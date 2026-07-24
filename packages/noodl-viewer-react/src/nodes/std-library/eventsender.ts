import type {
  EditorConnectionLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

type Propagation = 'global' | 'parent' | 'children' | 'siblings';

interface EventSenderInstance extends NodeInstance {
  _internal: {
    /** Payload port values by port name, plus `_channelName`, which travels with the event. */
    inputValues: Record<string, unknown>;
    channelName: string;
    propagation: Propagation;
  };
}

const EventSender: NodeDefinitionOptions = {
  name: 'Event Sender',
  docs: 'https://docs.noodl.net/nodes/events/send-event',
  displayNodeName: 'Send Event',
  category: 'Events',
  usePortAsLabel: 'channelName',
  color: 'component',
  exportDynamicPorts: true,
  initialize: function (this: EventSenderInstance) {
    this._internal.inputValues = {};
    this._internal.channelName = '';
    this._internal.propagation = 'global';
  },
  inputs: {
    sendEvent: {
      displayName: 'Send',
      valueChangedToTrue: function (this: EventSenderInstance) {
        const self = this;

        //wait for all other inputs to update before sending
        this.scheduleAfterInputsHaveUpdated(function () {
          if (self._internal.propagation === 'global') {
            self.context.sendGlobalEventFromEventSender(self._internal.channelName, self._internal.inputValues);
          } else {
            self.nodeScope.sendEventFromThisScope(
              self._internal.channelName,
              self._internal.inputValues,
              self._internal.propagation
            );
          }
        });
      }
    },
    channelName: {
      type: {
        name: 'string',
        allowEditOnly: true,
        identifierOf: 'EventChannelName',
        identifierDisplayName: 'Event Channels'
      },
      default: '',
      group: 'Settings',
      displayName: 'Channel Name',
      set: function (this: EventSenderInstance, value: string) {
        this._internal.channelName = value;
        this._internal.inputValues._channelName = value;
      }
    },
    propagation: {
      type: {
        name: 'enum',
        enums: [
          { value: 'global', label: 'Global' },
          { value: 'parent', label: 'Parent' },
          { value: 'children', label: 'Children' },
          { value: 'siblings', label: 'Siblings' }
        ]
      },
      default: 'global',
      group: 'Settings',
      displayName: 'Send to',
      set: function (this: EventSenderInstance, value: Propagation) {
        this._internal.propagation = value;
      }
    },
    payload: {
      type: {
        name: 'stringlist',
        allowEditOnly: true
      },
      group: 'Payload'
    }
  },
  prototypeExtensions: {
    // The `runtime-discovered` dynamic-port mechanism: every payload name the author typed
    // becomes an input the first time the graph asks for it.
    registerInputIfNeeded: {
      value: function (this: EventSenderInstance, name: string) {
        if (this.hasInput(name)) {
          return;
        }
        const self = this;
        this.registerInput(name, {
          set: function (value: unknown) {
            self._internal.inputValues[name] = value;
          }
        });
      }
    }
  }
};

function updatePorts(nodeId: string, parameters: Record<string, unknown>, editorConnection: EditorConnectionLike) {
  const ports = [];

  // Add payload inputs
  const payload = parameters.payload as string | undefined;
  if (payload) {
    for (const p of payload.split(',')) {
      ports.push({
        type: {
          name: '*',
          allowConnectionsOnly: true
        },
        plug: 'input',
        group: 'Payload',
        name: p,
        displayName: p
      });
    }
  }

  editorConnection.sendDynamicPorts(nodeId, ports, {
    detectRenamed: {
      plug: 'input'
    }
  });
}

const EventSenderModule: NodeModule = {
  node: EventSender,
  setup: function (context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Event Sender', function (node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, editorConnection);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, editorConnection);
      });
    });
  }
};

export default EventSenderModule;
