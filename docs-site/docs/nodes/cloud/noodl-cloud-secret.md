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

## Examples

**Mint a signed token for another service to check**

The key never appears in the graph — only the NAME of the secret does, which is what makes this function safe to commit and safe to export. Secret resolves that name against the backend's machine-local `secrets.json` and then against a `NODEGX_SECRET_<NAME>` environment variable, and it reaches the project author's own credentials only: the backend's own webhook, email, auth and admin credentials are not addressable from a graph at all. Signing is cloud-only for the obvious reason — a browser node with a key input would be a browser holding the key. Two things about the token itself. A JWT is SIGNED, NOT ENCRYPTED: everything in Claims is readable by anyone who holds the token, so it carries identifiers and never secrets, and 'nobody will look' is not a security property. And `exp` is stamped only when Expires In is set — `iat` is always stamped, `exp` is not — so a token with no expiry is something you chose rather than something that happened to you. Ten minutes is set here because this token exists to be handed to one other service for one call. The chain is Do-driven throughout: Secret publishes Value on `done`, and only then is there a key to sign with, so the signature is wired to fire from that signal rather than from the request. Failure is a single Response, because a function that cannot read its secret and a function that cannot sign look identical from the caller's side and neither should return a token-shaped blank.

**Prove an inbound request really came from who it says**

Two different 'is this genuine' questions, side by side, because choosing the wrong one is the common mistake. HMAC is for a webhook: the sender computed a keyed digest of the body with a shared secret and put it in a header, and you recompute it and compare. The input that decides whether this works is Value — it must be the RAW body, byte for byte, exactly as it arrived. Re-serialising the parsed object first produces a different string (key order, whitespace, number formatting) and therefore a different signature, and the symptom is every webhook failing verification with no clue why. JWT Verify is for a token somebody else ISSUED to you, and it refuses any token whose header names an algorithm other than the one you selected — which is what defeats both `alg: none` and algorithm confusion, and is why Algorithm is set here rather than read from the token. Nothing inside a token may be believed before the signature check, so Claims is left alone on failure rather than handed over unchecked; reading claims off a token you have not verified is the same bug as trusting the webhook body. Clock Tolerance exists for issuers whose clock is not quite yours and defaults to 0. Both keys come from Secret nodes by name, so neither credential is in the graph. Note what neither node is for: your own users' sessions. That is Verify Session Token, which asks this backend about its own `_Session` rows.

## Related nodes

[Request](./noodl-cloud-request.md), [Response](./noodl-cloud-response.md), [HTTP Request](../data/net-noodl-http.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
