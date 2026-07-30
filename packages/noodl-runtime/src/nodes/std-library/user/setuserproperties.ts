'use strict';

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot write user properties.
 *
 * The graph half was always right: `failure` and `error` are real ports. The *diagnosis*
 * went to `editorConnection.sendWarning` and therefore existed only on the canvas.
 *
 * Per node rather than one code for the family (`record/storage-op-failed`'s choice),
 * because there the family shares a single `setError` funnel and the message is what
 * distinguishes the cases; here every node has its own funnel and the *operation* is the
 * distinguishing fact, so the code should carry it.
 *
 * It is also the editor's warning key — the bus's editor subscriber keys by `code` — so
 * `clearWarnings` names this same constant. Raise and clear move together, always.
 */
const SET_USER_PROPERTIES_ERROR_CODE = 'user/set-properties-failed';

const NoodlRuntime = require('../../../../noodl-runtime');

/** A class in the backend schema, as the editor reports it in `systemCollections`. */
interface SystemCollection {
  name: string;
  schema?: { properties?: Record<string, { type?: string }> };
}

/**
 * `this` inside the Set User Properties node.
 *
 * The port set is `runtime-discovered`: every writable column of the `_User` class becomes
 * a `prop-<key>` input, both here (via `registerInputIfNeeded`) and editor-side (via
 * `setup` below). The `prop-` prefix is what keeps those apart from the node's own
 * `email`/`username` ports, and it is stripped again before the value is stored.
 */
interface SetUserPropertiesNodeInstance extends NodeInstance {
  _internal: {
    userProperties: Record<string, unknown>;
    email?: string;
    username?: string;
    error?: string;
  };
  /** On the instance rather than in `_internal`, like String Format's `formatScheduled`. */
  storeScheduled?: boolean;
  setError(err: string): void;
  clearWarnings(): void;
  scheduleStore(): void;
  setUserProperty(name: string, value: unknown): void;
}

const SetUserPropertiesNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.SetUserProperties',
  docs: 'https://docs.noodl.net/nodes/data/user/set-user-properties',
  displayNodeName: 'Set User Properties',
  category: 'Cloud Services',
  color: 'data',
  initialize: function (this: SetUserPropertiesNodeInstance) {
    const internal = this._internal;

    internal.userProperties = {};
  },
  getInspectInfo() {},
  outputs: {
    success: {
      type: 'signal',
      displayName: 'Success',
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
      getter: function (this: SetUserPropertiesNodeInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    store: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: SetUserPropertiesNodeInstance) {
        this.scheduleStore();
      }
    },
    email: {
      displayName: 'Email',
      type: 'string',
      group: 'General',
      set: function (this: SetUserPropertiesNodeInstance, value: string) {
        this._internal.email = value;
      }
    },
    username: {
      displayName: 'Username',
      type: 'string',
      group: 'General',
      set: function (this: SetUserPropertiesNodeInstance, value: string) {
        this._internal.username = value;
      }
    }
  },
  methods: {
    setError: function (this: SetUserPropertiesNodeInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      this.raiseRuntimeError(SET_USER_PROPERTIES_ERROR_CODE, err);
    },
    clearWarnings(this: SetUserPropertiesNodeInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, SET_USER_PROPERTIES_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-set-warning');
      }
    },
    scheduleStore: function (this: SetUserPropertiesNodeInstance) {
      const internal = this._internal;

      if (this.storeScheduled === true) return;
      this.storeScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.storeScheduled = false;

        const UserService = NoodlRuntime.Services.UserService;
        UserService.forScope(this.nodeScope.modelScope).setUserProperties({
          email: this._internal.email,
          username: this._internal.username,
          properties: internal.userProperties,
          success: () => {
            this.sendSignalOnOutput('success');
          },
          // `UserService` always hands the error callback a string, never an Error —
          // every method unwraps the backend's `{ error, code }` first (NOTES §15.x).
          error: (e: string) => {
            this.setError(e);
          }
        });
      });
    },
    setUserProperty: function (this: SetUserPropertiesNodeInstance, name: string, value: unknown) {
      this._internal.userProperties[name] = value;
    },
    registerInputIfNeeded: function (this: SetUserPropertiesNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        return this.registerInput(name, {
          set: this.setUserProperty.bind(this, name.substring('prop-'.length))
        });
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

      // Server-side, `password` and `emailVerified` are writable and so become ports;
      // in the browser viewer they are not, hence the two lists.
      const _ignoreKeys =
        typeof _noodl_cloud_runtime_version === 'undefined'
          ? ['authData', 'createdAt', 'updatedAt', 'email', 'username', 'emailVerified', 'password']
          : ['authData', 'createdAt', 'updatedAt', 'email', 'username'];

      for (const key in props) {
        if (_ignoreKeys.indexOf(key) !== -1) continue;

        const p = props[key];
        if (ports.find((_p) => _p.name === key)) continue;

        if (p.type === 'Relation') {
          // Relations are not settable through this node.
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
            plug: 'input',
            group: 'Properties',
            name: 'prop-' + key,
            displayName: key
          });
        }
      }
    }
  }

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const SetUserPropertiesNodeModule: NodeModule = {
  node: SetUserPropertiesNodeDefinition,
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
      graphModel.on('nodeAdded.net.noodl.user.SetUserProperties', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('net.noodl.user.SetUserProperties')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = SetUserPropertiesNodeModule;
