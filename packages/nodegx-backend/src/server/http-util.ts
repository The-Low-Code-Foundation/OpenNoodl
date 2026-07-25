/**
 * Small HTTP helpers shared by every route family. No framework — the service
 * keeps the plain-`http` approach the in-editor server used.
 *
 * @module nodegx-backend/server/http-util
 */

import type * as http from 'http';

const MAX_JSON_BODY = 10 * 1024 * 1024; // 10MB, matching the old server
const MAX_FILE_BODY = 50 * 1024 * 1024; // uploads get more headroom

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

/** Parsed request URL: pathname + decoded query params. */
export function parseURL(url: string): { pathname: string; query: Record<string, string> } {
  const [pathname, queryString] = url.split('?');
  const query: Record<string, string> = {};
  if (queryString) {
    for (const pair of queryString.split('&')) {
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.substring(0, eq);
      const value = eq === -1 ? '' : pair.substring(eq + 1);
      try {
        query[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, '%20'));
      } catch {
        query[key] = value;
      }
    }
  }
  return { pathname, query };
}

/** Read the request body as a Buffer (for file uploads). */
export function readRawBody(req: http.IncomingMessage, maxSize: number = MAX_FILE_BODY): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Read and JSON-parse the request body. Empty body parses to {}. */
export async function readJSONBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRawBody(req, MAX_JSON_BODY);
  const text = raw.toString('utf-8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export function sendJSON(
  res: http.ServerResponse,
  status: number,
  data: unknown,
  headers: Record<string, string> = {}
): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...CORS_HEADERS,
    ...headers
  });
  res.end(body);
}

/**
 * An HTTP-mappable error. `parseCode` carries the Parse error code the clients
 * read (`{ code, error }` body) — e.g. 101 object-not-found / invalid-login,
 * 202 username-taken, 209 invalid-session-token.
 */
export class HttpError extends Error {
  status: number;
  parseCode?: number;

  constructor(status: number, message: string, parseCode?: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.parseCode = parseCode;
  }
}

/** Send an error in the `{ code?, error }` shape all four runtime clients read. */
export function sendError(res: http.ServerResponse, err: unknown): void {
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.parseCode !== undefined) body.code = err.parseCode;
    sendJSON(res, err.status, body);
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  sendJSON(res, 500, { error: message });
}
