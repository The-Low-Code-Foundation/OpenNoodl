'use strict';

/**
 * Now (CWF-011 slice 1) — what time is it.
 *
 * ## ⚠️ CWF-011's stated mechanism was wrong, and following it would have shipped 1970
 *
 * The task said: *"the runtime has a platform hook for this: `platform.getCurrentTime()` … Use
 * the hook, not `Date.now()`"*. It is not a wall clock. In the browser it is
 * **`window.performance.now()`** (`noodl-viewer-react.js`) — milliseconds since the page loaded,
 * so `new Date(getCurrentTime())` is a moment in January 1970 that drifts forward as the tab
 * stays open. On the SSR server and in the catalog generators it is `() => 0`. Only the cloud
 * runner happens to pass epoch milliseconds. The hook is the *frame* clock: `currentFrameTime`,
 * animation timing and the editor-connection send throttle are its callers.
 *
 * So this node uses `Date.now()`, which is the same clock in all three runtimes and is what
 * `jest.useFakeTimers().setSystemTime(...)` controls — the determinism the task wanted, from the
 * mechanism that actually has it.
 *
 * Three outputs rather than one, because the answer leaves the graph in three shapes: a `Date`
 * for the other date nodes, epoch milliseconds for arithmetic and storage, and an ISO string for
 * a JSON body.
 */

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';

interface NowNodeInstance extends NodeInstance {
  _internal: {
    now: Date;
  };
  _read(token?: unknown): void;
}

const NowNode: NodeDefinitionOptions = {
  name: 'net.noodl.Now',
  displayNodeName: 'Now',
  docs: 'https://docs.noodl.net/nodes/utilities/now',
  category: 'Utilities',
  color: 'data',
  /** Read once at creation so the outputs are never empty before the first Read. */
  initialize: function (this: NowNodeInstance) {
    this._internal.now = new Date(Date.now());
  },
  getInspectInfo(this: NowNodeInstance): InspectInfo {
    return this._internal.now.toISOString();
  },
  inputs: {
    read: {
      type: 'signal',
      displayName: 'Read',
      group: 'Actions',
      description: 'Re-reads the clock. The outputs hold the instant of the last Read, not a live value',
      valueChangedToTrue: function (this: NowNodeInstance) {
        this._read(this.beginOutcome());
      }
    }
  },
  outputs: {
    date: {
      type: 'date',
      displayName: 'Date',
      group: 'Value',
      description: 'The instant of the last Read, for the other date nodes',
      getter: function (this: NowNodeInstance) {
        return this._internal.now;
      }
    },
    timestamp: {
      type: 'number',
      displayName: 'Timestamp',
      group: 'Value',
      description: 'The same instant as milliseconds since 1 January 1970 UTC',
      getter: function (this: NowNodeInstance) {
        return this._internal.now.getTime();
      }
    },
    iso: {
      type: 'string',
      displayName: 'ISO String',
      group: 'Value',
      description: 'The same instant as an ISO-8601 string in UTC — the shape to put in a JSON body',
      getter: function (this: NowNodeInstance) {
        return this._internal.now.toISOString();
      }
    },
    // No `Failure`: reading the clock cannot fail. No `Unchanged`: two Reads in the same
    // millisecond still re-read; there is no branch where the node declines to do the work.
    ...outcomeOutputs({ done: 'Fires once the outputs hold the freshly-read instant' })
  },
  methods: {
    _read: function (this: NowNodeInstance, token?: unknown) {
      // ⚠️ `new Date(Date.now())`, not `new Date()`. They are the same instant, but the bare
      // constructor reads the clock internally and is NOT affected by `Date.now` being
      // substituted — which is how a test (and `jest.useFakeTimers`) controls this node. A node
      // whose time cannot be moved is a node whose date logic cannot be tested.
      this._internal.now = new Date(Date.now());
      this.flagOutputDirty('date');
      this.flagOutputDirty('timestamp');
      this.flagOutputDirty('iso');
      if (token) this.reportOutcome(token as never, 'done');
    }
  }
};

const NowNodeModule: NodeModule = { node: NowNode };

export = NowNodeModule;
