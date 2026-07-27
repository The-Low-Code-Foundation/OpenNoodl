# Phase 25 — Side Panel (Track J): Progress

**Status:** 🚧 In progress — 6 / 9 complete + 1 partial — **Tiers 1 and 2 complete**. The 2026-07-27
decision to stop after Tier 1 was reversed the same day; PNL-004 and PNL-005 ran as parallel worktree
agents and merged, each after a live-QA fix-up round. PNL-006, PNL-008 and the PNL-009 remainder are
in flight.
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
| F36 | A gate can be green about the wrong thing. `panel-chrome.mjs` asserted "title is single-line and ellipsised" and happily passed a Components panel rendering **"Co…"** — two characters — which is the precise outcome the mock named as the failure the `⋯` menu exists to prevent | `corpus/panel-chrome.mjs` | PNL-005 — ✅ assertion F measures fitted characters with real `measureText` and is **red until PNL-009 ships the menu** |

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

- Editor `tsc` clean; `npm run test:ci` green for `noodl-editor` and `noodl-core-ui`.
- Hex ratchet unchanged or improved for both packages (PNL-005 and PNL-009 delete legacy CSS and should
  improve it — record the numbers).
- The CDP panel-geometry gate introduced by PNL-001 and extended by PNL-004: at a short window height and
  at five panel widths, no panel has unreachable content and nothing overflows horizontally.
- Screenshots per task under `screenshots/pnl-00N/`, both themes. "Before" images must be captured at a
  **short window height** — the scroll defects don't reproduce on a tall window.
