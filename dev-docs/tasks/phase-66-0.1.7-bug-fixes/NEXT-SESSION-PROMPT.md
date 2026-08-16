# Phase 66 — next session

**Written 2026-08-16, session 42.** A rewrite, per §0. s41 measured FIX-022 and found the planner
defect real but the doctrine innocent. **s42 took the only row in the table that was built but never
run in the app — FIX-021 slice 0 — and drove it, with a control.** It closes. The drive also turned
up a small creation-flow friction that belongs to nobody's task yet.

⚠️ **After this session the agent-actionable queue in this phase is empty.** Everything left in §5 is
a ruling owed by Richard. Read §4 before assuming there is code to write.

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
| **FIX-021** slice 0 | ✅ s34 | ✅ **s42** | **Acceptance 1 CLOSED** — launcher file and MCP twin **byte-identical**, control separates. Slices A/B still need Richard |
| **FIX-004** §C | ✅ s37 | ✅ s38 | **Seam-category ruling still open** |
| **FIX-005** part 1 | ✅ s34 | ✅ s35 | Criteria 1–3 close, both themes. 🔴 Toolbox half is **dead code**. Part 2 = ruling |
| **FIX-022** — the planner half of the report | ✅ s41 | ✅ s41 | **MEASURED.** Defect real (5/10); **doctrine not the cause** (6/10 without it). 🟢 **One ruling owed** |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard. **D is the one unstarted *build* in the phase** |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | **Answer ruling 1 first** — see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Fourteen closed outright. Four partial** (008, 016, 017, 022) **plus FIX-021 slice 0 closed inside
an otherwise-open task. Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

🔴 **s42 took no gate readings, and that is a claim, not an omission.** It changed **no source** —
two markdown files under `dev-docs/`, nothing else. The drive exercised code that was already
committed at s34 and already covered by the 7 specs in the shared MCP suite. **If you change source,
this row does not transfer to you.**

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main` (jest)** | ✅ **216 suites / 3363 tests, 0 failed** | s41 |
| **`tests-unit/phase-66/planDoctrineArm.test.ts`** | ✅ **13/13**; **7/13 red** under a stubbed transform | s41 |
| **`tsc` over `scripts/aix002-measure/*.ts`** | ✅ **0 errors in harness files** | s41 |
| `nodegx-backend` jest (full) | ✅ 100 suites / 1085 passed, 10 skipped | s40 |
| `test:ci` (jasmine) | ⚠️ **2843 / 6 @ seed 39393** — **INHERITED, last actually taken s38** | s38 |
| `noodl-mcp` jest | ✅ 45 suites / 530 tests | s36 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

⚠️ **Every figure above is inherited.** **Re-measure; never quote a handover's figure as your own.**
Peers move `test:main` daily — it went 214→216 suites between s40 and s41 and most of that was theirs.

🔴 **`test:ci`'s exit code misleads BOTH ways** — a clean floor run exits **1**. **Prove completion
from `test-results.json`'s mtime, never the exit code.** Delete it before a run.

✅ **PIN THE SEED: `NOODL_SPEC_SEED=39393`.** ✅ Predict the count first:
`git log <floor-tree>..HEAD -- packages/noodl-editor/tests/`. Empty ⇒ the total must be **exactly** 2843.

⚠️ **`tsc -p tsconfig.tests-main.json`'s 31 errors are NOT a gate and NOT a regression** — see
FIX-004's task file. Do not re-derive this a sixth time.

---

## 3. What s42 found

Full write-up in `FIX-021-THE-PROJECT-THAT-KNOWS-ITS-BUILDER.md`, new section *"Slice 0 — DRIVEN"*.

### ✅ Slice 0 works in the product, and the control proves the drive measured it

The real launcher wizard, all the way through — *New project* → **Start with AI** → name + location →
preset → **one live scoping turn against the configured provider** → Continue → **Create project**.

| project | how | summary line | `## Where the decisions are` | bytes |
|---|---|---|---|---|
| `fix021-drive-ai` | launcher, **AI mode** | ✅ | ✅ | **1401** |
| twin, same name + summary | **`create_project`** (MCP) | ✅ | ✅ | **1401** |
| `fix021-drive-plain` | launcher, **Quick Start** | — | — | 963 |

✅ **`diff` launcher vs. MCP twin: identical bytes.** That is acceptance criterion 1 as written,
measured on disk rather than through the installer's own test host.

✅ **The third row is the control and it separates.** Quick Start writes no `docs/`, so
`result.written.length > 0` is false, the upgrade never runs, and neither block appears. Had that
file carried them too, the drive would have measured nothing.

⚠️ **The `kept-existing` guard was NOT driven** — the interesting half, the one that refuses to touch
a `CLAUDE.md` it did not write. A freshly created project's file is by construction the one the
installer just wrote, so the refusal path cannot arise here. It stays **spec-only**.

### 🔴 Incidental — the creation wizard has no default location, in any mode

Verified in code *and* in the app. `ProjectCreationWizard` gets **no `initialState`**
(`ProjectsPage.tsx:1278-1286`), `WizardProvider` defaults `location: ''`, and the Location field is
`isReadonly` — so it is fillable **only** by `Browse…` and a native folder dialog. Measured: name
typed, no location ⇒ **`Next` disabled**; it enabled the instant a location was set.

⚠️ **The fallback already exists and is unreachable** — `LocalProjectsModel.newProject` defaults to
`platform.getDocumentsPath() + name` (`:300`), but the wizard always supplies `path`, so it never
applies. Every new project costs a native dialog a default would spare. **Not fixed** — it is a
change to the creation UI and outside FIX-021's scope. Wants its own task or a ruling (§5).

---

## 4. What to do next and why

🔴 **There is no agent-actionable build left in this phase except FIX-008 D.** Do not invent one.

1. 🟢 **FIX-008 D** — `open_project` / an emitted registration line. The only item in §1 that is a
   *build* and not a ruling. It "removes the class" that A/B/E only patched. ⚠️ It was never scoped
   in detail; read FIX-008's *"What is left"* before starting, and it may deserve a ruling first.
2. 🟢 **FIX-022 needs a ruling, not a build** (§5). ⚠️ **The instrument is reusable for any prompt
   edit** — `--doctrine=on|off` generalises to "with/without the thing you just wrote", and a
   10-sample both-arms run is **~$0.09 and eight minutes**. Whatever the ruling, measure the fix.
3. 🟢 **FIX-005's dead selectors** — delete the four dead rules, or retarget them to
   `.blocklyToolboxSelected`. ⚠️ **Retargeting is a visible redesign of the toolbox.** Needs §5.
4. 🔴 **Everything else needs Richard** (§5).

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

### How to start here

🔴 **If you are grading anything the AI *plans***: `packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`.
Real `PlanningSession`, real prompt, real validator, structured output so the grade is a count.
✅ **`--dump=<path>` writes the arm's system prompt and exits before the provider is built** — the
arms are checkable with no API key.

🔴 **If you are grading what it *authors*, use the sibling** `dist/aix002-harness.cjs` (FIX-006's).
They share `shared.ts` and one `build.mjs`; **build once, both bundles rebuild.**

🔴 **If you are grading anything a cloud function does**, the cheap instrument is
`packages/nodegx-backend/tests/` — not the editor. Plain Node, safe beside a live stack.

✅ **If you need to drive the launcher wizard**, s42's route is in FIX-021's task file. The one trap:
**the Location field is readonly and only a native dialog fills it**, so set
`WizardContext`'s `location` through the React state hook rather than trying to type into it. Walk up
`__reactFiber$` from the name input ~14 hops to the hook whose `memoizedState` has both `location` and
`projectName`, then call `hook.queue.dispatch`. Everything downstream is ordinary clicks.

⚠️ **s42 launched and tore down a dev stack.** No announcement was made: `ps` showed no
`scripts/start.ts`, no webpack and no `run-electron-tests` before launching. `dev:stop` reported
**26 processes stopped, nothing left running**, and **41 `noodl-mcp.cjs` survived** — the `NEVER_SWEEP`
shield doing its job. ⚠️ **Compare pids, never counts** if you check this yourself.

---

## 5. Owed by Richard

- 🟢 **The wizard's missing default location. NEW from s42.** Every new project, in every mode,
  requires `Browse…` and a native dialog before `Next`/`Create` enables — and
  `LocalProjectsModel.newProject`'s own `~/Documents` fallback is unreachable because the wizard
  always supplies `path`. **(a)** Seed `location` from `getDocumentsPath()` and let `Browse…` override.
  **(b)** Seed it from the last-used location. **(c)** Deliberate — an explicit choice every time.
  ⚠️ **(a) and (b) both make `Next` live on open**, which changes the first thing the wizard teaches.
- 🟢 **FIX-022 — the counter-rule does not bind.** ~50% of plans for a single derived value create a
  component; the doctrine already forbids it in words; removing the doctrine does not fix it.
  **(a)** Accept — a `Reading Time` component is nameable and reusable, and the Script node inside it
  is FIX-006's axis, already fixed. **(b)** Give the counter-rule a numeric floor stated the way the
  positive rule states its trigger. **(c)** Move it to `planAdvisories`, which already speaks to the
  model once and the human after. ⚠️ **Measure any fix against `multi-section` too** — the ceiling
  there is the only guard against a "factor less" edit quietly undoing AAQ-008.
- 🟢 **FIX-004 — the redaction ruling.** A `noodl_log` block can print a provisioned secret to stdout
  in the clear, where the `Log` node cannot. **(a)** Accept. **(b)** Route through the scrubbed sink.
  **(c)** Say so in the tooltip. ⚠️ **(b) is not free.**
- 🟢 **FIX-006 — the `Substring` question.** With the compute/code-style blocks the model does string
  surgery inline (7/10); without them it reaches for the **`Substring` node** (10/10). Which is
  better for a beginner? ⚠️ **That was n=5 per cell** — see s41's n=3 finding before treating
  10/10 vs 7/10 as settled.
- 🟢 **FIX-004 §C — the seam-category question.** Should `App Objects` also list the four
  object-shaped blocks? And should `browser-blocks.spec.ts`'s byte-identity assertion be narrowed?
- 🟢 **FIX-006 AC4 — `Javascript2`.** Add the id to the Script line, or narrow `traps.ts:61-63`.
- 🟢 **FIX-005 — the dead-selector decision.** §4 item 3. Delete or retarget.
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
- 🔴 **FIX-021 slices A/B** — the six memory rulings. ✅ **Slice 0 is now built *and* driven.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58. It
  is **phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s42.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Ten sessions have
  now declined.**
- 🟢 **MCP servers accumulate on this checkout and nothing reaps them.** `dev:stop` spares them **by
  design** — **41 counted at s42's teardown**. ⚠️ **Killing processes one can only *infer* are
  orphaned is your call.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).
- ⚠️ **Minor:** `claude-haiku-4-5-20251001` is not in the harness's pricing registry, so every haiku
  session reports `costUsd: null`. A reporting gap, not a measurement one.
- ⚠️ **Minor, from s42:** the two drive projects `fix021-drive-ai` / `fix021-drive-plain` are now in
  the launcher's list pointing at a **scratchpad path that will be cleaned**. Harmless and
  self-labelling — the list already carries a dozen such entries from earlier drives — but they will
  read as broken projects if anyone clicks them.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. ✅ **s42 committed by pathspec**; the rest of the dirty tree
was peers' (kit-catalog, phase-65, cn-004 fixtures).

⚠️ **This checkout is busy.** ✅ **A peer will hold source saves if you ask** — a webpack recompile
HMR-reloads the renderer and **wipes every injected CDP global** mid-drive. ✅ **The three measurement
instruments named in §4 are plain Node and safe beside a live stack**, like `test:main`.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.

🔴 **It is OVER, and it moves while you read it. Do not quote any figure from a handover: take your
own.** ✅ **s42 added no index line** — its findings were filed *into* existing memories that already
have pointers, which costs zero budget. **Prefer that.**

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
