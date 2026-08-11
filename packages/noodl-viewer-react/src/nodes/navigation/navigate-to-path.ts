'use strict';

import NoodlRuntime from '@noodl/runtime';
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

/** A port in the editor's wire format, as pushed by `sendDynamicPorts`. */
interface DynamicPort {
  name: string;
  plug: 'input' | 'output';
  type?: unknown;
  displayName?: string;
  group?: string;
}

interface NavigateToPathInstance extends NodeInstance {
  _internal: {
    params: Record<string, unknown>;
    query: Record<string, unknown>;
    openInNewTab: boolean;
    path?: string;
    queryNames?: string;
    hasScheduledNavigate?: boolean;
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
    /**
     * One token per `Navigate` pulse waiting on the coalescing guard.
     *
     * ⚠️ Created lazily in `scheduleNavigate` rather than in `initialize`, for the reason the
     * Cloud Services slice recorded: a suite that never calls `initialize` finds `undefined`
     * exactly where the first invocation reads it.
     */
    pendingNavigateOutcomes?: OutcomeToken[];
  };
  scheduleNavigate(token?: OutcomeToken): void;
  navigate(): void;
  setParam(name: string, value: unknown): void;
  setQuery(name: string, value: unknown): void;
}

const NavigateToPathNode: NodeDefinitionOptions = {
  name: 'PageStackNavigateToPath',
  displayNodeName: 'Navigate To Path',
  category: 'Navigation',
  docs: 'https://docs.noodl.net/nodes/navigation/navigate-to-path',
  initialize(this: NavigateToPathInstance) {
    const internal = this._internal;
    internal.params = {};
    internal.query = {};
    internal.openInNewTab = false;
  },
  inputs: {
    path: {
      type: { name: 'string' },
      displayName: 'Path',
      group: 'General',
      description: 'Path to navigate to; wrap a segment in braces, as in /product/{id}, to get an input port for it',
      set(this: NavigateToPathInstance, value: string) {
        this._internal.path = value;
      }
    },
    queryNames: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Query',
      group: 'Query',
      description:
        'Names of query-string parameters to append, one input port each; a parameter left unset is omitted from the URL',
      set(this: NavigateToPathInstance, value: string) {
        this._internal.queryNames = value;
      }
    },
    openInNewTab: {
      index: 10,
      displayName: 'Open in new tab',
      group: 'General',
      default: false,
      type: 'boolean',
      description: 'Opens the path in a new browser tab instead of navigating this one',
      set(this: NavigateToPathInstance, value) {
        this._internal.openInNewTab = !!value;
      }
    },
    navigate: {
      displayName: 'Navigate',
      group: 'Actions',
      description: 'Navigates to Path, filling in any brace placeholders from their input ports',
      valueChangedToTrue(this: NavigateToPathInstance) {
        // ERG-001 §4. Only the port mints; every `p-`/`q-` setter merely stores a value.
        this.scheduleNavigate(this.beginOutcome());
      }
    }
  },
  // NDA-004 §3. One of the ten nodes that took a signal and emitted none — so "navigate, then
  // do the next thing" had nothing to hang off, and the `path === undefined` early return
  // below was indistinguishable from a navigation that worked.
  //
  // ERG-001 §4 renamed `success` to `done` — `navigate()` is reached from `scheduleNavigate` and
  // that from the `Navigate` port alone — and gave the server-side no-op an `Unchanged` rather
  // than leaving it as the bare `return` it was.
  outputs: {
    ...outcomeOutputs({
      done: 'Fires once the new path has been pushed to the browser history. Navigating in this window replaces the page, so nothing downstream of this may still exist',
      unchanged: 'Fires when there is no browser history to push to — a server-side render, where there is nothing to do and nothing to fail at',
      failure: 'Fires when no Path is set, or the browser blocked the new tab'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the navigation did not happen, set just before Failure fires',
      getter(this: NavigateToPathInstance) {
        return this._internal.lastError;
      }
    }
  },
  methods: {
    scheduleNavigate(this: NavigateToPathInstance, token?: OutcomeToken) {
      const internal = this._internal;
      if (token) {
        if (!internal.pendingNavigateOutcomes) internal.pendingNavigateOutcomes = [];
        internal.pendingNavigateOutcomes.push(token);
      }

      // The guard drops the second pulse's *navigation* deliberately; Rule 1 is per invocation,
      // so the second pulse's outcome is already queued above.
      if (!internal.hasScheduledNavigate) {
        internal.hasScheduledNavigate = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          internal.hasScheduledNavigate = false;
          this.navigate();
        });
      }
    },
    navigate(this: NavigateToPathInstance) {
      const internal = this._internal;

      // Drained before any branch, so every exit reports the same batch.
      const tokens = internal.pendingNavigateOutcomes || [];
      internal.pendingNavigateOutcomes = undefined;

      let formattedPath = internal.path;
      if (formattedPath === undefined) {
        // Was a bare `return`: the node was told to navigate, could not, and said nothing.
        internal.lastError = 'No path to navigate to';
        this.flagOutputDirty('error');
        reportOutcomes(this, tokens, 'failure', {
          code: 'navigate-to-path/no-path',
          message: 'No path to navigate to'
        });
        return;
      }

      const matches = internal.path.match(/\{[A-Za-z0-9_]*\}/g);
      let inputs: string[] = [];
      if (matches) {
        inputs = matches.map(function (name) {
          return name.replace('{', '').replace('}', '');
        });
      }

      inputs.forEach(function (name) {
        const v = internal.params[name];
        formattedPath = formattedPath.replace('{' + name + '}', v !== undefined ? String(v) : '');
      });

      let urlPath, hashPath;
      const navigationPathType = NoodlRuntime.instance.getProjectSettings()['navigationPathType'];
      if (navigationPathType === undefined || navigationPathType === 'hash') hashPath = formattedPath;
      else urlPath = formattedPath;

      const query: string[] = [];
      if (internal.queryNames !== undefined) {
        internal.queryNames.split(',').forEach((q) => {
          if (internal.query[q] !== undefined) {
            query.push(q + '=' + internal.query[q]);
          }
        });
      }

      const compiledUrl =
        (urlPath !== undefined ? urlPath : '') +
        (query.length >= 1 ? '?' + query.join('&') : '') +
        (hashPath !== undefined ? '#' + hashPath : '');

      // Browser-history navigation cannot run server-side; if the graph fires this during an
      // SSR render it degrades to a no-op instead of throwing. ERG-001 §4 named that no-op:
      // `Unchanged`, not `Failure`, for the reason the original line already gave — an SSR pass
      // firing `Failure` would train authors to ignore the port — and not silence, because the
      // silence was the dead chain.
      if (typeof window === 'undefined') {
        reportOutcomes(this, tokens, 'unchanged');
        return;
      }

      if (this._internal.openInNewTab) {
        const opened = window.open(compiledUrl, '_blank');
        if (!opened) {
          internal.lastError = 'The browser blocked opening a new tab';
          this.flagOutputDirty('error');
          reportOutcomes(this, tokens, 'failure', {
            code: 'navigate-to-path/blocked',
            message:
              'The browser blocked opening a new tab — this usually means the navigation was not triggered directly by a user action',
            detail: { url: compiledUrl }
          });
          return;
        }
      } else {
        window.history.pushState({}, '', compiledUrl);
        dispatchEvent(new PopStateEvent('popstate', {}));
      }

      reportOutcomes(this, tokens, 'done');
    },
    setParam(this: NavigateToPathInstance, name: string, value: unknown) {
      this._internal.params[name] = value;
    },
    setQuery(this: NavigateToPathInstance, name: string, value: unknown) {
      this._internal.query[name] = value;
    },
    registerInputIfNeeded: function (this: NavigateToPathInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('p-'))
        return this.registerInput(name, {
          set: this.setParam.bind(this, name.substring('p-'.length))
        });

      if (name.startsWith('q-'))
        return this.registerInput(name, {
          set: this.setQuery.bind(this, name.substring('q-'.length))
        });
    }
  }
};

const NavigateToPathModule: NodeModule = {
  node: NavigateToPathNode,
  setup: function setup(context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection: EditorConnectionLike = context.editorConnection;

    function _managePortsForNode(node: GraphNodeModel) {
      function _updatePorts() {
        // The original declared `ports` twice with `var` — once here, once for the
        // path-parameter mapping below. One binding, same behaviour, single `let` now.
        let ports: DynamicPort[] = [];

        if (node.parameters['path'] !== undefined) {
          const inputs = (node.parameters['path'] as string).match(/\{[A-Za-z0-9_]*\}/g) || [];
          const portsNames = inputs.map(function (def) {
            return def.replace('{', '').replace('}', '');
          });

          ports = portsNames
            //get unique names
            .filter(function (value, index, self) {
              return self.indexOf(value) === index;
            })
            //and map names to ports
            .map(function (name) {
              return {
                name: 'p-' + name,
                displayName: name,
                group: 'Parameter',
                type: '*',
                plug: 'input' as const
              };
            });
        }

        if (node.parameters['queryNames'] !== undefined) {
          (node.parameters['queryNames'] as string).split(',').forEach((q) => {
            ports.push({
              name: 'q-' + q,
              displayName: q,
              group: 'Query',
              plug: 'input',
              type: '*'
            });
          });
        }

        editorConnection.sendDynamicPorts(node.id, ports);
      }

      _updatePorts();
      node.on('parameterUpdated', function () {
        _updatePorts();
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.PageStackNavigateToPath', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('PageStackNavigateToPath')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default NavigateToPathModule;
