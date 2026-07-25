/**
 * Snapshot edge-detection for connection pulses.
 *
 * WHY THIS EXISTS — the shape of the data the recorder receives:
 *
 * The running preview does NOT send discrete "a signal fired" events. On every
 * `connectiondebugpulse` message it sends the *entire* set of connections that
 * are currently pulsing — a **state snapshot**, not an event delta
 * (see `EditorConnection.sendPulsingConnections` in the viewer bundle, which
 * flattens the whole `connectionsToPulse` map). A single real pulse lingers in
 * that map for ~100ms (`clearOldConnectionPulsing` evicts entries only after
 * `now - timestamp > 100`), so the same connection id reappears in many
 * consecutive snapshots for one real firing.
 *
 * The old recorder recorded one event per connection id per snapshot and leaned
 * on a 5ms wall-clock threshold to suppress "duplicates". That is exactly
 * backwards on both counts:
 *   - Snapshots arrive tens-to-hundreds of ms apart, so the 5ms window never
 *     catches the lingering re-emissions -> one click became ~40 rows.
 *   - A genuine rapid repeat on the *same* wire (<5ms apart) got dropped as a
 *     "duplicate" -> the documented data loss.
 *
 * The correct model uses the ids and the snapshot sequence the recorder already
 * has, with no time heuristic: a connection is a NEW pulse only on the frame it
 * transitions **absent -> present** in the snapshot set (a rising edge). While a
 * connection stays present it is the same lingering pulse and is ignored; once
 * it drops out of the set and later reappears, that reappearance is a new pulse.
 * This collapses the linger flood AND preserves legitimate repeats that the
 * runtime actually re-exposed as separate pulses.
 *
 * This module is intentionally pure and dependency-free so the core rule can be
 * unit-tested without a running project or Electron.
 *
 * @module triggerChain
 */

/**
 * Result of diffing one incoming snapshot against the previously-active set.
 */
export interface SnapshotDiff {
  /** Connection ids that just started pulsing (absent before, present now). */
  edges: string[];
  /** The de-duplicated membership of this snapshot, to carry as the new state. */
  active: Set<string>;
}

/**
 * Compute the rising edges of a pulse snapshot.
 *
 * @param previousActive - Connection ids that were pulsing in the prior snapshot
 * @param snapshot - Connection ids pulsing in the incoming snapshot (may contain
 *                   duplicates from fan-out flattening; they are collapsed)
 * @returns The newly-started connection ids and the snapshot's membership set
 */
export function diffPulseSnapshot(previousActive: ReadonlySet<string>, snapshot: Iterable<string>): SnapshotDiff {
  const active = new Set<string>();
  const edges: string[] = [];

  for (const id of snapshot) {
    if (active.has(id)) {
      // Same id twice within one snapshot (fan-out flattening) — one pulse.
      continue;
    }
    active.add(id);
    if (!previousActive.has(id)) {
      edges.push(id);
    }
  }

  return { edges, active };
}
