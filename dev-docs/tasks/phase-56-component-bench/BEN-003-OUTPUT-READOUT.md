# BEN-003 — The outputs read-out: what the component *emits*

**Status:** 📋 not started · depends on **BEN-001**

## Why this is not optional

Richard asked to "see what displays **and how it works**". Pixels answer the first half. A card that
renders beautifully and never fires its `onClick` looks identical to one that works.

It also changes what the bench can cover. Today a component with no visual root is refused —
*"has no visual root — there is nothing to render"* ([sandboxExport.ts:171-173](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxExport.ts#L171-L173)).
With an outputs rail, a logic-only component becomes previewable for the first time in the product's
history: feed it inputs, fire a signal, watch what comes out. BEN-001 §4 already mounts it; this task
gives it a display.

## The mechanism, and the thing to check first

**The editor pulls; the runtime never pushes.** That is a deliberate design decision recorded at
[ViewerConnection.ts:484-492](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L484-L492)
— streaming events at the renderer is what killed the shelved Trigger Chain Debugger. Do not add a
push channel for this.

Two existing pull surfaces, and the task must establish which one fits before writing UI:

1. **`sendGetPortValues(clientId, ports)`** ([:543](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L543))
   — asks for named ports on named nodes and self-filters by clientId. Straightforward for **value**
   outputs; polling-shaped, so it will not catch a signal that fired between polls.
2. **The OBS-002 trace buffer** (`getTraceState` / `getTraceDictionary` / `getTraceEvents`, tail-read
   by `afterSeq`) — an index the walk queries. This is the right shape for **signals**, which are
   events, not states.

⚠️ **`start_trace` from an agent destroys a human's recording** (TALK-003). Whatever the bench arms,
it must identify itself as owner the way `sendTraceEnabled` already stamps `owner: this.clientId`
([:505-511](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L505-L511)), and it
must send `getTraceState` *before* arming so it knows whether it joined a recording or started one.

**Do not assume either surface works on a sandbox client.** Both were built for the app preview.
Establishing that a `sandbox-<id>` client answers them is step one of this task, and if it does not,
that is a finding for the register, not a silent scope cut.

## Build

### 1. Establish the channel

A throwaway probe against a live bench client, before any UI: ask for one known value output and one
known signal, and record what comes back. Write the answer into NOTES. If the sandbox client is
invisible to these commands, file it and pick the other one.

### 2. The rail

Below the inputs rail, in the same right-hand column:

- **Value outputs** — name, current value, and a subtle flash when it changes. Read via
  `getPortValues`, polled while the bench is visible and **not** while it is hidden (R3 keeps the
  other webview alive; do not keep polling it).
- **Signal outputs** — an append-only log: `12:04:31 · onSubmit`, newest last, capped and scrollable.
  Clear button.
- Empty state: *"Nothing emitted yet — interact with the component, or fire an input signal."*

### 3. Pacing

⚠️ **An occluded Electron window clamps timers ~1000×.** A poll loop written with `setInterval` in a
backgrounded renderer will appear to hang. If the read-out ever runs while not frontmost, pace it
with `MessagePort` the way the existing drivers do.

## Acceptance

- [ ] The channel question is answered in writing, with the probe's actual output, before any UI
      lands.
- [ ] **Live:** clicking a button inside a benched component appends its signal to the log.
- [ ] **Live:** a value output updates in the rail when an input that feeds it changes.
- [ ] **Live:** a logic-only component (no visual root) mounts, accepts inputs, and shows outputs —
      the previously impossible case.
- [ ] Polling stops when the bench is not the active mode; verified, not asserted.
- [ ] Arming the trace from the bench does not disturb a recording already in progress.

## Risks

| Risk | Mitigation |
|---|---|
| Polling cost with a large component | Only poll declared component outputs — a bounded set from the interface, never the whole graph |
| The trace channel is heavier than the feature deserves | Ship value outputs on `getPortValues` first; signals can be a second slice if the trace route proves expensive |
| A signal that fires between polls is missed and the rail lies by omission | If signals land on the polling route rather than the trace route, say so in the UI — an incomplete log presented as complete is the `fake-is-an-unchecked-claim` failure |
