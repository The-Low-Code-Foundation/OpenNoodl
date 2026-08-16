# FIX-005 — The dropdown you cannot read (and the category name that argues with a ruling)

**Report 3** · Tier 2 · Effort **S–M** (CSS) + **S** (rename, once ruled)

> *"The dropdowns that appear on certain nodes have strange highlight colours, between the one
> selected and the other non selected ones, their hover animations make them very hard to read.
> We should rename 'Runtime Variables' to 'App variables'."*

## Part 1 — the dropdown. Mechanism pinned, contrast measured.

All styling lives in one `:global` block, `BlocklyWorkspace.module.scss:281+`. The theme cannot
reach menus (`componentStyles` has no menu entry) — CSS is the only lever. Measured in both themes:

| State | Dark | Light | Verdict |
|---|---|---|---|
| resting text on `bg-3` | 13.03:1 | 14.20:1 | fine |
| hover background delta (`bg-4` vs `bg-3`) | **1.18:1** | **1.08:1** | ⚠️ hover is effectively invisible |
| **selected**: `fg-highlight` on solid `--theme-color-primary` (`:477-481`) | **2.33:1** | **3.56:1** | 🔴 fails AA in both themes — *the* unreadable row |

Root causes, ranked:
1. The selected row is solid primary with near-white text — 2.33:1.
2. Hover moves one background step (`bg-3`→`bg-4`) — imperceptible.
3. **Blockly's own highlight class `blocklyMenuItemHighlight` is never styled.** Blockly's
   hover/keyboard highlight is a *class*, not `:hover` (stock rule: `rgba(0,0,0,.1)` — a black
   wash, invisible on dark). On open, Blockly highlights the selected item with it, so two
   highlight mechanisms fight and mouse vs keyboard look different.
4. `:hover` and `[aria-selected]` have equal specificity, both `!important` — source order means
   **hovering the selected row gives no feedback at all**.
5. `:456`'s `padding: 6px 12px !important` **destroys Blockly's 28px checkmark gutter**: the
   checked row's floated checkbox is pulled to −12px (outside the box), so the selected row's
   label sits at a different x and the tick is clipped — much of the "strange" look.
6. The `.goog-*` rules (`:439-449`, `:504-533`) are dead — Blockly 12 emits none.

Ruled out: the block-hue theory — no `renderer` is passed at inject, so Geras runs and
`FIELD_DROPDOWN_COLOURED_DIV` never fires. The colours are ours.

### Fix direction

- Selected → tinted background (`--theme-color-primary-transparent` / `primary-bg`,
  `colors.css:289`) or `bg-4` + a 2px primary left rule; text stays on a dark ground (13:1).
- Hover → a real delta (token or bg + left rule); add `.blocklyMenuItemHighlight` to the same
  ruleset so keyboard and mouse agree.
- Restore `padding-left: 28px` so the tick lands in its gutter, **or** hide
  `.blocklyMenuItemCheckbox` and mark selection by background alone (the sprite is a fixed dark
  PNG that reads poorly on dark anyway — ruling below).
- Delete the dead `.goog-*` rules. Apply the same treatment to `.blocklyTreeSelected` (`:299`) —
  the toolbox tree has the identical solid-primary problem.
- **Gate:** a dropdown-contrast spec copying `tests-unit/vfn-002/field-editor-contrast.spec.ts`
  (reads tokens *out of the SCSS*). A screenshot drive in both themes is owed — a spec cannot
  prove a rule wins.

## Part 2 — the rename. 🔴 This reverses a phase-64 ruling; it needs a decision, not a commit.

VFN-012 renamed this category **away from** `App Variables` → `Runtime Variables`, precisely so
`Noodl.Config` could be `App Config` without two shelves reading as the same thing
(`VFN-012-THE-BLOCKS-THE-APP-ALREADY-HAS.md:58-82`). The user's reason for reverting ("show
they're the global `Noodl.Variables` ones") is the *opposite* of the reason it was renamed.
Complication: the settings-panel section that owns `Noodl.Config` is called **"Custom Variables"**
(`VariablesSection.tsx:399`) — three surfaces currently use three vocabularies for two bags.

**Options to put to Richard:**
- **A.** Keep `Runtime Variables`; add a flyout label/tooltip *"the global `Noodl.Variables`
  written by Variable nodes"*. Cheapest, no ruling reversed.
- **B.** `Global Variables` (+ rename `App Config` → `App Settings`, matching its own "Open app
  settings" button). Sidesteps "App" on the runtime bag; matches the user's own words ("the
  global ones").
- **C.** Revert to `App Variables` and rename `App Config` → `App Settings` **and** the settings
  section to match. Satisfies the request literally; reverses VFN-012; biggest sweep.

Blast radius of any rename (copy only — block type ids are frozen): `BlocklyToolbox.ts:89` + the
`:62` history comment (rewrite it, don't leave it lying), `BlocklyLocale.ts` ×6 locales, and two
specs that pin the string red: `tests-unit/vfn-012/app-config-block.spec.ts:263,266`,
`browser-blocks.spec.ts:299`.

## Acceptance criteria

1. Selected, hovered, and keyboard-highlighted dropdown rows are each distinct and ≥4.5:1 text
   contrast in **both** themes — measured, then screenshotted live.
2. Hovering the currently-selected row visibly responds.
3. The checked row's label aligns with unchecked rows (gutter fixed or checkbox hidden).
4. Contrast spec red under the pre-fix rules (negative control), green after.
5. Whichever naming option is ruled: one vocabulary across toolbox, settings panel, and locales;
   the two pinned specs updated deliberately; the VFN-012 history comment rewritten.


## Part 1 — what shipped (2026-08-16, session 34, `5b91e9c8`)

All five ranked root causes are addressed, and the measured table above reproduced exactly before
anything was changed (2.33 / 3.56 selected; 1.18 / 1.08 hover delta).

| state | before | after |
|---|---|---|
| selected | `fg-highlight` on solid `primary` — **2.33 / 3.56**, fails AA both themes | `bg-5` + 3px `primary` rule + weight 600 — **9.09 / 12.11**, rule **3.89 / 3.40** |
| hover / keyboard | one bg step, **1.18 / 1.08** | `bg-4` + 3px `primary-highlight` rule — **11.04 / 13.18**, rule **5.94 / 4.77** |
| hovering the selected row | nothing (source order) | background moves to `bg-4`; rule and weight kept |
| the tick | clipped, label out of column | checkbox hidden, gutter uniform, rule marks selection |
| `.goog-*` | dead, and read as live | deleted |

🔴 **The design decision, because it is not the obvious one.** Moving selection onto a *background*
cannot work in this palette and that is measured, not assumed: `bg-4`/`bg-3` is **1.18 / 1.08** and
even two steps, `bg-5`/`bg-3`, is only **1.43 / 1.17**. Nothing in the neutrals is far enough apart
to read as a state change in the light theme. So the **rule** carries state and the background only
says which row. `font-weight` on selected is load-bearing for the same reason — `primary` and
`primary-highlight` are only **2.02:1** apart, so rule colour alone does not separate *selected*
from *hovered*, and weight is a channel that works without hue.

🔴 **The toolbox category was worse than the row the report complained about.** `.blocklyTreeSelected`
was solid primary under a `fg-default` label: **1.19:1 dark / 1.64:1 light**. The fix direction
called it *"the identical solid-primary problem"*; it was the worst reading in the file, because the
label there is the muted foreground rather than the highlight one. Now **4.65 / 5.58**.

✅ **Criterion 4 discharged properly.** 22 specs in `tests-unit/fix-005/dropdown-contrast.spec.ts`
read the token names **out of the SCSS**, so they cannot drift from the rule. With the old selected
rule restored the suite goes **red with 5 failures** — exactly the selected assertions — while
resting, hover and the tree stay green, so the failure is scoped to the change rather than a global
break.

🔴 **Still owed: criteria 1's live half and 2 and 3 — a screenshot in both themes.** A spec cannot
prove a rule *wins*, and this ruleset is a pile of `!important` where source order decides; that is
the very defect fixed here, so it is the last thing to take on trust.
⚠️ **Part 2 (the rename) is untouched.** It reverses VFN-012 and needs a decision, not a commit.

---

## Part 1 — DRIVEN 2026-08-16 (session 35), both themes. Criteria 1, 2 and 3 CLOSE.

Driven on `fix005-drive` (a renamed copy of `vfn64-drive`), the `number ▾` dropdown on
`/ErgCodes`'s Logic Builder. **Every state read as a computed style off the live DOM**, not from
the SCSS — that is the whole point, since the specs read token names *out of* the stylesheet and
therefore cannot fail when the rule loses.

🔴 **The kill condition was stated before the drive and was NOT met.** `:281` opens a top-level
`:global { }` and `:507` writes `:global(.blocklyDropDownDiv) :global(.blocklyMenuItem)` — a
`:global()` function nested inside a `:global` block. If css-loader had dropped or literalised
that, the whole ruleset would match nothing and all 22 specs would still pass; Blockly appends
`.blocklyDropDownDiv` to `document.body`, so there is no fallback path. **Resting rows compute
`border-left: 3px solid transparent`, so the selectors compile and the rules win.**

### All four states, captured simultaneously (pointer resting on `string`, `number` selected)

| row | state | background | left rule | weight |
|---|---|---|---|---|
| `any` `boolean` `object` `array` | resting | transparent (on `bg-3`) | transparent | 400 |
| `string` | `:hover` true | **`bg-4`** | **`primary-highlight`** | 400 |
| `number` | `aria-selected` | **`bg-5`** | **`primary`** | **600** |
| `number` at menu-open | selected **+** highlight | **`bg-4`** | `primary` | 600 |

**Measured contrast — every figure reproduces the table above exactly, in both themes.**

| | dark | light |
|---|---|---|
| resting text on `bg-3` | **13.03** | **14.20** |
| hovered text on `bg-4` | **11.04** | **13.18** |
| selected text on `bg-5` | **9.09** | **12.11** |
| selected rule vs `bg-5` | **3.89** | **3.40** |
| hover rule vs `bg-4` | **5.94** | **4.77** |

- ✅ **Criterion 1** — three states mutually distinct on *three* channels (background, rule colour,
  weight) and every text reading ≥ 9:1, far above AA. Screenshotted in both themes.
- ✅ **Criterion 2** — the reordering works. At menu-open Blockly puts `blocklyMenuItemHighlight`
  on the selected row and the background moves `bg-5` → `bg-4` (9.09 → 11.04) while the rule stays
  `primary` and the weight stays 600. That is the row responding *and* remaining identifiable.
- ✅ **Criterion 3** — `.blocklyMenuItemCheckbox` computes `display: none` and all six rows report
  an identical label x of **952px**. Nothing shifts when the selection moves.
- ⚠️ **Scope on the keyboard half.** The `blocklyMenuItemHighlight` arm was observed live —
  Blockly applied it on open and moved it onto the hovered row — so the declarations are proven.
  **Arrow-key navigation itself was not driven**; it shares the same declaration block as `:hover`,
  so what is untested is only whether Blockly's key handler sets that class, not the styling.

### 🔴 The toolbox-category half of this fix is DEAD CODE — `.blocklyTreeSelected` matches nothing

Measured with the toolbox fully rendered (16 categories) and a category **selected**, in both
themes, and re-confirmed on a single CDP connection so the selected state could not lapse between
calls:

| selector this stylesheet targets | matches | Blockly 12 actually emits |
|---|---|---|
| `.blocklyTreeSelected` (edited by `5b91e9c8`) | **0** | `.blocklyToolboxSelected` |
| `.blocklyToolboxDiv` | **0** | `.blocklyToolbox` |
| `.blocklyTreeRow` | **0** | `.blocklyTreeRowContentContainer` |
| `.blocklyTreeLabel` | **0** | `.blocklyToolboxCategoryLabel` |

**What actually renders**: Blockly sets the selected category's fill as an *inline style* from the
category's own colour — `background-color: rgb(91,103,165); border-left: 8px solid rgb(91,103,165)`
— and its own stock rule `.blocklyToolboxSelected .blocklyToolboxCategoryLabel` paints the label
`#fff`. That is **5.35:1**, identical in both themes because an inline colour ignores our tokens.

🔴 **So both of this file's toolbox numbers describe a rule that has never applied.** The "worst
reading in the file, **1.19:1**" was never on screen, and neither is the **4.65 / 5.58** claimed
after. Both arithmetics are *correct* — recomputed here to 1.19 and 4.65 exactly — but their
premise, that the selector matches, is false. ⚠️ **There is no live defect**: 5.35:1 passes AA, so
this is a false claim rather than a broken screen.

⚠️ **This is the same defect as the `.goog-*` rules the same commit deleted** for "matching nothing
for several major versions while reading as a second set of dropdown rules that might be the ones
in force". Four more of exactly that were left in place, one of them freshly edited.

**Not fixed here, because the choice is a design decision and not mechanical:** *delete* the four
dead rules (hygiene, matches what `5b91e9c8` did to `.goog-*`, leaves the toolbox on Blockly's
category-coloured selection at 5.35:1), or *retarget* them to `.blocklyToolboxSelected` and friends
(applies the intended `bg-5` + rule treatment, but visibly changes the toolbox and would need
`!important` to beat Blockly's inline style). ⚠️ **Retargeting is a visible redesign of the
toolbox** — it should not fall out of a contrast drive.

⚠️ **Method note worth keeping:** a first sweep for "dead Blockly selectors" ran with the dropdown
**closed** and duly reported every `.blocklyMenuItem` rule as matching nothing. That is a *state*
difference charged to the selector. Only selectors whose subject UI is on screen can be called
dead — which is why the toolbox result above is stated and the context-menu rules are not.

## ✅ RULED 2026-08-16 (session 42)

**Dead selectors → DELETE.** All four, matching what `5b91e9c8` did to the `.goog-*` rules.
Rejected: retargeting to `.blocklyToolboxSelected` — it needs `!important` to beat Blockly's inline
style and is a **visible redesign of the toolbox**, which should not fall out of a contrast drive.
The toolbox stays on Blockly's category-coloured selection at 5.35:1, which passes AA.

**The rename → `App Variables` + `App Config`.** `Noodl.Variables` is called **App Variables**, to
sit with the other `Noodl.*` surfaces; the extra globals in app settings are called **App Config**,
after the `Noodl.Config` method they represent. ⚠️ **This knowingly reverses VFN-012**, which renamed
away from `App Variables` — recorded here so it does not read as an accident later.

## ✅ BUILT 2026-08-16 (session 43) — the four dead selectors are gone

`BlocklyWorkspace.module.scss`: `.blocklyToolboxDiv`, `.blocklyTreeLabel`, `.blocklyTreeRow:hover`
and `.blocklyTreeSelected` deleted, replaced by a comment that records the measurement (0 matches
each, both themes, toolbox rendered with a category selected), what Blockly 12 emits instead, and
why retargeting was rejected. Same shape as `5b91e9c8`'s `.goog-*` note.

⚠️ **No screen changes.** The rules matched nothing, so the toolbox still renders Blockly's own
category-coloured selection at 5.35:1. Deleting them removes a false claim, not a style.

🔴 **Five specs went with them, and finding them was a lesson.** `tests-unit/fix-005/
dropdown-contrast.spec.ts`'s last block graded `.blocklyTreeSelected` and `.blocklyTreeLabel` — five
green rows plus a negative control that fired at 1.19:1, all of it measuring a selector that matches
nothing. **The control could not have caught it**: it varied the background *token* and held the
*selector* constant, so it proved the contrast formula separates two colours, never that either
colour reaches a pixel. The block is replaced by a comment saying so.

⚠️ **My pre-delete grep missed it** — I searched `packages/noodl-editor/tests` and `src/editor/src`
and concluded "no spec asserts them". `tests-unit/` is a **third** root, and it is where this
package's copy-and-token specs live. `test:main` caught it; the grep would not have.

🔴 **Still open in this task: the rename** to `App Variables` / `App Config`. Not started here — it
is the `.jsx`/`test:ci` half, and it knowingly reverses VFN-012.

## 🔴 A much larger idea the rename exposed — NOT this task

Richard: *"the ultimate would be moving the whole damn thing down to 'Variables / Functions / Blocks'
because it's kind of a drawer by itself… App Variables, Objects, Arrays… they're all declared
globally and Blockly could just pick them up and display them as a list of blocks, like with the
blockly variables. I know that's a big change, but it makes so much more sense than dot notation."*

✅ **This is Blockly's own native model, not a departure from it.** Blockly already enumerates
declared variables and offers them as draggable blocks rather than names you type. App Variables,
App Config, Objects and Arrays are all declared globally, so the editor can enumerate them the same
way — which removes dot notation **and** removes having to remember names. Plus `Function Variables`
for the Blockly-scoped ones, and the whole set moved into its own drawer.

**Wants its own task.** Do not fold it into the rename, and do not let the rename pre-empt its
naming decisions.
