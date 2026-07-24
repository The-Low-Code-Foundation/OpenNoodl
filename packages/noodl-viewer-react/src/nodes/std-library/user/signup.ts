'use strict';

import type {
  EditorConnectionLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

import UserService from './userservice';

/** `this` inside the Sign Up node. */
interface SignUpInstance extends NodeInstance {
  _internal: {
    username?: string;
    password?: string;
    email?: string;
    /** Extra `_User` columns, collected from the `prop-…` inputs. */
    userProperties: Record<string, unknown>;
    /** Message from the last failed attempt. */
    error?: string;
  };
  signUpScheduled?: boolean;
  setError(err: string): void;
  setUserProperty(name: string, value: unknown): void;
  scheduleSignUp(): void;
}

/**
 * One entry of the `systemCollections` project metadata — the backend's class schemas, as
 * the editor pushed them. This node reads `_User`'s to discover which columns a project has
 * added, and turns each into an input port.
 */
interface SystemCollection {
  name: string;
  schema?: {
    /** Column name → column type, in Parse's spelling (`String`, `Number`, `Relation`, …). */
    properties?: Record<string, { type?: string }>;
  };
}

const SignUpNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.SignUp',
  docs: 'https://docs.noodl.net/nodes/data/user/sign-up',
  displayNodeName: 'Sign Up',
  category: 'Cloud Services',
  color: 'data',
  initialize(this: SignUpInstance) {
    const internal = this._internal;
    internal.userProperties = {};
  },
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
      getter(this: SignUpInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    signup: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: SignUpInstance) {
        this.scheduleSignUp();
      }
    },
    username: {
      displayName: 'Username',
      type: 'string',
      group: 'General',
      set(this: SignUpInstance, value: string) {
        this._internal.username = value;
      }
    },
    password: {
      displayName: 'Password',
      type: 'string',
      group: 'General',
      set(this: SignUpInstance, value: string) {
        this._internal.password = value;
      }
    },
    email: {
      displayName: 'Email',
      type: 'string',
      group: 'General',
      set(this: SignUpInstance, value: string) {
        this._internal.email = value;
      }
    }
  },
  methods: {
    setError(this: SignUpInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      if (this.context.editorConnection) {
        this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'user-login-warning', {
          message: err,
          showGlobally: true
        });
      }
    },
    clearWarnings(this: SignUpInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'user-login-warning');
      }
    },
    scheduleSignUp(this: SignUpInstance) {
      const internal = this._internal;

      if (this.signUpScheduled === true) return;
      this.signUpScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.signUpScheduled = false;

        UserService.instance.signUp({
          username: this._internal.username,
          password: this._internal.password,
          email: this._internal.email,
          properties: internal.userProperties,
          success: () => {
            this.sendSignalOnOutput('success');
          },
          error: (e) => {
            this.setError(e);
          }
        });
      });
    },
    setUserProperty(this: SignUpInstance, name: string, value: unknown) {
      this._internal.userProperties[name] = value;
    },
    // The `runtime-discovered` mechanism: `prop-<column>` inputs are created on demand,
    // and `updatePorts` below is what tells the editor they exist.
    registerInputIfNeeded(this: SignUpInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('prop-')) {
        return this.registerInput(name, {
          set: this.setUserProperty.bind(this, name.substring('prop-'.length))
        });
      }
    }
  }
};

function updatePorts(
  nodeId: string,
  _parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  systemCollections: SystemCollection[] | undefined
): void {
  const ports: {
    type: { name: string };
    plug: string;
    group: string;
    name: string;
    displayName: string;
  }[] = [];

  if (systemCollections) {
    // Fetch ports from collection keys
    const c = systemCollections.find((c) => c.name === '_User');
    if (c && c.schema && c.schema.properties) {
      const props = c.schema.properties;
      // The columns the node already has dedicated inputs for, plus the ones Parse owns.
      const _ignoreKeys = ['authData', 'password', 'username', 'createdAt', 'updatedAt', 'emailVerified', 'email'];
      for (const key in props) {
        if (_ignoreKeys.indexOf(key) !== -1) continue;

        const p = props[key];
        if (ports.find((_p) => _p.name === key)) continue;

        if (p.type === 'Relation') {
          // Relations cannot be set at sign-up time, so they get no port.
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

const SignUpModule: NodeModule = {
  node: SignUpNodeDefinition,
  setup(context: NodeContextLike, graphModel) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(
        node.id,
        node.parameters,
        editorConnection,
        graphModel.getMetaData('systemCollections') as SystemCollection[] | undefined
      );

      node.on('parameterUpdated', function () {
        updatePorts(
          node.id,
          node.parameters,
          editorConnection,
          graphModel.getMetaData('systemCollections') as SystemCollection[] | undefined
        );
      });

      graphModel.on('metadataChanged.systemCollections', function (data: SystemCollection[] | undefined) {
        updatePorts(node.id, node.parameters, editorConnection, data);
      });
    }

    // Unlike every other node here, the ports depend on project *metadata* rather than on
    // the node's own parameters — so the wiring waits for the import to finish and then
    // covers both the nodes already present and any added later.
    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.net.noodl.user.SignUp', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('net.noodl.user.SignUp')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default SignUpModule;
