'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot verify an email address.
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
const VERIFY_EMAIL_ERROR_CODE = 'user/verify-email-failed';

/** `this` inside the Verify Email node. */
interface VerifyEmailInstance extends NodeInstance {
  _internal: {
    token?: string;
    username?: string;
    /** Message from the last failed attempt. */
    error?: string;
  };
  verifyEmailScheduled?: boolean;
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
      description: 'Fires once the address has been confirmed',
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      description:
        'Fires when the token was rejected or the request could not be made, after the reason has been reported on the error channel',
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      description: 'Why the last attempt failed; empty until one does',
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
      description: 'Confirms the address using the token from the verification email',
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: VerifyEmailInstance) {
        this.scheduleVerifyEmail();
      }
    },
    token: {
      description: 'Verification token taken from the link in the email',
      type: 'string',
      displayName: 'Token',
      group: 'General',
      set: function (this: VerifyEmailInstance, value: string) {
        this._internal.token = value;
      }
    },
    username: {
      description: 'Username the verification link was issued for',
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

      this.raiseRuntimeError(VERIFY_EMAIL_ERROR_CODE, err);
    },
    clearWarnings(this: VerifyEmailInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, VERIFY_EMAIL_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-verify-email-warning');
      }
    },
    scheduleVerifyEmail: function (this: VerifyEmailInstance) {
      if (this.verifyEmailScheduled === true) return;
      this.verifyEmailScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.verifyEmailScheduled = false;

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
