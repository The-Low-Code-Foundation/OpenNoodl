# BCN-004 — the Directus file payload, measured

**Measured 2026-07-31** against Directus 11 in the
[uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/). Probe:
[`bcn-004-files-probe.mjs`](../phase-16-runtime-deploy-health/uba-e2e/bcn-004-files-probe.mjs).
Raw output: `BCN-004-FILES-PROBE-OUTPUT.txt`. **16 checks, 0 failures.**

This closes the one item [BCN-007-NOTES](./BCN-007-NOTES.md) §3 handed to BCN-004 by name: the
Directus field mapping in `file-ref.test.ts` was *"documented, not probed"*, and BCN-007 shipped
having **never observed a real upload response at all**.

A real 1×1 PNG was uploaded, served, read back and deleted.

---

## 1. The documented field map is correct

| Field | Documented in `fileRef.ts:14` | Observed |
|---|---|---|
| stored handle | `id` + `filename_disk` | ✅ both present, `filename_disk` = `{uuid}.png` |
| download name | `filename_download` | ✅ present, = the uploaded filename |
| content type | `type` | ✅ `"image/png"` |
| size | `filesize` | ✅ `70` |
| url | *synthesised* `/assets/{id}` | ✅ no `url` field on the payload; `/assets/{id}` serves the exact bytes |

`contentType`, `size` and `url` — the contract's names — are all absent, confirming the rename
the boundary does is a real rename and not a no-op.

The read shape (`GET /files/{id}`) has **the same 26 keys** as the upload response, so an adapter
needs one mapping, not two.

## 2. Three findings the fixture could not have produced

### 2.1 ⚠️ Directus assets are **not public**, and the synthesised URL is the thing that breaks

```
GET /assets/{id}  Authorization: Bearer <admin>  -> 200, image/png, bytes match
GET /assets/{id}  (no header)                     -> 403
```

`normalizeFileRef`'s `urlFrom` seam exists precisely because Directus *"returns a handle, not a
URL"*. What the probe adds is that the URL it composes **does not work unauthenticated**. A
`FileRef.url` reaches `CloudFile.toString()` and ends up in an `<img src>` — a browser request
carrying no `Authorization` header. On a default Directus that renders a broken image with a 403
in the network tab and nothing anywhere else.

This is the same failure *shape* the phase keeps finding: a success path that returns a
plausible-looking wrong thing. BCN-007 step 2 has to decide between requiring the project to
grant the public role read on `directus_files`, and minting a signed/token URL — but it can no
longer decide it by assuming `/assets/{id}` just works.

### 2.2 ⚠️ 403 means *both* "deleted" and "never existed" — 404 is unreachable

```
GET /files/{deleted-id}      Bearer <admin> -> 403 FORBIDDEN
GET /files/{unused-uuid}     Bearer <admin> -> 403 FORBIDDEN
GET /files/not-a-uuid        Bearer <admin> -> 403 FORBIDDEN
```

With an **admin** token. Directus hides existence deliberately, so on this wire an adapter
**cannot tell "gone" from "not allowed"**. An error mapping that turns 403 into *"check your
access token"* — the obvious mapping — gives the wrong message for a file that is simply
deleted. Whatever BCN-007 step 2 does here, it cannot claim to know which happened.

### 2.3 The upload is a `200`, so there is no 201 to observe

BCN-007-NOTES lists *"no 201 has ever been observed"* as an open item. On Directus there is not
one to observe: `POST /files` answers **200**, matching `POST /items/{c}` in
[BCN-004-WIRE-FACTS](./BCN-004-WIRE-FACTS.md) §2. The 201 in that note is the Supabase/PostgREST
shape, and it remains unobserved *for files* — Supabase Storage is a separate service from the
PostgREST container in the rig.

### 2.4 A doc comment with its premise backwards

`fileRef.ts::readSize` says *"Directus's `filesize` is a string in its REST payloads and a number
in some of its SDK types"*. Measured, it is a **number** (`70`) in the REST payload. The function
accepts both, so **there is no bug** — but the comment argues from the wrong direction, and the
next person to touch it would widen the wrong side. The numeric-string branch is still earning
its place from PostgREST's `bigint`-as-string, which is the second half of the same comment.

## 3. Still not probed

- **Supabase Storage and PocketBase files.** Neither is in the rig — the Supabase container is
  plain PostgREST, and no PocketBase file field is seeded. BCN-007 steps 2–3.
- **`contentType`/`size` on a real *Parse-wire* upload.** BCN-002 found a stock Parse Server
  refuses uploads outright, so that response shape is still unreachable on that backend.
- **The `token` and `public` `FileUrlKind`s.** No adapter mints either yet.
