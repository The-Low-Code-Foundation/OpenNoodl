# Phase 66 — next session

**Written 2026-08-18, session 58's brief, by session 57.** A rewrite, per §0. s57 took **item 1 —
FIX-013's AC1 and AC2 — and both are DRIVEN** (`1e2dd175`). One task, one commit, docs only: no
source changed, so no gate was owed and none was run.

✅ **s57's headline: phase 66 has no built-but-undriven task left.** FIX-013 was the only one, and it
had been waiting two sessions for a free checkout. The checkout was free at s57's start (measured —
every `electron/dist` match was an MCP server), the drive took one editor session, and the stack was
torn down after.

🔴 **The most transferable finding is again about an instrument, and it is the second session running
that a check nearly passed while measuring nothing.** s57's absence check was written beside a
known-firing control — the real `SandboxToolbar` mounted into the bench's own subtree — and **the
first control run reported `0 0 0 0`**, exactly like the absence it was supposed to license. The
cause was s57's own rig: two components mounted as siblings, the second threw, and React discarded
the whole tree *including the control*. ✅ **Read the control row before the measurement row.**

⚠️ **The fixture s56 left carried a trap of its own.** `fix013-drive`'s `project.json` still had
`"name": "fix012-drive"`, so its launcher card was indistinguishable from the real `fix012-drive`'s.
Renamed on the copy before driving; **the source fixture still has it.**

🔴 **Every ruling and measurement is in its own task file.** §4 here is a work order. FIX-013's full
write-up — the control triple, the seven AC2 measures, the two corrections to s55's own text — is at
the foot of its own file.

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
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020 / 023 / 024** | ✅ | ✅ | **CLOSED** — sixteen tasks |
| **FIX-008** A, B, C, D, E | ✅ | ✅ | **CLOSED** (s56) |
| **FIX-013** — the empty-state sandbox | ✅ | ✅ | 🆕 **AC1 + AC2 DRIVEN s57 (`1e2dd175`). CLOSED** |
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + the reuse cell | ✅ | ✅ | **No open build** (s53). ⚠️ The §7 ruling is the only thing owed |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 | **Slices A/B are the open work — now item 1** |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Nineteen tasks closed outright.** ⚠️ **Count the names, don't copy a total.**

✅ 🆕 **There is no built-but-undriven task left in this phase.** Every remaining P66 item is either
a new build (FIX-021 A/B), a gate hole, or a ruling owed by Richard.

---

## 2. Gate readings

⚠️ **s57 ran NO gates, and none was owed** — the commit changes one `.md` file and no source at all.
That is stated rather than skipped: a docs commit with a green gate table copied forward is how a
stale reading gets laundered into a fresh one.

| Gate | Reading | When |
|---|---|---|
| **drive: FIX-013 AC1 + AC2, live editor** | ✅ **AC1 5/5 present + 4/4 absent on two components; AC2 7/7 measures** | ✅ **s57** |
| `noodl-mcp` jest, FULL | ✅ 53 suites / 633 tests, exit 0 | s56 — inherited |
| resident tool-surface budget | ✅ 8,223 / 57 under the 8,280 bar | s56 — inherited |
| `npm run build` (esbuild) | ✅ exit 0 | s56 — inherited |
| `tsc -p tsconfig.json` (noodl-mcp) | ⚠️ **8 errors — pre-existing, diffed byte-identical** | s56 — inherited |
| root `npm run typecheck` | ✅ exit 0 | s55 — inherited |
| `test:ci` (jasmine) | ✅ 2849 / 6 @ 39393 — the floor, same six by name | s55 — inherited |
| `typecheck:editor-tests` | ✅ exit 0 | s55 — inherited |
| `lint:ci` ratchet | ✅ 877 / 3916 baseline | s55 — inherited |
| `noodl-runtime` jest | ✅ 137 suites / 2515 | s54 — inherited |
| `noodl-editor` `test:main` | ⚠️ 234 suites / 3601, 2 failed — both pass in isolation | s54 — inherited |
| `nodegx-backend` / `viewer-react` / `cloud-runtime` | ✅ | s51 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** 🔴 **Quote a TREE, not a commit.**

### 🔴 Readings that will mislead you

- 🔴 **`noodl-mcp` has NO root typecheck gate.** Ten `typecheck:*` scripts in the root
  `package.json`, and **`typecheck:mcp` is not one of them**. The package's own `tsc` reports **8
  errors**, pre-existing, proved against a throwaway worktree and diffed 8 = 8. One is a real
  `Exclude<ToolGroupId,'core'>`/zod mismatch at `disclosure.ts:381`; the rest are three test files.
  **Nothing watches this. It wants a task** — item 4.
- 🔴 **A tool added to an existing DEFERRED MCP group costs ZERO surface budget** — measured twice.
  The margin is only visible on a passing run's `[surface]` line.
- 🔴 **`provision.test.ts` and `projectOwnsBackend.test.ts` flake** on real ports. **Do not report
  them as a regression without an isolation re-run.**
- 🔴 **A jest run of `tests/` is NOT what a client runs** — in-process `InMemoryTransport` vs
  `dist/noodl-mcp.cjs` over stdio.
- 🆕 🔴 **A text search is the wrong instrument for FIX-013's absence check.** Searching the bench
  for the string `"Sample data"` **false-positives on the summary itself**: ruling 1(c)'s caption is
  literally `No sample data — signed in as a sample user`. Use the `data-test` hooks
  (`sandbox-auth-toggle`, `sandbox-data-toggle`, `sandbox-sample-data`, `sandbox-real-backend`).

### ⚠️ A peer is live and editing editor source

s57 drove with a peer actively working. Their edits landed mid-drive and **reloaded s57's editor
twice** — `packages/noodl-viewer-react/src/viewer.jsx` rebuilds into
`packages/noodl-editor/src/external/`, which the editor's own dev server watches, so a viewer edit is
an editor HMR reload. At s57's finish the peer's uncommitted work was:

```
 M packages/nodegx-module-inject/src/index.js          M packages/nodegx-module-inject/tests/inject.test.js
 M .../nodelibrary/NodeLibraryData.ts                  M .../nodelibrary/NodeLibraryImporter.ts
 M .../SettingsPanel/sections/KitsSection.tsx          M packages/noodl-runtime/noodl-runtime.ts
 M packages/noodl-viewer-react/src/viewer.jsx          M .../testfs/module-inject/expected-inject.snapshot.txt
 ?? packages/noodl-editor/tests-unit/cn-015/           ?? packages/noodl-runtime/test/modulefailures.test.ts
```

plus the long-standing `leg-001-lane-notes.md`, `phase-68-learnbook/README.md`, `scripts/library/check.ts`
and `?? dev-docs/tasks/phase-65-the-library/`.

✅ **s57 committed ONE pathspec and verified afterwards that every one of those survived.** Do the same.
✅ **43 MCP servers survived s57's `dev:stop`** — the `NEVER_SWEEP` shield held, as documented.

⚠️ **The bundled-editor-build gap is now seven sessions old.**

---

## 3. What s57 did — FIX-013 AC1 + AC2 (`1e2dd175`)

Driven on a `cp -R` copy of `fix013-drive`, opened via
`LocalProjectsModel.openProjectFromFolder()` → reload → click the card, scoped to the bench with
`[data-test=preview-scope-chip]` → `[data-test=preview-scope-target-/Probe]`.

**AC1** — on **`/Probe` and `/App`**: frame, inputs rail, outputs rail, scenario bar and summary all
present; `sandbox-auth-toggle`, `sandbox-data-toggle`, `sandbox-sample-data`, `sandbox-real-backend`,
the `Apply` button and its banner text all absent.

**AC2** — `/Probe`'s summary carries the whole backwards clause, `white-space: normal`,
`text-overflow: clip`, no ellipsis, **48px at a 17.4px line-height (≈2.75 lines)**, and unclipped on
both axes — probed with **`scrollLeft`/`scrollTop`, never `scrollWidth`**.
✅ **Negative control: `/App`, which has no backwards port, gets no sentence.**

✅ **`workbench-1.png` is the BEFORE and the comparison is exact** — it shows all four buttons, the
open Data panel, the Apply banner, and the same clause **cut off mid-word** at *"signed in as a
sample us"*. s55's claim that AC2 is met *for the first time* rather than preserved is confirmed.

### 🔴 Two corrections to the build's own write-up, both in the task file

1. **The backwards sentence is no longer appended last.** `componentBench.ts:489` is
   `` `${summary} ${dataset.summary}` ``, so ruling 1(c)'s caption trails it. The placement argument
   still holds — it wraps — but that sentence of s55's §"The summary did NOT go where the Fix
   direction said" is no longer literally true of the shipped string.
2. **`/Probe` reports 5 outputs, not 4.** `benchInterface` reads `component.getPorts()` — the
   *published* interface — so `pBackwards`, plugged `"input"` on `Component Inputs`, is counted **and
   listed in the outputs rail** as an output. Predicting "4" from the `Component Outputs` node alone
   is wrong. ✅ **This mismatch is what proved the reading was real rather than assumed.**

---

## 4. What to do next and why

**Ordered by value, not cost.** ⚠️ **Items needing API calls are blocked on credit** — see §5.

1. 🔴 **FIX-021 slices A/B** — the user profile. **Now the phase's only open build.** Big; three of
   six questions answered. ⚠️ **FIX-006's weighting and FIX-022's reuse axis both belong in it.**
   ⚠️ Blocked on credit if it needs a measurement harness; the *build* is not.
2. ⚠️ **A bundled/packaged editor build**, in passing — §2. Seven sessions old, and it is the item
   with a live user impact (§5).
3. 🆕 ⚠️ **A root `typecheck:mcp`**, and the 8 errors behind it — §2. Small, and it closes a gate
   hole rather than a bug.
4. 🆕 ⚠️ **Rename `fix013-drive`'s `project.json` `name` field**, which still reads `fix012-drive`.
   One line; it removes a launcher coin-toss that will otherwise bite whoever drives it next.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list, behind
  `parser.getPorts()`. **Wants a task; needs a syntax-tree parse of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.** ⚠️ One typeless node costs the MCP server a project's entire
  validate-and-write surface.
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.

### How to start here

🔴 **Read the CONTROL row before the measurement row.** s57's known-firing control read `0 0 0 0` on
its first run — identical to the absence it was licensing — because two components were mounted as
siblings and the second threw, taking the control down with the tree. **A control that reads zero
proves nothing, and looks exactly like success.**

🔴 **Write the expected observation BEFORE driving, and expect to be wrong in a way that teaches.**
s57 pre-registered "4 outputs" and the app said 5. Chasing the mismatch is what confirmed
`benchInterface` reads the *published* interface — a check that had merely agreed would have
measured nothing.

🔴 **Census before you build — and grep the file you are about to add to.** s56 appended a re-export
that was already at HEAD. One grep would have saved it.

🔴 **A spec that reads real machine state has a branch that never runs on CI.** ✅ **Export the pure
function and assert it directly.**

🔴 **A mutation harness must restore in a `finally`.**

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **`${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.**

⚠️ **`cp -R` a fixture and its launcher card is a coin-toss** — the card shows `project.json`'s
`name`, which the copy inherits. **Rename the copy first**, and confirm it matched 1 of N.

---

## 5. Rulings — what a builder must not get wrong

- 🆕 ✅ **FIX-013 — AC1 + AC2 DRIVEN s57. The task is CLOSED.** 🔴 **`useSampleData` is not the
  switch.** 🔴 **`emptyState` must keep shipping the class list NAMED.** 🔴 **`synthesizeMissing`
  must keep defaulting to `true`** and **must keep being sent `false` by the bench**.
  🔴 **`list()` must keep caching the empty array.** 🔴 **The bench summary must keep WRAPPING** —
  this is now a measured property (`white-space: normal`, ≈2.75 lines), not an intention.
  🔴 **`ComponentBench` must keep importing neither `SandboxToolbar` nor `SandboxDataEditor`** —
  that non-import is the static half of AC1's proof.
- ✅ **FIX-013 ruling 2 → the two surfaces DIVERGE (s55), confirmed in source s57.** 🔴 **The AI
  preview keeps its toolbar and data editor**; `SandboxPreview.tsx` is their only importer.
  BEN-004 §7 is knowingly retired for the bench.
- ✅ **FIX-013 rulings 3 + 4 → the non-destructive branch (s55).** 🔴 **`signedIn` and `useSampleData`
  stay programmatic options with no UI.** ⚠️ **Richard's answers are still owed.**
- ✅ **FIX-008 D — BUILT + DRIVEN s56.** 🔴 **`completeBind` must stay the single successful-bind
  path.** 🔴 **`ProjectBinding`'s bind-once boundary must hold.** 🔴 **`list_projects`' note must
  keep branching on `isBound`.** 🔴 **The same-directory case must keep its own answer.**
- ✅ **FIX-022 — the reuse cell BUILT + MEASURED s53.** 🔴 **`minPlacementSites` OFF for `trivial`,
  `small-logic`, `multi-section`.** 🔴 **BOTH evidence paths.** 🔴 **A REGRESSION detector.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE** (s42).
- ✅ **FIX-006 — the Substring weighting BUILT + MEASURED s52.** 🔴 **`NODES_BEFORE_CODE` keeps BOTH
  halves**, and stays a separate export from `THREE_WAYS_TO_COMPUTE`.
- ✅ **FIX-006 AC4.** 🔴 **`Javascript2` must keep leading the Script paragraph** (`traps.ts:61-63`).
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` stays LAST in all four parameter lists**;
  do not tidy the four spellings into one constant; `createBlockConsole` returns `console` ITSELF
  when there is no sink.
- ✅ **FIX-016 — mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` stays `true` for `'script'`.**
  ⚠️ **AC1 as originally written is still FALSE as built.** **Retired or still owed? s50–s57 did not
  decide.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` 2nd in `ALL_RULES`; `duplicateNodeId` leads.**
- ✅ **FIX-008 C — 🔴 Observe stays `user` on purpose.** 🔴 **`--scope project` resolves against the
  shell's cwd**; the `scopeNote` names the folder.
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly.
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN.** 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-024 — CLOSED s51.** 🔴 **`'learn'` and `'learning'` are two different pages.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel".**

### Still owed by Richard

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** **Every measurement harness in this phase is
  blocked.** ⚠️ **s54, s55, s56 and s57 all needed none of it.**
- 🔴 **THE REPACKAGE — still the item with a live user impact.** `nodegx-puppy-test-3` resolves to
  `/Applications/NodeGX.app/…`, the **Aug-13** bundle. FIX-008 D's `open_project` exists in the
  checkout bundle and in no packaged app. 🆕 **FIX-013's fix is in the same position: driven in the
  checkout, absent from the packaged app.**
- 🔴 **FIX-013 rulings 3 and 4 — confirm or overturn.** ⚠️ **The build is now driven and closed on
  the non-destructive branch, so this is no longer blocking anything** — but overturning it is still
  a deletion someone has to authorise.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?**
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want?**
- 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6** · 🔴 **FIX-016 AC1 — retired or still owed?**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work. Still uncommitted at s57 — twenty-five sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-five
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  🆕 **`fix013-drive` is kept but no longer needed by any open item** — FIX-013 is driven.
  ⚠️ **`fix016-s50-drive` is a scratch copy, deletable.**
  ✅ **s57's own copy `fix013-s57-drive` was deleted and de-registered from the launcher recents.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results*; write every path absolute and the question does not arise.
✅ **s57 was bitten by this once** — a `cd` in a compound command, reported in the tool result.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command.

🔴 **This checkout is SHARED and the peer commits mid-session.** ⚠️ **`hot: true`**: an edit to
`packages/noodl-editor/src` hot-reloads a live editor mid-drive — 🆕 **and so does an edit to
`packages/noodl-viewer-react/src`**, because its webpack build emits into
`packages/noodl-editor/src/external/`, which the editor dev server watches. **s57's drive was
reloaded twice this way and lost its renderer state both times** (`window.__req` and every probe go
with it). ✅ **Take each measurement in ONE uninterrupted chain of `cdp` calls**, and re-establish
`__req` after any reload.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure — ✅ **s57 saw exactly that.** 🔴 **All `electron/dist` matches on an idle checkout
are MCP servers** — attribute by PPID and cmdline. ✅ **s57 measured 43 of them surviving a real
`dev:stop`.**

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **Take your own reading before adding a line.** ✅ **A new fact belonging to a section that already
has a 📚 pointer goes in the POINTER FILE, which costs zero index budget.**

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s57 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared thirteen sessions running. ✅ **s57 also ran `git diff --stat HEAD` on this file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
