'use strict';

import NoodlRuntime from '@noodl/runtime';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
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
  };
  scheduleNavigate(): void;
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
      set(this: NavigateToPathInstance, value: string) {
        this._internal.path = value;
      }
    },
    queryNames: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Query',
      group: 'Query',
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
      set(this: NavigateToPathInstance, value) {
        this._internal.openInNewTab = !!value;
      }
    },
    navigate: {
      displayName: 'Navigate',
      group: 'Actions',
      valueChangedToTrue(this: NavigateToPathInstance) {
        this.scheduleNavigate();
      }
    }
  },
  outputs: {},
  methods: {
    scheduleNavigate(this: NavigateToPathInstance) {
      const internal = this._internal;

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

      let formattedPath = internal.path;
      if (formattedPath === undefined) return;

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

      // Browser-history navigation cannot run server-side; if the graph fires
      // this during an SSR render it degrades to a no-op instead of throwing.
      if (typeof window === 'undefined') return;

      if (this._internal.openInNewTab) {
        window.open(compiledUrl, '_blank');
      } else {
        window.history.pushState({}, '', compiledUrl);
        dispatchEvent(new PopStateEvent('popstate', {}));
      }
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
