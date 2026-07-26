# BAK-006 — File Storage v2: Notes

Status: shipped 2026-07-26. This records every decision the spec asked to be
recorded, what was verified and how, and an honest residual list.

## What shipped

- `packages/nodegx-backend/src/storage/` (new): `types.ts` (the `StorageDriver`
  interface), `LocalDriver.ts`, `S3Driver.ts`, `sigv4.ts` (zero-dep AWS SigV4),
  `sniff.ts` (magic-byte content-type sniffing), `signing.ts` (signed-URL
  HMAC), `transform.ts` (sharp-optional thumbnails), `config.ts`
  (`FileConfigStore`), `MetadataStore.ts` (`_Files` table), `orphanSweep.ts`,
  `FileSubsystem.ts` (composition root, mirrors `BackupSubsystem`).
- `packages/nodegx-backend/src/server/files.ts` rewritten: upload (validate,
  sniff, hash, driver-backed store, metadata row), serve (original + `?thumb=`,
  ETag/Cache-Control, private-file gating, signed URLs), `GET
  /files/:name/sign`, delete (blob + metadata + cached thumbnails).
- `packages/nodegx-backend/src/server/admin-files.ts` (new): `GET`/`PUT
  /admin/files/config`, `POST /admin/files/sweep`.
- `HttpServer.ts` / `service.ts` / `AdminDashboardRoutes.ts`: wired additively
  (new routes, new subsystem construction/start/stop, new feature flag).
- `_Files` system table, created via `SchemaManager.createTable` exactly like
  every other system collection — gets a real `ACL` column for free.
- Admin dashboard **Files** tab (`src/admin/ui/index.html`): limits, deny
  list, TTL, thumbnail presets (read display), orphan-sweep schedule +
  last-report + run-now (report-only and delete-orphans variants).
- MCP tools (`packages/noodl-mcp/src/tools/backendTools.ts`):
  `get_backend_file_config`, `configure_backend_files`,
  `run_backend_file_sweep`.
- `docs/runtime/BACKEND-FILES.md`.
- `packages/nodegx-backend/package.json`: `sharp` as an **optionalDependency**.

## Decisions recorded

### Signed-URL TTL — 300 seconds default

Short enough that a leaked URL (referrer header, browser history) is
worthless soon after; long enough that a page load plus a few retried image
requests never race it. `GET /files/:name/sign` mints a fresh one on demand —
the intended usage is "sign right before you render," not "sign once and
persist the URL." This is why `upload()`'s response `url` for a PRIVATE file
is always the plain (unsigned) path, never a pre-signed one: a signed URL
baked into a persisted `CloudFile.url` would silently start failing once it
expired. Configurable per backend (`signedUrlTtlSeconds`).

### Thumbnail presets: named presets public, arbitrary sizes admin-only

Named presets (`sm`/`md`/`lg` by default, backend-configurable) are reachable
by anyone who can read the file (its own coarse `files.read` gate applies);
arbitrary `?thumb=WxH` is admin-only. This is the DoS mitigation the spec
calls for ("Transform endpoint as DoS vector") without needing a rate limiter
in this task (BAK-009's territory) — the attack surface for "resize this to
9999×9999 repeatedly" is closed structurally, not by rate limiting.

### S3 client choice: zero-dependency, hand-rolled SigV4 over `node:https`

**No AWS SDK.** Reasoning, in order:
1. This package ships as ONE esbuild-bundled CommonJS file with no
   `node_modules` resolution at runtime (`scripts/build.js`'s module doc,
   which is WF-003's territory — not edited by this task). The full AWS SDK
   v3 is dozens of packages built for the whole AWS surface; this driver needs
   exactly PUT/GET/DELETE/HEAD/List against ONE S3-compatible endpoint.
2. SigV4 is a short, fully-specified, versioned algorithm — the same shape of
   dependency BAK-007 already decided to hand-roll (`tar`) rather than take a
   package for.
3. Zero new required dependency, zero "worktree doesn't have it installed"
   risk (the exact trap BAK-002 hit with `nodemailer`), zero bundle-size cost.

**Correctness is NOT taken on faith.** `tests/sigv4.test.ts` asserts the
canonical request, string-to-sign, and final `Authorization` header
byte-for-byte against REAL fixtures from AWS's own `aws4_testsuite`
conformance suite (fetched live from
`github.com/saibotsivad/aws-sig-v4-test-suite`, an npm-published mirror of the
suite AWS itself publishes and the SDKs test against) — not a
self-consistency check, not hand-computed hex values from memory. All 4 cases
pass, including a duplicate-query-key ordering edge case.

**Beyond the algorithm, the driver was run against a REAL S3-compatible
service** — MinIO, in Docker, in this sandbox (Docker WAS available here,
unlike the "may not be available" the brief warned about):
```
docker run -d -p 19000:9000 -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data
# bucket created via `mc mb` inside the container
NODEGX_TEST_S3_ENDPOINT=http://127.0.0.1:19000 \
NODEGX_TEST_S3_BUCKET=nodegx-bak006-test \
NODEGX_TEST_S3_ACCESS_KEY=minioadmin NODEGX_TEST_S3_SECRET_KEY=minioadmin \
npx jest tests/storage-driver.test.ts
```
All 7 conformance cases (put/get round-trip, stat, streaming, no-dedupe,
delete-idempotency, listKeys) passed against the real endpoint. The suite is
env-gated and **skips loudly** (a `console.warn` naming the exact env vars)
when the endpoint isn't set, so CI/other sandboxes without Docker still run
green — this run against real MinIO is recorded here rather than claimed
silently. **Not verified against a real (non-MinIO) S3-compatible provider**
beyond MinIO — that spot-check the spec asks for is a residual.

### Storage layout, for BAK-007

Both drivers keep EVERYTHING under one root:
- `LocalDriver`: `<dataDir>/files/blobs/<hh>/<hh>/<hash>-<random>` (git-style
  bucketing). Thumbnail cache is a SEPARATE tree, `<dataDir>/files/thumbs/`,
  deliberately regenerable/disposable — a backup can skip it without losing
  anything (it costs one lazy re-render per thumb on next request).
- `S3Driver`: same key SHAPE inside the bucket (`<hh>/<hh>/<hash>-<random>`),
  no local disk footprint at all beyond the local `_Files` metadata (which
  lives in the main SQLite database, already in BAK-007's snapshot).
- **`_Files` metadata is in the SAME SQLite database** every other collection
  is in — BAK-007's existing DB backup already covers it; no second export
  path was needed for that half.
- For a LOCAL driver, "back up files" = "tar `<dataDir>/files/blobs/`" (skip
  `thumbs/`); for an S3 driver, files are already off-box and a bucket-level
  backup (versioning, replication) is the operator's normal S3 practice.

### Private-upload surface: a header, not a node input (deliberate v1 cut)

The spec's client-surface bullet says existing File nodes "keep working
untouched." Marking an upload private is a NEW capability, so the choice was:
add a `private` boolean input to the shipped **Upload File** node (touching a
runtime node + regenerating the catalog), or expose it as a request header
(`X-NodeGX-File-Private: true`) any authenticated caller (a cloud function's
`fetch`, curl, MCP-driven tooling) can already set today with zero node
changes. Chose the header: it fully unblocks the feature (verified end-to-end
over real HTTP — private upload, owner read, cross-user denial, signed URL,
delete-by-owner-only), keeps the shipped node LITERALLY untouched (not just
behaviorally unchanged), and avoids a catalog-regen touching a file three
concurrent tasks (WF-003, BAK-008) could also be near via `catalog:check`'s
shared `node-catalog.json`. A "Private" checkbox on Upload File (and a small
"Sign File URL" node so app authors don't need a cloud function to refresh a
signed URL) is a clean, scoped follow-up — filed as a residual below, not
because it's hard, but because it's genuinely separable and this worktree
cannot live-verify an editor node change anyway (see environment traps).

### Transactional consistency — the honest shape

Blob store and metadata row are two different systems (filesystem-or-S3, and
SQLite) — there is no cross-system transaction. `upload()` writes the blob
FIRST, then the metadata row; if the row insert throws, the just-written blob
is deleted (best-effort rollback) and the request fails loudly. If the
PROCESS dies between the two steps, the result is a genuine orphan blob — this
is exactly what the orphan sweep exists to find and report. This is not a
claim of atomicity; it is a documented detection net, and the sweep's test
(`files-http.test.ts`) proves the detection half by planting both kinds of
mismatch directly on disk and confirming the sweep finds — and, only when
asked, cleans up — exactly the blob-side one.

### Content-type policy default: deny list empty, allow list unset (allow all)

Matches the spirit of "current behavior, now validated" — a fresh backend
doesn't suddenly reject uploads it used to accept. Operators opt IN to
restriction.

## What was verified, and how

- **`sigv4.ts`** — against real AWS `aws4_testsuite` fixtures (not
  self-consistency). `tests/sigv4.test.ts`, 4/4 green.
- **`S3Driver`** — full conformance suite against a REAL MinIO instance in
  Docker (this sandbox had Docker; command above). 7/7 green. Also driven
  through `FileSubsystem`'s driver-switch path indirectly via the admin config
  test (`rejects an s3 driver config missing endpoint/bucket`); a live
  end-to-end upload/serve THROUGH the HTTP surface with the S3 driver active
  was not additionally run (the conformance suite already exercises the exact
  same driver code the HTTP surface calls) — **residual**: one live
  HTTP-through-S3 pass would remove even that inference step.
- **`sniff.ts`** — `tests/sniff.test.ts`, 9/9, including the literal success
  criterion ("a PDF renamed .png is still detected as a PDF").
- **`signing.ts`** — `tests/signing.test.ts`, 6/6: scoping, tampering, wrong
  secret, real-time expiry (fixed-clock injection, not a sleep).
- **`transform.ts`** — `tests/transform.test.ts`, two halves:
  - Sharp genuinely absent in this worktree (an `optionalDependency`; nothing
    was mocked) — proved the REAL loud-501 path, not a simulated one.
  - A `jest.mock('sharp', ..., { virtual: true })` stands in for a PRESENT
    sharp to prove the surrounding plumbing (format selection, buffer
    propagation) — this tests OUR usage of sharp's API, not sharp's own
    resize correctness, which is out of scope to verify here.
- **End-to-end HTTP** (`tests/files-http.test.ts`, 16/16, real `BackendService`):
  sniffing-over-declared-type, ETag/304, delete idempotency, oversized-upload
  413 (found and fixed a real bug — see below), disallowed-content-type 400,
  empty-upload 400, private-file owner/other-user/anonymous/admin, signed-URL
  mint/use/tamper/replay-on-other-file/real-time-expiry, non-owner-cannot-
  delete, thumbnail 501 (real sharp absence) + reason, unknown-preset 400,
  arbitrary-size admin-gate-before-501, admin config get/put validation,
  orphan sweep report-then-delete-then-confirm-rows-untouched (plants both
  orphan shapes directly on disk).
- **MCP tools** — `packages/noodl-mcp/tests/backendTools.test.ts`, 4 new cases
  against a REAL spawned `dist/cli.js` backend (not a mock): config
  read/write/round-trip, invalid-cron rejection, on-demand sweep.
- **Live curl pass against the built `dist/cli.js`** (BAK-005's precedent):
  rebuilt fresh, confirmed the `sharp` require-indirection produced NO
  `require("sharp")` literal in the bundle (`grep -c` = 0; only
  `require(SHARP_MODULE_NAME)` appears) — proving the esbuild-avoidance trick
  actually works in the real artifact, not just in theory — then ran the
  service and curled: upload-renamed-as-.pdf → sniffed `image/png`, GET with
  correct headers, `?thumb=` → real 501, DELETE → 404 after. All matched the
  jest suite's assertions.
- **Regression**: `npm test` in `nodegx-backend` — **403/403** (396 real +
  7 env-gated-S3, which also ran green with `NODEGX_TEST_S3_ENDPOINT` set).
  `npx tsc --noEmit` clean. `noodl-runtime` **362/362**, unaffected (no
  runtime source touched). `noodl-mcp` **55/55** (4 new). `npm run catalog:check`
  — "Committed catalog is up to date" (no runtime node touched, confirmed
  rather than assumed).
- **A real bug found and fixed along the way**: `readRawBody`'s over-limit
  path calls `req.destroy()` immediately after `reject()`, which kills the
  TCP socket before the caller's 413 response can be written — the client
  sees a connection reset, never the 413 body. WF-005's webhook handler
  already discovered this and works around it (checking the declared
  `Content-Length` BEFORE calling `readRawBody`, per its own comment in
  `HttpServer.ts`). `files.ts`'s `upload()` now does the same upfront check.
  **Not fixed at the root** (`http-util.ts`'s `readRawBody` itself) —
  `http-util.ts` is high-traffic shared code and the two existing call sites
  already work around the same issue independently; changing the shared
  primitive was judged riskier than following the established workaround
  pattern. Flagged here rather than silently worked around.

## Residuals

- **One real (non-MinIO) S3-compatible provider spot-check** — the spec asks
  for "MinIO in CI + one real provider verified"; only MinIO was run (real,
  not simulated — see above). No AWS/other-provider credentials available in
  this sandbox.
- **A live end-to-end upload/serve/delete pass with the S3 driver ACTUALLY
  selected as the backend's active driver** (as opposed to the driver's own
  conformance suite, which already exercises identical code) — a genuinely
  small gap given the conformance suite's coverage, named for completeness.
- **"Private" input on the Upload File node + a "Sign File URL" node** — the
  header-based private-upload surface is fully functional and tested; graph-
  level ergonomics for it are a clean, scoped follow-up (see decision above).
  Needs a live editor session to build/verify (this worktree cannot
  live-verify editor/node changes — `lerna exec` resolves to the MAIN
  checkout, not this worktree; see the parallel-worktree-traps precedent).
- **Dashboard Files tab — not opened in a browser.** Server-side assembly is
  verified (marker/CSP/route tests green, matching BAK-005's own residual
  posture); the rendered UI itself was not visually walked through.
- **Driver-to-driver migration tooling** — explicitly out of scope per the
  spec (documented manual procedure only); not attempted.
- **`readRawBody`'s `req.destroy()`-races-the-response issue is not fixed at
  its root** (`http-util.ts`) — worked around locally in `files.ts`, matching
  the existing webhook workaround. A future pass could fix it once, in
  `http-util.ts`, and delete both workarounds — flagged, not fixed, to keep
  this task's footprint in a high-traffic shared file minimal.
- **Per-file virus scanning, resumable/multipart uploads, video/audio/PDF
  processing** — all explicitly out of scope per the spec; not attempted.
