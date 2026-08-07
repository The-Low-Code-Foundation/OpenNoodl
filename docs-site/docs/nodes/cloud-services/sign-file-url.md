---
title: "Sign File URL"
---
Mints a short-lived signed URL for a cloud file, for previewing or downloading files uploaded as private.

Sign File URL takes a `cloudfile` handle (from Upload File or a record's file property) and, when `sign` fires, asks the backend for a time-limited signed URL to it. A private file's plain `url` 403s for anyone but its owner; the signed URL works for the short window it is valid, which is the intended usage — sign right before rendering, not once and persist. On `done` the signed `url`, its `expiresAt`, and `ttlSeconds` are available; `failure` carries `error`/`errorStatus` the same shape Upload File uses.

## When to use it

Previewing or linking to a file that was uploaded with Upload File's `private` input set. Not needed for public (non-private) files — their plain `cloudFile.url` already works for anyone who can reach the app.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `Sign File URL` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `file` | Cloudfile | — | Stored file to mint a link for, as an Upload File node or a record property produces it; any other value leaves the previous file in place |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `sign` | Signal | — | Mints a fresh link for File, refused for a caller who could not read the file directly |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `expiresAt` | String | — | Moment the link stops working, as an ISO 8601 timestamp. Empty for a "public" link, which never expires; for a "token" link on Directus this is the session's expiry rather than the link's |
| `isShareable` | Boolean | — | False when the link only works because it carries your own credential — sending it to someone else either fails for them or hands them your session. True for a signed or public link |
| `ttlSeconds` | Number | — | How long Signed URL stays valid from the moment it was minted, in seconds |
| `url` | String | — | Usable link to the file; empty until Sign has succeeded once. Read URL Kind before sharing it — on some backends this link carries your own credential rather than a signature |
| `urlKind` | String | — | How this link is protected: "signed" — it carries its own proof and stops working at Expires At; "token" — it carries your own sign-in credential; "public" — it needs nothing and never expires |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a link has been minted and Signed URL is up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last signing attempt failed; empty until one does |
| `errorStatus` | Number | — | HTTP status the backend refused with, or 0 when the request never left the app |
| `failure` | Signal | — | Fires when no link could be minted — no file was set, or the backend refused the caller access — after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

A `backendId` (Backend) input is registered at runtime rather than declared, so it appears only once a project has more than one backend. Before BCN-007 step 6 this node always used `CloudStore.instance` — the singleton bound to the legacy `cloudservices` endpoint — so it could not sign a file on any backend the Record nodes could reach. A backend id naming nothing is an error, never a fallback. BCN-010 gates the node on `files.sign`; where signing is `degraded` rather than absent the node still works and the caveat says what the link actually is — on Directus it carries your own sign-in rather than a signature, which is also what the `URL Kind` and `Safe To Share` outputs report at runtime.

## Patterns

- Fire `sign` from the same signal that produced the `cloudFile` (e.g. Upload File's `done`), so the graph never holds a `cloudFile` without also having signed it.

## Watch out for

- Persisting a signed `url` (e.g. saving it to a record) instead of the plain cloudfile — the signature expires and the stored link stops working; store the cloudfile, sign again at render time.

## Examples

**Upload a private file and preview it with a signed URL**

Open File Picker hands the picked file to Upload File with its `private` input set, so the backend ACLs the upload to its uploader instead of leaving it public. A private file's plain URL is not directly usable in an `<img>` — it 403s for anyone else, including an unauthenticated preview — so on the picker's `done` the resulting `cloudFile` is wired into Sign File URL, whose `sign` signal is fired from the same `done`. Sign File URL mints a short-TTL signed URL (the row-ACL check that gates it is the same one the file's own GET route uses), and THAT url — not the cloudFile's own plain url — feeds the Image's `src`. Re-signing before every render (rather than persisting the signed URL) is the idiomatic use: a stored, expired signature just 403s later.

## Related nodes

[Upload File](./upload-file.md), [Cloud File](./cloud-file.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
