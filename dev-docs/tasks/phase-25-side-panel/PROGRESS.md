# Phase 25 — Side Panel (Track J): Progress

**Status:** 🚧 In progress — 1 / 9 (Tier 1: 1 / 3)
**Specced:** 2026-07-27
**Mock:** [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) (`93cc4da`)
**Phase overview:** [README.md](./README.md)

## Task status

| ID | Title | Tier | Status | Landed | Notes |
|---|---|---|---|---|---|
| [PNL-001](./PNL-001-PANEL-SCROLL-CORRECTNESS.md) | Panel scroll & box-model correctness | 1 | ✅ Complete | 2026-07-27 | [NOTES](./PNL-001-NOTES.md). Both defects reproduced with numbers, then fixed. Global `box-sizing` reset **evaluated and rejected** — it shrinks every TextInput by 18px. Gate: `corpus/panel-geometry.mjs`, 11/11 clean at 620/720/1200px. |
| [PNL-002](./PNL-002-OUTSIDE-CLICK-GESTURE.md) | Outside-click vs. drag in the popup layer | 1 | ⬜ Not started | — | |
| [PNL-003](./PNL-003-PANEL-WIDTH-BEHAVIOUR.md) | Panel width: reset, memory, snap & collapse | 1 | ⬜ Not started | — | |
| [PNL-004](./PNL-004-CONTAINER-QUERY-LAYOUT.md) | Container-query layout + `PanelRow` | 2 | ⬜ Not started | — | |
| [PNL-005](./PNL-005-ONE-PANEL-CHROME.md) | One panel chrome, everywhere | 2 | ⬜ Not started | — | 14 panels to migrate |
| [PNL-006](./PNL-006-COMPONENTS-PANEL-RESTYLE.md) | Components panel restyle | 3 | ⬜ Not started | — | |
| [PNL-007](./PNL-007-INLINE-RENAME.md) | Node label & inline rename | 3 | ⬜ Not started | — | |
| [PNL-008](./PNL-008-SETTINGS-CONSOLIDATION.md) | Three settings panels become one | 3 | ⬜ Not started | — | |
| [PNL-009](./PNL-009-FLOAT-AND-FULL-MODES.md) | Floating & full panel modes | 4 | ⬜ Not started | — | Validate the need first |

## Findings register

Everything below was established by reading the code during the 2026-07-27 critique, with the file and
line confirmed. Executors should re-confirm the live symptom before fixing — if a finding turns out to
be stale or to have a different cause, correct it here rather than implementing around the description.

| # | Finding | Where | Owner |
|---|---|---|---|
| F1 | Panel width resets to 380px on every `activeChanged` **and** every `window.resize`; never persisted | `EditorPage.tsx:77, 83-95` | PNL-003 |
| F2 | Scroll-area flex children lack `flex-shrink: 0` and carry `overflow: hidden`, so sections squeeze and clip instead of the container scrolling | `CollapsableSection.module.scss:1-8` | PNL-001 — ✅ **confirmed** (28px, 109px and 221px hidden on Editor Settings) and fixed |
| F3 | `BasePanel .Root` is 34px taller than its slot: `height: 100%` + 16px padding + 1px border, no global `box-sizing: border-box` | `BasePanel.module.scss:1-18` | PNL-001 — ✅ **confirmed** (exactly 34px, every `BasePanel` panel) and fixed |
| F19 | `Checkbox .Checkbox` is `position: absolute` with no positioned parent, so its containing block is `BasePanel .Inner` — checkboxes below the fold land past the panel bottom and inflate a non-scrolling ancestor | `Checkbox.module.scss` | PNL-001 — found while fixing F2/F3; fixed |
| F20 | A global `* { box-sizing: border-box }` is **not** adoptable as-is: it narrows every `TextInput` by 18px, shrinks the checkbox glyph 20→16px and the icon rail by 20px | measured, editor-wide | PNL-001 recorded the full table; unowned |
| F4 | `click` fires on the common ancestor of mousedown/mouseup, so a drag out of the panel reads as an outside click in all three dismissal pairs | `popuplayer.ts:320-341` | PNL-002 |
| F5 | `min-width: 380px` on the rail+panel root silently overrides the divider's `sizeMin={200}` | `SideNavigation.module.scss:9` | PNL-003 |
| F6 | Dead `'topology'` references drive an expansion path for a panel whose registration is commented out | `SidePanel.tsx:122`, `EditorPage.tsx:85`, `router.setup.ts:92-100` | PNL-003 |
| F7 | 14 live panels don't use `BasePanel`; each rolls its own header | `views/panels/**` | PNL-005 |
| F8 | `PanelHeader` renders a `.Title` div that has **no CSS rule**, so title size is undefined and every panel picks its own | `PanelHeader.tsx:23` + `.module.scss` | PNL-005 |
| F9 | No `container-type` anywhere in the editor or core-ui; panel content cannot adapt to panel width | codebase-wide | PNL-004 |
| F10 | Local backend `.Actions` has no `flex-wrap`; the row overflows once the backend is running | `LocalBackendCard.module.scss:72` | PNL-004 |
| F11 | The endpoint URL row has no `min-width: 0`, so it pushes its card wider than the panel | `LocalBackendCard.tsx` | PNL-004 |
| F12 | Selected tree row sets both an azure tint **and** azure label text — the least readable row in the tree on light | `ComponentsPanel.module.scss:91-94` | PNL-006 |
| F13 | The node label is a permanently-rendered `TextInput` with `isDisabled={!isEditingLabel}` | `NodeLabel.tsx:171-184` | PNL-007 |
| F14 | Three rail destinations for settings; `IconName.Setting` renders as a sun | `router.setup.ts:211-280` | PNL-008 |
| F15 | Two panels both own the app title, writing through different models (`updateAppConfig` vs `ProjectSettingsModel`) | `AppSetupPanel.tsx`, `ProjectSettingsPanel.tsx` | PNL-008 — resolve **before** UI work |
| F16 | `switch('cloud-functions')` in two places targets an id unregistered since WF-007; `switch()` silently no-ops on unknown ids | `NodeGraphContext.tsx:120`, `sidebarmodel.tsx:337` | PNL-008 (housekeeping) |
| F17 | Six `createPortal` + `position: fixed` full-screen overlays in one file, with a hardcoded `rgba(0,0,0,.85)` scrim that predates the light theme | `LocalBackendCard.tsx:268-340` | PNL-009 |
| F18 | Two search panel implementations in the tree; only `search-panel/search-panel` is registered | `views/panels/search/`, `views/panels/search-panel/` | PNL-005 to identify; DEBT-010 to delete |

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
