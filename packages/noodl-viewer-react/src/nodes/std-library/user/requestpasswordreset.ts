'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

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

      if (this.context.editorConnection) {
        this.context.editorConnection.sendWarning(
          this.nodeScope.componentOwner.name,
          this.id,
          'user-request-password-reset-warning',
          {
            message: err,
            showGlobally: true
          }
        );
      }
    },
    clearWarnings(this: RequestPasswordResetInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(
          this.nodeScope.componentOwner.name,
          this.id,
          'user-request-password-reset-warning'
        );
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
