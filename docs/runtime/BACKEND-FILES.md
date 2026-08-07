# File storage for the local backend

The standalone NodeGX backend (`nodegx-backend`) tracks every uploaded file as
a real record (size, sniffed content type, hash, owner), enforces limits, can
serve on-the-fly thumbnails, supports private files behind BAK-003's access
model, and stores blobs on local disk by default or in an S3-compatible bucket
if you configure one. The full design record is
[`dev-docs/tasks/phase-22-production-backend/BAK-006-FILE-STORAGE-V2.md`](../../dev-docs/tasks/phase-22-production-backend/BAK-006-FILE-STORAGE-V2.md);
decisions and how they were verified are in
[`BAK-006-NOTES.md`](../../dev-docs/tasks/phase-22-production-backend/BAK-006-NOTES.md).

This grows WF-004's raw `/files` upload/serve/delete — the wire contract
(`POST /files/:name` → `{ url, name }`, `GET /files/:name`, `DELETE
/files/:name`) is unchanged, so every existing File-typed field and the
**Upload File** / **Cloud File** nodes keep working exactly as before.

## The one thing you must know: sniffed, not trusted

**The content type stored and served is sniffed from the actual bytes, never
taken from the client's declared `Content-Type` or the uploaded name's
extension.** A file named `photo.pdf` that is actually a PNG is served back as
`image/png`. This is deliberate: the declared type/name are attacker-
controlled, and validation (size limits, allow/deny lists) that trusted them
would be trivially bypassable.

## Limits and content-type policy

Configure in the editor: **Backend Services → (your local backend) → Files**,
or via MCP (`get_backend_file_config` / `configure_backend_files`).

| Setting | Default | Notes |
|---|---|---|
| Max upload size | 25 MB | Oversized uploads are rejected with `413` before the body is even fully read (declared `Content-Length` is checked first). |
| Content-type deny list | empty | Refuse specific sniffed types outright (e.g. `application/x-msdownload`). |
| Content-type allow list | none (allow all) | When set, ONLY these sniffed types may be uploaded. |
| Signed URL TTL | 300s | See "Private files" below. |

## Private files and signed URLs

A file is **public** by default (WF-004's original behavior — anyone who
knows the URL can read it). To upload a **private** file, send
`X-NodeGX-File-Private: true` as an authenticated user; the file's owner is
that user, and it is readable only by them (or an admin) — enforced through
BAK-003's row-level ACL, the same model every other collection uses, not a
second permission system. (This header is not currently wired into the
shipped **Upload File** node — see BAK-006-NOTES for why that is a deliberate
v1 scope cut. A cloud function or any authenticated `fetch` call can set it
today.)

Because a private file's `GET /files/:name` requires either an authenticated
principal with read access OR a valid signature, **`<img src>` cannot read a
private file directly** — an `<img>` tag cannot carry a session-token header.
Call `GET /files/:name/sign` (as a principal who can read the file) to mint a
short-TTL signed URL:

```
GET /files/:name/sign  ->  { url, expiresAt, ttlSeconds }
```

Use that `url` directly as the `<img src>`. **Sign right before you render** —
the URL expires (300s by default), so persisting a signed URL (e.g. in a
`CloudFile.url` saved to a record) is not the intended pattern; the plain
`/files/:name` URL is what gets persisted, and you sign a fresh one each time
you need to display it.

## Thumbnails

```
GET /files/:name?thumb=<preset>
```

Three presets ship by default — `sm` (64×64, cover), `md` (256×256, cover),
`lg` (1024×1024, contain) — configurable per backend. Arbitrary dimensions
(`?thumb=400x300`) are **admin-only**, to keep the endpoint from being a
resize-anything DoS vector for the public internet; named presets are public.
Results are cached on disk and served with a correct `ETag`/`Cache-Control`
(`public, max-age=31536000, immutable` for public files; `private, no-store`
for private ones) — a cache hit never touches the transform library.

### The sharp caveat — read this before you rely on thumbnails

Thumbnails are rendered with [`sharp`](https://sharp.pixelplumbing.com/), a
**native** image library. It ships as an *optional* dependency:

- **Uploads and original files always work**, with or without sharp.
- If sharp isn't installed (or its native binding fails to load for this
  platform), `?thumb=` requests return an explicit **501** with the reason —
  never a silent skip, and never a pure-JS fallback resizer producing
  different bytes than sharp would.
- `GET /admin/files/config` (and the panel/dashboard) report
  `transformsAvailable` honestly, so you find out from the config screen, not
  from a confusing 501 in production.

If you deploy with `npm install` in `packages/nodegx-backend` on a normal
Linux/macOS/Windows target, sharp's prebuilt binary installs automatically and
this just works. If it doesn't (an unusual platform, an offline install), the
backend keeps running — everything except `?thumb=` is unaffected.

## Storage drivers

| Driver | Config | Notes |
|---|---|---|
| `local` (default) | none | Blobs under `<dataDir>/files/blobs/`, hash-bucketed (`hh/hh/hash-random`). |
| `s3` | `endpoint`, `region`, `bucket`, `forcePathStyle`; credentials separately | Any S3-compatible service — AWS S3, MinIO, and others. Signed with a from-scratch SigV4 implementation (no AWS SDK) — see BAK-006-NOTES for why and how it's verified. |

Set the driver via `configure_backend_files` (MCP) or the panel; S3
credentials are set separately (`s3AccessKeyId`/`s3SecretAccessKey`) and are
never echoed back by any read surface — same convention as the SMTP password.
**Switching drivers does not migrate existing files** — that is a documented
manual procedure (copy the blobs, update the `driver`/`key` on each `_Files`
row), not a button, in v1.

## Orphan sweep

Two things can drift apart: a blob with no metadata row pointing at it (an
**orphan blob** — e.g. a crash between writing the blob and the metadata
insert), or a metadata row whose blob is missing (an **orphan row** — e.g. a
blob deleted outside the normal path). The orphan sweep finds both.

**Report-only by default.** A scheduled sweep (5-field cron, disabled by
default) or an on-demand run (`run_backend_file_sweep` via MCP, or the
panel's "Run now") reports what it finds. Passing `deleteOrphans: true`
deletes orphan **blobs** — orphan **rows** are never auto-deleted, because a
metadata row with a missing blob is a data-integrity signal worth a human
looking at, not something to quietly prune.

## Backups

File-storage backup/restore is BAK-007's concern, not this document's — the
storage layout above (everything under one `root` directory per driver) is
what makes "back this up" tractable for it.
