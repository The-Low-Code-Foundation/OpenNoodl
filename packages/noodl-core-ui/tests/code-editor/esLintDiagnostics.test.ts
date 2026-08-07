/**
 * FH-017 slice 3 — one linter, real messages, more than one at a time.
 *
 * What replaced what: the toolbar's verdict used to come from a synchronous
 * `new Function()` that threw on the first problem and therefore could never
 * report a second, while the squiggles came from a Lezer error walk that only
 * ever said "Unexpected token". These cases pin the behaviour that was bought
 * with the `eslint-linter-browserify` dependency — and the two limits that were
 * *not*, which are recorded here so nobody re-discovers them as bugs.
 */
import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';

import { setCodeAuthoringContext } from '@noodl-core-ui/components/code-editor/authoringContext';
import { javascriptDiagnostics, lintMessages } from '@noodl-core-ui/components/code-editor/utils/esLintDiagnostics';

function stateFor(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [javascript()] });
}

describe('lintMessages', () => {
  describe('modes with no JavaScript in them', () => {
    it.each(['css', 'html', 'text', 'json'] as const)('reports nothing for %s', (mode) => {
      expect(lintMessages('background-color: red;', mode)).toEqual([]);
    });

    it('reports nothing for an empty document', () => {
      expect(lintMessages('', 'function')).toEqual([]);
      expect(lintMessages('   \n  ', 'function')).toEqual([]);
    });
  });

  describe('expression mode', () => {
    it('accepts an object literal, which is not a valid *program* unwrapped', () => {
      expect(lintMessages("{ Authorization: 'Bearer x', ContentType: 'json' }", 'expression')).toEqual([]);
    });

    it('accepts an array literal and a ternary', () => {
      expect(lintMessages("['a', 'b']", 'expression')).toEqual([]);
      expect(lintMessages('a ? b : c', 'expression')).toEqual([]);
    });

    it('never reports an unknown identifier — in an expression they become inputs', () => {
      const messages = lintMessages('customerTotal * vatRate', 'expression');
      expect(messages).toEqual([]);
    });

    it('reports a syntax error on the author’s own line, not the wrapper’s', () => {
      const messages = lintMessages('(1 + 2', 'expression');
      expect(messages).toHaveLength(1);
      expect(messages[0].line).toBe(1);
      expect(messages[0].severity).toBe('error');
    });

    it('reports a multi-line expression’s error on the right line', () => {
      const messages = lintMessages('1 +\n2 +\n(3 * ', 'expression');
      expect(messages[0].line).toBe(3);
    });
  });

  describe('function mode', () => {
    it('accepts the identifiers the runtime injects', () => {
      // `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', …)` —
      // simplejavascript.ts:447.
      const code = 'Outputs.total = Inputs.a + Inputs.b;\nNoodl.Variables.seen = true;\nconst c = Component;';
      expect(lintMessages(code, 'function')).toEqual([]);
    });

    it('accepts a top-level return — a node’s code is a function body', () => {
      expect(lintMessages('const a = 1;\nreturn a;', 'function')).toEqual([]);
    });

    it('accepts browser globals', () => {
      expect(lintMessages('console.log(window.location.href); fetch("/x");', 'function')).toEqual([]);
    });

    it('catches a typo’d identifier, at its column, as a warning', () => {
      const messages = lintMessages('const total = Inputs.amount;\nOutputs.result = totl;', 'function');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        line: 2,
        severity: 'warning',
        ruleId: 'no-undef'
      });
      expect(messages[0].message).toContain('totl');
      expect(messages[0].column).toBe('Outputs.result = '.length + 1);
    });

    it('reports two independent problems at once — the thing one `new Function` could not', () => {
      const messages = lintMessages('const a = { x: 1, x: 2 };\nconst b = { y: 1, y: 2 };\nOutputs.o = [a, b];', 'function');

      const duplicates = messages.filter((message) => message.ruleId === 'no-dupe-keys');
      expect(duplicates).toHaveLength(2);
      expect(duplicates.map((message) => message.line)).toEqual([1, 2]);
    });

    it('reports assigning to a const as an error, not a warning', () => {
      const messages = lintMessages('const a = 1;\na = 2;\nOutputs.o = a;', 'function');
      const constAssign = messages.find((message) => message.ruleId === 'no-const-assign');

      expect(constAssign).toBeDefined();
      expect(constAssign!.severity).toBe('error');
      expect(constAssign!.line).toBe(2);
    });

    it('says what is wrong, without the "Parsing error:" label', () => {
      const messages = lintMessages('const x = ;', 'function');
      expect(messages[0].message).not.toMatch(/^Parsing error/);
      expect(messages[0].message).toContain('Unexpected token');
    });
  });

  describe('the limits, recorded on purpose', () => {
    it('reports an unterminated block at end-of-input, like every other parser', () => {
      // Not a defect and not fixable by swapping linters: acorn, Lezer and
      // TypeScript all fail an unclosed brace at EOF rather than at the brace.
      // FH-017's criterion 3 assumed otherwise.
      const messages = lintMessages('function f() {\nconst a = 1;\nconst b = 2;', 'function');
      expect(messages).toHaveLength(1);
      expect(messages[0].line).toBe(3);
    });

    it('stops at the first *syntax* error — only rule violations come in plural', () => {
      const messages = lintMessages('const a = ;\nconst b = ;', 'function');
      expect(messages).toHaveLength(1);
    });
  });
});

describe('javascriptDiagnostics', () => {
  it('produces a range that can actually be drawn', () => {
    const state = stateFor('function f() {\nreturn 1;');
    const [diagnostic] = javascriptDiagnostics(state, 'function');

    expect(diagnostic).toBeDefined();
    expect(diagnostic.to).toBeGreaterThan(diagnostic.from);
  });

  it('anchors a diagnostic at the offending text', () => {
    const doc = 'const total = 1;\nOutputs.result = totl;';
    const state = stateFor(doc);
    const [diagnostic] = javascriptDiagnostics(state, 'function');

    expect(state.doc.sliceString(diagnostic.from, diagnostic.to)).toBe('totl');
  });

  it('carries the rule name so the panel can show where a claim comes from', () => {
    const state = stateFor('Outputs.x = totl;');
    const [diagnostic] = javascriptDiagnostics(state, 'function');

    expect(diagnostic.source).toBe('eslint:no-undef');
  });

  it('leaves JSON to the parse-tree walk', () => {
    const state = EditorState.create({ doc: '{ a: 1 }' });
    expect(javascriptDiagnostics(state, 'json')).toEqual([]);
  });
});

/**
 * FH-019 — the half of ERG-002 §2 finding #4 that is not completion. A
 * registered library's global is a real `window` property once the app runs, so
 * `no-undef` reporting it was the linter being confidently wrong about working
 * code.
 */
describe('a registered library’s global', () => {
  afterEach(() => setCodeAuthoringContext(null));

  it('is reported as undefined when the project has no such library', () => {
    const messages = lintMessages('const c = new PocketBase();', 'function');
    expect(messages.map((m) => m.ruleId)).toContain('no-undef');
  });

  it('is accepted once the open project has registered it', () => {
    setCodeAuthoringContext({
      libraries: [{ name: 'PocketBase', global: 'PocketBase' }],
      variables: [],
      objects: [],
      arrays: []
    });

    expect(lintMessages('const c = new PocketBase();', 'function')).toEqual([]);
  });

  it('is re-read per lint pass, so registering one fixes an editor already open', () => {
    const code = 'tinymce.init({});';
    expect(lintMessages(code, 'function').length).toBeGreaterThan(0);

    setCodeAuthoringContext({
      libraries: [{ name: 'tinyMCE', global: 'tinymce' }],
      variables: [],
      objects: [],
      arrays: []
    });

    expect(lintMessages(code, 'function')).toEqual([]);
  });
});
