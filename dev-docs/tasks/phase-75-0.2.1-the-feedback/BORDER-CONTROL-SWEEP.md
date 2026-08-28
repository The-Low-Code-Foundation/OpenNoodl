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

## What session 64 fixed — the launcher's Projects view, and a hover trap no grep can find

`LauncherProjectCard`, `LauncherSearchBar` and the `Projects` view in **`noodl-core-ui`** — the
second slice outside `noodl-editor`. **Four controls, one of them not on the inventory**, plus two
hover rules. ⚠️ The Projects view sets no background on `.Main`, so three of the four are seen
against the launcher's own `.ContentArea` — **a ground in a different stylesheet from every control
that sits on it**, and `bg-0`, a step no previous slice has worked on.

| control | element | fill | ground | was | now (dark / light) |
|---|---|---|---|---|---|
| `LauncherProjectCard .Card` | `role="button"` | `bg-1` | `.ContentArea` (`bg-0`) | 1.26 / 1.27 | **4.17 / 3.72** fill, **4.86 / 3.28** ground |
| `LauncherSearchBar .Search` | `<input>` box | `bg-1` | `.ContentArea` (`bg-0`) | 1.26 / 1.27 | **4.17 / 3.72** fill |
| `LauncherSearchBar .Select` | `<select>` box | `bg-1` | `.ContentArea` (`bg-0`) | 1.26 / 1.27 | **4.17 / 3.72** fill |
| `Projects .FolderPickerItem` | `<button>` | `bg-3` | `.FolderPickerDialog` (`bg-2`) | 1.08 / 1.04 | **3.08 / 3.05** fill, **3.57 / 3.37** ground |

**Deliberately left on the divider token** (three sites, asserted as such): `.Sidebar` (a region
boundary), `.FolderPickerDialog` (a modal surface edge) and `LauncherSearchBar .Kbd` — the ⌘K
keycap, a hint rather than something a reader operates, left for the reason session 61 left the
picker's `.Kbd` and `.Enter`.

Pinned by `tests-unit/border-sweep/launcher-control-borders.test.ts` — 38 rows, both themes,
**eleven mutants**.

### 🔴 The finding: a THIRD SHAPE of the hover trap, and the first that is INVISIBLE TO A GREP

Sessions 61, 62 and 63 each found hover rules that **name** a divider tone (`border-strong`,
`border-highlight`). That is a findable defect — the "20 stylesheets" list below was built by
searching hover rules for `border-color`, and every trap site named in it was found that way.

**`.FolderPickerItem:hover` declares no border at all.** It moves the *fill* down the ramp
(`bg-3 → bg-4`), and POL-016 scopes `border-control` to bg-1/2/3 — it is **2.64:1 dark / 2.77:1
light on `bg-4`**. So the resting fix is **inherited onto a step where it fails 1.4.11**, and only
while the pointer is on the button.

🔴 **A hover can therefore break a resting fix without mentioning the border, and no search over
border declarations can find it.** The trap list below is bounded by the same query shape as the
inventory, and this is the proof it has the same kind of hole. ✅ **The check that works is
measuring every state that changes the border *or the fill*** — which is what the spec's state row
does, and it is why that row reddens here at `2.64:1 on its own fill`.

Fixed with `primary`: **3.54 / 3.40** on the hover fill, **4.80 / 4.14** on the dialog.

### 🔴 A FOURTH case for the up/down rule — and a new direction: the fill does not move

`.Card:hover` moves the fill **not at all** (it lifts with `transform` and a shadow). Deleting its
`border-color` — the node picker's remedy — was **measured and passes**: the resting tone is simply
inherited at 4.17 / 3.72. It was rejected anyway, for two reasons that are not about the number:
the rule lists `border-color` in **its own `transition`**, so a deletion leaves a declared
transition animating nothing; and the sibling `.TemplateCard:hover` — the same object one component
away — already uses `primary`. **Consistency and the rule's purpose decided this one, not the
measurement.**

So the sweep's hover decision now has four cases: fill **up** ⇒ deletion is right; fill **down past
3:1** ⇒ deletion reintroduces the defect; fill **down but still clearing** ⇒ deletion passes but
goes quieter; fill **stationary** ⇒ deletion passes and is still usually wrong.

### 🔴 SIXTH proof the inventory is a floor

The list has `.Card`, `.Select` and `.FolderPickerItem` from this family. **`.Search` is a fourth**
— the box that draws the search `<input>`'s boundary, measured at 1.26 / 1.27. Invisible to the
query for the fourth time running, and always the same way: **a text field sets no
`cursor: pointer`.** `.TemplateFilter-search`, `NodePickerSearchBar .Field`,
`BenchScenarioBar .NameField`, and now `.Search`. **Every slice so far has contained at least one.**

### ⚠️ A FOURTH distinct negative-control bound, and it is the highest yet

Sessions 61 and 62 filed that the bound belongs to the **ground**: 1.4 on `bg-1`, 1.2 on `bg-2`.
This family sits on **`bg-0`, where the divider is 1.46 dark / 1.12 light** — needing **1.5**.
Copying either earlier file's bound would have read the correct value as a defect. **Re-derive per
surface; this is the fourth session to file it and the first where the bound went UP.**

### 🔴 `own()` is load-bearing here, and it was proved by reproduction rather than assumed

Session 63 warned that a slice on a nested family copying the bench or picker helpers inherits its
defect. **Measured directly: replacing `own()` with `return body` makes this spec pass 38/38 with
the `.Card` revert applied.** `.Card` nests `&:hover { border-color: primary }` and the reader tries
`border-color` before `border`, so the resting rows resolve to the hover's tone — session 63's
defect, reproduced exactly, in the next family to be worked. ✅ **The instruction to copy
`code-editor-control-borders.test.ts` is now load-bearing rather than advisory.**

### ✅ A row a number cannot replace — pinning the ground BY NAME

`.ContentArea` paints `bg-0` and nests a scrollbar-track rule painting `bg-1`. Two faults must
coincide for the ground to become that scrollbar — `own()` regressing **and** the nested rule using
the other spelling (`background-color` where the outer uses `background`, which the reader tries
first). **Both were reproduced together: the ground row reddens six times and every contrast row
stays green**, because `border-control` clears 3:1 on `bg-1` (4.17 / 3.72) just as on `bg-0`
(4.86 / 3.28).

🔴 **When the wrong answer also passes, the only check that works is naming the right one.** Every
control in this file therefore pins its ground token by name, and future slices should too — the
grounds in this sweep are increasingly read from a *different stylesheet* than the control.

### The eleven mutants, each killed by a named row

| mutant | killed by |
|---|---|
| revert `.Card` resting | its own fill + ground rows (4 reds) |
| **restore `.Card:hover`'s `border-strong`** | **the state row ONLY** (2 reds) — `.Card&:hover is 1.74:1 on its own fill` / `2.03:1 on .ContentArea` |
| revert `.Search` (the site the inventory cannot see) | its own rows (4 reds) |
| revert `.Select` | its own rows (4 reds) |
| revert `.FolderPickerItem` resting | its own rows (4 reds) |
| **delete `.FolderPickerItem:hover`'s border — the PICKER's remedy** | **the state row ONLY** (2 reds) — `2.64:1` dark, `2.77:1` light |
| over-fix — sweep the `.Kbd` keycap | the non-controls row (2 reds) |
| over-fix — sweep the `.FolderPickerDialog` region | the non-controls row (2 reds) |
| raise the shared `border-default` in `colors.css` (dark) | the negative control, **in dark only** (1 red) |
| **break `own()` in the spec, with the `.Card` revert applied** | **NOTHING — 38/38, which is the finding** |
| **break `own()` + the nested-spelling hazard** | **the ground-pin rows ONLY** (6 reds), every contrast row green |

⚠️ Failure **text** was read for the two state-row kills, not just the counts — session 63's lesson
that a kill attributed to the wrong row is a broken reader. Both name the right control and land on
the predicted numbers.

### 🧭 Found while reading, NOT swept — the launcher tree has `border-strong` controls

The inventory is bounded by `border-default`, so these are not in it at all — the leak session 62
filed, seen again at scale:

- 🔴 **`LauncherButton .is-secondary`** — a `<button>` modifier, `bg-2` fill, `border-color:
  border-strong` = **1.74 / 1.53**. Invisible on **both** counts (a modifier class, and the wrong
  token), and this is the launcher's **shared** button, so it is a defect wherever a secondary
  button appears. ⚠️ Its hover fills `bg-2 → bg-3` — **down** the ramp, so it needs the direction
  check before a tone is picked.
- **`ShareTemplateModal`** — `.Preamble`, `.Result` and `.ChoiceItem` all name `border-strong`;
  `.ChoiceItem` is very likely a control and the other two very likely regions. **Membership is a
  judgement, as always.**

~~**Recommended next: `LauncherButton` first**~~ — ✅ **DONE, session 65**, together with
`ShareTemplateModal`.

## What session 65 fixed — the shared button, and the first family with TWO grounds per control

`LauncherButton .is-secondary` and `ShareTemplateModal .ChoiceItem` — **the slice that closes the
launcher's `border-strong` sites**, i.e. the two that session 64 found *while reading* and that
**appear in no count in this document**, because the inventory's query is bounded by
`border-default`. Two controls, four stylesheets read, **22 rows, twelve mutants**.

| control | element | fill | ground(s) | was | now (dark / light) |
|---|---|---|---|---|---|
| `LauncherButton .is-secondary` | `<button>` | `bg-2` | `LauncherHeader` (`bg-1`), `CommunityAccountCard` (`bg-2`), `Projects .FolderPickerDialog` (`bg-2`) | 1.49 / 1.39 on its fill | **3.57 / 3.37** fill, **4.17 / 3.72** on the titlebar |
| `ShareTemplateModal .ChoiceItem` | radio pill, `cursor` + `:focus-within` | none | `Modal .Root` (`bg-4`) | 1.10 / 1.14 | **5.85 / 4.61** |

**Deliberately left on the divider token** (six sites, asserted as such): `.Preamble` and `.Result`
(static `bg-2` regions on the modal, carried by their fill step), `Modal .Root`, the titlebar's
`border-bottom`, `CommunityAccountCard .Root` and `.FolderPickerDialog`.

🧭 **Noted, not swept, and NOT a token question**: `.is-ghost` paints neither fill nor border and is
identified by its label text; `.Root:disabled` drops `opacity` to 0.55, a composited value
`themeTokens` explicitly refuses to grade. Both are recorded in the spec rather than measured,
because a made-up number is worse than an admitted gap — the `.ResizeHandle` precedent from s62.

Pinned by `tests-unit/border-sweep/launcher-button-control-borders.test.ts`.

### 🔴 The finding: A SHARED CONTROL HAS MANY GROUNDS, and this document's table shape cannot say so

Every slice from session 60 to 64 mapped **one control to one ground**, and the `CONTROLS` table in
all four specs is built that way. `.is-secondary` is the launcher's **shared** button and is placed
on **three surfaces**: the titlebar (`bg-1`), the community card (`bg-2`) and the folder picker's
footer (`bg-2`).

🔴 **A tone chosen by reading one call site is a real measurement of the wrong question.** Reading
only the titlebar would have reported 4.17 / 3.72 and missed that on the two `bg-2` grounds the fill
step is **literally 1.00:1** — the `.Button` shape from session 63, where the edge is the only thing
that exists. ✅ **The fix is only correct if it clears on the WORST ground**, so the spec's ground
is a *list* and the row is titled "on EVERY surface it is placed on". **Any component in
`components/` rather than a view has this shape; the remaining `noodl-core-ui` sites should be
assumed to until their call sites are counted.**

### 🔴 `border-control` is the DEFECT at `.ChoiceItem` — session 63's exclusion, reached from the other side

`.ChoiceItem` paints no fill, so it is seen against the surface behind it — and that surface is
**`Modal .Root` = `bg-4`**, where `border-control` is **2.64 / 2.77, under 3:1**. Session 63 met
this exclusion at `.CloseButton`, which was **FILLED** `bg-4`; this pill is **GROUNDED** on it.

🔴 **So "what step is it on?" has to be asked of BOTH sides of the edge, not just the fill.** A
worker applying the sweep's usual remedy here reddens four rows at 2.64 / 2.77 — the mutant is in
the table below. It uses `fg-default-shy` (**5.85 / 4.61**), following s63's precedent exactly.

⚠️ **And raising a resting edge is not always free.** This file's own note says the SELECTED state
of these pills is carried by the **border**, so a stronger resting tone eats into the signal the
selection contrasts against. It survives on three channels — hue, a doubled weight via
`box-shadow`, and the label colour — and there is now a row that refuses to let the pair collapse.

### 🔴 The first family that needs BOTH state-discovery mechanisms in one spec

The code-editor and launcher specs walk **nested `&` blocks**; the bench spec matches **top-level
rules that extend the selector**. This family contains both spellings — `.is-secondary` nests
`&:hover:not(:disabled)`, while `ShareTemplateModal` writes `.ChoiceItem:hover` and
`.ChoiceItem.is-selected` as top-level rules.

🔴 **Copying either existing helper alone leaves half the states unmeasured, and every contrast row
stays GREEN while it does** — proved by two mutants that each remove one mechanism and redden
*only* the row added to detect exactly that. ✅ **A spec whose state reader is half-blind is the
s63 defect in a new costume; assert that both spellings are reachable rather than trusting it.**

### 🔴 `own()` is INERT in this family — and s64's instruction was inherited, not measured

Session 64 raised "copy `code-editor-control-borders.test.ts`, `own()` is load-bearing" from advice
to instruction. **Measured here, it kills nothing**: breaking it alone leaves all 22 rows green, and
breaking it *with* the `.is-secondary` revert applied still kills the same six rows the revert kills
on its own.

The reason is specific and checkable: **no nested state in either file declares `border-color`.**
`.is-secondary`'s nested hover sets only `background`, and `.ChoiceItem`'s states are top-level,
which a nested-block stripper never sees. ✅ **Keep `own()` — it is correct, and the next
`border-color` added inside a nested state needs it — but do not report it as this file's strength.**
🔴 **A guard inherited from a sibling family is an untested guard until its mutant is run here.**

### ✅ The ground pin by name earned its place again, and more cheaply than s64's version

s64 needed two coinciding faults to make the ground misread. Here **one** does it: `Modal .Content`
nests scrollbar rules painting `bg-3` and `bg-5`. Moving the modal's ground to `bg-3` reddens ten
rows — **but only because the ground is pinned BY NAME**. `fg-default-shy` clears 3:1 on `bg-3`
(6.81 / 5.07) exactly as on `bg-4`, so **every contrast row would have passed on the wrong ground.**
Failure text confirmed: `modalShell .Root paints --theme-color-bg-3`, expected `bg-4`.

### ⚠️ A correction to this document's own number

s64 recorded `.is-secondary` as *"`bg-2` fill, `border-color: border-strong` = **1.74 / 1.53**"*.
The tone and the defect are right; **the number is the ratio against `bg-1`**, the titlebar ground.
Against its own `bg-2` fill it is **1.49 / 1.39** — *worse* than recorded. Not a large error, but it
is the fill figure that decides whether the edge is load-bearing, and it was the one not taken.

### The twelve mutants, each killed by a named row

| mutant | killed by |
|---|---|
| revert `.is-secondary` to `border-strong` | its fill, ground and state rows (6 reds) |
| revert `.ChoiceItem` to `border-strong` | its own rows (4 reds) |
| **"tidy" `.ChoiceItem` to `border-control` — the SWEEP'S OWN REMEDY** | **its fill + ground rows (4 reds)** — `2.64:1` dark, `2.77:1` light |
| break `own()` **alone** | **NOTHING — 22/22, and that is the finding** |
| break `own()` **with the revert applied** | the same 6 rows the revert kills alone — `own()` adds nothing here |
| **`statesOf` loses the TOP-LEVEL mechanism** | **the both-spellings row ONLY (2 reds)** — every contrast row green |
| **`statesOf` loses the NESTED mechanism** | **the both-spellings row ONLY (2 reds)** — every contrast row green |
| hover fill moves one step further, `bg-3` → `bg-4` | **the state row ONLY (2 reds)** — s64's `.FolderPickerItem` trap, guarded prospectively |
| over-fix — sweep the `.Preamble` REGION | the non-controls row (2 reds) |
| raise the shared `border-strong` in `colors.css` (dark) | the negative control, **in dark only** (1 red) |
| **move the modal's ground to `bg-3`** | **the ground-pin rows (10 reds)** — by NAME; every contrast row would have passed |
| the selected pill loses its `box-shadow`, or collapses to the resting tone | the selection row (2 reds each) |

⚠️ Failure **text** was read for the `border-control` and ground-pin kills, not just counts.

### ⚠️ The hover direction check, run as instructed — and a fifth variant

s64 flagged that `.is-secondary`'s hover fills **down** the ramp (`bg-2` → `bg-3`) and said to run
the direction check before picking a tone. Run: `border-control` is **3.08 / 3.05 on `bg-3`**, so it
**still clears** and inheritance is correct. But the variant is new — **the hover declares no border
at all**, so there is nothing to *delete*; the only question is whether inheriting the raised
resting tone is safe. That is s64's third shape (a state that changes only the fill) with a **safe**
outcome rather than a failing one, and it is asserted rather than assumed.

## What session 66 fixed — the learner path, and a control whose edge IS its fill

`LearnerPathSection` — the intake questions and the path they produce, in the launcher's Learning
tab. **One stylesheet, three controls, three regions, 26 rows, twelve mutants.** The first slice
whose recommended target came with a scouted disposition attached, and **one of the three scouted
calls was wrong**: `.Primary` was flagged as a likely false positive to be *left alone*, and the
right answer was to **grade it** instead.

| control | element | fill | ground(s) | was | now (dark / light) |
|---|---|---|---|---|---|
| `.Option` | `<button aria-pressed>` | `bg-2` | `Launcher .ContentArea` (`bg-0`) | 1.07 / 1.15 on its fill | **3.57 / 3.37** fill, **4.86 / 3.28** ground |
| `.Ghost` | `<button>`, **no fill** | none | `.ContentArea` (`bg-0`) **and `.Step` (`bg-1`)** | 1.46 / 1.12 and 1.26 / 1.27 | **4.86 / 3.28** and **4.17 / 3.72** |
| `.Primary` | `<button>` | `primary` | `.ContentArea` (`bg-0`) | edge **= fill, 1.00:1** | **unchanged — and now GRADED at 6.53 / 4.03** |

⚠️ **`.Option`'s edge is load-bearing in a way the dark theme hides.** Its `bg-2` fill on the
`bg-0` content area is a step of 1.361 dark but **1.028 light** — far under NAT-001's own 1.09
perceptual bar. With a divider edge, an unchosen option in light theme was a label.

**Deliberately left on the divider token** (three sites, asserted as such): `.Truth`, `.Step` and
`.Omitted`, all static `bg-1` boxes carried by a fill step of 1.165 / 1.133.

🧭 **Noted, not swept, and NOT a token question**: every `:disabled` here drops `opacity` to
0.5–0.55, a composited value `themeTokens` refuses to grade — the `.ResizeHandle` precedent.

Pinned by `tests-unit/border-sweep/learner-path-control-borders.test.ts`.

### 🔴 The finding: TWO GROUNDS FROM ONE CALL SITE — counting call sites is the wrong instrument

Session 65 found that a shared control must clear on the worst of its surfaces, and closed with an
instruction: **"any component in `components/` rather than a view should be assumed to have this
shape until its CALL SITES are counted."** Counted here, `LearnerPathSection` has **exactly one**
call site (`views/Learning.tsx`), which under that instruction reads as *one ground, no hazard*.

🔴 **It has two, and the second is inside the component itself.** `.Ghost` is placed twice by its
own JSX: once in the head row, on the launcher's `bg-0` content area, and once inside a `.Step`,
which paints `bg-1`. A call-site count returns 1 and **cannot see the second placement at all.**

✅ **Count PLACEMENTS, not call sites** — the question is how many distinct surfaces the element is
drawn on, and a component that draws its own regions answers part of that question itself. The
mutant is in the table below: deepening `.Step` to `bg-4` reddens **`.Ghost` and nothing else**.

⚠️ Note also that **which ground is worst swaps by theme** — `border-control` is 4.86 on `bg-0` and
4.17 on `bg-1` in dark, but 3.28 and 3.72 in light. A slice that measured only the worse-in-dark
ground would have picked the wrong one to defend in light.

### 🔴 A CONTROL WHOSE EDGE IS ITS FILL IS GRADED BY ITS FILL STEP, NOT EXCUSED BY JUDGEMENT

`.Primary` paints `border: 1px solid primary` on `background: primary` — **1.00:1 between them**,
which reads as the worst defect in the file. Session 63 met this shape at `.SaveButton` and
disposed of it as a **false positive**, and this session's scouting note predicted the same
disposition: *"measure before touching it."*

🔴 **Both dispositions stop one step early.** "False positive" is a claim about *today*, recorded
in prose, that no row can defend — the `.SaveButton` precedent adds a control to an exclusion list
and the list cannot fail. What is actually true is narrower and checkable: **the object is
identified by its FILL**, at 6.53 / 4.03 on its ground, and the border is only keeping its box the
same size as `.Ghost` and `.Option` beside it.

✅ **So the resting row now branches**: when a control's edge and fill resolve to the same token, it
grades the **fill step against the ground** instead of the edge against the fill. `.Primary` passes
that at 6.53 / 4.03 — and reddens the moment the fill moves. Mutant M3 does exactly that and the
failure text reads *".Primary paints its edge the same tone as its fill, and that fill is only
1.16:1 on the launcher's content area (bg-0) in dark — nothing identifies it."*

⚠️ **An exclusion list cannot make that assertion.** Every earlier slice's "deliberately left
alone" prose is in the same position; the region row below is a weaker instrument than this one for
the same reason, and it is worth asking of each excluded site whether the reason it was excluded is
itself gradeable.

### 🔴 `own()` IS load-bearing here — and session 65's instruction cuts BOTH ways

Session 65 broke `own()` in its own family and killed **nothing**, and filed the right rule:
**a guard inherited from a sibling family is untested until its mutant is run here.**

Run here, it kills. `.Option` nests `&[data-chosen='yes'] { border-color: var(--theme-color-primary) }`,
and `tokenOf` tries `border-color` before `border`, so a reader without `own()` resolves the
**resting** edge of an *unchosen* option to `primary`. Measured:

- `.Option` reverted to `border-default`, `own()` intact → **6 reds**
- `.Option` reverted to `border-default`, `own()` broken → **26/26 GREEN**

🔴 **The revert vanishes.** So s65's rule is confirmed by its own opposite: the answer was INERT
there and load-bearing here, and neither session could have known without running the mutant. It
also protects the ground — `.ContentArea` nests a scrollbar track painting `bg-1`.

### ⚠️ The other half of the state reader draws NOTHING here, and the spec says so

Session 65's `statesOf` reads states from nested `&` blocks **and** from top-level rules extending
the selector. In this family **only the nested branch fires** — every state is nested. It is kept
because it is correct, but reporting a two-mechanism reader as this file's strength would be s65's
own warning repeated by the session that received it. **The row asserts the states this file
relies on, and asserts the other branch is unexercised**, so that adding a top-level `.Option:hover`
later reddens it and the next reader learns the branch has started to matter.

✅ **And the suffix guard on that row is load-bearing, found by reddening**: `.Options` is the flex
row that *holds* the options, and a plain prefix match reads it as a state of `.Option`. It failed
on the first run, which is how it is known to be live rather than decorative.

### ✅ The ground pin by name earned its place a third time

Moving `.ContentArea` to `bg-1` reddens **ten rows** — but every one of them is a `groundToken`
name check. `border-control` clears 3:1 on `bg-1` (4.17 / 3.72) exactly as on `bg-0` (4.86 / 3.28),
and `primary` clears on both, so **every contrast number in this file would have passed on the
wrong ground.** Failure text confirmed: *"launcherShell .ContentArea paints --theme-color-bg-1"*,
expected `bg-0`.

### ⚠️ THREE negative-control bounds in one file, the first family to need that many

Sessions 61, 62, 64 and 65 each filed that the bound belongs to the **ground**. This family's
controls touch three steps at once, so it carries three: **1.5** on `bg-0` (1.46 dark), **1.4** on
`bg-1` (1.27 light) and **1.2** on `bg-2` (1.15 light). Copying any single earlier file's bound
reads a correct value as a defect on two of the three.

### The twelve mutants, each killed by a named row

| mutant | killed by |
|---|---|
| revert `.Option` to `border-default` | its fill, ground **and state** rows (6 reds) |
| revert `.Ghost` to `border-default` | its own rows (6 reds) |
| **`.Primary` loses the fill that identified it** | **its resting row (2 reds)** — 1.16 / 1.13, text read |
| break `own()` **alone** | **nothing — 26/26** |
| **break `own()` WITH the `.Option` revert applied** | **nothing — 26/26, and THAT is the finding**: the revert's six reds vanish |
| **`.Step` deepens to `bg-4`** | **`.Ghost` ONLY (6 reds)** — the second ground, proved to be measured |
| over-fix — sweep the `.Truth` REGION | the non-controls row (2 reds) |
| raise the shared `border-default` in `colors.css` (dark) | the negative control, **in dark only** (1 red) |
| **`.Option:hover` fills DOWN to `bg-4`** | **the state row ONLY (2 reds)** — s64's trap, guarded prospectively |
| the chosen option collapses to the resting tone | the selection row (2 reds) |
| **the state row loses its SUFFIX guard** | **itself (2 reds)** — `.Options` read as a state of `.Option` |
| move the ground to `bg-1` | **10 rows, all by NAME**; every contrast row would have passed |

⚠️ Failure **text** was read for the `.Primary` and ground-pin kills, not just counts.

## What session 67 fixed — the folder tree, and a modal that is its own second ground

**Unit of work: one component family, read whole** — `FolderTree` plus its sibling `FolderTreeItem`
and the view that places them. Suggested by session 66 as the natural follow-on, and the last
`noodl-core-ui` file on the remaining list with more than one entry.

**Two declarations fixed, two more graded**, and — as in every session since 60 — the list was
wrong in both directions:

- `.RenameInputField` / `.CreateFolderInputField` — **two native `<input>`s sharing one rule**.
  1.26:1 dark / 1.27:1 light against the `bg-1` sidebar, 1.07 / 1.15 against their own `bg-2` fill.
  → `border-control` (4.17 / 3.72 on the ground, 3.57 / 3.37 on the fill).
  🔴 **Neither is on the inventory, for exactly the documented reason**: neither sets `cursor`, the
  blind spot the list already admits at `.TemplateFilter-search`. **Third confirmation** that the
  query is a floor.
  ✅ `:focus` already names `primary` (4.80 / 4.14) — *stronger* than the raised resting tone, so
  the focus signal is not eaten. Checked, not assumed.
- `.DeleteConfirmationCancelButton` — the one entry that WAS on the list. 1.07 / 1.15 on the
  dialog. → `border-control` + a hover remedy, below.
- `.DeleteConfirmationDeleteButton` — edge and fill the same tone, **graded not excused** (below).
- `.NewFolderButton` — a `<button>` with **no border and no fill at all**, graded by its label.

### 🔴 The finding: the SECOND GROUND is a modal the component renders itself

Session 66 found a control with two grounds from one call site and filed **count PLACEMENTS, not
call sites**. `FolderTree` has one call site (`Projects.tsx:193`) and **two grounds again** — but
the second is not another spot in the layout. It is a `position: fixed` confirmation dialog that
this component renders into the centre of the screen.

🔴 **A placement count that walks the component's own layout tree still misses it, because the
dialog ESCAPES that tree.** The file's own header comment says "the 224px **bg-1** sidebar… this
component fills it", and that sentence is true of everything except **the two buttons that matter
most**, which are on the dialog's `bg-2`. A tone picked by believing the header comment is a real
measurement of the wrong surface.

✅ **Read what the component RENDERS, including its modals and portals** — not where it is placed.

The two grounds are one ramp step apart (1.168:1 in dark), so **every contrast row would have
passed on the wrong one**. Only the ground pin by NAME catches it — see the mutants.

### 🔴 The fill step decides whether the edge is graded at all — session 66's branch, generalised

Session 66 added a branch for `edge === fill` and graded `.Primary` by its fill step. This family is
where that special case stops being enough, because the same question arises when the edge and fill
are *different* tones and the fill still carries the object on its own.

Session 60 already wrote the general rule down, at `.TemplateCard`: an edge is *"load-bearing or not
depending on whether the fill step carries the object on its own."* **That has been prose in this
document for six sessions.** It is now the spec's one criterion:

> A control is identified by its **outermost tone** — the border if it paints one, else the fill —
> and that ratio against the ground is asserted always. The second question, *is the ring visible as
> a ring against the fill it encloses*, is asked **only when the fill does NOT clear 3:1 on the
> ground**, i.e. when the ring is doing the identifying on its own.

`edge === fill` is simply the degenerate case where the outermost tone IS the fill.

⚠️ **It stays strict exactly where this sweep has always been strict.** Every `bg-N` control here has
a fill step of 1.10–1.17 on its ground, so the ring is load-bearing and both ratios are graded —
mutants M1 and M2 confirm it, each reporting *both* numbers. It relaxes only for the destructive
button, whose `danger` fill is 4.52 / 4.38 on the dialog.

### ✅ Session 64's hover remedy transfers — and was MEASURED here, not inherited

`.DeleteConfirmationCancelButton` is the same shape as `.FolderPickerCancelButton`, which session 64
fixed **in this same view, one component over**: a `bg-3` button whose hover moves the fill DOWN to
`bg-4`, naming no border of its own. `border-control` is **2.64 dark / 2.77 light** on `bg-4`, so
the raised resting tone would be inherited onto a step where it fails 1.4.11 — and only while the
pointer is on the button.

Session 65 filed that **a guard inherited is untested until its mutant runs in the new family**.
Run here it kills, at the same two numbers (mutant M3). Remedy: `border-color: var(--theme-color-primary)`
on hover — 3.54 / 3.40 on the hover fill, 4.80 / 4.14 on the dialog ground.

### 🔴 A defect this sweep CANNOT fix, recorded as a number rather than as prose

`.DeleteConfirmationDeleteButton:hover` drops **both** fill and edge to `danger-dim`, which is
**2.61:1 on the dialog in DARK** — a real 1.4.11 failure, found only because session 66's branch
made the resting state gradeable and the same rule was then applied to the states.

🔴 **It is not fixable inside this file, and the reason is a genuine conflict:**

| | dark | light |
|---|---|---|
| white label on `danger` (the resting fill) | **2.79:1** ❌ | 4.83:1 |
| white label on `danger-dim` (the hover fill) | 4.83:1 | 6.57:1 |
| boundary: `danger` on the dialog | 4.52:1 | 4.38:1 |
| boundary: `danger-dim` on the dialog | **2.61:1** ❌ | 5.96:1 |

**The label needs the dim step; the boundary needs the bright one.** They cannot both be satisfied
by one tone in dark. `LauncherHeader.module.scss:183` already ruled on the label half — *"only the
dim step carries a white glyph legibly in BOTH themes"* — and **the resting fill of this button
contradicts that ruling**, at 2.79:1.

🔴 **This is not local.** `danger` as a white-labelled fill appears in at least **seven** stylesheets:
`PrimaryButton`, `CellEditor`, `DataGrid`, `EasyMode`, `AddColumnForm`, `TitleBar` and this one.
**It is a platform token decision, not a border-sweep edit**, and changing it in one dialog would
be a divergence from six other places.

✅ **So it is PINNED by its measured value** rather than excluded in prose — the row asserts the
hover boundary is *still exactly 2.61 / 5.96*, and reddens if anyone moves it. ⚠️ **The row does
not claim the button passes.** It claims the defect is still the size it was when written up.

### ✅ The exclusion rule applied rather than the exclusion list extended

`.NewFolderButton` is a real `<button>` painting `border: 0` and `background: none` — under the
inventory's own membership test, a control with **no boundary whatsoever**, which reads as the worst
defect in the file. It is not one: what identifies it is its **label**, and a label is a number —
**9.24:1 dark / 6.18:1 light** on the sidebar, and 10.84 / 13.33 on the step its hover moves to.

Writing *"a text button, deliberately left alone"* would have been the claim session 66 warned
cannot fail. Mutant M9b moves the label tone and the row reds **at 1.49:1**.

### 🔴 `own()` is load-bearing here — predicted from the code, then proved by the two-part mutant

The two `<input>`s nest `&:focus { border-color: var(--theme-color-primary) }`, and `tokenOf` tries
`border-color` before `border` — so a reader without `own()` resolves the **resting** edge of an
unfocused field to `primary`, which clears 3:1 everywhere.

**Broken alone** it kills 3 rows. **Broken with the M1 revert applied**, the revert's two reds
**vanish** — M6b kills exactly the same three rows as M6a, with no `.RenameInputField` row among
them. Third family, third distinct answer (s65 inert, s66 live, s67 live).

### 🔴 The suffix guard is UNEXERCISED here — and the mirror image is why

This was **predicted to be live and the prediction was wrong**, which is the more useful outcome.
`.RenameInput` is the wrapper that HOLDS `.RenameInputField`, and `.CreateFolderInput` holds
`.CreateFolderInputField` — which looks exactly like session 66's `.Option` / `.Options` hazard.

🔴 **It is the MIRROR IMAGE of it.** The guard fires only when the **queried** selector is a prefix
of another; here the queried selector is the **longer** of the pair, so nothing is ever a candidate.
Removing the guard kills **no row** (mutant M11).

⚠️ **A common prefix is not enough to conclude the guard is live — the DIRECTION is the whole
question.** The comment in the spec now says so, and says it because the mutant said so.

### ⚠️ Three negative-control bounds again, and the third is a control's own fill

1.4 on the sidebar (`bg-1`), 1.2 on the dialog (`bg-2`), 1.2 on the cancel button's own `bg-3` fill.
**Sixth session** to file that the bound belongs to the GROUND.

### The mutants — eleven run, ten killed by a named row, and the eleventh is a finding

| mutant | killed by |
|---|---|
| M1 revert the two `<input>`s to `border-default` | the inputs' resting row, **both themes** — text read: 1.26 / 1.27 on the ground *and* 1.07 / 1.15 on the fill |
| M2 revert `.DeleteConfirmationCancelButton` | its resting row, both themes (1.07 / 1.15 on the dialog) |
| M3 delete the hover `primary` | its **state** row, both themes — **2.64 / 2.77**, session 64's numbers |
| M4 over-fix: raise `.Divider` to `border-control` | the **REGION** row, both themes |
| M5 raise the shared `border-default` token | the **negative control** — all three bounds named |
| M6a break `own()` alone | 3 rows |
| M6b break `own()` **with M1 applied** | **the revert's 2 reds VANISH** — the finding |
| M7 move the pinned ground to `bg-0` | **5 rows, by NAME** — every contrast row would have passed |
| M8 change the pinned hover tone | the **known-open pin**, both themes |
| M9 change the label token name | the borderless row (name pin) |
| M9b change the label **value** | the borderless row **at a number** — 1.49:1 |
| M10 add a border to `FolderTreeItem` | the **sibling** row — reports `.Root` |
| **M11 remove the suffix guard** | 🔴 **NOTHING — see the finding above** |

⚠️ **The mutant runner itself was wrong first.** Run from the repo root, jest used the root config
and the spec failed to **parse** — `Tests: 0 total`, reported as a kill. Every mutant would have
read as "killed" while nothing ran. The runner now **refuses a run that failed to RUN** before
reporting reds. (Filed under the standing "a failed install reads as a failed test" trap.)

## ⬜ What is left — 38 sites, and that number is a FLOOR

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
  FALSE POSITIVE and `.FormatButton`, which is not on this list, was a real defect.
  ~~`.Card` (LauncherProjectCard), `.Select` (LauncherSearchBar), `.FolderPickerItem` (Projects)~~
  — ✅ **DONE, session 64**, and it was **four** controls: `.Search` (LauncherSearchBar) is not on
  this list and was a real defect. **5 left**: `.DismissButton` (SuggestionBanner),
  `.VariantSelector-trigger`, `.TokenPicker-trigger`,
  ~~`.DeleteConfirmationCancelButton` (FolderTree)~~ — ✅ **DONE, session 67**, and it was **two
  declarations fixed plus two graded** rather than one: the two `<input>`s
  (`.RenameInputField` / `.CreateFolderInputField`) are on no list because neither sets `cursor`,
  `.DeleteConfirmationDeleteButton` is a **known-open platform defect pinned by number**, and
  `.NewFolderButton` is graded by its LABEL rather than added to an exclusion list. **3 left.**
  ~~, `.Option` / `.Ghost` (LearnerPathSection)~~ — ✅ **DONE, session 66**, and it was **three**
  controls rather than two: `.Primary` is not on this list, is not a defect, and is now GRADED by
  its fill step rather than excused as a false positive. ~~**4 left.**~~ **3 left after session 67.**
  — ~~⚠️ **plus `LauncherButton .is-secondary` and three `ShareTemplateModal` sites**~~ — ✅ **DONE,
  session 65**, and of those four **two were controls and two were regions**: `.is-secondary` and
  `.ChoiceItem` were real defects, `.Preamble` and `.Result` are static regions and were asserted as
  such. Neither control appears in any count in this document — both name `border-strong`.
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
  needed `primary`**; ~~`.Card` (LauncherProjectCard)~~ — ✅ done s64, **also `primary`**, and see
  s64's finding: `.FolderPickerItem:hover` was a trap site this list **could never have contained**,
  because it names no border at all
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
