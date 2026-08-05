# FH-011 — Provenance Record records nothing

Covers reported item **10** (the defect half — the recording-HUD idea is [TALK-003](TALK-003-A-RECORDING-HUD.md)).

## What was reported

> Provenance 'record' still isn't working. I've clicked record, it says 'stop' so it's recording, I
> clicked a button that creates an object, nothing comes up on the provenance panel.

## The mechanism — confirmed, and it is structural

Record → click the app → Stop is **guaranteed** to show an empty panel. This is not a flaky capture
path; the capture works and the display path was never wired for this flow.

The full chain (all confirmed by reading, file:line):

1. The Record button (`ProvenancePanel.tsx:312-317`) calls `TraceSession.start()`
   ([TraceSession.ts:190-197](../../../packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/TraceSession.ts#L190-L197)),
   which clears the local event store and broadcasts `traceEnabled` to the viewer. The runtime
   *does* capture: both trace emitters (`outputproperty.ts:148-168` values, `:194-215` signals) fire
   unconditionally on every edge while `traceEnabled` is true. **There is no event-type filter** —
   an object-creating click produces perfectly ordinary signal/value events.
2. But the editor only ever **pulls** the runtime's buffer from three places: a walk request
   (`ProvenancePanel.tsx:131-152`), the Refresh button (`:269-275`), and a 1.5 s poll that is gated
   `if (!recording || !target) return` (`ProvenancePanel.tsx:170-171`). `target` is only set by a
   provenance *walk* from the canvas right-click. `start()` doesn't pull. **`stop()` doesn't pull
   either** (`TraceSession.ts:199-203`).
3. The panel's "Recorded interactions" root list is derived from `session.traceEvents`
   (`ProvenancePanel.tsx:236`) — which `start()` cleared and nothing ever refills.

The OBS-002 demo walkthrough (`DEMO-WALKTHROUGH.md:126-129`) documents the poll as *"only while
Record is on **and a walk is on screen**"* — the parenthetical is the bug. The spec's promised flow
(*"Record → click → stop. The panel lists only root events… pick one, get the causal tree"*,
`OBS-002-PROVENANCE-WALK.md:63-70`) was never wired; the demo's flow always had a walk up first.

Diagnostic that proves it: press Record, click the app, press **Refresh** — the interactions appear.

### Three secondary drops, all real

- **A preview reload disarms tracing silently.** Any project edit after pressing Record reloads the
  preview (`noodl-runtime.ts:355-359` → `location.reload()`); the fresh `NodeContext` starts
  `traceEnabled = false` (`nodecontext.ts:191`), and the editor re-sends **nothing** on viewer
  registration except debug inspectors (`ViewerConnection.ts:153-156`). Button still says "Stop";
  runtime is not tracing.
- **Record arms even with no viewer.** `ViewerConnection.send()` silently no-ops on a closed socket
  (`ViewerConnection.ts:359-363`) while `recording` flips unconditionally (`TraceSession.ts:194`).
- **A project switch leaves the runtime tracing forever.** POL-010's `TraceSession.forget()` sets
  `recording = false` without telling the runtime (`TraceSession.ts:275-285`, documented at
  `:270-274`).

There is no test for `TraceSession.start/stop` at all, and no test drives Record → panel content.

## What to build

**Slice 1 — stop pulls.** `TraceSession.stop()` pulls the buffer (`refreshEvents()`) before
notifying. Record → click → Stop must populate the root-event list with zero further clicks.

**Slice 2 — the live poll loses its walk gate.** While `recording`, poll on the session (pull
events) regardless of `target`; keep the *walk refresh* part gated on `target` as today. The
"Recorded interactions" list should grow live while recording — that is most of what Richard
expected to see.

**Slice 3 — re-arm on viewer registration.** On the viewer `registered` event, if
`TraceSession.recording`, re-send `sendTraceEnabled(true)` — same pattern as
`sendDebugInspectorsEnabled` (`ViewerConnection.ts:153-156`). This closes the edit-mid-recording
hole. Also: `forget()` sends `traceEnabled(false)` before dropping state.

**Slice 4 — an honest empty state.** An empty pull is an answer: render "recording — 0 events so
far" rather than the placeholder, and don't let the 2 s `awaitEvent` timeout
(`TraceSession.ts:130`, `:31` — early-return on empty batch means the event never fires) be
indistinguishable from a hang.

**Slice 5 — a jasmine spec for the session.** Record → synthetic events → stop → `traceEvents`
populated; forget-while-recording sends the disarm. (Editor specs are jasmine, not jest.)

## Criteria

1. Record → click a button in the preview → the interactions list grows within ~1.5 s, no walk open.
2. Stop → the list is populated; picking a root walks it.
3. Record → edit the graph (preview reloads) → click again → events still arrive.
4. Record with no preview running → the panel says so instead of arming a dead session.
5. Switch project mid-recording → runtime tracing is off (verify via the relay or a second arm).
6. Verified in the running editor — jest/jasmine cannot see the reload re-arm.

## Traps

- Delivery is QUEUED, not a call stack (OBS-001) — don't assert on same-tick arrival.
- The relay client (`nodegx-observe/src/relayClient.ts:369-370`) shares the same **global**
  `traceEnabled` switch — an agent's `stop_trace` disarms the panel's recording with no UI signal.
  Don't fix that here, but don't be confused by it while verifying.
- Sidebar panels are hidden-but-mounted; HMR won't re-run effects in a mounted panel. Restart the
  editor before concluding a new subscription doesn't fire.
