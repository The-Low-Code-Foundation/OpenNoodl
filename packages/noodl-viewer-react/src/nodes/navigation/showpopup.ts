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
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
  };
  scheduleShow(): void;
  show(): void;
  reportFailure(code: string, message: string): void;
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
  // NDA-004 §2 (register ⏳ item 3, sequenced after NDA-010 §3). Every outcome this node had
  // was a *later* one — `Closed`, `Dismissed`, an author's close actions — so a popup that
  // never opened was indistinguishable from one the user had not finished with yet. The
  // trigger is an author `Do` (`Show`, group `Actions`), so this cannot fire on the boot path.
  outputs: {
    Closed: {
      type: 'signal'
    },
    Dismissed: {
      type: 'signal',
      displayName: 'Dismissed',
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
      getter: function (this: ShowPopupInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    reportFailure: function (this: ShowPopupInstance, code: string, message: string) {
      this._internal.lastError = message;
      this.raiseRuntimeError(code, message);
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    },
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
      if (this._internal.target == undefined) {
        return this.reportFailure(
          'show-popup/no-target',
          'No Target component is set on this Show Popup node'
        );
      }

      /**
       * NDA-004 §2 — the returned promise was dropped, and it can **reject**.
       *
       * `NodeContext.showPopup` awaits `nodeScope.createNode(popupComponent)`, which for a
       * component name that is not registered reaches `getComponentModel` and *throws*
       * `Can't find component model for …`. Nothing awaited that here, so a Show Popup pointed
       * at a deleted or renamed component produced an **unhandled promise rejection** — not
       * even `nodecontext.ts`'s blanket catch, which only wraps `update()` — and no popup, with
       * nothing whatever on the graph to say so.
       *
       * Catching here rather than reporting from `showPopup` deliberately: the failure belongs
       * to the node that asked, which is the decision NDA-008 §3 settled for the Component
       * Stack and this phase has followed since. It also covers the bundle-fetch case for free,
       * because that rejects through the same promise.
       */
      const shown = this.context.showPopup(this._internal.target, this._internal.popupParams, {
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

      // `showPopup` is typed as returning a promise, but it is reached through the context
      // interface and a host could hand back nothing; guarding costs one check and turns a
      // `TypeError` on `.catch` into no report at all, which is the defect being fixed.
      shown &&
        shown.catch &&
        shown.catch((e: unknown) => {
          this.reportFailure(
            'show-popup/target-failed',
            'The popup "' + this._internal.target + '" could not be opened: ' + ((e as Error)?.message || String(e))
          );
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
                  /**
                   * NDA-010 §1 (re-scoped). Params came out of the target's `inputPorts` carrying
                   * their declared type; results were pushed as `'*'`, so **one direction of the
                   * popup boundary type-checked and the other did not** — and `*` accepts every
                   * connection, which is the type dead end class E is about, arrived at from the
                   * other side.
                   *
                   * The names still come from Close Popup's hand-typed `results` stringlist; that
                   * half is a design question and is written up in the spec. What is free is the
                   * *type*: where the popup component declares an output port of the same name, use
                   * it. `foreach.tsx:797-798` reads a target component's `outputPorts` the same way,
                   * so this is an existing pattern rather than a new coupling.
                   *
                   * Falling back to `'*'` is deliberate — a result with no matching output port is
                   * exactly as connectable as it was before, so no graph that works today stops.
                   */
                  const declared = c.outputPorts && c.outputPorts[p];
                  ports.push({
                    name: 'closeResult-' + p,
                    displayName: p,
                    type: (declared && declared.type) || '*',
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

        // NDA-010 §1. The target's *output* ports are now a type source for `closeResult-*`, so
        // they have to be tracked too — otherwise adding the Component Output that gives a result
        // its type leaves the port at `*` until something else happens to re-run this.
        c.on('outputPortAdded', _updatePorts);
        c.on('outputPortRemoved', _updatePorts);

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
