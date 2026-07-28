/**
 * A workflow, open in the editor (WFA-004).
 *
 * This is the document type §1 decided on. It owns the definition, the backend
 * it came from, whether it has unsaved edits, and the conversion in both
 * directions between a `WorkflowDefinition` and a graph the canvas can draw.
 * The `ComponentModel` subclass it builds is an adapter for the canvas's one
 * door, not a claim that a workflow is a project component.
 *
 * THE ONE NON-NEGOTIABLE: **canvas node id === step id.** `ExecutionOverlay`
 * keys on `step.nodeId → getNodeBounds(nodeId)` and the engine writes the
 * workflow's own step ids into `nodeId` (F15), so this identity is what makes
 * WFA-002's whole run inspector work over this canvas with no changes. There is
 * deliberately no id-mapping table anywhere in this module.
 *
 * @module models/workflow/WorkflowDocument
 */

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { NodeLibrary } from '@noodl-models/nodelibrary';
import { NodeLibraryImporter } from '@noodl-models/nodelibrary/NodeLibraryImporter';

import { NodeGraphContextTmp } from '../../contexts/NodeGraphContext/NodeGraphContext';
import Model from '../../../../shared/model';
import { fetchStepKinds, fetchWorkflow, saveWorkflow } from './WorkflowBackendClient';
import { WorkflowComponentModel } from './WorkflowComponentModel';
import { WorkflowGraphModel } from './WorkflowGraphModel';
import { layoutWorkflow } from './workflowLayout';
import {
  buildWorkflowNodeLibrary,
  isRoutePort,
  kindFromTypeName,
  PORT_IN,
  PORT_NEXT,
  PORT_ON_ERROR,
  routeNameFromPort,
  routePortName,
  typeNameForKind
} from './workflowNodeLibrary';

import type { StepKindCatalog, StepKindSpec, WorkflowDefinition, WorkflowInput, WorkflowRef, WorkflowStep } from './types';

/** Params the editor stores on the node but which are step *fields*, not params. */
const STEP_FIELD_PARAMS = new Set(['ref']);

/**
 * The card's second line.
 *
 * It carries three things, in the order they are worth reading: what kind of
 * step this is, which function it invokes (`call-function` and `retry` — the
 * single most useful thing on the card, §2), and whether the run starts here.
 * All of it rides `metadata.typeLabelOverride`, which the canvas painter
 * already reads as the sub-label, so none of it needs a painter change.
 */
function subLabelParts(displayName: string, ref: unknown, isEntry: boolean): string {
  const parts = [displayName];
  if (ref) parts.push(String(ref));
  if (isEntry) parts.push('entry step');
  return parts.join(' · ');
}

function subLabel(spec: StepKindSpec, node: NodeGraphNode, isEntry: boolean): string {
  return subLabelParts(spec.displayName, spec.invokesFunction ? node.parameters?.ref : undefined, isEntry);
}

function subLabelFor(spec: StepKindSpec, step: WorkflowStep, isEntry: boolean): string {
  return subLabelParts(spec.displayName, spec.invokesFunction ? step.ref : undefined, isEntry);
}

export class WorkflowDocument extends Model {
  public readonly ref: WorkflowRef;
  public definition: WorkflowDefinition;
  public readonly catalog: StepKindCatalog;
  public readonly component: WorkflowComponentModel;
  public readonly graph: WorkflowGraphModel;

  /** The step a run starts from. */
  public entry: string;

  private _dirty = false;

  private constructor(args: {
    ref: WorkflowRef;
    definition: WorkflowDefinition;
    catalog: StepKindCatalog;
    graph: WorkflowGraphModel;
  }) {
    super();
    this.ref = args.ref;
    this.definition = args.definition;
    this.catalog = args.catalog;
    this.graph = args.graph;
    this.entry = args.definition.entry;

    this.component = new WorkflowComponentModel({
      backendId: args.ref.backendId,
      backendName: args.ref.backendName,
      workflowId: args.definition.id,
      workflowName: args.definition.name || args.definition.id,
      graph: args.graph
    });

    this.bindGraph();

    // "Set as entry step" — the one thing about a workflow that is not
    // expressible by dragging a wire. Contributed to the canvas's existing
    // context menu rather than added as a surface.
    this.graph.contextMenuActionsProvider = (selected: string[]) => {
      if (selected.length !== 1) return [];
      const id = selected[0];
      if (id === this.entry) return [];
      return [
        {
          label: `Start the run at "${this.graph.findNodeWithId(id)?.label || id}"`,
          onClick: () => this.setEntry(id)
        }
      ];
    };
  }

  /**
   * Open a workflow from a running backend.
   *
   * The step-kind catalog is fetched FIRST and installed into the node library,
   * because a graph whose types are not registered paints as red unknowns — the
   * exact symptom WFA-001 found when the cloud runtime's client disappeared.
   * Both fetches are per-backend and neither is cached across backends: a
   * catalog is only true of the backend that served it.
   */
  static async open(ref: WorkflowRef): Promise<WorkflowDocument> {
    const catalog = await fetchStepKinds(ref.backendId);
    NodeLibraryImporter.instance.importWorkflowLibrary(buildWorkflowNodeLibrary(catalog));

    const definition = await fetchWorkflow(ref.backendId, ref.id);
    return WorkflowDocument.fromDefinition(ref, definition, catalog);
  }

  /**
   * The pure half of `open` — no IPC, no node-library side effects.
   *
   * Separated so the definition⇄graph conversion (the part with an invariant
   * worth testing: node id === step id, and a round trip that preserves every
   * edge) can be exercised without a running backend.
   */
  static fromDefinition(ref: WorkflowRef, definition: WorkflowDefinition, catalog: StepKindCatalog) {
    return new WorkflowDocument({ ref, definition, catalog, graph: buildGraph(definition, catalog) });
  }

  /** A brand-new, unsaved workflow with a single entry step. */
  static async create(ref: Omit<WorkflowRef, 'id' | 'stepCount'> & { id: string; name: string }, kind: string) {
    const catalog = await fetchStepKinds(ref.backendId);
    NodeLibraryImporter.instance.importWorkflowLibrary(buildWorkflowNodeLibrary(catalog));

    const now = new Date().toISOString();
    const definition: WorkflowDefinition = {
      version: 1,
      id: ref.id,
      name: ref.name,
      entry: kind.replace(/-/g, ''),
      concurrency: 1,
      steps: [{ id: kind.replace(/-/g, ''), kind: kind as WorkflowStep['kind'] }],
      createdAt: now,
      updatedAt: now
    };

    const doc = WorkflowDocument.fromDefinition({ ...ref, stepCount: 1 }, definition, catalog);
    doc.markDirty();
    return doc;
  }

  get isDirty() {
    return this._dirty;
  }

  specFor(kind: string): StepKindSpec | undefined {
    return this.catalog.kinds.find((k) => k.kind === kind);
  }

  markDirty() {
    if (this._dirty) return;
    this._dirty = true;
    this.notifyListeners('dirtyChanged', { dirty: true });
  }

  private bindGraph() {
    this.graph.on(
      ['nodeAdded', 'nodeRemoved', 'connectionAdded', 'connectionRemoved'],
      () => {
        this.syncEntry();
        this.markDirty();
      },
      this
    );

    // A parameter change reaches the graph as a node-level notification, so it
    // is subscribed per node as nodes arrive.
    this.graph.forEachNode((node) => this.bindNode(node));
    this.graph.on('nodeAdded', ({ model }: { model: NodeGraphNode }) => this.bindNode(model), this);
  }

  private bindNode(node: NodeGraphNode) {
    node.on(
      ['parametersChanged', 'labelChanged'],
      () => {
        this.refreshNodeChrome(node);
        this.markDirty();
      },
      this
    );
    this.refreshNodeChrome(node);
  }

  /**
   * Keep what the card says in step with what the step is.
   *
   * `call-function` and `retry` show the function they invoke — the single most
   * useful thing on the card — and `switch` grows one output port per case
   * label. Both ride existing mechanisms (`metadata.typeLabelOverride` is what
   * the painter already reads for a sub-label; `setDynamicPorts` is the
   * per-node port mechanism), so neither needs a change to the canvas.
   */
  refreshNodeChrome(node: NodeGraphNode) {
    const kind = kindFromTypeName(node.typename);
    if (!kind) return;
    const spec = this.specFor(kind);
    if (!spec) return;

    node.metadata = { ...(node.metadata || {}), typeLabelOverride: subLabel(spec, node, node.id === this.entry) };

    if (kind === 'switch') {
      node.setDynamicPorts(switchRoutePorts(node));
    }
  }

  /** Repaint every card's sub-label — the entry marker moved. */
  private refreshAllChrome() {
    this.graph.forEachNode((node) => {
      this.refreshNodeChrome(node);
    });
  }

  /**
   * The entry step, kept honest as the graph is edited.
   *
   * A workflow starts at exactly one step. If the stored entry is deleted, the
   * leftmost step with nothing wired into it takes over — which is what a
   * reader would assume looking at the canvas anyway.
   */
  private syncEntry() {
    const ids = new Set<string>();
    this.graph.forEachNode((n) => {
      ids.add(n.id);
    });
    if (ids.has(this.entry)) return;

    const withIncoming = new Set(this.graph.connections.map((c) => c.toId));
    const roots: NodeGraphNode[] = [];
    this.graph.forEachNode((n) => {
      if (!withIncoming.has(n.id)) roots.push(n);
    });
    roots.sort((a, b) => a.x - b.x);
    this.entry = roots[0]?.id || [...ids][0];
    this.refreshAllChrome();
    this.notifyListeners('entryChanged', { entry: this.entry });
  }

  setEntry(stepId: string) {
    if (this.entry === stepId) return;
    this.entry = stepId;
    this.refreshAllChrome();
    this.markDirty();
    this.notifyListeners('entryChanged', { entry: stepId });
    // The card's sub-label carries the entry marker, so the canvas has to
    // repaint for the move to be visible.
    NodeGraphContextTmp.nodeGraph?.repaint();
  }

  /** The definition as the graph currently stands. */
  toInput(): WorkflowInput {
    const stepsById = new Map<string, WorkflowStep>();
    const order: string[] = [];

    this.graph.forEachNode((node) => {
      const kind = kindFromTypeName(node.typename);
      if (!kind) return;

      const params: Record<string, unknown> = {};
      for (const [name, value] of Object.entries(node.parameters || {})) {
        if (STEP_FIELD_PARAMS.has(name)) continue;
        if (value === undefined) continue;
        params[name] = value;
      }

      const step: WorkflowStep = {
        id: node.id,
        kind: kind as WorkflowStep['kind'],
        ui: { x: Math.round(node.x), y: Math.round(node.y) }
      };

      const label = node.label;
      if (label && label !== node.id) step.name = label;
      if (node.parameters?.ref) step.ref = String(node.parameters.ref);
      if (Object.keys(params).length) step.params = params;

      stepsById.set(node.id, step);
      order.push(node.id);
    });

    for (const c of this.graph.connections) {
      const step = stepsById.get(c.fromId);
      if (!step || !stepsById.has(c.toId)) continue;

      if (c.fromProperty === PORT_NEXT) {
        step.next = [...(step.next || []), c.toId];
      } else if (c.fromProperty === PORT_ON_ERROR) {
        step.onError = [...(step.onError || []), c.toId];
      } else if (isRoutePort(c.fromProperty)) {
        const route = routeNameFromPort(c.fromProperty);
        step.routes = step.routes || {};
        step.routes[route] = [...(step.routes[route] || []), c.toId];
      }
    }

    return {
      id: this.definition.id,
      name: this.ref.name || this.definition.name,
      entry: this.entry,
      concurrency: this.definition.concurrency || 1,
      timeoutMs: this.definition.timeoutMs,
      stepTimeoutMs: this.definition.stepTimeoutMs,
      steps: order.map((id) => stepsById.get(id) as WorkflowStep)
    };
  }

  /**
   * Write it back to the backend.
   *
   * A rejected definition throws with the backend validator's own message,
   * which is the text to show verbatim: it names the step and the problem, and
   * an invalid definition on disk is what stops a backend booting. Nothing is
   * written locally first, so a refused save leaves the backend exactly as it
   * was.
   */
  async save(): Promise<WorkflowDefinition> {
    const saved = await saveWorkflow(this.ref.backendId, this.toInput());
    this.definition = saved;
    this._dirty = false;
    this.notifyListeners('dirtyChanged', { dirty: false });
    this.notifyListeners('saved', { definition: saved });
    return saved;
  }

  dispose() {
    this.graph.forEachNode((node) => {
      node.off(this);
    });
    this.graph.off(this);
    NodeLibrary.instance.off(this);
  }
}

/* -------------------------------------------------------------------------- */
/* Definition → graph                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `switch`'s route ports, derived from its own `cases` param.
 *
 * The catalog marks these `dynamic: true` because their names are the case
 * labels. They are per-node, which is exactly what `setDynamicPorts` is for.
 */
function switchRoutePorts(node: NodeGraphNode) {
  const cases = node.parameters?.cases;
  const labels: string[] = Array.isArray(cases)
    ? cases.map((c) => (c && typeof c === 'object' ? String((c as { label?: unknown }).label ?? '') : '')).filter(Boolean)
    : [];

  return labels.map((label, i) => ({
    name: routePortName(label),
    displayName: label,
    editorName: label,
    type: { name: 'signal', connectionLabel: true },
    plug: 'output',
    group: 'Routes',
    // After the static ports (in, params, next, default, onError); the exact
    // number varies per node, so start clear of them.
    index: 100 + i
  })) as TSFixme[];
}

function buildGraph(definition: WorkflowDefinition, catalog: StepKindCatalog): WorkflowGraphModel {
  const graph = new WorkflowGraphModel();
  const specs = new Map(catalog.kinds.map((k) => [k.kind, k]));

  // Positions: stored ones win; a workflow with none is laid out (§5). Mixed is
  // possible — a step added by MCP to a hand-arranged workflow — so the layout
  // is computed for everything and only consulted where `ui` is absent.
  const laidOut = layoutWorkflow(definition.steps, definition.entry);

  for (const step of definition.steps) {
    const pos = step.ui || laidOut.get(step.id) || { x: 0, y: 0 };
    const spec = specs.get(step.kind);

    const parameters: Record<string, unknown> = { ...(step.params || {}) };
    if (step.ref !== undefined) parameters.ref = step.ref;

    const node = NodeGraphNode.fromJSON({
      // The identity the whole overlay depends on.
      id: step.id,
      type: typeNameForKind(step.kind),
      x: pos.x,
      y: pos.y,
      label: step.name || step.id,
      parameters,
      metadata: spec ? { typeLabelOverride: subLabelFor(spec, step, step.id === definition.entry) } : undefined
    });

    if (step.kind === 'switch') node.setDynamicPorts(switchRoutePorts(node));

    graph.addRoot(node);
  }

  const known = new Set(definition.steps.map((s) => s.id));
  const connect = (fromId: string, fromProperty: string, toId: string) => {
    if (!known.has(toId)) return; // a dangling edge cannot exist post-validation
    graph.addConnection({
      fromId,
      fromProperty,
      toId,
      toProperty: PORT_IN,
      annotation: undefined
    });
  };

  for (const step of definition.steps) {
    for (const t of step.next || []) connect(step.id, PORT_NEXT, t);
    for (const [route, targets] of Object.entries(step.routes || {})) {
      for (const t of targets || []) connect(step.id, routePortName(route), t);
    }
    for (const t of step.onError || []) connect(step.id, PORT_ON_ERROR, t);
  }

  return graph;
}
