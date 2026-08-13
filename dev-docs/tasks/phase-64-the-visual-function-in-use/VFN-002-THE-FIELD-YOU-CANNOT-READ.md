# VFN-002 — The field you cannot read while you type in it

**Status:** ✅ **BUILT** (`0067304d`; ring token fixed `5452720e`) · ✅ **SPEC-PROVED** (6 stylesheet
tests + 9 contrast cases, both controlled) · 🟡 **DRIVEN in part — the clip is measured live and
passes** · 🔴 **OWED:** criterion 3's ring *rendered on a block* in both themes, and **criterion 4
(dropdowns)**, never touched · **Tier 1** · no dependencies

> ## ✅ Criterion 3, half measured and half handed on — 2026-08-13, lane D
>
> Criterion 3 had never been measured at all. It is now measured **from the tokens the rule names**,
> which is the half that can be settled without a renderer, and it found a failure.
>
> ### 🔴 The ring was invisible, and the fix is a token
>
> | pair | dark | light | bar |
> |---|---|---|---|
> | `--theme-color-fg-default` on `--theme-color-bg-3` — the text | **6.66:1** | **6.54:1** | AA 4.5 ✅ |
> | `--theme-color-border-default` on `bg-3` — the ring **as it shipped** | **1.01:1** | **1.11:1** | 3.0 🔴 |
> | `--theme-color-border-control` on `bg-3` — the ring **now** | **3.17:1** | **3.16:1** | 3.0 ✅ |
>
> `border-default` is the panel-edge tone; against this rule's own `bg-3` fill it is the same colour
> as the surface it delimits. Criterion 3 asks for *"a visible border"* and there was not one, in
> either theme. `--theme-color-border-control` is the token `colors.css` defines for exactly this
> ("the lightest tone that still clears 3:1 on bg-1, bg-2 and bg-3") and is already how
> `ExtractToComponentPopup` and VFN-009's own `SavedBlocksSection` draw a control edge.
>
> **Changed:** `BlocklyWorkspace.module.scss` — `box-shadow: 0 0 0 1px var(--theme-color-border-control)`.
> **Gated:** `tests-unit/vfn-002/field-editor-contrast.spec.ts` (9 cases), which reads the token
> names **out of the stylesheet** rather than restating them, with two negative controls: the
> replaced token measured at 1.01/1.11, and black-on-white/white-on-white through the same formula.
> Watched red — with `border-default` restored, both ring assertions failed at 1.01 and 1.11.
>
> ### ⚠️ Measured and deliberately not asserted — the ring's *outer* edge
>
> A `box-shadow` paints outside the border box, so the ring's other side is the Blockly block. No
> `--theme-color-*` tone clears 3:1 against the hue circle: the ring is **1.00:1 (dark, worst hue
> 310)** and **1.01:1 (light, worst hue 30)** against the block, and the field's own `bg-3` fill is
> **2.43:1 / 2.25:1**. This is the wall VFN-013 hit and answered by taking the theme out of the
> badge entirely; doing the same to a *text input* would mean a light-theme field with a dark ring,
> which is a different trade and belongs to whoever sees it on screen. The numbers are logged by the
> spec so the next person starts from them rather than rediscovering them.
>
> ### 🔴 Still owed to the drive
>
> 1. **That these rules win.** A declaration that is present and losing looks identical from a
>    stylesheet parse, and this repo has a register entry about the class of defect where they were.
> 2. **A screenshot of an open field editor on a block, in both themes** — the ring against the
>    block, at real zoom, is the reading a token cannot give.
> 3. **Criterion 4**, the dropdowns, which was never driven either.

> ## ✅ Measured live 2026-08-13, with the pre-fix rule re-injected as the control.
>
> ### 🔴 First, a correction to this file's stated instrument
>
> **`scrollWidth > clientWidth` is off by one and will report a false failure.** Both are rounded to
> integers, so a box measuring `26.305px` reports `client=26, scroll=27` with nothing hidden. Taken
> at face value the fixed field "fails" on 4 of 4 field kinds. The honest instrument is
> **`scrollLeft`**: drive the caret to the end, set `scrollLeft = 1e6`, and read it back. If the box
> cannot be scrolled, nothing is clipped.
>
> ### With the fix — `math_number`, typing `12345`
>
> ```
> value   rectW    client scroll intDelta textPx  slack(rect-text) scrolledBy font
> 1       18.148   18     18     0        8.153   9.995            0          sans-serif 14.6667px
> 12      26.305   26     27     1        16.306  9.998            0          sans-serif
> 123     34.453   34     35     1        24.460  9.994            0          sans-serif
> 1234    42.609   43     43     0        32.613  9.997            0          sans-serif
> 12345   50.766   51     51     0        40.766  10.000           0          sans-serif
> ```
>
> **~10px of slack at every length, `scrollLeft` immovable at 0.** The 1px integer delta appears only
> where `rectWidth` is fractional. Nothing is hidden at any intermediate length. ✅ Criterion 1.
>
> ### The negative control — the pre-fix rule re-injected at runtime
>
> ```
> value   client scroll textPx  scrolledBy  pad/border  font
> 1       16     23     6.595   6.5         8px/1px     -apple-system
> 12      24     32     15.237  7.0         8px/1px     -apple-system
> 123     32     40     24.223  7.5         8px/1px     -apple-system
> 1234    41     50     33.453  9.0         8px/1px     -apple-system
> 12345   49     59     42.310  9.5         8px/1px     -apple-system
> ```
>
> ✅ **The control genuinely clips: up to 9.5px of real horizontal scroll, versus 0 with the fix.**
> So the green reading is earned rather than an instrument that measured nothing.
>
> ### ✅ The font half is confirmed by measurement, not only by reading
>
> With the fix the input computes to **`sans-serif`** — Blockly's own `FIELD_TEXT_FONTFAMILY`, the
> family it measured the block text with. Re-injecting our override flips it to **`-apple-system`**
> and `scrollWidth` for `12345` grows 51 → 59px. That 8px is the font mismatch alone, separate from
> the 18px of padding and border, exactly as §"a third, smaller contributor" predicted.
>
> ### Criterion 2 — all four field kinds
>
> `math_number`, the hat block's signal-name field, `noodl_send_signal`'s name field and
> `noodl_get_variable` were each opened and typed into. All four: `padding 0/0`, `border 0/0`,
> `box-sizing border-box`, `box-shadow rgb(35,42,51) 0 0 0 1px`, font `sans-serif`. ✅
>
> 🔴 **Still owed: criterion 3's contrast reading**, in both themes. The ring is present and the
> tokens resolve, but no AA measurement was taken. Criterion 4 (dropdowns) was not driven either.

> **What landed.** The rule in
> [`BlocklyWorkspace.module.scss`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.module.scss)
> now declares `border: none`, `padding: 0` and a `box-shadow` ring, and **no `font-family`** —
> all three exactly as specced below. Gated by `tests-unit/vfn-002/` (6 tests), which parses the
> stylesheet and asserts the absences, **with a negative control** that runs the same parser over
> the rule as it was and requires it to see all three declarations that made the field unreadable.
>
> ✅ **The font half is confirmed in source, not assumed.** Blockly's renderer injects
> `.blocklyRenderer-x.blocklyTheme-y .blocklyHtmlInput { font-family: FIELD_TEXT_FONTFAMILY }`,
> and `WidgetDiv.show` copies the renderer and theme class names onto the widget div — precisely
> so the editor and the measurement use one font. Deleting our override lets that rule win, which
> is why "make the fonts agree" needed no `FIELD_TEXT_FONTFAMILY` change.
>
> 🔴 **Still owed: the live measurement.** `scrollWidth > clientWidth` on a real field, before and
> after, is the only honest reading of the rendered result and it needs a running editor. Criteria
> 1, 2 and 4 are not claimed.

## The report

> *"When you add blocks with fields, clicking into the field the 'focussed' mode text inside the
> field is cut off left and right. To the point where the number field you can't see what you're
> typing until you unfocus the field and the number appears."*

## The mechanism, in two CSS rules

**Blockly's own base rule**, from `blockly_compressed.js`:

```css
.blocklyHtmlInput {
  border: none;
  border-radius: 4px;
  height: 100%;
  margin: 0;
  outline: none;
  padding: 0;
  width: 100%;
  text-align: center;
  display: block;
  box-sizing: border-box;
}
```

Every value there is load-bearing. Blockly positions and sizes the editor by measuring the field's
rendered **text** on the block (`FieldTextInput.resizeEditor_` → the field's scaled bounding box) and
setting the widget div to exactly that box. The input is `width: 100%` of a box that is the width of
the text — with `padding: 0` and `border: none`, that is exact.

**Our override**, [`BlocklyWorkspace.module.scss:292-301`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.module.scss):

```scss
.blocklyWidgetDiv input,
.blocklyHtmlInput {
  background-color: var(--theme-color-bg-3) !important;
  color: var(--theme-color-fg-default) !important;
  border: 1px solid var(--theme-color-border-default) !important;
  border-radius: 4px !important;
  padding: 4px 8px !important;
  font-family: var(--font-family) !important;
}
```

`box-sizing: border-box` is inherited from Blockly's rule, so the border and padding come **out of**
the width Blockly computed, not off the outside of it: **18 px of horizontal content box, gone**.
`text-align: center` then clips the overflow symmetrically, which is why it is cut off on *both*
sides rather than running off one end.

For a `math_number` field showing `2`, the measured text is roughly 10 px wide. 10 − 18 is negative.
The content box collapses and there is nothing to see until the field is closed and the value is
painted back onto the block by Blockly's own SVG text — which is exactly the report.

⚠️ **`font-family` is a third, smaller contributor and must not be forgotten.** Blockly measures the
text with *its own* font (`FIELD_TEXT_FONTFAMILY`, applied to the block's `<text>`), and the input
then renders it in `var(--font-family)`. Even with the padding gone, a wider editor font overflows a
box sized for a narrower measured one. The two fonts have to agree, in one direction or the other.

## The fix

Restore the geometry, keep the theme:

```scss
.blocklyWidgetDiv input,
.blocklyHtmlInput {
  background-color: var(--theme-color-bg-3) !important;
  color: var(--theme-color-fg-default) !important;
  /* 🔴 No padding and no border. Blockly sizes this box to the field's measured text
     with `box-sizing: border-box`, so anything here comes out of the text's own room —
     18px of it, which is more than a number field has. Style it with `box-shadow`,
     which does not participate in the box model. */
  border: none !important;
  padding: 0 !important;
  box-shadow: 0 0 0 1px var(--theme-color-border-default);
  border-radius: 4px !important;
}
```

and make the fonts agree. The honest way is to stop overriding it — delete the `font-family` line, so
the input renders in the same family Blockly measured with. If the editor font is wanted, then
Blockly's `FIELD_TEXT_FONTFAMILY` has to be set to match on the theme
([`BlocklyTheme.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyTheme.ts)),
so that the measurement and the rendering are the same font by construction rather than by luck.

⚠️ **`box-shadow` and not `outline`.** Blockly's base rule sets `outline: none` on this element and
means it — the focus ring is the widget div's job.

## Acceptance criteria

1. Clicking into a `math_number` field showing `2` and typing `12345` shows all five digits, at
   every intermediate length.
2. The same for a text field, a `noodl_get_variable` name field, and the hat block's signal-name
   field — the four field kinds a builder meets first.
3. The editor still reads as a Noodl control: correct background, correct foreground, a visible
   border, AA contrast in both themes.
4. Nothing regresses in the dropdown fields, which share the `.blocklyWidgetDiv input` selector.

## How to prove it

🔴 **Measure, do not look.** A screenshot of a field with `2` in it looks fine at every width. The
instrument is the element:

```js
const input = document.querySelector('.blocklyHtmlInput');
({ client: input.clientWidth, scroll: input.scrollWidth, value: input.value })
```

`scrollWidth > clientWidth` **is** the defect, and it is the only honest reading. Take it before the
fix on a number field with three digits typed in — that is the red — and after.

⚠️ `cdp type` drives a real `<input>` here, so this one is drivable without the injected-context
trick the CodeMirror popout needs. But the field editor only exists while the field is open: click
the field first and assert the element is there before measuring, or you will measure `null` and read
it as a pass.
