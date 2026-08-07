# CWF-015 — Creating a user from a cloud function

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) Pile C, approved 2026-08-05.
Richard's original: *"all the data nodes should be available in cloud functions, create user etc"*.
**Status:** ✅ **shipped 2026-08-06.** Four cloud-only nodes — `Create User`, `Update User`,
`Delete User`, `Verify Session Token` — over one process-global seam
([`nodegx-backend/src/users/SystemUsers.ts`](../../../packages/nodegx-backend/src/users/SystemUsers.ts)),
no new HTTP route, driven end to end in
[`tests/cloud-system-users.test.ts`](../../../packages/nodegx-backend/tests/cloud-system-users.test.ts)
(16 cases, enforcement on). Slice 4 is closed by CWF-017 having landed first; the deny path is
tested. See **What shipped** at the foot of this page, including three premises below that were
wrong.

## What the cloud has and does not have

| | Cloud | Browser |
|---|---|---|
| Read the current user | **User**, **Set User Properties** ✅ | ✅ |
| Who called | Request node's `Authenticated` + `User Id` ✅ | n/a |
| Sign Up, Log In, Log Out, Verify Email, Reset Password, Sign In With, Magic Link | ❌ | ✅ |

**And the absence is defensible**, unlike Pile A's. Those seven are *session-shaped*: they set the
browser's current session as a side effect. `LogIn` server-side would mean "the server is now logged
in as bob", which is meaningless in a process handling many requests concurrently — and dangerous if
it half-works.

So this is not a move. It is a small server-shaped API on top of machinery that already exists: the
backend implements `POST /users` (signup), `GET /users/me`, `PUT /users/:id`
([server/users.ts:9-11](../../../packages/nodegx-backend/src/server/users.ts#L9-L11)), and the cloud
runtime already has a `UserService` and a users API
([api/users.js](../../../packages/noodl-viewer-cloud/src/api/users.js)).

> ⚠️ **Premise 1, corrected on the build.** Right in spirit, wrong about the named machinery — and
> the correction is load-bearing rather than pedantic. **None of those three routes can serve a
> system-scoped node.** `POST /users` *mints a session and answers with its token*
> ([users.ts:196-211](../../../packages/nodegx-backend/src/server/users.ts#L196-L211)), so a node
> built on it could hand its caller a logged-in session for an account it had just created — the
> exact escalation this task exists not to ship. `PUT /users/:id` refuses any id but the caller's
> own (`Cannot modify another user.`, code 206,
> [users.ts:222-226](../../../packages/nodegx-backend/src/server/users.ts#L222-L226)), so "set the
> properties of user X" cannot be expressed through it at all. What *was* reusable is one level
> down: `hashPassword` and `AdapterFacade`. The seam built instead is a process global,
> `_noodl_system_users`, the same idiom as CWF-009's `_noodl_get_secret` — **and adding no HTTP
> route is the point**, because a second door onto account creation would be a second gate to keep
> in step with the first. (The line reference was also off by two; fixed above.)

## Slices

### Slice 1 — Create User

Inputs: username, email, password (optional — a passwordless/invite user is a real case, see
BAK-004), plus arbitrary properties the way Set User Properties takes them. Outputs: user id,
Success/Failure, and a **specific** failure for "already exists" — the single most common branch a
signup function needs to take, and the one that is useless as a generic error.

⚠️ **This runs as the system, not as a session.** It must not touch the runtime's "current user" at
all. Read `UserService.forScope` carefully first: the Request node uses it per-request
([request.ts:99-127](../../../packages/noodl-viewer-cloud/src/nodes/cloud/request.ts#L99-L127)) and
that scope is the thing to leave alone.

### Slice 2 — Update / Delete User (as system)

Set User Properties exists but operates on *the current user*. A function moderating or
administering accounts needs "set properties of user X". Same node with an explicit id input, or a
sibling — decide, and make the difference legible on the canvas, because the failure mode is
"accidentally edited the caller instead of the target".

### Slice 3 — Verify Token

Given a session token (not the caller's own — one passed in the body, e.g. from a mobile client or
a partner) return valid / user id / ~~expiry~~.

> ⚠️ **Premise 2, wrong: there is no expiry.** `POST /login` and `POST /users` write `_Session` rows
> carrying `sessionToken` and `userId` and nothing else
> ([users.ts:138](../../../packages/nodegx-backend/src/server/users.ts#L138),
> [users.ts:197](../../../packages/nodegx-backend/src/server/users.ts#L197)), and the table itself
> declares only those two columns
> ([service.ts `ensureSystemTables`](../../../packages/nodegx-backend/src/service.ts)). A session on
> this backend lives until a password change or a delete revokes it. An `Expires At` output would
> have been blank on every session this backend has ever minted — an inert port, which is worse than
> an absent one — so the node ships without one and says why on its page.
>
> Related, filed not fixed: `noodl-viewer-cloud/src/api/users.js` `impersonate()` creates `_Session`
> rows *with* an `expiresAt` and queries on it, but `UserRoutes.findSession` — the thing that
> actually resolves a token — never looks at it. An "expiring" impersonation session therefore never
> expires.

⚠️ **Do not confuse this with
[CWF-010](CWF-010-THE-CRYPTO-KIT.md)'s JWT Verify.** That one verifies *someone else's* JWTs. This
one asks our own backend about our own session token. Both are wanted; naming them apart is half the
work.

### Slice 4 — the authorisation question

A function that can create and edit users is a function that must not be `public`. This slice is
**[CWF-017](CWF-017-FUNCTION-ACCESS-AND-LIMITS.md)'s door** applied: ship these nodes and the
per-function access rule together, or ship a privilege escalation with a nice icon.

## Done when

- A cloud function creates a user, driven against a real backend; the user can then log in from a
  browser app — the round trip, not just a 201.
- Creating a duplicate takes the "already exists" branch, not the generic failure.
- The caller's own session is provably untouched: a function that creates a user and then reads
  `User` still sees the original caller.
- Nothing in the browser gained a node.

## Traps

- ⚠️ **Password handling.** The backend hashes on signup; a node that accepts a password must hand it
  to the same path, never store or log it, and never echo it. ~~`redact()` and the execution-history
  scrubber both need to know about this input — check both.~~

  > ⚠️ **Premise 3, wrong: those are not two things, and neither needed a change.** `ops/redact.ts`
  > is a *thin door* over the execution-history scrubber and says so in its own module comment —
  > BAK-009 made one rule rather than two precisely so they could not drift. That one rule,
  > `SENSITIVE_KEY_PATTERN`
  > ([scrub.ts:44](../../../packages/noodl-viewer-cloud/src/execution-history/scrub.ts#L44)),
  > already matches `pass(word|wd)?` and `token`, so a request body naming its parameter `password`
  > or `token` is scrubbed before any run record is written. Checked, not assumed: the suite asserts
  > no created account's password appears in the audit trail. What the *nodes* add is the half no
  > key pattern can do — `Password` and `Token` are `allowConnectionsOnly`, so the property panel
  > offers no field to type one into and a credential cannot be frozen into the project file a
  > deploy ships.
- ⚠️ The wire says Parse for compatibility reasons that have nothing to do with what the thing is
  ([BACKEND-AUTHORING-MODEL](../../reference/BACKEND-AUTHORING-MODEL.md)). `x-parse-session-token` is
  the header. Do not "fix" the naming here.
- ⚠️ Email verification and password reset flows (BAK-002) have their own token machinery. A Create
  User node that bypasses verification silently creates unverified users who cannot log in — decide
  whether it triggers the verification email, and say which on the node page.
  **Decided: it does not send one.** A system-created account is an invite or an import, not a
  self-service signup, and the address may not be reachable yet. The row is written with
  `emailVerified: false` unless the node's `Email Verified` port is ticked, which is how an author
  creates an account that can log in straight away on a backend with `requireForLogin` on. To send
  the mail, wire `Done` into the Send Email node with the `verifyEmail` template. Said in those
  words on the node page and in the enrichment entry.

---

## What shipped

**Four nodes, cloud-only** (`noodl-viewer-cloud/src/nodes/index.ts`, `availableIn: ["cloud"]` in the
generated catalog, and a `Users` sub-category under Cloud Functions in
`nodelibraryexport.ts` so they are reachable from the picker):

| Node | Outcome shape |
|---|---|
| `Create User` | `done` = created · **`unchanged` = that username is taken**, with `User Id` carrying the *existing* account · `failure` |
| `Update User` | `done` · `failure` (no `unchanged` — nothing diffs the row first) |
| `Delete User` | `done` · `unchanged` = already absent · `failure` |
| `Verify Session Token` | `done` = live session · `unchanged` = not one of ours · `failure` = could not check |

Slice 1's "a **specific** failure for already exists" is `Unchanged`, not a second failure port: a
user with that username existing is the post-condition already holding, which is what the outcome
contract's third terminal outcome is *for*. It comes with `Treat Unchanged as` for a project whose
idiom is that a duplicate is a bug.

Slice 2's "same node or a sibling — decide": **siblings**, with `User Id` required on both and a
blank one a `Failure` that says *"this node never falls back to the caller"* rather than a write to
whoever happened to call.

### The access posture an author must set

⚠️ **A function holding these nodes needs `functions.<name>.call` in `security.json`** — CWF-017's
Permissions panel writes it. Set it to `nobody` (backend and admin only), a `role:<name>`, or at the
very least `authenticated`.

**If they set none**, the rule falls back to the graph's `Allow Unauthenticated` port
(`effectiveFunctionRule`, source `graph`): ticked ⇒ `public` ⇒ **the open internet can create
accounts on this backend**; unticked ⇒ `authenticated` ⇒ any signed-in user can. Both are pinned by
tests rather than described, because a posture nobody measured is a posture nobody has.

Two things the CWF-017 doc does not say, both found by driving it:

- **`devOpen: true` bypasses the function gate entirely** (`HttpServer.assertAccess` step 2). It is
  loopback-only and a non-loopback bind refuses to start with it, so this is a local-development
  fact and not a deploy one — but it does mean a rule set locally is not being *tested* locally.
- **`call: 'nobody'` on a function whose Request node has `Allow Unauthenticated` unticked is closed
  to literally everyone, the operator included.** The admin credential bypasses the *rule*
  (`checkFunctionCall`, source `credential`) and then meets the graph's own check, where it fails,
  because an admin bearer token is not a session token. The mirror image of the contradiction the
  Permissions panel already names.

`runAs: 'caller'` is still refused at load (`model.ts` `validateSecurityConfig`), and that is the
right answer here: these nodes run **as the system, unconditionally**, because there is no per-run
credential seam to run them any other way. So `runAs` is not a lever an author can pull to soften
them — `call` is the only one. If `runAs: 'caller'` ever lands, a function holding these nodes
declaring it would be a contradiction the loader should catch.

### What stops "a node that can create a user" being "a node that can create an admin"

1. **There is no admin user.** Admin authority is a *credential* (`security.adminToken`, matched by
   `SecurityState.matchAdminCredential`), never a `_User` row and never a column on one.
2. **Privilege for a user comes only from a role**, in `_Role` + `_Join_users__Role`. Nothing in
   this family writes either table or calls `addRelation`, so a created user resolves to `roles: []`
   and every `role:` rule denies it — asserted, by creating a user through a function and having a
   role-gated function refuse it.
3. **Protected keys are refused, not stripped.** `objectId`, `createdAt`, `updatedAt`, `ACL`,
   `password`, `sessionToken` and everything beginning with `_` are a `failure` naming the key.
   `POST /users` quietly `delete`s `ACL`; a system-privileged node has to be louder than that.
4. **No session is ever minted.** `Create User` writes a row and stops. No result this seam returns
   carries a session token.
5. **The gate**, above — and the deny path is tested with both halves: the 403 *and* the absence of
   the account, because a 403 that arrives after the write would still be a breach.

### Deferred, with the reason

- **A `_Role` membership node.** Deliberately not shipped. Roles are the one thing that turns a user
  row into privilege, and putting them behind a graph would undo point 2 above. `POST
  /admin/roles/:name/users` already exists for an operator.
- **Sending a verification email from `Create User`.** See the trap above: decided against, and the
  author has `Send Email` for it.
- **An example in the enrichment corpus.** These are `examples: []` like every other cloud-only node
  (Secret, the crypto three): a validated example is a v2 graph fragment, and the corpus has none for
  cloud-function graphs yet.
