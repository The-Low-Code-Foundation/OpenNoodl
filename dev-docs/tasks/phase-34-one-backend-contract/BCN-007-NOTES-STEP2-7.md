# BCN-007 — Notes, steps 2–7

**Steps 2, 3, 4, 5, 6 and 7 — Directus, Supabase Storage and PocketBase files; the
signing-vs-token distinction on the node's outputs; per-backend deletion semantics;
the live pass; the descriptor flips.** Plus the **Directus system-collections gap**,
which was BCN-010's stated precondition.

Read alongside [BCN-007-FILES.md](./BCN-007-FILES.md) (the spec, whose traps §1
corrects twice), [BCN-007-NOTES.md](./BCN-007-NOTES.md) (step 1),
[BCN-004-FILE-FACTS.md](./BCN-004-FILE-FACTS.md) and
[BCN-006-007-LIVE-QA.md](./BCN-006-007-LIVE-QA.md).

**Everything below was measured before it was written.** Four probe outputs and one
node-level driver are committed beside the code:

| Artefact | What it is | Result |
|---|---|---|
| `bcn-007-files-probe.mjs` → `BCN-007-FILES-PROBE-OUTPUT.txt` | the four file wires, first contact | 32 checks, 3 failures — all three were findings, two were instrument defects |
| `bcn-007-files-probe2.mjs` → `…PROBE2-OUTPUT.txt` | those three failures with the confounds removed | 17 checks, 4 failures |
| `bcn-007-files-probe3.mjs` → `…PROBE3-OUTPUT.txt` | nodegx privacy + signature expiry with a real owner | **14 checks, 0 failures** |
| `bcn-007-supabase-storage-probe.mjs` → `…STORAGE-OUTPUT.txt` | Supabase Storage, in the rig for the first time | **14 checks, 0 failures** |
| `bcn-007-file-driver.ts` → `BCN-007-FILE-DRIVER-OUTPUT.txt` | **the live pass, through the nodes**, four backends | **57 checks, 0 failures** |

---

## 1. Stale premises

### 1.1 ⚠️ The spec's Directus deletion trap is **false**, and the real hazard is the opposite one

> Traps: *"**Directus will not delete a file that is referenced.** A `deleteFile`
> that reports success because it got a 2xx from a different code path will look
> correct and leave the file."*

Measured, with a **real** relation created through `POST /relations`
(`related_collection: directus_files`, `on_delete: SET NULL`, confirmed present by
reading `/relations/{c}/{field}` back):

```
DELETE /files/{id}  while a row references it   -> 204
GET    /items/bcn007_ref/1  afterwards          -> {"id":1,"title":"referenced","attachment":null}
```

The delete **succeeds**, the file is gone, and Directus nulls the reference. An
adapter written to the spec would have grown a defensive pre-check for a refusal
that never comes.

Worth recording how nearly this was got wrong: probe 1 created the file field with
`schema: { foreign_key_table: 'directus_files' }` on the field-create call, saw the
204, and would have reported the same conclusion — but Directus had **ignored** that
schema hint, so there had never been a reference at all. Probe 2 exists to
distinguish those. The conclusion survived; the evidence for it did not.

### 1.2 ⚠️ PocketBase's `protected: true` does **not** make a file private

The existing descriptor evidence read *"the protected flag is per field, not per
file"*, which is true and not the interesting part. Measured:

| Collection view rule | `protected` | `GET /api/files/…` with no credential |
|---|---|---|
| `''` (anyone may view) | `true`, confirmed round-tripped by reading the collection back | **200, serves the bytes** |
| absent (admin only) | `true` | **404** |

So `protected` **defers entirely to the record's view rule**. An author who marks a
field protected on a public collection has done nothing at all. The `files.private`
cell now says so in those words.

### 1.3 ⚠️ `packages/noodl-runtime/src/api/files.ts` does not exist

The handover's territory list names it. The file is
`packages/noodl-viewer-react/src/api/files.ts` — `Noodl.Files`, the JS API. It
needed no change: `CloudFile` already grew `contentType`/`size` when
BCN-006-007-LIVE-QA's finding was closed (`7cb23527`), and this task added `target`
to the same constructor.

### 1.4 ⚠️ `files.progress: supported` was written before the adapter it describes

Directus's cell read `supported('XHR upload path is client-side')` and PocketBase's
read `supported('multipart upload goes over the XHR path')`. Neither is true:
`RestDataAdapter` is built on `fetch`, and **`fetch` has no upload-progress event**.
Both corrected to `degraded`. Nothing synthetic is emitted — a bar that jumps 0→100
tells an author their instrumentation works when it does not.

### 1.5 The spec's `readRawBody` 413 trap did not apply, and the sniffing one did not either

Neither was reachable. The 413/socket-destroy workaround is `nodegx-backend`'s
server-side upload path (BAK-006); nothing here touches it. Content-type sniffing
(`sniff.ts`) is likewise server-side and stayed server-side — the adapters pass
`file.type` through, which is what the client declared. **Only `nodegx-backend`
sniffs**; Supabase stores whatever `Content-Type` it was sent, and Directus and
PocketBase sniff for themselves (both reported `image/png` for a real PNG). That is a
descriptor-shaped fact, not a code change, and there is no client-side sniffer to
write without pulling BAK-006's module into the runtime bundle. Recorded rather than
solved. `sharp` was never touched; nothing in the shared path does transforms.

---

## 2. The decisions the handover asked for, stated plainly

### 2.1 PocketBase's three-part handle: **expressed in the contract, AND declared `degraded`**

The spec said *"either the capability is `degraded` … or `uploadFile` takes an
optional record target that the other backends ignore. Prefer the latter if it does
not distort the contract; prefer the former over a lie."*

**Both, for different reasons.**

`FileTarget` is a **discriminated union** on the contract (`data.ts`), carried on
`UploadFileOptions`, `SignFileUrlOptions`, `DeleteFileOptions` and back out on
`FileRef` and `CloudFile`:

```ts
export type FileTarget =
  | { kind: 'record'; collection: string; recordId?: string; field: string }   // PocketBase
  | { kind: 'bucket'; bucket: string; path: string };                          // Supabase
```

- A union rather than one bag of optional strings, because the two ideas are not the
  same thing wearing different names, and step 1 refused a delimited composite for
  exactly this reason.
- Supabase is in it too. Step 1 only anticipated PocketBase; measurement showed
  Supabase has the identical problem — an object is `(bucket, path)` and neither can
  be defaulted.
- The other three backends **never read it**. That is what makes it safe on shared
  options: it is not read where it has no meaning, rather than read and
  mistranslated.

And `files.upload` on **both** backends is `degraded`, because the target is
something the app author has to supply and cannot be guessed. An Upload File node
with Collection blank is a file with nowhere to live, and `degraded` is what puts
that in front of them before they ship rather than after.

### 2.2 The `{__type, url, name}` save format: **declared, not changed**

Three reasons, in order of weight:

1. **It is a stored-data change on the Parse wire.** `{__type: 'File'}` is Parse's
   envelope; a widened one would be written into users' databases and would not be
   readable by any Parse Server. Step 1 said the widening belongs to whoever owns the
   record wire, and that is still true.
2. **The phase's fresh-start decision does not help.** Legacy *projects* are not a
   design constraint; the *wire* still is, because `parse` is a shipped backend type.
3. **The declaration can be made actionable, which is the part that was missing.**

So the declaration is not a comment nobody reads. Concretely:

- `CloudFile.target`'s doc says it does not survive a save, at the point where
  someone would assume it does.
- The Cloud File node's `Content Type` and `Size` port descriptions already said
  *"empty … on a file read back from a record property"*.
- ⚠️ **And the refusal message for the case was wrong, and is fixed.** Sign File URL
  and Delete File have **no Collection or Bucket inputs**, so the upload's sentence
  ("Set Collection and Field on the node") names ports that are not there — the exact
  plausible-looking-wrong-message class this phase exists to remove. There is now a
  separate `LOST_TARGET` sentence that names the real cause:

  > *"This file came from a saved record, and on this backend a record only stores
  > the file's name — not the bucket or collection it lives in, which is what a link
  > or a delete needs. Wire the Cloud File straight from the Upload File node that
  > produced it, or use a cloud function that knows where the file is."*

  Pinned by a test that asserts the message **does not** contain "Set Collection and
  Field".

### 2.3 The Directus system-collections gap: **IMPLEMENTED**

`PROGRESS.md` lists this as *"the blocker on deleting the four `noodl.byob.*`
types"*. It is closed. **The orchestrator can land the deletions.**

Measured first (`BCN-007-FILES-PROBE-OUTPUT.txt` §1d):

```
GET /items/directus_users                     -> 403 "You don't have permission to access this."
GET /users                                    -> 200
GET /users?limit=1&fields=id,email&sort=-id   -> 200, {"data":[{"id":…,"email":…}]}
GET /items/directus_files                     -> 403
```

Cheap, therefore implemented rather than declared: the two routes take the **same
query dialect** and return the **same `{data: […]}` envelope**, so the entire
difference is the path. Everything else in `RestDataAdapter` — filters, sort,
pagination, the `filter_count` total, identity normalisation — applies unchanged.

New file `packages/noodl-runtime/src/api/backends/directusSystem.ts`; `path()`
consults it. Five tests, and the mutation that disables it fails two of them.

Three deliberate choices, each written down at the point of temptation:

- **`apiPathMode` is derived, not carried.** BYOB had an enum port with
  `items`/`system`. The switch has no correct second position — `/items/directus_x`
  is 403 for every system collection and `/users` is 404 for every user one — so
  its entire information content is the collection name, which is what
  `apiPathModePorts` already defaults from and what `detectApiPathMode` does
  outright. Deriving it removes a control whose wrong setting could only break the
  request.
- **The rewrite is keyed on the `/items/` template, not on `profile.type ===
  'directus'`.** Same reasoning `recordTarget` gives for the same choice. A test
  pins that a *PocketBase* collection someone named `directus_users` is untouched.
- **A `directus_` collection with no mapped endpoint falls back to `/items/` and
  403s.** Deriving the route by stripping the prefix would invent one for any future
  `directus_` table not served under its bare name, and a fabricated route answers
  404 — which reads to a user as *"this collection does not exist"*. A 403 is at
  least the same error a genuine permission problem gives. Tested.

**Nothing is needed from Worker B.** `record-ports.ts`'s `filterByApiPathMode:
false` means *"show all collections including system ones"*, which is now **correct
rather than a workaround** — the adapter can serve them. Its comment
(*"Directus' items-vs-system split is a Directus concept reached through a port
these nodes do not have"*) is now slightly stale in its reasoning but right in its
conclusion; not worth a cross-territory edit.

⚠️ **One thing for whoever lands the BYOB deletion.** `byob-utils.ts` holds a second
copy of the endpoint map (`SYSTEM_ENDPOINTS`) and `schema-ports.ts` a second copy of
`isSystemCollection`. They are **not** merged here — `api/` may not import `nodes/`
(the layering `restSerialize.ts` states), and the BYOB copy is scheduled for
deletion with its family. **Delete the copy; do not re-point it.**

---

## 3. Deviations from the spec, each with its reasoning

### 3.1 A Directus `FileRef.url` carries **no credential**, and is therefore a broken `<img>`

BCN-004-FILE-FACTS §2.1 posed the choice: *"require the project to grant the public
role read on `directus_files`, or mint a signed/token URL"*.

Neither, exactly. The `FileRef.url` is the **plain** `/assets/{id}`, which 403s
unauthenticated, and the usable link comes from `signFileUrl`.

The reason is that **a `FileRef.url` is persisted into a record property** by
`_serializeObject`. Baking the caller's access token into it would write a live
credential into the user's database, where it outlives the session and is readable
by everyone who can read the row. That is a worse outcome than a broken image.

It is also precisely the rule `nodegx-backend` already follows for a private file —
*"the `url` `upload()` returns for a private file is always the PLAIN (unsigned)
path"* — so the two backends behave alike rather than differing by adapter author.

Two tests pin it, including one that asserts the URL does not contain the session
token, and the mutation that adds the token fails both.

### 3.2 Directus's stored handle is `id`, not `filename_disk`

Step 1 wrote `filename_disk` from documentation. `DELETE /files/{id}` and
`/assets/{id}` are both keyed by the UUID; `filename_disk` is that UUID plus an
extension — close enough to look right in a log and wrong for any file whose type
Directus could not name. `filename_disk` is now not mapped at all. The mutation that
restores step 1's guess fails three tests.

### 3.3 Supabase reports **no** `contentType` and **no** `size`

Step 1's table promised `metadata.mimetype` / `metadata.size`. Those exist — on a
**second** request, `POST /object/list/{bucket}`. The upload answers `{Key, Id}` and
nothing else. They are reported **absent** rather than fetched, because a second
round trip whose failure would have to be swallowed is a worse answer than the
truthful one, and absence is exactly what lets a node tell "the backend did not say"
from "this file is empty".

### 3.4 Two node outputs, not one, for the signing distinction

The spec asks for *"the difference … visible on the node's output"*. `urlKind`
(`signed`/`token`/`public`) is the fact; **`isShareable` ("Safe To Share")** is the
consequence, and it is the one an author can wire to a Share button. A single
`kind` port makes the author look up what `token` implies.

`isShareable` is `undefined` — not `false` — until Sign has succeeded once: a node
that has never run has not decided the link is unsafe.

### 3.5 Five File Location inputs on Upload File, not a double-duty three

Bucket / Path / Collection / Record ID / Field, each description naming the backend
it belongs to, all inert on NodeGX, Parse and Directus. Three double-duty ports
("Collection / Bucket") were considered and rejected: a port that means two things
is the plausible-looking-wrong-thing this phase removes. `fileTarget()` builds the
union and **a half-filled group yields `undefined`, never a partial target** — a
`{kind:'record'}` with no collection passes the adapter's guard and then composes a
URL containing the string `undefined`. Tested.

### 3.6 A `RestDataAdapter` upload refuses a body with no bytes

`UploadFileOptions.file` is typed `{name, type?}` — the structural subset the Parse
wire needed. A caller passing that literal has no bytes, and every one of these
backends answers 200 for a body of `{}`. Guarded before anything is sent.

---

## 4. ⚠️ The defect the live pass found, which nothing else could

**The three file nodes could not reach any backend except the legacy one, and
nothing had noticed.**

`Upload File` and `Sign File URL` called `CloudStore.instance` — the module-level
singleton that always resolves `cloudservices` — while BCN-004 step 5 gave the six
Record nodes `CloudStore.forBackend`. So this task could have implemented
`uploadFile` for Directus perfectly and an Upload File node in a graph would still
have posted to the built-in backend.

The driver caught it on its **first run**, on all four backends at once, as a
transport failure with an empty error message. No unit test could have: they mock
`CloudStore` and assert what the node asks it for.

Fixed in both nodes, following the Record family's own pattern:

- `backendId` registered through `registerInputIfNeeded` (dynamic, because the enum
  is built from the project's backends).
- `CloudStore.forBackend(modelScope, backendId)`, and **a backend id naming nothing
  is an error with a sentence, never a fallback** — falling back would upload the
  user's file to a different backend from the one the graph names, with a Success
  signal to say it went well.
- A `setup`/`updatePorts` pair emitting `recordBackendPickerPorts`, so the **editor
  shows the picker**. It imports the Record family's helper rather than rolling a
  second one, deliberately: `hideWhenSingleBackend` counts `cloudservices` as a
  backend, and a hand-rolled copy would have re-introduced BCN-004's defect where
  built-in-plus-Directus counted as "one", hid the picker, and silently moved every
  node onto the other backend.

Cloud File needs none of this — it reads a `CloudFile` and touches no backend.

Two new tests pin the routing; the mutation that restores `CloudStore.instance`
fails both.

---

## 5. The live pass, check by check

`bcn-007-file-driver.ts`, copied from `bcn-004-node-driver.ts` as instructed (its
XHR-shim `catch` fix, `_initCloudServices()` re-read and editor-connection stub are
all things that cost that task real time). Real node instances in a real
`NodeContext`, inputs through `registerInputIfNeeded`, outputs off real ports.

**57 checks, 0 failures.** Full output in `BCN-007-FILE-DRIVER-OUTPUT.txt`.

| Check | nodegx | directus | pocketbase | supabase |
|---|---|---|---|---|
| Upload File fires Success | ✅ | ✅ | ✅ | ✅ |
| Cloud File publishes a URL | ✅ | ✅ | ✅ | ✅ |
| that URL serves to an anonymous `<img>` | ✅ 200 | ✅ **403, as expected** | ✅ 200 | ✅ 200 |
| …bytes are the uploaded PNG | ✅ | n/a (403) | ✅ | ✅ |
| …served as `image/png` | ✅ | n/a | ✅ | ✅ |
| Sign File URL fires Success | ✅ | ✅ | ✅ | ✅ |
| `URL Kind` reads what the backend mints | ✅ `signed` | ✅ `token` | ✅ `token` | ✅ `signed` |
| `Safe To Share` agrees | ✅ | ✅ false | ✅ false | ✅ |
| the signed/token URL serves with no session | ✅ | ✅ | ✅ | ✅ |
| …bytes are the PNG | ✅ | ✅ | ✅ | ✅ |
| `deleteFile` reports success | ✅ | ✅ | ✅ | ✅ |
| **the file no longer serves afterwards** | ✅ 404 | ✅ 403 | ✅ 404 | ✅ 400 |

Plus the expiry section, on the one backend whose TTL is configurable low
(`signedUrlTtlSeconds: 3` in the data dir's `files.json`):

| | |
|---|---|
| a **private** upload succeeds through the node | ✅ |
| ⚠️ the plain URL of a private file is refused anonymously | ✅ 403 |
| Sign File URL succeeds, `URL Kind` = `signed`, `Safe To Share` = true | ✅ |
| the signed URL serves anonymously **right now** | ✅ 200 |
| ⚠️ **THE SIGNED URL STOPS SERVING once its TTL passes** | ✅ |

Expiry was also observed on **Supabase** in its own probe: `POST /object/sign` with
`{expiresIn: 3}`, waited out, then `400 InvalidJWT "jwt expired"`.

### 5.1 The one part of the spec's live pass that is **not** covered

> *"read it back through a **rendered `Image` node** in a running app"*

**Not done, and not claimed.** That needs a React tree; this harness is node-level.

What is done instead is the half that can actually fail: the URL a `Cloud File` node
published is fetched **exactly as an `<img src>` fetches it** — one GET, no
`Authorization` header — and the bytes and content type are compared to the PNG that
went in. That is what caught Directus's 403 and would have caught a JSON body stored
as an image. What it does not prove is that `Image`'s `Source` input accepts a
`CloudFile` and calls `toString()` on it. `CloudFile.toString()` returning the url is
long-standing behaviour with its own test, but the wiring was not driven.

---

## 6. Mutation tests

Eleven mutations. **Ten were caught; one was not, and the one that was not is the
most useful result in this section.**

| # | Mutation | Caught by | Result |
|---|---|---|---|
| M1 | upload body no longer sent `raw` — `JSON.stringify` eats the `FormData` | unit | ✅ 1 failure |
| M2 | `multipartHeaders` stops deleting `Content-Type` | unit | ✅ 1 failure |
| M3 | Directus `FileRef.url` carries the access token | unit | ✅ 2 failures |
| M4 | Directus `signFileUrl` stamps `signed` instead of `token` | unit | ✅ 2 failures |
| M5 | the Directus system-collection rewrite is disabled | unit | ✅ 2 failures |
| M6 | Supabase `signedURL` used relative, without the origin | unit | ✅ 1 failure |
| M7 | Directus `name` maps to `filename_disk` (step 1's guess) | unit | ✅ 3 failures |
| M8 | `normalizeFileRef` silently drops the `target` | unit | ✅ 4 failures |
| M9 | multipart keeps `Content-Type: application/json` | **live** | ✅ 2 failures — real servers reject it |
| M10 | the signed URL's signature is corrupted so it never works | **live** | ⚠️ see below |
| M11 | the node goes back to `CloudStore.instance` | unit | ✅ 2 failures |

### 6.1 ⚠️ M10 — the expiry check passes on a URL that never served

```
FAIL  nodegx: the signed URL serves anonymously right now
PASS  nodegx: ⚠️ THE SIGNED URL STOPS SERVING once its TTL passes
```

**"Stops serving after its TTL" is vacuous on its own.** It passes for a URL that was
dead from the moment it was minted. The claim only means something because the
driver checks *"serves anonymously right now"* first, and that guard is what failed.
Any future expiry check needs both halves or it proves nothing.

### 6.2 ⚠️ A mutation that did not mutate, and one that was too weak

Both worth recording because they are the failure mode the handover warned about.

- **M3, first attempt.** A `perl -0pi` regex containing `${...}` silently expanded
  as shell, applied nothing, and the suite reported **104 passed**. That reads
  exactly like "the check does not discriminate" and was a broken instrument. Every
  mutation after it was applied through a Python helper that **asserts the old string
  was present** and prints `applied`.
- **M10, first attempt.** Appending `&mutated=1` to the signed URL — the URL still
  served 200, because an extra query parameter does not disturb `exp`/`sig`. The
  mutation was too weak to be a test of anything. Redone by corrupting the signature
  itself, which produced §6.1.

### 6.3 Two instrument defects the run found in itself

- **A `Blob` is not a `File`.** The driver's first upload helper returned a `Blob`
  with a `.name` property. nodegx stored **28 bytes of `application/json`** and
  answered 200, and the byte-comparison check caught it.
  ⚠️ **And this is a real hazard, not only an instrument one.**
  `ParseWireAdapter._makeRequest` branches on `options.content instanceof File`, so a
  `Blob` — which is what `canvas.toBlob()`, `fetch().blob()` and most client-side
  image processing produce — is **silently JSON-stringified and uploaded as `{}`,
  with a Success signal**. Not fixed here: that line is `ParseWireAdapter`'s and
  BCN-002's, and it is another worker's file in this batch. **Recorded for the
  register.**
- **The wrong admin header.** Probe 2 sent `X-NodeGX-Admin-Token` at a Parse-wire
  route and got a 403 that looked like a permission finding.
  `security/state.ts::resolvePrincipal` reads the admin credential from
  `X-Parse-Master-Key` or `Authorization: Bearer`; the dashboard header only works on
  `/admin/*`.

---

## 7. Could not verify

| Claim | Status |
|---|---|
| **A rendered `Image` node** | **Not done.** §5.1. Node-level harness; the URL is fetched as an `<img>` would but no React tree renders it |
| **Upstream Parse's file methods** | **Not driven.** BCN-002 measured a stock Parse Server refusing uploads outright and `/files/:name/sign` answering 403 code 119; those three cells were already `unsupported`/`conditional` and nothing here moved them. The `parse` container is in the rig and was not exercised by this task |
| **`files.progress` on any backend** | **Not observed as absent.** The claim is structural — `fetch` has no upload-progress event — and no run counted zero events. The Parse-wire path's single event on a 70-byte file was already recorded by BCN-006-007-LIVE-QA |
| **The Supabase adapter against a real hosted Supabase project** | **No.** The rig runs `supabase/storage-api` directly, so the driver mounts it under `/storage/v1` with a proxy (BCN-004's pattern, for BCN-004's reason). Kong's own behaviour — auth, rate limits, its `/storage/v1` route — is unexercised |
| **Supabase Storage with an S3 backend** | **No.** `STORAGE_BACKEND=file`. Bucket provisioning is out of scope by the spec |
| **PocketBase multi-file (`maxSelect > 1`) through the nodes** | **Probed, not driven.** The probe observed `gallery+` appending and the plain form replacing; the adapter uses the plain form and `readPocketBaseFileName` takes the last entry. No node-level run used a multi-file field |
| **A file larger than 70 bytes, anywhere** | **No.** Every check uses a 1×1 PNG. Chunking, the 413 path, and any progress *sequence* are untouched |
| **Writing a `CloudFile` into a REST record property** | **Not addressed, and it is a real gap.** `makeRestSerializer` passes a `CloudFile` through `toJSON` and would send the object; a Directus file column expects a UUID string. That is the record-write path (BCN-004/005's), not the file path, and no check here covers it. ⚠️ Worth a register entry |
| **`files.private` on Directus and Supabase through the nodes** | **Partly.** The Supabase private-bucket 400 and the Directus anonymous 403 were both measured by probe; the Upload File node's `Private` input is a no-op on both and no check asserts that it is harmless |
| **The `public` `FileUrlKind`** | **Still unexercised.** Four adapters mint `signed` or `token`; none mints `public`. The union member is a shape nothing fills |
| **`noodl-editor` (Jasmine)** | **Not run.** No editor source references the touched modules; that is evidence, not the suite |

---

## 8. The rig — what changed, and what other workers should know

⚠️ **A `supabase-storage` service was added to `docker-compose.yml`** under the
existing `supabase` profile. Supabase Storage had **never been in the rig** — `:8056`
is plain PostgREST and answers every `/storage/v1/*` with a bare `404 {}`. BCN-006
hit the same wall on auth and correctly refused to flip its Supabase cells; rather
than repeat that, this task stood a real `supabase/storage-api` up against the rig's
existing `supabase-db` and probed it.

- **No existing container was restarted or recreated.** The service was brought up as
  a standalone container on the rig's network first, then written into the compose
  file so the measurement is reproducible. No other worker's run was disturbed.
- It creates its own `storage` schema and roles in `supabase-db` and touches nothing
  in `public`, so the BCN-001/003/004/005 fixtures there are unaffected.
- ⚠️ **`JWT_SECRET` is the env var the image actually reads.** Setting only
  `AUTH_JWT_SECRET`/`PGRST_JWT_SECRET` — both documented — makes every request answer
  `403 "invalid signature"`, which reads exactly like a wrong key rather than a wrong
  variable name. All three are set.
- The container is on `:8112` and serves `/object/…` at its root; the driver proxies
  `/storage/v1/*` onto it, as Kong does in production.

**Fixtures created and cleaned up**, all namespaced: Directus `bcn007_docs` /
`bcn007_ref` collections (deleted), PocketBase `bcn007_docs` / `bcn007_prot` /
`bcn007_prot2` / `bcn007_files` (deleted), Supabase buckets `bcn007-public` /
`bcn007-private` / `bcn007-driver` (left; they are in the new `storage` schema and
touch nothing shared). **`articles` and `authors` were never touched.**

⚠️ The nodegx-backend used for this work runs on **:8110** from a scratch data dir
with two non-default settings that the probes depend on: `signedUrlTtlSeconds: 3` in
`files.json`, and `devOpen: false` + `files.delete: "authenticated"` in
`security.json`. **`files.delete` defaults to `"nobody"`** on a fresh backend, which
is worth knowing: a Delete File node against a default nodegx backend answers 403 for
every principal except an admin.

---

## 9. Gate numbers, all run in this worktree after merging `cline-dev`

| Package | Result | Baseline |
|---|---|---|
| `@noodl/runtime` | **88/89 suites, 1706 passed, 0 failed**, 1719 total | 89 suites / 1682 passed / **0 failed**; one suite (`agent-live-endpoint`) is env-gated and wholly skipped, 13 skipped |
| `@noodl/backend-contract` | **169 passed, 0 failed** | 169 |
| `@noodl/noodl-viewer-react` | **35 suites, 379 passed, 0 failed** | 373 |
| `tsc --noEmit` — `nodegx-backend-contract` | clean | — |
| `tsc --noEmit` — `noodl-runtime` | clean *(after `npm run build:types`)* | — |
| `tsc --noEmit` — `noodl-viewer-react` | clean | — |
| **PLAT-004 TSFixme ratchet** | **RED, unmoved** — the same inherited `+26`… `+28` from `nda-016-layout-sizemode`, `nda-004-navigation-failure`, `nda-008-stack-replace-transition` and eight pre-existing single-line entries. **No file this task touched appears in the report**, and the baseline was **not** re-run | RED, inherited |

⚠️ `noodl-runtime`'s bare `npx jest` still crashes in `@jest/reporters/getResultHeader`
on a missing `terminal-link` and reports a meaningless "1 of 23 total". The custom
reporter is the workaround; the crash looks exactly like a failing suite.

⚠️ `noodl-runtime`'s `dist-types` must be built first or four corpus suites do not
start and the run reads `79/84`.

Live: **57 node-level checks, 0 failures**, plus 14 + 14 probe checks with 0 failures
on the two probes whose confounds were removed.

---

## 10. For the register

| Finding | Owner |
|---|---|
| ⚠️ **A `Blob` uploaded through the Parse wire is silently JSON-stringified and stored as `{}`, with a Success signal.** `_makeRequest` branches on `instanceof File`; `canvas.toBlob()` and `fetch().blob()` both produce `Blob` | `ParseWireAdapter` / BCN-002 |
| ⚠️ **A `CloudFile` written into a REST record property is sent as a JSON object**, where a Directus file column expects a UUID string. `makeRestSerializer` passes it through `toJSON` unchanged | BCN-004/005 record write path |
| ⚠️ **nodegx `files.delete` defaults to `"nobody"`**, so a Delete File node against a fresh backend answers 403 for everyone but an admin | BAK-003/006 — is that the intended default for an app? |
| ⚠️ **A private nodegx upload made by a non-user principal has no owner and is not actually private.** Now `files.private: degraded` | BAK-006 |
| ⚠️ **An expired signature on a *public* nodegx file still serves.** Signing a public file produces an expiry that does nothing | recorded on the `files.sign` cell and the node's `URL Kind` port |
| **The four `noodl.byob.*` types are unblocked.** §2.3 | orchestrator / BCN-010 |
