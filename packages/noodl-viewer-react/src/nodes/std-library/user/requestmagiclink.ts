'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot request a magic link.
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
const REQUEST_MAGIC_LINK_ERROR_CODE = 'user/request-magic-link-failed';

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
      description: 'Fires once the request has been accepted, which never means an account exists for that address',
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      description:
        'Fires when the request itself failed — no backend, no network, or rate limited — never because the address is unknown',
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      description: 'Why the last request failed; empty until one does',
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
      description: 'Asks the backend to email a one-click sign-in link to Email',
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: RequestMagicLinkInstance) {
        this.scheduleSend();
      }
    },
    email: {
      description: 'Address to send the sign-in link to',
      type: 'string',
      displayName: 'Email',
      group: 'General',
      set(this: RequestMagicLinkInstance, value: string) {
        this._internal.email = value;
      }
    },
    redirect: {
      description: 'Page the link should return to; leave blank to come back to the page the request was made from',
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

      this.raiseRuntimeError(REQUEST_MAGIC_LINK_ERROR_CODE, err);
    },
    clearWarnings(this: RequestMagicLinkInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, REQUEST_MAGIC_LINK_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-magiclink-warning');
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
