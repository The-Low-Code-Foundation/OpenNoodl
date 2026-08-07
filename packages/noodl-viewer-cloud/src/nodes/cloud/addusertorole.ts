/**
 * Add User To Role (F86) — the node Richard asked for.
 *
 * > *"say I'm signing up a user and I want them to become part of the 'member'
 * > role or whatever, what node would I use?"*
 *
 * Before this there was no answer: roles were creatable in the editor's
 * Permissions panel, and members could only be added by pasting an objectId into
 * a text field by hand. A rule could say `role:member` and nothing a running app
 * did could ever put anyone in `member`.
 *
 * Read the family note in `system-roles.ts` first: it carries the cloud-only
 * registration rule, what actually gates these nodes, and why roles are flat.
 *
 * ## The three things this node is not
 *
 *  - **It is not a browser node, and there will not be one.** Adding the current
 *    user to a role from client-side graph is one wire from a button to "make me
 *    an admin". Role mutation is backend-authoritative.
 *  - **It is not `POST /admin/roles/:name/users`.** That route exists and is
 *    admin-gated; reaching it from a graph would mean putting the admin
 *    credential in the graph, which is what the Secret node exists to prevent.
 *    This adds no route: in process, the only gate is the function's `call` rule.
 *  - **It cannot write a permission rule.** Creating a role grants nothing on
 *    its own — privilege comes from a rule that *names* a role, and rules are
 *    written in the Permissions panel and nowhere else.
 *
 * ## Why `Create Role If Missing` is off by default
 *
 * A role name is written in two places by two people at two times: the rule that
 * grants through it, and the call that fills it. Creating on demand turns a typo
 * into a role that exists, has a member, and is named by no rule — a grant that
 * silently never happens, which is the exact failure this whole finding is
 * about. So an unknown role is a Failure that *names* the role, and the port is
 * there for the case that is genuinely not a typo: a function deployed to a
 * fresh backend where nobody has opened the Permissions panel yet.
 *
 * ## `Unchanged` is "they were already in it"
 *
 * A signup function that runs twice must not go red the second time. The
 * outcome contract already has the port for it: the post-condition already
 * holding is `Unchanged`, and `Roles` is populated on that branch exactly as on
 * `Done`, so "make sure this user is a member" is one wire.
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
  done: 'Fires once the user is in the role and Roles lists it',
  unchanged:
    'Fires when the user was already in this role, with Roles still listing it, so a signup function re-run ' +
    'does not go red; set Treat Unchanged as to Failure if a repeat is a bug',
  failure:
    'Fires when the membership could not be written — a blank Role or User Id, a user id nothing resolves, ' +
    'or a role that does not exist and Create Role If Missing left off'
};

export const node = {
  name: 'noodl.cloud.addusertorole',
  displayNodeName: 'Add User To Role',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/add-user-to-role',
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
        'Name of the role to put the user in, matching the name a permission rule uses after "role:" — ' +
        'letters, digits, underscore and hyphen only',
      set: function (value) {
        this._internal.role = value;
      }
    },
    userId: userIdInput,
    createRole: {
      group: 'General',
      displayName: 'Create Role If Missing',
      type: 'boolean',
      // ⚠️ The declared default never runs its setter (FINDINGS A-D1), so the
      // value is read as `=== true` at call time and `undefined` lands on false.
      // The default is here for the panel, not for the behaviour.
      default: false,
      description:
        'Creates the role when it does not exist yet, instead of failing; leave it off so a mistyped name is ' +
        'a loud Failure rather than a role no rule ever names',
      set: function (value) {
        this._internal.createRole = value;
      }
    },
    ...outcomeInputs(OUTCOMES),
    add: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Adds the user to the role',
      valueChangedToTrue: function () {
        // ERG-001 §4: only the port mints an outcome token, and `doAdd` has no
        // other caller — no value setter on this node grants anything.
        this.scheduleAdd(this.beginOutcome());
      }
    }
  },
  outputs: {
    roles: rolesOutput,
    roleCreated: {
      group: 'Roles',
      displayName: 'Role Was Created',
      type: 'boolean',
      description:
        'True when this call created the role as well as the membership, which is worth branching on because ' +
        'a brand-new role is named by no permission rule yet',
      getter: function () {
        return this._internal.roleCreated;
      }
    },
    ...outcomeOutputs(OUTCOMES),
    error: errorOutput
  },
  methods: {
    setError,
    scheduleAdd: function (token) {
      scheduleAction.call(this, token, () => this.doAdd());
    },
    doAdd: function () {
      const tokens = drainOutcomes.call(this);

      if (!this._internal.role) {
        setError.call(this, 'role/name-required', 'Add User To Role: a Role is required.', tokens);
        return;
      }
      if (!this._internal.userId) {
        setError.call(
          this,
          'role/user-id-required',
          'Add User To Role: a User Id is required. This node never falls back to the caller.',
          tokens
        );
        return;
      }

      callSystemRoles.call(
        this,
        'Add User To Role',
        {
          op: 'add',
          role: this._internal.role,
          userId: this._internal.userId,
          createRole: this._internal.createRole === true
        },
        tokens,
        (result: SystemRoleResult) => {
          publishResult.call(this, result);
          this._internal.roleCreated = result.roleCreated === true;
          this.flagOutputDirty('roleCreated');
        }
      );
    }
  }
};

export function setup() {
  // No editor-connection listeners and no dynamic ports: every port on this
  // node is declared above. Present for parity with the rest of the cloud
  // family, whose registration calls `setup` when it exists.
}
