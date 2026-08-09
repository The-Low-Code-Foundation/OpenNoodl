# BEN-007 — The acceptance pass the phase closes on

**Status:** ✅ **DRIVEN 2026-08-09, 12 of 13** — every criterion below except **§C** has a measured
number or a screenshot behind it, recorded in [HANDOVER-SESSION-7.md](HANDOVER-SESSION-7.md).
**§C is a human gate and stays open**: it needs someone who did not build this, which is the whole
reason it is written that way. Its two screenshots are committed under `screenshots/`.

⚠️ **Criterion 5 says "no reload" and that is true only in the common case.** Applying a scenario
reloads the bench window **on purpose** when a name being cleared has no derived default (register
B21) — `applyValueSet` bumps `revision` *and* `remountKey` there. The two scenarios driven here carry
the same key set, so nothing was cleared and nothing reloaded. Do not read the criterion as a
promise that a scenario switch never reloads.

⚠️ **Criterion 6's stated evidence is weaker than it looks.** The route lives in the URL hash, so it
survives a reload — "the route is still there" would read green on a preview that had been torn down
and rebuilt. The drive planted a JS marker and typed form values as well, and that is what caught
**B29**. Anything re-running this criterion should do the same.

## Why this is a task and not a checkbox

Four of five specs in phase 42bis were wrong about their own mechanism. The phase-55 handover said
the suite was green while it was red. A right mechanism is not a right prediction. So this phase does
not close on specs passing — it closes on someone driving the editor and watching it work.

**A fake is an unchecked claim.** Every criterion below names the evidence that settles it.

## Setup

Use the `run-editor` skill. Traps that will otherwise eat the session, all previously paid for:

- ⚠️ **`--target=editor` attaches to the PREVIEW**, not the editor. Verify which target you are on
  before believing anything.
- ⚠️ **Never `cdp reload`.**
- ⚠️ **Verify WHICH project opened first.** Dev launch rewrites the example project.
- ⚠️ **Occluded Electron clamps timers ~1000×** — pace any driver with `MessagePort`.
- ⚠️ **A property-panel select opened by `.click()` never closes** (portalled options), and a text
  input commits on **blur/Enter only**. Both are directly in this phase's UI.
- ⚠️ **Closing a webview CDP target white-screens the editor** — this phase has three webviews.
- ⚠️ HMR will not reach a mounted panel; expect to remount.

Fixture: the NodeGX QA fixture project, plus one AI-authored component for the BEN-006 leg.

## The run

### A. The human path (BEN-001/002/003/004/005)

1. Open a hand-written card component from the components panel via **right-click → Preview in
   isolation**. → *Evidence: screenshot showing the component on the bench stage.*
2. Type three input values. → *Evidence: the values read out of the rendered DOM, plus proof the
   preview did **not** reload — leave an unrelated element hovered/typed across the change and find
   it intact.*
3. Fire an input signal; click something in the component. → *Evidence: both appear in the outputs
   log.*
4. Set the frame to 320 and toggle stretch. → *Evidence: measured document width, both ways.*
5. Save two scenarios, switch between them. → *Evidence: both render; the project file contains the
   metadata; no reload.*
6. Switch back to **App**. → *Evidence: the route and the typed form state from before the switch are
   still there. This is R3 and it is the criterion that decides whether the phase met its brief.*

### B. The AI path (BEN-006)

7. Run a component-mode build. On its preview, open **Data**, change a product name and set the row
   count to 1, Apply. → *Evidence: the new string in the DOM and exactly one row.*
8. Fill in a class flagged **Fields unknown** by hand. → *Evidence: populated render where it was
   blank.*

### C. The disorientation test

9. Screenshot bench mode and app mode with the window chrome cropped. Show both to someone who did
   not build this. → *Evidence: they say which is which without reading any text.* If they cannot,
   **R2 failed** and the fix is visual, not a label.
10. Ask them which one is the real app. → *Evidence: they answer correctly and quickly.*

### D. Regressions

11. The AI authoring preview behaves exactly as before for a build that touches none of the new
    controls. → *Evidence: sample data summary, sign-in toggle and token resolution all unchanged.*
12. Editing a node property still updates the app preview live (BEN-002 touched `modelUpdate`).
13. Design tokens resolve in all three preview surfaces.

## Gates

Both runners, and **do not conflate them** — the phase-55 handover did:

- `npx jest` (tests-main + tests-unit) — compare the **passing count**, not just the summary. A suite
  that will not compile reports `Tests: 0`.
- `npm run test:ci` in `noodl-editor` — the jasmine/Electron suite. **Only the `Jasmine:` line
  counts**; an OOM kill (137) is not a verdict. It carries **4 inherited failures** (phase-55 F32);
  measure both ways at the base commit before blaming this phase for any of them.
- The typecheck gates that are actually gates — `typecheck:core-ui` is **not** one.
- `catalog:examples`, if anything under `docs/node-catalog/` was touched.

## Closing

- [x] Every criterion above has its evidence recorded, not asserted — **except §C/9 and §C/10**,
      which are a human gate and are recorded as open.
- [x] Anything filed-not-fixed has a **row** in the phase README register, with its blocker named:
      **B28** (stretch and the frame, closing B3 and B8), **B29** (an unattributed app-preview
      reload), **B30** (an unattributed broken Apply), **B31** (a delivered-and-ignored bench input),
      **B32** (R2 measured, and where it is weakest). **B1/F22 is still open** — the shared
      render-report module is unchanged CJS under `scripts/` and nothing in the editor bundle imports
      it, so this drive read the sandbox webview's own DOM over CDP and took screenshots, and says so
      in B1 rather than quietly dropping the standard.
- [x] A handover written for whoever picks this up, stating what was measured and what was inferred:
      [HANDOVER-SESSION-7.md](HANDOVER-SESSION-7.md).
