# Phase 66 — next session

**Written 2026-08-16, session 36.** A rewrite, per §0. s35 drove two tasks and found a shipped fix
whose CSS selector matched nothing. **s36 built the last unbuilt piece of FIX-006 and drove it** —
and the corpus said the task file's own predicate would have flagged 13 working library prefabs.

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
| **FIX-005** part 1 | ✅ s34 | ✅ s35 | Criteria 1–3 close, both themes. 🔴 Toolbox half is **dead code**. Part 2 = ruling |
| **FIX-004** §A+§B | ✅ s34 | ✅ s35 | AC 1, 3, 4, 5 close; AC2 half. Cloud half + slice C + async remain |
| **FIX-006** 1+2 | ✅ s34 | 🔴 — | Prompt changes; **only AC1/AC2 can grade them** — a live authoring run |
| **FIX-006** fix 3 | ✅ **s36** `d6a635f5` | ✅ **s36** | **AC3 DRIVEN** over real MCP stdio. **AC4's MCP half DRIVEN**; editor half still source-only |
| **FIX-021** slice 0 | ✅ s34 | 🔴 — | 7 specs. Slices A/B need Richard |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | **Answer ruling 1 first** — see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Twelve closed outright. Three partial** (008, 016, 017). **Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total.**

---

## 2. Gate readings

✅ **s36 took the four marked ⬅.** `test:ci` was **not** run — see the note under the table.

| Gate | Reading | When |
|---|---|---|
| **`test:main` (jest)** | ✅ **210 suites / 3266 tests, 0 failed**, exit 0 ⬅ | **s36** |
| **`tsc --noEmit` — `noodl-editor`** | ✅ **0 errors** ⬅ | **s36** |
| **`tsc -p tsconfig.tests.json`** (jasmine spec tree) | ✅ **0 errors** ⬅ | **s36** |
| **`noodl-mcp` jest** | ✅ **45 suites / 530 tests** ⬅ | **s36** |
| **`test:ci` (jasmine)** | ⚠️ 2843 / 6 @ seed 39393 — **inherited, s34 @ `5b91e9c8`** | s34 |
| `noodl-mcp` `tsc` | ⚠️ 8 errors, all pre-existing | s34 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

✅ **`test:main` reconciles exactly:** 209 / 3248 (peer, 08-16) **+ 1 suite / + 18 tests** = this
session's new spec file, and nothing else moved.

🔴 **`test:ci` was not run, and that is a real gap — state it, don't paper over it.** What it could
still catch here is an import breakage in the jasmine `tests/` tree, which `tsconfig.json` does
**not** cover (it includes `src/` only). That specific risk was closed instead by running
**`tsc -p tsconfig.tests.json`**, which does cover it, clean. What remains uncovered is jasmine
*runtime* behaviour. The change is purely additive and the shared gate is covered by jest, so the
residual risk is low — but it is **not zero, and nobody has measured it**.

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

---

## 3. What s36 found

### The task file's proposed predicate would have flagged 13 working library prefabs

FIX-006 §3 asked for *"a `Javascript2` node whose `code` contains no `define(`/`script(` call"*.
Implemented literally and censused over the repo's **88** Script nodes, that fires on **13 — every
one a working library prefab or module**. A gate that rejects the correct answer.

**Why:** the runtime has **three** generations of declaration API, not one. The parser injects four
parameters (`javascriptnodeparser.js:22`) and aliases a fifth (`getCodePrefix`: `const Script =
Node`). The third — `Node.*` / `Script.*` with `Inputs`, `Outputs`, `Signals`, `Setters`, `OnInit`,
`OnDestroy`, `OnInputsChanged` — is **the one the shipped library actually uses**. Counting all
three: **0 of 88**.

⚠️ **The narrowing was 13 → 1 → 0**, and each step needed the corpus. The last survivor
(`library/prefabs/media-query`) declares *only* `Node.OnInit` + `Node.OnDestroy`, no ports at all.

🔴 **0-of-88 is also exactly what a predicate matching everything scores**, so the quiet result was
only worth anything once the other arm ran: four known-bad shapes fire, seven known-good stay
silent. Mutating the predicate to always-true and to always-false each kills **5 of 18** specs;
deleting the one wiring line kills **exactly 1**.

### `authoringTraps` is gated on `--allow-writes`, and a read-only probe reads as a defect

`get_project_info` omits the traps block in read-only mode **by design** (`read.ts:116`). s36's
first wire check ran read-only, got a clean MISS on every probe, and that measured **the flag, not
the fix**. The read-write arm carries it: **16,213 chars vs 667**. ✅ That pair is the actual
evidence for AC4's MCP half — one variable, two arms, opposite results.

### The block's leading type names are real, and were checked rather than assumed

`Expression`, `Logic Builder`, `JavaScriptFunction`, `Javascript2` are all genuine `typeName`s in
`list_node_types` (displayNames "Expression", "Visual Function", "Function", "Script"). The comment
in `traps.ts` claiming the leading token is *"the id the agent must actually write"* holds.

### ⚠️ The MCP `dist/` bundle was rebuilt

`packages/noodl-mcp/dist/noodl-mcp.cjs` is gitignored and had **0** occurrences of the new rule
until s36 rebuilt it (13:19). That rebuild is what made the AC3 drive possible.
🔴 **The ~18 MCP servers already running still hold pre-rebuild code** — they will not see the new
rule until they restart. This is the same deployment debt the phase already tracks.

---

## 4. What to do next and why

0. 🔴 **FIX-006 AC1 + AC2 are now the whole remaining task, and they need a live authoring run.**
   Fixes 1+2 are prompt changes; no spec can grade them. Re-run the authoring measurements against
   the reported request ("take a string, cut first char, convert to number, multiply by 0.9") and
   check the model reaches for a Function/Expression, and writes `const`/`slice` not `var`/regex.
   **Agent-actionable if a live build loop is available.**
1. **FIX-006 AC4's editor half** — the in-editor `systemPrompt()` on the wire, not in source. Cheap
   once an editor is up; ⚠️ do it **alongside another drive**, not for its own sake.
2. 🟢 **FIX-005's dead selectors** — delete the four dead rules, or retarget them to
   `.blocklyToolboxSelected`. ⚠️ **Retargeting is a visible redesign of the toolbox.** Needs §5.
3. **FIX-004 slice C** (objects as data) — agent-actionable. ⚠️ **Async is deliberately separate**:
   the Visual Function compiles with a **sync** `new Function`. Its own task.
4. **FIX-004 AC2's cloud half.** ⚠️ `console.log` in the cloud sandbox is **not stdout**:
   `sandbox.isolate.js` routes it to `_noodl_api_call('log', …)`. Expect a Noodl log entry.
5. 🔴 **FIX-016 §1, FIX-017's remaining half, FIX-008 C, FIX-013** — all need Richard (§5).

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

### How to start here

s35's lesson was *ask what the gate would say if the fix were not applied at all*. **s36's is the
same question pointed one step earlier: ask what the RULE would say about code that is already
correct.** A predicate arrives in a task file looking like a specification; it is a hypothesis with
a population. The census took four minutes and moved the answer from 13 false positives to 0.

✅ **And measure the memory index with `node`, never `python`** — s36 reproduced s35's exact
documented mistake: in Python both `len(s)` and `len([c for c in s])` are code points, so the check
printed two identical numbers and declared 14 chars free while the file was **78 UTF-16 over**.

---

## 5. Owed by Richard

- 🟢 **FIX-005 — the dead-selector decision.** §4 item 2. Delete or retarget. **Cheap either way**;
  nothing is currently broken on screen, so this is about the record and about whether the toolbox
  should follow the token palette at all.
- 🔴 **FIX-005 part 2 — the rename.** **A.** Keep `Runtime Variables` + a tooltip — cheapest.
  **B.** `Global Variables` + `App Config` → `App Settings`. **C.** Revert to `App Variables` and
  rename `App Config` — biggest sweep. ⚠️ **It reverses VFN-012 deliberately**, and the stated
  reason ("the global ones") is the *opposite* of why it was renamed. Copy only, plus two specs.
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
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s36.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Fix it, delete
  it, or rule that a closed phase's corpus tooling may rot.** Four sessions have now declined.
- 🟢 **~18 MCP servers are alive on this checkout and nothing reaps them.** They accrue about a pair
  per session; `dev:stop` spares them **by design**. ⚠️ **Killing processes one can only *infer* are
  orphaned is your call, not a passing session's.**
- ⚠️ **MCP servers hold pre-rebuild code.** s36 rebuilt `noodl-mcp/dist` (gitignored), so **running
  servers are now behind it** until they restart. The **packaged-app** repackage is still owed.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls and bit s36 twice (a `tsc -p tsconfig.json` ran against the wrong project once).

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. s36 did exactly that and left the three peer-owned dirty
files (`leg-001-lane-notes.md`, `phase-68-learnbook/README.md`, `check.ts`) untouched.

⚠️ **This checkout is busy** — **17 peer sessions** during s36, and `MEMORY.md` was **185 UTF-16
over budget** on arrival (s35 left it with 47 free). **Re-read before editing shared files, and
size-check at the END.**
⚠️ `dev-docs/tasks/phase-65-the-library/` is untracked and belongs to another phase — **do not
commit or modify it. But DO read it.**

### 🔴 Measuring the memory index

**`node`, never `python`.** In Python `len(s)` *and* `len([c for c in s])` are both code points, so
a Python check prints two identical numbers and cannot see the UTF-16 overflow that actually binds.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

✅ **s36 left it at 17,472 UTF-16 / 17,380 code points — 38 free.** If those two numbers come out
*equal*, your instrument is wrong, not the file.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.**

⚠️ **A survivor count is NOT proof the shield was exercised.** The discriminating version needs a
**decoy** matching `DEV_TOOL` + repo root but unprotected, which must **die** in the same run.

### Etiquette

**Announce before *and* after any `test:ci` or editor launch**, and **re-take `ListAgents` at both
ends**. ⚠️ **Two peers can share a name** — send with the `[ref]` when a listing shows one.
✅ **`test:main`, the `tsc` gates and `noodl-mcp` jest are plain Node and safe beside a live stack** —
s36 ran all four with 17 peers active and announced nothing.
🔴 **Peer messages stay SHORT and RARE** (Richard, 08-16: *"curb its enthusiasm"*).

### Driving over MCP without an editor

✅ **s36 drove AC3 with no editor at all**, which avoids every editor-launch hazard:
`node packages/noodl-mcp/dist/noodl-mcp.cjs <proj> --allow-writes`, JSON-RPC on stdin.
⚠️ **`fix012-drive` is a V1 project and the server refuses it** — use `cn001-kit-drive`.
⚠️ Copy the project to the scratchpad first and rename it in **`nodegx.project.json`** (a V2 project
has no root `project.json`). Nothing then touches a real project or the recent-projects list.
⚠️ **Read the tool schema before calling** — `create_component` takes **`path`**, not `component`;
a wrong argument name comes back as a validation error that is easy to misread as the rule not firing.
