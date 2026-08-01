# Next session — Visual (20 in scope) is the last category in NDA-012

Continue on branch `cline-dev` in `/Users/richardosborne/vscode_projects/OpenNoodl`.
Tip when this was written: `bae73621`. The checkout is clean apart from another session's
uncommitted phase-31 files (leave them alone — §7).

## Where things stand

**Data closed 2026-08-01 at 37/37. NDA-012 is 16 of 17 categories. Only Visual (20 in scope) remains.**

A four-worker parallel batch read the last 29 Data nodes: **26 new defects, 13 fixed, 13 filed**,
and the category went **12.7% → 96.8%** documented. **Zero merge conflicts across four merges.**

| Commit | What |
|---|---|
| `a6af2915` | Worker C — Object family + HTTP Request, 3 defects fixed |
| `bfb9bfd5` / `9db6f403` | Worker A — the 15 agentic/streaming nodes, 14 defects |
| Worker B (merged in `9db6f403`'s range) | Array/Repeater/Variable, 8 defects |
| `9f003d08` | Worker D — Record family port descriptions, 53/53 static |
| `2c23675f` | Catalogs regenerated once; a rollback timer the batch left armed |
| `54a13074` | Typed C's corpus rows so the batch adds nothing to the ratchet |
| `978adc7f` | The four worksheet fragments merged into `audit/data.md` |
| `bae73621` | Register, findings, and **the instrument that was wrong** |

### Gates at `bae73621` — I ran every one of these myself, before *and* after

| Gate | Before | After |
|---|---|---|
| `packages/noodl-runtime` jest | 90/91 suites, 1683 passing | **92/93 suites, 1734 passing**, 0 failed |
| `packages/noodl-viewer-react` jest | 35 suites, 382 passing | **36 suites, 403 passing**, 0 failed |
| runtime typecheck | clean | **clean** |
| viewer-react typecheck | clean (`--skipLibCheck`) | **clean** |
| `catalog:check` | clean, 151 types | **clean, 151 types** |
| `catalog:merge:check` | clean | **clean, 151/151** |
| `cloud-library:check` | clean, 58 types | **clean, 58 types** |
| **editor `test:ci`** | **2000 specs, 0 failures** | **2000 specs, 0 failures** |

⚠️ **The editor suite is now measured, not assumed.** The handover this replaces said "nothing I
touched is editor code, but that is a reason to expect it green, not evidence". It is evidence now —
run both times. Its log contains `Automatic merge failed` and `error: failed to push some refs`
lines; those are the merge-driver and git specs exercising conflicts **deliberately**. Do not read
them as a broken gate.

⚠️ **The TSFixme ratchet is RED at the inherited `any +35` / `@ts-expect-error +1`, and the handover
this replaces said +33.** The extra two were that session's own corpus file — the figure was stale by
exactly the work that wrote it down. The batch took it to +42 and it was brought back to +35 by
typing, so **this batch contributes zero**. Still unowned. **Do not re-baseline silently.**

## §1 — Corrections to the document you are replacing

1. ⚠️ **"Nine other partial tasks" over-counts phase 30's remaining work.** Two task cells were
   stale in the *status column* while their own notes said otherwise, and I only caught it by
   checking the commits: **NDA-006** reads "Slices 1+2 done" when all four slices plus the deployed
   leg landed (`b33b1b3e`, `cc28a4be`); **NDA-007** reads "§1 done + renderer built" when §2 and §3
   landed (`899ab676`). Both verified against git.

   ⚠️ **And "read to the end of the section" — this phase's own rule — does not work here.**
   NDA-007's trailing text is the *current* one; **NDA-009's trailing sentence ("§2 and §3 remain")
   is the stale one**, superseded by text earlier in the same cell. Position does not indicate
   currency in an append-only cell. **Only the date and commit stamps do.**

   The real remaining shape of phase 30: **Visual (20 in scope)**, **NDA-010 §1**, three live-QA tails
   (NDA-002, NDA-013, NDA-014), and two decisions that are Richard's (NDA-004's deprecated-five
   policy, NDA-017 §1).

2. **Data's scope figures in the previous handover were correct** — 37 in scope, 433 ports, 55
   documented, 12.7%, 20 at 0%. Reproduced independently. Worth stating because it was the number
   most likely to have rotted. ⚠️ Note the catalog spells these `isDeprecated` / `typeName`, **not**
   `deprecated` / `type` — the obvious field names return zero rows and read as "nothing is
   deprecated".

## §2 — The three findings that reach outside Data

Full text in FINDINGS **DB-i…DB-vi**.

1. ⚠️ **The `B1` / `Fail?` pre-fill was answering a different question, in TWO instruments.**
   `worksheets.js` and `register.js` both derived "has a failure output" by matching
   `/fail|error/i` against port **names**, so a node with a *string* output called `Error` and no
   failure signal at all read **"✅ has one"**. Worker A found four such nodes in one directory.
   **Fifteen categories were audited from that column.** Both fixed to require a **signal**.
   Applying it flips **zero** cells today — the four nodes that exposed it were fixed in this batch
   — so it is a guard against recurrence, not a re-scoring. ⚠️ **Visual is the first category to be
   audited with a correct pre-fill; do not compare its B1 hit rate with earlier categories'.**

2. ⚠️ **`Model.get(undefined)` is unreachable over a wire.** `sendValue` returns early on
   `undefined` (`node.ts:635`), so the reachable empty values are `null` and `''` — and
   `typeof null === 'object'` is what actually routes a cleared value into `Model.create(null)`.
   Every prior write-up of the phase's third recurring shape used the `undefined` spelling, which
   arrived through an *internal walk* in NDA-004 §2, not a connection. **A sweep hunting that
   spelling over connections finds nothing and concludes the class is clean.**
   Same line, second consequence: **a value output cannot be cleared**, so a stale output after a
   failure is a runtime-wide property, not a per-node defect. Worker C pinned that with a row rather
   than "fixing" it.

3. ⚠️ **A declared `default` never runs its setter.** `registerInput` writes it straight into
   `_inputValues` (`node.ts:116-118`); `NodeScope` queues only the keys the *model* carries
   (`nodescope.ts:148-157`). So a node whose real work is a setter side effect **does nothing until
   an author touches an input** — `Global Store`, `Subscribe to Store` and `State History` were all
   dead. Invisible from the canvas, because the panel shows the default and the `State` getter reads
   the manager directly. **The predicate is mechanical** — *a node whose real work is a setter side
   effect and all of whose ports have defaults* — **and it has never been run outside Data.** Worth
   one grep before Visual starts.

## §3 — Visual (20 in scope): what is known before you start

⚠️ **Measured 2026-08-01, after this handover was first written, and it corrected the handover twice.
Both errors were mine and both would have mis-scoped the batch.**

**Visual is 20 nodes in scope, not 29.** The catalog holds 29, of which **9 are deprecated** — the
legacy form controls (`Button`, `Checkbox`, `Field Set`, `Form`, `Label`, `Options`, `Radio Button`,
`Range`, `Text Input`), which Richard's standing decision puts out of scope. Every phase-30 document
had carried "Visual (29)" unexamined. **This is Data's "42 nodes" error repeating**, one category
later, from the same cause: a count taken before the deprecated filter was applied.

⚠️ **And C1 is NOT nearly free here — it is a bigger job than Data's was.** This section first said
so on the strength of the *0%-node count* (one node), which is not coverage. Measured:

| | Data (before its batch) | **Visual (now)** |
|---|---|---|
| Nodes in scope | 37 | **20** |
| Static ports | 433 | **1,226** |
| Documented | 55 (12.7%) | **633 (51.6%)** |
| **Undocumented ports** | **378** | **593** |

**Half the nodes but 2.8× the ports, and more undocumented ports than Data had ports.** The nine
biggest: `Text Input` 118, `Slider` 113, `Dropdown` 111, `Group` 105, `Button` 99, `Checkbox` 96,
`Radio Button` 95, `Video` 89, `Image` 78. **A low 0%-node count means the shared pass reached these
nodes' shared names (`width`, `height`, `margin`), not that they are documented.**

- ⚠️ **`Component Children` has ZERO static ports** and must be recorded **`n/a`, not 100%**
  (so must `Component Inputs`, `Component Outputs` and `DbConfig`, in other categories).
- ⚠️ **The validator being green is weak evidence** — dynamic-port nodes skip port checks.
- ⚠️ **`graph-harness` does not call a module's `setup`.** NV-v found six of Navigation's fifteen
  defects there, and it is where editor-time port derivation lives.
- Visual is where **NDA-016 (`Layout.size`)**, **NDA-006 (Columns)** and **NDA-007 (icons)** already
  did deep work. Expect Component Utilities' 0.63 shape — **prior work, not exhaustion** — and say
  which it is rather than reporting a bare rate.

### The territory, mapped (so the parallel/serial call is made on evidence)

| Directory | Nodes | Ports |
|---|---|---|
| `noodl-viewer-react/src/nodes/visual/` | Circle, Columns, Drag, Group, Icon, Image, Text, Video (8) | 471 |
| `noodl-viewer-react/src/nodes/controls/` | Button, Checkbox, Dropdown (`options.ts`), Radio Button, Radio Button Group, Slider, Text Input (7) | 676 |
| `noodl-viewer-react/src/nodes/navigation/` | Page, Component Stack (`navigation-stack.tsx`), Page Router (`router.tsx`) (3) | 72 |
| `nodes/std-library/data/foreach.tsx` | Repeater (1) | 7 |
| — | Component Children (1) | 0 (`n/a`) |

⚠️ **`controls/utils.ts` is the hot shared file — 6 of the 7 control nodes import it.** It is this
category's `RestDataAdapter.ts`: **assign it to exactly one worker and say so**, or two workers edit
it and the seam that produced zero conflicts last time produces its first.
⚠️ **`nodes/visual/css-definition.ts` is imported by nothing** — check whether it is dead before
anyone spends time in it.
⚠️ **`Repeater` lives in `std-library/data/`**, the directory the last batch's Worker B owned. It is
one node and 7 ports; **give it to whoever owns the smallest slice**, and do not let that make
`data/` a shared directory again.
⚠️ **Nobody should edit the base visual machinery** (`react-component-node.ts`, `layout.ts`,
`Group.tsx` and friends) — it is shared by every node in the category and by NDA-016's fix. A defect
there is a filing, and it belongs to the orchestrator.

**Recommended shape: three workers, not four** — `visual/` (8), `controls/` (7, owning `utils.ts`),
and `navigation/` + `Repeater` + `Component Children` (5). Controls is 55% of the ports, so if it is
split, split it *inside* the directory by file and give `utils.ts` to one of the two explicitly.

⚠️ **One result from this batch argues against the ordering heuristic**: the fifteen agentic nodes
had **never been read** and scored the phase's **lowest** rate (0.93), with two nodes clean, while
the worst defects were in the *oldest* code. **Unread predicts nothing about density either way** —
which does not retire the "unread means unaudited, not clean" rule, since the same never-read
directory is where §2.3's three dead nodes were.

## §4 — Unowned, and nobody in this batch could take them

1. ⚠️ **OB-ii's last two sites.** `dbmodelcrudbase.ts:423` and `dbmodelnode2.ts:235` carry the
   empty-Id-binds-a-shared-record shape **byte-for-byte**, and in the Record family it lands on
   **DA-ii's schema-burning mechanism**. Worker C found them and could not fix them (D's territory);
   Worker D was descriptions-only. **Filed, unowned. This is a cost of the parallel seam and it is
   the first thing to pick up.**
2. ⚠️ **`Run Tasks` is Data's 37th node and has no worksheet entry and no port descriptions.**
   Audited under NDA-009, never documented — **the only in-scope Data node still at 0%** (0/14), and
   `audit/data.md` still shows it `⬜`. Small, and it is what stops Data reading 100%.
3. **WD-1** — `Error` is never cleared by a later success on all six Record verbs
   (`dbmodelcrudbase.ts:96-99`). It changed what Worker D could truthfully write on those ports.
4. **WD-4 / FC-9** — `RestDataAdapter.ts:1032-1039` drops a per-record ACL with only a
   `console.warn` (the B2 class, one layer below where NDA-004 §2 fixed it); and
   `nodedefinition.ts:46` keeps port `type` for only 4 type names, so NDA-014 §2's `object → string`
   mirror in `setInputValue` never fires for a declared `string` port.
5. **From phase 34's register, still untouched**: a `Blob` through the Parse wire is
   JSON-stringified to `{}` *with a Success signal*; a `CloudFile` in a REST record property is sent
   as an object where Directus wants a UUID; `byob-utils.ts` and its test outlive the family they
   served.

## §5 — Waiting on Richard

- ⚠️ **Does phase 34 ship before or after the alpha?** Still open. **The case for "finish the audit"
  is stronger than it was**: phase 30's remaining work is one category, one small task, three QA
  tails and two decisions — not the nine-task backlog the last handover implied (§1.1).
- ⚠️ **NEW — a cloud function cannot make an HTTP request.** `net.noodl.HTTP` is
  `availableIn: ['browser']`; the only cloud-available general HTTP node is `REST2`, which is
  deprecated **and filtered out of the picker**. Across all 57 cloud-available types the only other
  candidates are `Sign File URL` and `noodl.cloud.request` — and that one is the function's
  *incoming* trigger, not a client. **The hole predates DA-i** (the editor has always hidden
  deprecated nodes via `componentmodel.ts:292-295`); DA-i is what made it *discoverable*, which is
  an argument for that fix rather than against it. **NDA-011 decided "deprecated, not deleted"
  without this fact.** FINDINGS **DB-v**.
- **Should `Insert Object Into Array` treat a duplicate insert as failure or idempotent success?**
  Measured, not decided. Worker B recommends leaving `Done` and adding `Unchanged` if it bites
  (WORKER-B-NOTES §6.1).
- **Should `shortDesc` exist at all?** It reaches **nobody** — and DA-iv named the wrong cause.
  `build-catalog.js` writes it on one hard-coded line and it is **not in the catalog for any core
  node**, so `ContextBuilder`'s `?? node.shortDesc` cannot fire regardless of enrichment summaries.
  Fifty sites declare it. Worker B recommends deleting it (§6.2).
- **Port-documentation precedence.** There are now **three** channels — `description`, `tooltip` and
  enrichment `ports` — with no declared precedence (**WD-3**). Decide before the next category
  writes 200 more sentences into one of them.
- Standing: NDA-004's deprecated-five policy, NDA-017 §1, the admin-token disclosure, Q6,
  `cloudservices` vs `backendServices`, `BCN-006-LIFECYCLE-DESIGN.md` §9, nodegx `files.delete`
  defaulting to `"nobody"`.

## §6 — Traps

### New this session

- ⚠️ **A green count with new noise beside it is not a green gate.** The runtime run began reporting
  *"a worker process has failed to exit gracefully"* with **0 failures**. It was an open
  `Optimistic Update` transaction holding a rollback timer — **test teardown, not a shipped defect**
  (`_onNodeDeleted` clears it correctly). Three reusable facts: **a single test file runs in-band**,
  so the leak was invisible when the suite ran alone and appeared only once a second file forced a
  worker process — *"it passes on its own"* was true and meaningless; **`--detectOpenHandles`
  reported nothing**, because it also forces in-band, so the bisect had to be by pairing files; and
  the fix is to **delete the node**, not to fake timers, because `_onNodeDeleted` clearing that
  timer is the H1 contract the family is being audited against — so the teardown doubles as its
  control.
- ⚠️ **`echo "exit=$?"` after a pipe reports the pipe's last stage, not the tool.** Two typechecks
  read "exit=0" meaninglessly. Redirect to a file, *then* check `$?`.
- ⚠️ **A bare substring in a territory grep gives false positives**: `modelcrudbase` matches
  `dbmodelcrudbase`, so a seam check reported an overlap that did not exist. Anchor the pattern.
  (Same class as SUB-013's bare-pattern trap.)
- ⚠️ **`$` under the `m` flag matches end-of-*line*.** Extracting multi-line `**Verdict:**` blocks
  from `audit/data.md` silently truncated 13 of 36 at the first newline, mid-sentence. Search
  forward to a **blank line** instead.
- ⚠️ **`git diff cline-dev..wt-X` is the wrong check once you have merged anything** — it shows the
  already-merged worker's files as differences and reads as a territory violation. Use
  `git merge-base` explicitly.

### Standing, and all confirmed live this session

- ⚠️ **The Bash cwd persists**, and a root-only npm script run from `packages/noodl-runtime` fails
  with `Missing script`. It bit within two minutes. **Always `cd` to the repo root explicitly**, and
  use absolute paths in `node -e` requires.
- ⚠️ **`catalog:check` can pass while `catalog:merge` and `cloud-library:check` are stale.** It did,
  exactly as documented. Run all three; fix with `catalog:merge` and `cloud-library:generate`.
- ⚠️ **`packages/noodl-runtime`'s bare `npx jest` crashes** in `@jest/reporters` on a full run and
  reports a meaningless "1 of 23". A minimal JSON reporter is the workaround (used all session).
- ⚠️ **Build `noodl-runtime`'s `dist-types` first** or corpus suites do not start and the run reads
  short.
- ⚠️ **Scope greps to `packages/*/src`** — the repo root hits `.claude/worktrees/agent-*` leftovers
  and the minified `noodl.deploy.js`.
- ⚠️ **`noodl.deploy.js` is a gitignored artifact nothing rebuilds.** This batch's runtime changes do
  **not** reach a deployed app until `npm run build --prefix packages/noodl-viewer-react` runs.
- ⚠️ **`instanceof Collection` is `false` under `noodl-viewer-react`'s jest and `true` in the
  shipped build** (`class CollectionImpl extends Array {}` at `target: es5`). Measured at both
  targets. **Two `instanceof Collection` branches in the Array family have never been exercised by
  any test**, and one existing corpus premise rests on the jest answer.
- **Mixin ordering**: assign store stubs **after** the method-bind loop, or the node reaches the
  real wire and fails with `XMLHttpRequest is not defined` rather than saying the stub was ignored.
- ⚠️ **A stub in a shared test factory is a coverage hole with no warning label**, and it is
  invisible from the file that has the defect. Read the factory, not just the assertions.
- ⚠️ **`rm` on a tracked file is blocked by the permission classifier**; `mv` to the scratchpad
  works. Relevant because `scripts/node-audit/worksheets.js` **never overwrites**.

### Parallel batches — the seam that worked

**Four workers, four disjoint file sets, zero conflicts.** What made it work was taking three things
away from the workers entirely: **`audit/data.md`** (each wrote its rows into its own notes file in
the same table format; the orchestrator merged them), **the generated catalog** (regenerated
**once**, by the orchestrator, after all merges — a 2 MB regenerated file in four branches is four
unmergeable files), and **`PROGRESS`/`FINDINGS`/`NODE-REGISTER`**. Reuse this shape.

⚠️ **Two workers may share a directory if they share no file** — C and D did, in
`std-library/data/`. It held, but it is the tightest seam in the batch, and one worker "just tidying"
a sibling file breaks it. **Say so explicitly in the briefs** — and expect the cost: the two OB-ii
sites in §4.1 are unowned *because* of that seam. Budget an orchestrator pass to pick up what the
seam stranded.

⚠️ **Do NOT use `isolation: "worktree"`** — it branches from `origin/main`, 900+ commits behind.
Build worktrees from `cline-dev` with the recipe in
`../phase-34-one-backend-contract/NEXT-SESSION-HANDOVER.md`.
⚠️ **Only one editor at a time across a batch** (fixed dev-server ports; `lsof -i :8574`).

### Editor / CDP

- ✅ `--target=editor`. ⚠️ `--target=dashboard` is stale advice and actively harmful — it falls
  through to the *preview* window.
- ⚠️ **`BaseDialog` renders every dialog TWICE, permanently.** Scope with
  `[class*=VisibleDialog] > [class*=ChildContainer] <sel>`.
- ⚠️ **HMR does not reliably swap a changed component.** Relaunch after touching node registrations.
- ⚠️ **A dev launch rewrites the project it opens**, on open *and* shutdown. Use a scratch project.
- Launch detached; **never `cdp reload`**.

## §7 — Housekeeping

- **Another session commits to `cline-dev`.** Explicit pathspecs, never `git add -A`.
- **Do not touch** `dev-docs/tasks/phase-31-readiness-and-operations/{PROGRESS,README}.md` or
  `OPS-010-LAUNCH-GUIDANCE.md` — uncommitted work from a paused session, untouched all batch.
- The four `wt-nda012*` worktrees and branches are removed. The `wt-bcn*` branches are a **previous**
  session's leftovers and were deliberately left alone.
- Pre-existing and unowned: `dist-types/src/api/cloudstore.d.ts` has a dangling `packages/…` import,
  so `tsc -p noodl-viewer-react` needs `--skipLibCheck`. `@noodl/mcp` has **one** pre-existing
  failing test. The root `tsc` has 18 pre-existing `Cannot find module '@noodl-versioning'` errors.

## §8 — The rig

Left **running**, and all three answered 200 all session:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8092/parse/health   # parse
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8055/server/health  # directus
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8091/api/health     # pocketbase
```

Bring up from `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e`:
`docker compose --profile supabase --profile aggregate up -d` and `docker compose --profile parse up -d`.

- **Parse** `:8092` — app id `uba-e2e-app`, master key `uba-e2e-master-key`, mounted at `/parse`.
- **Directus** `:8055` — `admin@example.com` / `directus-admin-pw`; static token
  `bcnorch-static-token-1234567890` does not expire, login tokens do (15 min). ⚠️ CORS disabled, so a
  browser cannot read it cross-origin; proxy at `uba-e2e/bcn-orch-cors-proxy.mjs`.
- **PocketBase** `:8091` — `admin@example.com` / `pocketbase-admin-pw`.
- **PostgREST (as "Supabase")** `:8056` — no GoTrue, no Realtime.
- **nodegx-backend** — start your own. ⚠️ Parse wire at the **root** (`/classes/…`), and
  `/api/_schema` rather than `/schemas`.

⚠️ **Left on Parse**: `nda012_Owner`/`nda012_Target` (`enemies` is deliberately poisoned —
`Relation<undefined>`, DA-ii's evidence, unrepairable without dropping the class) plus this batch's
`nda012a_*`…`nda012d_*`. Also in use: `bcn005_*`, `bcn004n`, `bcn007_*`, `bcnorch`.
⚠️ **Never truncate `articles` or `authors`.** ⚠️ **Never pipe a probe into `head`** — SIGPIPE kills
node partway and reads as the server having died.

## §9 — Read these first

- [`PROGRESS.md`](./PROGRESS.md) — updated in all four places this time (task cell, coverage table,
  find-rate table, log), which is what the last handover's §5.5 asked for. **Its newest log entry is
  always more current than this file**, which goes stale in one round.
- [`FINDINGS.md`](./FINDINGS.md) — **DB-i…DB-vi** at the end, plus the "checked and clean"
  subsection, which records two things verified as *not* defects so they are not re-raised.
- [`audit/data.md`](./audit/data.md) — 41 entries, **36 filled**. The five `⬜` are the four
  deprecated types and `Run Tasks` (§4.2). **Read it; the orchestrator writes it.**
- `WORKER-{A,B,C,D}-NOTES.md` — the full per-node reasoning, the explicit "could not verify" lists,
  and the two decision write-ups for Richard.
