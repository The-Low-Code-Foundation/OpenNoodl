/**
 * Who the client actually is, behind a proxy or not (BAK-009).
 *
 * Rate limits, audit entries and access logs all key off "the client", so
 * getting this wrong is not cosmetic: believe a forged `X-Forwarded-For` and an
 * attacker sits in a fresh rate-limit bucket on every request and forges the
 * origin recorded against every privileged action.
 *
 * Two rules, both deliberate:
 *
 *   1. **The header is only read from a trusted peer.** Default trust is
 *      `["loopback"]` — a reverse proxy on the same machine, which is the
 *      documented Caddy/nginx setup. With no proxy at all this is still safe:
 *      a direct client's own header is ignored because the client is not a
 *      trusted proxy.
 *   2. **The rightmost untrusted hop wins**, not the leftmost. A proxy APPENDS
 *      the peer it saw, so with `X-Forwarded-For: 9.9.9.9` sent by the client
 *      the edge produces `9.9.9.9, <real client>`. Reading left-to-right — the
 *      obvious implementation, and the one this service used to have — hands
 *      the attacker the steering wheel.
 *
 * @module nodegx-backend/ops/client-ip
 */

import type * as http from 'http';

/** Minimal request shape — anything with headers and a socket address. */
export interface AddressableRequest {
  headers: Record<string, unknown>;
  socket?: { remoteAddress?: string };
}

/** Strip IPv6-mapped IPv4 (`::ffff:127.0.0.1`) down to the v4 form. */
function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed);
  return mapped ? mapped[1] : trimmed;
}

function isLoopback(address: string): boolean {
  const a = normalizeAddress(address);
  return a === '::1' || a.startsWith('127.');
}

function isPrivate(address: string): boolean {
  const a = normalizeAddress(address).toLowerCase();
  if (isLoopback(a)) return true;
  if (a.startsWith('10.') || a.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(a)) return true;
  // Unique-local IPv6 (fc00::/7) and link-local (fe80::/10) — the shapes a
  // container network or a LAN hands out.
  if (a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe8')) return true;
  return false;
}

/**
 * Is `address` one of the proxies we believe? Entries are the names
 * `loopback` / `private` / `*`, or a literal address. (No CIDR parsing: the
 * two named sets cover same-host and container-network proxies, which is every
 * setup the runbook documents.)
 */
export function isTrustedProxy(address: string | undefined, trusted: string[]): boolean {
  if (!address) return false;
  const a = normalizeAddress(address);
  for (const entry of trusted) {
    if (entry === '*') return true;
    if (entry === 'loopback' && isLoopback(a)) return true;
    if (entry === 'private' && isPrivate(a)) return true;
    if (normalizeAddress(entry) === a) return true;
  }
  return false;
}

/**
 * The client address for this request. Falls back to the socket address
 * whenever the header is absent, unusable, or arrives from an untrusted peer;
 * `'unknown'` only when there is no socket at all (unit-test doubles).
 */
export function clientIp(req: AddressableRequest | http.IncomingMessage, trusted: string[] = ['loopback']): string {
  const socketAddress = (req as AddressableRequest).socket?.remoteAddress;
  const peer = socketAddress ? normalizeAddress(socketAddress) : '';
  if (!isTrustedProxy(peer, trusted)) return peer || 'unknown';

  const raw = (req.headers as Record<string, unknown>)['x-forwarded-for'];
  const header = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : '';
  if (!header.trim()) return peer || 'unknown';

  const hops = header
    .split(',')
    .map((h) => normalizeAddress(h))
    .filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isTrustedProxy(hops[i], trusted)) return hops[i];
  }
  // Every hop is itself a trusted proxy: the leftmost is as close to the
  // client as this chain gets.
  return hops[0] || peer || 'unknown';
}
