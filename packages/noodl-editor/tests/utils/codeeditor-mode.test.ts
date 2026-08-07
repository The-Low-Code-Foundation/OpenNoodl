/**
 * AIX-005 residual — which mode a `codeeditor` port opens in.
 *
 * The recorded defect was "the object popout is titled EXPRESSION". That
 * particular popout is gone: ERG-003 routed `array` and `object` ports to
 * `ListValueType`'s JSON editor, so they no longer reach `CodeEditorType` at
 * all. The *class* of defect survived it — the mode was derived from
 * `codeeditor === 'json'` and nothing else, so every port declaring any other
 * language got JavaScript-expression validation under a toolbar reading
 * **EXPRESSION**. Three real ports do that today:
 *
 * | Port | Node | `codeeditor` |
 * |------|------|--------------|
 * | `style`    | CSS Definition (`css-definition.ts`)   | `css`  |
 * | `styleCss` | every visual node (`react-component-node.ts`) | `text` |
 * | `csv`      | Static Data (`staticdata.ts`)          | `text` |
 * | `headCode` | project settings (`project-settings.ts`) | `html` |
 *
 * These rows pin the mapping against those declarations. The consequence of
 * the mapping — label, placeholder, and the absence of a JavaScript verdict —
 * is pinned in core-ui's `modes.test.ts`, which runs under jest and can import
 * the component's own helpers. (It was `jsValidator.test.ts` until FH-017
 * slice 2 deleted that module along with the second error system in it.)
 *
 * describe/it/expect are Jasmine globals here; the editor suite is not jest.
 */

import { validationTypeForEditType } from '../../src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType';

describe('CodeEditorType — the port language decides the mode (AIX-005)', () => {
  it('opens a CSS port as CSS, not as a JavaScript expression', () => {
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'css' })).toBe('css');
  });

  it('opens the text ports (styleCss, Static Data CSV) as text', () => {
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'text' })).toBe('text');
  });

  it('opens the Head Code port as HTML', () => {
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'html' })).toBe('html');
  });

  it('still opens a JSON port as JSON', () => {
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'json' })).toBe('json');
  });

  it('keeps the name-based guess for the three JavaScript modes', () => {
    // The only signal available for "which wrapping does the validator accept".
    expect(validationTypeForEditType({ name: 'stringWithExpression', codeeditor: 'javascript' })).toBe('expression');
    expect(validationTypeForEditType({ name: 'scriptString', codeeditor: 'javascript' })).toBe('script');
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'javascript' })).toBe('function');
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'typescript' })).toBe('function');
  });

  it('falls back to expression for a language it does not know', () => {
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'brainfuck' })).toBe('expression');
    expect(validationTypeForEditType(undefined)).toBe('expression');
  });
});
