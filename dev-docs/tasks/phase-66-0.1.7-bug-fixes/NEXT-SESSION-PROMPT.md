# Phase 66 — next session

**Written 2026-08-17, session 56's brief, by session 55.** A rewrite, per §0. s55 took **item 1 —
FIX-013's UI slice — and it is BUILT, GATED and NOT DRIVEN** (`346114a6`). One task, one commit.

✅ **s55's headline: the bench is empty and the toolbar is gone, in one commit as required.**
`buildBenchExport` passes `emptyState: true`; `SandboxToolbar` and `SandboxDataEditor` lose their
bench mounts along with the four pieces of state they owned. **AC3 is now structural rather than
asserted**: `useSandboxViewer` is the only writer of `noodl-sandbox-data`, the runtime disables the
shim for the literal string `real` alone, and the bench now calls it with a hard-coded `true`.

🔴 **The summary did NOT go where the Fix direction said, and that was the judgement call of the
session.** The doc said *"the chrome strip beside `BenchCaption`"*. **That placement satisfies the
letter of the task and defeats AC2**: `describe()` appends the backwards-ports sentence **last**, and
`BenchCaption` is a single `white-space: nowrap` line whose own CSS comment names it **the shrink
zone** because **BEN-004 measured the strip clipping at 640px**. A sentence appended last, dropped
into the element designated to truncate first, is hidden rather than relocated. ✅ **It lives in the
bench instead, full-width, wrapping, no height cap** — which is **strictly better than the toolbar it
replaced**, a 30px `nowrap` row with an ellipsis that was **already clipping the diagnostic**. AC2 is
met there for the first time, not preserved.

🔴 **A spec failure was the session's real finding.** `ShareItem` reads **no collections** — the same
shape as the bug report's `CategoryCard` — so the class map is **empty**, which makes s54's
`synthesizeMissing: false` **the only thing doing any work on that component**. ⚠️ **And the passing
half of the same spec could not fail**: a loop over `Object.values(classes)` asserting
`records.length === 0` **iterated zero times**. Both were rewritten.

⚠️ **A peer holds the checkout and its editor is LIVE** — see §2. **This is why AC1/AC2 are
undriven**, and it is the whole of the open work on this task.

🔴 **Every ruling and every measurement is in its own task file.** §4 here is a work order, not the
source of truth. FIX-013's full write-up — the placement argument, ruling 2 answered, and the empty
fixture finding — is at the foot of its own file.

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
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — see s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + the reuse cell | ✅ | ✅ | **No open build** (s53). ⚠️ The §7 ruling is the only thing owed |
| **FIX-013** — the empty-state sandbox | ✅ **data layer + UI** | 🔴 **NO** | 🆕 **`346114a6`** on s54's `8216037d`. **Gated, undriven.** AC1/AC2 are item 1 |
| **FIX-008** A, B, C, E | ✅ | ✅ C driven s48 | **D unstarted** — item 3 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Seventeen closed outright.** ⚠️ **Count the names, don't copy a total** — this number has moved
twice in one session before.

🔴 **FIX-013 is now the phase's only built-but-undriven task.** It is no longer *uncalled* — s54's
capability is switched on — it is **unwatched**. That is a different and smaller gap.

---

## 2. Gate readings

✅ **s55 took the five marked.** This session changed **editor `src`** (2 files + 1 stylesheet) and
**`tests/ai/`**, so `test:ci` was required and was taken **twice** — the first run caught a real
defect in a new spec.

| Gate | Reading | When |
|---|---|---|
| **root `npm run typecheck`** (the PR gate) | ✅ exit **0**, zero `error TS` | ✅ **s55** |
| **`test:ci` (jasmine)** | ✅ **2849 specs / 6 failures** @ 39393 — **the floor, the same six by name** | ✅ **s55**, bundle **23:41:30** |
| **`test:ci` — first run** | ⚠️ **2849 / 7** — the 7th was s55's own new spec. Fixed, re-run above | ✅ **s55** |
| **`npm run typecheck:editor-tests`** | ✅ exit **0**, zero `error TS` — **the gate that covers `tests/`** | ✅ **s55** |
| **`lint:ci` ratchet** | ✅ exit **0**, **877** against a 3916 baseline — **unmoved by the deletion** | ✅ **s55** |
| `noodl-runtime` jest (full) | ✅ 137 suites / 2515 | s54 — inherited |
| `noodl-editor` `test:main` | ⚠️ 234 suites / 3601, 2 failed — both pass in isolation | s54 — inherited |
| `noodl-mcp` jest | ✅ 52 suites / 613 | s52 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s51 — inherited |
| `noodl-viewer-react` jest | ✅ 71 suites / 910 | s51 — inherited |
| `cloud-runtime` jest | ✅ 7 suites / 172 | s51 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ✅ **Every exit code was read from a file after
`echo $?`, never through a pipe.**

✅ **`lint:ci` re-measured, not inherited.** s55 changed three files in the ratchet's exact scope
(`packages/noodl-editor/src`, per `.eslint-baseline.json`), so an inherited number would have been
worthless. **877, identical to s54's** — the deletion removed imports without moving it. ⚠️ **It is a
ROOT script**; running it from `packages/noodl-editor` is the call s54 lost.

### 🔴 Three readings that will mislead you if you carry them forward

- 🔴 **`tests/ai/` is EXECUTED by `test:ci` alone.** `test:main`'s jest `testMatch` is
  `tests-main/**` + `tests-unit/**` only — running `jest tests/ai/component-bench.test.ts` reports
  **"No tests found"**, which is not a pass. The only thing that *runs* a spec there is a
  ~13-minute `test:ci`.
- ✅ **But it IS typechecked — by a script the root gate does not call.**
  `packages/noodl-editor/tsconfig.json`'s `include` covers `src/` only, so **`npm run typecheck`
  says nothing about `tests/`**. 🔴 **`npm run typecheck:editor-tests`
  (`tsconfig.tests.json`) is the one that does** — s55 took it, exit 0. ⚠️ **s55 nearly wrote this
  down as "tests are not typechecked at all"**; the script list in the ROOT `package.json` is the
  thing to read before claiming a gate does not exist. There are **nine** `typecheck:*` scripts and
  the bare `typecheck` is not their union.
- 🔴 **`test:ci` exits 1 on a clean floor run.** The **count** is the readout, never the exit code.
- 🔴 **A jasmine spec that loops over an empty collection PASSES.** s55 shipped one for ten minutes:
  `for (const k of Object.values(classes)) expect(k.records.length).toBe(0)` where `classes` is `{}`.
  ✅ **Assert the collection's size first, then loop** — or the loop is decoration.

### 🔴 A peer is live, holds the checkout, and its editor is UP

Thirteen uncommitted paths at s55's finish, **none of them s55's**:

```
 M packages/noodl-editor/src/editor/src/models/nodelibrary/BasicNodeType.ts        ← SOURCE
 M packages/noodl-editor/src/editor/src/models/nodelibrary/NodeLibraryData.ts      ← SOURCE
 M packages/noodl-editor/src/shared/utils/projectmodules.ts                        ← SOURCE
 M packages/noodl-editor/src/editor/src/styles/propertyeditor/propertyeditor.css   ← SOURCE
 M …/panels/SettingsPanel/sections/KitsSection.tsx                                 ← SOURCE
 M …/panels/propertyeditor/components/NodeLabel/NodeLabel.tsx                      ← SOURCE
?? …/panels/propertyeditor/provenance.ts        ?? tests-unit/cn-006b/
?? dev-docs/tasks/phase-69-…/notes/cn-006b-drive.md
 M dev-docs/…/phase-50-…/leg-001-lane-notes.md   M dev-docs/…/phase-68-…/README.md
 M scripts/library/check.ts                      ?? dev-docs/tasks/phase-65-the-library/
```

✅ **s55's `test:ci` is clean of every one of them, and that is measured across the WHOLE list rather
than a sample**: the test bundle was sealed **23:41:30**; the earliest peer edit is **23:42:39** and
all seven source paths are later. ⚠️ **A different peer committed `ac1e3c65` (CN-014) at 23:26:05,
13 seconds before s55's first run started** — so both runs are on a tree that *includes* that commit.

⚠️ **s55 committed 5 pathspecs and verified afterwards that all thirteen peer paths were still
uncommitted.** Do the same.

⚠️ **The bundled-editor-build gap is now five sessions old.** Nobody has run a **packaged** build
since s51's `BenchRunner.ts` import landed.

---

## 3. What s55 did — FIX-013's UI slice (`346114a6`)

**The flip, the deletion and the summary's new home, in one commit** — because flipping the bench
without removing the toolbar would have made the reported defect *universal* (§3 of s54's handover).

- **`emptyState: true` is hard-coded in `buildBenchExport`**, not offered. 🔴 **A bench that can be
  switched back needs a control to switch it with, and the control is the reported defect.**
- **Four pieces of state deleted** from `ComponentBench` — `useSampleData`, `signedIn`, `userData`,
  `dataOpen` — with three arguments and three effect dependencies.
- **`.Summary`**, a control-free strip in the slot the toolbar vacated. **Not a second toolbar**:
  nothing in it is clickable, so BEN-004 §7 is not engaged.

### ✅ Ruling 2, answered as the two surfaces DIVERGE — and recorded, as the ruling demanded

`SandboxToolbar`, `SandboxDataEditor` and `sandboxDataDraft` **all keep their owner in
`SandboxPreview.tsx`**. Nothing is orphaned; **nothing left disk**. The AI preview keeps its toolbar,
its data editor and its sample rows. 🔴 **BEN-004 §7's "do not build a second toolbar" is knowingly
retired for the bench.** Ruling 2's remaining payoff — deleting those three files — is **not taken**
and stays available if the AI preview is ever swept.

### ✅ Rulings 3 and 4 taken on their non-destructive branch

`signedIn` and `useSampleData` survive as **programmatic options with no UI**.
`component-bench.test.ts`'s Real-backend assertions needed **no edit at all**, exactly as s54
predicted. 🔴 **Richard's answers are still owed** — the build simply did not have to wait.

---

## 4. What to do next and why

**Ordered by value, not cost.** ⚠️ **Items needing API calls are blocked on credit** — see §5.

1. 🔴 **DRIVE FIX-013's AC1 and AC2.** The only open work on the task. ✅ **The fixture is already
   built and waiting**: `~/vscode_projects/NodeGX test projects/fix013-drive`, a copy of
   `fix012-drive` whose `/Probe` carries a **`pBackwards` port plugged `"input"`** — the backwards
   declaration AC2 needs. ⚠️ **Drive a COPY of it**, per standing practice.
   - **AC1**: bench a component — frame, inputs rail, outputs rail, scenario bar, one-line summary.
     **No Sign out, no Data, no Sample data / Real backend, no Apply banner.** Screenshot vs
     `workbench-1.png`.
   - **AC2**: bench `/Probe` and read the backwards-ports sentence **in full, wrapped, unclipped**.
     🔴 **This is the assertion the whole placement argument turns on — if it is ellipsised, the
     placement is wrong and §3's reasoning is wrong with it.**
   - ⚠️ **`ComponentBench` has a history here**: a `useTrackBounds` ref on a conditionally-rendered
     element once took the entire preview surface's React tree down, and **no spec could catch it**.
     s55's `.Summary` is conditionally rendered but holds **no ref** — the drive is what confirms it.
2. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.
   ⚠️ **FIX-006's weighting and FIX-022's reuse axis both belong in it** — do not build A/B in a way
   that cannot express them.
3. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.
4. ⚠️ **A bundled/packaged editor build**, in passing — §2.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list, behind
  `parser.getPorts()`, i.e. **running the author's code**. **Wants a task; needs a syntax-tree parse
  of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled
  `react-app`. **Pre-existing and unowned.**

### How to start here

🔴 **Census before you build, and read the GUARD before you write one.** ✅ **s55's whole finding came
from a spec that FAILED**: the fixture reads no collections, which is the reported shape, and the
assertion that seemed obviously true was the one worth writing.

🔴 **A spec that cannot fail passes exactly like one that cannot break.** Assert the size of a
collection before looping over it.

🔴 **A doc's Fix direction can be overtaken by the code it points at.** s33 chose the chrome strip;
the strip has since gained two controls and a chip, and its own CSS says it clips at 640px. ✅ **Read
the destination before relocating something into it.**

🔴 **Check which gate covers the file you changed.** `tests/` is in neither `test:main` nor
`typecheck` — a spec edit there is only ever measured by `test:ci`.

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **and
`${PIPESTATUS[0]}` is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.**

⚠️ **A foreground `sleep` is refused by the harness.** Poll with a backgrounded `until` loop.
⚠️ **`test:ci` exceeds the 600s foreground timeout** and is moved to the background; that is normal.

---

## 5. Rulings — what a builder must not get wrong

- ✅ **FIX-013 ruling 1 → (c), BUILT END-TO-END (s54 data layer, s55 UI).** 🔴 **`useSampleData` is not
  the switch and never was** — it uninstalls the shim and reaches the real backend. 🔴 **`emptyState`
  must keep shipping the class list NAMED**; an empty `classes` map is the one shape that defeats the
  mode. 🔴 **`synthesizeMissing` must keep defaulting to `true`** — the AI preview and every existing
  export depend on it — **and must keep being sent `false` by the bench**, which on a
  no-collections component is the *only* thing preventing five invented rows. 🔴 **`list()` must keep
  caching the empty array**, or writes stop working. 🔴 **The bench summary must keep WRAPPING** —
  the diagnostic is appended last and a `nowrap` home hides it.
- ✅ **FIX-013 ruling 2 → the two surfaces DIVERGE (s55).** 🔴 **The AI preview keeps its toolbar and
  data editor; do not "tidy" the divergence away.** BEN-004 §7 is knowingly retired for the bench.
- ✅ **FIX-013 rulings 3 + 4 → the non-destructive branch (s55).** 🔴 **`signedIn` and `useSampleData`
  must stay programmatic options with no UI.** ⚠️ **Richard's answers are still owed** and could still
  delete them; nothing was foreclosed.
- ✅ **FIX-022 — the reuse cell BUILT + MEASURED s53.** 🔴 **`minPlacementSites` must stay OFF for
  `trivial`, `small-logic` and `multi-section`.** 🔴 **The placement metric must keep BOTH evidence
  paths.** 🔴 **The cell is a REGRESSION detector, not evidence of improvement.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE** (s42).
- ✅ **FIX-006 — the Substring weighting BUILT + MEASURED s52.** 🔴 **The rule is not "prefer nodes",
  and `NODES_BEFORE_CODE` must keep BOTH halves.** 🔴 **Keep it a separate export from
  `THREE_WAYS_TO_COMPUTE`.**
- ✅ **FIX-006 AC4 — the id is in the prompt and now graded.** 🔴 **`Javascript2` must keep leading the
  Script paragraph**; `traps.ts:61-63` states the rule.
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` must stay LAST in all four parameter
  lists.** 🔴 **Do not "tidy" the four spellings into one shared constant.** 🔴 **`createBlockConsole`
  must keep returning `console` ITSELF when there is no sink.**
- ✅ **FIX-016 — the mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` must stay `true` for
  `'script'`.** ⚠️ **AC1 as originally written is still FALSE as built** (driven s26). **Someone
  should decide whether AC1 is retired or still owed; s50–s55 did not.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` is 2nd in `ALL_RULES` on purpose;
  `duplicateNodeId` must keep leading.**
- ✅ **FIX-008 C — BUILT s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly.
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE.**
  🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-024 — CLOSED by a peer s51.** 🔴 **`'learn'` and `'learning'` are two different pages.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** **Every measurement harness in this phase is
  blocked** — FIX-006's, FIX-022's, and any A/B a future ruling needs. **`.env`, the account behind
  `ANTHROPIC_API_KEY`.** ⚠️ **s54 and s55 both needed none of it**, and neither does item 1.
- 🔴 **THE REPACKAGE — still the item with a live user impact.** `nodegx-puppy-test-3` resolves to
  `/Applications/NodeGX.app/…`, the **Aug-13** bundle. **The fix is committed and driven; he cannot
  see it.**
- ⚠️ **`packages/noodl-mcp/dist/` is still pre-fix** — gitignored, and what *checkout-registered*
  servers load. 🔴 **A session that rebuilds it should announce that it did.**
- 🔴 **FIX-013 rulings 3 and 4 — confirm or overturn.** s55 took the branch that deletes nothing, so
  both are still genuinely open and nothing is foreclosed either way.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?** Single-use
  factoring runs at **5/10 and 6/10** where reuse is impossible and **0/17** where it is available.
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want for the reported request?**
- 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6** · 🔴 **FIX-016 AC1 — retired or still owed?**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** **Still uncommitted at s55 — twenty-three sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-three
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`,
  🆕 **`fix013-drive`** (item 1 needs it). ⚠️ **`fix016-s50-drive` is a scratch copy, deletable.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls**; s49
through s54 each lost at least one call to it. ✅ **s55 lost none** — every call that changed
directory did so in its own subshell or was written from the root.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s55 committed once, 5 files, and verified with
`git status --short` afterwards that all thirteen peer paths were still there.**

🔴 **This checkout is BUSY — a peer is editing editor source AND running an editor.** §2 lists its
files. ✅ **Every CDP reader should return an explicit `{alive:…}`** — a dead instrument and a genuine
absence are the same string.

### 🔴 Peer etiquette

🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — **attribute by PPID and
cmdline**; a live editor is `Electron . --dev` whose ancestry runs back to `scripts/start.ts`.
🔴 **Announce teardown to the FULL launch list.** 🔴 **Reply to a socket on its socket.**
🔴 **A peer's teardown is not permission to run a suite — read the TREE.** ⚠️ **And read it TWICE.**
⚠️ **`hot: true`**: the editor renderer is `webpack-dev-server` with HMR, so **an edit to
`packages/noodl-editor/src` hot-reloads a peer's live editor mid-drive.** s55 batched its edits into
one pass for exactly this reason.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — the watchdog runs the same
sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ⚠️ **Compare pids,
never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **Take your own reading before adding a line; the headroom moves both ways and neither direction
is yours.** ✅ **The move whenever a new fact belongs to a section that already has a 📚 pointer: put
it in the POINTER FILE, which costs zero index budget.**

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46 through s55 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared eleven sessions running. ✅ **s55 also ran `git diff --stat HEAD` on the file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
