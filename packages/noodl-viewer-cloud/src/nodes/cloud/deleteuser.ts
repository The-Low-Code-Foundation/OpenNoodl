/**
 * Delete User (CWF-015 slice 2) — remove an account and every session it holds,
 * as the system.
 *
 * Read the family note in `system-users.ts` first.
 *
 * ## Sessions go first, and that ordering is the point
 *
 * A deleted user whose `_Session` rows survived would leave tokens that
 * `SecurityState.resolvePrincipal` resolves to a `_User` row it can no longer
 * fetch — a 209 at best, and orphan rows nothing would ever collect. `Sessions
 * Revoked` reports how many went, which is also the honest answer to "was
 * anybody actually signed in as them?".
 *
 * ## `Unchanged` is "there was no such user"
 *
 * Not a Failure: the post-condition — that account does not exist — already
 * held, which is exactly what `Unchanged` is for, and a moderation job re-run
 * after a partial failure must not go red on its second pass. A project that
 * wants the harder reading sets `Treat Unchanged as` to Failure.
 *
 * ⚠️ **A blank `User Id` is a Failure and never means "the caller".** Same rule
 * as Update User, and it matters more here.
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
  done: 'Fires once the account and its sessions are gone',
  unchanged: 'Fires when there is no user with this id — the account is already absent, which is the goal met',
  failure: 'Fires when the account could not be deleted, including when User Id is blank'
};

export const node = {
  name: 'noodl.cloud.deleteuser',
  displayNodeName: 'Delete User',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/delete-user',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'User', 'Events', 'Error']
  },
  inputs: {
    userId: {
      group: 'General',
      displayName: 'User Id',
      type: 'string',
      description:
        'Which account to delete. Required — this node never falls back to the caller, and a blank id is a ' +
        'Failure rather than the deletion of whoever is signed in',
      set: function (value) {
        this._internal.userId = value;
      }
    },
    ...outcomeInputs(OUTCOMES),
    remove: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Deletes the account named by User Id, and every session it holds',
      valueChangedToTrue: function () {
        // ERG-001 §4: only the port mints; `doDelete` has no other caller, and
        // no value setter on this node deletes anything.
        this.scheduleDelete(this.beginOutcome());
      }
    }
  },
  outputs: {
    ...outcomeOutputs(OUTCOMES),
    sessionsRevoked: {
      group: 'User',
      displayName: 'Sessions Revoked',
      type: 'number',
      description: 'How many sessions the deleted account held. Zero after Unchanged',
      getter: function () {
        return this._internal.sessionsRevoked;
      }
    },
    error: errorOutput
  },
  methods: {
    setError,
    scheduleDelete: function (token) {
      scheduleAction.call(this, token, () => this.doDelete());
    },
    doDelete: function () {
      const tokens = drainOutcomes.call(this);

      if (!this._internal.userId) {
        setError.call(
          this,
          'user/id-required',
          'Delete User: a User Id is required. This node never falls back to the caller.',
          tokens
        );
        return;
      }

      callSystemUsers.call(
        this,
        'Delete User',
        { op: 'delete', userId: this._internal.userId },
        tokens,
        (result: SystemUserResult) => {
          this._internal.sessionsRevoked = result.sessionsRevoked || 0;
          this.flagOutputDirty('sessionsRevoked');
        }
      );
    }
  }
};

export function setup() {
  // Every port here is static — no dynamic-port behaviour of any kind.
}
