---
title: "Response"
---
Exit point of a cloud function component: collects result values and sends the reply back to the caller.

Response ends a cloud function — it only exists in the cloud runtime. Declare the function's result values as a name list in `params`; each name becomes an input to feed, and a matching `out-<name>` output appears on the browser-side Cloud Function (CloudFunction2) caller. Triggering `send` (Send, signal) replies to the pending call: with `status` 'success' (the default) it returns HTTP 200 with the collected result values, with `status` 'failure' it returns HTTP 400 carrying `errorMessage`, which the caller surfaces on its `error` output before firing `failure`. A function can contain several Response nodes — for example one success and one failure path — but exactly one should send per call.

## When to use it

End every path through a cloud function with one. Without a `send`, the caller's request never completes. In browser components use Component Outputs instead.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.response` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `params` | Stringlist | — | Names to return in the response body, each becoming an input to supply it |
| `status` | Enum (`success`, `failure`) | `success` | Whether the caller gets a 200 carrying Parameters or a 400 carrying Error Message |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `send` | Signal | — | Sends the response and ends the request, which can only happen once |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `errorMessage` | String | — | Message returned to the caller; used only when Status is Failure |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires as the response goes out, and before the request scope is torn down |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the response could not be sent |
| `failure` | Signal | — | Fires when the response could not be sent, because there is no request in scope or one was already answered |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Input ports mirror the result values declared for the cloud function (one input per response value).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| status = success OR status NOT SET | `params` | — |
| status = failure | `errorMessage` | — |
| status = success OR status NOT SET | — | — |

## Ports at runtime

Each name in the `params` stringlist becomes a runtime-registered input (stored as `pm-<name>`, type '*') collected into the success reply. Declared port groups make the ports conditional on `status`: `params` (and its `pm-` inputs) exist while status is 'success' or unset, `errorMessage` exists while status is 'failure'. CloudFunctionAdapter mirrors the union of all Response nodes' `params` onto the browser-side caller as `out-<name>` outputs.

## Patterns

- Two Response nodes — one with status 'success', one with status 'failure' and an `errorMessage` — triggered from the two branches of a Condition: explicit success/failure replies.
- Feed `pm-` inputs as values as your logic computes them; only `send` decides when the reply goes out.

## Watch out for

- Finishing a function path without triggering any Response `send` — the browser-side caller hangs until the request times out.

## Examples

**Cloud function round trip: browser call → request → response**

A cloud function is a component that runs server-side: Request is its entry (its `params` become outputs carrying the caller's inputs; `receive` fires per invocation) and Response is its exit (its `params` become inputs; `send` returns them). In the browser, Call Cloud Function (CloudFunction2) names the function; the function's request params appear as inputs and its response params as outputs. Here two numbers are summed server-side: the browser sends a and b, the function computes with an Expression, and `sum` comes back on `success`.

**Server-side aggregation exposed as a cloud function**

Aggregate Records runs count/sum/min/max/average over a database class without transferring the records — it exists only in the cloud runtime, so the idiomatic shape is a small cloud function around it: Request triggers the aggregate's fetch, `fetched` sends the Response, and the aggregate results (outputs generated from the `aggregates` configuration) are returned as response params. The browser calls it like any cloud function and renders the statistic.

## Related nodes

[Request](./noodl-cloud-request.md), [Cloud Function](../cloud-services/cloud-function2.md), [Condition](../logic/condition.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
