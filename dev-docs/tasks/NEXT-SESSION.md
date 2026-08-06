# Next session — the prompt

**Written 2026-08-06**, updated at the end of a **second** session the same day. Covers everything
still open in **phase 42** (first hour), **phase 40** (AI authoring quality) and **phase 39**
(alpha polish).

**What the second session did**, so you do not redo it:

1. **Paid the live-QA debt.** HUD-001…004, FH-011, MCP-001/003, FH-020+FH-022 and the cloud
   vocabulary were driven in the running editor, **both themes**, across two real restarts.
   Evidence is in `phase-42-first-hour/README.md` § *The live-QA pass*. Two things were proved the
   only way they can be: **HUD-004's data-loss fix** (editor at 60 events, an agent's `start_trace`
   did not drop it) and **MCP-003's reconnect** (observe survived an editor restart and a new
   token). **FH-020 + FH-022 close triage item 0.**
2. **Built Richard's four decisions** — F10, F13, NDA-017's migration, and `set_design_tokens`
   recorded in both docs.
3. **Closed six plain bugs** — F1, F2, F8, F9, F11, POL-017 — plus a new **POL-019**.

⚠️ **Three registers were lying, and all three the same way**: a row filed from one task's notes,
fixed by an adjacent task, and never closed. `ProvenancePanel.timeOf()` (fixed by HUD-003),
AAQ-011 F2 (fixed by FH-005 + FH-013) and POL-017's gutter (fixed by `00adecd5`, a commit about the
linter) all sat as *filed, not fixed* while being fixed. POL-016's rule catches rows that
**vanish**; nothing catches rows that **outlive their fix**. If you touch a register, check its open
rows against the code before believing them.

Paste the block below into a fresh session.

---

Continue the OpenNoodl/NodeGX revival across three phases. Work on `cline-dev`, commit straight to
it, no branches and no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-42-first-hour/README.md` — current as of 2026-08-06, and its
   "Where this phase stands" section is the honest register.
2. `dev-docs/reference/BACKEND-AUTHORING-MODEL.md` — mandatory before touching any CWF task.
3. `dev-docs/tasks/phase-40-ai-authoring-quality/AAQ-011-FOUND-ALONG-THE-WAY.md` — the F-row
   register. ⚠️ Its rows are **out of numeric order** (F3 and F8 are easy to miss), and its
   `HANDOVER.md` omits F3 entirely.
4. `dev-docs/tasks/phase-39-alpha-polish/PROGRESS.md` — the register.
   ⚠️ **`phase-39/HANDOVER.md` is a session stale and marked superseded — do not work from it.**

## How to work

**Run several agents in parallel on disjoint file sets.** That is how the last three batches got
through 23 tasks. What was learned doing it, which you should carry:

- **`git commit -m "…" -- <explicit paths>`, never `git add`, never `git add -A`, never stash,
  never `git checkout`/`git restore` a file you did not write.** A path-limited commit still takes
  the *worktree state of the whole file*, so agents editing a shared file commit each other's
  in-flight work — that is acceptable when both changes are landing, but it means a commit's
  `--stat` is not a reliable account of who did what. Tell each agent to include rather than
  revert, and to say so.
- **Serialise anything that regenerates the node catalog.** `catalog:check`, `cloud-library:check`
  and `catalog:merge:check` all compare the committed snapshot to the **working tree** source —
  so two agents adding nodes at once will each see green while HEAD is inconsistent. That is
  exactly how HEAD came to advertise `net.noodl.Log` with no runtime registering it.
- **Give any agent touching nodes, workflows or the editor `npm run test:ci` as a gate, not just
  `typecheck:editor`.** Only the final `Jasmine:` line counts. The retry fold passed every gate it
  was given and still left a reader un-migrated.
- **Verify the whole tree yourself at the end**, rather than trusting the agents' reports. Every
  batch so far has left something the individual gates could not see. **It happened again on
  2026-08-06**: F10 and F13 independently built **two incompatible spawn records** for the same
  orphan problem — precisely the failure F13's own row predicts, since each spawner reaps only its
  own. They converged (`6640dfc1`), and the F10 agent then reported a defect in F13's reaper it was
  not allowed to fix, which the orchestrator fixed (`b4af5ab5`). **Two agents given adjacent
  problems will solve them twice**; ask each what shared state it is writing, and read the other's
  work before believing a report that says "done".
- Tell every agent the task docs are **researched but not infallible** and to verify at file:line.
  Across three batches roughly two premises per doc were wrong, and several specified
  implementations would have broken the feature they specified. Have them fix the doc line.

**Gates, and their current baselines (all green at `HEAD` as of 2026-08-06):**

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests
npm run catalog:check && npm run cloud-library:check && npm run catalog:merge:check
npm run library:check                       # 58/58
npx lerna run test --scope @noodl/runtime           # 2285
npx lerna run test --scope @noodl/cloud-runtime     # 172
npx lerna run test --scope @noodl/nodegx-backend    # 89 suites / 901
npx lerna run test --scope @noodl/observe           # 23
npx lerna run test --scope @noodl/mcp               # 186
npm run test:ci                             # Jasmine: 2342 specs, 0 failures
```

All of the above were re-run by the orchestrator on the settled tree at the end of the second
session, **not** taken from agent reports. ⚠️ **The editor spec count is a shared-checkout number.**
It moved 2295 → 2342 across one day with four sessions' work in the tree; treat the **failure
count** as the signal and never conclude "my change added N specs" from the total.

`npm run typecheck:core-ui` is **red on files nobody owns and is not a gate**.
`npm run typecheck:backend-tests` has ~11 pre-existing errors in `realtime-filter.test.ts` and
`workflow-canvas-contract.test.ts` — check `git status` before owning a failure.

⚠️ **A sibling session has uncommitted work in this checkout** (`package-lock.json`,
`packages/nodegx-observe/bin/`, `projectmodel*`, `ProjectImporter`, `LocalProjectsModel`,
`featureFlags.ts`, `import-engine/analyze.ts`, `VersionControlPanel/**`, `tests/versioning/**`,
untracked `tests-unit/erg-005/`). Do not touch, revert, stash or commit any of it. Check whether
that session is live before starting anything that overlaps.

---

## Richard's decisions already taken — do not relitigate

- **FH-018 → the Config node is deleted outright.** Done.
- **ERG-005 §2 → explicit type selection on Component I/O, with inference as the default.**
  Decided 2026-08-06; blocked only on the other session's §1 landing, since it changes the same
  seams.
- **FH-019 slice 3 → yes, take the dependency.** Approved 2026-08-06: move `typescript` from
  `devDependencies` to `dependencies` so the language service resolves in the packaged app
  (~11 MB on a 23 MB package). ⚠️ **`package-lock.json` is currently modified by the sibling
  session** — do not commit a lockfile change on top of theirs. Wait until it is clean, or agree
  the handoff with that session first.
- **NDA-017's per-input "Run on value change"** is the shipped design and stays.
- **NDA-017 migration → yes, migrate on load.** Decided 2026-08-06 and ✅ **built the same day** —
  [NDA-017 §4](phase-30-node-library-audit/NDA-017-SIGNAL-INPUT-FRESHNESS.md#4--the-migration-built).
  A pure function in `ProjectPatches/runOnValueChangeMigration.ts`, wired into `applyPatches`.
  **7,196 parameters on 3,507 nodes across 55 of 81 real projects** — 29% of the class. ⚠️ Two things
  worth carrying: the ordering that actually bit was **drain order inside the parameter bag**, not
  §3's port-exists race (that one is already fixed in `defineNode`, and jest *can* reach it); and
  **Text Input has no run-on-change checkbox at all**, because `createNodeFromReactComponent` never
  copies `runOnValueChange`.
- **AAQ-011 F10 → yes, start the project's backend on open and stop it on close.** Decided
  2026-08-06. ⚠️ **The constraint, verbatim, is a hard requirement:** *"for the love of Mike please
  make sure that all 'stop' cases are covered, like the editor crashes, the user's computer goes on
  fire, etc so that there's no chance we leave orphaned backends running that fuck up other projects
  or fry the user's CPU."* **A close handler is not the design** — a crash or a power cut never runs
  one. The design owes **orphan reaping**: a durable pid/port/project record at spawn, swept on the
  next launch. ✅ **BUILT 2026-08-06** — `240bf0c0` (registry + reaper, 46 jest specs), `2994e48f`
  (start on open / stop on close), `7e76c70b` (delayed spinner, silent success, sticky failure),
  `6640dfc1` (converged onto `noodl-mcp`'s record format). ⚠️ **The row's premise was wrong**: an
  orphan guard already existed — `nodegx-backend` has taken `--parent-pid` since WF-004 and drains
  itself. What it cannot survive is a **recycled** parent pid, `EPERM` read as alive, or a wedged
  process. Those three are what the reaper covers. **Adopt, never restart**, and therefore never
  stop what we did not start.
- **AAQ-011 F13 → yes, `noodl-mcp` may provision backends.** Decided 2026-08-06, on the ground that
  an external agent must be able to build a full-stack app end to end. What that opens is the design
  work — lifecycle, ports and secrets ownership — and **it inherits F10's no-orphans constraint**,
  in the harder form: an MCP sidecar has no window to close and no quit event. ✅ **BUILT
  2026-08-06** — `e45bc02a` (record + reaper), `460f17e3` (`provision_backend` / `stop_backend` /
  `list_backend_processes`, write-gated), `b4af5ab5` (the self-identity fix below). Deliberately
  **not** a plan operation: `apply_plan`'s contract is all-or-nothing with a byte-identical
  discard, and a spawned process plus a created database are neither — the editor reaches the same
  conclusion from the other side (`provisionBackend.ts:21-25` puts only the *binding* in the undo
  group). ⚠️ **`b4af5ab5` is worth reading before you touch the reaper**: its `self` fast path
  compared the owner pid alone, so a dead session whose pid the OS recycled onto the current one was
  classified `self` and skipped **forever** — the `--parent-pid` hole rebuilt one branch above the
  code that closes it. Identity is now kind + pid + session start time.
- **`set_design_tokens` → declared in AAQ-005, implemented in AAQ-009.** Decided 2026-08-06. The
  declaration is a vocabulary question (the one table in `validation/authoringVocabulary.ts`, so the
  two clients cannot diverge on it); the behaviour is a styling question, on the `applyPreset` seam.
- **TALK-001…007's decisions** at the foot of each doc are settled.

## Decisions still owed by Richard

Ask these early — several tasks are gated on them.

**Four of the six were answered on 2026-08-06** and have moved to the list above. They are numbered
as they were, so a handover that cites "question 3" still resolves.

| # | Question | Why it blocks |
|---|---|---|
| ~~1~~ | ~~**Do we migrate projects authored before NDA-017?**~~ ✅ **ANSWERED 2026-08-06 — yes, on load.** See above. | It put a **double email send** one hop away in the prefabs (FH-023). Repo-wide, and silent. |
| ~~2~~ | ~~**AAQ-011 F10** — should opening a project start its backend?~~ ✅ **ANSWERED 2026-08-06 — yes, with orphan reaping as a hard requirement.** See above. | Gates the full-stack story. |
| ~~3~~ | ~~**AAQ-011 F13** — may `noodl-mcp` spawn backend processes?~~ ✅ **ANSWERED 2026-08-06 — yes.** Ports, secrets and lifecycle are now design work, not a permission question. See above. | Without it an external agent cannot build a full-stack app end to end. |
| 4 | **AAQ-011 F12** — the `noodl-mcp` write gate is component-scoped, so `duplicate-node-id` fires only *after* the write. Filed rather than patched because the fix is a design change. | AAQ-005. |
| 5 | **AAQ-011 F3** — the `record_scope` "now answer in prose" second turn is visibly redundant. A design question, to decide inside AAQ-004's fix review. | AAQ-004 mechanism B. |
| ~~6~~ | ~~**AAQ-005** — does `set_design_tokens` land in AAQ-005 or AAQ-009?~~ ✅ **ANSWERED 2026-08-06 — both: declared in AAQ-005, implemented in AAQ-009.** See above. | Both. |

---

## Phase 42 — what is left

Six items. The phase README's tables carry the mechanisms.

| Task | State |
|---|---|
| **CWF-004** — Transform + the data-step family | Was blocked on CWF-001; **now unblocked**. Widened on Richard's argument: without a workflow-level reshape, every function carries its caller's mess. A free Function step is advised against. |
| **CWF-006** — triggers + the entry step | A **subset of phase 43** (`dev-docs/tasks/phase-43-backend-authoring-clarity/`) — if that lands first this is superseded. CWF-002 deferred its entry-card indicator here on the same grounds. Check phase 43 before building. |
| **CWF-007** — streaming responses | A design doc to argue with, not a build. Its Q3 was already answered by TALK-005. |
| **CWF-016** — idempotency keys | The only item on the track with nothing built behind it, and the only capability a Function node cannot fake (needs state across requests). **Design first, concurrency test first.** |
| **FH-007** / ERG-005 §2 | Decided; sequenced behind the other session's §1. |
| **MCP-004** — the docs page | ⚠️ **A change to the docs repo, not this one.** MCP-001 already probes the URL once per session and shows the link only if it answers, so the page turns itself on when published with no editor release. Exact path, sidebar entry and content are specified at the foot of MCP-004. |

### Phase 42's filed-not-fixed list

These have mechanisms recorded and no owner. Several are small.

> ⚠️ **This list was stale in FOUR of its ten rows when the next session read it**, and it is the
> same failure the phase-39 and phase-42 registers hit: *a row outlives its own fix.* Three were
> fixed by `edb8661b` the previous day and the phase-42 README already said so — only this
> hand-written summary lagged. **The README outranks this prompt; grep before believing a row here.**

- ~~**`runRetentionCleanup()` / `cleanupByAge` have zero call sites**~~ — ✅ fixed `edb8661b`
  (previous session; this row was already stale when written). `ExecutionStore.prune()` is the
  production caller — `service.ts:293` at start, then write-driven at most hourly. Retention is
  `ops.json` → `executions.retentionDays`, default 30, `0` = keep forever.
- ~~**`Array Filter`'s `enabled` and `Array Map`'s `mapScript` are inert `default`s**~~ — ✅ fixed
  `9446e6fc`, **and half the row was false.** Both `default`s are indeed inert (a declared `default`
  never runs its setter — the most-repeated trap in this repo), but `filtercollectionnode.ts:179`
  sets `this._internal.enabled = true` inside `initialize`, so **a hand-authored filter never passed
  everything through**. Measured: 3 records in, 1 out, no `enabled` parameter present. That line is
  now commented as load-bearing and asserted, because deleting it as "redundant beside the `default`"
  is precisely how this node would acquire its twin's defect. **Array Map was real**: `mapScript`'s
  setter is what *compiles* the script, so an untouched Script gave `mapFunc: undefined` → `Failure`
  and *"could not be compiled: unknown error"* — unknown because nothing had ever failed to compile,
  nothing had compiled at all. The editor meanwhile rendered the declared template into the field, so
  the node refused a script the author could see. ⚠️ **Behaviour change worth knowing**: an Array Map
  whose Script was never edited now runs the empty template and emits **one empty record per source
  record** firing `Done`, where it used to emit nothing and fire `Failure`. A Repeater bound to one
  goes from rendering nothing to rendering N empty items.
- ~~**CWF-009 has no admin route**~~ — ✅ fixed `4aba4eb2`. `GET /admin/secrets`, `PUT`/`DELETE
  /admin/secrets/:name`. No `:namespace` segment ever: the handler supplies `functions`, so the
  backend's own namespaces stay *unnameable* through this door as they are from a graph. No route
  returns a value. **The panel itself is still not built** and is now the only missing part.
- ~~**CWF-018's `timeoutMs` has no row in the Permissions panel.**~~ — ✅ fixed `25e9696c`. A
  `time limit (seconds)` field beside CWF-017's rate limit; blank = the service default, `0` = no
  limit (CWF-007 streaming's opt-out).
- ~~**`impersonate()` writes `_Session` rows with `expiresAt` that `findSession` never reads**~~ —
  ✅ fixed `edb8661b` (previous session). `findSession` now judges the row (`users.ts:111-113`).
  ⚠️ The care went into the *other* direction: every session this backend has ever minted has a null
  `expiresAt`, so absent/null/unparseable must mean **never expires** — reading absent as expired
  would have signed out every account on every existing backend at deploy. **Still open and NOT
  covered by that fix**: `impersonate()` writes a `user` *pointer* where this backend reads `userId`,
  so its rows would not resolve to a user even once found. That is a `noodl-viewer-cloud` change and
  has no owner.
- ~~**`fireWorkflow` never calls `recordTriggerFire`**~~ — ✅ fixed `edb8661b` (previous session).
  `dispatcher.ts` now pairs **every** `registry.recordFire` with exactly one `recordTriggerFire` of
  the same verdict (`:228`, `:284`, `:322`, `:375`) — an invariant written into the module doc.
- 🔴 **NEW — [FH-024](phase-42-first-hour/FH-024-THE-LOCAL-ADMIN-API-IS-CROSS-ORIGIN-READABLE.md):
  any web page can read a developer's local backend admin API.** Filed 2026-08-06, **needs a
  decision from Richard, candidate alpha-blocker.** `devOpen` defaults true → every admin gate
  returns early with no token checked; CORS defaults to `origins: ['*']` and is applied before
  routing. So `GET http://127.0.0.1:<port>/admin/*` is unauthenticated *and* answers
  `Access-Control-Allow-Origin: *`. The deploy interlock is correct and deployed backends are
  unaffected — the error is treating `loopback` as "only the developer can reach this". **OBS-004
  was this exact bug.** F10 made it live all session by starting the backend on project open.
  ⚠️ Confirmed by construction, **not yet driven** — slice 0 is the real cross-origin `fetch`.
- ~~The Execution History panel's empty state says a function call is recorded "not node by node"~~
  — ✅ fixed `98096162`. It now names the case the reader is in ("this call reached none"), which is
  true whether or not the function has a Log node.
- **Badges stay `pointer-events: none`** even now HUD-003 gives the click a destination. Revisit
  only if the canvas grows hit-testing.

---

## Phase 40 — AI authoring quality

This is the **largest remaining block** and it is a dependency chain, not a list.
`AAQ-005 → AAQ-006 (Strands harness) → AAQ-007 (the agent sees its work) → AAQ-008/009/010`.

| Task | State |
|---|---|
| **AAQ-005** — one authoring substrate | Slices 1–3 built and green. **Criteria 3 and 4 are not started**, and the multi-component *tool set* is still two shapes deliberately (`SURFACE_DIVERGENCES`). |
| **AAQ-006** — the agent harness | Not started. Engine choice (Strands) is settled and recorded so it is not relitigated. Depends on AAQ-005. |
| **AAQ-007** — the agent sees its work | Not started. **F6 is a prerequisite, not a footnote**: authoring a 55-node component costs 6m51s of editor main-thread time against a zero-latency provider. |
| **AAQ-008** — components by default | Not started. Depends on AAQ-005/006. |
| **AAQ-009** — a bespoke visual identity per project | Not started. Fully bespoke tokens, not presets — decided. Prompt-encodable parts can land early. |
| **AAQ-010** — the whole styling surface | Not started. Blocked on AAQ-009 + AAQ-007 + **F14** + **AIB-010** (which lives in phase 38). |
| **AAQ-001** — a created page is reachable | **CLOSED 2026-08-06 (`d2b1077b`).** Criteria closed live; the one thing owed — promoting `PageWithoutPageNode` to blocking (**F7**) — is done. The "57 sites across 15 files" estimate was ~3.5× too large: 41 specs in 8 files went red, 16 fixture sites fixed it. |
| **AAQ-003** — authored apps scroll | Criterion 2 is not driven; needs a second brief, to take with the engine work. |
| **AAQ-004** — the conversation is kept | Mechanism A built and under test. **Mechanism B sits with AAQ-006.** F3 is the decision inside its fix review. |

**Open F-rows that are plain bugs, no decision needed** — good parallel-agent fodder:

- ✅ **F9 — closed `339b3009`.** The clear went into `_reportReset` and withdraws every reset
  diagnosis the current pass did not reach; a genuinely empty Router still warns. The HANDOVER
  contradiction was resolved in the same commit — the row was right, it was never a product
  question.
- ✅ **F8 — closed `61579634`.** `collectBackendSummary` reads the built-in backend's cached schema
  through `builtInSchemaCollections`. Outcome 3 narrowed rather than being replaced; **one** spec
  asserted the four-outcome shape, not three, and `DatabaseSchemaExtractor` needed no wiring.
- ✅ **F11 — closed `1da7a13e`.** The row was right about the line and incomplete twice:
  `requireRunning` throws the *same* message for a missing id, an unknown id and a **stopped**
  backend, so **four** situations reached one "Failed to load tables"; and the propless mount comes
  from the hot-reload handler and `useSetupSettings`, not a plain sidebar click. A pure
  `schemaFailure.ts` discriminates them. **Auto-select was deliberately rejected** — this surface
  deletes rows, so the empty state offers the backends as buttons instead of silently targeting one.
- ✅ **F1 — closed `1e20488f`.** Not "hardcoded to dark tokens": a **token-tier mismatch inside one
  rule** — a `--base-color-*` primitive background under a `--theme-color-*` foreground. Measured
  **1.29:1** light. One singleton, three drag surfaces, and **two twins in the same file**
  (`.popup-layer-toast`, still reachable from `EditorClipboard.ts:267`, at 1.92:1).
- ✅ **F2 — closed as superseded**, both halves driven: FH-013 killed the label truncation, FH-005's
  `flushSync` fixed the popout. It had been fixed for a day while the row said otherwise.
- **F6** — the 6m51s authoring cost. Not a decision; it gates AAQ-007. **Still the only open F-row
  that is a plain bug**, and it is the one blocking the AAQ chain.

---

## Phase 39 — alpha polish

**The register hygiene is done** (`d7258ae2`): the stale `(N residual)` tags corrected against their
own bodies, the headline reconciled at **18 numbered tasks / 18 files, no gaps**, `Status:` lines
added to POL-001/002/003/014/015, POL-010's two `## Status:` headings disambiguated, and POL-005's
stale "filed, not fixed" prose rewritten. **POL-018** was created for POL-010 slice 2, which had
been deferred with no row — the exact failure POL-016 exists to prevent, inside the phase that
adopted the rule.

What is actually left:

- ✅ **POL-017 — closed `47a5987e` + `7b9440b8`.** ⚠️ **The gutter had already been fixed** by
  `00adecd5` (a commit about the linter) a day before, while the task file still said *filed, not
  fixed*. The real remaining defect was one level up: `TextType.Shy` mapped straight to `fg-muted`,
  so criterion 4's *second* element (the change-summary line, 3.93/3.62) failed — fixed at the token
  mapping, which **257 call sites in 59 files** inherit. `Icon`'s `is-variant-shy` deliberately
  stays at `fg-muted` (a non-text graphic is 1.4.11 at 3:1; raising it would mirror the POL-016
  mistake). **Owed:** `pol004-doc-diff.js` has not been re-run, and POL-017 says so rather than
  claiming a green harness.
- 🆕 **POL-019 — the topbar did not fit** (`fc623918`). Found by driving. Three parts: `.LeftSide`
  could shrink but `.UrlBarWrapper` had `min-width: 300px` and no `overflow`; `.RightSide` declared
  no flex and was spared by accident; and `isSmall < 850` **matched nothing** — the roomy layout
  needs 1007px and the compact one 705px, a **157px dead band** that the Settings panel misses by
  six pixels. At 858 (the backend surfaces' shipped default) the route pill sat entirely inside the
  right cluster. Also removed a `container-name` with no `container-type` — inert.
- **POL-018** — provenance topology from `ProjectModel`. Deferred by Richard's decision; now has a
  row and a file, with the two open questions it carries (component scoping; component instances)
  written as questions rather than assumed. ⚠️ Its blast radius **grew after the deferral**:
  `RecordingOverlay` (HUD-001/002) is a third consumer now, and a project-sourced topology contains
  nodes with no runtime existence — while a badge is a claim that something *fired*.

---

## The live-QA debt — mostly paid, and what is left

**Done 2026-08-06 (second session).** HUD-001…004, FH-011, MCP-001/003, FH-020+FH-022 and the cloud
vocabulary were driven in the running editor against the **NodeGX QA Fixture**, both themes, across
two full restarts. The evidence table is in
[`phase-42-first-hour/README.md`](phase-42-first-hour/README.md) § *The live-QA pass* — read that
rather than re-driving them.

**Still owed**, and each needs a *fresh* editor session because the state is one-shot:

1. **HUD-003 criterion 2** — clicking a root with the Provenance panel **never opened this
   session**. Opening it first destroys the test, which is what happened.
2. **HUD-001 step 2** — Record pressed with **no preview running** (the pill must stay on `Record`
   and say so). The preview auto-restores on open, so you must stop it first.
3. **FH-011's preview-reload re-arm**, and **HUD-004's crashed-agent (slice 3) and legacy paths**.
4. **FH-010** (the VC dialogs), **FH-019** (completions in a Function vs an Expression popout — the
   two `Noodl` objects differ), **FH-023** (the four prefabs).

**Restart the editor; do not trust HMR** — it will not reach an already-mounted panel, and several
of these are mount-effect wiring. **Check both themes.** Use the `run-editor` skill.

⚠️ **Driving traps found the hard way, all of which cost time:**

- **Verify which project actually opened, by name, before believing anything.** Clicking a launcher
  card by walking up from matched text opened the *wrong* project, and a full HUD scenario was then
  driven against one whose `Home` is a single `Page` node — producing a legitimate-looking
  "0 events" that reads exactly like a broken feature. Confirm with
  `ProjectModel.instance.name` through the webpack module cache.
- **The preview can legitimately show a different app than the project you opened** — a dev launch
  opens the example project, and that project on disk has been rewritten by an earlier AI session
  into a puppy app while keeping the title *"Hello World Project"*.
- **`nodegx-observe`'s MCP handshake races its own startup**: it connects to the relay *before* it
  wires stdin, so an `initialize` sent immediately is dropped and looks like a broken server. Wait
  for its readiness line on **stderr**.
- **The fixture's `/erg-rig` was never laid out** — six root nodes report `getNodeBounds → (0,0)`,
  so their badges pile on one pixel and the canvas draws the nodes overlapping too. That nearly got
  filed as a badge-deduplication bug; `data-node-id` proved one badge per node. Good for signal QA,
  useless for judging layout by eye.
- **Each `npm run cdp` costs ~1.5s of node startup**, so a loop of clicks is seconds apart and a
  3-second badge fade will be over before an "immediate" read lands. Collapse click-then-measure
  into one shell call.

Full notes: `live-qa-driving-traps-2026-08-06` in the orchestrator's memory, and the corrected
`nodegx-qa-fixture` entry.

⚠️ **One packaging item a human must verify**, from MCP-002:

```
npm run build:editor        # starts with lerna clean; not cheap
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/noodl-mcp"
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/nodegx-observe"
node ".../Resources/nodegx-observe/nodegx-observe.cjs" --version
```

Watch the log for `file source doesn't exist` — **electron-builder only warns on a missing
`extraResources` source and ships the app anyway**, which is how every published artifact has
probably been missing `Resources/nodegx-backend/cli.js`.
