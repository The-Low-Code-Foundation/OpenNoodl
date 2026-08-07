---
title: "JWT Verify"
---
Check a JWT somebody else issued: signature, algorithm, exp and nbf. Not how you authenticate your own users.

JWT Verify checks a token against the secret on Key and, only if it verifies, puts the payload on Claims. It refuses a token whose header names any algorithm other than the one you selected — which is what stops both `alg: none` and algorithm confusion — and it checks nbf and exp with an optional clock tolerance. Nothing in a token can be believed before the signature check, so Claims is left alone on any failure rather than handed over unchecked. IMPORTANT: this is for OTHER people's tokens — a partner's signed webhook, an OIDC id_token, a link your own backend minted with JWT Sign. Your own callers are already resolved: the Request node outputs Authenticated and User Id from the session token before the graph runs.

## When to use it

A partner hands you a signed token; an identity provider returns an id_token; you are checking back a link you minted with JWT Sign. Never for your own session tokens.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.jwtverify` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `algorithm` | Enum (`HS256`, `HS384`, `HS512`) | `HS256` | The algorithm the token MUST have been signed with. A token whose header says anything else is refused unread — that is what stops alg:none and algorithm confusion |
| `clockTolerance` | Number | `0` | Seconds of leeway on exp and nbf, for issuers whose clock is not quite yours |
| `key` | String | — | The shared secret the issuer signed with. Wire this from a Secret node |
| `token` | String | — | The JWT to check, without any "Bearer " prefix |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `verify` | Signal | — | Checks the token |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `claims` | Object | — | The token payload — set ONLY after the signature verified. Nothing in a token can be believed before that, so this is left alone on a failure rather than handed over unchecked |
| `valid` | Boolean | — | Whether the token verified. False whenever Failure fired, so either can be wired |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the token verified and Claims holds its payload |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the token did not verify |
| `failure` | Signal | — | Fires when the token did not verify, for any reason — expired, not yet valid, wrong key, wrong algorithm, tampered with, or malformed. Error says which |

## Patterns

- Request receive → Secret Do → JWT Verify Do, with Failure wired to a Response that answers 401.
- Wire both Done and Failure. A function that only wires the happy path hangs when the token is bad.

## Watch out for

- Using this to authenticate your own app's users. The Request node's Authenticated and User Id already did that.
- Reading Claims off the Failure path. It is deliberately not set there.

## Related nodes

[JWT Sign](./noodl-cloud-jwtsign.md), [Secret](./noodl-cloud-secret.md), [Request](./noodl-cloud-request.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
