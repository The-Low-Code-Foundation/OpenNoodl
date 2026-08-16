# Phase 66 — next session

**Written 2026-08-16, session 44.** A rewrite, per §0. s44 took items 1 and 2 of s43's queue and
shipped both — `e16684df`, `3d3cc974`, `4b42d835`.

🔴 **The queue has no cheap end left.** Everything below is medium or larger. Nothing waits on
Richard except FIX-013's rulings 2–4 and FIX-021's Q2/Q5/Q6.

🔴 **s44's headline is a method result, not a feature: item 2's premise was FALSE, and the census
that found it took two minutes.** FIX-016's task file said an author who writes the wrong notation in
a Script node *"gets no message at all"*. Measured, the editor was **accusing the Script node's own
API** — telling authors that `define(…)`, the notation the product's own `NOTATION_RULES.script`
prescribes, is an undeclared port, with a fix-it offering to write `Inputs.define`. **Budget for that
shape: a premise asserting an ABSENCE is the one nobody has checked, because a silence has nothing to
trip over.**

🔴 **Every ruling and every build is recorded in its own task file.** §4 here is a work order, not the
source of truth.

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
| **FIX-001 / 002 / 003 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — thirteen tasks |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ **s44 3/3** | Acceptance 1 closed s42; the location seed driven s44. **Slices A/B are the open work** |
| **FIX-016** §2, §3, §3c, **ruling 1** | ✅ | ⚠️ **ruling 1 NOT driven** | Message 6 is spec-level; nobody has seen it in a gutter |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** |
| **FIX-004** §A+§B | ✅ | ✅ | Redaction (b) and §C are RULED and unbuilt |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet — §3 says why not** |
| **FIX-005** part 1 + dead selectors | ✅ | ✅ | **The rename is unbuilt** |
| **FIX-008** A, B, E | ✅ | ✅ | C unblocked (**the measurement is an agent's, not Richard's**); D unstarted |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Thirteen closed outright.** ⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

✅ **s44 took all of these itself**, on a checkout with peers' uncommitted work and peers actively
saving source throughout.

| Gate | Reading | When |
|---|---|---|
| **`noodl-core-ui` jest** | ✅ **26 suites / 461 tests** (was 25 / 444) | ✅ **s44** |
| **`noodl-editor` `test:main`** | ⚠️ **220 / 221 suites — see the flake below** | ✅ **s44** |
| **`typecheck:core-ui`** | 44 errors, **none in any file touched**; `--listFiles` confirms the changed files are in the compile | ✅ **s44** |
| **`lint:ci` ratchet** | ✅ exit 0, 876 against a 3916 baseline | ✅ **s44** |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s40 — inherited |
| `test:ci` (jasmine) | 🔴 **UNWITNESSED on the committed tree** — see below | — |
| `library:check` | ✅ 58/58 | s30 — inherited |

### 🔴 `test:main` has two load-flaky suites, and they are not yours

`bld-004/reasoningChannel` failed one full run; `aib-009/turnDeadline` failed the next. Both report
*"nothing arrived for 0 seconds"*. **Do not spend a session on this the way s44 nearly did.** The
attribution is measured:

- **`npx jest --findRelatedTests <your changed files>` listed ZERO editor suites** for s44's four.
- Each suite passes **3/3 in isolation**.
- The full run was clean twice earlier the same session.

✅ **`--findRelatedTests` is the cheap instrument for "is that failure mine?"** — it answers from
jest's own module graph rather than from your reading of the imports.

### 🔴 `test:ci`'s floor is unwitnessed, and a peer is on it

A peer's pinned-seed run **timed out at 900s** with no results file (exit 1, runner said so) while
s44's dev stack was up — three full webpack rebuilds, ~7 minutes of compile, landed inside their
window, *triggered by a third party's source saves, not s44's*. They re-ran on an idle checkout and
will report. **Their prediction is 2843/7** (the seventh a `projectmodules` golden from `f7da52d1`)
and it is **untested — not confirmed, not refuted**. ✅ **Do not quote 2843/7 until someone posts a
run that says so.**

**s44 did not run `test:ci`, as a claim rather than an omission:** `.ts`/`.tsx` under `src/`, two new
specs, no `.jsx`, nothing under `packages/noodl-editor/tests/`. 🔴 **That reasoning does not transfer
to FIX-005's rename or FIX-004 §C** — both are Blockly, which is `test:ci` territory.

---

## 3. What s44 built, and the one thing to read before building anything

### ✅ FIX-021 — the wizard opens somewhere (`e16684df`, driven `4b42d835`)

Ruling (B). `projects.lastCreateLocation` seeds the Location field; `getDocumentsPath()` on first run;
Browse still overrides and records.

🔴 **The existence guard is the part to keep.** `isStepValid('basics')` checks only
`location.length > 0`, so seeding a folder on an unmounted volume would **enable `Next`** and fail at
creation — later, and naming a folder the user never typed. Invariant: **empty, or a folder that
exists.** Driven arm C proves it against the real `filesystem.exists`.

⚠️ **Undriven half:** Browse recording the choice needs the native dialog, which CDP cannot drive.

### ✅ FIX-016 ruling 1 — and the census that rewrote it (`3d3cc974`)

The two nodes are compiled differently and the editor treated them as one mode:

| node | compiled as |
|---|---|
| Function (`JavaScriptFunction`) | `AsyncFunction('Inputs','Outputs','Noodl','Component', …)` |
| Script (`Javascript2`) | `Function('define','script','Node','Component', …)` |

One ESLint globals list — the union **minus** `define`/`script` — served both, and the completion
list had the same defect under the misleading name `SCRIPT_GLOBALS`. Now per-mode, plus **message 6**,
and **script mode gets only message 6**: messages 1–5 all emit `Inputs.`/`Outputs.` notation, and all
five are wrong on a node that mines no ports from its text. ESLint's own diagnostics still pass
through.

🔴 **Left standing on purpose — the next slice.** `unionPorts` calls `minePorts(code)` in script mode
too, so FUN-005's rail and FUN-006's bar can show a Script node **ports it does not have**. The Script
node's ports come from `parser.getPorts()` — `Node.Inputs`/`Outputs`/`Signals` or `define()` — never
from a regex over the document (`javascript.ts:831-840`). Four surfaces; not folded in.

---

## 4. What to do next and why

**Ordered by cost.**

1. 🟠 **Drive FIX-016 message 6.** Cheapest way to close a "built, not driven" row: a Script node,
   `Outputs.Done()` in its popout, read the lint state through `forEachDiagnostic`. ✅ **The control
   that makes it a measurement:** the identical document on a **Function** node must stay silent, and
   `define({…})` on the Script node must *also* be silent — the second is the half that was broken.
2. 🟠 **FIX-004 §C — dual-list the four object-shaped blocks under `App Objects`**, and narrow
   `browser-blocks.spec.ts`'s byte-identity fence to what its title claims. ⚠️ Blockly ⇒ `test:ci`.
3. 🟠 **FIX-005 rename → `App Variables` / `App Config`.** ⚠️ **Knowingly reverses VFN-012** — say so
   in the commit. ⚠️ Blockly ⇒ `test:ci`.
4. 🟠 **FIX-008 C** — take the two-servers-visible measurement yourself (**it is an agent's, not
   Richard's**), then build C.
5. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
6. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API, and it is the
   difference between a rule that helps and one that forbids deliberate work.
7. 🔴 **FIX-016 — the script-mode mining slice** (§3). Four surfaces.
8. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink.
9. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
10. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.

**Do not start** FIX-015 here — it is its own phase.

### How to start here

🔴 **Census before you build, whatever the task file says.** s44's item 2 was *"add the missing
message"* and the measurement changed what got built. **Ten lines in the package's own node runner**
— call the real entry point, print the output for both modes — beat four sessions of reading.

🔴 **Grading anything in the code editor:** `javascriptDiagnostics(state, validationType)` is pure and
runs headlessly in `noodl-core-ui`'s jest. `setOpenNodeContext({typeName, declaredInputs,
declaredOutputs})` is how you say which node is open; `null` is a code **file**, not a node.

🔴 **Grading what the AI plans:** `packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`.
✅ `--dump=<path>` writes the arm's system prompt and exits before the provider is built. ⚠️ `--model`
is effectively required. **Authoring** is the sibling `dist/aix002-harness.cjs`; they share one
`build.mjs`.

🔴 **Before deleting anything a spec might grade, search THREE roots**: `src/`, `tests/` **and
`tests-unit/`**. ⚠️ Exclude `*.bundle.js` — s44 lost a search to a 20MB source-map hit.

✅ **A mutation check costs one shell call.** Apply the mutant, run the suite, restore, `diff` the
file back — all in **one** Bash invocation, so the broken-file window is seconds and no peer's
`git add -A` can catch it. s44 ran four; each one changed what the write-up could claim.

---

## 5. Rulings — what a builder must not get wrong

- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids.** Measure node choice **and** chain shape. ⚠️ n=5 cells are not a
  floor; re-run at n=10. ⚠️ **Coupling:** this preference belongs in FIX-021's user profile, where
  Richard can change it — **do not build it in a way that forecloses slices A/B.**
- ✅ **FIX-016 ruling 1 — BUILT s44.** ⚠️ The strictness survived: the parser was not loosened.
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. **§C — dual-list, and narrow the fence** to
  *"changes no existing block type id"*.
- ✅ **FIX-005 — rename → `App Variables` + `App Config`.** ⚠️ **Reverses VFN-012 knowingly.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user and
  gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-008 C — the measurement is an AGENT's, not Richard's.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.

### 🔴 Two things Richard raised that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.** **Its own
  task; do not fold it into the rename.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** ⚠️ Unlanded work on a PR-gated script is exactly what a sibling's `git add -A`
  sweeps. **Still uncommitted at s44** — twelve sessions now.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twelve sessions
  have declined.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).
- ⚠️ **New from s44:** the `turnDeadline` timing suites are load-flaky under `test:main` (§2). And
  `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s44 committed three times, pathspec-only**; peers' work
(phase-65, phase-50 notes, phase-68, phase-69 notes, `scripts/library/check.ts`) was untouched
throughout.

⚠️ **This checkout is busy and peers save source constantly.** A save triggers a **~130s** webpack
rebuild that HMR-reloads the renderer mid-drive — s44 lost two readings to exactly that and spent
four minutes thinking the editor had crashed. ✅ **A peer will hold saves if you ask.**

### 🔴 Peer etiquette — s44's own near-miss

**An all-clear is about the moment it was sent.** s44 read *"checkout released"* as *"free"*, launched,
and a different peer had taken the window one message earlier and was mid-`test:ci`. ✅ **What made it
recoverable was reporting the launch immediately, with a PPID walk showing their tree alive** — not
reassurance. `NEVER_SWEEP` held and their run survived the launch.

🔴 **Reply to a socket on its socket.** ⚠️ **Announce teardown to the FULL launch list.** 🔴 **Keep peer
messages short and rare.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.**

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**. ✅ **s44 measured 16,113 / 16,200 and added
nothing to `MEMORY.md`** — new memories were filed under existing pointers, which costs zero budget.

🔴 **It moves while you read it.** A peer had already filed s44's `test:ci` finding before s44 could;
`grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```
