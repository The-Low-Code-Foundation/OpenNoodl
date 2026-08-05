/**
 * FH-017 slice 1 — `Noodl.` completes while you type.
 *
 * The regression this pins: the source guarded on `word.from === word.to &&
 * !context.explicit`, which is true of *every* position after a `.`, so the
 * `Noodl.` branch below it was unreachable except by Ctrl-Space. CED-001's QA
 * only ever typed `Noodl.V`, where the word is one character long and the guard
 * does not fire — which is exactly why nobody saw it.
 *
 * `explicit = false` in these cases is load-bearing. It is what "typing" means.
 */
import { CompletionContext } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';

import { noodlCompletionSource } from '@noodl-core-ui/components/code-editor/noodl-completions';

function contextAt(doc: string, pos: number = doc.length, explicit = false): CompletionContext {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  return new CompletionContext(state, pos, explicit);
}

function labelsFor(doc: string, explicit = false): string[] | null {
  const result = noodlCompletionSource(contextAt(doc, doc.length, explicit));
  return result ? result.options.map((option) => option.label) : null;
}

describe('noodlCompletionSource', () => {
  describe('after `Noodl.`', () => {
    it('completes the namespace while typing, with no explicit request', () => {
      expect(labelsFor('Noodl.')).toEqual(['Variables', 'Objects', 'Arrays']);
    });

    it('still completes it mid-statement', () => {
      expect(labelsFor('const count = Noodl.')).toEqual(['Variables', 'Objects', 'Arrays']);
    });

    it('keeps offering the namespace once a letter is typed — CM does the filtering', () => {
      expect(labelsFor('Noodl.V')).toContain('Variables');
    });

    it('anchors the completion at the character after the dot', () => {
      const doc = 'Noodl.';
      const result = noodlCompletionSource(contextAt(doc));
      expect(result!.from).toBe(doc.length);
    });
  });

  describe('after somebody else’s dot', () => {
    it('offers nothing — `Math.min` is not a member of your array', () => {
      expect(labelsFor('myArray.')).toBeNull();
      expect(labelsFor('response.data.')).toBeNull();
    });

    it('stays quiet even on an explicit request', () => {
      expect(labelsFor('myArray.', true)).toBeNull();
    });
  });

  describe('at top level', () => {
    it('completes the Noodl namespace itself', () => {
      expect(labelsFor('Nood')).toEqual(['Noodl']);
    });

    it('falls back to the general list on a shorter prefix', () => {
      // `Noo` is not `nood`, so it takes the prefix filter — which is where the
      // dotted `Noodl.Variables` labels live.
      expect(labelsFor('Noo')).toEqual(['Noodl.Variables', 'Noodl.Objects', 'Noodl.Arrays']);
    });

    it('completes a math helper by prefix', () => {
      expect(labelsFor('const x = ro')).toContain('round');
    });

    it('offers nothing at an empty position while typing', () => {
      expect(labelsFor('const x = ')).toBeNull();
    });

    it('offers the list at an empty position when asked explicitly', () => {
      const labels = labelsFor('const x = ', true);
      expect(labels).toContain('Inputs');
      expect(labels).toContain('Outputs');
    });
  });
});
