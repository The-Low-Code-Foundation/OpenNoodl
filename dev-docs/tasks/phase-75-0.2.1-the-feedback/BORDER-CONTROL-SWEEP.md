# `--theme-color-border-default` on control boundaries — the sweep

_Opened 2026-08-28, session 60. Supersedes the framing FB-005 T4 handed on._

## The finding T4 filed, and why its proposed fix was the wrong one

T4 measured an unselected `TemplateCard` boundary at **1.07:1 dark / 1.15:1 light** and filed it as
*"a design-token decision, Richard's — changing the token touches every surface in the editor."*

**The measurement was right and the conclusion was backwards.** `--theme-color-border-default` is a
**divider** tone, and `colors.css` says so in two separate comment blocks:

- NAT-003's note: the three border tokens are ramp-relative literals; when the ramp lifted and they
  did not follow, `border-default` *"stopped being a hair off `bg-3` (1.01) and became a visible
  line on it (1.34), **which is the opposite of what it is for**."*
- POL-016's note: the three are *"DIVIDER tones… right for a hairline between two regions and far
  under the 3:1 WCAG 1.4.11 asks of anything that has to be identified as a control."*

🔴 **Raising the shared token would restage the NAT-003 regression across all 376 declarations**,
and **VFN-002's c3 negative control asserts `border-default` is INVISIBLE on bg-3** — it would go
red by construction. That the token "touches every surface" is precisely the argument for *not*
moving it.

## ✅ The token that was already correct

`--theme-color-border-control` (POL-016) exists in both themes for exactly this case — *"without a
ring at THIS weight it reads as a label, not a button."* Measured this session:

| ground | dark `#7d8a98` | light `#7a8691` |
|---|---|---|
| `bg-0` | 4.86:1 | 3.28:1 |
| `bg-1` | 4.17:1 | 3.72:1 |
| `bg-2` | 3.57:1 | 3.37:1 |
| `bg-3` | 3.08:1 | 3.05:1 |

Clears 3:1 on every panel step in both themes. **So the defect was never 376 declarations. It is
the subset that are CONTROL boundaries wearing a divider's token.**

## What session 60 fixed

`TemplateStep.module.scss` — three declarations, all controls:

- `.TemplateCard` — a `<button aria-pressed>`; fill `bg-3`, edge was 1.08:1 dark / 1.04:1 light on
  its own fill. ⚠️ The fill step alone is **1.156 dark / 1.085 light**, and the light figure is
  *under* NAT-001's own 1.09 perceptual bar — so on this card the edge is load-bearing, not
  decorative.
- `.TemplateFilter-pill` — inactive toggle state. Active is still `primary` + a `✓`, so raising the
  resting edge does not weaken which-one-is-on.
- `.TemplateFilter-search` — a text `<input>`.

**Deliberately left on `border-default`**: `.TemplateStep-notice` (a static region) and
`.TemplateCard-tag` (a non-interactive chip). Both are dividers and both are correct.

Pinned by `tests-unit/fb-005/template-shelf-control-borders.test.ts` — 16 rows, both themes. The
spec **resolves each selector's own border and background tokens out of the .scss**, so it measures
the card rather than the palette. Three mutants, each killed by a named row:

| mutant | killed by |
|---|---|
| revert `.TemplateCard` to `border-default` | the two 3:1 rows, dark and light (4 reds) |
| raise the shared `border-default` to a 3:1 tone | the **negative control** (1 red) |
| over-correct — sweep `.TemplateCard-tag` too | the **non-controls** row (2 reds) |

The last two are the point: this file refuses *both* the under-fix and the over-fix.

## What session 61 fixed — the node picker, read exhaustively

**Unit of work: one surface family**, as recommended below. The picker was chosen because it is
small enough to read in full rather than trust the list against.

**Six declarations across four stylesheets**, all controls:

- `NodePickerCard .Root` — a `<button>`; fill `bg-2` on the `bg-1` column. Was 1.07 dark / 1.15 light.
- `NodePickerSearchBar .Field` — the `<label>` that draws the `<input>`'s boundary. Was 1.07 / 1.15.
- `NodePickerEmpty .Action` — a `<button type="button">`; its fill is the same `bg-1` it sits on, so
  the edge is the *only* thing identifying it. Was 1.26 / 1.27.
- `NodePickerPreview .DocsButton` — a `<button>`. Was 1.26 / 1.27.
- **plus two hover states** — see the finding below.
- `.is-unavailable` (BCN-010's dashed amber card) — the `color-mix` base moved from the divider to
  the control tone: **2.52:1 in light**, i.e. a card that still inserts with no identifiable edge.
  Now 4.48 light / 5.05 dark.

All four controls now measure **3.37–4.17:1** on both sides in both themes.

**Deliberately left on `border-default`** (ten sites, asserted as such): the panel `.Root` itself, the
rail/footer/preview/library hairlines, `.GroupRule`, and the two **keycap chips** `.Kbd` and
`.Enter` — hints, not things a reader operates.

Pinned by `tests-unit/border-sweep/node-picker-control-borders.test.ts` — 40 rows, both themes,
resolving every selector's own border, fill **and ground** out of the `.scss` files.

### 🔴 The finding: `border-strong` is a DIVIDER, so the resting-state fix alone is a REGRESSION

`--theme-color-border-default` is not the only divider tone. **`--theme-color-border-strong` is one
of the same three** (`colors.css`, NAT-003's block), measuring **1.74:1 dark / 1.53:1 light** — and
both `.Root:hover` and `.DocsButton:hover` moved their edge to it.

That is harmless while the resting edge is also a divider. **It stops being harmless the moment the
resting edge is raised to a real control tone**: the boundary then goes 3.57 → 1.74 *when a reader
points at it*. **A find-and-replace over the inventory below would have shipped exactly that**,
because the inventory lists resting declarations and says nothing about states.

Both hover rules now drop `border-color` entirely. On the card this is not a loss: the hover fill
lightens `bg-2` → `bg-1`, which lifts the *same* border to **4.17 / 3.72** on its own.

⚠️ **So the unit of work is a rule, not a declaration** — every state a control has (`:hover`,
`:focus`, `.is-*`) is part of the same claim.

### ⚠️ A threshold is a property of the GROUND, not of the token

The shelf spec's negative control asserts `border-default` < **1.2**; this file's asserts < **1.4**,
and both are right. The shelf measures against `bg-2`; the picker panel is `bg-1`, where `colors.css`
documents the divider at **1.254 by design**. Copying the other file's bound read the correct value
as a defect. **Re-derive the bound per surface.**

### Mutants — six, each killed by a named row

| mutant | killed by |
|---|---|
| revert `.Root` to `border-default` | its own fill/ground rows (6 reds) |
| **restore `:hover`'s `border-strong`** | **the hover row ONLY (2 reds)** — nothing else sees it |
| raise the shared `border-default` in `colors.css` | the negative control (1 red) |
| over-correct — sweep the `.Enter` keycap too | the non-controls row (1 red) |
| revert `.Field` (the site the inventory missed) | its own rows (4 reds) |
| revert the `.is-unavailable` mix base | the unavailable row, **in light only** (1 red) |

The last is worth noting: it reddens in **light and not dark**, which is what the 2.52 / 3.19 split
predicts. A row that fails in exactly one theme is measuring the surface, not the string.

### 🔴 Third independent proof that 60 is a FLOOR

The inventory listed **three** picker sites (`.Root`, `.Action`, `.DocsButton`). **Nine stylesheets
in that tree name `border-default`, and one of the misses — `.Field` — was a real defect**: a text
input never sets `cursor: pointer`, so the query cannot see it. This is the same shape as
`.TemplateFilter-search`. **Read the family; do not work the list.**

## ⬜ What is left — 60 sites, and that number is a FLOOR

🔴 **The inventory is bounded by its own query and reports that bound.** It selects blocks
containing both `border-default` and `cursor: pointer` — so it **misses native `<input>`,
`<select>` and `<button>` that never set a cursor**. `.TemplateFilter-search` is proof: it is a
control, it was part of this defect, and **this query did not find it**. It was found by reading the
file. So treat 60 as a lower bound, and read each file rather than trusting the list.

⚠️ **Membership is a judgement, not a grep.** `.Matrix`, `.OpSummary` and `.TriggerInfoCopy` are on
the list because they set a cursor, but they may well be regions rather than controls. **The test is
whether a reader must identify the thing as an interactive component** (1.4.11), not whether it is
clickable.

The 60, by package:

- **`noodl-core-ui`** (13): `.Button` (CodeHistoryButton), `.CancelButton` (CodeHistoryDiffModal),
  `.PreviewButton` (CodeHistoryDropdown), `.SaveButton` / `.CloseButton` (JavaScriptEditor),
  `.DismissButton` (SuggestionBanner), `.VariantSelector-trigger`, `.TokenPicker-trigger`,
  `.Card` (LauncherProjectCard), `.Select` (LauncherSearchBar),
  `.DeleteConfirmationCancelButton` (FolderTree), `.Option` / `.Ghost` (LearnerPathSection),
  `.FolderPickerItem` (Projects)
- **Canvas / bench** (11): `.Action` / `.Empty` / `.PickerChip` (BenchScenarioBar), `.Clear`
  (BenchOutputsRail), `.ResetAll` / `.SignalButton` (BenchInputsRail), `.FrameChip` /
  `.FrameDefault` / `.ScopeChip` (PreviewChrome), `.AiPill` (CanvasHud), `.TrailChip`
- **Canvas tabs & overlays** (6): `.Tab` / `.WindowButton` / `.WindowCloseButton` (CanvasTabs),
  `.badge` (ExecutionNodeBadge), `.closeButton` (ExecutionOverlay), `.navButton` (ExecutionTimeline)
- ~~**Node picker** (3)~~ — ✅ **DONE, session 61**, and it was 6 declarations rather than 3
- **Version control / GitHub** (6): `.LoadMoreButton` ×2, `.IssueItem`, `.PRItem`,
  `.SecondaryButton`, `.RepoItem`
- **Panels** (18): `.HeaderAction` / `.TriggerButton` (ComponentsPanel), `.PageButton`
  (DataBrowser), `.PresetCard` (AddBackendDialog), `.Endpoint` (LocalBackendCard), `.Matrix` /
  `.OpSummary` (Permissions ⚠️), `.TypeSelect` (CreateTableModal), `.Select` (AddColumnForm),
  `.Button` (ListValueEditor), `.FilterBuilderButton`, `.TriggerInfoCopy` (⚠️), `.NativeSelect` /
  `.ColourSwatch` (Settings), `.Run` (BuildThread), `.TopologyMapPanel__backButton`,
  `.TopologyMapView__button`, `.Shelf` (MyBlocksSaveDialog)

### 🔴 The hover trap is laid across MOST of what is left — check it per site

`border-color: var(--theme-color-border-{strong,hover,highlight})` (all three resolve to the same
divider tone) appears in a hover/focus rule in **20 stylesheets**. **At least 17 of the sites still
on the list below are in them**:

- `.Button` (CodeHistoryButton), `.CancelButton` (CodeHistoryDiffModal), `.Card` (LauncherProjectCard)
- `.Action` / `.Empty` / `.PickerChip` (BenchScenarioBar), `.ResetAll` / `.SignalButton`
  (BenchInputsRail), `.AiPill` (CanvasHud)
- `.LoadMoreButton` ×2 (IssuesList, PRsList), `.IssueItem`, `.PRItem`, `.SecondaryButton`
  (ConnectToGitHub)
- `.PresetCard` (AddBackendDialog), `.Endpoint` (LocalBackendCard), `.FilterBuilderButton`
  (ByobFilterBuilder), `.Shelf` (MyBlocksSaveDialog)

⚠️ **None of these is a defect today.** While the resting edge is also a divider, hover moving
1.26 → 1.74 is an *improvement*. It becomes a regression **only when the resting edge is raised and
the hover is left behind** — which is exactly what working from the inventory would do. So for every
site: read the whole rule, and fix the states with it.

✅ **Session 60's shelf work is clean on this** — `.TemplateCard:hover` and `.TemplateFilter-pill:hover`
both use `--theme-color-primary` (5.60 dark / 4.57 light), *stronger* than the resting control tone,
and `.TemplateFilter-search` has no hover. Checked, not assumed.

### How to do the rest

Not as one sweep. Each site needs its **own ground read out of its own stylesheet** — several of
these sit on `bg-0` or `bg-page`, where the ratios differ — and the `.TemplateCard` row shows the
edge can be load-bearing or not depending on whether the fill step carries the object on its own.
🔴 **A blanket find-and-replace would be the over-fix the third mutant exists to catch**, applied at
scale and undriven.

**Recommended unit of work: one panel or surface family at a time**, extending the same spec
pattern — read the selector's tokens from disk, assert 3:1 on both sides, and keep a negative
control that the shared divider token has not moved.
