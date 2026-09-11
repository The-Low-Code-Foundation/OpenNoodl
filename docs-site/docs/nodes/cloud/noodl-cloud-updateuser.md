---
title: "Update User"
---
Writes properties (and optionally a new password) to a NAMED user from inside a cloud function, as the system. Cloud-only.

Update User is Set User Properties' server-side sibling, and the difference is the whole point: Set User Properties writes to whoever is signed in and fails when nobody is, while this one writes to the account whose id you give it, with the authority of the server. `userId` is required — a blank one is a `failure` with a sentence saying so, and never a fallback to the caller, because the failure mode this split exists to prevent is 'accidentally edited the caller instead of the target'. List the columns to write in `properties` to get one input per name, pulse `store` (Do), and `done` fires once the row is written.

## When to use it

In a cloud function that moderates or administers accounts: suspending a user, changing a plan after a webhook from a payment provider, resetting a password on request, correcting an imported record. Use the browser's Set User Properties node when a signed-in person is editing their own profile — that is the caller's own authority and does not belong on the server.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.updateuser` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `password` | String | — | A new password for this account, hashed by the backend. Setting one revokes EVERY session this user has, including one that may be calling this function. Leave it unwired to change properties only. Connection-only — a password must not live in a project file |
| `properties` | Stringlist | — | Names of the user columns this node writes, each becoming an input to supply the value. A name the backend refuses — objectId, ACL, password, sessionToken, or anything starting with "_" — is a Failure naming the key, never a silent drop |
| `userId` | String | — | Which account to change. Required — this node never falls back to the caller, and a blank id is a Failure rather than a write to whoever is signed in |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Writes the values below to the account named by User Id |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `sessionsRevoked` | Number | — | How many of this user's sessions the last write ended. Non-zero only when a Password was supplied |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the account has been written |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed. It never contains a password, a hash or a token |
| `failure` | Signal | — | Fires when the account could not be written — a blank or unknown User Id, a property the backend refuses, or a username already taken by somebody else |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups). Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| — | — | — |

## Ports at runtime

Every name listed in the `properties` parameter mints one input port called `prop-<name>`, in the Properties group, typed `*`. The set comes from that parameter alone — nothing is read from the backend's `_User` schema and no editor connection is involved — so an authoring tool can derive the port list from the project file. Names are de-duplicated and blanks dropped; a refused name still mints a port and fails at run time with the key named.

## Patterns

- Request `receive` → Update User `store`, with the target's id arriving as a request parameter: the shape of every 'admin acts on account X' function.
- Wire `sessionsRevoked` into the response when the function resets a password, so the caller knows the user was signed out everywhere.

## Watch out for

- Leaving `userId` unwired and expecting it to mean 'the current user'. It does not, and it never will — that node is Set User Properties, in the browser.
- Putting this node in a function with no `call` rule. A function that can change any account's password is a function that must name who may call it (CWF-017).

## Examples

**Take a privilege away, and write down that you did**

Revoking is the other half of granting, and it has one behaviour that surprises people: removing a role membership does NOT end that user's existing sessions. They stay signed in; what changes is what the access rules let them do on their next request. If the requirement is 'they are out, now', revoking the role is not sufficient on its own. `unchanged` covers two different post-conditions that both mean 'they are not in it' — they were never a member, or the role does not exist at all — and Error says which. Both are wired into the same continuation here, because for a revoke, 'they are not in that role any more' is the goal and it has been reached either way; a function that failed on an already-revoked user would break every retry. Update User then stamps the account with who did it and when, and it is worth being clear why that is a different node from Set User Properties: that one writes to whoever is signed in and fails when nobody is, while this writes to the account whose id you give it with the authority of the server. `userId` is required and a blank one is a failure rather than a fallback to the caller — which is exactly the accident (editing the admin instead of the target) that the split exists to prevent. Get User Roles reads the result back through the same resolver the permission check uses, so the Response tells the screen what the access rules will actually agree to, not what this function believes it just did.

## Related nodes

[Create User](./noodl-cloud-createuser.md), [Delete User](./noodl-cloud-deleteuser.md), [Verify Session Token](./noodl-cloud-verifysessiontoken.md), [Set User Properties](../cloud-services/net-noodl-user-set-user-properties.md), [Request](./noodl-cloud-request.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
