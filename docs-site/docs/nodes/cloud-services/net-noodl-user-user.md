---
title: "User"
---
Reads the currently signed-in user: id, username, email, custom properties, and an authenticated boolean, kept live across session changes.

User mirrors the current session's user. Its value outputs — `id`, `username`, `email` (strings) and one output per custom property on the User class — always reflect the signed-in user, and `authenticated` (boolean) is true exactly while a user is signed in. The node tracks the app-wide user service: it updates when Log In or Sign Up succeeds, when a stored session is restored, and when Log Out runs or the session is lost, so a single connection from `authenticated` can gate an entire logged-in UI. `changed` (signal) fires when the user's data changes. Triggering `fetch` (signal) re-reads the user from the server, firing `fetched` and then `done` on completion, or `failure` with `error` (string value) set; `completed` follows either way. `fetched` is the value-level announcement — the twin Record node fires it on binding too — and `done` is this invocation's outcome. It also works inside cloud functions, where it reflects the calling user's session.

## When to use it

The one node to read who is logged in and their properties, anywhere in the app. It performs no actions — pair it with Log In, Sign Up, Log Out and Set User Properties for those.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.User` |
| Available in | browser, cloud |
| SSR compatibility | partial — Sessions live in browser storage; a server render always sees a logged-out user. |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `runOnChange-user` | Boolean | `true` | Whether a new value on User properties re-runs this node. On by default; untick to make this input passive so only the control signal runs it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Re-reads the signed-in user from the backend, which is also how an expired session is discovered |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `authenticated` | Boolean | — | True while somebody is signed in on this device; a server render always sees false |
| `email` | String | — | Email address of the signed-in user; empty while nobody is signed in |
| `id` | String | — | Id of the signed-in user record; empty while nobody is signed in |
| `username` | String | — | Username of the signed-in user; empty while nobody is signed in |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when a property of the signed-in user changes, including a change another node made |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Fetch finished and the outputs below are up to date |
| `fetched` | Signal | — | Fires once the user record has been re-read and the outputs below are up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last read failed; empty until one does |
| `failure` | Signal | — | Fires when the user record could not be read, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property outputs include one port per custom user property in addition to the built-in ones.

## Ports at runtime

Beyond the static ports, the editor generates one value output per custom property in the User class schema (stored as `prop-<name>`, typed from the schema) plus a `changed-<name>` signal per property (built-ins authData/password/username/email are excluded — username and email have static outputs). In the browser it additionally registers the signal outputs `loggedIn` (Logged In), `loggedOut` (Logged Out) and `sessionLost` (Session Lost), which fire on the corresponding session transitions; these do not exist in the cloud runtime.

## Patterns

- `authenticated` → a Group's `visible` (and through an inverter to the login form): one boolean drives both faces of the UI.
- `loggedOut`/`sessionLost` signal outputs → navigation to the login page: handle forced sign-outs globally.

## Watch out for

- Storing the user id in your own variable at login time — read `id` from this node instead so restored and switched sessions stay correct.

## Examples

**Log in, show the user, log out**

The authentication triangle: Log In takes `username`/`password` values and a `login` signal, firing `success` or `failure` (+`error`). The User node is the session's single source of truth — its `authenticated` boolean and profile outputs update on login/logout, so UI binds to it rather than to the action nodes. Log Out ends the session from anywhere. Gate visible areas on `authenticated`, not on the login node's `success` pulse.

## Related nodes

[Log In](./net-noodl-user-log-in.md), [Log Out](./net-noodl-user-log-out.md), [Sign Up](./net-noodl-user-sign-up.md), [Set User Properties](./net-noodl-user-set-user-properties.md), [Condition](../logic/condition.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
