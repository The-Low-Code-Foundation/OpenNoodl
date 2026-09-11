---
title: "Upload File"
---
Uploads a browser file to cloud storage when triggered, reporting progress and yielding a cloudfile handle.

Upload File takes a browser File (typically from Open File Picker) on its untyped `file` input and, when `upload` fires, stores it in the cloud backend's file storage. Progress streams out (`progressLoadedPercent`, byte counts, `progressChanged`), and on `done` the stored file is available as `cloudFile` — the handle to attach to a record's file property or unwrap with Cloud File. `failure` carries `error` and `errorStatus`.

## When to use it

Attachments, avatars, imports — any user-picked file that must persist server-side. The upload stores the file only; associating it with a record is a separate write (Create/Set Record).

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `Upload File` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `bucket` | String | — | Supabase Storage bucket to upload into. Supabase only; there is no default, and a bucket that does not exist fails with an error that does not say so |
| `collection` | String | — | PocketBase collection holding the record the file attaches to. PocketBase only |
| `field` | String | — | The file-typed field on that record. PocketBase only |
| `file` | * | — | The file to upload, as an Open File Picker node produces it |
| `path` | String | — | Object path inside the bucket, such as avatars/me.png. Supabase only. Leave blank to use the file's own name |
| `private` | Boolean | `false` | Restricts the stored file to whoever uploaded it, so reading it later needs a Sign File URL node |
| `recordId` | String | — | Existing record to attach the file to. PocketBase only. Leave blank to create a new record as part of the upload |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `upload` | Signal | — | Starts uploading File, and fails straight away when no file has been set |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `cloudFile` | Cloudfile | — | The stored file, for wiring into a record property or a Cloud File node |
| `progressLoadedBytes` | Number | — | How much of the file has been sent so far, in bytes |
| `progressLoadedPercent` | Number | — | How much of the file has been sent so far, from 0 to 100 |
| `progressTotalBytes` | Number | — | Size of the file being uploaded, in bytes |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the file is stored and Cloud File is up to date |
| `progressChanged` | Signal | — | Fires each time the byte counts below move during an upload |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last upload failed; empty until one does |
| `errorStatus` | Number | — | HTTP status the backend refused with, or 0 when the request never left the app |
| `failure` | Signal | — | Fires when the file could not be stored, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

A `backendId` (Backend) input is registered at runtime rather than declared, so it appears only once a project has more than one backend — the node then uploads through whichever backend the picker names instead of the project's `cloudservices` endpoint (BCN-007 step 6). A backend id naming nothing is an error, never a silent fallback. The static inputs are also **per backend, not universal**: `bucket` and `path` are Supabase Storage only, and `collection`/`recordId`/`field` are PocketBase only, because PocketBase stores a file as a field on a record rather than as an object of its own. Leave them unset on the built-in, Parse and Directus backends. BCN-010 gates the node on `files.upload`, so a backend that cannot accept an upload marks the node with the reason before it is triggered.

## Patterns

- Picker `done` → `upload`, upload `done` → record write: three nodes, each owning one step.
- `private: true` uploads pair with Sign File URL: wire the same `done` signal to both the record write and the signer.

## Watch out for

- Treating `cloudFile` as set before `done` fired — sequence record writes on the Done signal.
- Setting `private: true` and then binding `cloudFile.url` straight to an Image/link — a private file's plain url 403s for anyone but the uploader; sign it first.

## Examples

**Create a record with an uploaded file attachment**

The create-with-attachment flow: Open File Picker hands the picked browser file to Upload File, which stores it in cloud storage and outputs a `cloudFile`. Cloud File exposes that file's `url`, previewed in an Image (the cloudfile→image cast). When the upload succeeds, Create Record (NewDbModelProperties) writes a new 'Attachment' record whose properties — including the file — are set on the node's schema-generated inputs.

**Upload a private file and preview it with a signed URL**

Open File Picker hands the picked file to Upload File with its `private` input set, so the backend ACLs the upload to its uploader instead of leaving it public. A private file's plain URL is not directly usable in an `<img>` — it 403s for anyone else, including an unauthenticated preview — so on the picker's `done` the resulting `cloudFile` is wired into Sign File URL, whose `sign` signal is fired from the same `done`. Sign File URL mints a short-TTL signed URL (the row-ACL check that gates it is the same one the file's own GET route uses), and THAT url — not the cloudFile's own plain url — feeds the Image's `src`. Re-signing before every render (rather than persisting the signed URL) is the idiomatic use: a stored, expired signature just 403s later.

**Record audio in the browser and upload it as a cloud file**

The whole round trip in built-in nodes: **Record Media** captures from the microphone, **Upload File** stores the result, and a **Video** node plays it back. The wiring worth copying is the three-way split on the outcome — `Started` and `Stopped` drive a `States` node that owns the status text, `Recording` drives the Stop button's `enabled` so the two buttons can never both be live, and `Permission Denied` / `Device Busy` land on their own states because a refused prompt and a microphone another tab is holding need different words. ⚠️ `Blob URL` is a string and `Mounted` is a boolean, so the playback surface is gated through an `Expression` rather than wired straight across — a URL is not a truth value. The `File` output is a real `File`, which is exactly what `Upload File` expects, so nothing here converts the recording to text and back on the way.

**Show a camera preview and record the stream you are already showing**

Two nodes that look like they overlap and do not. **Web Camera** opens a stream and hands it to a **Video** node's `Source Object`, which is the live preview; **Record Media** takes that same stream on its `Media Stream` input and writes it to a file. Because the stream is passed rather than re-requested, the browser asks for permission once — a recorder that calls `getUserMedia` again would prompt a second time and open a second camera handle. The ownership rule falls out of the same wire: the recorder did not open this stream, so it never stops its tracks, and `Stop` ends the recording while the preview keeps running. Stopping the camera stays the job of the node that started it, which is why `Stop Stream` is wired from its own button.

## Related nodes

[Open File Picker](../utilities/open-file-picker.md), [Cloud File](./cloud-file.md), [Sign File URL](./sign-file-url.md), [Create Record](../data/new-db-model-properties.md), [Update Record](../data/set-db-model-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
