/**
 * Validates the published node-definition API (PLAT-003 step 4).
 *
 * The point of this suite is that it authors nodes using *only* the types `@noodl/types`
 * exports — no `any`, no reaching into runtime internals — and then runs them. If the
 * published types drift from what `defineNode` actually accepts, this file stops
 * compiling; if they describe behaviour the runtime does not have, the assertions fail.
 *
 * It doubles as a characterisation test for the behaviours PLAT-003 must preserve while
 * typing: ordinary input setters, edge-triggered signal inputs, output getters, signal
 * emission, and the numbered-inputs dynamic-port mechanism.
 */

import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

/**
 * A node authored entirely against the published types.
 *
 * `_internal` is the sanctioned per-instance scratch space, so state lives there rather
 * than on the instance — which is also what every node in the standard library does.
 */
const counterNode: NodeDefinitionOptions = {
  name: 'PLAT003 Counter',
  category: 'Logic',
  displayNodeName: 'Counter (type test)',
  shortDesc: 'Counts signals, for validating the published node-definition types.',

  initialize(this: NodeInstance) {
    this._internal.count = 0;
    this._internal.step = 1;
  },

  inputs: {
    step: {
      type: 'number',
      displayName: 'Step',
      group: 'General',
      default: 1,
      set(this: NodeInstance, value: number) {
        this._internal.step = value;
      }
    },
    increment: {
      displayName: 'Increment',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        this._internal.count = (this._internal.count as number) + (this._internal.step as number);
        this.flagOutputDirty('count');
        this.sendSignalOnOutput('changed');
      }
    }
  },

  outputs: {
    count: {
      type: 'number',
      displayName: 'Count',
      get(this: NodeInstance) {
        return this._internal.count;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed'
    }
  }
};

/** A node whose input set is unbounded — the `numbered-inputs` dynamic-port mechanism. */
const summerNode: NodeDefinitionOptions = {
  name: 'PLAT003 Summer',
  category: 'Math',

  initialize(this: NodeInstance) {
    this._internal.values = {};
  },

  numberedInputs: {
    value: {
      type: 'number',
      displayPrefix: 'Value',
      group: 'Values',
      createSetter(this: NodeInstance, index: number) {
        return function (this: NodeInstance, value: number) {
          (this._internal.values as Record<number, number>)[index] = value;
          this.flagOutputDirty('sum');
        };
      }
    }
  },

  outputs: {
    sum: {
      type: 'number',
      get(this: NodeInstance) {
        return Object.values(this._internal.values as Record<number, number>).reduce((a, b) => a + b, 0);
      }
    }
  }
};

/** Creates a bare context with the two definitions registered. */
function createContext() {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(counterNode));
  context.nodeRegister.register(NodeDefinition.defineNode(summerNode));
  return context;
}

describe('published node-definition API', () => {
  it('compiles metadata that matches what was authored', () => {
    const context = createContext();
    const metadata = context.nodeRegister.getNodeMetadata('PLAT003 Counter');

    expect(metadata.name).toBe('PLAT003 Counter');
    expect(metadata.category).toBe('Logic');
    expect(metadata.displayNodeName).toBe('Counter (type test)');

    // Declared ports keep their authored metadata, and defaults are filled in.
    expect(metadata.inputs.step.type).toBe('number');
    expect(metadata.inputs.step.default).toBe(1);
    expect(metadata.inputs.step.exportToEditor).toBe(true);
    expect(metadata.inputs.step.inputPriority).toBe(0);
    expect(metadata.outputs.count.displayName).toBe('Count');
  });

  it('rewrites a valueChangedToTrue input into a connections-only signal port', () => {
    const context = createContext();
    const metadata = context.nodeRegister.getNodeMetadata('PLAT003 Counter');

    // Whatever the author declared, a signal input's type is replaced. This is the one
    // place the compiled metadata deliberately disagrees with what was written.
    expect(metadata.inputs.increment.type).toEqual({
      name: 'signal',
      allowConnectionsOnly: true
    });
  });

  it('applies input defaults before initialize runs', () => {
    const context = createContext();
    const node = context.nodeRegister.createNode('PLAT003 Counter', 'counter-1');

    expect(node.getInputValue('step')).toBe(1);
  });

  it('triggers a signal input only on the rising edge', () => {
    const context = createContext();
    const node = context.nodeRegister.createNode('PLAT003 Counter', 'counter-1');

    expect(node.getOutput('count').value).toBe(0);

    node.setInputValue('increment', true);
    expect(node.getOutput('count').value).toBe(1);

    // Still true — no edge, so no trigger.
    node.setInputValue('increment', true);
    expect(node.getOutput('count').value).toBe(1);

    node.setInputValue('increment', false);
    node.setInputValue('increment', true);
    expect(node.getOutput('count').value).toBe(2);
  });

  it('gives every instance its own signal-input edge state', () => {
    const context = createContext();
    const first = context.nodeRegister.createNode('PLAT003 Counter', 'counter-1');
    const second = context.nodeRegister.createNode('PLAT003 Counter', 'counter-2');

    first.setInputValue('increment', true);

    // If the edge state were shared, `second` would already consider itself high and this
    // rising edge would be swallowed.
    second.setInputValue('increment', true);

    expect(first.getOutput('count').value).toBe(1);
    expect(second.getOutput('count').value).toBe(1);
  });

  it('respects an ordinary input setter feeding the signal input', () => {
    const context = createContext();
    const node = context.nodeRegister.createNode('PLAT003 Counter', 'counter-1');

    node.setInputValue('step', 5);
    node.setInputValue('increment', true);

    expect(node.getOutput('count').value).toBe(5);
  });

  it('registers numbered inputs on demand and leaves the set open', () => {
    const context = createContext();
    const node = context.nodeRegister.createNode('PLAT003 Summer', 'summer-1');

    // Nothing exists until asked for — that is what makes the port set unbounded.
    expect(node.hasInput('value 0')).toBe(false);

    node.registerInputIfNeeded('value 0');
    node.registerInputIfNeeded('value 7');

    expect(node.hasInput('value 0')).toBe(true);
    expect(node.hasInput('value 7')).toBe(true);

    node.setInputValue('value 0', 10);
    node.setInputValue('value 7', 32);

    expect(node.getOutput('sum').value).toBe(42);
  });

  it('ignores names outside a numbered-input family', () => {
    const context = createContext();
    const node = context.nodeRegister.createNode('PLAT003 Summer', 'summer-1');

    node.registerInputIfNeeded('unrelated 0');

    expect(node.hasInput('unrelated 0')).toBe(false);
  });

  it('rejects a definition with no category', () => {
    expect(() => NodeDefinition.defineNode({ name: 'No Category' } as NodeDefinitionOptions)).toThrow(
      'Node must have a category'
    );
  });

  it('chains initialize functions when definitions are extended', () => {
    const calls: string[] = [];

    const base = {
      name: 'PLAT003 Extended',
      category: 'Logic',
      initialize() {
        calls.push('base');
      }
    };

    const extended: NodeDefinitionOptions = NodeDefinition.extend(base, {
      initialize() {
        calls.push('mixin');
      }
    });

    const context = new NodeContext();
    context.nodeRegister.register(NodeDefinition.defineNode(extended));
    context.nodeRegister.createNode('PLAT003 Extended', 'extended-1');

    expect(calls).toEqual(['base', 'mixin']);
  });
});
