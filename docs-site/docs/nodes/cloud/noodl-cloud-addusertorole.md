---
title: "Add User To Role"
---
Adds a user to a named permission role from inside a cloud function, as the system. Cloud-only — the only way an account gains privilege.

Add User To Role writes a membership row linking `userId` to `role`. `Roles` (every role the user is now in) and `roleCreated` are read back through the same resolver a permission rule's `role:` check uses, so this cannot answer a role the access check would disagree with. A `role` that does not exist is a `failure` unless `createRole` is on — off by default on purpose, because a mistyped role name that silently gets created is a grant that names nobody: the rule that was meant to reference it still says the old, correct name. `userId` is required and there is deliberately no fallback to whoever called the function; wiring a request parameter straight into it turns this into 'grant any role to any account' with an HTTP endpoint in front, so gate the function with a `call` rule (CWF-017) and check the caller's own id before wiring it in.

## When to use it

In a cloud function that provisions or escalates privilege: making a newly signed-up user a `member`, promoting someone to `staff`, adding a subscriber to a `pro` role after a payment webhook confirms it. Never reachable from a browser graph — that would be one wire from a button to self-granted admin.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.addusertorole` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `createRole` | Boolean | `false` | Creates the role when it does not exist yet, instead of failing; leave it off so a mistyped name is a loud Failure rather than a role no rule ever names |
| `role` | String | — | Name of the role to put the user in, matching the name a permission rule uses after "role:" — letters, digits, underscore and hyphen only |
| `treatUnchangedAs` | Enum (`unchanged`, `done`, `failure`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way; Failure suits one whose idiom is that a no-op is a bug. Completed fires whatever this is set to. |
| `userId` | String | — | Object id of the account to act on, usually wired from Create User or a Request parameter; blank is a Failure rather than a fallback to whoever called the function |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `add` | Signal | — | Adds the user to the role |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `roleCreated` | Boolean | — | True when this call created the role as well as the membership, which is worth branching on because a brand-new role is named by no permission rule yet |
| `roles` | Array | — | Every role this user is in once the operation has finished, read back through the same resolver the access check itself uses |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the user is in the role and Roles lists it |
| `unchanged` | Signal | — | Fires when the user was already in this role, with Roles still listing it, so a signup function re-run does not go red; set Treat Unchanged as to Failure if a repeat is a bug |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed |
| `failure` | Signal | — | Fires when the membership could not be written — a blank Role or User Id, a user id nothing resolves, or a role that does not exist and Create Role If Missing left off |

## Patterns

- Wire straight after Create User in a signup function to put every new account into a default role like `member` — `unchanged` and `done` both mean the account is now in that role, so wiring both to the same next step covers a re-run cleanly.

## Watch out for

- Wiring a request parameter straight into `userId` (or `role`) on a function anyone may call. That is 'grant any role to any account' with an HTTP endpoint in front of it — give the function a `call` rule (CWF-017) and check inside the graph that the caller is entitled to make this particular grant.
- Leaving Create Role If Missing on as a default habit. It turns a mistyped role name into a role that exists, has one member, and is named by no permission rule — a grant that silently never takes effect.

## Related nodes

[Remove User From Role](./noodl-cloud-removeuserfromrole.md), [Get User Roles](./noodl-cloud-getuserroles.md), [Create User](./noodl-cloud-createuser.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
