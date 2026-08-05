# CWF-015 — Creating a user from a cloud function

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) Pile C, approved 2026-08-05.
Richard's original: *"all the data nodes should be available in cloud functions, create user etc"*.
**Status:** open, unowned. **Real** — this is the one item on the track that is genuinely absent
rather than undoored.

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
([server/users.ts:7-9](../../../packages/nodegx-backend/src/server/users.ts#L7-L9)), and the cloud
runtime already has a `UserService` and a users API
([api/users.js](../../../packages/noodl-viewer-cloud/src/api/users.js)).

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
a partner) return valid / user id / expiry. ⚠️ **Do not confuse this with
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
  to the same path, never store or log it, and never echo it. `redact()` and the execution-history
  scrubber both need to know about this input — check both.
- ⚠️ The wire says Parse for compatibility reasons that have nothing to do with what the thing is
  ([BACKEND-AUTHORING-MODEL](../../reference/BACKEND-AUTHORING-MODEL.md)). `x-parse-session-token` is
  the header. Do not "fix" the naming here.
- ⚠️ Email verification and password reset flows (BAK-002) have their own token machinery. A Create
  User node that bypasses verification silently creates unverified users who cannot log in — decide
  whether it triggers the verification email, and say which on the node page.
