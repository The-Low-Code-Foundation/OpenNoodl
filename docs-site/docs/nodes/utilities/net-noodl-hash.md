---
title: "Hash"
---
SHA-256/384/512 digest of a string, rendered as hex, base64 or base64url. Works in the browser and in a cloud function.

Hash takes the text on Value, hashes it with the chosen SHA-2 algorithm and puts the digest on Digest. It runs on WebCrypto, which both runtimes already have — there is no dependency behind it. The digest is computed asynchronously, so Done fires from a later turn than the Do that started it: wire Done, never assume Digest is fresh in the same frame. MD5 and SHA-1 are deliberately not offered; WebCrypto implements neither for digesting, and hand-rolling one would be shipping a broken hash. If you need a keyed digest, that is the HMAC node, which is cloud-only because it takes a secret.

## When to use it

Content addressing, a cache key, an integrity check, or comparing a value against a digest somebody else published. Not for storing passwords — a plain SHA-2 is the wrong tool for that, whichever runtime you are in.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.Hash` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `algorithm` | Enum (`SHA-256`, `SHA-384`, `SHA-512`) | `SHA-256` | Which SHA-2 digest to compute. MD5 and SHA-1 are not offered — WebCrypto has neither |
| `encoding` | Enum (`hex`, `base64`, `base64url`) | `hex` | How the digest bytes are rendered as text |
| `value` | String | — | The text to hash, as UTF-8 bytes |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `hash` | Signal | — | Computes the digest of Value |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `digest` | String | — | The hash of Value, rendered in Encoding. Available once Done has fired |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the digest has been computed and is available on Digest |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the digest could not be computed |
| `failure` | Signal | — | Fires when the digest could not be computed, most often because WebCrypto is not available here |

## Patterns

- Do → Done → the node that consumes Digest. The digest is asynchronous, so a wire off Done is the only way to sequence it correctly.

## Watch out for

- Reading Digest immediately after pulsing Do, in the same frame. It is still the previous value.
- Hashing a password with this node. Use your backend's password flow; a bare SHA-2 is not a password hash.

## Related nodes

[HMAC](../cloud/noodl-cloud-hmac.md), [Random Bytes](./net-noodl-random-bytes.md), [UUID](./net-noodl-uuid.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
