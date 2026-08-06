/**
 * The one typed HTTP client for this package's specs (PLAT-004).
 *
 * Fifteen spec files each hand-rolled the same eight lines — fetch, try/catch
 * `res.json()`, return `{status, json}` — and every one of them declared
 * `let json: any = null`. That single `any` is what the ratchet was actually
 * measuring: it leaked outward into `(s: any) => s.nodeId`,
 * `(t: any) => t.name`, `(e: any) => e.status` at ~60 call sites, none of which
 * were assertions about anything. A field rename on either side of the wire
 * would have kept every one of those specs green.
 *
 * So the fix is the one PLAT-004 keeps arriving at: when a helper's type forces
 * a cast at every call site, the helper is what is wrong. `request<T>` is
 * generic, the caller names the payload it expects, and the payload types
 * themselves live at the PRODUCER (`src/**`) wherever the producer has one —
 * `WorkflowExecution`, `ExecutionWithSteps`, `OutFrame`, `SchemaResponse` — so
 * drift fails to compile where it is introduced rather than silently where it
 * is read.
 *
 * `T` defaults to `unknown` rather than `any` on purpose: an un-annotated call
 * gets a value it must narrow, not a value that pretends to be everything.
 */

/** What every helper here returns. `json` is `null` for a non-JSON body. */
export interface HttpResult<T> {
  status: number;
  /** Parsed body, or `null` when the response had no JSON body. */
  json: T;
  /** The raw body text, for the specs that assert on non-JSON responses. */
  text: string;
  headers: Headers;
}

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * Send `body` verbatim instead of JSON-encoding it. `body` must then be a
   * string or Buffer — the body-limit and file-upload specs post raw payloads.
   */
  raw?: boolean;
}

/**
 * One request. Sets `content-type: application/json` only when there is a body
 * to encode, because several routes distinguish "no body" from "empty body".
 */
export async function request<T = unknown>(
  base: string,
  method: string,
  pathName: string,
  options: RequestOptions = {}
): Promise<HttpResult<T>> {
  const { body, headers = {}, raw = false } = options;
  const hasBody = body !== undefined;

  const res = await fetch(`${base}${pathName}`, {
    method,
    headers: hasBody && !raw ? { 'content-type': 'application/json', ...headers } : headers,
    body: hasBody ? (raw ? (body as string | Buffer) : JSON.stringify(body)) : undefined
  });

  const text = await res.text();
  let json: T = null as T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    /* non-JSON body — `text` carries it */
  }

  return { status: res.status, json, text, headers: res.headers };
}

export const get = <T = unknown>(base: string, pathName: string, headers?: Record<string, string>) =>
  request<T>(base, 'GET', pathName, { headers });

export const post = <T = unknown>(
  base: string,
  pathName: string,
  body?: unknown,
  headers?: Record<string, string>
) => request<T>(base, 'POST', pathName, { body, headers });

export const put = <T = unknown>(
  base: string,
  pathName: string,
  body?: unknown,
  headers?: Record<string, string>
) => request<T>(base, 'PUT', pathName, { body, headers });

export const del = <T = unknown>(base: string, pathName: string, headers?: Record<string, string>) =>
  request<T>(base, 'DELETE', pathName, { headers });

/**
 * The admin credential a running backend minted for itself, read out of its own
 * data dir — exactly the way the editor's supervisor gets it.
 *
 * Needed by every spec that drives an admin route, which since FH-024 means
 * every spec that drives an admin route on a DEV-OPEN backend too: dev-open
 * used to relax the admin gate, and that is what made a default local backend's
 * admin API readable by any web page. Call it after `service.start()` — the
 * file is written by `SecurityState`'s constructor.
 */
export function adminToken(dataDir: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
  if (!secrets.adminToken) throw new Error(`no adminToken in ${dataDir}/secrets.json`);
  return secrets.adminToken as string;
}

/** `adminToken` as the header a request carries it in. */
export const adminHeaders = (dataDir: string): Record<string, string> => ({
  authorization: `Bearer ${adminToken(dataDir)}`
});

/**
 * A client bound to one base URL — the shape most spec files want, since `base`
 * is assigned in `beforeAll` and never changes afterwards. Taking a getter
 * rather than a string is what makes that work: `base` is still empty when the
 * client is constructed at describe-scope.
 *
 * `getDefaultHeaders` is the same trick for a credential: it is read per
 * request, not at construction, so a spec can pass `() => adminHeaders(dataDir)`
 * from describe-scope before the backend that mints the token exists. Per-call
 * headers win over it, so a spec can still drive the unauthenticated case.
 */
export function httpClient(getBase: () => string, getDefaultHeaders?: () => Record<string, string>) {
  const merge = (headers?: Record<string, string>) =>
    getDefaultHeaders ? { ...getDefaultHeaders(), ...(headers || {}) } : headers;
  return {
    request: <T = unknown>(method: string, pathName: string, options?: RequestOptions) =>
      request<T>(getBase(), method, pathName, { ...(options || {}), headers: merge(options?.headers) }),
    get: <T = unknown>(pathName: string, headers?: Record<string, string>) =>
      get<T>(getBase(), pathName, merge(headers)),
    post: <T = unknown>(pathName: string, body?: unknown, headers?: Record<string, string>) =>
      post<T>(getBase(), pathName, body, merge(headers)),
    put: <T = unknown>(pathName: string, body?: unknown, headers?: Record<string, string>) =>
      put<T>(getBase(), pathName, body, merge(headers)),
    del: <T = unknown>(pathName: string, headers?: Record<string, string>) =>
      del<T>(getBase(), pathName, merge(headers))
  };
}

// ============================================================================
// Parse-wire payloads the specs read back
// ============================================================================

/**
 * A record as the Parse-wire routes return it. The stored fields are genuinely
 * open — a collection is whatever the app writes — so the index signature is
 * the honest type; what it buys over `any` is that `objectId`, `createdAt` and
 * `updatedAt` are known to be there and known to be strings.
 */
export interface ParseRecord {
  objectId: string;
  createdAt?: string;
  updatedAt?: string;
  [field: string]: unknown;
}

/** `GET /classes/:collection` and the BYOB query routes. */
export interface ParseQueryResult<T = ParseRecord> {
  results: T[];
  count?: number;
}

/** `DELETE /classes/:c/:id`. */
export interface DeletedResponse {
  deleted: boolean;
  objectId: string;
}

/**
 * A user as `/users`, `/login` and `/me` return it. The session token rides
 * only on signup and login — the same "returned exactly once" shape the webhook
 * secret has — so it is optional rather than assumed present.
 */
export interface UserResponse extends ParseRecord {
  username?: string;
  sessionToken?: string;
  /**
   * ⚠️ **Absent for every account created before BCN-006's remainder**, and that
   * was the defect: a password signup never wrote the column, so `/users`,
   * `/login` and `/users/me` all omitted it and the `User` node's
   * `Email Verified` output read `undefined` for every user on this backend.
   */
  emailVerified?: boolean;
  /** Present on the error responses these routes share with everything else. */
  error?: string;
  code?: number;
}

/** The error envelope `HttpError` sends. */
export interface ErrorBody {
  error: string;
  code?: number | string;
  requestId?: string;
}

/**
 * Every body BAK-004's three sign-in suites read — the OIDC/GitHub callbacks,
 * the identity-linking routes and the admin auth surface.
 *
 * These three files landed after PLAT-004 slice 6 measured the package, each
 * carrying the same `let json: any = null` the rest of the suite had just shed,
 * so they are folded into the same convention rather than left as an exception.
 * Everything is optional because one helper serves success, error and redirect
 * responses alike; `authOutcome` and `authNotice` ride on the handoff redirect,
 * not on a JSON body, and are read from the parsed fragment.
 */
export interface AuthSpecBody {
  objectId?: string;
  username?: string;
  sessionToken?: string;
  email?: string;
  emailVerified?: boolean;
  hasPassword?: boolean;
  /** Never returned by any route — asserted absent, which is the point. */
  _hashed_password?: unknown;
  identities?: Array<Record<string, unknown>>;
  provider?: Record<string, unknown>;
  providers?: Array<Record<string, unknown>>;
  config?: Record<string, unknown>;
  entries?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
  authOutcome?: string;
  authNotice?: string;
  error?: string;
  code?: number | string;
}

/**
 * `sessionToken` and `identities` are optional above because one helper carries
 * success, error and redirect bodies alike. These narrow, and throw naming what
 * actually came back — a spec that fails here should say "the route returned no
 * session token", not read `undefined` off a request header two lines later.
 */
export function sessionHeader(json: AuthSpecBody): Record<string, string> {
  const token = json.sessionToken;
  if (!token) throw new Error(`Expected a sessionToken, got: ${JSON.stringify(json)}`);
  return { 'x-parse-session-token': token };
}

export function entriesOf(json: AuthSpecBody): Array<Record<string, unknown>> {
  const { entries } = json;
  if (!entries) throw new Error(`Expected an audit entries list, got: ${JSON.stringify(json)}`);
  return entries;
}

export function identitiesOf(json: AuthSpecBody): Array<Record<string, unknown>> {
  const { identities } = json;
  if (!identities) throw new Error(`Expected an identities list, got: ${JSON.stringify(json)}`);
  return identities;
}
