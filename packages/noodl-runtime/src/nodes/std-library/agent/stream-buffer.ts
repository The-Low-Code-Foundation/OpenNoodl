/**
 * Stream Buffer node (AGENT-007).
 *
 * Batches items arriving faster than the UI wants to react. A token stream can emit
 * hundreds of frames a second; a Repeater rebuilt on each one is the difference
 * between a smooth chat surface and a janky one. Add items as they arrive, flush on a
 * count, on an interval, or on demand.
 *
 * The interval timer is the one piece of state in the AGENT-007 set that can outlive
 * the node, so it is cleared in `_onNodeDeleted` and on every configuration change,
 * and the timer functions are injectable so a test can prove no timer survives
 * teardown.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type { NodeDefinitionOptions, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';

import type { BufferInternal, StreamBufferNodeInstance } from './node-instances';

import Node = require('../../../node');

function internalOf(node: StreamBufferNodeInstance): BufferInternal {
  return node._internal;
}

const StreamBufferNode: NodeDefinitionOptions = {
  name: 'net.noodl.StreamBuffer',
  displayNodeName: 'Stream Buffer',
  category: 'Data',
  color: 'data',
  docs: 'https://docs.noodl.net/nodes/data/stream-buffer',
  searchTags: ['buffer', 'batch', 'throttle', 'stream', 'queue', 'flush', 'debounce', 'agent', 'streaming'],

  // The interval flush depends on timers, which never advance during a server render.
  // Manual and size-based flushes work, so this is `partial`, not `client-only`.
  ssr: {
    compat: 'partial',
    note: 'Interval-based flushing needs a running timer, so it only happens in the browser. Add, Flush and size-based flushing behave normally.'
  },

  initialize(this: StreamBufferNodeInstance) {
    const internal = internalOf(this);
    internal.pendingData = undefined;
    internal.hasPendingData = false;
    internal.buffer = [];
    internal.flushedData = [];
    internal.flushCount = 0;
    internal.droppedItems = 0;
    internal.flushSize = 0;
    internal.flushInterval = 0;
    internal.maxSize = 10000;
    internal.timer = null;
    internal.seams = {};
  },

  getInspectInfo(this: StreamBufferNodeInstance) {
    const internal = internalOf(this);
    return {
      type: 'value',
      value: {
        buffered: internal.buffer.length,
        flushes: internal.flushCount,
        lastFlushSize: internal.flushedData.length,
        droppedItems: internal.droppedItems,
        intervalRunning: internal.timer !== null
      }
    };
  },

  inputs: {
    data: {
      type: '*',
      displayName: 'Data',
      description: 'The next item to buffer, of any type; its value is retained between pulses of Add',
      group: 'Data',
      set(this: StreamBufferNodeInstance, value: unknown) {
        const internal = internalOf(this);
        internal.pendingData = value;
        internal.hasPendingData = true;
      }
    },

    flushSize: {
      type: 'number',
      default: 0,
      displayName: 'Flush Size',
      description: 'Flush automatically once this many items are buffered; 0 disables size-based flushing',
      group: 'Config',
      tooltip: 'Flush automatically once this many items are buffered. 0 disables size-based flushing.',
      set(this: StreamBufferNodeInstance, value: number) {
        internalOf(this).flushSize = Number(value) > 0 ? Number(value) : 0;
      }
    },

    flushInterval: {
      type: 'number',
      default: 0,
      displayName: 'Flush Interval (ms)',
      description:
        'Flush automatically this often in milliseconds while items are buffered; 0 disables interval flushing',
      group: 'Config',
      tooltip: 'Flush automatically this often while items are buffered. 0 disables interval flushing.',
      set(this: StreamBufferNodeInstance, value: number) {
        const internal = internalOf(this);
        const next = Number(value) > 0 ? Number(value) : 0;
        if (next === internal.flushInterval) return;
        internal.flushInterval = next;
        // Re-arm rather than leave a timer running at the old period.
        this.stopTimer();
        if (internal.buffer.length > 0) this.armTimer();
      }
    },

    maxSize: {
      type: 'number',
      default: 10000,
      displayName: 'Max Size',
      description:
        'Hard cap on buffered items; overflow drops the oldest and is counted on Dropped Items; 0 means no cap',
      group: 'Config',
      tooltip:
        'Hard cap on buffered items. Overflow drops the oldest and is reported on Dropped Items. 0 means no cap.',
      set(this: StreamBufferNodeInstance, value: number) {
        internalOf(this).maxSize = Number(value) >= 0 ? Number(value) : 0;
      }
    },

    add: {
      displayName: 'Add',
      description: 'Buffers the current Data, flushing straight away if that reaches Flush Size',
      group: 'Actions',
      valueChangedToTrue(this: StreamBufferNodeInstance) {
        // ERG-001 §4. Only the ports mint; the interval timer's own flush is not an invocation.
        this.addItem(this.beginOutcome());
      }
    },

    flush: {
      displayName: 'Flush',
      description: 'Hands the whole buffer to Flushed Data now; an empty buffer is a legitimate no-op',
      group: 'Actions',
      valueChangedToTrue(this: StreamBufferNodeInstance) {
        this.doFlush(this.beginOutcome());
      }
    },

    clear: {
      displayName: 'Clear',
      description: 'Discards the buffer and resets both counters without flushing',
      group: 'Actions',
      valueChangedToTrue(this: StreamBufferNodeInstance) {
        this.clearBuffer(this.beginOutcome());
      }
    }
  },

  outputs: {
    buffer: {
      type: 'array',
      displayName: 'Buffer',
      description: 'Items waiting to be flushed, oldest first',
      group: 'Data',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).buffer;
      }
    },
    bufferSize: {
      type: 'number',
      displayName: 'Buffer Size',
      description: 'How many items are waiting, which is what Flush Size is compared against',
      group: 'Status',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).buffer.length;
      }
    },
    flushedData: {
      type: 'array',
      displayName: 'Flushed Data',
      description: 'The batch handed over by the most recent flush; a stable array that later Adds do not mutate',
      group: 'Data',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).flushedData;
      }
    },
    flushCount: {
      type: 'number',
      displayName: 'Flush Count',
      description: 'How many flushes have happened since the last Clear',
      group: 'Status',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).flushCount;
      }
    },
    droppedItems: {
      type: 'number',
      displayName: 'Dropped Items',
      description: 'How many items Max Size has discarded from the front since the last Clear',
      group: 'Status',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).droppedItems;
      }
    },

    flushed: {
      type: 'signal',
      displayName: 'Flushed',
      description: 'Fires once Flushed Data holds a new batch, and not for a flush that found nothing',
      group: 'Events'
    },
    overflowed: {
      type: 'signal',
      displayName: 'Overflowed',
      description: 'Fires when Max Size has just discarded something',
      group: 'Events'
    },
    cleared: {
      type: 'signal',
      displayName: 'Cleared',
      description: 'Fires once the buffer has been discarded',
      group: 'Events'
    },
    /**
     * ERG-001 §4. `Flushed`, `Overflowed` and `Cleared` are all kept: each is a *value-level*
     * announcement about a specific piece of state, and `Overflowed` in particular fires from
     * inside an `Add` that otherwise succeeded, so none of them is this invocation's outcome.
     * The interval timer also flushes on its own, which is a path nobody invoked.
     *
     * `Unchanged` is earned twice: a `Flush` that found nothing (the source already called that
     * "a legitimate no-op" and the port descriptions say so), and a `Clear` with nothing to
     * clear. Neither raises.
     *
     * NDA-004 §2's `Failure` is folded in — `Add` is an author `Do` (group `Actions`), so it
     * cannot fire on the boot path, and `reportFailure` has no caller but `addItem`.
     */
    ...outcomeOutputs({
      done: 'Fires once an Add, Flush or Clear you triggered has changed the buffer',
      unchanged: 'Fires when a Flush found nothing to send, or a Clear found nothing to discard — an idle buffer doing exactly what it should',
      failure: 'Fires when Add ran before any value had arrived on Data, so nothing was buffered'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last Add was refused; blank until one is',
      group: 'Events',
      getter(this: StreamBufferNodeInstance) {
        return internalOf(this).lastError;
      }
    }
  },

  methods: {
    /**
     * NDA-004 §2. `Add` with nothing on `Data` returned bare — no item buffered, no signal, no
     * console line, nothing anywhere. From the canvas that is indistinguishable from a buffer
     * that is working, right up until a `Flush` produces less than the author expected.
     *
     * `hasPendingData` is set by the `data` setter and never cleared, so this is only false
     * before the *first* value has ever arrived: an `Add` wired ahead of its data, or a `Data`
     * input left unconnected. Both are configuration mistakes, not states the graph passes
     * through — `Add` is an author `Do`, so nothing here fires while the graph boots.
     *
     * Not reported: `Flush` on an empty buffer, and `Clear` on an empty buffer. Both are
     * legitimate empty results — a timed flush with nothing to send is exactly what an idle
     * buffer should do — and the contract lists those among the things that must *not* raise.
     * Open File Picker's `Cancelled` question, asked and answered the other way.
     */
    addItem(this: StreamBufferNodeInstance, token?: OutcomeToken) {
      const internal = internalOf(this);
      if (!internal.hasPendingData) {
        return this.reportFailure(
          'stream-buffer/no-data',
          'Nothing to add — no value has arrived on the Data input',
          token
        );
      }

      internal.buffer.push(internal.pendingData);

      if (internal.maxSize > 0 && internal.buffer.length > internal.maxSize) {
        const dropped = internal.buffer.length - internal.maxSize;
        internal.buffer.splice(0, dropped);
        internal.droppedItems += dropped;
        this.flagOutputDirty('droppedItems');
        this.sendSignalOnOutput('overflowed');
      }

      this.flagOutputDirty('buffer');
      this.flagOutputDirty('bufferSize');

      if (internal.flushSize > 0 && internal.buffer.length >= internal.flushSize) {
        // One invocation: the `Add` that filled the buffer owns the flush it triggered, so the
        // token travels with it rather than being settled here and again inside `doFlush`.
        this.doFlush(token);
        return;
      }
      this.armTimer();
      if (token) this.reportOutcome(token, 'done');
    },

    reportFailure(this: StreamBufferNodeInstance, code: string, message: string, token?: OutcomeToken) {
      internalOf(this).lastError = message;
      this.flagOutputDirty('error');
      if (token) {
        this.reportOutcome(token, 'failure', { code, message });
      } else {
        this.raiseRuntimeError(code, message);
        this.sendSignalOnOutput('failure');
      }
    },

    doFlush(this: StreamBufferNodeInstance, token?: OutcomeToken) {
      const internal = internalOf(this);
      this.stopTimer();
      if (internal.buffer.length === 0) {
        // ERG-001 §4. Was a bare `return`, and it is the one branch on this node the contract's
        // `Unchanged` was written for: a timed flush with nothing to send is exactly what an
        // idle buffer should do, so it is neither a `Done` that lies nor a `Failure` that fires
        // on a correct graph.
        if (token) this.reportOutcome(token, 'unchanged');
        return;
      }

      // A fresh array: handing out the live buffer would let a downstream node see it
      // mutate under it on the next Add.
      internal.flushedData = internal.buffer;
      internal.buffer = [];
      internal.flushCount++;

      this.flagOutputDirty('flushedData');
      this.flagOutputDirty('buffer');
      this.flagOutputDirty('bufferSize');
      this.flagOutputDirty('flushCount');
      this.sendSignalOnOutput('flushed');
      if (token) this.reportOutcome(token, 'done');
    },

    clearBuffer(this: StreamBufferNodeInstance, token?: OutcomeToken) {
      const internal = internalOf(this);
      this.stopTimer();
      // Read before the reset, not after: an outcome inferred from state a branch has already
      // changed is the defect the JSON parser's runaway-buffer branch introduced.
      const hadSomethingToClear =
        internal.buffer.length > 0 ||
        internal.flushedData.length > 0 ||
        internal.droppedItems > 0 ||
        internal.flushCount > 0;
      internal.buffer = [];
      internal.flushedData = [];
      internal.droppedItems = 0;
      internal.flushCount = 0;

      this.flagOutputDirty('buffer');
      this.flagOutputDirty('bufferSize');
      this.flagOutputDirty('flushedData');
      this.flagOutputDirty('flushCount');
      this.flagOutputDirty('droppedItems');
      this.sendSignalOnOutput('cleared');
      if (token) this.reportOutcome(token, hadSomethingToClear ? 'done' : 'unchanged');
    },

    armTimer(this: StreamBufferNodeInstance) {
      const internal = internalOf(this);
      if (internal.flushInterval <= 0) return;
      if (internal.timer !== null) return;
      const setTimeoutImpl = internal.seams.setTimeoutImpl || ((fn: () => void, ms: number) => setTimeout(fn, ms));
      internal.timer = setTimeoutImpl(() => {
        internal.timer = null;
        this.doFlush();
      }, internal.flushInterval);
    },

    stopTimer(this: StreamBufferNodeInstance) {
      const internal = internalOf(this);
      if (internal.timer === null) return;
      const clearTimeoutImpl = internal.seams.clearTimeoutImpl || ((h: unknown) => clearTimeout(h as never));
      clearTimeoutImpl(internal.timer);
      internal.timer = null;
    },

    _onNodeDeleted(this: StreamBufferNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.stopTimer();
      const internal = internalOf(this);
      internal.buffer = [];
      internal.flushedData = [];
    }
  }
};

export = {
  node: StreamBufferNode
};
