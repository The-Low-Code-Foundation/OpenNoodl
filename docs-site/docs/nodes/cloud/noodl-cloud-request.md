---
title: "Request"
---
Entry point of a cloud function component: receives the call's parameters and fires Received to start the server-side flow.

Request is the entry node of a cloud function — it only exists in the cloud runtime, and a component containing one becomes callable from the browser through a Cloud Function (CloudFunction2) node. Declare the function's parameters as a name list in `params`; each name becomes an output carrying the value the caller sent, and a matching `in-<name>` input appears on the browser-side caller. When a call arrives the node checks authentication (rejecting unauthenticated calls unless `allowNoAuth` is true), publishes each parameter, then fires `receive` (Received, signal) — wire that signal into your logic and end the flow at a Response node. The caller's identity, parameters and headers are also placed on a 'Request' model readable elsewhere in the function.

## When to use it

Place exactly one at the start of every cloud function component. It is meaningless in browser components — there, use Component Inputs for inputs and CloudFunction2 to call the function.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.request` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `allowNoAuth` | Boolean | `false` | Whether a request with no valid session token is allowed to run this function at all |
| `params` | Stringlist | — | Names to pull out of the request body, each becoming an output — and a Type, Required and Default row to declare what it is |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `auth` | Boolean | — | Whether the request carried a session token that resolved to a user |
| `origin` | String | — | The address the calling app is served from — its Origin header, or this backend’s own host when the caller sent none. Blank when neither is known (a workflow step has no caller). Caller-supplied like every header: right for links sent back to whoever called, not a proof of where the request came from. |
| `userId` | Boolean | — | Id of the user the session token resolved to, and blank for an unauthenticated request |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `receive` | Signal | — | Fires when a request arrives, after every parameter output has been updated |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Output ports mirror the parameters declared for the cloud function (one output per request parameter).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| — | — | — |
| — | — | — |
| — | — | — |
| — | — | — |

## Ports at runtime

Each name in the `params` stringlist becomes a runtime-registered output (stored as `pm-<name>`) holding that parameter's value from the current call. The same list is what CloudFunctionAdapter mirrors onto browser-side CloudFunction2 callers as `in-<name>` inputs, so editing `params` changes both sides. CWF-014: a name may also carry `ptype-<name>` (one of *, string, number, boolean, object, array, date), `preq-<name>` and `pdef-<name>`. When any of those is set the node checks the request body BEFORE the graph runs — a missing required field, or a value the declared type cannot take, is answered as HTTP 400 naming the field, and the graph does not run at all. A value the declared type can take losslessly is coerced first, so "42" reaches a number-typed output as the number 42, and an omitted parameter with a Default arrives holding it. A declared type also becomes the `pm-<name>` output's port type, so the wire out of it is checked like any other.

## Patterns

- `receive` → your logic → Response `send`: every cloud function is this shape; the reply is not sent until a Response node sends it.
- `userId` → a query filter parameter: trust the session-derived id, never an id passed in `params`, for per-user data.

## Watch out for

- Leaving `allowNoAuth` false and then calling the function from a logged-out browser session — the call is rejected before `receive` ever fires.
- Ticking Required on a parameter and giving it a Default too: the default wins and the request is never refused, which is almost certainly not what the tick meant.
- Checking the request body inside the graph with Condition nodes and answering through a Response node with Status = Failure: that is a graph that ran. Declare the type on the parameter instead, and the request never starts.

## Examples

**Cloud function round trip: browser call → request → response**

A cloud function is a component that runs server-side: Request is its entry (its `params` become outputs carrying the caller's inputs; `receive` fires per invocation) and Response is its exit (its `params` become inputs; `send` returns them). In the browser, Call Cloud Function (CloudFunction2) names the function; the function's request params appear as inputs and its response params as outputs. Here two numbers are summed server-side: the browser sends a and b, the function computes with an Expression, and `sum` comes back on `success`.

**Server-side aggregation exposed as a cloud function**

Aggregate Records runs count/sum/min/max/average over a database class without transferring the records — it exists only in the cloud runtime, so the idiomatic shape is a small cloud function around it: Request triggers the aggregate's fetch, `fetched` sends the Response, and the aggregate results (outputs generated from the `aggregates` configuration) are returned as response params. The browser calls it like any cloud function and renders the statistic.

## Related nodes

[Response](./noodl-cloud-response.md), [Cloud Function](../cloud-services/cloud-function2.md), [Aggregate Records](../cloud-services/noodl-cloud-aggregate.md), [User](../cloud-services/net-noodl-user-user.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
