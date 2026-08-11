# SIG-005 — The signal travels

**Status:** 📋 open · **Track SIG**

> The version of this lesson that needs no reading at all: click a button, watch the signal *move*
> down the wire. One click and you have seen that a signal is an instant and a value is a standing
> state.

## ⚠️ It is built. It is enabled by default. Read this before scoping the task.

[`NodeGraphEditorConnection.ts:647-656`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts#L647-L656):

```ts
if (DebugInspector.instance.isEnabled() && DebugInspector.instance.isConnectionPulsing(this)) {
  const t = DebugInspector.instance.getPulseAnimationState(this);
  ctx.strokeStyle = connectionColors.pulsing ? connectionColors.pulsing : theme.wirePulse;
  ctx.setLineDash([5, 15]);
  ctx.lineDashOffset = -t.offset;
  ctx.globalAlpha = t.opacity * 0.7;
  this.drawCurve();
  ctx.stroke();
}
```

A travelling dash, with a fade-in and a fade-out, over the wire's own curve, in a dedicated pulse
colour that `CanvasTheme` already returns as the third member of every wire's colour triple
([`CanvasTheme.ts:434-442`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/canvas/CanvasTheme.ts#L434-L442)).

And the gate is open: [`debuginspector.js:18`](../../../packages/noodl-editor/src/editor/src/utils/debuginspector.js#L18) sets
`this.enabled = true` in the constructor, and **`setEnabled` is called from nowhere in the editor
source** — verified by grep, 2026-08-09. It is fed by the running app over the viewer connection
([`ViewerConnection.ts:214`](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L214)), and the animation
loop, the removal fade and the frame budget are all written
([`debuginspector.js:27-98`](../../../packages/noodl-editor/src/editor/src/utils/debuginspector.js#L27-L98)).

**So this task is not "build a pulse". It is: find out why a mechanism that is finished and switched on
is not something a new user has ever mentioned seeing.**

## §0 — The investigation, which comes first

Do not write rendering code until these are answered, in this order:

1. ⚠️ **What emits `connectionsToPulse`, and when?** The consumer is
   `ViewerConnection.ts:214`; the **producer was not found** in `noodl-runtime/src`,
   `noodl-viewer-react/src` or the editor source under those names. It is marked ⚠️ **unverified** and
   tracing it is step one — everything below depends on what it actually sends and how often.
2. **Does it pulse signals only, or every connection?** If it already pulses value wires on change,
   half of SIG-006's hover and most of this task's teaching value is *also* already built, and the
   phase gets smaller. If it pulses only signals, that is the strongest possible reinforcement of the
   phase's whole thesis and should be said out loud in the UI.
3. **Does it require the app to be running, and does it survive the preview being occluded?**
   ⚠️ An occluded Electron renderer clamps timers by roughly 1000× and fires zero `ResizeObserver`
   callbacks — an animation graded by eye on a background window will look broken when it is fine, and
   fine when it is broken. **A screenshot forces the frame.** Grade this with forced frames, not by
   watching.
4. **Is it visible at all against the wire underneath it?** `globalAlpha = t.opacity * 0.7` over a wire
   that is already painted, in `wirePulse`, in **both themes**. This is the phase's standing
   opacity trap in its natural habitat: an alpha multiplied onto a colour never appears in a token, so
   nothing in the code says a contrast ratio moved.

**Report all four in the register before building.** The likely outcomes are very different tasks: "it
never fires", "it fires and is invisible", and "it fires, is visible, and nobody knows to look" each
need a different fix, and only the last one is a design problem.

⚠️ **§0.1 and §0.2 were answered from source on 2026-08-11 — see R1 and R2 below. Do not re-hunt
them.** The headline is that the pulse fires on **every** connection, because `connectionSentSignal`
simply calls `connectionSentValue`, so a value change and a signal firing are rendered identically
today. **§0.4 — is it visible at all — is the open question**, and R4 records the 100 ms linger window
that makes it the likely one.

## §1 — The build, conditional on §0

Once the mechanism is understood:

1. **Make the pulse legible.** Whatever §0.4 measures, fix. Shape and motion are the channels available
   — ⚠️ **wire colour is already carrying four meanings** (type, health, pulse, diff annotation) and
   `NodeGraphEditorConnection.ts:625-627` explicitly refuses to add selection as a fifth. Do not add a
   sixth.
2. **Make it discoverable.** A builder who has never seen it does not know to run the app and watch a
   wire. Whatever surfaces it — a first-run note, a mention beside the run button — belongs to whoever
   owns onboarding; **this task's job is to make sure there is something to discover** and to say so.
3. **Own the travelling-mark mechanism for the phase.** SIG-006 wants the same mark, on hover, at
   design time. One implementation, two triggers. ⚠️ If SIG-006 is built first there will be two
   animation paths on one wire and they will drift.
4. **Say what pulsed.** If §0.2 finds that value wires pulse too, the two must be visually distinct —
   a signal firing and a value changing are the two things this whole phase exists to separate, and
   rendering them identically would actively teach the confusion.

## Acceptance

- [ ] §0's four questions answered **in the register, with evidence**, before any rendering change.
      The producer of `connectionsToPulse` is named with a file and line.
- [ ] Clicking a button in a running app visibly moves a mark along the signal wire. Captured as
      forced frames at ≥ 3 points along the travel, both themes — ⚠️ not judged by watching an
      occluded window.
- [ ] The pulse measures ≥ 3:1 against the wire it overlays, **in light mode**, on composited pixels.
- [ ] A value wire changing and a signal wire firing are distinguishable from each other in a still
      frame, or value wires do not pulse at all and that is stated.
- [ ] Exactly one travelling-mark implementation exists in the painter at the end of SIG-006.

## Register

| # | Finding | State |
|---|---|---|
| **R1** | ✅ **The producer is `NodeContext.prototype.connectionSentValue`** — [`nodecontext.ts:573`](../../../packages/noodl-runtime/src/nodecontext.ts#L573). It fills `connectionsToPulse` at [`:585-601`](../../../packages/noodl-runtime/src/nodecontext.ts#L585) and ships it via `editorConnection.sendPulsingConnections` at [`:626`](../../../packages/noodl-runtime/src/nodecontext.ts#L626) and [`:645`](../../../packages/noodl-runtime/src/nodecontext.ts#L645); the editor consumes it at `ViewerConnection.ts:214`. The 2026-08-09 grep missed it because nothing in the chain is named "pulse" on the producing side. Found 2026-08-11 while writing SIG-005's handover. | ✅ **answered — §0.1** |
| **R2** | 🔴 **§0.2 is answered, and it is this task's biggest finding: the pulse fires on EVERY connection, not only signals.** `connectionSentSignal` ([`:608`](../../../packages/noodl-runtime/src/nodecontext.ts#L608)) is a four-line wrapper that increments a counter and then *calls* `connectionSentValue` with a string. **A value changing and a signal firing produce an identical entry and an identical mark.** The one mechanism in the editor that could teach the distinction this whole phase is named for currently renders both the same way. §1.4 is therefore not a contingency — it is the work. | ✅ **answered — §0.2** |
| **R3** | ⚠️ **There is a second enable gate the spec did not know about, on the runtime side.** The spec found `DebugInspector.instance.enabled = true` in the *editor*. `connectionSentValue` returns early unless `editorConnection.isConnected() && debugInspectorsEnabled` ([`:574`](../../../packages/noodl-runtime/src/nodecontext.ts#L574)), which is set by `setDebugInspectorsEnabled` ([`:698`](../../../packages/noodl-runtime/src/nodecontext.ts#L698)) from `viewer.jsx:112/258`, driven by the editor's `sendDebugInspectorsEnabled` (`ViewerConnection.ts:477`, called at `:173` on connect and at `:504`). Read in source the chain **looks** complete end to end — so this is a thing to confirm live, not a diagnosis. | 📋 **read, not driven — §0.3** |
| **R4** | ⚠️ **A pulse lives 100 ms.** `clearOldConnectionPulsing` ([`:629-641`](../../../packages/noodl-runtime/src/nodecontext.ts#L629)) deletes any entry older than 100 ms and reschedules itself on a 100 ms `setTimeout`. Against a fade-in, a fade-out and `globalAlpha = t.opacity * 0.7` over an already-painted wire, that is a strong candidate for "it fires and is invisible" — a different task from "it never fires". **§0.4 is the open question; measure it before changing anything.** | 📋 **open — §0.4** |

