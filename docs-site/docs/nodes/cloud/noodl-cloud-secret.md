---
title: "Secret"
---
Reads one of the project's stored credentials by name, inside a cloud function. Cloud-only — it does not exist in the browser.

Secret is the door to a stored credential from inside a cloud function. Set Name to the secret you want, pulse Do, and the value appears on Value with Done. The backend resolves the name against the `functions` section of its machine-local `secrets.json`, then falls back to a `NODEGX_SECRET_<NAME>` environment variable — the project author's own credentials, and nothing else: the backend's webhook, email, auth and admin credentials are not addressable from a graph at all. A name that resolves to nothing is a Failure with a message naming the secret and the two places to put it, never an empty string — a silently missing credential turns into somebody else's 401 an hour later. This node is registered only in the cloud runtime: a Secret node in a browser bundle would be a secret in a browser bundle.

## When to use it

Whenever a cloud function calls a third-party API, signs something, or otherwise needs a credential. Wire Value straight into the HTTP Request node's header or the HMAC / JWT Sign node's Key — do not copy the credential into a parameter, a Function node script or a Response.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.secret` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `name` | String | — | Which stored secret to read. A cloud function can only ever read the project's own secrets — the backend's webhook, email, auth and admin credentials are not addressable from here |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Reads the secret and puts it on Value |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | String | — | The secret, available once Done has fired. Blank until then, and blank after a Failure |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the secret has been read and is available on Value |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the secret could not be read — names the secret and where to put it, never a value |
| `failure` | Signal | — | Fires when the secret is not provisioned on this machine, or the Name is unusable. A missing credential is loud here rather than an empty string that becomes a 401 from somebody else an hour later |

## Patterns

- Request `receive` → Secret `fetch`; Secret `done` → HTTP Request `fetch`, with Value wired into the Authorization header: the ordinary shape of calling a paid API from the server.
- Wire `failure` somewhere that answers the caller. A function whose only wired path is the happy one hangs forever when the credential is missing (CWF-018).

## Watch out for

- Wiring Value into a Response node's parameter. That writes the credential into your own API's reply — the one leak this node cannot prevent for you.
- Reading a secret with a Function node and `process.env` instead. It works, but the name is then invisible to every tool that reads the graph.

## Related nodes

[Request](./noodl-cloud-request.md), [Response](./noodl-cloud-response.md), [HTTP Request](../data/net-noodl-http.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
