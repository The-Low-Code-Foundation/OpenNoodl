/**
 * NDA-015 §2 / NDA-010 §2 — the Binding Contract, applied.
 *
 * `dev-docs/reference/BINDING-CONTRACT.md` says a node that resolves a target implicitly must
 * (a) accept an explicit target, (b) show what it resolved, and (c) warn when it resolves
 * nothing. These rows are that contract, one clause at a time, on the two nodes it names.
 *
 * The graphs here nest components deliberately, because *nesting is the defect*. Richard's
 * "sometimes the wrong Component Object will be updated" is what a single-component test can
 * never reproduce: with one ancestor there is only one answer and the binding looks perfect.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ComponentObjectModule = require('@noodl/runtime/src/nodes/std-library/componentutils/componentobject');
import ParentComponentObjectModule from '../../src/nodes/std-library/componentutils/parentcomponentobject';
import SetParentComponentObjectPropertiesModule from '../../src/nodes/std-library/componentutils/setparentcomponentobjectproperties';

import { GroupModule } from './visual-container';

interface ParentObjectInstance extends NodeInstance {
  _internal: { parentComponentName?: string; model?: { data: Record<string, unknown> } };
}

/**
 * Two or three nested components, each optionally owning a Component Object.
 *
 * `/root` contains `/Outer`, which contains `/Inner`, which holds the Parent Component Object
 * node under test. `owners` names the components that get a Component Object node.
 */
async function nestedGraph(options: {
  owners: string[];
  target?: string;
}): Promise<CorpusGraph> {
  const objectNodeFor = (component: string) =>
    options.owners.indexOf(component) !== -1
      ? [{ id: component + '-object', type: 'net.noodl.ComponentObject', parameters: { properties: 'title' } }]
      : [];

  const graph = await createCorpusGraph({
    modules: [
      GroupModule,
      ComponentObjectModule as unknown as NodeModule,
      ParentComponentObjectModule as unknown as NodeModule
    ],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'root-group',
              type: 'Group',
              children: [{ id: 'outer-instance', type: '/Outer' }]
            },
            ...objectNodeFor('/root')
          ]
        },
        {
          name: '/Outer',
          nodes: [
            {
              id: 'outer-group',
              type: 'Group',
              children: [{ id: 'inner-instance', type: '/Inner' }]
            },
            ...objectNodeFor('/Outer')
          ]
        },
        {
          name: '/Inner',
          nodes: [
            {
              id: 'inner-group',
              type: 'Group',
              children: [
                {
                  id: 'parent-object',
                  type: 'net.noodl.ParentComponentObject',
                  parameters: {
                    properties: 'title',
                    ...(options.target ? { targetComponent: options.target } : {})
                  }
                }
              ]
            },
            ...objectNodeFor('/Inner')
          ]
        }
      ]
    } as never
  });

  await graph.settle(4);
  return graph;
}

/** What the node bound to, read off the node itself rather than off the canvas message. */
function boundTo(graph: CorpusGraph): string | undefined {
  return graph.node<ParentObjectInstance>('parent-object')._internal.parentComponentName;
}

describe('NDA-015 §(a): Parent Component Object can name its target', () => {
  test('the default is unchanged — the nearest ancestor that owns a Component Object', async () => {
    const graph = await nestedGraph({ owners: ['/root', '/Outer'] });

    // Both /root and /Outer qualify. The contract does not change which one wins; existing
    // projects must bind exactly as they did.
    expect(boundTo(graph)).toBe('/Outer');
  });

  test('an explicit target reaches past the nearer ancestor', async () => {
    const graph = await nestedGraph({ owners: ['/root', '/Outer'], target: '/root' });

    // This is the case that had no expressible answer before: two nested components each
    // owning a Component Object, and the author wanting the outer one.
    expect(boundTo(graph)).toBe('/root');
    expect(graph.errors).toEqual([]);
  });

  test('an explicit target that is not an ancestor fails — it does not fall back', async () => {
    const graph = await nestedGraph({ owners: ['/root', '/Outer'], target: '/Nowhere' });

    // Falling back to /Outer would be the silent-wrong-target bug wearing the input that was
    // supposed to prevent it. Nothing bound, and the miss was raised.
    expect(boundTo(graph)).toBeUndefined();
    expect(graph.errors.map((e) => e.code)).toContain('parent-component-object/target-not-found');
  });

  test('naming an ancestor that has no Component Object is its own failure', async () => {
    const graph = await nestedGraph({ owners: ['/root'], target: '/Outer' });

    // Distinct from "not an ancestor" on purpose: the two mistakes have different fixes, and
    // a single "could not resolve" would leave the author guessing which one they made.
    expect(graph.errors.map((e) => e.code)).toContain('parent-component-object/target-has-no-object');
  });
});

describe('NDA-015 §(b): the resolved target is visible', () => {
  test('the node card is told which ancestor was bound', async () => {
    const graph = await nestedGraph({ owners: ['/root', '/Outer'] });

    // Clause (b). Before this, the answer existed only inside `getInspectInfo` — visible to
    // somebody already inspecting the node, which is to say already suspecting it.
    expect(graph.editorConnection.subLabels['parent-object']).toBe('→ /Outer');
  });

  test('a node that resolved nothing claims no target', async () => {
    const graph = await nestedGraph({ owners: [] });

    expect(graph.editorConnection.subLabels['parent-object']).toBeUndefined();
  });
});

describe('NDA-015 §(c): resolving nothing is loud', () => {
  test('no ancestor with a Component Object raises rather than binding to nothing quietly', async () => {
    const graph = await nestedGraph({ owners: [] });

    const raised = graph.errors.filter((e) => e.code === 'parent-component-object/no-ancestor');
    expect(raised.length).toBeGreaterThan(0);
    // The ancestors that *do* exist ride along, so the message can say what the author has
    // to choose from rather than only what they do not.
    expect(raised[0].detail).toEqual({ ancestors: ['/Outer', '/root'] });
  });

  test('the miss is raised once, not once per graph change', async () => {
    const graph = await nestedGraph({ owners: [] });
    const before = graph.errors.length;

    await graph.settle(4);

    // `findParentComponentStateModelId` runs again on every `componentStateNodesChanged`.
    // Without the `lastMissCode` guard a legitimately-unresolvable node would drown the very
    // channel it is trying to report on.
    expect(graph.errors.length).toBe(before);
  });

  test('a healthy graph raises nothing', async () => {
    // The pinned control. Without it, "no errors" above could equally mean the error bus was
    // never wired to this graph at all.
    const graph = await nestedGraph({ owners: ['/Outer'] });

    expect(graph.errors).toEqual([]);
    expect(boundTo(graph)).toBe('/Outer');
  });
});

/**
 * The read half and the write half of Component Object state must pick the same ancestor.
 *
 * NDA-015 §2 said the hand-copied walk had been reduced to one implementation. It had not —
 * only `parentcomponentobject.ts` adopted `componentwalk.ts`, and the other three copies were
 * still hand-rolled with their **own type lists**, which had diverged:
 *
 * | Site | Accepted |
 * |---|---|
 * | `parentcomponentobject.ts` (reads) | modern + deprecated |
 * | `javascriptnodeparser.js` (Function nodes read) | modern + deprecated |
 * | `setparentcomponentobjectproperties.ts` (**writes**) | modern only |
 *
 * That is not a tidiness problem. With a deprecated `Component State` on the nearer ancestor
 * and a modern Component Object further up, the reading node bound to the nearer one and the
 * writing node beside it wrote to the further one — the same piece of state read from one
 * component and written to another, silently, with no way to see it.
 */
describe('NDA-015 §2: the Component Object walk is one walk', () => {
  /**
   * A stand-in for the deprecated `Component State` node.
   *
   * The walk's only question is "does this component's scope contain a node of this type", so
   * a bare registration is a faithful stimulus — and it keeps this row from depending on the
   * deprecated node's own behaviour, which is not what is under test.
   */
  const DeprecatedComponentStateModule: NodeModule = {
    node: { name: 'Component State', category: 'Corpus' }
  };

  /** `/root` (modern Component Object) → `/Outer` (deprecated) → `/Inner` (both nodes). */
  async function splitOwnerGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [
        GroupModule,
        ComponentObjectModule as unknown as NodeModule,
        ParentComponentObjectModule as unknown as NodeModule,
        SetParentComponentObjectPropertiesModule,
        DeprecatedComponentStateModule
      ],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'root-group', type: 'Group', children: [{ id: 'outer-instance', type: '/Outer' }] },
              { id: 'root-object', type: 'net.noodl.ComponentObject', parameters: { properties: 'title' } }
            ]
          },
          {
            name: '/Outer',
            nodes: [
              { id: 'outer-group', type: 'Group', children: [{ id: 'inner-instance', type: '/Inner' }] },
              // The nearer owner, and the deprecated spelling.
              { id: 'outer-state', type: 'Component State' }
            ]
          },
          {
            name: '/Inner',
            nodes: [
              {
                id: 'inner-group',
                type: 'Group',
                children: [
                  { id: 'parent-object', type: 'net.noodl.ParentComponentObject', parameters: { properties: 'title' } },
                  {
                    id: 'set-parent-object',
                    type: 'net.noodl.SetParentComponentObjectProperties',
                    parameters: { properties: 'title' }
                  }
                ]
              }
            ]
          }
        ]
      } as never
    });

    await graph.settle(4);
    return graph;
  }

  test('the reader and the writer resolve to the same component', async () => {
    const graph = await splitOwnerGraph();

    const readId = graph
      .node<ParentObjectInstance & { findParentComponentStateModelId(): string | undefined }>('parent-object')
      .findParentComponentStateModelId();
    // NDA-004 §2 renamed `getComponentObjectId` to `resolveComponentObject`, which returns the
    // miss reason alongside the id — the write half could previously only answer "nothing", and
    // handed that `undefined` to `Model.get`, which silently minted a throwaway record.
    const writeId = graph
      .node<NodeInstance & { resolveComponentObject(): { id?: string } }>('set-parent-object')
      .resolveComponentObject().id;

    // The claim in one line: reading and writing "the parent component object" must mean the
    // same object. Before the shared walk these were two different components.
    expect(readId).toBe(writeId);
    expect(readId).toBeDefined();
  });

  test('both pick the nearer ancestor, deprecated spelling included', async () => {
    const graph = await splitOwnerGraph();

    // Naming which one they agree on, so "they agree" cannot be satisfied by both being wrong
    // in the same direction — e.g. both skipping `/Outer` and landing on `/root`.
    expect(graph.node<ParentObjectInstance>('parent-object')._internal.parentComponentName).toBe('/Outer');
  });
});
