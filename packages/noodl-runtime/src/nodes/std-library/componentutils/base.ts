'use strict';

import Node = require('../../../node');
import Model = require('../../../model');
import { outcomeOutputs } from '../../../outcome';
import { ResolvedTargetReporter } from '../../../resolvedtarget';
import type {
  EditorConnectionLike,
  GraphNodeModel,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/**
 * Where a Set …Component Object Properties node is going to write, or why it cannot.
 *
 * The `id` and the miss are mutually exclusive, and the miss carries a code *and* a message
 * because the Failure Contract wants both: the code for tooling and tests, the message for the
 * author reading it on the canvas.
 */
interface ComponentObjectResolution {
  /** Id of the record to write into. Absent exactly when the walk found nothing. */
  id?: string;
  /** Name of the component whose record this is, for the node card (BINDING-CONTRACT §(b)). */
  name?: string;
  /** Set when nothing resolved: the stable code to raise. */
  missCode?: string;
  /** Set when nothing resolved: the human sentence. */
  missMessage?: string;
  /** Optional structured payload for the raise — the target asked for, the ancestors seen. */
  missDetail?: unknown;
}

/**
 * `this` inside a Set …Component Object Properties node.
 *
 * `hasScheduledStore` lives on the instance rather than in `_internal` — that is where the
 * original put it, and the two Component Object nodes do the same, so it is left alone.
 */
interface SetComponentObjectPropertiesInstance extends NodeInstance {
  _internal: {
    /** Latest value of each `prop-…` input, keyed by the property name without the prefix. */
    inputValues: Record<string, unknown>;
    /**
     * The `Parent Component` input on the parent variant: an ancestor named explicitly, or
     * unset for "nearest ancestor that has a Component Object". Unused by the self variant,
     * which has no such input.
     */
    targetComponent?: string;
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
  };
  hasScheduledStore?: boolean;
  resolveComponentObject(): ComponentObjectResolution;
  scheduleStore(): void;
  reportResolution(): void;
}

/**
 * What the two concrete nodes supply. Everything else about them is identical, which is why
 * this file exists.
 */
interface SetComponentObjectPropertiesDef {
  name: string;
  displayName: string;
  docs: string;
  /**
   * Which record to write into, and — when the answer is "none" — why.
   *
   * The self variant always resolves: its record is its own component instance's, which exists
   * by definition. The parent variant walks, so it can miss.
   */
  resolveComponentObject(this: SetComponentObjectPropertiesInstance): ComponentObjectResolution;
  /**
   * Whether resolution can miss, which is what decides if this node gets `Failure`/`Error`
   * ports at all.
   *
   * Not derived, declared: the Failure Contract is explicit that a port implying a failure
   * mode that does not exist is worse than no port, and the self variant cannot fail to find
   * its own component's record. It therefore keeps exactly the one `Done` output it had.
   */
  canFailToResolve?: boolean;
  /** Extra static inputs — the parent variant's explicit target (BINDING-CONTRACT §(a)). */
  inputs?: NodeDefinitionOptions['inputs'];
}

function extendSetComponentObjectProperties(def: SetComponentObjectPropertiesDef): NodeModule {
  /**
   * BINDING-CONTRACT §(b): which component's record this node writes to, on the node card.
   *
   * One per node type rather than per instance, so a graph node used in several places reports
   * one summary instead of whichever instance resolved last. See `resolvedtarget.ts`.
   */
  const resolvedTargets = new ResolvedTargetReporter();

  const SetComponentObjectProperties: NodeDefinitionOptions = {
    name: def.name,
    displayNodeName: def.displayName,
    category: 'Component Utilities',
    color: 'component',
    docs: def.docs,
    initialize: function (this: SetComponentObjectPropertiesInstance) {
      this._internal.inputValues = {};
    },
    /**
     * Report the resolved target as soon as the tree exists, not only when asked to store.
     *
     * Deferred for the reason `parentcomponentobject.ts` documents at length (NDA-015 §3): at
     * `nodeScopeDidInitialize` the enclosing component's node-creation loop is still running,
     * so the Component Object being looked for may not exist yet. `scheduleAfterUpdate` drains
     * at the end of this update pass, by which time the walk has something to walk.
     *
     * Silent about misses on purpose. This runs on every graph, and a node whose ancestor has
     * no Component Object *yet* is not a failure — it is a failure only when the author presses
     * `Do`, which is where the raise lives.
     */
    nodeScopeDidInitialize: function (this: SetComponentObjectPropertiesInstance) {
      if (!def.canFailToResolve) return;
      this.context.scheduleAfterUpdate(() => {
        this.reportResolution();
      });
    },
    inputs: Object.assign(
      {
        properties: {
          type: {
            name: 'stringlist',
            allowEditOnly: true
          },
          displayName: 'Properties',
          group: 'Properties',
          description: 'Names of the values this node writes, each becoming an input to supply it',
          set() {}
        },
        store: {
          type: 'signal',
          group: 'Actions',
          displayName: 'Do',
          description: 'Writes every supplied property value into the component object',
          valueChangedToTrue(this: SetComponentObjectPropertiesInstance) {
            this.scheduleStore();
          }
        }
      },
      def.inputs
    ),
    /**
     * ERG-001 §4. `stored` was one of the four internal names that all displayed as "Done"
     * (§0.2 Result 2); both variants say `done` now, and `Completed` joins them.
     *
     * `Failure` still comes from `canFailToResolve` rather than from the helper, because that
     * flag is the family's whole NDA-004 verdict — the self variant cannot miss its own
     * record and a vestigial `Failure` on it would imply a failure mode that does not exist.
     * `Completed` has no such exemption and is on both.
     */
    outputs: Object.assign(
      outcomeOutputs({
        done: 'Fires once every property has been written'
      }),
      // NDA-004 §2. Only on the variant that can actually miss — see `canFailToResolve`.
      def.canFailToResolve
        ? {
            failure: {
              type: 'signal',
              group: 'Events',
              displayName: 'Failure',
              description: 'Fires when no parent Component Object could be found, so nothing was written'
            },
            error: {
              type: 'string',
              group: 'Error',
              displayName: 'Error',
              description: 'Which ancestor was looked for and why it was not found',
              getter: function (this: SetComponentObjectPropertiesInstance) {
                return this._internal.lastError;
              }
            }
          }
        : undefined
    ),
    methods: {
      resolveComponentObject: def.resolveComponentObject,
      reportResolution(this: SetComponentObjectPropertiesInstance) {
        resolvedTargets.report(this, this.resolveComponentObject().name);
      },
      scheduleStore(this: SetComponentObjectPropertiesInstance) {
        if (this.hasScheduledStore) return;
        this.hasScheduledStore = true;
        // After the coalescing guard: two `Do` pulses in one frame are one store and so one
        // invocation, which must produce exactly one outcome.
        const outcome = this.beginOutcome();

        const internal = this._internal;
        this.scheduleAfterInputsHaveUpdated(() => {
          this.hasScheduledStore = false;

          const resolution = this.resolveComponentObject();
          if (def.canFailToResolve) resolvedTargets.report(this, resolution.name);

          /**
           * NDA-004 §2 — and this one was not merely mute.
           *
           * `getComponentObjectId` returned `undefined` when the walk found no ancestor with a
           * Component Object, and the old code passed that straight to `Model.get`.
           * `Model.get(undefined)` is the *anonymous* tier (`model.ts:205`): it mints a brand
           * new record, on every store, that nothing else in the graph can name and nothing
           * holds a reference to. So the node wrote every property into a throwaway and then
           * emitted `Done`.
           *
           * That is worse than the silent failures elsewhere in this batch. Those looked like
           * nothing happening; this actively reported success for a write that could never be
           * read back, which is the one thing the contract says a completion signal must never
           * do.
           */
          if (resolution.id === undefined) {
            internal.lastError = resolution.missMessage;
            this.flagOutputDirty('error');
            // The raise moved inside `reportOutcome`, which does it before the signal for the
            // same reason `error` is flagged first: a graph wired `Failure -> show` must
            // already be able to read the reason when the pulse lands.
            this.reportOutcome(outcome, 'failure', {
              code: resolution.missCode,
              message: resolution.missMessage,
              detail: resolution.missDetail
            });
            return;
          }

          // CWF-008: the same scope the *read* side uses (`componentobject.ts`) and the same one
          // `javascriptnodeparser.ts` resolves `Component.Object` in. Undefined in the browser,
          // per-request in the cloud runtime.
          const model: ModelLike = (this.nodeScope.modelScope || Model).get(resolution.id);

          const properties = (this.model.parameters.properties as string) || '';
          const validProperties = properties.split(',');

          const keysToSet = Object.keys(internal.inputValues).filter((key) => validProperties.indexOf(key) !== -1);

          for (const i of keysToSet) {
            model.set(i, internal.inputValues[i], { resolve: true });
          }
          // Last, after every write has notified.
          this.reportOutcome(outcome, 'done');
        });
      },
      _onNodeDeleted(this: SetComponentObjectPropertiesInstance) {
        Node.prototype._onNodeDeleted.call(this);
        // Not optional: the reporter holds instances strongly, so a Repeater churning its
        // template would grow that map for the life of the session.
        if (def.canFailToResolve) resolvedTargets.forget(this);
      },
      registerInputIfNeeded: function (this: SetComponentObjectPropertiesInstance, name: string) {
        if (this.hasInput(name)) {
          return;
        }

        if (name.startsWith('prop-')) {
          const propertyName = name.substring('prop-'.length);
          this.registerInput(name, {
            set(this: SetComponentObjectPropertiesInstance, value: unknown) {
              this._internal.inputValues[propertyName] = value;
            }
          });
        } else if (name.startsWith('type-')) {
          this.registerInput(name, {
            set() {}
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

    const _types = [
      { label: 'String', value: 'string' },
      { label: 'Boolean', value: 'boolean' },
      { label: 'Number', value: 'number' },
      { label: 'Date', value: 'date' },
      { label: 'Array', value: 'array' },
      { label: 'Object', value: 'object' },
      { label: 'Any', value: '*' }
    ];

    // Add value outputs
    const properties = parameters.properties as string | undefined;
    if (properties) {
      for (const p of properties.split(',')) {
        // Property input
        ports.push({
          type: {
            name: parameters['type-' + p] === undefined ? '*' : parameters['type-' + p]
          },
          plug: 'input',
          group: 'Property Values',
          displayName: p,
          //  editorName:p,
          name: 'prop-' + p
        });

        // Property type
        ports.push({
          type: {
            name: 'enum',
            enums: _types,
            allowEditOnly: true
          },
          plug: 'input',
          group: 'Property Types',
          displayName: p,
          default: '*',
          name: 'type-' + p
        });
      }
    }

    editorConnection.sendDynamicPorts(nodeId, ports, {
      detectRenamed: {
        plug: 'input'
      }
    });
  }

  return {
    node: SetComponentObjectProperties,
    setup: function (context: NodeContextLike, graphModel) {
      const editorConnection = context.editorConnection;
      if (!editorConnection || !editorConnection.isRunningLocally()) {
        return;
      }

      graphModel.on('nodeAdded.' + def.name, (node: GraphNodeModel) => {
        updatePorts(node.id, node.parameters, editorConnection);

        node.on('parameterUpdated', (event: { name: string }) => {
          if (event.name === 'properties' || event.name.startsWith('type-')) {
            updatePorts(node.id, node.parameters, editorConnection);
          }
        });
      });
    }
  };
}

export { extendSetComponentObjectProperties };
export type { ComponentObjectResolution, SetComponentObjectPropertiesInstance };
