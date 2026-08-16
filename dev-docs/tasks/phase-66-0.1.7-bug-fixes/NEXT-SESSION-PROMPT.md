# Phase 66 — next session

**Written 2026-08-16, session 38.** A rewrite, per §0. s37 built FIX-004 §C and found that `in`
answers backwards about every App Object. **s38 drove §C in the real app** — all seven blocks draw,
the four-block chain runs, and the `in` inversion reproduces in the live viewer runtime. It also
closed **FIX-006 AC4's editor half** and corrected an overclaim in that task's own record.

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
| **FIX-004** §A+§B | ✅ s34 | ✅ s35 | AC 1, 3, 4, 5 close; AC2 half. Cloud half remains |
| **FIX-004** §C | ✅ s37 `b9d6966e` | ✅ **s38** | **DRIVEN.** Data category at index 13; all **7** blocks draw in the *flyout*; `JSON.parse → Object.keys → For each → obj[k]` runs and returns **3**; `in` inversion reproduced in the live viewer. Async still deliberately separate |
| **FIX-006** 1+2 | ✅ s34 | 🔴 — | Prompt changes; **only AC1/AC2 can grade them** — a live authoring run |
| **FIX-006** fix 3 | ✅ s36 `d6a635f5` | ✅ s36 | AC3 driven over real MCP stdio |
| **FIX-006** AC4 | ✅ | ✅ **s38** | **BOTH HALVES DRIVEN.** MCP half s36; **editor half s38** — `systemPrompt()` called live in the renderer, both modes carry the block |
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

🔴 **s38 took NO gates, and owes none: it changed no source.** Its only edits are three task/handover
files and three memory files. Everything below is inherited — **re-measure before quoting.**

| Gate | Reading | When |
|---|---|---|
| **`test:main` (jest)** | ✅ 212 suites / 3313 tests, 0 failed | s37 |
| **`tsc --noEmit -p tsconfig.json`** | ✅ 0 errors | s37 |
| **`tsc -p tsconfig.tests.json`** | ✅ 0 errors | s37 |
| **`noodl-mcp` jest** | ✅ 45 suites / 530 tests | s36 |
| **`test:ci` (jasmine)** | ⚠️ 2843 / 6 @ seed 39393 — **inherited, s34 @ `5b91e9c8`** | s34 |
| `noodl-mcp` `tsc` | ⚠️ 8 errors, all pre-existing | s34 |
| `noodl-core-ui` jest | ✅ 25 suites / 444 | s24 |
| `library:check` (PR gate) | ✅ 58/58, exit 0 | s30 |

🔴 **`test:ci` has now not been run for four sessions.** A peer re-confirmed the floor as
**2843 / 6 at seed 39393**, reproduced twice, and says nothing since has touched
`packages/noodl-editor/tests/` — so **a different total is a finding, not drift.**
🔴 **Quote the six failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

⚠️ **`tsc -p tsconfig.tests-main.json`'s 31 errors are NOT a gate and NOT a regression** — see
FIX-004's task file. Do not re-derive this a third time.

---

## 3. What s38 found

### ✅ FIX-004 §C is driven, with controls that could have failed

Full table in the task file. The four things that matter:

1. **`Data` is toolbox index 13**, immediately after `Lists` — read from live `getToolboxItems()`.
2. **All seven blocks draw in the FLYOUT WORKSPACE.** 🔴 This is the reading the toolbox XML cannot
   give: a block whose *definition* failed to register is still named in the XML and simply does not
   draw. Controls: `Lists` returns **12** through the same reader (so 7 is not a constant), and a
   bogus block type is absent from `Blockly.Blocks` while all seven real ones are present.
3. **The chain runs.** Generated `obj[k]` — a **computed** key, the whole point of the slice — and
   returned **`3`**, a number. 🔴 **Shown to be falsifiable**: flipping the members dropdown to
   `VALUES` emits `Object.values` and returns **`NaN`**; restoring `KEYS` returns `3`.
4. **`in` reproduces in the live viewer runtime**, not just headlessly — `'title' in o` is `false`,
   `'data' in o` is `true`, and `JSON.stringify` adds the `id`. s37's generator choice is right.

✅ **The on-screen question is answered: `Data` beside `App Objects` reads fine.** They are ten rows
apart in different visual groups — `App Objects` in the `App *` seam block, `Data` with the generic
vocabulary. The collision the toolbox comment worried about does not materialise.

### 🔴 FIX-006 AC4's supporting note overclaimed, and the drive caught it

AC4 itself **passes on both wires**. But the task file said the four checked type names meant *"the
block really does name the ids an agent must write"*. Measured live: it names **three**
(`Expression`, `Logic Builder`, `JavaScriptFunction`). The fourth is prose — *"Reach for the Script
node LAST"* — and **`Javascript2` does not appear in the prompt at all**.

⚠️ **Probably not a defect** — an id matters less in a prohibition than in a recommendation. But
`traps.ts:61-63` states the rule as *"the type name leads every line … it is also the id the agent
must actually write"*, and item four does not follow it. **Ruling in §5; cheap either way.**

### The instrument lesson, continuing s37's

s37's was *ask what your instrument says when the answer is the one you expect*. s38's is narrower
and it came from a peer, not from me: **a positive control can prove your pipeline works and still
say nothing about the predicate you are claiming.** My teardown report quoted *"0 dev-stack
processes, control 24 `electron` lines"*, which two peers called the thing that made the zero
readable. A third pointed out those 24 lines are almost all **MCP servers matching on the binary
path** — so the control tested `ps` and the grep, **not** whether `Electron . --dev` would have
fired had a stack been up. ✅ **The strong version is a decoy carrying the target argv.**
Filed to memory.

---

## 4. What to do next and why

0. 🔴 **FIX-006 AC1 + AC2 are the whole remaining task there, and they need a live authoring run.**
   Fixes 1+2 are prompt changes; no spec can grade them. Re-run the authoring measurements against
   the reported request ("take a string, cut first char, convert to number, multiply by 0.9") and
   check the model reaches for a Function/Expression, and writes `const`/`slice` not `var`/regex.
   **Now the single most valuable agent-actionable item in the phase** — everything cheaper is done.
1. 🟢 **`test:ci`.** Four sessions unrun, and §C's change lives in `views/BlocklyEditor/`, which the
   jasmine tree does not import. Residual risk is jasmine *runtime* behaviour only — low, but nobody
   has measured it, and the floor is freshly re-confirmed so a delta would be attributable.
   ⚠️ **Announce before and after.**
2. 🟢 **FIX-005's dead selectors** — delete the four dead rules, or retarget them to
   `.blocklyToolboxSelected`. ⚠️ **Retargeting is a visible redesign of the toolbox.** Needs §5.
3. **FIX-004 AC2's cloud half.** ⚠️ `console.log` in the cloud sandbox is **not stdout**:
   `sandbox.isolate.js` routes it to `_noodl_api_call('log', …)`. Expect a Noodl log entry.
4. 🔴 **FIX-016 §1, FIX-017's remaining half, FIX-008 C, FIX-013** — all need Richard (§5).

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

### How to start here

If you are driving anything Blockly, **read `driving-the-app-pointers.md` first** — s38 added the
whole Logic Builder recipe to it, including the one that cost the most time: **the property panel is
not where Blockly lives.** Selecting a `Logic Builder` node renders two buttons and *zero*
injection divs; the workspace opens in a canvas tab via a `LogicBuilder.OpenTab` event. Reading the
panel and concluding "no workspace" is a false negative that looks exactly like a broken feature.

---

## 5. Owed by Richard

- 🟢 **FIX-004 §C — the seam-category question.** Should `App Objects` also list the four
  object-shaped blocks (`get`/`set property` by expression, `the property names of`,
  `has property`)? And should `tests-unit/vfn-012/browser-blocks.spec.ts`'s byte-identity assertion
  be narrowed to the claim its own title makes — *no existing block type id changes*? ✅ **s38's
  drive does not change this**: the blocks work, findability is the open question. **Cheap either
  way; both are one edit.**
- 🟢 **FIX-006 AC4 — `Javascript2`, NEW.** Either add the id to the Script line, or narrow
  `traps.ts:61-63`'s stated rule to the three recommendations. §3 above. **One edit either way.**
- 🟢 **FIX-005 — the dead-selector decision.** §4 item 2. Delete or retarget. **Cheap either way.**
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
  PR-gated script is exactly what a sibling's `git add -A` sweeps.** Still uncommitted at s38.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Fix it, delete
  it, or rule that a closed phase's corpus tooling may rot.** Six sessions have now declined.
- 🟢 **MCP servers reached ~39 halves on this checkout and nothing reaps them.** A peer watched it
  climb 19 → 25 → 33 → 39 across one day; `dev:stop` spares them **by design**, which is right for a
  live peer and wrong for a dead session, so the population only grows. ⚠️ **Killing processes one
  can only *infer* are orphaned is your call, not a passing session's.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the cwd persists
between calls and bit s38 twice in its first minute (`git show -- <path>` returned silently empty
because the real path is `packages/noodl-editor/src/editor/src/…`, with an extra `src/editor/`;
`--name-only` is how you get untruncated paths out of `--stat`).

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file:
`add` and commit in the **same** command. ✅ **s38 changed no source and committed nothing**; the
dozen dirty files at teardown were all peers'.

⚠️ **This checkout is busy** — **19 peer sessions** during s38. ✅ **A peer will hold source saves if
you ask**: a webpack recompile HMR-reloads the renderer and **wipes every injected CDP global**
mid-drive, which reads as the app losing state. One short message bought a clean window.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**. **At s38 close: 17,497 — 13 chars free.**
🔴 **Do not add an index line.** File findings *into* files that already have pointers, which costs
zero budget (s37 and s38 both did this).

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

If those two numbers come out *equal*, your instrument is wrong, not the file.

### Peer etiquette — two corrections from s38

🔴 **`SendMessage` now needs the `[ref]` for EVERY name**, not just duplicated ones — 8 of 10
bare-name sends failed in one batch. Copy `name [ref]` from a fresh `ListAgents`. (Oddly, the only
bare names that *worked* were the duplicated pair. Don't reason about it; always send the ref.)

🔴 **Do not let a name-addressed broadcast inherit a socket-sourced fact.** s38 told
`opennoodl-84 [20954e]` *"you offered to verify"* when the offer had arrived on
`uds:/tmp/cc-socks/74937.sock`. A third peer wrote back to say it wasn't them and that s38 might be
waiting on a promise nobody made. **Reply to a socket on its socket.**

⚠️ **Announce teardown to the FULL launch list, re-taking `ListAgents` first** — one name
(`preflight-95`) arrived mid-window and had never received the launch notice.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — `dev-watchdog.js:44` runs the
same sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.**
✅ The reaping bug itself is **fixed and measured** (`2b758a87` + `4fd2cfdb`) — but **keep
announcing**, because a reaper started before those commits still holds the old inert module.

⚠️ **A survivor count is NOT proof the shield was exercised, and a positive control on `electron`
lines is weaker than it looks** — those lines are mostly MCP servers matching the *binary path*, so
they prove `ps` and your grep run, **not** that `Electron . --dev` would have fired. The strong
version is a **decoy carrying the target argv**. ⚠️ **Compare pids, never counts** — MCP totals move
minute to minute (22, 24 and 39 were all read in the same minute by three sessions).
