---
title: "Log In"
---
Logs a user into the cloud backend with username and password, establishing the session the User node reflects.

Log In sends the current `username` and `password` (string values) to the cloud backend when `login` (Do, signal) is triggered. On success the returned session is stored in the browser (it persists across reloads), the app-wide user service switches to the logged-in user — which updates every User node and fires their Logged In signal — and `done` (signal) fires. On a bad login or network problem `error` (string value) is set with the message and `failure` (signal) fires; nothing about the current session changes.

## When to use it

The action node behind a login form. To read who is logged in, or to react to session changes, use the User node; to create an account use Sign Up (which also logs the new user in); to end the session use Log Out.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.LogIn` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `password` | String | — | Password to sign in with |
| `username` | String | — | Username to sign in as |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `login` | Signal | — | Attempts to sign in with Username and Password |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the sign-in succeeded and a session has been stored |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last sign-in failed; empty until one does |
| `failure` | Signal | — | Fires when the sign-in was refused, after the reason has been reported on the error channel |

## Patterns

- Text Input `text` → `username`/`password`, Button `onClick` → `login`, `done` → navigation: the standard login form.
- `error` → a Text node's `text`: surface backend messages like 'Invalid username/password' directly.

## Watch out for

- Driving logged-in UI from this node's `done` signal alone — state belongs to the User node's `authenticated` boolean, which also covers sessions restored on reload.

## Examples

**Log in, show the user, log out**

The authentication triangle: Log In takes `username`/`password` values and a `login` signal, firing `success` or `failure` (+`error`). The User node is the session's single source of truth — its `authenticated` boolean and profile outputs update on login/logout, so UI binds to it rather than to the action nodes. Log Out ends the session from anywhere. Gate visible areas on `authenticated`, not on the login node's `success` pulse.

## Related nodes

[User](./net-noodl-user-user.md), [Sign Up](./net-noodl-user-sign-up.md), [Log Out](./net-noodl-user-log-out.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
