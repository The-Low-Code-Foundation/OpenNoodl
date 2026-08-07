/**
 * Create User (CWF-015 slice 1) — a cloud function creating an account **as the
 * system**.
 *
 * Read the family note in `system-users.ts` first: it carries the cloud-only
 * registration rule, the connection-only credential ports, and why nothing here
 * touches the runtime's current user.
 *
 * ## The three things this node is not
 *
 *  - **It is not Sign Up.** Sign Up sets the browser's session as a side effect.
 *    This mints no session and returns no session token, so a function holding
 *    it cannot hand its caller a logged-in session for an account it just made.
 *  - **It is not `POST /users`.** That route DOES mint a session, and it is
 *    gated by `security.json`'s `signup` rule, which is about people signing
 *    themselves up. This runs as the system and meets a different gate: the
 *    function's own `call` rule (CWF-017).
 *  - **It cannot create an administrator.** Admin authority on this backend is a
 *    credential, not a user row, and privilege for a user comes only from a role
 *    in `_Role`, which nothing here writes. See `SystemUsers.ts`.
 *
 * ## `Unchanged` is "that username is taken"
 *
 * The task asked for "a **specific** failure for already exists — the single
 * most common branch a signup function needs to take, and the one that is
 * useless as a generic error". The outcome contract already has the port for it:
 * a user with that username existing is the post-condition already holding,
 * which is exactly `Unchanged`. `User Id` carries the EXISTING user's id on that
 * branch, so idempotent provisioning is one wire rather than a query first — and
 * a project whose idiom is "a duplicate is a bug" sets `Treat Unchanged as` to
 * Failure and gets the harder reading with no rewiring.
 *
 * ## Verification email: it does not send one
 *
 * Deliberate, and stated here because the node page has to say which. A
 * system-created account is an invite or an import, not a self-service signup,
 * and the address may not even be reachable yet. The row is written with
 * `emailVerified: false` unless `Email Verified` is ticked — so if this backend
 * has `verification.requireForLogin` on, an account created with it unticked
 * cannot log in until it is verified, which is the intended, visible behaviour.
 * To send the mail, wire `Done` into the Send Email node with the `verifyEmail`
 * template; to create an account that can log in straight away, tick the port.
 */

import { outcomeInputs, outcomeOutputs } from '@noodl/runtime/src/outcome';

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

const OUTCOMES = {
  done: 'Fires once the account exists and User Id holds its id',
  unchanged:
    'Fires when a user with this Username already exists. User Id holds the EXISTING user, so this is the ' +
    'branch to wire for "make sure this account exists"; set Treat Unchanged as to Failure if a duplicate is a bug',
  failure:
    'Fires when the account could not be created — a blank Username, a property the backend refuses, or a ' +
    'store that would not write'
};

export const node = {
  name: 'noodl.cloud.createuser',
  displayNodeName: 'Create User',
  category: 'Cloud',
  docs: 'https://docs.noodl.net/nodes/cloud-functions/create-user',
  color: 'data',
  connectionPanel: {
    groupPriority: ['General', 'Properties', 'Actions', 'User', 'Events', 'Error']
  },
  dynamicports: propertyDynamicPorts,
  inputs: {
    username: {
      group: 'General',
      displayName: 'Username',
      type: 'string',
      description: 'The account\'s identity, and what Log In looks it up by. Required; a blank one is a Failure',
      set: function (value) {
        this._internal.username = value;
      }
    },
    email: {
      group: 'General',
      displayName: 'Email',
      type: 'string',
      description:
        'The account\'s email address. Optional, and NOT checked for uniqueness — this backend\'s own signup ' +
        'does not check it either, so a duplicate email is not a duplicate user here',
      set: function (value) {
        this._internal.email = value;
      }
    },
    password: {
      group: 'General',
      displayName: 'Password',
      // ⚠️ Connection-only, and this is the trap CWF-015 names. A typed
      // parameter would be a plaintext password inside the project file every
      // deploy ships, so the property panel offers no field for it
      // (`propertyeditor/DataTypes/Ports.ts` filters `allowConnectionsOnly`
      // out) and the semantic validator errors on a parameter for this port.
      // Wire it from the Request node's parameter instead.
      type: { name: 'string', allowConnectionsOnly: true },
      description:
        'The account\'s password, hashed by the backend with the same function Log In verifies against. ' +
        'Leave it unwired for an invite or passwordless account: no hash is stored at all, so no password can ' +
        'ever match it until one is set. Connection-only — a password must not live in a project file',
      set: function (value) {
        this._internal.password = value;
      }
    },
    emailVerified: {
      group: 'General',
      displayName: 'Email Verified',
      type: 'boolean',
      // ⚠️ The declared default never runs its setter (FINDINGS A-D1), so the
      // value is read as `=== true` at call time and `undefined` lands on
      // false. The default is here for the panel, not for the behaviour.
      default: false,
      description:
        'Whether the new account counts as having a verified address. This node never sends a verification ' +
        'email; tick this for an account that must be able to log in straight away on a backend that requires ' +
        'verification, and leave it for one that should go through the normal flow',
      set: function (value) {
        this._internal.emailVerified = value;
      }
    },
    properties: propertiesInput,
    ...outcomeInputs(OUTCOMES),
    create: {
      displayName: 'Do',
      group: 'Actions',
      type: 'signal',
      description: 'Creates the account',
      valueChangedToTrue: function () {
        // ERG-001 §4: only the port mints an outcome token, and `doCreate` has
        // no other caller — no value setter on this node creates anything.
        this.scheduleCreate(this.beginOutcome());
      }
    }
  },
  outputs: {
    userId: {
      group: 'User',
      displayName: 'User Id',
      type: 'string',
      description:
        'The new account\'s id after Done, or the existing account\'s id after Unchanged. Blank after a Failure',
      getter: function () {
        return this._internal.userId;
      }
    },
    ...outcomeOutputs(OUTCOMES),
    error: errorOutput
  },
  methods: {
    setError,
    registerInputIfNeeded: registerPropertyInput,
    scheduleCreate: function (token) {
      scheduleAction.call(this, token, () => this.doCreate());
    },
    doCreate: function () {
      const tokens = drainOutcomes.call(this);

      if (!this._internal.username) {
        setError.call(this, 'user/username-required', 'Create User: a Username is required.', tokens);
        return;
      }

      callSystemUsers.call(
        this,
        'Create User',
        {
          op: 'create',
          username: this._internal.username,
          email: this._internal.email,
          password: this._internal.password,
          emailVerified: this._internal.emailVerified === true,
          properties: this._internal.userProperties
        },
        tokens,
        (result: SystemUserResult) => {
          this._internal.userId = result.userId;
          this.flagOutputDirty('userId');
        }
      );
    }
  }
};

export function setup() {
  // No runtime-side dynamic-port pusher, unlike Request/Response. Since WF-007
  // only the `dynamicports` declaration above ever fires (WFA-009), and adding
  // a second generator would create the parity obligation those two files carry
  // — two lists that must agree port for port — for no live benefit.
}
