---
title: "REST"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

REST node: a scripted request/response pair — request script shapes the call, response script maps the payload onto output ports.

The REST node wraps one HTTP endpoint in two small scripts. The request script assembles method, resource and body from the node's script-declared `Inputs`; the response script reads `Response.content`/`Response.status` and assigns `Outputs`, and those script-declared names are the node's ports. `fetch` runs the request, `success`/`failure` report the outcome, `cancel` aborts in flight.

## When to use it

Recurring API endpoints that deserve a typed port surface — the mapping lives in the node, the graph sees clean ports. For a quick GET with no mapping, HTTP Request is lighter; for secrets or server-side work, call a cloud function instead of embedding keys client-side.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `REST2` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `method` | Enum (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) | `GET` | — |
| `requestScript` | String | `//Add custom code to setup the request object before the request
//is made.
//
//*Request.resource     contains the resource path of the request.
//*Request.method       contains the method, GET, POST, PUT or DELETE.
//*Request.headers      is a map where you can add additional headers.
//*Request.parameters   is a map the parameters that will be appended
//                      to the url.
//*Request.content      contains the content of the request as a javascript
//                      object.
//
` | — |
| `resource` | String | `/` | — |
| `responseScript` | String | `// Add custom code to convert the response content to outputs
//
//*Response.status    The status code of the response
//*Response.content   The content of the response as a javascript
//                    object.
//*Response.request   The request object that resulted in the response.
//
//*Inputs and *Outputs contain the inputs and outputs of the node.
` | — |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `cancel` | Signal | — | — |
| `fetch` | Signal | — | — |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `canceled` | Signal | — | — |
| `success` | Signal | — | — |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | — |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Input and output ports are parsed from the request/response scripts in the node parameters (custom headers, query parameters and response mappings become ports).

## Ports at runtime

All data ports are runtime-discovered from the two scripts' Inputs./Outputs. references, exactly like a Function node — write the scripts first, then wire to the names they declare.

## Watch out for

- Embedding API secrets in the request script — anything client-side ships to the browser; put secrets behind a cloud function.

## Examples

**REST node feeding a repeater**

The REST node wraps a request/response pair in two scripts: the request script assembles the call from the node's script-declared inputs, and the response script maps the payload onto script-declared outputs — here an `items` array. Ports come from those scripts (that is its dynamism). `fetch` on mount loads the list; `success`/`failure` sequence what follows. For a one-off GET without mapping scripts, HTTP Request is the lighter tool.

## Related nodes

[HTTP Request](./net-noodl-http.md), [Function](../custom-code/java-script-function.md), [Cloud Function](../cloud-services/cloud-function2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
