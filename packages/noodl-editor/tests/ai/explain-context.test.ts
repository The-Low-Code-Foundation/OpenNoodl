/**
 * AIX-004 — Explain Mode: context assembly.
 *
 * The spec's testing plan puts two properties above all others: context is
 * bounded and the whole project is never sent, and explanations are contextual
 * rather than generic. Only the first is directly testable without a model, but
 * the second has a testable precondition — the context must actually *contain*
 * the connections, parameter values and port semantics that make an explanation
 * specific. Both are asserted here, against the same real-project corpus the
 * validator's false-positive suite uses.
 *
 * Offline: assembly touches the bundled catalog and nothing else.
 */

import {
  assembleContext,
  ExplainContextError
} from '../../src/editor/src/models/AiAssistant/explain/assemble';
import { componentPorts, fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { renderContext } from '../../src/editor/src/models/AiAssistant/explain/render';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
const syntheticAwkward = require('../io/fixtures/synthetic-awkward.project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

// A real component with a signal chain, a component instance, a Component
// Inputs/Outputs pair and two JavaScript nodes — i.e. all the shapes an
// explanation has to describe.
const COMPONENT = '/Logic Components/Get Article From Slug';
const IDS = {
  componentInputs: '24fe2934-6dd3-566f-25c3-580ad51da5f9',
  componentOutputs: 'acdd6097-9bb4-fb3f-63f6-9c02a1c388ef',
  buildQuery: '0f5d4c0f-f62c-40b5-f04c-cf4fe10afc33',
  graphQlInstance: '5031604b-2051-1d79-4685-154ac00ea0cc',
  parseResult: '683d4253-ad8c-2db5-f534-66661c3d5187',
  collection: 'd8d35d3b-7846-0b92-8c4a-fedf93f6f981',
  filter: '81513bd0-baf1-1b56-86ae-f37040ee8cd6',
  model: '9649086d-7367-4be2-22fc-5ae4d22d2157',
  expression: '54d7ad5a-61cb-fed4-2f76-f452334d7219'
};

describe('AIX-004 graph adapter', () => {
  const graph: ExplainGraph = fromSerialisedProject(gitRepoUtf8);

  it('adapts every component in a real project', () => {
    expect(graph.components.length).toBe(gitRepoUtf8.components.length);
  });

  it('flattens the visual hierarchy while keeping parent/child links', () => {
    const article = graph.components.find((c) => c.name === '/Pages/Article');
    expect(article).toBeDefined();
    const withParents = article!.nodes.filter((n) => n.parent);
    expect(withParents.length).toBeGreaterThan(0);
    for (const node of withParents) {
      const parent = article!.nodes.find((n) => n.id === node.parent);
      expect(parent).toBeDefined();
      expect(parent!.children).toContain(node.id);
    }
  });

  it('derives a component interface from its Component Inputs/Outputs nodes', () => {
    const component = graph.components.find((c) => c.name === COMPONENT)!;
    const ports = componentPorts(component);
    expect(ports.inputPorts).toEqual(['Do', 'Slug']);
    expect(ports.outputPorts).toEqual(['Failure', 'Success', 'article']);
  });

  it('carries authored parameter values, which is what makes an explanation specific', () => {
    const component = graph.components.find((c) => c.name === COMPONENT)!;
    const script = component.nodes.find((n) => n.id === IDS.buildQuery)!;
    expect(typeof script.parameters['functionScript']).toBe('string');
    expect((script.parameters['functionScript'] as string).length).toBeGreaterThan(0);
  });
});

describe('AIX-004 context assembly — bounds', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);

  it('never includes nodes from another component', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [IDS.graphQlInstance]
    });

    const idsInComponent = new Set(graph.components.find((c) => c.name === COMPONENT)!.nodes.map((n) => n.id));
    for (const node of context.nodes) {
      expect(idsInComponent.has(node.id)).toBe(true);
    }
  });

  it('does not include the interior of a component instance, only the instance itself', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [IDS.graphQlInstance]
    });

    const instance = context.nodes.find((n) => n.id === IDS.graphQlInstance)!;
    expect(instance.isComponentInstance).toBe(true);

    // The referenced component has its own nodes; none of them may appear.
    const referenced = graph.components.find((c) => c.name === '/Logic Components/Contentful GraphQL')!;
    expect(referenced.nodes.length).toBeGreaterThan(0);
    const contextIds = new Set(context.nodes.map((n) => n.id));
    for (const node of referenced.nodes) {
      expect(contextIds.has(node.id)).toBe(false);
    }
  });

  it('respects an explicit node budget and records what it dropped', () => {
    const context = assembleContext(
      graph,
      { scope: 'component', componentName: '/Pages/Article' },
      { maxNodes: 5 }
    );

    expect(context.nodes.length).toBe(5);
    expect(context.bounds.truncated).toBe(true);
    expect(context.bounds.nodesOmitted).toBeGreaterThan(0);
    expect(context.bounds.notes.length).toBeGreaterThan(0);
  });

  it('never drops the selected nodes to satisfy the budget', () => {
    const selected = [IDS.buildQuery, IDS.graphQlInstance, IDS.parseResult];
    const context = assembleContext(
      graph,
      { scope: 'subgraph', componentName: COMPONENT, nodeIds: selected },
      { maxNodes: 3 }
    );

    const ids = context.nodes.map((n) => n.id);
    for (const id of selected) expect(ids).toContain(id);
  });

  it('truncates long parameter values rather than dropping or sending them whole', () => {
    const context = assembleContext(
      graph,
      { scope: 'node', componentName: COMPONENT, nodeIds: [IDS.buildQuery] },
      { maxParameterChars: 40 }
    );

    const node = context.nodes.find((n) => n.id === IDS.buildQuery)!;
    const script = node.parameters.find((p) => p.name === 'functionScript')!;
    expect(script.truncated).toBe(true);
    expect(script.value.length).toBeLessThanOrEqual(41); // 40 + the ellipsis
  });

  it('counts connections that cross the edge of the slice', () => {
    const context = assembleContext(
      graph,
      { scope: 'node', componentName: COMPONENT, nodeIds: [IDS.buildQuery] },
      { neighbourDepth: 0 }
    );

    expect(context.nodes.length).toBe(1);
    expect(context.connections.length).toBe(0);
    expect(context.bounds.connectionsOmitted).toBeGreaterThan(0);
  });

  it('is deterministic — the same request twice produces identical rendered context', () => {
    const request = { scope: 'component' as const, componentName: COMPONENT };
    const first = renderContext(assembleContext(graph, request));
    const second = renderContext(assembleContext(graph, request));
    expect(first).toBe(second);
  });
});

describe('AIX-004 context assembly — scopes', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);

  it('node scope follows the wire in both directions and labels the direction', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [IDS.graphQlInstance]
    });

    const byId = new Map(context.nodes.map((n) => [n.id, n]));
    expect(byId.get(IDS.graphQlInstance)!.role).toBe('selected');
    // Feeds the instance's Query port.
    expect(byId.get(IDS.buildQuery)!.role).toBe('upstream');
    // Fed by the instance's queryResult port.
    expect(byId.get(IDS.parseResult)!.role).toBe('downstream');
  });

  it('node scope at depth 2 reaches two hops but not three', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [IDS.model]
    });

    const ids = new Set(context.nodes.map((n) => n.id));
    expect(ids.has(IDS.filter)).toBe(true); // one hop
    expect(ids.has(IDS.collection)).toBe(true); // two hops
    expect(ids.has(IDS.componentInputs)).toBe(true); // also two hops, via the filter's Slug input
    expect(ids.has(IDS.graphQlInstance)).toBe(false); // three hops away
  });

  it('subgraph scope keeps every selected node and the wires between them', () => {
    const context = assembleContext(graph, {
      scope: 'subgraph',
      componentName: COMPONENT,
      nodeIds: [IDS.collection, IDS.filter, IDS.model]
    });

    expect(context.selectedIds.length).toBe(3);
    const pairs = context.connections.map((c) => `${c.fromId}->${c.toId}`);
    expect(pairs).toContain(`${IDS.collection}->${IDS.filter}`);
    expect(pairs).toContain(`${IDS.filter}->${IDS.model}`);
  });

  it('component scope covers the whole component and reports its shape', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });

    expect(context.selectedIds).toEqual([]);
    expect(context.nodes.length).toBe(9);
    expect(context.component.nodeCount).toBe(9);
    expect(context.component.connectionCount).toBe(12);
    expect(context.component.inputPorts).toContain('Slug');
    expect(context.component.outputPorts).toContain('article');
    expect(context.bounds.nodesOmitted).toBe(0);
  });

  it('resolves a component by path form as well as legacy name', () => {
    const context = assembleContext(graph, {
      scope: 'component',
      componentName: 'Logic Components/Get Article From Slug'
    });
    expect(context.component.name).toBe(COMPONENT);
  });

  it('rejects a request naming a node that is not in the component', () => {
    expect(() =>
      assembleContext(graph, { scope: 'node', componentName: COMPONENT, nodeIds: ['not-a-real-id'] })
    ).toThrowError(ExplainContextError);
  });

  it('rejects a node/subgraph request with no selection', () => {
    expect(() => assembleContext(graph, { scope: 'node', componentName: COMPONENT, nodeIds: [] })).toThrowError(
      ExplainContextError
    );
  });
});

describe('AIX-004 catalog semantics in context', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);

  it('documents each distinct node type once, with SUB-005 semantics attached', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });

    const typeNames = context.nodeTypes.map((t) => t.typeName);
    expect(new Set(typeNames).size).toBe(typeNames.length);

    const expression = context.nodeTypes.find((t) => t.typeName === 'Expression');
    expect(expression).toBeDefined();
    // SUB-005 documented this type; without its summary an explanation of an
    // Expression node can only restate the parameter value back at the user.
    expect(expression!.summary).toBeTruthy();
  });

  it('documents only the ports the context actually references', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });

    const collection = context.nodeTypes.find((t) => t.typeName === 'Collection2');
    expect(collection).toBeDefined();
    const portNames = collection!.ports.map((p) => p.name);
    // Referenced by a parameter and a connection respectively…
    expect(portNames).toContain('collectionId');
    expect(portNames).toContain('items');
    // …and the type has many more ports than that.
    expect(portNames.length).toBeLessThan(20);
  });

  it('marks a component instance as defined in the project rather than unknown', () => {
    const context = assembleContext(graph, {
      scope: 'node',
      componentName: COMPONENT,
      nodeIds: [IDS.graphQlInstance]
    });

    const instanceType = context.nodeTypes.find((t) => t.typeName === '/Logic Components/Contentful GraphQL')!;
    expect(instanceType.unknown).toBeFalsy();
  });

  it('marks module/legacy types as unknown so the model is told not to guess', () => {
    // This project uses node types the catalog cannot enumerate — `Markdown`
    // and `module.inlineHtml`, the same ones SUB-006 warns about.
    const context = assembleContext(graph, {
      scope: 'component',
      componentName: '/Visual Components/Article/Article'
    });
    const unknowns = context.nodeTypes.filter((t) => t.unknown).map((t) => t.typeName);
    expect(unknowns).toContain('Markdown');
    expect(unknowns).toContain('module.inlineHtml');
    expect(renderContext(context)).toContain('Do not guess what it does');
  });

  it('marks signal connections, which is the difference between "when" and "what"', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });

    const signalEdge = context.connections.find(
      (c) => c.fromId === IDS.filter && c.toId === IDS.buildQuery && c.toProperty === 'run'
    );
    expect(signalEdge).toBeDefined();
    expect(signalEdge!.isSignal).toBe(true);

    const valueEdge = context.connections.find(
      (c) => c.fromId === IDS.collection && c.toProperty === 'items'
    );
    expect(valueEdge!.isSignal).toBe(false);
  });
});

describe('AIX-004 rendered context', () => {
  const graph = fromSerialisedProject(gitRepoUtf8);

  it('introduces every node by id so citations have something to point at', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });
    const text = renderContext(context);
    for (const node of context.nodes) {
      expect(text).toContain(`\`${node.id}\``);
    }
  });

  it('records its own size on the context, so growth is observable', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });
    expect(context.stats.renderedChars).toBe(0);
    const text = renderContext(context);
    expect(context.stats.renderedChars).toBe(text.length);
    expect(context.stats.nodeCount).toBe(context.nodes.length);
  });

  it('tells the model what it cannot see when the context was cut', () => {
    const context = assembleContext(
      graph,
      { scope: 'component', componentName: '/Pages/Article' },
      { maxNodes: 5 }
    );
    const text = renderContext(context);
    expect(text).toContain('What you cannot see');
    expect(text).toContain('not all of it');
  });

  it('omits the "cannot see" section entirely when nothing was cut', () => {
    const context = assembleContext(graph, { scope: 'component', componentName: COMPONENT });
    expect(context.bounds.truncated).toBe(false);
    expect(renderContext(context)).not.toContain('What you cannot see');
  });

  it('stays far below any model context window even for the largest corpus component', () => {
    const largest = graph.components.reduce((a, b) => (a.nodes.length >= b.nodes.length ? a : b));
    const context = assembleContext(graph, { scope: 'component', componentName: largest.name });
    const text = renderContext(context);
    // Not a tuning target — a canary. If assembly ever starts pulling in whole
    // projects this fails long before a user sees a bill for it.
    expect(text.length).toBeLessThan(200_000);
  });
});

describe('AIX-004 assembly over awkward graphs', () => {
  const graph = fromSerialisedProject(syntheticAwkward);

  it('assembles every component in the dynamic-port/deep-nesting fixture without throwing', () => {
    for (const component of graph.components) {
      const context = assembleContext(graph, { scope: 'component', componentName: component.name });
      expect(context.component.name).toBe(component.name);
      expect(context.nodes.length).toBeLessThanOrEqual(component.nodes.length);
      renderContext(context);
    }
  });

  it('assembles a node-scope context for every node in the fixture without throwing', () => {
    for (const component of graph.components) {
      for (const node of component.nodes) {
        const context = assembleContext(graph, {
          scope: 'node',
          componentName: component.name,
          nodeIds: [node.id]
        });
        expect(context.selectedIds).toEqual([node.id]);
      }
    }
  });
});
