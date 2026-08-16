# Phase 66 — next session

**Written 2026-08-16, session 43.** A rewrite, per §0. s43 took the first four items of s42's build
queue plus the FIX-022 re-grade, and shipped them as `82b33466`.

🔴 **The queue is still a build queue, and it is now shorter at the cheap end.** Everything left is
medium or larger, except item 1. Nothing below waits on Richard except FIX-013's rulings 2–4 and
FIX-015's eight, which are a scoping session of their own.

🔴 **Two of the four "documentation only" items turned out to be corrections, not transcriptions.**
FIX-016 §3's fact was already written down in two places — *backwards*, with a spec enforcing it —
and FIX-005's dead selectors had five green specs grading them. **Budget for that shape: an item
whose ruling says "just document it" is where the product's own copy is least likely to be right,
because nobody has had a reason to read it.**

🔴 **Every ruling is recorded in its own task file under `## ✅ RULED 2026-08-16 (session 42)`, and
what s43 built is recorded under a `## ✅ … 2026-08-16 (session 43)` heading in the same files.**
The task files are the durable record. §4 here is a work order, not the source of truth.

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
| **FIX-006** — AC1–AC4 | ✅ | ✅ | AC4 built **s43**. **The Substring weighting is the one build left in this task** |
| **FIX-004** §A+§B | ✅ | ✅ | Redaction (b) and §C are RULED and unbuilt |
| **FIX-021** slice 0 | ✅ | ✅ s42 | Acceptance 1 closed — launcher file and MCP twin byte-identical |
| **FIX-022** | ✅ | ✅ | **RE-GRADED s43 — the defect is REAL on the reuse axis, 11/11 single-use.** No rule written yet, and §3 says why not yet |
| **FIX-017** | ✅ | ✅ | **CLOSED s43** on documentation — AC1 accepted, AC3 struck |
| **FIX-016** §2, §3, §3c | ✅ | ✅ | **§3 CLOSED s43.** §1's teaching diagnostic is ruled and unbuilt |
| **FIX-005** part 1 + dead selectors | ✅ | ✅ | Selectors deleted **s43**. **The rename is unbuilt** |
| **FIX-008** A, B, E | ✅ | ✅ | C unblocked (**the measurement is an agent's, not Richard's**); D unstarted |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |
| **FIX-021** slices A/B | 📋 | — | **GREEN — a user profile.** Three of six questions answered |

**Fifteen closed outright** — FIX-017 is the fifteenth. ⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

✅ **s43 took these itself, at tree `82b33466`, on a checkout with peers' uncommitted work in it.**
That last clause matters: `test:main` compiled their in-flight `router.setup.ts`,
`projectmodules.ts` and `KitsSection.tsx` alongside mine, so the green is a reading of the *tree*,
not of my diff alone.

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main` (jest)** | ✅ **220 suites / 3396 tests, 0 failed — twice** | ✅ **s43** |
| **`noodl-mcp` jest** | ✅ **50 suites / 585 tests** | ✅ **s43** |
| **`noodl-core-ui` jest** | ✅ **25 suites / 444 tests** | ✅ **s43** |
| `nodegx-backend` jest (full) | ✅ 100 suites / 1085 passed, 10 skipped | s40 — inherited |
| `test:ci` (jasmine) | ✅ **2843 / 6 @ 39393**, six by name — **witnessed on the COMMITTED tree** | **run output 21:21:42**, this checkout, post-`9e76bae4`. ⚠️ **the results FILE disagrees — see below** |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 — inherited |

🔴 **`test:main` moved 216 → 220 suites and 3363 → 3396 tests in a day, and most of it was peers'.**
Re-measure; never quote a handover's figure as your own.

🔴 **The first `test:main` run reported 2 failed suites and I could only identify one** — the tail of
a piped run truncates the failure list. **Redirect the whole run to a file** (`npx jest > out.txt
2>&1`) rather than piping to `tail`, or you will be guessing about the failure you cannot see. Two
clean full runs followed the fix, so the second failure did not reproduce.

**`test:ci` was NOT run, as a claim rather than an omission.** s43 changed one `.scss`, three `.ts`
under `src/`, and two jest specs. No `.jsx`, and no file under `packages/noodl-editor/tests/`.
🔴 **That reasoning does not transfer to FIX-005's rename or FIX-004's §C** — both are Blockly, which
is `.jsx`/`test:ci` territory.

✅ **PIN THE SEED: `NOODL_SPEC_SEED=39393`.** 🔴 **`test:ci`'s exit code misleads both ways** — a clean
floor run exits **1**. **Prove completion from `test-results.json`'s mtime; delete it before a run.**

### 🔴 `test-results.json` on disk is STALE BY A WHOLE RUN — it says 7, the floor is 6

⚠️ **s30 got this wrong first and committed it wrong** (`8b1d829a`, superseded here). The record said
*"the floor is SEVEN, do not quote 6"*. **That was false and it retired a real measurement.** Corrected
by finding the primary artifacts. Four `test:ci` runs exist as background-task output:

| when | tree | reading | `projectmodules` in output |
|---|---|---|---|
| 13:14:24 | older (2812 specs) | 9 failures | 13 |
| 13:29:41 | older (2812 specs) | 6 failures | 13 |
| **16:01:26** | pre-CN-006 | **2843 / 6** @ 39393 | **0** |
| 🔴 **21:21:42** | **post-`9e76bae4` — the COMMITTED tree** | **2843 / 6** @ 39393 | **0** |

✅ **The floor is 2843 / 6 at seed 39393, and the committed tree IS witnessed** — the 21:21 run is in
this checkout (`/Users/richardosborne/vscode_projects/OpenNoodl/packages/noodl-editor` in its output),
it postdates `9e76bae4` (20:43), and it lists the same six by name.

🔴 **And `packages/noodl-editor/tests/test-results.json` STILL reads `failedCount 7`, mtime 20:37:49.**
A run completed at **21:21** and **did not update it**. So the file is not merely a readout that can go
stale against the *tree* — it went stale against **a later completed run of its own suite**. ⚠️ **Why it
did not write is NOT established, and s30 is deliberately not naming a mechanism.**

**What the 7 actually was:** the 20:37 run saw the CN-006 projectmodules work in flight and uncommitted
and produced one extra failure — `projectmodules — injectIntoHtml snapshot (scanner unification)
produces byte-identical HTML to the committed golden`. It **does not reproduce on committed code**
(21:21, zero hits). Contamination after all — but that was only knowable from the run outputs.

✅ **THE RECOVERY INSTRUMENT, which five sessions missed and which settles this class of question:**

```
ls -lt /private/tmp/claude-*/-Users-richardosborne-vscode-projects-OpenNoodl/*/tasks/
/usr/bin/grep -arl "Randomized with seed 39393" /private/tmp/claude-*/…/tasks/
```

🔴 **Background-task output survives a session's context roll.** Prefer it to `test-results.json`, and
prefer it to any session's reconstruction — **including its account of its own run.** Delete the results
file before re-running, and read the run's own output for the verdict.

⚠️ **`tsc -p tsconfig.tests-main.json`'s 31 errors are NOT a gate and NOT a regression.** Do not
re-derive this a seventh time.

---

## 3. What s43 did, and the two things worth reading before you build

### ✅ Five items shipped in `82b33466`

| item | what landed |
|---|---|
| **FIX-017** | AC1 accepted, AC3 struck, both with the reason written where the next reader will hit it. **Task closed** |
| **FIX-005** | The four dead toolbox selectors deleted (`.blocklyToolboxDiv`, `.blocklyTreeLabel`, `.blocklyTreeRow`, `.blocklyTreeSelected`), plus the five specs that graded them |
| **FIX-006 AC4** | `traps.ts`'s Script paragraph now leads with `` `Javascript2` `` |
| **FIX-016 §3** | `run` documented as the Function's only trigger, in `NOTATION_RULES` (mid-edit) and the picker card (pre-choice) |
| **FIX-022** | The 20 saved plans re-graded on the reuse axis. No API calls |

### 🔴 A spec can be green, controlled, and measuring nothing — twice in one session

**FIX-005.** `tests-unit/fix-005/dropdown-contrast.spec.ts` graded the selected toolbox category in
both themes: five passing rows and a negative control that fired at **1.19:1**. The selector matches
**zero elements** and has for several major Blockly versions. **The control could not have caught
it** — it varied the *background token* and held the *selector* constant, so all it ever proved was
that the contrast formula separates two colours. Reading a token name out of a stylesheet
establishes what the file says, never what the browser applies.

**FIX-016 §3.** The chooser's header and `chooserCopy.test.ts`'s docblock both asserted that
`Node.Signals.X = function(){}` mints unlimited signal inputs *"additional to the built-in `Run`"* —
a sentence **true of neither node**. `Node.Signals` is read at `javascriptnodeparser.js:203-211`, on
a path reached only by `Javascript2`, which has **no** built-in `Run`; a Function body compiles as
`AsyncFunction('Inputs','Outputs','Noodl','Component', …)` (`simplejavascript.ts:609-619`), so
`Node` is not in scope at all and `run` is its one signal input. **A spec had been enforcing the
false half since LGC-001.**

✅ **The repair pattern, if you meet this again:** narrow the prohibition to the half that is still
false (unlimited signal *outputs* are real) rather than deleting it, and give the control **both**
arms — one showing the forbidden sentence still matches, one showing the now-*required* sentence
does not. A one-armed negative goes on passing after the list stops catching anything.

### 🔴 FIX-022 — the defect survived the ruling, and the missing control is the finding

Re-scored the 20 saved plans for **how many times the created component is placed**:

| arm | plans that create | placed **once** | placed **twice+** |
|---|---|---|---|
| doctrine ON | 5 / 10 | **5** | **0** |
| doctrine OFF | 6 / 10 | **6** | **0** |

Every creating plan is two operations — one `create`, one `update` placing it in a single parent at
a single site. So 5/10 and 6/10 stop being an upper bound and **become the rate**.

🔴 **But no arm contains a request where reuse is genuinely available.** `small-logic` asks for a
reading time beside the author name: one site by construction. So this measures over-decomposition
where reuse is *impossible*, and says nothing about whether the planner recognises real reuse.
**A rule pushing "don't factor for a single use" could damage exactly the case Richard builds on
purpose — one-node components placed many times — and nothing in this instrument would notice.**
✅ **Add that cell before writing any rule.**

⚠️ The instrument is the plan's **prose**, not a graph: records carry `operations[].intent`, not an
instance count. "Placed once" is a reading of one operation naming one site.

---

## 4. What to do next and why

**Ordered by cost. Item 1 is the last cheap one.**

1. 🟢 **FIX-021 — seed the wizard's location from last-used**, falling back to `getDocumentsPath()`
   on first run. Ruled (B), small, self-contained.
2. 🟠 **FIX-016 ruling 1 — the teaching diagnostic.** Keep the Script node strict; add the
   editor-time message an author who writes `Outputs.Done()` without declaring it currently never
   gets. ⚠️ Read the task file: **the strictness is deliberate and must survive the fix.**
3. 🟠 **FIX-004 §C — dual-list the four object-shaped blocks under `App Objects`**, and narrow
   `browser-blocks.spec.ts`'s byte-identity fence to what its title claims. ⚠️ Blockly ⇒ `test:ci`.
4. 🟠 **FIX-005 rename → `App Variables` / `App Config`.** ⚠️ **Knowingly reverses VFN-012** — say so
   in the commit. ⚠️ Blockly ⇒ `test:ci`.
5. 🟠 **FIX-008 C** — take the two-servers-visible measurement yourself (**it is an agent's, not
   Richard's**), then build C.
6. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
7. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule (§3). Cheap in code, ~$0.10
   in API, and it is the difference between a rule that helps and one that forbids deliberate work.
8. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink. Not free; price it.
9. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
10. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.

**Do not start** FIX-015 here — it is its own phase (§5).

### How to start here

🔴 **If you are grading anything the AI *plans***:
`packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`. Real `PlanningSession`, real
prompt, real validator. ✅ **`--dump=<path>` writes the arm's system prompt and exits before the
provider is built** — arms are checkable with no API key. ⚠️ **`--model` is effectively required.**
The 20 saved plans are in `measurements/`; the re-grade one-liner is in FIX-022 §"Reproducing".

🔴 **If you are grading what it *authors*, use the sibling** `dist/aix002-harness.cjs`. They share
`shared.ts` and one `build.mjs`; **build once, both bundles rebuild.**

🔴 **If you are grading a cloud function**, use `packages/nodegx-backend/tests/` — plain Node, safe
beside a live stack.

🔴 **Before deleting anything a spec might grade, search THREE roots** in this package:
`src/`, `tests/` **and `tests-unit/`**. s43 searched the first two, concluded "no spec asserts
these", and `test:main` found five that did. ⚠️ Exclude `*.bundle.js` — build artifacts under
`tests/` and `src/external/` match everything and drown the result.

✅ **To drive the launcher wizard**, s42's route is in FIX-021's task file. The one trap: **the
Location field is readonly and only a native dialog fills it** — set `WizardContext`'s `location`
through the React state hook, identifying it **by shape, never hop count**.

⚠️ **s43 launched no editor and no dev stack.** Every gate it ran is plain Node.

---

## 5. Rulings — the sixteen from s42, and what a builder must not get wrong

⚠️ **Each is recorded in full, with rejected options, in its own task file.** The five s43 built are
now marked BUILT there. What is left:

- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids — and the current criteria would score that as a win.** Measure
  node choice **and** chain shape. ⚠️ The n=5 cells are not a floor; re-run at n=10.
  ⚠️ **Coupling:** Richard's user-profile example — *"prefer inbuilt nodes"* — **is** this ruling.
  That preference belongs in the profile, where this user can change it. **Do not build the
  weighting in a way that forecloses FIX-021's slices A/B.**
- 🔴 **FIX-016 ruling 1 — keep the Script node STRICT, and make it TEACH.** Do **not** make the
  parser accept an undeclared `Outputs.Done()`. Add the editor-time diagnostic that is absent.
  Rejected: (a) copy/default.
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. **§C — dual-list, and narrow the fence** to
  *"changes no existing block type id"*.
- ✅ **FIX-005 — rename → `App Variables` + `App Config`.** ⚠️ **Reverses VFN-012 knowingly.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction currently **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) last-used. Slices A/B GREEN as a USER PROFILE**, per-user and
  gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-008 C — the measurement is an AGENT's, not Richard's.** Mis-filed as his for fourteen
  sessions. Register both servers, ask a model to author, see which it reaches for.
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** Re-graded s43: the rate survives. §3 has the
  one cell still missing before a rule can be written safely.

### 🔴 Two things Richard raised that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables` for Blockly-scoped ones, in their own *Variables / Functions /
  Blocks* drawer. ✅ **This is Blockly's own native model.** **Wants its own task; do not fold it
  into the rename.**
- 🔴 **FIX-015 → its own phase, green-lit.** 182 tokens, storage, CSS generation, preview + deploy
  injection all built and running, and **no shipped build has ever rendered the panel** —
  `config.devMode` has never been set and `TokenPicker` has **zero call sites**. ⚠️ **Slice 1 is
  "build and test the panel", not "un-gate it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** (in the new phase's scoping session) ·
  🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s43.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Eleven
  sessions have declined.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).
- ⚠️ **Minor:** `claude-haiku-4-5-20251001` is missing from the harness's pricing registry, so haiku
  sessions report `costUsd: null`.
- ⚠️ **Minor, from s42:** `fix021-drive-ai` / `fix021-drive-plain` sit in the launcher list pointing
  at a **scratchpad path that will be cleaned**. Harmless, but they will read as broken projects.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls, and s43 lost two calls to exactly that (the phase directory is
`phase-66-0.1.7-bug-fixes`, **not** `phase-66-scoped-from-the-user-test`).

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. ✅ **s43 committed eleven pathspecs**; the rest of the
dirty tree was peers' (kit-scaffold, phase-65, ProjectFiles, CodeFileDocument, KitsSection, cn-006).
⚠️ **Peers were actively writing throughout this session** — five files appeared in `git status`
between its first and last read.

⚠️ **This checkout is busy.** ✅ **A peer will hold source saves if you ask** — a webpack recompile
HMR-reloads the renderer and wipes every injected CDP global mid-drive. ✅ The measurement
instruments in §4 are plain Node and safe beside a live stack, like `test:main`.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.

🔴 **It moves while you read it. Do not quote any figure from a handover: take your own.**
✅ **Prefer filing into an already-pointed-to memory** — that costs zero budget.
⚠️ **Whoever trims it must read it immediately before writing** — peers append concurrently, so a
trim computed from a five-minute-old read silently discards their lines.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

If those two numbers come out *equal*, your instrument is wrong, not the file.

### Peer etiquette

🔴 **`SendMessage` needs the `[ref]` for EVERY name.** Copy `name [ref]` from a fresh `ListAgents`.
🔴 **Reply to a socket on its socket.** ⚠️ **Announce teardown to the FULL launch list**, re-taking
`ListAgents` first. 🔴 **Keep peer messages short and rare.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ✅ The reaping bug
is **fixed and measured** — but **keep announcing**, because a reaper started before those commits
still holds the old inert module. ⚠️ **Compare pids, never counts.**
