/**
 * HLS-006 — the one place that decides what a NodeGX process listens on, and who may talk to it.
 *
 * ## Why this is a module and not four lines in each server
 *
 * Measured 2026-09-09: this repo starts **three** HTTP/WebSocket listeners that a person can
 * reach — the editor's web server (`web-server.js`, port 8574, HTTP plus the project relay),
 * the editor's design-tool import socket (`design-tool-import-server.js`, 8575), and
 * `@noodl/preview` — and until this file each made its own decision. Two of them called
 * `.listen(port)` with no address at all, which binds `::`: **every interface on the machine**.
 * [#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31) is what that looks like from
 * another machine on the same LAN, with no credential asked for at any point.
 *
 * 🔴 **A security default is the worst possible place for a second copy.** Two servers with two
 * policies drift, and the direction they drift in is the one nobody is looking at. So the policy
 * is a function of its arguments, it lives in the package that also ships the `nodegx` binary,
 * and the editor resolves it through the `@nodegx/export` alias that already exists in its
 * tsconfig, its jest config and its webpack config.
 *
 * ## The policy, stated
 *
 * 1. **Loopback by default, everywhere.** Not "usually", not "in production". The address is
 *    `127.0.0.1` unless a caller has explicitly decided to share.
 * 2. **Sharing is a decision somebody makes**, and it produces a URL *and* a token. A share with
 *    no token is not a thing this module can express — {@link resolveAccess} mints one rather
 *    than accepting the absence.
 * 3. **The token gates the interface it was minted for, not the machine.** A request arriving
 *    over loopback is not challenged: when the socket is loopback-bound that is the only kind
 *    there is, and when it is shared, a local process could read the token file anyway. The
 *    threat this closes is the LAN, and pretending otherwise would break every local tool for a
 *    protection that was never real. `relay-token.js` states the same boundary for the same
 *    reason.
 *
 * ⚠️ **This module deliberately knows nothing about `http`.** It takes the three fields of a
 * request that bear on the decision and returns a verdict. That is what lets the specs drive it
 * with real sockets *and* enumerate the cases exhaustively without one.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';

/** The default, and the entire point of this file. */
export const LOOPBACK = '127.0.0.1';

/**
 * What a share binds. `0.0.0.0` rather than `::` — the IPv4 wildcard is what a phone on the
 * office wifi actually reaches, and binding the dual-stack wildcard by *accident* is the defect
 * this file exists to remove, so it is never the value of a default anywhere in it.
 */
export const ALL_INTERFACES = '0.0.0.0';

/** Where a shared server accepts the token from. All three, because each has a caller. */
export const TOKEN_QUERY = 't';
export const TOKEN_HEADER = 'x-nodegx-token';
export const TOKEN_COOKIE = 'nodegx_token';

/** What a caller asked for. Every field optional: the empty request is the safe one. */
export interface AccessRequest {
  /**
   * An explicit decision to leave loopback. 🔴 There is no way to reach {@link ALL_INTERFACES}
   * without setting this, including by passing `host`.
   */
  share?: boolean;
  /** The address to bind when sharing. Ignored — deliberately — when `share` is not set. */
  host?: string;
  /** A token supplied by the caller (`--token`), so a CI job can know it before the server runs. */
  token?: string | null;
}

/** The decision. `token` is always present; `shared` says whether anything will ever check it. */
export interface Access {
  /** Pass this to `listen()`. */
  host: string;
  shared: boolean;
  token: string;
}

/**
 * 64 hex characters from `randomBytes`. Same shape and same generator as the relay token, so the
 * two are interchangeable where a caller has one already — which the editor does, and uses.
 */
export function mintToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Resolve a request into a binding.
 *
 * 🔴 The one rule with teeth: `host` is honoured **only** when `share` is set. A caller who
 * passes `{ host: '0.0.0.0' }` and forgets `share` gets loopback. That asymmetry is deliberate —
 * the failure it prevents is a config file, an environment variable or a forwarded option
 * quietly re-opening the port, which is exactly how `.listen(port)` came to bind `::` in the
 * first place: nobody decided it.
 */
export function resolveAccess(request: AccessRequest = {}): Access {
  const shared = request.share === true;
  return {
    host: shared ? request.host || ALL_INTERFACES : LOOPBACK,
    shared,
    // A shared server always has a token. An unshared one still gets one, so that turning
    // sharing on later cannot find itself without a credential and invent a weaker path.
    token: request.token || mintToken()
  };
}

/**
 * Constant-time comparison, and a length check that is deliberate rather than left to the
 * exception `timingSafeEqual` throws on a mismatch — which would itself leak the length.
 */
export function tokenMatches(candidate: unknown, token: string): boolean {
  if (typeof candidate !== 'string' || typeof token !== 'string' || token.length === 0) return false;
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(token, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Whether a peer address is this machine talking to itself.
 *
 * ⚠️ `::ffff:127.0.0.1` is what a dual-stack socket reports for an IPv4 loopback client, and it
 * is not the string `127.0.0.1`. A check that misses it does not fail loudly — it challenges the
 * editor's own webview for a token, which looks like the server being broken.
 */
export function isLoopbackAddress(address: string | undefined | null): boolean {
  if (!address) return false;
  const addr = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
  if (addr === '::1') return true;
  // The whole 127.0.0.0/8 block, not just .0.0.1 — `127.0.0.53` is a loopback address too.
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr);
}

/** The three fields of an incoming request that bear on the decision. */
export interface IncomingRequestLike {
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  remoteAddress?: string;
}

/** Read the token a request is presenting, from whichever of the three places carries it. */
export function tokenFromRequest(request: IncomingRequestLike): string | null {
  const headers = request.headers || {};

  const header = headers[TOKEN_HEADER];
  if (typeof header === 'string' && header.length > 0) return header;

  const auth = headers['authorization'];
  if (typeof auth === 'string' && /^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '');

  if (typeof request.url === 'string') {
    try {
      // `URL` needs an absolute input and the request line is a path. The base is never used for
      // anything but parsing, so a fixed placeholder is correct and cannot leak.
      const query = new URL(request.url, 'http://placeholder.invalid').searchParams.get(TOKEN_QUERY);
      if (query) return query;
    } catch {
      // 🔴 `new URL` throws on a request line the WHATWG parser will not take — `//%%` is enough.
      // Found by the spec, not by review. Letting it out of here would put an exception in the
      // request handler of a **shared** server, reachable by anything on the network that can
      // send four bytes: the one place in this module where a remote caller must not be able to
      // change what the process does. A request that carries no readable token carries no token.
    }
  }

  const cookie = headers['cookie'];
  if (typeof cookie === 'string') {
    for (const part of cookie.split(';')) {
      const [name, ...value] = part.trim().split('=');
      if (name === TOKEN_COOKIE && value.length > 0) return value.join('=');
    }
  }

  return null;
}

/** What {@link authoriseRequest} decided, and why. The reason is for the log, not the client. */
export type AccessVerdict =
  | { ok: true; reason: 'loopback' | 'token'; setCookie: string | null }
  | { ok: false; reason: 'no-token' | 'wrong-token'; status: 401; body: string };

/**
 * The gate.
 *
 * 🔴 **`no-token` and `wrong-token` are separate reasons and the same 401.** They are separate
 * because a log that cannot tell "nobody presented anything" from "somebody presented something
 * wrong" cannot tell a misconfigured colleague from a probe; they are the same response because
 * telling the client which one it was is how a scanner learns the parameter name is right.
 */
export function authoriseRequest(request: IncomingRequestLike, access: Access): AccessVerdict {
  if (!access.shared || isLoopbackAddress(request.remoteAddress)) {
    return { ok: true, reason: 'loopback', setCookie: null };
  }

  const presented = tokenFromRequest(request);
  if (presented === null) {
    return { ok: false, reason: 'no-token', status: 401, body: UNAUTHORISED_BODY };
  }
  if (!tokenMatches(presented, access.token)) {
    return { ok: false, reason: 'wrong-token', status: 401, body: UNAUTHORISED_BODY };
  }

  // The token arrives once, in the URL the person was handed. Every asset the page then loads is
  // a bare request, so the accepted token is handed back as a cookie — otherwise the HTML would
  // be the only thing that ever renders. `HttpOnly` because no script needs to read it back, and
  // `SameSite=Strict` so another site cannot ride it.
  return {
    ok: true,
    reason: 'token',
    setCookie: `${TOKEN_COOKIE}=${access.token}; Path=/; HttpOnly; SameSite=Strict`
  };
}

/**
 * ⚠️ Says what to do, not what was wrong. Someone on the LAN who reaches this is either a
 * colleague who was given a URL without its token, or a scanner; the sentence is written for the
 * first and gives the second nothing.
 */
export const UNAUTHORISED_BODY =
  'This NodeGX preview is being shared and needs the token that was shown alongside its URL.\n' +
  'Open the full link you were given — it ends with `?t=…` — rather than the address on its own.\n';

/**
 * The address on this machine that another machine on the same network can actually type.
 *
 * ⚠️ `os.hostname()` is the obvious answer and the wrong one: a hostname only resolves if the
 * network has mDNS or a DNS entry for it, so a share action that prints a name resolves for the
 * person who ran it and for about half the people they send it to. An IPv4 address always works
 * on the network it came from.
 *
 * `null` when there is no external interface — which is a real state (no network) and is worth
 * saying, rather than printing `0.0.0.0`, an address nobody can connect to.
 */
export function lanAddress(): string | null {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

/** The link to hand over. The token is in it, which is what makes the link the whole credential. */
export function shareUrl(host: string, port: number, token: string): string {
  return `http://${host}:${port}/?${TOKEN_QUERY}=${encodeURIComponent(token)}`;
}

/**
 * The sentence a server prints or shows about what it is doing.
 *
 * 🔴 #31's actual complaint is not only that the port was open — it is that **the editor never
 * mentioned it**. A server that binds correctly and says nothing has fixed the exposure and kept
 * the thing that made it a surprise, so saying this is part of the fix rather than decoration.
 */
export function describeAccess(access: Access, port: number, hostname?: string): string {
  if (!access.shared) {
    return `Listening on ${LOOPBACK}:${port} — this machine only. Nothing else on the network can reach it.`;
  }
  const reachableAt = hostname || access.host;
  return (
    `Shared on the network at ${shareUrl(reachableAt, port, access.token)}\n` +
    'Anyone on this network who has that link can open the app. The token is in the link; ' +
    'it changes every time sharing is turned on.'
  );
}
