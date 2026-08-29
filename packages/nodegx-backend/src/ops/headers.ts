/**
 * CORS and security headers (BAK-009).
 *
 * The service used to answer every request with `Access-Control-Allow-Origin:
 * *`, unconditionally and unconfigurably. That default is not wrong for this
 * product — a NodeGX app is a browser client served from wherever the developer
 * put it, and refusing cross-origin by default would break the normal case —
 * but "unconfigurable" is: a production backend should be able to name the two
 * origins that are allowed to talk to it, and an operator should be TOLD when
 * an internet-facing backend is still answering `*`.
 *
 * So: `*` stays the default, an explicit list is honoured, and a non-loopback
 * bind serving `*` produces a startup warning that names the setting to change.
 *
 * TLS is not here and never will be: it belongs to the reverse proxy, and the
 * runbook's Caddy/nginx examples are the verified form of that answer.
 *
 * @module nodegx-backend/ops/headers
 */

import type * as http from 'http';

import type { CorsConfig } from './model';

/** Methods and headers the API surface accepts. */
const ALLOW_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
/**
 * 🔴 Every header the runtime's own clients set must be in this list, or the
 * browser refuses the request before it is sent and the app reports the
 * operation as having FAILED — not as having been blocked.
 *
 * `X-Parse-Installation-Id` (SBR-007 D21) is the one that was missing.
 * `ParseAuthAdapter._makeRequest` sets it on every AUTH call and nothing else
 * does, so a cross-origin deployed app had working data and no sign-in at all:
 * Chrome answered the preflight with `HeaderDisallowedByPreflightResponse`, the
 * `Log In` node saw a failed request, and the panel told the person their
 * password was wrong. Same-origin hosts never preflight, which is why every
 * preview arm was green.
 */
const ALLOW_HEADERS =
  'Content-Type, Authorization, X-Request-Id, X-Parse-Application-Id, X-Parse-Session-Token, ' +
  'X-Parse-Installation-Id, X-Parse-Master-Key, X-Parse-REST-API-Key, X-NodeGX-Api-Key, Last-Event-ID';

/**
 * Which `Access-Control-Allow-Origin` to send, or null for none.
 *
 * With an explicit allow-list the REQUEST's origin is echoed rather than the
 * list being sent verbatim — a browser accepts exactly one origin in that
 * header, so sending a list is the same as sending nothing, only harder to
 * debug.
 */
export function allowedOrigin(requestOrigin: string | undefined, config: CorsConfig): string | null {
  if (config.origins.includes('*')) {
    // With credentials the wildcard is illegal, so echo instead. (The config
    // validator refuses `*` + credentials outright; this is the belt.)
    return config.credentials && requestOrigin ? requestOrigin : '*';
  }
  if (!requestOrigin) return null;
  return config.origins.includes(requestOrigin) ? requestOrigin : null;
}

/**
 * Set the CORS headers for this request on the response, before any handler
 * runs. Handlers therefore never think about CORS — and cannot forget it,
 * which is what the old "spread a constant into every writeHead" arrangement
 * depended on.
 */
export function applyCors(req: http.IncomingMessage, res: http.ServerResponse, config: CorsConfig): void {
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const origin = allowedOrigin(requestOrigin, config);
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
  res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, Retry-After');
  if (config.credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
  // Caches must not serve one origin's allowed response to another.
  if (origin !== '*') res.setHeader('Vary', 'Origin');
}

/**
 * Security headers for the served admin dashboard (BAK-005) — an HTML document
 * with a credential in it, which is a different threat model from the JSON API.
 * The API gets none of these: they are meaningless for a fetch() response and
 * would only be noise on the wire.
 *
 * The dashboard already sets its own strict CSP with a per-request nonce; these
 * are the surrounding ones.
 */
export function applyAdminSecurityHeaders(res: http.ServerResponse): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  // The dashboard needs no camera, microphone, or geolocation, and saying so is
  // free.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
}

/**
 * The `Server` header. Honest rather than absent: version-hiding does not slow
 * an attacker down (the behaviour fingerprints the service anyway) and it does
 * slow down the operator trying to work out which build is running.
 */
export function serverHeader(version: string = SERVICE_VERSION): string {
  return `nodegx-backend/${version}`;
}

/**
 * This build's version. A literal rather than a `require('../package.json')`:
 * the service ships as a single esbuild bundle with no node_modules and no
 * package.json beside it, so reading one at runtime is exactly the kind of
 * "works in dev, absent in the artifact" trap the packaging notes warn about.
 */
export const SERVICE_VERSION = '0.1.0';
