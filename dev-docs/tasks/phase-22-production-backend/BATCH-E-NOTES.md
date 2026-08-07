# Batch E — phase 22 scoped follow-ups

Agent E, relaunched worktree (`batch-e-backend`, branched correctly from
`cline-dev` at `ed04fc16`). Covers the three "smaller, scoped follow-ups" from
`PROGRESS.md`'s "Open items at phase close" §4, in priority order. Items 1 and
2 are shipped and verified; item 3 is a recorded design decision, not code —
see its section for why.

Commits on `batch-e-backend`:
- `9ab9cf36` — item 1 (BAK-009 CLI audit rows)
- `cb651e08` — item 2 (BAK-006 Private input + Sign File URL node)
- item 3 — this file only, no code

---

## 1. CLI-driven backup/restore now writes an `_Audit` row (BAK-009)

### What changed

The HTTP admin routes get their `_Audit` row for free from
`HttpServer`'s request dispatcher: it stamps one for every privileged
route, keyed by `method+pattern`, entirely inside the request lifecycle
(`recordAudit` in `HttpServer.ts`). `nodegx-backend backup`/`restore`
(CLI) never builds an HTTP request, so it never reached that dispatcher —
it produced a `WF-006` execution record but nothing in `_Audit`.

Fixed at the seam both entry points already share — `BackupManager`,
not a second insert bolted onto `cli.ts`:

- `BackupManagerDeps` gained an optional `openAudit?: (dataDir: string) =>
  Promise<{ audit: AuditLog; close: () => Promise<void> }>`.
  `createBackup`/`restore` call it (via a new private `recordAudit`) after
  the operation completes, on both the success and failure paths.
- It is a **factory**, not a pre-opened `AuditLog`, and it is called
  **after** the operation finishes, not before or during. This matters
  specifically for `restore`: it replaces the live db file out from under
  any connection already open against it (WAL/SHM removed, a new file
  renamed into place). A connection opened before that swap and reused
  afterward would silently write into the discarded pre-restore file —
  the row would exist but never be reachable on disk. Opening fresh,
  once the swap is done, is what makes the row land in the database that
  actually exists post-restore.
- Only the CLI's `BackupManager` instance (`cliBackupManager` in
  `cli.ts`) is constructed with `openAudit` set. The HTTP-serving
  instance (`service.ts` → `BackupSubsystem`) is untouched, so nothing
  double-records for `POST /admin/backups` / `POST /admin/backups/restore`
  — those keep getting their row from the existing dispatcher path exactly
  as before.
- `cli.ts`'s `openCliAuditLog(dataDir, allowEphemeral)` opens a facade,
  calls `ensureAuditTable` (a CLI-only data dir may never have gone
  through `service.ts`'s `ensureSystemTables`), builds an `AuditLog`
  against the same `ops.json`-backed config (`OpsState`) the service uses
  — so a backend's `audit.enabled`/`retentionDays` settings are honoured
  by CLI-driven actions too — and hands back `{ audit, close }`.
  `runBackup`/`runRestore` pass `actor: { actorKind: 'cli', actor:
  os.userInfo().username, ip: 'cli' }` (`cliActor()`); `ip: 'cli'` rather
  than `'127.0.0.1'` deliberately, so a reader of the trail can tell this
  wasn't a network client at all.
- `schema apply`'s internal pre-destructive backup (via the same
  `cliBackupManager`-built manager) gets an audit row too, with the
  default `actorKind: 'cli'` fallback in `recordAudit` — no special-casing
  needed since it goes through the same `createBackup` call.

### Files

- `packages/nodegx-backend/src/backup/BackupManager.ts`
- `packages/nodegx-backend/src/cli.ts`
- `packages/nodegx-backend/tests/cli-backup-audit.test.ts` (new)

### Verified, and how

- New in-process test drives `main()` from `src/cli.ts` directly (`import {
  main } from '../src/cli'`), **not** a spawned child process — a spawned
  CLI test grades `dist/`, which would pass or fail independently of this
  source change. Three cases: `backup` writes a `backup.create` row
  (`actorKind: 'cli'`, `outcome: 'success'`); `restore` writes a
  `backup.restore` row and — the specific hazard above — a **fresh**
  connection opened after the test reads the row back confirms the
  restored `Widget` row survived, proving the audit write landed in the
  post-restore database, not a stale one; a restore against a
  nonexistent archive still records a `failure` row rather than nothing.
- **Proved the tests fail without the fix**: `git stash push` on
  `BackupManager.ts` + `cli.ts` (keeping the new test file), reran — all
  three assertions failed for the expected reason (`openAudit` never
  called, so no `_Audit` table/rows exist at all). `git stash pop`
  restored the fix; reran green.
- Full `nodegx-backend` suite: **62 suites / 622 passed / 10 skipped**
  (pre-existing skips), `tsc -p tsconfig.json --noEmit` clean.

### Deviations / judgment calls

- The audit write is **not awaited by the CLI's exit path explicitly** —
  `recordAudit` is awaited inside `createBackup`/`restore` themselves
  (so the promise IS resolved before those methods return), which is
  what actually matters; there's no separate fire-and-forget risk here
  unlike the HTTP dispatcher's `void this.auditLog.record(...)`.
- `schema apply`'s CLI path was brought along (same shared manager
  construction) even though the task named "backup/restore" specifically
  — it was free once `cliBackupManager` had `openAudit` wired, and leaving
  it out would have been an inconsistency (one CLI-privileged path
  audited, a sibling one silently not) with no corresponding safety
  benefit.
- `export`/`import` (CLI) remain unaudited. Over HTTP, `POST
  /admin/import/:collection` is a declared action (`data.import`) but
  `export` is a GET (not audited by the `requiresAuditAction` rule: only
  mutations are audited). Wiring CLI `import` the same way as
  backup/restore would be a small, mechanical follow-up in the same
  shape — not done here because it was outside the item's literal scope
  and the effort was spent on the two named entry points plus their
  correctness (the restore-timing hazard) instead.

### Not verified

- No live/packaged-binary run of `nodegx-backend backup`/`restore`
  against a real deployed data dir — only the in-process `main()` test
  and the existing jest suites.

---

## 2. Private input on Upload File + a Sign File URL node (BAK-006)

### What changed

The header-based private-upload surface (`X-NodeGX-File-Private: true`)
has worked over raw HTTP since BAK-006 shipped; this closes the
ergonomics gap BAK-006-NOTES named explicitly, without touching any of
the storage/signing/ACL logic underneath (SigV4, `_Files` ACL reuse, the
signed-URL HMAC — all reused verbatim, per the task's instruction not to
reimplement).

- **`CloudStore.uploadFile`** (`packages/noodl-runtime/src/api/cloudstore.js`)
  now accepts a `private` option and sends
  `X-NodeGX-File-Private: true` when set. Both branches of `_makeRequest`
  — the browser/XHR path a viewer runs under, and the cloud-runtime/fetch
  path a cloud function runs under — merge in an `options.headers` bag;
  every other existing caller passes no `headers`, so the merge is a
  no-op for them (`Object.assign({...fixed}, {} )`), and this is a
  behaviour-preserving change everywhere except the one new caller.
- **`CloudStore.signFileUrl({ name, success, error })`** — new method,
  hits `GET /files/:name/sign` (BAK-006's existing endpoint). No new
  signing logic; it is a thin wrapper over `_makeRequest`, identical in
  shape to `uploadFile`/`deleteFile`.
- **Upload File** (`packages/noodl-viewer-react/src/nodes/std-library/uploadfile.ts`)
  gets a `private` boolean input (group General, default `false`),
  threaded straight into `CloudStore.instance.uploadFile({ ..., private:
  this._internal.private })`. The node's shipped shape is otherwise
  unchanged — no existing input, output, or behaviour was touched.
- **Sign File URL** — new node,
  `packages/noodl-runtime/src/nodes/std-library/data/signfileurl.ts`,
  registered in `noodl-runtime.ts` right after `cloudfilenode` (the
  existing "Cloud File" node it sits beside conceptually). Takes a
  `cloudfile`-typed `file` input and a `sign` signal; outputs
  `url`/`expiresAt`/`ttlSeconds` on success or `error`/`errorStatus` on
  failure (`failure` signal) — the exact same error shape Upload File
  already uses (`err.hasOwnProperty('error')` to distinguish a plain
  string from a `CloudStore` error object), so an app author who already
  knows Upload File's error pattern already knows this one.
- Placed in `noodl-runtime` (not `noodl-viewer-react`, where Upload File
  lives) because, like Cloud File, it needs no browser-only API (no
  `File` object, no XHR upload-progress) — `_makeRequest`'s dual
  XHR/fetch shape already works from either a browser viewer or a cloud
  function.

### The node-picker + catalog trail

Adding a node/port means the generated catalog (`packages/noodl-types/src/node-catalog.json[.d.ts]`)
goes stale, and — since the new node is `inNodePicker: true` — so does
the authored enrichment layer (`docs/node-catalog/enrichment/`,
`catalog:merge:check`'s CI gate requires every node be documented, and a
picker-visible node additionally needs an example). All regenerated and
re-authored, not just the generated half:

- `packages/noodl-runtime/src/nodelibraryexport.ts` — added `'Sign File
  URL'` to the "Cloud Data" picker sub-category, right after `'Upload
  File'`. Without this the generator's `inNodePicker` flag comes out
  `false` for the new type (it's driven by the curated picker index, not
  by the node registry itself) — caught by literally reading the
  generated diff before committing it, not assumed.
- `docs/node-catalog/enrichment/sign-file-url.json` (new) and
  `docs/node-catalog/enrichment/upload-file.json` (updated: documents the
  new `private` port, a pattern pairing it with Sign File URL, and an
  anti-pattern for the mistake of binding a private upload's plain `url`
  straight to an `<img>`).
- `docs/node-catalog/examples/cloud-sign-private-file-url.json` (new) —
  a validated v2 graph fragment (Open File Picker → Upload File
  `private: true` → Sign File URL → Image `src`), required because
  `ENRICHMENT.md`'s schema makes `examples` mandatory for any
  non-deprecated, picker-visible node.
- `packages/noodl-types/src/node-catalog.json[.d.ts]` and
  `node-catalog-enriched.json[.d.ts]` regenerated
  (`npm run catalog:generate && npm run catalog:merge`) — 155 node types
  (was 154), still 89 with dynamic ports (both changes are **static**
  port shapes, no `dynamicPorts` regen risk).
- All three CI gates green: `npm run catalog:check`, `npm run
  catalog:examples` (50/50), `npm run catalog:merge:check`
  (155/155 documented).

### The symlink trap this task actually hit

The worktree's `node_modules` is a relative symlink chain that resolves
`@noodl/runtime` to the **primary checkout's** `packages/noodl-runtime`,
not this worktree's — confirmed by tracing it
(`node_modules/@noodl/runtime -> ../../packages/noodl-runtime`, resolved
against the *real* location of that `node_modules`, which is the primary
checkout's root). This is invisible for packages that only import their
own sources by relative path (which is why item 1's `nodegx-backend`
tests worked untouched), but it matters here because this item edits
`noodl-runtime` and is consumed by `noodl-viewer-react` across the
package boundary:

- **TypeScript**: `noodl-viewer-react`'s `tsconfig.json` resolves
  `@noodl/runtime` types via `paths` → `../noodl-runtime/dist-types`
  (PLAT-006's mechanism), which IS relative to this worktree — but
  `dist-types` didn't exist yet here. `npm run build:types` inside
  `packages/noodl-runtime` (this worktree) regenerated it from the
  edited source; `tsc --noEmit` in `noodl-viewer-react` was clean
  afterward. (`dist-types` is gitignored, generated-locally-only, nothing
  to commit.)
- **Jest**, at runtime, does NOT honour those `paths` (no
  `moduleNameMapper` configured) — a test in `noodl-viewer-react` that
  imports `@noodl/runtime/src/api/cloudstore` at test time would silently
  exercise the **primary checkout's stale copy**, proving nothing about
  this edit. Handled by splitting verification instead of fighting the
  resolution:
  - `noodl-runtime`'s own suite (`test/cloudstore-files.test.ts`,
    `test/nodes/signfileurl.test.ts`) imports via **relative paths**
    (`../src/api/cloudstore`), which resolve within this worktree
    regardless of the symlink, and exercises the real wire logic (XHR
    header-setting, the fetch-path header merge, the real `signfileurl.ts`
    node against a `jest.spyOn`'d `CloudStore.instance.signFileUrl`).
  - `noodl-viewer-react`'s new test (`tests/uploadfile.test.ts`)
    `jest.mock`s `@noodl/runtime/src/api/{cloudstore,cloudfile}` instead
    of trying to reach the real implementation — it only needs to prove
    the **node** threads its `private` input through to `CloudStore`
    correctly, which the mock's call-arguments assertion does regardless
    of which copy of `cloudstore.js` the mock would otherwise have shadowed.

### Verified, and how

- `noodl-runtime`: **42 suites / 982 passed / 7 skipped** (pre-existing),
  `tsc --noEmit` clean.
- `noodl-viewer-react`: **8 suites / 62 passed**, `tsc --noEmit -p
  tsconfig.json` clean (after regenerating `dist-types`, see above).
- **Proved all three new test files fail without the fix**: `git stash`
  on the three source files (`cloudstore.js`, `noodl-runtime.ts`,
  `uploadfile.ts`) plus temporarily moving the new `signfileurl.ts` node
  file out of the tree, reran — all new assertions failed (missing
  header, `signFileUrl is not a function`, module-not-found for the new
  node). Restored and reran green.
- `npm run catalog:check` / `catalog:examples` / `catalog:merge:check` —
  all clean, per above.

### Deviations / judgment calls

- **The `readRawBody` 413/socket-destroy trap** (worked around twice per
  BAK-006-NOTES) was considered and left alone: this task's changes are
  entirely on the request/response **shaping** side (a header on upload,
  a new GET endpoint) — nothing here touches body-reading at all, so
  there was no seam to fix it at, and no new instance of the bug was
  introduced.
- Placed Sign File URL in `noodl-runtime` rather than
  `noodl-viewer-react` (unlike Upload File) — a deliberate structural
  choice (see above), not an oversight; flagging it because it means the
  new node and Upload File now live in two different packages despite
  being used together.
- Did not add a `Noodl.Files.sign(...)` JS-API counterpart (the
  `Noodl.Files.upload(...)` surface in
  `packages/noodl-viewer-react/src/api/files.ts` script nodes use) —
  only the node-level ergonomics were asked for; noted as a natural,
  cheap next step if script-node parity is later wanted.

### Not verified

- **No live editor session** authored a graph with either the new
  `private` input or the new node — this worktree cannot live-verify an
  editor/node change (the recorded `lerna exec`-resolves-to-the-main-checkout
  trap). Both compile, register, are in the regenerated catalog, and pass
  their unit-level tests; neither has been dragged onto a canvas.
- No live end-to-end HTTP pass (private upload → sign → fetch the signed
  URL) through a running `nodegx-backend` — BAK-006's own suite already
  covers that path server-side (`files-http.test.ts`); this task's tests
  are node/CloudStore-level, proving the graph-facing plumbing calls the
  right thing, not re-proving the server behaviour BAK-006 already
  proved.

---

## 3. Explicit "link a provider from account settings" (BAK-004) — design decision, not code

Per the task's own instruction: *"If the safe design is not obvious
within budget, write up the options and the risk and STOP. A recorded
decision beats a rushed auth flow."* Having read BAK-004-NOTES.md,
`oauth-routes.ts`, `FlowStore.ts`, and `identities.ts` closely enough to
name the exact seams below, the judgment call is that a correct,
safely-tested implementation of this is a multi-hour auth-flow feature
in its own right (new authenticated endpoint, flow-state changes, a new
identity-linking code path, redirect-target reuse, conflict/replay
tests) — not a same-session addition on top of items 1 and 2. Writing
the design up is the better use of the remaining budget than rushing it.
**No code was written for this item; no BAK-004 file was touched.**

### Why this is hard, precisely

BAK-004 deliberately keeps the session token out of every URL (see
`oauth-routes.ts`'s own module doc, "the token handoff" and "the
flow-binding cookie" sections). An OAuth "link" flow is a **top-level
browser navigation** to the provider and back — there is no way to
attach an `Authorization` header to that navigation the way an
authenticated `fetch` can. So the callback, which is what would actually
write the `_UserIdentity` row, arrives with no idea who is asking unless
something *earlier* told it — and that something cannot be the session
token itself without recreating exactly the URL-credential exposure this
task was careful to avoid everywhere else.

### The design (concrete enough to build from)

1. **A new authenticated, non-navigational endpoint** — e.g. `POST
   /users/me/link-intent` or similar, called by a normal authenticated
   `fetch`/XHR (session token in a header, never a URL — the pattern
   every *other* authenticated call in this backend already uses). It
   validates the caller's session and mints a short-lived, single-use,
   random **link ticket** — the same shape as the existing handoff code
   in `FlowStore.ts` (`randomToken`, short TTL, one-time, server-side
   map), storing `{ userId }` against it. Returns `{ ticket }`.
2. **The client does the top-level navigation** to `/oauth/:provider/start?linkTicket=<ticket>&redirect=...`.
   The ticket is safe to put in a URL for the same reason the existing
   handoff code is: single-use, ~60s TTL, and on its own grants nothing
   (it only resolves to a userId inside THIS server's memory — it is not
   a credential an attacker could replay to get a session).
3. **`/oauth/:provider/start`** redeems the ticket (exists, unexpired,
   unused; mark used immediately — replay-proof) and stores `linkUserId:
   <the resolved userId>` on the `PendingFlow` record
   (`FlowStore.ts`'s existing `state`-keyed map — one new optional field)
   alongside the PKCE verifier/nonce it already carries. Everything else
   about `/start` (the flow-binding cookie, the redirect allow-list via
   `resolveRedirect`) is unchanged and reused as-is.
4. **The callback**, on seeing `pendingFlow.linkUserId` set, does **not**
   call `IdentityStore.resolveSignIn` (the rule 1–5 email-discovery
   machinery) at all — that function has no way to target a specific
   already-known userId, and forcing it to would risk exactly the rule
   4/5 interactions the task says must not change. Instead it calls a
   **new** method, e.g. `IdentityStore.linkToExistingUser(userId,
   identity)`:
   ```ts
   async linkToExistingUser(userId: string, identity: ProviderIdentity): Promise<void> {
     const existing = await this.findBySubject(identity.providerId, identity.subject);
     if (existing && existing.userId !== userId) {
       throw new AuthLinkError('IDENTITY_ALREADY_LINKED',
         `This ${identity.providerId} account is already linked to a different NodeGX account.`);
     }
     await this.writeIdentity(userId, identity, existing);
   }
   ```
   `writeIdentity` is the existing private primitive `resolveSignIn`
   itself bottoms out on — reused, not reimplemented. This path is
   **orthogonal** to rules 1–5 by construction (it targets a userId
   directly; it never looks anything up by email), so **Rule 5's
   revocation behaviour is untouched** — it lives entirely inside
   `resolveSignIn`, which this path never calls.
5. **The redirect back** does not need a new session or a handoff code
   at all — the user is already signed in and stays signed in on their
   existing session. Redirect to the original (allow-listed) `redirect`
   target with a plain `?linked=success` / `?linked=error&reason=...`
   query param, reusing `resolveRedirect`/`withError` from
   `../auth/redirect` exactly as the existing callback does for its own
   error cases.

### Residual risks worth a future implementer reading this twice

- **Ticket replay window**: even single-use, a ticket minted but never
  consumed (user closes the tab) sits in memory until its TTL — same
  bounded-memory shape as `FlowStore`'s existing pending-flow cap, so the
  existing `MAX_PENDING_*`-and-evict pattern should cover it, not a new
  problem.
- **Conflict UX**: what the account-settings UI shows when
  `linkToExistingUser` throws `IDENTITY_ALREADY_LINKED` (the provider
  account is already someone else's) needs a real decision, not just an
  error string — this is the same "account already exists" ambiguity
  rule 2's error message already narrates for ordinary sign-in, so the
  wording precedent exists.
- **Does linking here also need Rule 5's protections?** No — deliberately
  not, and that is the point of routing around `resolveSignIn` entirely:
  the user is explicitly, already authenticated on the account they're
  linking to; there is no email-matching ambiguity for rule 5 to be
  protecting against in the first place. Restated because it is the
  fact this whole task is not allowed to get wrong.
- **MCP/dashboard parity**: BAK-004's three fronts (editor panel, served
  dashboard, MCP tools) would each need this surfaced if built — not
  designed here beyond noting it is the same "three doors, one model"
  shape the rest of BAK-004 already follows.

Recorded 2026-07-28 by agent E (batch-e-backend). No BAK-004 source file
was read for anything beyond confirming the seams named above; nothing
in `auth/`, `server/oauth-routes.ts`, `server/admin-auth.ts`, or the
existing `_UserIdentity`/session model was modified.
