'use strict';

/**
 * Action Dispatcher (AGENT-005) — executes actions a backend sent, and refuses the rest.
 *
 * The node is a shell over `ActionDispatcher`; the vocabulary rules, ordering and
 * lifecycle live there and are documented there. This file's job is to make all of it
 * *visible in the graph*: what was dispatched, what completed, what failed, and — the
 * output that matters most for a node a remote server can talk to — what was **refused
 * and why**.
 *
 * Wiring, in the common case:
 *
 *     [Server-Sent Events]  data ──▶ action
 *                      onMessage ──▶ dispatch
 *
 * @module noodl-runtime
 * @since 2.0.0
 */
import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import {
  ActionDispatcher,
  ActionDispatcherOptions,
  ActionInfo,
  BUILT_IN_ACTIONS,
  DispatcherDeps,
  parseList,
  RefusalInfo
} from './action-dispatcher';

import Node = require('../../../node');

interface DispatcherInternal {
  options: ActionDispatcherOptions;
  dispatcher: ActionDispatcher | null;
  pendingAction: unknown;

  actionType: string;
  actionId: string;
  payload: unknown;
  result: unknown;
  lastError: string;
  refusedType: string;
  refusalReason: string;
  refusalMessage: string;

  completedCount: number;
  failedCount: number;
  refusedCount: number;
  cancelledCount: number;

  /** Test seam; production leaves it empty and the real timers are used. */
  deps: DispatcherDeps;
}

function internalOf(node: NodeInstance): DispatcherInternal {
  return node._internal as unknown as DispatcherInternal;
}

/** Creates the dispatcher on first use, so a node that is never dispatched to owns nothing. */
function dispatcherOf(node: NodeInstance): ActionDispatcher {
  const internal = internalOf(node);
  if (internal.dispatcher) return internal.dispatcher;

  internal.dispatcher = new ActionDispatcher(
    internal.options,
    {
      onDispatched(info: ActionInfo) {
        internal.actionType = info.actionType;
        internal.actionId = info.actionId;
        internal.payload = info.payload;
        node.flagOutputDirty('actionType');
        node.flagOutputDirty('actionId');
        node.flagOutputDirty('payload');
        node.flagOutputDirty('isExecuting');
        node.sendSignalOnOutput('dispatched');
      },

      onCompleted(info) {
        internal.result = info.result;
        node.flagOutputDirty('result');
        node.flagOutputDirty('isExecuting');
        node.sendSignalOnOutput('completed');
        internal.completedCount++;
        node.flagOutputDirty('completedCount');
      },

      onFailed(info) {
        internal.lastError = info.error;
        node.flagOutputDirty('lastError');
        node.flagOutputDirty('isExecuting');
        node.sendSignalOnOutput('failed');
        internal.failedCount++;
        node.flagOutputDirty('failedCount');
      },

      onRefused(info: RefusalInfo) {
        internal.refusedType = info.actionType;
        internal.refusalReason = info.reason;
        internal.refusalMessage = info.message;
        internal.lastError = info.message;
        internal.refusedCount++;
        // Values before the signal: a graph wired `refusalReason -> text`,
        // `refused -> show` must already hold the reason when the signal lands.
        node.flagOutputDirty('refusedType');
        node.flagOutputDirty('refusalReason');
        node.flagOutputDirty('refusalMessage');
        node.flagOutputDirty('lastError');
        node.flagOutputDirty('refusedCount');
        node.sendSignalOnOutput('refused');
      },

      onQueueChanged() {
        node.flagOutputDirty('queueSize');
        node.flagOutputDirty('waitingFor');
        node.flagOutputDirty('isExecuting');
      },

      onIdle() {
        node.sendSignalOnOutput('idle');
      }
    },
    internal.deps
  );

  return internal.dispatcher;
}

const ActionDispatcherNode: NodeDefinitionOptions = {
  name: 'net.noodl.ActionDispatcher',
  displayNodeName: 'Action Dispatcher',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'channel',
  searchTags: [
    'action',
    'dispatch',
    'command',
    'agent',
    'ai',
    'backend',
    'remote',
    'control',
    'workflow',
    'guided',
    'tour'
  ],

  initialize(this: NodeInstance) {
    const internal = internalOf(this);
    internal.options = {
      channel: 'default',
      storeName: 'app',
      builtIns: [],
      allowedKeys: [],
      handlerTimeout: 30000,
      waitForHandler: 2000,
      maxQueueSize: 100,
      rateLimit: 0,
      rateLimitWindow: 60000
    };
    internal.dispatcher = null;
    internal.pendingAction = undefined;

    internal.actionType = '';
    internal.actionId = '';
    internal.payload = undefined;
    internal.result = undefined;
    internal.lastError = '';
    internal.refusedType = '';
    internal.refusalReason = '';
    internal.refusalMessage = '';

    internal.completedCount = 0;
    internal.failedCount = 0;
    internal.refusedCount = 0;
    internal.cancelledCount = 0;

    internal.deps = {};
  },

  getInspectInfo(this: NodeInstance) {
    const internal = internalOf(this);
    const dispatcher = internal.dispatcher;
    return {
      type: 'value',
      value: {
        channel: internal.options.channel,
        enabledBuiltIns: internal.options.builtIns,
        lastAction: internal.actionType,
        queueSize: dispatcher ? dispatcher.queueSize : 0,
        waitingFor: dispatcher ? dispatcher.waitingFor : '',
        completed: internal.completedCount,
        failed: internal.failedCount,
        refused: internal.refusedCount,
        lastRefusal: internal.refusalReason ? internal.refusalReason + ': ' + internal.refusalMessage : ''
      }
    };
  },

  inputs: {
    channel: {
      type: 'string',
      default: 'default',
      displayName: 'Channel',
      description:
        'Names the handler registry this dispatcher draws on; leave it as default unless two independent flows must not see each other',
      group: 'Dispatcher',
      tooltip:
        'Names the handler registry this dispatcher draws on. Leave as "default" unless two independent flows must not see each other.',
      set(this: NodeInstance, value: string) {
        internalOf(this).options.channel =
          value === undefined || value === null || value === '' ? 'default' : String(value);
      }
    },

    action: {
      type: '*',
      displayName: 'Action',
      description: 'An action object, an array of them to run in order, or JSON text holding either',
      group: 'Action',
      tooltip: 'An action object, an array of them to run in order, or JSON text holding either.',
      set(this: NodeInstance, value: unknown) {
        internalOf(this).pendingAction = value;
      }
    },

    // -- built-in vocabulary ------------------------------------------------
    builtIns: {
      type: 'string',
      displayName: 'Enabled Built-ins',
      description:
        'Comma-separated built-in action names this dispatcher may execute; empty, the default, means a server cannot write to the store at all',
      group: 'Built-in Actions',
      tooltip:
        'Comma-separated built-in action names this dispatcher may execute: ' +
        BUILT_IN_ACTIONS.join(', ') +
        '. Empty — the default — means a server cannot write to the store at all; everything must go through an Action Handler you wired.',
      set(this: NodeInstance, value: string) {
        const requested = parseList(value);
        // Silently dropping a misspelt name would leave the author believing an action is
        // enabled when it is not, so unknown names are kept out of the allow-list and
        // reported. They can never grant anything: the dispatcher matches on this list.
        const unknown = requested.filter((name) => (BUILT_IN_ACTIONS as readonly string[]).indexOf(name) === -1);
        internalOf(this).options.builtIns = requested.filter(
          (name) => (BUILT_IN_ACTIONS as readonly string[]).indexOf(name) !== -1
        );
        if (unknown.length > 0) {
          internalOf(this).lastError = 'Not built-in action names, so not enabled: ' + unknown.join(', ');
          this.flagOutputDirty('lastError');
        }
      }
    },

    storeName: {
      type: 'string',
      default: 'app',
      displayName: 'Store Name',
      description: 'The only store the built-in actions can write; a store named inside an incoming action is ignored',
      group: 'Built-in Actions',
      tooltip:
        'The only store the built-in actions can write. A store named inside an incoming action is ignored — the graph chooses the store, not the server.',
      set(this: NodeInstance, value: string) {
        internalOf(this).options.storeName =
          value === undefined || value === null || value === '' ? 'app' : String(value);
      }
    },

    allowedKeys: {
      type: 'string',
      displayName: 'Allowed Keys',
      description:
        'Comma-separated keys the built-in store actions may write; blank means any key, and setting any key also refuses CLEAR_STORE',
      group: 'Built-in Actions',
      tooltip:
        'Comma-separated keys the built-in store actions may write. Blank means any key of the configured store. Setting any key also refuses CLEAR_STORE.',
      set(this: NodeInstance, value: string) {
        internalOf(this).options.allowedKeys = parseList(value);
      }
    },

    // -- delivery -----------------------------------------------------------
    handlerTimeout: {
      type: 'number',
      default: 30000,
      displayName: 'Handler Timeout (ms)',
      description: 'Milliseconds a handler has to signal Complete or Fail before the action is failed; 0 waits forever',
      group: 'Delivery',
      tooltip: 'How long a handler has to signal Complete or Fail before the action is failed. 0 waits forever.',
      set(this: NodeInstance, value: number) {
        internalOf(this).options.handlerTimeout = Number(value) >= 0 ? Number(value) : 30000;
      }
    },

    waitForHandler: {
      type: 'number',
      default: 2000,
      displayName: 'Wait For Handler (ms)',
      description:
        'Milliseconds an action waits for its handler to appear before being refused as unknown; everything behind it waits too',
      group: 'Delivery',
      tooltip:
        'How long an action waits for its handler to appear before being refused as unknown — the window in which a component can still mount. 0 refuses immediately. Everything behind it waits too, because order is preserved.',
      set(this: NodeInstance, value: number) {
        internalOf(this).options.waitForHandler = Number(value) >= 0 ? Number(value) : 2000;
      }
    },

    maxQueueSize: {
      type: 'number',
      default: 100,
      displayName: 'Max Queue Size',
      description:
        'Bound on queued actions; overflow refuses the newest so accepted actions keep their order; 0 is unbounded',
      group: 'Delivery',
      tooltip:
        'Bound on queued actions. Overflow refuses the newest so accepted actions keep their order. 0 is unbounded.',
      set(this: NodeInstance, value: number) {
        internalOf(this).options.maxQueueSize = Number(value) >= 0 ? Number(value) : 100;
      }
    },

    rateLimit: {
      type: 'number',
      default: 0,
      displayName: 'Rate Limit',
      description: 'Actions executed per window before the rest are refused rather than delayed; 0 is unlimited',
      group: 'Delivery',
      tooltip: 'Max actions executed per window. 0 is unlimited. Excess actions are refused, not delayed.',
      set(this: NodeInstance, value: number) {
        internalOf(this).options.rateLimit = Number(value) >= 0 ? Number(value) : 0;
      }
    },

    rateLimitWindow: {
      type: 'number',
      default: 60000,
      displayName: 'Rate Limit Window (ms)',
      description: 'Length of the rate-limit window in milliseconds; ignored unless Rate Limit is set',
      group: 'Delivery',
      set(this: NodeInstance, value: number) {
        internalOf(this).options.rateLimitWindow = Number(value) > 0 ? Number(value) : 60000;
      }
    },

    // -- signals ------------------------------------------------------------
    dispatch: {
      displayName: 'Dispatch',
      description: 'Admits whatever is on Action and runs it, or refuses it with a reason',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as never as { doDispatch(): void }).doDispatch();
      }
    },

    cancel: {
      displayName: 'Cancel All',
      description: 'Discards everything queued and abandons anything in flight, reporting how many were dropped',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as never as { doCancel(): void }).doCancel();
      }
    }
  },

  outputs: {
    // -- what is happening --------------------------------------------------
    actionType: {
      type: 'string',
      displayName: 'Action Type',
      description: 'Type of the action currently being executed',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).actionType;
      }
    },
    actionId: {
      type: 'string',
      displayName: 'Action Id',
      description: 'Id of the action currently being executed, taken from the message when it carried one',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).actionId;
      }
    },
    payload: {
      type: '*',
      displayName: 'Payload',
      description:
        'The data the current action carried, taken from its payload or data field, or the whole action when it has neither',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).payload;
      }
    },
    result: {
      type: '*',
      displayName: 'Result',
      description: 'What the handler or built-in returned for the action that just completed',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).result;
      }
    },

    dispatched: {
      type: 'signal',
      displayName: 'Dispatched',
      description: 'Fires when an action has been accepted and is about to run',
      group: 'Events'
    },
    completed: {
      type: 'signal',
      displayName: 'Completed',
      description: 'Fires once an action has finished and Result holds its answer',
      group: 'Events'
    },
    failed: {
      type: 'signal',
      displayName: 'Failed',
      description:
        'Fires when an accepted action ran and did not succeed, whether the handler said so or the deadline passed',
      group: 'Events'
    },
    idle: {
      type: 'signal',
      displayName: 'Idle',
      description: 'Fires when the queue has drained after doing at least one thing',
      group: 'Events'
    },

    // -- refusals: the security-visible path --------------------------------
    refused: {
      type: 'signal',
      displayName: 'Refused',
      description:
        'Fires when an action was not run at all, which is the output to watch for anything a server can talk to',
      group: 'Refusals'
    },
    refusedType: {
      type: 'string',
      displayName: 'Refused Type',
      description: 'Type of the refused action, or blank when the message was too malformed to have one',
      group: 'Refusals',
      get(this: NodeInstance) {
        return internalOf(this).refusedType;
      }
    },
    refusalReason: {
      type: 'string',
      displayName: 'Refusal Reason',
      description: 'Why it was refused, as one of invalid, unknown, not-allowed, rate-limited or queue-full',
      group: 'Refusals',
      get(this: NodeInstance) {
        return internalOf(this).refusalReason;
      }
    },
    refusalMessage: {
      type: 'string',
      displayName: 'Refusal Message',
      description: 'The refusal in a sentence an app author can show or log',
      group: 'Refusals',
      get(this: NodeInstance) {
        return internalOf(this).refusalMessage;
      }
    },

    // -- status -------------------------------------------------------------
    lastError: {
      type: 'string',
      displayName: 'Last Error',
      description: 'The most recent failure or refusal, whichever happened last',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).lastError;
      }
    },
    queueSize: {
      type: 'number',
      displayName: 'Queue Size',
      description: 'How many actions are waiting behind the one being executed',
      group: 'Status',
      get(this: NodeInstance) {
        const dispatcher = internalOf(this).dispatcher;
        return dispatcher ? dispatcher.queueSize : 0;
      }
    },
    isExecuting: {
      type: 'boolean',
      displayName: 'Is Executing',
      description: 'True while an action is running, which is the cue for a busy indicator',
      group: 'Status',
      get(this: NodeInstance) {
        const dispatcher = internalOf(this).dispatcher;
        return dispatcher ? dispatcher.isExecuting : false;
      }
    },
    /** The action type held at the head of the queue because no handler has registered yet. */
    waitingFor: {
      type: 'string',
      displayName: 'Waiting For',
      description:
        'Action type holding the head of the queue because its handler has not registered yet; blank when nothing is waiting',
      group: 'Status',
      get(this: NodeInstance) {
        const dispatcher = internalOf(this).dispatcher;
        return dispatcher ? dispatcher.waitingFor : '';
      }
    },
    completedCount: {
      type: 'number',
      displayName: 'Completed Count',
      description: 'How many actions have completed since the page loaded',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).completedCount;
      }
    },
    failedCount: {
      type: 'number',
      displayName: 'Failed Count',
      description: 'How many accepted actions have failed since the page loaded',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).failedCount;
      }
    },
    refusedCount: {
      type: 'number',
      displayName: 'Refused Count',
      description: 'How many actions have been refused since the page loaded',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).refusedCount;
      }
    },
    cancelledCount: {
      type: 'number',
      displayName: 'Cancelled Count',
      description: 'How many actions Cancel All has discarded since the page loaded',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).cancelledCount;
      }
    },
    cancelled: {
      type: 'signal',
      displayName: 'Cancelled',
      description: 'Fires once Cancel All has emptied the queue',
      group: 'Events'
    }
  },

  methods: {
    /**
     * Dispatches immediately rather than through `scheduleAfterInputsHaveUpdated`.
     *
     * Every other node in this family defers, because inputs and signals arrive in one
     * frame in no guaranteed order. Deferring here would be wrong: a stream can deliver
     * several messages in a single frame, and a coalesced schedule would run the *last*
     * one and silently drop the rest — the exact ordering bug this node exists to avoid.
     * Acting on the signal is safe because `flagOutputDirty` queues a value onto the
     * connected input *before* `sendSignalOnOutput` fires, so the action that belongs to
     * this pulse has already landed. This is the same choice Text Accumulator makes for
     * its `add` signal.
     */
    doDispatch(this: NodeInstance) {
      const internal = internalOf(this);
      dispatcherOf(this).dispatch(internal.pendingAction);
    },

    doCancel(this: NodeInstance) {
      const internal = internalOf(this);
      if (!internal.dispatcher) return;
      const dropped = internal.dispatcher.cancelAll();
      internal.cancelledCount += dropped;
      this.flagOutputDirty('cancelledCount');
      this.flagOutputDirty('queueSize');
      this.flagOutputDirty('waitingFor');
      this.flagOutputDirty('isExecuting');
      this.sendSignalOnOutput('cancelled');
    },

    /**
     * Queued actions are discarded on delete rather than run to completion: the outputs
     * that would have reported them are going away with the node, and executing UI
     * actions into a component the user has navigated away from is worse than dropping
     * them. What must not survive is a timer or a registry listener, and neither does.
     */
    _onNodeDeleted(this: NodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      const internal = internalOf(this);
      if (internal.dispatcher) {
        internal.dispatcher.dispose();
        internal.dispatcher = null;
      }
    }
  }
};

export = {
  node: ActionDispatcherNode
};
