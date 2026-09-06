/**
 * EXP-011 §74, measured in the runtime — **a value typed into a port that ALSO has a wire: what is written, and when.**
 *
 * Five registers (§67.5 #1, §68.5 #1, §69.5 #1, §70.5 #1, §71.5 #1) said the same sentence about five nodes: "the
 * typed-in value shows until the wire's source first delivers". The mechanism is `nodescope.ts` + `node.ts`, not any
 * node's own code:
 *
 * - `setNodeParameters` queues every authored parameter into the node at creation (`queueInput`); `addConnection`
 *   then `connectInput`s each wire, and a wire whose source already holds a DEFINED output value queues that value
 *   over the parameter (first-update consolidation: the last queued value wins). A source that holds `undefined`
 *   queues nothing (`sendValue` returns early) — the parameter stands.
 * - So for a Do-triggered Set (Set Variable, Global Store Set, Set Object Properties) `_internal.value` at any Do is
 *   the wire's LAST DEFINED delivery, else the typed-in value. For a creation-time writer (a Variable's Value, an
 *   Object's own `prop-*`) the typed-in value is written first and each delivery is written over it.
 *
 * Each construct is measured against two sources: a `Variable2` nothing has written (delivers nothing until written,
 * then delivers; written back to `undefined` it delivers nothing and the last value stands — s94's §66.5 #1 rule) and
 * a `String` constant (delivers at boot). The readouts are the runtime's own records: the variables record, the
 * global store manager, the Model registry.
 */

import type { NodeDefinitionOptions, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import Model = require('../../src/model');
import VariableModule = require('../../src/nodes/std-library/data/variablenode2');
import SetVariableModule = require('../../src/nodes/std-library/data/setvariablenode');
import ModelNodeModule = require('../../src/nodes/std-library/data/modelnode2');
import SetModelPropertiesModule = require('../../src/nodes/std-library/data/setmodelpropertiesnode');
import GlobalStoreSetModule = require('../../src/nodes/std-library/agent/globalstoresetnode');
import StringModule = require('../../src/nodes/std-library/variables/string');
import { globalStoreManager } from '../../src/nodes/std-library/agent/globalstore';

const VARIABLES_RECORD = '--ndl--global-variables';
const variables = () => Model.get(VARIABLES_RECORD);

const MODULES: Array<NodeModule | NodeDefinitionOptions> = [
  VariableModule,
  SetVariableModule,
  ModelNodeModule,
  SetModelPropertiesModule,
  GlobalStoreSetModule,
  StringModule
] as unknown as Array<NodeModule | NodeDefinitionOptions>;

async function graphWith(
  nodes: Array<Record<string, unknown>>,
  connections: Array<Record<string, string>>
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: MODULES,
    rootComponent: '/root',
    data: { components: [{ name: '/root', nodes, connections }] } as never
  });
  await graph.settle(3);
  return graph;
}

async function pulse(graph: CorpusGraph, id: string, port: string): Promise<void> {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
  await graph.settle(3);
}

/** A source `Variable2` nothing has written, or a `String` constant that delivers at boot. */
const unwrittenSource = (name: string) => ({ id: 'src', type: 'Variable2', parameters: { name } });
const constantSource = (value: string) => ({ id: 'src', type: 'String', parameters: { value } });

/** Every write of `name` on the variables record, in order — the sequence a creation-time writer leaves. */
function recordVariableWrites(name: string): { writes: unknown[]; stop(): void } {
  const writes: unknown[] = [];
  const onChange = (args: { name: string; value: unknown }) => {
    if (args.name === name) writes.push(args.value);
  };
  variables().on('change', onChange);
  return { writes, stop: () => variables().off('change', onChange) };
}

function recordModelWrites(modelId: string, key: string): { writes: unknown[]; stop(): void } {
  const writes: unknown[] = [];
  const model = Model.get(modelId);
  const onChange = (args: { name: string; value: unknown }) => {
    if (args.name === key) writes.push(args.value);
  };
  model.on('change', onChange);
  return { writes, stop: () => model.off('change', onChange) };
}

const readout: string[] = [];
afterAll(() => {
  // eslint-disable-next-line no-console
  console.log(['EXP-011 §74 runtime readout', ...readout].join('\n'));
});

describe('R Set Variable — a typed-in Value under a wire into Value', () => {
  test('R1 the wire from a Variable nothing wrote: Do writes the TYPED-IN value; once the source is written, Do writes the wire’s value; the source written back to undefined leaves the wire’s last value in place (the literal never returns)', async () => {
    const graph = await graphWith(
      [unwrittenSource('s96-r1-src'), { id: 'set', type: 'Set Variable', parameters: { name: 's96-r1', value: 'typed' } }],
      [{ sourceId: 'src', sourcePort: 'value', targetId: 'set', targetPort: 'value' }]
    );
    await pulse(graph, 'set', 'do');
    const first = variables().get('s96-r1');
    expect(first).toBe('typed');

    variables().set('s96-r1-src', 'wired');
    await graph.settle(2);
    await pulse(graph, 'set', 'do');
    const second = variables().get('s96-r1');
    expect(second).toBe('wired');

    variables().set('s96-r1-src', undefined);
    await graph.settle(2);
    await pulse(graph, 'set', 'do');
    const third = variables().get('s96-r1');
    expect(third).toBe('wired');
    readout.push(`R1 Set Variable, unwritten source: Do ⇒ ${JSON.stringify(first)}; source written 'wired' ⇒ Do ⇒ ${JSON.stringify(second)}; source ⇒ undefined ⇒ Do ⇒ ${JSON.stringify(third)}`);
  });

  test('R2 the wire from a String constant: the constant is delivered at boot, so the first Do already writes the wire’s value — the typed-in value is never written', async () => {
    const graph = await graphWith(
      [constantSource('const'), { id: 'set', type: 'Set Variable', parameters: { name: 's96-r2', value: 'typed' } }],
      [{ sourceId: 'src', sourcePort: 'savedValue', targetId: 'set', targetPort: 'value' }]
    );
    const internalAtBoot = (graph.node('set') as unknown as { _internal: { value: unknown } })._internal.value;
    await pulse(graph, 'set', 'do');
    const written = variables().get('s96-r2');
    expect(internalAtBoot).toBe('const');
    expect(written).toBe('const');
    readout.push(`R2 Set Variable, String constant source: _internal.value after boot=${JSON.stringify(internalAtBoot)}; Do ⇒ ${JSON.stringify(written)}`);
  });

  test('R3 control — the typed-in value with NO wire: Do writes it (§69, unchanged)', async () => {
    const graph = await graphWith([{ id: 'set', type: 'Set Variable', parameters: { name: 's96-r3', value: 'typed' } }], []);
    await pulse(graph, 'set', 'do');
    expect(variables().get('s96-r3')).toBe('typed');
    readout.push(`R3 Set Variable, no wire: Do ⇒ ${JSON.stringify(variables().get('s96-r3'))}`);
  });
});

describe('G Global Store Set — a typed-in Value under a wire into Value', () => {
  test('G1 the wire from a Variable nothing wrote: Set writes the TYPED-IN value; once the source is written, the wire’s value', async () => {
    const graph = await graphWith(
      [unwrittenSource('s96-g1-src'), { id: 'set', type: 'net.noodl.GlobalStore.Set', parameters: { storeName: 's96', key: 'g1', value: 'typed' } }],
      [{ sourceId: 'src', sourcePort: 'value', targetId: 'set', targetPort: 'value' }]
    );
    await pulse(graph, 'set', 'set');
    const first = globalStoreManager.getKey('s96', 'g1');
    expect(first).toBe('typed');
    variables().set('s96-g1-src', 'wired');
    await graph.settle(2);
    await pulse(graph, 'set', 'set');
    const second = globalStoreManager.getKey('s96', 'g1');
    expect(second).toBe('wired');
    readout.push(`G1 Global Store Set, unwritten source: Set ⇒ ${JSON.stringify(first)}; source written ⇒ Set ⇒ ${JSON.stringify(second)}`);
  });

  test('G2 the wire from a String constant: the first Set writes the constant — the typed-in value is never written', async () => {
    const graph = await graphWith(
      [constantSource('const'), { id: 'set', type: 'net.noodl.GlobalStore.Set', parameters: { storeName: 's96', key: 'g2', value: 'typed' } }],
      [{ sourceId: 'src', sourcePort: 'savedValue', targetId: 'set', targetPort: 'value' }]
    );
    await pulse(graph, 'set', 'set');
    const written = globalStoreManager.getKey('s96', 'g2');
    expect(written).toBe('const');
    readout.push(`G2 Global Store Set, String constant source: Set ⇒ ${JSON.stringify(written)}`);
  });
});

describe('O Set Object Properties — a typed-in prop-<key> under a wire into the same prop', () => {
  const setter = (id: string) => ({
    id: 'set',
    type: 'SetModelProperties',
    parameters: { idSource: 'explicit', modelId: id, properties: 'x', 'prop-x': 'typed' }
  });

  test('O1 the wire from a Variable nothing wrote: Do writes the TYPED-IN value; once the source is written, the wire’s value', async () => {
    const graph = await graphWith(
      [unwrittenSource('s96-o1-src'), setter('s96-o1')],
      [{ sourceId: 'src', sourcePort: 'value', targetId: 'set', targetPort: 'prop-x' }]
    );
    await pulse(graph, 'set', 'store');
    const first = Model.get('s96-o1').get('x');
    expect(first).toBe('typed');
    variables().set('s96-o1-src', 'wired');
    await graph.settle(2);
    await pulse(graph, 'set', 'store');
    const second = Model.get('s96-o1').get('x');
    expect(second).toBe('wired');
    readout.push(`O1 Set Object Properties, unwritten source: Do ⇒ ${JSON.stringify(first)}; source written ⇒ Do ⇒ ${JSON.stringify(second)}`);
  });

  test('O2 the wire from a String constant: the first Do writes the constant — the typed-in value is never written', async () => {
    const graph = await graphWith(
      [constantSource('const'), setter('s96-o2')],
      [{ sourceId: 'src', sourcePort: 'savedValue', targetId: 'set', targetPort: 'prop-x' }]
    );
    await pulse(graph, 'set', 'store');
    const written = Model.get('s96-o2').get('x');
    expect(written).toBe('const');
    readout.push(`O2 Set Object Properties, String constant source: Do ⇒ ${JSON.stringify(written)}`);
  });
});

describe('V Variable — a typed-in Value under a wire into Value (a creation-time write)', () => {
  test('V1 the wire from a Variable nothing wrote: the typed-in value is written at creation and STANDS; once the source is written, its value is written over it', async () => {
    const rec = recordVariableWrites('s96-v1');
    try {
      const graph = await graphWith(
        [unwrittenSource('s96-v1-src'), { id: 'v', type: 'Variable2', parameters: { name: 's96-v1', value: 'seed' } }],
        [{ sourceId: 'src', sourcePort: 'value', targetId: 'v', targetPort: 'value' }]
      );
      const atBoot = variables().get('s96-v1');
      expect(atBoot).toBe('seed');
      variables().set('s96-v1-src', 'wired');
      await graph.settle(2);
      expect(variables().get('s96-v1')).toBe('wired');
      expect(rec.writes).toEqual(['seed', 'wired']);
      readout.push(`V1 Variable, unwritten source: at boot=${JSON.stringify(atBoot)}; source written ⇒ ${JSON.stringify(variables().get('s96-v1'))}; write sequence=${JSON.stringify(rec.writes)}`);
    } finally {
      rec.stop();
    }
  });

  test('V2 the wire from a String constant: the constant lands over the typed-in value in the first update — the record shows what was written and in what order', async () => {
    const rec = recordVariableWrites('s96-v2');
    try {
      await graphWith(
        [constantSource('const'), { id: 'v', type: 'Variable2', parameters: { name: 's96-v2', value: 'seed' } }],
        [{ sourceId: 'src', sourcePort: 'savedValue', targetId: 'v', targetPort: 'value' }]
      );
      expect(variables().get('s96-v2')).toBe('const');
      readout.push(`V2 Variable, String constant source: final=${JSON.stringify(variables().get('s96-v2'))}; write sequence=${JSON.stringify(rec.writes)}`);
    } finally {
      rec.stop();
    }
  });
});

describe('M Object — a typed-in prop-<key> under a wire into the same prop (a creation-time write)', () => {
  const object = (id: string) => ({ id: 'obj', type: 'Model2', parameters: { idSource: 'explicit', modelId: id, properties: 'x', 'prop-x': 'seed' } });

  test('M1 the wire from a Variable nothing wrote: the typed-in value is written at creation and STANDS; once the source is written, its value is written over it', async () => {
    const rec = recordModelWrites('s96-m1', 'x');
    try {
      const graph = await graphWith(
        [unwrittenSource('s96-m1-src'), object('s96-m1')],
        [{ sourceId: 'src', sourcePort: 'value', targetId: 'obj', targetPort: 'prop-x' }]
      );
      const atBoot = Model.get('s96-m1').get('x');
      expect(atBoot).toBe('seed');
      variables().set('s96-m1-src', 'wired');
      await graph.settle(2);
      expect(Model.get('s96-m1').get('x')).toBe('wired');
      expect(rec.writes).toEqual(['seed', 'wired']);
      readout.push(`M1 Object, unwritten source: at boot=${JSON.stringify(atBoot)}; source written ⇒ ${JSON.stringify(Model.get('s96-m1').get('x'))}; write sequence=${JSON.stringify(rec.writes)}`);
    } finally {
      rec.stop();
    }
  });

  test('M2 the wire from a String constant: the constant lands over the typed-in value — the record shows what was written and in what order', async () => {
    const rec = recordModelWrites('s96-m2', 'x');
    try {
      await graphWith(
        [constantSource('const'), object('s96-m2')],
        [{ sourceId: 'src', sourcePort: 'savedValue', targetId: 'obj', targetPort: 'prop-x' }]
      );
      expect(Model.get('s96-m2').get('x')).toBe('const');
      readout.push(`M2 Object, String constant source: final=${JSON.stringify(Model.get('s96-m2').get('x'))}; write sequence=${JSON.stringify(rec.writes)}`);
    } finally {
      rec.stop();
    }
  });
});
