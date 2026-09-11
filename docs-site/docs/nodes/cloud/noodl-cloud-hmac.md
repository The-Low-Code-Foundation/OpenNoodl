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

## Examples

**Prove an inbound request really came from who it says**

Two different 'is this genuine' questions, side by side, because choosing the wrong one is the common mistake. HMAC is for a webhook: the sender computed a keyed digest of the body with a shared secret and put it in a header, and you recompute it and compare. The input that decides whether this works is Value — it must be the RAW body, byte for byte, exactly as it arrived. Re-serialising the parsed object first produces a different string (key order, whitespace, number formatting) and therefore a different signature, and the symptom is every webhook failing verification with no clue why. JWT Verify is for a token somebody else ISSUED to you, and it refuses any token whose header names an algorithm other than the one you selected — which is what defeats both `alg: none` and algorithm confusion, and is why Algorithm is set here rather than read from the token. Nothing inside a token may be believed before the signature check, so Claims is left alone on failure rather than handed over unchecked; reading claims off a token you have not verified is the same bug as trusting the webhook body. Clock Tolerance exists for issuers whose clock is not quite yours and defaults to 0. Both keys come from Secret nodes by name, so neither credential is in the graph. Note what neither node is for: your own users' sessions. That is Verify Session Token, which asks this backend about its own `_Session` rows.

## Related nodes

[Secret](./noodl-cloud-secret.md), [Hash](../utilities/net-noodl-hash.md), [JWT Sign](./noodl-cloud-jwtsign.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
