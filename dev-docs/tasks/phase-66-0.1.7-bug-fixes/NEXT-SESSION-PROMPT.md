# Phase 66 — next session

**Written 2026-08-16, session 45.** A rewrite, per §0. s45 took item 1 of s44's queue and closed it —
`654a72cf`. **One task, one commit, docs-only.**

🔴 **The queue has no cheap end left, and s45 spent the last of it.** Everything below is medium or
larger. Nothing waits on Richard except FIX-013's rulings 2–4 and FIX-021's Q2/Q5/Q6.

🔴 **s45's headline is again a method result, and it is the second half of s44's.** s44 learned that
*a premise asserting an ABSENCE is the one nobody has checked*. s45 learned the operational twin:
**an absence you go and check will pass for free unless the instrument is proven alive at the moment
you read it.** Both of the session's absence readings were wrong the first time — one because a
peer's HMR reload had killed the probe, one because the linter had not settled — and **both wrong
readings were passes.** Details in §3; the general form is now in memory.

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
| **FIX-016** §2, §3, §3c, **ruling 1** | ✅ | ✅ **s45, 2×2 + 2 controls** | **Message 6 has been seen in a gutter.** The mining slice is still open — item 6 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | Acceptance 1 closed s42; the location seed driven s44. **Slices A/B are the open work** |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** |
| **FIX-004** §A+§B | ✅ | ✅ | Redaction (b) and §C are RULED and unbuilt |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** |
| **FIX-005** part 1 + dead selectors | ✅ | ✅ | **The rename is unbuilt** |
| **FIX-008** A, B, E | ✅ | ✅ | C unblocked (**the measurement is an agent's, not Richard's**); D unstarted |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Thirteen closed outright; FIX-016 ruling 1 is now built AND driven.** ⚠️ **Count the names, don't
copy a total.**

---

## 2. Gate readings

🔴 **s45 took NONE of these.** Every row below is inherited, and the dates say from where. This is a
claim rather than an omission: **s45's only commit changes one markdown file** — no `src/`, no specs,
no fixtures, nothing any gate reads. The drive itself ran against the tree as it stood.

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 / 6 @ 39393**, six by name — **WITNESSED on HEAD** (post-`3d3cbb22`) | run **2026-08-16 21:53:37** — inherited |
| `noodl-core-ui` jest | ✅ 26 suites / 461 tests | s44 — inherited |
| `noodl-editor` `test:main` | ⚠️ 220 / 221 suites — load-flaky, see below | s44 — inherited |
| `typecheck:core-ui` | 44 errors, none in any file touched | s44 — inherited |
| `lint:ci` ratchet | ✅ exit 0, 876 against a 3916 baseline | s44 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s40 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** Counts move daily, and the tree moved under s45 twice
during a single drive.

### 🔴 `test:main` has two load-flaky suites, and they are not yours

`bld-004/reasoningChannel` and `aib-009/turnDeadline`, both reporting *"nothing arrived for 0
seconds"*, on different runs. Each passes **3/3 in isolation**; `npx jest --findRelatedTests` listed
**zero** editor suites for s44's changed files.

✅ **`--findRelatedTests` is the cheap instrument for "is that failure mine?"** — it answers from
jest's own module graph rather than from your reading of the imports.

### ✅ SETTLED — the `test:ci` floor, and both numbers were right about different trees

| tree | reading |
|---|---|
| pre-`3d3cbb22` (golden 23 lines, 0 tags) | **2843 / 7** — the 7th real, and `f7da52d1`'s |
| **HEAD**, post-`3d3cbb22` *"the golden was two lines short"* (25 lines, 2 tags), committed **21:52:24** | ✅ **2843 / 6**, run **21:53:37** |

🔴 **A `2843 / 6` run at 21:53 was briefly published as REFUTING the attribution. It was measuring the
fix** — the corrected golden was in the working tree from **21:32:56**, 21 minutes earlier.

⚠️ **The mechanism, because it defeated three separate "is the checkout clean?" checks:** the spec
reads its fixture with `fs.readFileSync` **from the WORKING TREE, never from a git object.** So
*"the floor on the committed tree"* names **git state**, which is not what the spec read. A clean
check covering processes and *your own* files still misses **a peer's uncommitted fix living in the
tree** — on this checkout that is the normal case.

✅ **So record two facts, not one: `git rev-parse HEAD` AND the mtimes of the fixtures the spec
reads.** Only the second is what ran. ✅ **The golden's mtime alone settles this in one command.**

✅ **The one unambiguous positive: the prediction was written down as a NUMBER AND A NAME** — *2843/7,
the `projectmodules` golden* — so it could be wrongly refuted and correctly reinstated inside an hour
by people who had each already been wrong twice. ⚠️ **A prediction that is only a direction ("I expect
it to fail") cannot be reinstated, because there is nothing to re-check.**

⚠️ **The miss worth more than the fix:** `git log -S"injectIntoHtml"` did **not** return `f7da52d1`,
and that null nearly cleared it. The commit changes the *inputs* the spec compares, never the symbol's
name. **A symbol-scoped search cannot answer a behavioural question** — same family as a seed-scoped
sweep and a dateless mtime: filter, then read the null as absence.

🔴 **That golden is the ONLY cross-package check that the editor's injector still agrees with
`nodegx-module-inject`** (`projectmodules.test.ts:14`). It was red on the branch from **16:39** until
`3d3cbb22` at **21:52:24** — ✅ **green now, and it did its job: the producer's own package tests
stayed green throughout while only the consumer's golden noticed.**

🔴 **Blockly work is `test:ci` territory** — that covers items 1 and 2 below.

---

## 3. What s45 did, and the two instrument failures worth more than the result

### ✅ FIX-016 ruling 1 — DRIVEN (`654a72cf`)

Fixture `fix016-msg6-drive` (a `cp -R` of `fix003-drive`, identity confirmed by
`_retainedProjectDirectory`, never by component names). `/Components/PriceDiscount` carries **both**
node types — `Javascript2 dc5ef4ce…` and `JavaScriptFunction js` — so both arms ran in one component
with no project switch between them. **The observation was written before the editor was launched.**

| document | Script (`Javascript2`) | Function (`JavaScriptFunction`) |
|---|---|---|
| `Outputs.Done();` | ✅ **message 6**, `warning`, `nodegx:ports`, **`actions: []`** | ✅ **nothing on `Outputs`** |
| `define({ inputs:…, outputs:…, run:… })` | ✅ **silent, 0 diagnostics** | ✅ *"No port named define … `Inputs.define`"* + fix-it |
| `zzzUndefinedThing;` | ✅ plain **`eslint:no-undef`**, no action | ✅ **message 3** + fix-it |

🔴 **The bottom-right cell is the defect s44 found, correctly relocated.** That sentence is exactly
what was being shown on the **Script** node before `3d3cc974`. It now appears only where a missing
`define` really is a missing port. **The same sentence being right in one cell and wrong in the other
is the entire content of the fix, and only the 2×2 shows it** — three cells plus an inference would
not have.

✅ **`openNode != null`, the load-bearing gate, is proven by CONSEQUENCE.** `getCodeAuthoringContext`
is not exported, so it could not be read; message 6 firing in a real popout *is* the proof the gate
passed and that `codenotation:'script'` reached the editor. The toolbar independently reads **SCRIPT**.
✅ **Rendered, not merely resolved** — gutter marker, *"⚠ 1 warning"*, and the full sentence in both
the hover tooltip and `.cm-panel-lint`, with **no action button** beside the Function node's message 3
which draws one.

### 🔴 Both absence readings were wrong first time, and both wrong readings PASSED

**1. A peer's save HMR-reloaded the renderer mid-drive and the absence check reported success.** Every
injected handle died; the popout closed; the editor fell back to the Launcher. The next check — a
shell `grep` for the message-6 text over a `cdp eval` — ran against an eval that had **thrown**,
matched nothing, and exited after **zero polls** reporting exactly the transition being hoped for.
**A dead instrument and a genuine absence are the same string.**
✅ **Every reader now returns an explicit `{alive}` and absence assertions require `alive === true`.**
⚠️ The recorded consequence of this trap was *"looks like a feature doing nothing"*; this was the
opposite, on the arm least likely to be re-run.

**2. 🔴 The CodeMirror linter passes through an intermediate state indistinguishable from the settled
one.** `dispatch` clears the old diagnostics *before* the new pass runs, so `count === 0` is true of
both *"correctly silent"* and *"not linted yet"*, and a loop waiting for `count === 0` exits on the
wrong one. **Two cells changed their answer between the first poll and ~12s.**

⚠️ **Consequence for the write-up:** the Function/`Outputs.Done()` arm is recorded as **"no diagnostic
on `Outputs`"**, *not* "silent". Settled, it emits an unrelated `info` about a declared-but-unread
port `price` — correct behaviour, nothing to do with this change. **"Silent" would have been a
true-sounding sentence falsifiable in ten seconds by the next reader.**
✅ **Settle ~20s and re-read every cell, including the ones that already agreed with you.** A 1→0
transition is *some* evidence the lint re-ran and is **not sufficient** — a clear-then-relint produces
the same transition en route to a non-zero settled state.

🔴 **Both are now in memory** (`a-codemirror-lint-read-before-settle-is-a-different-answer`, and a new
section on `an-hmr-reload-wipes-injected-cdp-state`), linked from `driving-the-app-pointers`.

---

## 4. What to do next and why

**Ordered by cost.** s44's item 1 is gone; everything else has moved up one.

1. 🟠 **FIX-004 §C — dual-list the four object-shaped blocks under `App Objects`**, and narrow
   `browser-blocks.spec.ts`'s byte-identity fence to what its title claims. ⚠️ Blockly ⇒ `test:ci`.
2. 🟠 **FIX-005 rename → `App Variables` / `App Config`.** ⚠️ **Knowingly reverses VFN-012** — say so
   in the commit. ⚠️ Blockly ⇒ `test:ci`.
3. 🟠 **FIX-008 C** — take the two-servers-visible measurement yourself (**it is an agent's, not
   Richard's**), then build C.
4. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
5. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API, and it is the
   difference between a rule that helps and one that forbids deliberate work.
6. 🔴 **FIX-016 — the script-mode mining slice.** `unionPorts` calls `minePorts(code)` in script mode,
   so FUN-005's rail and FUN-006's bar can show a Script node **ports it does not have**; the Script
   node's ports come from `parser.getPorts()`, never from a regex over the document
   (`javascript.ts:831-840`). **Four surfaces.** ⚠️ **s45's drive says nothing about this** — it read
   the code editor's lint state only, not the rail or the bar.
7. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink.
8. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
9. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.

**Do not start** FIX-015 here — it is its own phase.

### How to start here

🔴 **Census before you build, whatever the task file says.** s44's item 2 was *"add the missing
message"* and the measurement changed what got built. **Ten lines in the package's own node runner**
beat four sessions of reading.

🔴 **Grading anything in the code editor, headlessly:** `javascriptDiagnostics(state, validationType)`
is pure and runs in `noodl-core-ui`'s jest. `setOpenNodeContext({typeName, declaredInputs,
declaredOutputs})` says which node is open; `null` is a code **file**, not a node.

✅ **Grading it in the running editor** (s45's recipe, reusable):
`forEachDiagnostic` off the module cache at `../../node_modules/@codemirror/lint/dist/index.js`,
against `document.querySelector('.cm-content').cmTile.view.state`. Select the node by its **view**
node via `NodeGraphContextTmp.nodeGraph`, then `cdp click "button.property-codeeditor-button"`.
⚠️ **Settle ~20s before reading, and return `{alive}` from every read.**

🔴 **Grading what the AI plans:** `packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`.
✅ `--dump=<path>` writes the arm's system prompt and exits before the provider is built. ⚠️ `--model`
is effectively required. **Authoring** is the sibling `dist/aix002-harness.cjs`.

🔴 **Before deleting anything a spec might grade, search THREE roots**: `src/`, `tests/` **and
`tests-unit/`**. ⚠️ **Exclude `*.bundle.js`** — s44 lost a search to a 20MB source-map hit and s45 lost
one to a 6MB viewer bundle in the *first minute*. **Scope the path before you grep.**

✅ **A mutation check costs one shell call.** Apply the mutant, run the suite, restore, `diff` the
file back — all in **one** Bash invocation, so no peer's `git add -A` can catch the broken file.

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
- ✅ **FIX-016 ruling 1 — BUILT s44, DRIVEN s45.** ⚠️ The strictness survived: the parser was not
  loosened, and the drive confirms a genuine typo is still reported in JavaScript's own words.
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
  sweeps. **Still uncommitted at s45** — thirteen sessions now.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Thirteen sessions
  have declined.**
- ⚠️ **The packaged-app repackage is still owed** (`noodl-mcp/dist` rebuilt s36, gitignored).
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **New from s45:** `fix016-msg6-drive` now exists in the projects dir and is worth keeping — it is
  the only fixture with **both** JS node types in one component.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s45 committed once, pathspec-only**; peers' work (phase-65,
phase-50 notes, phase-68, `scripts/library/check.ts`, and **new UNI-011 files under
`models/community/` plus `utils/report/diagnostics.ts`**) was untouched throughout.

⚠️ **This checkout is busy and peers save source constantly.** A save triggers a webpack rebuild that
HMR-reloads the renderer mid-drive — **s45 lost the entire first pass of its drive to exactly that**,
and the reload turned an absence check into a false pass (§3). ✅ **A peer will hold saves if you ask.**
✅ **Re-establish the whole rig in ONE eval afterwards**, so the re-entry window is a single call.

### 🔴 Peer etiquette — and what s45 did instead of announcing

**`ListAgents` reported 19 peer sessions.** s45 judged a 19-way launch broadcast to be flatly
incompatible with *"keep peer messages short and rare"*, and **measured instead**, before launch and
again before teardown: **0 editors, 0 `test:ci`, 0 `test:main`, 0 webpack**, each paired with a
**positive control on the same pipeline** so the zeros were attributable rather than the signature of
a dead check. Teardown re-measured, then `dev:stop`; **39 MCP servers survived**, 0 editors left.

⚠️ **This is a deviation from "announce the launch", and the next session should make its own call.**
It was defensible here because the reaping bug is fixed and measured and the checkout was provably
idle — **it is not defensible if anything is running.** 🔴 **If you do announce, announce teardown to
the FULL launch list**; a launch with no matching close manufactures a reservation that outlives you.
🔴 **Reply to a socket on its socket.**

🔴 **All 20 `electron/dist` matches on an idle checkout are MCP servers, not editors.** Attribute by
**PPID**, never by that path, and never quote a count as evidence of an editor.

### 🔴 Re-read this file immediately before rewriting it — s45 was saved by doing so

s44 overwrote a peer's 29 lines by rewriting from its context copy. **s45's context copy was stale
too**: a peer rewrote this file at **22:03**, after the session started, adding the settled `test:ci`
section now in §2. `git log -1 --stat` plus a full re-read caught it and the content survived.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at. **On this checkout that is most of `dev-docs/`, and it has now nearly
happened twice in two sessions.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **s45 measured `17,293` code points / `17,385` UTF-16 — roughly 125 characters of headroom.**
**`MEMORY.md` is effectively FULL.** s45 added **nothing** to it: one new memory and one update were
filed under the existing `driving-the-app-pointers` entry, which costs zero budget.

🔴 **The next session that needs an index line will have to collapse something first.** Promote traps
out before collapsing, and a section with a 📚 pointer takes new entries **in the pointer file**.

🔴 **It moves while you read it.** `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```
