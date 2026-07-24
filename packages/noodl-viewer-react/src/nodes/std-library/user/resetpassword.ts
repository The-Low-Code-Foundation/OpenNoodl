'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/** `this` inside the Reset Password node. */
interface ResetPasswordInstance extends NodeInstance {
  _internal: {
    token?: string;
    username?: string;
    newPassword?: string;
    /** Message from the last failed attempt. */
    error?: string;
  };
  resetPasswordScheduled?: boolean;
  setError(err: string): void;
  scheduleResetPassword(): void;
}

const ResetPasswordNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.ResetPassword',
  docs: 'https://docs.noodl.net/nodes/data/user/reset-password',
  displayNodeName: 'Reset Password',
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
      getter: function (this: ResetPasswordInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    reset: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: ResetPasswordInstance) {
        this.scheduleResetPassword();
      }
    },
    token: {
      type: 'string',
      displayName: 'Token',
      group: 'General',
      set: function (this: ResetPasswordInstance, value: string) {
        this._internal.token = value;
      }
    },
    username: {
      type: 'string',
      displayName: 'Username',
      group: 'General',
      set: function (this: ResetPasswordInstance, value: string) {
        this._internal.username = value;
      }
    },
    newPassword: {
      type: 'string',
      displayName: 'New Password',
      group: 'General',
      set: function (this: ResetPasswordInstance, value: string) {
        this._internal.newPassword = value;
      }
    }
  },
  methods: {
    setError: function (this: ResetPasswordInstance, err: string) {
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
    clearWarnings(this: ResetPasswordInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(
          this.nodeScope.componentOwner.name,
          this.id,
          'user-verify-email-warning'
        );
      }
    },
    scheduleResetPassword: function (this: ResetPasswordInstance) {
      if (this.resetPasswordScheduled === true) return;
      this.resetPasswordScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.resetPasswordScheduled = false;

        UserService.instance.resetPassword({
          token: this._internal.token,
          username: this._internal.username,
          newPassword: this._internal.newPassword,
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

const ResetPasswordModule: NodeModule = {
  node: ResetPasswordNodeDefinition,
  setup: function () {}
};

export default ResetPasswordModule;
