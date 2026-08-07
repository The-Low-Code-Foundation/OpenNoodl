---
title: "Sign Up"
---
Creates a new user account on the cloud backend and logs it in, with inputs for custom user properties.

Sign Up creates a user from the current `username`, `password` and optional `email` (string values), plus one input per custom property on the User class, when `signup` (Do, signal) is triggered. On success the new account is immediately logged in — the session is stored in the browser, every User node updates, their Logged In signal fires — and `done` (signal) fires. On failure (e.g. username taken) `error` (string value) is set and `failure` (signal) fires, and no account is created.

## When to use it

The action node behind a registration form. For signing in an existing user use Log In; for editing the signed-in user's properties later use Set User Properties.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.SignUp` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `email` | String | — | Email address for the new account; leave blank if the project does not ask for one |
| `password` | String | — | Password for the new account |
| `username` | String | — | Username for the new account |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `signup` | Signal | — | Creates an account from the values below and signs it in |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the account has been created and signed in |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last sign-up failed; empty until one does |
| `failure` | Signal | — | Fires when the account could not be created, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property inputs include one port per custom user property.

## Ports at runtime

The editor generates one value input per custom property in the User class schema (stored as `prop-<name>`, typed from the schema; built-ins like username, password, email and system fields are excluded). These set the new user's properties at creation time.

## Patterns

- Text Inputs → `username`/`password`/`email`, Button `onClick` → `signup`, `done` → navigate into the app: the standard registration form.
- Fill `prop-<name>` inputs at sign-up for properties every account must have, instead of a follow-up Set User Properties call.

## Watch out for

- Triggering Log In from `done` — sign-up already establishes the session.

## Examples

**Sign up, then set profile properties**

Sign Up creates the account and starts a session (`done` fires once the user is signed up and logged in). Custom profile fields beyond username/email/password are written afterwards with Set User Properties, whose property inputs are generated from the user-class schema — here `displayName` is set from the same form, triggered by the signup succeeding. Chain the signals: signup `done` → set-properties `store`.

## Related nodes

[Log In](./net-noodl-user-log-in.md), [User](./net-noodl-user-user.md), [Set User Properties](./net-noodl-user-set-user-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
