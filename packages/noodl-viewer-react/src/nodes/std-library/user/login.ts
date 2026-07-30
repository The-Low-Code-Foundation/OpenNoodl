'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot log in.
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
const LOG_IN_ERROR_CODE = 'user/log-in-failed';

/** `this` inside the Log In node. */
interface LogInInstance extends NodeInstance {
  _internal: {
    username?: string;
    password?: string;
    /** Message from the last failed attempt; drives both the `error` output and the warning. */
    error?: string;
  };
  logInScheduled?: boolean;
  setError(err: string): void;
  scheduleLogIn(): void;
}

const LoginNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.LogIn',
  docs: 'https://docs.noodl.net/nodes/data/user/log-in',
  displayNodeName: 'Log In',
  category: 'Cloud Services',
  color: 'data',
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
      getter(this: LogInInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    login: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: LogInInstance) {
        this.scheduleLogIn();
      }
    },
    username: {
      displayName: 'Username',
      type: 'string',
      group: 'General',
      set(this: LogInInstance, value: string) {
        this._internal.username = value;
      }
    },
    password: {
      displayName: 'Password',
      type: 'string',
      group: 'General',
      set(this: LogInInstance, value: string) {
        this._internal.password = value;
      }
    }
  },
  methods: {
    setError(this: LogInInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      this.raiseRuntimeError(LOG_IN_ERROR_CODE, err);
    },
    clearWarnings(this: LogInInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, LOG_IN_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-login-warning');
      }
    },
    scheduleLogIn(this: LogInInstance) {
      if (this.logInScheduled === true) return;
      this.logInScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.logInScheduled = false;

        UserService.instance.logIn({
          username: this._internal.username,
          password: this._internal.password,
          success: () => {
            this.sendSignalOnOutput('success');
          },
          error: (e) => {
            this.setError(e);
          }
        });
      });
    }
  }
};

const LogInModule: NodeModule = {
  node: LoginNodeDefinition,
  setup() {}
};

export default LogInModule;
