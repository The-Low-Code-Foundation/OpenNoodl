Continue phase 34 (Track S — One Backend Contract) on branch `cline-dev` in
/Users/richardosborne/vscode_projects/OpenNoodl. Tip when this was written: `9c8fab01`.
The checkout is free. The uba-e2e rig is **already up** (9 containers); local
`nodegx-backend` processes are stopped and you start your own.

## Where things stand

**Tier 1 and Tier 2 are complete.** BCN-001/002/003/003b, and now BCN-005 (relations),
BCN-006 steps 1–4 (auth), BCN-008 (realtime) and BCN-009 step 2 (one active backend) are all
merged and gate-verified. **Tier 3 is what remains, and BCN-010 is the task that decides
whether the phase's claim is true.**

Last session ran four parallel workers and merged all four, plus the orchestrator's own work:

- **BCN-005** — a neutral relation model shaped *around Parse's junction-less `Relation`*, with
  `addRelation`/`removeRelation` on Directus/PostgREST/PocketBase. 55 live checks, 0 failures.
- **BCN-006 step 4** — `RestAuthAdapter`, **the first `performRefresh` this product has ever
  had**. Criterion 4 met on a *genuine* 25-second expiry, not a mocked clock.
- **BCN-008** — four realtime transports on one lifecycle, `SubscribeToChanges` retired onto
  Query Records, and **the restart test closed for the first time**. 99 checks, 0 failures.
- **BCN-009 step 2** — the two-active-backends defect closed, editor *and* runtime halves,
  live-verified through real nodes.
- **BCN-004 step 6** — 101 live checks through the *nodes* across all five backends.

### Gates at `9c8fab01` — use these, the old ones were wrong

| Gate | Number |
|---|---|
| `packages/noodl-runtime` | **89 suites, 1682 passing of 1695**, 0 failures |
| `packages/nodegx-backend-contract` | **169** |
| `packages/noodl-viewer-react` | **373** |
| editor `npm run test:ci` | **1963 specs**, 0 failures |
| `npm run catalog:check` | clean |
| `npm run catalog:merge:check` | clean, 155/155 documented |

⚠️ **The handover before this one said "84/84 suites, 1556 tests" and that conflated two
columns.** One suite (`agent-live-endpoint`) is env-gated and wholly skipped, and 13 tests are
skipped. **0 failures is the bar, not the raw counts.**

⚠️ **PLAT-004 TSFixme ratchet is RED at an inherited `any +26`** — pre-existing, from three
phase-30 viewer test files. Do not re-baseline silently.

### Read these first — they change the tasks

- `PROGRESS.md` — the carried-forward register is now ~30 entries, each pointed at an owner.
  **Read it to the end of the section**; entries added late are the ones that get missed.
- `BCN-004-NOTES-STEP6.md` — the node-level live pass, and the two instrument defects it caught
- `BCN-005-NOTES.md` — six measured wire facts, three of them "wrong answer, not an error"
- `BCN-006-NOTES.md`, `BCN-008-NOTES.md` §8–13, `BCN-009-NOTES-STEP2.md`
- `BCN-007-FILES.md`, `BCN-010-GATING-AND-CATALOG.md` — the two specs this batch executes

## Six findings that shape this batch

1. ⚠️ **Deleting the four `noodl.byob.*` types would remove a working capability.**
   `byob-query-data.ts` has an `apiPathMode` port reaching Directus **system collections**
   (`directus_users` → `/users`); `RestDataAdapter` has **zero** references to `apiPathMode`;
   `record-ports.ts` sets `filterByApiPathMode: false` deliberately. **Closing that gap is
   Worker A's, and it is BCN-010's precondition.** Last session re-scoped the deletion out of
   BCN-004 step 7 rather than creating the silent gap BCN-010 exists to prevent.
2. ⚠️ **`catalog:check` passes while `catalog:merge` fails.** Deleting a node type leaves the
   enrichment layer dangling — an example, a `relatedNodes` reference, the type's own file —
   and the cheap gate does not see it. **Run both after any node deletion.** CI runs
   `catalog:merge:check`.
3. ⚠️ **A capability implemented is not a cell flipped, and vice versa.** BCN-006 shipped
   Directus and PocketBase auth and *flagged its own* Supabase cells as claiming what nothing
   had measured. Four `supabase` auth cells moved to `conditional`. **Do not flip a cell you
   have not measured, and do not leave one claiming what you did not build.**
4. ⚠️ **`Model.get` and `Collection`'s diff key a plain object, so `7` and `'7'` rendezvous on
   one record.** That is correct and it is an *accident* — `WeakRegistry` already uses a `Map`,
   which does not coerce. Converting `models` to a `Map` would silently split every
   integer-keyed record in two. Nine tests object to it; do not "modernise" past them.
5. ⚠️ **`parsePocketbaseSchema` read a field PocketBase renamed in 0.23**, so every collection
   introspected with **zero fields**, silently, for two releases. Fixed. **The existing test is
   why it survived** — it only ever used the old shape, so parser and test agreed with each
   other and with nothing else. Assume the same of any parser whose fixture you did not measure.
6. ⚠️ **BCN-005's authoritative relation parsers have no caller.** They exist and are tested;
   the editor's schema sync never stores their output, so what runs is a strict subset. Exact
   call site in `BCN-005-NOTES.md` §5. **That is Worker D's.**

## Run four workstreams

Launch workers A/B/C/D in worktrees first (recipe below), then do the orchestrator's own work in
the primary **while they run** — worktree edits do not trigger the primary's webpack, so this is
safe concurrently.

**`RestDataAdapter.ts` is the hot file and only Worker A may touch it.** That rule has now
produced zero conflicts across eleven merges. Say so if you re-scope.

**Descriptor rows are owned by whoever implements the capability** — Worker A edits `files.*`,
Worker C edits `auth.*`, nobody else edits either. Worker B owns the gating *machinery*, not the
rows.

### Worker A — BCN-007 files (steps 2–7) + the system-collections gap

- **Owns**: `packages/noodl-runtime/src/api/backends/RestDataAdapter.ts` (**exclusively**),
  `fileRef.ts`, `restSerialize.ts`, `nodes/std-library/data/cloudfilenode.ts`, `signfileurl.ts`,
  `packages/noodl-viewer-react/src/nodes/std-library/uploadfile.ts`, `src/api/files.ts`, and the
  **`files.*` rows** of every descriptor.
- **Must not touch**: auth files (C), the gating machinery or `record-ports.ts`/`schema-ports.ts`
  (B), `packages/noodl-editor/` (D), `wire.ts`.
- Steps 2–7 of `BCN-007-FILES.md`: Directus `/files`, Supabase Storage, PocketBase
  record-attached, the signing-vs-token-URL distinction made visible on the node, per-backend
  deletion semantics as caveats, live pass, cells.
- ⚠️ **Directus `/assets/{id}` 403s unauthenticated**, so the URL an adapter synthesises is a
  broken `<img>` — and 403 also means "never existed", so **deleted and forbidden are
  indistinguishable** on that wire. Measured, in `BCN-004-FILE-FACTS.md`.
- ⚠️ **A saved File-typed record property is `{__type, url, name}`** — `_serializeJSON` drops
  `contentType`/`size`, so the normalised reference stops meaning what the spec assumes **one
  save later**. A test pins this today; decide whether to change the stored format or declare it.
- ⚠️ **PocketBase's file handle is not one string** — (collection, record id, filename) — and
  `FileRef.name` cannot hold it. BCN-007 left this undecided on purpose. **Express it in the
  contract or declare it `degraded`; do not silently approximate it.**
- **Also yours, and it unblocks BCN-010**: `apiPathMode` / Directus **system collections**.
  Either give `RestDataAdapter` the capability BYOB had, or declare it `unsupported` with a
  reason — but decide it, because the four `noodl.byob.*` types cannot be deleted until you do.
- **Ends in a live pass**: upload a real image, **read it back through a rendered `Image` node in
  a running app**, sign a URL where supported and confirm it expires, delete, confirm the read
  then fails.

### Worker B — BCN-010: capability gating & catalog reconciliation

**The task that makes the phase's claim true or false.** Criterion 3 — *"anything a chosen
backend cannot do is visible in the editor, with a sentence saying why, before it is discovered
at runtime"* — is the one that justifies the whole phase.

- **Owns**: `packages/nodegx-backend-contract/src/capabilities.ts` and the gating helpers,
  `packages/noodl-runtime/src/nodes/std-library/data/{schema-ports,record-ports}.ts`, the
  editor's **port-rendering** views, `scripts/node-catalog/`, `docs/node-catalog/`.
- **Must not touch**: `RestDataAdapter.ts` (A), auth files (C),
  `packages/noodl-editor/src/editor/src/models/BackendServices/` (D), and **not the `files.*` or
  `auth.*` descriptor rows** (A and C).
- Steps 1–8 of `BCN-010-GATING-AND-CATALOG.md`: wire the descriptor into port and node rendering
  for all four states with reasons; resolve `conditional` by probe at connect time, cached and
  re-probed on reconnect; relabel the record nodes (leave type names alone); the registry-wide
  duplicate-label test; regenerate the catalog and fix enrichment/examples/validator corpus;
  update MCP and user docs.
- ⚠️ **`CloudStore._handle()` still answers `nodegx` unconditionally**, so a capability gate
  reading it sees a floor rather than the truth. **Do not build the gating on top of it** without
  saying what you did about it.
- ⚠️ **The node deletions are NOT yours to start.** They depend on Worker A closing the
  system-collections gap; the orchestrator lands all four **after** A merges, so `register-nodes`
  and `nodelibraryexport.ts` are touched once. Coordinate rather than racing.
- ⚠️ BCN-003b found the Parse-family visual filter already greys operators from a descriptor
  cell. **Reuse that seam** rather than inventing a second one.
- **Ends in a live pass** in a real editor: a project on Directus showing a capability disabled
  *with its reason*, the same project switched to another backend showing it enabled, and a
  `conditional` cell resolving to disabled after a probe.

### Worker C — BCN-006 remainder (steps 5, 6) + the auth-node picker

- **Owns**: `packages/noodl-runtime/src/api/backends/{ParseAuthAdapter,RestAuthAdapter,TokenLifecycle,SessionStore,AuthEvents}.ts`,
  `packages/noodl-viewer-react/src/nodes/std-library/user/`, `src/api/users.ts`, the **`auth.*`
  rows** of every descriptor, and the auth half of `packages/nodegx-backend/`.
- **Must not touch**: `RestDataAdapter.ts` (A), the gating machinery (B),
  `packages/noodl-editor/` (D).
- **Step 5 (OAuth) is not started. Most of step 6 (schema-driven user ports) is not done.**
- ⚠️ **`emailVerified` is HALF closed and this is the one-line half.** A new sign-up now stores
  `false`; **a pre-existing user still reads `undefined`**, because `nodegx-backend`'s password
  signup never writes the column. It is one line, in your territory now.
- ⚠️ **Supabase auth is gated, not implemented**, and there is **no GoTrue in the rig** — every
  `/auth/v1/*` is a 404 from PostgREST. Either add GoTrue to `docker-compose.yml` and measure it,
  or leave the four `conditional` cells alone and say so. **Do not implement it from
  documentation** — that is the one subsystem where being wrong locks a user out.
- **Also yours — half of BCN-009 step 4**: `user/user.ts` and `user/setuserproperties.ts` have
  **no `backendId` port at all**, so the auth family cannot be pointed at a backend. Give them
  one, using `recordBackendPickerPorts` as the template.
- ⚠️ **`Noodl.Users` is promise-based** (`logIn`, `signUp`, `become`, `on`, `off`, `Current`), not
  the `{success, error}` callback shape `UserService` uses. **Passing callbacks makes every call
  look like it timed out while actually succeeding.**
- **Ends in a live pass in the preview window** — the only way to reach the XHR branch, since
  Node has no `XMLHttpRequest`.

### Worker D — the editor's schema sync

Editor-only by design, so it cannot conflict with the other three.

- **Owns**: `packages/noodl-editor/src/editor/src/models/BackendServices/` and
  `views/panels/BackendServicesPanel/`.
- **Must not touch**: `packages/noodl-runtime/`, `packages/nodegx-backend-contract/`, the editor's
  port-rendering views (B).
- ⚠️ **BCN-005's authoritative relation parsers have no caller.** They parse each backend's real
  relation metadata into the neutral model, they are tested, and **nothing stores their output**,
  so a running app resolves relations from a strict subset of what the backend describes. Exact
  call site in `BCN-005-NOTES.md` §5. **This is the headline.**
- ⚠️ Relation metadata is **admin-only on every REST backend** (Directus 403, PostgREST has no
  endpoint, PocketBase 401). The editor holds admin credentials and a running app does not —
  which is *why* the sync has to store it. Keep the admin key out of anything published.
- `parsePocketbaseSchema` was fixed last session (0.23 renamed `schema` → `fields`). ⚠️ **Check
  the other three parsers the same way**, against a live server rather than their fixtures — the
  PocketBase one passed its own test for two releases while recovering nothing.
- If Worker A gives `RestDataAdapter` system collections, the schema sync is what surfaces them.
  Coordinate through your notes rather than reaching into runtime.
- **Ends in a live pass in a real editor**: sync a Directus schema, confirm an M2M relation is
  stored, reopen the project and confirm it survived.

### Orchestrator (you) — what only the primary can do

- **The four `noodl.byob.*` deletions, after Worker A merges.** All four together, plus their
  registrations in `register-nodes.js` and `nodelibraryexport.ts`, plus the enrichment layer.
  ⚠️ **Run `catalog:check` AND `catalog:merge:check`** — the first passes while the second fails.
- ⚠️ **The Repeater's actual React rendering with a numeric `objectId`.** The data path is proven
  (Model store, `Collection.set` diff, `Record Id` round-trip); **the render is not**, and it
  needs a rendered React tree. This is the last third of the risk the register flagged as the
  likeliest place a real defect is still hiding.
- ⚠️ **An export/deploy of a converged project.** BCN-009's criterion is *"a **deployed** app
  resolves its backend from the unified metadata"*, and every check so far is in-process. Verify
  it in a bundle.
- **Widen `objectId?: string` to `string | number`** on the contract and on
  `CloudStore._fromJSON`, whose declaration still says `string` while the value is a number. It
  recompiles every consumer, which is why it was left — do it when nothing else is in flight.
- Merge A/B/C/D, verify every gate **yourself** rather than trusting the reported numbers, and
  keep `PROGRESS.md` current.

## How to run the parallel workers (this recipe works; use it verbatim)

Do **NOT** use `isolation: "worktree"` — the harness creates every worktree branch from
`origin/main`, which is 900+ commits behind and has no `packages/nodegx-backend-contract` at all.
Build them yourself and launch non-isolated agents pinned to an absolute path:

```bash
P=/Users/richardosborne/vscode_projects/OpenNoodl
W=<your-scratchpad>/wt-<task>
git -C "$P" worktree add -b wt-<task> "$W" cline-dev

mkdir "$W/node_modules"
for e in "$P"/node_modules/*; do n=$(basename "$e"); [ "$n" = "@noodl" ] && continue
  ln -s "$e" "$W/node_modules/$n"; done
for e in "$P"/node_modules/.[!.]*; do [ -e "$e" ] || continue
  ln -s "$e" "$W/node_modules/$(basename "$e")" 2>/dev/null || true; done
# @noodl entries are RELATIVE symlinks (../../packages/...), so recreating them
# in a real dir inside the worktree makes them resolve to the WORKTREE's packages.
mkdir "$W/node_modules/@noodl"
for e in "$P"/node_modules/@noodl/*; do
  ln -s "$(readlink "$e")" "$W/node_modules/@noodl/$(basename "$e")"; done
ln -s "$P/packages/node_modules" "$W/packages/node_modules"
for d in "$P"/packages/*/node_modules; do pkg=$(basename "$(dirname "$d")")
  [ -d "$W/packages/$pkg" ] && ln -s "$d" "$W/packages/$pkg/node_modules"; done
```

Verify before believing any green suite — this is the trap that makes a worktree silently test
the primary's sources:

```bash
node -e "console.log(require.resolve('@noodl/backend-contract',{paths:['$W/packages/noodl-runtime']}))"
# must print a path under $W
```

Put these in every worker prompt:

- *"The primary checkout is off limits for edits. Pass `-C <abs-worktree-path>` to every git
  command."* Include the other workers' owned paths as an explicit do-not-touch list.
- *"Merge `cline-dev` into your branch before you start"* — it moves under them, and their gate
  numbers are meaningless otherwise.
- *"Never run `npm install`"* — `node_modules` is symlinked and it would mutate the primary.
- *"Never edit `PROGRESS.md`"* — reserved for the orchestrator.
- ⚠️ *"`packages/noodl-runtime`'s `npx jest` crashes in `@jest/reporters/getResultHeader`
  (`Cannot find module 'terminal-link'`) and reports a meaningless '1 of 23 total'. It looks
  exactly like a failing suite and is not."* A working reporter is in the scratchpad; invoke it
  as `npx jest --reporters <path> -- <testfile>` — **the `--` matters**, `--reporters=<path>`
  misparses.
- ⚠️ *"Build `noodl-runtime`'s `dist-types` first or four corpus suites will not start and the
  run reads `79/84`, which looks like real breakage."*
- Ask for a `BCN-00X-NOTES.md` with **stale premises**, **deviations with reasoning**, and an
  explicit **"could not verify"** list. That format has now caught a dozen stale premises, four
  wrong contract shapes, several real defects, and three checks that never checked anything.
- **Ask for mutation-testing of every live driver and every new test.** This is the single
  highest-yield instruction in the batch. Last session it caught: two pagination checks that pass
  under a broken implementation; a routing check that stayed green with the feature disabled
  entirely; an XHR shim that manufactured a product defect; a realtime delivery check that passed
  with the pong removed; and one of my own tests that mutated the wrong line and proved nothing.

## The rig

Already up. `cd dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e` if you need to restart it:

```bash
docker compose --profile supabase --profile aggregate up -d   # directus 8055, postgrest 8056, pocketbase 8091
docker compose --profile parse up -d                          # parse server 8092
```

- **Directus** `:8055` — `admin@example.com` / `directus-admin-pw`; `POST /auth/login` returns a
  token that **expires in 15 minutes**, so re-auth inside long runs.
- **PostgREST (as "Supabase")** `:8056` — write grants already applied. ⚠️ **Plain PostgREST**:
  no GoTrue, no Realtime, no Storage. Anything needing those is a rig extension, not a probe.
- **PocketBase** `:8091` — `admin@example.com` / `pocketbase-admin-pw`
- **Parse Server** `:8092` — app id `uba-e2e-app`, master key `uba-e2e-master-key`
- **nodegx-backend** — start your own:
  `node packages/nodegx-backend/bin/nodegx-backend.js serve --port <port> --data-dir <dir>`.
  ⚠️ It mounts the Parse wire at the **root** (`/classes/…`), **not** under `/api`, and serves
  `/api/_schema` rather than `/schemas`.

⚠️ **The rig is shared between workers.** Namespace your fixtures. In use already: `bcn005_*`
collections (Directus), `bcn004n` (Directus/PocketBase/Parse/nodegx), and `articles` rows where
`body LIKE 'bcn004n-%'` (PostgREST). **Never truncate `articles` or `authors`.**

⚠️ **Never pipe a probe into `head`** — it closes the pipe, SIGPIPEs node, and the run dies
partway through looking like the server stopped answering. Redirect to a file.

⚠️ Restarting a container is legitimate (BCN-008's reconnect test does it) but **it will break
another worker's run**. Say so in your notes if you do it.

## Editor / CDP traps

✅ **An editor CAN be driven from a worktree.** `npm run dev:debug` from the worktree compiles the
*worktree's own* sources — CDP reports the worktree's `index.html` and worktree-only specs run.
The `node_modules` symlink affects where *packages* resolve, not where *sources* are read.
⚠️ `BCN-009-NOTES` §6.1 says the opposite and **that stale premise cost one run its entire live
pass**. Two workers have now confirmed it is wrong.

- ✅ Use `--target=editor`. ⚠️ **`--target=dashboard` is stale advice and actively harmful** — it
  is not a known needle, so it falls back to "first page", which is the *preview* window. Use
  `--target=viewer` for the embedded webview on `localhost:8574`.
- ⚠️ **`BaseDialog` renders every dialog TWICE, permanently** — a hidden measuring copy plus the
  real one. Every `[data-test]` inside a dialog matches two elements and `cdp click` uses
  `querySelector`, so it always hits the copy. **Scope with
  `[class*=VisibleDialog] > [class*=ChildContainer] <sel>`.** (The "two React trees across a
  reload" explanation in `BCN-009-LIVE-QA-PARTIAL.md` is wrong.)
- ⚠️ **HMR does not reliably swap a changed component** even while logging "Updated modules" and
  "App is up to date". Relaunch rather than trust it — always after touching node registrations.
- `cdp.js` has no `hover`; a `MenuDialog` tooltip renders through a `<Tooltip>` component, so
  reading the DOM says "no tooltip" and that reading is wrong. Dispatch
  `Input.dispatchMouseEvent` `mouseMoved` to a neutral point, then the element.
- Rail buttons are `[data-test="<panel-id>-panel"]`; panels mount lazily. `cdp type` **appends**
  rather than replaces — use the native value setter plus a bubbling `input` event.
- Launch detached; **never `cdp reload`**.
- ⚠️ **A dev launch rewrites the project it opens**, on open *and* on shutdown. Open a scratch
  project (the launcher's recent list has several outside the repo) or `git checkout` the fixture
  after.
- **Adding a node programmatically is far easier than driving the picker**:
  `NodeGraphNode.fromJSON({id,type,x,y,parameters:{}}, model)` then `model.addRoot(n,{})`. Reach
  webpack with `window.webpackChunknoodl_editor.push([['x'],{},r=>window.__wr=r])`.
- **A node-level headless harness exists** and is often better than an editor:
  `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/bcn-004-node-driver.ts` registers real
  nodes into a real `NodeContext` and drives them through `registerInputIfNeeded`. Copy it rather
  than building a new one.

## Waiting on Richard — do not decide these unilaterally

- **Q3: does the phase ship before or after the alpha?** Tier 3 is what removes the duplicate
  nodes a stranger would see; Tier 1 alone is invisible to users.
- **Q6: do the four maturity levels gate the security disclosure?** BCN-009 shipped "show it
  always" and proposes gating only the `publicToken` finding.
- `BCN-006-LIFECYCLE-DESIGN.md` §9 — six token-lifecycle decisions flagged rather than absorbed.
- `IconName.QuestionFree` on the disclosure reads as "help, click me" rather than "here is a
  fact" — one line, his call.
- **Whether `cloudservices` and `backendServices` should finally merge into one config key.**
  BCN-009 step 2 converged the *selection* and deliberately left the *configuration* split, with
  an eight-site argument for why (the exporter, the deploy build context, the project merger and
  its version-control UI). Judge it on its own merits now that the defect it was meant to fix is
  closed without it.

## Housekeeping / known state

- **Another session commits to `cline-dev`** (a phase-33 `alpha-006` docs commit landed mid-run
  last time). **Commit with explicit pathspecs**, never `git add -A` from the root.
- Do not touch `dev-docs/tasks/phase-31-readiness-and-operations/{PROGRESS,README}.md` or
  `OPS-010-LAUNCH-GUIDANCE.md` — uncommitted work from a paused session.
- Branches `wt-bcn005`/`wt-bcn006`/`wt-bcn008`/`wt-bcn009` are merged; their worktrees are
  removed. `git worktree list` should show only the primary plus `.claude/worktrees/agent-*`
  leftovers. `git worktree prune` if any `wt-*` survive.
- Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…`
  import, so `tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has one
  pre-existing failing test. The root `tsc` has 18 pre-existing `Cannot find module
  '@noodl-versioning'` errors. `tests/ai/plan-doc-writer.test.ts:35` is a bare 30ms sleep
  standing in for an async filesystem write.
- The editor Jasmine flake is **closed** — `35c6f3db` fixed the instrument. Do not re-litigate.

## One judgement call worth flagging

I put **BCN-007's files work and the Directus system-collections gap in the same worker**, because
both live in `RestDataAdapter.ts` and splitting them would put two workers in the hot file — the
one thing the territory rule exists to prevent. The cost is that BCN-010's node deletions depend
on Worker A finishing, so the orchestrator lands them after A merges rather than Worker B taking
them. If you would rather BCN-010 be self-contained, move system collections into Worker B's brief
and give Worker A files only — but then **B owns `RestDataAdapter.ts` and A must not touch it**,
and BCN-007 steps 2–3 become much harder to land.
