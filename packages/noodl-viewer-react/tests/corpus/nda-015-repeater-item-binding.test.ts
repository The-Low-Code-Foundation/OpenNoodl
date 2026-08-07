/**
 * NDA-015 §2 / FINDINGS F-ii — the Binding Contract applied to "the current Repeater item".
 *
 * The sweep at the end of NDA-015 found the implicit-binding class was wider than the two
 * nodes the spec named. `_forEachModel` — the ambient "current item" a Repeater (or Run Tasks)
 * hangs on the component instance it creates — was resolved by a hand-copied walk in **five**
 * places (`modelcrudbase`, `modelnode2`, `dbmodelcrudbase`, `dbmodelnode2`,
 * `javascriptnodeparser._findForEachModel`), each ending:
 *
 * ```js
 * this.setModel(component !== undefined ? component._forEachModel : undefined);
 * ```
 *
 * So **`Id Source = From repeater` on a node that is not inside a Repeater bound to nothing
 * and said nothing** — clause (c) exactly — and nested Repeaters bound nearest-wins with no
 * way to name the intended one and nothing on the canvas to say which was picked, which is
 * clause (a) and (b).
 *
 * These rows are that contract on this protocol. The graphs nest Repeaters deliberately, for
 * the same reason the sibling file nests components: with one Repeater there is only one
 * answer and the binding looks perfect no matter what the code does.
 */

/* eslint-env jest */

import type { ModelLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NoodlRuntime from '@noodl/runtime';
import Model = require('@noodl/runtime/src/model');
import ObjectNodeModule = require('@noodl/runtime/src/nodes/std-library/data/modelnode2');
import RecordNodeModule = require('@noodl/runtime/src/nodes/std-library/data/dbmodelnode2');

import ForEachModule from '../../src/nodes/std-library/data/foreach';

/** The Repeater's minimal visual parent — the same three-method contract as NDA-013's. */
interface ContainerInstance extends NodeInstance {
  _children: Array<NodeInstance & { parent?: NodeInstance }>;
}

const ContainerModule: NodeModule = {
  node: {
    name: 'corpus.Container',
    category: 'Corpus',
    initialize: function (this: ContainerInstance) {
      this._children = [];
    },
    methods: {
      addChild: function (this: ContainerInstance, child: NodeInstance & { parent?: NodeInstance }, index?: number) {
        if (index === undefined || index >= this._children.length) this._children.push(child);
        else this._children.splice(index, 0, child);
        child.parent = this;
      },
      removeChild: function (this: ContainerInstance, child: NodeInstance & { parent?: NodeInstance }) {
        const idx = this._children.indexOf(child);
        if (idx !== -1) this._children.splice(idx, 1);
        child.parent = undefined;
      },
      getChildren: function (this: ContainerInstance) {
        return this._children;
      }
    }
  }
};

interface ObjectInstance extends NodeInstance {
  _internal: { model?: ModelLike };
}

/** The record the Object node actually bound to, read off the node rather than off a port. */
function boundItemId(graph: CorpusGraph, id = 'object'): string | undefined {
  const model = graph.node<ObjectInstance>(id)._internal.model;
  return model ? model.getId() : undefined;
}

/**
 * Two nested Repeaters, with an Object node in the innermost template.
 *
 * `/root → outer Repeater → /Outer → inner Repeater → /Inner → object`. Both `/Outer` and
 * `/Inner` instances end up carrying a `_forEachModel`, which is the whole point: the walk has
 * two candidates and has to be asked which one is meant.
 */
async function nestedRepeaters(options: { repeaterComponent?: string; idSource?: string } = {}) {
  const graph = await createCorpusGraph({
    modules: [ForEachModule, ContainerModule, ObjectNodeModule as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'root-container',
              type: 'corpus.Container',
              children: [
                { id: 'outer-repeater', type: 'For Each', parameters: { template: '/Outer', templateType: 'explicit' } }
              ]
            }
          ],
          connections: []
        },
        {
          name: '/Outer',
          nodes: [
            {
              id: 'outer-container',
              type: 'corpus.Container',
              children: [
                { id: 'inner-repeater', type: 'For Each', parameters: { template: '/Inner', templateType: 'explicit' } }
              ]
            }
          ],
          connections: []
        },
        {
          name: '/Inner',
          nodes: [
            {
              id: 'object',
              type: 'Model2',
              parameters: {
                idSource: options.idSource || 'foreach',
                ...(options.repeaterComponent ? { repeaterComponent: options.repeaterComponent } : {})
              }
            }
          ],
          connections: []
        }
      ]
    } as never
  });

  graph.node('outer-repeater').setInputValue('items', [Model.create({ id: 'outer-item' })]);
  await graph.settle(6);

  graph.node('inner-repeater').setInputValue('items', [Model.create({ id: 'inner-item' })]);
  await graph.settle(6);

  return graph;
}

/** One Repeater whose template holds the node under test, or no Repeater at all. */
async function singleGraph(options: {
  nodeType: string;
  insideRepeater: boolean;
  parameters?: Record<string, unknown>;
}) {
  const under = { id: 'object', type: options.nodeType, parameters: options.parameters || { idSource: 'foreach' } };

  const graph = await createCorpusGraph({
    modules: [
      ForEachModule,
      ContainerModule,
      ObjectNodeModule as unknown as NodeModule,
      RecordNodeModule as unknown as NodeModule
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'root-container',
              type: 'corpus.Container',
              children: options.insideRepeater
                ? [{ id: 'repeater', type: 'For Each', parameters: { template: '/Item', templateType: 'explicit' } }]
                : []
            },
            // Outside the Repeater, the node under test sits directly in `/root` — which is
            // the author mistake this whole file exists for.
            ...(options.insideRepeater ? [] : [under])
          ],
          connections: []
        },
        { name: '/Item', nodes: options.insideRepeater ? [under] : [], connections: [] }
      ]
    } as never
  });

  if (options.insideRepeater) {
    graph.node('repeater').setInputValue('items', [Model.create({ id: 'the-item' })]);
  }
  await graph.settle(6);

  return graph;
}

describe('NDA-015 §2 / F-ii: the current Repeater item obeys the Binding Contract', () => {
  const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;

  beforeAll(() => {
    // Same stub as NDA-013: `foreach.tsx` reads two project settings straight off
    // `NoodlRuntime.instance`, which a corpus graph never constructs.
    (NoodlRuntime as unknown as { instance?: unknown }).instance = { getProjectSettings: () => ({}) };
  });

  afterAll(() => {
    (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
  });

  describe('§(c): binding to nothing is loud', () => {
    test('Id Source = From repeater outside any Repeater raises rather than binding silently', async () => {
      const graph = await singleGraph({ nodeType: 'Model2', insideRepeater: false });

      // The headline row. This is the whole defect: the node asked for the current item, there
      // was none, and every one of the five sites answered `undefined` and moved on.
      expect(boundItemId(graph)).toBeUndefined();
      expect(graph.errors.map((e) => e.code)).toContain('repeater-item/no-item-in-scope');
    });

    test('the message names Run Tasks too, because it is the other producer', async () => {
      const graph = await singleGraph({ nodeType: 'Model2', insideRepeater: false });

      // `runtasks.ts` sets `_forEachModel` with the same `createNode` extraProps shape as the
      // Repeater. Telling an author with a Run Tasks template that they are "not inside a
      // Repeater" would send them hunting a bug that is not there.
      const raised = graph.errors.filter((e) => e.code === 'repeater-item/no-item-in-scope');
      expect(raised[0].message).toContain('Run Tasks');
    });

    test('the miss is raised once, not once per resolution', async () => {
      const graph = await singleGraph({ nodeType: 'Model2', insideRepeater: false });
      const before = graph.errors.length;

      graph.node('object').setInputValue('idSource', 'foreach');
      await graph.settle(4);

      expect(graph.errors.length).toBe(before);
    });

    test('a Record outside a Repeater reports instead of throwing a TypeError', async () => {
      // PLAT-003 NOTES §27.3, carried as a documented live defect until now: `dbmodelnode2`'s
      // `setModel` dereferenced its argument unguarded, so the same walk that merely fell
      // silent on the Object node *crashed* here — from inside an input setter. The twins now
      // agree, and the miss is reported rather than thrown.
      const graph = await singleGraph({ nodeType: 'DbModel2', insideRepeater: false });

      expect(boundItemId(graph)).toBeUndefined();
      expect(graph.errors.map((e) => e.code)).toContain('repeater-item/no-item-in-scope');
    });

    test('a node inside a Repeater raises nothing', async () => {
      // The pinned control. Without it, "no errors" above could equally mean the error bus was
      // never wired to this graph.
      const graph = await singleGraph({ nodeType: 'Model2', insideRepeater: true });

      expect(boundItemId(graph)).toBe('the-item');
      expect(graph.errors).toEqual([]);
    });

    test('Id Source = explicit outside a Repeater is not a binding failure', async () => {
      // The other control: the raise is tied to the author having *asked* for the repeater
      // item, not to the node existing outside a Repeater.
      const graph = await singleGraph({
        nodeType: 'Model2',
        insideRepeater: false,
        parameters: { idSource: 'explicit' }
      });

      expect(graph.errors).toEqual([]);
    });
  });

  describe('§(a): which Repeater, when there are two', () => {
    test('the default is unchanged — the innermost Repeater wins', async () => {
      const graph = await nestedRepeaters();

      // The contract does not change which one wins; existing projects must bind as they did.
      expect(boundItemId(graph)).toBe('inner-item');
      expect(graph.errors).toEqual([]);
    });

    test('an explicit target reaches past the inner Repeater to the outer one', async () => {
      const graph = await nestedRepeaters({ repeaterComponent: '/Outer' });

      // The case that had no expressible answer before: two nested Repeaters, and the author
      // wanting the outer item.
      expect(boundItemId(graph)).toBe('outer-item');
      expect(graph.errors).toEqual([]);
    });

    test('an explicit target that is not in scope fails — it does not fall back', async () => {
      const graph = await nestedRepeaters({ repeaterComponent: '/Nowhere' });

      // Falling back to the inner item would be the silent-wrong-target bug wearing the input
      // that was supposed to prevent it.
      expect(boundItemId(graph)).toBeUndefined();
      expect(graph.errors.map((e) => e.code)).toContain('repeater-item/target-not-found');
    });

    test('naming a component in scope that is not a repeater template is its own failure', async () => {
      const graph = await nestedRepeaters({ repeaterComponent: '/root' });

      // Distinct from "not in scope" on purpose: "you named a component that does not contain
      // this node" and "you named the right component and it is not repeated" are different
      // mistakes with different fixes.
      expect(graph.errors.map((e) => e.code)).toContain('repeater-item/target-has-no-item');
    });
  });

  describe('§(b): the resolved Repeater is visible', () => {
    test('the node card is told which template supplied the item', async () => {
      const graph = await nestedRepeaters();

      // The component, not the record id: one graph node is many runtime nodes, so labelling
      // by item would report "→ 10 targets" on a perfectly-bound node in a 10-row Repeater.
      expect(graph.editorConnection.subLabels['object']).toBe('→ /Inner');
    });

    test('an explicit target moves the label with the binding', async () => {
      const graph = await nestedRepeaters({ repeaterComponent: '/Outer' });

      expect(graph.editorConnection.subLabels['object']).toBe('→ /Outer');
    });

    test('a node that resolved nothing claims no target', async () => {
      const graph = await singleGraph({ nodeType: 'Model2', insideRepeater: false });

      expect(graph.editorConnection.subLabels['object']).toBeUndefined();
    });
  });
});
