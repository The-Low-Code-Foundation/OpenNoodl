'use strict';

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

const NoodlRuntime = require('../../../../noodl-runtime');
const { Node } = require('../../../../noodl-runtime');

/** A class in the backend schema, as the editor reports it in `systemCollections`. */
interface SystemCollection {
  name: string;
  schema?: { properties?: Record<string, { type?: string }> };
}

/**
 * `this` inside the User node.
 *
 * The port set is `runtime-discovered` on the *output* side: every readable column of the
 * `_User` class becomes a `prop-<key>` output plus a `changed-<key>` signal, and three
 * session signals (`loggedIn`/`loggedOut`/`sessionLost`) exist only in the browser. Those
 * three are declared nowhere in `outputs` — the commented-out block there is the original
 * static declaration, superseded by `registerOutputIfNeeded` and `updatePorts`.
 */
interface UserNodeInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    error?: string;
    onModelChangedCallback(args: ModelChangeEvent): void;
    /** `hasScheduled<Type>` flags, written by {@link scheduleOnce}. */
    [flag: string]: unknown;
  };
  scheduleOnce(type: string, cb: () => void): void;
  setError(err: string): void;
  clearWarnings(): void;
  setUserModel(model: ModelLike | undefined): void;
  scheduleFetch(): void;
  getUserProperty(name: string): unknown;
}

const UserNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.User',
  docs: 'https://docs.noodl.net/nodes/data/user/user-node',
  displayNodeName: 'User',
  category: 'Cloud Services',
  color: 'data',
  ssr: {
    compat: 'partial',
    note: 'Sessions live in browser storage; a server render always sees a logged-out user.'
  },
  initialize: function (this: UserNodeInstance) {
    const _this = this;
    this._internal.onModelChangedCallback = function (args: ModelChangeEvent) {
      if (_this.isInputConnected('fetch')) return;

      if (_this.hasOutput('prop-' + args.name)) _this.flagOutputDirty('prop-' + args.name);

      if (_this.hasOutput('changed-' + args.name)) _this.sendSignalOnOutput('changed-' + args.name);

      _this.sendSignalOnOutput('changed');
    };

    const userService = NoodlRuntime.Services.UserService.forScope(this.nodeScope.modelScope);

    this.setUserModel(userService.current);
    userService.on('loggedIn', () => {
      this.setUserModel(userService.current);

      if (this.hasOutput('loggedIn')) this.sendSignalOnOutput('loggedIn');
    });

    userService.on('sessionGained', () => {
      this.setUserModel(userService.current);
    });

    userService.on('loggedOut', () => {
      this.setUserModel(undefined);
      if (this.hasOutput('loggedOut')) this.sendSignalOnOutput('loggedOut');
    });

    userService.on('sessionLost', () => {
      this.setUserModel(undefined);
      if (this.hasOutput('sessionLost')) this.sendSignalOnOutput('sessionLost');
    });
  },
  getInspectInfo(this: UserNodeInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return '[No Model]';

    return [
      { type: 'text', value: 'Id: ' + model.getId() },
      { type: 'value', value: this._internal.model.data }
    ];
  },
  outputs: {
    id: {
      type: 'string',
      displayName: 'Id',
      group: 'General',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined ? this._internal.model.getId() : undefined;
      }
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events'
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
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
      group: 'Error',
      getter: function (this: UserNodeInstance) {
        return this._internal.error;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username',
      group: 'General',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined ? this._internal.model.get('username') : undefined;
      }
    },
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'General',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined ? this._internal.model.get('email') : undefined;
      }
    },
    authenticated: {
      type: 'boolean',
      displayName: 'Authenticated',
      group: 'General',
      getter: function (this: UserNodeInstance) {
        return this._internal.model !== undefined;
      }
    }
    /*    loggedIn:{
            type:'signal',
            displayName:'Logged In',
            group:'Events'
        },
        loggedOut:{
            type:'signal',
            displayName:'Logged Out',
            group:'Events'
        },
        sessionLost:{
            type:'signal',
            displayName:'Session Lost',
            group:'Events'
        },         */
  },
  inputs: {
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: UserNodeInstance) {
        this.scheduleFetch();
      }
    }
  },
  methods: {
    _onNodeDeleted: function (this: UserNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      if (this._internal.model) this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    scheduleOnce: function (this: UserNodeInstance, type: string, cb: () => void) {
      const _this = this;
      const _type = 'hasScheduled' + type;
      if (this._internal[_type]) return;
      this._internal[_type] = true;
      this.scheduleAfterInputsHaveUpdated(function () {
        _this._internal[_type] = false;
        cb();
      });
    },
    setError: function (this: UserNodeInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      if (this.context.editorConnection) {
        this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'user-warning', {
          message: err,
          showGlobally: true
        });
      }
    },
    clearWarnings(this: UserNodeInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'user-warning');
      }
    },
    setUserModel(this: UserNodeInstance, model: ModelLike | undefined) {
      const internal = this._internal;

      if (internal.model !== model) {
        // Check if we need to change model
        if (internal.model)
          // Remove old listener if existing
          internal.model.off('change', internal.onModelChangedCallback);

        internal.model = model;
        if (model) model.on('change', internal.onModelChangedCallback);
      }
      this.flagOutputDirty('id');
      this.flagOutputDirty('authenticated');
      this.flagOutputDirty('email');
      this.flagOutputDirty('username');

      // Notify all properties changed
      if (model)
        for (const key in model.data) {
          if (this.hasOutput('prop-' + key)) this.flagOutputDirty('prop-' + key);
        }
    },
    scheduleFetch: function (this: UserNodeInstance) {
      this.scheduleOnce('Fetch', () => {
        const userService = NoodlRuntime.Services.UserService.forScope(this.nodeScope.modelScope);
        userService.fetchCurrentUser({
          // The response is deliberately unused — `userService.current` is the source of
          // truth and the callback only signals that it has settled.
          success: () => {
            this.setUserModel(userService.current);

            this.sendSignalOnOutput('fetched');
          },
          error: (err: string) => {
            this.setError(err || 'Failed to fetch.');
          }
        });
      });
    },
    registerOutputIfNeeded: function (this: UserNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name === 'loggedOut' || name === 'loggedIn' || name === 'sessionLost') {
        this.registerOutput(name, {
          getter: () => {} /* No getter needed, signal */
        });
        return;
      }

      if (name.startsWith('prop-'))
        this.registerOutput(name, {
          getter: this.getUserProperty.bind(this, name.substring('prop-'.length))
        });
    },
    getUserProperty: function (this: UserNodeInstance, name: string) {
      return this._internal.model !== undefined ? this._internal.model.get(name) : undefined;
    }
  }
};

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  systemCollections: SystemCollection[] | undefined
) {
  const ports: Record<string, unknown>[] = [];

  if (systemCollections) {
    // Fetch ports from collection keys
    const c = systemCollections.find((c) => c.name === '_User');
    if (c && c.schema && c.schema.properties) {
      const props = c.schema.properties;
      const _ignoreKeys = ['authData', 'password', 'username', 'email'];
      for (const key in props) {
        if (_ignoreKeys.indexOf(key) !== -1) continue;

        const p = props[key];
        if (ports.find((_p) => _p.name === key)) continue;

        if (p.type === 'Relation') {
          // Relations are not readable through this node.
        } else {
          // Other schema type ports
          const _typeMap: Record<string, string> = {
            String: 'string',
            Boolean: 'boolean',
            Number: 'number',
            Date: 'date'
          };

          ports.push({
            type: {
              name: _typeMap[p.type] ? _typeMap[p.type] : '*'
            },
            plug: 'output',
            group: 'Properties',
            name: 'prop-' + key,
            displayName: key
          });

          ports.push({
            type: 'signal',
            plug: 'output',
            group: 'Changed Events',
            displayName: key + ' Changed',
            name: 'changed-' + key
          });
        }
      }
    }
  }

  if (typeof _noodl_cloud_runtime_version === 'undefined') {
    // On the client we have some extra outputs
    ports.push({
      plug: 'output',
      name: 'loggedIn',
      type: 'signal',
      displayName: 'Logged In',
      group: 'Events'
    });

    ports.push({
      plug: 'output',
      name: 'loggedOut',
      type: 'signal',
      displayName: 'Logged Out',
      group: 'Events'
    });

    ports.push({
      plug: 'output',
      name: 'sessionLost',
      type: 'signal',
      displayName: 'Session Lost',
      group: 'Events'
    });
  }

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const UserNodeModule: NodeModule = {
  node: UserNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(
        node.id,
        node.parameters,
        context.editorConnection,
        graphModel.getMetaData('systemCollections') as SystemCollection[]
      );

      node.on('parameterUpdated', function () {
        updatePorts(
          node.id,
          node.parameters,
          context.editorConnection,
          graphModel.getMetaData('systemCollections') as SystemCollection[]
        );
      });

      graphModel.on('metadataChanged.systemCollections', function (data: SystemCollection[]) {
        updatePorts(node.id, node.parameters, context.editorConnection, data);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.net.noodl.user.User', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('net.noodl.user.User')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = UserNodeModule;
