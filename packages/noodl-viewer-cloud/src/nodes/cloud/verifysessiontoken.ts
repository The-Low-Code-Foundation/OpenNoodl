/**
 * Verify Session Token (CWF-015 slice 3) — ask this backend about one of its own
 * session tokens.
 *
 * Read the family note in `system-users.ts` first.
 *
 * ## ⚠️ Not `JWT Verify`, and naming them apart is half the work
 *
 * CWF-010's **JWT Verify** (`noodl.cloud.jwtverify`) verifies *somebody else's*
 * JWT against a key you hold: a token minted elsewhere, checked by mathematics.
 * This node asks *our own backend* about *our own* session token, by looking it
 * up in `_Session`. The two answer different questions about different things
 * and neither substitutes for the other.
 *
 * The token this takes is one that arrived in the request **body** — from a
 * mobile client, a partner integration, a callback — not the caller's own. The
 * caller's own token is already resolved for you: that is the Request node's
 * `Authenticated` and `User Id`, and reaching for this node to re-check it is
 * work the runtime has already done.
 *
 * ## What it accepts, and what it will not become
 *
 * Only a `_Session` row matches. An admin credential is not a session and an API
 * key is not a session, so neither can be probed through this node — it cannot
 * be turned into an oracle for either.
 *
 * ⚠️ It *is* an oracle for session tokens, which is unavoidable and is the whole
 * point. That is why the function holding it must not be `public`: an
 * unauthenticated caller with this behind an open rule can test tokens at
 * whatever rate the limiter allows. Give the function a `call` rule (CWF-017),
 * and a per-function `rateLimit` while you are there.
 *
 * ## There is no expiry to report
 *
 * CWF-015 slice 3 asked for "valid / user id / expiry", and the third does not
 * exist. `POST /login` and `POST /users` write `_Session` rows carrying
 * `sessionToken` and `userId` and nothing else, and the `_Session` table has no
 * `expiresAt` column at all (`nodegx-backend/service.ts` `ensureSystemTables`).
 * A session on this backend lives until a password change or a delete revokes
 * it. An `Expires At` output would therefore be blank on every session this
 * backend has ever minted — an inert port, which is worse than an absent one.
 */

import { outcomeInputs, outcomeOutputs } from '@noodl/runtime/src/outcome';

import {
  callSystemUsers,
  drainOutcomes,
  errorOutput,
  scheduleAction,
  setError,
  type SystemUserResult
} from './system-users';

const OUTCOMES = {
  done: 'Fires when the token is a live session — Valid is true and User Id holds whose it is',
  unchanged:
    'Fires when the token is not a live session on this backend. Nothing failed and nothing changed; the ' +
    'answer is simply no, and this is the branch to wire to your 401',
  failure: 'Fires when the check could not be made at all, such as a blank Token'
};

export const node = {
  name: 'noodl.cloud.verifysessiontoken',
  displayNodeName: 'Verify Session Token',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/verify-session-token',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'User', 'Events', 'Error']
  },
  inputs: {
    token: {
      group: 'General',
      displayName: 'Token',
      // Connection-only: a session token typed into a graph is a live
      // credential inside the project file a deploy ships, and a token that
      // came from a request is the only kind worth checking anyway.
      type: { name: 'string', allowConnectionsOnly: true },
      description:
        'The session token to check, as it arrived in the request body. Not the caller\'s own — that is already ' +
        'resolved on the Request node\'s Authenticated and User Id. Connection-only, because a token in a project ' +
        'file is a credential in a project file',
      set: function (value) {
        this._internal.token = value;
      }
    },
    ...outcomeInputs(OUTCOMES),
    verify: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Checks the token. Nothing is checked, and nothing is written, until this fires',
      valueChangedToTrue: function () {
        // ERG-001 §4: only the port mints; `doVerify` has no other caller.
        this.scheduleVerify(this.beginOutcome());
      }
    }
  },
  outputs: {
    valid: {
      group: 'User',
      displayName: 'Valid',
      type: 'boolean',
      description: 'Whether the token is a live session. The value form of the Done / Unchanged branch',
      getter: function () {
        return !!this._internal.valid;
      }
    },
    userId: {
      group: 'User',
      displayName: 'User Id',
      type: 'string',
      description: 'Whose session it is, after Done. Blank on every other branch',
      getter: function () {
        return this._internal.userId;
      }
    },
    username: {
      group: 'User',
      displayName: 'Username',
      type: 'string',
      description: 'That user\'s username, after Done. Blank on every other branch',
      getter: function () {
        return this._internal.username;
      }
    },
    ...outcomeOutputs(OUTCOMES),
    error: errorOutput
  },
  methods: {
    setError,
    scheduleVerify: function (token) {
      scheduleAction.call(this, token, () => this.doVerify());
    },
    doVerify: function () {
      const tokens = drainOutcomes.call(this);

      // Cleared before the check, not after it: a stale `User Id` sitting on the
      // output while the next answer is in flight is how a graph acts on the
      // previous caller's identity.
      this._internal.valid = false;
      this._internal.userId = undefined;
      this._internal.username = undefined;
      this.flagOutputDirty('valid');
      this.flagOutputDirty('userId');
      this.flagOutputDirty('username');

      if (!this._internal.token) {
        setError.call(this, 'user/token-required', 'Verify Session Token: a Token is required.', tokens);
        return;
      }

      callSystemUsers.call(
        this,
        'Verify Session Token',
        { op: 'verifyToken', token: this._internal.token },
        tokens,
        (result: SystemUserResult) => {
          this._internal.valid = result.valid === true;
          this._internal.userId = result.userId;
          this._internal.username = result.username;
          this.flagOutputDirty('valid');
          this.flagOutputDirty('userId');
          this.flagOutputDirty('username');
        }
      );
    }
  }
};

export function setup() {
  // Every port here is static — no dynamic-port behaviour of any kind.
}
