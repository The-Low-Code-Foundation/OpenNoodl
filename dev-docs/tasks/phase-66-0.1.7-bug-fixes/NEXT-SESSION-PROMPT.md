# Phase 66 — next session

**Written 2026-08-16, session 42.** A rewrite, per §0. s42 drove FIX-021 slice 0 (§3), then **Richard
ruled on all sixteen open items in one sitting.**

🔴 **The character of this phase has changed. For twenty sessions the blocker was rulings; it is now
a build queue.** Nothing below waits on Richard except FIX-013's rulings 2–4 and FIX-015's eight,
which are a scoping session of their own.

🔴 **Every ruling is recorded in its own task file under a `## ✅ RULED 2026-08-16 (session 42)`
heading, with the rejected options named.** This file is overwritten each session — **the task files
are the durable record, and they are where you read the reasoning before you build.** §5 here is a
work order, not the source of truth.

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
| **FIX-006** — all four ACs | ✅ | ✅ s39 | **CLOSED — the thirteenth.** AC4 + the Substring axis now RULED, so there is new work |
| **FIX-004** §A+§B | ✅ s34 | ✅ s40 | **CLOSED — the fourteenth.** Redaction + §C now RULED |
| **FIX-021** slice 0 | ✅ s34 | ✅ **s42** | **Acceptance 1 CLOSED** — launcher file and MCP twin **byte-identical**, control separates |
| **FIX-022** | ✅ s41 | ✅ s41 | 🔴 **RULED — no numeric floor. The headline is retired; re-grade before building anything** |
| **FIX-005** part 1 | ✅ s34 | ✅ s35 | Selectors + rename both RULED |
| **FIX-008** A, B, E | ✅ | ✅ | C now unblocked (**the measurement is an agent's, not Richard's**); D unstarted |
| **FIX-016** §2, §3c | ✅ | ✅ | 🔴 **§3 RULED — the phase's only genuinely blocked item is now unblocked** |
| **FIX-017** §B, §A | ◐ | ◐ | AC1 **accepted**, AC3 **struck** — the task closes on documentation |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open, and smaller than the file claimed |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |
| **FIX-021** slices A/B | 📋 | — | **GREEN — a user profile.** Three of six questions answered |

**Fourteen closed outright. Everything else now has a ruling to build against.**

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

🔴 **s42 took no gate readings, and that is a claim, not an omission.** It changed **no source** —
only markdown under `dev-docs/`. **The moment you act on §5 you are changing source, and none of the
rows below transfer to you.**

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main` (jest)** | ✅ **216 suites / 3363 tests, 0 failed** | s41 |
| `nodegx-backend` jest (full) | ✅ 100 suites / 1085 passed, 10 skipped | s40 |
| `test:ci` (jasmine) | ⚠️ **2843 / 6 @ seed 39393** — last actually taken s38 | s38 |
| `noodl-mcp` jest | ✅ 45 suites / 530 tests | s36 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

⚠️ **Every figure above is inherited.** **Re-measure; never quote a handover's figure as your own.**
`test:main` moved 214→216 suites in a single day and most of it was peers'.

🔴 **`test:ci`'s exit code misleads BOTH ways** — a clean floor run exits **1**. **Prove completion
from `test-results.json`'s mtime, never the exit code.** Delete it before a run.
✅ **PIN THE SEED: `NOODL_SPEC_SEED=39393`.** ✅ Predict the count first:
`git log <floor-tree>..HEAD -- packages/noodl-editor/tests/`. Empty ⇒ the total must be **exactly** 2843.

⚠️ **`tsc -p tsconfig.tests-main.json`'s 31 errors are NOT a gate and NOT a regression.** Do not
re-derive this a sixth time.

🔴 **FIX-005's rename and FIX-004's §C both touch Blockly**, which means **`.jsx`/`test:ci` territory
and another phase's spec file.** Budget `test:ci` for those two specifically.

---

## 3. What s42 did

### ✅ FIX-021 slice 0 driven — the last built-but-unrun row

Real launcher wizard, end to end: *New project* → **Start with AI** → name + location → preset →
**one live scoping turn** → Continue → **Create project**.

| project | how | summary line | `## Where the decisions are` | bytes |
|---|---|---|---|---|
| `fix021-drive-ai` | launcher, **AI mode** | ✅ | ✅ | **1401** |
| twin, same name + summary | **`create_project`** (MCP) | ✅ | ✅ | **1401** |
| `fix021-drive-plain` | launcher, **Quick Start** | — | — | 963 |

✅ **`diff` launcher vs. twin: identical bytes** — acceptance criterion 1 as written, measured on
disk rather than through the installer's own test host. ✅ **The third row is the control and it
separates**: Quick Start writes no `docs/`, the upgrade never runs, neither block appears.

⚠️ **The `kept-existing` guard was NOT driven** and stays **spec-only** — it cannot arise on a fresh
project, whose file is by construction the one the installer just wrote.

### 🔴 The ruling that retired s41's headline — read this before touching FIX-022

Richard: *"no number. I sometimes create components with just one node inside… because I want to
reuse that function in multiple places."*

s41 measured *"5/10 plans create a whole component for one derived value"* and s42 recommended a
numeric floor. **Both are wrong-shaped.** A one-node component is legitimate **when it is placed more
than once**, and **the grade never checked how many times the plan places it.** So:

- **5/10 is an upper bound on the defect, not a measurement of it.**
- The axis is **reuse**, not size. A node-count rule would forbid work the product owner does on
  purpose.
- ✅ **The next step is a re-grade of the 20 saved plans for instantiation count — no new API calls.**
  Only a surviving single-use rate justifies writing any rule at all.

---

## 4. What to do next and why

**Ordered by cost. The first four are small and independent — a good session takes all of them.**

1. 🟢 **FIX-017 — documentation only.** Accept AC1 (Ctrl-Space is OS-bound, not ours), strike AC3
   (premise false) with one line saying why. **Closes the task.**
2. 🟢 **FIX-005 selectors — delete the four dead rules.** Not retarget. Hygiene, matches what
   `5b91e9c8` did to `.goog-*`.
3. 🟢 **FIX-006 AC4 — add the `Javascript2` id to the Script line.** One string.
4. 🟢 **FIX-016 §3 — document `run` as the Function's only trigger.** Signal inputs are ruled out;
   Script nodes are the multi-signal node. **This closes the item that was blocked for twenty
   sessions.**
5. 🟢 **FIX-022 re-grade** (§3 above). Cheap, and it decides whether there is a defect to fix.
6. 🟢 **FIX-021 — seed the wizard's location from last-used**, falling back to
   `getDocumentsPath()` on first run.
7. 🟠 **FIX-016 ruling 1 — the teaching diagnostic.** Keep the Script node strict; add the
   editor-time message an author currently never gets. ⚠️ Read the task file: the strictness is
   deliberate and must survive the fix.
8. 🟠 **FIX-004 §C — dual-list the four object-shaped blocks under `App Objects`**, and narrow
   `browser-blocks.spec.ts`'s byte-identity fence to what its title claims.
9. 🟠 **FIX-005 rename → `App Variables` / `App Config`.** ⚠️ **Knowingly reverses VFN-012** — say so
   in the commit.
10. 🟠 **FIX-008 C** — take the two-servers-visible measurement yourself, then build C.
11. 🔴 **FIX-006 Substring weighting** — a prompt edit, and the one most likely to be got wrong. See
    §5's note: the rule is **not** "prefer nodes".
12. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink. Not free; price it.
13. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
14. 🔴 **FIX-021 slices A/B** — the user profile. Big, and three of its six questions are answered.

**Do not start** FIX-015 here — it is its own phase (§5).

### How to start here

🔴 **If you are grading anything the AI *plans***:
`packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`. Real `PlanningSession`, real
prompt, real validator. ✅ **`--dump=<path>` writes the arm's system prompt and exits before the
provider is built** — arms are checkable with no API key. **The 20 saved plans from s41 are what
item 5 re-grades.**

🔴 **If you are grading what it *authors*, use the sibling** `dist/aix002-harness.cjs`. They share
`shared.ts` and one `build.mjs`; **build once, both bundles rebuild.**

🔴 **If you are grading a cloud function**, use `packages/nodegx-backend/tests/` — plain Node, safe
beside a live stack.

✅ **To drive the launcher wizard**, s42's route is in FIX-021's task file. The one trap: **the
Location field is readonly and only a native dialog fills it** — set `WizardContext`'s `location`
through the React state hook (walk `__reactFiber$` up from the name input to the hook whose
`memoizedState` holds both `location` and `projectName`, identify it **by shape, never hop count**).
Everything downstream is ordinary clicks.

⚠️ **s42 launched and tore down a dev stack.** No announcement: `ps` showed no `scripts/start.ts`, no
webpack, no `run-electron-tests`. `dev:stop` reported **26 stopped, nothing left running**, and
**41 `noodl-mcp.cjs` survived** — the `NEVER_SWEEP` shield working. ⚠️ **Compare pids, never counts.**

---

## 5. Rulings — all sixteen answered 2026-08-16, and the traps inside them

⚠️ **Each is recorded in full, with rejected options, in its own task file.** Below is what a builder
must not get wrong.

- 🔴 **FIX-022 — no numeric floor; the axis is REUSE.** See §3. **Re-grade before building.**
- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids — and the current criteria would score that as a win.** Measure
  node choice **and** chain shape. ⚠️ The n=5 cells are not a floor; re-run at n=10.
- 🔴 **FIX-016 ruling 1 — keep the Script node STRICT, and make it TEACH.** Do **not** make the
  parser accept an undeclared `Outputs.Done()`. Declaration stays necessary — it is the node's
  character. Add the **editor-time diagnostic** that is currently absent. Rejected: (a) copy/default.
- ✅ **FIX-016 §3 — signal inputs ruled OUT for Functions.** `run` is the only trigger; Script nodes
  are for multiple input signals.
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. Rejected: accept, tooltip-only.
- ✅ **FIX-004 §C — dual-list, and narrow the fence** to *"changes no existing block type id"*.
- ✅ **FIX-005 — delete the dead selectors** (not retarget). **Rename → `App Variables` +
  `App Config`.** ⚠️ **Reverses VFN-012 knowingly.**
- ✅ **FIX-006 AC4 — add the id.**
- ✅ **FIX-017 — AC1 accepted, AC3 struck.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction currently **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed** — and 2's payoff is three
  files, not five.
- ✅ **FIX-021 — wizard location (B) last-used. Slices A/B GREEN as a USER PROFILE.** Richard:
  *"I want a NodeGX user profile for the AI to use, even stuff like 'the user speaks casually but
  avoids swear words' or 'User isn't comfortable with pure javascript and we should prefer inbuilt
  nodes'."* Answers Q4 (**per-user, gitignored — not committed `docs/`**), Q3 (`CLAUDE.md` stays the
  signpost), Q1 (human-authored first). 🔴 **Q2, Q5, Q6 still open.**
  ⚠️ **Note the coupling:** his example *"prefer inbuilt nodes"* **is** FIX-006's ruling. That
  preference belongs in the profile, where this user can change it — not hard-coded into the prompt
  for everybody. **Do not build FIX-006's weighting in a way that forecloses this.**
- ✅ **FIX-008 C — the measurement is an AGENT's, not Richard's.** It was mis-filed as his for
  fourteen sessions. Register both servers, ask a model to author, see which it reaches for.

### 🔴 Two things Richard raised that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks.** *"App Variables, Objects,
  Arrays… they're all declared globally and Blockly could just pick them up and display them as a
  list of blocks, like with the blockly variables… it makes so much more sense than dot notation."*
  Plus `Function Variables` for Blockly-scoped ones, and the whole set in its own
  *Variables / Functions / Blocks* drawer. ✅ **This is Blockly's own native model** — it already does
  exactly this for its own variables. **Wants its own task; do not fold it into the rename.**
- 🔴 **FIX-015 → its own phase, green-lit.** The token system is **built and running** (182 tokens,
  storage, CSS generation, preview + deploy injection) and the AI can read and write all of it, while
  **no shipped build has ever rendered the panel** — `config.devMode` has never been set, and
  `TokenPicker` has **zero call sites**. Richard: *"the panel is probably buggy AF because we never
  tested it."* ⚠️ **Slice 1 is "build and test the panel", not "un-gate it"** — expect the first
  drive to return a bug list. The eight rulings belong to that phase's scoping session.

### Still owed by Richard

- 🔴 **FIX-013 rulings 2, 3, 4.**
- 🔴 **FIX-015's eight rulings** — in the new phase's scoping session, with him.
- 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a PR-gated
  script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s42.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Ten sessions
  have declined.**
- 🟢 **MCP servers accumulate and nothing reaps them** — **41 at s42's teardown.** `dev:stop` spares
  them **by design**. ⚠️ Killing processes one can only *infer* are orphaned is your call.
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).
- ⚠️ **Minor:** `claude-haiku-4-5-20251001` is missing from the harness's pricing registry, so haiku
  sessions report `costUsd: null`.
- ⚠️ **Minor, from s42:** `fix021-drive-ai` / `fix021-drive-plain` sit in the launcher list pointing
  at a **scratchpad path that will be cleaned**. Harmless, self-labelling, but they will read as
  broken projects if clicked.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls, and s42 lost two calls to exactly that.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. ✅ **s42 committed by pathspec**; the rest of the dirty tree
was peers' (kit-catalog, phase-65, cn-004 fixtures).

⚠️ **This checkout is busy.** ✅ **A peer will hold source saves if you ask** — a webpack recompile
HMR-reloads the renderer and **wipes every injected CDP global** mid-drive. ✅ The measurement
instruments in §4 are plain Node and safe beside a live stack, like `test:main`.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.

🔴 **It moves while you read it. Do not quote any figure from a handover: take your own.** s42 found
it **OVER at 17,682** and trimmed to **17,503** — mostly by deleting stale figures the file itself
warns against quoting. ✅ **Prefer filing into an already-pointed-to memory** — that costs zero budget.

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
`ListAgents` first.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ✅ The reaping bug
is **fixed and measured** — but **keep announcing**, because a reaper started before those commits
still holds the old inert module. ⚠️ **Compare pids, never counts.**
