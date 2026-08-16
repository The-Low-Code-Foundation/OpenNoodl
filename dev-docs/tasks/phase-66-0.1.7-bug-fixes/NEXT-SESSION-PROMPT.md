# Phase 66 — next session

**Written 2026-08-16, session 49's brief, by session 48.** A rewrite, per §0. s48 cleared **the whole
of s47's queue**: item 1 (the two s46 drives), item 2 (FIX-008 C's AC3) and item 3 (the typeless-node
task). **Three tasks, three commits**, each with its source, specs and task file.

✅ **FIX-005 is CLOSED** — fourteen tasks now. ✅ **FIX-004 §C and FIX-008 C are driven.**
📋 **FIX-023 exists**, scoped and censused, and it is the one with a live user impact today.

🔴 **The scheduling problem that blocked s47 solved itself in one message.** A peer held 9222; asking
*"is it yours, and may I have it when you're done?"* got a straight answer and a ping ten minutes
later. **Two sessions were lost waiting silently.** ⚠️ Ask early, then do editor-free work while you
wait — s48 took AC3 in that window.

🔴 **s48's own headline is a correction it made to itself.** It recorded *"`window.Blockly` has no
`getMainWorkspace`, so the API route is dead"* — true of the **global**, and the recipe in memory
uses the **webpack module**, a different object. **Untested ≠ dead.** The corrected note is in
FIX-004 and in memory.

🔴 **Every ruling and every build is recorded in its own task file.** §4 here is a work order, not
the source of truth.

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
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — fourteen tasks. ✅ **FIX-005 joined them at s48** |
| **FIX-016** §2, §3, §3c, **ruling 1** | ✅ | ✅ s45, 2×2 + 2 controls | The mining slice is still open — item 2 |
| **FIX-004** §A+§B, §C, **§C dual-list** | ✅ | ✅ **all driven, dual-list s48** | **Redaction (b) is the one build left** — item 3 |
| **FIX-008** A, B, C, E | ✅ | ✅ **C driven s48 (AC3)** | **D unstarted** — item 8 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** |
| **FIX-023** | 📋 | — | 🔴 **NEW, scoped s48. Tier 1, live user impact** — item 1 |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Fourteen closed outright.** ⚠️ **Count the names, don't copy a total.**

✅ **No task now has a built-but-undriven half.** That was true of three tasks at s47.

---

## 2. Gate readings

✅ **s48 took the five marked.** This session changed **source** (`mcpCommands.ts`), so those are its
own.

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main`** | ✅ **227 suites / 3527 tests, all green** | ✅ **s48, 23:33** |
| **`tests-unit/mcp-001` + `mcp-004`** | ✅ **3 suites / 58 tests** | ✅ **s48** |
| **`tsc -p tsconfig.json`** | ✅ 0 errors | ✅ **s48** |
| **`tsc -p tsconfig.tests.json`** | ✅ 0 errors | ✅ **s48** |
| **Mutant M5** (approval sentence dropped) | ✅ applied, announced, **bit 1 of 58**; source `diff`ed back identical | ✅ **s48** |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited** |
| `noodl-core-ui` jest | ✅ 26 suites / 461 tests | s44 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s40 — inherited |
| `lint:ci` ratchet | ✅ exit 0, 876 against a 3916 baseline | s44 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ⚠️ **Both `tsc` readings are off empty output, not an
exit code.**

✅ **`test:main` 3526 → 3527** is exactly s48's one new spec; suite count unchanged at 227.

### 🔴 `test:ci` NOT taken — same two reasons as s46 and s47

The changed source (`mcpCommands.ts`) has **no jasmine spec**; that whole surface is `tests-unit`,
which is plain-Node jest, so a `test:ci` run would have **graded none of it**. And peers still hold
uncommitted `noodl-editor` source (`models/community/*`, `DialogLayer/*`, `SandboxSurface`,
`VisualCanvas`, `NodeContextMenu`) plus untracked `portshare.ts` / `nodesharecontext.ts`, so a run
would compile **their** working tree. **Floor stays inherited: 2843 / 6 @ 39393, witnessed 21:53:37.**

---

## 3. What s48 did

### ✅ Item 1 — the two s46 builds, DRIVEN, one editor launch (`98c3c7e0`)

Rig: `fix004c-s48-drive` (a copy of `vfn64-drive`), Visual Function node `c6` in `/ErgCodes`.

**FIX-004 §C — seven rows, in order, drawn.** Read from the **flyout workspace**
(`.blocklyToolboxFlyout .blocklyBlock`), type off each block's own class, position off
`getBoundingClientRect()`, **sorted by drawn `y`**, every row a non-zero height:

`noodl_get_object` · `noodl_get_object_property` · **`_expr`** · `noodl_set_object_property` ·
**`_expr`** · **`noodl_object_members`** · **`noodl_object_has_property`**

**Exactly the interleaving the build claimed.** ✅ **The `Data` / `App Objects` collision did not
materialise** — nine rows apart, different visual groups, as s38 predicted from geometry.

**FIX-005 — both halves.** The flyout says **`App Variables`**, never `Runtime Variables`. Settings →
Project renders a collapsable section headed **`App Config`**, chevron and all, and the string
`Custom Variables` occurs **nowhere in the rendered document**.

🔴 **This upgraded the grade rather than repeating it.** The settings half was previously asserted by
**reading source text** for the `title` prop — the spec said so — and could not prove the section
renders. ✅ **It also walks the whole route `APP_CONFIG_SETTINGS_PATH` names**: Settings opens on a
**Project** tab, and `App Config` is a section on it. Every segment of that sentence exists.

⚠️ **The six locales are still spec-graded only** — the editor language was not switched.

### ✅ Item 2 — FIX-008 C, AC3 DRIVEN, and a copy gap closed (`d96d6f06`)

**The command was not hand-written**: `buildMcpCommands` called directly with the bundle path from
`resolveMcpServer` — the two units the panel composes — so the string that ran is the string the
panel hands the user. Target a **scratch copy** of a v2 project, deleted afterwards.

**A 2×2, location × before/after.** The server is listed **only** in (project folder, after the add).
✅ **The absence elsewhere sits beside a known-firing signal**: the same `$HOME` listing still names
three other `nodegx*` servers, and `claude mcp get` there fails *while enumerating the six that do
exist*. ✅ **The `$HOME` listing is byte-identical before and after** — nothing leaked to user scope.
✅ **Scope asserted directly**, not inferred from location: `claude mcp get` reports **`Project config
(shared via .mcp.json)`**.

🔴 **What the drive found, and it became a build:** a project-scope server lists as **`⏸ Pending
approval`** where every user-scope one lists as **`✔ Connected`**. Correct — it is Claude Code's trust
prompt for a `.mcp.json` — but a **behaviour C introduced and the copy did not mention**, so the user
pastes a working command and reads a status that does not say "connected". `perProjectScopeNote` now
says it. **That is C's trade stated rather than discovered.**

⚠️ **The shadowing claim in the same note was NOT re-tested** — proving it again means writing a
user-scope entry into Richard's real `~/.claude.json`. It rests on the 2026-08-11 measurement.

✅ **Incidental, and it is the bug C exists for, live on this machine:** `nodegx-puppy-test-3` is
**user-scope**, bound to `…/Puppy test 3`, and `✔ Connected` from `$HOME` and from unrelated folders
alike. ⚠️ It resolves to `/Applications/NodeGX.app/…` — **the packaged Aug-13 bundle**.

### 📋 Item 3 — FIX-023 written, censused, not built (`dbb63364`)

`FIX-023-ONE-TYPELESS-NODE-KILLS-THE-SERVER.md`. ✅ **Reproduced by s48 on the registered, packaged
server**, so it is the code on Richard's machine now. One node object with no `type` reaches
`isComponentRef(type: string)` → `type.startsWith('/')` — **the parameter is typed `string`, so no
`tsc` gate can see it**.

✅ **Census before scoping: 28 v2 projects, exactly ONE affected** (`Puppy test 3`, **1 of its 119
node objects**). One in 28 is a rounding error *except* that it is the project Richard has a
registered server for.

⚠️ **Count node OBJECTS, not array entries** — a `children` array holds **id strings**, and the first
pass reported ~83 "typeless nodes" here and ~40 in healthy projects.

🔴 **The guard exists in exactly ONE call site** (`ProjectStore.ts:429`) and five walkers have none —
someone hit this before and patched the line they were standing on.

---

## 4. What to do next and why

**Ordered by value, not cost. Item 1 is the only one with a user waiting.**

1. 🔴 **FIX-023 — build it.** §3 and the task file. **A guard at the load boundary, not at the five
   call sites**, plus an error that **names the node and the component**. ⚠️ **The uninformative
   error is the bigger defect** — it turns a one-node problem into an unexplained dead server.
   ⚠️ **Fix C (widen `isComponentRef`'s signature) must not ship alone**: it silences the crash
   without telling anyone the project is malformed. ✅ Drive on **`puppy-test-3-fix008c`**, kept for
   exactly this.
2. 🔴 **FIX-016 — the script-mode mining slice.** `unionPorts` calls `minePorts(code)` in script mode,
   so FUN-005's rail and FUN-006's bar can show a Script node **ports it does not have**; the Script
   node's ports come from `parser.getPorts()`, never a regex over the document
   (`javascript.ts:831-840`). **Four surfaces.** ⚠️ s45's drive read the code editor's lint state
   only. 🔴 **Check for peers' uncommitted `noodl-core-ui/src/components/code-editor/*` first.**
3. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink. ⚠️ **Not free**: the
   sink is per-run `runContext`, which generated code has no handle on today. **The last FIX-004
   build.**
4. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
5. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API.
6. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
7. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.
8. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.

**Do not start** FIX-015 here — it is its own phase.

### How to start here

🔴 **If a peer holds 9222, ASK — early — then do editor-free work while you wait.** s47 waited
silently and moved nothing; s48 asked, got *"mid-drive, I'll ping you"*, took AC3 in the gap, and had
the port ten minutes later. ⚠️ **`ListAgents` names need their `[ref]`** on first send. ⚠️ **Attribute
by PPID** — `ps` showed ~25 `electron/dist` matches and **all but one were MCP servers**.

🔴 **READ `driving-the-app-pointers` BEFORE the drive, not after it stalls.** s48 reinvented **two**
things already on that page — coordinate clicking (`cdp drag "x,y" "x,y"`) and getting an
unregistered project into the launcher (`openProjectFromFolder` → reload → click the card). ~20
minutes each.

🔴 **"Untested" is not "dead", and s48 filed the confusion before catching it.** `window.Blockly` has
no `getMainWorkspace`; the working recipe uses `req.c['blockly'].exports`, a **different object**. A
missing method on the handle you happened to try says nothing about the handle you did not.

🔴 **Census before you build, whatever the task file says**, and **count the right population** —
FIX-023's first census inflated 1 to 83 by treating id strings as nodes.

🔴 **"Nothing changed" is never a result on its own — establish whether the thing was ATTEMPTED.**
For a control that is `[mutant applied]`; for a behavioural arm it is **the transcript**. ⚠️ **A
refusal and a crash leave identical footprints and mean opposite things.**

🔴 **Check the exit code before reading the diff.** macOS has **no `timeout`**; a command that exits
127 looks exactly like a well-behaved run.

✅ **A mutation check costs one shell call** — apply, run, restore, `diff` back, in **one** Bash
invocation. 🔴 **Make each mutant announce that it applied**, and **restore from a scratchpad backup,
never `git checkout`**. ✅ **s48 did the edit in `node`, not `sed`** — the `\$`-inside-quotes bug that
bit s46 and s47 cannot reach a `String.replace`.

✅ **Measuring what a model does with an MCP surface:** `claude -p --strict-mcp-config --mcp-config
<file>` — pure arms, real client, nothing of the user's touched. ⚠️ **Identical `--allowedTools` in
every arm.** ⚠️ **~$0.60 a run.**

✅ **Grading what the AI plans:** `packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`.
✅ `--dump=<path>` writes the arm's system prompt and exits before the provider is built.
⚠️ `--model` is effectively required. **Authoring** is the sibling `dist/aix002-harness.cjs`.

---

## 5. Rulings — what a builder must not get wrong

- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids.** Measure node choice **and** chain shape. ⚠️ n=5 cells are not a
  floor; re-run at n=10. ⚠️ **Coupling:** this preference belongs in FIX-021's user profile — **do
  not build it in a way that forecloses slices A/B.**
- ✅ **FIX-008 C — BUILT s47, MEASURED s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose**; M4
  exists to stop a later reader "finishing the job". 🔴 **Do not re-open the scope question from the
  string** — settled by the 3/3 vs 4/4 measurement.
- ✅ **FIX-004 §C dual-list — BUILT s46, DRIVEN s48.** The seam fence is narrowed and its narrowing is
  mutant-checked; **do not widen it back** to admit a future change.
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. **The one FIX-004 build left.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly. **The argument lives on
  `ToolboxLabels.noodlVariables`; do not re-litigate it from `appConfig.ts`.**
- ✅ **FIX-016 ruling 1 — BUILT s44, DRIVEN s45.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.
- 📋 **FIX-023 — no ruling needed to start.** Fix A + Fix B; **C alone is explicitly forbidden.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.** ⚠️ s46's
  rename does **not** pre-empt this.
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

⚠️ **The typeless-node bug is no longer on this list — it is FIX-023**, filed in this phase because
P66 is *0.1.7 bug fixes* and this is a 0.1.7 bug with a user waiting. **If Richard wants it
elsewhere, moving one file and one `TASKS.md` row is the whole cost.**

### Still owed by Richard

- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** ⚠️ Unlanded work on a PR-gated script is exactly what a sibling's `git add -A`
  sweeps. **Still uncommitted at s48 — sixteen sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Sixteen sessions
  have declined.**
- ⚠️ **The packaged-app repackage is owed, and FIX-023 gives it a third reason** — the shipped bundle
  is **Aug 13**, so every project-bound server on this machine predates fix E *and* will predate
  FIX-023's guard. **Richard's own `nodegx-puppy-test-3` will not see the fix without it.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c` (the only typeless-node reproduction —
  FIX-023 needs it), `fix016-msg6-drive` (the only fixture with both JS node types in one component),
  and 🆕 **`fix004c-s48-drive`** (a `vfn64-drive` copy with a Visual Function node — the FIX-004/005
  re-drive rig). ⚠️ s48 hand-added the last one to
  `~/Library/Application Support/NodeGX/recently_opened_project.json`; opening it made the entry
  genuine, so nothing needs undoing.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command (s48 did this once, for FIX-023). ✅ **s48 committed three times,
pathspec-only**; peers' work (phase-50 notes, phase-65, phase-68, in-flight `noodl-editor`
community/dialog files, `scripts/library/check.ts`) was untouched throughout, and a peer commit landed
mid-session without incident.

⚠️ **This checkout is busy and peers save source constantly.** A save triggers a webpack rebuild that
HMR-reloads the renderer mid-drive. ✅ **A peer will hold saves if you ask.** ✅ **Re-establish the
whole rig in ONE eval afterwards.**

### 🔴 Peer etiquette — s48 launched, so s48 announced

s48 asked two candidate sessions about 9222, got a clean answer from the owner, and **told that owner
when the stack was down**. 🔴 **Announce teardown to the FULL launch list.** 🔴 **Reply to a socket on
its socket.** 🔴 **All `electron/dist` matches on an idle checkout are MCP servers, not editors** —
attribute by **PPID**, never quote a count as evidence of an editor.

⚠️ **A peer's account of who owns a stack can be right and still be stale** — one peer correctly noted
that the 9222 stack it had watched all evening was **gone**, replaced by a different one at 23:04.
**Re-walk the PPID chain; do not trust last session's owner.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure — s48 saw exactly this.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **s48 measured `17,397` code points / `17,492` UTF-16 — EIGHTEEN characters of headroom.**
⚠️ **s47 read `17,505` and s48 added nothing, so a PEER moved it by −13 mid-session.** The file's
mtime (23:31:50) fell inside s48's session with no edit from s48. **Take your own reading; the
headroom moves both ways and neither direction is yours.**
✅ **s48 added NOTHING to `MEMORY.md`** — its one memory update went into the existing
`driving-the-app-pointers` file, under a pointer that already exists, which costs zero index budget.
**That is the move whenever the new fact belongs to a section that already has a 📚 pointer.**

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46, s47 and s48 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared four sessions running.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
