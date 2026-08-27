/**
 * NDA-017 — migrate projects authored before §2 reversed the run-on-value-change default.
 *
 * ## What went wrong, and why a migration is the only honest repair
 *
 * Fifteen node families used to share one idiom: **connect the node's control signal and every
 * value setter goes passive.**
 *
 * ```ts
 * set: function (value) {
 *   this._internal.scope[name] = value;
 *   if (!this.isInputConnected('run')) this._scheduleEvaluateExpression();
 * }
 * ```
 *
 * NDA-017 §2 replaced that guard with a per-input *Run on value change* checkbox, and made the
 * checkbox default **ticked** — so wiring `Run` no longer silently changes what every other port
 * does. That was the right decision and it is not in question here.
 *
 * What §2 did not do is migrate anything. Every graph authored before it was written **against
 * the old contract**, by an author who could see that wiring `Run` made the value inputs passive
 * and built on top of that. §2 reversed the contract underneath those graphs with no diagnostic:
 * an input that used to sit still now re-runs the node the moment a value lands on it. FH-023
 * measured the consequence in the shipped prefabs and it is not cosmetic — a **double email
 * send** was one hop away, because a key that now arrives mid-request re-triggers the send.
 *
 * **Richard's decision, 2026-08-06: migrate on load.** For every node that has its control
 * signal connected, write `runOnChange-<input>: false` for the value inputs that signal used to
 * silence. That preserves what the author actually built, rather than what §2's default would now
 * do to it. A node with no control signal connected is untouched: its behaviour did not change.
 *
 * ## Why the parameter has to be written, and cannot be left absent
 *
 * A declared `default` never runs its setter (phase 30 finding A-D1) — which is precisely why
 * `runOnValueChange()` in the runtime reads **absent as ticked**. So "passive" is not expressible
 * by omission. The migration has to write the literal `false`, and that is the whole shape of it.
 *
 * ## When in the load sequence this is valid — the part that broke a node once
 *
 * This module runs on the **saved project JSON**, in `applyPatches`, *before*
 * `ProjectModel.fromJSON`. From that point on its writes are ordinary stored parameters,
 * indistinguishable from ones an author unticked by hand. That matters three times over:
 *
 * 1. **It is the only point where the whole graph is in view.** The rule needs the component's
 *    connection list to know whether the control signal is wired, and it needs it before any node
 *    is instantiated. `ProjectModel.fromJSON` builds nodes; the patch pass sees the document.
 *
 * 2. **The runtime already survives a `runOnChange-*` parameter arriving before its port
 *    exists — but only since §3.** A saved project applies parameters through
 *    `NodeScope.setNodeParameters`, which calls `registerInputIfNeeded(name)` for each one. On a
 *    dynamic-port family that used to mean Expression minting `runOnChange-a` as a *discovered
 *    expression input*: the `false` landed in the expression scope, the real checkbox was never
 *    registered, and `_compileFunction` built a `Function` with a parameter called
 *    `runOnChange-a`, threw, and the node evaluated to `0` for the rest of the session. That is
 *    fixed centrally in `defineNode`, which now claims any `runOnChange-…` name before the
 *    node's own handler sees it. **This migration is that fix's first bulk consumer**; without it
 *    this module would break every Expression and Function node it touched.
 *
 * 3. **Order inside the parameter bag is load-bearing.** All nodes (and their parameters) are
 *    created before any connection is added (`NodeScope.setComponentModel`), and the queued
 *    values drain in the order `setNodeParameters` queued them, which is the parameter bag's
 *    own key order. (FB-025 restated the drain rule — a pending value now goes before a pending
 *    signal, and an emptied port lets go of its queue key — but *these* are all values queued in
 *    one pass, so the order among them is still queueing order and this paragraph still holds.)
 *    If the
 *    governed value drains *before* its checkbox, the setter reads absent-as-ticked and schedules
 *    exactly the load-time run this migration exists to prevent. So {@link
 *    applyRunOnValueChangeMigration} rebuilds the bag with the `runOnChange-*` keys **first**, and
 *    `NodeScope.setNodeParameters` gives them an explicit priority so the guarantee does not rest
 *    on key order alone. Note this race is not the migration's: an author's hand-untick has had
 *    it since §2.
 *
 * ## Idempotent, and never louder than the author
 *
 * A `runOnChange-<input>` key that is **already present is never touched**, whatever its value.
 * That is what makes a second load a no-op, and it is also what makes the migration undoable: the
 * property panel writes `true` explicitly when a box is re-ticked (`BooleanType.onChange` sends
 * `Boolean(value)`, not `undefined`), so an author who re-ticks keeps it across every future load.
 * Only the panel's explicit *reset* affordance deletes the parameter — and a reset on a
 * pre-§2 graph means "give me the default", which for that graph is what this migration says.
 *
 * The plan is returned rather than only applied, so a caller can log, diff or count it. That is
 * the diagnosability half: nothing is stamped into the project (the format has nowhere to put a
 * marker — an open question §2 recorded and did not close), so the record has to be the report.
 *
 * ## Deliberately conservative
 *
 * The failure mode of a wrong migration is that it rewrites user projects, so every judgement
 * call here goes the quiet way:
 *
 * - **Only the fifteen families**, by exact type name. Their deprecated twins (`Model`,
 *   `Collection`, `DbModel`, …) still carry the *old* guard, were never given checkboxes, and so
 *   have nothing to preserve — writing to them would invent a port.
 * - **Only when the control signal is genuinely connected**, which means a connection whose
 *   source node exists in the same component. `NodeScope.addConnection` swallows a dangling wire,
 *   so a wire from a deleted node never made the setters passive and must not migrate.
 * - **Discovered inputs only where they are observable.** Expression and Function mint their
 *   value inputs from user text, so the saved document is the only evidence there is. An input
 *   that has neither a connection nor a stored parameter never receives a value at all, so its
 *   checkbox governs nothing and is not written — see {@link governedInputsFor}.
 * - **The definition port is never touched.** `expression` and `functionScript` keep the old
 *   `!isInputConnected(…)` guard on purpose (§2: dropping it would run every `Run`-driven script
 *   once at load, including the ones that POST), so they are not governed inputs and never appear
 *   in the table below.
 *
 * @module noodl-editor/models/ProjectPatches/runOnValueChangeMigration
 */

/**
 * Prefix identifying a "run on value change" checkbox port.
 *
 * Duplicated from `noodl-runtime/src/run-on-value-change.ts` rather than imported, for the same
 * reason `CatalogIndex` duplicates it: this module is loaded by the editor renderer *and* by the
 * main-process merge driver, and neither may pull in the runtime. `runOnChangePrefixMatchesRuntime`
 * in the spec pins the two together.
 */
export const RUN_ON_CHANGE_PREFIX = 'runOnChange-';

/**
 * How one node family's control signal used to silence its inputs.
 *
 * Mirrors the `runOnValueChange` field on the runtime node definitions
 * (`packages/noodl-runtime/src/run-on-value-change.ts` owns the mechanism; the declarations live
 * on the fifteen node modules). The spec pins every entry against the shipped node catalog, so a
 * family that gains or loses a governed input fails loudly here rather than migrating half a graph.
 */
export interface RunOnChangeFamily {
  /**
   * The signal input whose presence used to make the value inputs passive — the literal argument
   * to the old `isInputConnected(…)` guard, and the `controlSignal` recorded on the definition.
   */
  controlSignal: string;
  /**
   * Governed names that exist on **every** instance of the family: the definition's
   * `runOnValueChange.inputs` (real value ports) plus its `sources` (subscriptions — a record, an
   * array, the signed-in user — which have no port to hang a value on but were silenced by the
   * same guard). Written unconditionally, because `defineNode` synthesises their checkbox ports
   * on every instance.
   */
  declared: string[];
  /**
   * Port-name prefixes marking an input this family discovers per instance — `in-` for the
   * Function node's script inputs, `qp-`/`fp-` for the query and filter parameter ports. A saved
   * name carrying one of these is governed under its **full** port name, which is what
   * `registerRunOnValueChangeInput` is called with.
   */
  discoveredPrefixes?: string[];
  /**
   * Expression only: its discovered inputs are bare identifiers parsed out of the `expression`
   * parameter, so they cannot be recognised by shape. Anything observed on the instance that is
   * not one of {@link staticInputs} is one of them.
   */
  discoveredBareIdentifiers?: boolean;
  /** The type's own declared input names. Only consulted with {@link discoveredBareIdentifiers}. */
  staticInputs?: string[];
}

/**
 * The fifteen families of NDA-017 §2, keyed by node type name.
 *
 * Eighteen entries for fifteen families: the four Variable types share one definition
 * (`variables/variablebase.ts`) and one row each here, because the migration keys on type name.
 */
export const RUN_ON_CHANGE_FAMILIES: Readonly<Record<string, RunOnChangeFamily>> = {
  // variables/variablebase.ts — `Set` is the control signal on all four types.
  String: { controlSignal: 'saveValue', declared: ['value'] },
  Number: { controlSignal: 'saveValue', declared: ['value'] },
  Boolean: { controlSignal: 'saveValue', declared: ['value'] },
  Color: { controlSignal: 'saveValue', declared: ['value'] },

  // std-library/condition.ts
  Condition: { controlSignal: 'eval', declared: ['condition'] },

  // std-library/data/collectionnode2.ts — `array` is a subscription, not a port.
  Collection2: { controlSignal: 'fetch', declared: ['collectionId', 'array'] },

  // std-library/data/modelnode2.ts
  Model2: { controlSignal: 'fetch', declared: ['modelId', 'object'] },

  // std-library/data/dbmodelnode2.ts
  DbModel2: { controlSignal: 'fetch', declared: ['modelId', 'record'] },

  // std-library/data/variablenode2.ts
  Variable2: { controlSignal: 'fetch', declared: ['name', 'variable'] },

  // std-library/data/filtercollectionnode.ts
  'Filter Collection': {
    controlSignal: 'filter',
    declared: ['items', 'enabled', 'array', 'filterSettings']
  },

  // std-library/data/filterdbmodelsnode.ts — plus one `fp-<name>` port per visual filter input.
  FilterDBModels: {
    controlSignal: 'filter',
    declared: ['items', 'enabled', 'records', 'filterSettings'],
    discoveredPrefixes: ['fp-']
  },

  // std-library/data/dbcollectionnode2.ts — every governed name is registered at runtime
  // (`initialize` and `registerInputIfNeeded`), so none of them reaches the catalog; plus one
  // `qp-<name>` port per visual query input.
  DbCollection2: {
    controlSignal: 'storageFetch',
    declared: ['records', 'querySettings', 'collectionName', 'search'],
    discoveredPrefixes: ['qp-']
  },

  // std-library/componentutils/componentobject.ts
  'net.noodl.ComponentObject': { controlSignal: 'fetch', declared: ['object'] },

  // noodl-viewer-react/nodes/std-library/componentutils/parentcomponentobject.ts
  'net.noodl.ParentComponentObject': { controlSignal: 'fetch', declared: ['object'] },

  // std-library/user/user.ts
  'net.noodl.user.User': { controlSignal: 'fetch', declared: ['user'] },

  // noodl-viewer-react/nodes/controls/text-input.ts — `Set` is the control signal and `Text` the
  // one value input it silenced.
  //
  // ⚠️ This family's checkbox port does **not** exist. `createNodeFromReactComponent` builds its
  // definition field by field and never copies `runOnValueChange`, so `defineNode` synthesises
  // nothing and the catalog carries no `runOnChange-startValue` — while `text-input.ts` calls
  // `shouldRunOnValueChange('startValue')`, which therefore always answers *ticked*. The family is
  // migrated anyway, and correctly: the parameter reaches `registerInputIfNeeded`, `defineNode`'s
  // wrapper claims it and mints the checkbox, and the untick lands. Kept in the table with this
  // note rather than dropped, because dropping it would silently exclude the most common
  // `Set`-driven node in the library.
  'net.noodl.controls.textinput': { controlSignal: 'set', declared: ['startValue'] },

  // std-library/simplejavascript.ts — script inputs are registered as `in-<name>`, so the
  // checkbox is `runOnChange-in-<name>`. `functionScript` is the definition port and keeps the
  // old guard deliberately; it is not governed.
  JavaScriptFunction: { controlSignal: 'run', declared: [], discoveredPrefixes: ['in-'] },

  // std-library/expression.ts — every free identifier in `expression` becomes an input.
  // `expression` is the definition port and keeps the old guard deliberately.
  Expression: {
    controlSignal: 'run',
    declared: [],
    discoveredBareIdentifiers: true,
    staticInputs: ['expression', 'run']
  }
};

/** A node as it appears in a saved project's `graph.roots` tree. */
export interface MigrationNodeLike {
  id: string;
  type: string;
  parameters?: Record<string, unknown>;
  ports?: { name?: string }[];
  dynamicports?: { name?: string }[];
  children?: MigrationNodeLike[];
}

/** A connection as it appears in a saved component's `graph.connections`. */
export interface MigrationConnectionLike {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

/** A component as it appears in a saved project. */
export interface MigrationComponentLike {
  name?: string;
  graph?: {
    roots?: MigrationNodeLike[];
    connections?: MigrationConnectionLike[];
  };
}

/** The saved project shape — also exactly what `ProjectModel.toJSON()` produces. */
export interface MigrationProjectLike {
  components?: MigrationComponentLike[];
}

/** One parameter the migration would write. */
export interface RunOnChangeWrite {
  /** Component the node lives in, for the report. */
  component: string;
  nodeId: string;
  nodeType: string;
  /** The governed input — the full port name, `in-amount` rather than `amount`. */
  input: string;
  /** Always `runOnChange-<input>`. */
  parameter: string;
}

/** What the migration would do, or did. */
export interface RunOnValueChangeMigrationPlan {
  /** Every parameter to write. All of them are `false`; the field is implied, not carried. */
  writes: RunOnChangeWrite[];
  /** Nodes of one of the fifteen families, whether or not their control signal is wired. */
  familyNodes: number;
  /** …of those, the ones whose control signal is connected — the migration's population. */
  signalDrivenNodes: number;
  /** Governed inputs skipped because the author already has an answer stored. */
  preserved: number;
}

function emptyPlan(): RunOnValueChangeMigrationPlan {
  return { writes: [], familyNodes: 0, signalDrivenNodes: 0, preserved: 0 };
}

/** The checkbox port governing `inputName`. */
export function runOnChangePortName(inputName: string): string {
  return RUN_ON_CHANGE_PREFIX + inputName;
}

/**
 * Every governed input name observable on this saved node.
 *
 * Declared names come from the family and are returned unconditionally — `defineNode` puts their
 * checkbox on every instance, so writing `false` always lands somewhere real, and the `sources`
 * among them (a record subscription, the signed-in user) have no other evidence in the document.
 *
 * Discovered names are the conservative half. They exist only if the author's script, expression
 * or visual query produced them, and the saved document knows about them in exactly three places:
 * an incoming connection, a stored parameter, or an instance port bag. Anything else — an
 * identifier in the expression text that nothing feeds — never receives a value, so its checkbox
 * governs nothing and writing it would only invent a port in the panel.
 */
export function governedInputsFor(node: MigrationNodeLike, family: RunOnChangeFamily, incomingPorts: string[]): string[] {
  const governed: string[] = [];
  const seen = new Set<string>();

  const add = (name: string) => {
    if (name.length === 0 || seen.has(name)) return;
    seen.add(name);
    governed.push(name);
  };

  for (const name of family.declared) add(name);

  const wantsDiscovery = !!family.discoveredPrefixes || !!family.discoveredBareIdentifiers;
  if (!wantsDiscovery) return governed;

  const statics = new Set(family.staticInputs ?? []);

  const observed: string[] = [...incomingPorts];
  for (const name of Object.keys(node.parameters ?? {})) observed.push(name);
  for (const port of node.ports ?? []) if (typeof port?.name === 'string') observed.push(port.name);
  for (const port of node.dynamicports ?? []) if (typeof port?.name === 'string') observed.push(port.name);

  for (const name of observed) {
    // Never governed by anything: a checkbox is not governed by a checkbox.
    if (name.indexOf(RUN_ON_CHANGE_PREFIX) === 0) continue;
    if (statics.has(name)) continue;

    if (family.discoveredPrefixes) {
      if (family.discoveredPrefixes.some((prefix) => name.indexOf(prefix) === 0)) add(name);
      continue;
    }
    // Bare-identifier discovery (Expression). Everything left is a discovered input.
    add(name);
  }

  return governed;
}

/** Flatten a component's nested root tree. */
function eachNode(roots: MigrationNodeLike[], visit: (node: MigrationNodeLike) => void): void {
  for (const node of roots) {
    if (!node || typeof node !== 'object') continue;
    visit(node);
    if (Array.isArray(node.children)) eachNode(node.children, visit);
  }
}

/**
 * What the migration would write, without touching anything.
 *
 * Pure: the project object is only read. This is the unit every test and every blast-radius
 * measurement uses, so "what would this do to a real project" never needs an editor to answer.
 */
export function planRunOnValueChangeMigration(project: MigrationProjectLike): RunOnValueChangeMigrationPlan {
  const plan = emptyPlan();
  if (!project || !Array.isArray(project.components)) return plan;

  for (const component of project.components) {
    const graph = component?.graph;
    if (!graph || !Array.isArray(graph.roots)) continue;

    const componentName = typeof component.name === 'string' ? component.name : '';
    const connections = Array.isArray(graph.connections) ? graph.connections : [];

    // Ids that actually exist in this component. A connection from a node that is gone was
    // never made at runtime (`NodeScope.addConnection` catches and logs), so it never made the
    // setters passive and must not migrate.
    const nodeIds = new Set<string>();
    eachNode(graph.roots, (node) => {
      if (typeof node.id === 'string') nodeIds.add(node.id);
    });

    /** Ports on each node that something is wired into. */
    const incomingByNode = new Map<string, string[]>();
    for (const connection of connections) {
      if (!connection || typeof connection.toId !== 'string' || typeof connection.toProperty !== 'string') continue;
      if (!nodeIds.has(connection.fromId)) continue;
      const ports = incomingByNode.get(connection.toId);
      if (ports) ports.push(connection.toProperty);
      else incomingByNode.set(connection.toId, [connection.toProperty]);
    }

    eachNode(graph.roots, (node) => {
      const family = RUN_ON_CHANGE_FAMILIES[node.type];
      if (!family) return;
      plan.familyNodes++;

      const incomingPorts = incomingByNode.get(node.id) ?? [];
      if (incomingPorts.indexOf(family.controlSignal) === -1) return;
      plan.signalDrivenNodes++;

      const parameters = node.parameters ?? {};
      for (const input of governedInputsFor(node, family, incomingPorts)) {
        const parameter = runOnChangePortName(input);
        // Already answered — by an earlier load of this migration, or by the author. Either way
        // it is not ours to overwrite. This single check is the whole of idempotency.
        if (Object.prototype.hasOwnProperty.call(parameters, parameter)) {
          plan.preserved++;
          continue;
        }
        plan.writes.push({
          component: componentName,
          nodeId: node.id,
          nodeType: node.type,
          input,
          parameter
        });
      }
    });
  }

  return plan;
}

/**
 * Apply the plan to the project in place, and return it.
 *
 * The parameter bag is **rebuilt with the `runOnChange-*` keys first**. See §3 of the module
 * header: queued inputs drain in the bag's key order, so a governed value that drains before its
 * checkbox schedules exactly the load-time run this migration exists to prevent.
 */
export function applyRunOnValueChangeMigration(
  project: MigrationProjectLike
): RunOnValueChangeMigrationPlan {
  const plan = planRunOnValueChangeMigration(project);
  if (plan.writes.length === 0) return plan;

  const writesByNode = new Map<string, RunOnChangeWrite[]>();
  for (const write of plan.writes) {
    const list = writesByNode.get(write.nodeId);
    if (list) list.push(write);
    else writesByNode.set(write.nodeId, [write]);
  }

  for (const component of project.components ?? []) {
    const roots = component?.graph?.roots;
    if (!Array.isArray(roots)) continue;
    eachNode(roots, (node) => {
      const writes = writesByNode.get(node.id);
      if (!writes) return;

      const existing = node.parameters ?? {};
      const rebuilt: Record<string, unknown> = {};
      for (const write of writes) rebuilt[write.parameter] = false;
      for (const name of Object.keys(existing)) {
        if (!Object.prototype.hasOwnProperty.call(rebuilt, name)) rebuilt[name] = existing[name];
      }
      node.parameters = rebuilt;
    });
  }

  return plan;
}

/** A one-line summary for the load-time log. Empty string when there is nothing to say. */
export function describeRunOnValueChangeMigration(plan: RunOnValueChangeMigrationPlan): string {
  if (plan.writes.length === 0) return '';
  const nodes = new Set(plan.writes.map((w) => w.nodeId)).size;
  return (
    `[NDA-017] migrated ${plan.writes.length} value input(s) on ${nodes} node(s) to passive ` +
    `(runOnChange-*: false), preserving the pre-§2 behaviour of graphs whose control signal is wired. ` +
    `${plan.signalDrivenNodes} of ${plan.familyNodes} node(s) in the class have their control signal connected; ` +
    `${plan.preserved} input(s) already had an answer and were left alone.`
  );
}
