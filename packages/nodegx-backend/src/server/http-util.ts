/**
 * Small HTTP helpers shared by every route family. No framework — the service
 * keeps the plain-`http` approach the in-editor server used.
 *
 * @module nodegx-backend/server/http-util
 */

import type * as http from 'http';

import { requestIdOf } from '../ops/request-id';

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

/**
 * Read the request body as a Buffer (for file uploads).
 *
 * On overflow this stops consuming and rejects with a 413, but deliberately
 * does **not** destroy the request. It used to: `req.destroy()` tears down the
 * socket, so the 413 the caller then tried to write never reached the client —
 * the sender saw a bare `ECONNRESET` and had no idea it had hit a size limit.
 * Both call sites papered over that with their own Content-Length pre-check,
 * which only helps senders that declare a length.
 *
 * Instead the request is paused and left intact so the caller's error response
 * can be written. `sendError` marks 413s `Connection: close`, which is what
 * actually ends the socket — after the status has been flushed, and without
 * Node trying to parse the rest of the upload as a second pipelined request.
 */
export function readRawBody(req: http.IncomingMessage, maxSize: number = MAX_FILE_BODY): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    function settle(err: Error | null, value?: Buffer) {
      if (settled) return;
      settled = true;
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      if (err) {
        // Stop pulling bytes we have already decided to refuse. The socket
        // stays open exactly long enough for the response.
        req.pause();
        reject(err);
      } else {
        resolve(value as Buffer);
      }
    }

    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxSize) {
        settle(new HttpError(413, 'Request body too large'));
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => settle(null, Buffer.concat(chunks));
    const onError = (err: Error) => settle(err);

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
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

/**
 * Send an error in the `{ code?, error }` shape all four runtime clients read.
 *
 * BAK-009 adds `requestId` when the dispatcher assigned one: an error a user
 * screenshots is then enough to find the exact log line and execution record
 * behind it, without asking them what time it happened.
 */
export function sendError(res: http.ServerResponse, err: unknown): void {
  const requestId = requestIdOf(res);
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { error: err.message };
    if (err.parseCode !== undefined) body.code = err.parseCode;
    if (requestId) body.requestId = requestId;
    // A 413 is raised while the body is still arriving, so the rest of it is
    // still in flight on this socket. Keeping the connection alive would leave
    // Node trying to read those bytes as the next pipelined request; closing
    // after the response is what lets the client actually read the status.
    sendJSON(res, err.status, body, err.status === 413 ? { Connection: 'close' } : {});
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  sendJSON(res, 500, requestId ? { error: message, requestId } : { error: message });
}
