# PNL-005: One Panel Chrome, Everywhere

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-005 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 2 — system |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium (14 panel migrations; the risk is the legacy `Frame`-hosted ones) |
| **Estimated Time** | ~1 week |
| **Prerequisites** | PNL-001 (box model); PNL-003 for the mode-group contents |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — every panel header in the prototype; the Components before/after pair shows the header being replaced |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Give every side panel the same header — one component, one height, one title style, one action slot —
so the panel column reads as one surface instead of fourteen.

## Background

Reported as *"the component panel is still a bit messy"* and, in the screenshots, visible as: the
Components panel wears a 36px `--theme-color-bg-3` bar with a 12px title, while Search, Problems and
Editor Settings show a much larger title on the panel background. They are different components.

Two causes:

1. **14 live panels don't use `BasePanel` at all** and each render their own header markup:
   `ComponentsPanelReact`, `ComponentXRayPanel`, `ExecutionHistoryPanel`, `GitHubPanel`,
   `GraphDiffPanel`, `MigrationNotesPanel`, `TriggerChainDebuggerPanel`, `auth/AuthPanel`,
   `email/EmailPanel`, `permissions/PermissionsPanel`, `propertyeditor`, `schemamanager/SchemaPanel`,
   `triggers/TriggersPanel`, plus the `componentspanel` wrapper. (`DataLineagePanel` and
   `TopologyMapPanel` are also on the list but are registered-out; leave them for DEBT-010. So is
   `search/SearchPanel.tsx`, which is a dead duplicate — the *registered* search panel is
   `search-panel/search-panel.tsx` and it already uses `BasePanel`.)
2. **`PanelHeader` never styles its own title.** `PanelHeader.tsx:23` renders
   `<div className={css['Title']}><Label size={LabelSize.Big}>` — but there is **no `.Title` rule** in
   `PanelHeader.module.scss`. The title's size is whatever `LabelSize.Big` happens to be, and panels
   that roll their own header pick something else. That is why no two agree.

Some of that list are not really sidebar panels: `SchemaPanel`, `PermissionsPanel`, `DataBrowser` and
`TriggersPanel` are rendered as full-screen overlays through `createPortal` from inside
`LocalBackendCard` (`LocalBackendCard.module.scss:77`, `.SchemaPanelOverlay`, `position: fixed`).
**Do not force those into the sidebar header.** They need a header, but theirs is a full-screen
header with a close affordance — PNL-009 makes that a real panel mode. Give them a shared full-screen
header here or leave them alone and say which; do not half-migrate them.

## Current State

`PanelHeader` is 36px (`flex: 0 0 36px`), `padding: 0 16px`, with a `bg-1` bottom border and a
`children` slot on the right. `BasePanel` renders it when `title` is set. That is a reasonable
foundation — it needs a title rule, a taller bar, and a place to put the mode controls.

`CollapsableSection`'s header is a *different* 36px bar (`padding: 0 10px 0 16px`, `bg-3` in the panel
variant). Section headers and panel headers looking similar is part of why the column reads as
undifferentiated; the panel header should be visibly the parent.

## Desired State

Per the mock:

- **44px bar**, panel background (`bg-2`), hairline bottom border.
- **Title**: 13px / weight 650 / `fg-1`, single line, ellipsised — with a real `.Title` rule in
  `PanelHeader.module.scss` so it is defined in one place. Pick the token-based type ramp entry rather
  than a literal if one fits.
- **Action slot** (existing `children`): panel-specific controls, as 27px icon buttons — the sheet
  selector and New for Components, Add for Backend Services, re-check for Problems.
- **Mode group**: a separate right-hand group, divided by a hairline, holding PNL-003's widen and hide
  controls (and PNL-009's float/full when they land). Under 360px of panel width it keeps only widen
  and hide and moves the rest into `⋯` — this is a container query on the panel frame, delivered by
  PNL-004; if PNL-004 hasn't landed, add the container here and let PNL-004 absorb it.
- **Section headers get visually subordinate** to the panel header, so the hierarchy reads.

Every one of the 14 panels above moves onto `BasePanel` + `PanelHeader`, keeping its own content
untouched. Where a panel currently has a header control, it becomes an action-slot button.

### Watch for these during migration

- **`propertyeditor`** hosts legacy imperative views through `Frame` and has its own header bar
  (`property-header-bar`, `property-panel-header-edit-bar` — see PNL-007, which owns the label inside
  it). Coordinate: PNL-007 changes the *contents* of that header, PNL-005 changes the *bar* around it.
  Whichever lands second must not revert the other.
- **`ProjectSettingsPanel`** renders a legacy `Ports` view via `Frame` inside a `BasePanel` — it is
  already on `BasePanel`, so it is a good check that the taller header doesn't break `Frame`'s sizing
  assumptions.
- **Two search implementations.** `router.setup.ts` imports `search-panel/search-panel` (already on
  `BasePanel`); `search/SearchPanel.tsx` + its module.scss are an unreferenced duplicate. Confirm it has
  no importer and note it for DEBT-010 — do not migrate a dead panel, and do not delete it here either.

## Scope

### In scope
- `PanelHeader` (title rule, 44px, mode-group slot) and `BasePanel` (pass it through).
- The 14 live panel migrations, minus the full-screen overlays if you choose to defer them.
- Section-header subordination in `CollapsableSection`.
- Deleting the per-panel header CSS that becomes dead.

### Out of scope
- The components **tree** below the header — PNL-006.
- The node label inside the property header — PNL-007.
- Panel content, in every case. This task is the bar and nothing under it.
- The registered-out dead panels (`DataLineagePanel`, `TopologyMapPanel`) — DEBT-010.

## Acceptance

Live-verified via the `run-editor` skill, both themes:

1. Click through **every** registered panel. Each has a 44px header, the same title treatment, and its
   controls in the action slot. No panel is missing a header; none has two.
2. The Components panel's `bg-3` bar is gone and its sheet selector works from the action slot.
3. At 240px panel width, every title ellipsises rather than wrapping or pushing controls out; the mode
   group is down to widen + hide + `⋯`.
4. Section headers inside a panel are visibly subordinate to the panel header in both themes.
5. Screenshots of every panel, both themes, committed under `screenshots/pnl-005/` — this is the
   evidence for "one chrome", and a written claim isn't.
6. Panels hosting legacy `Frame` views (`propertyeditor`, `ProjectSettingsPanel`) render at the right
   height with no clipped or overlapping content.

Gates: editor `tsc` clean; `npm run test:ci` green for both packages; hex ratchet unchanged (deleting
legacy header CSS should *improve* it — record the numbers); no orphaned `.module.scss` files left behind.

## Notes for the executor

- Migrate one panel end-to-end first, get it reviewed against the mock, then do the rest. Fourteen
  half-migrated panels is a worse state than today's fourteen inconsistent ones.
- Several of these panels have no tests and no screenshots. Capture "before" images for all fourteen
  before you touch anything.
- HMR keeps stale panel components mounted; hard-reload between migrations.
- Commit in batches with a pathspec limited to your files — not one commit for fourteen panels, and not
  fourteen commits either. Group by area.
