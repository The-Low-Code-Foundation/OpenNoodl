# FH-011 — Provenance Record records nothing

Covers reported item **10** (the defect half — the recording-HUD idea is [TALK-003](TALK-003-A-RECORDING-HUD.md)).

**Status:** shipped 2026-08-06 — all five slices, plus two defects this task's own reading turned
up (see *Three corrections* below). The poll now belongs to `TraceSession`, so the HUD track is
unblocked. Criteria 1–5 are covered by ordering specs; **criterion 6 (the live drive) is
outstanding** — the recipe is at the foot of this doc.

## What was reported

> Provenance 'record' still isn't working. I've clicked record, it says 'stop' so it's recording, I
> clicked a button that creates an object, nothing comes up on the provenance panel.

## The mechanism — confirmed, and it is structural

Record → click the app → Stop is **guaranteed** to show an empty panel. This is not a flaky capture
path; the capture works and the display path was never wired for this flow.

The full chain (all confirmed by reading, file:line):

1. The Record button (`ProvenancePanel.tsx:312-317`) calls `TraceSession.start()`
   ([TraceSession.ts:190-197](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L190-L197)
   — the session lives in `utils/provenance/`, not beside the panel; the path in this link was
   wrong),
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

- **A preview reload disarms tracing silently.** A *full export* after pressing Record reloads the
  preview (`noodl-runtime.ts:383-386` → `NoodlRuntime.reload()` → `:469-470 location.reload()`;
  `projectInstanceChanged` does the same at `:613`) — resolving the last error, changing the root
  node, or a second viewer registering all cause one. ⚠️ *Not* "any project edit", as this doc
  first said: ordinary edits go out as incremental `modelUpdate` messages and do not reload. The
  hole is real either way, and wider than a reload — the fresh `NodeContext` starts
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

**Slice 2 — the live poll loses its walk gate, and moves out of the panel.** While `recording`,
poll (pull events) regardless of `target`; keep the *walk refresh* part gated on `target` as today.
The "Recorded interactions" list should grow live while recording — that is most of what Richard
expected to see.

⚠️ **Amended 2026-08-05 by [TALK-003](TALK-003-A-RECORDING-HUD.md): the poll belongs in
`TraceSession`, not in `ProvenancePanel`.** The poll lives in the panel today
(`ProvenancePanel.tsx:170-186`), and a sidebar panel's component is constructed only when the panel
is **first opened** — `SidePanel.tsx:57-68` creates it on the first `switch`, so "hidden but
mounted" does not apply to a panel nobody has opened. Once Record moves to the canvas (TALK-003's
Q1, [HUD-001](HUD-001-THE-RECORDING-OVERLAY.md)), a user can record an entire session without the
panel ever existing — and a poll that lives there would never run. Owning the timer on the session
is the same amount of work here and is what the HUD needs; do it in this slice rather than moving
it later.

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

---

## ✅ Built 2026-08-06

`TraceSession.ts`, `ProvenancePanel.tsx`, one line of `ViewerConnection.ts`, and a new
`tests/utils/tracesession.spec.ts` (10 specs). All five slices, slice 2 built the amended way.

### Three corrections to this doc

1. **The disarm *destroys* the buffer, so slice 1 is an ordering fix, not an extra call.**
   `setTraceEnabled(false)` does not merely stop writing — it drops the `TraceBuffer` outright
   ([nodecontext.ts:691-695](../../../packages/noodl-runtime/src/nodecontext.ts#L691-L695)) — and
   `stop()` sent the disarm on its first line. So "`stop()` doesn't pull either" understates it:
   pulling *after* the existing disarm would have pulled an empty buffer and looked like the same
   bug. `stop()` is now `async`, pulls first, and only then disarms. It also guards on an arm
   generation, because a pull may outlive its recording by up to the 2 s deadline.

2. **Stop un-recorded the recording.** The panel passed `{ recording: session.recording }` into
   `buildIndex`, and `hasTrace` is what makes a silent edge `✕ never fired` rather than `·
   unknown` — so every ✕ in a walk reverted to `·` the instant Record was released, i.e. exactly
   when the user turns back to read it. Not in the report and not in this doc; it would have made
   criterion 2 read as "fixed" while the walk said nothing. The session now carries `hasTrace`
   (armed **or** finished; cleared by `forget`), which also keeps the case the whole feature
   exists for — *a recording in which nothing fired at all* — distinguishable from no recording.

3. **`refreshEvents()` was the one pull that never called `listen()`.** The Refresh button calls
   it before anything else, so on a session where nothing had yet asked for a topology the
   runtime's reply arrived at no listener and the pull timed out with the events unread. The
   doc's own diagnostic ("press Record, then Refresh") only worked because `start()` subscribes.

### What a human must drive — criterion 6

Nothing below is covered by the specs: they can prove the *order* of the messages and that an
empty pull is answered, and nothing more. A restart is required, not an HMR reload — the panel is
constructed once, ever.

1. **Criterion 1 (the fix itself).** Open a project with a button wired to something, run the
   preview, open the Provenance panel, press **Record** — the panel should say
   `Recording — 0 events so far`. **Do not open a walk.** Click the button in the preview. Within
   ~1.5 s the count rises and `Recorded interactions` lists the click. *This is the reported
   defect; before, it stayed empty forever.*
2. **Criterion 2.** Press **Stop** — the list stays populated (the pull happens before the
   disarm). Click a root: the causal walk opens, and its rows still carry ✓/✕ rather than `·`.
3. **Criterion 3 (unreachable from a spec).** Press Record, click once, then make the preview
   reload — resolve the last error in the Problems panel, or change the root node — and click the
   button again. The count must keep rising. Before, the reload silently disarmed the runtime and
   the button lied for the rest of the session. Note the `seq` reset is handled: the panel's list
   replaces rather than doubles.
4. **Criterion 4.** Close the preview, press **Record**: the panel says *"No preview is running —
   open the app, then press Record."* and the button stays on `Record`.
5. **Criterion 5.** Record, then switch project from the launcher. Reopen the first project's
   preview and press Record again: it arms cleanly (if the old runtime were still tracing, the
   relay would be carrying events nobody asked for). The direct check is the relay log, or
   `nodegx-observe`'s `get_trace_events` against the old client.
