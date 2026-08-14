# FIX-011 — The bench frame has no height

**Report 8 (a)** · Tier 2 · Effort **M** (the one-line symptom fix is **S**)

> *"All node bench components open at a fixed height of like a couple of hundred pixels … let
> users define some kind of 'default width and height' of each component, with the ability to
> increase and decrease width and height in the bench."*

## Mechanism — pinned

**There is no height anywhere in the bench frame chain.** `BenchFrame = { width, stretch }` —
no height field exists in the type (`previewScope.ts:57-70`). The frame div sets only `width`
(`ComponentBench.tsx:620`); `.Frame` has `margin: auto` (deliberate, for the horizontal-scroll
fix, `ComponentBench.module.scss:47-53, 71`) which **cancels** `.Stage`'s `align-items: stretch`
per flexbox §8.1 — so the frame shrink-fits to its content, and the `<webview>`'s UA default
replaced-element height (**150px**) leaks through. The `768 × 150` readout is honest measurement
of a box nothing ever sized.

Persistence: none by design (R5 — "preview state, never project state", `VisualCanvas.tsx:88-96`).
The only bench disk write is scenarios (`component.setMetaData('bench.scenarios')`). A scenario
carries a frame **width** but no height (`benchScenarios.ts:59-66`). Near-miss:
`componentBench.ts:139,154` already *type* `frame?: { width?, height? }` on `BenchMount`/
`BenchExport` — dead code (the bench never passes frame, deliberately: frame-as-build-input would
`location.reload()` on every resize, `ComponentBench.tsx:28-33`).

## Fix direction

1. **Immediate symptom (S):** give `.Frame` a real default height — "fill the stage" is one CSS
   line (`align-self: stretch` + drop the vertical half of `margin: auto`).
2. **`height` joins the model (M):** add `height` (+ stretch semantics) to `BenchFrame` with
   clamp/resolve mirrors of the width pair; write it onto `.Frame`; extend `benchSizeLabel`.
3. **Resize gesture:** drag handles on the frame's right and bottom edges, as **sibling overlays**
   (a `<webview>` swallows pointer events — children won't work), writing through the existing
   `onFrameChange`.
4. **Per-component default size:** a new component-metadata key (`'bench.frame'`) beside
   `bench.scenarios`, read in the same effect shape, written **behind a deliberate gesture only**
   ("Set as default size") — never autosaved from a drag, or every stray resize dirties the
   project.
5. Wire or delete the dead `BenchExport.frame` type — it is currently a lie.

## Rulings needed

- **Does per-component default size persist to component metadata** (a second deliberate exception
  to R5 — a default size is arguably authored intent) or stay ephemeral with only scenarios
  carrying size? (Recommend: persist behind the explicit gesture.)
- Do **scenarios** gain height? If yes: `readBenchScenarios` + `benchScenarioIsModified` change,
  and old scenarios must stay readable (they already degrade tolerantly).
- Is `Stretch` one toggle for both axes, or two?
- Default height: "fill the stage" (recommended — fixes the reported symptom with no new model)
  vs a fixed number?

## Acceptance criteria

1. Benching a card component fills the stage vertically by default — no 150px sliver. Screenshot
   vs `workbench-1.png`'s framing.
2. Dragging the bottom edge resizes height live; the size readout tracks it; no `location.reload`.
3. "Set as default size" → close bench → re-bench → the size is restored; `project.json` diff
   shows exactly one metadata key.
4. A stray resize *without* the gesture does not dirty the project (control).
5. ⚠️ Coordinate with FIX-019 — both want chrome-strip real estate (30px, six controls, clips at
   640px per BEN-004's drive). Decide the strip layout once, together.
