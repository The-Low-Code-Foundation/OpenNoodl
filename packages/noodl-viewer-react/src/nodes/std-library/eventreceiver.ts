import { Node } from '@noodl/runtime';
import type { GraphNodeModel, NodeContextLike, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

type EventData = Record<string, unknown>;

interface EventReceiverInstance extends NodeInstance {
  _internal: {
    outputValues: EventData;
    outputNames: string[];
    eventReceived: boolean;
    _isEnabled: boolean;
    channelName: string;
    consume?: 'never' | 'always';
    onEventReceivedCallback?: ((eventData: EventData) => void) | null;
  };
  handleEvent(eventData: EventData): boolean;
  onEventReceived(eventData: EventData): void;
  registerListenersForChannel(channelName: string): void;
  getChannelName(): string;
}

const EventReceiver: NodeDefinitionOptions = {
  name: 'Event Receiver',
  docs: 'https://docs.noodl.net/nodes/events/receive-event',
  displayNodeName: 'Receive Event',
  category: 'Events',
  usePortAsLabel: 'channelName',
  color: 'component',
  initialize: function (this: EventReceiverInstance) {
    const internal = this._internal;
    internal.outputValues = {};
    internal.outputNames = [];
    internal.eventReceived = false;
    internal._isEnabled = true;
    internal.channelName = '';
  },
  inputs: {
    enabled: {
      displayName: 'Enabled',
      type: 'boolean',
      default: true,
      description: 'Whether events on this channel are acted on; while off they are ignored and not passed to another receiver either',
      set: function (this: EventReceiverInstance, value: unknown) {
        this._internal._isEnabled = value ? true : false;
      }
    },
    consume: {
      displayName: 'Consume',
      type: {
        name: 'enum',
        enums: [
          { label: 'Never', value: 'never' },
          { label: 'Always', value: 'always' }
        ]
      },
      default: 'never',
      description: 'Whether receiving an event stops it reaching other receivers on the same channel',
      set: function (this: EventReceiverInstance, value: 'never' | 'always') {
        this._internal.consume = value;
      }
    },
    channelName: {
      type: { name: 'string', identifierOf: 'EventChannelName' },
      displayName: 'Channel',
      description: 'Name to listen on, which must match a Send Event exactly; nothing reports a name no sender uses',
      set: function (this: EventReceiverInstance, value: string) {
        if (this._internal.onEventReceivedCallback) {
          //remove old listener
          this.context.eventSenderEmitter.removeListener(
            this._internal.channelName,
            this._internal.onEventReceivedCallback
          );
          this._internal.onEventReceivedCallback = null;
        }

        this._internal.channelName = value;
        this.registerListenersForChannel(value);
      }
    }
  },
  outputs: {
    eventReceived: {
      displayName: 'Received',
      type: 'signal',
      description: "Fires when an event arrives on Channel, once the payload outputs carry that event's values"
    }
  },
  prototypeExtensions: {
    // The `runtime-discovered` dynamic-port mechanism, output side: the payload names come
    // from whichever Event Senders share this node's channel, so they are known only per
    // project. `setup` below is what tells the editor about them.
    registerOutputIfNeeded: function (this: EventReceiverInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      const self = this;

      this._internal.outputNames.push(name);
      this.registerOutput(name, {
        getter: function () {
          return self._internal.outputValues[name];
        }
      });
    },
    /**
     * NDA-012 (Events) — the payload lands *before* `Received` announces it.
     *
     * This used to pulse first and flag the payload outputs afterwards, so a node acting on the
     * signal — a Function's `Run`, a Set Object Properties' `Do` — read the previous event's data,
     * or nothing at all on the first one. Carrying data alongside a signal is this node's entire
     * purpose, so the ordering defeated the reason it exists.
     *
     * Both `flagOutputDirty` and `sendSignalOnOutput` push into the receiving node's input queue
     * (`outputproperty.ts:114,149`), so what settles this is program order and nothing else: the
     * values are queued ahead of the pulse and drain ahead of it. `onapperror.ts:142-148` and
     * `Response` (NDA-004 §3) already did it this way; the rule existed and this node predated it.
     *
     * `Signal To Index` has the same shape (`signaltoindex.ts:64`) and is filed, not fixed here —
     * it is a different category's worksheet and deserves its own discrimination check.
     */
    handleEvent: function (this: EventReceiverInstance, eventData: EventData) {
      if (this._internal._isEnabled === false) {
        return;
      }

      for (const name in eventData) {
        if (this.hasOutput(name)) {
          this._internal.outputValues[name] = eventData[name];
          this.flagOutputDirty(name);
        }
      }

      this.sendSignalOnOutput('eventReceived');

      return this._internal.consume === 'always';
    },
    onEventReceived: function (this: EventReceiverInstance, eventData: EventData) {
      this.handleEvent(eventData);
    },
    _onNodeDeleted: function (this: EventReceiverInstance) {
      Node.prototype._onNodeDeleted.call(this);
      if (this._internal.onEventReceivedCallback) {
        const eventEmitter = this.context.eventSenderEmitter;
        eventEmitter.removeListener(this._internal.channelName, this._internal.onEventReceivedCallback);
      }
    },
    registerListenersForChannel: function (this: EventReceiverInstance, channelName: string) {
      const eventEmitter = this.context.eventSenderEmitter;
      this._internal.onEventReceivedCallback = this.onEventReceived.bind(this);
      eventEmitter.on(channelName, this._internal.onEventReceivedCallback);

      const self = this;
      this.context.eventEmitter.once('applicationDataReloaded', function () {
        if (self._internal.onEventReceivedCallback) {
          eventEmitter.removeListener(channelName, self._internal.onEventReceivedCallback);
        }
      });
    },
    getChannelName: function (this: EventReceiverInstance) {
      return this._internal.channelName;
    }
  }
};

// The `.js` original assigned `module.exports` twice — first `{ node }`, then the same
// object plus `setup`. The first assignment was dead and is dropped here.
const EventReceiverModule: NodeModule = {
  node: EventReceiver,
  setup: function (context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    function onEventReceiver(node: GraphNodeModel) {
      let channelName = node.parameters.channelName;

      function _collectPayloadPorts() {
        const eventSenders = graphModel.getNodesWithType('Event Sender');
        const matching = eventSenders.filter((sender) => sender.parameters.channelName === channelName);

        const portKeys: Record<string, boolean> = {};
        matching.forEach((sender) => {
          const payload = sender.parameters.payload as string | undefined;
          const ports = payload ? payload.split(',') : [];
          for (const key of ports) {
            portKeys[key] = true;
          }
        });

        const ports = [];
        for (const key in portKeys) {
          ports.push({
            name: key,
            type: '*',
            plug: 'output',
            displayName: key
          });
        }

        editorConnection.sendDynamicPorts(node.id, ports, {
          detectRenamed: {
            plug: 'output'
          }
        });
      }

      _collectPayloadPorts();
      node.on('parameterUpdated', function (event: { name: string; value: unknown }) {
        if (event.name === 'channelName') {
          channelName = event.value;
          _collectPayloadPorts();
        }
      });

      // Track all event senders and update ports when they change
      function _trackEventSender(sender: GraphNodeModel) {
        //_collectPayloadPorts();

        sender.on('inputPortAdded', function () {
          _collectPayloadPorts();
        });

        sender.on('inputPortRemoved', function () {
          _collectPayloadPorts();
        });

        sender.on('parameterUpdated', function (event: { name: string }) {
          if (event.name === 'channelName') {
            _collectPayloadPorts();
          }
        });
      }

      graphModel.getNodesWithType('Event Sender').forEach(_trackEventSender);

      graphModel.on('nodeAdded.Event Sender', _trackEventSender);

      graphModel.on('nodeRemoved.Event Sender', () => {
        _collectPayloadPorts();
      });
    }

    //wait with dynamic ports until the entire graph is loaded
    graphModel.on('editorImportComplete', () => {
      //all future added nodes though delta updates
      graphModel.on('nodeAdded.Event Receiver', (node: GraphNodeModel) => onEventReceiver(node));

      //existing nodes from the initial export
      graphModel.getNodesWithType('Event Receiver').forEach((node) => onEventReceiver(node));
    });
  }
};

export default EventReceiverModule;
