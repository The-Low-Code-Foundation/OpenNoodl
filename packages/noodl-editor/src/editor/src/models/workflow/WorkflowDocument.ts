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
import {
  deleteTrigger,
  fetchBackendEndpoint,
  listTriggers,
  setTriggerEnabled,
  TriggerDef
} from '../triggers/TriggerBackendClient';
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
import {
  addTriggerNodes,
  isTriggerNode,
  refreshTriggerNode,
  triggerIdOfNode,
  triggersForWorkflow,
  TriggerNodeContext
} from './workflowTriggerNodes';

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

  /**
   * The backend triggers pointing at this workflow (WFA-005). Drawn as entry
   * nodes; NOT part of the definition, and never written by `toInput`.
   */
  public triggers: TriggerDef[];

  /** What the trigger rows need to build a webhook URL. Null until the fetch lands. */
  private triggerCtx: TriggerNodeContext;

  private _dirty = false;

  /**
   * True while trigger ENTRY nodes are being added or removed.
   *
   * Those are graph mutations that are not definition edits, and the dirty
   * listener cannot tell the difference by looking at the event.
   */
  private redrawingTriggers = false;

  private constructor(args: {
    ref: WorkflowRef;
    definition: WorkflowDefinition;
    catalog: StepKindCatalog;
    graph: WorkflowGraphModel;
    triggers?: TriggerDef[];
    endpoint?: string | null;
  }) {
    super();
    this.ref = args.ref;
    this.definition = args.definition;
    this.catalog = args.catalog;
    this.graph = args.graph;
    this.entry = args.definition.entry;
    this.triggers = args.triggers || [];
    this.triggerCtx = {
      backendId: args.ref.backendId,
      backendName: args.ref.backendName,
      endpoint: args.endpoint ?? null
    };

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
      const node = this.graph.findNodeWithId(id);

      // A trigger node carries the actions on the backend object it stands for.
      if (isTriggerNode(node)) return this.triggerActions(id);

      if (id === this.entry) return [];
      return [
        {
          label: `Start the run at "${node?.label || id}"`,
          onClick: () => this.setEntry(id)
        }
      ];
    };
  }

  /**
   * The actions a trigger node offers (WFA-005 §1, steps 5–6).
   *
   * Enable/disable and delete live HERE rather than on the canvas's own delete
   * gesture, and that is a decision rather than an omission: canvas delete is
   * local and undoable, deleting a trigger from a backend is neither, and
   * putting an irreversible cross-process delete behind Cmd-Z's promise would be
   * a lie about what just happened. The node types are `singleton`, so the
   * canvas refuses to delete or copy them and the only route is this menu —
   * where the label can name the backend it is about to change.
   */
  private triggerActions(nodeId: string): unknown[] {
    const triggerId = triggerIdOfNode({ id: nodeId, typename: this.graph.findNodeWithId(nodeId)?.typename });
    if (!triggerId) {
      // The manual marker stands for the absence of a trigger; there is nothing
      // to enable and nothing to delete.
      return [];
    }
    const trigger = this.triggers.find((t) => t.id === triggerId);
    if (!trigger) return [];

    return [
      {
        label: trigger.enabled ? 'Disable this trigger' : 'Enable this trigger',
        onClick: () => void this.setTriggerEnabled(triggerId, !trigger.enabled)
      },
      {
        label: `Delete this trigger from ${this.ref.backendName}…`,
        onClick: () => void this.deleteTrigger(triggerId)
      }
    ];
  }

  /**
   * Turn a trigger on or off from its node, and repaint what the card says.
   *
   * The registry is asked, then the node is refreshed from the ANSWER rather
   * than from what was requested — a disabled trigger that looks enabled is the
   * failure this surface exists to prevent, and optimistically painting the
   * requested state is how that failure gets reintroduced.
   */
  async setTriggerEnabled(triggerId: string, enabled: boolean): Promise<void> {
    await setTriggerEnabled(this.ref.backendId, triggerId, enabled);
    await this.refreshTriggers();
  }

  /** Delete a trigger from the backend, after confirming that is what it does. */
  async deleteTrigger(triggerId: string): Promise<void> {
    const trigger = this.triggers.find((t) => t.id === triggerId);
    const what = trigger?.name || trigger?.webhook?.slug || triggerId;
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(
        `Delete the trigger "${what}" from ${this.ref.backendName}?\n\n` +
          `This removes a backend object, not a piece of this workflow. It cannot be undone, and a webhook's ` +
          `secret goes with it — any sender using that URL stops working.`
      );
    if (!confirmed) return;

    await deleteTrigger(this.ref.backendId, triggerId);
    await this.refreshTriggers();
  }

  /**
   * Re-read this workflow's triggers and redraw their nodes.
   *
   * A trigger appearing or disappearing changes the SET of entry nodes, so the
   * nodes are rebuilt rather than patched; an enable/disable only changes what
   * one card says, so that path patches in place and leaves the canvas alone.
   * Neither marks the document dirty — nothing about the definition changed.
   */
  async refreshTriggers(): Promise<void> {
    const all = await listTriggers(this.ref.backendId);
    const mine = triggersForWorkflow(all, this.definition.id);
    const sameSet =
      mine.length === this.triggers.length && mine.every((t) => this.triggers.some((existing) => existing.id === t.id));

    this.triggers = mine;
    if (sameSet) {
      for (const trigger of mine) refreshTriggerNode(this.graph, trigger, this.triggerCtx);
    } else {
      this.rebuildTriggerNodes();
    }
    this.notifyListeners('triggersChanged', { triggers: mine });
    NodeGraphContextTmp.nodeGraph?.repaint();
  }

  /**
   * Drop every trigger node and lay the current set out again.
   *
   * Held inside `redrawingTriggers`, because adding and removing nodes is
   * exactly what the dirty-tracking listener watches for — and none of this is
   * an edit to the DEFINITION. Without the flag, opening a workflow whose
   * trigger was toggled elsewhere would leave the Save button lit over a
   * definition nobody touched.
   */
  private rebuildTriggerNodes(): void {
    this.redrawingTriggers = true;
    try {
      const existing: string[] = [];
      this.graph.forEachNode((n) => {
        if (isTriggerNode(n)) existing.push(n.id);
      });
      for (const id of existing) {
        const node = this.graph.findNodeWithId(id);
        // No `undo:` — a trigger node is a view of a backend object, and an
        // undo entry would offer to restore something the canvas does not own.
        if (node) this.graph.removeNode(node);
      }
      addTriggerNodes(this.graph, this.triggers, this.entry, this.triggerCtx);
    } finally {
      this.redrawingTriggers = false;
    }
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

    // WFA-005: the triggers are fetched with the definition, so the canvas
    // draws the whole automation at once rather than the workflow first and
    // then how it starts. Neither read can fail the open — a backend that
    // cannot answer about triggers still has a workflow worth drawing, and the
    // canvas then shows the manual entry marker, which is honest about what it
    // does not know.
    const [triggers, endpoint] = await Promise.all([
      listTriggers(ref.backendId).catch(() => [] as TriggerDef[]),
      fetchBackendEndpoint(ref.backendId).catch(() => null)
    ]);

    return WorkflowDocument.fromDefinition(ref, definition, catalog, {
      triggers: triggersForWorkflow(triggers, definition.id),
      endpoint
    });
  }

  /**
   * The pure half of `open` — no IPC, no node-library side effects.
   *
   * Separated so the definition⇄graph conversion (the part with an invariant
   * worth testing: node id === step id, and a round trip that preserves every
   * edge) can be exercised without a running backend.
   */
  static fromDefinition(
    ref: WorkflowRef,
    definition: WorkflowDefinition,
    catalog: StepKindCatalog,
    /**
     * The backend's answer about what triggers this workflow. **Absent means
     * "not asked", not "nothing"** — and the difference matters, because the
     * `manual` entry marker is a positive claim that nothing triggers this
     * workflow. Drawing it from an unanswered question would be a lie the
     * canvas tells confidently. `open()` always asks; the pure conversion path
     * does not, so it produces a graph of steps and nothing else.
     */
    entryNodes?: { triggers?: TriggerDef[]; endpoint?: string | null }
  ) {
    const triggers = entryNodes?.triggers || [];
    const endpoint = entryNodes?.endpoint ?? null;
    return new WorkflowDocument({
      ref,
      definition,
      catalog,
      triggers,
      endpoint,
      graph: buildGraph(
        definition,
        catalog,
        entryNodes
          ? { triggers, ctx: { backendId: ref.backendId, backendName: ref.backendName, endpoint } }
          : undefined
      )
    });
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

    // A brand-new workflow has no triggers — and that is an ANSWER, not an
    // absence of one, so it gets the manual entry marker like any other
    // untriggered workflow.
    const doc = WorkflowDocument.fromDefinition({ ...ref, stepCount: 1 }, definition, catalog, {
      triggers: [],
      endpoint: await fetchBackendEndpoint(ref.backendId).catch(() => null)
    });
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
        if (this.redrawingTriggers) return;
        this.syncEntry();
        this.markDirty();
      },
      this
    );

    // A parameter change reaches the graph as a node-level notification, so it
    // is subscribed per node as nodes arrive.
    this.graph.forEachNode((node) => this.bindNode(node));
    this.graph.on('nodeAdded', ({ model }: { model: NodeGraphNode }) => this.bindNode(model), this);

    /**
     * Dragging a trigger's `fires` wire onto a different step MOVES the entry.
     *
     * The wire is derived — it is redrawn from `definition.entry` on every open
     * — so leaving the gesture to do nothing would give the canvas a wire you
     * can move and that springs back next time. Making it set the entry is the
     * reading a user would take from the picture anyway: this trigger starts
     * the run *here*.
     */
    this.graph.on(
      'connectionAdded',
      ({ model }: { model: { fromId: string; toId: string } }) => {
        if (this.redrawingTriggers || !model) return;
        if (!isTriggerNode(this.graph.findNodeWithId(model.fromId))) return;
        if (model.toId === this.entry) return;
        this.setEntry(model.toId);
        this.rebuildTriggerNodes();
      },
      this
    );
  }

  private bindNode(node: NodeGraphNode) {
    // A trigger node's rows are read-only views of a backend object, so a
    // change to one is never a definition edit and must never dirty the
    // document (it is also never a step, so `refreshNodeChrome` has nothing to
    // say about it).
    if (isTriggerNode(node)) return;

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
    // Trigger nodes are excluded from BOTH halves of this, and both matter: a
    // trigger is not a candidate entry step, and the edge a trigger draws into
    // the entry step would otherwise make that step look like it has a
    // predecessor — so the leftmost-with-nothing-wired-in rule would skip the
    // very step the trigger fires.
    const ids = new Set<string>();
    this.graph.forEachNode((n) => {
      if (!isTriggerNode(n)) ids.add(n.id);
    });
    if (ids.has(this.entry)) return;

    const withIncoming = new Set(
      this.graph.connections.filter((c) => !isTriggerNode(this.graph.findNodeWithId(c.fromId))).map((c) => c.toId)
    );
    const roots: NodeGraphNode[] = [];
    this.graph.forEachNode((n) => {
      if (!isTriggerNode(n) && !withIncoming.has(n.id)) roots.push(n);
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
      // A trigger node has no kind (`kindFromTypeName` checks the trigger prefix
      // first), so it is skipped here and never reaches the definition — which
      // is what makes drawing triggers a VIEW rather than a change to what gets
      // saved.
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

function buildGraph(
  definition: WorkflowDefinition,
  catalog: StepKindCatalog,
  entryNodes?: { triggers: TriggerDef[]; ctx: TriggerNodeContext }
): WorkflowGraphModel {
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

    // Added to the graph BEFORE its dynamic ports are set, and the order is
    // load-bearing rather than stylistic. `setDynamicPorts` broadcasts
    // `Model.instancePortsChanged` globally, and every listener of a global
    // model event identifies what the event is about by walking `owner` — so an
    // unowned node is both a crash risk in a listener that does not expect one
    // and invisible to the workflow filter that exists to stop these events
    // reaching the viewer. Owned first, then announce.
    graph.addRoot(node);

    if (step.kind === 'switch') node.setDynamicPorts(switchRoutePorts(node));
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

  // WFA-005: the trigger entry nodes, added LAST so they can be placed relative
  // to the entry step, and added HERE — while the graph is being built, before
  // the document binds its dirty listener — so a workflow does not open with
  // unsaved changes just because something triggers it.
  if (entryNodes) {
    addTriggerNodes(graph, entryNodes.triggers, definition.entry, entryNodes.ctx);
  }

  return graph;
}
