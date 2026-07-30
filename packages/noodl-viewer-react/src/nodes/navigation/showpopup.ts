import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/** @see {@link NodeContext.showPopup} — the runtime owns the policy, this node selects it. */
type PopupStackPolicy = 'replace' | 'stack';

interface ShowPopupInstance extends NodeInstance {
  _internal: {
    popupParams: Record<string, unknown>;
    closeResults: Record<string, unknown>;
    target?: string;
    hasScheduledShow?: boolean;
    stackPolicy?: PopupStackPolicy;
  };
  scheduleShow(): void;
  show(): void;
  setPopupParam(param: string, value: unknown): void;
  getCloseResult(param: string): unknown;
}

const ShowPopupNode: NodeDefinitionOptions = {
  name: 'NavigationShowPopup',
  displayNodeName: 'Show Popup',
  category: 'Navigation',
  docs: 'https://docs.noodl.net/nodes/popups/show-popup',
  initialize: function (this: ShowPopupInstance) {
    this._internal.popupParams = {};
    this._internal.closeResults = {};
  },
  inputs: {
    target: {
      type: 'component',
      displayName: 'Target',
      group: 'General',
      set: function (this: ShowPopupInstance, value: string) {
        this._internal.target = value;
      }
    },
    stackPolicy: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Replace It', value: 'replace' },
          { label: 'Show On Top', value: 'stack' }
        ]
      },
      displayName: 'When A Popup Is Open',
      group: 'General',
      default: 'replace',
      set: function (this: ShowPopupInstance, value: PopupStackPolicy) {
        this._internal.stackPolicy = value === 'stack' ? 'stack' : 'replace';
      }
    },
    show: {
      type: 'signal',
      displayName: 'Show',
      group: 'Actions',
      valueChangedToTrue: function (this: ShowPopupInstance) {
        this.scheduleShow();
      }
    }
  },
  outputs: {
    Closed: {
      type: 'signal'
    },
    Dismissed: {
      type: 'signal',
      displayName: 'Dismissed',
      group: 'Events'
    }
  },
  methods: {
    setPopupParam: function (this: ShowPopupInstance, param: string, value: unknown) {
      this._internal.popupParams[param] = value;
    },
    getCloseResult: function (this: ShowPopupInstance, param: string) {
      return this._internal.closeResults[param];
    },
    scheduleShow: function (this: ShowPopupInstance) {
      const _this = this;
      const internal = this._internal;
      if (!internal.hasScheduledShow) {
        internal.hasScheduledShow = true;
        this.scheduleAfterInputsHaveUpdated(function () {
          internal.hasScheduledShow = false;
          _this.show();
        });
      }
    },
    show: function (this: ShowPopupInstance) {
      if (this._internal.target == undefined) return;

      this.context.showPopup(this._internal.target, this._internal.popupParams, {
        senderNode: this.nodeScope.componentOwner,
        stackPolicy: this._internal.stackPolicy ?? 'replace',
        // NDA-010 §3. Separate from `Closed` on purpose: this popup went away because
        // another one replaced it, which is not the user finishing with it. An author's
        // `Closed` branch is where the save-or-commit work goes, and running it for an
        // interaction that never happened is worse than the stacking this policy fixes.
        // There are no close results, because nothing in the popup produced any.
        onDismissPopup: () => {
          this.sendSignalOnOutput('Dismissed');
        },
        onClosePopup: (action: string | undefined, results: Record<string, unknown>) => {
          this._internal.closeResults = results;

          for (const key in results) {
            if (this.hasOutput('closeResult-' + key)) this.flagOutputDirty('closeResult-' + key);
          }

          if (!action) this.sendSignalOnOutput('Closed');
          else this.sendSignalOnOutput(action);
        }
      });
    },
    registerInputIfNeeded: function (this: ShowPopupInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('popupParam-'))
        return this.registerInput(name, {
          set: this.setPopupParam.bind(this, name.substring('popupParam-'.length))
        });
    },
    registerOutputIfNeeded: function (this: ShowPopupInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('closeResult-'))
        return this.registerOutput(name, {
          getter: this.getCloseResult.bind(this, name.substring('closeResult-'.length))
        });

      if (name.startsWith('closeAction-'))
        return this.registerOutput(name, {
          getter: function () {
            /** No needed for signals */
          }
        });
    }
  }
};

const ShowPopupModule: NodeModule = {
  node: ShowPopupNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection: EditorConnectionLike = context.editorConnection;

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        const ports = [];

        const targetComponentName = node.parameters['target'] as string | undefined;
        if (targetComponentName !== undefined) {
          const c = graphModel.components[targetComponentName];
          if (c) {
            for (const inputName in c.inputPorts) {
              const o = c.inputPorts[inputName];
              ports.push({
                name: 'popupParam-' + inputName,
                displayName: inputName,
                type: o.type || '*',
                plug: 'input',
                group: 'Params'
              });
            }

            for (const _n of c.getNodesWithType('NavigationClosePopup')) {
              if (_n.parameters['closeActions'] !== undefined) {
                (_n.parameters['closeActions'] as string).split(',').forEach((a) => {
                  if (ports.find((p) => p.name === a)) return;

                  ports.push({
                    name: 'closeAction-' + a,
                    displayName: a,
                    type: 'signal',
                    plug: 'output',
                    group: 'Close Actions'
                  });
                });
              }

              if (_n.parameters['results'] !== undefined) {
                (_n.parameters['results'] as string).split(',').forEach((p) => {
                  ports.push({
                    name: 'closeResult-' + p,
                    displayName: p,
                    type: '*',
                    plug: 'output',
                    group: 'Close Results'
                  });
                });
              }
            }
          }
        }
        editorConnection.sendDynamicPorts(node.id, ports);
      }

      function _trackTargetComponent(name: string | undefined) {
        if (name === undefined) return;
        const c = graphModel.components[name];
        if (c === undefined) return;

        c.on('inputPortAdded', _updatePorts);
        c.on('inputPortRemoved', _updatePorts);

        // Also track all close popups for changes
        for (const _n of c.getNodesWithType('NavigationClosePopup')) {
          _n.on('parameterUpdated', _updatePorts);
        }

        // Track close popup added and removed
        c.on('nodeAdded', (_n: GraphNodeModel) => {
          if (_n.type === 'NavigationClosePopup') {
            _n.on('parameterUpdated', _updatePorts);
            _updatePorts();
          }
        });

        c.on('nodeWasRemoved', (_n: GraphNodeModel) => {
          if (_n.type === 'NavigationClosePopup') _updatePorts();
        });
      }

      _updatePorts();
      _trackTargetComponent(node.parameters['target'] as string | undefined);

      // Track parameter updated
      node.on('parameterUpdated', function (event) {
        if (event.name === 'target') {
          _updatePorts();
          _trackTargetComponent(node.parameters['target'] as string | undefined);
        }
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.NavigationShowPopup', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('NavigationShowPopup')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default ShowPopupModule;
