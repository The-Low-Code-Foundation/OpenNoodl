'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot reset a password.
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
const RESET_PASSWORD_ERROR_CODE = 'user/reset-password-failed';

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

      this.raiseRuntimeError(RESET_PASSWORD_ERROR_CODE, err);
    },
    clearWarnings(this: ResetPasswordInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, RESET_PASSWORD_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-reset-password-warning');
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
