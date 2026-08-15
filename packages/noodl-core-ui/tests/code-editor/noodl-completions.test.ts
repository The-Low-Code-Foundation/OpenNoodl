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

import { setCodeAuthoringContext, setOpenNodeContext } from '@noodl-core-ui/components/code-editor/authoringContext';
import { createNoodlCompletionSource } from '@noodl-core-ui/components/code-editor/noodl-completions';
import type { ValidationType } from '@noodl-core-ui/components/code-editor/utils/types';

function contextAt(doc: string, pos: number = doc.length, explicit = false): CompletionContext {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  return new CompletionContext(state, pos, explicit);
}

function openFunctionNode(inputs: string[], outputs: { name: string; type: string }[]) {
  setOpenNodeContext({
    nodeId: 'n1',
    typeName: 'JavaScriptFunction',
    declaredInputs: inputs.map((name) => ({ name, type: 'string' })),
    declaredOutputs: outputs
  });
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

  /**
   * FIX-017 §B. `Noodl.` has listed `Records` since FH-019, and `Noodl.Records.`
   * then answered nothing — the editor named a thing and went blank when the
   * user followed its advice. These pin the second level, and just as
   * importantly the four places it must *not* answer.
   */
  describe('a second level under `Noodl.` (FIX-017 §B)', () => {
    it('answers `Noodl.Records.` — the literal complaint', () => {
      expect(labelsFor('Noodl.Records.')).toEqual(
        expect.arrayContaining(['query', 'create', 'save', 'delete'])
      );
    });

    it('carries the call signature in `info`, not just the name', () => {
      const result = createNoodlCompletionSource('function')(contextAt('Noodl.Records.'))!;
      const query = result.options.find((option) => option.label === 'query')!;

      expect(query.info).toContain('query(className, query, options)');
    });

    it('answers for the other namespaces `Noodl.` advertises', () => {
      expect(labelsFor('Noodl.Users.')).toEqual(expect.arrayContaining(['logIn', 'signUp', 'Current']));
      expect(labelsFor('Noodl.CloudFunctions.')).toEqual(['run']);
      expect(labelsFor('Noodl.Navigation.')).toEqual(expect.arrayContaining(['navigate', 'navigateToPath']));
      expect(labelsFor('Noodl.Files.')).toEqual(['upload']);
      expect(labelsFor('Noodl.SEO.')).toEqual(expect.arrayContaining(['setTitle', 'setMeta']));
      expect(labelsFor('Noodl.Config.')).toEqual(expect.arrayContaining(['appName', 'favicon']));
    });

    it('spells the current user `Current`, because that is what the runtime spells it', () => {
      // `users.ts:40` — capital C, and the sort of detail a list written from
      // memory gets wrong in a way no test would have caught.
      expect(labelsFor('Noodl.Users.')).toContain('Current');
      expect(labelsFor('Noodl.Users.')).not.toContain('current');
    });

    it('gives an alias the same members as the thing it aliases', () => {
      // ⚠️ The `toContain` is not padding. Comparing the two calls alone passes
      // vacuously when *both* return null — which is exactly what the
      // pre-§B build did, so the equality below agreed with the defect. Pin
      // that each side actually answered before pinning that they agree.
      expect(labelsFor('Noodl.Object.')).toContain('get');
      expect(labelsFor('Noodl.Array.')).toContain('get');
      expect(labelsFor('Noodl.Events.')).toContain('emit');

      expect(labelsFor('Noodl.Model.')).toEqual(labelsFor('Noodl.Object.'));
      expect(labelsFor('Noodl.Collection.')).toEqual(labelsFor('Noodl.Array.'));
      expect(labelsFor('Noodl.eventEmitter.')).toEqual(labelsFor('Noodl.Events.'));
    });

    // ⚠️ The four refusals. Each one is a wrong answer this walk could easily
    // have given, and three of them would be actively worse than silence.
    it('refuses the bare `Object.` — that is JavaScript’s, not Noodl’s', () => {
      expect(labelsFor('Object.')).toBeNull();
      expect(labelsFor('Array.')).toBeNull();
    });

    it('refuses a second level in an Expression, whose `Noodl` has none', () => {
      expect(labelsFor('Noodl.Records.', false, 'expression')).toBeNull();
      expect(labelsFor('Noodl.Users.', false, 'expression')).toBeNull();
    });

    it('refuses a third level rather than repeating the second', () => {
      expect(labelsFor('Noodl.Records.query.')).toBeNull();
      expect(labelsFor('Noodl.Users.Current.')).toBeNull();
    });

    it('still lets the project answer for `Noodl.Variables.`', () => {
      // The ordering guard: the static walk knows the *name* `Variables` and
      // has nothing under it, so running it first would replace a right answer
      // with silence.
      setCodeAuthoringContext({ libraries: [], variables: ['cartTotal'], objects: [], arrays: [] });
      expect(labelsFor('Noodl.Variables.')).toEqual(['cartTotal']);
    });

    it('still answers plain `Noodl.` — the branch the walk replaced', () => {
      expect(labelsFor('Noodl.')).toEqual(expect.arrayContaining(['Records', 'Variables']));
      expect(labelsFor('Noodl.', false, 'expression')).toEqual(['Variables', 'Objects', 'Arrays', 'Object']);
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

/**
 * FUN-008 — a bare port name completes to its notation.
 *
 * The originating user typed `Input_1`, not `Inputs.`, and nothing was
 * listening. Completion cannot help someone who never types the trigger.
 *
 * ⚠️ **The failure mode this file has actually shipped is a source that never
 * fires**, and it typechecks and reads correctly while doing nothing (FH-017
 * slice 1, pinned at the top of this file). These rows are the unit half; the
 * task is explicit that they are not sufficient and it must be driven, because
 * a source that silently never fires is indistinguishable from one that is not
 * installed.
 */
describe('a bare port name completes to its notation (FUN-008)', () => {
  afterEach(() => {
    setCodeAuthoringContext(null);
    setOpenNodeContext(null);
  });

  function completionsFor(doc: string, mode: ValidationType = 'function') {
    const result = createNoodlCompletionSource(mode)(contextAt(doc, doc.length, false));
    return result ? result.options : [];
  }

  function portOptions(doc: string, mode: ValidationType = 'function') {
    return completionsFor(doc, mode).filter((option) => option.boost === 99);
  }

  it('offers the read expression for a declared input, from a partial word', () => {
    openFunctionNode(['Input_1'], []);
    const [first] = completionsFor('Inp');

    expect(first.label).toBe('Inputs.Input_1');
    expect(first.apply).toBe('Inputs.Input_1');
    expect(first.detail).toBe('input port');
  });

  it('sorts the port above the globals, which is the whole of §4', () => {
    // `Inp` also prefixes the global `Inputs`. Without the boost the port lands
    // under it and under every identifier in the document.
    openFunctionNode(['Input_1'], []);
    const options = completionsFor('Inp');

    expect(options[0].label).toBe('Inputs.Input_1');
    expect(options.some((option) => option.label === 'Inputs')).toBe(true);
    expect(options[0].boost).toBeGreaterThan(0);
  });

  it('completes a value output to an assignment, caret after the `=`', () => {
    openFunctionNode([], [{ name: 'Output_1', type: 'string' }]);
    const [first] = portOptions('Out');

    expect(first.apply).toBe('Outputs.Output_1 = ');
    expect(first.detail).toBe('output port (value)');
  });

  it('completes a signal output to a call', () => {
    openFunctionNode([], [{ name: 'Done', type: 'signal' }]);
    const [first] = portOptions('Don');

    expect(first.apply).toBe('Outputs.Done()');
    expect(first.detail).toBe('output port (signal)');
  });

  it('matches on the port name even though the label is the expression', () => {
    // `Outputs.Done()` does not begin with `Don`, so CodeMirror's own filter
    // would drop it. This is why the result sets `filter: false`.
    openFunctionNode([], [{ name: 'Done', type: 'signal' }]);
    const result = createNoodlCompletionSource('function')(contextAt('Don', 3, false));

    expect(result.filter).toBe(false);
    expect(result.options.some((option) => option.label === 'Outputs.Done()')).toBe(true);
  });

  it('offers a port mined from the code, not only a declared one', () => {
    const options = portOptions('const a = Inputs.Value;\nVal');
    expect(options.map((option) => option.label)).toContain('Inputs.Value');
  });

  it('uses bracket notation for a name the dot form would not mine', () => {
    openFunctionNode(['My Value'], []);
    expect(portOptions('My').map((option) => option.apply)).toContain('Inputs["My Value"]');
  });

  describe('§3 — where it must not fire', () => {
    it('offers nothing in expression mode', () => {
      // A bare identifier there already *becomes* the port; prefixing it would
      // create a port called `Inputs`.
      openFunctionNode(['Input_1'], []);
      expect(portOptions('Inp', 'expression')).toEqual([]);
    });

    it('offers nothing after a dot', () => {
      openFunctionNode(['Input_1'], []);
      expect(portOptions('foo.Inp')).toEqual([]);
    });

    it('offers nothing in a declaration position', () => {
      // `var Inputs.Input_1` is a syntax error — a completion that breaks the
      // document is worse than no completion.
      openFunctionNode(['Input_1'], []);
      expect(portOptions('var Inp')).toEqual([]);
      expect(portOptions('let Inp')).toEqual([]);
      expect(portOptions('const Inp')).toEqual([]);
      expect(portOptions('function Inp')).toEqual([]);
    });

    it('still offers in a reference position', () => {
      openFunctionNode(['Input_1'], []);
      expect(portOptions('return Inp').length).toBeGreaterThan(0);
      expect(portOptions('var x = Inp').length).toBeGreaterThan(0);
    });

    it('offers nothing at an empty position', () => {
      // Every port on the node, ahead of every language completion, on every
      // keystroke of whitespace.
      openFunctionNode(['Input_1'], []);
      expect(portOptions('')).toEqual([]);
      expect(portOptions('return ')).toEqual([]);
    });

    it('offers nothing when no node is open and nothing is mined', () => {
      expect(portOptions('Inp')).toEqual([]);
    });
  });

  it('does not disturb the member completions this file already had', () => {
    openFunctionNode(['Input_1'], []);
    const result = createNoodlCompletionSource('function')(contextAt('Inputs.', 7, false));

    expect(result).not.toBeNull();
    // The bare-name offer is a top-level thing; after a dot the member branch
    // answers, unboosted, exactly as it did before.
    expect(result.options.every((option) => option.boost !== 99)).toBe(true);
    expect(result.options.map((option) => option.label)).toEqual(['Input_1']);
  });

  it('completes a declared-but-unread port after `Inputs.` too', () => {
    // ⚠️ Found by the row above going red. `Inputs.` read `minePorts` alone, so a
    // port added in the panel and not yet mentioned did not complete — the exact
    // position a beginner is in one second after creating it, and the one place
    // completion knew the answer and withheld it.
    openFunctionNode(['Declared_1'], []);
    const result = createNoodlCompletionSource('function')(contextAt('Inputs.', 7, false));

    expect(result.options.map((option) => option.label)).toEqual(['Declared_1']);
    expect(result.options[0].info).toContain('not yet read');
  });

  it('still says why a mined port exists, which is the thing being taught', () => {
    const result = createNoodlCompletionSource('function')(
      contextAt('const a = Inputs.Value;\nInputs.', 31, false)
    );

    expect(result.options[0].label).toBe('Value');
    expect(result.options[0].info).toContain('because your code reads it');
  });
});
