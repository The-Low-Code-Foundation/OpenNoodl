---
title: "Log Out"
---
Ends the current user session on the cloud backend and clears it from the browser.

Log Out ends the current session when its `login` input (displayed 'Do', signal) is triggered: the backend session is revoked, the stored session is removed from the browser, and the app-wide user service switches to logged-out — updating every User node (`authenticated` becomes false) and firing their Logged Out signal. `done` (signal) fires when this completes; `failure` (signal) fires with `error` (string value) set if the request fails.

## When to use it

The action behind a log-out button or menu item. To react to the session ending (e.g. navigate to the login page), listen on this node's `done` or the User node's Logged Out signal.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.LogOut` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `login` | Signal | — | Signs the current user out and clears the stored session |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the session has been ended |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last sign-out failed; empty until one does |
| `failure` | Signal | — | Fires when the sign-out was refused, after the reason has been reported on the error channel |

## Patterns

- Button `onClick` → `login` (Do), `done` → navigate to the public/login page.

## Examples

**Log in, show the user, log out**

The authentication triangle: Log In takes `username`/`password` values and a `login` signal, firing `success` or `failure` (+`error`). The User node is the session's single source of truth — its `authenticated` boolean and profile outputs update on login/logout, so UI binds to it rather than to the action nodes. Log Out ends the session from anywhere. Gate visible areas on `authenticated`, not on the login node's `success` pulse.

## Related nodes

[Log In](./net-noodl-user-log-in.md), [User](./net-noodl-user-user.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
