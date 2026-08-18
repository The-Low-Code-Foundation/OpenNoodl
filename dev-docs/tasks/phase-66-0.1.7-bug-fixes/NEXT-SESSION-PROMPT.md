# Phase 66 — next session

**Written 2026-08-18, session 62's brief, by session 61.** A rewrite, per §0.

## 🔴 EVERY RULING IN THIS PHASE IS ANSWERED. ONE DRIVE STANDS BETWEEN P66 AND DONE.

Richard answered the whole outstanding queue at s61. **Eight rulings, none of which created a build.**
Phase 66's remaining work is therefore exactly one item:

> 🔴 **Drive FIX-021's MCP half.** Built at s60, spec-covered and mutation-checked, **never seen in a
> running editor.** ⚠️ It clicks Connect, which writes Richard's **real `~/.claude.json`** — back it
> up first and put it back. **Needs no API credit.** The pre-registered observations are in §4.

**When that drive passes, phase 66 closes.**

### 🔴 s61's other finding: a question was asked that had been answered two months of sessions ago

s61 told Richard that FIX-004's §C seam-category ruling was owed and had been **missing from the
handover's list**. **It was not owed.** It was **ruled in session 42** and **built in session 46** —
the four object-shaped blocks are dual-listed under `App Objects` in the live toolbox
(`BlocklyToolbox.ts:354-358` and `:474-477`), and the VFN-012 fence was narrowed with four mutants
behind it.

🔴 **How it happened, because it will happen again to somebody:** FIX-004's file is an **append-only
narrative**. Three sections — *"What was deliberately NOT done"*, *"Still owed on §C"*, *"Still owed
after this drive"* — describe a gap that a **later** section closes. Grepping for `owed` finds all
three and none of the closure. **The handover's original list was correct; the "correction" was the
error.** All three are now stamped `STALE` in place, with a pointer to the section that discharged
them.

✅ **The lesson, generalised: in these task files, a sentence saying something is open is evidence
about the moment it was written and nothing else. Read forward to the end of the file, or check the
code, before believing it.**

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
2. **Gate readings with their date and tree.** ⚠️ **Mark which ones this session actually took.**
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 013 / 014 / 017 / 018 / 019 / 020 / 023 / 024** | ✅ | ✅ | **CLOSED** — seventeen tasks |
| **FIX-008** A, B, C, D, E | ✅ | ✅ | **CLOSED** (s56) |
| **FIX-004** — §A+§B, §C, §C dual-list, redaction (b) | ✅ | ✅ | 🆕 **CLOSED.** Its §C ruling was discharged at s42/s46; s61 confirmed. Nothing owed |
| **FIX-006** | ✅ | ✅ | 🆕 **CLOSED s61** — the `Substring` → `Expression` shape accepted |
| **FIX-013** | ✅ | ✅ | 🆕 **CLOSED s61** — rulings 3 + 4 took the non-destructive branch |
| **FIX-016** | ✅ | ✅ | 🆕 **CLOSED s61** — AC1 **RETIRED** by Richard |
| **FIX-022** | ✅ | ✅ | 🆕 **CLOSED s61** — §7 ruled **(a) accept** |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s42/s44 | Closed halves |
| **FIX-021 slice B** — the global user profile | ✅ s58 | ✅ s59 | Q2/Q5/Q6 **confirmed s61** |
| **FIX-021 — the MCP half** | ✅ s60 | ⛔ | 🔴 **THE PHASE'S ONE REMAINING ITEM.** §4 |
| **FIX-021 slice A** | ⛔ | — | ✅ **RULED OUT at s61 (Q2), not deferred.** Proposing it is proposing to overturn a ruling |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

🔴 **TWENTY-THREE tasks closed.** ⚠️ **Count the names, never copy a total.** The arithmetic:
**23 closed + FIX-015 (left the phase) = 24**, with **FIX-021 alone still open**, on a drive.

---

## 2. Gate readings

⚠️ **s61 took NO suite readings and owed none** — it changed no source. Its work was eight rulings
and the documents that record them. **Everything below is s60's or older; re-measure before quoting.**
🔴 **Quote a TREE, not a commit.**

| Gate | Reading | When |
|---|---|---|
| **`typecheck:mcp`** (added s60) | ✅ **exit 0** — was 8 errors, in no gate at all | s60 |
| `typecheck:editor` / `-tests` | ✅ exit 0 | s60 |
| `noodl-mcp` jest, FULL | ✅ **54 suites / 641 tests** | s60 |
| `noodl-editor` `test:main` (jest) | ✅ **242 suites / 3723 tests, 0 failed** | s60 |
| resident tool-surface budget | ✅ **8,223 / 57 under the 8,280 bar** | s60 |
| `lint:ci` ratchet | ✅ **877** / 3916 baseline | s60 |
| `test:ci` (jasmine) | ✅ **2849 / 6 @ seed 39393** — the floor, both known families | s58 |
| `tests-unit/fix-021/` | ✅ 4 suites / 32 tests | s58 |
| `noodl-runtime` jest | ✅ 137 suites / 2515 | s54 |
| `nodegx-backend` / `viewer-react` / `cloud-runtime` | ✅ | s51 |
| `library:check` | ✅ 58/58 | s30 |
| electron-builder package | ✅ exit 0, ~6 min, `NodeGX-0.1.7-mac-arm64.dmg` | s59 |

⚠️ **`test:main`'s baseline moves under you** — s58 read 239/3658, s60 read 242/3723 having added
seven tests. **Peers land suites mid-session.** Re-measure; never diff against a remembered number.

### 🔴 Readings that will mislead you

- 🔴 **`test:ci`'s exit code lies BOTH ways**; a clean floor run exits **1**, and `… | tail` reports
  the pipe's last command ⇒ **0** regardless. **Delete `tests/test-results.json` first and prove
  completion from its mtime.**
- 🔴 **A tool added to an existing DEFERRED MCP group costs ZERO surface budget**, and **so does a
  FIELD added to a tool's RESULT** — the budget measures the advertised surface plus `instructions`
  and nothing else. That is what made FIX-021's MCP half fit against 57 tokens of headroom.
- 🔴 **`provision.test.ts` and `projectOwnsBackend.test.ts` flake** on real ports.
- 🔴 **A jest run of `tests/` is NOT what a client runs** — in-process vs `dist/noodl-mcp.cjs` over stdio.

---

## 3. What s61 did

**No code.** Eight rulings answered by Richard and recorded in their task files:

| # | Task | Answer |
|---|---|---|
| 1 | **FIX-016 AC1** | 🔴 **RETIRE.** A type control at creation is a new UI affordance, not this task's defect |
| 2 | **FIX-022 §7** | **(a) ACCEPT.** Rejected: a numeric floor, `planAdvisories` |
| 3 | **FIX-006** | **Accept** the `Substring` → `Expression` shape; the weighting stays |
| 4 | **FIX-004 §C** | ✅ **Already ruled s42, built s46** — the question was stale, not open |
| 5 | **FIX-021 Q2** | **Confirm:** one file, no project twin. 🔴 **Slice A is ruled OUT** |
| 6 | **FIX-021 Q5** | **Confirm:** `always`, 2,000-char cap, free when empty |
| 7 | **FIX-021 Q6** | **Confirm:** prose only |
| 8 | **FIX-021 `allowWrites`** | **Confirm as built:** the profile reaches read-only servers too |
| 9 | **FIX-013 rulings 3 + 4** | **The non-destructive branch, both** — programmatic, no UI, no spec edits |

🔴 **Not one of the eight created a build.** #1 retires a criterion, #2 and #3 accept measured
behaviour, #5–#9 confirm what shipped, and #9's chosen branch is explicitly the one that deletes
nothing (`component-bench.test.ts:259-262` needs no edit).

---

## 4. What to do next — the drive, and nothing else

### 🔴 Drive FIX-021's MCP half

**Write the observations down BEFORE launching.** These five are pre-registered here so the next
session does not invent them after seeing the result:

1. **Connect, then read `~/.claude.json`.** The `nodegx` entry's `env` carries
   **`NODEGX_USER_PREFERENCES`**, pointing at the real `<userData>/PREFERENCES.md`.
2. 🔴 **The known-firing control, and the row that matters most:** `ELECTRON_RUN_AS_NODE` is **still
   there beside it**. A registration that *replaced* the env record instead of extending it looks
   like a pass to any probe that only checks the new key — and leaves a server that boots a GUI app
   with a dock icon (BST-004/F80).
3. **Open or create a project; read its `.mcp.json`.** Same variable, same value.
4. **With something written in the profile**, have a Claude Code session on that project call
   `get_project_info` and confirm `userPreferences` arrives **with its `note`** — the precedence
   sentence travels with the text, and its absence is the failure worth catching.
5. ⚠️ **The absence row, which needs row 4 above it to mean anything:** restore the seeded template
   (all HTML comments) and confirm the field is **gone**, not empty.

🔴 **`Connect` writes Richard's REAL `~/.claude.json`.** Back it up, and put it back.
⚠️ **The registered `nodegx-puppy-test-3` still resolves to the Aug-13 bundle** (§5) — so a
registered agent runs *older* server code than this checkout builds. **Drive the dev stack, or say
which bundle you measured.**

### Then: close the phase

Once the drive passes, FIX-021 closes and **all 23 remaining tasks are closed**. Write the phase's
close-out and hand the two carried items below to whoever owns them.

### Carried out of the phase, uncosted — NOT P66 work

- 🔴 **`claudeMcpAdd` does not quote its `-e` pairs.** Pre-existing; it matters more now one carries a
  path, because on a machine whose user data sits under a directory with a space the **displayed**
  command needs quoting. The written registration is JSON and unaffected. **Wants its own task.**
- 🔴 **A bar that teaches `define()`** (s50) — needs the node's **real** port list behind
  `parser.getPorts()`, i.e. a syntax-tree parse. ⚠️ **Explicitly not covered by FIX-016's AC1
  retirement.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **`io-error: Unexpected failure: ${err.message}` names neither the tool nor the project.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.
- ⚠️ **The PLANNING turn does not carry the profile** — only the authoring turn does, as Q5 specified.
- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel".**

### How to start here

🔴 **Read to the END of a task file before believing any sentence in it that says something is open.**
s61 asked Richard a question that had been ruled two dozen sessions earlier, because three
`still owed` paragraphs sat above the section that discharged them. **Or check the code — that is
what settled it in ten seconds.**

🔴 **Before believing a "0", find the known-firing signal beside it.** Every absence assertion in
this phase has a presence row built the same way, in the same file, in the same run.

🔴 **A gate is not evidence until it has been made to fail.** s60's `typecheck:mcp` was proven on
`src/` and `tests/` **separately**; the `env` whitelist by a mutant that reddens exactly two rows.

🔴 **Count the pattern before mutating, and require exactly 1.**

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **`${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.** ⚠️ **zsh does not word-split
unquoted variables** — `set -- $var` silently yields one word.

---

## 5. Rulings — what a builder must not get wrong

**All eight of s61's answers are recorded in their own task files with their reasoning.** The
durable ones:

- 🆕 ✅ **FIX-016 AC1 is RETIRED.** 🔴 **This does NOT retire the mining slice** —
  `modeHasDeclaredPorts` stays `true` for `'script'`, and the `define()` bar is separate carried work.
- 🆕 ✅ **FIX-022 §7 → (a) accept.** 🔴 **The reuse cell's rulings survive it:** `minPlacementSites`
  OFF for `trivial`, `small-logic`, `multi-section`; **both** evidence paths; the regression detector.
  ⚠️ If ever revisited, **measure against `multi-section` too** — its ceiling is the only guard
  against a "factor less" edit undoing AAQ-008.
- 🆕 ✅ **FIX-006 — the shape is accepted.** 🔴 **`NODES_BEFORE_CODE` keeps BOTH halves**, separate
  from `THREE_WAYS_TO_COMPUTE`; **`Javascript2` keeps leading the Script paragraph** (`traps.ts:61-63`).
- 🆕 ✅ **FIX-013 rulings 3 + 4 → programmatic, no UI, nothing deleted.**
  ⚠️ **`component-bench.test.ts:259-262` needs no edit.** Ruling 2 still stands: **the two surfaces
  diverge and the AI preview keeps its toolbar and data editor** — which is why a `SandboxToolbar`
  absence check is invalid. 🔴 `useSampleData` is **not** the switch; `emptyState` **predates** the
  fix; `emptyState` keeps shipping the class list **named**; `list()` caches the empty array; the
  bench summary keeps **wrapping**.
- 🆕 ✅ **FIX-021 Q2 → ONE file. 🔴 SLICE A IS RULED OUT, not deferred.** Q5 → `always`, 2,000-char
  cap, free when empty (**rejected:** `pull`). Q6 → prose only (**rejected:** `ai.role.*` keys).
  **The MCP half is NOT gated on `allowWrites`** — confirmed.
- 🆕 ✅ **FIX-004 §C was ruled s42 and built s46.** 🔴 **Its three "still owed" paragraphs are STALE
  and now stamped as such.** `noodl_new_object` and the JSON pair are **deliberately not**
  dual-listed; a spec pins that asymmetry so nobody "finishes the job".
- 🔴 **FIX-021's MCP half — do not "simplify" either half of the security fix back.** The `env`
  whitelist and main's overwrite of the profile path both exist because the registration is written
  to the user's real `~/.claude.json` and spawned by their agent. **`NODEGX_USER_PREFERENCES` is a
  wire contract across four files**; renaming one end turns the feature off silently for every
  registration already on disk.
- 🔴 **`typecheck:mcp` covers `src/` AND `tests/`, and is a required check in `pr.yml`.**
  **Do not narrow it to `src/`** — seven of the eight errors it caught were in `tests/`.
- ✅ **THE REPACKAGE — ruled s59: BUILT, LEFT IN `dist/`, NOT INSTALLED.** Do not install it without
  asking again. ⚠️ **So `nodegx-puppy-test-3` still resolves to the Aug-13 bundle**, and FIX-008 D's
  `open_project` is absent from what a registered agent actually runs. **A deployment choice, not a
  debt — but do not read s59's table as "shipped".**
- 🔴 **The build route is `_viewer` → `build:sidecars` → `npx lerna exec --scope noodl-editor --
  npm run build`.** ⚠️ **Never `npm run build:editor` or `build:editor:_editor` on this checkout** —
  both delete the root `node_modules`. **`build:editor:pack` copies; it does not build.**
- ✅ **Slice B must keep doing:** guidance in **HTML comments**; an empty section **dropped**; the
  block **last** and ahead of `cacheBoundary`; the **precedence sentence in the block**;
  `globalPreferences()` charging **nothing** when empty; `ensureUserProfileSeeded` writing **only
  when there is no file**.
- ✅ **FIX-008 D.** 🔴 `completeBind` stays the single successful-bind path; `ProjectBinding`'s
  bind-once boundary holds; `list_projects`' note branches on `isBound`; the same-directory case
  keeps its own answer.
- ✅ **FIX-004 redaction (b).** 🔴 **`console` stays LAST in all four parameter lists**; do not tidy
  the four spellings into one constant; `createBlockConsole` returns `console` ITSELF with no sink.
- ✅ **FIX-023.** 🔴 `malformedNode` 2nd in `ALL_RULES`; `duplicateNodeId` leads.
- ✅ **FIX-008 C.** 🔴 Observe stays `user` on purpose; `--scope project` resolves against the shell's
  cwd and the `scopeNote` names the folder.
- ✅ **FIX-005** — the rename reversed VFN-012 knowingly. ✅ **FIX-024** — 🔴 `'learn'` and
  `'learning'` are two different pages.

### Still owed by Richard

🆕 ✅ **NOTHING IN PHASE 66.** The queue is empty for the first time since the phase opened.

Outside it, unchanged and still declined by twenty-nine sessions:

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** ⚠️ **The remaining drive needs none of it.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work, still uncommitted.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`.
- ⚠️ **`package-lock.json`'s `@nodegx/kit-scaffold` line — phase 69 should confirm it** (a genuine
  cn-006 desync; **not** verified with `npm ci`, on purpose).
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  ⚠️ **`fix016-s50-drive` is a scratch copy, deletable.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results*. 🔴 **s60 was bitten by this twice.**

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command.

🔴 **This checkout is SHARED and the peer commits mid-session.** ✅ **s60 saw a peer land eleven
modified and eight new files mid-session** (phase-67/69). **Commit by explicit pathspec and verify
afterwards.** ⚠️ **`hot: true`**: an edit to `packages/noodl-editor/src` hot-reloads a live editor
mid-drive — and so does an edit to `packages/noodl-viewer-react/src`. ✅ **Take each measurement in
ONE uninterrupted chain of `cdp` calls.**

### Driving the settings panel — the exact route

1. Write an entry into `~/Library/Application Support/NodeGX/recently_opened_project.json`
   (**back it up; remove the entry AFTER `dev:stop`**), `npm run cdp -- reload`, then click
   `[data-test=launcher-project-card]`.
2. `npm run cdp -- click "[data-test=settings-panel]"` — the rail's gear, `placement: 'bottom'`.
3. The **Editor** tab is a `[class*=Tabs-module__Button--]` whose `innerText` is `Editor`; tag it
   with an `id` and click that.
4. 🔴 **Every section is `isClosed` and its body is MOUNTED at height 0.** Scroll it into view,
   click its `[class*=Header]`, **re-measure**, and only then read or click inside it.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**. ✅ **Put findings into EXISTING pointer files**,
which costs zero index budget.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s61 all checked `git log -1 --stat` plus the mtime before rewriting** — seventeen
sessions running. A whole-file overwrite is the one edit that cannot conflict: git accepts it
happily, and the loss is invisible in the diff you are looking at.
