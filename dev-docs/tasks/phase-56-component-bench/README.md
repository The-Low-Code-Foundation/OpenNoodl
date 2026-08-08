# Phase 56 — The Component Bench (Track BEN)

**Created:** 2026-08-08
**Status:** 📋 specced, not started. Tasks are **[TASKS.md](TASKS.md)** (BEN-001…007).
**Origin:** Richard, 2026-08-08, after using the AI build panel's component mode:

> *"Noodl used to have this option, but it was retired a long time ago. You could see one component
> at a time, rather than needing to put it on a page to view it. What would be cool would be to even
> be able to supply the component with static inputs and see what displays and how it works."*

## The premise

**Most of this already exists, in the wrong room.** AIX-008 built a per-component preview and called
it a sandbox: [`SandboxPreview.tsx`](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx)
mounts a real runtime on a single component by setting `rootComponent`/`rootNode` to something that
is not a page ([sandboxExport.ts:198](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/sandboxExport.ts#L198)).
It is clickable, typing works, it resolves design tokens, and it already carries a Sample data /
Real backend switch and a signed-in toggle.

It is reachable only from the AI authoring review document. A human who wants to look at a component
they wrote by hand has no way in.

**And the one thing it cannot do is the thing Richard asked for.** Because the component is mounted
*as root*, every `Component Inputs` port has no source. Nothing sets them, so they sit at
`undefined`, and a card component previews as its empty state — which is indistinguishable, on
screen, from a card component that does not work. That is the same failure class phase 55 spent five
sessions on (dead placeholders that validate clean), arriving by a different route.

## The goal

> One surface where a builder mounts any single component, feeds it input values by hand, watches
> what it emits, and saves that as a named scenario — without ever being confused about whether they
> are looking at the app or at a bench.

Two audiences, one substrate:

- **The human builder**, from the components panel: build a card, feed it three strings, see it.
- **The AI build panel's component mode**, which already lands on this preview and today can only
  show whatever the agent's own `sample_data` implied. BEN-006 lets the user overwrite that data and
  re-render — *"so users can set their own data ideas and see what they render like"* (Richard).

## Why the retired feature was retired, and what we do about it

A component isolated from its page can lie. It reads route params that do not exist; it looks right
only because a flex parent stretched it; it has no width to inherit. The original feature quietly
showed a component that would not survive contact with a page, which is worse than showing nothing.

This phase does not pretend that away. It handles it in three places:

1. **The bench frame is explicit and adjustable** (BEN-004) — you choose the width, you are never
   shown an accidental one, and the size is displayed.
2. **The bench is never the source of truth.** The app preview stays authoritative and the toolbar
   makes the hierarchy obvious. The bench is for building a component, not for signing it off.
3. **Outputs are shown, not just pixels** (BEN-003) — so "does it work" has an answer that is not a
   screenshot. This is also what makes a logic-only component previewable for the first time; today
   it is refused with *"has no visual root — there is nothing to render"*.

## The anti-disorientation rules (Richard's constraint, made testable)

> *"without messing up the existing preview display too much or making them feel lost between the
> 'full app' preview and a fabricated per component preview"*

These are acceptance criteria, not preferences. BEN-004 owns them and BEN-007 tests them.

| # | Rule | Why |
|---|---|---|
| R1 | **One preview surface, two modes — never a second preview panel** | Two live previews and nobody knows which is real. The mode selector lives in the existing preview toolbar |
| R2 | **The bench never renders full-bleed** | Inset on a visibly different stage. Full-bleed = app, framed-on-a-stage = component. Readable across the room, stronger than any badge |
| R3 | **The app preview is not torn down when you switch** | Its webview stays alive and hidden, so a round trip is instant and does not lose the route they had navigated to. This, not labelling, is the actual fix for "feel lost" |
| R4 | **One always-present way back**, in the same toolbar position in both modes | — |
| R5 | **Input values are preview state, never project state**, until explicitly saved as a scenario | The rule `signedIn` already follows ([SandboxPreview.tsx:102](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L102)) |

## What already exists — do not rebuild it

| Thing | Where | What it gives this phase |
|---|---|---|
| Per-clientId export | `ViewerConnection.registerSandboxExport` / `exportSandbox` ([:313](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L313)) | A second/third preview window fed independently of the project. No new protocol message |
| Splice-not-clone export | `buildSandboxExport` | Mount a detached component as root without touching `ProjectModel` |
| Network shim | `noodl-viewer-react/src/sandbox/` | fetch + XHR intercepted before the runtime exists — one seam, not N node branches |
| Sample dataset | `sandboxData.ts` + `noodl-runtime/src/sandbox/` | Three-layer inference (agent data → wire scan → code scan). BEN-006 adds a fourth, highest layer |
| The interface | `ComponentModel.getPorts()` ([:91](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L91)), `validation/componentInterface.ts` | The input form's schema, for free |
| Persistence | `ComponentModel.setMetaData` ([:344](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L344)), round-tripped through `toJSON` | Where scenarios live |
| Live port values | `ViewerConnection.sendGetPortValues` ([:543](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L543)) | The outputs read-out, pull-shaped |
| Frame sizing | `CanvasView.setViewportSize` ([:227](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts#L227)) | The bench's width control |

## Settled — do not relitigate

- **One substrate, two clients.** The harness, the input form and the data editor are shared by the
  bench and the AI authoring preview from one module. A second dialect is the BCN-003 mistake.
- **The bench does not replace the app preview**, and it is not a route. It is a mode of the preview
  panel.
- **Nothing is written to `project.json` without an explicit save.** Typing in an input field must
  not dirty the project.
- **Not a constraint: legacy projects.** Per `dev-docs/reference/COMPATIBILITY-POLICY.md`.

## Landmines this phase will hit

Written down because each one has already cost a session somewhere in this repo.

- ~~**`modelUpdate` is broadcast, not targeted.**~~ **Resolved in BEN-002 — see register B2.** Every
  `modelUpdate` the project's own model events send is still a broadcast, correctly: they are facts
  about the project and true of every viewer. A bench input is not, and it goes through
  `ViewerConnection.sendModelUpdateToClient`, which carries a `target` the **relay** routes on. No
  runtime change was needed and the task file's proposed mechanism was the wrong one.
- **A changed export makes the runtime call `location.reload()`**, and a sandbox client returns under
  the same id — hence the `delete this.lastExports[clientId]` at [:581](../../../packages/noodl-editor/src/editor/src/ViewerConnection.ts#L581).
  A reload also destroys every bit of component state the user just clicked into.
- **A component input port is declared `plug: 'output'`** ([componentmodel.ts:179](../../../packages/noodl-editor/src/editor/src/models/componentmodel.ts#L179)).
  Phase 55 F8/F23: getting this backwards broke the reference build *and* the recipe library.
- **A component instance carries zero built-in ports** (LAS-001). Every port on the harness instance
  must come from the target's interface.
- **`getPorts()` derives type from connections.** An input wired to nothing comes back `'*'` with no
  default. The form must degrade, not guess.
- **`PreviewTokenInjector` used to hold ONE webview** and now holds a set; the bench is a third
  surface — verify, do not assume.
- **`NodeGraphModel.forEachNode` treats a truthy return as "stop".**
- **The viewer webpack build is pre-ES2015 for iteration** — `Array.from`, never `[...set]`.
- **`sizeMode` silently voids width/height/objectFit.** Relevant the moment the bench sets a frame size.

## Register

| # | Finding | State |
|---|---|---|
| B1 | Phase-55 **F22** is a prerequisite-adjacent blocker: the shared report module is plain CJS under `scripts/`, which the editor bundle cannot import. BEN-007 wants render-report evidence from the bench; if F22 is still open, take screenshots instead and say so | 🔴 OPEN, inherited from phase 55 |
| B2 | **`modelUpdate` now has client targeting, and it needed no runtime change — the task file was wrong about the mechanism.** BEN-002 proposed mirroring the trace channel's `content.clientId`, matched by the runtime against its own. That shape is right for a *request* every viewer receives and one answers; it is the wrong shape here and it would have put the filtering in runtime code that could get it wrong. The relay already routes **any** message carrying a `target` to that socket alone and only broadcasts the ones without ([relay-server.js:154-163](../../../packages/noodl-editor/src/main/src/relay-server.js#L154-L163)) — which is how `export` has always reached one sandbox client. So `ViewerConnection.sendModelUpdateToClient` is four lines, the message never reaches the other clients *at all*, and existing behaviour is untouched by construction: a send with no `target` still broadcasts and nothing that broadcast before passes one. ⚠️ Note what a broadcast would have done instead of erroring: the runtime **silently ignores a delta for a component it does not have** (`editormodeleventshandler.ts` returns early on an unknown `componentName`), so the wrong design would have looked like it worked | 🟢 DECIDED and built in BEN-002/1; **Live** — verify the app preview does not receive it |
| B3 | **BEN-001 §3's Group-wrapper frame was not built.** The frame is the size of the *surface* the export renders into, not a Group injected into the harness graph — `sizeMode` silently voids `width`/`height` and an unsized absolute Group fills its parent (phase-55 F7), so a wrapper that gets either wrong makes a correct component look broken inside the tool built to say whether it is. `buildBenchExport` carries `frame`/`stretch` through on its result for BEN-004 to apply. **Nothing about `stretch`'s rendered behaviour has been measured** | 🟡 DEVIATION, deliberate — settle live in BEN-007 §A/4 |
| B5 | **The plug inversion is TWO inversions and the task files describe one.** A port declared on a `Component Inputs` node is `plug: 'output'` (LAS-001); `getPorts()` republishes it as `plug: 'input'`. BEN-001 §2 and BEN-002's opening both say `plug: 'output'` is a component input *as `getPorts` returns it*, which is false — the first implementation followed them and shipped an empty inputs rail, caught by 6 red specs. Both task files now carry a correction; **anything else in this phase that reasons about `plug` must say which end it means** | 🟢 FIXED in the code, corrections filed in BEN-001/BEN-002 |
| B4 | `benchInterface` reports `backwards` (a `Component Inputs` port plugged `input`) in the summary, which is the first surface in the product where LAS-001's inversion is visible to a human rather than merely true. **Confirmed live, 2026-08-08, on the first component ever mounted on the bench**: `ecommerce-example`'s `ProductCard` reports *0 inputs, 11 outputs* and the summary names all eleven — `name`, `tagline`, `price`, `compareAtPrice`, `image`, `imageAlt`, `category`, `badge`, `rating`, `reviewCount`, `slug` — as declared with plug `"input"` and therefore published as component OUTPUTS. It renders as an almost-empty box, and the bench says why | 🟢 CONFIRMED live; the *fix* to `ProductCard` is not this phase's |
| B6 | **"The existing preview toolbar" (BEN-004 §1) was read as the preview *surface's* chrome, not `EditorTopbar`.** §1's own mock gives it away — `1280 × 800 · 100%` is `VisualCanvas`'s `.ViewportInfo` string verbatim. The alternative was ruled out on evidence rather than taste: `EditorTopbar`'s two layout breakpoints are measured arithmetic (POL-019 — `1010` and `710`, derived from the summed widths of the controls in each layout), and a wide new leftmost control there would have invalidated both. The cost is a 30px strip the app preview never had, in both modes, which is a real change to "the existing preview display" | 🟢 DECIDED, and the strip is the thing to look at first in BEN-007 |
| B7 | **The round trip is lossless in one direction only.** The app preview is hidden, never unmounted (R3, and the criterion that matters most). The *bench* is unmounted on the way back, so bench → app → bench reloads the bench and loses whatever was clicked into it. Deliberate: R3 names the app preview, and a second permanently-resident runtime is exactly the memory cost BEN-004's own Risks table says to measure rather than assume. **Neither the cost of keeping it nor the annoyance of dropping it has been measured** | 🟡 DEVIATION, deliberate — settle in BEN-007 with a number |
| B8 | **`stretch` is implemented as "the frame becomes the stage", which is not obviously what a flex parent does to a child.** The control's job is to answer "it only looked right because a flex parent stretched it", and what it actually does is remove the fixed width. Whether those are the same thing for a real component is unmeasured, and it is the second half of B3 — no graph-level wrapper exists to make them the same. Measured live: stretch gives the bench document the stage width less padding (884 in a 916 stage), and the read-out says `884 × 284 · stretched` rather than claiming the stage's 916 | 🟡 OPEN, BEN-007 §A/4 alongside B3 |
| B9 | **`useTrackBounds` (`noodl-core-ui`) threw the whole React tree away on a null ref.** `observer.observe(ref.current)` in a *layout* effect, with no guard, while the two lines around it already used `ref.current?.`. A ref on a conditionally-rendered element cost the editor its entire preview panel the first time the bench was driven. Guarded, and the bench frame is now mounted unconditionally. ⚠️ The guard is not a substitute for mounting the element: the effect keys on `[ref]`, which never changes, so an element that appears later is still never observed | 🟢 FIXED; the "appears later" limitation is unaddressed and now documented in the hook |
| B11 | **BEN-002 §1 maps `stringlist` to a select, and it cannot be one.** A `stringlist` is a comma-separated *string*; it enumerates nothing, so there is no option set to build a select from, and a select over no options is an empty dropdown that reads as broken. It gets a text field, with the type name shown on the row so the comma convention is at least visible. The same fallback catches an `enum` whose `enums` array is missing — the rail degrades to a field rather than rendering a dropdown with nothing in it | 🟡 DEVIATION from the task file, deliberate, specced |
| B12 | **A signal cannot be fired with one message.** The runtime turns a queued `SIGNAL_PULSE` into `setInputValue(true)` then `setInputValue(false)` in a single pass ([node.ts:592](../../../packages/noodl-runtime/src/node.ts#L592)) — but that constant only exists on a *connection*. Arriving as a parameter, the rising and falling edges have to be sent as two updates; send only the `true` and the signal fires once and never rearms. `benchSignalContents` sends both. **Unverified live** — that the second update rearms rather than being consolidated away is read from `queueInput`'s first-update branch, not measured | 🟡 BUILT, live verification is BEN-002's own criterion |
| B13 | **Reset was shipped twice as a mechanism with no consequence, and the drive caught both.** (1) Sending `parameterValue: undefined` is *exactly* the documented unset: the key is dropped, `setParameter` deletes the parameter, and the runtime takes its reset-to-default branch. That branch ends at `getDefaultValueForInput(this.model.type, name)` — and the type is a **component**, whose input ports are declared by a user and carry no default, so it queues `undefined` and nothing is restored. Measured: after Reset the rail was empty and correct while the component still showed every value — text, colour, alignment and visibility unchanged. (2) The fix "clear the values and rebuild" is also inert: a value set through a targeted update never entered the export, so the rebuild produces **identical bytes**, `_exportToClient` drops it, and nothing reaches the runtime. Reset now sends the port's **derived default** where there is one — which the editor's `getParameter` supplies from the connected port's type, so it is nearly always — and reloads the window (`useSandboxViewer`'s `remountKey`) where there is not. ⚠️ **That remount branch is unexercised**: no component that could be built for it has a defaultless port, precisely because the fallback is so broad | 🟢 FIXED and driven for the common path; the remount branch is code without a live case |
| B14 | **Reloading a preview webview over CDP destroys the whole preview surface.** `Page.reload` on the app-preview target (to install a `WebSocket` recorder via `addScriptToEvaluateOnNewDocument`) left the editor alive and React mounted, but `[data-preview-mode]` gone, **zero** `<webview>` elements and no bench. Same family as POL-012's "closing a webview CDP target white-screens the editor", and it costs a stack restart. Instrument from outside instead: the relay publishes a launch token (`~/Library/Application Support/NodeGX/relay-token`) and a third client registering as a `viewer` sees every broadcast — which is how B2 was actually proven | 🟢 CHARACTERISED — do not reload a preview webview to instrument it |
| B10 | **Two driving traps, both of which made a working thing look broken.** (1) An **occluded** Electron renderer runs no rendering steps, so `requestAnimationFrame` never fires and **`ResizeObserver` never delivers** — every measured read-out looks frozen while the DOM is correct. `npm run cdp -- screenshot` forces the pending frame and unsticks it; measured `document.hidden === true`, `rafFrames: 0` over 3s. (2) `MenuDialog` renders each row **twice** (in place and portalled) and only the second one's click handler fires. ⚠️ **Extended, 2026-08-08: the core-ui `Select` does both of these too.** Its options live in a `BaseDialog`, so they are *not* children of the `OptionsContainer` a driver would inspect — query `[data-test=select-option]` document-wide — and a 3-option enum returns **6** nodes. Click the second half. An empty `OptionsContainer` is what "the select will not open" looks like, and it cost a detour | 🟢 CHARACTERISED — read before driving anything in BEN-007 |
