# Phase 36 — Runtime Observability (Track U)

**Created:** 2026-08-02
**Origin:** not the roadmap. Richard asked whether a regular user's Claude Code could debug their app
the way this session debugs the editor. Answering it honestly meant reading the runtime's debug
path, and what turned up was a **shipped, complete instrumentation subsystem that nothing good is
built on top of**.

## What this phase is

The running preview already tells the editor everything: every port value, every wire that fires,
every node-local warning. That stream has existed for years. Three things consume it — the canvas
wire-pulse animation, pinned value inspectors, and a shelved `experimental: true` panel that
produced "a huge list of useless crap".

**Phase 36 is the answer to a question the instrumentation was never asked:** *"I clicked Add To
Cart and nothing appeared in the repeater. Where did it stop?"*

The through-line: **the user always knows the symptom and never knows the middle.** Every design here
follows from refusing to make them search the middle.

## The design position

Recorded first because the tasks only make sense downstream of it.

### The log is never the surface

Everything we considered building first — a filterable event list, a search bar, a timeline — asks
the user to *find* the failure in a stream. That works at ten nodes and collapses at four hundred.

But we have the graph *and* the trace. What should be connected is knowable statically; what actually
fired is knowable from the trace. **Diff them and the answer is computed, not searched.**

So the trace is an index. The surface is a walk.

### One walk, three annotation layers

Right-click any port → walk backwards through the connections. Each hop is annotated by whatever
information exists:

| Layer | Annotation | Needs | Answers |
|---|---|---|---|
| **1 — Provenance** | each hop's *current* value | nothing — works on a cold editor | *"Why is this label X?"* |
| **2 — Temporality** | *changed at 14:02:11* / *never fired* / *fired, value unchanged* | a trace | *"Why didn't it change when I clicked?"* |
| **3 — Diagnosis** | ⚠ node-local invariant violations | per-node checks | *"…**there** it is"* |

**Layer 1 requires nothing to have fired.** That was the design's turning point — Richard's examples
("why is the label X?", "why is padding 10px?") are *state provenance* questions, a different class
from causal ones, and they are answerable cold. The same surface serves both and gets richer with a
trace rather than requiring one.

The ✓/✕ boundary in a layer-2 walk **is** the bug. No scanning.

### Scale comes from topology, not filtering

Both walks are bounded by **graph topology, not event volume**. Four hundred unrelated nodes firing
continuously are not upstream of `Repeater.Items`, so they never appear. The firehose stays in the
buffer, unread. This is why the walk scales where a filtered list does not.

### The aha moments are mostly not LLM work

The worked example was: a States node received `"Clicked"` but the state is named `"clicked"`.

That diagnosis is `if (!this.states.includes(value)) warn(...)`. The States node knows its own state
names. An LLM would also catch it — expensively, non-deterministically, and only when online. Most
"aha" moments are **node-local invariants nobody has written yet**, and the channel that reports them
([`sendWarning`](../../../packages/noodl-runtime/src/editorconnection.ts#L480) — danger ring +
Problems panel entry) has been shipped and in use for years.

**An LLM is a consumer of this phase, not a requirement of it.** Layers 1–3 are deterministic,
offline, free and instant. Layer 4 — *"I don't know what's wrong, figure it out"* — is genuine LLM
work, and note Richard's own phrasing for it: *"let me fire a couple of buttons and see why."* That
is **agency, not chat**. A read-only chat box in the editor is the worst of both: LLM cost with no
ability to act.

So: build layers 1–3 as callable tools; let the in-editor AI and Claude Code both consume them. An
LLM over a raw graph dump guesses. An LLM over a provenance walk is good **for free**.

## Tasks

| ID | Title | Tier | Focus |
|---|---|---|---|
| [OBS-001](./OBS-001-TRACE-SUBSTRATE.md) | The trace substrate | 1 | ✅ **Built.** Append-only per-edge event log + session dictionary. **Replaces a map that structurally cannot record the same wire firing twice** |
| [OBS-002](./OBS-002-PROVENANCE-WALK.md) | The provenance walk | 1 | ✅ **Built** — see [OBS-002-NOTES.md](./OBS-002-NOTES.md). Right-click → backward walk, all three annotation layers wired, click-to-reveal. The shelved panel is **not** retired; that is still open question 3 |
| [OBS-003](./OBS-003-NODE-DIAGNOSTICS.md) | Node-local diagnostics | 2 | Layer 3. **Zero dependencies — ships alone, on infrastructure that already exists.** The one task left |
| [OBS-004](./OBS-004-AGENT-ACCESS.md) | Agent access | 3 | ✅ **Built** — see [OBS-004-NOTES.md](./OBS-004-NOTES.md). `nodegx-observe` MCP server, node-id-addressed input injection, and a token on every relay `register` |

**Tiers 1 and 3 are complete** as of 2026-08-02; **OBS-003 is the only task left in the phase.**
Read [OBS-002-NOTES.md](./OBS-002-NOTES.md) before building on the trace: three of its defects were
surfaces stating more than they knew, and the same trap is available to anything else built over it.
[OBS-004-NOTES.md](./OBS-004-NOTES.md) records what agent access actually shipped, and the one
correction it forced — **the relay was never authenticated, and that was worse than "obscure but
open"**, because browsers do not apply the same-origin policy to WebSockets.

⚠️ **Tier 3 landed before tier 2, against the intended order.** The reason was territory, not
appetite: OBS-003's first batch of checks lives in the same runtime node files phase 35's ERG-001
was actively rewriting, and OBS-004 is disjoint from both. The argument for building tier 2 first
is unaffected and still correct — **OBS-004 is only as good as the layers under it**, and today its
`get_warnings` returns whatever the existing `sendWarning` call sites happen to emit, which is
thin. OBS-003 is what makes it good.

**Tiers are stopping points.** Tier 1 is the product and must ship together — OBS-001 alone is
invisible, OBS-002 without it is layer 1 only (which is still useful, and is a legitimate early
stopping point). Tier 2 accumulates indefinitely and delivers value from the first check. Tier 3 is
the thing Richard originally asked about, and it is deliberately last: **it is only good if tiers 1
and 2 are good**, because it consumes them.

## Verified facts this phase rests on

Every one of these was read in source during design. They are recorded because several contradict
what the team (and this session) believed at the start.

### The channel

| Fact | Where |
|---|---|
| The editor's **main process** runs a WebSocket relay on port **8574** (`NOODLPORT`) | [web-server.js:59](../../../packages/noodl-editor/src/main/src/web-server.js#L59), [:272](../../../packages/noodl-editor/src/main/src/web-server.js#L272) |
| It is a typed broadcast relay: clients `register` as `viewer`/`editor`/`service`; messages fan to the *opposite* type, or to a specific `clientId` via `target` | [web-server.js:257-336](../../../packages/noodl-editor/src/main/src/web-server.js#L257-L336) |
| It is **product infrastructure, not dev tooling** — it serves the preview, so it runs in the packaged app | same |
| `{cmd:'debuggingEnabled'}` from an editor peer flips the runtime's inspectors on | [editorconnection.ts:207](../../../packages/noodl-runtime/src/editorconnection.ts#L207) → [viewer.jsx:256](../../../packages/noodl-viewer-react/src/viewer.jsx#L256) |
| `getConnectionValue` already queries a connection's **current** value on demand (gated `isRunningLocally()`) | [editorconnection.ts:212](../../../packages/noodl-runtime/src/editorconnection.ts#L212) |
| `sendWarning(componentName, nodeId, key, warning)` draws the danger ring and files a Problems entry | [editorconnection.ts:480](../../../packages/noodl-runtime/src/editorconnection.ts#L480) |
| CDP is **not** required to observe. Any process that can open `ws://localhost:8574` gets the stream | — |

### The defect

| Fact | Where |
|---|---|
| The debug model is a **map keyed by output id**. A re-fire within the linger window overwrites the value and bumps a timestamp — **no second event**. It structurally cannot record "this wire fired twice with different values" | [nodecontext.ts:454-470](../../../packages/noodl-runtime/src/nodecontext.ts#L454-L470) |
| Fan-out is **already enumerated per edge** (`fromNode + fromPort + toNode + toPort`) — the per-edge event shape is not an invention | [nodecontext.ts:474-476](../../../packages/noodl-runtime/src/nodecontext.ts#L474-L476) |
| `updateDirtyNodes()` runs an entire causal cascade inside one frame (while-loop, ≤10 iterations, plus after-update callbacks); one snapshot is sent at the end | [nodecontext.ts:241-280](../../../packages/noodl-runtime/src/nodecontext.ts#L241-L280), [:293](../../../packages/noodl-runtime/src/nodecontext.ts#L293) |
| A pulse lingers ~100ms, so one firing reappears in many consecutive snapshots | [nodecontext.ts:520](../../../packages/noodl-runtime/src/nodecontext.ts#L520) |
| Values only stream for inspectors the editor **pinned** — Richard's *"hoping you see the right data go by"* | [nodecontext.ts:217](../../../packages/noodl-runtime/src/nodecontext.ts#L217) |
| Signals route through the value path as `'[Signal] Trigger count N'` and already carry a monotonic counter | [nodecontext.ts:490-501](../../../packages/noodl-runtime/src/nodecontext.ts#L490-L501) |
| When debugging is off, the very first statement returns — **cost is one boolean per propagation, zero storage** | [nodecontext.ts:455](../../../packages/noodl-runtime/src/nodecontext.ts#L455) |

### The prior art

| Fact | Where |
|---|---|
| A prior session already diagnosed the linger-flood (*"one click became ~40 rows"*) and fixed it with rising-edge detection. **Read this file before touching the runtime** — it is the best existing description of the data's shape | [snapshotDiff.ts](../../../packages/noodl-editor/src/editor/src/utils/triggerChain/snapshotDiff.ts) |
| The shelved panel is registered with `experimental: true`, not deleted | [router.setup.ts:296-304](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L296-L304) |
| `TriggerChainRecorder` is a singleton capped at 1000 events | [TriggerChainRecorder.ts](../../../packages/noodl-editor/src/editor/src/utils/triggerChain/TriggerChainRecorder.ts) |
| `switchToComponent(component, options)` — click-to-reveal is a call, not a project | [NodeGraphContext.tsx:26](../../../packages/noodl-editor/src/editor/src/contexts/NodeGraphContext/NodeGraphContext.tsx#L26) |
| WFA-002 built `ExecutionList` / `ExecutionDetail` / `ExecutionFilters` for workflow runs, which never got real data to draw. **That is the list-plus-detail shape to lift** | [ExecutionHistoryPanel/](../../../packages/noodl-editor/src/editor/src/views/panels/ExecutionHistoryPanel/) |
| The property editor does not surface node ids anywhere | [propertyeditor/](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/) |

## Corrections this phase carries in

Recorded because each one changed the design, and two of them were this session's errors.

⚠️ **"Runtime state isn't exposed" was wrong.** The first answer in the design conversation claimed
the editor had no runtime-state channel and that an observability subsystem would have to be built.
It already exists, end to end, and is not gated on dev mode anywhere. Richard caught it. Anyone
scoping this work should assume **more** exists than they expect and read before estimating.

⚠️ **"Stamp node names into every event" was reversed.** Recommended first for a self-describing
trace, then withdrawn once the high-buffer-limit requirement landed — denormalised names are exactly
what makes events fat. The design is now a **session dictionary** (ids → names, types, components,
*and connection topology*), sent once and delta'd on graph change, with events carrying only ids.
This is strictly better: ~4–5× smaller events, and search-by-name resolves against the dictionary
first rather than scanning rows.

⚠️ **CDP was assumed necessary and is not.** Observation needs only the WebSocket relay. CDP was in
the first proposal purely because this session reaches for it out of repo habit. It survives only in
OBS-004, and even there `sendInputEvent` on the viewer window is the better route.

⚠️ **The shelved panel's failure was structural, not cosmetic.** It was not badly designed; it was
built on a frame-flushed map that had already destroyed the ordering and the repeats. No amount of
filtering, search or formatting recovers information the runtime discarded. **Do not attempt to fix
the panel without OBS-001.**

## Open questions for Richard

None blocking; all are refinements that can be answered when the task is picked up.

1. **Buffer default.** With interning and a ~200-char value-preview cap, an event is ~150–250 bytes,
   so 250k events ≈ 40–60MB. Is that the right default, or higher? Note the real memory lever is the
   **value-preview character cap**, not the event count.
2. **Session boundary.** Proposed: clear on Record-start *and* on preview reload. Richard suggested
   time-based ("every X minutes") — count-capped plus clear-on-reload is more predictable and appears
   to cover the intent, but this is his call.
3. **Does the shelved panel get rebuilt or retired?** OBS-002 assumes the walk replaces it and the
   `experimental` flag comes off something new. The forward-chain view is a genuine companion surface
   and could keep the old panel's identity instead.
4. ~~**OBS-004 scope.**~~ **Answered: token first.** Richard chose the token handshake over
   deferring. Shipped: every peer presents a per-launch token in its `register`, and a peer that has
   not is neither sent to nor read from.

   ⚠️ **The question understated the exposure.** It framed the relay as "obscure but open". It was
   not obscure in the way that implies: **browsers do not apply the same-origin policy to
   WebSockets**, so any page a user visited could open `ws://localhost:8574`, register as an
   `editor`, and read the project export and every traced value out of the running app — no prompt,
   no CORS preflight, nothing to notice. The token was overdue rather than newly required.

5. **New: do the two MCP servers merge?** `nodegx-observe` ships **inside `packages/noodl-mcp`** as
   a second binary — one dependency set, one build, no shared code path. That is a packaging
   decision taken to avoid adding a package (and a lockfile change) while a concurrent session held
   the checkout, not a judgement that they belong together. The spec's warning that the two must not
   be *confused* stands, and sharing a package works against it.
