'use strict';

/**
 * The trace substrate (OBS-001): an append-only, per-edge event log.
 *
 * WHY THIS EXISTS — what the old debug path could not represent:
 *
 * The runtime's long-standing debug reporting is a **map keyed by output id**, flushed once
 * per frame (`NodeContext.connectionSentValue`). A wire that fires twice inside one frame
 * overwrites its own entry and bumps a timestamp, so the second firing produces no record at
 * all. Intra-frame ordering is destroyed the same way: `updateDirtyNodes` runs an entire
 * causal cascade — a while-loop of up to 10 iterations plus after-update callbacks — and one
 * snapshot is sent at the end. And nothing anywhere records that B fired *because of* A.
 *
 * That is not a tuning problem. It is a data structure that cannot hold the information, and
 * it is why the shelved Trigger Chain Debugger produced "a huge list of useless crap" no
 * amount of filtering could rescue. See `snapshotDiff.ts` in the editor for the best existing
 * description of the snapshot shape, written by the session that fixed the linger-flood half
 * of the problem — this module removes the need for that diff rather than undoing it.
 *
 * The two paths coexist deliberately. The snapshot path still drives the canvas wire-pulse
 * animation and is untouched.
 *
 * THE COST DISCIPLINE. With tracing off, nothing here is reached and nothing is allocated —
 * every call site guards on a boolean first. That is a hard requirement, not an aspiration:
 * an app nobody is debugging must pay one boolean per propagation and no storage.
 *
 * @module tracebuffer
 */

/**
 * One value or signal crossing one edge, once.
 *
 * ⚠️ Stored **flat** rather than as the `{from: {node, port}, to: {node, port}}` shape the
 * OBS-001 spec sketches. The spec's own rationale for a session dictionary is event size —
 * ~150-250 bytes each is what makes a 250k buffer affordable — and two nested objects per
 * event add ~64-100 bytes of object header before any content, which breaks that budget at
 * exactly the scale the budget was written for. {@link toWireEvent} restores the nested shape
 * on the way out, so consumers (OBS-002, OBS-004) code against the documented contract and
 * pay the allocation only for events actually shipped, which is far fewer than are stored.
 */
export interface TraceEvent {
  /** Monotonic, assigned at propagation time. **This is the ordering, not `t`.** */
  seq: number;
  /** Wall clock, for display only. Many events share a millisecond. */
  t: number;
  /**
   * The `seq` of the event that delivered the input being processed when this one was
   * emitted, or `0` for a root (a timer, a DOM event, boot — anything not caused by another
   * edge). This is the tree.
   */
  cause: number;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
  /** A **bounded preview string**, never the value itself. See {@link previewValue}. */
  value: string;
  kind: 'value' | 'signal';
}

/** The nested shape OBS-002 and OBS-004 consume. */
export interface WireTraceEvent {
  seq: number;
  t: number;
  cause: number;
  from: { node: string; port: string };
  to: { node: string; port: string };
  value: string;
  kind: 'value' | 'signal';
}

export function toWireEvent(e: TraceEvent): WireTraceEvent {
  return {
    seq: e.seq,
    t: e.t,
    cause: e.cause,
    from: { node: e.fromNode, port: e.fromPort },
    to: { node: e.toNode, port: e.toPort },
    value: e.value,
    kind: e.kind
  };
}

/** Ids to names, types, components, and the connection topology. Sent once, delta'd. */
export interface SessionDictionary {
  nodes: Record<string, { name: string; type: string; component: string }>;
  edges: Array<{ from: { node: string; port: string }; to: { node: string; port: string } }>;
}

/**
 * Who is tracing, and how far the buffer has got — HUD-004.
 *
 * ⚠️ **`owners` is a label list, never a credential.** The relay's authorisation gate is
 * per-socket and checked on `register`; a peer that got past it can name itself anything. This
 * exists so a surface can say *"also traced by an agent"* instead of pretending it is alone —
 * ownership must not become a trust decision anywhere.
 */
export interface TraceState {
  /** Derived: whether any owner is holding the trace. */
  enabled: boolean;
  owners: string[];
  /** The last `seq` assigned, or 0 when there is no buffer. */
  highestSeq: number;
}

/** Default character cap for a value preview. The real memory lever — see the module note. */
export const DEFAULT_VALUE_CAP = 200;

/** Default event capacity. ~40-60MB at 150-250 bytes per event. */
export const DEFAULT_CAPACITY = 250000;

/** Thrown internally by the bounded writer to unwind as soon as the cap is reached. */
const OVER_CAP = {};

/**
 * Render a value to a preview string of at most `cap` characters.
 *
 * ⚠️ **This is the one real performance risk in OBS-001 and the reason this is hand-written
 * rather than a `JSON.stringify` call.** In trace mode every propagation is captured, app-wide.
 * `JSON.stringify` has no early exit, so a repeater bound to a 10,000-row collection would
 * serialise the whole collection on every fire and then throw away all but 200 characters of
 * it — which would tank the very preview the author is trying to debug. This walker stops
 * writing the moment it is over budget, so the cost is bounded by the cap and not by the size
 * of the value.
 *
 * It must also never throw: a failure in the diagnostic channel is the worst possible bug.
 */
export function previewValue(value: unknown, cap: number = DEFAULT_VALUE_CAP): string {
  const out: string[] = [];
  let written = 0;
  const seen = new Set<unknown>();

  function put(s: string): void {
    written += s.length;
    if (written > cap) {
      out.push(s.slice(0, Math.max(0, s.length - (written - cap))));
      throw OVER_CAP;
    }
    out.push(s);
  }

  function walk(v: unknown, depth: number): void {
    if (v === null) return put('null');
    if (v === undefined) return put('undefined');

    const t = typeof v;
    if (t === 'string') return put('"' + (v as string) + '"');
    if (t === 'number') return put(Number.isNaN(v) ? 'NaN' : String(v));
    if (t === 'boolean' || t === 'bigint') return put(String(v));
    if (t === 'function') return put('<function ' + ((v as { name?: string }).name || 'anonymous') + '>');
    if (t === 'symbol') return put(String(v));

    // A runtime Node reaching a port — matches `_formatConnectionValue`'s long-standing shape.
    const ctorName = (v as { constructor?: { name?: string } }).constructor?.name;
    if (ctorName === 'Node') return put('<Node> ' + ((v as { name?: string }).name || ''));

    if (typeof window !== 'undefined' && typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) {
      return put('DOM Node <' + v.tagName + '>');
    }

    if (v instanceof Date) return put(v.toISOString());

    if (seen.has(v)) return put('[Circular]');
    // Depth is bounded independently of the cap so a deeply-nested-but-tiny value cannot
    // build an unbounded call stack.
    if (depth > 6) return put('…');
    seen.add(v);

    if (Array.isArray(v)) {
      put('[');
      for (let i = 0; i < v.length; i++) {
        if (i > 0) put(',');
        walk(v[i], depth + 1);
      }
      put(']');
      return;
    }

    // A Collection or Model — Noodl's own containers print far better by identity than by
    // their internals, and their internals are exactly what is expensive to walk.
    if (ctorName === 'Collection' || ctorName === 'Model') {
      const id = (v as { id?: unknown }).id;
      return put('<' + ctorName + (id !== undefined ? ' ' + String(id) : '') + '>');
    }

    put('{');
    let first = true;
    for (const k in v as Record<string, unknown>) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      if (!first) put(',');
      first = false;
      put(k + ':');
      walk((v as Record<string, unknown>)[k], depth + 1);
    }
    put('}');
  }

  try {
    walk(value, 0);
  } catch (e) {
    if (e === OVER_CAP) return out.join('') + '…';
    // Any other failure is a bug in the walker, and a broken preview must not break the app.
    return '<unpreviewable>';
  }

  return out.join('');
}

/**
 * A count-capped ring buffer of {@link TraceEvent}s.
 *
 * Cleared on trace start and on preview reload (`applicationDataReloaded`), never on a timer —
 * count-capped plus clear-on-reload is more predictable than a time window, and the buffer is
 * an index for the walk rather than something anyone reads front to back.
 */
export class TraceBuffer {
  private events: TraceEvent[];
  private capacity: number;
  private writeIndex = 0;
  private wrapped = false;
  /** Monotonic across the whole session — it does **not** reset when the ring wraps. */
  private nextSeq = 1;

  constructor(capacity: number = DEFAULT_CAPACITY) {
    this.capacity = Math.max(1, capacity);
    this.events = new Array(this.capacity);
  }

  /** The seq the next {@link push} will assign, without consuming it. */
  peekNextSeq(): number {
    return this.nextSeq;
  }

  /**
   * Append one edge event and return its `seq`, so the caller can hand that seq to the
   * receiving node as the cause of whatever it does next.
   */
  push(
    t: number,
    cause: number,
    fromNode: string,
    fromPort: string,
    toNode: string,
    toPort: string,
    value: string,
    kind: 'value' | 'signal'
  ): number {
    const seq = this.nextSeq++;
    this.events[this.writeIndex] = { seq, t, cause, fromNode, fromPort, toNode, toPort, value, kind };
    this.writeIndex++;
    if (this.writeIndex >= this.capacity) {
      this.writeIndex = 0;
      this.wrapped = true;
    }
    return seq;
  }

  /** How many events are currently held (≤ capacity). */
  get size(): number {
    return this.wrapped ? this.capacity : this.writeIndex;
  }

  /** Every held event in propagation order, oldest first. */
  toArray(): TraceEvent[] {
    if (!this.wrapped) return this.events.slice(0, this.writeIndex);
    return this.events.slice(this.writeIndex).concat(this.events.slice(0, this.writeIndex));
  }

  /**
   * Events with `seq` greater than `afterSeq`, oldest first — the incremental read the editor
   * uses to tail a running trace without re-reading what it already has.
   */
  since(afterSeq: number): TraceEvent[] {
    const all = this.toArray();
    let lo = 0;
    let hi = all.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (all[mid].seq <= afterSeq) lo = mid + 1;
      else hi = mid;
    }
    return all.slice(lo);
  }

  /**
   * Drop every held event. `seq` deliberately keeps counting: a cause recorded on a node
   * before the clear must never collide with a fresh event after it.
   */
  clear(): void {
    this.events = new Array(this.capacity);
    this.writeIndex = 0;
    this.wrapped = false;
  }
}
