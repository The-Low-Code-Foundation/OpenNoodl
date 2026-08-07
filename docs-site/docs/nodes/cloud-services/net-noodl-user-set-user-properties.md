---
title: "Set User Properties"
---
Saves changes to the signed-in user's email, username and custom properties on the cloud backend.

Set User Properties writes the current values of its `email` and `username` (string values) and its per-property inputs to the signed-in user when `store` (Do, signal) is triggered. On success the server confirms the update, the local user model changes — User nodes see the new values and fire their per-property Changed signals — and `done` (signal) fires. On failure `error` (string value) is set and `failure` (signal) fires. It requires a signed-in session; it is also available inside cloud functions, where it acts on the calling user.

## When to use it

The action behind a profile/settings form for the logged-in user. To set properties at account creation use Sign Up's property inputs; to read properties use the User node. It cannot edit other users — do that server-side in a cloud function with appropriate trust.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.SetUserProperties` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `email` | String | — | New email address for the signed-in user; leave blank to keep the current one |
| `username` | String | — | New username for the signed-in user; leave blank to keep the current one |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Writes the values below to the signed-in user, and fails when nobody is signed in |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the user record has been written |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last write failed; empty until one does |
| `failure` | Signal | — | Fires when the user record could not be written, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property inputs include one port per custom user property.

## Ports at runtime

The editor generates one value input per custom property in the User class schema (stored as `prop-<name>`, typed from the schema). In the browser the built-ins password and emailVerified are excluded along with system fields; only wired or set inputs are sent as changes.

## Patterns

- Text Input `text` → `prop-<name>`, Save button `onClick` → `store`, `done` → a confirmation state: the standard profile form.
- User node property output → Text Input `text` (initial value), edited value → back into `prop-<name>` here: read-modify-write on one screen.

## Examples

**Sign up, then set profile properties**

Sign Up creates the account and starts a session (`done` fires once the user is signed up and logged in). Custom profile fields beyond username/email/password are written afterwards with Set User Properties, whose property inputs are generated from the user-class schema — here `displayName` is set from the same form, triggered by the signup succeeding. Chain the signals: signup `done` → set-properties `store`.

## Related nodes

[User](./net-noodl-user-user.md), [Sign Up](./net-noodl-user-sign-up.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
