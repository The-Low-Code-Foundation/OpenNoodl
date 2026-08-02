# OBS-001: The trace substrate

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OBS-001 |
| **Phase** | Phase 36 (Track U) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical — everything else in the phase consumes this |
| **Difficulty** | 🟡 Medium — one file carries most of it, but it is a hot path |
| **Prerequisites** | none |
| **Consumers** | OBS-002 (the walk), OBS-004 (the agent), the existing canvas pulse animation |

## Objective

Replace the frame-flushed, connection-keyed **map** the runtime uses to report debug activity with an
append-only, per-edge **event log** plus a session dictionary — so that ordering, repeats and
causality survive to the consumer.

## Background

The runtime's debug reporting is a map keyed by output id, flushed once per frame:

```js
// nodecontext.ts:454
NodeContext.prototype.connectionSentValue = function (output, value) {
  if (!this.editorConnection || !this.editorConnection.isConnected() || !this.debugInspectorsEnabled) {
    return;                                    // ← opt-in is already free. Preserve this.
  }
  const timestamp = this.getCurrentTime();
  this._outputHistory[output.id] = { value, timestamp };

  if (this.connectionsToPulse.hasOwnProperty(output.id)) {
    this.connectionsToPulse[output.id].timestamp = timestamp;
    return;                                    // ← the defect: a re-fire produces no event
  }
  ...
};
```

Three consequences, all of which killed the shelved Trigger Chain Debugger:

1. **A wire firing twice with different values is unrepresentable.** The second fire overwrites the
   value and bumps a timestamp. This is not a tuning problem; the data structure cannot hold it.
2. **Intra-frame ordering is destroyed.** `updateDirtyNodes()` runs a whole causal cascade inside one
   frame — a while-loop of up to 10 iterations plus after-update callbacks
   ([nodecontext.ts:241-280](../../../packages/noodl-runtime/src/nodecontext.ts#L241-L280)) — and one
   snapshot is sent at the end ([:293](../../../packages/noodl-runtime/src/nodecontext.ts#L293)).
3. **There is no causality at all.** Nothing records that B fired *because of* A.

⚠️ **Read [snapshotDiff.ts](../../../packages/noodl-editor/src/editor/src/utils/triggerChain/snapshotDiff.ts)
first.** Its header is the best existing description of this data's shape, written by the session that
fixed the linger-flood half of the problem (one click → ~40 rows). This task does not undo that work;
it removes the need for it.

## What already works and must not be broken

| Behaviour | Why it matters |
|---|---|
| **Opt-in is already free.** [nodecontext.ts:455](../../../packages/noodl-runtime/src/nodecontext.ts#L455) returns on the first statement when debugging is off | Richard's explicit requirement: no cost in an app nobody is debugging. Cost today is one boolean per propagation, zero storage. `traceEnabled` must keep exactly this discipline |
| **Fan-out is already per-edge.** [nodecontext.ts:474-476](../../../packages/noodl-runtime/src/nodecontext.ts#L474-L476) builds `fromNode + fromPort + toNode + toPort` per connection | The per-edge event shape is not an invention — it is what the runtime already computes |
| **Signals already route through the value path** with a monotonic counter ([:490-501](../../../packages/noodl-runtime/src/nodecontext.ts#L490-L501)) | Signals and values need one event type, not two |
| **The snapshot path drives canvas wire-pulse animation** | ⚠️ **Do not remove it.** The two paths coexist. This task is additive |

## Scope

### 1. Per-edge append-only events

One event per edge per firing. Fan-out to three inputs is three sibling events sharing a cause.

```
{ seq, t, cause, from: {node, port}, to: {node, port}, value, kind: 'value' | 'signal' }
```

- `seq` — monotonic, assigned at propagation time. This is the ordering, not the timestamp.
- `cause` — the `seq` of the event being processed when this one was emitted. This is the tree.
- `value` — a **bounded preview string**, not the object. See the perf note below.

### 2. A `traceEnabled` flag distinct from `debugInspectorsEnabled`

Turning on the trace must not force canvas inspectors on, and vice versa. Wire it the same way
`debuggingEnabled` is wired ([editorconnection.ts:207](../../../packages/noodl-runtime/src/editorconnection.ts#L207)
→ [viewer.jsx:256](../../../packages/noodl-viewer-react/src/viewer.jsx#L256)) — a new relay command.

### 3. Record everything while recording

Today values stream only for inspectors the editor pinned
([nodecontext.ts:217](../../../packages/noodl-runtime/src/nodecontext.ts#L217)) — Richard's *"hoping
you see the right data go by to be able to pin it"*. In trace mode, capture all propagations.

### 4. The session dictionary

Sent once when tracing starts, delta'd on graph change:

```
{ nodes: { [id]: { name, type, component } },
  edges: [ { from: {node, port}, to: {node, port} } ] }
```

Events then carry **ids only**. Three reasons this shape and not denormalised names:

- ~4–5× smaller events, which is what makes a large buffer affordable.
- Search-by-name resolves against the dictionary to a set of ids first, then filters — fast over
  250k events with no per-row string matching.
- ⚠️ **The topology is load-bearing, not a nicety.** OBS-002's backward walk and OBS-004's agent
  both need to know what *should* be connected in order to diff it against what fired. Shipping the
  edge list here is what lets the agent do the walk **without project access** — which sidesteps the
  fact that the MCP server currently refuses legacy projects and v2 is still default-off
  ([featureFlags.ts:22](../../../packages/noodl-editor/src/editor/src/services/ProjectStructure/featureFlags.ts#L22)).

### 5. Buffer and session lifetime

- Count-capped ring buffer. Proposed default 250k events (~40–60MB at 150–250 bytes each).
- Cleared on **trace start** and on **preview reload** (`applicationDataReloaded` is the existing hook).
- Not time-based. See open question 2 in the [README](./README.md).

## Performance — the one real risk

Capturing every value on every propagation, app-wide.
[`_formatConnectionValue`](../../../packages/noodl-runtime/src/nodecontext.ts#L440) is the right seam,
but it currently returns the value itself for most types. Serialising a large collection or a
DOM-heavy value on every fire will tank the preview.

**Store a bounded preview string, never the object.** Cap at ~200 chars. This is the memory lever
that actually matters — far more than the event count.

Second-order: a repeater over 100 rows produces a lot of events. The ring buffer absorbs it and
OBS-002 aggregates on display; no per-frame cap should be needed, but measure before assuming.

## Acceptance

- [ ] A wire that fires twice in one frame with different values produces **two** events with
      distinct `seq` and both values.
- [ ] Events emitted during one cascade carry `cause` chains that reconstruct the propagation tree.
- [ ] Fan-out to N inputs produces N sibling events sharing a `cause`.
- [ ] With tracing off, no allocation occurs on the propagation path (verify by inspection of the
      early return, plus a profiler pass on a busy fixture).
- [ ] The canvas wire-pulse animation is unchanged.
- [ ] The dictionary lets a consumer render a chain with real node names and no project access.
- [ ] Buffer clears on preview reload; memory is bounded under a sustained-firing fixture.

## Notes

The NodeGX QA fixture is the natural test project — it has enough structure to produce a real
cascade. A sustained-firing case (a repeater over a growing collection) should be added for the
memory test.
