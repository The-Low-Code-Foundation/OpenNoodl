import { EdgeTriggeredInput } from '@noodl/runtime';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

interface ClosePopupInstance extends NodeInstance {
  _internal: {
    resultValues: Record<string, unknown>;
    results?: string;
    closeActions?: string;
    closeAction?: string;
    hasScheduledClose?: boolean;
    /** Installed by the popup layer when the popup opens; see showpopup's `onClosePopup`. */
    closeCallback?(action: string | undefined, results: Record<string, unknown>): void;
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
  };
  scheduleClose(): void;
  close(): void;
  closeActionTriggered(name: string): void;
  setResultValue(key: string, value: unknown): void;
}

const ClosePopupNode: NodeDefinitionOptions = {
  name: 'NavigationClosePopup',
  displayNodeName: 'Close Popup',
  category: 'Navigation',
  docs: 'https://docs.noodl.net/nodes/popups/close-popup',
  initialize: function (this: ClosePopupInstance) {
    this._internal.resultValues = {};
  },
  inputs: {
    results: {
      type: { name: 'stringlist', allowEditOnly: true },
      group: 'Results',
      set: function (this: ClosePopupInstance, value: string) {
        this._internal.results = value;
      }
    },
    closeActions: {
      type: { name: 'stringlist', allowEditOnly: true },
      group: 'Close Actions',
      set: function (this: ClosePopupInstance, value: string) {
        this._internal.closeActions = value;
      }
    },
    close: {
      type: 'Signal',
      displayName: 'Close',
      group: 'Actions',
      valueChangedToTrue: function (this: ClosePopupInstance) {
        this.scheduleClose();
      }
    }
  },
  // NDA-004 §3: this node took a signal and emitted none, so nothing could be sequenced after
  // a popup closed and a close that did nothing looked identical to one that worked.
  outputs: {
    success: {
      type: 'signal',
      displayName: 'Closed',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function (this: ClosePopupInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    setResultValue: function (this: ClosePopupInstance, key: string, value: unknown) {
      this._internal.resultValues[key] = value;
    },
    _setCloseCallback: function (this: ClosePopupInstance, cb: ClosePopupInstance['_internal']['closeCallback']) {
      this._internal.closeCallback = cb;
    },
    scheduleClose: function (this: ClosePopupInstance) {
      const _this = this;
      const internal = this._internal;
      if (!internal.hasScheduledClose) {
        internal.hasScheduledClose = true;
        this.scheduleAfterInputsHaveUpdated(function () {
          internal.hasScheduledClose = false;
          _this.close();
        });
      }
    },
    close: function (this: ClosePopupInstance) {
      // NDA-004 §2. `closeCallback` is installed by the popup layer when the popup opens, so
      // its absence means exactly one thing: this node was asked to close a popup and there
      // is no popup in scope to close. The Failure Contract names this case explicitly. It
      // used to be a bare `if` with no `else` — the node did nothing and said nothing, which
      // reads to an author as a broken Close button.
      //
      // This is the *reporting* half only. Which popup a Close Popup node should target, and
      // how that target is made visible on the canvas, is NDA-010 §2 / NDA-015's work.
      if (!this._internal.closeCallback) {
        this._internal.lastError = 'No popup in scope to close';
        this.raiseRuntimeError(
          'close-popup/no-popup-in-scope',
          'No popup in scope to close — this node only works inside a component opened as a popup'
        );
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      this._internal.closeCallback(this._internal.closeAction, this._internal.resultValues);
      this.sendSignalOnOutput('success');
    },
    closeActionTriggered: function (this: ClosePopupInstance, name: string) {
      this._internal.closeAction = name;
      this.scheduleClose();
    },
    registerInputIfNeeded: function (this: ClosePopupInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('result-'))
        return this.registerInput(name, {
          set: this.setResultValue.bind(this, name.substring('result-'.length))
        });

      if (name.startsWith('closeAction-'))
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: this.closeActionTriggered.bind(this, name)
          })
        });
    }
  }
};

const ClosePopupModule: NodeModule = {
  node: ClosePopupNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection: EditorConnectionLike = context.editorConnection;

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        const ports = [];

        // Add results inputs
        const results = node.parameters['results'];
        if (results) {
          const names = (results as string).split(',');
          for (const i in names) {
            const p = names[i];

            ports.push({
              type: {
                name: '*'
              },
              plug: 'input',
              group: 'Results',
              name: 'result-' + p,
              displayName: p
            });
          }
        }

        // Add close actions
        const closeActions = node.parameters['closeActions'];
        if (closeActions) {
          const names = (closeActions as string).split(',');
          for (const i in names) {
            const p = names[i];

            ports.push({
              type: 'signal',
              plug: 'input',
              group: 'Close Actions',
              name: 'closeAction-' + p,
              displayName: p
            });
          }
        }

        editorConnection.sendDynamicPorts(node.id, ports);
      }

      _updatePorts();
      node.on('parameterUpdated', function (event) {
        if (event.name === 'results' || event.name === 'closeActions') {
          _updatePorts();
        }
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.NavigationClosePopup', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('NavigationClosePopup')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default ClosePopupModule;
