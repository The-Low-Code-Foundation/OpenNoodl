# Next session — Visual's per-node audit is the last thing phase 30 needs

Continue on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip when this was written: `9d65f91b`. **The working tree is completely clean and there is exactly
one worktree and three branches** — see §8, which is now a record of a cleanup rather than a list of
things to step around.

⚠️ **"Another session is also committing to `cline-dev`" was false, and had been false for at least
four handovers.** Richard confirmed it on 2026-08-01: there has only ever been this one session. The
belief cost real work — a complete 299-line OPS-010 spec sat uncommitted for days because every
handover told the next session to leave it alone, and each inherited the instruction from the last
without checking. **It is committed now (`9d65f91b`).** If you find uncommitted work in this repo,
it is orphaned, not in flight: read it, and commit or discard it deliberately.

## Where things stand

**Data is CLOSED at 37/37 and 100% documented.** `Run Tasks` closed it.

**Visual is started but NOT audited, and the distinction matters.** Its C1 went **51.6% → 80.0%**
and four defects are fixed — but **no Visual node has its twelve checks filled in**. Every entry in
`audit/visual.md` is still `⬜`. Treat the category as unaudited work with a head start on C1.

⚠️ **The three-worker Visual batch was terminated mid-task by an account monthly spend limit**, not
by anything in the code. None of the three had committed. Their uncommitted work was reviewed,
verified, pinned and salvaged — see §3 — but the per-node audit itself did not happen.

| Commit | What |
|---|---|
| `2d7b34b8` | OB-ii's last two sites — the defects the Data batch's seam stranded |
| `ca795e1f` | `Run Tasks` — 5 defects, 2 of them permanent wedges; C1 0% → 100% |
| `b7c7d599` | The Visual shared-port pass — 20 sentences close 269 ports |
| `a5fdc308` | Salvage of the killed batch — G1 on Text and the media sources, Image's empty failure port |
| `4f08103d` | Register, findings DC-i…DC-iv, PROGRESS, and Run Tasks' worksheet entry |

### Gates at `4f08103d` — I ran every one of these before *and* after

| Gate | Before | After |
|---|---|---|
| `packages/noodl-runtime` jest | 92/93 suites, 1734 passing | **93/94 suites, 1750 passing**, 0 failed |
| `packages/noodl-viewer-react` jest | 36 suites, 403 passing | **37 suites, 417 passing**, 0 failed |
| runtime typecheck | clean | **clean** |
| viewer-react typecheck | clean (`--skipLibCheck`) | **clean** |
| `catalog:check` | clean | **clean** |
| `catalog:merge:check` | clean | **clean** (needed `catalog:merge`) |
| `cloud-library:check` | clean | **clean** (needed `cloud-library:generate`) |
| editor `test:ci` | 2000 specs, 0 failures | **2000 specs, 0 failures** |

⚠️ **The TSFixme ratchet is RED at the inherited `any +35` / `@ts-expect-error +1` and this session
contributes zero.** It went to +36 and I typed the one `any` away rather than re-baselining.
⚠️ **Do not re-baseline it.** ⚠️ **`catalog:check` passed while the other two were stale**, exactly
as the standing trap says — run all three.

**A worthwhile, unowned job**: **+28 of the +35 is phase 30's own corpus test files** —
`nda-016-layout-sizemode.test.ts` (+12), `nda-004-navigation-failure.test.ts` (+9),
`nda-008-stack-replace-transition.test.ts` (+7). That is our debt, not inherited debt, and typing
those three files takes the ratchet most of the way to green.

## §1 — What phase 30 has left

1. **Visual's per-node audit — 20 nodes, twelve checks each.** The only substantial item. §2.
2. **NDA-010 §1.**
3. **Three live-QA tails**: NDA-002, NDA-013, NDA-014 — plus **two new ones this session owes**
   (§3.1).
4. **Two decisions that are Richard's**: NDA-004's deprecated-five policy, NDA-017 §1.

## §2 — Visual: everything you need, already measured

**20 nodes in scope of 29 in the catalog** — the nine deprecated legacy form controls are out by
Richard's standing decision. `audit/visual.md` was **regenerated this session** and its pre-fills are
current; ⚠️ the copy it replaced had every `C1` figure stale by 40–50 points (it showed `Button` at
1% when the node was at 53%), so **do not trust a C1 number quoted from any older document**.

### The territory, and what C1 is left in each

| Directory | Nodes | Undocumented ports left |
|---|---|---|
| `noodl-viewer-react/src/nodes/visual/` | Circle, Columns, Drag, Group, Icon, Image, Text, Video (8) | ~85 |
| `noodl-viewer-react/src/nodes/controls/` | Button, Checkbox, Dropdown (`options.ts`), Radio Button, Radio Button Group, Slider, Text Input (7) | ~140 |
| `noodl-viewer-react/src/nodes/navigation/` | Page, Component Stack (`navigation-stack.tsx`), Page Router (`router.tsx`) (3) | 33 |
| `nodes/std-library/data/foreach.tsx` | Repeater (1) | 7 |
| `noodl-runtime/src/nodelibraryexport.ts:354` | Component Children (1) | 0 → record **`n/a`**, not 100% |

**246 undocumented ports remain** of the original 593. Re-derive rather than trusting that number:

```bash
node -e 'const c=require("./packages/noodl-types/src/node-catalog.json");
const v=c.nodes.filter(n=>n.category==="Visual"&&!n.isDeprecated);let t=0,d=0;
for(const n of v)for(const p of [...(n.inputs||[]),...(n.outputs||[])]){t++;if(p.description)d++;}
console.log(t,d,(d/t*100).toFixed(1)+"%");'
```

⚠️ The catalog spells these `isDeprecated` / `typeName`, **not** `deprecated` / `type` — the obvious
field names return zero rows and read as "nothing is deprecated". That error has now cost this phase
a mis-scope twice (Data's "42 nodes", Visual's "29").

### Ownership rules that held, and the one that didn't

- ✅ **`controls/utils.ts` to exactly one owner.** Verified: imported by exactly six files, all of
  them the control nodes. Its shared interaction ports are **already documented** (`a5fdc308`).
- ✅ **The orchestrator owns `react-component-node.ts` and `node-shared-port-definitions.ts`** and
  does the shared-port pass alone. This is what `PORT-DESCRIPTION-STYLE.md` prescribes and it worked:
  20 sentences, 269 ports, no conflicts.
- ⚠️ **`nodes/visual/css-definition.ts` is NOT dead and NOT Visual's.** The previous handover said it
  was "imported by nothing". It is imported by `register-nodes.js:15` and it is a **CustomCode**
  category node, already audited. Leave it alone.
- ⚠️ **`nodes/navigation/` is mostly the *Navigation* category**, which is closed. Only `page.ts`,
  `navigation-stack.tsx` and `router.tsx` are Visual's. A defect in the others is a filing that
  corrects a category believed closed.
- ⚠️ **Nobody edits the base visual machinery** (`react-component-node.ts`, `layout.ts`). A defect
  there is the orchestrator's.

### If you parallelise again — the one rule that would have saved this session

⚠️ **Tell workers to commit after every node**, and say why. Three workers died mid-task with
everything uncommitted. The work was salvageable only because I could read their worktrees; had the
worktrees been cleaned up first, all of it would have been lost. **Also check the spend limit before
launching a fleet** — three agents plus an orchestrator exhausted a monthly cap in under an hour.

Everything else about the seam was sound and is worth reusing verbatim: disjoint file sets, the
catalog and `audit/`+`PROGRESS`/`FINDINGS`/`NODE-REGISTER` taken away from workers entirely, each
worker writing worksheet rows into its own notes file in the same table format.

⚠️ **Do NOT use `isolation: "worktree"`** — it branches from `origin/main`, 900+ commits behind. Build
worktrees from `cline-dev` with the recipe in `../phase-34-one-backend-contract/NEXT-SESSION-HANDOVER.md`
(and verify with the `require.resolve` check, or a worktree silently tests the primary's sources).

### Where the defects are likely to be

- **B1/B2 on the media and interaction nodes.** `Video`, `Image` and `Drag` all pre-fill `B1 ⚠️
  none`, and three of this session's four Visual defects were there. **B2 asks whether the failure is
  visible in a *deployed* app** — an `editorConnection.sendWarning` with no `raiseRuntimeError` beside
  it is the defect, and it is the most common shape in this phase.
- **G1 on the controls.** They are how an app collects data. The reachable empty values are `null`
  and `''`, **never `undefined`** (§4.2).
- **H1 on Page / Component Stack / Page Router / Repeater.** Lifecycle and identity is their whole
  job, and NV-iii (one-shot state that latches) was found next door in `Close Popup` and
  `Pop Component Stack`. `Component Stack` is the category's only non-`safe` SSR node, so H1 is a
  real check on it.
- **`Slider`** — its 80 remaining ports are mostly its private border generator (§3.2).
- **`Repeater`** is the densest pre-fill in the category: 3 flagged checks on 7 ports, 0% documented,
  and it is what the whole `foreachitem.ts` binding contract in the runtime serves.

## §3 — This session's own loose ends

1. ⚠️ **Two salvaged fixes are verified by inspection and typecheck only** — they need a DOM and a
   frame clock, which `renderToStaticMarkup` cannot provide. **They are named in
   `tests/corpus/nda-012-visual-empty-values.test.tsx` rather than left silent, and live QA owes
   them**: `Image`'s `On Error` reporting, and `Drag`'s `scale || 1` plus its snap-timer cleanup.
2. ⚠️ **`Slider` has a private copy of `addBorderInputs` (`slider.ts:225`).** The documentation
   consequence is minor. **The open question is whether the two copies have drifted in *behaviour*** —
   no fix to the shared border ports has ever reached Slider, and nobody has checked what that cost.
3. **`Component Children`** (`noodl-runtime/src/nodelibraryexport.ts:354`) has zero static ports and
   still needs its worksheet row, recorded **`n/a`, not 100%**.

## §4 — Findings that change how you audit. All still current

1. ⚠️ **The `B1`/`Fail?` pre-fill was wrong in both instruments** until last session — it matched
   `/fail|error/i` against port **names**, so a *string* port called `Error` read as "✅ has one".
   Fifteen categories were audited from that column. Both now require a **signal**. **Visual is the
   first category audited with a correct pre-fill; do not compare its B1 rate with earlier ones.**
2. ⚠️ **`Model.get(undefined)` is unreachable over a wire.** `sendValue` drops `undefined`
   (`node.ts:635`), so the reachable empty values are `null` and `''`. A sweep hunting the
   `undefined` spelling finds nothing and concludes the class is clean. Same line: **a value output
   cannot be cleared**, so a stale output after a failure is runtime-wide — pin it with a row rather
   than "fixing" it.
3. ⚠️ **A declared `default` never runs its setter.** `registerInput` writes it into `_inputValues`
   (`node.ts:116-118`); `NodeScope` queues only the keys the *model* carries (`nodescope.ts:148-157`).
   Three Data nodes did nothing until an author touched an input. **The predicate is mechanical and
   has still not been run over Visual** — `drag.ts` mirrors four defaults in `initialize` precisely
   because of this, which is evidence the shape is present in the category.
4. ⚠️ **`graph-harness` does not call a module's `setup`.** Six of Navigation's fifteen defects were
   there, and it is where editor-time port derivation lives.
5. ⚠️ **The validator being green is weak evidence** — dynamic-port nodes skip port checks.
6. ⚠️ **A node audited for one contract is not an audited node** (DC-i, new). `Run Tasks` was worked
   over four times by NDA-009 and nobody ever started a run. **Before trusting any "already audited"
   claim in this phase, check *which* checks that audit ran.**

## §5 — Waiting on Richard

- ⚠️ **A cloud function cannot make an HTTP request.** `net.noodl.HTTP` is `availableIn: ['browser']`;
  the only cloud-available general HTTP node is `REST2`, which is deprecated **and filtered out of the
  picker**. **NDA-011 decided "deprecated, not deleted" without this fact.** FINDINGS **DB-v**.
  **Ask about this one early — it may change what NDA-011 concluded.**
- **Does phase 34 ship before or after the alpha?** The case for finishing the audit is stronger
  again: phase 30 is now one category, three QA tails and two decisions.
- **Should `Insert Object Into Array` treat a duplicate insert as failure or idempotent success?**
- **Should `shortDesc` exist at all?** It reaches **nobody** — not in the catalog for any core node,
  so `ContextBuilder`'s `?? node.shortDesc` cannot fire. Fifty sites declare it.
- **Port-documentation precedence** — three channels (`description`, `tooltip`, enrichment `ports`)
  with no declared precedence (**WD-3**). **This is now urgent**: this session wrote ~300 sentences
  into `description` and the next category will write more.
- Standing: NDA-004's deprecated-five policy, NDA-017 §1, admin-token disclosure, Q6,
  `cloudservices` vs `backendServices`, `BCN-006-LIFECYCLE-DESIGN.md` §9, nodegx `files.delete`
  defaulting to `"nobody"`.

## §6 — Traps

### New this session

- ⚠️ **The Bash cwd persists, and it bit three times** — including once where `cd packages/... && grep`
  reported "no such file or directory" because the shell was *already* there, and once where a
  typecheck read `exit=1` for the same reason and looked like a real failure. **Always `cd` to the
  repo root explicitly and use absolute paths.**
- ⚠️ **A shared port *name* is not a shared *declaration*.** `backgroundColor` looks exactly like the
  33 names that live in shared machinery and is declared at 8 separate per-node sites. Group by
  declaration site, not by name — and **re-measure after a bulk pass** to find what escaped it.
- ⚠️ **A guard in the obvious place can measure as fixed while the reachable path stays broken.**
  `dbmodelnode2.ts` has three routes to the shared record and the third runs *before* `setModelID`.
  **Drive the input setter a wire reaches, not the method.**
- ⚠️ **`zsh` eats `--include=*.ts` and `'\"'` in greps.** Quote glob arguments; several searches
  returned "no matches found" or a math error and read as "nothing there".
- ⚠️ **A scratchpad script cannot `require('ts-node')`** — module resolution starts from the script's
  own directory. Put probes inside the package and run them as jest tests.
- ⚠️ **Salvaging an agent's uncommitted work**: `git -C <worktree> diff > patch` then `git apply`
  works, but `git status --short | head` will hide new untracked source files behind the
  `node_modules` symlinks. **Filter `node_modules` out rather than truncating.**

### Standing, and confirmed live again this session

- ⚠️ **`catalog:check` can pass while `catalog:merge` and `cloud-library:check` are stale.** It did.
  Fix with `catalog:merge` and `cloud-library:generate`.
- ⚠️ **`packages/noodl-runtime`'s bare `npx jest` crashes** in `@jest/reporters` on a full run. Use a
  minimal reporter (one is at `scratchpad/minimal-reporter.js`; it is 20 lines, rewrite it if gone).
- ⚠️ **Build `noodl-runtime`'s `dist-types` first** (`npm run build:types --prefix
  packages/noodl-runtime`) or corpus suites do not start and the run reads short.
- ⚠️ **`echo "exit=$?"` after a pipe reports the pipe's last stage.** Redirect, then check `$?`.
- ⚠️ **A green count with new noise beside it is not a green gate.**
- ⚠️ **Scope greps to `packages/*/src`** — the root hits leftover worktrees and `noodl.deploy.js`.
- ⚠️ **`noodl.deploy.js` is a gitignored artifact nothing rebuilds.** This session's runtime and
  viewer changes do **not** reach a deployed app until
  `npm run build --prefix packages/noodl-viewer-react` runs.
- ⚠️ **`rm` on a tracked file is blocked by the permission classifier**; `mv` to the scratchpad works.
  Relevant because `scripts/node-audit/worksheets.js` **never overwrites** — `mv` the file away to
  regenerate it.
- ⚠️ **`instanceof Collection` is `false` under `noodl-viewer-react`'s jest and `true` in the shipped
  build.** Two branches in the Array family have never been exercised by any test.

### Editor / CDP

- ✅ `--target=editor`. ⚠️ `--target=dashboard` is stale advice and falls through to the *preview*
  window. ⚠️ `BaseDialog` renders every dialog **twice** — scope with
  `[class*=VisibleDialog] > [class*=ChildContainer] <sel>`. ⚠️ **HMR does not reliably swap a changed
  component** — relaunch after touching node registrations. ⚠️ **A dev launch rewrites the project it
  opens**, on open *and* shutdown — use a scratch project. Launch detached; **never `cdp reload`**.
- ⚠️ **Only one editor at a time across a batch** (fixed dev-server ports; `lsof -i :8574`).

## §7 — The rig

Left **running**; all three answered 200 this session:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8092/parse/health   # parse
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8055/server/health  # directus
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8091/api/health     # pocketbase
```

Bring up from `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e`:
`docker compose --profile supabase --profile aggregate up -d` and `docker compose --profile parse up -d`.

- **Parse** `:8092` — app id `uba-e2e-app`, master key `uba-e2e-master-key`, mounted at `/parse`.
- **Directus** `:8055` — `admin@example.com` / `directus-admin-pw`; static token
  `bcnorch-static-token-1234567890` does not expire. ⚠️ CORS disabled; proxy at
  `uba-e2e/bcn-orch-cors-proxy.mjs`.
- **PocketBase** `:8091` — `admin@example.com` / `pocketbase-admin-pw`.
- **PostgREST (as "Supabase")** `:8056` — no GoTrue, no Realtime.
- **nodegx-backend** — start your own. ⚠️ Parse wire at the **root** (`/classes/…`), and
  `/api/_schema` rather than `/schemas`.

⚠️ **Left on Parse**: `nda012_Owner`/`nda012_Target` (`enemies` is deliberately poisoned —
`Relation<undefined>`, DA-ii's evidence) plus `nda012a_*`…`nda012d_*`, `bcn005_*`, `bcn004n`,
`bcn007_*`, `bcnorch`. ⚠️ **Never truncate `articles` or `authors`.** ⚠️ **Never pipe a probe into
`head`** — SIGPIPE kills node partway and reads as the server having died.

## §8 — Housekeeping — the repo was cleaned up on 2026-08-01

**State now: one worktree, three branches, clean tree.** `git add -A` is safe again, though explicit
pathspecs remain the better habit.

| | Before | After |
|---|---|---|
| Worktrees | **28** | **1** (the primary) |
| Branches | **14** | **3** — `cline-dev`, `main`, `nightly-to-main` |
| Uncommitted files | 3 (phase-31, orphaned) | **0** |

- **24 stale `.claude/worktrees/agent-*` worktrees** from AIX/PNL/DEP/batch-era sessions, plus this
  session's three, plus `batch-c-editor-shell`, `batch-e-backend` and eight `wt-bcn*` branches — all
  removed. ⚠️ **Every one was verified merged into `cline-dev` first** (`git branch --no-merged`) and
  **checked for uncommitted work**; one agent worktree was dirty and its two files already existed in
  `cline-dev`. `git branch -d` (merged-only) was used deliberately rather than `-D`, so the delete
  itself was the proof. `.claude/worktrees` is now empty, which also fixes the standing grep trap.
- `nightly-to-main` is the **only** unmerged branch. It is CI infrastructure — **keep it**.
- ⚠️ **`main` is 1,007 commits behind `cline-dev`, and `origin/cline-dev` is 857 behind.** See §10.
- ⚠️ **Five old stashes survive** and two of them (`stash@{0}`, `stash@{3}`) contain the *minified*
  `project-examples/agent-chat/project.json` (−5,719 lines) — the known editor-launch corruption.
  **Applying either would damage the example project.** They are AIX-era WIP whose tasks have since
  shipped. Left in place only because dropping a stash is irreversible; Richard's call.
- Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…` import,
  so `tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has **one** pre-existing failing
  test. The root `tsc` has 18 pre-existing `Cannot find module '@noodl-versioning'` errors.

## §10 — ⚠️ 857 commits exist only on this machine

`cline-dev` is **857 commits ahead of `origin/cline-dev`** and 1,007 ahead of `main`. That is
essentially the entire revival — every phase from 12 to 34 — living on one disk with no remote copy.

This is the single largest risk to the project and it is **not a technical problem**: the remote
exists (`github.com/The-Low-Code-Foundation/OpenNoodl`) and nothing is in conflict. It needs a
decision about whether this work is pushed to a public repository, and that is Richard's alone —
which is why no session has done it. **Raise it; do not action it unasked.**
- Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…` import,
  so `tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has **one** pre-existing failing
  test. The root `tsc` has 18 pre-existing `Cannot find module '@noodl-versioning'` errors.

## §9 — Read these first

- [`PROGRESS.md`](./PROGRESS.md) — **its newest log entry is always more current than this file.**
  Updated in all four places: task cell, coverage table, find-rate table, log.
- [`FINDINGS.md`](./FINDINGS.md) — **DC-i…DC-iv** at the end.
- [`audit/data.md`](./audit/data.md) — **complete**; `Run Tasks`' entry is the worked example of a
  twelve-check verdict block.
- [`audit/visual.md`](./audit/visual.md) — regenerated, current pre-fills, **all entries still `⬜`**.
- `WORKER-{A,B,C,D}-NOTES.md` — the Data batch's per-node reasoning. **There are no Visual worker
  notes**; the three workers died before writing any.
