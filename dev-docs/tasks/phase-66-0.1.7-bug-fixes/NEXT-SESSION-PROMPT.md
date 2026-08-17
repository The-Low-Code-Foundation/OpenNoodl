# Phase 66 — next session

**Written 2026-08-17, session 51's brief, by session 50.** A rewrite, per §0. s50 took **item 1 —
FIX-016's script-mode mining slice — and closed it outright**: censused, built, gated, mutated,
driven, committed (`64ae6527`). One task, one commit.

✅ **FIX-016's last open build is CLOSED — sixteen tasks now.**

🔴 **s50's headline is that the scoping was wrong in both directions, and the census is what found
it.** The slice was filed as *"four surfaces: FUN-005's rail and FUN-006's bar."* **FUN-005's rail
does not exist** — `rail` occurs in four doc comments and no component. **FUN-004's diagnostics was
already fixed by s44.** And **FUN-008's completions — two call sites — were not mentioned at all**,
and are the half that mattered most: the editor was offering to *insert* `Inputs.price` into a Script
node while message 6 underlined that same line as throwing, in the same popout.

🔴 **The root cause was one predicate answering two questions**, and the tempting fix was one edit
instead of four. `modeHasDeclaredPorts` is `true` for `'script'` and **correctly so** — a Script
node's proplists are real. Dropping `'script'` from it would have deleted **message 6**, which is
gated on it. There is a spec row and a mutant for exactly that.

🔴 **The drive corrected itself, and only because it had a control.** The first completion probes
used a bare prefix at document position 0 — an `isDeclarationPosition`, where ports are correctly
refused in **both** modes. The Function control came back empty too, which is how it was caught. A
one-armed probe would have recorded *"no `Inputs.runOnce` offered — fixed"*: true, measured, and
evidence for nothing.

🔴 **Every ruling and every build is recorded in its own task file.** §4 here is a work order, not the
source of truth. FIX-016's full write-up — the census table, the before/after matrix, the three
mutants and the 2×6 drive — is at the foot of its own file.

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
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020 / 023** | ✅ | ✅ | **CLOSED** — fifteen tasks |
| **FIX-016** §2, §3, §3c, ruling 1, **+ the mining slice** | ✅ | ✅ **s50, 2 arms × 6 rows** | 🆕 **The last open build is CLOSED.** ⚠️ **AC1 is still false as built** — see §5 |
| **FIX-004** §A+§B, §C, **§C dual-list** | ✅ | ✅ all driven, dual-list s48 | **Redaction (b) is the one build left** — item 1 |
| **FIX-008** A, B, C, E | ✅ | ✅ C driven s48 (AC3) | **D unstarted** — item 6 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Fifteen closed outright, and FIX-016 has no open build left.** ⚠️ **Count the names, don't copy a
total.**

✅ **No task has a built-but-undriven half.** True at s49 and still true.

---

## 2. Gate readings

✅ **s50 took the four marked.** This session changed **`noodl-core-ui` source**
(`code-editor/*`), so those are its own.

| Gate | Reading | When |
|---|---|---|
| **`noodl-core-ui` jest** | ✅ **27 suites / 498 tests**, exit 0 | ✅ **s50** |
| **root `npm run typecheck`** (the PR gate) | ✅ exit 0, zero `error TS` | ✅ **s50** |
| **`typecheck:core-ui`** | ✅ **44 errors — s44's exact count**, all `TS2307` in `noodl-editor`, **zero in any `code-editor` file** | ✅ **s50** |
| **`lint:ci` ratchet** | ✅ exit 0, 876 against a 3916 baseline | ✅ **s50** |
| `noodl-editor` `test:main` | ✅ 228 suites / 3538 tests, 1 timing flake | s49 — inherited |
| `noodl-mcp` jest | ✅ 50 suites / 585 tests | s49 — inherited |
| `tests/validation/*` (7 suites) | ✅ 86 tests, ⚠️ under jest not jasmine | s49 — inherited |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited** |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s40 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ✅ **The root typecheck was taken without a pipe** and
its exit code read directly, per §4.

⚠️ **`noodl-core-ui` was 26 suites / 461 at s44 and is 27 / 498 now.** s50's suite accounts for **+1
suite and 21 tests**; the other **16 tests are peers'**. Don't attribute the whole delta.

### 🔴 `test:ci` NOT taken, and this time the reason is clean

The changed surface is entirely `noodl-core-ui`, whose specs **are** the jest suite above. There is no
jasmine spec over these files, so `test:ci` would not have graded the diff. ⚠️ **This is not s49's
situation** — there, `tests/validation/*` was the jasmine suite for the change and was substituted
with jest. Here there is nothing to substitute.

---

## 3. What s50 did — the FIX-016 mining slice (`64ae6527`)

**One new predicate, three gates, one corrected doc.**

- **`modeUsesPortNotation(validationType)`** — `['function']` — in `declaredPorts.ts`, deliberately
  beside `modeHasDeclaredPorts` so the difference is stated where both live. *"Is `Inputs.x` how ports
  are written here"* is a different question from *"does this node have declared ports"*, and for a
  Script node the answers differ.
- **`portBar.ts`** — silent in script mode. 🔴 **Not "mine nothing" — that is worse**: with an empty
  mined list a correct Script node falls to `unused-ports` and the bar nags the author who did the
  right thing. Every sentence the bar owns is `Inputs.`/`Outputs.` notation.
- **`noodl-completions.ts`** — both call sites. The member branch excluded `'expression'` only, so
  `'json'` reached the port completions too; that is fixed in passing and has a spec row.
- **`unionPorts.ts`** — the module doc **named `modeHasDeclaredPorts` as the gate**, and all three
  consumers followed it. Corrected in place, because the advice being followed is exactly why this
  happened.

### The spec, the three mutants, and one instrument failure

`tests/code-editor/scriptPortNotation.test.ts`, **21 tests**, every behavioural row a **pair** across
the two modes.

| mutant | result |
|---|---|
| the bar gate removed | **4 failed / 17 passed** |
| both completion gates reverted | **5 failed / 16 passed** |
| 🔴 `'script'` dropped from `modeHasDeclaredPorts` — the tempting one-edit "tidy" | **2 failed**, one being *"message 6 still fires"* |

⚠️ **The first mutant run reported `Tests: 0 total` beside `1 failed`** — a suite-level failure from
`npx jest --rootDir …` at the repo root breaking resolution. **A mutant that fails to compile grades
nothing.** Re-run from the package directory it gave 4/17. `0 total` is the tell.

### 🔴 Two existing specs asserted the OLD behaviour and were changed

`portBar.test.ts`'s two CN-019 rows used `'script'` as a stand-in for *"a mode with declared ports"*.
Both are repaired rather than deleted, with the reason inline. **If you touch the bar, read those two
rows first** — one of them moved its control from `'script'` to `'function'` on purpose.

### The drive — 2 arms × 6 rows, teardown clean

Copy of `fix016-msg6-drive` opened as `fix016-s50-drive`; `/Components/PriceDiscount` carries both
node types. ⚠️ **Identity by `_retainedProjectDirectory`, never by name — the copy reports as "FIX003
Drive" and three projects share that name.**

| probe | Script | Function |
|---|---|---|
| the bar | **0 `PortHintText`** across four documents | **1**, *"Read price with `Inputs.price` …"* |
| bare-name completion, expression position | **0, no tooltip** | **`Inputs.price`** + rendered tooltip |
| `def` in script mode | **`define`** + its info text | — |
| `Outputs.Done();` in script mode | **message 6**, `nodegx:ports` | — |

✅ **The `define` row is what makes the absences mean anything** — the cheapest way to pass every
other row is to break completion in script mode outright.

---

## 4. What to do next and why

**Ordered by value, not cost.** The item with a live user waiting is still the repackage, which is
Richard's, not a build.

1. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink. ⚠️ **Not free**: the
   sink is per-run `runContext`, which generated code has no handle on today. **The last FIX-004
   build.**
2. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
3. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API.
4. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
5. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.
6. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.

**Do not start** FIX-015 here — it is its own phase.

### 🆕 Two things s50 uncovered and deliberately did NOT build

- 🔴 **A bar that teaches `define()`.** The Script node now gets *silence* where it used to get false
  advice, which is honest but not the ruling's *"the node should teach"*. Building it needs the
  node's **real** port list, and the editor cannot compute it: the `define({ inputs, outputs })` half
  lives behind `parser.getPorts()`, which means **running the author's code**. Guessing between *"no
  ports yet"* and *"ports you have not used"* is how the bar was wrong in the first place. **Wants a
  task; needs a syntax-tree parse of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface.** Completion
  offers `define` and nothing about the ports the author declared inside it. Same blocker, same fix.

### Still carried from s49, uncosted

- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** FIX-023 removed the one crash that reached it. **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**

### How to start here

🔴 **Census before you build, whatever the task file says.** s49's census found a second normalisation
boundary; s50's found that **two of the four named surfaces did not need fixing and a third was never
named**. Two sessions running, the scoping's list has been wrong.

🔴 **A green spec proves nothing until you have seen it fail — and a mutant that does not compile
grades nothing.** ✅ One shell call: apply, **announce that it applied**, run, restore from a
scratchpad backup, `diff` back. 🔴 **Check the mutant reported a real test count**; `Tests: 0 total`
beside `1 failed` is the instrument, not the result.

🔴 **Run the control in the same session, not from memory.** s50's drive recorded a passing absence
that was caused by the cursor position rather than the fix, and only the Function arm returning the
same empty list exposed it.

🔴 **Check the exit code before reading the output, and never through a pipe.** macOS has **no
`timeout`**; a command that exits 127 looks exactly like a well-behaved run.

⚠️ **`npm run dev:debug` needs `run_in_background`, not `nohup`** — attribution here is by PPID.
✅ **s50's teardown: `dev:stop` stopped 26 processes and all 45 MCP servers survived.** The launcher
exiting **144** is `dev:stop` reaping it, not a failure.

---

## 5. Rulings — what a builder must not get wrong

- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids.** Measure node choice **and** chain shape. ⚠️ n=5 cells are not a
  floor; re-run at n=10. ⚠️ **Coupling:** this belongs in FIX-021's user profile — **do not build it
  in a way that forecloses slices A/B.**
- ✅ **FIX-016 — the mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` must stay `true` for
  `'script'`** — message 6 is gated on it, and "tidying" the two predicates into one deletes s44's
  whole build. 🔴 **The bar is silent in script mode, not empty-listed** — do not "restore" it by
  feeding it an empty mined list; that nags correct code. ⚠️ **AC1 as originally written — *"adding an
  output from the panel offers Signal at creation time"* — is still FALSE as built** (driven s26: the
  `+` opens a name field and nothing else). Ruling 1 (s42) explicitly **rejected the copy/default
  option (a)** and asked for the diagnostic instead, which is built and driven. **Someone should
  decide whether AC1 is retired or still owed; s50 did not.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` is 2nd in `ALL_RULES` on purpose;
  `duplicateNodeId` must keep leading.** 🔴 **The diagnostic names the node and component IN THE
  MESSAGE, not only in `location`.**
- ✅ **FIX-008 C — BUILT s47, MEASURED s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose.**
  🔴 **Do not re-open the scope question from the string.**
- ✅ **FIX-004 §C dual-list — BUILT s46, DRIVEN s48.** The seam fence is narrowed and mutant-checked;
  **do not widen it back.**
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. **The one FIX-004 build left.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly. **The argument lives on
  `ToolboxLabels.noodlVariables`; do not re-litigate it from `appConfig.ts`.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **THE REPACKAGE — still the item with a live user impact.** Richard's `nodegx-puppy-test-3`
  resolves to `/Applications/NodeGX.app/…`, the **Aug-13** bundle. It will keep dying with
  `Unexpected failure: …'startsWith'` until the app is repackaged. **The fix is committed and driven;
  he cannot see it.**
- ⚠️ **`packages/noodl-mcp/dist/` is still pre-fix** — gitignored, and what *checkout-registered*
  servers load. 🔴 **A session that rebuilds it should announce that it did.**
- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **FIX-016 AC1 — retired or still owed?** See §5.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** ⚠️ Unlanded work on a PR-gated script is exactly what a sibling's `git add -A`
  sweeps. **Still uncommitted at s50 — eighteen sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Eighteen
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c` (the only typeless-node reproduction),
  `fix016-msg6-drive` (the only fixture with both JS node types in one component — ✅ **s50 drove a
  `cp -R` copy and never wrote to it**), and `fix004c-s48-drive`. 🆕 **`fix016-s50-drive` is a scratch
  copy and can be deleted.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls**; s50 lost
a call to a `cd` into the package directory two commands earlier, exactly as s49 did.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s50 committed once, pathspec-only, 8 files** — a peer landed
`9e71e76f` mid-session and had uncommitted work in `ContextBuilder.ts`; all untouched. ✅ **Verify
after the commit that the peers' files are still there**, not just before.

⚠️ **This checkout is busy and peers save source constantly.** A save triggers a webpack rebuild that
HMR-reloads the renderer mid-drive. ✅ **Every CDP reader should return an explicit `{alive:…}`** — a
dead instrument and a genuine absence are the same string.

### 🔴 Peer etiquette

s50 launched an editor and announced nothing, because **no peer held 9222 and no test suite was
running** — both checked by walking `ps`, not by asking. 🔴 **All `electron/dist` matches on an idle
checkout are MCP servers** — s50 counted **22 before** and **45 after** (peers started more
mid-session) and **zero editors**; attribute by **PPID**, never quote a count as evidence of an
editor. 🔴 **Announce teardown to the FULL launch list.** 🔴 **Reply to a socket on its socket.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — the watchdog runs the same sweep
with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ⚠️ **Compare pids, never
counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **Take your own reading before adding a line; the headroom moves both ways and neither direction is
yours.** ✅ **The move whenever a new fact belongs to a section that already has a 📚 pointer: put it
in the POINTER FILE, which costs zero index budget.** ✅ **s50 added nothing to the index** — its one
drive trap went into an existing memory file that already had a pointer.

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46 through s50 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared six sessions running. ✅ **s50 also ran `git diff --stat HEAD` on the file twice,
including immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
