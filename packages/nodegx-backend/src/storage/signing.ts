/**
 * Signed file URLs (BAK-006) — the mechanism that lets `<img src>` reach a
 * PRIVATE file without a session token (an `<img>` tag cannot set a custom
 * header). Unrelated to S3's SigV4 (./sigv4.ts signs THIS service's own
 * outbound requests to an S3-compatible backend); this HMAC scheme signs URLS
 * THIS service hands OUT to its own callers.
 *
 * ## Scheme
 *
 * `GET /files/:storedName?exp=<unixSeconds>&sig=<hex hmac-sha256>`
 * where `sig = HMAC-SHA256(secret, "<storedName>:<exp>")`. Path-scoped (the
 * signature only ever covers ONE stored name) and time-scoped (an `exp` in
 * the past is refused regardless of how the signature checks out) — a leaked
 * URL grants exactly one file for a bounded window, nothing else.
 *
 * ## TTL — decided and recorded (BAK-006-NOTES §signed-url-ttl)
 *
 * Default 5 minutes (300s). Short enough that a URL leaked via a referrer
 * header or a browser history entry is worthless soon after; long enough that
 * a page load plus a few retried image requests never race it. `GET
 * /files/:name/sign` mints a FRESH one on demand — the intended pattern is
 * "sign right before you render", not "sign once and persist the URL",
 * because a persisted `CloudFile.url` for a private file is a URL that WILL
 * expire (see FileRoutes' module doc for the full policy this implies for
 * `<img src>` on private files).
 *
 * The secret lives in secrets.json under the `files` namespace (SecretsStore
 * convention), auto-minted on first use, never rotated automatically (a
 * rotation invalidates every outstanding signed URL, including ones already
 * rendered on an open page — an operator's deliberate action, not automatic).
 *
 * @module nodegx-backend/storage/signing
 */

import * as crypto from 'crypto';

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

function hmacHex(secret: string, message: string): string {
  return crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex');
}

/** Constant-time compare (hash both sides first to erase length information). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

export interface SignedFileUrlParams {
  exp: number;
  sig: string;
}

/** Sign `storedName`, expiring `ttlSeconds` from now (default 300s). */
export function signFileAccess(secret: string, storedName: string, ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS, now = () => Date.now()): SignedFileUrlParams {
  const exp = Math.floor(now() / 1000) + Math.max(1, Math.floor(ttlSeconds));
  const sig = hmacHex(secret, `${storedName}:${exp}`);
  return { exp, sig };
}

/** Verify a presented `exp`/`sig` pair for `storedName`. False on any mismatch OR expiry. */
export function verifyFileAccess(secret: string, storedName: string, exp: number, sig: string, now = () => Date.now()): boolean {
  if (!Number.isFinite(exp) || !sig) return false;
  if (Math.floor(now() / 1000) > exp) return false;
  const expected = hmacHex(secret, `${storedName}:${exp}`);
  return safeEqual(expected, sig);
}
