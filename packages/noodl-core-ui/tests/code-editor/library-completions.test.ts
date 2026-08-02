/**
 * ERG-002 §2, finding #4 — completion source for registered-library globals.
 * Not wired into `codemirror-extensions.ts` (see the module doc on
 * `library-completions.ts`); this pins the source itself against a real
 * CodeMirror `EditorState`/`CompletionContext`, the same headless pattern
 * `syntaxDiagnostics.test.ts` uses.
 */
import { javascript } from '@codemirror/lang-javascript';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import { createLibraryCompletionSource } from '@noodl-core-ui/components/code-editor/library-completions';

function contextAt(doc: string, pos: number, explicit = false): CompletionContext {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  return new CompletionContext(state, pos, explicit);
}

describe('createLibraryCompletionSource', () => {
  it('returns null when there are no registered libraries', () => {
    const source = createLibraryCompletionSource([]);
    const result = source(contextAt('Pocket', 6, true));
    expect(result).toBeNull();
  });

  it('completes a registered library global by prefix', () => {
    const source = createLibraryCompletionSource([{ name: 'PocketBase', global: 'PocketBase' }]);
    const doc = 'const client = new Pocket';
    const result = source(contextAt(doc, doc.length, true));

    expect(result).not.toBeNull();
    expect(result!.options.map((o) => o.label)).toContain('PocketBase');
  });

  it('does not offer completions for a non-matching prefix', () => {
    const source = createLibraryCompletionSource([{ name: 'PocketBase', global: 'PocketBase' }]);
    const doc = 'const client = new tiny';
    const result = source(contextAt(doc, doc.length, true));

    expect(result === null || result.options.length === 0).toBe(true);
  });

  it('excludes a library with no verified global yet (empty string)', () => {
    const source = createLibraryCompletionSource([{ name: 'Draft library', global: '' }]);
    const result = source(contextAt('Dr', 2, true));
    expect(result).toBeNull();
  });

  it('offers every registered global on an explicit empty-word request', () => {
    const source = createLibraryCompletionSource([
      { name: 'PocketBase', global: 'PocketBase' },
      { name: 'tinyMCE', global: 'tinymce' }
    ]);
    const doc = 'const x = ';
    const result = source(contextAt(doc, doc.length, true));

    expect(result).not.toBeNull();
    expect(result!.options.map((o) => o.label).sort()).toEqual(['PocketBase', 'tinymce']);
  });
});
