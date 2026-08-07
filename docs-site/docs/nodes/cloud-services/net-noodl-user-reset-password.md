---
title: "Reset Password"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated: completes a password reset using an emailed token. Superseded by cloud-function-based flows.

Reset Password submits `username`, `token` (from the reset email) and `newPassword` (string values) to the backend when `reset` (Do, signal) is triggered; `success`/`failure` (signals) and `error` (string value) report the outcome. It is marked deprecated in the runtime — the source directs new work to cloud functions, where the token verification and password update run server-side in a component called via CloudFunction2.

## When to use it

Do not use in new graphs — implement password reset in a cloud function called via CloudFunction2 instead.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.ResetPassword` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `newPassword` | String | — | Password to set on the account |
| `token` | String | — | Reset token taken from the link in the email |
| `username` | String | — | Username the reset link was issued for |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `reset` | Signal | — | Sets the account password to New Password using the token from the reset email |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `success` | Signal | — | Fires once the password has been changed |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last attempt failed; empty until one does |
| `failure` | Signal | — | Fires when the token was rejected or the request could not be made, after the reason has been reported on the error channel |


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
