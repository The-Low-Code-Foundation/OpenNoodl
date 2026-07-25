/**
 * Parse-wire data routes — the subset the runtime clients actually emit
 * (`cloudstore.js`, `configservice.js`; sessions live in ./users.ts, functions
 * in the HttpServer against the WorkflowRunner):
 *
 *   POST   /classes/:c            query (body._method === 'GET') or create
 *   GET    /classes/:c            query via query-string (count calls)
 *   GET    /classes/:c/:id        fetch (include=)
 *   PUT    /classes/:c/:id        save / Increment / AddRelation / RemoveRelation
 *   DELETE /classes/:c/:id        delete
 *   GET    /aggregate/:c          group aggregates + distinct
 *   GET    /config                { params }
 *
 * Explicitly NOT implemented (the clients never call them): live queries, push,
 * GraphQL, client schema/ACL management.
 *
 * @module nodegx-backend/server/parse-wire
 */

import type * as http from 'http';

import type { AdapterFacade, QueryOptions } from '../persistence/AdapterFacade';
import { HttpError, readJSONBody, sendJSON } from './http-util';

function parseJSONParam(value: string | undefined, name: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(400, `Invalid ${name} parameter`);
  }
}

/** Map the wire query fields (from body or query-string) to adapter options. */
function toQueryOptions(src: Record<string, unknown>): QueryOptions {
  const options: QueryOptions = {};
  if (src.where !== undefined) {
    options.where =
      typeof src.where === 'string' ? parseJSONParam(src.where as string, 'where') : (src.where as Record<string, unknown>);
  }
  if (src.limit !== undefined) options.limit = parseInt(String(src.limit), 10);
  if (src.skip !== undefined) options.skip = parseInt(String(src.skip), 10);
  if (src.order !== undefined && src.order !== null && src.order !== '') {
    options.sort = String(src.order)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (src.keys !== undefined && src.keys !== null && src.keys !== '') {
    options.select = String(src.keys)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (src.include !== undefined && src.include !== null && src.include !== '') {
    options.include = String(src.include)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (src.count !== undefined && src.count !== null && String(src.count) !== '0' && src.count !== false) {
    options.count = true;
  }
  return options;
}

/** True when a PUT body is an operator update (`__op` values). */
function extractOps(body: Record<string, unknown>): {
  increments: Record<string, number>;
  addRelations: { key: string; targetObjectId: string }[];
  removeRelations: { key: string; targetObjectId: string }[];
  plain: Record<string, unknown>;
} {
  const increments: Record<string, number> = {};
  const addRelations: { key: string; targetObjectId: string }[] = [];
  const removeRelations: { key: string; targetObjectId: string }[] = [];
  const plain: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    const op = value && typeof value === 'object' ? (value as Record<string, unknown>).__op : undefined;
    if (op === 'Increment') {
      increments[key] = Number((value as Record<string, unknown>).amount) || 0;
    } else if (op === 'AddRelation' || op === 'RemoveRelation') {
      const objects = ((value as Record<string, unknown>).objects as Record<string, unknown>[]) || [];
      for (const obj of objects) {
        const entry = { key, targetObjectId: String(obj.objectId) };
        (op === 'AddRelation' ? addRelations : removeRelations).push(entry);
      }
    } else {
      plain[key] = value;
    }
  }

  return { increments, addRelations, removeRelations, plain };
}

export class ParseWireRoutes {
  private readonly facade: AdapterFacade;
  private readonly getConfigParams: () => Record<string, unknown>;

  constructor(facade: AdapterFacade, getConfigParams: () => Record<string, unknown>) {
    this.facade = facade;
    this.getConfigParams = getConfigParams;
  }

  /** POST /classes/:collection — Parse's query-tunnelling or a create. */
  async classesPost(req: http.IncomingMessage, res: http.ServerResponse, collection: string): Promise<void> {
    const body = await readJSONBody(req);

    if (body._method === 'GET') {
      const result = await this.facade.wireQuery(collection, toQueryOptions(body));
      sendJSON(res, 200, result);
      return;
    }

    delete body.ACL;
    delete body._method;
    const record = await this.facade.rawCreate(collection, body);
    // Parse's create response: objectId + createdAt only. The client merges its
    // own data over this — returning wire-typed fields here would leak `__type`
    // envelopes into model data un-deserialized (create responses skip
    // _deserializeJSON on the client).
    sendJSON(res, 201, { objectId: record.objectId, createdAt: record.createdAt });
  }

  /** GET /classes/:collection — used by count() with where/limit/count params. */
  async classesGet(res: http.ServerResponse, collection: string, query: Record<string, string>): Promise<void> {
    const result = await this.facade.wireQuery(collection, toQueryOptions(query));
    sendJSON(res, 200, result);
  }

  /** GET /classes/:collection/:id */
  async classGet(
    res: http.ServerResponse,
    collection: string,
    objectId: string,
    query: Record<string, string>
  ): Promise<void> {
    try {
      const record = await this.facade.wireFetch(collection, objectId, query.include);
      sendJSON(res, 200, record);
    } catch {
      throw new HttpError(404, 'Object not found.', 101);
    }
  }

  /** PUT /classes/:collection/:id — save and/or __op updates. */
  async classPut(req: http.IncomingMessage, res: http.ServerResponse, collection: string, objectId: string): Promise<void> {
    const body = await readJSONBody(req);
    delete body.ACL;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.objectId;

    const { increments, addRelations, removeRelations, plain } = extractOps(body);

    let updated: Record<string, unknown> | null = null;
    if (Object.keys(plain).length > 0) {
      updated = await this.facade.rawSave(collection, objectId, plain);
    }
    if (Object.keys(increments).length > 0) {
      updated = await this.facade.rawIncrement(collection, objectId, increments);
    }
    for (const rel of addRelations) {
      await this.facade.addRelation(collection, objectId, rel.key, rel.targetObjectId);
    }
    for (const rel of removeRelations) {
      await this.facade.removeRelation(collection, objectId, rel.key, rel.targetObjectId);
    }

    const response: Record<string, unknown> = {
      updatedAt: (updated && updated.updatedAt) || new Date().toISOString()
    };
    // Parse echoes incremented counters (plain numbers) in the PUT response.
    if (updated) {
      for (const key of Object.keys(increments)) response[key] = updated[key];
    }
    sendJSON(res, 200, response);
  }

  /** DELETE /classes/:collection/:id */
  async classDelete(res: http.ServerResponse, collection: string, objectId: string): Promise<void> {
    await this.facade.rawDelete(collection, objectId);
    sendJSON(res, 200, {});
  }

  /**
   * GET /aggregate/:collection — the two shapes `cloudstore.js` emits:
   * `distinct=<prop>` and `group=`/`$group=` (+ `match=`/`$match=`) with
   * `$avg`/`$sum`/`$max`/`$min`/`$addToSet` accessors.
   */
  async aggregate(res: http.ServerResponse, collection: string, query: Record<string, string>): Promise<void> {
    const where = parseJSONParam(query.match || query.$match || query.where, 'match');

    if (query.distinct) {
      const results = await this.facade.rawDistinct(collection, query.distinct, where);
      sendJSON(res, 200, { results });
      return;
    }

    const groupRaw = parseJSONParam(query.group || query.$group, 'group');
    if (!groupRaw) {
      throw new HttpError(400, 'Aggregate requires group or distinct');
    }

    // {$avg: '$field'} -> {avg: 'field'}; the group's _id/objectId key is
    // Parse-wire grouping noise our single-group aggregate ignores.
    const group: Record<string, Record<string, string>> = {};
    for (const [alias, accessor] of Object.entries(groupRaw)) {
      if (alias === '_id' || alias === 'objectId') continue;
      if (!accessor || typeof accessor !== 'object') continue;
      for (const [op, field] of Object.entries(accessor as Record<string, string>)) {
        const cleanOp = op.replace(/^\$/, '').replace(/^addToSet$/, 'distinct');
        group[alias] = { [cleanOp]: String(field).replace(/^\$/, '') };
      }
    }

    const result = await this.facade.rawAggregate(collection, group, where);
    sendJSON(res, 200, { results: [result] });
  }

  /** GET /config */
  config(res: http.ServerResponse): void {
    sendJSON(res, 200, { params: this.getConfigParams() });
  }
}
