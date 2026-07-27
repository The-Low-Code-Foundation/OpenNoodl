'use strict';

import { Node } from '@noodl/runtime';
import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/** One `globalsEventEmitter` subscription, kept so it can be removed on delete. */
interface GlobalsListener {
  name: string;
  listener: (...args: unknown[]) => void;
}

/**
 * `this` inside the Globals node.
 *
 * Its ports are `runtime-discovered`: `registerInputIfNeeded` /
 * `registerOutputIfNeeded` are overridden so any name the editor asks for becomes a
 * port, reading and writing `context.globalValues` under that name.
 */
interface GlobalsNodeInstance extends NodeInstance {
  _internal: {
    listeners: GlobalsListener[];
  };
  _newOutputValueReceived(name: string): void;
}

const GlobalsNode: NodeDefinitionOptions = {
  name: 'Globals',
  shortDesc: 'A node used to communicate values across the project.',
  category: 'Utilities',
  color: 'component',
  deprecated: true, // use variable instead
  initialize: function (this: GlobalsNodeInstance) {
    this._internal.listeners = [];
  },
  panels: [
    {
      name: 'PortEditor',
      context: ['select', 'connectTo', 'connectFrom'],
      title: 'Globals',
      plug: 'input/output',
      type: {
        name: '*'
      }
    }
  ],
  prototypeExtensions: {
    _onNodeDeleted: function (this: GlobalsNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      const globalsEmitter = this.context.globalsEventEmitter;

      for (let i = 0; i < this._internal.listeners.length; i++) {
        const listener = this._internal.listeners[i];
        globalsEmitter.removeListener(listener.name, listener.listener);
      }
      this._internal.listeners = [];
    },
    _newOutputValueReceived: {
      value: function (this: GlobalsNodeInstance, name: string) {
        // This used to write `this._cachedInputValues[name]` first, but
        // `_cachedInputValues` is assigned nowhere in the runtime, so the listener
        // threw `TypeError: Cannot set properties of undefined` the first time a
        // global changed that this node had an output for. The cache was never
        // load-bearing — the output getter below reads `context.globalValues`
        // directly — so the write is dropped rather than the cache introduced
        // (PLAT-003 NOTES §23.3).
        this.flagOutputDirty(name);
      }
    },
    registerInputIfNeeded: {
      value: function (this: GlobalsNodeInstance, name: string) {
        const self = this;

        if (this.hasInput(name)) {
          return;
        }
        this.registerInput(name, {
          set: self.context.setGlobalValue.bind(self.context, name)
        });
      }
    },
    registerOutputIfNeeded: {
      value: function (this: GlobalsNodeInstance, name: string) {
        if (this.hasOutput(name)) {
          return;
        }

        const newOutputValueReceivedCallback = this._newOutputValueReceived.bind(this, name);

        const globalsEmitter = this.context.globalsEventEmitter;

        this._internal.listeners.push({
          name: name,
          listener: newOutputValueReceivedCallback
        });

        globalsEmitter.on(name, newOutputValueReceivedCallback);

        this.registerOutput(name, {
          getter: function (this: GlobalsNodeInstance) {
            return this.context.globalValues[name];
          }
        });
      }
    }
  }
};

const GlobalsNodeModule: NodeModule = {
  node: GlobalsNode
};

export default GlobalsNodeModule;
