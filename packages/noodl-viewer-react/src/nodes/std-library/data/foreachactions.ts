import { Node } from '@noodl/runtime';
import { forgetForEachItem, resolveForEachItem } from '@noodl/runtime/src/foreachitem';
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
  _onNodeDeleted(): void;
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
    /**
     * NDA-004 §2 / NDA-015 — the **sixth** hand-rolled `_forEachModel` read.
     *
     * NDA-015's sweep found five (`modelcrudbase`, `modelnode2`, `dbmodelcrudbase`,
     * `dbmodelnode2`, `javascriptnodeparser._findForEachModel`) and converged them on
     * `resolveForEachItem`. This one was missed, and it is the node *named after* the
     * mechanism — which is the "a claim that something was cleaned up is a hypothesis too"
     * lesson landing on the task that established it.
     *
     * Two things change by converging. It now takes the **scope chain** rather than reading
     * `componentOwner` directly, so a Repeater Item one component deep inside a template
     * resolves instead of silently returning `undefined` (BINDING-CONTRACT's two walks —
     * ambient properties need `scopeChain`, which is what `resolveForEachItem` uses). And a
     * node that is not inside a Repeater or Run Tasks template at all now *says so*, once,
     * through `miss`'s per-node dedup, instead of handing out an `undefined` Item Id for ever.
     *
     * Safe from a getter for the reason banked in BINDING-CONTRACT: `extraProps` land at
     * `nodecontext.ts:398-403`, **before** `setComponentModel` builds any inner node. So by
     * the time this node exists inside a template, `_forEachModel` is already there — absence
     * means "not in a template", which is permanent, not "not yet".
     */
    getItemId(this: ForEachActionsInstance) {
      const model = resolveForEachItem(this);
      return model && model.getId();
    },
    _onNodeDeleted(this: ForEachActionsInstance) {
      // The base first — this is an override, and skipping it would drop the node's own
      // teardown. `resolvedTargets` holds instances strongly, and a Repeater churning its
      // template would otherwise grow that map for the life of the session.
      Node.prototype._onNodeDeleted.call(this);
      forgetForEachItem(this);
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
