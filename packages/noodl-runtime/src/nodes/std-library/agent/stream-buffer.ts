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

import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

import Node = require('../../../node');

/** See the note on SseNodeSeams: production leaves this empty, tests overwrite it. */
interface StreamBufferSeams {
  setTimeoutImpl?: (fn: () => void, ms: number) => any;
  clearTimeoutImpl?: (handle: any) => void;
}

interface BufferInternal {
  pendingData: unknown;
  hasPendingData: boolean;
  buffer: unknown[];
  flushedData: unknown[];
  flushCount: number;
  droppedItems: number;
  flushSize: number;
  flushInterval: number;
  maxSize: number;
  timer: any;
  seams: StreamBufferSeams;
}

function internalOf(node: NodeInstance): BufferInternal {
  return node._internal as unknown as BufferInternal;
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

  initialize(this: NodeInstance) {
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

  getInspectInfo(this: NodeInstance) {
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
      set(this: NodeInstance, value: unknown) {
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
      set(this: NodeInstance, value: number) {
        internalOf(this).flushSize = Number(value) > 0 ? Number(value) : 0;
      }
    },

    flushInterval: {
      type: 'number',
      default: 0,
      displayName: 'Flush Interval (ms)',
      group: 'Config',
      tooltip: 'Flush automatically this often while items are buffered. 0 disables interval flushing.',
      set(this: NodeInstance, value: number) {
        const internal = internalOf(this);
        const next = Number(value) > 0 ? Number(value) : 0;
        if (next === internal.flushInterval) return;
        internal.flushInterval = next;
        // Re-arm rather than leave a timer running at the old period.
        (this as any).stopTimer();
        if (internal.buffer.length > 0) (this as any).armTimer();
      }
    },

    maxSize: {
      type: 'number',
      default: 10000,
      displayName: 'Max Size',
      group: 'Config',
      tooltip: 'Hard cap on buffered items. Overflow drops the oldest and is reported on Dropped Items. 0 means no cap.',
      set(this: NodeInstance, value: number) {
        internalOf(this).maxSize = Number(value) >= 0 ? Number(value) : 0;
      }
    },

    add: {
      displayName: 'Add',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).addItem();
      }
    },

    flush: {
      displayName: 'Flush',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).doFlush();
      }
    },

    clear: {
      displayName: 'Clear',
      group: 'Actions',
      valueChangedToTrue(this: NodeInstance) {
        (this as any).clearBuffer();
      }
    }
  },

  outputs: {
    buffer: {
      type: 'array',
      displayName: 'Buffer',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).buffer;
      }
    },
    bufferSize: {
      type: 'number',
      displayName: 'Buffer Size',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).buffer.length;
      }
    },
    flushedData: {
      type: 'array',
      displayName: 'Flushed Data',
      group: 'Data',
      get(this: NodeInstance) {
        return internalOf(this).flushedData;
      }
    },
    flushCount: {
      type: 'number',
      displayName: 'Flush Count',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).flushCount;
      }
    },
    droppedItems: {
      type: 'number',
      displayName: 'Dropped Items',
      group: 'Status',
      get(this: NodeInstance) {
        return internalOf(this).droppedItems;
      }
    },

    flushed: { type: 'signal', displayName: 'Flushed', group: 'Events' },
    overflowed: { type: 'signal', displayName: 'Overflowed', group: 'Events' },
    cleared: { type: 'signal', displayName: 'Cleared', group: 'Events' }
  },

  methods: {
    addItem(this: NodeInstance) {
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
        (this as any).doFlush();
        return;
      }
      (this as any).armTimer();
    },

    doFlush(this: NodeInstance) {
      const internal = internalOf(this);
      (this as any).stopTimer();
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

    clearBuffer(this: NodeInstance) {
      const internal = internalOf(this);
      (this as any).stopTimer();
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

    armTimer(this: NodeInstance) {
      const internal = internalOf(this);
      if (internal.flushInterval <= 0) return;
      if (internal.timer !== null) return;
      const setTimeoutImpl = internal.seams.setTimeoutImpl || ((fn: () => void, ms: number) => setTimeout(fn, ms));
      internal.timer = setTimeoutImpl(() => {
        internal.timer = null;
        (this as any).doFlush();
      }, internal.flushInterval);
    },

    stopTimer(this: NodeInstance) {
      const internal = internalOf(this);
      if (internal.timer === null) return;
      const clearTimeoutImpl = internal.seams.clearTimeoutImpl || ((h: any) => clearTimeout(h));
      clearTimeoutImpl(internal.timer);
      internal.timer = null;
    },

    _onNodeDeleted(this: NodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      (this as any).stopTimer();
      const internal = internalOf(this);
      internal.buffer = [];
      internal.flushedData = [];
    }
  }
};

export = {
  node: StreamBufferNode
};
