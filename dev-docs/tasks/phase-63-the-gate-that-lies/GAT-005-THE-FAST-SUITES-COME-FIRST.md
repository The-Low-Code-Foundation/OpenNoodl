# GAT-005 — The fast suites come first

**Status:** 📋 open · **Tier 3: structure** · depends on GAT-004 landing first

## The observation

Everything built in the phase-61 session on 2026-08-12 — four tasks, ~90 new specs — was gated by
**jest**, which runs `noodl-core-ui`'s 21 suites and 337 tests in **13–37 seconds**. The Electron
jasmine suite, which takes twenty-plus minutes, covers `noodl-editor` and could not see most of that
work at all.

The session ran the slow suite four times and the fast one about twenty. Only the slow one is treated
as "the gate".

## What is on disk

| Package | Runner | Scripts | Roughly |
|---|---|---|---|
| `noodl-core-ui` | jest | `test` | 21 suites / 337 tests, ~15 s |
| `noodl-runtime` | jest | `test` | recorded at 132 suites / 2,462 tests |
| `noodl-viewer-react` | jest | `test` | recorded at 67 suites / 892 tests |
| `noodl-editor` | jest **and** jasmine | `test`, `test:main`, `test:ci` | `test:main` recorded at ~108 suites / ~1,492; `test:ci` is the 2,700-spec Electron suite |

⚠️ **The recorded numbers above are from earlier sessions and this repo has a standing rule that they
drift.** Re-measure before quoting them; the rule exists because two handovers in a row published a
`test:main` total that was wrong.

## §1 — Name the tiers, and make the fast one the default

The proposal is not "run less" — it is **run the cheap thing first and fail early**:

- `test:fast` — every jest suite across packages. Parallel, seconds to a couple of minutes.
- `test:ci` — unchanged, the Electron jasmine suite.
- a wrapper that runs fast-then-slow and stops at the first failure.

⚠️ **This is a convenience, not a permission to skip the slow suite.** The failure this invites is
somebody running `test:fast`, seeing green, and merging — so whatever the wrapper is called, the thing
that says "safe to merge" must be the one that ran everything.

## §2 — ⚠️ Change-scoped selection is the risky half, and may not be worth it

The tempting next step: skip the Electron suite when the diff does not touch `noodl-editor`.

**Do not build this on an import-graph guess.** Two things in this repo make it unsafe:

- `noodl-editor` imports `noodl-core-ui`, so a "core-ui only" change *can* break editor specs — this
  session changed `JavaScriptEditor.tsx` and `CodeEditorType.ts` in the same breath more than once;
- the suite already grades **uncommitted files in the working tree**, including a sibling session's,
  which has moved the total by +20 before now. A scope computed from `git diff` does not describe what
  the run will actually grade.

If it is built at all, it should be conservative — an allow-list of paths that *definitely* cannot
affect the editor suite, defaulting to running everything. ⚠️ And the default when the rule is unsure
must be **run the slow suite**, not skip it.

The honest recommendation: do §1, and treat §2 as a separate decision once §1 has been lived with.

## §3 — One command that says what to trust

The deeper problem this session hit is not speed, it is that *"is the tree good?"* has no single
answer. There are two runners in one package, four packages with suites, a gate that can lie
(GAT-001), and a readout nobody reads (`test-results.json`).

Whatever §1 produces should print, at the end, one block naming: which suites ran, their totals, and
where the machine-readable results are. ⚠️ Totals, not just pass/fail — this repo's own rule is
*"compare the total, not the failure count"*, because a gitignored build artefact once made whole
suites vanish silently.

## Acceptance

- A single command runs every jest suite in the repo and reports per-package totals.
- It fails fast, and a failure names the package and the suite.
- The slow suite is still reachable and still the thing that gates a merge.
- ⚠️ The per-package totals are **measured on the day** and written into the task file, not inherited.
- If §2 is built: a change touching only an allow-listed path skips the Electron suite, and the
  allow-list defaults to *not* skipping.

## Register

| # | Finding | State |
|---|---|---|
| G23 | `noodl-core-ui`: 21 suites / 337 tests in 13–37 s | ✅ measured 2026-08-12, repeatedly |
| G24 | The phase-61 work was gated almost entirely by jest; the Electron suite could not see most of it | ✅ observed across the session |
| G25 | Per-package jest totals for runtime, viewer-react and editor | ⚠️ **inherited from earlier sessions, not measured today.** Re-measure |
| G26 | `test:ci` grades uncommitted working-tree files, so a `git diff`-derived scope is not what runs | ✅ standing repo knowledge, observed again this session |
| G27 | Whether any jest suite depends on the Electron build having been produced | ⚠️ unverified — `noodl-viewer-react`'s `pretest` runs `build:types`, which has broken a suite's ability to *start* before |
