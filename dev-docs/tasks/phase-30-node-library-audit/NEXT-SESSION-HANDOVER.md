# Next session — phase 30's data audit, now that phase 34 has settled the library

Continue on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip when this was written: `7b06384d`. The checkout is clean apart from another session's
uncommitted phase-31 files (leave them alone — see Housekeeping).

## Where things stand

**Phase 34 (Track S — One Backend Contract) is COMPLETE. All ten tasks, all three tiers.**
There is one Record family, one gate that shows a builder what a chosen backend cannot do
and why, and the four `noodl.byob.*` types are gone.

Last session ran four parallel workers and merged all four, plus the orchestrator's own work:

- **BCN-007** — files across four backends. Its live pass found the adapter work would have
  been *perfect and unreachable*: `Upload File` and `Sign File URL` still called
  `CloudStore.instance`.
- **BCN-010** — the gate reaches the user through **one** `resolveGate`, consumed by three
  surfaces that cannot disagree. **Criterion 3 is demonstrated in a real editor**, not asserted.
- **BCN-006 steps 5–6** — OAuth measured against a stub OIDC provider rather than written
  from documentation; Supabase deliberately left gated with the reasoning recorded.
- **BCN-005 schema sync** — the relation parsers finally have a caller.
- **Orchestrator** — the two live checks only the primary could run, one security fix, the
  BYOB deletions, and the `objectId` widening.

### Gates at `7b06384d` — I ran every one of these myself

| Gate | Number |
|---|---|
| `packages/noodl-runtime` | **89/90 suites, 1673 passing of 1686**, 0 failures |
| `packages/nodegx-backend-contract` | **199** |
| `packages/noodl-viewer-react` | **379** |
| `packages/nodegx-backend` | **730** (of 740; 10 skipped) |
| editor `npm run test:ci` | **2000 specs**, 0 failures |
| `npm run catalog:check` | clean, **151 node types** |
| `npm run catalog:merge:check` | clean, 151/151 documented |
| `npm run cloud-library:check` | clean, 58 types |

⚠️ **`cloud-library:check` was RED on `cline-dev` for some time and nobody was running it.**
It is in CI. Regenerating recovered 2 missing node types and ports on 22 nodes, including
BCN-008's realtime outputs. **Add it to whatever gate list you work from.**

⚠️ **The runtime count DROPPED from 1740 and that is correct** — deleting four node types
deleted their tests. 0 failures is the bar, never the raw count.

⚠️ **PLAT-004's TSFixme ratchet is RED at an inherited `any +33` and `@ts-expect-error +1`.**
Pre-existing, from phase-30 viewer test files and BCN-008's transport tests. The previous
handover said `+26`; that was already stale. **Do not re-baseline silently.**

## What is next, and why

**NDA-012's per-node audit is at 15 of 17 categories, 80 of 155 nodes.** The two that remain
are exactly the two phase 30 held back deliberately, waiting for this:

| Category | Nodes | Audit file |
|---|---|---|
| **Data** | 41 | [`audit/data.md`](./audit/data.md) |
| **Cloud Services** | 22 | [`audit/cloud-services.md`](./audit/cloud-services.md) |

BCN-010's notes §12 records exactly what moved under those files, and it matters because
**they are partly hand-written prose that regenerating the catalog did not regenerate**:

- **Two picker labels changed**: `NewDbModelProperties` is now **Create Record** (was Create
  New Record), `SetDbModelProperties` is **Update Record** (was Set Record Properties).
  **Type names are unchanged, all of them.** An audit row keyed on the old *label* needs
  re-reading; a row keyed on the type name does not.
- **"What does this node do" is now a per-backend question.** Every node in
  `NODE_CAPABILITIES` carries a capability binding the editor renders. Read the binding and
  the descriptor cell alongside the ports, or you will document a node as though one answer
  fits six backends.
- **`Upload File` and `Sign File URL` gained ports and dynamic ports** (BCN-007), and their
  enrichment `runtimeBehavior` says which inputs are Supabase-only and which PocketBase-only.
  **An audit that reads the static port list alone will describe inputs that do nothing on
  four of six backends.**

### Read these first

- [`PROGRESS.md`](./PROGRESS.md) — phase 30's own register.
- `../phase-34-one-backend-contract/PROGRESS.md` — **read the carried-forward register to the
  end of the section.** ~40 entries; the ones added late are the ones that get missed. Four
  rows were struck last session because a closure recorded at the top left the original
  standing further down and it read as open.
- `../phase-34-one-backend-contract/BCN-010-NOTES.md` §12 — the unblocking note.
- `../phase-34-one-backend-contract/BCN-ORCH-NOTES.md` — the two traps below, in full.

## Five findings that shape this work

1. ⚠️ **`noodl.deploy.js` is a gitignored build artifact that nothing rebuilds.** A runtime
   change can pass every unit test and every node-driver check and **still not reach a
   deployed app**. Last session this made a non-defect look exactly like the phase's biggest
   defect: three hypotheses were tested and all three were wrong before the artifact's date
   settled it. `npm run build --prefix packages/noodl-viewer-react`, ~35s. **Rebuild before
   any deploy-level claim, then grep the artifact for a symbol your change introduced.**
2. ⚠️ **The rig's Directus has CORS disabled.** Every live check in this phase and phase 34
   — roughly 400 of them — ran in Node, where the same-origin policy does not exist, so none
   could see it. A browser cannot read Directus cross-origin. There is a proxy at
   `../phase-16-runtime-deploy-health/uba-e2e/bcn-orch-cors-proxy.mjs`. **This is a real
   deployment prerequisite nothing in the product mentions**, and a user meets it as *"my app
   works in preview and not deployed"*. Unowned; a candidate for a deploy-docs note.
3. ⚠️ **`catalog:check` passes while `catalog:merge` fails.** Reproduced again last session
   *without anyone hand-editing a catalog*: `catalog:generate` succeeded at 151 types while
   the merge failed on three dangling `relatedNodes`; fixing those, it failed again on an
   *example* demonstrating deleted types. **Run both after any node change, plus
   `cloud-library:check`.**
4. ⚠️ **The validator being green is weak evidence in these two categories specifically.**
   Dynamic-port nodes skip port checks, which is how `cloud-byob-crud` carried a wrong
   `class` parameter for months — and Data and Cloud Services are where the dynamic-port
   nodes live. NDA-005's own §2 found three separate dynamic-port mechanisms with no
   documentation channel; `numberedInputs` writes no metadata entry at all.
5. ⚠️ **A node can read 100% documented while its most-used ports are invisible.** `Config`
   reports 100% on `0/0` static ports; its three real ports are pushed from `setup`. Six
   nodes now do this. **The register should say `n/a`, not 100%** — that is NDA-005's, but
   you will hit it inside the Data pass.

## The other thing worth doing, and it is small

**NDA-012's two categories are the main event.** If you want a second, independent workstream
that cannot collide with it, the phase-34 register has several genuinely unowned items. The
three I would pick, in order:

1. ⚠️ **A `Blob` uploaded through the Parse wire is silently JSON-stringified and stored as
   `{}` — with a Success signal.** `_makeRequest` branches on `instanceof File`, and both
   `canvas.toBlob()` and `fetch().blob()` produce a `Blob`, so this is the common path for
   anything generated in-app. Unowned, `ParseWireAdapter`.
2. ⚠️ **A `CloudFile` written into a REST record property is sent as a JSON object**, where a
   Directus file column expects a UUID string. `makeRestSerializer` passes it through
   `toJSON` unchanged.
3. ⚠️ **`byob-utils.ts` and its test survive the family they served.** Nothing imports them,
   but the file holds the only coverage of `pickTotalCount`, `buildFieldsParam` and
   `buildEndpoint`/`buildUrl`/`buildHeaders`, whose replacements inside `RestDataAdapter`
   have none of their own. **Kept deliberately rather than deleted silently** — it wants its
   coverage repointed at the real homes, and then the file can go.

## How to work

**One session is probably right for this**, not a parallel batch: NDA-012's two categories
share the same audit conventions, the same nodes and the same catalog, so splitting them
across workers puts two agents in `data.md`, the catalog and the enrichment layer at once —
which is the one thing the territory rule exists to prevent. If you do parallelise, the clean
seam is **Data + Cloud Services in one worker, the three unowned defects above in another**,
and even then only the second may touch `packages/noodl-runtime/src/api/`.

If you do run workers, the worktree recipe in
`../phase-34-one-backend-contract/NEXT-SESSION-HANDOVER.md` works verbatim — do **not** use
`isolation: "worktree"`, which creates branches from `origin/main`, 900+ commits behind.

Ask any worker for a notes file with **stale premises**, **deviations with reasoning**, and an
explicit **"could not verify"** list. That format has now caught well over a dozen stale
premises, four wrong contract shapes and several checks that never checked anything.

**And ask for mutation testing of every new test and every live driver.** It is still the
highest-yield instruction available. Last session it caught: an export check that was vacuous
because an explicit `backendId` short-circuits the resolver before the gate it meant to test;
a `relations.length` rule that no test covered at all; and — independently, in two different
workers — **a mutation patch that edited the wrong line, failed to rebuild silently, and let
the harness re-drive an unmutated bundle and report clean.** Assume that failure mode.

## The rig

Bring it up from `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e`:

```bash
docker compose --profile supabase --profile aggregate up -d   # directus 8055, postgrest 8056, pocketbase 8091
docker compose --profile parse up -d                          # parse server 8092
```

- **Directus** `:8055` — `admin@example.com` / `directus-admin-pw`. `POST /auth/login` returns
  a token that **expires in 15 minutes**; there is also a non-expiring static token
  `bcnorch-static-token-1234567890` on the admin user, left from last session.
- **PostgREST (as "Supabase")** `:8056` — plain PostgREST. **No GoTrue, no Realtime.**
  ⚠️ **Supabase Storage IS now in the rig** — BCN-007 added `supabase-storage` to
  `docker-compose.yml`; `JWT_SECRET` is the env var the image actually reads.
- **PocketBase** `:8091` — `admin@example.com` / `pocketbase-admin-pw`, version 0.30.0.
  ⚠️ Its users collection may still be configured to issue **25-second tokens** from BCN-006's
  genuine-expiry test. Check before assuming defaults.
- **Parse Server** `:8092` — app id `uba-e2e-app`, master key `uba-e2e-master-key`, mounted
  at `/parse`, not root.
- **nodegx-backend** — start your own:
  `node packages/nodegx-backend/bin/nodegx-backend.js serve --port <port> --data-dir <dir>`.
  ⚠️ Parse wire at the **root** (`/classes/…`), and `/api/_schema` rather than `/schemas`.

⚠️ **Namespace your fixtures.** In use: `bcn005_*`, `bcn004n`, `bcn007_*`, `bcnorch`, and
`articles` rows where `body LIKE 'bcn004n-%'`. **Never truncate `articles` or `authors`.**
⚠️ **Never pipe a probe into `head`** — SIGPIPE kills node partway through and it reads as the
server having stopped answering. Redirect to a file.

## Harnesses that already exist — copy, do not rebuild

- `uba-e2e/bcn-004-node-driver.ts` — registers real nodes into a real `NodeContext` and drives
  them through `registerInputIfNeeded`. **The right tool for a node audit.**
- `uba-e2e/bcn-orch-export-driver.ts` + `bcn-orch-browse.mjs` + `bcn-orch-cors-proxy.mjs` —
  runs the editor's real exporter headlessly, serves the deployed bundle, and drives it in
  headless Chrome over CDP on port 9333, independent of any editor session. This is how to
  check anything at deploy level.
- `uba-e2e/bcn-007-file-driver.ts`, `bcn-006-oauth-driver.ts`, `bcn-005d-schema-sync-driver.mjs`.

## Editor / CDP traps

- ✅ `--target=editor`. ⚠️ **`--target=dashboard` is stale advice and actively harmful** — it
  is not a known needle, so it falls through to "first page", which is the *preview* window.
  `--target=viewer` is the embedded webview on `localhost:8574`.
- ✅ **An editor CAN be driven from a worktree** — `npm run dev:debug` compiles the worktree's
  own sources. `BCN-009-NOTES` §6.1 says otherwise and is wrong; three workers have confirmed it.
- ⚠️ **`BaseDialog` renders every dialog TWICE, permanently** (a hidden measuring copy). Scope
  with `[class*=VisibleDialog] > [class*=ChildContainer] <sel>`.
- ⚠️ **HMR does not reliably swap a changed component** even while logging "App is up to date".
  Relaunch — always after touching node registrations or labels.
- ⚠️ **Only one editor at a time** (fixed dev-server ports). Check `lsof -i :8574`.
- ⚠️ **A dev launch rewrites the project it opens**, on open *and* shutdown. Use a scratch
  project or `git checkout` the fixture after.
- Launch detached; **never `cdp reload`**.
- Adding a node programmatically beats driving the picker:
  `NodeGraphNode.fromJSON({id,type,x,y,parameters:{}}, model)` then `model.addRoot(n,{})`.

## Waiting on Richard — do not decide these unilaterally

- ⚠️ **The admin-token disclosure.** The leak is fixed (`b6a8507c`, `3a2d44f4`), but **any
  project already deployed with an external backend has shipped its admin token**, and nothing
  tells the user to rotate it. Whether BCN-009's security disclosure should say so is his call.
- **Q6: do the four maturity levels gate the security disclosure?** BCN-009 shipped
  "show it always" and proposes gating only the `publicToken` finding.
- **Whether `cloudservices` and `backendServices` should finally merge into one config key.**
  BCN-009 step 2 converged the *selection* and deliberately left the *configuration* split,
  with an eight-site argument. **Judge it on its own merits now** — the defect it was meant to
  fix is closed without it.
- `BCN-006-LIFECYCLE-DESIGN.md` §9 — six token-lifecycle decisions flagged rather than absorbed.
- ⚠️ **nodegx `files.delete` defaults to `"nobody"`**, so a Delete File node against a fresh
  backend answers 403 for everyone but an admin. Is that the intended default for an app?
- **NDA-017 §1** is already marked as his.

## Housekeeping

- **Another session commits to `cline-dev`.** Commit with explicit pathspecs, never
  `git add -A` from the root.
- **Do not touch** `dev-docs/tasks/phase-31-readiness-and-operations/{PROGRESS,README}.md` or
  `OPS-010-LAUNCH-GUIDANCE.md` — uncommitted work from a paused session.
- Branches `wt-bcn007`/`wt-bcn010`/`wt-bcn006b`/`wt-bcn005d` are merged and their worktrees
  removed. `git worktree list` should show only the primary plus `.claude/worktrees/agent-*`
  leftovers; `git worktree prune` if any `wt-*` survive.
- Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…`
  import, so `tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has **one**
  pre-existing failing test (9/10 suites, 105 passing of 106) — BCN-010 reported two; I measured
  one at `7b06384d`. Either way it is pre-existing, verified against the baseline. The root
  `tsc` has 18 pre-existing `Cannot find module '@noodl-versioning'` errors.
- ⚠️ `packages/noodl-runtime`'s bare `npx jest` **crashes** in `@jest/reporters/getResultHeader`
  (`Cannot find module 'terminal-link'`) and reports a meaningless "1 of 23 total". It looks
  exactly like a failing suite and is not. Use a minimal custom reporter:
  `npx jest --reporters <path> -- <testfile>` — **the `--` matters.**
- ⚠️ **Build `noodl-runtime`'s `dist-types` first** (`npm run build:types`) or four corpus
  suites will not start and the run reads short, which looks like real breakage.

## One judgement call worth flagging

I have pointed this handover at **NDA-012's Data and Cloud Services** because that is what
phase 34 was blocking and what phase 30 explicitly deferred — auditing them earlier would have
documented a library that was about to change.

But phase 30 has **nine other tasks in 🔄 partial state** (NDA-004 §2, NDA-005 §2 and its
per-node tail, NDA-006 slices, NDA-007, NDA-010 §1, NDA-014's live check, NDA-017 §1). If the
alpha is the nearer goal, a sweep that *closes* several of those may be worth more than opening
the largest remaining audit. **That is a sequencing call, and it depends on Richard's answer to
whether phase 34 ships before or after the alpha — which is still open.**
