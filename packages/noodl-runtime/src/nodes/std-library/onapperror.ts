'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import type { RuntimeErrorEvent, RuntimeErrorSubscription } from '../../runtimeerror';

/**
 * `On App Error` — the top-level error boundary.
 * See `dev-docs/reference/FAILURE-CONTRACT.md`.
 *
 * The Failure Contract makes an error observable from the graph in two complementary ways.
 * Per-node `Failure` outputs cover the errors an author expects and wants to branch on where
 * they happen. This node covers the rest, and the rest is most of them: the library has 155
 * nodes and will never have complete failure ports on all of them, so without a catch-all the
 * only honest answer to "something went wrong somewhere" is a console line the author of a
 * deployed app never sees.
 *
 * Multiple instances all fire. There is deliberately no claiming or consumption: this is a
 * boundary, not a handler chain, and one instance logging every error must not stop another
 * from showing a toast for the subset it cares about.
 */

interface OnAppErrorNodeInstance extends NodeInstance {
  _internal: {
    subscription?: RuntimeErrorSubscription;
    filter?: string;
    last?: RuntimeErrorEvent;
  };
  onRuntimeError(event: RuntimeErrorEvent): void;
}

const OnAppErrorNode: NodeDefinitionOptions = {
  name: 'On App Error',
  displayNodeName: 'On App Error',
  category: 'Utilities',
  color: 'component',
  initialize: function (this: OnAppErrorNodeInstance) {
    const internal = this._internal;

    // Subscribing in `initialize` rather than on first update is deliberate: errors raised
    // while the graph is still being built are exactly the ones an author has the hardest
    // time seeing, and a boundary that only arms itself later would miss them.
    internal.subscription = this.context.errorBus.subscribe((event: RuntimeErrorEvent) => {
      this.onRuntimeError(event);
    });

    this.addDeleteListener(function (this: OnAppErrorNodeInstance) {
      if (this._internal.subscription) {
        this._internal.subscription.unsubscribe();
        this._internal.subscription = undefined;
      }
    });
  },
  getInspectInfo(this: OnAppErrorNodeInstance): InspectInfo {
    const last = this._internal.last;
    if (!last) return 'No errors yet';
    return last.code + ': ' + last.message;
  },
  inputs: {
    filter: {
      type: 'string',
      displayName: 'Filter',
      group: 'General',
      description:
        'Only errors whose Code starts with this text are reported; leave blank to catch every error in the app',
      // A code prefix, matched against the raised `code` — `'run-tasks'` catches every
      // failure Run Tasks can report, `'run-tasks/no-completion-output'` catches exactly
      // one. Empty means everything, which is the useful default for a boundary.
      set: function (this: OnAppErrorNodeInstance, value: unknown) {
        this._internal.filter = value === undefined || value === null ? undefined : String(value);
      }
    }
  },
  outputs: {
    error: {
      type: 'signal',
      displayName: 'Error',
      group: 'Events',
      description: 'Fires when an error passes the Filter, after every value output below has been updated to describe it'
    },
    message: {
      type: 'string',
      displayName: 'Message',
      group: 'General',
      description: 'Human-readable account of what went wrong, safe to reword between releases — match on Code instead',
      getter: function (this: OnAppErrorNodeInstance) {
        return this._internal.last ? this._internal.last.message : undefined;
      }
    },
    code: {
      type: 'string',
      displayName: 'Code',
      group: 'General',
      description: 'Stable kebab-case identifier for this kind of error, namespaced by node type, as in run-tasks/task-failed',
      getter: function (this: OnAppErrorNodeInstance) {
        return this._internal.last ? this._internal.last.code : undefined;
      }
    },
    nodeId: {
      type: 'string',
      displayName: 'Node Id',
      group: 'Source',
      description: 'Graph id of the node that raised the error, or <runtime> when it was raised outside any node',
      getter: function (this: OnAppErrorNodeInstance) {
        return this._internal.last ? this._internal.last.nodeId : undefined;
      }
    },
    componentName: {
      type: 'string',
      displayName: 'Component Name',
      group: 'Source',
      description: 'Component the failing node sits in, or <runtime> when the error was raised outside any node',
      getter: function (this: OnAppErrorNodeInstance) {
        return this._internal.last ? this._internal.last.componentName : undefined;
      }
    },
    nodeType: {
      type: 'string',
      displayName: 'Node Type',
      group: 'Source',
      description: 'Kind of node that raised the error, or <runtime> when it was raised outside any node',
      getter: function (this: OnAppErrorNodeInstance) {
        return this._internal.last ? this._internal.last.nodeType : undefined;
      }
    },
    errorObject: {
      type: 'object',
      displayName: 'Error Object',
      group: 'General',
      description: 'The whole error event as one record, for logging it or sending it to an error-reporting service',
      // The whole structured event, for authors who want to log it or send it somewhere.
      // Wireable to a string input thanks to NDA-014's object -> string cast, which renders
      // it as JSON (PORT-TYPE-CONTRACT.md). Named `Error Object` rather than the contract's
      // second `Error` so the two ports are tellable apart on the canvas.
      getter: function (this: OnAppErrorNodeInstance) {
        return this._internal.last;
      }
    }
  },
  prototypeExtensions: {
    onRuntimeError: function (this: OnAppErrorNodeInstance, event: RuntimeErrorEvent) {
      const internal = this._internal;

      if (internal.filter && event.code.indexOf(internal.filter) !== 0) return;

      internal.last = event;

      // Values before the signal, always. A downstream node reading `Message` on the pulse
      // must see *this* error's message: flagging the value outputs dirty first is what
      // keeps the value and the signal that announces it in step.
      this.flagOutputDirty('message');
      this.flagOutputDirty('code');
      this.flagOutputDirty('nodeId');
      this.flagOutputDirty('componentName');
      this.flagOutputDirty('nodeType');
      this.flagOutputDirty('errorObject');
      this.sendSignalOnOutput('error');
    }
  }
};

const OnAppErrorNodeModule: NodeModule = {
  node: OnAppErrorNode
};

export = OnAppErrorNodeModule;
