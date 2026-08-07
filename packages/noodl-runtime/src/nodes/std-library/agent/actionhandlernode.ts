'use strict';

/**
 * Action Handler (AGENT-005) — declares one action type this app is willing to execute.
 *
 * This node **is** the allow-list. An `Action Dispatcher` executes an action type only if
 * a handler for it is registered here (or it is one of the built-ins the author enabled
 * by name on the dispatcher). There is no separate permission table, so a permission
 * cannot drift out of step with the graph: if the wire is not on the canvas, the server
 * cannot cause it.
 *
 * That also means this node is where a capability is *granted*. Wiring `trigger` to a
 * `Navigate` node gives a backend the ability to navigate the app; wiring it to a delete
 * gives a backend the ability to delete. That is intended and useful, and it is a
 * decision the author makes visibly, one action type at a time.
 *
 *     [Action Handler]  actionType: "OPEN_SESSION"
 *              trigger ──▶ [Navigate to Component]
 *              payload ──▶ [Set Variable]
 *
 * @module noodl-runtime
 * @since 2.0.0
 */
import type { NodeDefinitionOptions, NodeInstance, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';

import { ActionContext, ActionRegistry, actionRegistry, isBuiltInAction, Unsubscribe } from './action-dispatcher';

import Node = require('../../../node');

/** NDA-004 §2 — the matchable half of the failure pair. The bus keys by `code`. */
const HANDLER_ERROR_CODE = 'action-handler/operation-failed';

interface HandlerInternal {
  channel: string;
  actionType: string;
  enabled: boolean;
  autoComplete: boolean;
  result: unknown;
  errorMessage: string;

  payload: unknown;
  actionId: string;
  error: string;
  triggeredCount: number;

  pending: ActionContext | null;
  unregister: Unsubscribe | null;
  setupScheduled: boolean;

  /** Test seam; production uses the process-wide registry. */
  registry: ActionRegistry;
}

function internalOf(node: NodeInstance): HandlerInternal {
  return node._internal as unknown as HandlerInternal;
}

const ActionHandlerNode: NodeDefinitionOptions = {
  name: 'net.noodl.ActionHandler',
  displayNodeName: 'Action Handler',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'actionType',
  searchTags: ['action', 'handler', 'register', 'dispatch', 'agent', 'ai', 'backend', 'remote', 'command'],

  initialize(this: NodeInstance) {
    const internal = internalOf(this);
    internal.channel = 'default';
    internal.actionType = '';
    internal.enabled = true;
    internal.autoComplete = true;
    internal.result = undefined;
    internal.errorMessage = '';

    internal.payload = undefined;
    internal.actionId = '';
    internal.error = '';
    internal.triggeredCount = 0;

    internal.pending = null;
    internal.unregister = null;
    internal.setupScheduled = false;
    internal.registry = actionRegistry;
  },

  getInspectInfo(this: NodeInstance) {
    const internal = internalOf(this);
    if (!internal.actionType) return { type: 'text', value: '[No action type set]' };
    return {
      type: 'value',
      value: {
        channel: internal.channel,
        actionType: internal.actionType,
        registered: internal.unregister !== null,
        inFlight: internal.pending !== null,
        triggered: internal.triggeredCount,
        lastPayload: internal.payload,
        error: internal.error
      }
    };
  },

  inputs: {
    channel: {
      type: 'string',
      default: 'default',
      displayName: 'Channel',
      description: 'Must match the Channel on the Action Dispatcher that should be able to reach this handler',
      group: 'Handler',
      tooltip: 'Must match the Channel on the Action Dispatcher that should be able to reach this handler.',
      set(this: NodeInstance, value: string) {
        internalOf(this).channel = value === undefined || value === null || value === '' ? 'default' : String(value);
        (this as never as { scheduleSetup(): void }).scheduleSetup();
      }
    },

    actionType: {
      type: 'string',
      displayName: 'Action Type',
      description: 'The exact action type this handler accepts; registering it is what makes it executable at all',
      group: 'Handler',
      tooltip:
        'The exact action type this handler accepts, e.g. OPEN_SESSION. Registering it is what makes it executable at all.',
      set(this: NodeInstance, value: string) {
        internalOf(this).actionType = value === undefined || value === null ? '' : String(value);
        (this as never as { scheduleSetup(): void }).scheduleSetup();
      }
    },

    enabled: {
      type: 'boolean',
      default: true,
      displayName: 'Enabled',
      description:
        'Turning this off unregisters the handler, so the action is refused as unknown rather than quietly ignored',
      group: 'Handler',
      tooltip:
        'Turning this off unregisters the handler, so the action is refused as unknown rather than quietly ignored.',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).enabled = value === undefined ? true : !!value;
        (this as never as { scheduleSetup(): void }).scheduleSetup();
      }
    },

    autoComplete: {
      type: 'boolean',
      default: true,
      displayName: 'Auto Complete',
      description:
        'Reports the action complete as soon as Trigger has been sent; turn it off when a later step must finish first',
      group: 'Completion',
      tooltip:
        'Report the action complete as soon as Trigger has been sent. Turn off when a later step must wait for this one to finish, and wire Complete or Fail yourself.',
      set(this: NodeInstance, value: boolean) {
        internalOf(this).autoComplete = value === undefined ? true : !!value;
      }
    },

    result: {
      type: '*',
      displayName: 'Result',
      description: 'Handed back to the dispatcher as the Result of this action when it completes',
      group: 'Completion',
      tooltip: 'Handed back to the dispatcher as the Result of this action when it completes.',
      set(this: NodeInstance, value: unknown) {
        internalOf(this).result = value;
      }
    },

    errorMessage: {
      type: 'string',
      displayName: 'Error Message',
      description:
        'Reason handed back to the dispatcher when Fail is signalled; a generic one is used when this is blank',
      group: 'Completion',
      set(this: NodeInstance, value: string) {
        internalOf(this).errorMessage = value === undefined || value === null ? '' : String(value);
      }
    },

    complete: {
      displayName: 'Complete',
      description:
        'Reports the action finished, so the dispatcher runs whatever is queued behind it; ignored unless Auto Complete is off',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        // ERG-001 §4. Minted at the port; `doComplete` runs inline, so no pending array is
        // needed and none is created.
        (this as never as { doComplete(t: OutcomeToken): void }).doComplete(this.beginOutcome());
      }
    },

    fail: {
      displayName: 'Fail',
      description: 'Reports the action failed, so the dispatcher fires Failed with Error Message as the reason',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as never as { doFail(t: OutcomeToken): void }).doFail(this.beginOutcome());
      }
    }
  },

  outputs: {
    trigger: {
      type: 'signal',
      displayName: 'Trigger',
      description:
        'Fires when a dispatcher has an action of this type to run; whatever is wired downstream is the capability this grants',
      group: 'Events'
    },

    payload: {
      type: '*',
      displayName: 'Payload',
      description:
        'The data the action carried, taken from its payload or data field, or the whole action when it has neither',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).payload;
      }
    },
    actionId: {
      type: 'string',
      displayName: 'Action Id',
      description: 'Id of the action currently being handled, so a later Complete can be matched to it',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).actionId;
      }
    },
    registered: {
      type: 'boolean',
      displayName: 'Registered',
      description: 'True while this handler is in the allow-list, which needs both an Action Type and Enabled',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).unregister !== null;
      }
    },
    triggeredCount: {
      type: 'number',
      displayName: 'Triggered Count',
      description: 'How many actions this handler has been asked to run since the page loaded',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).triggeredCount;
      }
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the handler could not register, or why the last Complete or Fail had nothing to act on',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).error;
      }
    },
    /**
     * NDA-012 / NDA-004 §2. `Complete` and `Fail` used to end on the `error` string alone when
     * there was no action in flight, so both of this node's author-facing signal inputs could
     * be pulsed and produce nothing a graph could sequence off.
     *
     * Only the two author `Do`s fire it. The registration errors — a blank action type, a
     * reserved built-in name — raise on the runtime error bus instead: they are reached while
     * the graph is still coming up, and a signal on the boot path is the defect NDA-004 §2
     * warns about in `Stream Buffer`'s own comment.
     */
    /**
     * ⚠️ ERG-001 §4 — **`Done` and this `Failure` are not the two halves of `Fail`.**
     *
     * A `Fail` that finds an action in flight reports `Done`: the node was asked to report the
     * action failed and it did. This port keeps the meaning the sentence below has always
     * given it — the invocation was refused because there was nothing to act on — which is a
     * genuine refusal and a different thing entirely.
     *
     * ⚠️ **No `Unchanged`.** Neither verb has a state in which the post-condition already
     * holds: an action is either in flight, in which case there is work, or it is not, in which
     * case the node cannot act at all.
     */
    ...outcomeOutputs({
      done: 'Fires when Complete or Fail acted on the action in flight — including a Fail, which succeeds by reporting the failure',
      failure: 'Fires when Complete or Fail was signalled with no action in flight'
    })
  },

  methods: {
    /**
     * Registration is deferred to the end of the frame, the pattern Subscribe to Store
     * uses: `channel`, `actionType` and `enabled` arrive as separate writes, and
     * registering from the first of them would claim the wrong name and then have to
     * move. There is deliberately no `Register` signal — an action arriving before the
     * author remembered to pulse one would be refused, and the refusal would look like a
     * server bug rather than a missing wire.
     */
    scheduleSetup(this: NodeInstance) {
      const internal = internalOf(this);
      if (internal.setupScheduled) return;
      internal.setupScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: NodeInstance) {
        internalOf(this).setupScheduled = false;
        (this as never as { setupRegistration(): void }).setupRegistration();
      });
    },

    setupRegistration(this: NodeInstance) {
      const internal = internalOf(this);
      (this as never as { teardownRegistration(): void }).teardownRegistration();

      if (!internal.enabled) {
        this.flagOutputDirty('registered');
        return;
      }

      if (!internal.actionType) {
        internal.error = 'An action type is required';
        this.flagOutputDirty('error');
        this.flagOutputDirty('registered');
        this.raiseRuntimeError(HANDLER_ERROR_CODE, internal.error);
        return;
      }

      const node = this;

      try {
        internal.unregister = internal.registry.register(internal.channel, internal.actionType, {
          invoke(context: ActionContext) {
            const inner = internalOf(node);
            inner.pending = context;
            inner.payload = context.payload;
            inner.actionId = context.actionId;
            inner.triggeredCount++;

            // Values before the signal, so a graph wired `payload -> value`,
            // `trigger -> set` sees this action's payload and not the previous one's.
            node.flagOutputDirty('payload');
            node.flagOutputDirty('actionId');
            node.flagOutputDirty('triggeredCount');
            node.sendSignalOnOutput('trigger');

            // After the signal: everything wired to Trigger has already run
            // synchronously by now, so "complete" means "the graph finished this step".
            if (inner.autoComplete && inner.pending === context) {
              inner.pending = null;
              context.complete(inner.result);
            }
          }
        });
      } catch (error) {
        // A reserved built-in name is the case this catches, and it must be loud: the
        // author believes they have handled an action type and they have not.
        internal.error = String((error as Error)?.message || error);
        this.flagOutputDirty('error');
        this.flagOutputDirty('registered');
        this.raiseRuntimeError(HANDLER_ERROR_CODE, internal.error);
        return;
      }

      if (internal.error) {
        internal.error = '';
        this.flagOutputDirty('error');
      }
      this.flagOutputDirty('registered');
    },

    teardownRegistration(this: NodeInstance) {
      const internal = internalOf(this);
      if (internal.unregister) {
        internal.unregister();
        internal.unregister = null;
      }
    },

    doComplete(this: NodeInstance, token: OutcomeToken) {
      const internal = internalOf(this);
      const pending = internal.pending;
      if (!pending) {
        (this as never as { reportFailure(m: string, t: OutcomeToken): void }).reportFailure(
          'Complete was signalled with no action in flight',
          token
        );
        return;
      }
      internal.pending = null;
      pending.complete(internal.result);
      // Last, after the dispatcher has been told: the outcome is the end of the action.
      this.reportOutcome(token, 'done');
    },

    doFail(this: NodeInstance, token: OutcomeToken) {
      const internal = internalOf(this);
      const pending = internal.pending;
      if (!pending) {
        (this as never as { reportFailure(m: string, t: OutcomeToken): void }).reportFailure(
          'Fail was signalled with no action in flight',
          token
        );
        return;
      }
      internal.pending = null;
      pending.fail(internal.errorMessage || `the handler for "${internal.actionType}" reported a failure`);
      // ⚠️ `done`, not `failure`. The node was asked to report a failure and did exactly that.
      this.reportOutcome(token, 'done');
    },

    /**
     * The node was asked to act and could not. Reports on all three channels the Failure
     * Contract asks for: the `error` string, the `Failure` signal, and the runtime error bus,
     * which is what reaches `On App Error` in a deployed build with no editor watching.
     */
    reportFailure(this: NodeInstance, message: string, token: OutcomeToken) {
      internalOf(this).error = message;
      this.flagOutputDirty('error');
      // ERG-001 §4: `reportOutcome` raises on the bus and then sends `Failure` and `Completed`,
      // so the three channels the Failure Contract asks for are still all served — from one
      // place, in the contract's order.
      this.reportOutcome(token, 'failure', { code: HANDLER_ERROR_CODE, message });
    },

    /**
     * A handler deleted mid-action fails that action rather than letting it sit until the
     * dispatcher's timeout: the queue behind it should not be stalled for thirty seconds
     * by a component that has been navigated away from.
     */
    _onNodeDeleted(this: NodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      const internal = internalOf(this);
      const pending = internal.pending;
      internal.pending = null;
      if (pending) pending.fail(`the handler for "${internal.actionType}" was removed before it completed`);
      (this as never as { teardownRegistration(): void }).teardownRegistration();
    }
  }
};

export = {
  node: ActionHandlerNode
};
