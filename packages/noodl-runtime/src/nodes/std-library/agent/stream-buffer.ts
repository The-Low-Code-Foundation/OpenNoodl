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

import type { NodeDefinitionOptions } from '@noodl/types';

import type { BufferInternal, StreamBufferNodeInstance } from './node-instances';

import Node = require('../../../node');

function internalOf(node: StreamBufferNodeInstance): BufferInternal {
  return node._internal;
}

const StreamBufferNode: NodeDefinitionOptions = {
  name: 'net.noodl.StreamBuffer',
  displayNodeName: 'Stream Buffer',
  shortDesc: 'Batches items from a stream and flushes them on a count, an interval, or on demand.',
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
      group: 'Config',
      tooltip: 'Hard cap on buffered items. Overflow drops the oldest and is reported on Dropped Items. 0 means no cap.',
      set(this: StreamBufferNodeInstance, value: number) {
        internalOf(this).maxSize = Number(value) >= 0 ? Number(value) : 0;
      }
    },

    add: {
      displayName: 'Add',
      group: 'Actions',
      valueChangedToTrue(this: StreamBufferNodeInstance) {
        this.addItem();
      }
    },

    flush: {
      displayName: 'Flush',
      group: 'Actions',
      valueChangedToTrue(this: StreamBufferNodeInstance) {
        this.doFlush();
      }
    },

    clear: {
      displayName: 'Clear',
      group: 'Actions',
      valueChangedToTrue(this: StreamBufferNodeInstance) {
        this.clearBuffer();
      }
    }
  },

  outputs: {
    buffer: {
      type: 'array',
      displayName: 'Buffer',
      group: 'Data',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).buffer;
      }
    },
    bufferSize: {
      type: 'number',
      displayName: 'Buffer Size',
      group: 'Status',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).buffer.length;
      }
    },
    flushedData: {
      type: 'array',
      displayName: 'Flushed Data',
      group: 'Data',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).flushedData;
      }
    },
    flushCount: {
      type: 'number',
      displayName: 'Flush Count',
      group: 'Status',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).flushCount;
      }
    },
    droppedItems: {
      type: 'number',
      displayName: 'Dropped Items',
      group: 'Status',
      get(this: StreamBufferNodeInstance) {
        return internalOf(this).droppedItems;
      }
    },

    flushed: { type: 'signal', displayName: 'Flushed', group: 'Events' },
    overflowed: { type: 'signal', displayName: 'Overflowed', group: 'Events' },
    cleared: { type: 'signal', displayName: 'Cleared', group: 'Events' }
  },

  methods: {
    addItem(this: StreamBufferNodeInstance) {
      const internal = internalOf(this);
      if (!internal.hasPendingData) return;

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
        this.doFlush();
        return;
      }
      this.armTimer();
    },

    doFlush(this: StreamBufferNodeInstance) {
      const internal = internalOf(this);
      this.stopTimer();
      if (internal.buffer.length === 0) return;

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
    },

    clearBuffer(this: StreamBufferNodeInstance) {
      const internal = internalOf(this);
      this.stopTimer();
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
