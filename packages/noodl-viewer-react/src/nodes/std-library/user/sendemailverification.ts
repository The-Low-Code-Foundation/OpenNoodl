'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot send a verification email.
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
const SEND_EMAIL_VERIFICATION_ERROR_CODE = 'user/send-email-verification-failed';

/** `this` inside the Send Email Verification node. */
interface SendEmailVerificationInstance extends NodeInstance {
  _internal: {
    email?: string;
    /** Message from the last failed attempt. */
    error?: string;
  };
  sendScheduled?: boolean;
  setError(err: string): void;
  scheduleSendEmailVerification(): void;
}

const SendEmailVerificationNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.SendEmailVerification',
  docs: 'https://docs.noodl.net/nodes/data/user/send-email-verification',
  displayNodeName: 'Send Email Verification',
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
      getter: function (this: SendEmailVerificationInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    send: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: SendEmailVerificationInstance) {
        this.scheduleSendEmailVerification();
      }
    },
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'General',
      set: function (this: SendEmailVerificationInstance, value: string) {
        this._internal.email = value;
      }
    }
  },
  methods: {
    setError: function (this: SendEmailVerificationInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      this.raiseRuntimeError(SEND_EMAIL_VERIFICATION_ERROR_CODE, err);
    },
    clearWarnings(this: SendEmailVerificationInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, SEND_EMAIL_VERIFICATION_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-send-email-verification-warning');
      }
    },
    scheduleSendEmailVerification: function (this: SendEmailVerificationInstance) {
      if (this.sendScheduled === true) return;
      this.sendScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.sendScheduled = false;

        UserService.instance.sendEmailVerification({
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

const SendEmailVerificationModule: NodeModule = {
  node: SendEmailVerificationNodeDefinition,
  setup: function () {}
};

export default SendEmailVerificationModule;
