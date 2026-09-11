# SIG-005 — The signal travels

**Status:** ✅ **closed 2026-08-11** · **Track SIG**

> **The answer, in one line: it fires, it has always fired, and in the default dark theme it measured
> 1.48:1 against the wire it was painted on.** Not "it never fires" and not "nobody knows to look" —
> the third outcome, "it fires and is invisible", and the measurement is in R5.
>
> Two things shipped. The mark now carries its meaning in **weight and shape** rather than in a
> luminance step it cannot win in dark; and **a signal and a value no longer look the same**, which
> they did, because `connectionSentSignal` is a wrapper around `connectionSentValue` and the editor
> drew both as identical dashes. See R6 and R7.
>
> ⚠️ **R8 is not this task and is not fixed:** the component a project *opens on* builds its
> connections before the node library can answer them, so every wire in it reports no type and a
> signal wire is painted in the **data** colour until you navigate away and back.

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

## What shipped

| | |
|---|---|
| [`wirePulse.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wirePulse.ts) | **new** — which mark a wire gets, where the head is at a given age, how far the value overlay has drifted, and the polyline sampler. Import-free, so it is graded without Electron and so SIG-006 can reuse it. Its header carries the measurements. |
| [`NodeGraphEditorConnection.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts) | the pulse block, ~10 lines → ~40: weight instead of `globalAlpha × 0.7`, and the signal/value split |
| `tests-unit/sig-005/wirePulse.test.ts` | **21 specs**, in `test:main` |
| `tsconfig.tests-main.json` | one allowlist entry, same shape as `portCopy.ts` |

**Not done, on purpose:** §1.2, discoverability. The task's own scope for it was *"make sure there is
something to discover, and say so"* — there now is, and where it gets surfaced (a first-run note, a
line beside the run button) belongs to whoever owns onboarding. ⚠️ Note what it costs to discover
today: the pulse needs a **running preview**, and it is ~600 ms long.

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

- [x] §0's four questions answered **in the register, with evidence**, before any rendering change.
      The producer of `connectionsToPulse` is named with a file and line — R1, and R5 for the one
      that was still open.
- [x] Clicking a button in a running app visibly moves a mark along the signal wire. The click →
      pulse chain was driven end to end in the running editor (R5); the mark was then captured as
      **synchronously forced frames** at three points along the travel (`ageMs` 84 / 231 / 399 of a
      420 ms crossing), in **both themes** — `ed.layoutAndPaint()` rather than `repaint()`, so the
      frame is painted by the call and not by a `requestAnimationFrame` an occluded window would
      clamp.
- [x] The pulse measures ≥ 3:1 against the wire it overlays, **in light mode**, on composited pixels
      — **5.09:1** signal / **4.74:1** value, up from 3.25 / 3.09.
- 🔴 **The same criterion is not achievable in dark and the task says so rather than reporting
      around it.** Against a dark-theme wire the mark measures **1.84:1** (signal) and **1.75:1**
      (value), up from 1.48 / 1.43 but nowhere near 3. Reaching 3:1 there needs a mark *darker* than
      the wire, which against a near-black ground is indistinguishable from a gap in the wire — and a
      gap is what `getHealth()` already uses dashes to mean. **What the criterion was reaching for is
      met a different way: the mark measures 17.19:1 against the ground on its flanks, at every point
      along the travel, because it is wider than the wire it runs on.** Full numbers in R6.
- [x] A value wire changing and a signal wire firing are distinguishable from each other in a still
      frame — one round-capped bead at a position on the wire, versus a repeating dash along the
      whole of it. R7.
- [x] Exactly one travelling-mark implementation exists in the painter. It is
      [`wirePulse.ts`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/wirePulse.ts),
      which takes the point function as an argument rather than reaching for the connection — SIG-006
      §"Build" item 4 consumes it with a hover trigger and must not write a second one.

## Register

| # | Finding | State |
|---|---|---|
| **R1** | ✅ **The producer is `NodeContext.prototype.connectionSentValue`** — [`nodecontext.ts:573`](../../../packages/noodl-runtime/src/nodecontext.ts#L573). It fills `connectionsToPulse` at [`:585-601`](../../../packages/noodl-runtime/src/nodecontext.ts#L585) and ships it via `editorConnection.sendPulsingConnections` at [`:626`](../../../packages/noodl-runtime/src/nodecontext.ts#L626) and [`:645`](../../../packages/noodl-runtime/src/nodecontext.ts#L645); the editor consumes it at `ViewerConnection.ts:214`. The 2026-08-09 grep missed it because nothing in the chain is named "pulse" on the producing side. Found 2026-08-11 while writing SIG-005's handover. | ✅ **answered — §0.1** |
| **R2** | 🔴 **§0.2 is answered, and it is this task's biggest finding: the pulse fires on EVERY connection, not only signals.** `connectionSentSignal` ([`:608`](../../../packages/noodl-runtime/src/nodecontext.ts#L608)) is a four-line wrapper that increments a counter and then *calls* `connectionSentValue` with a string. **A value changing and a signal firing produce an identical entry and an identical mark.** The one mechanism in the editor that could teach the distinction this whole phase is named for currently renders both the same way. §1.4 is therefore not a contingency — it is the work. | ✅ **answered — §0.2** |
| **R3** | ⚠️ **There is a second enable gate the spec did not know about, on the runtime side.** The spec found `DebugInspector.instance.enabled = true` in the *editor*. `connectionSentValue` returns early unless `editorConnection.isConnected() && debugInspectorsEnabled` ([`:574`](../../../packages/noodl-runtime/src/nodecontext.ts#L574)), which is set by `setDebugInspectorsEnabled` ([`:698`](../../../packages/noodl-runtime/src/nodecontext.ts#L698)) from `viewer.jsx:112/258`, driven by the editor's `sendDebugInspectorsEnabled` (`ViewerConnection.ts:477`, called at `:173` on connect and at `:504`). Read in source the chain **looks** complete end to end — so this is a thing to confirm live, not a diagnosis. | 📋 **read, not driven — §0.3** |
| **R5** | ✅ **§0.3 and §0.4 answered by driving it. The chain works; the mark was invisible.** Driven in the running editor on `lib21-qa`, 2026-08-11: a `Button` → `String.saveValue` signal wire and a `String.savedValue` → `Text.text` value wire, built in the open component, previewed live. A real click in the preview produced exactly the id the editor generates — `…onClick…saveValue` — arriving at `DebugInspector.setConnectionsToPulse`, and changing the variable's `value` produced the *value* wire's id on the same channel. **So R3 is confirmed working end to end and is not the bug, and R2 is confirmed live and not only in source.** §0.4 is the bug: measured on composited canvas pixels, four dash phases, peak opacity, **dark theme — signal `#b6e4f2` on `#35c3e8` = 1.48:1 (max 1.69), value `#a7e2c9` on `#45d08a` = 1.43:1 (max 1.57)**. Light theme: 3.25:1 and 3.09:1. **The default theme is the one that fails, which inverts the phase's standing "light mode is binding" constraint for this task.** | ✅ **answered — §0.3, §0.4** |
| **R6** | 🔴 **The pulse token is the wrong kind of colour for a dark theme, and no colour fixes it.** `wirePulse` is `--theme-color-fg-highlight`: `#eef2f6` in dark, `#18212b` in light. A wire is already a bright saturated colour at 9.3:1 against the ground, so in dark the pulse moves it 70% of the way to white and barely moves its luminance; in light the same token is near-black and moves a great deal. **To clear 3:1 against a dark-theme wire the mark must be *darker* than it — and a dark mark on a bright wire against a near-black ground reads as a gap, which is what an unhealthy wire's `[5]` dash already means.** So the mark went to **weight**: `wireWidth + 2.5` for a signal, `+ 1.5` for a value, at full alpha instead of `× 0.7`. After, dark: core **1.84:1** / **1.75:1** (from 1.48 / 1.43) and **flank 17.19:1 against the ground** at all three sampled ages; light: core **5.09:1** / **4.74:1** (from 3.25 / 3.09), flank 14.35:1. The signal mark puts 503–525 px on the ground against the value overlay's 180–192 — the weight difference is itself measurable. | ✅ **fixed** |
| **R7** | 🔴 **§1.4 needed no protocol change at all.** The runtime cannot tell the editor which pulses were signals — `connectionSentSignal` funnels into `connectionSentValue` and `sendPulsingConnections` flattens the map into a bare array of id strings. But **the editor already knows**: `NodeLibrary.nameForPortType(this.fromPort.type)` is computed one line above the pulse block and `CanvasTheme.connectionColors` already branches on it. So the split is `wirePulseKind(type)` and nothing on the wire moved. **A signal gets one round-capped bead that runs source → target; a value gets the repeating dash along the whole wire.** A signal is a moment and has a position; a value connection is live everywhere at once and has none. ⚠️ The old mark could not have travelled anyway: `offset = life / 20` is 50 px/s, so on a 300 px wire it left the source and was deleted ~250 px short of arriving. The new mark crosses in 420 ms, inside the ~600 ms the pulse is visible for. | ✅ **fixed** |
| **R8** | 🔴 **Not this task, found by it, and not fixed: the component a project OPENS ON has every wire unresolved.** On a fresh open of `lib21-qa`, `ed.connections[0].fromPort` is `undefined` for every connection in `/#__page__/Home` — so `nameForPortType` returns undefined, `connectionColors` falls to the data pair, and **a signal wire is painted green instead of cyan**. Switching to `/Table/Row` shows `onClick:ok/signal` on its wires, and switching *back* to Home resolves Home's too. So the graph is built before the node library can answer, `resolvePorts` fails silently (it has no guard and no retry), and the re-resolve that exists — `EditorEventBindings.ts:58-70`, on `libraryUpdated`/`typeAdded` — has already fired or is not yet bound. **The one graph a builder sees when they open their project is the one drawing wire kind wrong**, which is squarely this phase's premise, and it self-heals the moment they navigate, which is why nobody has ever reported it. Left filed rather than fixed: the fix is in editor load ordering, a different risk surface from a canvas painter, and it deserves its own gate. ✅ **Fixed 2026-08-11 as [ELO-001](../editor-load-ordering/ELO-001-A-PORT-LIST-CACHED-BEFORE-THE-LIBRARY.md)** — and 🔴 **the diagnosis in this row is wrong about the mechanism.** `resolvePorts` fails silently, but the `libraryUpdated` re-resolve *does* fire, with the connection in hand, after the library has loaded and the type has resolved to a `BasicNodeType`; it still reads **zero ports**, because `getPorts()` memoised the `[]` it derived from the `UnknownNodeType` at bind time and `[]` is truthy. `NodeGraphModel.scheduleUpdateTypes()` clears that cache one `setTimeout(…, 1)` tick *after* the only thing that would have re-read it — which is also why probing the live editor a few seconds later shows a healthy cache and a broken `fromPort`. Measured cold: **0 signal-cyan px / 767 data-green px** before, **751 / 0** after. | ✅ **fixed — ELO-001** |
| **R4** | ⚠️ **A pulse lives 100 ms.** `clearOldConnectionPulsing` ([`:629-641`](../../../packages/noodl-runtime/src/nodecontext.ts#L629)) deletes any entry older than 100 ms and reschedules itself on a 100 ms `setTimeout`. Against a fade-in, a fade-out and `globalAlpha = t.opacity * 0.7` over an already-painted wire, that is a strong candidate for "it fires and is invisible" — a different task from "it never fires". **§0.4 is the open question; measure it before changing anything.** | 📋 **open — §0.4** |

