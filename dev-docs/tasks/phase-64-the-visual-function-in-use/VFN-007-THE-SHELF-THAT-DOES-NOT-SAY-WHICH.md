# VFN-007 — The shelf that does not say which

**Status:** 📋 open · **Tier 3** · ~2 hours · 🔴 **reproduce before building**

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

1. The reproduce step is run and its answer written into this file before anything is built.
2. The selected shelf is visible at a glance, in both themes, and its indicator measures **≥ 3:1**
   against its own surround (the non-text contrast floor).
3. Clicking anywhere in an option row selects it, including the consequence note.
4. Keyboard: the picker is reachable by Tab, changeable by arrows or Space, and shows focus.
5. The saved definition still lands on the chosen shelf — assert against `myBlocksStore().scopeOf(id)`,
   not against the toast.

## How to prove it

A drive for the contrast measurement, with `scripts/devtools/icon-contrast.js` on the picker.
Screenshots in both themes with each option selected, so the *difference* is visible in the artefact
rather than asserted.

🔴 A screenshot alone is not the proof — that is what a mockup is, and a mockup is not a contrast
measurement. Take the number.
