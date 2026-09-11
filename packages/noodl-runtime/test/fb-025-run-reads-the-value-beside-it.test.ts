/**
 * FB-025 — a Visual Function's `Run` read the *previous* value, for ever.
 *
 * Richard: *"When I run the visual function node multiple times, with a value that varies every
 * time the run signal is triggered … it uses the previous value and outputs the result for the
 * previous value, as if the new value arrives too late and there's a race condition between the
 * standard 'run' signal input in the visual function node and the values that come into it."*
 *
 * It is a race, and it was decided once and then never re-run. `Node.update` drained its per-port
 * input queues in `Object.keys(_inputValuesQueue)` order — **insertion order of the keys**, i.e.
 * the order each port was first *ever* delivered to. A port's key was created once and never
 * moved, so a `Run` pulsed once before its value port had ever been written kept its place at the
 * head of every later drain, and the program ran on whatever `Inputs` held from last time.
 *
 * This is the *signal before value* class the corpus already names twice
 * (`objectchanged.ts`'s `emptyToNull`, `nda-012-logic-category.test.ts`'s "an accident of the
 * node's `initialize`, not of its ordering") and `CONTRACT.md` C4 already claims as a guarantee.
 * `nda-012` now pins the general rule; this file pins it on the node Richard reported, because a
 * general rule that nobody exercises on the reported graph is how the fix would quietly rot.
 *
 * Every row here is red on the unfixed drain.
 */

import type { NodeInstance } from '@noodl/types';

import { createGraph } from './helpers/node-harness';

import LogicBuilderModule = require('../src/nodes/std-library/logic-builder');

function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

/** The Text Input's shape: flag the value output, then send the signal that describes it. */
interface FieldNodeInstance extends NodeInstance {
  emit(payload: unknown): void;
  pulse(): void;
}

const FieldModule = {
  node: {
    name: 'fb025.Field',
    category: 'Test',
    initialize: function (this: NodeInstance) {
      this._internal.payload = undefined;
    },
    outputs: {
      text: {
        type: 'string',
        getter: function (this: NodeInstance) {
          return this._internal.payload;
        }
      },
      textChanged: { type: 'signal' }
    },
    methods: {
      emit(this: NodeInstance, payload: unknown) {
        this._internal.payload = payload;
        this.flagOutputDirty('text');
        this.sendSignalOnOutput('textChanged');
      },
      pulse(this: NodeInstance) {
        this.sendSignalOnOutput('textChanged');
      }
    }
  }
};

/** A Visual Function that copies one input to one output, wired to a field. */
function buildGraph() {
  const graph = createGraph(FieldModule as never, LogicBuilderModule as never);

  const field = graph.make<FieldNodeInstance>('fb025.Field', 'field');
  const vf = graph.make('Logic Builder', 'vf');

  vf.setInputValue(
    'workspace',
    workspace(
      { type: 'noodl_define_input', fields: { NAME: 'x', TYPE: 'string' } },
      { type: 'noodl_set_output', fields: { NAME: 'seen' } }
    )
  );
  vf.setInputValue('generatedCode', 'Outputs["seen"] = Inputs["x"];\n');

  // `run` first, which is how the wire gets made when an author drops the node and connects the
  // trigger before deciding what to feed it.
  vf.connectInput('run', field, 'textChanged');
  (vf as never as { registerInputIfNeeded(name: string): void }).registerInputIfNeeded('x');
  vf.connectInput('x', field, 'text');

  return { graph, field, vf, seen: () => vf.getOutput('seen') && vf.getOutput('seen').value };
}

describe('FB-025 — Run reads the value that arrived with it', () => {
  it('🔴 runs on the new value after a pulse that arrived before any value ever did', () => {
    const { graph, field, seen } = buildGraph();

    /**
     * The whole defect in one line. This pulse creates the `run` queue key while `x` has never
     * been delivered to, and on the unfixed drain that fixes the order for the life of the node.
     * A real graph reaches this state on its own: a Text Input flags `Text` and then fires
     * `Text Changed`, and `sendValue` returns early on `undefined` — so a field whose first
     * value is empty queues the signal and not the value.
     */
    field.pulse();
    graph.context.update();

    field.emit('one');
    graph.context.update();
    expect(seen()).toBe('one'); // was `undefined` — the value before this one

    field.emit('two');
    graph.context.update();
    expect(seen()).toBe('two'); // was `'one'`
  });

  it('runs on the new value when the value port was delivered to first', () => {
    // The control. This arrangement was always correct, by accident, and must stay correct.
    const { graph, field, seen } = buildGraph();

    field.emit('one');
    graph.context.update();
    expect(seen()).toBe('one');

    field.emit('two');
    graph.context.update();
    expect(seen()).toBe('two');
  });

  it('🔴 keeps every event in step when several arrive before the node updates', () => {
    const { graph, field, seen } = buildGraph();
    const outputs: unknown[] = [];

    field.pulse();
    graph.context.update();

    // Three events inside one frame — a fast source, which is where C7's lockstep is the only
    // thing holding a signal to the value it was sent with.
    field.emit('a');
    field.emit('b');
    field.emit('c');
    graph.context.update();
    outputs.push(seen());

    expect(outputs).toEqual(['c']);
  });
});
