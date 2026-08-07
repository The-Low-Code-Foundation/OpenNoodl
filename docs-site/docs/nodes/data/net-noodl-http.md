---
title: "HTTP Request"
---
HTTP Request: fetches a URL on demand, delivering the parsed response, status code and an outcome signal.

The straightforward HTTP client: set `url` (plus method/headers/body via its configuration), fire `fetch`, and read `response` (parsed body, untyped), `responseHeaders`, and `statusCode`. `done`/`failure` split the outcome, with `error` describing failures, and `completed` fires after either so a chain can carry on regardless. `cancel` aborts an in-flight request: the abandoned request reports `unchanged` beside `canceled`, because nothing arrived and nothing changed, and the `cancel` itself reports `done` when it had something to abandon and `unchanged` when it did not.

## When to use it

One-off or simple API calls where the response can be consumed directly or handed to a Function/Script for shaping. Prefer the REST node when an endpoint is reused enough to deserve declared ports; prefer a cloud function when credentials must stay off the client.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.HTTP` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `url` | String | `` | Address the request is sent to; any {name} in it becomes a Path Parameter input, and leaving it blank fails the request rather than sending one |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `cancel` | Signal | — | Abandons a request that is still in flight, which answers on Canceled rather than Failure; reports Unchanged when there is nothing to cancel |
| `fetch` | Signal | — | Sends the request using the values currently on the inputs |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `response` | * | — | Body the server sent, parsed as JSON when it said so and as text otherwise; it keeps the previous body when a request never reached the server |
| `responseHeaders` | Object | — | Every header the server returned, keyed by lower-cased header name |
| `statusCode` | Number | — | HTTP status the server answered with; it keeps the previous status when a request timed out or never reached the server |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `canceled` | Signal | — | Fires only when Cancel abandoned a request in flight; a timeout answers on Failure instead |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the server has answered with a 2xx status and Response is up to date |
| `unchanged` | Signal | — | Fires when nothing was fetched and nothing changed: a Cancel that abandoned a request in flight, or a Cancel with no request to abandon. Canceled tells those two apart |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | What went wrong with the last request, in one sentence; unchanged when a request succeeds |
| `failure` | Signal | — | Fires when the request could not be completed — no URL, a network error, a timeout, an unparseable body, or a non-2xx status — after the reason has been put on Error |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Input and output ports derive from node parameters: configured headers and query parameters become inputs; response mappings become outputs.

## Ports at runtime

Header and body inputs are runtime-registered from the node's method/headers configuration; only the core trigger/result surface is static. Dynamic outputs minted from Response Mapping are all prefixed `out-`, so an author's mapping name can never collide with the node's own ports. NDA-012: exceeding `timeout` fires `failure` with a message naming the timeout — `canceled` fires only for an explicit `cancel`. ERG-001: failures now also reach the runtime error channel, so `On App Error` sees them in a deployed build — codes are `http/no-url`, `http/error-status`, `http/timeout` and `http/network-error`. Requests genuinely overlap: a second `fetch` while one is in flight starts a second request, and each invocation carries its own outcome. `statusCode` and `response` keep the *previous* request's answer when a request never reached the server, because a value output cannot be cleared. Deleting the node does not abandon a request already in flight.

## Patterns

- `failure` → Condition `eval` with `result` → error text `visible`: errors as levels, not pulses.

## Examples

**HTTP Request with scripted post-processing and error display**

HTTP Request (net.noodl.HTTP) fetches the `url` when `fetch` fires and delivers `response` (parsed body), `statusCode`, and either `done` or `failure` with `error` — plus `completed` after either, to carry on regardless. The response is post-processed by a Script node (Javascript2), whose input/output ports are declared by its own code — here it reads `Inputs.response` and produces a `headline` output. Errors surface as a level: `failure` evaluates a Condition whose `result` shows the error text.

## Related nodes

[REST](./rest2.md), [Script](../custom-code/javascript2.md), [Function](../custom-code/java-script-function.md), [Cloud Function](../cloud-services/cloud-function2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
