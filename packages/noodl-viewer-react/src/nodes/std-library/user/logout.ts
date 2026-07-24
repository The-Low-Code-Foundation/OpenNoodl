'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/** `this` inside the Log Out node. */
interface LogOutInstance extends NodeInstance {
  _internal: {
    /** Message from the last failed attempt. */
    error?: string;
  };
  logOutScheduled?: boolean;
  setError(err: string): void;
  scheduleLogOut(): void;
}

const LogOutNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.LogOut',
  docs: 'https://docs.noodl.net/nodes/data/user/log-out',
  displayNodeName: 'Log Out',
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
      getter(this: LogOutInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    // Named `login` rather than `logout`: the port name is persisted in every project that
    // uses this node, so it cannot be corrected without breaking them.
    login: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: LogOutInstance) {
        this.scheduleLogOut();
      }
    }
  },
  methods: {
    setError(this: LogOutInstance, err: string) {
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
    clearWarnings(this: LogOutInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'user-login-warning');
      }
    },
    scheduleLogOut(this: LogOutInstance) {
      if (this.logOutScheduled === true) return;
      this.logOutScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.logOutScheduled = false;

        UserService.instance.logOut({
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

const LogOutModule: NodeModule = {
  node: LogOutNodeDefinition,
  setup() {}
};

export default LogOutModule;
