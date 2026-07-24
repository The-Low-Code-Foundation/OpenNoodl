'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

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

      if (this.context.editorConnection) {
        this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'user-login-warning', {
          message: err,
          showGlobally: true
        });
      }
    },
    clearWarnings(this: LogInInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'user-login-warning');
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
