# PNL-004: Container-Query Panel Layout + Shared `PanelRow`

## Metadata

| Field | Value |
|-------|-------|
| **ID** | PNL-004 |
| **Phase** | Phase 25 — Side Panel (Track J) |
| **Tier** | 2 — system |
| **Priority** | 🟠 High (PNL-003 makes the width move; this is what makes moving it safe) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | ~1 week |
| **Prerequisites** | PNL-001 (box model). Pairs with PNL-003 — either order, but both should land before PNL-006/008 restyle anything. |
| **Mock** | [`mocks/nodegx-side-panel-mock.html`](./mocks/nodegx-side-panel-mock.html) — "One panel, any width" (the 268 / 380 / 600px triptych) and the backend-actions before/after |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Make panel content adapt to the width the panel actually has, by introducing one container-query
layout system and one shared row component that every panel uses instead of hand-rolled grids.

## Background

The panel is a narrow column whose width varies — and after PNL-003, varies deliberately and often.
Nothing in it adapts. Two visible consequences, both reported:

1. **The local backend action row overflows horizontally.**
   [`LocalBackendCard.module.scss:72`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/LocalBackendCard.module.scss#L72)
   is `.Actions { padding-top: 8px; border-top: … }` with no `flex-wrap`. Stopped, the five buttons
   (Start / Data / Schema / Permissions / Export) fit. Running, "Start" becomes "Stop" and the row
   scrolls sideways out of the panel.
2. **Fixed label columns wrap at narrow widths.** In Editor Settings, "API Key (saved)" and "Endpoint
   (optional)" wrap to two lines beside a field that has room to spare, because the label column is a
   fixed width regardless of how much space there is.

The reason nothing adapts is that a media query is the wrong tool — the panel is a fraction of the
window, so window width tells you nothing about panel width. **No panel in the codebase declares a
container query.** Container queries are the right tool and are fully supported in the Electron
version this ships on.

## Current State

- No `container-type` anywhere in `noodl-core-ui` or `noodl-editor` (grep to confirm before starting;
  if another session has added one, build on it).
- Label/control rows are hand-rolled per panel. The property panel's 62px grid (UIX-004), the settings
  sections' rows, and the backend panel's rows are three different implementations of one idea.
- `Section` / `CollapsableSection` provide the section shell but nothing below it.
- Cards (`LocalBackendCard`, backend cards, problem rows) size themselves for one assumed width.

## Desired State

### 1. Panels are containers

`container-type: inline-size` on the panel body (in `BasePanel`), and on the panel frame so the
*header* can adapt too — the mock needs both: under 360px the header keeps only widen and hide, and
moves Float/Full into an overflow menu rather than truncating the panel title to "Compo…".

Three bands, named once and used everywhere:

| Band | Width | Layout |
|---|---|---|
| compact | < 340px | Label above control; controls full-width; buttons wrap and fill; secondary actions collapse into `⋯` |
| default | 340–559px | 104px label column, control beside it |
| wide | ≥ 560px | 132px label column, help text inline, card grids two-up |

The exact numbers come from the mock and are a starting point. If a real panel's content wants a
different boundary, move the boundary and record why — but move it in **one place**, not per panel.

### 2. One `PanelRow`

A new core-ui component — `components/sidebar/PanelRow` — taking a label, a control slot, optional
help text and optional `fx`/binding affordance, and implementing the three bands. Every panel row in
the sidebar goes through it.

This is the one new abstraction the phase adds. Get its API right before migrating anything, because
PNL-006 and PNL-008 will both consume it. In particular: it must handle a label that is genuinely
long (the settings panels have several), a control that is a button row rather than a single input,
and the case where the label is visually hidden but present for screen readers.

### 3. Rows and cards that cannot overflow

The rule that fixes the backend row is `flex-wrap: wrap` plus `flex: 1 1 <basis>` and `min-width: 0`
on the flex children — it reflows at any width with no query at all. Apply the same discipline to
every horizontal group in a panel: an action row, a URL row (the endpoint URL currently has no
`min-width: 0`, so it pushes its card wider than the panel), a chip row.

Cards get `container-type: inline-size` themselves, so a card in a 268px docked panel and the same
card in a 600px floating one both lay out correctly.

### 4. Primary action gets its own row

In the mock's backend card, Start/Stop is full-width and the three inspection actions share a wrapping
row, with Export and Delete moving into `⋯`. That is a content decision as much as a layout one:
destructive actions belong behind the menu. Apply the same reading to other multi-action cards.

## Scope

### In scope
- `BasePanel` — declare the containers.
- New `PanelRow` in core-ui, with stories.
- Migrate the worst offenders, and only these, in this task:
  - `LocalBackendCard` (the reported overflow) and the rest of `BackendServicesPanel`.
  - `EditorSettingsPanel` + `AiSettings/AiSettingsSection` (the reported wrapping labels).
  - `AppSetupPanel/sections/*` and `ProjectSettingsPanel/sections/*`.
- A horizontal-overflow gate (below).

### Out of scope
- Panels not yet on `BasePanel` (15 of them) — PNL-005 migrates them, and they pick up the containers
  for free when it does.
- The legacy property-editor `DataTypes/*` views, which render through the imperative `Ports` view.
  They are phase-9 (STYLE-004) territory. **Note which of them break at 240px** for that task.
- The components tree — PNL-006 owns its own layout.
- Redesigning any card. This task changes how cards *reflow*, not what they contain, except for the
  primary-action/overflow-menu split above.

## Acceptance

Live-verified via the `run-editor` skill, at panel widths **240px, 300px, 380px, 560px and 760px**,
both themes:

1. **The reported case**: start the local SQLite backend with the panel at 300px. The action row wraps;
   nothing scrolls sideways; the endpoint URL ellipsises instead of widening the card.
2. Editor Settings at 300px: AI provider, model, API key and endpoint rows are stacked label-above-control
   and every field is fully usable. At 560px they are two-column with the help text inline.
3. Every migrated panel at 240px: **no horizontal scrollbar and no clipped control**.
4. Every migrated panel at 760px: no row stretched absurdly wide; card grids go two-up where the mock says.
5. Drag the divider slowly from 240px to 760px with each migrated panel open; the transitions between
   bands don't produce a broken intermediate state.

**Automated gate**: extend the PNL-001 CDP script to assert, for every registered panel at each of the
five widths, that no element inside the panel has `scrollWidth > clientWidth + 1`. This is cheap and it
is the only way this stays fixed as panels get added.

Gates: editor `tsc` clean; `npm run test:ci` for `noodl-core-ui` and `noodl-editor` green; hex ratchet
unchanged; `PanelRow` has stories in the core-ui storybook alongside the other sidebar components.

## Notes for the executor

- **Build `PanelRow` first and review its API before migrating anything.** Two later tasks depend on
  it; a bad API costs more than the migration.
- Do not introduce a second row component. If a panel's rows genuinely don't fit `PanelRow`, that is
  information about `PanelRow` — widen it or say clearly why that panel is exempt.
- The `flex-wrap` + `min-width: 0` fix needs no container query. Prefer it. Container queries are for
  layout *changes*, not for making things not overflow — reaching for a query where `min-width: 0`
  would do is how this becomes unmaintainable.
- Capture "before" screenshots at 240px and 300px before you start; PNL-004's value is invisible in
  an after-only screenshot.
- Commit with a pathspec limited to your files.
