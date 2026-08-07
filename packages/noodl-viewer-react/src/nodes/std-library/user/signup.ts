'use strict';

import type {
  EditorConnectionLike,
  GraphNodeModel,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
} from '@noodl/types';
import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot sign up.
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
const SIGN_UP_ERROR_CODE = 'user/sign-up-failed';

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
    /** ERG-001. Invocations of `Do` that have not reported yet — see `login.ts`. */
    pendingSignUp?: OutcomeToken[];
  };
  signUpScheduled?: boolean;
  setError(err: string, tokens?: OutcomeToken[]): void;
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
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Success` renamed to `Done`, plus the universal `Completed`.
    //
    // ⚠️ **No `Unchanged`.** A sign-up either creates an account or is refused; an address that
    // already has one is a backend refusal, not a post-condition that already held.
    ...outcomeOutputs({
      done: 'Fires once the account has been created and signed in',
      failure: 'Fires when the account could not be created, after the reason has been reported on the error channel'
    }),
    error: {
      description: 'Why the last sign-up failed; empty until one does',
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
      description: 'Creates an account from the values below and signs it in',
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: SignUpInstance) {
        this.scheduleSignUp();
      }
    },
    username: {
      description: 'Username for the new account',
      displayName: 'Username',
      type: 'string',
      group: 'General',
      set(this: SignUpInstance, value: string) {
        this._internal.username = value;
      }
    },
    password: {
      description: 'Password for the new account',
      displayName: 'Password',
      type: 'string',
      group: 'General',
      set(this: SignUpInstance, value: string) {
        this._internal.password = value;
      }
    },
    email: {
      description: 'Email address for the new account; leave blank if the project does not ask for one',
      displayName: 'Email',
      type: 'string',
      group: 'General',
      set(this: SignUpInstance, value: string) {
        this._internal.email = value;
      }
    }
  },
  methods: {
    /** ERG-001 — the funnel now reports the outcome too. See `login.ts::setError`. */
    setError(this: SignUpInstance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this.flagOutputDirty('error');

      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: SIGN_UP_ERROR_CODE,
        message: err
      });
    },
    clearWarnings(this: SignUpInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, SIGN_UP_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-login-warning');
      }
    },
    scheduleSignUp(this: SignUpInstance) {
      const internal = this._internal;

      // ERG-001. Minted before the coalescing guard — see `login.ts::scheduleLogIn`.
      const pending = internal.pendingSignUp || (internal.pendingSignUp = []);
      pending.push(this.beginOutcome());

      if (this.signUpScheduled === true) return;
      this.signUpScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.signUpScheduled = false;

        const tokens = internal.pendingSignUp || [];
        internal.pendingSignUp = [];

        UserService.instance.signUp({
          username: this._internal.username,
          password: this._internal.password,
          email: this._internal.email,
          properties: internal.userProperties,
          success: () => {
            reportOutcomes(this, tokens, 'done');
          },
          error: (e) => {
            this.setError(e, tokens);
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
