# Phase 64 — the tasks (VFN: the visual function in use)

**Created:** 2026-08-13, out of [README.md](README.md) and eleven reports from one session of
building with the floating Logic Builder.

>  **Status, 2026-08-13 (end of day)** — tier 1 is **built and driven**; VFN-004, 007, 008, 011 and
> 012 are **built, merged and NOT driven**. Gates on `cline-dev`: **165 suites / 2453 passing**,
> `tsc` clean, `cloud-library:check` green.
>
> 🔴 **Start at [NEXT-SESSION-2026-08-13-C.md](NEXT-SESSION-2026-08-13-C.md).** Its first items are
> Richard's own three asks from driving the merged build — VFN-013 (run values drawn on top of the
> block they belong inside), VFN-014 (*View Code* shows the instrumented build), and VFN-009/010
> (the saved-blocks manager, now unblocked by VFN-008).
>
> ✅ **VFN-013 and VFN-014 are BUILT on `vfn-a-asks` (2026-08-13).** Jest **168 suites / 2494
> passing** (+3 suites, +41 specs on the 165/2453 baseline), `tsc -p tsconfig.json` clean. Both
> carry negative controls that were watched going red. **Both owe a live drive** — the badge
> re-sweep and the *View Code* press — and neither has been merged.
>
> 🔴 **Five merged tasks have never been run.** That is the position tier 1 was in this morning,
> and driving it found one task's *stated instrument* was wrong and VFN-007's real cause was a
> fifth candidate nobody had considered. Bundle the drive; live QA is serial across this machine.
>
> ✅ **A placed saved block now publishes its ports — FIXED 2026-08-13 on `vfn-c-ports`.** The call
> block states its definition's ports in `extraState.ports` and `detectIO` reads them; the route
> both writeups filed was rejected because the **backpack** shelf can never reach the viewer and the
> reported block was backpack-only. It also fixes the interface rails and the bench, which nobody
> had noticed were blind. 🔴 **The canvas half still needs a drive.** See
> [NOTES-ports.md](NOTES-ports.md).
>
> 🔴 **One defect still filed and unfixed:** `BaseDialog`'s measuring copy is **tab-reachable**, so
> every focusable element in every dialog is in the tab order twice. In -C.

**Every claim about existing code in these files was read in source**, and every claim that was
*not* pinned says so and carries a reproduce-first instruction. Six of the eleven reports have a
mechanism; two do not; three are design work.

| Task | File | One line | Report | Tier | State |
|---|---|---|---|---|---|
| VFN-001 ⭐ | [VFN-001-ONE-DELETE-STILL-MEANS-TWO.md](VFN-001-ONE-DELETE-STILL-MEANS-TWO.md) | the focus guard reads `activeElement` *after* Blockly removed the focused block | 2 | **1 — ship-blocking** | ✅ **BUILT AND DRIVEN 2026-08-13 — criteria 1–4 all pass**, each with a negative control (canvas nodes 8→8→8→8 across three Deletes; control deletes the node with focus outside). 🔴 **The task's own fix sketch was insufficient and the spec caught it (VFN-001b):** a detached element has no ancestors, so `path[0].closest('[data-keyboard-scope]')` is `null` on the very block that was removed — the resolver walks the captured composed path and takes the first element still `isConnected`. 13 specs (6 jasmine + 7 jest), including a negative control taken at the same instant on the same event. Also made correct: closing tabs is one transition, because a batched loop of `closeTab` never emits `AllTabsClosed` |
| VFN-002 | [VFN-002-THE-FIELD-YOU-CANNOT-READ.md](VFN-002-THE-FIELD-YOU-CANNOT-READ.md) | our own `padding` takes 18 px out of a box Blockly sized to fit the text exactly | 3 | **1 — ship-blocking** | ✅ **BUILT AND MEASURED LIVE 2026-08-13 — passes.** 🔴 **`scrollWidth > clientWidth` is the WRONG instrument** (integer rounding gives a false 1px failure); `scrollLeft` is the honest one — 0 with the fix, up to 9.5px of real clip with the pre-fix rule re-injected. Border and padding gone, ring is a `box-shadow`, `font-family` override deleted — ✅ and the font half is *confirmed in source*: `WidgetDiv.show` copies the renderer and theme class names onto the widget div so Blockly's own `FIELD_TEXT_FONTFAMILY` rule reaches the input, which is why no theme change was needed. 6 tests parse the stylesheet, with a negative control over the pre-fix rule. ✅ live measurement done; 🔴 criterion 3's AA contrast reading and criterion 4 (dropdowns) still owed |
| VFN-003 | [VFN-003-THE-DIALOG-ELECTRON-DOES-NOT-HAVE.md](VFN-003-THE-DIALOG-ELECTRON-DOES-NOT-HAVE.md) | Blockly asks for a name with `window.prompt`, which Electron does not implement | 4 | **1 — ship-blocking** | ✅ **BUILT AND DRIVEN 2026-08-13 — criteria 1, 2, 3, 5 pass; 4 proved at the seam.** The control re-registers `window.prompt` and reproduces the silence on demand. All three registered (`setPrompt`/`setConfirm`/`setAlert`), contract split into a React-free module so it is assertable — 10 specs, including the whole prompt → taken → alert → re-prompt gesture. 🔴 **Registered from `BlocklyWorkspace`, NOT `initBlocklyIntegration()`** — the latter is reachable from the plain-Node runner and a `@noodl-core-ui` import in its graph broke two suites *to run*. ✅ Ephemeral focus handled. ✅ The silence is reproduced by the control and gone with the fix. 🔴 The full "delete a variable in use" gesture is still undriven |
| VFN-004 | [VFN-004-THE-WINDOW-SAYS-WHERE-IT-BELONGS.md](VFN-004-THE-WINDOW-SAYS-WHERE-IT-BELONGS.md) | the tab names the component, and clicking it takes you back to the node | 1A | 2 | 📋 open |
| VFN-005 | [VFN-005-THE-APP-IS-BEHIND-THE-WINDOW.md](VFN-005-THE-APP-IS-BEHIND-THE-WINDOW.md) | 82% of the viewport, centred, is on top of the running app — park it, snap it, or place it better | 1B | 2 | 📋 open · ✅ **criterion 1 answered 2026-08-13: OCCLUSION** (window measured 74.1%×69.5%; every blocked point inside the window rect) |
| VFN-006 | [VFN-006-SHOW-ME-WHAT-I-AM-SAVING.md](VFN-006-SHOW-ME-WHAT-I-AM-SAVING.md) | "5 blocks" becomes *those* five blocks, outlined on the workspace | 5 | 2 | 📋 open |
| VFN-007 | [VFN-007-THE-SHELF-THAT-DOES-NOT-SAY-WHICH.md](VFN-007-THE-SHELF-THAT-DOES-NOT-SAY-WHICH.md) | the backpack radio takes the choice and does not show it — reproduce, then replace the control | 6 | 3 | 📋 open · 🔴 **criterion 1 answered 2026-08-13: NOT contrast.** `BaseDialog` renders the body twice, so 4 radios share one native group and the check lands on the invisible measuring copy |
| VFN-008 ⭐ | [VFN-008-A-SAVED-BLOCK-THAT-DESCRIBES-ITSELF.md](VFN-008-A-SAVED-BLOCK-THAT-DESCRIBES-ITSELF.md) | a description that is asked for, stored, and shown everywhere the block appears | 7 | 2 | 🟡 **all six criteria built, NOT driven.** ✅ **criterion 4 fixed 2026-08-13 (`vfn-c-ports`)** — it was false as written: a call block now states its definition's ports in `extraState.ports` and `detectIO` reads them, so the port the generated code writes to exists. 🔴 **both filed routes rejected** — the backpack shelf can never reach the viewer and the reported block was backpack-only; measured on the real `vfn64-qa` artefacts (`result` appears, typed `number`). Also fixes the interface rails and the bench, which the finding never mentioned. Each half watched red. 🔴 canvas half needs a drive |
| VFN-009 ⭐ | [VFN-009-THE-LIBRARY-IN-THE-PROJECT.md](VFN-009-THE-LIBRARY-IN-THE-PROJECT.md) | open, rename, delete and **edit** a saved block, with a warning that names every call site | 8, 9 | 2 | 📋 open |
| VFN-010 | [VFN-010-THE-BACKPACK-IN-THE-LAUNCHER.md](VFN-010-THE-BACKPACK-IN-THE-LAUNCHER.md) | backpack blocks are marked in the picker and managed from the launcher | 8 | 3 | 📋 open |
| VFN-011 ⭐ | [VFN-011-THE-BENCH.md](VFN-011-THE-BENCH.md) | set sandbox values, press Run, watch the badges fill — with no app running | 10 | **1 — the flagship** | 📋 open |
| VFN-012 | [VFN-012-THE-BLOCKS-THE-APP-ALREADY-HAS.md](VFN-012-THE-BLOCKS-THE-APP-ALREADY-HAS.md) | app-config variables, registered libraries and `window` become blocks | 11 | 3 | 📋 open |
| VFN-013 | [VFN-013-THE-VALUES-YOU-CANNOT-READ.md](VFN-013-THE-VALUES-YOU-CANNOT-READ.md) | run values are drawn on top of the block they belong inside | live test 2026-08-13 | 2 | ✅ **BUILT 2026-08-13, live re-measure OWED.** Placement is now nesting-aware: a top-level block keeps LGC-003 §5.1's `-(width+6)` anchor to the pixel; a nested one goes above (or below) its **own** left edge, never left of it, with badge-vs-block and badge-vs-badge collisions resolved. New pure module `badgeLayout.ts`; 17 specs with the negative control built from the *old* formula (prints 4 real overlaps). 🔴 **Criterion 3 found a REAL failure and it was not the placement**: the badge fill was `--theme-color-bg-2`, which measures **2.58:1** against a block in the LIGHT theme — Blockly hues are theme-independent, so no light fill can clear 3:1 and the badge is now dark in both themes (worst 3.21:1 over the whole hue circle). Owed: the `getBoundingClientRect()` re-sweep in a driven editor |
| VFN-014 | [VFN-014-THE-CODE-NOBODY-CAN-READ.md](VFN-014-THE-CODE-NOBODY-CAN-READ.md) | *View Code* shows the probe-instrumented build, not the program | live test 2026-08-13 | 2 | ✅ **BUILT 2026-08-13, live drive OWED.** *View Code* now leads with a probe-free rendering of the same program and keeps the instrumented one behind one *Show tracing* press, labelled as what runs. Each inlined saved block is marked `// test1` (criterion 6). 19 specs, incl. **criterion 3 proved with a negative control**: instrumented → readable render → instrumented is byte-identical, and a deliberately leaked generator makes that comparison go red. Criterion 4 proved by *running* both and diffing outputs **and signal order**. ✅ **mechanism pinned**: `generatedCode` is generated inside `withBlockProbes`, which is **scoped** — a clean rendering is one call away. ✅ **criterion 5 REPRODUCED AND CLOSED 2026-08-13: `Outputs["result"]` is the inlined body of saved block `test1` (user backpack), and `generatedCode` is NOT stale — the serious candidate is eliminated.** 🔴 it produced a **new criterion 6**: the code cannot say which lines came from a saved block, which is why `result` was unfindable |

## Suggested order, and why

**Tier 1 first, and it is genuinely a tier rather than a preference.** VFN-001, 002 and 003 are each
a builder losing work or being unable to proceed: a node deleted that nobody touched, a number you
cannot see while typing it, a button that does nothing at all. All three are small — the largest is
VFN-003 and it is one seam and one dialog — and none of them depends on anything else in the phase.
Shipping the rest of this phase on top of them is shipping polish over a data-loss bug.

**VFN-011 next, alone if necessary.** It is the flagship and it is the one task that changes what the
node *is*: a visual function you can exercise without running the app is a different tool from one
you can only watch. It is also the task most likely to find that something else is wrong, because it
is the first thing in this feature's history that executes a block program on demand.

**Then the library, in order: VFN-008 → VFN-009 → VFN-010.** They are one job in three sizes, and
008 is the cheapest half of the value: a saved block that says what it does removes most of the
reason to open it. 009 needs 008's description field to have somewhere to edit it. 010 needs 009's
manager to exist before it can be a second instance of it.

**VFN-004, 005, 006, 007 in any order.** All four are independent, all four are small, and none of
them blocks anything. VFN-005 is the only one with a reproduce step in front of it.

**VFN-012 last**, because it adds vocabulary to a language the previous eleven tasks are busy making
work. It is also the one task whose scope can be cut without leaving a hole: shipping the app-config
variables and not the libraries is a coherent partial answer.

## Two things to check before starting *any* task here

1. 🔴 **Reproduce the report.** Two of eleven have no pinned mechanism and both are written to look
   obvious. This register has filed a "not there" finding that was a grep of the wrong surface, a
   guard that was decoration, and a spec containing the sentence it forbade. Reproduce first.
2. ⚠️ **`test:main` and `test:ci` before and after.** `test:main` measured 144 suites / 2107 green
   on 2026-08-12; `test:ci` has a floor of 6 failures at 2670 specs. Compare **names**, not counts,
   and read `tests/test-results.json` rather than the log. `cloud-library:check` is a required PR
   gate and drifts red on any port-group rename — VFN-012 adds ports and must run it.
