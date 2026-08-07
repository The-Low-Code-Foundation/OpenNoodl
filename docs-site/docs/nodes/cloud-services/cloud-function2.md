---
title: "Cloud Function"
---
Calls a cloud function component from the browser: send parameters, run the server-side graph, receive its results.

Cloud Function is the browser-side caller of a cloud function — a component that lives on the cloud runtime and starts with a Request node and ends with a Response node. Pick the target in the `function` input; the node then grows one `in-<name>` input per parameter declared on the function's Request node and one `out-<name>` output per value declared on its Response nodes. Triggering `call` (Call, signal) POSTs the current `in-` values to the server, where the function's graph runs; when the Response sends a success reply the `out-` outputs update and `done` (signal) fires. On a failure reply — or any transport error — `error` (string value) is set and `failure` (signal) fires. The logged-in user's session token is sent along automatically, so the function sees the caller's identity.

## When to use it

Use it whenever browser logic needs work done with server-side trust: secrets, security-sensitive writes, aggregations, or multi-record transactions. For plain reads of database classes prefer DbCollection2 (Query Records) directly. Do not use the deprecated v1 'Cloud Function' node in new graphs.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `CloudFunction2` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `call` | Signal | — | Runs the selected cloud function with the current input values |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the function has returned and its result outputs are up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last call failed; empty until one does |
| `failure` | Signal | — | Fires when the function could not be reached or answered with an error, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered, editor-adapter); the tables above may be incomplete for a given instance._

Input/output ports mirror the request/response ports of the targeted cloud function component (CloudFunctionAdapter).

## Ports at runtime

Ports are mirrored from the targeted cloud function component by the editor's CloudFunctionAdapter. The `function` input (edit-only) lists every component that contains a `noodl.cloud.request` node — cloud function components live under the `/#__cloud__/` sheet, and the parameter stores the component name without that prefix. Each name in the Request node's `params` list becomes an `in-<name>` input; each name in the Response nodes' `params` lists becomes an `out-<name>` output. All are type '*'; an authoring tool must read the target component's Request/Response `params` to know which ports exist.

## Patterns

- Button `onClick` → `call`, `out-<name>` → visual inputs: the request/response cycle for an action the client must not perform itself.
- `done` → a Query Records fetch action: refresh client data after a server-side write.

## Watch out for

- Wiring `out-` outputs somewhere without also handling `failure` leaves errors invisible — surface `error` in the UI or react to `failure`.

## Examples

**Cloud function round trip: browser call → request → response**

A cloud function is a component that runs server-side: Request is its entry (its `params` become outputs carrying the caller's inputs; `receive` fires per invocation) and Response is its exit (its `params` become inputs; `send` returns them). In the browser, Call Cloud Function (CloudFunction2) names the function; the function's request params appear as inputs and its response params as outputs. Here two numbers are summed server-side: the browser sends a and b, the function computes with an Expression, and `sum` comes back on `success`.

**Server-side aggregation exposed as a cloud function**

Aggregate Records runs count/sum/min/max/average over a database class without transferring the records — it exists only in the cloud runtime, so the idiomatic shape is a small cloud function around it: Request triggers the aggregate's fetch, `fetched` sends the Response, and the aggregate results (outputs generated from the `aggregates` configuration) are returned as response params. The browser calls it like any cloud function and renders the statistic.

## Related nodes

[Request](../cloud/noodl-cloud-request.md), [Response](../cloud/noodl-cloud-response.md), [Aggregate Records](./noodl-cloud-aggregate.md), [Query Records](./db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
