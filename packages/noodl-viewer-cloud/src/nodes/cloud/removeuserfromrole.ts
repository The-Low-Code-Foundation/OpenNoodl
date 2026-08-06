/**
 * Remove User From Role (F86) — the other half of the pair.
 *
 * Read the family note in `system-roles.ts` first. This node exists for the same
 * reason its twin does: a role a running app can fill but never empty is a
 * privilege that can only be revoked by hand in the editor, which is not a
 * revocation an app can perform when a subscription lapses or a moderator is
 * stood down.
 *
 * ## Two `Unchanged` branches, both meaning "they are not in it"
 *
 * The user was not a member, and the role does not exist at all. Both are the
 * post-condition already holding rather than a failure — the same reading
 * `Delete User` gives an id that is already gone — so a de-provisioning job
 * re-run does not go red on its second pass. `Error` carries which of the two it
 * was, for a function that wants to tell them apart.
 *
 * ⚠️ **Removing a role membership does not end that user's sessions.** A session
 * token is not a copy of a principal: `SecurityState` resolves roles per request
 * through `rolesForUser`, so the next request that token makes already sees the
 * shorter list. There is no cache to invalidate and no session to revoke.
 */

import { outcomeInputs, outcomeOutputs } from '@noodl/runtime/src/outcome';

import {
  callSystemRoles,
  drainOutcomes,
  errorOutput,
  publishResult,
  rolesOutput,
  scheduleAction,
  setError,
  userIdInput,
  type SystemRoleResult
} from './system-roles';

const OUTCOMES = {
  done: 'Fires once the user is out of the role and Roles no longer lists it',
  unchanged:
    'Fires when the user was not in this role, or the role does not exist, so a de-provisioning job re-run ' +
    'does not go red; Error says which of the two it was',
  failure: 'Fires when the membership could not be removed — a blank Role or User Id, or a store that would not write'
};

export const node = {
  name: 'noodl.cloud.removeuserfromrole',
  displayNodeName: 'Remove User From Role',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/remove-user-from-role',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Roles', 'Events', 'Error']
  },
  inputs: {
    role: {
      group: 'General',
      displayName: 'Role',
      type: 'string',
      description:
        'Name of the role to take the user out of, matching the name a permission rule uses after "role:"',
      set: function (value) {
        this._internal.role = value;
      }
    },
    userId: userIdInput,
    ...outcomeInputs(OUTCOMES),
    remove: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Removes the user from the role',
      valueChangedToTrue: function () {
        // ERG-001 §4: only the port mints an outcome token.
        this.scheduleRemove(this.beginOutcome());
      }
    }
  },
  outputs: {
    roles: rolesOutput,
    ...outcomeOutputs(OUTCOMES),
    error: errorOutput
  },
  methods: {
    setError,
    scheduleRemove: function (token) {
      scheduleAction.call(this, token, () => this.doRemove());
    },
    doRemove: function () {
      const tokens = drainOutcomes.call(this);

      if (!this._internal.role) {
        setError.call(this, 'role/name-required', 'Remove User From Role: a Role is required.', tokens);
        return;
      }
      if (!this._internal.userId) {
        setError.call(
          this,
          'role/user-id-required',
          'Remove User From Role: a User Id is required. This node never falls back to the caller.',
          tokens
        );
        return;
      }

      callSystemRoles.call(
        this,
        'Remove User From Role',
        { op: 'remove', role: this._internal.role, userId: this._internal.userId },
        tokens,
        (result: SystemRoleResult) => {
          publishResult.call(this, result);
        }
      );
    }
  }
};

export function setup() {
  // No editor-connection listeners and no dynamic ports.
}
