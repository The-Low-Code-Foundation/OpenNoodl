/**
 * VFN-002 — the field you cannot read while you type in it.
 *
 * > *"clicking into the field the 'focussed' mode text inside the field is cut off left and
 * > right. To the point where the number field you can't see what you're typing until you
 * > unfocus the field and the number appears."*
 *
 * Blockly positions and sizes `.blocklyHtmlInput` by measuring the field's rendered text on the
 * block and setting the widget div to exactly that box. Its own base rule is `border: none;
 * padding: 0; width: 100%; box-sizing: border-box`, so **anything this repo declares in the box
 * model comes out of the text's own room**: the `1px` border and `4px 8px` padding that used to
 * be here took 18 px out of a box measured at ~10 px for the digit `2`.
 *
 * 🔴 This is a spec about *which declarations exist*, because that is exactly what the defect
 * was — not a value that was too large, but properties that may not be set here at all. The
 * measurement that grades the rendered result is `scrollWidth > clientWidth` on a live field,
 * and it needs a running editor; this is the gate that stops it coming back.
 */
import * as fs from 'fs';
import * as path from 'path';

const SCSS = path.join(
  __dirname,
  '../../src/editor/src/views/BlocklyEditor/BlocklyWorkspace.module.scss'
);

/** The declarations of the rule whose selector list names `.blocklyHtmlInput`. */
function fieldEditorDeclarations(source: string): string[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');

  const selectorIndex = stripped.indexOf('.blocklyHtmlInput');
  expect(selectorIndex).toBeGreaterThan(-1);

  const open = stripped.indexOf('{', selectorIndex);
  const close = stripped.indexOf('}', open);
  expect(open).toBeGreaterThan(-1);
  expect(close).toBeGreaterThan(open);

  return stripped
    .slice(open + 1, close)
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);
}

function property(declaration: string): string {
  return declaration.split(':')[0].trim();
}

function valueOf(declarations: string[], name: string): string | undefined {
  const found = declarations.find((d) => property(d) === name);
  return found?.slice(found.indexOf(':') + 1).replace('!important', '').trim();
}

describe('VFN-002 — the block field editor keeps the box Blockly measured', () => {
  const declarations = fieldEditorDeclarations(fs.readFileSync(SCSS, 'utf8'));
  const properties = declarations.map(property);

  it('declares no padding', () => {
    // `padding: 0` is allowed and is what is there — it restates Blockly's own base rule against
    // anything else in the cascade. Any non-zero padding is the defect.
    expect(valueOf(declarations, 'padding') ?? '0').toBe('0');
    expect(properties).not.toContain('padding-left');
    expect(properties).not.toContain('padding-right');
    expect(properties).not.toContain('padding-inline');
  });

  it('declares no border', () => {
    expect(valueOf(declarations, 'border') ?? 'none').toBe('none');
    expect(properties).not.toContain('border-width');
    expect(properties).not.toContain('border-left');
    expect(properties).not.toContain('border-right');
  });

  it('does not override the font Blockly measured the text with', () => {
    // Blockly applies `FIELD_TEXT_FONTFAMILY` to this input through the renderer stylesheet —
    // the widget div is given the renderer and theme class names when it is shown, precisely so
    // the editor and the measurement agree. Setting a family here breaks that by hand.
    expect(properties).not.toContain('font-family');
    expect(properties).not.toContain('font-size');
    expect(properties).not.toContain('font');
  });

  it('does not resize the box Blockly sized', () => {
    expect(properties).not.toContain('width');
    expect(properties).not.toContain('height');
    expect(properties).not.toContain('min-width');
    expect(properties).not.toContain('margin');
    expect(properties).not.toContain('box-sizing');
  });

  it('still reads as a Noodl control — theme, and a ring that costs no width', () => {
    expect(valueOf(declarations, 'background-color')).toContain('--theme-color-bg-3');
    expect(valueOf(declarations, 'color')).toContain('--theme-color-fg-default');

    // ⚠️ `box-shadow` and not `outline`: Blockly's base rule sets `outline: none` on this element
    // and means it. A shadow does not participate in the box model, which is the whole point.
    //
    // 🔴 `border-control`, not `border-default`. The ratio is measured in
    // `field-editor-contrast.spec.ts`; the short version is that `border-default` against this
    // rule's own `bg-3` fill is 1.01:1, which is a ring the same colour as the thing it rings.
    expect(valueOf(declarations, 'box-shadow')).toContain('--theme-color-border-control');
    expect(properties).not.toContain('outline');
  });

  /**
   * 🔴 NEGATIVE CONTROL. Every assertion above is of the form "this property is absent", and a
   * suite of absences is indistinguishable from a parser that found nothing to read. So run the
   * same parser over the rule exactly as it was when the field was unreadable, and require it to
   * see all three declarations that made it so.
   */
  it('NEGATIVE CONTROL — the same parser sees the defect in the rule as it was', () => {
    const before = `
      .blocklyWidgetDiv input,
      .blocklyHtmlInput {
        background-color: var(--theme-color-bg-3) !important;
        color: var(--theme-color-fg-default) !important;
        border: 1px solid var(--theme-color-border-default) !important;
        border-radius: 4px !important;
        padding: 4px 8px !important;
        font-family: var(--font-family) !important;
      }
    `;

    const wasDeclared = fieldEditorDeclarations(before);
    const wasProperties = wasDeclared.map(property);

    expect(valueOf(wasDeclared, 'padding')).toBe('4px 8px'); // the 8px each side
    expect(valueOf(wasDeclared, 'border')).toBe('1px solid var(--theme-color-border-default)'); // 1px each side
    expect(wasProperties).toContain('font-family');
  });
});
