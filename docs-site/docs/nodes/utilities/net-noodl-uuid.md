---
title: "UUID"
---
A random version-4 UUID from the platform's cryptographic random source. Not the same thing as Unique Id.

UUID emits a standard RFC 4122 version-4 identifier — 36 characters, 122 random bits — generated once when the node is created and again on every New. It uses crypto.randomUUID where that exists and builds the same layout from crypto.getRandomValues where it does not (a browser on a non-secure origin), so it is never weaker, only differently reached. It is deliberately a second node beside Unique Id rather than a replacement: Unique Id is 10 characters from Math.random(), which is right for keying a rendered list and wrong for a record id, an idempotency key or anything an attacker might try to guess.

## When to use it

A record id, an idempotency key, a correlation id across services, a filename that must not collide. Anywhere the id leaves this page or has to be unguessable.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.UUID` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `generate` | Signal | — | Generates a fresh UUID, replacing the one on Id |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `uuid` | String | — | A random version-4 UUID, generated once when the node is created and again on every New. Use this rather than Unique Id wherever the id has to be globally unique or unguessable |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a new UUID is available on Id |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why no UUID could be generated |
| `failure` | Signal | — | Fires when there is no cryptographic random source here, leaving Id as it was |

## Patterns

- Create Record with Id wired from this node: an id minted client-side lets the same request be retried safely.

## Watch out for

- Using Unique Id where this node is meant. Ten characters of Math.random() is not an identifier to key a database on.

## Related nodes

[Unique Id](../string-manipulation/unique-id.md), [Random Bytes](./net-noodl-random-bytes.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
