# Next session — the prompt

**Written 2026-08-06**, at the end of a day that shipped 23 phase-42 tasks across 20 parallel
agents. Covers everything still open in **phase 42** (first hour), **phase 40** (AI authoring
quality) and **phase 39** (alpha polish).

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
  batch so far has left something the individual gates could not see.
- Tell every agent the task docs are **researched but not infallible** and to verify at file:line.
  Across three batches roughly two premises per doc were wrong, and several specified
  implementations would have broken the feature they specified. Have them fix the doc line.

**Gates, and their current baselines (all green at `HEAD` as of 2026-08-06):**

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests
npm run catalog:check && npm run cloud-library:check && npm run catalog:merge:check
npm run library:check                       # 58/58
npx lerna run test --scope @noodl/runtime           # 2284
npx lerna run test --scope @noodl/cloud-runtime     # 172
npx lerna run test --scope @noodl/nodegx-backend    # 86 suites / 887
npx lerna run test --scope @noodl/observe           # 23
npx lerna run test --scope @noodl/mcp               # 161
npm run test:ci                             # Jasmine: 2295 specs, 0 failures
```

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
  **7,196 parameters on 2,908 nodes across 55 of 81 real projects** — 29% of the class. ⚠️ Two things
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
  next launch. Unowned.
- **AAQ-011 F13 → yes, `noodl-mcp` may provision backends.** Decided 2026-08-06, on the ground that
  an external agent must be able to build a full-stack app end to end. What that opens is the design
  work — lifecycle, ports and secrets ownership — and **it inherits F10's no-orphans constraint**,
  in the harder form: an MCP sidecar has no window to close and no quit event. Unowned.
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

- **`runRetentionCleanup()` / `cleanupByAge` have zero call sites** — nothing trims the
  execution-history table today.
- **`Array Filter`'s `enabled` and `Array Map`'s `mapScript` are inert `default`s** — a
  hand-authored filter passes *everything* through. Affects the browser identically, so the fix
  is a behaviour change and wants its own task.
- **CWF-009 has no admin route**, so an editor Secrets panel has nothing to call.
- **CWF-018's `timeoutMs` has no row in the Permissions panel.**
- **`impersonate()` writes `_Session` rows with `expiresAt` that `findSession` never reads** — an
  "expiring" impersonation session never expires.
- **`fireWorkflow` never calls `recordTriggerFire`** — workflow-target fires are missing from
  trigger metrics.
- The Execution History panel's empty state says a function call is recorded "not node by node" —
  true only for a function with no Log node.
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
| **AAQ-001** — a created page is reachable | Criteria closed live. One thing owed: promote `PageWithoutPageNode` to blocking (**F7**) — 57 fixture sites across 15 spec files. |
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
- **F11** — the Data Browser's first open reports "Failed to load tables" (an undefined
  `backendId` rendered as a broken backend).
- **F1** — light mode: a component dragged from the component menu is a dark pill with dark text.
  Mechanism unverified.
- **F2** — the custom-CSS property row label clips to "CSS …", and the popup CSS editor opens
  downward and overflows. Mechanism unverified. (Note FH-005 already fixed the *popout* flip for
  the code and JSON editors — check whether that covers half of this.)
- **F6** — the 6m51s authoring cost. Not a decision; it gates AAQ-007.

---

## Phase 39 — alpha polish

Nearly closed. What is actually left:

- **POL-017** — every code editor's line numbers are below the text contrast floor. Filed, not
  fixed, not alpha-blocking. The replacement token is already measured (`fg-default-shy`,
  4.82/4.67). ⚠️ **Its own criterion 4 is wider than its proposed answer**: it demands zero text
  nodes below 4.5:1, and the measurement table lists a second failing element (the change-summary
  line, 3.93:1 / 3.62:1) with no token proposed. Fixing only the gutter will not meet it.
- **POL-010 slice 2** — provenance topology sourced from `ProjectModel` rather than the preview.
  Deferred by decision, but it has **no row and no task file** — which is precisely the failure
  mode POL-016 exists to prevent, unfixed inside the phase that adopted the rule. Give it a row.

**Register hygiene, worth 20 minutes** (this phase has a documented history of a register that
lied, so this is not cosmetic):

- POL-002 `(1 residual)`, POL-004 `(2 residuals)` and POL-005 `(1 open question)` all carry tags
  whose own bodies say the item is closed. POL-005's still reads "Richard's call whether that
  matters" when the answer is in the same file.
- `PROGRESS.md` contradicts itself three lines apart: headline "16 of 16 done" vs "there are 15
  numbered tasks, not 16 — a miscount". There are 17 `POL-*.md` files on disk.
- POL-005's "three findings — filed, not fixed" section is stale prose; all three are closed.
- POL-001/002/003/014/015 carry **no `Status:` line at all** — the register is the only claim of
  doneness, and it is the thing that has lied before.
- POL-010 has two `## Status:` headings in one file (`DONE` at :30, `DIAGNOSED` at :89) with
  nothing saying the second is a historical stratum.

---

## The biggest debt: nothing has been driven in the editor

**Twenty-three tasks shipped on 2026-08-06 and not one was verified in the running app.** Every
task doc carries its own live-QA recipe. This is the highest-value thing the next session can do
and it cannot be parallelised across agents the way building was — the editor is a queue, not a
resource to seize.

Priority order, because these are the ones where a test genuinely cannot see the answer:

1. **HUD-001…004** — the recording overlay, badges lighting up as nodes fire, expand → walk, and
   the per-peer trace ownership. **HUD-004's data-loss fix needs `nodegx-observe` on the same
   relay** (rebuild it first: `npm --prefix packages/nodegx-observe run build` — it runs from
   `dist/`). The recipe for proving the data loss is gone is at the foot of HUD-004.
2. **FH-011** — Record with no walk on screen, and across a preview reload.
3. **MCP-001** — copy both commands, run them from an unrelated directory, then **restart the
   editor** and query the observe server. That restart is the whole point of MCP-003.
4. **FH-020** (the Ports tab), **FH-019** (completions in a Function vs an Expression popout — the
   two `Noodl` objects differ), **FH-010** (the VC dialogs), **FH-023** (the four prefabs).
5. **The cloud vocabulary** — open a cloud-function canvas and confirm the 81 node types are
   really there and the browser picker is unchanged.

**Restart the editor; do not trust HMR** — it will not reach an already-mounted panel, and several
of these are mount-effect wiring. **Check both themes.** A dev launch rewrites the example
project — revert it afterwards. Use the `run-editor` skill.

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
