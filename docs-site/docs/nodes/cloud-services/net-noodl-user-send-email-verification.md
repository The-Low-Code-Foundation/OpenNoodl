---
title: "Send Email Verification"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated: asks the backend to send a verification email to the given address. Superseded by cloud-function-based flows.

Send Email Verification sends the `email` (string value) to the backend when `send` (Do, signal) is triggered, causing a verification email to be sent; `success`/`failure` (signals) and `error` (string value) report the outcome. It is marked deprecated in the runtime — the source directs new work to cloud functions, where a component called via CloudFunction2 controls the verification email and token server-side.

## When to use it

Do not use in new graphs — implement email verification in a cloud function called via CloudFunction2 instead.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `net.noodl.user.SendEmailVerification` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `email` | String | — | Address to send the verification link to |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `send` | Signal | — | Asks the backend to email a verification link to Email |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `success` | Signal | — | Fires once the request has been accepted, which does not mean the address exists |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last request failed; empty until one does |
| `failure` | Signal | — | Fires when the request could not be made, after the reason has been reported on the error channel |


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
