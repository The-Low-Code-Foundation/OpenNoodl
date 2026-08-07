# BCN-007: Files Across Five Backends

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-007 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 2 — the adapters |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟡 Medium — five file APIs that are more alike than they look |
| **Estimated Time** | ~1 week |
| **Prerequisites** | BCN-004 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

`uploadFile`, `signFileUrl` and `deleteFile` work across all five backends, and the `Upload File`,
`Cloud File` and `Sign File URL` nodes stop being Parse-only.

## Background

The scoping conversation assumed files were the wildcard — *"Files I dunno because none of the backends
we offer should do native file storage, the file storage should be a bucket linked to the database in
all cases."*

**The assumption is wrong, in our favour.** All five have a file API, and all five can be backed by a
bucket:

| Backend | File API | Bucket-backed |
|---|---|---|
| NodeGX | [`src/storage/`](../../../packages/nodegx-backend/src/storage/) — `FileSubsystem`, `LocalDriver`, `S3Driver`, signing, sigv4, transform, sniff | ✅ BAK-006 |
| Parse | `/files` | S3 file adapter |
| Directus | `/files` | storage adapter |
| Supabase | Storage API `/storage/v1/object/:bucket` | it *is* S3 |
| PocketBase | file fields + `/api/files/:collection/:id/:filename` | S3 option |

So files stay in the contract and are one of the **cheaper** items, not a wildcard. Richard's underlying
point survives intact — the storage should be a bucket — but that is a deployment choice the user makes
in their backend, not a reason to drop the capability.

The genuine differences are two. First, **PocketBase attaches files to a record field** rather than
storing them independently, so "upload a file and get a URL" is a create-or-update on a record. Second,
**URL signing differs**: ours signs (BAK-006's hand-rolled SigV4, verified against AWS's own fixtures),
Supabase signs, Directus serves via access token, PocketBase issues short-lived file tokens.

## Current State

| Piece | State |
|---|---|
| Contract methods | `uploadFile` (438), `signFileUrl` (461), `deleteFile` (478) in `cloudstore.js` |
| Nodes | `Upload File`, `Cloud File`, `Sign File URL` — all Cloud Services category, Parse-wire only |
| NodeGX storage | full subsystem, S3 + local drivers, thumbnails via optional sharp, orphan sweep |
| REST backends | no file support at all through NodeGX today |
| Tests | `cloudstore-files.test.ts` |

## Desired State

1. **The three contract methods are implemented per backend**, with a normalised file reference — id,
   URL, filename, content type, size — whatever the wire returns.
2. **PocketBase's record-attached model is expressed honestly.** Either the capability is `degraded`
   with "files attach to a record on PocketBase", or `uploadFile` takes an optional record target that
   the other backends ignore. Prefer the latter if it does not distort the contract; prefer the former
   over a lie.
3. **Signed URLs where supported, access-token URLs where not**, and the difference is visible: a URL
   that expires and a URL that requires a header are different things for an app author to hold.
4. **Deletion semantics are declared.** Ours has an orphan sweep; Directus refuses to delete a file in
   use; Supabase does not care; PocketBase deletes with the record. These are `degraded` caveats, not
   bugs to paper over.
5. **The three nodes serve every backend** or are gated with reasons.

## Implementation Steps

1. Define the normalised file reference on the contract; implement for Parse-wire first (BCN-002's
   adapter already has the methods).
2. Directus `/files`, Supabase Storage, PocketBase record-attached — one at a time, each with a live
   upload/read/delete round-trip.
3. Decide and implement the PocketBase record-target question.
4. Normalise signing vs token-URL, and make the distinction visible on the `Sign File URL` node's
   output rather than only in docs.
5. Declare deletion semantics per backend as descriptor caveats.
6. **Live pass**: upload a real image, read it back through a rendered `Image` node in a running app,
   sign a URL where supported and confirm it expires, delete, and confirm the read fails afterwards.
7. Flip descriptor cells.

## Success Criteria

- [ ] `uploadFile` / `signFileUrl` / `deleteFile` work on all five backends or are gated with a reason.
- [ ] A normalised file reference is returned by every adapter.
- [ ] PocketBase's record-attached model is either expressed in the contract or declared `degraded` —
      not silently approximated.
- [ ] Signed URLs and token URLs are distinguishable by an app author from the node's outputs.
- [ ] Per-backend deletion semantics are declared.
- [ ] Live pass on every backend, including rendering an uploaded image in a running app and confirming
      an expiring URL actually expires.

## Out of Scope

- **Image transformation.** Ours has it (BAK-006, optional sharp); Directus and Supabase have their own;
  PocketBase has thumbs. A unified transform API is a bigger surface than this phase can justify.
  Descriptor cell, no contract method.
- **Bucket provisioning.** Connecting to a backend that has storage configured is in scope; configuring
  the user's S3 is not.
- **Direct-to-bucket uploads.** Presigned client-side upload straight to S3, bypassing the backend, is a
  real optimisation and a separate design.
- **The orphan sweep.** `nodegx-backend`'s, and it stays ours.

## Traps

- **`readRawBody` 413 socket-destroy has been worked around twice already** in BAK-006. Whatever the
  upload path does about large bodies, check what that task learned before rediscovering it.
- **PocketBase files are meaningless without their record.** An upload flow that returns a file id with
  nowhere to put it produces orphans the user cannot see or delete.
- **Supabase Storage is a separate service from PostgREST** with its own URL base and its own
  permissions (bucket policies, not RLS on a table). A file 403 will look like a data 403 and have a
  different cause.
- **Directus will not delete a file that is referenced.** A `deleteFile` that reports success because it
  got a 2xx from a different code path will look correct and leave the file.
- **`sharp` is genuinely optional** in our subsystem — do not let a shared file path acquire a hard
  dependency on it while generalising.
- **Content-type sniffing matters for what renders.** BAK-006 has `sniff.ts` for a reason; a
  generalisation that trusts the client's declared content type inherits the bug it was written to fix.