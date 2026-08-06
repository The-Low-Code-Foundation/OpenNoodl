/**
 * HS256/384/512 JSON Web Tokens (CWF-010 slice 4), on WebCrypto and nothing else.
 *
 * No dependency: a JWT is base64url framing around the HMAC this file's sibling already computes.
 * Adding a library here would have been the signal that something was mis-scoped.
 *
 * ⚠️ **`verify` decides the algorithm from the CALLER, not from the token.** Reading `alg` out of
 * the header and trusting it is the classic JWT defect in both its forms: `alg: "none"`, where a
 * token with an empty signature verifies, and algorithm confusion, where an attacker re-signs an
 * RS256 token as HS256 using the public key as the HMAC secret. Here the expected algorithm is a
 * parameter, the header's `alg` must *equal* it, and there is no code path that runs any other.
 *
 * ⚠️ **The signature is checked before anything in the payload is believed.** `exp`, `nbf` and
 * the claims are all attacker-controlled until the MAC says otherwise.
 *
 * This module lives in the shared runtime because the two nodes that use it are cloud-only and
 * live in a different package — the code has to be somewhere both can import. Nothing registers
 * a node here, so the browser vocabulary is unchanged.
 */

import { base64UrlToBytes, bytesEqual, bytesToBase64Url, DigestAlgorithm, hmacBytes, utf8Bytes } from './encoding';

/** The JOSE `alg` names this module implements, and their WebCrypto digests. */
export const HS_ALGORITHMS: Record<string, DigestAlgorithm> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512'
};

export type JwtClaims = Record<string, unknown>;

export interface JwtVerifyResult {
  valid: boolean;
  claims?: JwtClaims;
  /** Why it failed, in words an author can act on. Absent when `valid`. */
  reason?: string;
}

function base64UrlJson(value: unknown): string {
  return bytesToBase64Url(utf8Bytes(JSON.stringify(value)));
}

/**
 * Sign a claims object.
 *
 * `iat` is always stamped. `exp` is stamped only when `expiresInSeconds` is a positive number —
 * a token with no expiry is a deliberate choice an author has to make by leaving the field empty,
 * not something this function guesses at.
 */
export async function signJwt(
  claims: JwtClaims,
  key: string,
  alg: string,
  expiresInSeconds?: number
): Promise<string> {
  const hash = HS_ALGORITHMS[alg];
  if (!hash) throw new Error(`Unsupported algorithm "${alg}". This node signs HS256, HS384 and HS512.`);
  if (!key) throw new Error('A signing Key is required.');

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: JwtClaims = { ...claims, iat: issuedAt };
  if (typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
    payload.exp = issuedAt + Math.floor(expiresInSeconds);
  }

  const signingInput = `${base64UrlJson({ alg, typ: 'JWT' })}.${base64UrlJson(payload)}`;
  const signature = bytesToBase64Url(await hmacBytes(key, signingInput, hash));
  return `${signingInput}.${signature}`;
}

/**
 * Verify a token that somebody else issued.
 *
 * Checks, in this order: shape, header `alg` equals the expected one, signature, `nbf`, `exp`.
 * Returns rather than throws — "this token is not valid" is an answer, and the caller decides
 * what to do with it.
 */
export async function verifyJwt(
  token: string,
  key: string,
  alg: string,
  clockToleranceSeconds = 0
): Promise<JwtVerifyResult> {
  const hash = HS_ALGORITHMS[alg];
  if (!hash) return { valid: false, reason: `Unsupported algorithm "${alg}". This node verifies HS256/384/512.` };
  if (!key) return { valid: false, reason: 'A Key is required to verify a token.' };
  if (!token) return { valid: false, reason: 'No token was supplied.' };

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Not a JWT: a token has three dot-separated parts.' };
  }

  let header: { alg?: unknown; typ?: unknown };
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
  } catch {
    return { valid: false, reason: 'The token header is not readable base64url JSON.' };
  }

  // The `alg: none` and algorithm-confusion gate. Note it runs BEFORE the signature check and
  // before anything in the payload is read.
  if (header.alg !== alg) {
    return {
      valid: false,
      reason: `The token says alg "${String(header.alg)}" and this node was told to expect "${alg}". Refused.`
    };
  }

  let expected: Uint8Array;
  try {
    expected = await hmacBytes(key, `${parts[0]}.${parts[1]}`, hash);
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : String(e) };
  }

  let actual: Uint8Array;
  try {
    actual = base64UrlToBytes(parts[2]);
  } catch {
    return { valid: false, reason: 'The signature is not readable base64url.' };
  }

  if (!bytesEqual(expected, actual)) {
    return { valid: false, reason: 'The signature does not match — wrong key, or the token was tampered with.' };
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
  } catch {
    return { valid: false, reason: 'The token payload is not readable base64url JSON.' };
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = Number.isFinite(clockToleranceSeconds) ? Math.max(0, clockToleranceSeconds) : 0;

  if (typeof claims.nbf === 'number' && now + tolerance < claims.nbf) {
    return { valid: false, reason: 'The token is not valid yet (nbf is in the future).' };
  }
  if (typeof claims.exp === 'number' && now - tolerance >= claims.exp) {
    return { valid: false, reason: 'The token has expired (exp is in the past).' };
  }

  return { valid: true, claims };
}
