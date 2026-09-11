# BEN-003 — The outputs read-out: what the component *emits*

**Status:** ✅ **DONE and driven**, 2026-08-08 · depends on **BEN-001**

## Acceptance, as measured

| Criterion | Evidence |
|---|---|
| The channel question answered in writing, with the probe's output, before any UI | the section below, and register B17 |
| **Live:** a click inside a benched component appends its signal | clicked `Press me` inside `/Components/BenchEmitter`; `+4.8s Pressed` appeared after **1.2s**, on the interval pull alone — nothing in the editor knew the click had happened |
| **Live:** a value output updates when an input that feeds it changes | three `Bump` pulses from the rail moved `Count` **0 → 3**; the in-component click made it **4** |
| **Live:** a logic-only component mounts, accepts inputs, shows outputs | `/Components/BenchLogicProbe` has no visual root. It mounts, the summary says *"nothing to draw — feed it inputs and watch the outputs rail"*, and `Go` ×3 gives `Count` **0 → 3** with three `Changed` rows. ⚠️ `Seed` is wired to `startValue`, which the runtime only reads at init — setting it after mount correctly changes nothing |
| Polling stops when the bench is not the active mode | counted on the wire from a third relay peer: **15** `getTraceEvents` in 10s while benched, **0** in 12s after switching to App preview. A pull carries `afterSeq`, so it is a tail read |
| Arming does not disturb a recording in progress | a third peer armed the app preview as `human-hud`; after the bench mounted, ran and tore down, the app preview still answered `{"enabled":true,"owners":["human-hud"],"highestSeq":37}` |

⚠️ **The disarm is not observable from outside, and that is the targeting working.** A third-party
spy sees only broadcasts — a message carrying a `target` is routed to that socket alone. Zero
`traceEnabled` messages were seen at teardown, which is the same evidence as the app preview being
untouched. What *is* observable is the consequence: polling stops, and the human's recording survives.

## The channel, answered — 2026-08-08, against a live bench client

§1 required this in writing, with the probe's actual output, before any UI. The probe ran as a third
relay peer (the launch token at `~/Library/Application Support/NodeGX/relay-token`), so nothing had to
be instrumented and the raw wire shape is visible. Fixtures authored for it: `/Components/BenchEmitter`
(a value output and a signal output) and `/Components/BenchLogicProbe` (no visual root at all) — **the
corpus contained no component with a declared output**, exactly as it contained none with typed inputs.

**The answer is one channel, not two.** The task expected `getPortValues` for values and the trace for
signals. The trace carries *both*, and carries them better.

### 1. A sandbox client answers `getPortValues` — but it cannot ever show a signal

```
{"values":[{"node":"bench-subject","port":"Count","direction":"output","exists":true,"value":"0"},
           {"node":"bench-subject","port":"Pressed","direction":"output","exists":true,"value":"undefined"},
           {"node":"bench-subject","port":"Label","direction":"input","exists":true,"value":"\"emitter\""},
           {"node":"bench-subject","port":"Nope","direction":"output","exists":false}]}
```

So the command works on a `sandbox-<id>` client, a component **instance**'s outputs are readable by
name, and an undeclared port comes back `exists: false` rather than silently as `undefined`. But
`Pressed` — a signal output — reads `"undefined"` before, during and after firing, because a signal
has no state to read. **`getPortValues` can never answer the half of the task that matters most.**

### 2. `getTraceEvents` carries both kinds, and says which is which

Armed, then `Bump` pulsed and the fixture's button clicked:

```
seq=1 cause=0 kind=value  be-ci.Bump             -> be-counter.increase = true
seq=2 cause=0 kind=value  be-ci.Bump             -> be-counter.increase = false
seq=3 cause=1 kind=value  be-counter.currentCount-> be-count.text       = 5
seq=4 cause=1 kind=value  be-counter.currentCount-> be-co.Count         = 5
seq=5 cause=0 kind=signal be-button.onClick      -> be-counter.increase = true
seq=6 cause=0 kind=signal be-button.onClick      -> be-co.Pressed       = true
seq=7 cause=5 kind=value  be-counter.currentCount-> be-count.text       = 6
seq=8 cause=5 kind=value  be-counter.currentCount-> be-co.Count         = 6
```

A component output is **an edge whose `to.node` is a `Component Outputs` node of the mounted
component**, and `getTraceDictionary` supplies exactly that mapping (`{node: {name, type, component}}`
plus the edge list). `kind` separates the signal from the value; `seq` gives exact ordering.

Decisively: `getTraceEvents(afterSeq)` is a **tail read**, not a sample. Nothing that happens between
two pulls is lost — which is the whole of the Risks table's *"a signal that fires between polls is
missed and the rail lies by omission"*. A `getPortValues` poll has that defect by construction.

### 3. The trace can be armed on ONE client — B2's finding, a second time

`sendTraceEnabled` is a broadcast, and the first probe measured the collateral: both viewers armed,
and the app preview answered `enabled:true`. Adding `target` to that same message fixes it with **no
runtime change**, because the relay routes any message carrying one:

```
armed with target=<bench>   →  bench traceState {"enabled":true,"owners":["ben003-probe2"]}
                               app   traceState {"enabled":false,"owners":[]}
```

So the bench never disturbs the live preview, and TALK-003's *"an agent's `start_trace` destroys a
human's recording"* is avoided by not reaching the human's runtime at all. `getTraceState` is still
sent before arming, as §1 requires, and it answered `{"enabled":false,"owners":[],"highestSeq":0}`.

### 4. ⚠️ Two defects the probe found, both of which must be fixed first

- **No reply on this channel says who sent it.** Measured across all eight replies of the first probe:
  `portValues`, `traceState`, `traceDictionary` and `traceEvents` all arrive with
  `clientId: undefined`. The relay forwards viewer messages verbatim and the runtime does not stamp
  its own id. `TraceSession` already knows the relay broadcasts to every editor peer and de-duplicates
  by `seq` — but that only defends against re-delivery of *its own* client's buffer. A **second**
  client's events are numbered from 1 independently, so `highest < lastSeq` takes the buffer-reset
  branch and **replaces a human's recording with the bench's**. See register B15.
- **A read on an occluded window is stale, and looks broken.** Count=3, `Bump` pulsed, read again:
  still 3. Force a frame with a screenshot, read again: 4. The queued parameter is applied on a frame,
  and an occluded renderer runs none (B10). The read was never wrong. See register B16.

### The decision

| | |
|---|---|
| **Seed** | one `getPortValues` for the declared **value** outputs, so a value set before the bench armed is shown rather than blank |
| **Follow** | `getTraceEvents(afterSeq)` on a tail pull, filtered to edges landing on the mounted component's `Component Outputs` nodes |
| **Arm** | `traceEnabled` **targeted at the bench client**, after `getTraceState`, and disarmed when the bench is not the active mode |
| **Not built** | a second polling route for signals. It would lie by omission, and the trace already answers |

---


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
