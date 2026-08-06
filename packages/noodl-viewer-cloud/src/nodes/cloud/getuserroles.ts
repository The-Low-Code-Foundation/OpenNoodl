/**
 * Get User Roles (F86) — the read that makes the other two verifiable.
 *
 * Read the family note in `system-roles.ts` first.
 *
 * ## Why a read node ships with the two writes
 *
 * Without it, "did the membership take effect?" can only be answered by making
 * a second change and watching what happens, and "is this caller staff?" can
 * only be answered by a Function node doing its own query. Both are the shape of
 * question a function asks *before* deciding what to do, and neither should
 * require a mutation to answer.
 *
 * ⚠️ **This is the resolver enforcement itself uses.** `Roles` comes from
 * `SecurityState.rolesForUser`, the same call the access check makes when it
 * evaluates `role:member`. A node that ran its own query could have answered
 * "member" while the rule disagreed; this cannot.
 *
 * ## `Unchanged` is "in no roles at all"
 *
 * Rather than `Done` with an empty list. "This user has nothing" is the branch a
 * membership check wants to take, and an empty array arriving on a `Done` wire
 * is the shape that gets mistaken for a port nobody connected. Nothing is
 * written on any branch, so nothing here is audited — the same stance this
 * backend takes for every other read.
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
  done: 'Fires once Roles holds every role this user is in',
  unchanged: 'Fires when the user is in no roles at all, which is the branch a membership check wants',
  failure: 'Fires when the roles could not be read — a blank User Id, or a user id nothing resolves'
};

export const node = {
  name: 'noodl.cloud.getuserroles',
  displayNodeName: 'Get User Roles',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/get-user-roles',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Roles', 'Events', 'Error']
  },
  inputs: {
    userId: userIdInput,
    ...outcomeInputs(OUTCOMES),
    read: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Reads the roles this user is in',
      valueChangedToTrue: function () {
        this.scheduleRead(this.beginOutcome());
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
    scheduleRead: function (token) {
      scheduleAction.call(this, token, () => this.doRead());
    },
    doRead: function () {
      const tokens = drainOutcomes.call(this);

      if (!this._internal.userId) {
        setError.call(this, 'role/user-id-required', 'Get User Roles: a User Id is required.', tokens);
        return;
      }

      callSystemRoles.call(
        this,
        'Get User Roles',
        { op: 'list', userId: this._internal.userId },
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
