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

## Examples

**Turn an email address into a stable fingerprint**

The dictionary asks for `:formatted as MD5 hash` and `:formatted as SHA1 Hash`, and the honest answer is that this node offers neither — SHA-256, SHA-384 and SHA-512 only. That is a decision, not a gap: WebCrypto, which Hash runs on in both the browser and a cloud function, does not implement MD5 or SHA-1 for digesting, and hand-rolling one would mean shipping a hash that is broken for every purpose either was ever used for. If you are migrating a Bubble app that stored MD5 fingerprints, they will not reproduce here and no setting will make them; treat that as a re-hash of the source data, not a translation. Two details decide whether this works. Hash is ASYNCHRONOUS — the digest is computed off a later turn than the `Do` that started it — so Digest is wired to the Text and the button is wired to `Do`; reading Digest in the same pass as the click would read the previous answer. And hashing is exact, so the normalisation in front of it is doing real work: `Foo@Example.com ` and `foo@example.com` are different bytes and therefore entirely different digests, which is how a 'stable fingerprint' quietly stops matching. Trim and lower-case first, deliberately, and write down that you did. Failure fires only when WebCrypto is unavailable, which in a browser means the page is not on a secure origin — worth a Log, because the symptom is a blank fingerprint rather than an error. The digest is published as well as rendered: a fingerprint that only ever reaches a Text is a fingerprint nothing can be compared against.

## Related nodes

[HMAC](../cloud/noodl-cloud-hmac.md), [Random Bytes](./net-noodl-random-bytes.md), [UUID](./net-noodl-uuid.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
