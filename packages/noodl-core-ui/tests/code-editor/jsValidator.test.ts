/**
 * CED-001 (A9). The validator behind the editor's status chip and error panel had no
 * coverage at all, including the position parsing that A3 rewrote.
 */

import {
  isSameValidation,
  isValidatedType,
  validateJavaScript
} from '@noodl-core-ui/components/code-editor/utils/jsValidator';
import { defaultPlaceholder, modeLabel } from '@noodl-core-ui/components/code-editor/utils/modes';

describe('validateJavaScript', () => {
  describe('expression', () => {
    it('accepts an expression', () => {
      expect(validateJavaScript('Noodl.Variables.count * 2', 'expression').valid).toBe(true);
      expect(validateJavaScript('a ? b : c', 'expression').valid).toBe(true);
    });

    it('accepts an object literal, which is what array/object ports carry', () => {
      // CodeEditorType routes those ports here rather than to `json`, deliberately:
      // `{ Authorization: 'Bearer x' }` is a good object literal and bad JSON.
      expect(validateJavaScript("{ Authorization: 'Bearer x' }", 'expression').valid).toBe(true);
      expect(validateJavaScript("['a', 'b']", 'expression').valid).toBe(true);
    });

    it('treats empty input as valid', () => {
      expect(validateJavaScript('', 'expression').valid).toBe(true);
      expect(validateJavaScript('   ', 'expression').valid).toBe(true);
    });

    it('rejects a statement, which is not an expression', () => {
      expect(validateJavaScript('const a = 1;', 'expression').valid).toBe(false);
    });

    it('rejects unbalanced brackets with a suggestion', () => {
      const result = validateJavaScript('(1 + 2', 'expression');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.suggestion).toBeTruthy();
    });
  });

  describe('function and script', () => {
    it('accepts a function body', () => {
      expect(validateJavaScript('Outputs.total = Inputs.a + Inputs.b;', 'function').valid).toBe(true);
      expect(validateJavaScript('const a = 1;\nreturn a;', 'function').valid).toBe(true);
    });

    it('rejects a broken body', () => {
      expect(validateJavaScript('function f() {', 'function').valid).toBe(false);
      expect(validateJavaScript('const = ;', 'script').valid).toBe(false);
    });

    it('treats script the same as function', () => {
      const code = 'if (Inputs.on) { Outputs.value = 1; }';
      expect(validateJavaScript(code, 'script')).toEqual(validateJavaScript(code, 'function'));
    });
  });

  describe('json', () => {
    it('accepts well-formed JSON and rejects a JS object literal', () => {
      expect(validateJavaScript('{ "a": 1 }', 'json').valid).toBe(true);
      expect(validateJavaScript('{ a: 1 }', 'json').valid).toBe(false);
    });

    it('turns the offset V8 reports into a real line and column', () => {
      // The old parser regexed for `line (\d+)`, which V8 does not emit, and assigned
      // the *document offset* from `position (\d+)` to `column`. V8 only supplies a
      // position for some error classes; where it does not, the editor fills the
      // position in from the parse tree instead (see `firstErrorPosition`).
      const result = validateJavaScript('{\n  "a": 1\n}\nextra', 'json');

      expect(result.valid).toBe(false);
      expect(result.line).toBe(4);
      expect(result.column).toBe(1);
    });

    it('treats empty input as valid', () => {
      expect(validateJavaScript('', 'json').valid).toBe(true);
    });
  });

  it('rejects an unknown validation type', () => {
    expect(validateJavaScript('1', 'nonsense' as never).valid).toBe(false);
  });

  /**
   * AIX-005 residual. Every `codeeditor` port that was not `json` used to be
   * validated as a JavaScript expression, so the CSS Definition node's `style`
   * — a port that exists to hold a stylesheet — reported a syntax error on the
   * first declaration typed into it.
   */
  describe('the modes with no validator', () => {
    it('does not fail CSS, HTML or CSV as JavaScript', () => {
      expect(validateJavaScript('background-color: red;', 'css').valid).toBe(true);
      expect(validateJavaScript('.card { padding: 8px }', 'css').valid).toBe(true);
      expect(validateJavaScript('<meta name="x" content="y">', 'html').valid).toBe(true);
      expect(validateJavaScript('name,age\nAda,36', 'text').valid).toBe(true);
    });

    it('every one of them is the same JavaScript the expression validator refuses', () => {
      expect(validateJavaScript('background-color: red;', 'expression').valid).toBe(false);
      expect(validateJavaScript('name,age\nAda,36', 'expression').valid).toBe(false);
    });

    it('says it has no verdict, so nothing claims the text was checked', () => {
      expect(isValidatedType('css')).toBe(false);
      expect(isValidatedType('html')).toBe(false);
      expect(isValidatedType('text')).toBe(false);

      expect(isValidatedType('expression')).toBe(true);
      expect(isValidatedType('function')).toBe(true);
      expect(isValidatedType('script')).toBe(true);
      expect(isValidatedType('json')).toBe(true);
    });
  });
});

describe('editor modes', () => {
  it('names every mode after what it holds, never "Expression" by default', () => {
    expect(modeLabel('expression')).toBe('Expression');
    expect(modeLabel('function')).toBe('Function');
    expect(modeLabel('script')).toBe('Script');
    expect(modeLabel('json')).toBe('JSON');
    expect(modeLabel('css')).toBe('CSS');
    expect(modeLabel('html')).toBe('HTML');
    expect(modeLabel('text')).toBe('Text');
  });

  it('does not invite JavaScript into a port that cannot hold any', () => {
    expect(defaultPlaceholder('css').indexOf('JavaScript')).toBe(-1);
    expect(defaultPlaceholder('html').indexOf('JavaScript')).toBe(-1);
    expect(defaultPlaceholder('text')).toBe('');
    expect(defaultPlaceholder('json')).toBe('{}');
  });
});

describe('isSameValidation', () => {
  it('compares every field a caller renders', () => {
    expect(isSameValidation({ valid: true }, { valid: true })).toBe(true);
    expect(isSameValidation({ valid: false, error: 'a' }, { valid: false, error: 'b' })).toBe(false);
    expect(isSameValidation({ valid: false, line: 1 }, { valid: false, line: 2 })).toBe(false);
    expect(isSameValidation({ valid: false, column: 1 }, { valid: false })).toBe(false);
  });
});
