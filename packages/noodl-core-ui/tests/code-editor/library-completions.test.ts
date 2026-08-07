/**
 * ERG-002 §2, finding #4 — completion source for registered-library globals.
 * Wired into `codemirror-extensions.ts` by FH-019; the last block here is what
 * covers the wiring, by going through the registry the editor writes to rather
 * than through the factory.
 *
 * Pinned against a real CodeMirror `EditorState`/`CompletionContext`, the same
 * headless pattern `syntaxDiagnostics.test.ts` uses.
 */
import { javascript } from '@codemirror/lang-javascript';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';

import { setCodeAuthoringContext } from '@noodl-core-ui/components/code-editor/authoringContext';
import {
  createLibraryCompletionSource,
  libraryCompletionSource
} from '@noodl-core-ui/components/code-editor/library-completions';

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

describe('libraryCompletionSource — the one the editor registers', () => {
  afterEach(() => setCodeAuthoringContext(null));

  it('offers nothing for a project with no registered libraries', () => {
    const doc = 'const client = new Pocket';
    expect(libraryCompletionSource(contextAt(doc, doc.length, true))).toBeNull();
  });

  it('completes a library global published by the open project', () => {
    setCodeAuthoringContext({
      libraries: [{ name: 'PocketBase', global: 'PocketBase' }],
      variables: [],
      objects: [],
      arrays: []
    });

    const doc = 'const client = new Pocket';
    const result = libraryCompletionSource(contextAt(doc, doc.length, true));

    expect(result!.options.map((o) => o.label)).toEqual(['PocketBase']);
  });

  it('follows the project it is asked about, with no editor remount', () => {
    // The popout mounts once and outlives any number of Settings changes; this
    // is the property that makes a registry the right shape for FH-019 and a
    // prop the wrong one.
    const doc = 'const x = tiny';

    setCodeAuthoringContext({ libraries: [], variables: [], objects: [], arrays: [] });
    expect(libraryCompletionSource(contextAt(doc, doc.length, true))).toBeNull();

    setCodeAuthoringContext({
      libraries: [{ name: 'tinyMCE', global: 'tinymce' }],
      variables: [],
      objects: [],
      arrays: []
    });
    expect(libraryCompletionSource(contextAt(doc, doc.length, true))!.options.map((o) => o.label)).toEqual(['tinymce']);
  });
});
