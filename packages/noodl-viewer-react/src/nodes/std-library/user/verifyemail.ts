'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/** `this` inside the Verify Email node. */
interface VerifyEmailInstance extends NodeInstance {
  _internal: {
    token?: string;
    username?: string;
    /** Message from the last failed attempt. */
    error?: string;
  };
  /**
   * Copy-pasted from the Log Out node, which is why it is named for logging out. Harmless —
   * it is a private per-instance flag and this node has nothing else using the name.
   */
  logOutScheduled?: boolean;
  setError(err: string): void;
  scheduleVerifyEmail(): void;
}

const VerifyEmailNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.VerifyEmail',
  docs: 'https://docs.noodl.net/nodes/data/user/verify-email',
  displayNodeName: 'Verify Email',
  category: 'Cloud Services',
  color: 'data',
  deprecated: true, // Use cloud functions
  initialize: function () {},
  /** Deliberately empty: this node has nothing worth showing in the inspector. */
  getInspectInfo(): InspectInfo | void {},
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
      getter: function (this: VerifyEmailInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    verify: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: VerifyEmailInstance) {
        this.scheduleVerifyEmail();
      }
    },
    token: {
      type: 'string',
      displayName: 'Token',
      group: 'General',
      set: function (this: VerifyEmailInstance, value: string) {
        this._internal.token = value;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username',
      group: 'General',
      set: function (this: VerifyEmailInstance, value: string) {
        this._internal.username = value;
      }
    }
  },
  methods: {
    setError: function (this: VerifyEmailInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      if (this.context.editorConnection) {
        this.context.editorConnection.sendWarning(
          this.nodeScope.componentOwner.name,
          this.id,
          'user-verify-email-warning',
          {
            message: err,
            showGlobally: true
          }
        );
      }
    },
    clearWarnings(this: VerifyEmailInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(
          this.nodeScope.componentOwner.name,
          this.id,
          'user-verify-email-warning'
        );
      }
    },
    scheduleVerifyEmail: function (this: VerifyEmailInstance) {
      if (this.logOutScheduled === true) return;
      this.logOutScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.logOutScheduled = false;

        UserService.instance.verifyEmail({
          token: this._internal.token,
          username: this._internal.username,
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

const VerifyEmailModule: NodeModule = {
  node: VerifyEmailNodeDefinition,
  setup: function () {}
};

export default VerifyEmailModule;
