/**
 * CED-001 (A8/A9). Format, history restore and external sync each used to dispatch a
 * whole-document replace, so one Cmd-Z discarded the entire session.
 */

import { EditorState } from '@codemirror/state';

import { minimalChange } from '@noodl-core-ui/components/code-editor/utils/textChange';

/** Apply a computed change and read the document back. */
function apply(current: string, next: string): string {
  const change = minimalChange(current, next);
  if (!change) {
    return current;
  }

  const state = EditorState.create({ doc: current });
  return state.update({ changes: change }).state.doc.toString();
}

describe('minimalChange', () => {
  it('reports nothing to do when the text is identical', () => {
    expect(minimalChange('const a = 1;', 'const a = 1;')).toBeNull();
    expect(minimalChange('', '')).toBeNull();
  });

  it('touches only the differing span', () => {
    expect(minimalChange('const a = 1;', 'const a = 2;')).toEqual({ from: 10, to: 11, insert: '2' });
  });

  it('describes a pure insertion as an empty range', () => {
    expect(minimalChange('ab', 'axb')).toEqual({ from: 1, to: 1, insert: 'x' });
  });

  it('describes a pure deletion as an empty insert', () => {
    expect(minimalChange('axb', 'ab')).toEqual({ from: 1, to: 2, insert: '' });
  });

  it('leaves shared indentation alone when a line is re-indented', () => {
    const change = minimalChange('function f() {\nreturn 1;\n}', 'function f() {\n  return 1;\n}');
    expect(change).toEqual({ from: 15, to: 15, insert: '  ' });
  });

  it('produces the target document for every shape of edit', () => {
    const cases: Array<[string, string]> = [
      ['', 'hello'],
      ['hello', ''],
      ['abc', 'cba'],
      ['const total = 1;', 'const total = 1;\nconst tax = 0.2;'],
      ['line one\nline two\nline three', 'line one\nline three'],
      ['🙂 ok', '🙃 ok']
    ];

    for (const [current, next] of cases) {
      expect(apply(current, next)).toBe(next);
    }
  });
});
