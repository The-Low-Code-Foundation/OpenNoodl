# BCN-007 — Notes

**Step 1 only: the normalised file reference, and the Parse wire behind it.**

Read alongside [BCN-007-FILES.md](./BCN-007-FILES.md), whose premises §1 corrects, and
[BCN-002-NOTES.md](./BCN-002-NOTES.md), which this task starts from rather than from the
spec.

**Scope, stated first, because most of the spec is deliberately untouched.** Implementation
step 1, plus step 4's contract half, plus step 5 for the two backends that could be
evidenced. Steps 2, 3, 6, 7 and three-fifths of step 5 are not done and not begun — they
need BCN-004's REST transport, which does not exist. No REST transport was invented here;
that is BCN-004's and a second one guarantees a conflict.

---

## 1. Spec premises that were wrong

### 1.1 The premise that was right, and worth saying so

The spec's own headline correction holds. *"Files I dunno because none of the backends we
offer should do native file storage"* — all five have a file API and all five can be
bucket-backed, and files are one of the cheaper items rather than the wildcard. Nothing
found here contradicts that.

### 1.2 Three of the spec's five "Current State" file facts are already stale *(BCN-002)*

The spec's Desired State §3 and §5 assume the Parse-wire backends behave alike on files.
BCN-002 measured them and they do not: a stock Parse Server **refuses uploads outright**,
deleting a file **needs the master key**, and `GET /files/:name/sign` **does not exist on
Parse at all** — it is BAK-006's, ours. Acted on rather than re-derived. The concrete
consequence for step 1 is in §2.3.

### 1.3 ⚠️ A fourth wrong contract shape, same class as BCN-002's three *(found here)*

`UploadFileOptions.data` was typed **required**. BCN-001 extracted it because
`cloudstore.js`'s `uploadFile` did `Object.assign({}, options.data, response)` before
calling `success`. Nothing in the repository has ever set it — not the Upload File node,
not `Noodl.Files.upload`, not `noodl-viewer-cloud`, not a test — so the merge only ever
spread `undefined`, and the contract carried a required field no caller could satisfy.

Found the same way BCN-002's three were: by making something else depend on the shape.
**Removed**, not recorded, because BCN-007 is the task that owns what an upload returns and
an arbitrary caller-supplied object merged over the backend's own response is the one thing
a normalised `FileRef` cannot survive.

`DeleteFileOptions` has the same vestige on the adapter side
(`Object.assign({}, (options as {data?: unknown}).data, response)`) and it is **left
alone**: `deleteFile`'s success payload is not normalised by this task, and removing the
merge would be a behaviour change with nothing in this task's evidence to justify it.

### 1.4 ⚠️ The normalised reference cannot mean what the spec assumes it means

> Desired State §1: *"a normalised file reference — id, URL, filename, content type, size —
> whatever the wire returns."*

True at upload time. **False one save later**, and the spec does not say so.

`cloudstore.js`'s `_serializeObject` persists a File-typed record property as
`{__type: 'File', url, name}`, and `_deserializeJSON` reconstructs a `CloudFile` from
exactly those two fields. So a `FileRef` handed to the Upload File node may carry all six
fields, and *the same file* read back off a record carries two. Nothing in the file
subsystem is at fault; the persisted shape is the Parse wire's `__type: 'File'` envelope
and widening it is a stored-data change owned by whoever owns the record wire.

Recorded in the type's own doc comment rather than only here, because the person who will
be surprised is the one reading `FileRef`.

---

## 2. What was built

### 2.1 The contract

| Addition | Why it is shaped that way |
|---|---|
| `FileRef` | `name` and `url` **required** — `CloudFile` is built from exactly those two and twenty-five nodes pass it around. `id`, `filename`, `contentType`, `size` optional, because no backend reports all four and upstream Parse reports none |
| `FileUrlKind` + `FILE_URL_KINDS` | `signed` \| `token` \| `public`. See §2.2 |
| `SignedFileUrl` | Replaces the inline `{url, expiresAt?, ttlSeconds?}`. `kind` is **required** |
| `UploadFileOptions.data` | Gone — §1.3 |

`FileRef.name` is the **stored** name (`<random8>_<sanitized original>` on our backend), not
what the user called the file. It keeps the Parse-family spelling per the phase's naming
decision, the same argument `recordIdentity.ts` makes for `objectId`.

### 2.2 `kind` — step 4's contract half, and why it was worth taking early

The spec's third desired state is that *"a URL that expires and a URL that requires a header
are different things for an app author to hold."* A bare `url: string` cannot say which it
is, and the three fail in ways an author has to plan for differently:

- **`signed`** — carries its own proof, stops working at `expiresAt`, shareable until then.
  Ours (BAK-006), and Supabase's.
- **`token`** — only works while it carries the *signed-in user's* credential. Pasting it to
  a colleague either fails for them or hands them the credential; neither is what the author
  expected. Directus asset tokens and PocketBase file tokens are both this.
- **`public`** — needs nothing, never expires. Upstream Parse, and any non-private file on
  ours.

Required rather than optional: an adapter that cannot say which of the three it produced
does not know what it just handed the user. It is passed in by the adapter rather than
sniffed out of the response body — a heuristic over the URL ("does the query string contain
`sig`?") would be a guess dressed as a fact about how the link will fail.

**The node port is not done.** Step 4 proper asks for the distinction on the Sign File URL
node's *output*, and that is left to step 4: with one adapter implemented the port would
read `signed` on every project that could reach it, which teaches an author nothing and
would have to be re-explained once three more backends answer it.

### 2.3 The adapter

`fileRef.ts` is built the way `recordIdentity.ts` is and for the stated reason: an adapter
declares what its wire calls each field, the boundary renames, and the rename is written and
tested once rather than five times. The rename direction **no shipped adapter uses** is
tested anyway, against a real Directus `/files` payload, so BCN-004 inherits a proven helper.

On the Parse wire it is close to the identity function, which is the evidence that the shape
is right: `nodegx-backend`'s `FileUploadResult` already returns the four fields the contract
names, so `contentType` and `size` stop being discarded and nothing else moves. Upstream
Parse's two-field response leaves both **absent** rather than zero — absence is what lets a
node tell "this backend does not say" from "this file is empty".

`signFileUrl` stamps `signed` unconditionally, and that is measured rather than assumed:
this adapter serves two backend types, ours signs, and BCN-002 probed upstream Parse's
`/sign` and got 403 code 119 with the master key as readily as without. The only server that
reaches that callback is the one that signs, so the missing `parse` branch cannot be wrong.

### 2.4 Deletion semantics — step 5, two of five

Written for `nodegx` only, from `nodegx-backend/src/server/files.ts`'s `delete`, read line by
line: **permanent** (blob, `_Files` row and cached thumbnails), **idempotent** (an unknown
stored name answers 200 `{}` rather than 404, deliberately, matching WF-004 — so a Delete
File that reports success is not evidence the file existed), and **leaves records pointing at
it** (a File-typed property persists as `{__type:'File', url, name}` and nothing scans for
those; the orphan sweep runs the other way and does not help). `parse` needed nothing: its
`files.delete` cell already reads `unsupported` on BCN-002's measurement.

Still `supported`, not `degraded`: none of the three is a capability the backend lacks, and
`degraded` puts a warning in front of the user under BCN-010's gating.

**Directus, Supabase and PocketBase are deliberately not written.** The spec supplies the
sentences — Directus refuses to delete a file in use, Supabase does not care, PocketBase
deletes with the record — and BCN-001 supplied three equally careful sentences about Parse's
file cells that BCN-002 measured and found **all three wrong**, in the direction that only
surfaces in a user's app. Transcribing three more unprobed claims into the descriptor, into
the same three cells, would repeat that exactly. They belong to whoever has the adapter and
the probe.

---

## 3. Could not verify

Stated plainly, because this phase's own rule is that an unprobed claim is worse than a gap.

| Claim | Status |
|---|---|
| **A real file uploaded, rendered and deleted in a running app** | **Not done.** Step 6 is the live pass and it is out of scope for this slice. Nothing here has been driven against a running backend — not `nodegx-backend`, not the Parse Server in the rig |
| `contentType` and `size` actually arrive on a real upload | **Not probed.** Asserted from `FileUploadResult` (`files.ts:70`) and pinned by a unit test using that literal body. The 201 was never observed |
| Upstream Parse leaves both absent | **Not probed here.** Inferred from BCN-002's finding that a stock Parse Server refuses uploads outright, which means the response shape is currently unreachable on that backend at all |
| The Directus field mapping in the test | **Documented, not probed.** `filename_disk` / `filename_download` / `type` / `filesize` is read from Directus's documented `/files` payload. It is a **test fixture, not a descriptor cell**, and it is explicitly BCN-004's to confirm. Nothing in the shipped descriptor moved on the strength of it |
| The `token` and `public` kinds | **Unexercised.** No adapter produces either yet. The union is a shape three later tasks fill |
| Any node's ports | **Not driven.** `signfileurl.ts` and `uploadfile.ts` were read, not run. Their existing suites pass; neither reaches a real backend |
| `noodl-preview` suite | **Could not run** — it drives the *built* CLI and this worktree has no `dist/noodl-preview.cjs`. Environmental, not a result |
| `noodl-editor` (Jasmine) | **Not run.** `grep -rl "cloudstore\|backend-contract\|ParseWireAdapter" packages/noodl-editor/{src,tests}` returns nothing, so the editor cannot compile any file this task touched. That is evidence, not a hand-wave, but it is not the suite |

---

## 4. What the remaining steps inherit

| Step | What is already there | What it still has to decide |
|---|---|---|
| 2 — Directus / Supabase / PocketBase | `normalizeFileRef` with a declarative field map, and its `urlFrom` seam | **Directus and Supabase return a handle, not a URL.** `urlFrom` exists because of that and is untested against a live one |
| 3 — the PocketBase record target | Nothing, on purpose | **`FileRef.name` cannot hold PocketBase's handle**, which is (collection, record id, filename). Inventing a delimited composite in step 1 would have decided step 3 by accident. `fileRef.ts` says so at the point where the temptation is |
| 4 — signing vs token URL | `SignedFileUrl.kind`, required, three values | The **node port**. See §2.2 for why it was not added with one adapter implemented |
| 5 — deletion semantics | `nodegx` written from its route; `parse` already correct | Three cells, each needing a probe. §2.4 |
| 6 — live pass | Nothing | Everything in §3 |
| 7 — descriptor flips | Nothing moved for a backend without an adapter | — |

Two smaller things carried forward:

- **A 200 with no `url` still produces a `CloudFile` whose `toString()` is `undefined`.**
  `normalizeFileRef` reports what the backend sent and does not reject it. That is
  unchanged behaviour, deliberately: an error path here would be a behaviour change argued
  from a case no backend in the rig produces. Worth revisiting when there is a second wire
  to compare against.
- **`sharp` stayed optional.** Nothing in the shared file path acquired a dependency on it,
  because nothing in the shared file path touches transforms at all. The spec's trap is
  still live for whoever generalises thumbnails.

---

## 5. A worktree trap worth more than this task

⚠️ **In a parallel worktree, `@noodl/*` imports resolve to the PRIMARY checkout.**

`<wt>/node_modules` and `<wt>/packages/node_modules` are symlinks to the primary's, and the
primary's `node_modules/@noodl/backend-contract` is a relative symlink resolved against
*that* root. So a worktree's cross-package imports — `@noodl/backend-contract` from the
runtime, `@noodl/runtime` from the viewer — compile and test the **primary checkout's
sources**, silently. A contract change made in a worktree is invisible to its own runtime
suite, which fails with `has no exported member`, and a *runtime* change made in a worktree
is invisible to its own viewer suite, which passes having tested someone else's code.

Fixed for this session with per-package real `node_modules/@noodl` directories inside the
worktree (gitignored, never written outside it). The first attempt — `mkdir -p
packages/node_modules/@noodl` — wrote into the primary checkout, because
`<wt>/packages/node_modules` is itself a symlink. Reverted immediately; **check `ls -la`
before `mkdir -p` anywhere near a worktree's `node_modules`.**

This belongs in the parallel-worktree reference, not only here.

---

## 6. Suites

Run from the worktree, with the `@noodl` resolution fixed per §5, so these are this
worktree's sources.

| Package | Result |
|---|---|
| `@noodl/runtime` | 1282 passed, 13 skipped |
| `@noodl/backend-contract` | 92 passed *(88 before)*; `tsc --noEmit` clean |
| `@noodl/nodegx-backend` | 729 passed, 10 skipped |
| `@noodl/noodl-viewer-react` | 367 passed |
| `@noodl/cloud-runtime` | 57 passed |
| `@noodl/noodl-core-ui` | 44 passed |
| `@noodl/platform-node` | 13 passed, 3 skipped |
| `@noodl/preview` | ⚠️ **could not run** — needs `dist/noodl-preview.cjs`, which this worktree has never built |
| `@noodl/mcp` | ⚠️ **1 failed**, `create_component validates, writes and updates the registry` — the same test BCN-002-NOTES §9 verified as pre-existing and unowned |
| `noodl-editor` | not run — see §3 |

`noodl-runtime`'s `npx jest` still crashes in `@jest/reporters/getResultHeader` on a missing
`terminal-link` and reports a meaningless "1 of 23 total". A four-line custom reporter is the
workaround; the trap is that the crash looks exactly like a failing suite.

No `TSFixme` or `any` added, so the PLAT-004 ratchet is unmoved by this task. It was already
RED from other sessions when BCN-002 closed and was not re-baselined then either.
