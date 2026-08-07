---
title: "HMAC"
---
Keyed SHA-2 signature of a string. Cloud-only, because it takes a shared secret.

HMAC signs the text on Value with the secret on Key and puts the result on Signature, rendered in the chosen encoding. It is the primitive behind webhook signature verification (compute the HMAC of the raw request body and compare it to the header the sender supplied) and behind signing an outbound API request. It is registered only in the cloud runtime, and that is the point: every real use holds a shared secret, and a browser node whose Key input can only be filled from a literal or a fetch is a secret in the page. It shares one implementation with JWT Sign and JWT Verify, so a token this backend mints and a signature this node checks cannot drift apart.

## When to use it

Verifying a Stripe, GitHub or supplier webhook; signing a request some API requires signed; minting a tamper-evident download token. Wire Key from a Secret node.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.hmac` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `algorithm` | Enum (`SHA-256`, `SHA-384`, `SHA-512`) | `SHA-256` | Which SHA-2 digest the HMAC is built on. HMAC-SHA256 is what almost every webhook uses |
| `encoding` | Enum (`hex`, `base64`, `base64url`) | `hex` | How the signature bytes are rendered as text. Match whatever the other side sends |
| `key` | String | — | The shared secret. Wire this from a Secret node — never type a credential into the graph |
| `value` | String | — | The message to sign, as UTF-8 bytes. For a webhook signature this is the raw request body |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `sign` | Signal | — | Computes the signature of Value under Key |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `signature` | String | — | The HMAC of Value, rendered in Encoding. Available once Done has fired |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the signature has been computed and is available on Signature |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why no signature was produced. It names the problem, never the key |
| `failure` | Signal | — | Fires when the signature could not be computed — most often no Key |

## Patterns

- Secret Done → HMAC Do, with Value wired from the Request node's raw body: the standard webhook-verification shape.

## Watch out for

- Re-serialising the request body before signing it. Any difference in key order or whitespace changes the signature.
- Typing the key into the graph. It ends up in the exported project; use a Secret node.

## Related nodes

[Secret](./noodl-cloud-secret.md), [Hash](../utilities/net-noodl-hash.md), [JWT Sign](./noodl-cloud-jwtsign.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
