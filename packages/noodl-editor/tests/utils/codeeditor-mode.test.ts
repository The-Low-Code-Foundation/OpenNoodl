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
 * ## The JavaScript half (FUN-009)
 *
 * The three JavaScript modes used to be guessed from `type.name`, and the guess
 * could never fire — `type.name` is `'string'` for all three code ports, so
 * Function, Script and Expression all opened as **FUNCTION**. The mode is now
 * declared by the port as `type.codenotation`; the three declarations are
 * pinned in `noodl-viewer-react/tests/fun-009-code-notation.test.ts`, which can
 * read the node definitions this suite cannot reach.
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

  it('takes the JavaScript mode from the port declaration (FUN-009)', () => {
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'javascript', codenotation: 'expression' })).toBe(
      'expression'
    );
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'javascript', codenotation: 'script' })).toBe(
      'script'
    );
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'javascript', codenotation: 'function' })).toBe(
      'function'
    );
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'typescript', codenotation: 'script' })).toBe(
      'script'
    );
  });

  it('ignores the type name, which is what made the old guess dead code (FUN-009)', () => {
    // The rows this replaces asserted `stringWithExpression` → expression and
    // `scriptString` → script. No port in the product has either name: all three
    // JavaScript code ports declare `type.name = 'string'`, so both branches were
    // unreachable and every one of them opened as `function` — an Expression node
    // included, where `no-undef` then underlined the identifiers that *are* its
    // input ports. A spec that only exercises invented inputs cannot see that.
    expect(validationTypeForEditType({ name: 'stringWithExpression', codeeditor: 'javascript' })).toBe('function');
    expect(validationTypeForEditType({ name: 'scriptString', codeeditor: 'javascript' })).toBe('function');
  });

  it('leaves an undeclared JavaScript port where it already was', () => {
    // The compatibility floor. `mapScript`, `storageJSONFilter` and the REST node's
    // two scripts declare no notation; they resolved to `function` before FUN-009
    // and still do. Changing that is a separate decision about four real ports
    // (FUN-009 F35), not a side effect of giving three other ports a voice.
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'javascript' })).toBe('function');
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'typescript' })).toBe('function');
    // An unrecognised notation is not a licence to invent one.
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'javascript', codenotation: 'lisp' })).toBe(
      'function'
    );
  });

  it('falls back to expression for a language it does not know', () => {
    expect(validationTypeForEditType({ name: 'string', codeeditor: 'brainfuck' })).toBe('expression');
    expect(validationTypeForEditType(undefined)).toBe('expression');
  });
});
