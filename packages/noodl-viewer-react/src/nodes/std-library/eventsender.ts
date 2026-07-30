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
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
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
      description: 'Sends one event on Channel Name, after every payload input has settled',
      valueChangedToTrue: function (this: EventSenderInstance) {
        const self = this;

        //wait for all other inputs to update before sending
        this.scheduleAfterInputsHaveUpdated(function () {
          // NDA-004 §2. An event sent to no channel name goes nowhere, and this used to be
          // the silent case: no receiver fires, nothing is reported, and the author is left
          // looking at the receiving end wondering why it never triggered.
          if (!self._internal.channelName) {
            const message = 'No channel name, so the event was not sent';
            self._internal.lastError = message;
            self.raiseRuntimeError('event-sender/no-channel', message);
            self.flagOutputDirty('error');
            self.sendSignalOnOutput('failure');
            return;
          }

          if (self._internal.propagation === 'global') {
            self.context.sendGlobalEventFromEventSender(self._internal.channelName, self._internal.inputValues);
          } else {
            self.nodeScope.sendEventFromThisScope(
              self._internal.channelName,
              self._internal.inputValues,
              self._internal.propagation
            );
          }

          // NDA-004 §3: `Sent` fires after the event has been dispatched, which — because
          // dispatch is deferred to after every input has settled — is a moment the author
          // previously had no way to observe at all.
          self.sendSignalOnOutput('sent');
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
      description: 'Name every Receive Event must match to hear this; nothing reports a name no receiver listens on',
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
      description: 'How far the event travels: the whole app, or only the receivers above, below or beside this node',
      set: function (this: EventSenderInstance, value: Propagation) {
        this._internal.propagation = value;
      }
    },
    payload: {
      type: {
        name: 'stringlist',
        allowEditOnly: true
      },
      description: 'Names of the values to carry with the event; each becomes an input here and an output on every matching Receive Event',
      group: 'Payload'
    }
  },
  outputs: {
    sent: {
      type: 'signal',
      displayName: 'Sent',
      group: 'Events',
      description: 'Fires once the event has been dispatched to every matching receiver'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events',
      description: 'Fires when the event could not be sent, which today means Channel Name was left empty'
    },
    /**
     * NDA-004 §2 — added 2026-07-30, and found by a `hasOutput` top-up rather than by a failing
     * row.
     *
     * The batch-1 fix gave this node a `Failure` signal and a raised code but **no `Error`
     * port**, which the contract names as its own defect: "a bare signal reproduces 'no
     * information' one level up". The rows written at the time asserted on `signalsFor` and on
     * the raised code, so nothing noticed. Retro-fitting `hasOutput` assertions to the batch-1
     * and batch-2 files is what surfaced it.
     */
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Why the last send failed, empty when the last send succeeded',
      getter: function (this: EventSenderInstance) {
        return this._internal.lastError;
      }
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
