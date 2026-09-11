---
title: "JWT Sign"
---
Mint a signed JSON Web Token (HS256/384/512). Cloud-only — signing in a browser means the key is in the browser.

JWT Sign serialises the Claims object into a JWT signed with the secret on Key. It always stamps `iat`; it stamps `exp` only when Expires In is set, so a token with no expiry is something you chose rather than something that happened. A JWT is signed, not encrypted: everything in Claims is readable by whoever holds the token. RS256 is not offered in this pass — it needs a PEM key import, still with no dependency, and is a slice of its own.

## When to use it

Issuing a short-lived token your own system will check later — a download link, a callback nonce, a hand-off to a partner who has your shared secret. To authenticate your own users, do not mint tokens here: the Request node already resolves the caller from their session.

## At a glance

| | |
|---|---|
| Category | Cloud |
| Type name | `noodl.cloud.jwtsign` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `algorithm` | Enum (`HS256`, `HS384`, `HS512`) | `HS256` | Which HMAC signs the token. RS256 is not offered yet — it needs a key-import pass of its own |
| `claims` | Object | — | The payload object. `iat` is always added; `exp` is added when Expires In is set. Anything you put here is readable by whoever holds the token — a JWT is signed, not encrypted |
| `expiresIn` | Number | — | Seconds until the token expires, stamped as `exp`. Leave empty for a token with no expiry — which is a decision, not a default |
| `key` | String | — | The signing secret. Wire this from a Secret node — never type a credential into the graph |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `sign` | Signal | — | Signs the claims and puts the token on Token |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `token` | String | — | The signed JWT, available once Done has fired |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the token has been signed and is available on Token |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why no token was produced. It names the problem, never the key |
| `failure` | Signal | — | Fires when the token could not be signed — no Key, or claims that will not serialise |

## Patterns

- Secret Done → JWT Sign Do, then Token into a URL or a response: the whole shape of a signed link.

## Watch out for

- Putting a secret in Claims. The payload is base64, not encryption — anyone with the token can read it.
- Leaving Expires In empty for a token that reaches a user's browser. A token with no expiry is valid until the key changes.

## Examples

**Mint a signed token for another service to check**

The key never appears in the graph — only the NAME of the secret does, which is what makes this function safe to commit and safe to export. Secret resolves that name against the backend's machine-local `secrets.json` and then against a `NODEGX_SECRET_<NAME>` environment variable, and it reaches the project author's own credentials only: the backend's own webhook, email, auth and admin credentials are not addressable from a graph at all. Signing is cloud-only for the obvious reason — a browser node with a key input would be a browser holding the key. Two things about the token itself. A JWT is SIGNED, NOT ENCRYPTED: everything in Claims is readable by anyone who holds the token, so it carries identifiers and never secrets, and 'nobody will look' is not a security property. And `exp` is stamped only when Expires In is set — `iat` is always stamped, `exp` is not — so a token with no expiry is something you chose rather than something that happened to you. Ten minutes is set here because this token exists to be handed to one other service for one call. The chain is Do-driven throughout: Secret publishes Value on `done`, and only then is there a key to sign with, so the signature is wired to fire from that signal rather than from the request. Failure is a single Response, because a function that cannot read its secret and a function that cannot sign look identical from the caller's side and neither should return a token-shaped blank.

## Related nodes

[JWT Verify](./noodl-cloud-jwtverify.md), [Secret](./noodl-cloud-secret.md), [HMAC](./noodl-cloud-hmac.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
