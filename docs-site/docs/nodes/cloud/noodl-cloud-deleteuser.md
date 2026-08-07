---
title: "Delete User"
---
Deletes a named user account and every session it holds, from inside a cloud function, as the system. Cloud-only.

Delete User removes the `_User` row whose id you give it, and every `_Session` row belonging to it, with the authority of the server. Sessions go first and that ordering is deliberate: a deleted user whose sessions survived would leave tokens that resolve to a row the backend can no longer fetch. `sessionsRevoked` reports how many went, which is also the honest answer to 'was anybody actually signed in as them?'. `userId` is required — a blank one is a `failure`, never the deletion of whoever called.

## When to use it

In a cloud function that closes accounts: a moderation action, an account-deletion request the user made in your app, or the cleanup half of a provisioning job. There is no browser equivalent and there deliberately is not one.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.deleteuser` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `treatUnchangedAs` | Enum (`unchanged`, `done`, `failure`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way; Failure suits one whose idiom is that a no-op is a bug. Completed fires whatever this is set to. |
| `userId` | String | — | Which account to delete. Required — this node never falls back to the caller, and a blank id is a Failure rather than the deletion of whoever is signed in |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `remove` | Signal | — | Deletes the account named by User Id, and every session it holds |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `sessionsRevoked` | Number | — | How many sessions the deleted account held. Zero after Unchanged |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the account and its sessions are gone |
| `unchanged` | Signal | — | Fires when there is no user with this id — the account is already absent, which is the goal met |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed. It never contains a password, a hash or a token |
| `failure` | Signal | — | Fires when the account could not be deleted, including when User Id is blank |

## Patterns

- Wire `done` and `unchanged` to the same Response when the function's job is 'make sure this account is gone'. Both mean it is.

## Watch out for

- Wiring a request parameter straight into `userId` on a function anyone may call. That is 'delete any account by id' with an HTTP endpoint in front of it — give the function a `call` rule (CWF-017) and check inside the graph that the caller is entitled to delete that particular account.
- Expecting a blank `userId` to delete the caller's own account. It is a failure; read the caller's id from the Request node's `userId` output and wire it in explicitly, so the graph says what it does.

## Related nodes

[Create User](./noodl-cloud-createuser.md), [Update User](./noodl-cloud-updateuser.md), [Verify Session Token](./noodl-cloud-verifysessiontoken.md), [Request](./noodl-cloud-request.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
