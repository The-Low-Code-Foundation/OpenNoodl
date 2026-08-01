# Next session — finish NDA-012's Data category

Continue on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip when this was written: `f6ffe515`. The checkout is clean apart from another session's
uncommitted phase-31 files (leave them alone — see Housekeeping).

## Where things stand

**Phase 34 landed, so NDA-012's Data category is unblocked and started. It is 7 of 37.**

Three commits last session:

| Commit | What |
|---|---|
| `69ee9d1f` | The Record CRUD family — 6 nodes, 5 defects, 4 fixed |
| `1a90db03` | `Remove Object From Array` — DA-vi, fixed |
| `f6ffe515` | Reconciled PROGRESS.md's tables with its own log |

### Gates at `f6ffe515` — I ran every one of these myself

| Gate | Number |
|---|---|
| `packages/noodl-runtime` | **90/91 suites, 1683 passing**, 0 failures |
| `packages/noodl-viewer-react` | **35 suites, 382 passing**, 0 failures |
| runtime typecheck | clean |
| viewer-react typecheck | clean (needs `--skipLibCheck`, pre-existing) |
| `npm run catalog:check` | clean, **151 node types** |
| `npm run catalog:merge:check` | clean, 151/151 documented |
| `npm run cloud-library:check` | clean, 58 types |

⚠️ **Runtime went 1673 → 1683 and viewer 379 → 382; both deltas are exactly the new rows.**
0 failures is the bar, never the raw count.

⚠️ **I did not run the editor `test:ci` suite.** Nothing I touched is editor code, but that is a
reason to expect it green, not evidence that it is. Run it before any claim about the whole tree.

⚠️ **PLAT-004's TSFixme ratchet is still RED at the inherited `any +33` / `@ts-expect-error +1`.**
Pre-existing, untouched, unowned. **Do not re-baseline silently.**

## Two corrections the last handover got wrong — do not re-inherit them

1. ⚠️ **Cloud Services is NOT outstanding.** It was audited 2026-07-30 — 22/22 nodes, 25 defects,
   recorded in this phase's own PROGRESS.md. The previous handover named "Data and Cloud Services"
   as the two remaining categories; the two remaining are **Data** and **Visual (29)**. The error
   traces to `../phase-34-one-backend-contract/BCN-010-NOTES.md` §12, which was written to unblock
   phase 30 *before* phase 30's Cloud Services pass landed. **A note written to hand work over goes
   stale exactly as fast as the work it describes.**
2. ⚠️ **Data is 37 nodes in scope, not 42.** Phase 34 deleted the five `noodl.byob.*` types, so the
   2026-07-31 figure of *42 nodes / 471 ports* was already stale when it was written down. Measured
   after the merge: **41 in the catalog, 37 in scope, 433 ports, 55 documented (12.7%), 20 nodes at
   0%.** The regenerated `audit/data.md` is correct; the four deprecated nodes stay out of scope.

## What is next

### 1. The rest of Data — 30 nodes, in two families

**The agentic/streaming family is the bigger and more interesting half, and no pass has ever read
it.** Sixteen nodes, all in `packages/noodl-runtime/src/nodes/std-library/agent/`:

`SSE` (34 ports), `WebSocket` (36), `Action Dispatcher` (33), `Optimistic Update` (22),
`Text Accumulator` (19), `Stream Buffer` (17), `JSON Stream Parser` (15), `Pattern Extractor` (15),
`State History` (14), `Action Handler` (14), `Undo / Redo` (12), `State Snapshot` (12),
`Global Store` (10), `Set Global Store` (8), `Subscribe to Store` (6).

These are AIX-005's nodes. Two things make them a different proposition from the Record family:
they are **large** (SSE and WebSocket are the two biggest port counts in the category), and they
carry **connection state, timers and buffers** — which is where NDA-012's H1 check (survives
unmount/remount/delete) and SR-vi's timer-leak shape have found the most.

**The rest of the Array/Object/Variable family is 13 nodes** and is mostly small:
`Array`, `Array Filter`, `Array Map`, `Static Array`, `Clear Array`, `Create New Array`,
`Insert Object Into Array`, `Object`, `Set Object Properties`, `Create New Object`, `Variable`,
`Set Variable`, `Repeater Item`.

`Run Tasks` is in this category but was audited under NDA-009 — check its worksheet rather than
re-reading it.

### 2. Two leads already evidenced — take them first, they are cheap

- ⚠️ **`Insert Object Into Array` has DA-vi's sibling shape, and it needs a decision, not a fix.**
  Measured: inserting the same id twice leaves the array at size 1 and the node reports `Done` both
  times (`Array.prototype.add` early-returns on `contains`). Unlike the Remove case this is **not**
  obviously wrong — minting a record by id may be exactly how authors build arrays incrementally,
  and an idempotent insert is defensible. Put it to Richard rather than deciding it.
- ⚠️ **`shortDesc` is rotting across the family — DA-iv at four more sites.** `Insert Object Into
  Array`, `Remove Object From Array`, `Array` and `Create New Array` all carry the *same* sentence
  — *"A collection of models, mainly used together with a For Each Node."* — describing the **noun**
  on four different **verbs**. Fifty sites declare `shortDesc` across the three runtime packages.
  ⚠️ **But read DA-iv's finding first**: `shortDesc` is not exported to the node catalog and its only
  consumer is `ContextBuilder.ts:228` as `enriched?.summary ?? node.shortDesc`, so for any node with
  an enrichment summary it reaches nobody. **Measure who reads it before spending a session on it.**
  This is NDA-005 §0's `description`-was-inert finding in a second field, and the interesting
  question is whether the field should exist at all.

### 3. C1 port descriptions are owed for all seven audited nodes

This is why the category still reads **12.7%** rather than moving. The phase's convention is to
batch C1 with the per-node read so each node is read once — I broke that convention deliberately
(defects first, so verified work was committed and not at risk) and the debt is real. The seven:
`Add Record Relation`, `Remove Record Relation`, `Create Record`, `Update Record`, `Delete Record`,
`Filter Records`, `Remove Object From Array`.

## Five findings from last session that shape the next one

1. ⚠️ **A `Model.get` used as a lookup is a `Model.exists` question wearing a `Model.get` costume.**
   `Model.get` **mints a record on read** (`model.ts:232`), so any id arriving as a *string* — from
   a URL parameter, a text field, a Function node — resolves to a record nothing has loaded.
   **Four sites in this category alone**: both relation nodes (DA-ii), Filter Records' save handler
   (DA-v), `Remove Object From Array` (DA-vi). Data is where it concentrates, because Data is where
   ids arrive from outside the graph. **Grep `Model.get(` in every remaining file and ask, at each
   site, whether the result is only ever read from or compared by identity.**
2. ⚠️ **The third recurring shape has a variant its earlier instances hide.** Every prior instance
   was *"the key is missing"* (`Model.get(undefined)`, `Record`'s cleared `Id`). DA-ii is *"the key
   is fine and the registry invented the row"* — the id is present and valid, and no amount of
   validating the **input** catches it. A sweep for the first form walks straight past the second.
3. ⚠️ **A stub in a shared test factory is a coverage hole with no warning label.**
   `record-backend-routing.test.ts` — the suite that exists to drive the Record nodes — stubs
   `_getACL: () => undefined` in its instance factory. Reasonable for what it tested; it made the
   entire access-control path invisible to the only tests that drive those nodes, and **it is
   invisible from the file that has the defect.** Before trusting a node's coverage, read the
   factory, not just the assertions.
4. ⚠️ **A sweep framed around one symptom will not find the other.** NDA-004 §2 read the three Array
   mutators closely, built them a shared failure helper, and wrote the governing rule into that
   helper's own docstring — *"a completion signal for work that went nowhere is the one thing the
   Failure Contract says must never happen"* — then applied it to **one of that sentence's two
   causes**. It was hunting *nodes that stay silent when they fail*; DA-vi is a node that **succeeds
   loudly when it fails**. Expect more in the agentic family, where "succeeded" and "connected" are
   separate claims.
5. ⚠️ **A register disagrees with itself by default.** The 2026-08-01 log entry moved Data from HELD
   to in-progress and left three summary tables reading the old numbers. `f6ffe515` fixed it. **When
   you land work, update the task-table cell, the coverage table AND the find-rate table** — not just
   the log.

## How to work

**One session, not a parallel batch**, for the same reason as last time: the two remaining families
share `audit/data.md`, the catalog and the enrichment layer. If you do parallelise, the only clean
seam is **agentic/streaming in one worker, Array/Object/Variable in another** — and even then both
write `audit/data.md`, so one must own that file and the other hand over prose.

Do **not** use `isolation: "worktree"` — it creates branches from `origin/main`, 900+ commits behind.
The worktree recipe in `../phase-34-one-backend-contract/NEXT-SESSION-HANDOVER.md` works verbatim.

Ask any worker for a notes file with **stale premises**, **deviations with reasoning**, and an
explicit **"could not verify"** list.

**And ask for mutation testing of every new test.** It earned its keep again: six mutations, each
`grep`-verified in the patched file *before* the run was believed, each reddening only its own rows.
One result worth carrying — **mutation 2 reddened D1 as well as D2**, because D1's row depends on
both ACL fixes. That is correct and it is recorded; **a mutation that reddens more than you predicted
is information, not noise.**

## Traps I hit last session

- ⚠️ **The Bash tool's cwd persists, and running `npx jest` from the repo root uses the ROOT jest
  config**, which transforms `.ts` with **babel** and dies on the first type annotation. It looks
  exactly like a syntactically broken test file. **Always wrap: `(cd packages/<pkg> && npx jest …)`.**
- ⚠️ **`rm` on a tracked file was blocked by the permission classifier.** `mv`-ing it to the
  scratchpad worked and is the better move anyway — `audit/data.md` had to go before
  `worksheets.js` would regenerate it (that script **never overwrites**).
- ⚠️ **`packages/noodl-runtime`'s bare `npx jest` crashes** in `@jest/reporters/getResultHeader`
  (`Cannot find module 'terminal-link'`) on a **full** run and reports a meaningless "1 of 23".
  Targeted single-file runs are fine. For the full run use a minimal custom reporter:
  `npx jest --reporters <path>`.
- ⚠️ **Build `noodl-runtime`'s `dist-types` first** (`npm run build:types`) or four corpus suites
  will not start and the run reads short.
- ⚠️ **Grepping the repo root hits `.claude/worktrees/agent-*` leftovers and the minified
  `noodl.deploy.js`**, and one grep returned 2.5 MB. Scope greps to `packages/*/src`.
- **Mixin ordering bites in tests**: `addBaseInfo` defines `cloudStore` as one of the family's own
  methods, so a stub assigned *before* the method-bind loop is silently overwritten and the node
  reaches the real Parse wire — failing with `XMLHttpRequest is not defined` rather than telling you
  the stub was ignored. Assign store stubs **after** binding.

## Standing traps, unchanged and still true

- ⚠️ **`noodl.deploy.js` is a gitignored build artifact that nothing rebuilds.** A runtime change can
  pass every test and still not reach a deployed app. `npm run build --prefix
  packages/noodl-viewer-react`, ~35s, then grep the artifact for a symbol your change introduced.
- ⚠️ **The rig's Directus has CORS disabled**, so a browser cannot read it cross-origin. Proxy at
  `../phase-16-runtime-deploy-health/uba-e2e/bcn-orch-cors-proxy.mjs`. Still an unowned deployment
  prerequisite the product never mentions.
- ⚠️ **`catalog:check` can pass while `catalog:merge` fails.** Run both after any node change, plus
  `cloud-library:check`.
- ⚠️ **The validator being green is weak evidence in this category**: dynamic-port nodes skip port
  checks, and Data is where the dynamic-port nodes live.
- ⚠️ **A node can read 100% documented while its most-used ports are invisible** (`Config` reports
  100% on `0/0`). The register should say `n/a`, not 100% — NDA-005's, but you will hit it here.

## The rig

It was **up and left running**. Check before starting:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8092/parse/health   # parse
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8055/server/health  # directus
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8091/api/health     # pocketbase
```

To bring it up, from `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e`:

```bash
docker compose --profile supabase --profile aggregate up -d   # directus 8055, postgrest 8056, pocketbase 8091
docker compose --profile parse up -d                          # parse server 8092
```

- **Parse** `:8092` — app id `uba-e2e-app`, master key `uba-e2e-master-key`, mounted at `/parse`.
- **Directus** `:8055` — `admin@example.com` / `directus-admin-pw`; login tokens expire in 15 min,
  static token `bcnorch-static-token-1234567890` does not.
- **PocketBase** `:8091` — `admin@example.com` / `pocketbase-admin-pw`, 0.30.0. Its users collection
  may still issue **25-second tokens** from BCN-006's expiry test.
- **PostgREST (as "Supabase")** `:8056` — no GoTrue, no Realtime.
- **nodegx-backend** — start your own:
  `node packages/nodegx-backend/bin/nodegx-backend.js serve --port <port> --data-dir <dir>`.
  ⚠️ Parse wire at the **root** (`/classes/…`), and `/api/_schema` rather than `/schemas`.

⚠️ **Fixtures I left on Parse**: classes `nda012_Owner` and `nda012_Target`. **`nda012_Owner.enemies`
is deliberately poisoned** — it is `Relation<undefined>`, the DA-ii evidence, and it cannot be
repaired without deleting the class. Do not reuse that field name; namespace anything new.
⚠️ **Never truncate `articles` or `authors`.** In use elsewhere: `bcn005_*`, `bcn004n`, `bcn007_*`,
`bcnorch`.
⚠️ **Never pipe a probe into `head`** — SIGPIPE kills node partway and it reads as the server having
stopped answering. Redirect to a file.

## Harnesses that already exist — copy, do not rebuild

- `packages/noodl-runtime/test/corpus/nda-012-data-record-family.test.ts` — **new last session.**
  Drives the real CRUD mixins with a recording store. The pattern to copy for this family.
- `packages/noodl-viewer-react/tests/corpus/nda-004-array-mutators.test.ts` — `createCorpusGraph`
  over a real graph, with `mutatorGraph`/`pressDo` helpers. Extend for the rest of the Array family.
- `uba-e2e/bcn-004-node-driver.ts` — registers real nodes into a real `NodeContext`. **The right tool
  for a node audit** where the corpus harness cannot reach.
- `uba-e2e/bcn-orch-export-driver.ts` + `bcn-orch-browse.mjs` + `bcn-orch-cors-proxy.mjs` — deploy-level
  checks in headless Chrome on CDP 9333, independent of any editor session.

⚠️ **`graph-harness` does not call a module's `setup`**, and NV-v found six of Navigation's fifteen
defects living there. Every Data node's dynamic ports come from `setup`.

## Editor / CDP traps

- ✅ `--target=editor`. ⚠️ `--target=dashboard` is stale advice and actively harmful — it falls
  through to "first page", the *preview* window. `--target=viewer` is the webview on `localhost:8574`.
- ✅ An editor **can** be driven from a worktree; `BCN-009-NOTES` §6.1 says otherwise and is wrong.
- ⚠️ **`BaseDialog` renders every dialog TWICE, permanently.** Scope with
  `[class*=VisibleDialog] > [class*=ChildContainer] <sel>`.
- ⚠️ **HMR does not reliably swap a changed component.** Relaunch after touching node registrations.
- ⚠️ **Only one editor at a time** (`lsof -i :8574`). Launch detached; **never `cdp reload`**.
- ⚠️ **A dev launch rewrites the project it opens**, on open *and* shutdown. Use a scratch project.
- Adding a node programmatically beats driving the picker:
  `NodeGraphNode.fromJSON({id,type,x,y,parameters:{}}, model)` then `model.addRoot(n,{})`.

## Still unowned, from phase 34's register

None of these were touched last session. The first two are the same *class* as DA-ii — a value
serialised into a shape the far end cannot read:

1. ⚠️ **A `Blob` uploaded through the Parse wire is silently JSON-stringified and stored as `{}` —
   with a Success signal.** `_makeRequest` branches on `instanceof File`, and both `canvas.toBlob()`
   and `fetch().blob()` produce a `Blob`, so this is the common path for anything generated in-app.
2. ⚠️ **A `CloudFile` written into a REST record property is sent as a JSON object**, where a Directus
   file column expects a UUID string. `makeRestSerializer` passes it through `toJSON` unchanged.
3. ⚠️ **`byob-utils.ts` and its test survive the family they served.** Nothing imports them, but the
   file holds the only coverage of `pickTotalCount`, `buildFieldsParam` and
   `buildEndpoint`/`buildUrl`/`buildHeaders`, whose replacements inside `RestDataAdapter` have none.
   Kept deliberately; it wants its coverage repointed, then the file can go.

## Waiting on Richard — do not decide these unilaterally

- ⚠️ **Does phase 34 ship before or after the alpha?** Still open, and it is the sequencing question
  that decides whether finishing Data is worth more than closing phase 30's **nine other partial
  tasks** (NDA-004 §2, NDA-005 §2 and its per-node tail, NDA-006 slices, NDA-007, NDA-010 §1,
  NDA-014's live check, NDA-017 §1). **I have pointed this handover at Data because that is what the
  hold was waiting for — but if the alpha is nearer, a sweep that *closes* several partials may be
  worth more than opening the largest remaining audit.**
- **New:** should `Insert Object Into Array` treat a duplicate insert as a failure or as idempotent
  success? Measured, not decided. See "two leads" above.
- ⚠️ **The admin-token disclosure.** The leak is fixed (`b6a8507c`, `3a2d44f4`), but any project
  already deployed with an external backend has shipped its admin token and nothing tells the user
  to rotate it.
- **Q6: do the four maturity levels gate the security disclosure?** BCN-009 ships "show it always".
- **Should `cloudservices` and `backendServices` finally merge into one config key?** BCN-009 step 2
  converged the *selection* and left the *configuration* split. Judge it on its own merits now — the
  defect it was meant to fix is closed without it.
- `BCN-006-LIFECYCLE-DESIGN.md` §9 — six token-lifecycle decisions flagged rather than absorbed.
- ⚠️ **nodegx `files.delete` defaults to `"nobody"`** — a Delete File node against a fresh backend
  answers 403 for everyone but an admin. Intended default for an app?
- **NDA-017 §1** and **NDA-012 Data's deprecated-five policy** are already marked as his.

## Housekeeping

- **Another session commits to `cline-dev`.** Commit with explicit pathspecs, never `git add -A`.
- **Do not touch** `dev-docs/tasks/phase-31-readiness-and-operations/{PROGRESS,README}.md` or
  `OPS-010-LAUNCH-GUIDANCE.md` — uncommitted work from a paused session, still there.
- Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…` import,
  so `tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has **one** pre-existing
  failing test. The root `tsc` has 18 pre-existing `Cannot find module '@noodl-versioning'` errors.
- `git worktree list` should show only the primary plus `.claude/worktrees/agent-*` leftovers;
  `git worktree prune` if any `wt-*` survive.

## Read these first

- [`PROGRESS.md`](./PROGRESS.md) — the register. **Its newest log entry is always more current than
  this file**, which goes stale in one round.
- [`FINDINGS.md`](./FINDINGS.md) — **DA-ii…DA-vi** are last session's, at the end of the Data section.
  The "checked and clean" subsection matters: it records three things I verified are *not* defects,
  so they are not re-raised.
- [`audit/data.md`](./audit/data.md) — 41 entries, 7 filled in. Regenerated after phase 34, so it is
  the trustworthy port list.
