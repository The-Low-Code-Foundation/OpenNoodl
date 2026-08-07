'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';
import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';

import UserService from './userservice';

/**
 * NDA-004 §2 / FINDINGS B-iv — the code this node raises when it cannot log out.
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
const LOG_OUT_ERROR_CODE = 'user/log-out-failed';

/** `this` inside the Log Out node. */
interface LogOutInstance extends NodeInstance {
  _internal: {
    /** Message from the last failed attempt. */
    error?: string;
    /** ERG-001. Invocations of `Do` that have not reported yet — see `login.ts`. */
    pendingLogOut?: OutcomeToken[];
  };
  logOutScheduled?: boolean;
  setError(err: string, tokens?: OutcomeToken[]): void;
  scheduleLogOut(): void;
}

const LogOutNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.user.LogOut',
  docs: 'https://docs.noodl.net/nodes/data/user/log-out',
  displayNodeName: 'Log Out',
  category: 'Cloud Services',
  color: 'data',
  outputs: {
    // ── the outcome contract ────────────────────────────────────────────────
    //
    // ERG-001 §4. `Success` renamed to `Done`, plus the universal `Completed`.
    //
    // ⚠️ **No `Unchanged`**, and this one was measured rather than assumed: the tempting no-op is
    // "signing out when nobody is signed in", but `ParseAuthAdapter.logOut` POSTs `/logout`
    // unconditionally and only clears the session on the response. There is no local branch that
    // could report `Unchanged` without changing what the node does.
    ...outcomeOutputs({
      done: 'Fires once the session has been ended',
      failure: 'Fires when the sign-out was refused, after the reason has been reported on the error channel'
    }),
    error: {
      description: 'Why the last sign-out failed; empty until one does',
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      getter(this: LogOutInstance) {
        return this._internal.error;
      }
    }
  },
  inputs: {
    // Named `login` rather than `logout`: the port name is persisted in every project that
    // uses this node, so it cannot be corrected without breaking them.
    login: {
      description: 'Signs the current user out and clears the stored session',
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: LogOutInstance) {
        this.scheduleLogOut();
      }
    }
  },
  methods: {
    /** ERG-001 — the funnel now reports the outcome too. See `login.ts::setError`. */
    setError(this: LogOutInstance, err: string, tokens?: OutcomeToken[]) {
      this._internal.error = err;
      this.flagOutputDirty('error');

      reportOutcomes(this, tokens || [this.beginOutcome()], 'failure', {
        code: LOG_OUT_ERROR_CODE,
        message: err
      });
    },
    clearWarnings(this: LogOutInstance) {
      if (this.context.editorConnection) {
        const component = this.nodeScope.componentOwner.name;
        this.context.editorConnection.clearWarning(component, this.id, LOG_OUT_ERROR_CODE);
        this.context.editorConnection.clearWarning(component, this.id, 'user-login-warning');
      }
    },
    scheduleLogOut(this: LogOutInstance) {
      // ERG-001. Minted before the coalescing guard — see `login.ts::scheduleLogIn`.
      const pending = this._internal.pendingLogOut || (this._internal.pendingLogOut = []);
      pending.push(this.beginOutcome());

      if (this.logOutScheduled === true) return;
      this.logOutScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.logOutScheduled = false;

        const tokens = this._internal.pendingLogOut || [];
        this._internal.pendingLogOut = [];

        UserService.instance.logOut({
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

const LogOutModule: NodeModule = {
  node: LogOutNodeDefinition,
  setup() {}
};

export default LogOutModule;
