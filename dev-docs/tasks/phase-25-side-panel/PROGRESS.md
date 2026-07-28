# Phase 25 — Side Panel (Track J): Progress

**Status:** ✅ **All 9 tasks complete; all five gates run from the primary checkout** (2026-07-27).
Tiers 1–4 landed. The closing pass did the thing no worktree agent could — ran the gates against a
real editor (see *The trap that shaped this whole phase*) — and found **nine defects, F37–F45**, two
of them in behaviour a task had already described as verified. Four gates are green:
`panel-geometry` 45/45, `panel-chrome` 36/36, `panel-modes` 13/13, `components-tree` 4/4 both themes.
The fifth, `settings-consolidation`, was 11/13: its two failures were **F44**.

**Update 2026-07-28 — F21, F41 and F44 are all fixed** by the cross-phase defect batch (batch C);
the register rows carry the detail. F44 was **not** the "app-name persistence lag ... not a
side-panel defect" described here: metadata autosave was never armed at all, and the blast radius
included SEO, PWA, config variables, Styles, design tokens and the DB schema cache. **F20 remains
open and unowned** (it is a recorded decision, not a defect). Items still needing a human are listed
under *Still not verified*, and two are added there by batch C.
**Specced:** 2026-07-27
**Mock:** [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) (`93cc4da`)
**Phase overview:** [README.md](./README.md)

## Task status

| ID | Title | Tier | Status | Landed | Notes |
|---|---|---|---|---|---|
| [PNL-001](./PNL-001-PANEL-SCROLL-CORRECTNESS.md) | Panel scroll & box-model correctness | 1 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-001-NOTES.md). Both defects reproduced with numbers, then fixed. Global `box-sizing` reset **evaluated and rejected** — it shrinks every TextInput by 18px. Gate: `corpus/panel-geometry.mjs`, 11/11 clean at 620/720/1200px. |
| [PNL-002](./PNL-002-OUTSIDE-CLICK-GESTURE.md) | Outside-click vs. drag in the popup layer | 1 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-002-NOTES.md) · [matrix](./PNL-002-TEST-MATRIX.md). Mechanism confirmed off the live DOM, but the *felt* symptom had a second cause in the canvas. Fixed in 4 places; caught and fixed a regression the gesture change itself introduced. |
| [PNL-003](./PNL-003-PANEL-WIDTH-BEHAVIOUR.md) | Panel width: reset, memory, snap & collapse | 1 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-003-NOTES.md). Width per panel, per project, persisted; ⌘\ wide, ⌘B hide, drag-to-collapse. 11/11 acceptance checks driven live. Found a renderer deadlock and F21. |
| [PNL-004](./PNL-004-CONTAINER-QUERY-LAYOUT.md) | Container-query layout + `PanelRow` | 2 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-004-NOTES.md). `PanelRow` + two named containers + three bands declared once. Band numbers carry a −34px content-box offset so they mean *panel* widths (F29). Gate grew a horizontal axis at five widths — and then had to be taught not to cry wolf (F30). |
| [PNL-005](./PNL-005-ONE-PANEL-CHROME.md) | One panel chrome, everywhere | 2 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-005-NOTES.md). `PanelHeader` finally styles its own `.Title`. 7 panels migrated, not 14 — the spec's list was wrong in five places (F31). Two panels had chrome-less *states* rather than no chrome (F32). |
| [PNL-006](./PNL-006-COMPONENTS-PANEL-RESTYLE.md) | Components panel restyle | 3 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-006-NOTES.md). Kind glyphs, indent guides, in-place filter, and the light-mode selection fix that was the reported bug. **Its gate had never been run**; the closing pass ran it and it is now green in both themes — selected-row contrast **12.2:1 dark, 13.72:1 light** against a 4.5:1 bar. Doing so cost F45 (the gate wedged the panel) and F41's coral (2.91:1, now 3.36:1). Four honest SKIPs remain: the warning dot needs a project that carries a warning. |
| [PNL-007](./PNL-007-INLINE-RENAME.md) | Node label & inline rename | 3 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-007-NOTES.md). Text at rest, real field on double-click, check/cancel, Escape reverts. Phantom-undo guard tested, not assumed. The AiAuthoringPanel half of the spec was a stale premise. |
| [PNL-008](./PNL-008-SETTINGS-CONSOLIDATION.md) | Three settings panels become one | 3 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-008-NOTES.md). One destination behind a cog; F15's two-owners-of-the-title resolved. **Its live half had never been run**; it now passes 11 of 13 — one rail button, one header, both tabs, all 7 Project groups, one control per title field. The two failures are **F44**, a real and reproducible app-name persistence lag, not a layout defect. |
| [PNL-009](./PNL-009-FLOAT-AND-FULL-MODES.md) | Floating & full panel modes | 4 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-009-NOTES.md). Modes are **CSS-only** (no re-parenting), so the legacy `Frame`-hosted views survive; the 7 `LocalBackendCard` portals became registered transient panels and the scrim was deleted rather than tokenised. `panel-modes.mjs` is **13/13 green**, including the two behaviours the notes admitted were never verified. Getting there found F39 and F43 — the `⋯` menu had been opening in the window's corner the whole time. |

## Findings register

Everything below was established by reading the code during the 2026-07-27 critique, with the file and
line confirmed. Executors should re-confirm the live symptom before fixing — if a finding turns out to
be stale or to have a different cause, correct it here rather than implementing around the description.

| # | Finding | Where | Owner |
|---|---|---|---|
| F1 | Panel width resets to 380px on every `activeChanged` **and** every `window.resize`; never persisted | `EditorPage.tsx:77, 83-95` | PNL-003 — ✅ confirmed and fixed |
| F2 | Scroll-area flex children lack `flex-shrink: 0` and carry `overflow: hidden`, so sections squeeze and clip instead of the container scrolling | `CollapsableSection.module.scss:1-8` | PNL-001 — ✅ **confirmed** (28px, 109px and 221px hidden on Editor Settings) and fixed |
| F3 | `BasePanel .Root` is 34px taller than its slot: `height: 100%` + 16px padding + 1px border, no global `box-sizing: border-box` | `BasePanel.module.scss:1-18` | PNL-001 — ✅ **confirmed** (exactly 34px, every `BasePanel` panel) and fixed |
| F19 | `Checkbox .Checkbox` is `position: absolute` with no positioned parent, so its containing block is `BasePanel .Inner` — checkboxes below the fold land past the panel bottom and inflate a non-scrolling ancestor | `Checkbox.module.scss` | PNL-001 — found while fixing F2/F3; fixed |
| F20 | A global `* { box-sizing: border-box }` is **not** adoptable as-is: it narrows every `TextInput` by 18px, shrinks the checkbox glyph 20→16px and the icon rail by 20px | measured, editor-wide | PNL-001 recorded the full table; unowned |
| F21 | A focused `<button>` disables **every** editor keyboard shortcut. `KeyboardHandler.getFocusedElement()` treats anything focusable as "a text input or similar", and Chromium focuses buttons on click — so ⌘F/⌘D/⌘R/⌘⇧X/⌘⇧E all die after you click any button | `keyboardhandler.ts:26-32, 63-66` | ✅ **FIXED 2026-07-28** (batch C — [BATCH-C-NOTES.md](./BATCH-C-NOTES.md)). The predicate was fixed rather than opting each shortcut in, and `worksWhenFocused` is **deleted** — it has no remaining meaning. A naive "buttons are fine" fix would have traded one regression for another: the editor binds bare Space (canvas pan) and bare Enter (rename), which are also how the platform presses a focused button — hence an `activatable` tier. **Writing the test found a second bug in the same function:** `getFocusedElement` opened with `if (!document.hasFocus()) return null`, and `hasFocus()` is *false* in the spec runner, so the guard was inert there — and in any unfocused window, typing in a text field **would** fire canvas shortcuts, the exact inverse of F21. An after-state-only run would have been green and shipped it |
| F22 | The Components panel's header is clipped by the window title bar — it rolls its own header and does not reserve the title-bar height. Present in the PNL-001 "before" corpus, so it predates the phase | `componentspanel` | PNL-005 / PNL-006 |
| F4 | `click` fires on the common ancestor of mousedown/mouseup, so a drag out of the panel reads as an outside click in all three dismissal pairs | `popuplayer.ts:320-341` | PNL-002 — ✅ **confirmed** (`mousedown → INPUT`, `mouseup → CANVAS`, `click → FrameDivider .Root`) and fixed |
| F23 | **The felt symptom had a different cause.** The canvas cleared the node selection on *any* left `mouseup` over it, so a drag begun in a panel field rebuilt the property panel and destroyed the focused field. This, not the popup layer, is "it kicks me out" | `InteractionController.ts` | PNL-002 — ✅ found by repro and fixed |
| F24 | `MenuDialog`/`BaseDialog` render through a portal into `.dialog-layer-portal-target`, so a popout's visible menu is **not** a DOM descendant of `popoutsEl` — the popup layer's inside/outside test was blind to it. Latent before; a hard regression once dismissal moved to `pointerup` | `popuplayer.ts`, `ShowContextMenuInPopup.tsx` | PNL-002 — ✅ fixed |
| F25 | `BaseDialog .Root` is a full-viewport catcher carrying `onClick={onClose}` — the same common-ancestor bug, in React: press inside a menu, release outside, and the click lands on `.Root` having bypassed the inner `stopPropagation` | `BaseDialog.tsx` | PNL-002 — ✅ fixed (the spec's "extend it there and say so" case) |
| F5 | `min-width: 380px` on the rail+panel root silently overrides the divider's `sizeMin={200}` | `SideNavigation.module.scss:9` | PNL-003 — ✅ removed; 240px floor now reachable |
| F6 | Dead `'topology'` references drive an expansion path for a panel whose registration is commented out | `SidePanel.tsx:122`, `EditorPage.tsx:85`, `router.setup.ts:92-100` | PNL-003 — ✅ live references and `SideNavigation.isExpanded` deleted; the commented registration is DEBT-010's |
| F7 | 14 live panels don't use `BasePanel`; each rolls its own header | `views/panels/**` | PNL-005 |
| F8 | `PanelHeader` renders a `.Title` div that has **no CSS rule**, so title size is undefined and every panel picks its own | `PanelHeader.tsx:23` + `.module.scss` | PNL-005 |
| F9 | No `container-type` anywhere in the editor or core-ui; panel content cannot adapt to panel width | codebase-wide | PNL-004 |
| F10 | Local backend `.Actions` has no `flex-wrap`; the row overflows once the backend is running | `LocalBackendCard.module.scss:72` | PNL-004 |
| F11 | The endpoint URL row has no `min-width: 0`, so it pushes its card wider than the panel | `LocalBackendCard.tsx` | PNL-004 |
| F12 | Selected tree row sets both an azure tint **and** azure label text — the least readable row in the tree on light | `ComponentsPanel.module.scss:91-94` | PNL-006 |
| F13 | The node label is a permanently-rendered `TextInput` with `isDisabled={!isEditingLabel}` | `NodeLabel.tsx:171-184` | PNL-007 — ✅ fixed |
| F26 | `Tooltip` wraps its child in a trigger `div`, which is the element a flex row actually lays out — without `min-width: 0` on it, ellipsis on the child never engages. Cost the node label its ellipsis until `UNSAFE_triggerClassName` was used | `Tooltip.tsx` (consumers) | PNL-007 found it; worth knowing for PNL-004/005 |
| F14 | Three rail destinations for settings; `IconName.Setting` renders as a sun | `router.setup.ts:211-280` | PNL-008 |
| F15 | Two panels both own the app title, writing through different models (`updateAppConfig` vs `ProjectSettingsModel`) | `AppSetupPanel.tsx`, `ProjectSettingsPanel.tsx` | PNL-008 — resolve **before** UI work |
| F16 | `switch('cloud-functions')` in two places targets an id unregistered since WF-007; `switch()` silently no-ops on unknown ids | `NodeGraphContext.tsx:120`, `sidebarmodel.tsx:337` | PNL-008 (housekeeping) |
| F17 | Six `createPortal` + `position: fixed` full-screen overlays in one file, with a hardcoded `rgba(0,0,0,.85)` scrim that predates the light theme | `LocalBackendCard.tsx:268-340` | PNL-009 — **still open**; there are **seven**, not six. The full mode they should move onto now exists |
| F27 | The mode buttons live in `PanelHeader`'s slot, so only `BasePanel` panels can be detached at all — 15 panels have no header. And the property editor can never reach full mode (no header, and full covers the canvas you'd select a node on) | `SidePanel.tsx`, `views/panels/**` | PNL-005 unblocks it |
| F28 | Every mounted panel renders its own copy of the mode buttons, so their `data-test` ids are not unique. Anything scripted has to filter on a non-zero bounding box | `SidePanel.tsx` | PNL-005 / test hygiene |
| ~~F18~~ | ~~Two search panel implementations in the tree; only `search-panel/search-panel` is registered~~ **WRONG — do not act on this.** Both are live and neither is a duplicate. `search-panel/search-panel` is the editor's project search; `search/SearchPanel.tsx` is BAK-008's **backend full-text search**, imported at `LocalBackendCard.tsx:25` and one of the seven portal surfaces. Verified twice, 2026-07-27 | `views/panels/search/`, `views/panels/search-panel/` | ~~DEBT-010 to delete~~ — **DEBT-010 must not delete it** |
| F29 | Band boundaries stated as panel widths are wrong by 34px: a container size query resolves against the *content box*, and `panel-body` sits inside the panel's 16px inset and 1px border. Stating 340/560 verbatim put the boundaries at a ~374px and ~594px panel, so a 560px panel got the default band instead of wide | `PanelRow/panel-bands.scss` | PNL-004 — ✅ offset now carried in one place, with the arithmetic written out |
| F30 | **Three of four reported overflow failures were the gate, not the code.** An always-mounted legacy tooltip (`reactcomponents/tooltip.tsx`, `position: absolute`, inline `nowrap`) lives inside an `opacity: 0` wrapper — and opacity does not inherit, so an exemption checking the element's own opacity saw 1. An invisible child still inflates its parent's `scrollWidth`, so a "clipped container" must prove a *visible* descendant reaches past its content edge. Editable inputs scrolling their own value are also not defects | `corpus/panel-geometry.mjs` | PNL-004 — ✅ `checkVisibility({opacityProperty:true})`, a form-control bucket, and `data-allow-x-scroll` |
| F31 | The spec's 14-panel migration list was wrong in five places: `auth`/`email` are portal overlays not sidebar panels, `MigrationNotesPanel` has zero importers, `GraphDiffPanel` is not a panel at all, and `componentports` ("Ports") was **missing** while wearing a fifteenth header | `views/panels/**` | PNL-005 — ✅ 7 migrated, list corrected |
| F32 | Two panels had a chrome-less **state**, not missing chrome: `VersionControlPanel` returned `null` while `git === null` (and the promise clearing it has no `.catch()`, so a rejection blanks it forever), and `componentports` rendered its header inside `Frame`'s own React root — which also meant `PanelModeSlotContext` could never reach it, so Ports could never show widen/hide/float/full | `VersionControlPanel.tsx`, `componentports.tsx` | PNL-005 — ✅ both fixed; the missing `.catch()` filed, not adopted |
| F33 | **A rail walk that looks complete isn't.** `router.setup.ts` registers 21 panels; a default-settings rail shows 8 (two canvas-transient, ten experimental, three devMode). This is exactly how `versioncontrol`'s blank state survived a green run | `router.setup.ts` | recorded; `panel-chrome.mjs` now prints reached vs. mounted-but-unreachable and takes `--expect-panels` |
| F34 | **Version Control crashed into its error boundary on first render.** `CodeDiffDialog` gated with `isVisible={diff !== null}` but read `diff.original` in the children, which React evaluates regardless; `DiffList` renders it with `diff === null` whenever nothing is selected — its resting state. Predates the phase (last touched by DEBT-013). Found because the geometry gate started printing element text: an 877px-wide `<pre>` had been read as a unified diff and exempted as by-design, and was a stack trace | `CodeDiffDialog.tsx` | ✅ fixed `c492fc0d` |
| F35 | A gate that `process.exit()`s with an injected `<style>` still in the page **leaves the editor wedged** — a socket closing does not undo DOM. A leaked `width: 240px !important` pinned the panel and killed the divider until the app was restarted | `corpus/*.mjs` | PNL-005 — ✅ every override released in a `finally` |
| F36 | A gate can be green about the wrong thing. `panel-chrome.mjs` asserted "title is single-line and ellipsised" and happily passed a Components panel rendering **"Co…"** — two characters — which is the precise outcome the mock named as the failure the `⋯` menu exists to prevent | `corpus/panel-chrome.mjs` | PNL-005 — ✅ assertion F measures fitted characters with real `measureText`; **now green**, 36/36, on the live editor |

### Found by the closing live-QA pass, 2026-07-27

Everything above F37 was established by reading code. Everything below was found by
running the three merged-but-never-run tasks (PNL-006, PNL-008, PNL-009) against a real
editor from the primary checkout — which is the step every worktree agent was structurally
unable to take.

| # | Finding | Where | Status |
|---|---|---|---|
| F37 | **`ListItem` lets an unbreakable string escape the panel.** `.Body` already had `min-width: 0`, but that only lets the *Body* shrink — its own flex children keep `min-width: auto`, i.e. their min-content width. A 101-character changed-file path with no break opportunity (neither `_` nor `.` is one) held its full 506px and stuck up to **325px** out of the panel at the 240px floor. Invisible until F34's fix made Version Control render at all, so it arrived the moment that panel stopped crashing | `ListItem.module.scss` | ✅ fixed — `overflow-wrap: anywhere` + `> * { min-width: 0 }` |
| F38 | **`SearchInput` cannot shrink.** The `<input>` has `flex-grow: 1` and no `min-width: 0`, so it will not go below an `<input>`'s intrinsic ~20-character width plus the 40px icon gutter. At a 240px panel it overflowed its own Root by 35px and clipped the Search panel's section by 19px | `SearchInput.module.scss` | ✅ fixed — `min-width: 0` |
| F39 | **The `⋯` menu opened in the window's top-left corner, not under its button** — the one behaviour PNL-009's notes claimed the gate asserted. Two independent causes. (a) `showContextMenuInPopup` gave `MenuDialog` the popup-layer `container` as its positioning trigger, but the menu portals *out* of that container, so it measures 0×0 and PopupLayer positions it *after* `BaseDialog`'s one-shot `useLayoutEffect` has already run. (b) `overflowButtonRef.current` is null after a mode change: the same `modeSlot` element is rendered into more than one header over a panel's life, so the shared ref ends up detached. With `attachTo` empty the code silently fell back to `screen.getCursorScreenPoint()` — which under a synthesised click is wherever the human's mouse is parked, hence (1, 1) | `ShowContextMenuInPopup.tsx`, `SidePanel.tsx` | ✅ fixed — anchor to `event.currentTarget`, and pass `attachTo` through as the dialog's trigger |
| F40 | **Three instrument defects, one family: a gate green or red about the wrong thing.** `panel-geometry.mjs` measured the whole panel *slot* and filed every finding under the rail button it had just clicked — a Version Control overflow was reported three times as a Problems defect. `panel-chrome.mjs` could measure a panel that had not finished switching and pass anyway: `ai-authoring` was asserted while "Explain" was on screen, and "Explain" fits. `panel-modes.mjs` inherited the previous gate's panel state (11 of 12 checks red against a feature that works), looked for the menu in `.popup-layer-popout` when `MenuDialog` portals into the dialog layer — **F24 again, this time in the instrument** — and then read `BaseDialog`'s *measuring* copy, which sits at the origin, instead of the visible menu | `corpus/*.mjs` | ✅ all four fixed; findings now carry the panel they are in, titles are held to, state is reset in a preflight |
| F41 | **⌘B on a floating panel returns it docked.** Hiding a floating panel and showing it again drops the floating mode. The spec's acceptance 6 asks only that ⌘B *hides* it, which it does, so this is **recorded rather than fixed** — but it is now printed by `panel-modes.mjs` on every run instead of being something nobody looked at | `SidePanel` layout state | ✅ **FIXED 2026-07-28** (batch C). Was exactly as described; modes stay CSS-only per PNL-009. ⚠️ Its new `panel-modes.mjs` assertion has never executed — syntax-checked only — so F41 is fixed in the state machine and no further until someone runs the corpus from the primary checkout |
| F42 | **The phase's own gate list names a script that does not exist.** `noodl-core-ui` has no `test:ci`; its scripts are `start` and `build`. The real check is `npm run typecheck:core-ui`. Corrected in *Gates for the phase* below | this file | ✅ corrected |
| F43 | **`BaseDialog`'s position depended on its animation running.** The positioned variant is `position: absolute; top: 0; left: 0`, and every pixel of where it lands came from the `to` half of the `enter` keyframe plus `animation-fill-mode: both`. Suppress animations and **every menu in the editor** piles up in the window's top-left corner. This is what made the `⋯` anchoring check fail with **byte-identical numbers across three unrelated attempted fixes** — `panel-modes.mjs` injects `animation: none` for determinism, so the harness was suppressing the very thing doing the positioning. The identical numbers were the tell: a live measurement of a changing layout cannot repeat to the pixel | `BaseDialog.module.scss` | ✅ fixed — resting position stated as a rule; the keyframe still wins while it runs |
| F44 | **The app name does not reach `project.json` when you set it — only when something else saves.** PNL-008's L5 round trip writes the App name, polls the file for 15s and still sees the old value; it then writes the Browser tab title and the *app name* appears on disk alongside it. The lag is exactly one step, twice. The Browser tab title control persists on its own, so the two controls behave differently — which is the part that makes this look like the app rather than the instrument. **Caveat, stated rather than glossed:** the input was driven synthetically (native value setter + `input` + Enter + `blur`), so a real keystroke may commit differently. One human check settles it: rename the app, quit without touching anything else, reopen | `ProjectModel.setMetaData` / `EventDispatcher` | ✅ **FIXED 2026-07-28** (batch C) — **and the recorded cause was wrong.** Not a lag, not a debounce, not the synthetic-input instrument, not an F15 residue, and `AppSetupPanel`/`ProjectSettingsModel`-save-path no longer exist. `setMetaData` dispatches `ProjectModel.metadataChanged`; `EventDispatcher` matches on the first dot-component being *identical*, so the `Model.*` listener — the editor's only autosave — never heard it. **No save was ever armed.** It looked one step behind because `toJSON()` serialises `metadata` unconditionally, so the value rode out with whatever save something else happened to trigger. **The blast radius was never just the app name:** SEO, PWA, config variables, Styles, design tokens and the DB schema cache all persist through the same gap. ⚠️ Still owed: the real-keystroke path and quit-and-reopen against the 1s debounce |
| F45 | **A gate can leave the app unusable by *removing* a style, not just by injecting one.** `components-tree.mjs` cleared the inline `width` on the FrameDivider container to take its "wide" measurement. That width is `var(--frame-divider-…-container-1-width)`, owned by PNL-003's layout state, so deleting the declaration left nothing sizing the panel: it collapsed to 4px and **neither the rail icon nor ⌘B brought it back**, because as far as React was concerned nothing had changed. Every gate run afterwards then measured a collapsed panel. F35 said release what you inject; this is the same rule for what you remove | `corpus/components-tree.mjs` | ✅ fixed — saves and restores, and never removes what it did not set |

## Open questions

- **Is the floating mode wanted?** PNL-009 is the speculative one and says so. Poke the mock before it
  gets built; the phase is coherent without it.
- **Does wide-ness persist across a panel switch?** The mock treats it as per-session and clears it.
  PNL-003 ships that as a decision to revisit.
- **One settings destination or two?** The mock proposes one (Project | Editor tabs). Keeping Editor
  settings pinned to the bottom rail is the sanctioned fallback; PNL-008 records which shipped.
- **What is a component's "kind"?** PNL-006 wants kind-carrying glyphs, but kind isn't a first-class
  property. Ship only what's reliably derivable.

## Gates for the phase

Results are from the closing pass on 2026-07-27, run from the **primary checkout** with a
dev editor up and `Shine Phase 2` open.

| Gate | Result |
|---|---|
| `npx tsc -p packages/noodl-editor --noEmit` | ✅ clean for this work. **Caveat:** a concurrent session (AIX-011) had `PlanRun.ts` / `ProjectAuthoringView.tsx` mid-edit and contributed 4 errors of its own during the run. Confirmed unrelated — this phase's diff is two `.scss` files and two `.tsx` files, all clean |
| `node scripts/hex-color-ratchet.js` | ✅ `noodl-editor 16 / baseline 16`, holding |
| `npx lerna exec --scope noodl-editor -- npm run test:ci` | ✅ **1573 specs, 0 failures**. Earlier in this same session it was 1547/1 — *"Project import and export … Expected 8 to be 5"* — which PNL-009 had already recorded as pre-existing and reproduced with all its changes stashed. A concurrent session fixed it while this pass was running. Worth knowing that the count moved by 26 specs mid-session: on this branch the suite is a moving target, so quote the run, not a remembered number |
| `npm run typecheck:core-ui` | ⚠️ reports pre-existing `Cannot find module '@noodl-viewer-cloud/execution-history'` errors in `noodl-editor/src/main`. Untouched by this phase. (See F42 — there is no `test:ci` for this package) |
| `corpus/panel-geometry.mjs` | ✅ **9/9 vertical, 45/45 panel×width horizontal** — after F37 and F38 were fixed. It was 39/45 when first run |
| `corpus/panel-chrome.mjs` | ✅ **36/36** across both themes at wide and 240px. Assertion F is green: the Components title reads "Components", not "Co…". **This closes F36**, which PNL-005 left deliberately red |
| `corpus/panel-modes.mjs` | see PNL-009 row — the mode system's behaviours, with F39 fixed |
| `corpus/settings-consolidation.mjs` | ⚠️ **11/13**. Static S1–S4 green; live L1–L4, L6, L7 green — one rail button, one header, both tabs, all 7 Project groups, exactly one control per title field. The two failures are **F44** (app-name persistence), not side-panel defects |
| `corpus/components-tree.mjs` | ✅ **4/4 theme×width**, 58 rows at depth 4. Selected-row contrast **12.2:1 dark, 13.72:1 light** against a 4.5:1 bar — assertion A is the light-mode complaint this task existed to answer. Four honest SKIPs: the warning dot needs a project that carries a warning |

- Hex ratchet unchanged or improved for both packages (PNL-005 and PNL-009 delete legacy CSS and should
  improve it — record the numbers). **Recorded, and the expectation was wrong:** the ratchet counts
  `#hex` only, and the CSS those tasks deleted was `rgba()`. It cannot move on this work.
- Screenshots per task under `screenshots/pnl-00N/`, both themes. "Before" images must be captured at a
  **short window height** — the scroll defects don't reproduce on a tall window.

### The trap that shaped this whole phase

Every one of PNL-006, PNL-008 and PNL-009 merged with a *"Could not verify"* section, and every one gave
the same structural reason: **`npx lerna exec` resolves the package root to the main checkout**, so an
editor launched from a worktree runs someone else's code and neither a pass nor a fail means anything.
Three tasks' worth of live verification therefore piled up behind a single step that only the primary
checkout can take. When it was finally taken it found five defects — two of them (F37, F39) in shipped
behaviour that had been *described as verified*.

The lesson is not "worktrees are bad". It is that **a task whose acceptance needs a running app cannot be
closed from a worktree**, and saying so in the notes is not the same as someone running it. Budget the
primary-checkout pass as part of the task, not as a residual.

### Still not verified

- ~~**The `New record` / `Create table` modals inside a full-mode backend surface.**~~ **VERIFIED
  2026-07-28.** Driven against a running SQLite backend on 8578: Backend Services → Data → `+ New Record`
  opens "New Record in Articles" over the full-width Data Browser, dimming it. The PNL-009 regression
  risk — the modal falling *behind* the panel once it left the `z-index: 9999` portal — did **not**
  materialise: hit-testing every 18px down the modal's centre line returns a `NewRecordModal-*` element
  at every point, so nothing occludes it, and it is not clipped out of the viewport.
  ⚠️ One caveat for whoever looks next: the **screenshot** shows a horizontal seam bisecting the `views`
  input exactly at the graph canvas's top edge. It is a `Page.captureScreenshot` compositing artefact
  across the canvas layer boundary, **not** occlusion — the hit-test above is what settles it. Do not
  re-file it from the image alone.
- **PNL-006's kind glyphs and warning dot against a real project**, and PNL-008's acceptance 2/4/5 round
  trips (close-and-reopen, the experimental toggle, the settings-id migration). All need a project
  lifecycle rather than a panel walk.

  **Partly closed 2026-07-28, and it found something.** `components-tree.mjs` run against two
  independent real projects (`VerifyFix4`, `Agent Chat Example`) reports the same **2 failures** in
  both: *the "default" glyph measures **2.97:1** against its ground, below the 3:1 bar* — dark theme,
  at both wide and 240px. Project-independent, so it is the token and not the content.

  **Not fixed, deliberately, because the cause is a documented coupling rather than an oversight.**
  `.Cat-default` is `var(--theme-color-fg-muted)` and its comment says why: *"CanvasTheme's
  `categoryDefault` is `fg-muted`; so is this, so an uncategorised component looks the same in both
  places."* Changing the tree alone breaks that parity on purpose-built ground, and changing
  `CanvasTheme` is UIX-005/UIX-012 territory, not this task's. It is also a **1% miss on a decorative
  glyph** — the row is identified by its label, which passes at 13.72:1, so the glyph is redundant
  information rather than the thing carrying meaning. Three ways out, all Richard's call: lift
  `fg-muted`; give the glyph its own token and accept a deliberate tree/canvas divergence; or record
  a documented exemption and drop the assertion to match. **Do not "fix" it by editing one side.**

  Still NOT PROVEN, and honestly reported as such by the gate: **11 SKIPs** — depth-4 nesting, the
  warning dot, and label ellipsis. None of the eleven projects on this launcher has four levels of
  nesting, a component carrying a warning, or a name long enough to ellipsise at 186px. Covering
  these needs a **purpose-built fixture project**, not another walk.

  ⚠️ **`Shine Phase 2` — this phase's own reference project — no longer opens.** It points at
  `/private/tmp/.../c4026a28-.../scratchpad/demo-project`, a *previous session's scratchpad*, which
  has been cleaned up: `ENOENT … project.json`. Every earlier "run against Shine Phase 2 with 58 rows
  at depth 4" is therefore unrepeatable. The failure itself is handled **well** — a toast reads
  *"Couldn't load 'Shine Phase 2' — Its project.json is missing or unreadable"* with Show details /
  Dismiss, which is RUN-004's loud-failure work doing its job. But a reference project used by a
  phase's gates must not live in a temp directory; the fixture above should replace it.

### — the 2026-07-28 live-editor pass: F41 and F44 closed, one new defect

Run from the primary checkout, which is the only place it can be run (`lerna exec`
resolves there, so a worktree agent's "live verification" describes another tree).

**F41 — closed.** `panel-modes.mjs` executed for the first time: **13/13 clean**.
The assertion that had never run — the floating mode surviving a ⌘B hide → ⌘B show
round trip — passes (`position: fixed`, `hasDetachedBar: true`). The run also
closed four PNL-009 acceptance items that were previously recorded but unverified:
the icon rail stays hit-testable under a full-mode panel (`railHitTakesRail: true`
at 53px), focus is not trapped in a floating panel (escapes in 7 Tab presses of a
25 budget), the `⋯` popup is anchored to its button rather than the mouse, and
PNL-002's drag-out-of-popup is still not treated as an outside click.

**F44 — the synthetic-input caveat is closed, positively.** The register asked for
a rename "using the keyboard". Driven as real per-character
`Input.dispatchKeyEvent` with `text` (keydown/keypress/input per character, not an
inserted string), committed with Enter through `PropertyPanelTextInput`'s real
`inputValue !== value` gate: the new name reached `project.json` within 3s with
nothing else touched, and the divergent browser tab title was left alone. The
starting state was the hard case on purpose — `appName "My Noodl App"` vs
`htmlTitle "Noodl Viewer"`, i.e. the titles already diverged, which is what the
title-follow rule used to mask. **10/10.**

**F44's other caveat — "I did not look at the quit path" — turned out to be a real
defect, and a bigger one than F44.**

> **NEW — pending project saves are dropped on quit (1s silent data-loss window).**
> `scheduleProjectSave()` (`projectmodel.ts:1418`) is a bare
> `setTimeout(saveProject, 1000)` in the **renderer**, and it is the single arming
> point for *both* F44's metadata writes and the `Model.*` autosave — which is
> every graph edit. `app.on('before-quit')` (`main.js:745`) awaits
> `backendManager.stopAll()` and nothing else: no IPC asks the renderer to flush,
> and nothing awaits a save. So any edit followed by a quit inside the debounce is
> lost, with no error in any log.
>
> Observed, not inferred, on both paths — each time with the model confirmed to
> hold the value and the disk confirmed not to, then `app.quit()` (the app's own
> path, not a kill, which would have skipped the very handlers under test):
> - metadata rename → lost, reproduced **twice**;
> - a node label change on `/#__page__/Home` → lost (disk still `"Hello World!"`).
>
> This is **pre-existing and not caused by F44**. F44 made metadata *reach* the
> timer, so it inherits an exposure the graph path has always had. Blast radius is
> therefore everything on either path: identity, SEO, PWA, config variables,
> Styles, design tokens, the DB schema cache, backend services, cloudservices —
> plus every node, connection and component edit.
>
> A fix is not just "call `saveProject` on unload": `toDirectory` is async, so it
> needs `before-quit` to `preventDefault()`, ask the renderer to flush, await it,
> then quit — with a timeout so a failing save cannot wedge the quit. That is a
> design decision with its own hang risk, so it is filed here rather than taken
> in passing.

**✅ FIXED and live-verified 2026-07-28.** Richard took the design decision: do
both — hold the quit open *and* save on blur, because neither covers the other's
cases. Commits `b0a021b8` (the implementation, swept into a WFA-004 commit by a
concurrent session rather than landing under its own message), `6e88a614` (specs)
and `1121272a` (the backend-teardown timeout).

What shipped:

| Trigger | Covers |
|---|---|
| `before-quit` → `preventDefault()` → flush → stop backends → quit | ⌘Q, the app menu, the dock |
| window `close` → same handshake, then `destroy()` | ⌘W and the red button; the usual quit route on Windows/Linux. Stands down when `before-quit` is already draining, so ⌘Q costs one round trip |
| `blur` → flush | what no quit handler can reach — a crash, a force-kill, an OS-initiated shutdown |
| `flushPendingProjectSave()` | the renderer half: promisified, writes serialised so a flush cannot interleave with the debounced save, `savePending` tracking the edit until it is actually on disk |

**Two things the original write-up had not seen.** The old handler was `async`
and *appeared* to await `stopAll()` — but **Electron does not wait for an async
`before-quit` handler**, so that await never did anything and backends were being
torn down fire-and-forget. `preventDefault()` fixes that as a side effect. And
because holding the quit open is precisely what makes a hang fatal, `stopAll()`
had to be bounded too: it was previously un-hangable *because* it was un-awaited.

Also fixed, same family: `setSaveOnModelChange(false)` cleared the timer and
dropped the queued edit. `savePending` now survives the disable and re-arms on
re-enable.

**Live verification**, from the primary checkout, against `VerifyFix4`
(legacy format, one `project.json`, the same `/#__page__/Home` component as the
original report). Every probe edited, then read `project.json` **synchronously**
to confirm the edit was genuinely still only in memory, before doing anything:

| Path | Result |
|---|---|
| Edit → `app.quit()` 50ms later | model had it, disk did **not**; app exited in **581ms**; label **on disk** afterwards. Reopened: `labelAfterReopen: "QUITFLUSH-PROBE-1"` |
| Blur (control) — edit, no blur | not on disk at 350ms, on disk at 2500ms, i.e. the ordinary 1s debounce |
| Blur (treatment) — focus, edit, blur | **on disk at 366ms**, far inside the 1s debounce. The listener wrote it, not the timer |
| Window `close` | edit not on disk at edit time → on disk after close, and the app correctly stayed alive on macOS |
| **Hanging save** — `toDirectory` patched to never call back | app **still quit**, in **5284ms**, logging *"Timed out waiting for the renderer to flush its pending project save; quitting anyway"*. The wedge risk is bounded, not theoretical |

Gate: **1766 specs, 0 failures**, on four orders (seeds 63183, 07241, 69768,
unpinned 70078) — the four new specs touch module globals, and one seed is not
evidence for a spec that does.

⚠️ **A blur test that does not first take focus proves nothing.** The first
attempt called `win.blur()` on a window that had never had OS focus (the app was
launched headlessly while the terminal held focus), so no `blur` event fired at
all — `blurEventsFired: 0` — and the save that eventually appeared was the
debounce. `isFocused()` was `false` the whole time. Focus first, then blur, and
keep the no-blur control alongside it.

Also worth recording, a driving trap one window along from the documented one:
**`--target=dashboard` silently attaches to the "About NodeGX" window when it is
open.** `about-window/about.html` is also a `file:` page and sorts ahead of the
editor, so every query returns normally and only `webpackChunknoodl_editor` being
undefined gives it away. Match `noodl-editor/src/editor/index.html` specifically.
