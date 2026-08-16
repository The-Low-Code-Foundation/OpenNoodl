# Phase 66 — next session

**Written 2026-08-16, session 41.** A rewrite, per §0. s40 closed FIX-004's acceptance 2. **s41 took
the item s40 called the top agent-actionable one — "does the planner over-decompose?" — filed it as
FIX-022, built the instrument, and measured it.** The answer is *yes, and not for the reason anyone
expected*. The measurement also produced a methodological finding that outranks the result: **a
three-sample cell gave the opposite answer and would have been published.**

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
2. **Gate readings with their date and tree**, so the next session compares against a reading it
   can trust. ⚠️ **Mark which ones this session actually took.**
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 007 / 009 / 010 / 011 / 012 / 014 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — twelve tasks |
| **FIX-006** — all four ACs | ✅ | ✅ s39 | **CLOSED — the thirteenth.** ⚠️ Criteria met, *contribution* unmeasured — the control arm passes identically |
| **FIX-004** §A+§B — all five ACs | ✅ s34 | ✅ s40 | **CLOSED — the fourteenth.** AC2's cloud half s40 |
| **FIX-004** §C | ✅ s37 | ✅ s38 | **Seam-category ruling still open** |
| **FIX-005** part 1 | ✅ s34 | ✅ s35 | Criteria 1–3 close, both themes. 🔴 Toolbox half is **dead code**. Part 2 = ruling |
| **FIX-022** — the planner half of the report | ✅ **s41** | ✅ **s41** | **MEASURED.** Defect real (5/10); **doctrine not the cause** (6/10 without it). 🟢 **One ruling owed** |
| **FIX-021** slice 0 | ✅ s34 | 🔴 — | 7 specs. Slices A/B need Richard |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | **Answer ruling 1 first** — see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Fourteen closed outright. Four partial** (008, 016, 017, 022). **Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

✅ **s41 took four, and they cover everything it changed.** It changed **no editor source** — two new
files under `scripts/`, one new spec under `tests-unit/`, and a plumbing extraction within `scripts/`.

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main` (jest)** | ✅ **216 suites / 3363 tests, 0 failed** | **s41** |
| **`tests-unit/phase-66/planDoctrineArm.test.ts`** | ✅ **13/13**; **7/13 red** under a stubbed transform | **s41** |
| **`tsc` over `scripts/aix002-measure/*.ts`** | ✅ **0 errors in harness files** | **s41** |
| **both measurement bundles** | ✅ build clean; authoring harness smoke-tested | **s41** |
| `nodegx-backend` jest (full) | ✅ 100 suites / 1085 passed, 10 skipped | s40 |
| `test:ci` (jasmine) | ⚠️ **2843 / 6 @ seed 39393** — **INHERITED, not re-measured** | s38 |
| `noodl-mcp` jest | ✅ 45 suites / 530 tests | s36 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

⚠️ **`test:main` moved 214 → 216 suites and 3336 → 3363 tests since s40.** **One suite and 13 tests of
that are s41's; the rest is peers'.** **Re-measure; never quote a handover's figure as your own.**

**Why s41 did not run `test:ci`, as a claim rather than a cost.** `test:ci` runs the jasmine specs
under `packages/noodl-editor/tests/` and reaches nothing s41 touched. ⚠️ **If you edit `planning.ts` or
`decomposition.ts` in response to FIX-022's ruling, that reasoning does not transfer — run it.**

🔴 **`test:ci`'s exit code misleads BOTH ways** — a clean floor run exits **1**. **Prove completion
from `test-results.json`'s mtime, never the exit code.** Delete it before a run.

✅ **PIN THE SEED: `NOODL_SPEC_SEED=39393`.** ✅ Predict the count first:
`git log <floor-tree>..HEAD -- packages/noodl-editor/tests/`. Empty ⇒ the total must be **exactly** 2843.

⚠️ **`tsc -p tsconfig.tests-main.json`'s 31 errors are NOT a gate and NOT a regression** — see
FIX-004's task file. Do not re-derive this a fifth time.

---

## 3. What s41 found

Full write-up in `FIX-022-DOES-THE-PLANNER-OVER-DECOMPOSE.md`. Four things belong here.

### ✅ The reported defect is real, and it is the planner's

`small-logic` — *show "4 min read", worked out from the body text length* — on the shipped default
model, n=10: **5 of 10 plans create a whole component for that one derived value.** Every one is named
some variant of `Reading Time`, and its intent describes one computation. `DECOMPOSITION_PLANNING`'s
own §"WHEN NOT TO FACTOR" forbids exactly this, in words, in the same block.

### 🔴 AAQ-008's doctrine is not the cause

Same request against the **pre-AAQ-008 prompt**: **6 of 10.** No difference (Fisher p = 1.0).

✅ The control reverts **both** halves of `251a90f2` — the block *and* the HOW TO SCOPE bullet that
cross-references it **by name**. Reverting only the block would have left a dangling reference to a
missing section: a state the product never shipped, and a confound in any difference found.

✅ **A pre-doctrine session wrote the counter-rule into its own intent** — *"no new component needed
since this is a single derived value, not a repeated or multi-node cluster"* — while the arm that
**was given** that rule created the component. **The counter-rule does not bind.**

### 🔴 An n=3 cell gave the opposite answer, and every quality check passed

| arm | n=3 grid | n=10 |
|---|---|---|
| doctrine ON | **3/3** | 5/10 |
| doctrine OFF | **1/3** | 6/10 |

A pilot made it **4/4** treatment. That is the shape that gets published as *"the doctrine causes the
reported defect"* — with a verified subtraction, a mechanism, and a quotable prose corroboration. The
instrument was fine; the sample was three. Fisher on 3/3 vs 1/3 is **p ≈ 0.4** — never significant, and
it reads as decisive. ✅ **Deepening cost ten cents and four minutes**, because the expensive part of
these measurements is building the arms, not sampling them. Filed to memory.

### ⚠️ The positive control has a ceiling, which narrows the whole result

`multi-section` existed to prove the doctrine reaches the model, so a null elsewhere would be readable.
**Both models factor it unprompted** (sonnet 5,5,5 vs 5,3,5; haiku 4,4,4 vs 4,4,4). So the doctrine's
*benefit* is **undemonstrated on this corpus, not disproven** — and on haiku the grid separates nothing
at all, so nothing there should be attributed to the doctrine either way.

---

## 4. What to do next and why

1. 🟢 **FIX-022 needs a ruling, not a build** (§5). ⚠️ **The instrument is now reusable for any prompt
   edit** — `--doctrine=on|off` generalises to "with/without the thing you just wrote", and a 10-sample
   both-arms run is **~$0.09 and eight minutes**. Whatever the ruling, measure the fix.
2. 🟢 **FIX-005's dead selectors** — delete the four dead rules, or retarget them to
   `.blocklyToolboxSelected`. ⚠️ **Retargeting is a visible redesign of the toolbox.** Needs §5.
3. 🔴 **FIX-016 §1, FIX-017's remaining half, FIX-008 C, FIX-013** — all need Richard (§5).

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

### How to start here

🔴 **If you are grading anything the AI *plans*, the instrument now exists**:
`packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`. Real `PlanningSession`, real
prompt, real validator, structured output so the grade is a count. ✅ **`--dump=<path>` writes the
arm's system prompt and exits before the provider is built** — the arms are checkable with no API key.

🔴 **If you are grading what it *authors*, use the sibling** `dist/aix002-harness.cjs` (FIX-006's).
They now share `shared.ts` and one `build.mjs`; **build once, both bundles rebuild.**

🔴 **If you are grading anything a cloud function does, the cheap instrument is
`packages/nodegx-backend/tests/`** — not the editor. Plain Node, safe beside a live stack.

⚠️ **All three are plain Node and need no editor.** s41 made no announcement and checked for
`scripts/start.ts` / webpack / `run-electron-tests` before starting; none were live.

---

## 5. Owed by Richard

- 🟢 **FIX-022 — the counter-rule does not bind. NEW from s41.** ~50% of plans for a single derived
  value create a component; the doctrine already forbids it in words; removing the doctrine does not
  fix it. **(a)** Accept — a `Reading Time` component is nameable and reusable, and the Script node
  inside it is FIX-006's axis, already fixed. **(b)** Give the counter-rule a numeric floor stated the
  way the positive rule states its trigger. **(c)** Move it to `planAdvisories`, which already speaks
  to the model once and the human after. ⚠️ **Measure any fix against `multi-section` too** — the
  ceiling there is the only guard against a "factor less" edit quietly undoing AAQ-008.
- 🟢 **FIX-004 — the redaction ruling, from s40.** A `noodl_log` block can print a provisioned secret
  to stdout in the clear, where the `Log` node cannot. **(a)** Accept. **(b)** Route through the
  scrubbed sink. **(c)** Say so in the tooltip. ⚠️ **(b) is not free.**
- 🟢 **FIX-006 — the `Substring` question, from s39.** With the compute/code-style blocks the model
  does string surgery inline (7/10); without them it reaches for the **`Substring` node** (10/10).
  Which is better for a beginner? ⚠️ **That was n=5 per cell** — see §3's third item before treating
  10/10 vs 7/10 as settled.
- 🟢 **FIX-004 §C — the seam-category question.** Should `App Objects` also list the four
  object-shaped blocks? And should `browser-blocks.spec.ts`'s byte-identity assertion be narrowed?
- 🟢 **FIX-006 AC4 — `Javascript2`.** Add the id to the Script line, or narrow `traps.ts:61-63`.
- 🟢 **FIX-005 — the dead-selector decision.** §4 item 2. Delete or retarget.
- 🔴 **FIX-005 part 2 — the rename.** **A.** Keep `Runtime Variables` + tooltip. **B.**
  `Global Variables` + `App Settings`. **C.** Revert to `App Variables`. ⚠️ **Reverses VFN-012.**
- 🟢 **FIX-016 ruling 1.** **(a) Copy/default**; **(b) Parser asymmetry, RE-PRICED DOWN**.
  ⚠️ **Do not conflate with plain `Outputs.Done()`.**
- 🔴 **FIX-016 §3 — signal-input semantics.** **The only genuinely blocked part of FIX-016.**
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible. ⚠️ Ctrl-Space is **OS-bound**.
- 🔴 **FIX-017 AC3** — premise false. Restate or strike.
- 🔴 **FIX-008 fix C** — a measurement from you. The oldest open item on this list.
- 🔴 **FIX-013 — four rulings; answer ruling 1 FIRST.** ✅ The big subtraction is **ruling 1(c)'s**.
- 🔴 **FIX-015** — the eight rulings. Brainstorm, then its own phase.
- 🔴 **FIX-021 slices A/B** — the six memory rulings. Slice 0 is done.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58. It
  is **phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s41.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Nine sessions have
  now declined.**
- 🟢 **MCP servers accumulate on this checkout and nothing reaps them.** `dev:stop` spares them **by
  design**. ⚠️ **Killing processes one can only *infer* are orphaned is your call.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).
- ⚠️ **Minor, from s41:** `claude-haiku-4-5-20251001` is not in the harness's pricing registry, so
  every haiku session reports `costUsd: null`. A reporting gap, not a measurement one.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. ✅ **s41 committed by pathspec**; the rest of the dirty tree
was peers'.

⚠️ **This checkout is busy.** ✅ **A peer will hold source saves if you ask** — a webpack recompile
HMR-reloads the renderer and **wipes every injected CDP global** mid-drive. ✅ **The three measurement
instruments named in §4 are plain Node and safe beside a live stack**, like `test:main`.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.

🔴 **It is OVER, and it moves while you read it. Do not quote any figure from a handover: take your
own.** ✅ **s41 added no index line** — its finding was filed *into* `judgement-trap-pointers.md`,
which already has a pointer, and that costs zero budget. **Prefer that.**

⚠️ **Whoever trims it must read it immediately before writing** — several peers append concurrently,
so a trim computed from a five-minute-old read silently discards their lines.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

If those two numbers come out *equal*, your instrument is wrong, not the file.

### Peer etiquette

🔴 **`SendMessage` needs the `[ref]` for EVERY name**, not just duplicated ones. Copy `name [ref]`
from a fresh `ListAgents`. 🔴 **Reply to a socket on its socket.** ⚠️ **Announce teardown to the FULL
launch list**, re-taking `ListAgents` first.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ✅ The reaping bug
is **fixed and measured** — but **keep announcing**, because a reaper started before those commits
still holds the old inert module. ⚠️ **Compare pids, never counts.**
