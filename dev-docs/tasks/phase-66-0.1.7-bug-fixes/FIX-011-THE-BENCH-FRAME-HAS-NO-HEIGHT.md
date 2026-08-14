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

## ✅ RULED 2026-08-14 — persist, behind the explicit gesture

- ✅ **Per-component default size persists to component metadata**, written **only** by the
  deliberate "Set as default size" gesture — a second knowing exception to R5, on the grounds that
  a default size is authored intent. A drag alone never writes; acceptance criterion 4 (a stray
  resize does not dirty the project) is the control that proves it, and it is load-bearing, not
  decorative.
- 🟡 **Still open, and an agent may take the recommendation:** whether scenarios gain height
  (if yes: `readBenchScenarios` + `benchScenarioIsModified` change, and old scenarios must stay
  readable — they already degrade tolerantly); whether `Stretch` is one toggle or two.
- ✅ **Default height = "fill the stage"** — the recommended option, which fixes the reported
  symptom with no new model. The fixed-number alternative was not taken.

## Acceptance criteria

1. Benching a card component fills the stage vertically by default — no 150px sliver. Screenshot
   vs `workbench-1.png`'s framing.
2. Dragging the bottom edge resizes height live; the size readout tracks it; no `location.reload`.
3. "Set as default size" → close bench → re-bench → the size is restored; `project.json` diff
   shows exactly one metadata key.
4. A stray resize *without* the gesture does not dirty the project (control).
5. ⚠️ Coordinate with FIX-019 — both want chrome-strip real estate (30px, six controls, clips at
   640px per BEN-004's drive). Decide the strip layout once, together.

## ✅ CLOSED 2026-08-14 — driven 4/4 on `fix012-drive` :: `/Probe`, dev stack at `519a1e66`

1. ✅ **Frame filled the stage**: 768 × 239 in a 283px stage (239 = exact inner height after 16px
   padding), `align-self: stretch`, no inline height, height field showing its "Fill" placeholder.
   Not the 150px sliver. Screenshot taken.
2. ✅ **Bottom-edge drag, live**: 239 → 179 mid-drag → 150 at release (clamped at the minimum —
   which happens to equal the old UA sliver, a coincidence worth not being confused by). The
   readout tracked every step (`768 × 179`, `768 × 150`); the height field took the pinned value;
   `bench-drag-shield` existed exactly for the drag's duration; a `did-start-loading` counter on
   the bench webview read **0** — no reload.
3. ✅ **Pin → persist → restore**: the pin wrote `bench.frame {width:768, height:150}` as Probe's
   only metadata key; scope → App → re-bench restored 768×150 in the frame, both fields, and the
   readout, pin shown filled. **The "exactly one key" diff was proven serializer-to-serializer**:
   clearing the key via `setMetaData(undefined)` and re-pinning, the two editor-written files
   differ by exactly the six diff lines of that one key. (Byte-comparison against the *pre-editor*
   file is impossible — the editor's serializer reformats the whole file on first save; see the
   drive note in NEXT-SESSION-PROMPT §3.)
4. ✅ **Control held**: after the stray drag (no pin), `project.json`'s SHA and mtime were
   byte-identical to the pre-launch baseline — the drag wrote nothing, and (v1 fixture) neither
   did opening.
5. ✅ Settled at build time; the strip rendered all six controls plus the readout with no clipping
   at the drive's 1368px width.

**The `<webview>`-swallows-pointer-events claim (register B/§4 ⚠️) remains untested** — the drive
proves the shipped siblings-plus-shield arrangement works (handle took the mousedown, shield kept
the moves), not that a child grip would have failed. Settling that needs a deliberate experiment
nobody now needs.
