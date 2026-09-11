---
title: "Get User Roles"
---
Reads every permission role a user is currently in, from inside a cloud function. Cloud-only and read-only — nothing is written.

Get User Roles answers 'what is this account allowed to do' without making a change to find out. `Roles` comes from the same resolver a permission rule's `role:` check evaluates, so this cannot answer `member` while a rule disagrees — it is the actual check, not a second opinion on it. `unchanged` fires (rather than `done` with an empty array) when the user is in no roles at all, because that is the branch a membership check actually wants to take, and an empty array arriving on a `done` wire is easy to mistake for a port nobody connected.

## When to use it

Whenever a cloud function needs to decide something based on what a user is allowed to do — gating a branch on `role:staff`, showing a different response to a `pro` subscriber, or verifying a role grant actually took before reporting success to the caller. Also the honest way to check 'did Add User To Role actually work' without trusting its own report.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.getuserroles` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `treatUnchangedAs` | Enum (`unchanged`, `done`, `failure`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way; Failure suits one whose idiom is that a no-op is a bug. Completed fires whatever this is set to. |
| `userId` | String | — | Object id of the account to act on, usually wired from Create User or a Request parameter; blank is a Failure rather than a fallback to whoever called the function |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `read` | Signal | — | Reads the roles this user is in |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `roles` | Array | — | Every role this user is in once the operation has finished, read back through the same resolver the access check itself uses |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once Roles holds every role this user is in |
| `unchanged` | Signal | — | Fires when the user is in no roles at all, which is the branch a membership check wants |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed |
| `failure` | Signal | — | Fires when the roles could not be read — a blank User Id, or a user id nothing resolves |

## Patterns

- Read this after Add User To Role or Remove User From Role to confirm the membership actually changed, rather than trusting the mutation's own Done — useful when a function's response needs to report the account's current role set, not just that one operation succeeded.

## Watch out for

- Re-deriving 'is this user staff' from a cached copy of Roles taken earlier in a long-running function instead of reading it fresh — roles can change between the start of a function and a later branch inside it.

## Examples

**Take a privilege away, and write down that you did**

Revoking is the other half of granting, and it has one behaviour that surprises people: removing a role membership does NOT end that user's existing sessions. They stay signed in; what changes is what the access rules let them do on their next request. If the requirement is 'they are out, now', revoking the role is not sufficient on its own. `unchanged` covers two different post-conditions that both mean 'they are not in it' — they were never a member, or the role does not exist at all — and Error says which. Both are wired into the same continuation here, because for a revoke, 'they are not in that role any more' is the goal and it has been reached either way; a function that failed on an already-revoked user would break every retry. Update User then stamps the account with who did it and when, and it is worth being clear why that is a different node from Set User Properties: that one writes to whoever is signed in and fails when nobody is, while this writes to the account whose id you give it with the authority of the server. `userId` is required and a blank one is a failure rather than a fallback to the caller — which is exactly the accident (editing the admin instead of the target) that the split exists to prevent. Get User Roles reads the result back through the same resolver the permission check uses, so the Response tells the screen what the access rules will actually agree to, not what this function believes it just did.

## Related nodes

[Add User To Role](./noodl-cloud-addusertorole.md), [Remove User From Role](./noodl-cloud-removeuserfromrole.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
