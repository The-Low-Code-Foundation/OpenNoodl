# Phase 66 — next session

**Written 2026-08-16, session 34.** 🔴 **This file is a REWRITE, not another amendment.** §0 has
always said it is overwritten each session; s28–s34 each prepended instead, and it reached 845 lines
of stacked archaeology. Everything transferable in the old §3 is in the memory index — the pointers
are in §3 below — and everything phase-specific is in the task files. **Nothing was dropped that
isn't recorded somewhere a session will actually look.**

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
   Never let the two blur into "done".
2. **Gate readings with their date and tree**, so the next session compares against a reading it
   can trust rather than re-deriving one.
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

🔴 **s34 moved four tasks and every one landed on ◐ BUILT-NOT-DRIVEN.** Say that plainly: five
commits of product code, gated at the floor, **and not one of them seen working in the app.**

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 007 / 009 / 010 / 011 / 012 / 014 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — twelve tasks |
| **FIX-004** A+B | ✅ **s34** `43b2e521` | 🔴 — | 15 specs. Acceptance 1–4 all want the **bench**. Slice C + async untouched |
| **FIX-005** part 1 | ✅ **s34** `5b91e9c8` | 🔴 — | 22 specs, control-checked red. **Screenshot owed.** Part 2 = ruling |
| **FIX-006** 1+2 | ✅ **s34** `28310bc8` | 🔴 — | Prompt change; graded by re-running the authoring measurements. **Fix 3 not built** |
| **FIX-021** slice 0 | ✅ **s34** `00f5c629` | 🔴 — | 7 specs incl. a byte-equality vs the MCP twin. Slices A/B untouched |
| **FIX-008** A, B, E | ✅ | ✅ | **C, D open**; C needs a measurement from Richard |
| **FIX-016** §2, §3c | ✅ | ✅ | §1 fully investigated, awaits a ruling. **§3 (signal inputs) genuinely blocked** |
| **FIX-017** §B, §A | ◐ | ◐ | **AC1 does NOT close** (driven false, s26). AC3's premise is false |
| **FIX-013** | 📋 | — | Rulings re-sized s33 — **answer ruling 1 first**, see §5 |
| **FIX-015** | 📋 | — | Brainstorm → its own phase. Needs Richard |

**Twelve closed outright. Four newly partial (s34). Three older partial** (008, 016, 017).
**Two not started:** FIX-013, FIX-015.

⚠️ **Count the names, don't copy a total** — a bare number silently mixes whole tasks with
sub-items, which is what s29 had to unpick.

---

## 2. Gate readings

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 / 6 failed @ seed 39393** — EXACT floor match, **same six by name** | **s34**, HEAD `5b91e9c8` |
| **`test:main` (jest)** | ✅ **208 suites / 3233 tests**, 0 failed | **s34** |
| `tsc --noEmit` — `noodl-editor` | ✅ **0 errors** | **s34** |
| `noodl-mcp` jest | ✅ **44 suites / 519**, incl. the tool-disclosure budget | **s34** |
| `noodl-mcp` `tsc` | ⚠️ **8 errors, all pre-existing**, none in files s34 touched | **s34** |
| `noodl-core-ui` jest | ✅ **25 suites / 444** | s24 |
| `tsc --noEmit` — `noodl-core-ui` | ⚠️ **44**, all pre-existing | s24 |
| **`library:check`** (PR gate, `pr.yml:193`) | ✅ **58/58 clean, exit 0** — against the WORKING TREE | s30 |

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

✅ **The `test:ci` run was honest, and here is why you can believe it.** `test-results.json` was
**deleted before the run** and written fresh at 11:37. Per the standing trap, a stale file reads as a
perfect pass and a reaped run writes no file at all, so the mtime is the only field that settles it.
The compound exit code was ignored — it misleads in both directions.

🔴 **The `test:main` floor does NOT reconcile — re-take it and name the tree.** Inherited:
**205 / 3157 @ tree `d0891746`**. s34's own delta is **+2 suites / +37 tests** (15 + 22, verified by
running the two new specs alone), so the tree before s34 was **206 / 3196**. But **three peer suites
landed since `d0891746`** (`cn-001`, `cn-002`, `uni-010`) with **no deletions**, which predicts
*more* than 206, not fewer. ✅ **HEAD's 208 is trustworthy** — it is exactly the file count
`jest --listTests` reports. ⚠️ **The inherited figure is the suspect one**, most likely quoted
against a tree it was not measured at.

---

## 3. What is settled — do not re-derive

**The transferable findings are all in memory now; these are the pointers.** Read the memory file,
not a paraphrase here.

| Finding | Lives in |
|---|---|
| Stale statuses; a stale pointer that still RESOLVES survives; "leave them" read as "don't look"; an item's PRICE TAG vs its question | `a-heading-that-forbids-the-check-preserves-the-error` |
| Elimination over a candidate list nobody checked was exhaustive | `elimination-over-an-unchecked-candidate-list` |
| A `grep -v node_modules` filter deleted the hazard it was hunting | `ugrep-silently-skips-a-source-file-as-binary` |
| `pkill` skips `sweep()` ⇒ no shield; 13 procs = 13 MCP servers, 0 editors | `killing-the-launcher-pid-runs-the-same-sweep` |
| **s34: a task file's PREMISES are claims — 3 of 4 false, found only by building** | `build-the-caller-to-find-a-gates-hole` |

**Phase-specific, and still true:**

- 🔴 **s24's DOM null is fully unexplained.** All three candidates are dead (`scriptOutputs` *was*
  declared — the registry column has one producer). One un-eliminated cause remains: the query was
  aimed at the wrong panel. ⚠️ **Do NOT promote it to "the explanation"** — that move cost three
  sessions. It has **no live consequence**; this is curiosity debt.
- ✅ **`cdp.js`'s viewer hint is fixed** (`41c0c302`). **Do not re-file "cdp targets hides
  webviews"** — withdrawn s27.
- ✅ **TASKS.md was reconciled s29 and is current.** Every closed row names its closing session.
- ✅ **`check.ts` is settled as far as an agent can settle it** (s30). Attributed to LBR-002, gate
  passes. What remains is a commit, and it is Richard's — see §5.
- ✅ **`run-editor/SKILL.md` is fixed** (`300d7b47`). Do not re-investigate.

---

## 4. What to do next and why

0. 🔴 **THE BOTTLENECK IS DRIVING, NOT BUILDING.** s34 left four tasks built-and-gated with nothing
   driven. In value order:
   - **FIX-005 part 1** — a screenshot in **both themes**. The 22 specs prove the tokens are right
     and **cannot prove the rules win**; this ruleset is a pile of `!important` where source order
     decides, which is the exact defect that was fixed. This is the one most likely to be wrong.
   - **FIX-004 slice A** — the bench drive: `"42"` → convert → × 0.9 = **37.8 as a number**; the log
     block printing in a **preview and a cloud function**; a standalone log block getting a hat;
     live-value badges on the convert block.
   - **FIX-006** — re-run the authoring measurements. Both fixes are prompt changes and a spec
     cannot grade them.
   ⚠️ **All three want an editor.** Read the driving index in memory first, and announce.
1. 🔴 **FIX-016 §1 — do not build until Richard rules** (§5). Both questions are sized; (b) is much
   cheaper than the record long said.
2. 🔴 **FIX-017's remaining half needs Richard** — AC1 driven false, AC3's premise false. **Do not
   build §D speculatively.**
3. **FIX-008 fix C** — Richard owes a measurement. The oldest open item.
4. **FIX-013** — ✅ **rulings now correctly sized and ORDERED (s33): ruling 1 sets ruling 2's payoff,
   so answer 1 first.** Do not re-run the import-graph sweep; it is in the task file with its bounds.
5. **FIX-006 fix 3** — the validator rule for a `Javascript2` node with no `define(`/`script(`. Not
   built, and that shape still escapes every gate. **Agent-actionable, no ruling needed.**
6. **FIX-004 slice C** (objects as data) — agent-actionable. ⚠️ **Async is deliberately separate**
   and needs its own task: the Visual Function compiles with a **sync** `new Function`.
7. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015, or FIX-021's slices A/B — they need Richard, not an agent.

🔴 **Do NOT re-run `test:ci` to "check"** — it is current at `5b91e9c8` and matched the floor
exactly. 🔴 **Do NOT re-run the destructive `dev:stop` experiment** — it exists, `a905af94`.

### 🔴 How to start here, and it is the counterweight to six sessions of auditing

s29–s33 each sharpened *how to read an owed item*, and each found something real. **But six
consecutive sessions produced no product code, and the user's instruction on 2026-08-16 was
literally *"can we please move along with phase 66 … this is taking forever."***

s34 built four of the tasks that list called blocked, in one session, and **three of the task files'
own premises turned out to be false** — none catchable by reading more carefully:

1. **FIX-006 §1**: *"the traps block is already shared by both clients."* **Reachable** from both,
   **used** by one. `AUTHORING_TRAPS` had exactly two consumers, both in `noodl-mcp`; no prompt
   under `prompts/` imported it. Written to that sentence, the fix would have missed the in-editor
   AI entirely.
2. **FIX-004 ruling 1** was a **dependency, not a question** — its only objection was "sequence
   FIX-005 first", which dissolved when FIX-005 shipped the same session.
3. **FIX-005** called its own worst defect *"the identical problem"*: the selected toolbox category
   measures **1.19:1** against the reported row's 2.33.

✅ **The rule: a record can be audited indefinitely; a premise can only be tested from inside.**
When a list has been re-read three times without moving, **build the cheapest item on it.**
✅ **And "blocked on a ruling" is usually true of PART of a task** — take the recommendation the file
already wrote for the rest, say that you took it, and say what would change if it is wrong.
🔴 **The line s34 did not cross: nothing that reverses a prior ruling.** That is why FIX-005 part 2
and FIX-013 are still on §5 untouched.

---

## 5. Owed by Richard

- 🟢 **FIX-016 ruling 1 — two questions.**
  **(a) Copy/default**, small: the row says only `Type` and reads `String` whether or not anything is
  stored. Offer Type at add time in `AddNameField`; or a one-line hint under `scriptOutputs`; or
  nothing, since §2's diagnostic names the fix when the author gets it wrong.
  **(b) Parser asymmetry, RE-PRICED DOWN by measurement:** an author writing `Outputs.Done_1()` or
  `Outputs.Done.send()` gets a value port and **no Type row**, but **is told at runtime**, by name and
  line. So it is *"an accurate message that doesn't name the fix"*, **not** silent breakage — a copy
  question, not a diagnostics gap. ⚠️ **Do not conflate with plain `Outputs.Done()`, which works.**
- 🔴 **FIX-016 §3 — signal-input semantics.** Does an incoming signal re-run the body, or dispatch to
  a named handler? Or rule signal inputs out and document `run` as the only trigger. **The only
  genuinely blocked part of FIX-016.**
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible; the add affordance offers no type
  at creation. ⚠️ **One keystroke settles the copy half**: press Ctrl-Space in a Function popout —
  `com.apple.symbolichotkeys` key 60 is **enabled** on your machine, bound to "Select the previous
  input source".
- 🔴 **FIX-017 AC3** — premise false (ports and API names never share a prefix). Restate or strike.
- 🔴 **FIX-008 fix C** — a measurement from you. The oldest open item on this list.
- 🔴 **FIX-013 — four rulings, and s33 re-sized them. Answer ruling 1 FIRST.**
  Ruling 2's stated payoff was *"`sandboxData.ts`, `sandboxDataDraft`, the toolbar, the editor and
  the ~900-line runtime shim all become genuinely deletable"*. Measured:

  | module | production importers | ruling 2 deletes it? |
  |---|---|---|
  | toolbar, editor, `sandboxDataDraft` | the surfaces only; draft has **exactly one** | ✅ yes |
  | `sandboxData.ts` (**567**) | bench **+ `sandboxExport.ts:25`** | 🔴 **no** |
  | runtime shim (**1,121**, not ~900) | `noodl-viewer-react/src/sandbox/index.ts:61` | 🔴 **no** |

  `sandboxExport.ts:221-232` builds the dataset whenever `useSampleData` is true, and the task's own
  fix direction **hard-codes it true**. The shim lives in `noodl-runtime`, is installed by the
  **viewer**, is in all three built bundles, and its switch is a URL param defaulting **ON**.
  ✅ **So the big subtraction is ruling 1(c)'s to authorise; ruling 2's real payoff is three files.**
  🔴 **Nothing pre-empts your decision — only its price tag moved.**
- 🔴 **FIX-005 part 2 — the rename. Now the ONLY thing blocking that task**, part 1 being built.
  **A.** Keep `Runtime Variables`, add a tooltip *"the global `Noodl.Variables`"* — cheapest,
  reverses nothing. **B.** `Global Variables` + `App Config` → `App Settings`. **C.** Revert to
  `App Variables` + rename `App Config` and the settings section — literal, biggest sweep.
  ⚠️ **It reverses VFN-012 deliberately**: that rename existed so `Noodl.Config` could be `App
  Config` without two shelves reading alike, and your stated reason ("the global ones") is the
  *opposite* of the reason it was renamed. Blast radius is copy only — block type ids are frozen —
  plus two specs that pin the string.
- 🔴 **FIX-015** — the eight rulings. Brainstorm session, then its own phase.
- 🔴 **FIX-021 slices A/B** — the six memory rulings. Slice 0 is done.
- 🔴 **`scripts/library/check.ts` — LAND IT.** ✅ Attributed (LBR-002, named in two of its own
  comments), verified, and the gate passes **58/58, exit 0**. It is **phase 65's work**, which is why
  no P66 session has committed it. ⚠️ **Unlanded work on a PR-gated script is exactly what a
  sibling's `git add -A` sweeps.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches **13 processes right now: 13 MCP servers, 0 editors.** Lines 18–19 are
  inert (0 matches each). It is the **only** executable script in the repo carrying it. **Fix it,
  delete it, or rule that a closed phase's corpus tooling may rot.** ⚠️ Two sessions declined to edit
  a closed phase's directory; it is a one-line change with a measurement behind it.
- ⚠️ **MCP servers hold pre-rebuild code** — the **repackage** is separately owed.
- 🟢 **A lockfile written by `start.ts` at *intent*** — the ~75s window in which no process check can
  be correct is a hole no filter can close.
- ✅ **s34 TOOK four rulings rather than re-carrying them. Say if any is wrong.** FIX-004: one
  multi-mode dropdown; plain `log`; English labels. FIX-006: Script stays authorable, the traps block
  says *reach for it last*. **None reverses a prior ruling.**

### ✅ Struck this session

- ~~The memory-index budget~~ — **someone collapsed it.** s34 opened it **UNDER on both measures**
  for the first time (17,399 / 17,486 against a 17,510 ceiling), having been 111 / 201 over at s32.
  No P66 session did this, so a peer acted — the cross-phase fix s32 said it would take.
  ⚠️ **But headroom was 111 code points and only 24 UTF-16 units**, and **UTF-16 binds** because
  emoji cost two each. s34 added one pointer clause, went over, and cut it back three times to land
  at **17,418 / 17,505 — 92 / 5 free.** 🔴 **Five units is not headroom**; the next pointer added
  goes over. ✅ **Measure BOTH counts before and after every edit** — the code-point figure said
  there was room when there was not:
  `node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md`

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; use **absolute paths in every Bash call** (⚠️ the cwd
persists between calls and bit s34 twice).

🔴 **`git commit <pathspecs>` — never `git add` at all.** A sibling's commit sweeps whatever is in
your index, and an `add && …` chain that dies on a bad flag leaves it open. The only exception is a
**new** file, which cannot be reached by pathspec: `add` it and commit in the **same command**.

⚠️ **This checkout is busy.** ~14 peer sessions were live throughout s34; phase 67 landed four
`lesson*.ts` files *during* the session. **Pathspec every commit.**
⚠️ `dev-docs/tasks/phase-65-the-library/` and the phase-67 `UNI-011` file are untracked and belong to
neither phase — **do not commit or modify them. But DO read them**: s30 found the answer to a
fourteen-session-old owed item inside the directory sessions were told to leave alone.

### 🔴 Teardown: the by-pid route is NOT the gentle one

```
scripts/start.ts:74     spawns dev-watchdog.js with the launcher pids
dev-watchdog.js:44      any watched pid dying → sweep({ protectAncestors: false, … })
```

`dev:stop` leaves `protectAncestors` at **true**; the watchdog explicitly disables it. **Both are
safe only because `2b758a87`/`4fd2cfdb` shield MCP and suites.** 🔴 **A reaper started before those
commits holds the old module — keep announcing.**
🔴 **`pkill` never reaches `sweep()`**, so `NEVER_SWEEP` (`dev-processes.js:269`) does not run. It is
the one teardown route with no protection at all. **Use `dev:stop`.**

### 🔴 The pre-flight has a ~75-second blind window

`scripts/start.ts` appears **immediately**, bare `webpack` at ~8s, `Electron . --dev` at **~75s**.
Match on **`comm`** for what is already running *and* on argv for launches — the `comm` fix alone
trades a false positive for a **false negative**, which reads as "clear".

### ✅ Match the breadth of the check to the direction of the claim

| the claim | what you need |
|---|---|
| **"nothing is running"** (a null) | a **BROAD** match — 0 in the superset ⇒ 0 in the subset |
| **"something is running, and it's MINE"** | a **PATH-SCOPED** match — ~20 sibling worktrees match on argv shape |

🔴 **Put a positive control on the process check itself.** Four zeros from a typo'd pattern look
identical to a quiet checkout.
🔴 **Attribute by PPID, never by the `electron/dist` path** — ~25 Electron processes at idle are
**MCP servers**, one pair per live session.

### 🔴 grep in this repo needs `-a`, and must exclude by PATH

`/usr/bin/grep` without `-a` skips source files here as "binary" (emoji / NUL bytes) and reports a
**clean null**. 🔴 **Use `--exclude-dir=`, never `| grep -v node_modules`** — s32's survey deleted its
own finding that way, because the hazard it was hunting *was* a `node_modules` path.
⚠️ `pgrep -af` does **not** print args on macOS — use `ps -Ao pid,ppid,lstart,args`.

### 🔴 Two ways a gate lies, and one that bit s34

- **`test-results.json` is the readout, not the log.** Delete it before a run; **exit 0 + unchanged
  mtime = a broken build**, and a reaped run writes no file. **MTIME is the only honest field.**
- **`test:ci`'s exit code misleads BOTH ways** — `cmd; echo $?` reports the compound.
- 🔴 **s34: `hat-migration.spec.ts` walks the whole toolbox and instantiates every block — and
  catches `newBlock` and `continue`s.** Deliberate and correct for that suite, and it means **a
  toolbox naming a type this build does not register is a silently missing flyout row with every gate
  green.** Now asserted in `tests-unit/fix-004/blocks.spec.ts`.

### Etiquette

**Announce before *and* after any `test:ci` or editor launch.** 🔴 **The LAUNCH list is the TEARDOWN
list.** ⚠️ **Re-take `ListAgents` at both ends** — a roster goes stale inside an announce window.
✅ **`test:main` is plain Node and safe beside a live stack** — no announce needed.
🔴 **Peer messages stay SHORT and RARE** (Richard, 08-16: *"curb its enthusiasm"*). Blocking or
hazardous only; **findings go to the task file, not a broadcast.** Reply on the socket a message
arrived on; announce once to the names.

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key **`recentProjects`**)
**after** the editor is down, since it rewrites on exit. ⚠️ A copied project keeps the original's
**name** — rename it on disk or you cannot tell the cards apart.
⚠️ **When a drive's fixture backs a CONTESTED reading, say so in the task file before deleting it** —
that is why s24's fixture could not be re-measured.
