# Phase 66 — next session

**Written 2026-08-18, session 57's brief, by session 56.** A rewrite, per §0. s56 took **item 3 —
FIX-008 D — and it is BUILT, GATED, MUTATION-TESTED and DRIVEN** (`5754a168`). One task, one commit.

🔴 **Item 1 was blocked and is still the top item.** s56 arrived to find a peer holding the checkout
with a **live editor** (`Electron . --dev`, pid 87467, holding `--remote-debugging-port=9222`), and
two editors cannot coexist on that port. **FIX-013's AC1/AC2 are untouched and remain item 1.** s56
picked the highest-value item that needed no editor — and, deliberately, none of the peer's files:
**zero `packages/noodl-editor/src` edits**, so nothing hot-reloaded their drive.

✅ **s56's headline: `open_project` exists, and the bootstrap briefing finally has two exits.**
`list_projects` could name the user's real app and *nothing in the mode could open it*, so the only
completable path was `create_project` — which builds a second app beside the one they meant. **That
is the class FIX-008 D was written to remove, and the phase's report 5 is now closed end to end:
A, B, C, D and E all built and driven.**

🔴 **The most transferable finding is about an instrument, not the feature.** s56's drive included a
check written as `expect(e === null || true)` — **a check that cannot fail** — guarding the branch
that mattered most. It was caught because the *payload it printed* did not match the branch name.
The refusal it claimed to test was **unreachable on that server at all**: `bind()` never looks at its
argument once it has a store, so a format refusal cannot happen on a bound server. ✅ **It is now
driven on a second, fresh server, where it is reachable.**

⚠️ **A second instrument fault, same session:** the mutation harness crashed on its own output parser
and **left M1 applied on disk**. Caught by reading the source. The restore is now in a `finally`.

🔴 **Every ruling and measurement is in its own task file.** §4 here is a work order. FIX-008 D's
full write-up — the two renegotiations, the mutation table, the 20-check drive — is at the foot of
its own file.

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
| **FIX-008** A, B, C, D, E | ✅ | ✅ | 🆕 **D BUILT + DRIVEN s56 (`5754a168`). No open build — the task is CLOSED for code** |
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — see s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + the reuse cell | ✅ | ✅ | **No open build** (s53). ⚠️ The §7 ruling is the only thing owed |
| **FIX-013** — the empty-state sandbox | ✅ **data layer + UI** | 🔴 **NO** | `346114a6` on s54's `8216037d`. **Gated, undriven.** AC1/AC2 are item 1 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 | **Slices A/B are the open work** |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Seventeen closed outright, and FIX-008 makes eighteen.** ⚠️ **Count the names, don't copy a total.**

🔴 **FIX-013 is the phase's only built-but-undriven task**, and it has been for two sessions.

---

## 2. Gate readings

✅ **s56 took the six marked.** This session changed **only `packages/noodl-mcp`** (10 files + 2 new)
and one task doc. ⚠️ **It changed no editor source at all**, so `test:ci` was not required and was
not run — the editor is untouched by this commit.

| Gate | Reading | When |
|---|---|---|
| **`noodl-mcp` jest, FULL** | ✅ **53 suites / 633 tests, exit 0** | ✅ **s56** |
| **resident tool-surface budget** | ✅ **8,223 / 57 under the 8,280 bar — UNCHANGED by a new tool** | ✅ **s56** |
| **`npm run build` (esbuild)** | ✅ exit 0; `open_project` present in `dist/noodl-mcp.cjs` | ✅ **s56** |
| **`tsc -p tsconfig.json` (noodl-mcp)** | ⚠️ **8 errors — byte-identical to a HEAD-worktree baseline, diffed** | ✅ **s56** |
| **mutation table (8 mutants)** | ✅ **8/8 killed**, each verified applied and restored by sha256 | ✅ **s56** |
| **drive: shipped bundle over stdio** | ✅ **20/20** | ✅ **s56** |
| root `npm run typecheck` | ✅ exit 0 | s55 — inherited |
| `test:ci` (jasmine) | ✅ 2849 / 6 @ 39393 — the floor, same six by name | s55 — inherited |
| `typecheck:editor-tests` | ✅ exit 0 | s55 — inherited |
| `lint:ci` ratchet | ✅ 877 / 3916 baseline | s55 — inherited |
| `noodl-runtime` jest | ✅ 137 suites / 2515 | s54 — inherited |
| `noodl-editor` `test:main` | ⚠️ 234 suites / 3601, 2 failed — both pass in isolation | s54 — inherited |
| `nodegx-backend` / `viewer-react` / `cloud-runtime` | ✅ | s51 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.**

### 🔴 Four readings that will mislead you

- 🔴 **`noodl-mcp` has NO root typecheck gate.** There are **ten** `typecheck:*` scripts in the root
  `package.json` and **`typecheck:mcp` is not one of them**. The package's own `tsc` reports **8
  errors** and they are **pre-existing** — proved against a throwaway worktree at `3cee0a99` and
  diffed byte-identical, 8 = 8, not assumed from "the files aren't mine". One is a real
  `Exclude<ToolGroupId,'core'>`/zod mismatch at `disclosure.ts:381`; the rest are three test files.
  **Nothing watches this. It wants a task.**
- 🔴 **The MCP suite's budget line is the only place the margin is visible**, and it prints on a
  passing run: `[surface] 8223 tokens / 20 resident tools — 57 under the 8280 budget`. ✅ **A tool
  added to an existing DEFERRED group costs ZERO** — measured again this session, 8,223 either side.
- 🔴 **`provision.test.ts` and `projectOwnsBackend.test.ts` flake.** They failed once in an
  intermediate run this session and passed in isolation **and** in the runs either side. Real backend
  processes and ports. **Do not report them as a regression without an isolation re-run.**
- 🔴 **A jest run of `tests/` is NOT what a client runs.** The suite uses an in-process
  `InMemoryTransport`; the shipped artifact is `dist/noodl-mcp.cjs` spawned over stdio. s56's drive
  is a throwaway JSON-RPC client and it is the only thing that read the real `initialize`
  instructions. ⚠️ **`dist/` was REBUILT this session** — announced, per standing practice.

### ⚠️ A peer is live and holds the checkout

The peer committed twice while s56 worked (`7ea15c49` CN-006b, `3cee0a99` its handover) and is on
**phase 69**. Its editor was up at s56's start. At s56's finish the tree holds only long-standing
items — **none of them s56's, and none of them the peer's active work**:

```
 M dev-docs/tasks/phase-50-legibility/notes/leg-001-lane-notes.md
 M dev-docs/tasks/phase-68-learnbook/README.md
 M scripts/library/check.ts          ?? dev-docs/tasks/phase-65-the-library/
```

✅ **s56 committed 13 pathspecs and verified afterwards that nothing of anyone else's was swept** —
including a peer probe file (`packages/noodl-runtime/test/zz-cn015-probe.test.js`) that existed
mid-session. **Do the same.**

⚠️ **The bundled-editor-build gap is now six sessions old.**

---

## 3. What s56 did — FIX-008 D (`5754a168`)

**`open_project(directory)` binds the live server to a project already on disk**, and the reading and
authoring tools arrive in the same conversation. Driven end to end: bootstrap → `list_projects` →
`open_project` → **24 tools advertised** → `get_project_info` naming the bound directory → **27
components** read out of a real project.

Three decisions the fix direction did not specify:

1. 🔴 **`completeBind` is shared by both doors; the refusals are not.** What must not drift between
   `create_project` and `open_project` is the **side effects** — catalog overlay, disclosure flip,
   and the briefing `initialize` already spent. **None of those failures looks like a bind bug**
   (a kit's node types missing, `find_tools` still advertising the bootstrap copy, an agent authoring
   without the Router paragraph). The refusals genuinely differ and stay separate.
2. 🔴 **The same-directory case is answered as the success it is.** `bind()` returns `false` for
   "already bound" without regard to *what* it is bound to — so re-opening the project the server
   already serves would have read as a refusal, and the recovery from a refusal is a *different*
   project.
3. ⚠️ **No `.mcp.json`, no `CLAUDE.md`.** Fix B backfills those when the **editor** opens a project,
   where a human chose it in a UI. A model passing a path to a tool is different consent.

✅ **The already-bound-elsewhere note emits a runnable `claude mcp add --scope project` line, derived
from THIS process's own launch** (`process.execPath` + `argv[1]`) — a configuration that is
demonstrably working, because it is the one serving the call. `authoringServerName` and `quoteArg`
are **imported** from the editor's `mcpCommands.ts` (which has zero imports of its own), not mirrored.

🔴 **Two renegotiations, both stated in the source rather than slipped in:** BST-001's "exactly four
bootstrap tools" is now **five** (six advertised), and BST-006's briefing fences moved in both specs
that pinned them — the rule *"the paragraph must always match the build"* is symmetric, which is why
the assertions flipped rather than being deleted.

---

## 4. What to do next and why

**Ordered by value, not cost.** ⚠️ **Items needing API calls are blocked on credit** — see §5.

1. 🔴 **DRIVE FIX-013's AC1 and AC2.** Unchanged from s56's brief, and blocked there by a live peer
   editor — **check first whether the checkout is free** (`ps -Ao pid,ppid,lstart,command | grep
   'Electron . --dev'`; a live editor's ancestry runs back to `scripts/start.ts`).
   ✅ **The fixture is built and waiting**: `~/vscode_projects/NodeGX test projects/fix013-drive`, a
   copy of `fix012-drive` whose `/Probe` carries a **`pBackwards` port plugged `"input"`**.
   ⚠️ **Drive a COPY of it.**
   - **AC1**: bench a component — frame, inputs rail, outputs rail, scenario bar, one-line summary.
     **No Sign out, no Data, no Sample data / Real backend, no Apply banner.** vs `workbench-1.png`.
   - **AC2**: bench `/Probe` and read the backwards-ports sentence **in full, wrapped, unclipped**.
     🔴 **This is the assertion s55's whole placement argument turns on.**
   - ⚠️ **`ComponentBench` has history**: a `useTrackBounds` ref on a conditionally-rendered element
     once took the whole preview surface's React tree down, and **no spec could catch it**. s55's
     `.Summary` is conditionally rendered but holds **no ref** — the drive is what confirms it.
2. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.
   ⚠️ **FIX-006's weighting and FIX-022's reuse axis both belong in it.**
3. ⚠️ **A bundled/packaged editor build**, in passing — §2. Six sessions old.
4. 🆕 ⚠️ **A root `typecheck:mcp`**, and the 8 errors behind it — §2. Small, and it closes a gate hole
   rather than a bug.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list, behind
  `parser.getPorts()`. **Wants a task; needs a syntax-tree parse of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.** ⚠️ **FIX-008's own measurement fell over this** — one typeless
  node costs the MCP server a project's entire validate-and-write surface.
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.

### How to start here

🔴 **Census before you build — and grep the file you are about to add to.** s56 appended a re-export
to `editor-deps.ts` that **was already there at HEAD**, with the same reasoning already written out,
and found out from `tsc`. One grep would have saved it.

🔴 **A check that cannot fail passes exactly like one that cannot break, and a DRIVE is not exempt.**
s56's drive carried `expect(e === null || true)` on its most important branch. ✅ **Print the payload
next to the claim** — that mismatch is what exposed it.

🔴 **Ask whether the branch you are testing is REACHABLE on the server you are testing it on.** The
format refusal is impossible on a bound server, because `bind()` never looks at its argument once it
has a store. A green check there was measuring nothing.

🔴 **A spec that reads real machine state has a branch that never runs on CI.** `list_projects` reads
the launcher's store; on a machine that has never run NodeGX the empty branch is taken and the
interesting assertion is skipped. **This machine has 50 recorded projects** (measured), so it went
green here and would have proved nothing anywhere else. ✅ **Export the pure function and assert it
directly.**

🔴 **A mutation harness must restore in a `finally`.** s56's crashed on its own output parser and left
a mutant on disk.

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **`${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.**

---

## 5. Rulings — what a builder must not get wrong

- 🆕 ✅ **FIX-008 D — BUILT + DRIVEN s56.** 🔴 **`completeBind` must stay the single successful-bind
  path**; two spellings give a server bound by one door and three-quarters bound by the other.
  🔴 **`ProjectBinding`'s bind-once boundary must hold** — `open_project` binds a server with no
  project and must never move one that has; the `use_project` contract stays refused.
  🔴 **`list_projects`' note must keep branching on `isBound`** — naming `open_project` on a bound
  server teaches a model the tool does not work, and its fallback is `create_project`.
  🔴 **The same-directory case must keep its own answer.**
- ✅ **FIX-013 ruling 1 → (c), BUILT END-TO-END.** 🔴 **`useSampleData` is not the switch.**
  🔴 **`emptyState` must keep shipping the class list NAMED.** 🔴 **`synthesizeMissing` must keep
  defaulting to `true`** and **must keep being sent `false` by the bench**. 🔴 **`list()` must keep
  caching the empty array.** 🔴 **The bench summary must keep WRAPPING.**
- ✅ **FIX-013 ruling 2 → the two surfaces DIVERGE (s55).** 🔴 **The AI preview keeps its toolbar and
  data editor.** BEN-004 §7 is knowingly retired for the bench.
- ✅ **FIX-013 rulings 3 + 4 → the non-destructive branch (s55).** 🔴 **`signedIn` and `useSampleData`
  stay programmatic options with no UI.** ⚠️ **Richard's answers are still owed.**
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
  ⚠️ **AC1 as originally written is still FALSE as built.** **Retired or still owed? s50–s56 did not
  decide.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` 2nd in `ALL_RULES`; `duplicateNodeId` leads.**
- ✅ **FIX-008 C — 🔴 Observe stays `user` on purpose.** 🔴 **`--scope project` resolves against the
  shell's cwd** and there is no CLI flag for a target directory — the `scopeNote` names the folder.
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly.
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN.** 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-024 — CLOSED s51.** 🔴 **`'learn'` and `'learning'` are two different pages.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel".**

### Still owed by Richard

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** **Every measurement harness in this phase is
  blocked.** ⚠️ **s54, s55 and s56 all needed none of it**, and neither does item 1.
- 🔴 **THE REPACKAGE — still the item with a live user impact.** `nodegx-puppy-test-3` resolves to
  `/Applications/NodeGX.app/…`, the **Aug-13** bundle. 🆕 **FIX-008 D makes this sharper, not
  softer**: `open_project` exists in the checkout bundle and in no packaged app.
- ✅ 🆕 **`packages/noodl-mcp/dist/` was REBUILT by s56** and now carries A–E including `open_project`.
  ⚠️ It is gitignored, and it is what *checkout-registered* servers load.
- 🔴 **FIX-013 rulings 3 and 4 — confirm or overturn.** Nothing is foreclosed either way.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?**
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want?**
- 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6** · 🔴 **FIX-016 AC1 — retired or still owed?**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work. Still uncommitted at s56 — twenty-four sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-four
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`,
  **`fix013-drive`** (item 1 needs it). ⚠️ **`fix016-s50-drive` is a scratch copy, deletable.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results* — s56 lost one call to it and caught it immediately; write every
path absolute and the question does not arise.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s56 hit exactly that: two new files made the first commit
fail on `did not match any file(s) known to git`, and the chained `add && commit` is the fix.**

🔴 **This checkout is SHARED and the peer commits mid-session.** HEAD moved under s56 twice. ✅ **A
peer commit does not sweep unstaged work** — verified — **but stage nothing and the question cannot
arise.** ⚠️ **`hot: true`**: an edit to `packages/noodl-editor/src` hot-reloads a peer's live editor
mid-drive. ✅ **s56 changed no editor source at all**, which is the cheapest way to be safe.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure. 🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — attribute
by PPID and cmdline.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **Take your own reading before adding a line.** ✅ **A new fact belonging to a section that already
has a 📚 pointer goes in the POINTER FILE, which costs zero index budget.**

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s56 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared twelve sessions running. ✅ **s56 also ran `git diff --stat HEAD` on this file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
