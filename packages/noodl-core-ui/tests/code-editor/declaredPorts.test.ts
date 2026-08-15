/**
 * FUN-003 — the ports a node declares in the property panel.
 *
 * The contract these pin is agreement with the two runtime nodes that build the
 * ports: `simplejavascript.ts:624-682` (Function) and `javascript.ts:767-823`
 * (Script). Both read the same two `proplist` parameters and the same
 * `intype-`/`outtype-` convention, and their type defaults differ by direction —
 * an undeclared input is `'string'`, an undeclared output is `'*'`.
 *
 * The prefix cases are the ones worth reading. A Function node's port names are
 * `'in-' + label` / `'out-' + label`, and a consumer that inserts `Inputs.in-x`
 * writes valid JavaScript that mints a port called `in`. That prefix lives on
 * the assembled port list, never on the proplist label — so these assert that
 * nothing is stripped here, including from a label that happens to start with
 * `in-`, because stripping one would name a port that does not exist.
 */
import {
  collectDeclaredPorts,
  declaredPortsEqual,
  modeHasDeclaredPorts
} from '@noodl-core-ui/components/code-editor/utils/declaredPorts';
import { minePorts } from '@noodl-core-ui/components/code-editor/utils/scriptPorts';
import type { ValidationType } from '@noodl-core-ui/components/code-editor/utils/types';

describe('collectDeclaredPorts', () => {
  it('finds nothing on a node with no parameters at all', () => {
    expect(collectDeclaredPorts(undefined)).toEqual({ inputs: [], outputs: [] });
    expect(collectDeclaredPorts({})).toEqual({ inputs: [], outputs: [] });
  });

  it('reads the two proplists, with the runtime type defaults', () => {
    const declared = collectDeclaredPorts({
      scriptInputs: [
        { id: 'a1b2', label: 'Input_1' },
        { id: 'c3d4', label: 'Input_2' }
      ],
      scriptOutputs: [{ id: 'e5f6', label: 'Output_1' }]
    });

    expect(declared.inputs).toEqual([
      { name: 'Input_1', type: 'string' },
      { name: 'Input_2', type: 'string' }
    ]);
    expect(declared.outputs).toEqual([{ name: 'Output_1', type: '*' }]);
  });

  it('takes the chosen type from the row’s intype-/outtype- parameter', () => {
    const declared = collectDeclaredPorts({
      scriptInputs: [
        { id: 'a1b2', label: 'Count' },
        { id: 'c3d4', label: 'Untouched' }
      ],
      scriptOutputs: [{ id: 'e5f6', label: 'Result' }],
      'intype-Count': 'number',
      'outtype-Result': 'boolean'
    });

    expect(declared.inputs).toEqual([
      { name: 'Count', type: 'number' },
      { name: 'Untouched', type: 'string' }
    ]);
    expect(declared.outputs).toEqual([{ name: 'Result', type: 'boolean' }]);
  });

  it('carries an output typed as a signal, which is a different notation', () => {
    // `Outputs.Done()` rather than `Outputs.Done = `. An inserter that did not
    // know which would silently create the wrong kind of port.
    const declared = collectDeclaredPorts({
      scriptOutputs: [
        { id: 'a1b2', label: 'Done' },
        { id: 'c3d4', label: 'Value' }
      ],
      'outtype-Done': 'signal'
    });

    expect(declared.outputs).toEqual([
      { name: 'Done', type: 'signal' },
      { name: 'Value', type: '*' }
    ]);
  });

  it('does not strip the in-/out- prefix, because a proplist label never carries one', () => {
    // The Function node builds `'in-' + label`. A row labelled `in-Value`
    // therefore becomes the port `in-in-Value`, whose notation is
    // `Inputs["in-Value"]` — strip it and every consumer writes code for a port
    // that does not exist. The Script node applies no prefix at all.
    const declared = collectDeclaredPorts({
      scriptInputs: [{ id: 'a1b2', label: 'in-Value' }],
      scriptOutputs: [{ id: 'c3d4', label: 'out-Result' }]
    });

    expect(declared.inputs).toEqual([{ name: 'in-Value', type: 'string' }]);
    expect(declared.outputs).toEqual([{ name: 'out-Result', type: '*' }]);
  });

  it('keeps a label a human typed a space into, verbatim', () => {
    // `My Value` is reachable in the panel and `Inputs.My Value` is a syntax
    // error. Correcting it here would name a port the runtime never builds; the
    // bracket form is the insertion side's job.
    const declared = collectDeclaredPorts({ scriptInputs: [{ id: 'a1b2', label: 'My Value' }] });
    expect(declared.inputs).toEqual([{ name: 'My Value', type: 'string' }]);
  });

  it('drops a blank row and collapses a repeated label', () => {
    const declared = collectDeclaredPorts({
      scriptInputs: [
        { id: 'a1b2', label: 'Value' },
        { id: 'c3d4', label: '' },
        { id: 'e5f6', label: '   ' },
        { id: 'g7h8', label: 'Value' }
      ]
    });

    expect(declared.inputs).toEqual([{ name: 'Value', type: 'string' }]);
  });

  it('reads the legacy bare-string proplist shape', () => {
    // `decodePropList` tolerates it (ERG-003), so the panel and this agree.
    const declared = collectDeclaredPorts({ scriptInputs: ['Input_1'] });
    expect(declared.inputs).toEqual([{ name: 'Input_1', type: 'string' }]);
  });

  it('ignores a proplist parameter that is not a list', () => {
    expect(collectDeclaredPorts({ scriptInputs: 'Input_1', scriptOutputs: null })).toEqual({
      inputs: [],
      outputs: []
    });
  });

  it('unions with minePorts without doubling a port that is both declared and used', () => {
    // The acceptance criterion, stated as its consumers will meet it: the two
    // lists stay separate here so a consumer can tell "declared and unused"
    // from "used", and a union of them names each port once.
    const parameters = {
      scriptInputs: [{ id: 'a1b2', label: 'Input_1' }],
      scriptOutputs: [{ id: 'c3d4', label: 'Output_1' }]
    };
    const declared = collectDeclaredPorts(parameters);
    const mined = minePorts('Outputs.Output_1 = Inputs.Input_1;\nOutputs.Extra = 1;');

    const inputs = new Set([...declared.inputs.map((p) => p.name), ...mined.inputs]);
    const outputs = new Set([...declared.outputs.map((p) => p.name), ...mined.outputs]);

    expect([...inputs]).toEqual(['Input_1']);
    expect([...outputs]).toEqual(['Output_1', 'Extra']);

    // And the distinction survives the union: `Extra` was never declared.
    expect(declared.outputs.map((p) => p.name)).toEqual(['Output_1']);
  });
});

/**
 * FIX-016 §2 follow-up. The editor republishes the open node on **any** parameter
 * write, and this is what stops that becoming a re-lint per keystroke — so its
 * job is to be sensitive to the things that change the answer and deaf to the
 * things that do not.
 *
 * 🔴 The first three are the ones that matter. `a.length === b.length`, or a
 * comparison of names alone, passes everything else in this block: the type is
 * the *entire* subject of message 5, and a `String` → `Signal` change is exactly
 * one field of one entry.
 */
describe('declaredPortsEqual', () => {
  const PORTS = {
    inputs: [{ name: 'Celsius', type: 'number' }],
    outputs: [{ name: 'Done', type: '*' }]
  };

  it('is true for two reads of an unchanged node', () => {
    const parameters = {
      scriptInputs: [{ id: 'a1', label: 'Celsius' }],
      scriptOutputs: [{ id: 'b2', label: 'Done' }],
      'intype-Celsius': 'number'
    };
    expect(declaredPortsEqual(collectDeclaredPorts(parameters), collectDeclaredPorts(parameters))).toBe(true);
  });

  it('is false when only an output type changed — the whole point of the message', () => {
    const before = { inputs: PORTS.inputs, outputs: [{ name: 'Done', type: '*' }] };
    const after = { inputs: PORTS.inputs, outputs: [{ name: 'Done', type: 'signal' }] };
    expect(declaredPortsEqual(before, after)).toBe(false);
  });

  it('is false when only an input type changed', () => {
    const after = { inputs: [{ name: 'Celsius', type: 'string' }], outputs: PORTS.outputs };
    expect(declaredPortsEqual(PORTS, after)).toBe(false);
  });

  it('is false when a port is renamed', () => {
    const after = { inputs: PORTS.inputs, outputs: [{ name: 'Finished', type: '*' }] };
    expect(declaredPortsEqual(PORTS, after)).toBe(false);
  });

  it('is false when a port is added or removed', () => {
    const more = { inputs: PORTS.inputs, outputs: [...PORTS.outputs, { name: 'Failed', type: 'signal' }] };
    expect(declaredPortsEqual(PORTS, more)).toBe(false);
    expect(declaredPortsEqual(more, PORTS)).toBe(false);
  });

  it('is false when the rows are reordered', () => {
    // The proplist is the author's own order and the port bar lists ports in it,
    // so a reorder is a change the open editor should see.
    const two = { inputs: [], outputs: [{ name: 'A', type: '*' }, { name: 'B', type: 'signal' }] };
    const swapped = { inputs: [], outputs: [{ name: 'B', type: 'signal' }, { name: 'A', type: '*' }] };
    expect(declaredPortsEqual(two, swapped)).toBe(false);
  });

  it('is true across separately-built objects with the same content', () => {
    // Identity is not the test: the editor builds a fresh list on every write.
    expect(declaredPortsEqual({ inputs: [...PORTS.inputs], outputs: [...PORTS.outputs] }, PORTS)).toBe(true);
  });

  it('is true for two empty nodes', () => {
    expect(declaredPortsEqual({ inputs: [], outputs: [] }, { inputs: [], outputs: [] })).toBe(true);
  });

  it('does not confuse the two directions', () => {
    // A port list moved from inputs to outputs is not "no change".
    const asInputs = { inputs: PORTS.outputs, outputs: [] };
    const asOutputs = { inputs: [], outputs: PORTS.outputs };
    expect(declaredPortsEqual(asInputs, asOutputs)).toBe(false);
  });
});

describe('modeHasDeclaredPorts', () => {
  it('is true for the two modes whose nodes declare ports', () => {
    expect(modeHasDeclaredPorts('function')).toBe(true);
    expect(modeHasDeclaredPorts('script')).toBe(true);
  });

  it('is false for expression, where a bare identifier becomes a port', () => {
    // `expression.ts:399`. An affordance offering `Inputs.foo` here would create
    // a port called `Inputs`.
    expect(modeHasDeclaredPorts('expression')).toBe(false);
  });

  it('is false for the modes that are not code at all', () => {
    const notCode: ValidationType[] = ['json', 'text', 'css', 'html'];
    for (const mode of notCode) {
      expect(modeHasDeclaredPorts(mode)).toBe(false);
    }
  });

  it('is false when no mode was supplied', () => {
    expect(modeHasDeclaredPorts(undefined)).toBe(false);
  });
});
