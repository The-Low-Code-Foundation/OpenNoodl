/**
 * AWS Signature Version 4 — a from-scratch, zero-dependency implementation
 * for `S3Driver` (BAK-006).
 *
 * ## Why hand-rolled instead of an SDK
 *
 * The AWS SDK for JavaScript (v3) is dozens of packages and a credential
 * provider chain built for the full AWS surface; this driver needs exactly
 * one thing from it — a signed HTTP request against an S3-compatible PUT/GET/
 * DELETE/HEAD endpoint. SigV4 itself is a short, fully-specified, versioned
 * algorithm (unlike e.g. cron syntax, there is exactly one correct output per
 * input) — precisely the shape of dependency BAK-007 already decided to hand-
 * roll rather than pull in (tar) and the shape node:sqlite's build.js `external`
 * comment calls out generally: this package ships as ONE bundled file with no
 * node_modules resolution at runtime, so every dependency is either a Node
 * builtin, something already vendored (esbuild bundles pure JS fine), or, for
 * anything native or heavy, deliberately absent. An S3 SDK is neither of the
 * first two. Zero new dependency, zero "worktree doesn't have it installed"
 * risk, zero bundle-size cost. Documented in BAK-006-NOTES.
 *
 * ## Correctness
 *
 * This implementation is verified against AWS's own published SigV4 conformance
 * suite (the `aws4_testsuite` fixtures also used by the SDKs themselves) in
 * `tests/sigv4.test.ts` — canonical request, string-to-sign, and the final
 * Authorization header are asserted byte-for-byte against real AWS fixtures,
 * not a self-consistency check. Only the header-based ("Authorization:")
 * signing path is implemented; query-string presigning is not needed (this
 * driver always sends its own credentials, never hands a browser a presigned
 * S3 URL — BAK-006's signed URLs are this SERVICE's own HMAC scheme, see
 * ./signing.ts, unrelated to SigV4).
 *
 * Spec followed: docs.aws.amazon.com "Create a signed AWS API request"
 * (fetched live while writing this — general/latest/gr/sigv4-signed-request-
 * examples.html).
 *
 * @module nodegx-backend/storage/sigv4
 */

import * as crypto from 'crypto';

export interface SigV4Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
}

export interface CanonicalRequestInput {
  method: string;
  /** Already a raw (un-encoded) absolute path, e.g. "/bucket/a b.png". Segments get URI-encoded here. */
  path: string;
  /** Raw (un-encoded) key/value pairs — an array, not an object, so duplicate keys are representable. */
  query?: Array<[string, string]>;
  /** Header name (any case) -> value. Must include at least `host`. */
  headers: Record<string, string>;
  /** Hex sha256 of the body, or the literal "UNSIGNED-PAYLOAD" (S3 permits this). */
  payloadHash: string;
}

function sha256hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

/**
 * URI-encode one path segment or query component per SigV4's rules: encode
 * every byte except unreserved characters (A-Z a-z 0-9 - _ . ~). Space becomes
 * %20 (never `+`). All hex digits uppercase, matching AWS's own encoder.
 */
export function uriEncode(value: string, encodeSlash = true): string {
  return Buffer.from(value, 'utf8')
    .toString('binary')
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      const isUnreserved =
        (code >= 0x41 && code <= 0x5a) || // A-Z
        (code >= 0x61 && code <= 0x7a) || // a-z
        (code >= 0x30 && code <= 0x39) || // 0-9
        ch === '-' ||
        ch === '_' ||
        ch === '.' ||
        ch === '~';
      if (isUnreserved) return ch;
      if (ch === '/' && !encodeSlash) return '/';
      return '%' + code.toString(16).toUpperCase().padStart(2, '0');
    })
    .join('');
}

/** The canonical URI: each `/`-separated segment individually URI-encoded, `/` preserved. */
function canonicalUri(path: string): string {
  if (!path || path === '/') return '/';
  return path
    .split('/')
    .map((seg) => uriEncode(seg, true))
    .join('/');
}

/**
 * URI-encoded `k=v&k2=v2` query string, sorted alphabetically by key AFTER
 * encoding — ties (duplicate keys) broken by encoded value, matching AWS's
 * `get-vanilla-query-order-key` fixture (`Param1=value2&Param1=Value1` sorts
 * to `Param1=Value1&Param1=value2`: uppercase sorts before lowercase in byte
 * order).
 */
function canonicalQueryString(query: Array<[string, string]> | undefined): string {
  if (!query || query.length === 0) return '';
  const encoded = query.map(([k, v]) => [uriEncode(k), uriEncode(v)] as [string, string]);
  encoded.sort(([ka, va], [kb, vb]) => (ka < kb ? -1 : ka > kb ? 1 : va < vb ? -1 : va > vb ? 1 : 0));
  return encoded.map(([k, v]) => `${k}=${v}`).join('&');
}

interface CanonicalHeadersResult {
  canonicalHeaders: string;
  signedHeaders: string;
}

/** Lowercased, sorted, trimmed `name:value\n` block + the `;`-joined signed-header list. */
function canonicalHeaders(headers: Record<string, string>): CanonicalHeadersResult {
  const entries = Object.entries(headers).map(
    ([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, ' ')] as [string, string]
  );
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const canonicalHeadersStr = entries.map(([k, v]) => `${k}:${v}\n`).join('');
  const signedHeaders = entries.map(([k]) => k).join(';');
  return { canonicalHeaders: canonicalHeadersStr, signedHeaders };
}

export function canonicalRequest(input: CanonicalRequestInput): { creq: string; signedHeaders: string } {
  const { canonicalHeaders: ch, signedHeaders } = canonicalHeaders(input.headers);
  const creq = [
    input.method.toUpperCase(),
    canonicalUri(input.path),
    canonicalQueryString(input.query),
    ch,
    signedHeaders,
    input.payloadHash
  ].join('\n');
  return { creq, signedHeaders };
}

/** `YYYYMMDD` from an `YYYYMMDDTHHMMSSZ` amz-date string. */
function dateStampOf(amzDate: string): string {
  return amzDate.slice(0, 8);
}

export function credentialScope(amzDate: string, creds: SigV4Credentials): string {
  return `${dateStampOf(amzDate)}/${creds.region}/${creds.service}/aws4_request`;
}

export function stringToSign(amzDate: string, scope: string, hashedCanonicalRequest: string): string {
  return `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hashedCanonicalRequest}`;
}

export function derivedSigningKey(creds: SigV4Credentials, amzDate: string): Buffer {
  const dateKey = hmac('AWS4' + creds.secretAccessKey, dateStampOf(amzDate));
  const dateRegionKey = hmac(dateKey, creds.region);
  const dateRegionServiceKey = hmac(dateRegionKey, creds.service);
  return hmac(dateRegionServiceKey, 'aws4_request');
}

/**
 * Sign a request: returns the exact `Authorization` header value plus the
 * `x-amz-date` value the caller must also send (it is one of the signed
 * headers, so caller and signer must agree on it — passing it in, rather than
 * minting it here, keeps this function pure and testable).
 */
export function signAws4(input: CanonicalRequestInput, creds: SigV4Credentials, amzDate: string): { authorization: string; signedHeaders: string } {
  const { creq, signedHeaders } = canonicalRequest(input);
  const hashedCreq = sha256hex(creq);
  const scope = credentialScope(amzDate, creds);
  const sts = stringToSign(amzDate, scope, hashedCreq);
  const key = derivedSigningKey(creds, amzDate);
  const sig = hmac(key, sts).toString('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${sig}`;
  return { authorization, signedHeaders };
}

export { sha256hex };
