import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/** `this` inside the Repeater Item node. */
interface ForEachActionsInstance extends NodeInstance {
  _internal: {
    /**
     * Set by {@link ForEachActionsInstance.tryRemove} while the Repeater waits for the
     * `Try Remove` handshake to complete.
     */
    removeCompletedCallback?(): void;
  };
  getItemId(): string | undefined;
  signalAdded(): void;
  tryRemove(callback: () => void): void;
}

/**
 * Sits inside a Repeater's template component and talks to the Repeater that created it,
 * reaching it through the `_forEachModel`/`_forEachNode` pair the Repeater set on this
 * component instance.
 *
 * Its `Try Remove` output is a handshake, not a notification: when it has connections the
 * Repeater hands over a completion callback and waits, which is what lets a template run
 * an exit animation before its node is destroyed.
 */
const ForEachActionsDefinition: NodeDefinitionOptions = {
  name: 'For Each Actions',
  docs: 'https://docs.noodl.net/nodes/ui-controls/repeater-item',
  displayNodeName: 'Repeater Item',
  category: 'Data',
  color: 'data',
  inputs: {
    removeCompleted: {
      type: { name: 'boolean', allowConnectionsOnly: true },
      displayName: 'Remove Completed',
      group: 'Events',
      valueChangedToTrue: function (this: ForEachActionsInstance) {
        this._internal.removeCompletedCallback && this._internal.removeCompletedCallback();
      }
    }
  },
  outputs: {
    added: {
      type: 'signal',
      displayName: 'Added',
      group: 'Events'
    },
    tryRemove: {
      type: 'signal',
      displayName: 'Try Remove',
      group: 'Events'
    },
    itemId: {
      type: 'string',
      displayName: 'Item Id',
      group: 'General',
      get(this: ForEachActionsInstance) {
        return this.getItemId();
      }
    }
  },
  prototypeExtensions: {
    getItemId(this: ForEachActionsInstance) {
      const model = this.nodeScope.componentOwner._forEachModel;
      return model && model.getId();
    },
    signalAdded: function (this: ForEachActionsInstance) {
      this.sendSignalOnOutput('added');
    },
    tryRemove: function (this: ForEachActionsInstance, callback: () => void) {
      if (this.getOutput('tryRemove').hasConnections()) {
        this._internal.removeCompletedCallback = callback;
        this.sendSignalOnOutput('tryRemove');
      } else {
        // Schedule for later in this frame so any collection nodes
        // being delete can complete data persistence before being
        // deleted
        this.scheduleAfterInputsHaveUpdated(function () {
          callback();
        });
      }
    }
  }
};

// DEBT-006: this module's setup published `itemAction-…` ports and the node's
// `itemActionTriggered` called `signalItemAction`, which no node has ever
// defined — the publishing block itself had been commented out for years
// (PLAT-003 NOTES §17.7 #2, "dead *and* broken"). The whole mechanism is gone.
const ForEachActionsModule: NodeModule = {
  node: ForEachActionsDefinition,
  setup() {
    // Handled in editor adapter
  }
};

export default ForEachActionsModule;
