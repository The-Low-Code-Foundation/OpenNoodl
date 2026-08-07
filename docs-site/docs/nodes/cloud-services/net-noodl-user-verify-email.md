---
title: "Verify Email"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated: confirms a user's email address using an emailed token. Superseded by cloud-function-based flows.

Verify Email submits `username` and `token` (string values, the token coming from the verification email) to the backend when `verify` (Do, signal) is triggered; `success`/`failure` (signals) and `error` (string value) report the outcome. It is marked deprecated in the runtime — the source directs new work to cloud functions, where a component called via CloudFunction2 verifies the token and marks the address confirmed server-side.

## When to use it

Do not use in new graphs — implement email verification in a cloud function called via CloudFunction2 instead.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.VerifyEmail` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `token` | String | — | Verification token taken from the link in the email |
| `username` | String | — | Username the verification link was issued for |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `verify` | Signal | — | Confirms the address using the token from the verification email |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `success` | Signal | — | Fires once the address has been confirmed |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last attempt failed; empty until one does |
| `failure` | Signal | — | Fires when the token was rejected or the request could not be made, after the reason has been reported on the error channel |


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
