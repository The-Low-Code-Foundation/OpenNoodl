# Phase 66 — next session

**Written 2026-08-17, session 54's brief, by session 53.** A rewrite, per §0. s53 took **item 1 —
FIX-022's reuse cell — and closed the build** (`d4d34f02`). One task, one commit.

✅ **FIX-022 has no open build left.** It joins FIX-004, FIX-006 and FIX-016 as *built with nothing
owed but a judgement*. Seventeen tasks are closed outright.

🔴 **s53's headline is that the guard the fix needed now exists and its baseline is unanimous: all 17
planned sessions factored one shared component and placed it at all three sites, 0 single-use.**
Session 43 had named this the missing control — *"the one that prices the fix"* — because every
existing cell measured over-decomposition where reuse is **impossible**, so nothing would have
noticed a "don't factor for a single use" rule breaking the case Richard builds on purpose.

🔴 **Three sessions died on an exhausted API credit balance, and they graded as the defect.** A
session that never planned scores 0 creates and fails the oracle, which on this prompt is
indistinguishable from *"the planner refused to factor"*. Three instrument deaths would have been
published as three findings. ✅ Fixed, and **exercised against a real failing run** rather than merely
written. ⚠️ **The account has no credit — every further measurement in this phase is blocked until
Richard tops it up.**

🔴 **The placement metric is part prose, and s43's stated reason for that was wrong.** LAS-006 landed
`PlanOperation.instantiates` **eight days before** s41's run, so placement *can* be structural — the
model just usually leaves the field empty. It was filled on **5 of s41's 11 real placements**, so a
structural-only grade would have scored the other **6 as never placed at all**.

🔴 **Every ruling and every measurement is in its own task file.** §4 here is a work order, not the
source of truth. FIX-022's full write-up — the mechanical re-grade that reproduces s43's hand
reading, the three mutants, both tables — is at the foot of its own file.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
2. **Gate readings with their date and tree.** ⚠️ **Mark which ones this session actually took.**
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020 / 023 / 024** | ✅ | ✅ | **CLOSED** — sixteen tasks |
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — see s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + **the reuse cell** 🆕 | ✅ | ✅ | 🆕 **The last build is CLOSED** (s53, `d4d34f02`). ⚠️ The §7 ruling is the only thing owed |
| **FIX-008** A, B, C, E | ✅ | ✅ C driven s48 | **D unstarted** — item 3 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Seventeen closed outright.** ⚠️ **Count the names, don't copy a total** — this number has moved
twice in one session before.

✅ **No task has a built-but-undriven half.** True at s49 and still true.

⚠️ **FIX-022's cell is measured rather than driven, and that is the right instrument** — same
reasoning as FIX-006's weighting. What it grades is a plan, which is structured data, so the grade is
a count and a list of names rather than a screenshot.

---

## 2. Gate readings

✅ **s53 took the five marked.** This session changed **`noodl-editor` `scripts/`** (three modules,
one new) and **`tests-unit/`** (one new spec). **No editor renderer source, no runtime, no MCP.**

| Gate | Reading | When |
|---|---|---|
| **root `npm run typecheck`** (the PR gate) | ✅ exit **0**, zero `error TS` | ✅ **s53** |
| **`noodl-editor` `test:main` (full)** | ✅ **233 suites / 3593 tests**, exit 0, **no failures** | ✅ **s53** |
| **`lint:ci` ratchet** | ✅ exit 0, **876** against a 3916 baseline — s50/s51/s52's exact count | ✅ **s53** |
| **`tests-unit/phase-66` (both suites)** | ✅ **28/28**; **15** of them new | ✅ **s53** |
| **both measurement bundles** | ✅ build clean, exit 0 | ✅ **s53** |
| `noodl-mcp` jest | ✅ 52 suites / 613 | s52 — inherited |
| `noodl-runtime` jest | ✅ 137 suites / 2510 | s51 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s51 — inherited |
| `noodl-viewer-react` jest | ✅ 71 suites / 910 | s51 — inherited |
| `cloud-runtime` jest | ✅ 7 suites / 172 | s51 — inherited |
| `tests/validation/*` (7 suites) | ✅ 86 tests, ⚠️ under jest not jasmine | s49 — inherited |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited** |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ✅ **Every exit code above was read directly, not
through a pipe** — and the root `typecheck` was confirmed to be `tsc --noEmit` by reading the script
name back out of `package.json` in the same call.

✅ **`test:main` 232 → 233 suites and 3578 → 3593 tests is EXACTLY this session's one suite and 15
specs.** No peer moved it. **Never carry a count forward anyway.**

### 🔴 `test:ci` NOT taken, as a claim rather than a cost

s53 changed **no** editor source: two modified and one new file under `scripts/`, one new file under
`tests-unit/`. `test:ci` runs the jasmine specs under `packages/noodl-editor/tests/` and reaches none
of it — the same reasoning s41 recorded for the same directory. ⚠️ **If you edit `planning.ts` or
`decomposition.ts` in response to FIX-022 §7, that reasoning does not transfer.**

The checkout was idle throughout: **no `scripts/start.ts`, no webpack, no Electron editor** — 24
`electron/dist` matches at the start and **every one an MCP server**, attributed by cmdline. The tree
carried peers' four uncommitted paths the whole session, unchanged.

⚠️ **The one gap no gate here covers, and it is now three sessions old:** nobody has run a **bundled**
editor build since s51's `BenchRunner.ts` import landed, and s52's prompt-module change is
renderer-side. s53 adds nothing to that gap — its files are `scripts/` and `tests-unit/`, neither of
which webpack bundles. **Someone should still run it in passing.**

---

## 3. What s53 did — FIX-022's reuse cell (`d4d34f02`)

**One new corpus request, a placement metric, an extracted grader, and a spec for a grade nothing
held.**

- **`reuse-available`** 🆕 — the one corpus request where creating a component is **correct**: the
  same "Verified" badge wanted at three sites that already exist (article byline, comment, profile
  card). ⚠️ It names three *places* and still names no component, node type or component count.
- **`expect.minPlacementSites`** 🆕 — the reuse half of the oracle, set **only** where reuse is
  genuinely available. Demanding it elsewhere would grade the request, not the planner.
- **`plan-grade.ts`** 🆕 — the grader, extracted because **`plan-harness.ts` calls `main()` at import,
  so nothing in it can be held by a spec**. Adds `placements`, `singleUseCreates`, `reusedCreates`
  and `unplacedCreates`.
- **`planGrade.test.ts`** 🆕 — **15 specs in `test:main`.**

### The measurement

n=10 per arm, **arms interleaved pair by pair**, `claude-sonnet-5`, effort `low`.

| `reuse-available` | ON | OFF |
|---|---|---|
| sessions that planned | **9 / 10** | **8 / 10** |
| created a component | 9 / 9 | 8 / 8 |
| …placed at all **3** sites | **9 / 9** | **8 / 8** |
| single-use | **0** | **0** |

**Cost $0.22** across 18 charged sessions — twice s43's estimate, because this request is bigger than
`small-logic`. ✅ **Both arms archived** in `measurements/2026-08-17-fix022-reuse-{on,off}-…-n10.jsonl`.

---

## 4. What to do next and why

**Ordered by value, not cost.** ⚠️ **Items needing API calls are blocked on credit** — see §5.

1. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed. **Now the cheapest open
   build in the phase, and it needs no API credit.**
2. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered. ⚠️ **FIX-006's
   weighting and FIX-022's reuse axis are both exactly the kind of rule that belongs in a user
   profile** — do not build slices A/B in a way that cannot express them.
3. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.
4. ⚠️ **A bundled editor build**, in passing — §2.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list, behind
  `parser.getPorts()`, i.e. **running the author's code**. **Wants a task; needs a syntax-tree parse
  of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50). Same
  blocker, same fix.
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled
  `react-app`, so every file fails identically. **Pre-existing and unowned.**

### How to start here

🔴 **Census before you build, and census the SPELLINGS.** Five sessions running, the scoping's premise
has been wrong. ✅ **s53's whole finding came from one census step**: grepping the *saved records* for
`instantiates` before writing a metric, which showed the field existed, predated the measurement, and
was filled 5 times in 31 operations. **A field you assume is absent is worth one `grep`.**

🔴 **A green spec proves nothing until you have seen it fail — and PROVE which edit your mutant
made.** s53's first mutation run printed an **empty** changed-line block for all three mutants,
because it used `git diff` on a file that was still **untracked**. The mutants had applied; the guard
was simply blind. ✅ **`diff` against a saved copy, not `git diff`, and assert the file actually
changed** — a mutant that silently no-ops looks exactly like a passing suite.

🔴 **An instrument death grades as a finding.** Three billing failures scored as "0 creates, fails the
oracle" — the very defect the cell hunts. ✅ **Filter to the sessions that actually produced the
artefact, and print what killed the others with the provider's own words beside it.**

🔴 **Do not merge "not detected" into "detected once".** `unplacedCreates` is deliberately separate
from `singleUseCreates`: zero detected placements is far more likely to be the grader failing to see
one than a plan orphaning a component, and merging them lets a blind spot arrive as a defect rate.

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **and `${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). ✅ **Redirect to a file, `echo $?`, then read the file.**
🔴 **`cd` to the repo root in the same call**, because the shell's cwd persists. macOS has **no
`timeout`**; a command exiting 127 looks like a well-behaved run.

⚠️ **A foreground `sleep` is refused by the harness.** Poll with a backgrounded `until` loop.

⚠️ **`npm run dev:debug` needs `run_in_background`, not `nohup`** — attribution here is by PPID.

---

## 5. Rulings — what a builder must not get wrong

- ✅ **FIX-022 — the reuse cell BUILT + MEASURED s53.** 🔴 **`minPlacementSites` must stay OFF for
  `trivial`, `small-logic` and `multi-section`** — reuse is impossible in those requests by
  construction, and demanding it would grade the request rather than the planner. 🔴 **The placement
  metric must keep BOTH evidence paths.** `instantiates` alone misses 6 of 11 known-real placements;
  prose alone throws away the only structural signal there is. **The split is reported on purpose.**
  🔴 **The cell is a REGRESSION detector, not evidence of improvement** — 17/17 is the ceiling, the
  same shape as `multi-section`. ⚠️ **It does NOT license "the planner is sensitive to reuse"**: that
  compares two *different requests*, and nothing varied reuse availability while holding the request
  constant.
- ✅ **FIX-022 — no numeric floor; the axis is REUSE** (s42). A one-node component is legitimate when
  it is placed more than once. 🔴 **Any rule must be stated on the reuse axis, never on node count.**
- ✅ **FIX-006 — the Substring weighting BUILT + MEASURED s52.** 🔴 **The rule is not "prefer nodes",
  and `NODES_BEFORE_CODE` must keep BOTH halves.** Simple whole step ⇒ the built-in node; needs code
  at all ⇒ **all of it in one code node**. 🔴 **Keep it a separate export from
  `THREE_WAYS_TO_COMPUTE`** — merging them destroys the only arm that can attribute a result to this
  ruling. ⚠️ **Two judgements are left, neither a build** — §"Still owed".
- ✅ **FIX-006 AC4 — the id is in the prompt and now graded.** 🔴 **`Javascript2` must keep leading the
  Script paragraph**; `traps.ts:61-63` states the rule the block is checked against.
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` must stay LAST in all four parameter
  lists.** 🔴 **Do not "tidy" the four spellings into one shared constant** — `BenchRunner.ts` states
  why. 🔴 **`createBlockConsole` must keep returning `console` ITSELF when there is no sink.**
- ✅ **FIX-016 — the mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` must stay `true` for
  `'script'`.** 🔴 **The bar is silent in script mode, not empty-listed.** ⚠️ **AC1 as originally
  written is still FALSE as built** (driven s26). **Someone should decide whether AC1 is retired or
  still owed; s50 through s53 did not.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` is 2nd in `ALL_RULES` on purpose;
  `duplicateNodeId` must keep leading.** 🔴 **The diagnostic names the node and component IN THE
  MESSAGE.**
- ✅ **FIX-008 C — BUILT s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly. **Do not re-litigate it from
  `appConfig.ts`.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-024 — CLOSED by a peer s51.** 🔴 **`'learn'` and `'learning'` are two different pages** —
  **do not merge the ids.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** 🆕 Three of s53's 20 sessions died on it, and
  **every measurement harness in this phase is blocked** — FIX-006's, FIX-022's, and any A/B a future
  ruling needs. **`.env`, the account behind `ANTHROPIC_API_KEY`.**
- 🔴 **THE REPACKAGE — still the item with a live user impact.** `nodegx-puppy-test-3` resolves to
  `/Applications/NodeGX.app/…`, the **Aug-13** bundle. **The fix is committed and driven; he cannot
  see it.**
- ⚠️ **`packages/noodl-mcp/dist/` is still pre-fix** — gitignored, and what *checkout-registered*
  servers load. 🔴 **A session that rebuilds it should announce that it did.** ⚠️ **External agents on
  a registered server are NOT yet getting `NODES BEFORE CODE`**, even though `rejectionExamples.test.ts`
  proves the source serves it.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?** 🆕 **Now safe
  to answer**: single-use factoring runs at **5/10 and 6/10** where reuse is impossible, and **0/17**
  where it is available, so a rule can be written against a cell that would catch it overshooting.
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want for the reported request?** §5.
- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **FIX-016 AC1 — retired or still owed?** See §5.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** **Still uncommitted at s53 — twenty-one sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-one
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  ⚠️ **`fix016-s50-drive` is a scratch copy and can be deleted.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls**; s49
through s52 each lost a call to it, and s53 lost one to a `$SCRATCH` that was set but never exported.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s53 committed once, 7 files, four of them new in one chain**,
and verified with `git log -1 --name-only` that the peers' four uncommitted paths were still there
afterwards.

⚠️ **This checkout is busy**, though it was quiet all of s53 — the same four peer paths at start and
finish. ✅ **Every CDP reader should return an explicit `{alive:…}`** — a dead instrument and a
genuine absence are the same string.

### 🔴 Peer etiquette

🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — s53 counted 24 and **zero
editors**; **attribute by PPID and cmdline**. 🔴 **Announce teardown to the FULL launch list.**
🔴 **Reply to a socket on its socket.** 🔴 **A peer's teardown is not permission to run a suite —
read the TREE.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — the watchdog runs the same
sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ⚠️ **Compare pids,
never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **Take your own reading before adding a line; the headroom moves both ways and neither direction
is yours.** ✅ **The move whenever a new fact belongs to a section that already has a 📚 pointer: put
it in the POINTER FILE, which costs zero index budget.**

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46 through s53 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared nine sessions running. ✅ **s53 also ran `git diff --stat HEAD` on the file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
