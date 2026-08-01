/**
 * The editor's one probe cache, and the runner that settles a `conditional`
 * cell against a real instance. BCN-010 step 2.
 *
 * The policy — what may be believed and for how long — is in
 * `@noodl/backend-contract`'s `CapabilityProbeCache`, which has no I/O in it on
 * purpose. This file is the mechanism: the requests, the deadlines, and the
 * per-capability knowledge of what a positive answer looks like.
 *
 * ## Why the answers are per-capability and not generic
 *
 * `CapabilityProbe.expect` is prose, and the descriptor's own header explains
 * why it has to be:
 *
 * > 1. **Probe the exact thing.** PostgREST answers embedded-relation counts
 * >    with aggregates *disabled*.
 * > 2. **A 200 is not a yes.** PocketBase returns 200 and ordinary
 * >    un-aggregated rows for every aggregate spelling there is.
 *
 * A generic "did it 200" runner would report `supported` on both. So the runner
 * dispatches on the capability key and each branch knows what it is looking at.
 * A key with no branch is left **unprobed**, which renders as unsupported with
 * the descriptor's hedged wording — the honest rendering of not having asked.
 *
 * ## ⚠️ The WebSocket deadline is not optional
 *
 * BCN-008 measured it across four failure modes: **`close` never fired once**,
 * and a WebSocket on a path that does not upgrade fires *neither* `error` nor
 * `close` — silent for the full 20 seconds it waited. A probe without a deadline
 * on that transport does not return a negative; it returns nothing, forever, and
 * the port sits unprobed while looking as though a probe is in flight.
 */

import { CapabilityProbeCache, type ProbeOutcome, type ProbeRequest } from '@noodl/backend-contract';

/**
 * How long to wait for a 101 upgrade before calling it a no.
 *
 * BCN-008's measured *definite* answers came in 20ms (Parse) and the Directus
 * handshake settles in well under a second on a healthy instance. Three seconds
 * is far outside both and still short enough that a panel does not feel stuck —
 * and the cost of being wrong is a `conditional` cell staying closed, which is
 * the safe direction.
 */
const WEBSOCKET_DEADLINE_MS = 3000;

/** The same, for an HTTP probe. */
const HTTP_DEADLINE_MS = 5000;

let instance: CapabilityProbeCache | null = null;

/** The editor's single cache. */
export function capabilityProbes(): CapabilityProbeCache {
  if (!instance) instance = new CapabilityProbeCache({ runner: runProbe });
  return instance;
}

/** Test seam — replace the cache with one that has an injected runner/clock. */
export function __setCapabilityProbes(replacement: CapabilityProbeCache | null): void {
  instance = replacement;
}

async function runProbe(request: ProbeRequest): Promise<ProbeOutcome> {
  switch (request.key) {
    case 'realtime.subscribe':
      return probeRealtime(request);
    case 'data.aggregate':
      return probeAggregate(request);
    default:
      // Deliberately not answered. Throwing rather than guessing means the cache
      // records nothing, and `resolveGate` keeps the cell unprobed — closed, with
      // the descriptor's own hedged sentence, rather than closed with a
      // confident sentence we invented.
      throw new Error(`No probe implemented for ${request.key}`);
  }
}

/**
 * Realtime — a 101 upgrade, or a deadline.
 *
 * Nothing else settles it. BCN-008 repointed both descriptor probes at the
 * handshake for exactly this reason: `/server/info` on Directus and
 * `/serverInfo` on Parse say nothing about websockets *even when they are on*,
 * so a probe reading either reports `unsupported` on a working server.
 */
function probeRealtime(request: ProbeRequest): Promise<ProbeOutcome> {
  const url = websocketUrl(request.url, request.probe.path);

  return new Promise<ProbeOutcome>((resolve) => {
    let settled = false;
    let socket: WebSocket | null = null;

    const settle = (outcome: ProbeOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch (e) {
        /* closing a socket that never opened is not an error worth reporting */
      }
      resolve(outcome);
    };

    const timer = setTimeout(
      () =>
        settle({
          verdict: 'unsupported',
          at: Date.now(),
          detail: `no websocket upgrade from ${url} in ${WEBSOCKET_DEADLINE_MS}ms`
        }),
      WEBSOCKET_DEADLINE_MS
    );

    try {
      socket = new WebSocket(url);
    } catch (e) {
      settle({ verdict: 'unsupported', at: Date.now(), detail: 'the websocket URL was refused' });
      return;
    }

    // `open` IS the 101 — the browser does not surface the status line, and an
    // opened socket is the upgrade having happened.
    socket.onopen = () => settle({ verdict: 'supported', at: Date.now() });
    socket.onerror = () =>
      settle({ verdict: 'unsupported', at: Date.now(), detail: 'the websocket connection was refused' });
    // ⚠️ `onclose` is here for completeness and must never be the only path.
    socket.onclose = () =>
      settle({ verdict: 'unsupported', at: Date.now(), detail: 'the websocket closed without upgrading' });
  });
}

/**
 * Aggregates — the shape of the answer, never the status.
 *
 * Only Supabase's cell is `conditional` on this key, and PostgREST's two states
 * are distinguishable: with aggregates disabled it answers **400** with
 * `PGRST123`-family prose about aggregate functions; with them enabled it
 * answers 200 and a row whose single column is the aggregate.
 *
 * ⚠️ Not probed with an embedded-relation count. BCN-001 measured that those
 * answer 200 with aggregates *disabled*, which is the trap the descriptor's
 * header names first.
 */
async function probeAggregate(request: ProbeRequest): Promise<ProbeOutcome> {
  const response = await fetchWithDeadline(`${request.url}${request.probe.path}`, request.probe.method);
  if (!response) return { verdict: 'unsupported', at: Date.now(), detail: 'the server did not answer' };

  if (response.status !== 200) {
    return { verdict: 'unsupported', at: Date.now(), detail: `the server answered ${response.status}` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch (e) {
    return { verdict: 'unsupported', at: Date.now(), detail: 'the server answered something that was not JSON' };
  }

  // A row per group, each carrying the aggregate column. Anything else — an
  // empty body, a list of ordinary records — is the "200 is not a yes" case.
  const rows = Array.isArray(parsed) ? parsed : null;
  if (!rows || rows.length === 0) {
    return { verdict: 'unsupported', at: Date.now(), detail: 'the server answered 200 with no aggregate rows' };
  }

  const first = rows[0] as Record<string, unknown> | null;
  const looksAggregated = !!first && Object.keys(first).some((column) => /count|sum|avg/i.test(column));
  return looksAggregated
    ? { verdict: 'supported', at: Date.now() }
    : {
        verdict: 'unsupported',
        at: Date.now(),
        detail: 'the server answered 200 with ordinary rows rather than an aggregate'
      };
}

/** `http(s)://host/base` + a path → `ws(s)://host/base/path`. */
export function websocketUrl(base: string, path: string): string {
  const scheme = base.startsWith('https:') ? 'wss:' : 'ws:';
  const withoutScheme = base.replace(/^https?:/, '');
  const suffix = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `${scheme}${withoutScheme}${suffix}`;
}

async function fetchWithDeadline(
  url: string,
  method: string
): Promise<{ status: number; body: string } | undefined> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => controller?.abort(), HTTP_DEADLINE_MS);
  try {
    const response = await fetch(url, { method, signal: controller?.signal });
    return { status: response.status, body: await response.text() };
  } catch (e) {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
