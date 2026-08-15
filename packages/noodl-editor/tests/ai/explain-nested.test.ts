/**
 * FIX-001 §1c — looking inside a selected component instance.
 *
 * Before this, an explanation of an instance could describe the *box*: its
 * type, its ports, what was wired to them. "What does it actually do with what
 * I send it" was unanswerable, and assembly said so outright — reading outside
 * the component was "a shape assembly cannot express".
 *
 * Now it can, and the properties worth holding onto are mostly about what did
 * **not** change. The interior arrives in its own section with its own bound and
 * its own owner; `context.nodes` is still one component's slice, because the
 * runtime port set, the warning filter and the node budget all take their
 * meaning from that. And nothing outside the ExplainPanel sees any of it: the
 * MCP and review assemblers hand assembly a graph that cannot resolve an
 * instance, and get byte-identical context back.
 *
 * Offline: assembly touches the bundled catalog and nothing else.
 */

import { assembleContext } from '../../src/editor/src/models/AiAssistant/explain/assemble';
import {
  citableNodeIds,
  componentForCitedNode,
  componentsInExplanation,
  stripUnresolvedCitations
} from '../../src/editor/src/models/AiAssistant/explain/citations';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { renderContext } from '../../src/editor/src/models/AiAssistant/explain/render';
import { renderRuntime } from '../../src/editor/src/models/AiAssistant/explain/runtime';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const SLUG = '/Logic Components/Get Article From Slug';
const GRAPHQL = '/Logic Components/Contentful GraphQL';

const IDS = {
  /** An instance of GRAPHQL, inside SLUG. */
  graphQlInstance: '5031604b-2051-1d79-4685-154ac00ea0cc',
  /** Feeds that instance's Query port — a neighbour, never selected. */
  buildQuery: '0f5d4c0f-f62c-40b5-f04c-cf4fe10afc33',
  /** Interior of GRAPHQL. */
  graphQlInputs: 'd34a0ef4-fe48-1403-b3a2-e476c688fdfd',
  graphQlOutputs: 'a5bb8a6c-0250-9e19-2598-a515eb95ba4c'
};

/** Three instances of one component, in one component. */
const EXPANDED_OPTIONS = '/Visual Components/Profile/Expanded Options';
const PILL = '/Visual Components/Pills/Other Symptom Pill';
const PILL_INSTANCES = [
  '43cab7bb-2ebb-844f-b81a-546cc1e4cbed',
  'd4103db1-0a3b-f700-d614-2c3e1804d6a6',
  'f3d474f9-b493-5e89-f8be-2b7eae9cc78a'
];

/** A 22-node interior whose Component Inputs/Outputs sit at index 11 and 12. */
const ARTICLE_PAGE = '/Pages/Article';
const HEADER = '/Visual Components/Article/Article Page Header';
const HEADER_INSTANCE = 'a3429aaa-2e47-62a1-0d5f-c4a7baffbc35';

describe('FIX-001 §1c — the interior of a selected instance', () => {
  const graph: ExplainGraph = fromSerialisedProject(gitRepoUtf8);

  it('reads the component a selected instance points at', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: SLUG,
      nodeIds: [IDS.graphQlInstance]
    });

    expect(context.nested?.length).toBe(1);
    const nested = context.nested![0];
    expect(nested.name).toBe(GRAPHQL);
    expect(nested.instanceIds).toEqual([IDS.graphQlInstance]);
    // `toContain` twice rather than `expect.arrayContaining` — this suite is
    // jasmine, which has no such matcher, and the plain-Node jest runner used
    // for early feedback does. It compiled there and failed the real gate's
    // webpack build, which then exits 0 at the shell with no results file.
    const interiorIds = nested.nodes.map((n) => n.id);
    expect(interiorIds).toContain(IDS.graphQlInputs);
    expect(interiorIds).toContain(IDS.graphQlOutputs);
    // Whole, in this case — the component has four nodes.
    expect(nested.nodesOmitted).toBe(0);
    expect(nested.nodeCount).toBe(4);
  });

  it('names the component as the project names it, which is what navigation resolves', () => {
    // The instance's *type string* and the component's *name* are the same here,
    // but the section must carry the resolved component's name either way:
    // `ProjectModel.getComponentWithName` matches exactly, and the two forms
    // differ ("Home" vs "/#Home") often enough that guessing is a defect.
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: 'Logic Components/Get Article From Slug', // path form, deliberately
      nodeIds: [IDS.graphQlInstance]
    });
    const resolved = graph.components.find((c) => c.name === GRAPHQL)!;
    expect(context.nested![0].name).toBe(resolved.name);
  });

  it('carries the interface the parent actually wires to', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: SLUG,
      nodeIds: [IDS.graphQlInstance]
    });
    const nested = context.nested![0];
    expect(nested.inputPorts.length).toBeGreaterThan(0);
    expect(nested.outputPorts.length).toBeGreaterThan(0);
  });

  it('reads a component once however many instances of it are selected', () => {
    const context = assembleContext(graph, {
      scope: 'subgraph',
      componentName: EXPANDED_OPTIONS,
      nodeIds: PILL_INSTANCES
    });

    expect(context.nested?.length).toBe(1);
    expect(context.nested![0].name).toBe(PILL);
    // All three instances are named, so the model can say "all three of these".
    expect(context.nested![0].instanceIds.sort()).toEqual([...PILL_INSTANCES].sort());
  });

  it('reads only what was selected, never a neighbour that happens to be an instance', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: SLUG,
      nodeIds: [IDS.buildQuery]
    });

    // The instance is in the context — it is one hop downstream — and is still
    // only a box. Otherwise the size of an answer depends on what the selection
    // happens to sit next to.
    expect(context.nodes.some((n) => n.id === IDS.graphQlInstance)).toBe(true);
    expect(context.nested).toBeUndefined();
  });

  it('does not read an interior for a component-scope explanation', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: ARTICLE_PAGE });
    expect(context.nested).toBeUndefined();
  });

  it('still does not, even when a caller raises the bound at component scope', () => {
    // At component scope every node is a seed, so an interior read there would
    // open every instance in the component — and the section announcing them as
    // "what the reader selected" would be describing a selection of nothing.
    const context = assembleContext(
      graph,
      { scope: 'component', componentName: ARTICLE_PAGE },
      { maxNestedComponents: 5, maxNestedNodes: 40 }
    );
    expect(context.nested).toBeUndefined();
  });
});

describe('FIX-001 §1c — bounds', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);

  it('keeps the interface nodes when the node bound cuts an interior short', () => {
    const context = assembleContext(
      graph,
      { scope: 'node', componentName: ARTICLE_PAGE, nodeIds: [HEADER_INSTANCE] },
      { maxNestedNodes: 5 }
    );

    const nested = context.nested!.find((n) => n.name === HEADER)!;
    expect(nested.nodes.length).toBe(5);
    expect(nested.nodesOmitted).toBe(nested.nodeCount - 5);

    // Document order would have dropped both: they sit at index 11 and 12 of 22.
    const types = nested.nodes.map((n) => n.type);
    expect(types).toContain('Component Inputs');
    expect(types).toContain('Component Outputs');

    // What survived is still emitted in document order.
    const source = graph.components.find((c) => c.name === HEADER)!;
    const order = source.nodes.map((n) => n.id);
    const kept = nested.nodes.map((n) => order.indexOf(n.id));
    expect(kept).toEqual([...kept].sort((a, b) => a - b));
  });

  it('says so in bounds when an interior is cut, and flips truncated', () => {
    const context = assembleContext(
      graph,
      { scope: 'node', componentName: ARTICLE_PAGE, nodeIds: [HEADER_INSTANCE] },
      { maxNestedNodes: 5 }
    );

    expect(context.bounds.truncated).toBe(true);
    expect(context.bounds.notes.join(' ')).toContain(HEADER);
  });

  it('reads no interior at all when the bound is zero', () => {
    const context = assembleContext(
      graph,
      { scope: 'node', componentName: SLUG, nodeIds: [IDS.graphQlInstance] },
      { maxNestedComponents: 0 }
    );
    expect(context.nested).toBeUndefined();
  });

  it('caps how many distinct components one selection can open', () => {
    const profile = graph.components.find((c) => c.name === '/Pages/Profile')!;
    const instanceIds = profile.nodes
      .filter((n) => n.type.startsWith('/'))
      .map((n) => n.id);
    expect(instanceIds.length).toBeGreaterThan(2);

    const context = assembleContext(
      graph,
      { scope: 'subgraph', componentName: '/Pages/Profile', nodeIds: instanceIds },
      { maxNestedComponents: 2 }
    );

    expect(context.nested!.length).toBe(2);
    expect(context.bounds.notes.join(' ')).toContain('not read from the inside');
  });

  it('does not count interior nodes against the component slice budget', () => {
    // `bounds.nodesOmitted` means "nodes of *this* component not shown". An
    // interior read must not move it: the panel and the prompt both read that
    // number as a statement about the component in front of the user.
    const request = { scope: 'node' as const, componentName: SLUG, nodeIds: [IDS.graphQlInstance] };
    const withNested = assembleContext(graph, request);
    const without = assembleContext(graph, request, { maxNestedComponents: 0 });

    expect(withNested.nested).toBeDefined();
    expect(withNested.bounds.nodesOmitted).toBe(without.bounds.nodesOmitted);
    expect(withNested.stats.nodeCount).toBe(without.stats.nodeCount);
    expect(withNested.stats.nestedNodeCount).toBe(withNested.nested![0].nodes.length);
  });

  it('is deterministic', () => {
    const request = { scope: 'subgraph' as const, componentName: EXPANDED_OPTIONS, nodeIds: PILL_INSTANCES };
    expect(renderContext(assembleContext(graph, request))).toBe(
      renderContext(assembleContext(graph, request))
    );
  });
});

describe('FIX-001 §1c — what a caller without the project still gets', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);

  /**
   * The MCP assembler, the review reads and the measurement harness hand
   * assembly the components they have. An instance that resolves to nothing is
   * skipped silently — assembly cannot tell "this project has no such
   * component" from "you gave me one component", and a bounds note claiming
   * something was withheld would be a guess about the caller.
   */
  it('is byte-identical to the pre-1c context when the graph cannot resolve the instance', () => {
    const oneComponent: ExplainGraph = {
      components: [graph.components.find((c) => c.name === SLUG)!]
    };
    const request = { scope: 'node' as const, componentName: SLUG, nodeIds: [IDS.graphQlInstance] };

    const alone = assembleContext(oneComponent, request);
    expect(alone.nested).toBeUndefined();
    expect(alone.bounds.notes).toEqual(assembleContext(oneComponent, request, { maxNestedComponents: 0 }).bounds.notes);
    expect(renderContext(alone)).toBe(renderContext(assembleContext(oneComponent, request, { maxNestedComponents: 0 })));
  });

  it('does not read a component placed inside itself', () => {
    const recursive: ExplainGraph = {
      components: [
        {
          name: '/Recursive',
          nodes: [
            { id: 'a', type: 'Group', parameters: {}, children: ['b'], instancePorts: [] },
            { id: 'b', type: '/Recursive', parameters: {}, parent: 'a', children: [], instancePorts: [] }
          ],
          connections: []
        }
      ]
    };

    const context = assembleContext(recursive, { scope: 'node', componentName: '/Recursive', nodeIds: ['b'] });
    expect(context.nested).toBeUndefined();
  });
});

describe('FIX-001 §1c — the rendered context', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);
  const context = assembleContext(graph, {
    scope: 'node',
    componentName: SLUG,
    nodeIds: [IDS.graphQlInstance]
  });
  const rendered = renderContext(context);

  it('names the component whose interior it is, and the instance it belongs to', () => {
    expect(rendered).toContain(`Inside ${GRAPHQL}`);
    expect(rendered).toContain(IDS.graphQlInstance);
  });

  it('gives every interior node its id, so the model can cite it', () => {
    for (const node of context.nested![0].nodes) {
      expect(rendered).toContain(`\`${node.id}\``);
    }
  });

  it('says the interior nodes are somewhere else', () => {
    expect(rendered).toContain(`not in ${SLUG}`);
  });

  it('tells the model no current value was read inside an instance', () => {
    // 🔴 The §1a lesson, one layer up: an interior node is absent from the
    // Runtime section because nobody asked about it. Left unsaid, "absent" reads
    // as "not mounted", and the prompt tells the model that a not-mounted node
    // "is often the entire answer to why is this empty".
    expect(rendered).toContain('never asked about');
  });

  it('says outright when the whole interior was read', () => {
    // 🔴 Measured on the drive: given a complete interior, the model still wrote
    // "only a 2-node, bounded read … I can't rule out Inputs defined elsewhere".
    // Completeness was in the context only as two numbers to compare. An absence
    // that has to be derived gets derived wrongly — §1a's rule, one layer down.
    expect(context.nested![0].nodesOmitted).toBe(0);
    expect(rendered).toContain('That is the whole component');
  });

  it('says the interface is empty rather than omitting the line', () => {
    const noInterface: ExplainGraph = {
      components: [
        {
          name: '/Parent',
          nodes: [{ id: 'p1', type: '/Leaf', parameters: {}, children: [], instancePorts: [] }],
          connections: []
        },
        {
          name: '/Leaf',
          nodes: [{ id: 'l1', type: 'Text', parameters: { text: 'hi' }, children: [], instancePorts: [] }],
          connections: []
        }
      ]
    };
    const text = renderContext(
      assembleContext(noInterface, { scope: 'node', componentName: '/Parent', nodeIds: ['p1'] })
    );
    expect(text).toContain('it takes nothing in');
    expect(text).toContain('it gives nothing out');
  });

  it('reports the interface of the whole component even when the node read is cut', () => {
    // The interface is a fact about the component, not about how much of it was
    // read. Computing it from the kept nodes instead would turn "cut short" into
    // "has no outputs" — a false claim, in the sentence a parent most relies on.
    const cut = assembleContext(
      graph,
      { scope: 'node', componentName: SLUG, nodeIds: [IDS.graphQlInstance] },
      { maxNestedNodes: 1 }
    );
    const nested = cut.nested![0];
    expect(nested.nodes.length).toBe(1);
    expect(nested.inputPorts.length).toBeGreaterThan(0);
    expect(nested.outputPorts.length).toBeGreaterThan(0);

    const text = renderContext(cut);
    expect(text).not.toContain('That is the whole component');
    expect(text).toContain('of its nodes are not shown');
  });

  it('documents each node type once across the component and its interiors', () => {
    const names = context.nodeTypes.map((t) => t.typeName);
    expect(new Set(names).size).toBe(names.length);
    // A type used only inside is documented — and only once.
    expect(names).toContain('REST2');
    expect(names.filter((n) => n === 'REST2').length).toBe(1);
  });

  it('renders nothing extra when no interior was read', () => {
    const plain = renderContext(
      assembleContext(
        graph,
        { scope: 'node', componentName: SLUG, nodeIds: [IDS.graphQlInstance] },
        { maxNestedComponents: 0 }
      )
    );
    expect(plain).not.toContain('Inside the component instances');
  });
});

describe('FIX-001 §1c — citations across the boundary', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);
  const context = assembleContext(graph, {
    scope: 'node',
    componentName: SLUG,
    nodeIds: [IDS.graphQlInstance]
  });

  it('treats a citation to an interior node as resolved', () => {
    // Without this the panel would demote exactly the citations the nested read
    // exists to produce — silently, and looking like a model hallucination.
    const markdown = `See [the REST call](noodl-node:${IDS.graphQlOutputs}).`;
    expect(stripUnresolvedCitations(markdown, context)).toBe(markdown);
    expect(citableNodeIds(context).has(IDS.graphQlOutputs)).toBe(true);
  });

  it('still demotes a citation to a node in neither', () => {
    const markdown = 'See [nothing](noodl-node:not-a-real-id).';
    expect(stripUnresolvedCitations(markdown, context)).toBe('See nothing.');
  });

  it('reports which component a cited node lives in', () => {
    expect(componentForCitedNode(context, IDS.graphQlOutputs)).toBe(GRAPHQL);
    expect(componentForCitedNode(context, IDS.graphQlInstance)).toBe(SLUG);
    // An id in neither resolves to the component being explained, which is what
    // the panel navigated to before there were interiors at all.
    expect(componentForCitedNode(context, 'not-a-real-id')).toBe(SLUG);
  });

  it('counts an interior as somewhere the explanation still covers', () => {
    // 🔴 The panel drops a session when the user navigates away from the
    // component it explains. Clicking an interior citation *is* a navigation
    // away under that rule, so without this the answer would be disposed by the
    // click it came from — the panel blanking at the moment the feature worked.
    const covered = componentsInExplanation(context);
    expect(covered).toContain(SLUG);
    expect(covered).toContain(GRAPHQL);
    expect(covered).not.toContain('/Pages/Article');
  });

  it('never claims an interior node is unmounted', () => {
    // The absence rule is `asked − answered`, and an interior node is in
    // neither set. A later change that resolved absence against every citable
    // id would reintroduce the §1a defect one layer down.
    const runtime = renderRuntime(context, {
      isPreviewRunning: true,
      values: [],
      liveNodeIds: [],
      askedNodeIds: [IDS.graphQlInstance],
      diagnoses: []
    });
    for (const node of context.nested![0].nodes) {
      expect(runtime).not.toContain(node.id);
    }
  });
});
