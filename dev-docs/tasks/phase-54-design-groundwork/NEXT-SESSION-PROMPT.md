# Phase 54 — the next session

**Written:** 2026-08-11, at the end of a three-worktree parallel session run **beside a live phase-60
session**. That constraint shaped everything below: no gate that launches Electron was run, because
`test:ci` and `dev:*` kill by checkout and would have reaped the sibling's work.

**Read [TASKS.md](TASKS.md) first** — its correction table overrides the README's register, and two
more rows are now stale (see §5).

---

## §1 — What exists, and where

Three branches, **none merged to `cline-dev`**, all based on `80868946`:

| Branch | Commits | What landed |
|---|---|---|
| `dsg-004` | `6b8bdc44` → `5e03d9f8` (7) | three gates + the calibration corpus scripts |
| `dsg-005` | `a96e70df` → `191b9ee5` (4) | 18 compositions on the style vocabulary |
| `dsg-007` | `75fc129f` → `b41e96df` (5) | F2 fixed both sides, F30 root-caused and fixed |

A trial-merge worktree exists at `wt-trial54` (`6fc35d80`) holding all three **plus** the current
`cline-dev` tip. ⚠️ **It lives under a session-scoped scratchpad and may be garbage-collected — the
branches are the durable artefact.** Rebuild it with the recipe in §6 if it is gone.

## §2 — The gates that were run, with numbers

Measured on the trial merge **against the current tip `6e27f741`**, not against the agents' base —
the sibling landed SIG-003 mid-session, including a regenerated node catalog.

| Gate | Result |
|---|---|
| merge of all three + `cline-dev` | clean, **0 conflicts**; `comm -12` shows zero file overlap between any pair, and none with the sibling's 130 files |
| `typecheck:editor` / `typecheck:editor-tests` | exit 0 |
| `catalog:examples` | 57/57 strict, warnings-as-errors |
| `catalog:generate` → `git diff` | **empty** — the merged catalog is byte-identical to regeneration |
| `noodl-mcp` jest | 29 suites, 305 passed, 2 skipped |
| `test:main` — **merged** | **118 suites / 1644 tests, 0 failed** |
| `test:main` — **baseline @ `6e27f741`** | **115 suites / 1611 tests, 0 failed** |

⚠️ **`test:main` is safe beside a sibling session but NOT safe beside itself.** Running the baseline
and trial concurrently invented 1–2 failures **in a different suite each run** (`relay-auth`,
`reasoningChannel` — both port/timing-sensitive), and I briefly reported `cline-dev` as red on the
strength of two runs that agreed because they shared the confound. Serialise the comparison; re-run
any red suite **alone** before attributing it to a diff.

## §3 — The one blocking gate: `test:ci` has NOT been run

This is the first thing to do **in a session that owns the checkout**.

- `packages/noodl-editor/tests/models/ProjectIdentity.test.ts` (DSG-007/F30) — jasmine, barrel-exported
  in `tests/models/index.ts` (a spec absent from its barrel never runs), typechecks clean, **assertions
  never executed**. `test:main`'s jest `testMatch` covers only `tests-main/` and `tests-unit/` and
  cannot reach `tests/`, so there is no fallback.
- DSG-004's promotion of `uncollapsible-multi-column` to authored-blocking also needs one jasmine run.

**Until `test:ci` is green on the merged tree, F30 is fixed-and-unproven and F2 is not closed.**
Confirm the checkout is quiet first (`ps` for `electron/dist`, `webpack.test-ci`, `scripts/start.ts`;
poll for a *sustained* window, never `dev:stop` — it kills by checkout and also matches a running
`test:ci` Electron).

## §4 — Work that needs neither the editor nor the shared branch

Ordered by value. All of this is worktree-safe beside a live sibling.

1. **DSG-006 §3 — the design rubric.** ⭐ **The best available task, and it costs nothing.** The
   phase-55 replays already rendered their artefacts: `dev-docs/tasks/phase-55-llm-authoring-support/measurements/`
   holds desktop+phone PNGs for haiku, qwen, sonnet, deepseek and kimi, and `score-run.js`
   reproduces the structural numbers off disk. The design half was **judged, never scored**. Build the
   per-criterion rubric in §3's table and score the *existing* artefacts — **no paid drive, no
   editor**. ⚠️ Publish the row per criterion, never a single verdict; phase 58's exit test hid its
   one failing criterion behind one green summary.
2. **Decide `--border-control`** (DSG-005's finding). The doctrine at
   [`design.ts:134`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design.ts)
   prescribes it at 3:1; it is defined in **no token set**, so `border-color` falls back to
   `currentColor` — the exact defect the sentence exists to prevent. No border token reaches 3:1
   (`--border` 1.23, `--border-subtle` 1.10, `--border-strong` 1.48). A model **has already emitted
   it** in a real drive (`s9-awp006-deepseek-transcript.jsonl`), and it is live in
   `docs/node-catalog/examples/ui-split-hero.json`. **Richard's call:** define the token, or rewrite
   the doctrine sentence and the recipe. Do not do both halves from model taste.
3. **The gate that would have caught it.** `catalog:examples` validates types and connectivity but
   **not parameter values against the token set** — the same "nothing validates parameter values" gap
   the phase-38 register carries. This is DSG-004-shaped work in `scripts/validate-examples.ts`,
   needs no editor, and closes the class rather than the instance.
4. **DSG-003's five remaining recipes** — ⚠️ only from a **measured** DOM. The three that were not
   measured shipped the defect they were teaching against (F23). `scripts/devtools/render-from-disk.js`
   and `measure-from-disk.js` exist; **check whether either needs a browser this session can legally
   launch** before planning around them.
5. **Spec F33** (a copied project directory inherits its parent's id). Deliberately not built: it
   needs a new persisted field to know where an id was *minted*, and re-minting may be wrong —
   "duplicate this project, experiment against the same data" is legitimate, so refuse-and-explain is
   plausibly the right behaviour. **That is a UX decision, not a bug fix.** Residual hole to state in
   the spec: a copy of an *unbound* project, provisioned under a matching backend name, now reuses the
   original's backend.

## §5 — Register hygiene, and a collision to fix

⚠️ **`F25` is claimed twice.** `DSG-006`'s register already uses it for *"the design half has no
per-criterion score"*; `NOTES-DSG-005.md` claims it for `--border-control`. Phase-54 numbering runs
F1–F29 in the task files and the new notes claim F30–F34, so **renumber the `--border-control`
finding to F35** when the notes are folded into the register.

Also stale now: DSG-007's re-verification **withdrew F28** — the two `Stock Cupboard Backend`s on
8583/8584 are phase 58's two paid experiment arms, each correctly owning its own database. That was
the rule *working*, and acting on it as stranding would have destroyed an arm's data. TASKS.md's F2
correction row still describes it as the defect's second witness; fix that row.

**The §5 migration of the seven stranded projects stays unexecuted.** Two preconditions: run it only
on a build carrying F30 (an older installed binary still deletes `id` on save), and only after the
jasmine spec has actually run. Two entries need a human — `Puppy test` and `test1` both point at
8578, and `BCN009 QA` (8579) has no claimant.

## §6 — The parallel recipe that worked, verbatim

Do **not** use `isolation: "worktree"` on this repo — the harness roots those at `origin/main`,
hundreds of commits stale, 7-for-7 batches. Build them:

```
git worktree add -b <name> <scratchpad>/<name> cline-dev
```

then a **real** `node_modules` dir containing one symlink per entry of the primary's `node_modules`
(skipping `@noodl`), plus a **real** `@noodl/` dir whose entries point at the **worktree's**
`packages/*`, plus a symlink per `packages/*/node_modules`. Verify before launching anyone:

```
node -e "require.resolve('@noodl/runtime/package.json',{paths:['<wt>']})"
```

It must return a path **inside** the worktree; if it names the primary checkout, the dual-load trap is
armed and you will get a whole suite of false failures. All four worktrees this session resolved
correctly first time and landed on the right tip with no reset dance.

**In every agent prompt:** primary checkout read-only; no `npm install` (the symlinks would mutate the
primary's modules); no `dev:*` / `test:ci` / `dev:stop` / Electron; no `lerna exec` gates (they grade
the **primary** checkout's source, not the worktree diff); jest from the package dir, never the repo
root; path-limited incremental commits with a task-id prefix; its own `NOTES-<task>.md` and hands off
`TASKS.md`/`README.md`.

**Fence shared *design*, not only shared files.** All three branches were file-disjoint by
construction, but 004 and 005 both sit downstream of `design.ts` and were told to flag before editing
it — which is why there is nothing to reconcile. DSG-007 was told to grep for the **existing**
ownership-identity scheme rather than invent one, because two agents inventing rival backend spawn
records is a mistake this repo has already paid for.

## §7 — What the agents got right that the specs did not

Worth reading their notes before trusting any spec row here. Each of the three **refuted** part of its
own brief, and in two cases acting on the spec as written would have caused damage:

- **DSG-007** withdrew F28 (above) and found the *actual* root cause, which was absent from the spec:
  the editor minted an id and deleted it at both ends of the round trip — `toJSON()` never emitted it,
  so `buildProjectV2File`'s `if (project.id !== undefined)` was dead code on **every** v2 save. That
  one fact explains every row of the spec's disk table.
- **DSG-004** refuted §2.4's premise: hover *is* expressible via MCP's passthrough but is not in
  `AUTHORED_NODE_FIELDS`, so the gate would have rejected 100% of what it judged for something the
  author cannot write in the editor's loop at all. Filed as a vocabulary change, not built.
- **DSG-005** found that the doctrine ships the defect it forbids, and correctly refused to edit
  `design.ts` to fix it while a sibling was downstream of that module.

The pattern is the phase's own thesis turned on itself: **prose loses.** Grep the code before quoting
a spec row, including the rows in this file.
