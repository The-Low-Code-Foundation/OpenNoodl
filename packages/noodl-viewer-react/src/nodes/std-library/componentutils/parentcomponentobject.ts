'use strict';

import { EventEmitter } from 'events';
import { Node } from '@noodl/runtime';
import {
  COMPONENT_OBJECT_TYPES,
  componentAncestorNames,
  findAncestorWithComponentObject,
  findAncestorWithName
} from '@noodl/runtime/src/componentwalk';
import Model from '@noodl/runtime/src/model';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import { ResolvedTargetReporter } from '@noodl/runtime/src/resolvedtarget';
import type {
  ComponentInstanceLike,
  EditorConnectionLike,
  GraphNodeModel,
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
} from '@noodl/types';

const graphEventEmitter = new EventEmitter();
graphEventEmitter.setMaxListeners(1000000);

/**
 * Clause (b) of the Binding Contract: the resolved ancestor's name, on the node card.
 *
 * Module-level, so all instances of every Parent Component Object node share it and a graph
 * node used in several places reports one summary rather than whichever instance resolved
 * last. See `resolvedtarget.ts`.
 */
const resolvedTargets = new ResolvedTargetReporter();

/** `this` inside the Parent Component Object node. */
interface ParentComponentObjectInstance extends NodeInstance {
  _internal: {
    /** Latest value of each `value-…` input, keyed without the prefix. */
    inputValues: Record<string, unknown>;
    /** Id of the parent's record. `undefined` until a parent with one is found. */
    modelId?: string;
    /** The parent's record. Absent while no parent has been resolved. */
    model?: ModelLike;
    /** Shown in the inspector so the author can see *which* parent was found. */
    parentComponentName?: string;
    /** The `Parent Component` input: an ancestor named explicitly, or unset for "nearest". */
    targetComponent?: string;
    /**
     * Whether a failed resolution should be raised yet.
     *
     * False until the deferral in `nodeScopeDidInitialize` has run. Resolution during
     * `initialize` legitimately finds nothing — the parent's scope is still being built —
     * and raising there would report a failure on every correctly-wired graph in the
     * project. See the note on `nodeScopeDidInitialize`.
     */
    resolutionIsLoud?: boolean;
    /** The last miss already raised, so a repeated resolution does not repeat the report. */
    lastMissCode?: string;
    /** Message for the `Error` output; see NDA-004 §2. */
    lastError?: string;
    onModelChangedCallback(args: ModelChangeEvent): void;
  };
  hasScheduledStore?: boolean;
  /** Instance-bound listener, kept so it can be removed again on delete. */
  onComponentStateNodesChanged(): void;
  updateComponentState(): void;
  findParentComponentStateModelId(): string | undefined;
  setModelId(id: string | undefined, token?: OutcomeToken): void;
  scheduleStore(): void;
  reportMiss(code: string, message: string, detail?: unknown): void;
}

const ParentComponentObject: NodeDefinitionOptions = {
  name: 'net.noodl.ParentComponentObject',
  displayNodeName: 'Parent Component Object',
  category: 'Component Utilities',
  color: 'component',
  docs: 'https://docs.noodl.net/nodes/component-utilities/parent-component-object',
  /**
   * NDA-017 §2. `Fetch` is this family's control signal, and it governed **three** sites on
   * this node, not one: the object subscription, the rebind when an ancestor's Component
   * Object changes identity, and the initial bind in `updateComponentState`.
   *
   * One checkbox covers all three deliberately. Splitting "which object" from "its
   * properties" is right on the Object node, where `Id` is a port the author wired and can
   * reason about separately. Here there is no such port — the binding is resolved by walking
   * the component tree — so both halves are the same single thing from the author's side:
   * *this node's parent object*. Two boxes would be two names for one decision.
   */
  runOnValueChange: {
    controlSignal: 'fetch',
    sources: [{ name: 'object', displayName: 'Parent object' }]
  },
  initialize(this: ParentComponentObjectInstance) {
    this._internal.inputValues = {};

    this._internal.onModelChangedCallback = (args) => {
      // Was `if (this.isInputConnected('fetch') !== false) return;`.
      if (!this.shouldRunOnValueChange('object')) return;

      if (this.hasOutput('value-' + args.name)) {
        this.flagOutputDirty('value-' + args.name);
      }

      if (this.hasOutput('changed-' + args.name)) {
        this.sendSignalOnOutput('changed-' + args.name);
      }

      this.sendSignalOnOutput('changed');
    };

    //TODO: don't listen for delta updates when running deployed
    this.onComponentStateNodesChanged = () => {
      const id = this.findParentComponentStateModelId();

      if (this._internal.modelId !== id) {
        this._internal.modelId = id;

        // Was `if (this.isInputConnected('fetch') === false)`.
        if (this.shouldRunOnValueChange('object')) {
          this.setModelId(this._internal.modelId);
        }
      }
    };

    graphEventEmitter.on('componentStateNodesChanged', this.onComponentStateNodesChanged);

    this.updateComponentState();
  },
  //to search up the tree the root nodes in this component must have been initialized
  //we also need the connections to be setup so we can use isInputConnected
  //nodeScopeDidInitialize takes care of that
  /**
   * NDA-015 §3 — the standing `//FIXME: temporary hack` here, resolved.
   *
   * The ordering problem is real. `nodeScopeDidInitialize` fires from the *child's*
   * `NodeScope.setComponentModel`, which runs part-way through the parent's node-creation
   * loop, so any of the parent's nodes created after this instance — including, quite
   * possibly, the Component Object being looked for — do not exist yet. Resolving here
   * would find nothing and be wrong.
   *
   * The deferral is therefore load-bearing, and it is **not** a sleep. `scheduleAfterUpdate`
   * queues into `callbacksAfterUpdate`, which `NodeContext.updateDirtyNodes` drains after
   * the dirty-node loop *within the same update pass*, re-looping until both queues are
   * empty. By the time it runs, the whole tree for this pass has been created. That is a
   * defined scope-ready point, which is what the Binding Contract asks for — and it is
   * precisely what the old comment proposed as "the fix", so the fix was already here and
   * only the framing was wrong.
   *
   * What that comment got right is the cost: outputs propagate a pass later than the rest
   * of the graph. That is inherent to resolving after creation, not a defect of this call,
   * and closing it would need `NodeScope` to announce readiness upwards — a change well
   * beyond this contract.
   *
   * Going loud is tied to the same point: before it, a miss is expected and silent; after
   * it, a miss is a genuine failure and gets raised.
   */
  nodeScopeDidInitialize(this: ParentComponentObjectInstance) {
    this.context.scheduleAfterUpdate(() => {
      this._internal.resolutionIsLoud = true;
      if (!this._internal.modelId) {
        this.updateComponentState();
      }
    });
  },
  getInspectInfo(this: ParentComponentObjectInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return 'No parent component state found';

    const modelInfo = [{ type: 'text', value: this._internal.parentComponentName }];

    const data = this._internal.model.data;
    return modelInfo.concat(
      Object.keys(data).map((key) => {
        return { type: 'text', value: key + ': ' + data[key] };
      })
    );
  },
  inputs: {
    /**
     * BINDING-CONTRACT §(a). Optional: unset keeps the historical "nearest ancestor that has
     * one" resolution exactly, so no existing project changes behaviour.
     *
     * A name, not a hop count — "two levels up" breaks the moment somebody wraps a component
     * in a Group, "the component named X" survives it. Typed `component` so the editor offers
     * the project's components rather than a free-text field to mistype.
     */
    targetComponent: {
      type: 'component',
      displayName: 'Parent Component',
      group: 'General',
      description: 'Which ancestor to read from; leave blank for the nearest one that has a Component Object',
      set(this: ParentComponentObjectInstance, value: string) {
        this._internal.targetComponent = value || undefined;
        // A retarget is a new question, so a miss already reported about the old target must
        // be allowed to be reported again about the new one.
        this._internal.lastMissCode = undefined;
        this.updateComponentState();
      }
    },
    properties: {
      type: {
        name: 'stringlist',
        allowEditOnly: true
      },
      displayName: 'Properties',
      group: 'Properties',
      description: 'Names of the parent values to expose, each becoming a matching input and output',
      set() {}
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      description:
        'Republishes every property from the parent now. This is additional to the outputs updating on their own; untick Parent object under Run On Value Change to stop that',
      valueChangedToTrue: function (this: ParentComponentObjectInstance) {
        // ERG-001 §4. Only the port mints: `setModelId` is also reached from `initialize`, the
        // `targetComponent` setter, the deferred `nodeScopeDidInitialize` resolution and the
        // `componentStateNodesChanged` subscription, and none of those is an invocation.
        this.setModelId(this._internal.modelId, this.beginOutcome());
      }
    }
  },
  outputs: {
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events',
      description: 'Fires when a property on the resolved parent is written, unless Fetch is connected'
    },
    /**
     * ERG-001 §4 — `Fetched` stays where it is, and `Done` goes beside it.
     *
     * This is the node the `Fetched`-is-not-`Done` question is *measurably* settled on: three
     * of `setModelId`'s five callers are not invocations, so a rename would fire `Done` on the
     * boot path and on every ancestor rebuild while `Completed` — which only an invocation may
     * emit — stayed silent. `Done` and `Completed` diverging on a node doing nothing wrong is
     * Rule 2 broken in the one place its whole value lies.
     */
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events',
      description: 'Fires whenever every property is republished, whether by Fetch or by the parent being re-resolved'
    },
    /**
     * NDA-004 §2. NDA-015 gave this node *raising* — the runtime error channel — but nothing an
     * author could wire, so a graph could not branch on "my parent state never resolved".
     * `Failure` fires from `reportMiss`, which is to say under exactly the two guards the raise
     * already respects: never before the deferred first resolution (a miss during `initialize`
     * is normal on a healthy graph), and never twice for one distinct miss.
     *
     * ⚠️ ERG-001 §4 adds a **second** route to it, deliberately outside those guards: a `Fetch`
     * with nothing resolved. Rule 1 is per invocation, so an author who presses `Fetch` twice on
     * an unresolvable node is owed two answers, where `reportMiss`'s dedup — which exists to
     * stop a *repeated resolution* drowning the channel — would give one.
     *
     * No `Unchanged`: `Fetch` republishes unconditionally when there is a parent, and reports
     * the miss when there is not. §5 must not expect one.
     */
    ...outcomeOutputs({
      done: 'Fires once a Fetch you triggered has republished every property, after Fetched',
      failure: 'Fires when no parent Component Object could be found, so there is nothing to read'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Which ancestor was looked for and why it was not found',
      getter(this: ParentComponentObjectInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    updateComponentState(this: ParentComponentObjectInstance) {
      this._internal.modelId = this.findParentComponentStateModelId();
      // Was `if (this.isInputConnected('fetch') === false)`. Unticking makes the node bind
      // nothing until `Fetch` fires, which is exactly the behaviour connecting `Fetch` used
      // to impose silently.
      if (this.shouldRunOnValueChange('object')) {
        this.setModelId(this._internal.modelId);
      }
    },
    /**
     * Which ancestor's Component Object this node reads and writes.
     *
     * Implements all three clauses of `dev-docs/reference/BINDING-CONTRACT.md`: an optional
     * explicit target (a), the resolved name pushed to the node card (b), and a raised
     * failure whenever nothing resolves (c). The walk itself now lives in
     * `componentwalk.ts`, shared with the three other copies of it.
     */
    findParentComponentStateModelId(this: ParentComponentObjectInstance): string | undefined {
      const self = this.nodeScope.componentOwner;
      const wanted = this._internal.targetComponent;

      // Explicit target. A miss here is a *failure*, never a quiet fall back to the nearest
      // ancestor: falling back would reintroduce the silent-wrong-target bug behind an input
      // whose whole purpose is to prevent it (contract §(a)).
      if (wanted) {
        const named = findAncestorWithName(self, wanted);

        if (!named) {
          this._internal.parentComponentName = undefined;
          resolvedTargets.report(this, undefined);
          this.reportMiss('parent-component-object/target-not-found', 'No ancestor component named "' + wanted + '"', {
            target: wanted,
            ancestors: componentAncestorNames(self)
          });
          return;
        }

        // Named, but with nothing to read. Distinct from the above on purpose — "you named
        // the right component and it has no Component Object" and "you named a component
        // that is not above this one" are different mistakes with different fixes.
        if (!COMPONENT_OBJECT_TYPES.some((type) => named.nodeScope.getNodesWithType(type).length > 0)) {
          this._internal.parentComponentName = undefined;
          resolvedTargets.report(this, undefined);
          this.reportMiss(
            'parent-component-object/target-has-no-object',
            'The component "' + wanted + '" has no Component Object node',
            { target: wanted }
          );
          return;
        }

        this._internal.parentComponentName = named.name;
        this._internal.lastMissCode = undefined;
        this._internal.lastError = undefined;
        resolvedTargets.report(this, named.name);
        return 'componentState' + named.getInstanceId();
      }

      // Implicit: nearest ancestor that owns a Component Object. Unchanged behaviour, so
      // existing projects bind exactly as before — what is new is that it now says so.
      const parent: ComponentInstanceLike | undefined = findAncestorWithComponentObject(self);

      if (!parent) {
        this._internal.parentComponentName = undefined;
        resolvedTargets.report(this, undefined);
        // Was a bare `return` — the node bound to nothing, emitted nothing and looked
        // identical to one whose parent simply had no data yet (contract §(c)).
        this.reportMiss('parent-component-object/no-ancestor', 'No ancestor component has a Component Object node', {
          ancestors: componentAncestorNames(self)
        });
        return;
      }

      this._internal.parentComponentName = parent.name;
      this._internal.lastMissCode = undefined;
      this._internal.lastError = undefined;
      resolvedTargets.report(this, parent.name);

      return 'componentState' + parent.getInstanceId();
    },
    /**
     * Raise a resolution failure — at most once per distinct miss, and never too early.
     *
     * Both guards matter. `resolutionIsLoud` keeps the deferred first attempt quiet, because
     * resolution during `initialize` finds nothing on a perfectly healthy graph. `lastMissCode`
     * stops the repeat: `findParentComponentStateModelId` runs again on every
     * `componentStateNodesChanged`, and a node that legitimately has no ancestor would
     * otherwise raise once per edit, drowning the channel it is trying to use.
     */
    reportMiss(this: ParentComponentObjectInstance, code: string, message: string, detail?: unknown) {
      if (!this._internal.resolutionIsLoud) return;
      if (this._internal.lastMissCode === code) return;

      this._internal.lastMissCode = code;
      this._internal.lastError = message;
      this.raiseRuntimeError(code, message, detail);
      // NDA-004 §2: the same event, on the graph. Under `reportMiss`'s guards rather than beside
      // them, so the port cannot become the noisy twin of a channel that is deliberately quiet.
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    },
    setModelId(this: ParentComponentObjectInstance, id: string | undefined, token?: OutcomeToken) {
      this._internal.model && this._internal.model.off('change', this._internal.onModelChangedCallback);
      this._internal.model = undefined;

      if (!id) {
        // ERG-001 §4. Was a bare `return`, and it is the contract's headline class: `Fetch`
        // pressed on a node whose walk found nothing cleared the binding, emitted no `fetched`,
        // no `changed` and no diagnosis, and the graph behind it stopped dead. The setter and
        // subscription routes into here still return silently — they carry no token, because
        // nobody invoked them.
        if (token) {
          const message =
            'Fetch was triggered but no parent Component Object is bound, so there is nothing to republish';
          this._internal.lastError = message;
          this.flagOutputDirty('error');
          this.reportOutcome(token, 'failure', {
            code: 'parent-component-object/fetch-no-parent',
            message,
            detail: { target: this._internal.targetComponent }
          });
        }
        return;
      }

      const model: ModelLike = Model.get(id);
      this._internal.model = model;

      model.on('change', this._internal.onModelChangedCallback);

      for (const key in model.data) {
        if (this.hasOutput('value-' + key)) {
          this.flagOutputDirty('value-' + key);
        }
        if (this.hasOutput('changed-' + key)) {
          this.sendSignalOnOutput('changed-' + key);
        }
      }

      this.sendSignalOnOutput('changed');
      this.sendSignalOnOutput('fetched');

      // Last, after every value and every value-level announcement.
      if (token) this.reportOutcome(token, 'done');
    },
    scheduleStore(this: ParentComponentObjectInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        if (!internal.model) return;
        for (const i in internal.inputValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
      });
    },
    _onNodeDeleted(this: ParentComponentObjectInstance) {
      Node.prototype._onNodeDeleted.call(this);

      graphEventEmitter.off('componentStateNodesChanged', this.onComponentStateNodesChanged);
      this._internal.model && this._internal.model.off('change', this._internal.onModelChangedCallback);
      // Not optional: the reporter holds instances strongly, so a Repeater churning its
      // template would grow that map for the life of the session.
      resolvedTargets.forget(this);
    },
    registerOutputIfNeeded(this: ParentComponentObjectInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      const propertyName = name.substring('value-'.length);

      this.registerOutput(name, {
        get(this: ParentComponentObjectInstance) {
          if (!this._internal.model) return undefined;
          return this._internal.model.get(propertyName, { resolve: true });
        }
      });
    },
    registerInputIfNeeded: function (this: ParentComponentObjectInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('value-')) {
        const propertyName = name.substring('value-'.length);
        this.registerInput(name, {
          set(this: ParentComponentObjectInstance, value: unknown) {
            this._internal.inputValues[propertyName] = value;

            this.scheduleStore();
          }
        });
      }
    }
  }
};

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike
): void {
  const ports = [];

  // Add value outputs
  const propertiesParam = parameters.properties as string | undefined;
  const properties = propertiesParam && propertiesParam.split(',');

  // `properties` is falsy when the author has typed none. The original iterated it with
  // `for…in`, which tolerates that; `for…of` would throw, hence the `|| []`.
  for (const p of properties || []) {
    ports.push({
      type: {
        name: '*', //parameters['type-' + p] || 'string',
        allowConnectionsOnly: true
      },
      plug: 'input/output',
      group: 'Properties',
      name: 'value-' + p,
      displayName: p
    });

    ports.push({
      type: 'signal',
      plug: 'output',
      group: 'Changed Events',
      displayName: p + ' Changed',
      name: 'changed-' + p
    });
  }

  editorConnection.sendDynamicPorts(nodeId, ports, {
    detectRenamed: {
      plug: 'input/output'
    }
  });
}

const ParentComponentObjectModule: NodeModule = {
  node: ParentComponentObject,
  setup: function (context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.net.noodl.ParentComponentObject', (node: GraphNodeModel) => {
      updatePorts(node.id, node.parameters, editorConnection);

      node.on('parameterUpdated', () => {
        updatePorts(node.id, node.parameters, editorConnection);
      });
    });

    //TODO: handle additional delta update event:
    // - visual parent changed

    //this are the same events that'll create and delete the Comopent State instance node
    //it might not have had a chance to run yet if we're first in the event list, so
    //use a setTimeout
    graphModel.on('nodeAdded.net.noodl.ComponentObject', () => {
      setTimeout(() => {
        graphEventEmitter.emit('componentStateNodesChanged');
      }, 0);
    });
    graphModel.on('nodeRemoved.net.noodl.ComponentObject', () => {
      setTimeout(() => {
        graphEventEmitter.emit('componentStateNodesChanged');
      });
    });
  }
};

export default ParentComponentObjectModule;
