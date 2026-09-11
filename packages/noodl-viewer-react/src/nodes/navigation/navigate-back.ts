import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
} from '@noodl/types';
import { EdgeTriggeredInput } from '@noodl/runtime';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';

import type { StackBackResult } from './navigation-stack';

interface NavigateBackInstance extends NodeInstance {
  _internal: {
    resultValues: Record<string, unknown>;
    results?: string;
    backActions?: string;
    backAction?: string;
    hasScheduledNavigate?: boolean;
    /** ERG-001 §4 — tokens for the presses this frame; see `scheduleNavigate`. */
    pendingOutcomes?: OutcomeToken[];
    /** Set by the Component Stack when this node's page is pushed; see navigation-stack. */
    backCallback?(args: { backAction: string | undefined; results: Record<string, unknown> }): StackBackResult;
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
  };
  scheduleNavigate(outcome: OutcomeToken): void;
  navigate(outcome: OutcomeToken): void;
  reportFailure(outcome: OutcomeToken, code: string, message: string): void;
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
      description: 'Pops the enclosing Component Stack back to the component underneath',
      valueChangedToTrue: function (this: NavigateBackInstance) {
        this.scheduleNavigate(this.beginOutcome());
      }
    },
    results: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Results',
      group: 'Results',
      description:
        'Names of values to hand back to the node that pushed this component, one input port each',
      set: function (this: NavigateBackInstance, value: string) {
        this._internal.results = value;
      }
    },
    backActions: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Back Actions',
      group: 'Back Actions',
      description:
        'Names of the ways this component can be closed, one signal input each; the matching signal fires on the node that pushed it',
      set: function (this: NavigateBackInstance, value: string) {
        this._internal.backActions = value;
      }
    }
  },
  // NDA-004 §2/§3 + NDA-008 §3: this node took a signal and emitted none, so nothing could be
  // sequenced after a pop and a pop that did nothing looked identical to one that worked.
  //
  // ⚠️ ERG-001 §4 renamed `success` (displaying "Popped") to `done`. It was a sixth wire name for
  // §0.2 Result 2's one concept, alongside `navigated` on the two Navigate nodes.
  outputs: {
    ...outcomeOutputs({
      done:
        'Fires once the stack has popped this component. ⚠️ This node is destroyed with the ' +
        'component it pops, so sequence anything that must survive the pop from the node that pushed it',
      unchanged:
        'Fires when the Component Stack is already showing its first component, so there was nothing to pop',
      failure:
        'Fires when this node is not inside a pushed component, or a navigation is still animating'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the stack did not pop, set just before Failure fires',
      getter: function (this: NavigateBackInstance) {
        return this._internal.lastError;
      }
    }
  },
  initialize: function (this: NavigateBackInstance) {
    this._internal.resultValues = {};
  },
  methods: {
    scheduleNavigate: function (this: NavigateBackInstance, outcome: OutcomeToken) {
      const _this = this;
      const internal = this._internal;
      // ERG-001 §4 — one token per press. `backActionTriggered` is a second author-facing
      // trigger for the same action and mints its own, so a frame that carries both a plain
      // `Navigate` and a back action reports twice, because it *was* asked twice.
      if (internal.pendingOutcomes === undefined) internal.pendingOutcomes = [];
      internal.pendingOutcomes.push(outcome);

      if (!internal.hasScheduledNavigate) {
        internal.hasScheduledNavigate = true;
        this.scheduleAfterInputsHaveUpdated(function () {
          internal.hasScheduledNavigate = false;
          const outcomes = internal.pendingOutcomes || [];
          internal.pendingOutcomes = undefined;
          // The pop happens once; each press that asked for it gets its own report. Only the
          // first can pop, so the rest land on the stack's end-stop and report `Unchanged`.
          for (const token of outcomes) _this.navigate(token);
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
    navigate(this: NavigateBackInstance, outcome: OutcomeToken) {
      // NDA-012 (Navigation). The back action describes *this* pop, so it is consumed here
      // rather than left standing. It used to latch: `backActionTriggered` wrote it and
      // nothing ever cleared it, so once a component had been popped through a back action,
      // every later pop through the plain `Navigate` signal reported that same action to the
      // node that pushed it — and the pusher's `Navigated`-side branch for it ran again for
      // an interaction that never happened. Cleared before the callback, not after, so a
      // callback that pops and re-pushes cannot see a stale one either.
      const backAction = this._internal.backAction;
      this._internal.backAction = undefined;

      if (this._internal.backCallback === undefined) {
        return this.reportFailure(
          outcome,
          'pop-component-stack/no-stack-in-scope',
          'No Component Stack to pop — this node only works inside a component that a Component Stack pushed'
        );
      }

      const result = this._internal.backCallback({
        backAction,
        results: this._internal.resultValues
      });

      // Tolerate a `void` return: `_setBackCallback` is public enough that something other
      // than `navigation-stack.tsx` could be installing it, and treating "told us nothing" as
      // a failure would be worse than assuming it worked.
      if (result && result.ok === false) {
        // ERG-001 §4 — the stack at its root is an end-stop, not a drop. See `StackBackResult`.
        if ('unchanged' in result) return this.reportOutcome(outcome, 'unchanged');
        return this.reportFailure(outcome, result.code, result.message);
      }

      this.reportOutcome(outcome, 'done');
    },
    reportFailure(this: NavigateBackInstance, outcome: OutcomeToken, code: string, message: string) {
      this._internal.lastError = message;
      // Value first, signal last. `reportOutcome` puts the reason on the NDA-004 channel, so
      // `raiseRuntimeError` is not called here as well — that would raise twice for one drop.
      this.flagOutputDirty('error');
      this.reportOutcome(outcome, 'failure', { code, message });
    },
    setResultValue: function (this: NavigateBackInstance, key: string, value: unknown) {
      this._internal.resultValues[key] = value;
    },
    backActionTriggered: function (this: NavigateBackInstance, name: string) {
      this._internal.backAction = name;
      this.scheduleNavigate(this.beginOutcome());
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
