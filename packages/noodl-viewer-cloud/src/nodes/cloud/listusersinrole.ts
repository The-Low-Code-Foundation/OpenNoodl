/**
 * List Users In Role (DEF-005 b) — the inverse that was missing.
 *
 * Read the family note in `system-roles.ts` first: it carries the cloud-only
 * registration rule, what actually gates these nodes, and why roles are flat.
 *
 * ## The gap this closes
 *
 * `Get User Roles` answers *"which roles is this user in"*. **There was no node
 * that answered the other direction**, so *"show me the member list"* — the most
 * ordinary screen in a membership app — could not be built at all. The only
 * workaround was to maintain a projection collection duplicating `_Role`, which
 * goes stale the first time somebody changes a role by hand in the Permissions
 * panel, and then lies about who is a member on a screen whose entire job is
 * saying who is a member. TPL-001 ships without its member list because of this.
 *
 * ## Why it is cloud-only, when the *read* is safe
 *
 * ⚠️ This one deserves stating, because DEF-005's other half went the other way:
 * the `User` node now hands the browser **its own** roles, and that grants
 * nothing because the server re-resolves membership on every request it gates.
 * A member LIST is a different object. It is the account names, emails and
 * whatever else a `_User` row carries for **other people**, and no ACL stands
 * between a browser node and that — a cloud function runs as system. So this
 * stays where the rest of the family is, behind a function whose `call` rule is
 * written in the Permissions panel, and the graph decides who may see the
 * roster.
 *
 * 🔴 **A function holding this node with no rule falls back to the graph's
 * `Allow Unauthenticated` port.** Ticked means the roster is public. Set the
 * rule.
 *
 * ## `Total` is not decoration
 *
 * Turning ids into records is N fetches and a role can hold every account on the
 * backend, so the page is bounded. `Total` is the real membership count, so a
 * clipped page is legible as one — a member list that silently showed the first
 * hundred of four hundred would be the "nothing is silently missing" failure in
 * the exact screen this node exists to draw.
 *
 * ## `Unchanged` is "the role is empty"; a missing role is a Failure
 *
 * The same split `Get User Roles` makes. "Nobody has joined yet" is a branch a
 * roster screen wants; a role that does not exist is a typo, and answering it
 * with an empty list would draw the empty-community screen for a misspelling.
 */

import { outcomeInputs, outcomeOutputs } from '@noodl/runtime/src/outcome';

import {
  callSystemRoles,
  drainOutcomes,
  errorOutput,
  scheduleAction,
  setError,
  type SystemRoleResult
} from './system-roles';

const OUTCOMES = {
  done: 'Fires once Users and User Ids hold this page of the role membership',
  unchanged: 'Fires when the role exists and has no members at all — the "nobody has joined yet" branch',
  failure: 'Fires when the members could not be read — a blank Role, an unusable name, or a role that does not exist'
};

export const node = {
  name: 'noodl.cloud.listusersinrole',
  displayNodeName: 'List Users In Role',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/list-users-in-role',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Actions', 'Members', 'Events', 'Error']
  },
  inputs: {
    role: {
      group: 'General',
      displayName: 'Role',
      type: 'string',
      description:
        'Name of the role to list the members of, matching the name a permission rule uses after "role:" — ' +
        'letters, digits, underscore and hyphen only',
      set: function (value) {
        this._internal.role = value;
      }
    },
    limit: {
      group: 'General',
      displayName: 'Limit',
      type: 'number',
      // ⚠️ A declared default never runs its setter (DEF-033), so this is here
      // for the panel and NOT for the behaviour: `_internal.limit` stays
      // `undefined` until somebody sets the port. The real default lives in
      // `SystemRoles.members`, which is also where it has to be — a graph can
      // send a blank Request parameter through here just as easily.
      default: 100,
      description:
        'How many members to return in one call; Total still reports the whole membership, so a clipped page ' +
        'is always visible as one',
      set: function (value) {
        this._internal.limit = value;
      }
    },
    skip: {
      group: 'General',
      displayName: 'Skip',
      type: 'number',
      default: 0,
      description: 'How many members to step over before this page — Skip 100 with Limit 100 is the second page',
      set: function (value) {
        this._internal.skip = value;
      }
    },
    ...outcomeInputs(OUTCOMES),
    read: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Reads the members of the role',
      valueChangedToTrue: function () {
        this.scheduleRead(this.beginOutcome());
      }
    }
  },
  outputs: {
    users: {
      group: 'Members',
      displayName: 'Users',
      type: 'array',
      description:
        'The member records for this page, shaped exactly like the account record /users/me answers with, so ' +
        'a For Each over them reads the same property names the User node does',
      getter: function () {
        return this._internal.users;
      }
    },
    userIds: {
      group: 'Members',
      displayName: 'User Ids',
      type: 'array',
      description: 'Object ids of the members in this page, in the same order as Users',
      getter: function () {
        return this._internal.userIds;
      }
    },
    total: {
      group: 'Members',
      displayName: 'Total',
      type: 'number',
      description:
        'How many members the role has in total, before Limit — compare it with the length of Users to know ' +
        'whether there is another page',
      getter: function () {
        return this._internal.total;
      }
    },
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

      if (!this._internal.role) {
        setError.call(this, 'role/name-required', 'List Users In Role: a Role is required.', tokens);
        return;
      }

      callSystemRoles.call(
        this,
        'List Users In Role',
        {
          op: 'members',
          role: this._internal.role,
          limit: this._internal.limit,
          skip: this._internal.skip
        },
        tokens,
        (result: SystemRoleResult) => {
          // ⚠️ Published on the `Unchanged` branch as well as `Done`, the same
          // way `Roles` is on the three nodes above: an empty roster is a real
          // answer a screen renders, and leaving the ports stale there would
          // show the previous role's members under this role's name.
          this._internal.users = result.users || [];
          this._internal.userIds = result.userIds || [];
          this._internal.total = typeof result.total === 'number' ? result.total : 0;
          this.flagOutputDirty('users');
          this.flagOutputDirty('userIds');
          this.flagOutputDirty('total');
        }
      );
    }
  }
};

export function setup() {
  // No editor-connection listeners and no dynamic ports: every port on this
  // node is declared above.
}
