import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';
import { EdgeTriggeredInput } from '@noodl/runtime';

import type { StackBackResult } from './navigation-stack';

interface NavigateBackInstance extends NodeInstance {
  _internal: {
    resultValues: Record<string, unknown>;
    results?: string;
    backActions?: string;
    backAction?: string;
    hasScheduledNavigate?: boolean;
    /** Set by the Component Stack when this node's page is pushed; see navigation-stack. */
    backCallback?(args: { backAction: string | undefined; results: Record<string, unknown> }): StackBackResult;
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
  };
  scheduleNavigate(): void;
  navigate(): void;
  reportFailure(code: string, message: string): void;
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
  // NDA-004 §2/§3 + NDA-008 §3: this node took a signal and emitted none, so nothing could be
  // sequenced after a pop and a pop that did nothing looked identical to one that worked.
  outputs: {
    success: {
      type: 'signal',
      displayName: 'Popped',
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
      getter: function (this: NavigateBackInstance) {
        return this._internal.lastError;
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
    /**
     * NDA-008 §3. Three things could go wrong here and all three were silent.
     *
     * The callback is absent when this node is not inside a component that a Component Stack
     * pushed — the same shape as Close Popup's "no popup in scope", and the same reason it
     * reads to an author as a dead Back button. The other two come back from the stack: the
     * stack is already at its first component, or it is still animating the last navigation.
     * That last one is the case authors actually hit, because a double-tapped back button
     * used to lose its second tap without trace.
     */
    navigate(this: NavigateBackInstance) {
      if (this._internal.backCallback === undefined) {
        return this.reportFailure(
          'pop-component-stack/no-stack-in-scope',
          'No Component Stack to pop — this node only works inside a component that a Component Stack pushed'
        );
      }

      const result = this._internal.backCallback({
        backAction: this._internal.backAction,
        results: this._internal.resultValues
      });

      // Tolerate a `void` return: `_setBackCallback` is public enough that something other
      // than `navigation-stack.tsx` could be installing it, and treating "told us nothing" as
      // a failure would be worse than assuming it worked.
      if (result && result.ok === false) {
        return this.reportFailure(result.code, result.message);
      }

      this.sendSignalOnOutput('success');
    },
    reportFailure(this: NavigateBackInstance, code: string, message: string) {
      this._internal.lastError = message;
      this.raiseRuntimeError(code, message);
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
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
          set: EdgeTriggeredInput.createSetter({
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
