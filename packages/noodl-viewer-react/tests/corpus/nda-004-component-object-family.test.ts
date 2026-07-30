/**
 * NDA-004 §2 — the Component Object family, and the one member of it that lied.
 *
 * The family looks like four variations on one node, and the triage expected four cheap ✅s:
 * NDA-015 had given these nodes *raising* without giving them `Failure` **ports**. Reading them
 * produced a different split, which is the phase's recurring lesson (five identical-looking
 * call sites were not five instances of one defect):
 *
 * | Node | Verdict |
 * |---|---|
 * | `Set Parent Component Object Properties` | ✅ — and not mute. It reported **success** for a write that went nowhere |
 * | `Parent Component Object` | ✅ — already raised; had no port to wire |
 * | `Component Object` | 🔵 — no walk to miss, and no `Do` either |
 * | `Set Component Object Properties` | 🔵 — its record is its own component's, which exists by definition |
 *
 * ## The defect these rows exist for
 *
 * `setparentcomponentobjectproperties.ts` walked up for an ancestor owning a Component Object
 * and returned `undefined` when there was none. The shared base handed that straight to
 * `Model.get(undefined)` — which is the *anonymous* tier (`model.ts:205-212`): it mints a brand
 * new record, on every store, that nothing else in the graph can name and nothing holds a
 * reference to. So the node wrote every property the author had wired into a throwaway, and then
 * emitted `Done`.
 *
 * That is worse than the silences in the first §2 batch. Those looked like nothing happening.
 * This actively claimed success for a write that could never be read back — the one thing the
 * Failure Contract says a completion signal must never do.
 *
 * ## Why the 🔵 rows are here too
 *
 * A `Failure` port on a node that cannot fail is, by the contract, worse than no port. The two
 * 🔵 verdicts are therefore load-bearing decisions rather than work not done, and the row that
 * asserts the self variant has **no** `Failure` output is what stops a later mechanical sweep
 * "finishing the family off" and adding one.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';
import ComponentObjectModule from '../../src/nodes/std-library/componentutils/componentobject';
import ParentComponentObjectModule from '../../src/nodes/std-library/componentutils/parentcomponentobject';
import SetComponentObjectPropertiesModule from '../../src/nodes/std-library/componentutils/setcomponentobjectproperties';
import SetParentComponentObjectPropertiesModule from '../../src/nodes/std-library/componentutils/setparentcomponentobjectproperties';
import { GroupModule } from './visual-container';

/** Fires `Do` and supplies the value to store, so no row depends on input-queue ordering. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      go: { type: 'signal' },
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

interface ParentObjectInstance extends NodeInstance {
  _internal: { parentComponentName?: string; model?: { data: Record<string, unknown> } };
}

/**
 * `/root` → `/Outer` → `/Inner`, with the writer under test in `/Inner`.
 *
 * Nesting is not incidental: with a single ancestor there is only one answer and the binding
 * looks perfect no matter which walk it uses. `owners` names the components that get a
 * Component Object node — pass `[]` for the graph that used to write into a throwaway.
 *
 * A `Parent Component Object` reader sits beside the writer so a row can assert the write
 * landed *where the reader looks*, which is the only definition of "it worked" that matters.
 */
async function writerGraph(options: { owners: string[]; target?: string }): Promise<CorpusGraph> {
  const objectNodeFor = (component: string) =>
    options.owners.indexOf(component) !== -1
      ? [{ id: component + '-object', type: 'net.noodl.ComponentObject', parameters: { properties: 'title' } }]
      : [];

  const graph = await createCorpusGraph({
    modules: [
      GroupModule,
      TriggerModule,
      ComponentObjectModule as unknown as NodeModule,
      ParentComponentObjectModule as unknown as NodeModule,
      SetParentComponentObjectPropertiesModule
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'root-group', type: 'Group', children: [{ id: 'outer-instance', type: '/Outer' }] },
            ...objectNodeFor('/root')
          ]
        },
        {
          name: '/Outer',
          nodes: [
            { id: 'outer-group', type: 'Group', children: [{ id: 'inner-instance', type: '/Inner' }] },
            ...objectNodeFor('/Outer')
          ]
        },
        {
          name: '/Inner',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            {
              id: 'writer',
              type: 'net.noodl.SetParentComponentObjectProperties',
              parameters: {
                properties: 'title',
                ...(options.target ? { targetComponent: options.target } : {})
              }
            },
            {
              id: 'inner-group',
              type: 'Group',
              children: [
                {
                  id: 'reader',
                  type: 'net.noodl.ParentComponentObject',
                  parameters: {
                    properties: 'title',
                    ...(options.target ? { targetComponent: options.target } : {})
                  }
                }
              ]
            }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'writer', targetPort: 'prop-title' },
            { sourceId: 'trigger', sourcePort: 'go', targetId: 'writer', targetPort: 'store' }
          ]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

/** Press `Do` with a value on the property input, then let the graph settle. */
async function store(graph: CorpusGraph, value: unknown): Promise<void> {
  const trigger = graph.node<TriggerInstance>('trigger');
  trigger.send(value);
  trigger.go();
  await graph.settle(4);
}

describe('NDA-004 §2: a write with no parent to write to', () => {
  test('reports Failure instead of Done', async () => {
    const graph = await writerGraph({ owners: [] });
    await store(graph, 'hello');

    // The whole row in two lines. `Done` used to fire here, on top of a write into an
    // anonymous record that nothing could ever read.
    expect(graph.signalsFor('writer')).toContain('failure');
    expect(graph.signalsFor('writer')).not.toContain('stored');
  });

  test('raises the miss on the runtime error channel, naming the ancestors it did have', async () => {
    const graph = await writerGraph({ owners: [] });
    await store(graph, 'hello');

    const raised = graph.errors.filter((e) => e.code === 'set-parent-component-object-properties/no-ancestor');
    expect(raised.length).toBe(1);
    // The alternatives, not just the absence — an author can act on "the components above you
    // are /Outer and /root" and cannot act on "could not resolve".
    expect(raised[0].detail).toEqual({ ancestors: ['/Outer', '/root'] });
  });

  test('the Error output carries the message, not just the fact of it', async () => {
    const graph = await writerGraph({ owners: [] });
    await store(graph, 'hello');

    // "A bare `Failure` signal reproduces the current problem one level up" — the contract's
    // own words, and the reason `Error` is part of the port pair rather than a nicety.
    const error = graph.node('writer').getOutput('error').value as string;
    expect(error).toContain('No ancestor component has a Component Object node');
  });

  test('pinned control: with a parent to write to, the write lands and Done fires', async () => {
    const graph = await writerGraph({ owners: ['/Outer'] });
    await store(graph, 'hello');

    // Without this row, every assertion above could be satisfied by a node that had simply
    // stopped working. It also fixes the *direction*: the value must be visible to the reader
    // sitting beside the writer, which is what "it worked" means to an author.
    expect(graph.signalsFor('writer')).toContain('stored');
    expect(graph.signalsFor('writer')).not.toContain('failure');
    expect(graph.errors).toEqual([]);
    expect(graph.node<ParentObjectInstance>('reader')._internal.model.data.title).toBe('hello');
  });
});

describe('NDA-004 §2 / BINDING-CONTRACT §(a): the writer can name its target', () => {
  test('an explicit target reaches past the nearer ancestor, and the reader follows it', async () => {
    const graph = await writerGraph({ owners: ['/root', '/Outer'], target: '/root' });
    await store(graph, 'hello');

    // The case with no expressible answer before this change: two nested ancestors each owning
    // a Component Object, and the author wanting the outer one. Both halves of the pair take
    // the same input, so the state written is the state read.
    expect(graph.signalsFor('writer')).toContain('stored');
    expect(graph.node<ParentObjectInstance>('reader')._internal.parentComponentName).toBe('/root');
    expect(graph.node<ParentObjectInstance>('reader')._internal.model.data.title).toBe('hello');
  });

  test('a target that is not an ancestor fails — it does not fall back and write somewhere', async () => {
    const graph = await writerGraph({ owners: ['/root', '/Outer'], target: '/Nowhere' });
    await store(graph, 'hello');

    // Falling back to /Outer would be worse than writing nothing: the author would see `Done`
    // and believe the component they named had been updated.
    expect(graph.signalsFor('writer')).toContain('failure');
    expect(graph.signalsFor('writer')).not.toContain('stored');
    expect(graph.errors.map((e) => e.code)).toContain('set-parent-component-object-properties/target-not-found');
  });

  test('naming an ancestor that has no Component Object is its own failure', async () => {
    const graph = await writerGraph({ owners: ['/root'], target: '/Outer' });
    await store(graph, 'hello');

    // Split from "not an ancestor" on purpose, and split the same way the reader splits it:
    // two different mistakes with two different fixes.
    expect(graph.errors.map((e) => e.code)).toContain('set-parent-component-object-properties/target-has-no-object');
  });

  test('BINDING-CONTRACT §(b): the writer tells the node card which ancestor it writes to', async () => {
    const graph = await writerGraph({ owners: ['/root', '/Outer'], target: '/root' });

    // The writer had no sub-label at all before this; only the reader half did, so a mismatched
    // pair was invisible on the canvas even though both answers were sitting in memory.
    expect(graph.editorConnection.subLabels['writer']).toBe('→ /root');
  });
});

describe('NDA-004 §2: Parent Component Object has a port for the miss it already raised', () => {
  test('failing to resolve fires Failure and carries the message', async () => {
    const graph = await writerGraph({ owners: [] });
    await graph.settle(4);

    // NDA-015 gave this node the *raise*. A graph still could not branch on "my parent state
    // never resolved", which is the difference between a logging feature and a node feature.
    expect(graph.signalsFor('reader')).toContain('failure');
    expect(graph.node('reader').getOutput('error').value as string).toContain(
      'No ancestor component has a Component Object node'
    );
  });

  test('the port fires once per distinct miss, not once per graph change', async () => {
    const graph = await writerGraph({ owners: [] });
    await graph.settle(4);
    const before = graph.signalsFor('reader').filter((s) => s === 'failure').length;

    await graph.settle(4);

    // The port sits *under* `reportMiss`'s guards rather than beside them, so it cannot become
    // the noisy twin of a channel that is deliberately quiet. `lastMissCode` is what holds it.
    expect(graph.signalsFor('reader').filter((s) => s === 'failure').length).toBe(before);
    expect(before).toBe(1);
  });

  test('pinned control: a resolvable reader stays silent', async () => {
    const graph = await writerGraph({ owners: ['/Outer'] });
    await graph.settle(4);

    expect(graph.signalsFor('reader')).not.toContain('failure');
    expect(graph.errors).toEqual([]);
  });
});

describe('NDA-004 §2: the two 🔵 verdicts, pinned', () => {
  /** One component, one Component Object, one self-variant writer. No walk anywhere. */
  async function selfGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [
        GroupModule,
        TriggerModule,
        ComponentObjectModule as unknown as NodeModule,
        SetComponentObjectPropertiesModule
      ],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'object', type: 'net.noodl.ComponentObject', parameters: { properties: 'title' } },
              {
                id: 'writer',
                type: 'net.noodl.SetComponentObjectProperties',
                parameters: { properties: 'title' }
              }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'writer', targetPort: 'prop-title' },
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'writer', targetPort: 'store' }
            ]
          }
        ]
      } as never
    });

    await graph.settle(4);
    return graph;
  }

  test('Set Component Object Properties has no Failure port, because it cannot miss', async () => {
    const graph = await selfGraph();

    // The contract: "a node that *cannot* fail gets no `Failure` output — a vestigial port
    // implies a failure mode that does not exist". This row is what stops a later sweep
    // "finishing the family off" by giving the self variant the ports its sibling has.
    expect(graph.node('writer').hasOutput('stored')).toBe(true);
    expect(graph.node('writer').hasOutput('failure')).toBe(false);
    expect(graph.node('writer').hasOutput('error')).toBe(false);
  });

  test('and it stores to its own component, in the root component where there is no ancestor at all', async () => {
    const graph = await selfGraph();
    await store(graph, 'hello');

    // The root component has no ancestors whatsoever — the case that makes the parent variant
    // fail. The self variant is unaffected, which is the evidence behind its 🔵.
    expect(graph.signalsFor('writer')).toContain('stored');
    expect(graph.errors).toEqual([]);
  });

  test('Component Object stays silent when values arrive, because a value arriving is not a Do', async () => {
    const graph = await selfGraph();
    await store(graph, 'hello');

    // The Object node's trap, in the family that shares its shape: `Component Object`'s
    // `scheduleStore` is reached from a `value-…` setter, so anything raised there would fire
    // on the ordinary boot path. It has no `Do` and gets no `Failure`.
    expect(graph.node('object').hasOutput('failure')).toBe(false);
    expect(graph.errors).toEqual([]);
  });
});
