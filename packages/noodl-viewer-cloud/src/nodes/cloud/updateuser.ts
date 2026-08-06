/**
 * Update User (CWF-015 slice 2) — set the properties of a *named* user, as the
 * system.
 *
 * Read the family note in `system-users.ts` first.
 *
 * ## Why this is a sibling of Set User Properties rather than a mode of it
 *
 * CWF-015 asked for the difference to be "legible on the canvas, because the
 * failure mode is 'accidentally edited the caller instead of the target'". The
 * two nodes are therefore separate, differently named, and this one has a
 * required `User Id`:
 *
 * | | `Set User Properties` (`net.noodl.user.SetUserProperties`) | `Update User` (this) |
 * |---|---|---|
 * | Who it writes | whoever is signed in, and fails when nobody is | the user whose id you give it |
 * | Where it runs | browser and cloud | cloud only |
 * | Authority | the caller's session | the system |
 *
 * ⚠️ **A blank `User Id` is a Failure and never a fallback to the caller.**
 * There is no caller to fall back to — the system is not a session — and a node
 * that quietly wrote to whoever happened to be signed in would be the exact
 * defect this split exists to prevent.
 *
 * ## A password change here revokes every session
 *
 * `PUT /users/:id` spares the session that authorized the change, because a user
 * rotating their own password should not be logged out of the tab they did it
 * in. There is no such session here, so sparing one would mean choosing a
 * survivor arbitrarily — and an account being reset by an administrator is
 * precisely the case where a stolen session must not live. `Sessions Revoked`
 * says how many went.
 */

import { outcomeOutputs } from '@noodl/runtime/src/outcome';

import {
  callSystemUsers,
  drainOutcomes,
  errorOutput,
  propertiesInput,
  propertyDynamicPorts,
  registerPropertyInput,
  scheduleAction,
  setError,
  type SystemUserResult
} from './system-users';

export const node = {
  name: 'noodl.cloud.updateuser',
  displayNodeName: 'Update User',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/update-user',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Properties', 'Actions', 'User', 'Events', 'Error']
  },
  dynamicports: propertyDynamicPorts,
  inputs: {
    userId: {
      group: 'General',
      displayName: 'User Id',
      type: 'string',
      description:
        'Which account to change. Required — this node never falls back to the caller, and a blank id is a ' +
        'Failure rather than a write to whoever is signed in',
      set: function (value) {
        this._internal.userId = value;
      }
    },
    password: {
      group: 'General',
      displayName: 'Password',
      // Connection-only for the same reason as Create User's: a typed parameter
      // would be a plaintext password in the project file a deploy ships.
      type: { name: 'string', allowConnectionsOnly: true },
      description:
        'A new password for this account, hashed by the backend. Setting one revokes EVERY session this user ' +
        'has, including one that may be calling this function. Leave it unwired to change properties only. ' +
        'Connection-only — a password must not live in a project file',
      set: function (value) {
        this._internal.password = value;
      }
    },
    properties: propertiesInput,
    store: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Writes the values below to the account named by User Id',
      valueChangedToTrue: function () {
        // ERG-001 §4: only the port mints; `doStore` has no other caller.
        this.scheduleStore(this.beginOutcome());
      }
    }
  },
  outputs: {
    // ⚠️ No `Unchanged`. Nothing diffs the record first, so there is no
    // post-condition that can already hold — the same reason Set User Properties
    // has none. "There is no such user" is a Failure here and not a no-op,
    // because an update aimed at a user that does not exist is a mistake,
    // whereas deleting one that does not exist is the goal already met.
    ...outcomeOutputs({
      done: 'Fires once the account has been written',
      failure:
        'Fires when the account could not be written — a blank or unknown User Id, a property the backend ' +
        'refuses, or a username already taken by somebody else'
    }),
    sessionsRevoked: {
      group: 'User',
      displayName: 'Sessions Revoked',
      type: 'number',
      description:
        'How many of this user\'s sessions the last write ended. Non-zero only when a Password was supplied',
      getter: function () {
        return this._internal.sessionsRevoked;
      }
    },
    error: errorOutput
  },
  methods: {
    setError,
    registerInputIfNeeded: registerPropertyInput,
    scheduleStore: function (token) {
      scheduleAction.call(this, token, () => this.doStore());
    },
    doStore: function () {
      const tokens = drainOutcomes.call(this);

      if (!this._internal.userId) {
        setError.call(
          this,
          'user/id-required',
          'Update User: a User Id is required. This node never falls back to the caller.',
          tokens
        );
        return;
      }

      callSystemUsers.call(
        this,
        'Update User',
        {
          op: 'update',
          userId: this._internal.userId,
          password: this._internal.password,
          properties: this._internal.userProperties
        },
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
  // See the note on `createuser.ts`: the `dynamicports` declaration is the only
  // live generator since WF-007, so there is deliberately no second one here.
}
