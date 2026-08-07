---
title: "Verify Session Token"
---
Asks this backend whether a session token is one of its own live sessions, and whose. Cloud-only.

Verify Session Token looks a token up in this backend's `_Session` table and answers who holds it. It is for a token that arrived in the request BODY — from a mobile client, a partner integration, a callback — not the caller's own, which the Request node has already resolved onto `auth` (Authenticated) and `userId` (User Id). ⚠️ This is not CWF-010's JWT Verify: that node verifies somebody else's JWT against a key you hold, while this one asks our own backend about our own session. Only a session matches — an admin credential is not a session and an API key is not a session, so neither can be probed through this node. There is no expiry to report: this backend's session rows carry a token and a user id and nothing else, and a session lives until a password change or a delete revokes it.

## When to use it

When a cloud function receives a token it did not get as its own caller's credential and has to decide whether to trust it — a mobile client posting a token in a body, a partner passing a user's token through, a webhook that carries one. Reach for JWT Verify instead when the token was minted somewhere else and is signed with a key. Do not reach for either to check the caller's own session; that is already done.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.verifysessiontoken` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `token` | String | — | The session token to check, as it arrived in the request body. Not the caller's own — that is already resolved on the Request node's Authenticated and User Id. Connection-only, because a token in a project file is a credential in a project file |
| `treatUnchangedAs` | Enum (`unchanged`, `done`, `failure`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way; Failure suits one whose idiom is that a no-op is a bug. Completed fires whatever this is set to. |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `verify` | Signal | — | Checks the token. Nothing is checked, and nothing is written, until this fires |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `userId` | String | — | Whose session it is, after Done. Blank on every other branch |
| `username` | String | — | That user's username, after Done. Blank on every other branch |
| `valid` | Boolean | — | Whether the token is a live session. The value form of the Done / Unchanged branch |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the token is a live session — Valid is true and User Id holds whose it is |
| `unchanged` | Signal | — | Fires when the token is not a live session on this backend. Nothing failed and nothing changed; the answer is simply no, and this is the branch to wire to your 401 |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed. It never contains a password, a hash or a token |
| `failure` | Signal | — | Fires when the check could not be made at all, such as a blank Token |

## Patterns

- Request `receive` → Verify Session Token `verify`, with the body's token wired into `token`; `done` → the work, `unchanged` → a Response with Status set to Failure. That is the whole shape of a token-checked endpoint.

## Watch out for

- Putting this in a `public` function. It is an oracle for session tokens by design, so an unauthenticated caller behind an open rule can test tokens at whatever rate the limiter allows. Give the function a `call` rule and a per-function `rateLimit` (CWF-017).
- Using it to re-check the caller's own token. The Request node has already resolved it; a second lookup is a database round trip that answers a question already answered.
- Confusing it with JWT Verify. Verifying our own session token as if it were a JWT will never succeed, and verifying somebody else's JWT here will always answer `unchanged`.

## Related nodes

[JWT Verify](./noodl-cloud-jwtverify.md), [Create User](./noodl-cloud-createuser.md), [Update User](./noodl-cloud-updateuser.md), [Request](./noodl-cloud-request.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
