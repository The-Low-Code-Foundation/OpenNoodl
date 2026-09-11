# VFN-007 — The shelf that does not say which

**Status:** ✅ **BUILT 2026-08-13 on `vfn-saveblock`** (`136fa3be`; merged into `cline-dev` via
`7411c265`) · ✅ **SPEC-PROVED** — 23 tests, three negative controls; criterion 2 is a measured
contrast number · 🔴 **NOT DRIVEN** · 🔴 **OWED:** criteria 3 and 4 — the selected state **on screen**
in both themes, and the keyboard model · **Tier 3** · ✅ reproduced — and it is NOT contrast

> ## ✅ Built. Criteria 1, 2 and 5 closed; 3 and 4 owe a drive
>
> The picker is now an **ARIA radiogroup of themed option cards** — no `<input type="radio">`
> anywhere in the dialog, so there is no document-scoped group for `BaseDialog`'s second render
> of the body to join. The selected state is React's and nothing else's, which is what it always
> should have been: React's state was correct throughout the original bug.
>
> - `myblocks/shelfChoice.ts` (new) — the options as data and the arrow/Space/Enter model, both
>   pure and both graded.
> - `MyBlocksSaveDialog.tsx` / `.module.scss` — the cards, on design-system tokens.
> - `tests-unit/vfn-007/shelf-picker.test.ts` — 23 tests, **three negative controls**.
>
> **Criterion 2 is a measured number, not a screenshot.** `tests-unit/support/themeTokens.ts`
> (new) resolves `colors.css` for both themes and computes the WCAG ratio of the pairs the
> stylesheet actually names:
>
> | Pair | dark | light |
> |---|---|---|
> | `--theme-color-primary` on `--theme-color-bg-3` — the chosen dot and ring | **6.45** | **3.99** |
> | `--theme-color-border-control` on `--theme-color-bg-2` — the empty ring | **3.66** | **3.43** |
> | `--theme-color-primary` on `--theme-color-bg-2` — the chosen row's border | **6.45** | **4.33** |
>
> ⚠️ **What changed that the task file said to keep.** The `<label>` wrapper is gone — a
> `<label>` with no labelable control inside it labels nothing. The *property* it bought (the
> whole row including its consequence note is the click target) is kept and asserted.
> `DEFAULT_SCOPE` is untouched and is asserted to still be `'project'`.
>
> ⚠️ **Second finding, filed not fixed: `BaseDialog`'s measuring copy is tab-reachable.** It is
> `pointer-events: none; opacity: 0` — hidden from the mouse and the eye, not from the keyboard.
> **Every** focusable element in **every** dialog in the editor is therefore in the tab order
> twice, invisible copy first. One attribute (`inert`, or `aria-hidden`) on the measuring
> container closes the whole class; not done here because `BaseDialog` is on every dialog surface
> in the app and the change cannot be verified without a drive. Its own task.
>
> **Owed to a drive:** that a click on the note really selects the row, that Tab and the arrows
> behave in a rendered dialog, and `icon-contrast.js` on the painted pixels. Written up in
> [`NOTES-saveblock.md`](NOTES-saveblock.md).

> ## 🔴 Criterion 1 is answered, and it overturns this file's hypothesis
>
> Driven 2026-08-13 through the app's own `openSaveBlockDialog`, so these are the real radios.
> **The mechanism is a fifth candidate this file did not consider, and the four it eliminated stay
> eliminated.**
>
> **`BaseDialog` renders its children twice** — a zero-height `BaseDialog-module__MeasuringContainer`
> and the visible `ChildContainer`. Both copies contain `<input type="radio" name="myblocks-shelf">`.
> A native radio group is scoped to the **document** by name, so there are **four radios in one
> group** and the browser can keep only one checked.
>
> Clean before/after, one click on the visible backpack row:
>
> ```
> BEFORE                                    AFTER
> [0] MEASURING This project  checked=false  [0] MEASURING This project  checked=false
> [1] MEASURING My backpack   checked=false  [1] MEASURING My backpack   checked=TRUE   ← the check went here
> [2] visible   This project  checked=TRUE   [2] visible   This project  checked=false
> [3] visible   My backpack   checked=false  [3] visible   My backpack   checked=false  ← and never arrives here
> ```
>
> **After the click, not one visible radio is checked.** React's state is correct — which is exactly
> why "afterwards it correctly saves to the backpack" — but the browser handed the check to the
> invisible measuring copy. The builder sees a control that took their decision and shows nothing.
>
> ### What this changes
>
> - 🔴 **The `color-scheme` hypothesis below is not the cause.** It was reasonable and it is now
>   ruled out as the *primary* mechanism: measured `color-scheme: normal` and `accent-color: auto`
>   on a 13×13 native radio, but a radio that is **not checked at all** has no checked mark whose
>   contrast could be measured. Do not start with `icon-contrast.js`.
> - ✅ **The proposed fix still works, for a better reason.** Themed option cards do not participate
>   in a native radio group, so replacing the bare radios removes the whole class. Build that.
> - 🔴 **This is not confined to this dialog.** *Any* native radio group inside a `BaseDialog` has
>   it. Worth a grep before someone adds the next one.
> - ⚠️ **Also found: the radios carry no `value` attribute.** `input.value` reads `"on"` for both
>   ([`:167-170`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.tsx)
>   sets `checked` and `onChange` but never `value`), so nothing in the DOM says which shelf a radio
>   stands for — only its label text does. Fix that with the control; a spec cannot address them.
>
> ⚠️ **Instrument warning for whoever drives this next.** The measuring copy makes every dialog
> assertion double-count: `document.body.innerText` reports each dialog's text **twice**, and every
> button appears twice with the phantom **above** the real one, so a click at its centre lands on a
> `<p>`. Filter with `:not([class*=MeasuringContainer])` and hit-test with `elementFromPoint` before
> clicking. This cost the drive session that found it about an hour, across VFN-003 *and* VFN-007.

## The report

> *"When you save a block, to the project or to your backpack, clicking the backpack option doesn't
> check the checkbox, even though afterwards it correctly saves to the backpack."*

## What the report already tells us, and it is a lot

**The state change works.** The block lands on the backpack shelf, which means the click reached the
input, `onChange` fired, `setScope('user')` ran, React re-rendered, and `commit({ scope })` received
`'user'`. Every layer of the mechanism is functioning.

**So this is cosmetic, and it is the worst kind of cosmetic**: a control that takes a decision and
does not acknowledge it. A builder who cannot see the choice land will either click again or assume
it failed — and this particular choice is the one with the consequence that shows up weeks later,
when a collaborator opens the project and the block is not there.

## 🔴 The mechanism is NOT pinned, and four plausible ones were eliminated

Written down so the next person does not spend the same hour:

| Candidate | Ruled out because |
|---|---|
| A global `input[type=radio] { appearance: none }` reset | There is none. The only two `appearance: none` rules in the editor are scoped to `TableRow.module.scss` and `ConnectToGitHub.module.scss` |
| The dialog mounted twice, so two same-`name` radio groups fight | `DialogLayerModel` keys by id and holds one entry; `showDialog` replaces rather than stacks |
| A React controlled-input mismatch | `checked` and `onChange` are both present and the state demonstrably applies |
| A stacking/overlay problem eating the click | The click is not eaten — the save goes to the backpack |

**What is left, and worth checking first:** this repo declares `color-scheme` **nowhere**
(`grep -rn "color-scheme"` over both packages returns nothing). Native form controls therefore render
in Chromium's light-mode style on a dark sheet, and the checked/unchecked difference in a native
radio is a small `accent-color` dot inside a white circle. Against `--theme-color-bg-1` this may
simply be too low-contrast to read as a state change.

That is a hypothesis with a register entry behind it — *an icon host that sets `fill` sets nothing*,
nine dark-on-dark glyphs, worst 1.16:1 — and it is the family this smells like. **It is still a
hypothesis.**

## Reproduce first

Open the save dialog, click the backpack option, and read the DOM rather than the screen:

```js
[...document.querySelectorAll('input[name="myblocks-shelf"]')]
  .map(r => ({ v: r.value, checked: r.checked, computed: getComputedStyle(r).accentColor }))
```

- Both `checked` flags correct → **purely a rendering/contrast problem.** Measure the contrast
  between the checked mark and its surround with `scripts/devtools/icon-contrast.js`, which exists
  precisely because this class of defect cannot be found by reading.
- The `checked` flags wrong while the save still goes to the backpack → something is diverging
  between the DOM and React's state, and that is a different and more interesting bug. Find it before
  building anything.

## The fix, either way

Replace the bare native radios
([`MyBlocksSaveDialog.tsx:158-180`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.tsx))
with the design system's own control. `@noodl-core-ui/components/inputs/Checkbox` is already used by
`LibrariesSection` for exactly this kind of choice; if there is no radio equivalent, the two options
are mutually exclusive and small enough that two themed option **cards** — a bordered row per shelf,
the chosen one carrying `--theme-color-primary` on its border and a visible mark — are better than a
radio anyway, because each option's consequence is already written beside it.

This removes the whole class rather than repainting one instance: no native control means no
dependence on Chromium's default form styling, and it puts the shelf picker on the same tokens as
every other choice in the editor.

⚠️ **Keep the structure that works.** The `<label>` wrapping the input and its note is what makes the
whole row clickable, and the `note` text under each label
([`:61-66`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.tsx))
is the entire reason this is not a `<select>` — the consequence has to sit beside the option, not
behind it. Both survive the change.

⚠️ **`DEFAULT_SCOPE` stays `'project'`.** The argument is written down in
[`MyBlocksSave.ts:103-112`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSave.ts)
— the cheaper mistake is the default — and nothing in this report disturbs it.

## Acceptance criteria

1. ✅ **DONE 2026-08-13.** The reproduce step was run and its answer is at the top of this file:
   a duplicated radio-group `name` across `BaseDialog`'s two renders, **not** contrast.
2. ✅ **DONE.** The selected shelf is visible at a glance, in both themes, and its indicator
   measures **≥ 3:1** against its own surround. Measured from `colors.css` in both themes — the
   table is at the top of this file. ⚠️ Source-level; `icon-contrast.js` on the painted pixels is
   still owed.
3. 🟡 **Structure proved, delivery owed.** Clicking anywhere in an option row selects it,
   including the consequence note — the row is the control and the note is inside it, asserted.
   That a real click lands needs a drive.
4. 🟡 **Model and markup proved, delivery owed.** Roving `tabIndex`, arrows/Space through
   `shelfAfterKey`, and a focus outline on `--theme-color-focus-ring`. ⚠️ Expect an extra,
   invisible tab stop first — that is the `BaseDialog` finding above, not this picker.
5. ✅ **DONE.** The saved definition lands on the chosen shelf, asserted against `scopeOf` for
   both options and against the *other* shelf being empty. Not against the toast.

## How to prove it

A drive for the contrast measurement, with `scripts/devtools/icon-contrast.js` on the picker.
Screenshots in both themes with each option selected, so the *difference* is visible in the artefact
rather than asserted.

🔴 A screenshot alone is not the proof — that is what a mockup is, and a mockup is not a contrast
measurement. Take the number.
