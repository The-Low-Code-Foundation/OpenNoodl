---
title: "Send Email"
---
Sends an email through the backend's configured SMTP server from inside a cloud function or workflow.

Send Email is a server-side-only action node (it only runs inside a cloud function, never in a browser component). Wire `send` to fire it: it either renders one of the backend's built-in templates (Password Reset, Verify Email) against the `variables` object, or sends the raw `subject`/`text`/`html` inputs directly. The send is synchronous from the graph's point of view — `done` or `failure` fires once the attempt (plus one automatic retry on transient failure) has finished. If the backend has no SMTP configured, or this component is somehow evaluated outside a nodegx-backend process, it fails loudly on `failure`/`error` — it never drops a send silently or queues it for later.

## When to use it

Use it wherever a workflow needs to notify someone by email — a signup confirmation, an order receipt, an internal alert. Do not use it for the account password-reset/verify-email flows the backend already runs (BAK-002) — those are automatic; wire this node only for YOUR OWN application notifications.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.sendemail` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `html` | String | — | HTML body sent alongside Text Body; optional, and ignored when Template is set |
| `subject` | String | — | Subject line of the message, and ignored when Template is set |
| `template` | Enum (`none`, `passwordReset`, `verifyEmail`) | `none` | Which stored template to render, or None to use Subject, Text Body and HTML Body instead |
| `text` | String | — | Plain-text body of the message, and ignored when Template is set |
| `to` | String | — | Address the message goes to; the send fails outright when this is blank |
| `variables` | Object | — | Values substituted into the template placeholders, and ignored when Template is None |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `send` | Signal | — | Sends the message |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the mail server has accepted the message for delivery |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the message could not be sent |
| `failure` | Signal | — | Fires when the message could not be sent, including when no mail service is configured |

## Patterns

- Request `receive` → Send Email `send` → Response `send`: a fire-and-notify cloud function, the same shape as the Request/Response round trip but with a side effect instead of (or in addition to) a computed value.

## Watch out for

- Wiring this into a browser component — it has no effect there (no `_noodl_send_email` exists outside nodegx-backend) and the failure is confusing without knowing this node is cloud-only.
- Assuming a fired `sent` means the recipient's inbox will show it soon — deliverability (SPF/DKIM/provider reputation) is the operator's SMTP provider's job, not this node's.

## Examples

**Cloud function that sends an email notification**

A cloud function that receives a recipient/subject/message from its caller and emails it through the backend's configured SMTP server. Request's `params` become this function's inputs; Send Email fires on `receive` and reports success/failure back to Response, which the caller reads as usual. This is the general-purpose shape for any application email (signup confirmations, receipts, alerts) — distinct from the backend's own automatic password-reset/verify-email flows (BAK-002), which never need a Send Email node.

## Related nodes

[Request](./noodl-cloud-request.md), [Response](./noodl-cloud-response.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
