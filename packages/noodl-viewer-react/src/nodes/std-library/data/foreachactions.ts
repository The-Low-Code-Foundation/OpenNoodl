import { Node } from '@noodl/runtime';
import { forgetForEachItem, resolveForEachItem } from '@noodl/runtime/src/foreachitem';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/** `this` inside the Repeater Item node. */
interface ForEachActionsInstance extends NodeInstance {
  _internal: {
    /**
     * Set by {@link ForEachActionsInstance.tryRemove} while the Repeater waits for the
     * `Try Remove` handshake to complete.
     *
     * ⚠️ **Cleared the moment it is called.** ERG-001: it never used to be, so a second
     * `Remove Completed` pulse called the Repeater's callback again — NV-iii's latch, in the
     * node whose whole job is a one-shot handshake. Clearing it is also what makes the second
     * pulse honestly `Unchanged` instead of a second `Done`.
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
      description:
        'Tells the Repeater the exit work is finished and this item may now be destroyed; needed ' +
        'only when Try Remove is connected',
      group: 'Events',
      valueChangedToTrue: function (this: ForEachActionsInstance) {
        // ERG-001. This line was `callback && callback()` — silent whether or not there was a
        // handshake to complete, which is §0's "emits nothing at all" entry for this node.
        const outcome = this.beginOutcome();
        const callback = this._internal.removeCompletedCallback;
        // Cleared before it runs, not after: the callback destroys this item, and a Repeater
        // that re-entered here would otherwise find the slot still full.
        this._internal.removeCompletedCallback = undefined;
        if (callback) callback();
        // Nothing waiting is a no-op an author may have written on purpose — `Remove Completed`
        // pulsed unconditionally beside an exit animation is a reasonable graph — so it is
        // `Unchanged` and this node has no `Failure` port at all.
        this.reportOutcome(outcome, callback ? 'done' : 'unchanged');
      }
    }
  },
  outputs: {
    added: {
      type: 'signal',
      displayName: 'Added',
      description: 'Fires once this repeated item has been created and Item Id is available',
      group: 'Events'
    },
    tryRemove: {
      type: 'signal',
      displayName: 'Try Remove',
      description:
        'Fires before the Repeater destroys this item, and holds the removal until Remove Completed ' +
        'is pulsed — connect it only if something must run first',
      group: 'Events'
    },
    itemId: {
      type: 'string',
      displayName: 'Item Id',
      description: 'Id of the record this repeated item was created for',
      group: 'General',
      get(this: ForEachActionsInstance) {
        return this.getItemId();
      }
    },

    // ERG-001 §4. One action — `Remove Completed` — and no `Failure`: completing a handshake
    // that is not running is a no-op, not an error, and a `Failure` that fires on a graph
    // working exactly as written is how authors are trained to ignore the port.
    ...outcomeOutputs({
      done: 'Fires when a removal really was waiting on this handshake and has now been released',
      unchanged:
        'Fires when no removal was waiting — Try Remove had not been raised, or this handshake ' +
        'was already completed'
    })
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
