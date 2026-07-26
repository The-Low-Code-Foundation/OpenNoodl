/**
 * Request correlation (BAK-009).
 *
 * One id follows a request from arrival to reply, and — for anything that
 * starts work — into the execution record that work writes. That is the whole
 * feature: given a line in an access log, an operator can find the execution it
 * caused; given a failing webhook, they can find the request that delivered it.
 * It is also the seam a tracing system would attach to later, which is why the
 * inbound header is honoured rather than always minted fresh.
 *
 * A caller-supplied `X-Request-Id` is echoed only if it is short and boring —
 * it lands in log lines and in the response header, so anything else would be a
 * log-injection primitive handed to an anonymous client.
 *
 * @module nodegx-backend/ops/request-id
 */

import * as crypto from 'crypto';
import type * as http from 'http';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Printable, non-whitespace, no control characters, bounded length. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._~+/=@:-]{1,128}$/;

export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** The inbound id if it is safe to echo, else a fresh one. */
export function resolveRequestId(req: Pick<http.IncomingMessage, 'headers'>): string {
  const raw = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate === 'string' && SAFE_REQUEST_ID.test(candidate)) return candidate;
  return generateRequestId();
}

/**
 * The id already assigned to this response, if any. Reading it back off the
 * header is deliberate — it means `sendError` (which is handed a response and
 * nothing else) can include the id in the error body without anyone
 * monkey-patching a field onto `http.ServerResponse`.
 */
export function requestIdOf(res: http.ServerResponse): string | undefined {
  const value = res.getHeader(REQUEST_ID_HEADER);
  return typeof value === 'string' ? value : undefined;
}
