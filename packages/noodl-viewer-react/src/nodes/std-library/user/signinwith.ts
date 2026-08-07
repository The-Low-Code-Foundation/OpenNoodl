'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';
import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';

import UserService, { OAuthReturnState } from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot sign in with an external provider.
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
const SIGN_IN_WITH_ERROR_CODE = 'user/sign-in-with-failed';

/**
 * Sign In With — BAK-004's provider sign-in, as one node.
 *
 * The shape of this node is dictated by the shape of the flow, which is unlike
 * every other node in the Cloud Services group: triggering it **navigates the
 * browser away**. Nothing downstream of `Do` runs. The result arrives on a
 * LATER page load, in a fresh graph, possibly on a different page of the app.
 *
 * So the node is really two things at once:
 *
 *   1. A launcher. `Do` hands over to the backend's `/oauth/<provider>/start`.
 *   2. A receiver. On every initialize it asks UserService whether THIS page
 *      load is a sign-in coming back, and fires Success or Failure accordingly.
 *
 * Which means a working sign-in usually needs the node on the page the user
 * RETURNS to as well as the one they left from — most often the same page, and
 * the `Redirect` input is how you choose. The session itself is picked up by
 * UserService regardless (see its constructor), so a User node elsewhere in the
 * app sees the login even with no Sign In With node on the returning page; what
 * needs this node is reacting to the outcome.
 */
interface SignInWithInstance extends NodeInstance {
  _internal: {
    provider?: string;
    redirect?: string;
    error?: string;
    notice?: string;
    signingIn: boolean;
    /**
     * ERG-001. The invocations awaiting an answer, from either of this node's two roles.
     *
     * One list rather than two, because at most one of the roles is live on a given page load:
     * the launcher's token is minted and then the document is replaced, and the receiver's is
     * minted on a page the launcher never ran on.
     */
    pendingSignIn?: OutcomeToken[];
  };
  signInScheduled?: boolean;
  setError(err: string, tokens?: OutcomeToken[]): void;
  applyReturn(state: OAuthReturnState): void;
  scheduleSignIn(): void;
}

const SignInWithNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.SignInWith',
  displayNodeName: 'Sign In With',
  category: 'Cloud Services',
  color: 'data',
  ssr: {
    compat: 'partial',
    note: 'Sign-in is a browser redirect; a server render can lay the button out but never completes a flow.'
  },
  initialize(this: SignInWithInstance) {
    this._internal.signingIn = false;

    const service = UserService.instance;
    // A return may have RESOLVED before this node existed (the exchange is a
    // network round trip started in UserService's constructor, but a cached or
    // failed one can settle first), so check the current state as well as
    // subscribing. Both paths go through applyReturn, which is idempotent per
    // page load because UserService only ever consumes one return.
    service.on('oauthReturn', (state: unknown) => this.applyReturn(state as OAuthReturnState));
    if (service.oauthReturn && (service.oauthReturn.inProgress || service.oauthReturn.succeeded !== undefined)) {
      this.applyReturn(service.oauthReturn);
    }
  },
  getInspectInfo(this: SignInWithInstance): InspectInfo | void {
    if (this._internal.signingIn) return '[Signing in…]';
    if (this._internal.error) return [{ type: 'text', value: `Error: ${this._internal.error}` }];
  },
  outputs: {
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Success` renamed to `Done`, plus the universal `Completed`.
    //
    // ⚠️ **This is the one node in the family the contract's "one real exception" applies to.**
    // `Do` hands over to the provider and `window.location.href` replaces the document, so on
    // that path there is no downstream node left to observe a pulse and the node reports
    // nothing. Its *refusals* are synchronous and do report, because on those paths nothing
    // navigates. The outcome an author actually wants arrives on the **return leg**, on a later
    // page load, and that is where `Done` comes from.
    //
    // ⚠️ **No `Unchanged`.** A sign-in either completes, is refused, or leaves the page.
    ...outcomeOutputs({
      done: 'Fires on the page the provider returned to, once the session has been established',
      failure: 'Fires when the sign-in did not complete, after the reason has been reported on the error channel'
    }),
    signingIn: {
      description: 'True while a sign-in started on an earlier page load is still being exchanged',
      type: 'boolean',
      displayName: 'Signing In',
      group: 'States',
      getter(this: SignInWithInstance) {
        return this._internal.signingIn;
      }
    },
    error: {
      description: 'Why the last sign-in failed; empty until one does',
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter(this: SignInWithInstance) {
        return this._internal.error;
      }
    },
    notice: {
      description:
        'Something the user should be told about a sign-in that nevertheless succeeded, such as an old password having been revoked',
      type: 'string',
      displayName: 'Notice',
      group: 'General',
      getter(this: SignInWithInstance) {
        return this._internal.notice;
      }
    }
  },
  inputs: {
    signIn: {
      description: 'Hands over to the provider, which navigates the browser away — nothing downstream of this runs',
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: SignInWithInstance) {
        this.scheduleSignIn();
      }
    },
    provider: {
      description: 'Id of the sign-in provider to use, as the backend lists it',
      type: 'string',
      displayName: 'Provider',
      group: 'General',
      set(this: SignInWithInstance, value: string) {
        this._internal.provider = value;
      }
    },
    redirect: {
      description: 'Page the provider should return to; leave blank to come back to the page sign-in started from',
      type: 'string',
      displayName: 'Redirect',
      group: 'General',
      set(this: SignInWithInstance, value: string) {
        this._internal.redirect = value;
      }
    }
  },
  methods: {
    /** ERG-001 — the funnel now reports the outcome too. See `login.ts::setError`. */
    setError(this: SignInWithInstance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this._internal.signingIn = false;
      this.flagOutputDirty('error');
      this.flagOutputDirty('signingIn');

      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: SIGN_IN_WITH_ERROR_CODE,
        message: err
      });
    },
    clearWarnings(this: SignInWithInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, SIGN_IN_WITH_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-signinwith-warning');
      }
    },
    /**
     * The receiver half — a sign-in resolving on a *later page load*, in a fresh graph.
     *
     * ⚠️ **This is the one place in the phase where something other than a port opens an
     * invocation, and it is deliberate.** "Only the port mints" exists to stop setter and mount
     * paths *duplicating* a port's outcome; here there is no port invocation in this graph to
     * duplicate, because the `Do` that started this happened on a page that no longer exists.
     * The return leg is the only place the answer can be known, so it is where the outcome comes
     * from.
     *
     * ⚠️ `inProgress` is a **state**, not a terminal outcome: it sets `Signing In` and waits, so
     * no token is minted for it. Minting one there would leave it open when the real answer
     * arrived and the second report would raise `outcome/duplicate`.
     */
    applyReturn(this: SignInWithInstance, state: OAuthReturnState) {
      if (state.inProgress) {
        this._internal.signingIn = true;
        this.flagOutputDirty('signingIn');
        return;
      }
      this._internal.signingIn = false;
      this.flagOutputDirty('signingIn');

      const tokens = [this.beginOutcome()];

      if (state.succeeded) {
        // The notice is set when the backend's linking rule revoked an old
        // password (see BACKEND-AUTH.md). It is the one thing a sign-in can
        // succeed at while still needing to tell the user something.
        this._internal.notice = state.notice;
        this._internal.error = undefined;
        this.flagOutputDirty('notice');
        this.flagOutputDirty('error');
        // Last, after the values it is about.
        reportOutcomes(this, tokens, 'done');
        return;
      }
      this.setError(state.error || 'Sign-in could not be completed.', tokens);
    },
    /**
     * The launcher half — hand over to the provider, which navigates the browser away.
     *
     * ⚠️ **An accepted handover reports nothing, and that is the contract's one real exception
     * applied literally.** `signInWithProvider` sets `window.location.href`; the document is
     * replaced, so there is no downstream node left to observe a `Done` or a `Completed`. The
     * navigation slice deliberately kept `Done` on *its* navigating path, and the difference is
     * worth naming: a `Navigate` in a nav bar outside the Router demonstrably survives, so a
     * silent `Completed` there would have defeated Rule 2. Nothing survives this redirect.
     *
     * Both refusals — no backend configured, no provider set — are raised synchronously by the
     * adapter *before* it touches `location`, so the token is still open for them and they do
     * report. That is why `pendingSignIn` is left holding a token that is simply never settled
     * on the success path: the page is gone before it could matter.
     */
    scheduleSignIn(this: SignInWithInstance) {
      const pending = this._internal.pendingSignIn || (this._internal.pendingSignIn = []);
      pending.push(this.beginOutcome());

      if (this.signInScheduled === true) return;
      this.signInScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.signInScheduled = false;
        this._internal.signingIn = true;
        this.flagOutputDirty('signingIn');

        const tokens = this._internal.pendingSignIn || [];
        this._internal.pendingSignIn = [];

        UserService.instance.signInWithProvider({
          provider: this._internal.provider,
          redirect: this._internal.redirect,
          // Only reached when the redirect never happens — no backend
          // configured, or no provider set on the node.
          error: (message) => this.setError(message, tokens)
        });
      });
    }
  }
};

const SignInWithModule: NodeModule = {
  node: SignInWithNodeDefinition,
  setup() {}
};

export default SignInWithModule;
