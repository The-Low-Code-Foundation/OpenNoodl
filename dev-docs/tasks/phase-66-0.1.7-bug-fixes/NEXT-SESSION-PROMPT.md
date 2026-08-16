# Phase 66 — next session

**Written 2026-08-16, session 39.** A rewrite, per §0. s38 drove FIX-004 §C and FIX-006 AC4's editor
half. **s39 drove FIX-006 AC1 + AC2 — the item s38 called the phase's most valuable agent-actionable
one — and closed FIX-006 outright.** The criteria pass. The control arm says that is not the same as
the fix working, and the honest grade is written that way.

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
| **FIX-006** — all four ACs | ✅ | ✅ **s39** | **CLOSED — the thirteenth.** AC3 s36, AC4 both halves s36+s38, **AC1+AC2 s39** over 20 live authoring sessions. ⚠️ Read §3: the criteria pass and the *cause* is unmeasured |
| **FIX-005** part 1 | ✅ s34 | ✅ s35 | Criteria 1–3 close, both themes. 🔴 Toolbox half is **dead code**. Part 2 = ruling |
| **FIX-004** §A+§B | ✅ s34 | ✅ s35 | AC 1, 3, 4, 5 close; AC2 half. **Cloud half remains — now the top agent item** |
| **FIX-004** §C | ✅ s37 | ✅ s38 | Data category at index 13; all 7 blocks draw in the flyout; the chain returns `3`; `in` inversion reproduced live |
| **FIX-021** slice 0 | ✅ s34 | 🔴 — | 7 specs. Slices A/B need Richard |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | **Answer ruling 1 first** — see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Thirteen closed outright. Three partial** (008, 016, 017). **Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

🔴 **s39 took no gates, and owes none.** Its only source change is
`packages/noodl-editor/scripts/aix002-measure/` — the measurement harness, which is **in no
`tsconfig` `include`, no jest project and no jasmine suite** (§3). Nothing it touched is reachable
from any gate, so running one would have measured nothing about this change. Everything below is
inherited — **re-measure before quoting.**

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 / 6 @ seed 39393**, six failures identical **by name** | s38, 16:01 |
| **`test:main` (jest)** | ✅ 212 suites / 3313 tests, 0 failed | s37 |
| **`tsc --noEmit -p tsconfig.json`** | ✅ 0 errors | s37 |
| **`tsc -p tsconfig.tests.json`** | ✅ 0 errors | s37 |
| **`noodl-mcp` jest** | ✅ 45 suites / 530 tests | s36 |
| `noodl-mcp` `tsc` | ⚠️ 8 errors, all pre-existing | s34 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

✅ **The harness was typechecked by hand** — `tsc` with the project's `paths` and
`--resolveJsonModule` supplied on the command line reports **0 errors in
`scripts/aix002-measure/`**. ⚠️ Do this bare (`npx tsc harness.ts`) and you get ~20 phantom
`TS2307`s from the missing aliases; they are your flags, not the code.

🔴 **`test:ci`'s exit code misleads BOTH ways** — a clean floor run exits **1**, and `… | tail`
reports the pipe's last command, so it prints 0 whatever the suite did. **Prove completion from
`test-results.json`'s mtime, never the exit code.** Delete it before a run.

✅ **Predict the count before comparing to the floor**: `git log <floor-tree>..HEAD --
packages/noodl-editor/tests/`. Empty ⇒ the total must be **exactly** 2843. This repo's total moved
2779 → 2788 → 2812 → 2843 in one day, so "it probably drifted" is always available and makes the
floor absorb any result.

⚠️ **`tsc -p tsconfig.tests-main.json`'s 31 errors are NOT a gate and NOT a regression** — see
FIX-004's task file. Do not re-derive this a third time.

---

## 3. What s39 found

### ✅ FIX-006 AC1 + AC2 are driven, and FIX-006 closes

**Instrument:** `packages/noodl-editor/scripts/aix002-measure` — the real `AuthoringSession`, the
real context builder, the real validation gate, the real 44-component `git-repo-utf8` project, an
Anthropic provider built from `.env`. The reported request went into the corpus as
`fix006-string-math` and **names no node type and no JavaScript**; naming either would have answered
the criteria in the question. **2 models × 2 arms × n=5 = 20 sessions**, all authored, all valid on
first submit. **$0.53.**

| model | arm | Script | `var` | regex | `Substring` node | inline `.slice` |
|---|---|---|---|---|---|---|
| `claude-sonnet-5` | **ON** | **0/5** | **0/5** | **0/5** | 1/5 | 4/5 |
| `claude-sonnet-5` | OFF | 0/5 | 0/5 | 0/5 | 5/5 | 0/5 |
| `claude-haiku-4-5` | **ON** | **0/5** | **0/5** | **0/5** | 2/5 | 3/5 |
| `claude-haiku-4-5` | OFF | 0/5 | 0/5 | 0/5 | 5/5 | 0/5 |

`claude-sonnet-5` is the shipped Anthropic default and carries `recommendedFor: ['act']`, so the ON
row is what a real user gets.

🔴 **The control arm passes identically, so the blocks are not what makes the criteria pass.** The
reported 2019-shaped output does not reproduce on either model with or without
`THREE_WAYS_TO_COMPUTE` and `CODE_STYLE`. **Grade it "criteria met, contribution unmeasured"** — a
treatment arm alone would have read as proof and been worth nothing, because a current model writes
`const` and `slice` unprompted.

✅ **The null is readable because the arms demonstrably differ**, three ways: 14,505 vs 13,003 prompt
chars recorded per session on the wire (the ON figure is byte-identical to s38's live-renderer
reading, so the treatment arm really is the editor's prompt); a strip that **throws** rather than
degrades; and a consistent behavioural split — **guidance OFF found the dedicated `Substring` node
10/10, ON did so 3/10** and inlined `.slice(1)` instead.

⚠️ **That direction is a ruling, in §5.** The blocks' one measured effect is to move work *out* of a
purpose-built node and *into* code, and `THREE_WAYS_TO_COMPUTE` opens with "reaching past them costs
the user a node that cannot run".

⚠️ **The instrument is structurally blind to the report's other half.** `AuthoringSession` is handed
its `componentPath`, so *"should this have been a component at all"* — the over-decomposition, §4 of
the mechanism, `decomposition.ts` — cannot be graded here. AC1 and AC2 are worded to ask about node
choice and code style, and that is what closed. **The planner half is unmeasured and wants its own
run against `PlanningSession`; see §4 item 2.**

### 🔴 The harness was dead for eight days and nothing anywhere would have said so

First run died: `Cannot read properties of undefined (reading 'getActiveProvider')`. The harness last
changed **2026-07-26**; `AuthoringSession` began calling `AiClient.roleRequestFields` on
**2026-08-08** (`5af9fde6`, LAS-009 roles), putting `AiConfigStore` on the authoring path for the
first time. **It is in no `tsconfig`, no jest project, no jasmine suite** — esbuild strips types
without checking them, so a green `build.mjs` proves only that it parsed.

⚠️ **Any harness-derived figure in a task file was produced by a version of the instrument that may
no longer start. Run it before quoting it.**

Its store stub was wrong twice, and the second is the one that matters:

1. esbuild's `__toESM` builds a namespace from **own keys**, and a `Proxy` with only a `get` trap has
   none — every named import from the stub was `undefined`.
2. 🔴 **Had that worked it would have been worse.** A callable noop is **truthy**, so
   `getActiveProvider()` would have sent `resolveRole` down its override branch and spread a noop
   `provider` *and* `model` onto every request. The honest stub says **AI is off** (`null`).

⚠️ **`--model` is now effectively required** — *"omit for the registry default"* only ever worked
through `AiConfigStore.getModel()`. Omitting it fails fast rather than silently measuring elsewhere.

✅ **Two instrument checks worth repeating.** `AuthoringSession` sets no temperature and
`claudeFrontier` declares `sampling: false`, so none is sent and the API default applies — the five
runs per cell are **independent samples, not one result printed five times**. And the grader was
pointed at the reported defect reconstructed (`Javascript2` + `var` + a regex) and **fails it**,
while the real runs pass; it also scores a run that wrote no code `n/a`, never `pass`.

---

## 4. What to do next and why

1. 🟢 **FIX-004 AC2's cloud half — now the top agent-actionable item.** ⚠️ `console.log` in the cloud
   sandbox is **not stdout**: `sandbox.isolate.js` routes it to `_noodl_api_call('log', …)`. Expect
   a Noodl log entry, not a terminal line.
2. 🟢 **The FIX-006 half nobody has measured: does the planner over-decompose?** The report's first
   complaint was a component that should not have existed, and §3 explains why the authoring harness
   cannot see it. `PlanningSession` + `decomposition.ts:64-66` (the "logic cluster → component" rule)
   and its counter-rule at `:117-121`. The harness now works and the corpus prompt exists, so this
   is cheap. **File it as a new task rather than reopening FIX-006, which closed on its own ACs.**
3. 🟢 **FIX-005's dead selectors** — delete the four dead rules, or retarget them to
   `.blocklyToolboxSelected`. ⚠️ **Retargeting is a visible redesign of the toolbox.** Needs §5.
4. 🔴 **FIX-016 §1, FIX-017's remaining half, FIX-008 C, FIX-013** — all need Richard (§5).

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

### How to start here

If you are driving anything Blockly, **read `driving-the-app-pointers.md` first** — s38 added the
whole Logic Builder recipe, including the one that cost the most time: **the property panel is not
where Blockly lives.** Selecting a `Logic Builder` node renders two buttons and *zero* injection
divs; the workspace opens in a canvas tab via a `LogicBuilder.OpenTab` event.

If you are grading a **prompt** change, the harness is the instrument and it is now working:

```sh
node packages/noodl-editor/scripts/aix002-measure/build.mjs
node packages/noodl-editor/scripts/aix002-measure/dist/aix002-harness.cjs \
  --provider=anthropic --model=claude-sonnet-5 --only=<slug> --code-guidance=on|off
```

🔴 **Always run both arms.** One arm cannot distinguish "the prompt worked" from "the model would
have done it anyway", and on this evidence the second is the likelier explanation.

---

## 5. Owed by Richard

- 🟢 **FIX-006 — the `Substring` question, NEW from s39.** With the compute/code-style blocks in the
  prompt the model does the string surgery **inline in code** (7/10); with them removed it reaches
  for the dedicated **`Substring` node** (10/10). Which is the better thing to hand a beginner? If
  the node is, the blocks are nudging the wrong way and `CODE_STYLE`'s "prefer a string method"
  clause wants a "…but prefer a node over code where one exists" companion. **Cheap either way.**
- 🟢 **FIX-004 §C — the seam-category question.** Should `App Objects` also list the four
  object-shaped blocks (`get`/`set property` by expression, `the property names of`,
  `has property`)? And should `tests-unit/vfn-012/browser-blocks.spec.ts`'s byte-identity assertion
  be narrowed to the claim its own title makes — *no existing block type id changes*?
- 🟢 **FIX-006 AC4 — `Javascript2`.** Either add the id to the Script line, or narrow
  `traps.ts:61-63`'s stated rule to the three recommendations. **One edit either way.**
- 🟢 **FIX-005 — the dead-selector decision.** §4 item 3. Delete or retarget.
- 🔴 **FIX-005 part 2 — the rename.** **A.** Keep `Runtime Variables` + a tooltip — cheapest.
  **B.** `Global Variables` + `App Config` → `App Settings`. **C.** Revert to `App Variables` and
  rename `App Config` — biggest sweep. ⚠️ **It reverses VFN-012 deliberately**, and the stated
  reason ("the global ones") is the *opposite* of why it was renamed.
- 🟢 **FIX-016 ruling 1.** **(a) Copy/default**: the row says only `Type` and reads `String`
  whether or not anything is stored. **(b) Parser asymmetry, RE-PRICED DOWN**: `Outputs.Done_1()` /
  `Outputs.Done.send()` get a value port and no Type row, but **throw at runtime by name and line**
  — a copy question, not a diagnostics gap. ⚠️ **Do not conflate with plain `Outputs.Done()`.**
- 🔴 **FIX-016 §3 — signal-input semantics.** Does an incoming signal re-run the body, or dispatch
  to a named handler? Or rule signal inputs out. **The only genuinely blocked part of FIX-016.**
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible. ⚠️ Ctrl-Space is **OS-bound on
  your machine** (`com.apple.symbolichotkeys` key 60).
- 🔴 **FIX-017 AC3** — premise false (ports and API names never share a prefix). Restate or strike.
- 🔴 **FIX-008 fix C** — a measurement from you. The oldest open item on this list.
- 🔴 **FIX-013 — four rulings; answer ruling 1 FIRST.** Ruling 2's real payoff is **three files**:
  `sandboxData.ts` keeps `sandboxExport.ts:25`, and the 1,121-line runtime shim keeps
  `noodl-viewer-react/src/sandbox/index.ts:61`. ✅ The big subtraction is **ruling 1(c)'s**.
- 🔴 **FIX-015** — the eight rulings. Brainstorm, then its own phase.
- 🔴 **FIX-021 slices A/B** — the six memory rulings. Slice 0 is done.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  It is **phase 65's work**, which is why no P66 session has committed it. ⚠️ **Unlanded work on a
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s39.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Fix it, delete
  it, or rule that a closed phase's corpus tooling may rot.** Seven sessions have now declined.
- 🟢 **MCP servers reached ~39 halves on this checkout and nothing reaps them.** `dev:stop` spares
  them **by design** — right for a live peer, wrong for a dead session, so the population only grows.
  ⚠️ **Killing processes one can only *infer* are orphaned is your call, not a passing session's.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls, and a `cd`-prefixed `node -e` in s39 silently lost a shell variable.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. ✅ **s39 committed four files by pathspec** (`c6723f06`);
the dirty tree at teardown was all peers'.

⚠️ **This checkout is busy** — **19 peer sessions** during s39. ✅ **A peer will hold source saves if
you ask**: a webpack recompile HMR-reloads the renderer and **wipes every injected CDP global**
mid-drive. s39 needed no editor and no announcement — **the authoring harness is plain Node, safe
beside a live stack**, like `test:main`.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.

🔴 **AT s39 CLOSE IT IS 17,753 UTF-16 (17,660 code points) — 243 OVER, and s39 did not put it
there.** It was already over on arrival; peers grew it. s39 added **no index line**, filing both its
findings *into* memories that already have pointers. **Whoever next has slack should trim it**, and
should do so knowing peers edit this file concurrently — read it immediately before writing.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

If those two numbers come out *equal*, your instrument is wrong, not the file.

### Peer etiquette

🔴 **`SendMessage` needs the `[ref]` for EVERY name**, not just duplicated ones — 8 of 10 bare-name
sends failed in one s38 batch. Copy `name [ref]` from a fresh `ListAgents`.

🔴 **Do not let a name-addressed broadcast inherit a socket-sourced fact.** **Reply to a socket on
its socket.** ⚠️ **Announce teardown to the FULL launch list, re-taking `ListAgents` first.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.**
✅ The reaping bug itself is **fixed and measured** (`2b758a87` + `4fd2cfdb`) — but **keep
announcing**, because a reaper started before those commits still holds the old inert module.

⚠️ **A survivor count is NOT proof the shield was exercised**, and a positive control on `electron`
lines is weaker than it looks — those lines are mostly MCP servers matching the *binary path*. The
strong version is a **decoy carrying the target argv**. ⚠️ **Compare pids, never counts.**
