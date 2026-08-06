/**
 * What the code editor offers, and why.
 *
 * Two regressions are pinned here.
 *
 * **FH-017 slice 1** — the source guarded on `word.from === word.to &&
 * !context.explicit`, which is true of *every* position after a `.`, so the
 * `Noodl.` branch below it was unreachable except by Ctrl-Space. CED-001's QA
 * only ever typed `Noodl.V`, where the word is one character long and the guard
 * does not fire — which is exactly why nobody saw it. `explicit = false` in
 * these cases is load-bearing: it is what "typing" means.
 *
 * **FH-019** — every name offered came from a 25-element literal array. The
 * cases below that name a *mode* are the ones that array could not have passed:
 * it offered one conflated list to Expression and Function nodes alike, so it
 * was simultaneously offering `round` where it is undefined and hiding
 * `Noodl.Records` where it exists.
 */
import { CompletionContext } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { EditorState } from '@codemirror/state';

import { setCodeAuthoringContext } from '@noodl-core-ui/components/code-editor/authoringContext';
import { createNoodlCompletionSource } from '@noodl-core-ui/components/code-editor/noodl-completions';
import type { ValidationType } from '@noodl-core-ui/components/code-editor/utils/types';

function contextAt(doc: string, pos: number = doc.length, explicit = false): CompletionContext {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  return new CompletionContext(state, pos, explicit);
}

function labelsFor(doc: string, explicit = false, mode: ValidationType = 'function'): string[] | null {
  const result = createNoodlCompletionSource(mode)(contextAt(doc, doc.length, explicit));
  return result ? result.options.map((option) => option.label) : null;
}

describe('noodlCompletionSource', () => {
  afterEach(() => setCodeAuthoringContext(null));

  describe('after `Noodl.`', () => {
    it('completes the namespace while typing, with no explicit request', () => {
      expect(labelsFor('Noodl.')).toContain('Variables');
    });

    it('still completes it mid-statement', () => {
      expect(labelsFor('const count = Noodl.')).toContain('Variables');
    });

    it('keeps offering the namespace once a letter is typed — CM does the filtering', () => {
      expect(labelsFor('Noodl.V')).toContain('Variables');
    });

    it('anchors the completion at the character after the dot', () => {
      const doc = 'Noodl.';
      const result = createNoodlCompletionSource('function')(contextAt(doc));
      expect(result!.from).toBe(doc.length);
    });

    it('offers the whole API in a Function node, not three properties', () => {
      const labels = labelsFor('Noodl.')!;
      expect(labels).toEqual(expect.arrayContaining(['Records', 'Users', 'CloudFunctions', 'Navigation', 'Files']));
    });

    it('offers only what an Expression actually has', () => {
      // `createNoodlContext()` returns four properties and nothing else.
      expect(labelsFor('Noodl.', false, 'expression')).toEqual(['Variables', 'Objects', 'Arrays', 'Object']);
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

  describe('after `Inputs.` / `Outputs.`', () => {
    it('lists the inputs this script actually uses', () => {
      const doc = 'const a = Inputs.customerName;\nconst b = Inputs.itemCount;\nInputs.';
      expect(labelsFor(doc)).toEqual(['customerName', 'itemCount']);
    });

    it('changes when a port is renamed, because renaming it is the same edit', () => {
      expect(labelsFor('Inputs.customerName;\nInputs.')).toEqual(['customerName']);
      expect(labelsFor('Inputs.clientName;\nInputs.')).toEqual(['clientName']);
    });

    it('reads the bracket form the runtime also mines', () => {
      expect(labelsFor('Inputs["first name"];\nInputs.')).toEqual(['first name']);
    });

    it('lists outputs, and marks the ones called as signals', () => {
      const doc = 'Outputs.total = 1;\nOutputs.Done();\nOutputs.';
      const result = createNoodlCompletionSource('function')(contextAt(doc))!;

      expect(result.options.map((o) => o.label)).toEqual(['Done', 'total']);
      expect(result.options.find((o) => o.label === 'Done')!.type).toBe('function');
      expect(result.options.find((o) => o.label === 'total')!.type).toBe('variable');
    });

    it('offers nothing for a script that has not named a port yet', () => {
      expect(labelsFor('Inputs.')).toBeNull();
    });

    it('does not answer in an Expression, which has no Inputs object', () => {
      expect(labelsFor('Inputs.customerName;\nInputs.', false, 'expression')).toBeNull();
    });
  });

  describe('after `Noodl.Variables.`', () => {
    it('offers nothing when no project has been published', () => {
      expect(labelsFor('Noodl.Variables.')).toBeNull();
    });

    it('completes the project’s real variable names', () => {
      setCodeAuthoringContext({ libraries: [], variables: ['cartTotal', 'userName'], objects: [], arrays: [] });
      expect(labelsFor('Noodl.Variables.')).toEqual(['cartTotal', 'userName']);
    });

    it('completes objects and arrays from their own lists', () => {
      setCodeAuthoringContext({ libraries: [], variables: [], objects: ['session'], arrays: ['todos'] });
      expect(labelsFor('Noodl.Objects.')).toEqual(['session']);
      expect(labelsFor('Noodl.Arrays.')).toEqual(['todos']);
    });

    it('takes the bare `Variables.` form in an Expression, where it is a real global', () => {
      setCodeAuthoringContext({ libraries: [], variables: ['cartTotal'], objects: [], arrays: [] });
      expect(labelsFor('Variables.', false, 'expression')).toEqual(['cartTotal']);
    });

    it('refuses the bare form in a Function, where `Variables` is not defined', () => {
      setCodeAuthoringContext({ libraries: [], variables: ['cartTotal'], objects: [], arrays: [] });
      expect(labelsFor('Variables.', false, 'function')).toBeNull();
    });
  });

  describe('at top level', () => {
    it('completes the Noodl namespace itself', () => {
      expect(labelsFor('Nood')).toEqual(['Noodl']);
    });

    it('offers nothing at an empty position while typing', () => {
      expect(labelsFor('const x = ')).toBeNull();
    });

    it('offers what a Function node is compiled with when asked explicitly', () => {
      // `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', …)`.
      expect(labelsFor('const x = ', true)).toEqual(['Inputs', 'Outputs', 'Noodl', 'Component', 'Script']);
    });

    it('offers the maths helpers in an Expression, where they are parameters', () => {
      expect(labelsFor('ro', false, 'expression')).toContain('round');
    });

    it('does not offer them in a Function, where `round` is undefined', () => {
      expect(labelsFor('ro', false, 'function')).toBeNull();
    });

    it('does not offer `State` or `Props`, which are in scope nowhere', () => {
      const everything = [
        ...(labelsFor('', true, 'function') ?? []),
        ...(labelsFor('', true, 'expression') ?? [])
      ];
      expect(everything).not.toContain('State');
      expect(everything).not.toContain('Props');
    });
  });
});
