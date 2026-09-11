---
title: "Create User"
---
Creates a user account from inside a cloud function, as the system. Cloud-only — it does not exist in the browser.

Create User writes a new `_User` row on this backend's own database, with the authority of the server rather than of whoever called the function. Set `username` (the identity Log In looks accounts up by), optionally wire `password` and `email`, list any extra columns in `properties` to get one input per name, then pulse `create` (Do). On success `done` fires and `userId` holds the new account's id. It mints no session and returns no session token, so it is not Sign Up and cannot hand a caller a logged-in session for an account it just made. A password that is never wired means no password hash is stored at all — the invite/passwordless account BAK-004 describes — and no password can match until one is set.

## When to use it

In a cloud function that provisions accounts: an invite flow, a bulk import, a signup that has to validate something server-side first, or a partner integration that creates users on your behalf. Do NOT use it for a person signing themselves up in your app — that is the browser's Sign Up node, which sets the session as it goes. ⚠️ A function containing this node must carry a `call` rule in the backend's Permissions panel (CWF-017). With no rule the function's Request node decides: `Allow Unauthenticated` ticked means the open internet may create accounts, and unticked means any signed-in user may.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.createuser` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `email` | String | — | The account's email address. Optional, and NOT checked for uniqueness — this backend's own signup does not check it either, so a duplicate email is not a duplicate user here |
| `emailVerified` | Boolean | `false` | Whether the new account counts as having a verified address. This node never sends a verification email; tick this for an account that must be able to log in straight away on a backend that requires verification, and leave it for one that should go through the normal flow |
| `password` | String | — | The account's password, hashed by the backend with the same function Log In verifies against. Leave it unwired for an invite or passwordless account: no hash is stored at all, so no password can ever match it until one is set. Connection-only — a password must not live in a project file |
| `properties` | Stringlist | — | Names of the user columns this node writes, each becoming an input to supply the value. A name the backend refuses — objectId, ACL, password, sessionToken, or anything starting with "_" — is a Failure naming the key, never a silent drop |
| `treatUnchangedAs` | Enum (`unchanged`, `done`, `failure`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way; Failure suits one whose idiom is that a no-op is a bug. Completed fires whatever this is set to. |
| `username` | String | — | The account's identity, and what Log In looks it up by. Required; a blank one is a Failure |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `create` | Signal | — | Creates the account |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `userId` | String | — | The new account's id after Done, or the existing account's id after Unchanged. Blank after a Failure |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the account exists and User Id holds its id |
| `unchanged` | Signal | — | Fires when a user with this Username already exists. User Id holds the EXISTING user, so this is the branch to wire for "make sure this account exists"; set Treat Unchanged as to Failure if a duplicate is a bug |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last operation could not be performed. It never contains a password, a hash or a token |
| `failure` | Signal | — | Fires when the account could not be created — a blank Username, a property the backend refuses, or a store that would not write |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups). Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| — | — | — |

## Ports at runtime

Every name listed in the `properties` parameter mints one input port called `prop-<name>`, in the Properties group, typed `*`. The set is derived from that parameter alone — nothing is discovered from the backend's `_User` schema, and no editor connection or running backend is involved — so an authoring tool can compute the port list from the project file exactly as the editor does. Names are de-duplicated and blanks dropped. A `prop-` name the backend refuses (objectId, createdAt, updatedAt, ACL, password, sessionToken, or anything starting with `_`) still mints a port; the refusal happens at run time, on the `failure` branch, with the key named.

## Patterns

- Request `receive` → Create User `create`, with the Request node's parameter outputs wired into `username` and `password`: the ordinary shape of a server-side provisioning function.
- Wire `unchanged` to the same Response as `done` when the function's job is 'make sure this account exists'. `userId` is correct on both branches.
- Wire `failure` somewhere that answers the caller. A function whose only wired path is the happy one hangs until its timeout (CWF-018) the first time a username is taken.

## Watch out for

- Leaving the function without a `call` rule. A cloud function holding this node and answering `public` is account creation for the open internet.
- Returning `userId` from a `public` function on the `unchanged` branch. That turns the function into a username-enumeration oracle: it answers 'this one exists' for any name a caller tries.
- Reaching for this instead of the browser's Sign Up node. Sign Up signs the person in; this deliberately does not, and bolting a Log In onto the response is how a signup flow ends up with two sources of truth for the session.

## Examples

**Create an account and grant it a role, server-side**

Creating the account and granting the privilege are two writes, and they are two nodes because only the second one can fail in a way that matters. Create User writes a `_User` row with the authority of the SERVER rather than of whoever called the function, which is what makes this safe to expose as an admin action and also what makes it not Sign Up: it mints no session and returns no session token, so it cannot hand anyone a logged-in session — it creates an account somebody else will later sign in to. Add User To Role then writes the membership row, and `createRole` is deliberately left OFF here. That default is the point of the node: a mistyped role name that silently got created would be a grant that names nobody, because the permission rule that was meant to reference it still says the old, correctly-spelled name — so the account would look privileged in the admin screen and be refused by every access check. Off, a role that does not exist is a `failure` you can see. `Roles` comes back through the same resolver a permission rule's `role:` check evaluates, so what the function returns is the actual state of the access check rather than a second opinion on it. Both writes have a THIRD outcome, and wiring it is what makes re-inviting somebody harmless. `unchanged` on Create User means an account with that username already exists — and it still publishes `userId`, carrying the EXISTING account — so routing it into the grant makes the whole function idempotent in one wire rather than needing a lookup-first branch. `unchanged` on Add User To Role means they were already in it, which is a success for an invite, so it joins the success Response. Leave neither dangling: an unwired third outcome is a chain that silently stops, and the caller waits for a reply that is never sent. If a project's idiom is that a duplicate invite IS a bug, say so explicitly with Treat Unchanged As rather than by leaving the wire off. The failure Response is not optional decoration: a function whose only exit is the success path returns nothing at all when Create User fails, and the caller sees a timeout rather than 'that username is taken'.

## Related nodes

[Update User](./noodl-cloud-updateuser.md), [Delete User](./noodl-cloud-deleteuser.md), [Verify Session Token](./noodl-cloud-verifysessiontoken.md), [Request](./noodl-cloud-request.md), [Response](./noodl-cloud-response.md), [Set User Properties](../cloud-services/net-noodl-user-set-user-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
