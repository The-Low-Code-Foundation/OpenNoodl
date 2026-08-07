# Next session — the prompt

**Written 2026-08-06**, at the end of a **sixth** session the same day. **The next session's job is
to finish the alpha launch** — phase 33 — rather than to keep widening phases 40 and 42.

The reason for the change of aim is in phase 33's exit criterion, which nothing so far has moved:

> A person who has never seen NodeGX can, on any of the three platforms: **download a build their OS
> lets them run**, **reach a working app of their own without asking us anything**, and **when
> something breaks, tell us in a way we can act on** — each demonstrated by *someone who is not
> Richard and did not build it*.

Six sessions of engineering have made the product better and have not touched a single one of those
three. **The remaining work is mostly not engineering**, which is exactly why it keeps being
deferred in favour of tasks that are.

## What the SIXTH session did, so you do not redo it

Six parallel agents on disjoint file sets. Gates re-run **by the orchestrator on the settled tree**,
never taken from an agent's report:

`typecheck:runtime|cloud|viewer|editor|editor-tests` **clean** · `catalog:check`,
`cloud-library:check`, `catalog:merge:check` **up to date** · `library:check` **58/58** · runtime
**2298** · cloud-runtime **172** · nodegx-backend **97 suites / 1056** · observe **23** · mcp
**196** · **`Jasmine: 2391 specs, 0 failures`** · `test:main` **693 passing, 2 suites red** (both
another session's uncommitted `erg-005` — see the warning below).

| Task | Outcome |
|---|---|
| **CWF-016** slices 2–4 | **CLOSED.** Idempotency store, endpoint, editor door |
| **CWF-004** S6 | **CLOSED.** "New cloud function from this step"; Aggregate decided and not built |
| **CWF-007** | All four questions decided — now a scheduled build, not a design doc |
| **AAQ-011 F12** (editor half) | **CLOSED.** It *was* a live defect, measured before any fix |
| **AAQ-005** criterion 3 | **MET.** Multi-component changeset, one undo group |
| **FH-025** | **CLOSED.** The prefab row was stale on arrival |
| `impersonate()` · node-id-`add` | Both **CLOSED** |
| **FH-024** live QA | **A regression found and fixed** — see below |
| **POL-017** | **CLOSED** — the harness was re-run, not derived. Phase 39 is 18 done, 1 deferred |

### The five things worth carrying

1. 🔴 **FH-024's own fix shipped a regression, and only driving it found that.**
   `ExecutionHistoryManager` fetches `/executions` **directly** instead of through
   `ServiceSupervisor.request` — the one admin caller in the editor with no bearer token — so the
   Execution History panel was dead in both directions the moment `devOpen` stopped relaxing the
   admin gate. Exactly the shape the doc warned about from the other side: an `admin` route that does
   not start with `admin/`. **The general lesson: a security fix's blast radius is every caller, and
   the callers that do not go through the shared client are the ones you will not think of.**
2. ⚠️ **`test:main` is a PR CI gate and nothing watches it.** It was red **two different ways** on
   one day, and *both* were found by agents running it for unrelated reasons. **A jest suite that
   fails to compile reports `Tests: 0 total`, not a failure** — `workflowChangeSet` had been silently
   absent since CWF-005. Add it to your gate sweep and compare the **passing count**, not just the
   failure count.
3. **A register row is a claim until you re-measure it.** FH-025's row was **stale on arrival** —
   FH-023 shipped the repair the same day the row was filed. That is the **fifth** time this register
   has outlived its own fix. Conversely `candidate.ts` was filed as a *question* and turned out to be
   a live defect worse than described. **Neither direction is safe to assume.**
4. **Per-slice commits worked — nothing was lost this time.** But the mirror-image trap appeared:
   **`git commit -- <path>` is no protection when two agents write the same file.** One agent's
   register row was swept into another's commit seconds after it was written. Treat shared registers
   as a serialisation point and **consolidate them yourself at the end**.
5. **CWF-016's own slice-1 design was wrong in three places, one silently.** "Ride
   `ExecutionHistory.prune()`'s existing sweep so there is no fourth timer" would have swept
   **nothing** on a backend set to keep executions forever. A decision written into a doc before the
   code is still only a hypothesis about the code.

---

Paste the block below into a fresh session.

---

Finish the **alpha launch** (phase 33) for OpenNoodl/NodeGX. Work on `cline-dev`, commit straight to
it, no branches and no PRs.

Read these first, in this order:

1. `dev-docs/tasks/phase-33-alpha-launch/README.md` — the phase and its **exit criterion**, which is
   the only definition of done that matters here.
2. `dev-docs/tasks/phase-33-alpha-launch/HUMAN-GATED-ITEMS.md` — **the most important file in this
   handover.** Three of the seven tasks are not engineering, and everything else is downstream of
   them.
3. `dev-docs/tasks/phase-33-alpha-launch/PROGRESS.md` — task status and the F63–F75 findings register.
4. `dev-docs/tasks/phase-39-alpha-polish/PROGRESS.md` — 18 done, 1 deferred. ⚠️ Its `HANDOVER.md` is
   **superseded — do not work from it.**

## ⚠️ Read this before planning anything

**The alpha is not blocked on engineering.** It is blocked on a short list of things only Richard can
do, and a longer list of things an agent can build *around* them. If you spend the session building
and none of the human items move, the alpha does not get closer. **Put the human list to Richard in
your first message**, then build the agent list while he works through it.

### What only Richard can do — ordered by lead time, and the top one is the long pole

| # | What | Effort | Blocks |
|---|---|---|---|
| **A3** | **Recruit testers who are not Richard** — at least one each on macOS, Windows, Linux, who have never built this project. Plus a clean machine or fresh user account for the cold-install pass. | Days of *waiting* — start first | **The exit criterion itself.** ALPHA-001, ALPHA-002 |
| **A1** | **Export the Apple Developer ID cert and add 5 GitHub secrets.** ⚠️ **This is ~15 minutes, not weeks** — the certificate already exists in Richard's keychain (`Developer ID Application: Osborne Solutions`, team `Y35J975HXR`), and the CI half is already written. Only the app-specific password and the Apple ID are genuinely new. Steps are written out verbatim in HUMAN-GATED-ITEMS A1. | ~15 min | ALPHA-002, and every macOS artifact |
| **B1** | **Publishing entity, contact address, governing law.** `PRIVACY.md`/`TERMS.md` are complete and verified against the source except this, which is a marked TODO — **and both ship inside the binary**. | Minutes | Any build reaching a stranger |
| **B2** 🔴 | **F63 — a hardcoded GitHub OAuth client secret ships in every build.** The fix is a public OAuth client (PKCE) or device flow. This is a decision about which, not a question of whether. | A decision | Shipping a binary at all, arguably |
| **B3** | **A8 — the publish target is `The-Low-Code-Foundation/OpenNoodl` for a product called NodeGX**, so every download URL and the update feed say the old name. A decision, not a defect. | A decision | ALPHA-002 |
| **B4** | **Permission to create the issue labels.** F72: all three issue forms declare `needs-triage`, **no such label exists**, GitHub silently drops it — so every report filed since 2026-07-30 is effectively unlabelled. | Minutes | ALPHA-007 §6 |
| **B6** 🔴 | **Verify the GitHub issue prefill by hand** before any dialog code is written. | Minutes | ALPHA-007 §2 |
| **A2** | **Windows signing certificate — buy, or ship unsigned behind an install guide?** Windows is currently the *only* platform with a complete artifact story, so this is the one place signing changes a working path rather than an absent one. | A decision + possible purchase | ALPHA-002 |
| **B5/B7** | The content origin's disposition; whether a Discord/Discussions exists. | Decisions | ALPHA-006, ALPHA-007 |
| **C1** | An outside reader for `PRIVACY.md`/`TERMS.md`. | Days of waiting | ALPHA-005 criterion 5 |

⚠️ **"Ship unsigned for the alpha" is not the shortcut it sounds like** — Gatekeeper blocks unsigned
macOS builds outright, and the certificate already exists, so taking that route now would be a
*choice*, not a constraint.

### What an agent can build now, without waiting for any of the above

Build in this order. Every one of these is independent of the human list.

1. **ALPHA-007 Part A + B — the feedback loop.** **No prerequisites; it transmits nothing.** Part A
   is a composer that opens a pre-filled GitHub issue; Part B is the labels and a `/triage` skill.
   ⚠️ **Verify the URL prefill by hand before writing any dialog code** (B6) — the task says so and
   it is cheap to get wrong. This is what makes ALPHA-001's findings reproducible by anyone other
   than the person who hit them, so it wants to exist *before* the testers do.
2. **ALPHA-006 §1 — the help panel reads the bundled catalog.** Independently valuable and it
   **closes all 54 undocumented nodes on its own, with no website existing** (F70: 33 `docs` URLs
   point at pages that do not exist, 6 at the wrong path, 15 nodes have no URL at all, and
   `docs-parser.ts:75` swallows the 404 so the panel shows nothing rather than an error).
3. **ALPHA-003 — the log and the crash reporter.** ALPHA-005 is complete, so this is unblocked.
   ⚠️ **Its design changed and the task file says so**: A4 was wrong. Packaged builds *do* write a
   log — `bugtracker.ts` is live in every packaged build and appends to
   `<userData>/debug/log-<date>.txt`, monkey-patching `console.log` and capturing uncaught renderer
   errors. **The task is surfacing and scoping an existing log, not adding one** — and nobody has
   ever told a user it exists or asked their permission.
4. **ALPHA-001 Part A — the cold-install first hour.** Part A can start as soon as the tree is clean;
   **Part B needs a real signed build** and therefore A1. This discharges seven tasks' owed live QA
   in one pass.
5. **F65, F66, F67 — three cheap findings with no decision attached.** Dead cloud config with zero
   consumers shipping in every build; the updater polling GitHub **every 60 seconds forever**
   (~1,440 requests/day from an idle editor); `packages/noodl-editor/package.json` committed
   minified onto one line so every diff touching it is unreadable.

⚠️ **ALPHA-004 (user docs) is genuinely blocked** on ALPHA-006, and **ALPHA-006's remainder** is
blocked on phase 30 Tier 1. Do not start either as a way of looking busy.

### One judgement call to put to Richard early

**Is phase 41 (accessibility) alpha-blocking, or does it follow the alpha?** It is the currently
scheduled phase and he confirmed 2026-08-06 that it stays ahead of streaming — but that was a
question about *streaming*, not about the alpha. The facts: **the runtime emits one aria attribute
and deletes every focus ring**, and eleven side-nav icon buttons have no accessible name. Part B is
retroactive, which is the argument for doing it before a public build rather than after. **Ask;
do not assume either way.**

## How to work

**Run several agents in parallel on disjoint file sets.** What has been learned doing it, six
sessions running:

- **`git commit -m "…" -- <explicit paths>`, never `git add -A`, never stash, never
  `git checkout`/`git restore` a file you did not write.** The one legitimate `git add` is a single
  exact path for a **new** file.
- ⚠️ **Tell every agent to commit incrementally, per slice.** This worked in session six and nothing
  was lost. An agent that has not committed has produced nothing durable.
- ⚠️ **A pathspec commit does NOT protect a file two agents are both editing** — it commits whatever
  that file holds in the working tree. Session six had one agent's register row swept into another's
  commit. **Have agents report their register row and write it yourself**, or consolidate the
  register at the end. Do the latter regardless: it is what catches rows that went stale mid-batch.
- **Serialise anything that regenerates the node catalog.** `catalog:check`, `cloud-library:check`
  and `catalog:merge:check` compare the committed snapshot to the **working tree**.
- ⚠️ **Only one agent may own the Electron editor.** It is a queue, and a sibling `dev:stop` kills
  another session's `test:ci` — that happened again in session six. Also: `npm run test:ci` cannot
  run while an agent holds the editor, so **the orchestrator runs it at the end**.
- **Verify the whole tree yourself at the end.** Every session that did this found something.
- Tell every agent the task docs are **researched but not infallible** and to verify at file:line.
  Roughly two premises per doc are wrong. Have them fix the doc line.

**Gates and their baselines (all green at `HEAD` as of 2026-08-06):**

```
npm run typecheck:runtime|cloud|viewer|editor|editor-tests
npm run catalog:check && npm run cloud-library:check && npm run catalog:merge:check
npm run library:check                       # 58/58
npx lerna run test --scope @noodl/runtime           # 2298
npx lerna run test --scope @noodl/cloud-runtime     # 172
npx lerna run test --scope @noodl/nodegx-backend    # 97 suites / 1056
npx lerna run test --scope @noodl/observe           # 23
npx lerna run test --scope @noodl/mcp               # 196
npm run test:main                           # 693 passing — A PR CI GATE, newly added to this list
npm run test:ci                             # Jasmine: 2391 specs, 0 failures
```

⚠️ **The editor spec count is a shared-checkout number** — treat the **failure** count as the signal.
⚠️ **`test:main` reports `Tests: 0` for a suite that will not compile**, so watch the passing count.
`npm run typecheck:core-ui` is **red on files nobody owns and is not a gate**.
`npm run typecheck:backend-tests` is **not a gate** and reported **22 errors** on a clean tree at the
end of session six — the handover before it recorded "~11 in two test files", so **that baseline is
either stale or was never complete. Establish it before owning anything in it.**

⚠️ **A sibling session still has uncommitted work in this checkout** (`package-lock.json`,
`packages/nodegx-observe/bin/`, `projectmodel*`, `ProjectImporter`, `LocalProjectsModel`,
`featureFlags.ts`, `import-engine/analyze.ts`, `VersionControlPanel/**`, `tests/versioning/**`,
untracked `tests-unit/erg-005/`, plus an untracked `dev-docs/reviews/NODEGX-VS-CODE-A-REAL-APP.md`).
**It has not moved since 2026-08-03. Do not touch, revert, stash or commit any of it.**

🔴 **But it now needs a decision, because it is holding a CI gate red.** The two
`tests-unit/erg-005/` suites fail to compile under `test:main`, which is a PR gate. **If that session
is dead, someone has to decide what happens to its work** — it has been sitting for three days, it
blocks FH-019 slice 3 (which needs `package-lock.json` clean), and it blocks FH-007/ERG-005 §2.
**Put this to Richard.** Do not resolve it unilaterally.

Also dirty and deliberately left alone: `packages/noodl-editor/tests/testfs/import_proj5/project.json`,
a **pure reformat** written by some spec run.

## Richard's decisions — ALL TAKEN, do not relitigate

The standing set (FH-018 delete the Config node · ERG-005 §2 explicit types · NDA-017 per-input
run-on-change **and** its migration · F10 backend-on-open with orphan reaping · F13 `noodl-mcp` may
provision backends · `set_design_tokens` in AAQ-005/AAQ-009 · TALK-001…007 · FH-024 (a)+(b) ·
AAQ-011 F12 narrow fix · AAQ-011 F3 remove the second turn), plus **four taken 2026-08-06**:

- **CWF-004's Aggregate → NOT built.** Aggregation is the only entry in the family table that
  *computes*, and the served *"No arithmetic… Compute in a cloud function"* sentence stays true,
  unedited, in all three places. **The accepted cost, stated:** an in-flight supplier array that is
  never stored still needs a `call-function` hop, because `Aggregate Records` is a database
  aggregation over data **at rest**. Reopening it means editing the served sentence in three places
  **first**.
- **CWF-007 Q1 → channel first.** Survives a reload, works with no caller, inherits the SSE
  transport's auth/reconnect/shutdown. The HTTP-response variant is not ruled out and is not first.
- **CWF-007 Q2 → the authenticated session that started the channel.** The capability-URL option is
  rejected **by name**: it is the OBS-004 relay and the FH-024 admin API pattern, and it would be the
  third instance of one class.
- **CWF-007 Q4 → after alpha.**

⚠️ **The one thing CWF-007's build owes, and it is not a Richard question yet:** Q1 and Q2 **do not
compose.** Q1 was chosen partly because a channel works when *no caller is waiting* — a scheduled
workflow — and Q2 binds read access to a session such a run does not have. *"Who may read a channel
that no session created?"* is written into the task doc with three unranked candidates and an
explicit warning **not to settle it by widening Q2**.

## What is left outside phase 33

Kept short on purpose — **none of it is alpha-blocking**, and the point of this handover is that the
alpha is.

| Where | What is left |
|---|---|
| **Phase 42** | **CWF-006** (triggers + entry step — buildable now, sequence it on the workflow canvas after S6; it will collide in `WorkflowDocument`'s `contextMenuActionsProvider` and `refreshNodeChrome`). **FH-007**/ERG-005 §2 and **FH-019 slice 3**, both blocked on the sibling session. **MCP-004** is a change to the *docs repo*. |
| **Phase 40** | The dependency chain `AAQ-005 → AAQ-006 → AAQ-007 → AAQ-008/009/010`. AAQ-005 criteria 1–3 met; **criterion 4 needs a live external drive** through `noodl-mcp` with the transcript kept. **AAQ-007 is not gated.** AAQ-011 is **14 of 15 closed** — only **F14** remains, blocked on AAQ-010. |
| **Phase 39** | **POL-018** only, deferred by Richard's decision 6. Everything else is done and verified live. |
| **Phase 41** | Opened, not started. **See the judgement call above.** |
| **Post-alpha** | Phases 43–48 exist as folders. **CWF-007 streaming is now phase 45's, scheduled after alpha.** |

## The live-QA debt — what is still owed

Each needs a **fresh** editor session because the state is one-shot. Session six paid four of these
and could not reach the rest.

1. **FH-011's preview-reload re-arm** — attempted twice in session six and **destroyed both times**
   before the after-count could be read. Needs a different approach, not another attempt.
2. **HUD-004's crashed-agent (slice 3) and legacy paths.**
3. **FH-010** (VC dialogs — ⚠️ drive only, another session owns those files), **FH-019**
   (completions in a Function vs an Expression popout — the two `Noodl` objects genuinely differ,
   4 properties vs 19), **FH-023** (the four prefabs).
4. **CWF-004 S6's 15 jasmine specs were written but never run by their author** — the orchestrator's
   `test:ci` covers them at 2391/0, but **the gesture itself has never been driven in a real editor**.
5. **CWF-016's editor door** (the idempotency field in the Permissions panel) has never been seen.
6. **The HUD one-shots passed in dark theme only.**

**Restart the editor; do not trust HMR.** **Check both themes.** Use the `run-editor` skill.

⚠️ **Driving traps, each of which has cost real time:** verify **which project actually opened, by
name**, before believing anything · **`--target=editor` can attach to the launcher** (same file,
first match wins) · **an occluded preview repaints late — reading its DOM is not measuring the
graph** (this cost an hour in session six chasing a defect that did not exist: the Counter read 5
while the DOM read 0) · **an occluded Electron window clamps timers ~1000×**, so pace drivers with
`MessagePort` · a sibling's edit **full-reloads the editor** and kills every one-shot state · each
`npm run cdp` costs ~1.5s, so collapse click-then-measure into one call · `screenshot`/`reload` on
the viewer target are unsafe · the in-editor preview **cannot be closed on its own** — it is a
`<webview>` guest and killing it white-screens the editor.

⚠️ **One packaging item a human must verify**, from MCP-002 — and it matters more now that a real
release is the goal:

```
npm run build:editor        # starts with lerna clean; not cheap
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/noodl-mcp"
ls "packages/noodl-editor/dist/mac-arm64/NodeGX.app/Contents/Resources/nodegx-observe"
node ".../Resources/nodegx-observe/nodegx-observe.cjs" --version
```

Watch for `file source doesn't exist` — **electron-builder only warns on a missing `extraResources`
source and ships the app anyway**, which is how every published artifact has probably been missing
`Resources/nodegx-backend/cli.js`. And per F73: **electron-builder uploads as it goes, so a published
artifact is not evidence of a green job.**
