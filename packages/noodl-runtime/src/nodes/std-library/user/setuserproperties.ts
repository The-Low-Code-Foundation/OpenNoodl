'use strict';

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import { isParseWireContext } from '../data/record-ports';
import { sendSchemaPorts, staticPortNames } from '../data/schema-ports';
import {
  USER_INPUT_IGNORE_PARSE_BROWSER,
  USER_INPUT_IGNORE_PARSE_CLOUD,
  USER_INPUT_IGNORE_REST,
  userBackendPickerPorts,
  userPropertyPorts,
  userSchemaContext
} from './user-ports';

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
    /** The `Backend` picker's value. Absent and `_active_` both mean "the default". */
    backendId?: string;
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
      group: 'Events',
      description: 'Fires once the user record has been written'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events',
      description: 'Fires when the user record could not be written, after the reason has been reported on the error channel'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the last write failed; empty until one does',
      getter: function (this: SetUserPropertiesNodeInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    store: {
      displayName: 'Do',
      group: 'Actions',
      description: 'Writes the values below to the signed-in user; does nothing at all while nobody is signed in',
      valueChangedToTrue: function (this: SetUserPropertiesNodeInstance) {
        this.scheduleStore();
      }
    },
    email: {
      displayName: 'Email',
      type: 'string',
      group: 'General',
      description: 'New email address for the signed-in user; leave blank to keep the current one',
      set: function (this: SetUserPropertiesNodeInstance, value: string) {
        this._internal.email = value;
      }
    },
    username: {
      displayName: 'Username',
      type: 'string',
      group: 'General',
      description: 'New username for the signed-in user; leave blank to keep the current one',
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
          backendId: this._internal.backendId,
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

      // The `Backend` picker — BCN-009 step 4. A dynamic port with no branch here
      // silently drops its value, which is what "the node has a Backend dropdown
      // that does nothing" looks like.
      if (name === 'backendId')
        return this.registerInput(name, {
          set: (value: unknown) => {
            this._internal.backendId = value as string;
          }
        });

      if (name.startsWith('prop-'))
        return this.registerInput(name, {
          set: this.setUserProperty.bind(this, name.substring('prop-'.length))
        });
    }
  }
};

/**
 * The node's ports, from whichever backend the `Backend` input names —
 * BCN-006 step 6.
 *
 * ⚠️ The Parse-wire ignore list still differs by runtime, and that is a real
 * difference rather than a leftover: server-side, `password` and `emailVerified`
 * **are** writable columns on the `_User` row; in the browser they are not. The
 * REST list is derived from what the adapter strips, so this node cannot offer a
 * port for a field the write path would silently discard — see `user-ports.ts`
 * rule 3.
 */
function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ctx = userSchemaContext(graphModel, parameters);

  const ignore = isParseWireContext(ctx)
    ? typeof _noodl_cloud_runtime_version === 'undefined'
      ? USER_INPUT_IGNORE_PARSE_BROWSER
      : USER_INPUT_IGNORE_PARSE_CLOUD
    : USER_INPUT_IGNORE_REST;

  const ports: RuntimeDiscoveredPort[] = ([] as RuntimeDiscoveredPort[])
    .concat(userBackendPickerPorts(ctx))
    .concat(userPropertyPorts(ctx, { plug: 'input', ignore }));

  sendSchemaPorts(editorConnection, nodeId, ports, {
    staticPorts: staticPortNames(
      SetUserPropertiesNodeDefinition as { inputs?: Record<string, unknown>; outputs?: Record<string, unknown> }
    )
  });
}

const SetUserPropertiesNodeModule: NodeModule = {
  node: SetUserPropertiesNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      const rebuild = () => updatePorts(node.id, node.parameters, context.editorConnection, graphModel);

      rebuild();
      node.on('parameterUpdated', rebuild);

      // Three keys, for the reason `user.ts` records: the port set now depends on
      // the selected backend and its introspected schema as well as on the
      // Parse-wire cache.
      graphModel.on('metadataChanged.systemCollections', rebuild);
      graphModel.on('metadataChanged.dbCollections', rebuild);
      graphModel.on('metadataChanged.backendServices', rebuild);
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
