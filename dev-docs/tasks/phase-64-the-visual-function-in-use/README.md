# Phase 64 — The visual function in use (Track VFN)

**Created:** 2026-08-13
**Status, 2026-08-13:** ✅ **all fourteen tasks BUILT, spec-proved and merged** into `cline-dev`
(VFN-001…014 — 013 and 014 were added from the first live test). 🔴 **Most of the phase has never
been driven.** Tasks and their exact built/proved/driven state are **[TASKS.md](TASKS.md)**; the
remaining work is one bundled drive, listed in
**[NEXT-SESSION-2026-08-13-F.md](NEXT-SESSION-2026-08-13-F.md)**.
**Origin:** Richard, 2026-08-13, after using the floating Logic Builder for the first time as a
builder rather than as its author — the day after [LGC-010](../phase-59-logic-seam/LGC-010-A-WINDOW-NOT-A-PANE.md)
shipped the window:

> *"I'm playing with the logic visual function editor. Here are the things we need to fix … If we fix
> all those things I think the logic node will be amazing."*

## The premise, in one sentence

Phase 59 made the visual function **findable, legible and openable**; eleven minutes of actually
building with it found that it is not yet **usable** — and every one of the eleven reports is about
the moment *after* the blocks are on screen.

That is the shape to hold onto while working this phase. None of these is a discoverability
failure and none is a design disagreement. They are all the same class: *the feature is there, and
the thing you do next with it does not work.* A saved block you cannot read; a variable you cannot
create; a field you cannot see while typing; a run you cannot inspect; a Delete that deletes twice.

## 🔴 What was pinned in source, and what was not

Written down explicitly, because this register's most expensive repeated mistake is a task that
starts from a mechanism nobody checked. **Six of eleven have a mechanism read in source. Two do
not, and both carry a reproduce-first instruction. Three are design work with no defect underneath.**

| # | Report | Mechanism | Confidence |
|---|---|---|---|
| 2 | one Delete, two deletions | Blockly 12 binds `keydown` on its **injection div**, not `document` ([`blockly_compressed.js`, `inject`](../../../node_modules/blockly/blockly_compressed.js) — one `conditionalBind(d,"keydown",…)` where `d` is the container), so it runs *first* on the way up. Blockly 12's `FocusManager` focuses the **block's own SVG element** (`getFocusableElement`, `blocklyActiveFocus` — 82 `FocusManager` references in the bundle). Deleting the block removes the focused element, `document.activeElement` falls back to `<body>` **inside the same dispatch**, and our document-level handler then reads `'none'` and runs `nodeGraph.delete()` | ⭐ **pinned** — explains why L30's negative control passed and this still bites |
| 3 | field text clipped left and right | [`BlocklyWorkspace.module.scss:293-301`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.module.scss) adds `padding: 4px 8px !important` and `border: 1px !important` to `.blocklyHtmlInput`. Blockly's base rule is `padding: 0; border: none; width: 100%; text-align: center; box-sizing: border-box`, and the width is computed from the field's measured **text** width. 18 px comes out of the content box of a box that was exactly text-width | ⭐ **pinned** |
| 4 | Create variable does nothing | Nothing in this repo calls `Blockly.dialog.setPrompt`. Blockly's default is `defaultPrompt = (a,b,c) => c(window.prompt(a,b))` — **the only `window.prompt` in the bundle**. Electron renderers do not implement `prompt()` | ⭐ **pinned**. Rename variable is dead by the same route |
| 10 | "No runs yet" | The trace path is complete end to end. It arms **when the editor opens** ([`BlockTraceClient.ts:146`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlockTraceClient.ts)), so a run that already happened records nothing; and a node whose `generatedCode` predates LGC-003 emits no `__p`/`__s` and regenerates only on its own next edit | ⭐ **pinned** as *why it says that*. The **feature asked for** is new work |
| 7 | a saved block does not describe itself | `MyBlockDefinition.description` exists in the format and **nothing collects it and nothing shows it**. The call block's tooltip is one hard-coded sentence ([`MyBlocksBlocks.ts:65`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksBlocks.ts)) | ⭐ **pinned** as an absence |
| 8 | no way to edit a saved block | The engine is complete and unreachable: `save({id})` overwrites, `rename`, `referencesTo`, `remove` with `MyBlocksInUseError` ([`myblocks/store.ts:173-264`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/store.ts)). **Zero UI** | ⭐ **pinned** as an absence |
| 1B | cannot click the preview | The layer is `pointer-events: none` ([`nodegrapheditor.css:45-49`](../../../packages/noodl-editor/src/editor/src/styles/nodegrapheditor.css)) and LGC-010's drive **measured** an outside click reaching the preview. The window defaults to **82% of the viewport, centred** ([`logicOverlayGeometry.ts:74`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/logicOverlayGeometry.ts)) | ⚠️ **believed occlusion, unproven.** VFN-005 must reproduce before building |
| 6 | backpack radio does not check | State **does** apply — the save goes to the backpack, so `setScope` ran. Cosmetic only. No global radio reset exists in this repo, no `color-scheme` is declared anywhere, and the dialog is mounted once ([`DialogLayerModel.tsx`](../../../packages/noodl-editor/src/editor/src/models/DialogLayerModel.tsx)) | 🔴 **not pinned.** VFN-007 reproduces first |
| 1A, 5, 9, 11 | — | design work, no defect underneath | — |

## The four rulings, 2026-08-13

Taken before the tasks were written. **Do not re-litigate them inside a task.**

1. **The sandbox runs in the editor** (VFN-011). Compile the blocks in the editor process and run
   them against sandbox values with a stubbed Noodl API. No preview needed, works with the app
   stopped. The cost is accepted and stated: a second execution context that can drift from the
   runtime's, and `Variables`/`Objects`/`Arrays` that are stubs rather than live app state. The
   task owes a **drift gate**, not a promise.
2. **The saved-block library manager is built in full** — project *and* launcher (VFN-008, 009, 010).
3. **The window stays open across navigation and says where it belongs** (VFN-004). Tab reads
   `Component · Node`; clicking it navigates back and selects the node. Closing on navigation was
   rejected: it costs the round trip the whole feature exists to remove.
4. **The save gesture is made clear by highlighting the group on the workspace** (VFN-006), on
   hover of the menu item and for as long as the dialog is open. Multi-select was rejected —
   LGC-006 already ruled that the plugin route pins a frozen Blockly 12 release.

## Standing constraints inherited from phase 59, unchanged

- **`name: 'Logic Builder'` is the type id and is frozen.** Only `displayNodeName` changes.
- **The workspace is the single source of truth for ports.** `detectIO` reads the blocks; the editor
  publishes dynamic ports from the *viewer*, which cannot see editor globals. Nothing in this phase
  may create a second store — including VFN-011's sandbox, which must read the same `detectInterface`
  projection the rails already read.
- ⚠️ **`BlocklyWorkspace` reads `initialWorkspace` once and never reloads from props**, deliberately.
  Every decoration is an imperative SVG overlay. VFN-006's highlight and VFN-011's badges are both
  bound by this.
- ⚠️ **Occluded Electron fires zero `ResizeObserver` events and clamps timers ~1000×.** Anything
  geometric is written synchronously on the event's own tick, and `resizeBlocklyWorkspaces()` is
  called from whatever moved the box.
- 🔴 **Do not register `Blockly.Events.disableOrphans`.** See
  [FINDING-2026-08-12](../phase-59-logic-seam/FINDING-2026-08-12-disableOrphans-kills-every-program.md).
- 🔴 **`undefined` is not `""` on the generate seam.** A refusal travels as `undefined` and the
  writer skips the parameter; `""` is a real program. A tidy-up that collapses them re-opens a
  defect that has already cost this feature two sessions.
- **Adopt > build.** Any task that reimplements a `@blockly/*` plugin owes a written reason.
- **Structure > gate > documentation.**

## What is deliberately not here

- **Multi-select in the workspace.** Ruled out in favour of VFN-006's highlight. If a future Blockly
  release brings selection into core, VFN-006's `selectionFor` seam already takes an array.
- **"Which flows will this break" as a semantic analysis** (report 9's deep half). VFN-009 ships the
  honest half — *where* it is used, and *whether the shape changed in a way that refuses its call
  sites* — and files the rest against the unit-testing phase. A warning that guesses at behavioural
  breakage is worse than one that names call sites, because it will be believed.
- **Blocks ⇄ JavaScript round-trip.** Still out, still for the same reason.
- **AI authors the blocks.** Now *closer*: VFN-008/009/010 finish LGC-007's definition store, which
  was the stated blocker. Still filed, still not scheduled.
