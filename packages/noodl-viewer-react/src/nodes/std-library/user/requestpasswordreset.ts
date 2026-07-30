'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot request a password reset.
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
const REQUEST_PASSWORD_RESET_ERROR_CODE = 'user/request-password-reset-failed';

/** `this` inside the Request Password Reset node. */
interface RequestPasswordResetInstance extends NodeInstance {
  _internal: {
    email?: string;
    /** Message from the last failed attempt. */
    error?: string;
  };
  sendScheduled?: boolean;
  setError(err: string): void;
  scheduleRequestPasswordReset(): void;
}

const RequestPasswordResetNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.RequestPasswordReset',
  docs: 'https://docs.noodl.net/nodes/data/user/request-password-reset',
  displayNodeName: 'Request Password Reset',
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
      getter: function (this: RequestPasswordResetInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    send: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: RequestPasswordResetInstance) {
        this.scheduleRequestPasswordReset();
      }
    },
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'General',
      set: function (this: RequestPasswordResetInstance, value: string) {
        this._internal.email = value;
      }
    }
  },
  methods: {
    setError: function (this: RequestPasswordResetInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      this.raiseRuntimeError(REQUEST_PASSWORD_RESET_ERROR_CODE, err);
    },
    clearWarnings(this: RequestPasswordResetInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, REQUEST_PASSWORD_RESET_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-request-password-reset-warning');
      }
    },
    scheduleRequestPasswordReset: function (this: RequestPasswordResetInstance) {
      if (this.sendScheduled === true) return;
      this.sendScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.sendScheduled = false;

        UserService.instance.requestPasswordReset({
          email: this._internal.email,
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

const RequestPasswordResetModule: NodeModule = {
  node: RequestPasswordResetNodeDefinition,
  setup: function () {}
};

export default RequestPasswordResetModule;
