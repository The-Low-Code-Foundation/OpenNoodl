---
title: "Random Bytes"
---
A block of cryptographically random bytes as hex, base64 or base64url. Never falls back to Math.random().

Random Bytes fills Length bytes from the platform's cryptographic random source (crypto.getRandomValues) and renders them in Encoding. If there is no such source it fails loudly rather than substituting Math.random() — a silent downgrade there produces output that looks identical and is worthless. Length counts BYTES, not characters: 32 bytes is 64 hex characters or 43 base64url characters. A length outside 1-4096 is refused rather than clamped.

## When to use it

A nonce, a CSRF token, a PKCE verifier, an invite code, a one-time download key — anything that has to be unguessable. For an identifier that only has to be unique, the UUID node says so more clearly.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.RandomBytes` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `encoding` | Enum (`hex`, `base64`, `base64url`) | `hex` | How the bytes are rendered as text. Base64 URL is the safe one for a URL or a token |
| `length` | Number | `32` | How many random BYTES to generate (not characters — hex renders each byte as two). 1 to 4096 |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `generate` | Signal | — | Generates a fresh block of random bytes |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | String | — | The random bytes rendered in Encoding, replaced on every New |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once fresh random bytes are available on Value |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why no random bytes were produced |
| `failure` | Signal | — | Fires when there is no cryptographic random source here, or Length is out of range. This node will not quietly substitute Math.random() |

## Patterns

- New → Done → store or send. The value is replaced on every New, so read it from the Done path rather than later.

## Watch out for

- Treating Length as a character count. 16 bytes of hex is 32 characters.
- Using this where a UUID is what the other system expects — the shapes are not interchangeable.

## Related nodes

[UUID](./net-noodl-uuid.md), [Hash](./net-noodl-hash.md), [Unique Id](../string-manipulation/unique-id.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
