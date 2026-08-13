# VFN-002 — The field you cannot read while you type in it

**Status:** 🔨 **BUILT 2026-08-13, not measured live** · **Tier 1, ship-blocking** · no dependencies

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
