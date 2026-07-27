/**
 * AIX-008 — Sandbox preview: request routing
 *
 * One place that decides what a backend-shaped request means and answers it
 * from the store. Routing is by *path*, not by host, because the whole point is
 * that the sandbox does not care whether a backend is configured, reachable, or
 * real — a preview of unaccepted work must never depend on any of the three.
 *
 * `respond` returns `null` for anything that should reach the network
 * untouched (the viewer's own assets, source maps, the WS upgrade). Everything
 * else gets an answer, including endpoints nobody here recognises: a
 * synthesized empty 200 keeps a graph moving where a 404 would strand it.
 *
 * @module noodl-runtime/sandbox/responder
 */

import { sandboxUser } from './synth';
import type { SandboxStore } from './store';
import type { SandboxRecord } from './types';

export interface SandboxRequest {
  method: string;
  url: string;
  /** Parsed request body, when there was one. */
  body?: unknown;
}

export interface SandboxResponse {
  status: number;
  body: unknown;
}

/** Paths the sandbox must not touch: the viewer's own origin-relative assets. */
const PASSTHROUGH = [
  /\.(js|css|map|png|jpe?g|gif|svg|woff2?|ttf|ico|html|json5?)($|\?)/i,
  /^\/?noodl_modules\//,
  /^\/?static\//,
  /^\/?favicon/
];

function parsePath(url: string): { path: string; params: URLSearchParams } {
  // Endpoints can be absolute (`https://backend/items/x`), origin-relative
  // (`/classes/x`), or the string `undefined/classes/x` — which is what a
  // Parse client with no endpoint configured actually produces.
  const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '').replace(/^undefined/, '');
  const [rawPath, rawQuery] = withoutScheme.split('?');
  return { path: rawPath || '/', params: new URLSearchParams(rawQuery ?? '') };
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function asObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function jsonParam(params: URLSearchParams, key: string): Record<string, unknown> | undefined {
  const raw = params.get(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Parse's `{__op: 'Increment'}` and friends, applied against the stored record. */
function applyOps(record: SandboxRecord | undefined, data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const op = asObject(value).__op;
    if (op === 'Increment') {
      const amount = Number(asObject(value).amount) || 0;
      result[key] = (Number(record?.[key]) || 0) + amount;
    } else if (op === 'Delete') {
      result[key] = undefined;
    } else if (op === 'AddRelation' || op === 'RemoveRelation') {
      // Relations are not modelled; the write succeeds and changes nothing.
      continue;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function parseSession(store: SandboxStore) {
  return { ...store.user, sessionToken: String(store.user.sessionToken ?? 'r:sandbox-session') };
}

function respondParse(request: SandboxRequest, store: SandboxStore, path: string, params: URLSearchParams) {
  const parts = segments(path);
  const head = parts[0];
  const method = request.method.toUpperCase();
  const body = asObject(request.body);

  if (head === 'classes') {
    const className = parts[1];
    const objectId = parts[2];
    if (!className) return { status: 400, body: { error: 'No class' } };

    if (objectId) {
      if (method === 'DELETE') {
        store.remove(className, objectId);
        return { status: 200, body: {} };
      }
      if (method === 'PUT') {
        const existing = store.get(className, objectId);
        const updated = store.update(className, objectId, applyOps(existing, body));
        return { status: 200, body: updated ?? { updatedAt: new Date().toISOString() } };
      }
      const record = store.get(className, objectId);
      return record
        ? { status: 200, body: record }
        : { status: 404, body: { code: 101, error: 'Object not found.' } };
    }

    // A query is a POST carrying `_method: 'GET'` — Parse's tunnelled read.
    if (method === 'GET' || body._method === 'GET') {
      const query = {
        where: (body.where as Record<string, unknown>) ?? jsonParam(params, 'where'),
        limit: body.limit !== undefined ? Number(body.limit) : params.has('limit') ? Number(params.get('limit')) : undefined,
        skip: body.skip !== undefined ? Number(body.skip) : params.has('skip') ? Number(params.get('skip')) : undefined,
        order: (body.order as string) ?? params.get('order') ?? undefined,
        count: Boolean(body.count ?? params.get('count'))
      };
      const { results, count } = store.query(className, query);
      return { status: 200, body: query.count ? { results, count } : { results } };
    }

    if (method === 'POST') {
      const created = store.create(className, body);
      return { status: 201, body: { objectId: created.objectId, createdAt: created.createdAt } };
    }
  }

  if (head === 'aggregate') {
    const className = parts[1];
    const group = jsonParam(params, '$group') ?? jsonParam(params, 'group') ?? {};
    const match = jsonParam(params, '$match') ?? jsonParam(params, 'match');
    const { results } = store.query(className, { where: match });
    const row: Record<string, unknown> = {};

    for (const [key, spec] of Object.entries(group)) {
      if (key === '_id' || key === 'objectId') continue;
      const operator = Object.keys(asObject(spec))[0];
      const field = String(asObject(spec)[operator] ?? '').replace(/^\$/, '');
      const values = results.map((r) => r[field]).filter((v) => v !== undefined && v !== null);
      const numbers = values.map(Number).filter((n) => !Number.isNaN(n));

      if (operator === '$sum') row[key] = numbers.reduce((a, b) => a + b, 0);
      else if (operator === '$avg') row[key] = numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
      else if (operator === '$max') row[key] = numbers.length ? Math.max(...numbers) : 0;
      else if (operator === '$min') row[key] = numbers.length ? Math.min(...numbers) : 0;
      else if (operator === '$addToSet') row[key] = Array.from(new Set(values));
      else row[key] = numbers.length;
    }

    // `distinct=<field>` is a different shape: a flat list of values.
    const distinct = params.get('distinct');
    if (distinct) {
      return { status: 200, body: { results: Array.from(new Set(results.map((r) => r[distinct]))) } };
    }

    return { status: 200, body: { results: [row] } };
  }

  if (head === 'functions') {
    // Cloud functions are project code, not data — the sandbox cannot run them.
    // An empty success keeps the graph moving and says so in the console.
    console.log(`[sandbox] cloud function "${parts[1]}" answered with an empty result — preview data is simulated.`);
    return { status: 200, body: { result: {} } };
  }

  if (head === 'files') {
    const name = parts.slice(1).join('/') || 'file';
    return { status: 201, body: { name, url: `sandbox://files/${name}` } };
  }

  if (head === 'login' || head === 'users' || head === 'logout' || head === 'auth' || head === 'oauth') {
    return respondUser(request, store, parts, method, body);
  }

  if (path.includes('request_password_reset') || head === 'requestPasswordReset' || head === 'verificationEmailRequest') {
    return { status: 200, body: {} };
  }

  return undefined;
}

function respondUser(
  request: SandboxRequest,
  store: SandboxStore,
  parts: string[],
  method: string,
  body: Record<string, unknown>
): SandboxResponse {
  const head = parts[0];

  if (head === 'logout') return { status: 200, body: {} };

  if (head === 'login' || (head === 'users' && method === 'POST') || head === 'oauth' || head === 'auth') {
    // Any credentials are accepted: the sandbox exists so an auth wall cannot
    // hide what was built. The username the user typed is kept, so a "signed in
    // as" label reads as theirs.
    if (typeof body.username === 'string' && body.username) store.user.username = body.username;
    if (typeof body.email === 'string' && body.email) store.user.email = body.email;
    if (head === 'auth' && parts[1] === 'providers') return { status: 200, body: { providers: [] } };
    return { status: 200, body: parseSession(store) };
  }

  if (head === 'users' && parts[1] === 'me') return { status: 200, body: parseSession(store) };

  if (head === 'users' && parts[1] && method === 'PUT') {
    Object.assign(store.user, applyOps(store.user, body));
    return { status: 200, body: { updatedAt: new Date().toISOString() } };
  }

  if (head === 'users' && parts[1]) return { status: 200, body: parseSession(store) };

  return { status: 200, body: {} };
}

/** Directus/BYOB shape: `{ data, meta }`, records keyed by `id`. */
function respondByob(request: SandboxRequest, store: SandboxStore, path: string, params: URLSearchParams) {
  const parts = segments(path);
  const index = parts.indexOf('items');
  if (index === -1) return undefined;

  const collection = parts[index + 1];
  const recordId = parts[index + 2];
  const method = request.method.toUpperCase();
  const body = asObject(request.body);
  if (!collection) return undefined;

  if (recordId) {
    if (method === 'DELETE') {
      store.remove(collection, recordId);
      return { status: 200, body: { data: null } };
    }
    if (method === 'PATCH' || method === 'PUT') {
      const updated = store.update(collection, recordId, body);
      return { status: 200, body: { data: updated ?? null } };
    }
    const record = store.get(collection, recordId);
    return { status: record ? 200 : 404, body: { data: record ?? null } };
  }

  if (method === 'POST') {
    return { status: 200, body: { data: store.create(collection, body) } };
  }

  const limitParam = params.get('limit');
  const { results, count } = store.query(collection, {
    limit: limitParam ? Number(limitParam) : undefined,
    skip: params.has('offset') ? Number(params.get('offset')) : undefined,
    order: params.get('sort') ?? undefined,
    where: jsonParam(params, 'filter')
  });

  return { status: 200, body: { data: results, meta: { total_count: count, filter_count: count } } };
}

/**
 * Answer one request, or `null` to let it through to the network.
 */
export function respond(request: SandboxRequest, store: SandboxStore): SandboxResponse | null {
  const { path, params } = parsePath(request.url);

  if (PASSTHROUGH.some((pattern) => pattern.test(path))) return null;

  const parse = respondParse(request, store, path, params);
  if (parse) return parse;

  const byob = respondByob(request, store, path, params);
  if (byob) return byob;

  // Unknown endpoint — a REST node pointed somewhere the sandbox knows nothing
  // about. Answer rather than fail: nothing leaves the machine, and the graph
  // gets a value-shaped response instead of an error branch.
  console.log(`[sandbox] ${request.method} ${request.url} answered locally — the preview makes no real requests.`);
  return { status: 200, body: {} };
}

/** The dataset's user, or a fresh one when the editor supplied none. */
export function ensureUser(user: SandboxRecord | undefined): SandboxRecord {
  return user && typeof user.objectId === 'string' ? user : sandboxUser();
}
