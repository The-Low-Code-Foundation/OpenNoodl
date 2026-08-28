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

## What session 62 fixed — the component bench, and the picker's remedy did NOT transfer

**Unit of work: one surface family** — `ComponentBench` and the three rails it holds
(`BenchScenarioBar`, `BenchInputsRail`, `BenchOutputsRail`), read in full rather than worked from
the list. **Seven control declarations plus two hover rules**, across three stylesheets. All three
rails sit in `ComponentBench .Rail`, so the ground is `bg-2` for every site here — read from the
file that actually paints it, not from the file the control lives in.

| control | element | was | now (dark / light) |
|---|---|---|---|
| `BenchScenarioBar .PickerChip` | `<button>` | 1.08 / 1.04 on its `bg-3` fill | **3.08 / 3.05** fill, **3.57 / 3.37** ground |
| `BenchScenarioBar .Action` | `<button>` ×4 | 1.07 / 1.15 | **3.57 / 3.37** (transparent fill ⇒ ground both sides) |
| `BenchScenarioBar .Empty` | `<button>` | 1.07 / 1.15 | **3.57 / 3.37** |
| `BenchScenarioBar .NameField` | `<input>` | **1.74 / 1.53** (`border-strong`) | **4.17 / 3.72** on its `bg-1` fill |
| `BenchInputsRail .SignalButton` | `<button>` | 1.08 / 1.04 | **3.08 / 3.05** fill |
| `BenchInputsRail .ResetAll` | `<button>` | 1.07 / 1.15 | **3.57 / 3.37** |
| `BenchOutputsRail .Clear` | `<button>` | 1.07 / 1.15 | **3.57 / 3.37** |

**Deliberately left on the divider token** (two sites, asserted as such): `ComponentBench .Frame` —
the preview box's own edge, a REGION boundary — and `BenchScenarioBar .Menu`, a popup surface.

Pinned by `tests-unit/border-sweep/bench-control-borders.test.ts` — 50 rows, both themes, eight
mutants.

### 🔴 The finding: the node picker's hover remedy does NOT generalise, because it depended on the DIRECTION the fill moved

Session 61 closed its two hover traps by **deleting `border-color` entirely**, and that was safe
there for a reason that is easy to mistake for a rule: the picker's hover fill lightens `bg-2 →
bg-1`, which *raises the very same border* to 4.17 / 3.72 on its own.

**Both hover rules here move the fill the other way — `bg-3 → bg-4` — and `border-control` measures
2.64:1 dark / 2.77:1 light on `bg-4`.** Under 3:1. So deleting `border-color`, the remedy that
worked one family ago, would have left `.PickerChip` and `.SignalButton` failing 1.4.11 **exactly
while the pointer is on them** — the same defect the sweep is closing, reintroduced by the fix for
it. Nor can the fill carry the boundary alone: **`bg-4` on `bg-2` is 1.35 / 1.22.**

Both now use `--theme-color-primary` — **3.54 / 3.40** on the hover fill, **4.80 / 4.14** on the
rail behind it — which is also what the template shelf's hovers already use.

🔴 **So the hover trap has (at least) two shapes, and which one a site has depends on its own ramp
direction.** "Drop the hover border" is not the fix; it is one of two fixes, and reading which
applies costs one measurement. ⚠️ **Nine of the ~13 remaining trap sites listed below fill DOWN the
ramp on hover** — check the fill, not just the border.

### 🔴 Fourth independent proof the inventory is a FLOOR — and this one missed on BOTH counts

The inventory listed **six** sites in this family. `BenchScenarioBar .NameField` is a seventh, and
it is invisible to that query twice over: it is a text `<input>`, so it **sets no `cursor: pointer`**,
*and* its edge named **`border-strong` rather than `border-default`**. It measured **1.74:1** on its
own fill — a real defect, on the field you type a scenario's name into. Found by reading the file,
as `.TemplateFilter-search` and `NodePickerSearchBar .Field` were.

⚠️ **The query's token half is as leaky as its cursor half.** Every count in this document is
bounded by `border-default`; `border-strong` sites are not in it at all.

### The eight mutants, each killed by a named row

| mutant | killed by |
|---|---|
| revert `.PickerChip` resting | its own fill + ground rows (4 reds) |
| **restore `.PickerChip:hover`'s `border-strong`** | **the state row ONLY (2 reds)** — `.PickerChip:hover is 1.10:1 on its own fill` / `1.49:1 on the rail` |
| **restore `.SignalButton:hover`'s `border-strong`** | **the state row ONLY (2 reds)** |
| revert `.NameField` (the site the inventory cannot see) | its own rows (4 reds) |
| revert `.Action` (transparent fill) | its rows **and** its `:hover` state row (6 reds) |
| revert `.Clear` | same shape (6 reds) |
| over-correct — sweep `.Frame`, a region | the non-controls row (1 red) |
| raise the shared `border-default` in `colors.css` | the negative control — **in this file AND the picker's** (2 reds) |

⚠️ The state row is discovered from disk: it enumerates every top-level rule whose selector extends
the control's (`:hover`, `:disabled`, `.is-primary`, `.is-hidden`) and measures any that changes the
border or the fill. **A state added later is measured without anyone remembering to add a row.**

### ⚠️ The negative control's bound is 1.2 here and 1.4 in the picker, and both are right

Session 61's finding, confirmed a second time from the other direction: the bench rail is `bg-2`,
where the divider measures 1.07 / 1.15; the picker panel is `bg-1`, where `colors.css` documents it
at 1.254 **by design**. **Re-derive the bound per surface.**

### 🧭 Out of scope, but found while reading: `.ResizeHandle` has no resting visual at all

`ComponentBench .ResizeHandle` — the frame's six resize grips — is `background-color: transparent`
until `:hover`. That is a 1.4.11 question about a control that cannot be *seen* rather than one whose
edge is too faint, and **no border token fixes it**; it is a deliberate design choice recorded in the
file ("six visible grips would make the bench look like a dialog"). Noted rather than swept, because
it needs a design answer, not a token.

## What session 63 fixed — the code-editor family, and the token that is NOT always the answer

`CodeHistoryButton`, `CodeHistoryDropdown`, `CodeHistoryDiffModal` and `JavaScriptEditor` in
**`noodl-core-ui`** — the first slice outside `noodl-editor`. Session 62 wanted to know whether a
ground can still be read from a sibling stylesheet in another package. **It can**; the difference is
that there is no single shared rail, so each control names the rule that paints *its* surface.
`JavaScriptEditor.tsx` renders `CodeHistoryButton`, `.FormatButton`, `.SaveButton` and
`.CloseButton` into the **same toolbar**, so four of the five grounds resolve to `.Toolbar`.

Five controls fixed, all measured on **both sides in both themes**:

| control | fill | ground | was | now |
|---|---|---|---|---|
| `CodeHistoryButton .Button` | `bg-2` | `.Toolbar` (`bg-2`) | 1.07 | **3.57 / 3.37** |
| `CodeHistoryDropdown .PreviewButton` | `bg-3` | `.Dropdown` (`bg-1`) | 1.08 | **3.08 / 3.05** fill, 4.17 / 3.72 ground |
| `CodeHistoryDiffModal .CancelButton` | `bg-2` | `.Modal` (`bg-1`) | 1.07 | **3.57 / 3.37** fill, 4.17 / 3.72 ground |
| `JavaScriptEditor .FormatButton` | `bg-3` | `.Toolbar` (`bg-2`) | 1.08 | **3.08 / 3.05** fill, 3.57 / 3.37 ground |
| `JavaScriptEditor .CloseButton` | `bg-4` | `.Toolbar` (`bg-2`) | 1.26 | **5.85 / 4.61** fill, 7.91 / 5.61 ground |

Two hover rules (`.Button:hover`, `.CancelButton:hover`) moved off `border-highlight` to `primary`.
Pinned by `tests-unit/border-sweep/code-editor-control-borders.test.ts` — **38 rows, ten mutants**.

⚠️ `.Button`'s fill is `bg-2` and its ground is `bg-2` — **the fill step is literally 1.00:1**, so
the border is the *only* thing that identifies it. It is the clearest case in the sweep so far of
why the resting edge is load-bearing rather than decorative.

### 🔴 The finding: `border-control` is NOT the answer everywhere, and this family proves it

POL-016's own comment scopes the token's guarantee to **"bg-1, bg-2 and bg-3"**. `.CloseButton` is
filled **`bg-4`**, where `border-control` measures **2.64:1 dark / 2.77:1 light — under 3:1**.

🔴 **Swapping the token in there would have looked exactly like the other four edits and shipped a
control that still fails 1.4.11.** The sweep's own remedy is the defect at that site. It uses
`fg-default-shy` instead (5.85 / 4.61 on the fill, 7.91 / 5.61 on the toolbar).

✅ **And the rule already contained its own answer** — `.CloseButton:hover` has used
`fg-default-shy` all along; only the *resting* state was left behind. **That is the shape of all
three fixes in this family**: both hover remedies took `primary` from `.FormatButton:hover`, which
was already correct in the same file. **Before inventing a tone for a site, read the rest of its own
rule and its neighbours** — this family needed no new decision, only consistency.

⚠️ **So the sweep now has two exclusion tests, not one.** Beyond "is it a control?" there is
**"what step is it filled on?"** — any control on `bg-4` or `bg-5` (`border-control` is **2.41 /
2.54** on `bg-5`) is outside the token's guarantee and needs a different tone.

### 🔴 The inventory is wrong in BOTH directions — the first FALSE POSITIVE

The list has `.SaveButton` and not `.FormatButton`. They **share one comma-separated declaration**,
and `.SaveButton` **overrides `border-color` to `primary` immediately below it** — so it was never
part of this defect, while `.FormatButton`, which really did wear the divider, was invisible to the
query. Fifth proof the count is a floor, and **the first proof it also contains entries that are not
defects**. ⚠️ A worker trusting the list would have "fixed" a correct control and left a broken one.

### 🔴 A THIRD case for session 62's up/down rule

s62 filed: hover fill moves *up* the ramp ⇒ delete `border-color`; *down* ⇒ use `primary`.
`.CancelButton:hover` fills **down** (`bg-2 → bg-3`) and yet lands at **3.08 / 3.05 — it would have
PASSED on a deletion**. `primary` is used anyway, because **a rule whose job is to emphasise on
hover must not go quieter under the pointer** (3.57 → 3.08 is a fix that makes the thing worse where
the user is looking).

🔴 **So the decision is three steps, not one: the direction, then the number, then what the rule is
for.** Direction alone tells you when deletion is *unsafe*; it does not tell you when it is *right*.

### The ten mutants, each killed by a named row

| mutant | killed by |
|---|---|
| revert `.Button` to `border-default` | its own fill + ground rows (4 reds) |
| **restore `.Button:hover`'s `border-highlight`** | **the state row ONLY** (2 reds) — 1.28 / 1.25 on the fill |
| revert `.CancelButton` | its own rows (4 reds) |
| **restore `.CancelButton:hover`'s `border-highlight`** | **the state row ONLY** (2 reds) — 1.28 on fill, 1.74 on `.Modal` |
| revert `.PreviewButton` | its own rows (4 reds) |
| revert the SHARED `.FormatButton`/`.SaveButton` declaration | `.FormatButton`'s rows **and** the false-positive row (6 reds) |
| **"tidy" `.CloseButton` to `border-control` like its neighbours** | **its fill row ONLY** — *"2.64:1 on its own fill in dark"* |
| drop `.SaveButton`'s `border-color` override | the false-positive row (2 reds) |
| raise the shared `border-default` in `colors.css` | the negative control (1 red) |
| over-fix — sweep the `.Modal` REGION edge | the non-controls row (2 reds) |

### 🔴 The finding worth more than any of the above: the spec was GREEN while reading the wrong declaration

The first draft passed **38/38 — and four of these ten mutants survived it.** Reverting three of the
five controls to `border-default` changed nothing the spec looked at.

**Why:** it read `border-color` out of the whole SCSS rule body, and in SCSS **a rule body contains
its nested `&:hover`**. So `.CancelButton`'s *resting* edge resolved to its *hover's* `primary`, and
the resting rows were measuring a declaration that was never under test.

🔴 **The tell was not the survivor count — it was a mutant that touched ONLY a `:hover` and reddened
the RESTING rows.** A kill attributed to the wrong row is a broken reader wearing a strong spec's
clothes. ✅ **Read which row died, not how many.** The fix is `own()` in the spec, which strips
nested blocks before any declaration is read, and it is commented there at length.

⚠️ **This generalises to the whole sweep.** Every remaining family nests its states, and the two
existing specs' helpers do too — the bench and picker files happened to use *top-level* state rules
(`.X:hover { }`), so they were never exposed. **A future slice on a nested family that copies those
helpers inherits the defect.** Copy `code-editor-control-borders.test.ts` instead.

### ⚠️ The negative control's bound, a third time

Three grounds in one file, and they do not share a bound: `.Modal` and `.Dropdown` are `bg-1` (bound
**1.4**), `.Toolbar` is `bg-2` (bound **1.2**). All three are asserted separately. **Re-derive per
surface** — this is now the third session to file it.

## ⬜ What is left — 43 sites, and that number is a FLOOR

🔴 **The inventory is bounded by its own query and reports that bound.** It selects blocks
containing both `border-default` and `cursor: pointer` — so it **misses native `<input>`,
`<select>` and `<button>` that never set a cursor**. `.TemplateFilter-search` is proof: it is a
control, it was part of this defect, and **this query did not find it**. It was found by reading the
file. So treat 60 as a lower bound, and read each file rather than trusting the list.

⚠️ **Membership is a judgement, not a grep.** `.Matrix`, `.OpSummary` and `.TriggerInfoCopy` are on
the list because they set a cursor, but they may well be regions rather than controls. **The test is
whether a reader must identify the thing as an interactive component** (1.4.11), not whether it is
clickable.

⚠️ **s63: the headline number has never matched this list.** Counting the entries below gives
**57** originally, not 60, and **43** remaining after sessions 60–63 — the "60" appears to have been
a count of `border-default` declarations rather than of sites. Both are floors either way, and the
discrepancy is unexplained rather than resolved; **the count is not the artefact, the files are.**

By package (43 left):

- **`noodl-core-ui`** (13): ~~`.Button` (CodeHistoryButton), `.CancelButton` (CodeHistoryDiffModal),
  `.PreviewButton` (CodeHistoryDropdown), `.SaveButton` / `.CloseButton` (JavaScriptEditor)~~ —
  ✅ **DONE, session 63**. ⚠️ It was **five controls, but not these five**: `.SaveButton` was a
  FALSE POSITIVE and `.FormatButton`, which is not on this list, was a real defect. **8 left**:
  `.DismissButton` (SuggestionBanner), `.VariantSelector-trigger`, `.TokenPicker-trigger`,
  `.Card` (LauncherProjectCard), `.Select` (LauncherSearchBar),
  `.DeleteConfirmationCancelButton` (FolderTree), `.Option` / `.Ghost` (LearnerPathSection),
  `.FolderPickerItem` (Projects)
- **Canvas / bench** (11): ~~`.Action` / `.Empty` / `.PickerChip` (BenchScenarioBar), `.Clear`
  (BenchOutputsRail), `.ResetAll` / `.SignalButton` (BenchInputsRail)~~ — ✅ **DONE, session 62**,
  and it was 7 declarations + 2 hover rules rather than 6. **5 left**: `.FrameChip` /
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

- ~~`.Button` (CodeHistoryButton), `.CancelButton` (CodeHistoryDiffModal)~~ — ✅ done s63, **both
  needed `primary`**; `.Card` (LauncherProjectCard) remains
- ~~`.Action` / `.Empty` / `.PickerChip` (BenchScenarioBar), `.ResetAll` / `.SignalButton`
  (BenchInputsRail)~~ — ✅ done s62, and **two of them needed `primary` rather than a deletion**;
  `.AiPill` (CanvasHud) remains
- `.LoadMoreButton` ×2 (IssuesList, PRsList), `.IssueItem`, `.PRItem`, `.SecondaryButton`
  (ConnectToGitHub)
- `.PresetCard` (AddBackendDialog), `.Endpoint` (LocalBackendCard), `.FilterBuilderButton`
  (ByobFilterBuilder), `.Shelf` (MyBlocksSaveDialog)

🔴 **s62: there are TWO fixes, not one — check which by reading the hover FILL.** If it moves
*up* the ramp (toward the lighter end) the control tone survives on its own and the hover
`border-color` can simply be deleted, as in the node picker. If it moves *down* (`bg-3 → bg-4`,
where `border-control` is 2.64 / 2.77) deletion reintroduces the defect, and the rule needs
`primary`. Both cases are worked above.

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
