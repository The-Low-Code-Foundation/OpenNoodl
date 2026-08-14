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
