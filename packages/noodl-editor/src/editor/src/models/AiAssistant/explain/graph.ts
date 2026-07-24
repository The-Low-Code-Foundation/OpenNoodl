/**
 * AIX-004 — Explain Mode: graph adapters
 *
 * Explain mode reads one shape (`ExplainGraph`) no matter where the graph came
 * from. Two adapters produce it: the live editor models, which is what the panel
 * uses, and a legacy/serialised project object, which is what the specs use so
 * context assembly can be tested against the real project corpus without an
 * editor, a canvas, or a network.
 *
 * Deliberately read-only: nothing here mutates a model, and nothing it returns
 * holds a reference to one. That is what makes the "asking cannot change your
 * project" guarantee checkable rather than merely claimed.
 *
 * @module AiAssistant/explain/graph
 */

import type { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import { isComponentRef } from '../../../validation/model';
import type { ExplainGraph, GraphComponent, GraphConnection, GraphNode } from './types';

/**
 * Node types whose instance ports *are* the component's interface. A component
 * has no port declaration of its own — its ports are whatever these nodes
 * expose, which is why both adapters derive them the same way.
 */
const COMPONENT_INPUT_TYPES = new Set(['Component Inputs', 'PageInputs']);
const COMPONENT_OUTPUT_TYPES = new Set(['Component Outputs']);

/** The component's own interface, as a parent graph sees it. */
export function componentPorts(component: GraphComponent): { inputPorts: string[]; outputPorts: string[] } {
  const inputPorts = new Set<string>();
  const outputPorts = new Set<string>();
  for (const node of component.nodes) {
    if (COMPONENT_INPUT_TYPES.has(node.type)) for (const p of node.instancePorts) inputPorts.add(p);
    else if (COMPONENT_OUTPUT_TYPES.has(node.type)) for (const p of node.instancePorts) outputPorts.add(p);
  }
  return { inputPorts: [...inputPorts].sort(), outputPorts: [...outputPorts].sort() };
}

/** True when a node type denotes another project component rather than a library node. */
export { isComponentRef };

// ── Live editor models ────────────────────────────────────────────────────────

function instancePortNames(node: NodeGraphNode): string[] {
  const names: string[] = [];
  for (const port of node.getPorts() ?? []) {
    if (port && typeof port.name === 'string') names.push(port.name);
  }
  return names;
}

/**
 * Parameters as authored. `node.parameters` is the raw authored map — reading it
 * directly (rather than `getParameter`, which falls back to port defaults) keeps
 * defaults out of the context, since a default tells the model nothing the
 * catalog has not already told it.
 */
function authoredParameters(node: NodeGraphNode): Record<string, unknown> {
  const params = node.parameters as Record<string, unknown> | undefined;
  return params ? { ...params } : {};
}

function fromEditorNode(node: NodeGraphNode, parentId: string | undefined, out: GraphNode[]): void {
  const children = node.children ?? [];
  // `node.type` is the resolved type *object*; `typename` is the authored string.
  const typeName = node.typename ?? (node.type as { name?: string } | undefined)?.name ?? '';
  out.push({
    id: node.id,
    type: typeName,
    label: typeof node.label === 'string' && node.label ? node.label : undefined,
    parameters: authoredParameters(node),
    parent: parentId,
    children: children.map((c) => c.id),
    instancePorts: instancePortNames(node),
    comment: node.getComment?.() || undefined
  });
  for (const child of children) fromEditorNode(child, node.id, out);
}

/** Adapt one live `ComponentModel` (the case the panel always has in hand). */
export function fromComponentModel(component: ComponentModel): GraphComponent {
  const nodes: GraphNode[] = [];
  for (const root of component.graph?.roots ?? []) fromEditorNode(root, undefined, nodes);

  const connections: GraphConnection[] = (component.graph?.connections ?? []).map((c) => ({
    fromId: c.fromId,
    fromProperty: c.fromProperty,
    toId: c.toId,
    toProperty: c.toProperty
  }));

  return { name: component.fullName ?? component.name, nodes, connections };
}

/**
 * Adapt the whole open project. Explain mode only ever *renders* the active
 * component, but it needs the rest to resolve component instances by name.
 */
export function fromProjectModel(project: { components?: ComponentModel[] } | null | undefined): ExplainGraph {
  return { components: (project?.components ?? []).map(fromComponentModel) };
}

// ── Serialised / legacy project ───────────────────────────────────────────────

interface SerialisedPort {
  name?: string;
}

interface SerialisedNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown>;
  children?: SerialisedNode[];
  ports?: SerialisedPort[];
  dynamicports?: SerialisedPort[];
  metadata?: Record<string, unknown>;
}

interface SerialisedComponent {
  name: string;
  graph?: {
    roots?: SerialisedNode[];
    connections?: GraphConnection[];
  };
}

export interface SerialisedProject {
  components?: SerialisedComponent[];
}

function serialisedPortNames(node: SerialisedNode): string[] {
  const names: string[] = [];
  for (const p of node.ports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  for (const p of node.dynamicports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  return names;
}

function serialisedComment(node: SerialisedNode): string | undefined {
  const comment = node.metadata?.['comment'];
  return typeof comment === 'string' && comment ? comment : undefined;
}

function fromSerialisedNode(node: SerialisedNode, parentId: string | undefined, out: GraphNode[]): void {
  const children = node.children ?? [];
  out.push({
    id: node.id,
    type: node.type,
    label: typeof node.label === 'string' && node.label ? node.label : undefined,
    parameters: node.parameters ? { ...node.parameters } : {},
    parent: parentId,
    children: children.map((c) => c.id),
    instancePorts: serialisedPortNames(node),
    comment: serialisedComment(node)
  });
  for (const child of children) fromSerialisedNode(child, node.id, out);
}

/**
 * Adapt a serialised project — a v1 `project.json`, or anything
 * `ProjectModel.toJSON()` produced. Same shape the semantic validator's
 * `fromLegacyProject` consumes, plus the parameters explanations need.
 */
export function fromSerialisedProject(project: SerialisedProject | null | undefined): ExplainGraph {
  const components: GraphComponent[] = [];
  for (const comp of project?.components ?? []) {
    const nodes: GraphNode[] = [];
    for (const root of comp.graph?.roots ?? []) fromSerialisedNode(root, undefined, nodes);
    components.push({
      name: comp.name,
      nodes,
      connections: (comp.graph?.connections ?? []).map((c) => ({
        fromId: c.fromId,
        fromProperty: c.fromProperty,
        toId: c.toId,
        toProperty: c.toProperty
      }))
    });
  }
  return { components };
}

/** Look a component up by either its legacy name ("/#Home") or its path ("Home"). */
export function findComponent(graph: ExplainGraph, name: string): GraphComponent | undefined {
  const direct = graph.components.find((c) => c.name === name);
  if (direct) return direct;
  const stripped = name.replace(/^\//, '').replace(/^#/, '');
  return graph.components.find((c) => c.name.replace(/^\//, '').replace(/^#/, '') === stripped);
}
