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

import { isComponentRef } from '../../../validation/model';
import type { ExplainGraph, GraphComponent, GraphConnection, GraphNode } from './types';

/**
 * The live adapters are typed *structurally* rather than against `ComponentModel`
 * and `NodeGraphNode`.
 *
 * They read six fields between them, and importing the model classes — even as
 * `import type`, which erases at build time — makes every consumer of this
 * module a consumer of `componentmodel.ts`, and through it of the entire editor
 * and `noodl-core-ui`. That is invisible until something outside the editor
 * typechecks this file: adding the AIX-010 assembler to `noodl-mcp`'s
 * `editor-deps` took that package from 18 pre-existing errors to 1,985, all of
 * them in editor and core-ui sources the MCP server never runs.
 *
 * `ComponentModel` and `NodeGraphNode` still satisfy these, so every existing
 * call site is unchanged and passes its real models exactly as before.
 */
interface EditorPortLike {
  name?: unknown;
  /** LAS-001 — the direction, which `instancePorts` throws away. */
  plug?: unknown;
}

interface EditorNodeLike {
  id: string;
  /** The authored type string. `type` is the resolved type *object*. */
  typename?: string;
  type?: unknown;
  label?: unknown;
  parameters?: unknown;
  children?: EditorNodeLike[];
  getPorts?(): EditorPortLike[] | undefined | null;
  getComment?(): string | undefined | null;
}

interface EditorComponentLike {
  name: string;
  fullName?: string;
  /**
   * LEG-003 §2 / LEG-006. Read from two places on purpose. LEG-006 has since
   * landed and `ComponentModel` now carries `description` as a field of its
   * own, so the top-level read is the live one. The `metadata` read is not
   * dead: a project saved before LEG-006 still has the text in the metadata
   * bag on disk, and stays readable until it is next saved.
   */
  description?: unknown;
  metadata?: Record<string, unknown>;
  graph?: {
    roots?: EditorNodeLike[];
    connections?: ReadonlyArray<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
  };
}

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

function instancePortNames(node: EditorNodeLike): string[] {
  const names: string[] = [];
  for (const port of node.getPorts?.() ?? []) {
    if (port && typeof port.name === 'string') names.push(port.name);
  }
  return names;
}

/** The same ports with their direction — LAS-001; see `GraphNode.ports`. */
function declaredPorts(ports: readonly EditorPortLike[] | undefined | null): { name: string; plug?: string }[] {
  const out: { name: string; plug?: string }[] = [];
  for (const port of ports ?? []) {
    if (!port || typeof port.name !== 'string') continue;
    out.push({ name: port.name, ...(typeof port.plug === 'string' ? { plug: port.plug } : {}) });
  }
  return out;
}

/**
 * Parameters as authored. `node.parameters` is the raw authored map — reading it
 * directly (rather than `getParameter`, which falls back to port defaults) keeps
 * defaults out of the context, since a default tells the model nothing the
 * catalog has not already told it.
 */
function authoredParameters(node: EditorNodeLike): Record<string, unknown> {
  const params = node.parameters as Record<string, unknown> | undefined;
  return params ? { ...params } : {};
}

function fromEditorNode(node: EditorNodeLike, parentId: string | undefined, out: GraphNode[]): void {
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
    ports: declaredPorts(node.getPorts?.()),
    comment: node.getComment?.() || undefined
  });
  for (const child of children) fromEditorNode(child, node.id, out);
}

/**
 * A description is only a description when someone wrote something in it. An
 * empty string is the shape a form control leaves behind, not an author's
 * sentence, and it must not produce an empty quotation in the panel.
 */
function authoredDescription(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate;
  }
  return undefined;
}

/** Adapt one live `ComponentModel` (the case the panel always has in hand). */
export function fromComponentModel(component: EditorComponentLike): GraphComponent {
  const nodes: GraphNode[] = [];
  for (const root of component.graph?.roots ?? []) fromEditorNode(root, undefined, nodes);

  const connections: GraphConnection[] = (component.graph?.connections ?? []).map((c) => ({
    fromId: c.fromId,
    fromProperty: c.fromProperty,
    toId: c.toId,
    toProperty: c.toProperty
  }));

  const description = authoredDescription(component.description, component.metadata?.['description']);

  return {
    name: component.fullName ?? component.name,
    ...(description ? { description } : {}),
    nodes,
    connections
  };
}

/**
 * Adapt the whole open project. Explain mode only ever *renders* the active
 * component, but it needs the rest to resolve component instances by name.
 */
export function fromProjectModel(project: { components?: EditorComponentLike[] } | null | undefined): ExplainGraph {
  return { components: (project?.components ?? []).map(fromComponentModel) };
}

// ── Serialised / legacy project ───────────────────────────────────────────────

interface SerialisedPort {
  name?: string;
  plug?: string;
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
  description?: string;
  metadata?: Record<string, unknown>;
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
    ports: declaredPorts([...(node.ports ?? []), ...(node.dynamicports ?? [])]),
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
    const description = authoredDescription(comp.description, comp.metadata?.['description']);
    components.push({
      name: comp.name,
      ...(description ? { description } : {}),
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
