/**
 * HUD-001 / HUD-002 — everything the recording overlay *decides*, as pure functions.
 *
 * The overlay itself is a React component over the canvas, and React components are not
 * testable in this repo's editor suite (the specs are jasmine in Electron, and nothing renders
 * React). So the part that can be wrong lives here and `RecordingOverlay` only positions the
 * results — the same split `ProvenancePanel` has against `walkEngine`.
 *
 * ⚠️ **Nothing here reads `TraceEvent.t`, and that is not an oversight.** `t` is
 * `platform.getCurrentTime()`, which in the browser viewer is `window.performance.now()`
 * ([noodl-viewer-react.js:42](../../../../../noodl-viewer-react/noodl-viewer-react.js)) —
 * milliseconds since the *preview page* loaded, not a wall clock. Ageing a badge by comparing
 * it to the editor's `Date.now()` would put every badge fifty-odd years in the past and nothing
 * would ever be drawn. What a fade actually wants is *how long since I saw this*, so the fold
 * stamps the editor's own clock on the way in; the runtime's clock is never subtracted from the
 * editor's anywhere in this file. (`t` is still fine for *display*, which is all the runtime
 * ever claimed for it — see `tracebuffer.ts`: "Wall clock, for display only.")
 */

import type { TraceEventLike } from './walkEngine';

/** How long a node stays badged after the last event that touched it. */
export const BADGE_FADE_MS = 3000;

/**
 * The most badges painted at once.
 *
 * Not a correctness cap — the off-canvas summary counts every node whatever this is — but a
 * paint cap. The overlay re-renders on every poll *and* every pan, and a recording that touched
 * four hundred nodes would otherwise lay four hundred absolutely-positioned divs over the
 * canvas four times a second. The newest are kept, which is what "this just happened" means.
 */
export const BADGE_LIMIT = 40;

/** Above this many distinct components off canvas, the summary counts them instead of naming them. */
export const MAX_NAMED_COMPONENTS = 3;

export interface BadgeEntry {
  /**
   * Events touching this node at **either** end — the `40×` on the badge.
   *
   * Both ends, because an edge firing is two facts — something emitted and something received —
   * and a user watching their graph light up is watching the wire, not one of its ends.
   */
  touches: number;
  /**
   * Events **delivered to** this node. Summed across nodes this is the event total with each
   * event counted exactly once, which is what makes the off-canvas number a count of events
   * rather than a double-count of edge ends.
   */
  received: number;
  /**
   * The highest `seq` seen for this node — the badge order.
   *
   * ⚠️ `seq`, never `t`. Delivery in the runtime is **queued, not a call stack** (OBS-001):
   * many events share a millisecond and `t` is explicitly display-only, so ordering by it
   * shuffles the causal story into arrival noise.
   */
  lastSeq: number;
  /** When the **editor** folded it in. See the file header for why this is not `t`. */
  seenAt: number;
}

export interface BadgeState {
  nodes: Record<string, BadgeEntry>;
  /** The highest `seq` folded so far, so the next fold is a delta over the session's buffer. */
  lastSeq: number;
  /** Every event folded in this recording. */
  total: number;
}

export const EMPTY_BADGE_STATE: BadgeState = Object.freeze<BadgeState>({ nodes: {}, lastSeq: 0, total: 0 });

/**
 * Fold the session's buffer into one badge per node.
 *
 * The session hands over its whole accumulated array on every `eventsChanged`, so this takes
 * the delta above `lastSeq` rather than re-reading it. Three behaviours are load-bearing:
 *
 * - **An empty buffer is a reset.** `TraceSession.start()` and `clear()` both empty the array;
 *   a fold that ignored that would draw the previous recording over the new one.
 * - **A batch numbered below what we hold means the runtime renumbered.** A reloaded preview
 *   builds a fresh `TraceBuffer` starting at 1 and the session replaces its array wholesale;
 *   this is the same rule seen from the overlay's side, and without it every event after a
 *   mid-recording reload would be filtered away as "already seen".
 * - **Nothing new returns the same reference**, so a poll that answered "no change" does not
 *   re-render the overlay, and every badge with it, on a 1.5s cadence forever.
 */
export function foldEvents(state: BadgeState, events: readonly TraceEventLike[], now: number): BadgeState {
  if (events.length === 0) return state === EMPTY_BADGE_STATE ? state : EMPTY_BADGE_STATE;

  const highest = events[events.length - 1].seq;
  const base = highest < state.lastSeq ? EMPTY_BADGE_STATE : state;

  const nodes: Record<string, BadgeEntry> = { ...base.nodes };
  let lastSeq = base.lastSeq;
  let folded = 0;

  const touch = (nodeId: string, received: boolean, seq: number) => {
    const previous = nodes[nodeId];
    nodes[nodeId] = previous
      ? {
          touches: previous.touches + 1,
          received: previous.received + (received ? 1 : 0),
          lastSeq: Math.max(previous.lastSeq, seq),
          seenAt: now
        }
      : { touches: 1, received: received ? 1 : 0, lastSeq: seq, seenAt: now };
  };

  // The session's array is the whole accumulated buffer — up to a quarter of a million events —
  // and this runs on every poll. `seq` ascends, so the delta is a suffix: walk back to find
  // where it starts rather than filtering the lot forty times a minute.
  let start = events.length;
  while (start > 0 && events[start - 1].seq > base.lastSeq) start--;

  for (let i = start; i < events.length; i++) {
    const event = events[i];
    folded++;
    if (event.seq > lastSeq) lastSeq = event.seq;
    touch(event.from.node, false, event.seq);
    touch(event.to.node, true, event.seq);
  }

  if (folded === 0) return base;

  return { nodes, lastSeq, total: base.total + folded };
}

export interface Badge {
  nodeId: string;
  /** {@link BadgeEntry.touches} — what the badge reads. */
  count: number;
  lastSeq: number;
  /** Milliseconds since the editor last saw this node fire. Never negative. */
  age: number;
}

/**
 * The badges still worth drawing.
 *
 * ⚠️ **The fade is what keeps the display meaning "this just happened".** Without it, thirty
 * seconds of clicking lights the whole graph and the overlay quietly turns into a coverage map.
 * It is presentational only: the events stay in the session, so the Provenance walk still sees
 * every one of them long after the badge has gone.
 */
export function visibleBadges(state: BadgeState, now: number, options?: { fadeMs?: number; limit?: number }): Badge[] {
  const fadeMs = options?.fadeMs ?? BADGE_FADE_MS;
  const limit = options?.limit ?? BADGE_LIMIT;

  const out: Badge[] = [];
  for (const nodeId of Object.keys(state.nodes)) {
    const entry = state.nodes[nodeId];
    const age = Math.max(0, now - entry.seenAt);
    if (age >= fadeMs) continue;
    out.push({ nodeId, count: entry.touches, lastSeq: entry.lastSeq, age });
  }

  out.sort((a, b) => b.lastSeq - a.lastSeq);
  return out.length > limit ? out.slice(0, limit) : out;
}

/** How opaque a badge of a given age should be: solid for most of its life, then out. */
export function badgeOpacity(age: number, fadeMs: number = BADGE_FADE_MS): number {
  const holdFor = fadeMs * 0.66;
  if (age <= holdFor) return 1;
  if (age >= fadeMs) return 0;
  return Math.max(0, 1 - (age - holdFor) / (fadeMs - holdFor));
}

export interface OffCanvasSummary {
  /** Distinct nodes that fired and cannot be placed on the open canvas. */
  nodes: number;
  /** Events delivered to those nodes. Exact: each event is attributed to its receiver, once. */
  events: number;
  /** The components they live in — empty when there are too many to name usefully. */
  components: string[];
}

export const EMPTY_OFF_CANVAS: OffCanvasSummary = Object.freeze<OffCanvasSummary>({
  nodes: 0,
  events: 0,
  components: []
});

/**
 * What fired somewhere the user is not looking — Q3's honest half.
 *
 * Events arrive for the whole app while the canvas shows one component, and both silent
 * alternatives are lies: badging only what is open makes a click that fires forty events
 * elsewhere read as *nothing happened*, and counting app-wide with no explanation sends the
 * user hunting for badges that were never going to appear.
 *
 * ⚠️ **Derived at render, never cached.** `isOnCanvas` resolves against the *currently open*
 * graph, which changes underneath the overlay on every navigation — the same reason
 * `ExecutionOverlay` computes its "N are not in this graph" in render rather than memoising it.
 * A node deleted since it fired fails the same test, and deliberately gets no message of its
 * own: it is the same sentence and the same remedy.
 *
 * ⚠️ The component names come from the **trace dictionary**, which carries a component per node,
 * so naming where the events landed needs no project access at all.
 */
export function offCanvas(
  state: BadgeState,
  isOnCanvas: (nodeId: string) => boolean,
  componentOf: (nodeId: string) => string | undefined,
  options?: { maxNamed?: number }
): OffCanvasSummary {
  let nodes = 0;
  let events = 0;
  const components = new Set<string>();

  for (const nodeId of Object.keys(state.nodes)) {
    if (isOnCanvas(nodeId)) continue;
    nodes++;
    events += state.nodes[nodeId].received;
    const component = componentOf(nodeId);
    if (component) components.add(component);
  }

  const maxNamed = options?.maxNamed ?? MAX_NAMED_COMPONENTS;
  return {
    nodes,
    events,
    components: components.size > 0 && components.size <= maxNamed ? Array.from(components).sort() : []
  };
}

/**
 * The live counter in the header.
 *
 * App-wide, and explicit about what is not on this canvas — TALK-003 Q3. Counting only what is
 * open would make a click that fires forty events elsewhere read as nothing at all.
 */
export function headerSummary(eventCount: number, off: OffCanvasSummary = EMPTY_OFF_CANVAS): string {
  const events = `${eventCount} event${eventCount === 1 ? '' : 's'}`;
  if (off.events === 0) return events;
  if (off.components.length > 0) return `${events} · ${off.events} on ${off.components.join(', ')}`;
  return `${events} · ${off.events} on other components`;
}

/**
 * The second line, when the header alone would be ambiguous.
 *
 * ⚠️ **A count of zero is a result and has to look like one.** A recording that has captured
 * nothing yet and a HUD that failed to mount look identical on an untouched canvas, and the user
 * reading it has just pressed Record and clicked their app. Never a placeholder, never a spinner:
 * the number is live (the session polls every 1.5s whether or not any surface is open, FH-011),
 * so a live zero is the honest answer to "did my click do anything?".
 *
 * ⚠️ **And an empty canvas under a busy counter is the same failure one step along** — HUD-002
 * criterion 5. Recording on a component where nothing fires is the ordinary case (the user is
 * looking at the wrong component), and saying nothing makes it look like the badges are broken.
 */
export function canvasNote(input: {
  recording: boolean;
  eventCount: number;
  /** Badges that actually resolved to a position on the open canvas. */
  onCanvasBadges?: number;
  off?: OffCanvasSummary;
}): string | undefined {
  if (!input.recording) return undefined;
  if (input.eventCount === 0) {
    return 'Nothing has fired yet — use the app in the preview. This updates about once a second.';
  }

  const off = input.off ?? EMPTY_OFF_CANVAS;
  if ((input.onCanvasBadges ?? 0) > 0) return undefined;
  if (off.components.length > 0) {
    return `Nothing has fired on this component. Open ${off.components.join(' or ')} to watch it happen.`;
  }
  if (off.events > 0) return 'Nothing has fired on this component — it is all happening elsewhere in the app.';
  return undefined;
}
