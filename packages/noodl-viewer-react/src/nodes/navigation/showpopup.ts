import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';
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
    /**
     * One token per `Show` pulse waiting on the coalescing guard — ERG-001 §4.
     *
     * ⚠️ Created lazily in `scheduleShow`, not in `initialize`, for the reason the Cloud
     * Services slice recorded: a suite that never calls `initialize` finds `undefined` exactly
     * where the first invocation reads it.
     */
    pendingShowOutcomes?: OutcomeToken[];
  };
  scheduleShow(token?: OutcomeToken): void;
  show(): void;
  reportFailure(code: string, message: string, tokens: OutcomeToken[]): void;
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
      description: 'Component to open as a popup; its Component Inputs become input ports on this node',
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
      description: 'Replace It closes the popup already showing, Show On Top opens this one over it',
      set: function (this: ShowPopupInstance, value: PopupStackPolicy) {
        this._internal.stackPolicy = value === 'stack' ? 'stack' : 'replace';
      }
    },
    show: {
      type: 'signal',
      displayName: 'Show',
      group: 'Actions',
      description: 'Opens Target as a popup',
      valueChangedToTrue: function (this: ShowPopupInstance) {
        // ERG-001 §4. Only the port mints; `target`/`stackPolicy`/`popupParam-…` merely store.
        this.scheduleShow(this.beginOutcome());
      }
    }
  },
  // NDA-004 §2 (register ⏳ item 3, sequenced after NDA-010 §3). Every outcome this node had
  // was a *later* one — `Closed`, `Dismissed`, an author's close actions — so a popup that
  // never opened was indistinguishable from one the user had not finished with yet. The
  // trigger is an author `Do` (`Show`, group `Actions`), so this cannot fire on the boot path.
  outputs: {
    // `Closed` carried neither a `displayName` nor a `group`, so it rendered on its own above
    // the three ports it belongs with. Presentation only — ports are addressed by name — but
    // it is why the node's own outcome ports read as two unrelated sets.
    Closed: {
      type: 'signal',
      displayName: 'Closed',
      group: 'Events',
      description: 'Fires when the popup was closed without a close action, after Close Results are up to date'
    },
    Dismissed: {
      type: 'signal',
      displayName: 'Dismissed',
      group: 'Events',
      description: 'Fires when another popup replaced this one before the user closed it, so there are no Close Results'
    },
    /**
     * ERG-001 §4 — `Done` is **added**, and none of the three ports above became it.
     *
     * `Closed`, `Dismissed` and the author's `closeAction-…` outputs are all *later* events:
     * they fire when the user has finished with a popup that opened successfully, which may be
     * minutes after the `Show` that opened it, and `Dismissed` fires for something the author
     * never did. None of them is "the Show finished" — that is `Done`, and it fires once the
     * popup has actually been opened, which is the moment this node could not express at all.
     *
     * No `Unchanged`: `Show` either opens the target or reports why it could not. §5 must not
     * expect one.
     */
    ...outcomeOutputs({
      done: 'Fires once the popup has been opened. Closed and Dismissed are later events about the same popup, not this signal',
      failure: 'Fires when no Target is set, or the component could not be opened'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      description: 'Why the popup did not open, set just before Failure fires',
      getter: function (this: ShowPopupInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    reportFailure: function (this: ShowPopupInstance, code: string, message: string, tokens: OutcomeToken[]) {
      this._internal.lastError = message;
      this.flagOutputDirty('error');
      reportOutcomes(this, tokens, 'failure', { code, message });
    },
    setPopupParam: function (this: ShowPopupInstance, param: string, value: unknown) {
      this._internal.popupParams[param] = value;
    },
    getCloseResult: function (this: ShowPopupInstance, param: string) {
      return this._internal.closeResults[param];
    },
    scheduleShow: function (this: ShowPopupInstance, token?: OutcomeToken) {
      const _this = this;
      const internal = this._internal;
      if (token) {
        if (!internal.pendingShowOutcomes) internal.pendingShowOutcomes = [];
        internal.pendingShowOutcomes.push(token);
      }

      // The guard drops the second pulse's *show* deliberately; Rule 1 is per invocation, so the
      // second pulse's outcome is already queued above.
      if (!internal.hasScheduledShow) {
        internal.hasScheduledShow = true;
        this.scheduleAfterInputsHaveUpdated(function () {
          internal.hasScheduledShow = false;
          _this.show();
        });
      }
    },
    show: function (this: ShowPopupInstance) {
      // Taken into a local before the async work starts, so a second `Show` arriving mid-flight
      // owns its own batch rather than being settled by this one's answer.
      const tokens = this._internal.pendingShowOutcomes || [];
      this._internal.pendingShowOutcomes = undefined;

      if (this._internal.target == undefined) {
        return this.reportFailure(
          'show-popup/no-target',
          'No Target component is set on this Show Popup node',
          tokens
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
      //
      // ⚠️ ERG-001 §4: the outcome rides the same promise rather than being reported
      // optimistically beside it. `showPopup` rejects for a component that has been deleted or
      // renamed, and a `Done` sent before the answer arrives would spend the token and turn
      // every such failure into an `outcome/duplicate`. A host that hands back nothing has
      // already done its work synchronously by the time `show` returns, so it reports `Done`
      // here.
      if (shown && shown.then) {
        shown.then(
          () => reportOutcomes(this, tokens, 'done'),
          (e: unknown) => {
            this.reportFailure(
              'show-popup/target-failed',
              'The popup "' + this._internal.target + '" could not be opened: ' + ((e as Error)?.message || String(e)),
              tokens
            );
          }
        );
      } else {
        reportOutcomes(this, tokens, 'done');
      }
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
                  // NDA-012 (Navigation). This guard compared the *bare* action name against
                  // `p.name`, which is always the prefixed `closeAction-…` — so it never
                  // matched and never deduplicated anything. Two Close Popup nodes in the same
                  // popup declaring the same close action (the ordinary case: one on a button,
                  // one on a backdrop) pushed two ports with identical names. `navigate.ts:304`
                  // is the same guard written correctly, one file over.
                  if (ports.find((p) => p.name === 'closeAction-' + a)) return;

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
                  // Same duplication as the close actions above, except this loop never had a
                  // guard at all. `navigate.ts:318` carries it for `backResult-`.
                  if (ports.find((_p) => _p.name === 'closeResult-' + p)) return;

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
