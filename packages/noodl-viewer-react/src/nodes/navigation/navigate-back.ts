import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

interface NavigateBackInstance extends NodeInstance {
  _internal: {
    resultValues: Record<string, unknown>;
    results?: string;
    backActions?: string;
    backAction?: string;
    hasScheduledNavigate?: boolean;
    /** Set by the Component Stack when this node's page is pushed; see navigation-stack. */
    backCallback?(args: { backAction: string | undefined; results: Record<string, unknown> }): void;
  };
  scheduleNavigate(): void;
  navigate(): void;
  backActionTriggered(name: string): void;
  setResultValue(key: string, value: unknown): void;
}

const NavigateBack: NodeDefinitionOptions = {
  name: 'PageStackNavigateBack',
  displayNodeName: 'Pop Component Stack',
  category: 'Navigation',
  docs: 'https://docs.noodl.net/nodes/component-stack/pop-component',
  inputs: {
    navigate: {
      displayName: 'Navigate',
      group: 'Actions',
      valueChangedToTrue: function (this: NavigateBackInstance) {
        this.scheduleNavigate();
      }
    },
    results: {
      type: { name: 'stringlist', allowEditOnly: true },
      group: 'Results',
      set: function (this: NavigateBackInstance, value: string) {
        this._internal.results = value;
      }
    },
    backActions: {
      type: { name: 'stringlist', allowEditOnly: true },
      group: 'Back Actions',
      set: function (this: NavigateBackInstance, value: string) {
        this._internal.backActions = value;
      }
    }
  },
  initialize: function (this: NavigateBackInstance) {
    this._internal.resultValues = {};
  },
  methods: {
    scheduleNavigate: function (this: NavigateBackInstance) {
      const _this = this;
      const internal = this._internal;
      if (!internal.hasScheduledNavigate) {
        internal.hasScheduledNavigate = true;
        this.scheduleAfterInputsHaveUpdated(function () {
          internal.hasScheduledNavigate = false;
          _this.navigate();
        });
      }
    },
    _setBackCallback(this: NavigateBackInstance, cb: NavigateBackInstance['_internal']['backCallback']) {
      this._internal.backCallback = cb;
    },
    navigate(this: NavigateBackInstance) {
      if (this._internal.backCallback === undefined) return;

      this._internal.backCallback({
        backAction: this._internal.backAction,
        results: this._internal.resultValues
      });
    },
    setResultValue: function (this: NavigateBackInstance, key: string, value: unknown) {
      this._internal.resultValues[key] = value;
    },
    backActionTriggered: function (this: NavigateBackInstance, name: string) {
      this._internal.backAction = name;
      this.scheduleNavigate();
    },
    registerInputIfNeeded: function (this: NavigateBackInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('result-'))
        return this.registerInput(name, {
          set: this.setResultValue.bind(this, name.substring('result-'.length))
        });

      if (name.startsWith('backAction-'))
        return this.registerInput(name, {
          // Latent defect, PLAT-003 NOTES §19: `_createSignal` is not defined in this
          // file or anywhere else in the repository, so registering a `backAction-…`
          // input throws a ReferenceError at runtime. The working equivalent is
          // `EdgeTriggeredInput.createSetter` (see closepopup.ts). Left broken here
          // because fixing it changes runtime behaviour, which a typing slice must not.
          // @ts-expect-error -- see above
          set: _createSignal({
            valueChangedToTrue: this.backActionTriggered.bind(this, name)
          })
        });
    }
  }
};

function setup(context: NodeContextLike, graphModel: GraphModelLike) {
  if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
    return;
  }
  const editorConnection: EditorConnectionLike = context.editorConnection;

  function _managePortsForNode(node: GraphNodeModel) {
    function _updatePorts() {
      const ports = [];

      // Add results inputs
      const results = node.parameters.results;
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

      // Add back actions
      const backActions = node.parameters.backActions;
      if (backActions) {
        const names = (backActions as string).split(',');
        for (const i in names) {
          const p = names[i];

          ports.push({
            type: 'signal',
            plug: 'input',
            group: 'Back Actions',
            name: 'backAction-' + p,
            displayName: p
          });
        }
      }

      editorConnection.sendDynamicPorts(node.id, ports);
    }

    _updatePorts();
    node.on('parameterUpdated', function (event) {
      if (event.name === 'results' || event.name === 'backActions') {
        _updatePorts();
      }
    });
  }

  graphModel.on('editorImportComplete', () => {
    graphModel.on('nodeAdded.PageStackNavigateBack', function (node: GraphNodeModel) {
      _managePortsForNode(node);
    });

    for (const node of graphModel.getNodesWithType('PageStackNavigateBack')) {
      _managePortsForNode(node);
    }
  });
}

const NavigateBackModule: NodeModule = {
  node: NavigateBack,
  setup: setup
};

export default NavigateBackModule;
