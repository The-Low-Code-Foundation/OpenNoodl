# Phase 66 — next session

**Written 2026-08-16, session 40.** A rewrite, per §0. s39 closed FIX-006. **s40 drove FIX-004
acceptance 2's cloud half — the item s39 called the top agent-actionable one — which closes
acceptance 2 and with it all five of FIX-004 §A+§B's criteria.** The prediction the task file left
for this session was wrong, and it was wrong in the direction that would have filed a working
feature as broken.

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
| **FIX-006** — all four ACs | ✅ | ✅ s39 | **CLOSED — the thirteenth.** ⚠️ Criteria met, *contribution* unmeasured — the control arm passes identically. Read s39's §3 before citing it |
| **FIX-004** §A+§B — all five ACs | ✅ s34 | ✅ **s40** | **CLOSED — the fourteenth.** AC 1/3/4/5 s35; **AC2's browser half s35, cloud half s40** |
| **FIX-004** §C | ✅ s37 | ✅ s38 | Data category at index 13; all 7 blocks draw; chain returns `3`; `in` inversion reproduced live. **Seam-category ruling still open** |
| **FIX-005** part 1 | ✅ s34 | ✅ s35 | Criteria 1–3 close, both themes. 🔴 Toolbox half is **dead code**. Part 2 = ruling |
| **FIX-021** slice 0 | ✅ s34 | 🔴 — | 7 specs. Slices A/B need Richard |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | **Answer ruling 1 first** — see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Fourteen closed outright. Three partial** (008, 016, 017). **Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

✅ **s40 took four gates, and they cover everything it changed.**

| Gate | Reading | When |
|---|---|---|
| **`nodegx-backend` jest (full)** | ✅ **100 suites / 1085 passed, 10 skipped, 0 failed** | **s40** |
| **`noodl-editor` `test:main` (jest)** | ✅ **214 suites / 3336 tests, 0 failed** | **s40** |
| **`tsc -p packages/nodegx-backend/tsconfig.tests.json --noEmit`** | ✅ **0 errors** | **s40** |
| **`tsc --noEmit -p packages/noodl-editor/tsconfig.json`** | ✅ **0 errors** | **s40** |
| `test:ci` (jasmine) | ⚠️ **2843 / 6 @ seed 39393** — **INHERITED, not re-measured** | s38 |
| `noodl-mcp` jest | ✅ 45 suites / 530 tests | s36 |
| `noodl-mcp` `tsc` | ⚠️ 8 errors, all pre-existing | s34 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

⚠️ **Why s40 did not run `test:ci`, stated as a claim rather than a cost.** Its only source change is
**comment-only** (`NoodlBlocks.ts`), which both `tsc` runs prove parses. Its two spec files are jest
(`tests-unit/` and `nodegx-backend/tests/`) and `test:ci` runs neither. Nothing s40 touched is
reachable from it. **If you change Blockly *behaviour*, that reasoning does not transfer — run it.**

🔴 **Both `tsc` readings were read off EMPTY OUTPUT, not an exit code** — `… | tail` reports the
pipe's status, not the compiler's.

🔴 **`test:ci`'s exit code misleads BOTH ways** — a clean floor run exits **1**. **Prove completion
from `test-results.json`'s mtime, never the exit code.** Delete it before a run.

✅ **Predict the count before comparing to the floor**: `git log <floor-tree>..HEAD --
packages/noodl-editor/tests/`. Empty ⇒ the total must be **exactly** 2843. ⚠️ `test:main` moved
212 → **214** suites and 3313 → **3336** tests since s37 on peers' work; s40 added **one** test to an
existing suite. **Re-measure; never quote a handover's figure as your own.**

⚠️ **`tsc -p tsconfig.tests-main.json`'s 31 errors are NOT a gate and NOT a regression** — see
FIX-004's task file. Do not re-derive this a fourth time.

---

## 3. What s40 found

Full write-up in `FIX-004-THE-BLOCKS-THAT-ARE-MISSING.md`, appended section *"Acceptance 2's cloud
half"*. Four things belong here.

### ✅ `noodl_log` prints from a real cloud function — acceptance 2 closes

Driven on a **standalone backend, no jest and no editor**:
`node packages/nodegx-backend/dist/cli.js serve --data-dir <tmp> --port 8591`, a hand-written
`workflows/*.workflow.json` holding `Request → Logic Builder → Response`, and `curl`.

| arm | `generatedCode` | response | probe on stdout |
|---|---|---|---|
| **treatment** | `console.log('FIX004-STDOUT-PROBE-5510');` | 200 | ✅ **present, verbatim, bare** |
| **control** | `'FIX004-STDOUT-CONTROL-4417';` | 200 | ❌ absent |

🔴 **Both arms carry a unique probe string inside their generated code** and differ only in whether it
sits inside the block's `console.log`. That is what excludes the boring explanation — the runner
echoing its own source, inputs, or execution record. Gated regression:
`nodegx-backend/tests/cloud-logic-builder-log.test.ts`, **6 cases**, including an arm that grades the
suite's own oracle (a throwing program: the statement before the throw prints, the one after does
not, and `failure` carries the response — so a 200 via `success` really does mean the body ran).

### 🔴 The mechanism this task file told s40 to expect was dead code

FIX-004 said *"expect a Noodl log entry, not stdout"* — `sandbox.isolate.js:26` installs a
`global.console` forwarding to `_noodl_api_call('log', …)`. **Retired.**
`noodl-viewer-cloud/webpack-configs/webpack.prod.js:1-6` records that server and its sandbox as
deleted (WF-007), and **`_noodl_api_call` has no implementation in this repo** — only the four call
sites inside the dead file. Cloud functions run **in-process** in `nodegx-backend` via the real
`CloudRunner` (`@cloud-runtime`, `WorkflowRunner.ts:38`), so `console` is Node's own.

⚠️ **Looking in the predicted place and finding nothing would have filed a working feature as
broken, with a citation.** The residual: the isolate bundle is still *built* as the published
`@noodl/cloud-runtime` artefact, so an external consumer could still supply those globals — nothing a
spec here can reach.

✅ **Fixed at source, not only here.** The task file had copied a stale **code comment** on
`noodl_log` in `NoodlBlocks.ts` whose conclusion was right and reason obsolete. That comment now
carries the measured mechanism — because the next person to ask reads the block, not this file.

### 🔴 A block's `console.log` is a bare one, and a secret logged from a block leaks

Measured with a control, not reasoned about:

| arm | block program | provisioned secret in output |
|---|---|---|
| control | `console.log('SECRETLEN:' + String(Inputs["secret"]).length)` | ❌ absent — and `SECRETLEN:29` present, so the wire was live |
| **treatment** | `console.log(Inputs["secret"])` | 🔴 **present, in the clear** |

`net.noodl.Log` — the *node* — is levelled, carries the request id, lands in the execution record and
is redacted by key **and** by value (CWF-013). The **block** has none of that: the probe appeared in
**no** JSON log line. ⚠️ **A consequence of FIX-004, not a defect in it** — but a new unredacted door
onto stdout. **It wants a ruling; see §5.**

### 🔴 An instrument bug that passes alone and fails in the suite

The spec first captured output by spying `process.stdout.write`, copying `cloud-log-node.test.ts`.
**6/6 alone; 4 presence assertions red under a bare `npx jest`.** Jest runs a lone file in band; in a
**worker** it buffers console output over IPC, so `process.stdout.write` is never called.
`cloud-log-node.test.ts` is immune only because the structured logger writes to stdout **directly**
(`ops/logger.ts:61`). ✅ Now spies `console.log` too and asserts on the union — **and this is why the
CLI drive is the load-bearing evidence for "real stdout"**: under jest the assertion is about a
`console.log` *call*. Filed to memory.

---

## 4. What to do next and why

1. 🟢 **The FIX-006 half nobody has measured: does the planner over-decompose?** Now the top
   agent-actionable item. The report's first complaint was a component that should not have existed,
   and s39's authoring harness is structurally blind to it (`AuthoringSession` is handed its
   `componentPath`). `PlanningSession` + `decomposition.ts:64-66` (the "logic cluster → component"
   rule) and its counter-rule at `:117-121`. The harness works and the corpus prompt exists, so this
   is cheap. **File it as a new task rather than reopening FIX-006, which closed on its own ACs.**
2. 🟢 **FIX-005's dead selectors** — delete the four dead rules, or retarget them to
   `.blocklyToolboxSelected`. ⚠️ **Retargeting is a visible redesign of the toolbox.** Needs §5.
3. 🔴 **FIX-016 §1, FIX-017's remaining half, FIX-008 C, FIX-013** — all need Richard (§5).

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

### How to start here

🔴 **If you are grading anything a cloud function does, the cheap instrument is
`packages/nodegx-backend/tests/` — not the editor.** `BackendService` starts in-process on port 0,
cloud functions are hand-written `workflows/*.workflow.json` (`Request → … → Response`, node `type`
strings exactly as the editor writes them, e.g. `"Logic Builder"`), and `POST /functions/:name` goes
over real HTTP. It is plain Node and **safe beside a live editor stack**. ~15 `cloud-*.test.ts` files
are worked examples.

⚠️ **For anything about *output*, drive the standalone CLI as well** (§3) — the jest console trap is
real, and the CLI is one command.

⚠️ **Two traps that cost s40 time.** A quoting bug in `node -e` wrote `console.log(+PROBE+);` and the
first drive measured shell quoting, not the block — **put a generator script in a file**. And a
compile failure with only `success` wired **hung the request until curl's own timeout** (CWF-018
reproduced incidentally): wire `failure` in any fixture that might not compile.

If you are driving anything Blockly, **read `driving-the-app-pointers.md` first** — the property panel
is not where Blockly lives; the workspace opens in a canvas tab via `LogicBuilder.OpenTab`.

---

## 5. Owed by Richard

- 🟢 **FIX-004 — the redaction ruling, NEW from s40.** A `noodl_log` block can print a provisioned
  secret to stdout in the clear, where the `Log` node cannot. **(a)** Accept — a block program is
  code, and code can always print. **(b)** Route the block's generated `console.log` through the same
  scrubbed sink the `Log` node uses. **(c)** Leave the behaviour and say so in the block's tooltip.
  ⚠️ **(b) is not free**: that sink is the per-run `runContext`, which generated code has no handle on
  today.
- 🟢 **FIX-006 — the `Substring` question, from s39.** With the compute/code-style blocks in the
  prompt the model does string surgery **inline in code** (7/10); with them removed it reaches for the
  dedicated **`Substring` node** (10/10). Which is better for a beginner? If the node is, the blocks
  nudge the wrong way. **Cheap either way.**
- 🟢 **FIX-004 §C — the seam-category question.** Should `App Objects` also list the four
  object-shaped blocks? And should `tests-unit/vfn-012/browser-blocks.spec.ts`'s byte-identity
  assertion be narrowed to the claim its own title makes?
- 🟢 **FIX-006 AC4 — `Javascript2`.** Either add the id to the Script line, or narrow
  `traps.ts:61-63`'s stated rule to the three recommendations. **One edit either way.**
- 🟢 **FIX-005 — the dead-selector decision.** §4 item 2. Delete or retarget.
- 🔴 **FIX-005 part 2 — the rename.** **A.** Keep `Runtime Variables` + a tooltip. **B.**
  `Global Variables` + `App Config` → `App Settings`. **C.** Revert to `App Variables`. ⚠️ **It
  reverses VFN-012 deliberately**, and the stated reason is the *opposite* of why it was renamed.
- 🟢 **FIX-016 ruling 1.** **(a) Copy/default**: the row says only `Type` and reads `String` whether
  or not anything is stored. **(b) Parser asymmetry, RE-PRICED DOWN**: `Outputs.Done_1()` /
  `Outputs.Done.send()` get a value port and no Type row but **throw at runtime by name and line** —
  a copy question. ⚠️ **Do not conflate with plain `Outputs.Done()`.**
- 🔴 **FIX-016 §3 — signal-input semantics.** Re-run the body, or dispatch to a named handler? Or rule
  signal inputs out. **The only genuinely blocked part of FIX-016.**
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible. ⚠️ Ctrl-Space is **OS-bound on
  your machine** (`com.apple.symbolichotkeys` key 60).
- 🔴 **FIX-017 AC3** — premise false (ports and API names never share a prefix). Restate or strike.
- 🔴 **FIX-008 fix C** — a measurement from you. The oldest open item on this list.
- 🔴 **FIX-013 — four rulings; answer ruling 1 FIRST.** Ruling 2's real payoff is **three files**.
  ✅ The big subtraction is **ruling 1(c)'s**.
- 🔴 **FIX-015** — the eight rulings. Brainstorm, then its own phase.
- 🔴 **FIX-021 slices A/B** — the six memory rulings. Slice 0 is done.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58. It
  is **phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s40.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Fix it, delete
  it, or rule that a closed phase's corpus tooling may rot.** Eight sessions have now declined.
- 🟢 **MCP servers accumulate on this checkout and nothing reaps them.** `dev:stop` spares them **by
  design** — right for a live peer, wrong for a dead session, so the population only grows.
  ⚠️ **Killing processes one can only *infer* are orphaned is your call, not a passing session's.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls, and s40 lost one call to a `cd` that had persisted from an earlier one.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. ✅ **s40 committed five files by pathspec**, one of them
new; the rest of the dirty tree was peers'.

⚠️ **This checkout is busy.** ✅ **A peer will hold source saves if you ask** — a webpack recompile
HMR-reloads the renderer and **wipes every injected CDP global** mid-drive. s40 needed no editor and
made no announcement: **the backend suite and the standalone CLI are plain Node**, safe beside a live
stack, like `test:main`. ✅ It checked for `scripts/start.ts` / webpack / `run-electron-tests` before
editing editor source and found none live.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.

🔴 **It is OVER, and it moves while you read it.** s40 measured **17,663** code points / **17,758**
UTF-16 on arrival and **17,671 / 17,767** an hour later, without adding a line. **Do not quote either
figure: take your own.** ✅ **s40 added no index line** — both its findings were filed *into* files
that already have pointers (`harness-and-gates-pointers.md`, `judgement-trap-pointers.md`), which
costs zero budget. **Prefer that.**

⚠️ **Whoever trims it must read it immediately before writing** — several peers append concurrently,
so a trim computed from a five-minute-old read silently discards their lines.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

If those two numbers come out *equal*, your instrument is wrong, not the file.

### Peer etiquette

🔴 **`SendMessage` needs the `[ref]` for EVERY name**, not just duplicated ones. Copy `name [ref]`
from a fresh `ListAgents`. 🔴 **Reply to a socket on its socket**, and do not let a name-addressed
broadcast inherit a socket-sourced fact. ⚠️ **Announce teardown to the FULL launch list**, re-taking
`ListAgents` first.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ✅ The reaping bug
is **fixed and measured** (`2b758a87` + `4fd2cfdb`) — but **keep announcing**, because a reaper
started before those commits still holds the old inert module.

⚠️ **A survivor count is NOT proof the shield was exercised.** The strong version is a **decoy
carrying the target argv**. ⚠️ **Compare pids, never counts.** ✅ s40 started one backend of its own
on port **8591** and confirmed it gone by pid *and* by a closed port.
