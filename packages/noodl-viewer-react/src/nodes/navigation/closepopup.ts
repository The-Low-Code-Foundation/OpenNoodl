import { EdgeTriggeredInput, Node } from '@noodl/runtime';
import { componentAncestors } from '@noodl/runtime/src/componentwalk';
import { ResolvedTargetReporter } from '@noodl/runtime/src/resolvedtarget';
import type {
  ComponentInstanceLike,
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/** BINDING-CONTRACT §(b): which popup this node will close, on the node card. */
const resolvedTargets = new ResolvedTargetReporter();

/** What an attempt to find the enclosing popup came back with. */
interface PopupResolution {
  /** The popup's component instance, when one was found. */
  popup?: ComponentInstanceLike;
  /** How to close it — either the popup's published handler or a handed-down callback. */
  close?(action: string | undefined, results: Record<string, unknown>): void;
  /** Set when nothing resolved: the failure code and message to raise. */
  missCode?: string;
  missMessage?: string;
  /** Popup component names enclosing this node, nearest first — for the failure detail. */
  candidates: string[];
}

interface ClosePopupInstance extends NodeInstance {
  _internal: {
    resultValues: Record<string, unknown>;
    results?: string;
    closeActions?: string;
    closeAction?: string;
    hasScheduledClose?: boolean;
    /** Installed by the popup layer when the popup opens; see showpopup's `onClosePopup`. */
    closeCallback?(action: string | undefined, results: Record<string, unknown>): void;
    /** The `Popup` input: a popup named explicitly, or unset for "the enclosing one". */
    targetComponent?: string;
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
  };
  scheduleClose(): void;
  close(): void;
  closeActionTriggered(name: string): void;
  setResultValue(key: string, value: unknown): void;
  resolvePopup(): PopupResolution;
  reportResolution(): void;
}

const ClosePopupNode: NodeDefinitionOptions = {
  name: 'NavigationClosePopup',
  displayNodeName: 'Close Popup',
  category: 'Navigation',
  docs: 'https://docs.noodl.net/nodes/popups/close-popup',
  initialize: function (this: ClosePopupInstance) {
    this._internal.resultValues = {};
  },
  /**
   * Report what this node will close as soon as it can, not only when it is asked to close.
   *
   * Deferred for the same reason `parentcomponentobject.ts` defers (NDA-015 §3): at
   * `nodeScopeDidInitialize` the enclosing tree is still being built, and `showPopup` only
   * attaches the popup's group a frame later. `scheduleAfterUpdate` runs at the end of this
   * update pass, by which time the walk has something to walk.
   */
  nodeScopeDidInitialize: function (this: ClosePopupInstance) {
    this.context.scheduleAfterUpdate(() => {
      this.reportResolution();
    });
  },
  inputs: {
    /**
     * BINDING-CONTRACT §(a). Optional: unset closes the enclosing popup, which is what this
     * node has always done, so no existing graph changes behaviour.
     *
     * Worth having because popups nest — a popup opened from inside a popup gives a Close
     * Popup node two honest answers, and only the author knows which was meant.
     */
    targetComponent: {
      type: 'component',
      displayName: 'Popup',
      group: 'General',
      description: 'Which popup to close when popups are nested; leave blank to close the nearest enclosing one',
      set: function (this: ClosePopupInstance, value: string) {
        this._internal.targetComponent = value || undefined;
        this.reportResolution();
      }
    },
    results: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Results',
      group: 'Results',
      description:
        'Names of values to hand back to the Show Popup node that opened this popup, one input port each',
      set: function (this: ClosePopupInstance, value: string) {
        this._internal.results = value;
      }
    },
    closeActions: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Close Actions',
      group: 'Close Actions',
      description:
        'Names of the ways this popup can be closed, one signal input each; the matching signal fires on the Show Popup node',
      set: function (this: ClosePopupInstance, value: string) {
        this._internal.closeActions = value;
      }
    },
    close: {
      type: 'signal',
      displayName: 'Close',
      group: 'Actions',
      description: 'Closes the popup and hands back any Results',
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
      group: 'Events',
      description: 'Fires once the popup has been closed'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events',
      description: 'Fires when this node is not inside an open popup, or Popup names one it is not inside'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Why the popup was not closed, set just before Failure fires',
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
      // Being handed a callback is the moment this node learns it is inside an open popup,
      // so it is also the moment the card can say which one.
      this.reportResolution();
    },
    _onNodeDeleted: function (this: ClosePopupInstance) {
      Node.prototype._onNodeDeleted.call(this);
      // The reporter holds instances strongly; popups are created and destroyed constantly.
      resolvedTargets.forget(this);
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
    /**
     * Find the popup this node closes — NDA-010 §2 / NDA-015 §2.
     *
     * This node used to *wait to be handed* a callback: `NodeContext.showPopup` pushed one
     * onto `getNodesWithType('NavigationClosePopup')` in the popup's own top-level scope and
     * nowhere else. So a Close Popup node one component deeper inside the popup was never
     * given one, did nothing, and said nothing — "very hard to find the right place to put
     * the close popup node so that it actually works", reported as a defect and true.
     *
     * It now *resolves*: `showPopup` publishes `_popupCloseHandler` on the popup's component
     * instance, and this walks up until it finds one. The handed callback is still preferred
     * when present so graphs that work today take exactly the path they took before.
     *
     * Order matters in the walk: the node's own component owner is tested first, because a
     * Close Popup node sitting directly in the popup component belongs to *that* popup, and
     * `componentAncestors` deliberately never returns the starting component.
     */
    resolvePopup: function (this: ClosePopupInstance): PopupResolution {
      const owner = this.nodeScope && this.nodeScope.componentOwner;
      const chain: ComponentInstanceLike[] = owner ? [owner].concat(componentAncestors(owner)) : [];
      const popups = chain.filter((component) => typeof component._popupCloseHandler === 'function');
      const candidates = popups.map((component) => component.name);
      const wanted = this._internal.targetComponent;

      // Explicit target: a miss is a failure, never a fall back to the enclosing popup.
      // Falling back would close *something*, which is worse than closing nothing — the
      // author would see a popup shut and believe the target was honoured.
      if (wanted) {
        const named = popups.find((component) => component.name === wanted);
        if (!named) {
          return {
            candidates,
            missCode: 'close-popup/target-not-found',
            missMessage:
              'This node is not inside a popup named "' +
              wanted +
              '"' +
              (candidates.length ? ' — it is inside: ' + candidates.join(', ') : '')
          };
        }
        return { popup: named, close: named._popupCloseHandler, candidates };
      }

      // The callback the popup layer handed down, when there was one. Identical behaviour to
      // before this change for every graph that already worked.
      if (this._internal.closeCallback) {
        return { popup: popups[0], close: this._internal.closeCallback, candidates };
      }

      if (popups.length === 0) {
        return {
          candidates,
          missCode: 'close-popup/no-popup-in-scope',
          missMessage: 'No popup in scope to close — this node only works inside a component opened as a popup'
        };
      }

      return { popup: popups[0], close: popups[0]._popupCloseHandler, candidates };
    },
    /**
     * Push the resolved popup name to the node card (BINDING-CONTRACT §(b)).
     *
     * Silent about misses: this runs whenever the graph might have changed, and a Close Popup
     * node simply sitting in a component that is not currently open as a popup is the normal
     * state, not a failure. Failures are raised from `close`, where the node was actually
     * asked to do something and could not.
     */
    reportResolution: function (this: ClosePopupInstance) {
      const resolution = this.resolvePopup();
      resolvedTargets.report(this, resolution.popup ? resolution.popup.name : undefined);
    },
    close: function (this: ClosePopupInstance) {
      // NDA-012 (Navigation), and the same latch as Pop Component Stack's back action. The
      // close action describes *this* close, so it is consumed here. It used to be written
      // once by `closeActionTriggered` and never cleared, so after a popup had been closed
      // through, say, `Save`, every later close through the plain `Close` signal fired `Save`
      // on the Show Popup node again instead of `Closed` — the save branch running for an
      // interaction the user never made.
      const closeAction = this._internal.closeAction;
      this._internal.closeAction = undefined;

      const resolution = this.resolvePopup();
      resolvedTargets.report(this, resolution.popup ? resolution.popup.name : undefined);

      // NDA-004 §2: a close that did nothing used to look identical to one that worked —
      // a bare `if` with no `else`, which reads to an author as a broken Close button.
      if (!resolution.close) {
        this._internal.lastError = resolution.missMessage;
        this.raiseRuntimeError(resolution.missCode, resolution.missMessage, {
          target: this._internal.targetComponent,
          popupsInScope: resolution.candidates
        });
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      resolution.close(closeAction, this._internal.resultValues);
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
