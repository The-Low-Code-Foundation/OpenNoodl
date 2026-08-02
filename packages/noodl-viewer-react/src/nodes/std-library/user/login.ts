'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';
import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot log in.
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
const LOG_IN_ERROR_CODE = 'user/log-in-failed';

/** `this` inside the Log In node. */
interface LogInInstance extends NodeInstance {
  _internal: {
    username?: string;
    password?: string;
    /** Message from the last failed attempt; drives both the `error` output and the warning. */
    error?: string;
    /**
     * ERG-001. Invocations of `Do` that have not reported yet.
     *
     * An array because `logInScheduled` coalesces two pulses in an update pass into one attempt,
     * deliberately — and two invocations must still produce two outcomes.
     * `foreach.tsx`'s `pendingRefreshOutcomes` is the same shape for the same reason.
     */
    pendingLogIn?: OutcomeToken[];
  };
  logInScheduled?: boolean;
  setError(err: string, tokens?: OutcomeToken[]): void;
  scheduleLogIn(): void;
}

const LoginNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.LogIn',
  docs: 'https://docs.noodl.net/nodes/data/user/log-in',
  displayNodeName: 'Log In',
  category: 'Cloud Services',
  color: 'data',
  outputs: {
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Success` renamed to `Done` — the family-wide wire name §0.2 Result 2 settled
    // on — plus the universal `Completed`.
    //
    // ⚠️ **No `Unchanged`.** `UserService.logIn` reaches the backend unconditionally; there is no
    // local "already signed in as this user" check to make a no-op out of.
    ...outcomeOutputs({
      done: 'Fires once the sign-in succeeded and a session has been stored',
      failure: 'Fires when the sign-in was refused, after the reason has been reported on the error channel'
    }),
    error: {
      description: 'Why the last sign-in failed; empty until one does',
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter(this: LogInInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    login: {
      description: 'Attempts to sign in with Username and Password',
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: LogInInstance) {
        this.scheduleLogIn();
      }
    },
    username: {
      description: 'Username to sign in as',
      displayName: 'Username',
      type: 'string',
      group: 'General',
      set(this: LogInInstance, value: string) {
        this._internal.username = value;
      }
    },
    password: {
      description: 'Password to sign in with',
      displayName: 'Password',
      type: 'string',
      group: 'General',
      set(this: LogInInstance, value: string) {
        this._internal.password = value;
      }
    }
  },
  methods: {
    /**
     * ERG-001: the `failure` pulse and the raise both go through `reportOutcome`, so the outcome
     * and its reason cannot drift apart and `Completed` follows automatically. `tokens` is
     * optional because NDA-004's rows call this funnel directly — minting one here keeps that a
     * real, complete failure rather than a branch where a reason reaches the channel with no
     * outcome behind it.
     */
    setError(this: LogInInstance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this.flagOutputDirty('error');

      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: LOG_IN_ERROR_CODE,
        message: err
      });
    },
    clearWarnings(this: LogInInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, LOG_IN_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-login-warning');
      }
    },
    scheduleLogIn(this: LogInInstance) {
      // ERG-001. Minted *before* the coalescing guard, so the second `Do` of a pair still gets an
      // outcome even though it does not get a second attempt. This is the only method the `Do`
      // port reaches, and nothing else in this file mints a token.
      const pending = this._internal.pendingLogIn || (this._internal.pendingLogIn = []);
      pending.push(this.beginOutcome());

      if (this.logInScheduled === true) return;
      this.logInScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.logInScheduled = false;

        // Taken into a local before the request goes out, so a second `Do` arriving in flight
        // owns its own batch rather than being settled by this one's answer.
        const tokens = this._internal.pendingLogIn || [];
        this._internal.pendingLogIn = [];

        UserService.instance.logIn({
          username: this._internal.username,
          password: this._internal.password,
          success: () => {
            reportOutcomes(this, tokens, 'done');
          },
          error: (e) => {
            this.setError(e, tokens);
          }
        });
      });
    }
  }
};

const LogInModule: NodeModule = {
  node: LoginNodeDefinition,
  setup() {}
};

export default LogInModule;
