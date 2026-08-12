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

import {
  runtimeDiagnosticFromWarnings,
  validationTypeForEditType
} from '../../src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType';

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

/**
 * FUN-007 §2 — finding the last run's error among a node's warnings.
 *
 * The runtime has attached `line`, `column` and `hint` to the run-error warning
 * since 2026-08-12 and nothing read them. This is the reader.
 *
 * It matches on the **shape** — a warning that names a line — rather than on the
 * warning key, because the keys are string literals in `simplejavascript.ts`,
 * which this package does not import. FUN-007's own F32 already records what
 * happens to a constant copied across that boundary: two copies that must agree,
 * with nothing to notice when they stop.
 */
describe('CodeEditorType — the last run’s error reaches the gutter (FUN-007 §2)', () => {
  it('finds nothing when the node has no warnings at all', () => {
    expect(runtimeDiagnosticFromWarnings(undefined)).toBe(null);
    expect(runtimeDiagnosticFromWarnings(null)).toBe(null);
    expect(runtimeDiagnosticFromWarnings({})).toBe(null);
    expect(runtimeDiagnosticFromWarnings({ warnings: [] })).toBe(null);
  });

  it('reads the line, column and message off a run error', () => {
    const warnings = {
      warnings: [{ ref: {}, warning: { message: 'Line 2: boom', line: 2, column: 7, level: 'error' } }]
    };

    expect(runtimeDiagnosticFromWarnings(warnings)).toEqual({ line: 2, column: 7, message: 'Line 2: boom' });
  });

  it('ignores a warning that names no line', () => {
    // The "wrote no output" warning is the real instance: it is about the run as
    // a whole, has no line, and belongs on the node rather than in the gutter.
    const warnings = {
      warnings: [
        { ref: {}, warning: { message: 'The script ran but produced no output: "Output_1" stayed empty.' } }
      ]
    };

    expect(runtimeDiagnosticFromWarnings(warnings)).toBe(null);
  });

  it('picks the run error out of a node carrying both kinds', () => {
    const warnings = {
      warnings: [
        { ref: {}, warning: { message: 'The script ran but produced no output.' } },
        { ref: {}, warning: { message: 'Line 1: not defined', line: 1 } }
      ]
    };

    expect(runtimeDiagnosticFromWarnings(warnings)).toEqual({ line: 1, column: undefined, message: 'Line 1: not defined' });
  });

  it('leaves the column undefined when the stack carried none', () => {
    const warnings = { warnings: [{ ref: {}, warning: { message: 'Line 4: boom', line: 4 } }] };
    expect(runtimeDiagnosticFromWarnings(warnings).column).toBe(undefined);
  });

  it('refuses a line that is not a number, rather than anchoring at NaN', () => {
    const warnings = { warnings: [{ ref: {}, warning: { message: 'boom', line: '3' } }] };
    expect(runtimeDiagnosticFromWarnings(warnings)).toBe(null);
  });

  it('refuses a warning with no message — an empty gutter entry says nothing', () => {
    expect(runtimeDiagnosticFromWarnings({ warnings: [{ ref: {}, warning: { line: 1 } }] })).toBe(null);
    expect(runtimeDiagnosticFromWarnings({ warnings: [{ ref: {}, warning: { line: 1, message: '' } }] })).toBe(null);
  });

  it('survives a malformed entry without taking the editor down', () => {
    const warnings = { warnings: [null, undefined, {}, { warning: null }, { ref: {}, warning: { message: 'Line 1: ok', line: 1 } }] };
    expect(runtimeDiagnosticFromWarnings(warnings)).toEqual({ line: 1, column: undefined, message: 'Line 1: ok' });
  });

  it('does not treat the shortMessage summary as a diagnostic', () => {
    // `getWarnings` builds `shortMessage` by joining every warning with `<br>`.
    // Rendering that in the gutter would put HTML and unrelated sentences in it.
    const warnings = { shortMessage: 'one<br>two', warnings: [] };
    expect(runtimeDiagnosticFromWarnings(warnings)).toBe(null);
  });
});
