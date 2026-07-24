import { EdgeTriggeredInput } from '@noodl/runtime';
import type { NodeContextLike, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/** `this` inside the Repeater Item node. */
interface ForEachActionsInstance extends NodeInstance {
  _internal: {
    /**
     * Set by {@link ForEachActionsInstance.tryRemove} while the Repeater waits for the
     * `Try Remove` handshake to complete.
     */
    removeCompletedCallback?(): void;
    actionParameters?: Record<string, string>;
  };
  getItemId(): string | undefined;
  signalAdded(): void;
  tryRemove(callback: () => void): void;
  itemActionTriggered(name: string): void;
  setItemActionParameter(name: string): void;
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
    /*   itemActions:{
        type:{name:'stringlist',allowEditOnly:true},
        group:'Actions',
        set:function(value) {
        }
      },
      itemActionParameters:{
        type:{name:'stringlist',allowEditOnly:true},
        group:'Action Parameters',
        set:function(value) {
        }
      }    */
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
    },
    // Calls `signalItemAction`, which no node defines — see PLAT-003 NOTES §17. Unreachable
    // today because the `itemAction-` ports that would register this input are only created
    // by the commented-out `setup` below.
    itemActionTriggered(this: ForEachActionsInstance, name: string) {
      this.scheduleAfterInputsHaveUpdated(() => {
        const itemId = this.getItemId();
        const parentForEach = this.nodeScope.componentOwner._forEachNode as NodeInstance & {
          signalItemAction(name: string, itemId: string, parameters: Record<string, string>): void;
        };
        parentForEach.signalItemAction(name, itemId, this._internal.actionParameters || {});
      });
    },
    setItemActionParameter(this: ForEachActionsInstance, name: string) {
      if (!this._internal.actionParameters) this._internal.actionParameters = {};
      this._internal.actionParameters[name] = name;
    },
    registerInputIfNeeded: function (this: ForEachActionsInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('itemAction-'))
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: this.itemActionTriggered.bind(this, name)
          })
        });

      if (name.startsWith('itemActionParameter-'))
        return this.registerInput(name, {
          set: this.setItemActionParameter.bind(this, name)
        });
    }
  }
};

const ForEachActionsModule: NodeModule = {
  node: ForEachActionsDefinition,
  setup: function (context: NodeContextLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    /*  graphModel.on("nodeAdded.For Each Actions", function (node) {
      function _updatePorts() {
        var ports = [];

        var actions = node.parameters['itemActions'];
        if(actions) {
          actions.split(',').forEach((a) => {
            ports.push({
              name:'itemAction-' + a,
              displayName:a,
              plug:'input',
              type:'signal',
              group:'Actions',
            })
          })
        }

        var parameters = node.parameters['itemActionParameters'];
        if(parameters) {
          parameters.split(',').forEach((p) => {
            ports.push({
              name:'itemActionParameter-' + p,
              displayName:p,
              plug:'input',
              type:'*',
              group:'Parameters',
            })
          })
        }

        context.editorConnection.sendDynamicPorts(node.id, ports);
      }

      _updatePorts();
      node.on('parameterUpdated',function(event) {
        if(event.name === 'itemActions' || event.name === 'itemActionParameters') _updatePorts();
      })

    })*/
  }
};

export default ForEachActionsModule;
