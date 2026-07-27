# Phase 25: Side Panel (Revival Track J)

**Phase:** 25
**Track:** J — the side panel: correctness, width behaviour, one chrome, per-panel restyle
**Source:** Design critique session 2026-07-27. Mock: [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) (committed `93cc4da`) — interactive: rail switching, divider drag, four panel modes, the rename interaction.
**Status:** 📋 Specced, not started — 9 tasks. See [PROGRESS.md](./PROGRESS.md).
**Starts:** Anytime. No dependency on any other open track. PNL-001 and PNL-002 are independent bug fixes and can start immediately.

## Why this phase exists

Phase 23 deliberately parked layout: *"panel arrangement, docking, and the editor's information
architecture stay as-is. The mocks deliberately reproduce today's layout."* That was the right call
for a reskin — but it means the side panel got new colours on top of unchanged mechanics, and the
mechanics are where the complaints are.

Reading the code for the critique turned up four defects that are not matters of taste:

1. **The panel width is thrown away on every panel switch and every window resize.**
   [`EditorPage.tsx:83-95`](../../../packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx#L83-L95)
   registers `updateSidebarSize` on `SidebarModelEvent.activeChanged` *and* on `window.resize`, and
   for every panel except the (long since disabled) topology panel it calls
   `setFrameDividerSize(380)`. The width is also never persisted — `useState(undefined)` with no
   load and no save. So the width you just dragged survives until you click another rail icon or
   resize the window. **This is the mechanism behind "I'm constantly expanding and shrinking the
   side panel."** It is not a missing feature; it is a reset loop.
2. **Settings panels get squeezed instead of scrolling.**
   [`CollapsableSection.module.scss`](../../../packages/noodl-core-ui/src/components/sidebar/CollapsableSection/CollapsableSection.module.scss)
   makes each section a flex child with `overflow: hidden` and no `flex-shrink: 0`. When the content
   is taller than the panel the sections compress rather than the container overflowing, so the
   scroll area never scrolls and each section clips its own text mid-sentence.
3. **Every panel is 34px taller than its slot.**
   [`BasePanel.module.scss`](../../../packages/noodl-core-ui/src/components/sidebar/BasePanel/BasePanel.module.scss)
   is `height: 100%` plus 16px padding plus a 1px border, and the editor has **no global
   `box-sizing: border-box`**. The ancestor's `overflow: hidden` eats the difference. Together with
   (2) this is the reported "cut off by a couple of dozen pixels at the bottom" — 34, on every
   screen height.
4. **A drag that leaves the panel reads as a click outside it.** `click` fires on the *common
   ancestor* of mousedown and mouseup, so drag-selecting text in a panel field and releasing over
   the canvas produces a click whose target is `<body>` — and every "clicked outside → close" rule
   in [`popuplayer.ts:320-341`](../../../packages/noodl-editor/src/editor/src/views/popuplayer.ts#L320-L341)
   treats it as an outside click.

On top of that: 14 live panels don't use `BasePanel` at all and each roll their own header,
`PanelHeader.module.scss` never styles its own `.Title` (which is why no two panels agree on title
size), no panel declares a container query so nothing adapts to the width it's actually given, and
there are three rail destinations for "settings", one of them behind a sun.

## Task Table

| Order | ID | Title | Tier | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|---|
| 1 | [PNL-001](./PNL-001-PANEL-SCROLL-CORRECTNESS.md) | Panel scroll & box-model correctness | 1 — correctness | 🔴 Critical | 1–2 days | none | 🟢 Sonnet 5 |
| 2 | [PNL-002](./PNL-002-OUTSIDE-CLICK-GESTURE.md) | Outside-click vs. drag in the popup layer | 1 — correctness | 🟠 High | 2–3 days | none | 🔵 Opus 5 |
| 3 | [PNL-003](./PNL-003-PANEL-WIDTH-BEHAVIOUR.md) | Panel width: stop the reset, remember per panel, snap & collapse | 1 — correctness | 🔴 Critical | 3–4 days | none | 🔵 Opus 5 |
| 4 | [PNL-004](./PNL-004-CONTAINER-QUERY-LAYOUT.md) | Container-query panel layout + shared `PanelRow` | 2 — system | 🟠 High | ~1 wk | PNL-001 | 🟠 Opus 4.8 |
| 5 | [PNL-005](./PNL-005-ONE-PANEL-CHROME.md) | One panel chrome, everywhere | 2 — system | 🟠 High | ~1 wk | PNL-001; PNL-003 for the mode slot | 🟠 Opus 4.8 |
| 6 | [PNL-006](./PNL-006-COMPONENTS-PANEL-RESTYLE.md) | Components panel restyle | 3 — surfaces | 🟠 High | 3–4 days | PNL-005 | 🟠 Opus 4.8 |
| 7 | [PNL-007](./PNL-007-INLINE-RENAME.md) | Node label & inline rename | 3 — surfaces | 🟡 Medium | 2 days | none | 🟢 Sonnet 5 |
| 8 | [PNL-008](./PNL-008-SETTINGS-CONSOLIDATION.md) | Three settings panels become one | 3 — surfaces | 🟡 Medium | 4–5 days | PNL-005 | 🟠 Opus 4.8 |
| 9 | [PNL-009](./PNL-009-FLOAT-AND-FULL-MODES.md) | Floating & full panel modes | 4 — expansion | 🟡 Medium | 1–1.5 wks | PNL-003, PNL-005 | 🔵 Opus 5 |

Serial worst case ~6 weeks; realistic with parallelism ~3–4. PNL-001/002/003/007 have disjoint file
territories and can all run concurrently on day one.

## Sequencing notes

- **PNL-001, PNL-002 and PNL-003 are worth doing whether or not the rest of the phase is agreed.**
  They are bug fixes with a named root cause each. Nothing downstream depends on the mode system.
- **PNL-001 first among the CSS tasks.** PNL-004 and PNL-005 both touch `BasePanel`; landing the
  box-model fix first means they aren't reasoning about a 34px lie.
- **PNL-003 before PNL-005** so the header's mode-group slot has something to hold. PNL-003 may
  render its two buttons into `PanelHeader`'s existing `children` slot and let PNL-005 formalise it —
  it must not introduce a second header component to do so.
- **PNL-004's `PanelRow` is the one new abstraction this phase adds.** Every later task consumes it.
  If it isn't landed when PNL-006/008 start, they use the existing grids and migrate after — they
  must not fork a second row component.
- **Tiers are stopping points.** Tier 1 alone fixes the four named defects and makes the panel
  usable on a 13-inch screen. Tier 2 makes new panels correct by default rather than by discipline.
  Tier 3 is the visible restyle. Tier 4 is the part most worth challenging first.
- **Reuse the phase-23 visual-QA corpus** at [`../phase-23-visual-refresh/corpus/`](../phase-23-visual-refresh/corpus/)
  rather than building a new harness. Capture "before" screenshots at phase start — specifically at
  a **short window height (≤ 760px)**, which is the condition the scroll defects need.
- **Parallel-agent hygiene:** commit to `cline-dev` with a pathspec limited to your own files; other
  sessions work in this repo concurrently. Live verification runs from the **primary checkout** —
  `lerna exec` resolves there, not to a worktree.

## Exit criterion

On a 1280×760 window, in both themes: every panel scrolls to its true last pixel with nothing
clipped; the panel width you set survives a panel switch, a window resize, a project close and a
reopen, and each panel remembers its own; one keystroke widens the panel and one hides it; no panel
overflows horizontally at 240px or looks empty at 700px; every panel wears the same header; the
component name is plain text until you choose to edit it; and there is exactly one settings
destination on the rail, behind a cog.

## What this phase deliberately parks

- **The rail itself.** 52px, fixed, always visible, same icon order. It is the only part of the
  layout that should never move, and nothing in the critique asked for it to.
- **Multi-panel layouts** — two panels side by side, or a second rail on the right. Floating (PNL-009)
  covers the "watch this while I work" case; a real dock manager is a much larger project and is
  not justified by anything reported. If PNL-009 lands and floating turns out to be what people
  actually want, revisit.
- **Detaching a panel into a separate OS window.** Floating in PNL-009 is in-window. A real second
  `BrowserWindow` means a second React root, a second theme subscription and IPC for model changes.
- **The property editor's contents.** PNL-007 fixes its header; the DataTypes/legacy `Ports` views
  inside it are phase-9 territory (STYLE-004) and stay as they are.
- **Retiring the dead panels.** `DataLineagePanel` and `TopologyMapPanel` are registered-out but
  still compile; DEBT-010 owns deleting them. This phase only removes the *dead references to them*
  that get in its way (see PNL-003).
- **The full-screen data surfaces' own design** — Data browser, Schema, Permissions. PNL-009 moves
  them onto a supported full-panel mode; it does not redesign them.

## References

- [mocks/nodegx-side-panel-mock.html](./mocks/nodegx-side-panel-mock.html) — the concept, interactive
- [Phase 23 README](../phase-23-visual-refresh/README.md) — the parked-layout note this phase picks up
- [Phase 24 mock parity](../phase-24-mock-parity/) — the pixel-parity standard this phase inherits
- `packages/noodl-core-ui/src/styles/custom-properties/` — the token vocabulary the mock uses verbatim
- [UIX-013](../phase-23-visual-refresh/UIX-013-NODE-PICKER-OVERHAUL.md) — nearest precedent for a
  "structural bug found while designing the restyle" task
