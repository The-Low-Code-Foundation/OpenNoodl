'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/**
 * Request Magic Link — ask the backend to email a one-click sign-in link
 * (BAK-004).
 *
 * **Success does not mean the account exists.** The endpoint behind this node
 * answers identically for a known and an unknown address, because a public
 * anonymous endpoint that answers differently is an account-existence oracle —
 * the same reason Request Password Reset behaves this way. So the only honest
 * message to show on Success is "if that address has an account, a link is on
 * its way", and a UI that says "check your inbox" only for real users hands
 * back the oracle the backend just removed.
 *
 * Failure here means the REQUEST failed (no backend, network error, rate
 * limited), never "no such user".
 *
 * The click itself is handled by the runtime: the link comes back to the app
 * with a one-time code that UserService picks up on load, exactly like a
 * provider sign-in. Use a Sign In With node on the landing page to react to the
 * outcome.
 */
interface RequestMagicLinkInstance extends NodeInstance {
  _internal: {
    email?: string;
    redirect?: string;
    error?: string;
  };
  sendScheduled?: boolean;
  setError(err: string): void;
  scheduleSend(): void;
}

const RequestMagicLinkNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.RequestMagicLink',
  displayNodeName: 'Request Magic Link',
  category: 'Cloud Services',
  color: 'data',
  ssr: {
    compat: 'partial',
    note: 'Sends a request from the browser; a server render never triggers it.'
  },
  initialize() {},
  getInspectInfo(this: RequestMagicLinkInstance): InspectInfo | void {
    if (this._internal.error) return [{ type: 'text', value: `Error: ${this._internal.error}` }];
  },
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
      getter(this: RequestMagicLinkInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    send: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: RequestMagicLinkInstance) {
        this.scheduleSend();
      }
    },
    email: {
      type: 'string',
      displayName: 'Email',
      group: 'General',
      set(this: RequestMagicLinkInstance, value: string) {
        this._internal.email = value;
      }
    },
    redirect: {
      type: 'string',
      displayName: 'Redirect',
      group: 'General',
      set(this: RequestMagicLinkInstance, value: string) {
        this._internal.redirect = value;
      }
    }
  },
  methods: {
    setError(this: RequestMagicLinkInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      if (this.context.editorConnection) {
        this.context.editorConnection.sendWarning(
          this.nodeScope.componentOwner.name,
          this.id,
          'user-magiclink-warning',
          { message: err, showGlobally: true }
        );
      }
    },
    clearWarnings(this: RequestMagicLinkInstance) {
      if (this.context.editorConnection) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'user-magiclink-warning');
      }
    },
    scheduleSend(this: RequestMagicLinkInstance) {
      if (this.sendScheduled === true) return;
      this.sendScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.sendScheduled = false;

        UserService.instance.requestMagicLink({
          email: this._internal.email,
          redirect: this._internal.redirect,
          success: () => {
            this._internal.error = undefined;
            this.flagOutputDirty('error');
            this.sendSignalOnOutput('success');
          },
          error: (e) => this.setError(e)
        });
      });
    }
  }
};

const RequestMagicLinkModule: NodeModule = {
  node: RequestMagicLinkNodeDefinition,
  setup() {}
};

export default RequestMagicLinkModule;
