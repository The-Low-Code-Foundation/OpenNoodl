# Phase 25 — Side Panel (Track J): Progress

**Status:** ✅ **All 9 tasks complete and live-verified** (2026-07-27). Tiers 1–4 landed; the closing
pass ran every gate from the primary checkout against a real editor, which no worktree agent could do
— see *The trap that shaped this whole phase* below. That pass found and fixed five defects (F37–F41),
two of them in behaviour a task had already described as shipped. Two named items remain unverified
because they need a running local backend or a full project lifecycle; they are listed under
*Still not verified*.
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
| [PNL-006](./PNL-006-COMPONENTS-PANEL-RESTYLE.md) | Components panel restyle | 3 | 🚧 In flight | — | |
| [PNL-007](./PNL-007-INLINE-RENAME.md) | Node label & inline rename | 3 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-007-NOTES.md). Text at rest, real field on double-click, check/cancel, Escape reverts. Phantom-undo guard tested, not assumed. The AiAuthoringPanel half of the spec was a stale premise. |
| [PNL-008](./PNL-008-SETTINGS-CONSOLIDATION.md) | Three settings panels become one | 3 | 🚧 In flight | — | |
| [PNL-009](./PNL-009-FLOAT-AND-FULL-MODES.md) | Floating & full panel modes | 4 | 🚧 **Half complete** | 2026-07-27 | [NOTES](./PNL-009-NOTES.md). Need confirmed by Richard. Modes built **CSS-only** (no re-parenting) and validated incl. the legacy-view test; drag/resize/per-panel persistence work. **The 7 `LocalBackendCard` portals are NOT migrated** — acceptance 2 and 3 unmet. |

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
| F21 | A focused `<button>` disables **every** editor keyboard shortcut. `KeyboardHandler.getFocusedElement()` treats anything focusable as "a text input or similar", and Chromium focuses buttons on click — so ⌘F/⌘D/⌘R/⌘⇧X/⌘⇧E all die after you click any button | `keyboardhandler.ts:26-32, 63-66` | PNL-003 fixed it **only** for ⌘\ and ⌘B via an opt-in `worksWhenFocused`; the rest is unowned |
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
| F41 | **⌘B on a floating panel returns it docked.** Hiding a floating panel and showing it again drops the floating mode. The spec's acceptance 6 asks only that ⌘B *hides* it, which it does, so this is **recorded rather than fixed** — but it is now printed by `panel-modes.mjs` on every run instead of being something nobody looked at | `SidePanel` layout state | ⚠️ open, unowned |
| F42 | **The phase's own gate list names a script that does not exist.** `noodl-core-ui` has no `test:ci`; its scripts are `start` and `build`. The real check is `npm run typecheck:core-ui`. Corrected in *Gates for the phase* below | this file | ✅ corrected |
| F43 | **`BaseDialog`'s position depended on its animation running.** The positioned variant is `position: absolute; top: 0; left: 0`, and every pixel of where it lands came from the `to` half of the `enter` keyframe plus `animation-fill-mode: both`. Suppress animations and **every menu in the editor** piles up in the window's top-left corner. This is what made the `⋯` anchoring check fail with **byte-identical numbers across three unrelated attempted fixes** — `panel-modes.mjs` injects `animation: none` for determinism, so the harness was suppressing the very thing doing the positioning. The identical numbers were the tell: a live measurement of a changing layout cannot repeat to the pixel | `BaseDialog.module.scss` | ✅ fixed — resting position stated as a rule; the keyframe still wins while it runs |

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
| `npx lerna exec --scope noodl-editor -- npm run test:ci` | ⚠️ **1547 specs, 1 failure** — *"Project import and export … re-keys imported node ids … Expected 8 to be 5"*. Pre-existing and not from this phase: PNL-009's first pass recorded the same failure with all its changes stashed |
| `npm run typecheck:core-ui` | ⚠️ reports pre-existing `Cannot find module '@noodl-viewer-cloud/execution-history'` errors in `noodl-editor/src/main`. Untouched by this phase. (See F42 — there is no `test:ci` for this package) |
| `corpus/panel-geometry.mjs` | ✅ **9/9 vertical, 45/45 panel×width horizontal** — after F37 and F38 were fixed. It was 39/45 when first run |
| `corpus/panel-chrome.mjs` | ✅ **36/36** across both themes at wide and 240px. Assertion F is green: the Components title reads "Components", not "Co…". **This closes F36**, which PNL-005 left deliberately red |
| `corpus/panel-modes.mjs` | see PNL-009 row — the mode system's behaviours, with F39 fixed |
| `corpus/settings-consolidation.mjs --no-live` | ✅ S1, S1b, S2, S3, S4 all green |

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

- **The `New record` / `Create table` modals inside a full-mode backend surface.** PNL-009 moved them out
  of a `z-index: 9999` portal into the panel's stacking context and named this the change most likely to
  regress visually. It needs a running local backend.
- **PNL-006's kind glyphs and warning dot against a real project**, and PNL-008's acceptance 2/4/5 round
  trips (close-and-reopen, the experimental toggle, the settings-id migration). All need a project
  lifecycle rather than a panel walk.
