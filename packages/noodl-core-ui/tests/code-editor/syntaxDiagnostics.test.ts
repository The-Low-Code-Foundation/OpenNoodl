/**
 * CED-001 (A3/A9). Diagnostics used to come from regexing a `new Function` error
 * message for `line (\d+)`, which V8 almost never emits — so the position was
 * `undefined` and the squiggle, had the linter ever been wired up, spanned the whole
 * document. They now come from the parse tree the language extension already builds.
 */

import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { EditorState, type Extension } from '@codemirror/state';

import { syntaxDiagnostics } from '@noodl-core-ui/components/code-editor/utils/syntaxDiagnostics';

function diagnose(doc: string, language: Extension = javascript()) {
  return syntaxDiagnostics(EditorState.create({ doc, extensions: [language] }));
}

describe('syntaxDiagnostics', () => {
  it('finds nothing wrong with valid code', () => {
    expect(diagnose('const total = Inputs.a + Inputs.b;')).toEqual([]);
    expect(diagnose('for (let i = 0; i < n; i++) {\n  sum += i;\n}')).toEqual([]);
    expect(diagnose('')).toEqual([]);
  });

  it('does not span the whole document', () => {
    const doc = 'const a = 1;\nconst b = ;\nconst c = 3;\nconst d = 4;\nconst e = 5;';
    const [first] = diagnose(doc);

    expect(first).toBeDefined();
    expect(first.to - first.from).toBeLessThan(doc.length);
  });

  it('points at the offending line, not line one', () => {
    const doc = 'const a = 1;\nconst b = 2;\nconst c = ;';
    const state = EditorState.create({ doc, extensions: [javascript()] });
    const [first] = syntaxDiagnostics(state);

    expect(first).toBeDefined();
    expect(state.doc.lineAt(first.from).number).toBe(3);
  });

  it('always draws something, even where the parser failed between tokens', () => {
    for (const diagnostic of diagnose('function f() {\n  return ;\n}')) {
      expect(diagnostic.to).toBeGreaterThan(diagnostic.from);
    }
  });

  it('reports an unclosed brace at the end of input', () => {
    const doc = 'function f() {\n  return 1;';
    const diagnostics = diagnose(doc);

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].from).toBeGreaterThan(0);
  });

  it('merges the run of errors one mistake produces', () => {
    // A single stray token can leave the parser confused for a while; that reads as
    // one problem, not five.
    const diagnostics = diagnose('const a = { , , , };');
    expect(diagnostics.length).toBeLessThanOrEqual(4);
  });

  it('works for JSON too', () => {
    expect(diagnose('{ "a": 1 }', json())).toEqual([]);
    expect(diagnose('{ "a": }', json()).length).toBeGreaterThan(0);
  });
});
