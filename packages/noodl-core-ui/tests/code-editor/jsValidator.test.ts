/**
 * CED-001 (A9). The validator behind the editor's status chip and error panel had no
 * coverage at all, including the position parsing that A3 rewrote.
 */

import { isSameValidation, validateJavaScript } from '@noodl-core-ui/components/code-editor/utils/jsValidator';

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
});

describe('isSameValidation', () => {
  it('compares every field a caller renders', () => {
    expect(isSameValidation({ valid: true }, { valid: true })).toBe(true);
    expect(isSameValidation({ valid: false, error: 'a' }, { valid: false, error: 'b' })).toBe(false);
    expect(isSameValidation({ valid: false, line: 1 }, { valid: false, line: 2 })).toBe(false);
    expect(isSameValidation({ valid: false, column: 1 }, { valid: false })).toBe(false);
  });
});
