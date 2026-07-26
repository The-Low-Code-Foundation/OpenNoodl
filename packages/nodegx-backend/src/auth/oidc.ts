/**
 * Generic OpenID Connect: authorization code + PKCE, server-side (BAK-004).
 *
 * This is the whole "provider matrix" answer. Everything a provider differs in
 * — endpoints, signing keys, supported scopes — is read from its discovery
 * document at `<issuer>/.well-known/openid-configuration`, so Google, Keycloak,
 * Entra ID, Authentik, Auth0, Okta and GitLab are configuration rather than
 * code. Only GitHub, which is OAuth2 but not OIDC, needs an adapter (./github).
 *
 * ## The ID token is verified properly
 *
 * OIDC Core §3.1.3.7 permits a confidential client that received the ID token
 * over a direct, TLS-authenticated channel to the token endpoint — exactly this
 * flow — to skip signature verification. We do NOT take that exemption, and the
 * reason is not purity: the exemption's safety rests entirely on the TLS
 * validation of a `fetch()` call made deep inside another module, which is an
 * invisible, silently-breakable dependency for a check that would otherwise be
 * explicit and testable. So the signature is verified against the issuer's
 * JWKS, always, and there is no fallback path that skips it — a fallback is how
 * verification quietly stops happening.
 *
 * Only asymmetric algorithms are accepted (RS256/384/512, ES256/384/512, PS256/
 * 384/512). HMAC-signed ID tokens (`HS256` with the client secret) are legal
 * OIDC and are refused here anyway: they turn a signature check into a shared-
 * secret check, and every serious provider offers RS256.
 *
 * ## PKCE is unconditional
 *
 * The RFC frames PKCE as a public-client protection, and this is a confidential
 * client. It is sent regardless, because it also closes authorization-code
 * injection against confidential clients (RFC 9700 §2.1.1) and costs one hash.
 *
 * @module nodegx-backend/auth/oidc
 */

import * as crypto from 'crypto';

import { providerJson } from './http';

// ============================================================================
// PKCE, state, nonce
// ============================================================================

export interface Pkce {
  verifier: string;
  challenge: string;
  method: 'S256';
}

/** A fresh PKCE pair. 32 random bytes base64url is 43 chars — the RFC's minimum length, comfortably. */
export function createPkce(): Pkce {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
  return { verifier, challenge, method: 'S256' };
}

/** A random, URL-safe, unguessable value — used for `state`, `nonce`, and the flow-binding cookie. */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

// ============================================================================
// Discovery
// ============================================================================

export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  /** Present on well-behaved issuers; used only to produce a better error. */
  id_token_signing_alg_values_supported?: string[];
  code_challenge_methods_supported?: string[];
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Discovery documents and JWKS change rarely; refetching them on every sign-in
 * would add a provider round-trip to a latency-sensitive path and make this
 * backend a noisy neighbour. One hour, in memory, per process — the same
 * single-process stance as every other cache and scheduler here.
 */
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
const JWKS_TTL_MS = 60 * 60 * 1000;

const discoveryCache = new Map<string, CacheEntry<DiscoveryDocument>>();
const jwksCache = new Map<string, CacheEntry<crypto.JsonWebKey[]>>();

/** Forget every cached document. Called when auth config changes, and by tests. */
export function clearDiscoveryCache(): void {
  discoveryCache.clear();
  jwksCache.clear();
}

export function discoveryUrl(issuer: string): string {
  // The spec appends the well-known path to the issuer INCLUDING any path
  // component (`https://host/realms/x` -> `https://host/realms/x/.well-known/...`),
  // which is what Keycloak needs and what naive URL joining gets wrong.
  return `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
}

export async function discover(issuer: string, now = Date.now()): Promise<DiscoveryDocument> {
  const url = discoveryUrl(issuer);
  const cached = discoveryCache.get(url);
  if (cached && cached.expiresAt > now) return cached.value;

  const doc = await providerJson<DiscoveryDocument>(url, { what: 'OpenID Connect discovery document' });

  for (const field of ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const) {
    if (typeof doc[field] !== 'string' || !doc[field]) {
      throw new Error(`The discovery document at ${url} is missing "${field}", so this issuer cannot be used.`);
    }
  }
  // A discovery document that names a different issuer than the one we asked
  // is either a misconfiguration or a mix-up attack; either way the `iss` claim
  // check downstream would fail confusingly later instead of clearly now.
  if (doc.issuer.replace(/\/+$/, '') !== issuer.replace(/\/+$/, '')) {
    throw new Error(
      `The discovery document at ${url} declares issuer "${doc.issuer}", which does not match the configured ` +
        `issuer "${issuer}". Configure the issuer exactly as the provider publishes it.`
    );
  }

  discoveryCache.set(url, { value: doc, expiresAt: now + DISCOVERY_TTL_MS });
  return doc;
}

async function fetchJwks(jwksUri: string, now: number): Promise<crypto.JsonWebKey[]> {
  const cached = jwksCache.get(jwksUri);
  if (cached && cached.expiresAt > now) return cached.value;

  const doc = await providerJson<{ keys?: crypto.JsonWebKey[] }>(jwksUri, { what: 'JWKS (signing keys)' });
  const keys = Array.isArray(doc.keys) ? doc.keys : [];
  if (keys.length === 0) {
    throw new Error(`The JWKS at ${jwksUri} contains no keys, so no ID token from this issuer can be verified.`);
  }
  jwksCache.set(jwksUri, { value: keys, expiresAt: now + JWKS_TTL_MS });
  return keys;
}

// ============================================================================
// The authorization request
// ============================================================================

export interface AuthorizationRequest {
  discovery: DiscoveryDocument;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
  pkce: Pkce;
}

export function authorizationUrl(request: AuthorizationRequest): string {
  const url = new URL(request.discovery.authorization_endpoint);
  const params = url.searchParams;
  params.set('response_type', 'code');
  params.set('client_id', request.clientId);
  params.set('redirect_uri', request.redirectUri);
  params.set('scope', request.scopes.join(' '));
  params.set('state', request.state);
  params.set('nonce', request.nonce);
  params.set('code_challenge', request.pkce.challenge);
  params.set('code_challenge_method', request.pkce.method);
  return url.toString();
}

// ============================================================================
// The token exchange
// ============================================================================

export interface TokenResponse {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export async function exchangeCode(params: {
  discovery: DiscoveryDocument;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  return providerJson<TokenResponse>(params.discovery.token_endpoint, {
    what: 'token exchange',
    method: 'POST',
    form: {
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      // Providers differ on whether they want the secret in the body or in a
      // Basic header; every one of them accepts the body form, and sending both
      // makes some (notably Entra) refuse outright.
      client_secret: params.clientSecret,
      code_verifier: params.codeVerifier
    }
  });
}

// ============================================================================
// ID token verification
// ============================================================================

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nonce?: string;
  azp?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
  [claim: string]: unknown;
}

/** Node's `sign`/`verify` digest name, plus the padding an alg family implies. */
const ALGORITHMS: Record<string, { digest: string; family: 'rsa' | 'rsa-pss' | 'ec' }> = {
  RS256: { digest: 'sha256', family: 'rsa' },
  RS384: { digest: 'sha384', family: 'rsa' },
  RS512: { digest: 'sha512', family: 'rsa' },
  PS256: { digest: 'sha256', family: 'rsa-pss' },
  PS384: { digest: 'sha384', family: 'rsa-pss' },
  PS512: { digest: 'sha512', family: 'rsa-pss' },
  ES256: { digest: 'sha256', family: 'ec' },
  ES384: { digest: 'sha384', family: 'ec' },
  ES512: { digest: 'sha512', family: 'ec' }
};

/** Providers' clocks are not ours. 60 seconds is the conventional allowance. */
const CLOCK_SKEW_SECONDS = 60;

export class IdTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdTokenError';
  }
}

function decodeSegment(segment: string, what: string): Record<string, unknown> {
  let json: string;
  try {
    json = Buffer.from(segment, 'base64url').toString('utf-8');
  } catch {
    throw new IdTokenError(`The ID token's ${what} is not valid base64url.`);
  }
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new IdTokenError(`The ID token's ${what} is not a JSON object.`);
  }
}

/**
 * Verify an ID token's signature and its claims.
 *
 * Every check here is a real attack, not ceremony:
 *   - `alg` from an allow-list: `{"alg":"none"}` is the oldest JWT bug there is,
 *     and taking the algorithm from the token alone is the second oldest.
 *   - `kid` selection: a token that names a key the issuer does not publish is
 *     refused rather than tried against every key.
 *   - `iss`: prevents a token minted by a different issuer being replayed here.
 *   - `aud`/`azp`: prevents a token minted for a DIFFERENT client of the same
 *     issuer (an app the attacker controls) being replayed here. This is the
 *     one people leave out, and it is the one that matters most on shared
 *     issuers like Google.
 *   - `nonce`: binds the token to the authorization request this flow started.
 *   - `exp`: an expired assertion is not an assertion.
 */
export async function verifyIdToken(
  idToken: string,
  expected: { discovery: DiscoveryDocument; clientId: string; nonce: string },
  now = Date.now()
): Promise<IdTokenClaims> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new IdTokenError(`The ID token is not a three-part JWS (got ${parts.length} segments).`);
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = decodeSegment(headerB64, 'header');
  const alg = typeof header.alg === 'string' ? header.alg : '';
  const spec = ALGORITHMS[alg];
  if (!spec) {
    throw new IdTokenError(
      `The ID token is signed with "${alg || '(none declared)'}", which this backend does not accept. ` +
        `Accepted: ${Object.keys(ALGORITHMS).join(', ')}. HMAC (HS*) and unsigned tokens are refused by design.`
    );
  }

  const keys = await fetchJwks(expected.discovery.jwks_uri, now);
  const kid = typeof header.kid === 'string' ? header.kid : undefined;
  const candidates = kid ? keys.filter((k) => (k as { kid?: string }).kid === kid) : keys.length === 1 ? keys : [];
  if (candidates.length === 0) {
    throw new IdTokenError(
      kid
        ? `The ID token names signing key "${kid}", which is not in the issuer's JWKS (${expected.discovery.jwks_uri}).`
        : `The ID token declares no "kid" and the issuer publishes ${keys.length} keys, so the signing key is ambiguous.`
    );
  }

  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'ascii');
  const signature = Buffer.from(signatureB64, 'base64url');
  const verified = candidates.some((jwk) => verifyWithJwk(jwk, spec, signingInput, signature));
  if (!verified) {
    throw new IdTokenError("The ID token's signature does not verify against the issuer's published signing key.");
  }

  const claims = decodeSegment(payloadB64, 'payload') as unknown as IdTokenClaims;

  if (claims.iss !== expected.discovery.issuer) {
    throw new IdTokenError(`The ID token was issued by "${claims.iss}", not "${expected.discovery.issuer}".`);
  }
  if (typeof claims.sub !== 'string' || !claims.sub) {
    throw new IdTokenError('The ID token has no "sub" claim, so there is no stable identity to key on.');
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(expected.clientId)) {
    throw new IdTokenError(
      `The ID token's audience (${audiences.join(', ')}) does not include this backend's client id. ` +
        'It was minted for a different application.'
    );
  }
  // With multiple audiences the spec requires `azp`, and it must be us —
  // otherwise a token legitimately issued to another client that merely lists
  // us as an audience would be accepted.
  if (audiences.length > 1 && claims.azp !== expected.clientId) {
    throw new IdTokenError('The ID token lists several audiences and its "azp" claim is not this backend\'s client id.');
  }

  const nowSeconds = Math.floor(now / 1000);
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    throw new IdTokenError('The ID token has expired.');
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
    throw new IdTokenError('The ID token is issued in the future; check the clock on the identity provider.');
  }

  if (claims.nonce !== expected.nonce) {
    throw new IdTokenError(
      'The ID token\'s "nonce" does not match the one this sign-in started with, so it belongs to a different ' +
        'authorization request.'
    );
  }

  return claims;
}

function verifyWithJwk(
  jwk: crypto.JsonWebKey,
  spec: { digest: string; family: 'rsa' | 'rsa-pss' | 'ec' },
  signingInput: Buffer,
  signature: Buffer
): boolean {
  let key: crypto.KeyObject;
  try {
    key = crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' });
  } catch {
    // A key we cannot import (an unsupported curve, a malformed entry) is not
    // a verification failure for the whole token — another key may match.
    return false;
  }

  try {
    if (spec.family === 'ec') {
      // JWS ECDSA signatures are the raw r||s concatenation; Node defaults to DER.
      return crypto.verify(spec.digest, signingInput, { key, dsaEncoding: 'ieee-p1363' }, signature);
    }
    if (spec.family === 'rsa-pss') {
      return crypto.verify(
        spec.digest,
        signingInput,
        { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST },
        signature
      );
    }
    return crypto.verify(spec.digest, signingInput, key, signature);
  } catch {
    return false;
  }
}

// ============================================================================
// The normalized result every adapter produces
// ============================================================================

/**
 * What a completed provider round-trip yields, in the one shape the identity
 * layer consumes. Both the OIDC path and the GitHub adapter produce this, which
 * is why the linking rule has exactly one implementation.
 */
export interface ProviderIdentity {
  /** Provider config id (`google`, `acme-sso`) — the local namespace for `subject`. */
  providerId: string;
  /** The provider's stable, immutable identifier for this person. NEVER the email. */
  subject: string;
  email: string | null;
  /**
   * Did the PROVIDER assert this address is verified? The linking rule turns
   * entirely on this flag, so a provider that does not assert it gets `false`
   * and its users never auto-link.
   */
  emailVerified: boolean;
  displayName: string | null;
  /** Everything else worth keeping on the identity row, for debugging and display. */
  raw: Record<string, unknown>;
}

/** Build the normalized identity from verified OIDC claims. */
export function identityFromClaims(providerId: string, claims: IdTokenClaims): ProviderIdentity {
  const email = typeof claims.email === 'string' && claims.email ? claims.email.toLowerCase() : null;
  return {
    providerId,
    subject: claims.sub,
    email,
    // Absent `email_verified` means "not asserted", which must read as false:
    // treating an unasserted claim as verified is precisely the account-linking
    // takeover this task's risk table names.
    emailVerified: claims.email_verified === true,
    displayName:
      (typeof claims.name === 'string' && claims.name) ||
      (typeof claims.preferred_username === 'string' && claims.preferred_username) ||
      null,
    raw: {
      ...(typeof claims.picture === 'string' ? { picture: claims.picture } : {}),
      ...(typeof claims.preferred_username === 'string' ? { preferred_username: claims.preferred_username } : {})
    }
  };
}
