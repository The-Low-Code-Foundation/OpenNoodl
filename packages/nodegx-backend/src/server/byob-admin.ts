/**
 * BYOB + admin route families.
 *
 * BYOB (`/api/:table`) is the existing local-backend REST surface the BYOB
 * nodes and the Data Browser speak — moved from the in-editor
 * `LocalBackendServer.js`, with one fix: the old handlers `await`ed the
 * adapter's callback-style methods (which return undefined), so they could
 * never actually answer with data. They now go through AdapterFacade.
 * Responses stay storage-shaped (no Parse `__type` envelopes) — that is the
 * shape these clients have always been written against.
 *
 * Admin (`/admin/*`, `/executions*`) is the supervisor-facing surface the
 * editor's BackendManager proxies its IPC handlers to. It is what replaces the
 * in-process `server.getAdapter()` reach-ins.
 *
 * @module nodegx-backend/server/byob-admin
 */

import type * as http from 'http';

import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { WorkflowRunner } from '../workflow/WorkflowRunner';
import type { RequestContext } from './HttpServer';
import type { ClpOp } from '../security/model';
import type { SchemaColumnLike } from '../persistence/SchemaManagerLike';
import { validateAclShape } from '../security/model';
import { HttpError, readJSONBody, sendJSON } from './http-util';

function parseJSON(value: string | undefined, name: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new HttpError(400, `Invalid ${name} parameter`);
  }
}

/**
 * SPR-001/F84 — a write through `/api/:table` may set `ACL`, so it has to be
 * shape-checked here too.
 *
 * `stampCreate` has validated the create path since BAK-003 and `classPut`
 * validates the Parse-wire update, but this route — the one the Data Browser
 * writes through — did not. `{"ACL": {"someone": 5}}` was stored verbatim, and
 * a mis-shaped ACL is not inert: `canAccessRecord` matches on
 * `entry[access] === true`, so a nonsense entry silently means *nobody*.
 * Now that F84 puts an editable ACL cell in front of people, a typo there must
 * come back as a 400 the panel can show, not as a row that has quietly
 * disappeared for every caller.
 *
 * `null`/`undefined` stay legal — that is how an ACL is cleared.
 */
function assertAclShape(data: Record<string, unknown> | undefined | null): void {
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'ACL')) return;
  const error = validateAclShape(data.ACL);
  if (error) throw new HttpError(400, `Invalid ACL: ${error}`, 123);
}

/**
 * One table as `/admin/schema` describes it. `columns` is `unknown[]` because
 * the SchemaManager it comes from is untyped JS in `@noodl/runtime` — that part
 * is PLAT-003's, not this task's — but the envelope around it is knowable and
 * is what every consumer actually indexes into.
 */
export interface SchemaTable {
  name: string;
  columns: unknown[];
  createdAt: string | null;
}

/** `GET /admin/schema` and `GET /api/_schema`. */
export interface SchemaResponse {
  tables: SchemaTable[];
}

/** `GET /admin/schema/:table`. */
export interface TableSchemaResponse {
  name: string;
  columns: unknown[];
}

/** `POST /admin/schema` — one of the five mutation actions. */
export interface SchemaMutationResponse {
  success: boolean;
  action: 'createTable' | 'addColumn' | 'renameColumn' | 'changeColumnType' | 'deleteTable';
  table: string;
  /** Present on createTable / deleteTable: whether the DDL actually ran. */
  created?: boolean;
  deleted?: boolean;
  // ── changeColumnType (AAQ-002) ────────────────────────────────────────────
  /** Whether the column's type actually moved (false when it already matched). */
  changed?: boolean;
  /** The type it had before. */
  from?: string;
  /** Whether stored values had to be converted, rather than metadata alone. */
  rebuilt?: boolean;
  /** How many non-null values went through `CAST`, and so could have been lost. */
  convertedValues?: number;
}

export class ByobAdminRoutes {
  private readonly facade: AdapterFacade;
  private readonly executions: ExecutionHistory;
  private readonly getRunner: () => WorkflowRunner | null;

  constructor(facade: AdapterFacade, executions: ExecutionHistory, getRunner: () => WorkflowRunner | null) {
    this.facade = facade;
    this.executions = executions;
    this.getRunner = getRunner;
  }

  // ==========================================================================
  // BYOB: /api/:table
  // ==========================================================================

  async query(ctx: RequestContext): Promise<void> {
    const query = ctx.query;
    const options = {
      where: parseJSON(query.where, 'where'),
      sort: parseJSON(query.sort, 'sort') as unknown as string[] | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 100,
      skip: query.skip ? parseInt(query.skip, 10) : 0,
      count: query.count === '1' || query.count === 'true',
      acl: ctx.acl('read')
    };
    const { results, count } = await this.facade.rawQuery(ctx.params.table, options);
    sendJSON(ctx.res, 200, { results, count: count !== undefined ? count : results.length });
  }

  async fetch(ctx: RequestContext): Promise<void> {
    try {
      const record = await this.facade.rawFetch(ctx.params.table, ctx.params.id, ctx.acl('read'));
      sendJSON(ctx.res, 200, record);
    } catch {
      throw new HttpError(404, 'Record not found');
    }
  }

  async create(ctx: RequestContext): Promise<void> {
    const data = await readJSONBody(ctx.req);
    ctx.stampCreate(ctx.params.table, data);
    const record = await this.facade.rawCreate(ctx.params.table, data);
    sendJSON(ctx.res, 201, record);
  }

  async save(ctx: RequestContext): Promise<void> {
    const data = await readJSONBody(ctx.req);
    assertAclShape(data);
    try {
      const record = await this.facade.rawSave(ctx.params.table, ctx.params.id, data, ctx.acl('write'));
      sendJSON(ctx.res, 200, record);
    } catch {
      throw new HttpError(404, 'Record not found');
    }
  }

  async delete(ctx: RequestContext): Promise<void> {
    // POL-014 slice 2. The adapter's DELETE only reports "Object not found" when
    // an ACL predicate is in play; an admin delete of a row that isn't there
    // removes nothing, throws nothing, and this route answered `{deleted: true}`
    // — which is how the Data Browser could accept a confirm, delete nothing and
    // show no error. `fetch` and `save` already 404 for a missing row; so does
    // this now, and for the same reason.
    // The probe is a `fetch` under the *write* ACL, not `existsSync`: it is the
    // same query `GET /api/:table/:id` runs, so it behaves identically in
    // ephemeral (mock-SQL) mode, and a row the caller may not write answers like
    // a missing one — which is the existence hiding the adapter already does.
    try {
      await this.facade.rawFetch(ctx.params.table, ctx.params.id, ctx.acl('write'));
    } catch {
      throw new HttpError(404, 'Record not found');
    }
    try {
      await this.facade.rawDelete(ctx.params.table, ctx.params.id, ctx.acl('write'));
    } catch {
      throw new HttpError(404, 'Record not found');
    }
    sendJSON(ctx.res, 200, { deleted: true, objectId: ctx.params.id });
  }

  async batch(ctx: RequestContext): Promise<void> {
    const body = await readJSONBody(ctx.req);
    const operations = body.operations;
    if (!Array.isArray(operations)) {
      throw new HttpError(400, 'operations must be an array');
    }

    const results: unknown[] = [];
    for (const op of operations as Record<string, unknown>[]) {
      try {
        // Per-operation enforcement: the batch route can't be gated as a whole
        // (each op names its own collection and method).
        const collection = op.collection as string;
        const clpOp: ClpOp = op.method === 'create' ? 'create' : op.method === 'save' ? 'update' : 'delete';
        switch (op.method) {
          case 'create': {
            ctx.checkData(collection, clpOp);
            const data = (op.data as Record<string, unknown>) || {};
            ctx.stampCreate(collection, data);
            results.push(await this.facade.rawCreate(collection, data));
            break;
          }
          case 'save':
            ctx.checkData(collection, clpOp);
            assertAclShape(op.data as Record<string, unknown>);
            await this.facade.rawSave(
              collection,
              op.objectId as string,
              op.data as Record<string, unknown>,
              ctx.acl('write')
            );
            results.push({ success: true });
            break;
          case 'delete':
            ctx.checkData(collection, clpOp);
            await this.facade.rawDelete(collection, op.objectId as string, ctx.acl('write'));
            results.push({ deleted: true });
            break;
          default:
            results.push({ error: `Unknown method: ${String(op.method)}` });
        }
      } catch (e) {
        results.push({ error: e instanceof Error ? e.message : String(e) });
      }
    }

    sendJSON(ctx.res, 200, { results });
  }

  // ==========================================================================
  // Schema: /api/_schema (BYOB-compat) + /admin/schema
  // ==========================================================================

  getSchema(res: http.ServerResponse): void {
    const sm = this.facade.schemaManager;
    if (!sm) throw new HttpError(500, 'Schema manager not available');
    const tables: string[] = sm.listTables();
    const schemas: { name: string; columns?: unknown[]; createdAt?: string }[] = sm.exportSchemas();
    sendJSON(res, 200, {
      tables: tables.map((name) => {
        const schema = schemas.find((s) => s.name === name);
        return { name, columns: schema?.columns || [], createdAt: schema?.createdAt || null };
      })
    } satisfies SchemaResponse);
  }

  getTableSchema(res: http.ServerResponse, tableName: string): void {
    const sm = this.facade.schemaManager;
    if (!sm) throw new HttpError(500, 'Schema manager not available');
    const schema = sm.getTableSchema(tableName);
    if (!schema) throw new HttpError(404, `No such table: ${tableName}`);
    sendJSON(res, 200, { name: tableName, columns: schema.columns || [] } satisfies TableSchemaResponse);
  }

  async mutateSchema(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await readJSONBody(req);
    const sm = this.facade.schemaManager;
    if (!sm) throw new HttpError(500, 'Schema manager not available');

    // Unvalidated wire values: the SchemaManager is the validator and throws.
    // Each conversion is written down here rather than the whole `sm` arriving
    // as `any`, which is how these five reads used to typecheck (PLAT-004).
    const table = body.table as string;
    switch (body.action) {
      case 'createTable': {
        const created = sm.createTable({
          name: table,
          columns: (body.columns as SchemaColumnLike[] | undefined) || []
        });
        sendJSON(res, 200, { success: true, action: 'createTable', created, table } satisfies SchemaMutationResponse);
        return;
      }
      case 'addColumn':
        sm.addColumn(table, body.column as SchemaColumnLike);
        sendJSON(res, 200, { success: true, action: 'addColumn', table } satisfies SchemaMutationResponse);
        return;
      case 'renameColumn':
        sm.renameColumn(table, body.oldName as string, body.newName as string);
        sendJSON(res, 200, { success: true, action: 'renameColumn', table } satisfies SchemaMutationResponse);
        return;
      case 'changeColumnType': {
        // AAQ-002. Optional on the interface (an older adapter predates it), so
        // its absence is a 501 rather than an `is not a function` at request time.
        if (typeof sm.changeColumnType !== 'function') {
          throw new HttpError(501, 'This adapter cannot change a column type.');
        }
        const result = sm.changeColumnType(table, body.column as string, body.type as string);
        sendJSON(res, 200, {
          success: true,
          action: 'changeColumnType',
          table,
          ...result
        } satisfies SchemaMutationResponse);
        return;
      }
      case 'deleteTable': {
        // `deleteTable` is optional on the interface because `schema-migrate`
        // feature-detects it; here its absence is a real 501, not a crash.
        if (typeof sm.deleteTable !== 'function') {
          throw new HttpError(501, 'This adapter cannot delete tables.');
        }
        const deleted = sm.deleteTable(table);
        sendJSON(res, 200, { success: true, action: 'deleteTable', deleted, table } satisfies SchemaMutationResponse);
        return;
      }
      default:
        throw new HttpError(400, `Unknown schema action: ${String(body.action)}`);
    }
  }

  exportSchema(res: http.ServerResponse, format: string): void {
    const sm = this.facade.schemaManager;
    if (!sm) throw new HttpError(500, 'Schema manager not available');

    let content: string;
    if (format === 'postgres') content = sm.generatePostgresSQL();
    else if (format === 'supabase') content = sm.generateSupabaseSQL();
    else content = JSON.stringify(sm.exportSchemas(), null, 2);

    sendJSON(res, 200, { format: format || 'json', content });
  }

  // ==========================================================================
  // Workflows: /admin/workflows*
  // ==========================================================================

  workflowStatus(res: http.ServerResponse): void {
    const runner = this.getRunner();
    sendJSON(res, 200, runner ? runner.getStatus() : { initialized: false, workflowCount: 0, functions: [] });
  }

  async updateWorkflow(req: http.IncomingMessage, res: http.ServerResponse, name: string): Promise<void> {
    const runner = this.getRunner();
    if (!runner) throw new HttpError(503, 'Workflows not initialized');
    const body = await readJSONBody(req);
    const result = await runner.loadWorkflow(name, body);
    sendJSON(res, result.success ? 200 : 500, result);
  }

  async deleteWorkflow(res: http.ServerResponse, name: string): Promise<void> {
    const runner = this.getRunner();
    if (!runner) throw new HttpError(503, 'Workflows not initialized');
    const result = await runner.deleteWorkflow(name);
    sendJSON(res, result.success ? 200 : 500, result);
  }

  async reloadWorkflows(res: http.ServerResponse): Promise<void> {
    const runner = this.getRunner();
    if (!runner) throw new HttpError(503, 'Workflows not initialized');
    const result = await runner.reloadWorkflows();
    sendJSON(res, 200, result);
  }

  // ==========================================================================
  // Executions: /executions*
  // ==========================================================================

  listExecutions(res: http.ServerResponse, query: Record<string, string>): void {
    const result = this.executions.list({
      workflowId: query.workflowId || undefined,
      status: query.status || undefined,
      triggerType: query.triggerType || undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
      startedAfter: query.startedAfter ? parseInt(query.startedAfter, 10) : undefined,
      startedBefore: query.startedBefore ? parseInt(query.startedBefore, 10) : undefined
    });
    sendJSON(res, 200, result);
  }

  getExecution(res: http.ServerResponse, id: string): void {
    const result = this.executions.get(id);
    if (!result) throw new HttpError(404, 'Execution not found');
    sendJSON(res, 200, result);
  }
}
