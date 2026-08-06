import NoodlRuntime from '@noodl/runtime';

export function registerNodes(runtime: NoodlRuntime) {
  [
    require('./cloud/request'),
    require('./cloud/response'),
    require('./cloud/sendemail'),

    /**
     * CWF-009 — `Secret`. Registered here rather than in `@noodl/runtime`'s
     * shared list for the one reason that matters: the shared list reaches
     * every runtime, and a Secret node in a browser bundle is a secret in a
     * browser bundle. See the module comment on `cloud/secret.ts`.
     */
    require('./cloud/secret'),

    /**
     * CWF-010 — the three crypto nodes that take a KEY. Hash, Random Bytes and UUID are in the
     * shared runtime because none of them does; these are here because a key in a browser is a
     * key in the hands of everyone who opens the page. JWT Verify is here for the same reason:
     * an HS256 key is a shared secret, so verifying in a browser means shipping it.
     */
    require('./cloud/hmac'),
    require('./cloud/jwtsign'),
    require('./cloud/jwtverify'),

    /**
     * CWF-015 — user administration **as the system**. Here for the same reason
     * as Secret, one notch further up: a node that creates accounts, shipped in
     * a browser bundle, is account creation in the hands of everyone who opens
     * the page. See the family note in `cloud/system-users.ts`.
     *
     * The seven session-shaped user nodes the browser has — Sign Up, Log In,
     * Log Out, Verify Email, Reset Password, Sign In With, Magic Link — stay
     * absent server-side, deliberately: each sets the browser's current session
     * as a side effect, which is meaningless in a process handling many
     * requests at once and dangerous if it half-works.
     */
    require('./cloud/createuser'),
    require('./cloud/updateuser'),
    require('./cloud/deleteuser'),
    require('./cloud/verifysessiontoken'),

    /**
     * F86 — role membership. Here for the same reason as the four above, one
     * notch further up again: **role membership is the only way a `_User` row
     * acquires privilege on this backend** (`SecurityState.rolesForUser`; admin
     * authority is a credential, not a row). An Add User To Role node in a
     * browser bundle would be one wire from a button to "make me staff", so
     * there is no browser version of these and there will not be one.
     *
     * Deliberately NOT part of the CWF-015 family above: `users/SystemUsers.ts`
     * has a documented, tested property that it writes no roles, and that is
     * what makes "a node that can create a user" provably not "a node that can
     * create an admin". Granting privilege has its own module, its own process
     * global and its own audit actions. See `cloud/system-roles.ts`.
     */
    require('./cloud/addusertorole'),
    require('./cloud/removeuserfromrole'),
    require('./cloud/getuserroles'),

    require('./data/aggregatenode'),

    /**
     * CWF-003 — `HTTP Request`, the modern HTTP node.
     *
     * Registered **here** rather than by uncommenting the shared list in `noodl-runtime.ts`:
     * `noodl-viewer-react/src/register-nodes.js` already requires this same module for the
     * browser, so uncommenting the shared line would register it twice there. Until this line, a
     * cloud function's only HTTP node was the deprecated `REST2` — which the picker hides,
     * because it carries `deprecated: true`. So server-side HTTP was, in practice, unreachable
     * without a Function node.
     *
     * Two things this depends on, both checked rather than assumed:
     *
     *  - **The transport is `fetch`, unconditionally** (`httpnode.ts:697`) — there is no
     *    `XMLHttpRequest` branch to guard, unlike `cloudfunction2.ts`. Node 22 supplies `fetch`,
     *    `FormData`, `Blob` and `Headers` as globals in this process (TALK-007 §3.2 measured
     *    them inside a real cloud function), so the multipart path has what it needs too.
     *  - **The editor-connection listeners are inert here.** The shared comment said the node was
     *    "moved to viewer for debugging", which invited the guess that its `setup()` was the
     *    reason. It is not: `setup()` returns immediately unless
     *    `context.editorConnection.isRunningLocally()` — the same guard `restnode`,
     *    `filtercollectionnode` and eight other already-shared nodes carry — and the cloud
     *    runtime only sets `isRunningLocally` when it was asked to connect to an editor, which
     *    the backend never does.
     */
    require('@noodl/runtime/src/nodes/std-library/data/httpnode')
  ].forEach(function (nodeDefinition) {
    runtime.registerNode(nodeDefinition);
  });
}
