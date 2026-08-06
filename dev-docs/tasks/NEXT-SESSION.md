# Next session — the prompt

**Written 2026-08-06**, at the end of a **fourth** session the same day. Covers everything still
open in **phase 42** (first hour), **phase 40** (AI authoring quality) and **phase 39** (alpha
polish).

## What the FOURTH session did, so you do not redo it

**Every decision Richard owed is now taken. There are none outstanding.**

Gates re-run **by the orchestrator on the settled tree**, not taken from any agent's report:
`typecheck:cloud` · `typecheck:editor` clean · `catalog:check`, `cloud-library:check`,
`catalog:merge:check` all **up to date** · `library:check` **58/58** · nodegx-backend
**93 suites / 1019** · mcp **196** · **`Jasmine: 2352 specs, 0 failures`**.

| Commit | What |
|---|---|
| `8868d747` | Richard's last three decisions recorded in the phase-42 README |
| `c87c120f` | **CWF-016 slice 1** — the idempotency design decided |
| `390b880e` | **CWF-007** — the trap that decides whether streaming is possible, measured |
| `029711f5` | **AAQ-011 F12** — a node id written through `noodl-mcp` cannot collide |
| `4c53950d` `e49a1fda` | **AAQ-011 F3** — the redundant prose turn is gone |
| `fb0f0470` | 🔴 **FH-024** — the local admin API, driven then fixed |
| `0e7a8df4` | **CWF-004 slice 2** — the rest of the declarative data family |
| `e6a9242b` | Register consolidated |

### The four things worth carrying

1. 🔴 **FH-024 was worse than filed — it was WRITABLE.** The drive is the whole reason we know. From
   a real page on an unrelated origin: reads of six admin routes returned bodies, a **preflighted**
   `PUT /admin/ops` changed the running config, and a simple `text/plain` `POST /admin/roles`
   created a role. **Two lessons bigger than the bug:** the CORS suppression must come from the
   **route table, never a path prefix** (`GET /api/_schema` and `GET /executions` are admin routes
   that do not start with `admin/`, and the router splits *then* decodes, so `/%61dmin/ops` reaches
   `admin/ops`); and **(a)+(b) are both required** — a simple cross-origin write is sent blind
   regardless of CORS, so only (b) stops it landing.
2. ⚠️ **CWF-016's stated trap was BACKWARDS, and the correction shrinks what the feature can
   promise.** A `call-function` step never reaches `POST /functions/:name` — it runs in process via
   `invokeCloudFunction` → `WorkflowRunner.invokeFunction` → `cloudRunner.run`, with literally
   `headers: {}`. So dedup cannot swallow a retry. **The real limit is the mirror image: our own
   CWF-005 retries are the one duplicate path endpoint idempotency cannot protect.** This
   generalises — *no endpoint feature applies to a workflow step*.
3. ⚠️ **Two agents were cut off before committing, with ~2,700 lines of finished work in the tree
   and no way to resume them.** It was recoverable only because every change carried a marker
   naming its task. **Tell agents to commit per slice, not once at the end.**
4. **CWF-007's decisive trap resolves in favour of streaming.** A cloud function *can* consume a
   streaming upstream API: the trap is accurate about the isolate, but `nodegx-backend` does not use
   the isolate at all. Layer 2 is a vocabulary decision, not an engine limit.

---

Paste the block below into a fresh session.

---

Continue the OpenNoodl/NodeGX revival across three phases. Work on `cline-dev`, commit straight to
it, no branches and no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-42-first-hour/README.md` — current as of 2026-08-06, and its
   "Where this phase stands" section is the honest register.
2. `dev-docs/reference/BACKEND-AUTHORING-MODEL.md` — mandatory before touching any CWF task.
3. `dev-docs/tasks/phase-40-ai-authoring-quality/AAQ-011-FOUND-ALONG-THE-WAY.md` — the F-row
   register. **14 of 15 closed**; only F14 remains, blocked on AAQ-010.
   ⚠️ Its `HANDOVER.md` is stale — do not work from it.
4. `dev-docs/tasks/phase-39-alpha-polish/PROGRESS.md` — the register.
   ⚠️ **`phase-39/HANDOVER.md` is superseded — do not work from it.**

## How to work

**Run several agents in parallel on disjoint file sets.** What was learned doing it:

- **`git commit -m "…" -- <explicit paths>`, never `git add -A`, never stash, never
  `git checkout`/`git restore` a file you did not write.** The one legitimate `git add` is a single
  exact path for a **new** file — `git commit -- <path>` cannot include an untracked file.
- ⚠️ **Tell every agent to commit incrementally, per slice.** In the last session two agents were
  interrupted with all their work uncommitted and could not be resumed. An agent that has not
  committed has produced nothing durable.
- **Serialise anything that regenerates the node catalog.** `catalog:check`, `cloud-library:check`
  and `catalog:merge:check` compare the committed snapshot to the **working tree**, so two agents
  adding nodes at once each see green while HEAD is inconsistent.
- ⚠️ **Do not let two agents run heavy suites at once.** `test:ci` hit its 900s watchdog with **no
  `Jasmine:` line and therefore no verdict** while a sibling `lerna run` was executing. Only the
  final `Jasmine:` line counts, ever.
- **Verify the whole tree yourself at the end**, rather than trusting agents' reports.
- Tell every agent the task docs are **researched but not infallible** and to verify at file:line.
  Roughly two premises per doc are wrong, and several specified implementations would have broken
  the feature they specified. Have them fix the doc line.

**Gates and their baselines (all green at `HEAD` as of 2026-08-06):**

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests
npm run catalog:check && npm run cloud-library:check && npm run catalog:merge:check
npm run library:check                       # 58/58
npx lerna run test --scope @noodl/runtime           # 2293
npx lerna run test --scope @noodl/cloud-runtime     # 172
npx lerna run test --scope @noodl/nodegx-backend    # 93 suites / 1019
npx lerna run test --scope @noodl/observe
npx lerna run test --scope @noodl/mcp               # 196
npm run test:ci                             # Jasmine: 2352 specs, 0 failures
```

⚠️ **The editor spec count is a shared-checkout number** — treat the **failure** count as the signal
and never conclude "my change added N specs" from the total.

`npm run typecheck:core-ui` is **red on files nobody owns and is not a gate**.
`npm run typecheck:backend-tests` has ~11 pre-existing errors in `realtime-filter.test.ts` and
`workflow-canvas-contract.test.ts` — check `git status` before owning a failure.

⚠️ **A sibling session has uncommitted work in this checkout** (`package-lock.json`,
`packages/nodegx-observe/bin/`, `projectmodel*`, `ProjectImporter`, `LocalProjectsModel`,
`featureFlags.ts`, `import-engine/analyze.ts`, `VersionControlPanel/**`, `tests/versioning/**`,
untracked `tests-unit/erg-005/`). **It has not moved since 2026-08-03** — check whether that session
is live before starting anything that overlaps. Do not touch, revert, stash or commit any of it.

Also dirty and deliberately left alone: `packages/noodl-editor/tests/testfs/import_proj5/project.json`,
a **pure reformat** written by some spec run (identical JSON, minified → pretty-printed).

## Richard's decisions — ALL TAKEN, do not relitigate

Everything previously listed as owed is now decided. In addition to the standing set (FH-018 delete
the Config node · ERG-005 §2 explicit types · NDA-017 per-input run-on-change **and** its migration ·
F10 backend-on-open with orphan reaping · F13 `noodl-mcp` may provision backends · `set_design_tokens`
declared in AAQ-005 and implemented in AAQ-009 · TALK-001…007), the last three were taken 2026-08-06:

- **FH-024 → fixed, (a)+(b), driven first.** Done — `fb0f0470`.
- **AAQ-011 F12 → fix `duplicate-node-id` specifically, do NOT widen the write gate.** Done —
  `029711f5`. **The gate-scope class is left open deliberately**; the next project-wide rule will
  land in the same hole.
- **AAQ-011 F3 → remove the second prose turn entirely.** Done — `4c53950d`.

**The one decision now owed is new: CWF-004's Aggregate step.** Four inputs are written into the task
doc, including one found after the work landed — `noodl.cloud.aggregate` already exists as *Aggregate
Records*, but it is a **database** aggregation over a collection query and cannot see a payload
passing through a workflow. It is the only entry in the family table that computes, and shipping it
means editing the served sentence *"No arithmetic…"* in three places first.

## Phase 42 — what is left

| Task | State |
|---|---|
| **CWF-004** | Slices 1 and 2 shipped. **Open: S6's "new function from this step" gesture**, and Richard's Aggregate call. |
| **CWF-006** — triggers + the entry step | ⚠️ **NOT superseded — phase 43 is open and NOT scheduled.** Buildable now. **Sequence it after CWF-004's S6** — both land on the workflow canvas. |
| **CWF-016** — idempotency | Slice 1 (design) done. **Slices 2–4 unbuilt: the store, the endpoint, the editor door. Concurrency test FIRST** — claim-then-run under a unique constraint is the part that will be wrong. |
| **CWF-007** — streaming | Still a design doc to argue with. Q1, Q2 and Q4 are Richard's. ⚠️ **Q2 is the same question as FH-024** — a channel readable by anyone who knows its id would be the *third* instance of that class. |
| **FH-007** / ERG-005 §2 | Decided; sequenced behind the other session's §1. |
| **FH-019 slice 3** | Approved (move `typescript` to `dependencies`). ⚠️ **Still blocked on `package-lock.json` being clean** — the sibling session has it modified. |
| **MCP-004** — the docs page | ⚠️ A change to the **docs repo**, not this one. |

### Filed, not fixed — the two new ones

- 🆕 **The editor's AI write path may have F12's shape** — `candidate.ts:151` is `n.id ?? newId()`
  with no project-wide check. ⚠️ **Confirmed at the line; CONSEQUENCE UNVERIFIED.** The apply path
  may rekey downstream (`rekeyAllIds()` has four other callers). **Establish that before fixing
  anything.**
- 🆕 **A spec run rewrites `tests/testfs/import_proj5/project.json`** as a pure reformat. Harmless,
  which is why it will keep happening unnoticed.

Older rows that are still genuinely open: the **nine Config nodes in four shipped prefabs**, the
node-id-`add` bundle-load failure, `impersonate()` writing a `user` pointer where this backend reads
`userId` (a `noodl-viewer-cloud` change), and badges staying `pointer-events: none`.

## Phase 40 — AI authoring quality

**The largest remaining block, and a dependency chain:**
`AAQ-005 → AAQ-006 (Strands harness) → AAQ-007 → AAQ-008/009/010`.

| Task | State |
|---|---|
| **AAQ-005** | Slices 1–3 green. **Criteria 3 and 4 not started.** |
| **AAQ-006** — the agent harness | Not started. Engine (Strands) settled. Depends on AAQ-005. |
| **AAQ-007** — the agent sees its work | Not started, **not gated** (F6 was never a defect). |
| **AAQ-008/009/010** | Not started. AAQ-010 blocked on AAQ-009 + AAQ-007 + F14 + AIB-010. |
| **AAQ-003** | Criterion 2 not driven; needs a second brief. |
| **AAQ-004** | Mechanism A built and under test. **Mechanism B sits with AAQ-006.** F3 is closed. |

**AAQ-011 is 14 of 15 closed.** Only **F14** remains, blocked on AAQ-010. There are **no open F-rows
that are plain bugs and no open F-rows awaiting a decision.**

## Phase 39 — alpha polish

- **POL-017** — fixed; **`pol004-doc-diff.js` has not been re-run.** Criterion 4 is satisfied by
  construction, not by the harness. Re-run it in the next session that owns the editor.
- **POL-018** — provenance topology from `ProjectModel`. Deferred by Richard; carries two open
  questions (component scoping; component instances) written as questions, not assumptions.
- **POL-019** — closed (`fc623918`).

## The live-QA debt — what is left

Each needs a **fresh** editor session because the state is one-shot:

1. **HUD-003 criterion 2** — clicking a root with the Provenance panel **never opened** this session.
2. **HUD-001 step 2** — Record pressed with **no preview running** (stop it first; it auto-restores).
3. **FH-011's preview-reload re-arm**, and **HUD-004's crashed-agent (slice 3) and legacy paths**.
4. **FH-010** (VC dialogs), **FH-019** (completions in a Function vs an Expression popout — the two
   `Noodl` objects differ), **FH-023** (the four prefabs).
5. 🆕 **FH-024's fix in the real editor** — the drive was against a directly-spawned backend. Confirm
   the editor's own Backend Services panel, Data Browser and Execution History still work now that
   dev-open no longer relaxes the admin gate. **The supervisor should already attach the token**, but
   that is exactly the kind of claim this repo keeps discovering is untrue.
6. 🆕 **The BAK-005 `/_admin` dashboard now shows a sign-in form on a dev-open backend.** Confirm the
   token from `secrets.json` signs in.

**Restart the editor; do not trust HMR.** **Check both themes.** Use the `run-editor` skill.

⚠️ **Driving traps that each cost time:** verify **which project actually opened, by name**, before
believing anything · the preview can legitimately show a different app than the project you opened ·
`nodegx-observe`'s MCP handshake races its own startup (wait for its readiness line on **stderr**) ·
the fixture's `/erg-rig` was never laid out, so six root nodes report `(0,0)` and badges pile on one
pixel · each `npm run cdp` costs ~1.5s, so collapse click-then-measure into one shell call ·
⚠️ **an occluded Electron window clamps timers ~1000×** — pace drivers with `MessagePort`.

⚠️ **One packaging item a human must verify**, from MCP-002:

```
npm run build:editor        # starts with lerna clean; not cheap
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/noodl-mcp"
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/nodegx-observe"
node ".../Resources/nodegx-observe/nodegx-observe.cjs" --version
```

Watch for `file source doesn't exist` — **electron-builder only warns on a missing `extraResources`
source and ships the app anyway**, which is how every published artifact has probably been missing
`Resources/nodegx-backend/cli.js`.
