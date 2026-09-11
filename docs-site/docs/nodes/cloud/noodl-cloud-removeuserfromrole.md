---
title: "Remove User From Role"
---
Takes a user out of a named permission role from inside a cloud function, as the system. Cloud-only — the other half of Add User To Role.

Remove User From Role deletes the membership row linking `userId` to `role`, so the app can revoke a privilege it once granted — a subscription lapsing, a moderator being stood down. `unchanged` covers two different post-conditions that both mean 'they are not in it': the user was never a member, or the role does not exist at all; `Error` says which, for a function that wants to tell them apart, while `Roles` and every wired-through branch treat them the same. Removing a role membership does **not** end that user's existing sessions — a session token is not a copy of the roles it had at sign-in, so the very next request that token makes already resolves the shorter list. There is no cache to invalidate and nothing to revoke separately.

## When to use it

In a cloud function that de-provisions or downgrades access: ending a lapsed subscription's `pro` role, removing a stood-down moderator from `staff`. A de-provisioning job can safely re-run — both `unchanged` branches mean the desired end state already holds, the same reading Delete User gives an account id that is already gone.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.removeuserfromrole` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `role` | String | — | Name of the role to take the user out of, matching the name a permission rule uses after "role:" |
| `treatUnchangedAs` | Enum (`unchanged`, `done`, `failure`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way; Failure suits one whose idiom is that a no-op is a bug. Completed fires whatever this is set to. |
| `userId` | String | — | Object id of the account to act on, usually wired from Create User or a Request parameter; blank is a Failure rather than a fallback to whoever called the function |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `remove` | Signal | — | Removes the user from the role |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `roles` | Array | — | Every role this user is in once the operation has finished, read back through the same resolver the access check itself uses |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the user is out of the role and Roles no longer lists it |
| `unchanged` | Signal | — | Fires when the user was not in this role, or the role does not exist, so a de-provisioning job re-run does not go red; Error says which of the two it was |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed |
| `failure` | Signal | — | Fires when the membership could not be removed — a blank Role or User Id, or a store that would not write |

## Patterns

- Wire a lapsed-subscription webhook straight to this node's `remove`, with `done` and `unchanged` both leading to the same next step — the account ends up without the role either way, which is the only thing that response needs to be true.

## Watch out for

- Assuming removing a role also signs the user out of an active session. It does not — the next request that session's token makes already sees the shorter role list, but the session itself stays valid until it expires or is separately revoked.

## Examples

**Take a privilege away, and write down that you did**

Revoking is the other half of granting, and it has one behaviour that surprises people: removing a role membership does NOT end that user's existing sessions. They stay signed in; what changes is what the access rules let them do on their next request. If the requirement is 'they are out, now', revoking the role is not sufficient on its own. `unchanged` covers two different post-conditions that both mean 'they are not in it' — they were never a member, or the role does not exist at all — and Error says which. Both are wired into the same continuation here, because for a revoke, 'they are not in that role any more' is the goal and it has been reached either way; a function that failed on an already-revoked user would break every retry. Update User then stamps the account with who did it and when, and it is worth being clear why that is a different node from Set User Properties: that one writes to whoever is signed in and fails when nobody is, while this writes to the account whose id you give it with the authority of the server. `userId` is required and a blank one is a failure rather than a fallback to the caller — which is exactly the accident (editing the admin instead of the target) that the split exists to prevent. Get User Roles reads the result back through the same resolver the permission check uses, so the Response tells the screen what the access rules will actually agree to, not what this function believes it just did.

## Related nodes

[Add User To Role](./noodl-cloud-addusertorole.md), [Get User Roles](./noodl-cloud-getuserroles.md), [Delete User](./noodl-cloud-deleteuser.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
