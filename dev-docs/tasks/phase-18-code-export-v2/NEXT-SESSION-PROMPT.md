# Next session — Tier 2.7 is finished, and Tier 2's remainder is two design questions

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Built, gated, **not yet consumed by the product** (§21.1, and row 8 below) |
| EXP-002 deterministic generators | 🟡 in progress, re-aimed at the picker |
| EXP-003 AI logic translation | not started |
| EXP-004 report & honesty UX | 🟡 built and driven; **three lines need Richard, not a session** |
| EXP-005 / 006 / 007 | not started (006/007 blocked on 002 having a generator to inject into) |
| EXP-008 coverage ledger + gate | ✅ Built |
| EXP-009 backend connection | 🟢 built + driven; AC4 waits on a Cloud Services node |
| EXP-010 custom nodes & modules | 🟢 Route B built + driven; Route A not owed |
| **EXP-011 picker coverage** | 🟡 **Tier 1 COMPLETE, Tier 2.7 COMPLETE — 75/127 (59.1%)** |

**Tier 2's open remainder is now two items, and both have a design question in front of them:**
**Cloud Services (9)** and the **component stack pair** (§15.6 says that pair is a routing
question). There is no longer a Tier 2 node with a clear run at it.

## 🆕 Handed in from phase 80 on 2026-08-31 — DEF-033 is now P18's to build

**Richard ruled it, in P80's lane, and P80 does not build it.** *"Yeah just make it show the
truth, that seems like a no brainer."*

`Substring`'s `End` port **declares** `default: 0` while `initialize` writes `-1` — the panel shows
a number the node is not holding, and they are opposite answers, not a near-miss (`-1` returns the
rest of the string, `0` returns `''` for every input). This is **P18's own finding**, registered
from [§36.2](EXP-011-PICKER-COVERAGE.md) with owner `NONE`; the owner is now **P18**.

**The build:** align the declared default to `-1` at
[`substring.ts:52`](../../../packages/noodl-runtime/src/nodes/std-library/substring.ts#L52).
**Node behaviour is unchanged**, the export already agrees with the node, and **no target-output
row or emitted artefact moves.**

⚠️ **Two things §36.2 now records that are easy to miss:**

- The port's `description` currently explains the very mismatch being removed (*"setting it to 0
  yields nothing"*). **Rewrite it in the same commit** or the panel contradicts itself.
- 🔴 **`result` must NOT change.** A test that watches `result` passes identically before and after
  — it cannot grade this fix. Grade the **declared default and the panel**.

---

## What session 66 did

Built **EXP-011 §37 — the id pair**, `Unique Id` and `net.noodl.UUID`, finishing Tier 2.7.
**§37** has the long form.

- ✅ **Picker 73 → 75 of 127 (59.1%)**, floor raised in the same commit.
- ✅ New emitted module `src/lib/id.ts`, transcribed from `model.ts` and `crypto/{encoding,uuid}.ts`.
- ✅ **AC3's project is `tests/fixtures/badge-desk`** — routed, built, driven, and picked up
  automatically by the suites that enumerate `tests/fixtures`.
- ✅ **`relation-verbs.test.ts`'s untranslated-feeder example was repointed** at
  `net.noodl.ToCSV`; it was a `Unique Id`, and it had already lost `PageInputs` to Tier 2.5.

## 🔴 Read this before planning anything

1. 🔴 **Two nodes that look like one, and the picker number cannot tell.** `Unique Id` is ten
   characters of `Math.random()`; `UUID` is a v4 from the platform CSPRNG. Translating both to one
   generator raises the picker by two and is wrong about half of it, and **every shape check
   anyone would think to write passes either way**. The instruments that can see it are an *exact*
   differential — pin the entropy source, then compare character for character against the
   interpreter's own code — and a sabotage arm.
2. 🔴 **A neighbouring node's rule can be the exact opposite rule.** §24 established that
   `External Link`'s `Error` is read as the **stale row** in the Done arm, because the runtime
   never clears it. `UUID`'s `_generate` **does** clear it, so the same code here would print a
   message the app had just erased. The two nodes are one file apart. ✅ **Read the writer, not
   the sibling.**
3. ⚠️ **A line no driven app can grade is not a line that passed.** Sabotaging the success arm's
   `setRecordIdError(undefined)` changed **nothing** in the browser — the failure cannot fire
   where there is a CSPRNG. It is recorded as ungradeable-by-drive and a test grades it. Predict
   which arms your drive can see *before* you run them.
4. 🔴 **§36.5's question, answered from the other side.** Pass 4f's clause kills 6 rows; adding
   these nodes to Pass 4c's whitelist **as well** kills 0 — both passes bind the same row read, so
   two sites leave one branch dead. ✅ The rule that survives both sessions: **a node needing a
   state row goes in Pass 4f, a pure expression goes in Pass 4c, and never both.**
5. ⚠️ **A claim was written and measured false, and the correction is kept.** The eager
   `useState(randomId())` does **not** show a changing id — React discards the argument after
   mount. The lazy form is right as the faithful transcription of `initialize`; the cost of the
   eager one is a generator call per render, not a visible bug.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1248/1248, 49 suites, 49 files on disk
npm run export-ledger:picker                  # from the repo root — 75/127 (59.1%), floor 75
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle — **and it is 60 projects, not
101** (`parseProject` reads `nodegx.project.json` only; 40 are classic, 1 neither).
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why.
⚠️ `build-corpus.ts` reads **59/60**, and the red is **pre-existing**: `Members area (TPL-001)`,
`MemberRow.tsx(16,15)`, `TS7053` on `LABELS[standing]` inside a **preserved Function body**.
**Do not read it as a regression, and do not re-derive that.** Owner `NONE`.
⚠️ It takes **~4 minutes** and exceeds the 120s tool timeout — background it.

## Do this next — in the order they are worth doing

### 1. 🔴 The row-owned write, with the question §34 sharpened *(carried, unstarted — now the top row on merit, not just by default)*

Not *"can a row write to itself"*. The measured question: **does the write need an id at all?**
`Collection.updateWhere(match, update)` matches **by predicate**, and §29/§30 established the
emitted row closes over its own `item` — so "the record this row is bound to" has a referent on
this side that is not a string id. §5.3 refuses because a row has no *id*; the shape may never
have needed one.

⚠️ Derive before building: `updateWhere` **replaces** the row object, so `item` goes stale for
anything later in the same handler (a write then a removal removes nothing). Owner **`NONE`** — a
design question. **1 independent graph exportable, 6 corpus-wide, 14 nodes, and 100% of every
`Set Object Properties` anybody has authored.**

### 2. 🟢 `Unique Id`'s `Completed` — a small, fully-scoped increment *(new, from §37.4)*

The node has **one** outcome, and its own catalog description says so: *"it always fires together
with Done, and wiring either one does the same thing."* So `completed` could compile as `done` for
free. **The one thing to settle is the case where both ports are wired** — two chains whose
relative order this file would be choosing rather than reading. Today it defers with a reason that
names the one-move fix. Decide, or leave the deferral; either is defensible, and the deferral is
already honest. `UUID`'s `Completed` stays deferred on §8.4's sentence.

### 3. ⚠️ The 36 the sweep could not reach — and it is a `report.ts` change

Nodes beside the **router shell**. The App component has `file === null`, so `renderReport`'s
`attention` filter drops all of its notes and no `plan.ts` push can surface them. `withPreserved`
(§27.6) already rescues the script-bearing ones; a plain `Group` beside the Router is mentioned
nowhere in the export. Decide whether the report grows a section for scaffolded components'
dropped nodes, or whether being outside `src/App.tsx` is adequately implied. Owner **`NONE`**, §35.6.

### 4. Children authored inside a component instance — unowned, instrument broken first

**19 instances in 8 projects, 217 nodes in those subtrees.** `walk` descends into them, but
`renderInstance` emits `<Shell … />` self-closing, so anything below is unreachable and any marker
is orphaned. ⚠️ **`instkids.ts`'s 96/217 split separates nothing** — `src.includes(id)` counts
*rendered* and *named in a marker* alike. Split those before drawing any conclusion. Owner **`NONE`**.

### 5. The fixture that exercises the branch real projects take first

One arm: give a fixture's `For Each` a `dynamicports` entry so `resolveSourcePortKind` answers from
the file rather than falling through. **Zero** fixtures do; **48 of 62** real projects with a
repeater do. Cheap, and it puts the real path under the corpus audit permanently. *(Carried from
s62/s63 unstarted.)*

### 6. §31.1's limit #2 — the target-port side

Still examined by nothing. Limit #1 closed in §33.3. Cheap to scope, unknown to close.

### 7. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact: the **README comprehension test**
(`tests/fixtures/puppy-test-3` exports the richest example), the **external review of the
verification wording**, and **whether the preserved source block actually helps**.

### 8. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export
is `ts-node scripts/emit-app.ts` by hand. Owned by **`NONE`**, §21.1 has the evidence.
**Ask before building it.**

### 9. Smaller, and each decidable on its own

- The fixtures nothing reaches (§26.1): a `PageInputs` node, a braced `urlPath`, an `External
  Link`, a `Navigate To Path`, an untyped store key, a wire into a port that already carries an
  authored value, a refused script on a node that is not a Function.
- `plan.ts`'s `For Each → Component Outputs` **value**-port branch — **left alone deliberately**
  (0 exportable wires, 0 fixture wires, §33.4). Split it only if a real project lands there.
- `Navigate To Path`'s `Completed` chain (§24.6) — **decide before starting; not obviously worth it.**
- The date family's signals and the repeater's lifecycle pulses — one `effect()` slice (§9.6, §29.5).
  ⚠️ §31's census found **zero** such wires anywhere.
- EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 66 would tell you if it could only say three things

1. **Read the writer, not the sibling.** Two nodes one file apart had opposite rules about the same
   port, and the wrong one was the natural thing to copy. The clearing line in `_generate` is four
   characters of difference and it inverts the whole `Error` design.
2. **Predict which sabotage arms your instrument can see, before you run them.** One of three arms
   was measured to move nothing — correctly — and the honest record is "the drive cannot grade
   this", not "the drive passed". Then a test grades it.
3. **Pin the entropy and compare exactly.** For anything random, the shape assertion is the
   assertion that cannot fail. Seed the source, run the emitted artefact beside the interpreter's
   own code, and require the same string — then break a copy on purpose to prove the comparison
   can go red.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it —
`git add` it and commit in the same command so the staging window stays closed. ✅ s64, s65 and s66
all did exactly this.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** — and
**reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`). 49 files, 49 suites at
the end of s66.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

🔴 **Check for a peer's suite before running yours** — `ps` for `jest`/`vitest`. s66's checkout was
clear throughout. ⚠️ **A peer committed P77's and `noodl-mcp`'s dirty files mid-session** — that is
normal, and pathspec commits meant nothing of theirs was swept.
⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` and `dev-docs/` was touched.

⚠️ **The shell's cwd is reset between calls and parallel `cd`s race** — use absolute paths in
anything you send in parallel. 🔴 **A glob stored in a shell variable does not expand in zsh**.
🔴 **`cmd | head; echo $?` reads `head`'s exit code** — redirect to a file and echo `$?` on its own.
⚠️ **`timeout` is not on this machine** (BSD), and **`uniq -w` is not either**.
⚠️ **`sleep N` chained before another command is blocked by the harness** — background the command
and poll, or use an until-loop.

## Instruments

s66 scratchpad `cae86ff3-…/scratchpad`:
- **`mut.py`** (build-and-drive arms A/B/C) and **`mutants.py`** (the eight test-level mutants),
  both anchor-asserting, both with `restore` restoring from `snap-src-post/`.
- **`runmut.sh`** — mutate → tsc → jest → report killed rows by name, for a list of arms.
  ⚠️ It checks `tsc` on every mutant, because **a mutant that breaks the typecheck reads as
  `Tests: 0 total`, not as a kill.**
- **`arm.sh`** — mutate → tsc → emit → build, for the drive arms.
- **`snap-src-pre/`** and **`snap-src-post/`** — `src` either side of this session.
- **`harness/`** and **`corpus-harness/`** — built export harnesses with `node_modules`.
- **`drive.mjs`**, **`EXPECTED.md`** (written before the app ran), `drive-normal.log`,
  `drive-A.log`, `drive-B.log`, `drive-C.log`, `corpus.log`, `jest-final.log`.

s65 `ff4cafc5-…` — `mut.py`, `snap-src-{pre,post}/`, `harness/`, `corpus.log`, `ticket-out/`.
s64 `a893227f-…` — **`reportreach.ts`**, `silentreason.ts`, `sweepfires.ts`, `oneid.ts`.
s63 `da3e8895-…` — **`silenthole.ts`**, **`instkids.ts`** (⚠️ its split separates nothing — §34.5).
s62 `898de7ef-…` — **five reusable from-disk sweeps**, plus 🔴 **`v2only/` and `classiconly/`**,
symlink farms splitting the corpus by format. **s64, s65 and s66 all used `v2only`.**
s61 `759e5e4b-…` — `probe.js`. s60 `3685c239-…` — `fallback_probe.py`.
s59 `1d23bd1f-…` — `drive.mjs`, `app/`, `EXPECTED.md`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4, §30.4, §31.3, §32.5, §35.5, §36.5 and §37.5:

1. `cp -a src <scratchpad>/snap-src/` first — and take a **second** snapshot *after* the fix,
   because the pre-fix one is not a mutant undo (§28's trap).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == n` that fails leaves the source untouched.
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** Check `tsc`
   on each mutant. ✅ s66's `runmut.sh` does it automatically.
4. Run **both** the new rows and the control rows. The finding is the *disagreement*.
5. ✅ **A survivor is a finding, not a failure.** s66 had two: one was a **real hole** (a clause
   nothing graded — a row was added and it now kills), the other was a **deliberate redundancy**
   proving the alternative site would have been dead code. They read identically in the log and
   mean opposite things.
6. Name the killed rows with `--verbose` — jest prints no per-test lines for a multi-suite run.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>`. 🔴 **It only accepts a v2 project** (`nodegx.project.json`).
- ✅ **For a corpus-wide question, call `parseProject` + `planProject`/`emitApp` in-process**
  rather than shelling `emit-app.ts` 60 times.
- 🔴 **The build is still the only instrument for the real third-party libraries.**
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — it takes
  the **app**, not `app.files` — use it on any row asserting emitted text, because **a `toContain`
  passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. ⚠️ The emit **does** overwrite `package.json`.
- 🔴 **Author a fixture project by copying an existing one**, and ⚠️ **watch the collateral** — a
  copy carries the source's `componentId`s, `name`, `path` and the router's page list, and every
  one of those has to be rewritten or two fixtures collide.
- ⚠️ **A test-built node needs its parent's `children` array, not just a `parent`.** A node with
  only a `parent` is not in the render tree, so the read lands in nothing and a `not.toContain`
  half of an assertion passes while testing nothing. (Cost s66 one red.)
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.**
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`.**
- ⚠️ **A React input needs the native value setter plus an `input` event.**
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element.
- ✅ **Assert a positional readout against a known row** — s66's drive reads all `<p>` in DOM order
  and throws unless row 0 is the headline, so a reordered page fails loudly instead of quietly
  reading the wrong element.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  and pick the case that *excludes*, not the one that merely fits.
- ⚠️ **An error row is never cleared** on `External Link`/`Navigate To Path` — a success row must
  run **before** any failure row. 🔴 **`UUID` is the opposite** and clears on success (§37.2).

## Driving the editor, if the next question needs it

- 🔴 **Check for a peer's suite before launching.** A webpack build beside a peer's suite gives
  both of you flakes.
- 🔴 **Open a COPY, and rename its `name` field.**
- 🔴 **`route({to:'editor', project})` does NOT swap an already-open project.** Reload between
  projects and assert the loaded name in the readout — s61's `probe.js` prints it.
- ✅ **The module cache reaches everything**:
  `webpackChunknoodl_editor.push([[Symbol()],{},r=>{window.__req=r}])`, then
  `__req('./src/editor/src/models/warningsmodel.ts')`. `nodelibrary` is at
  `models/nodelibrary/index.ts`, not `models/nodelibrary.ts`.

## The eleven fixtures, and what each one already covers

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each` |
| `note-desk` | **a delete button in a list row** — the relayed row signal, `Remove Object From Array`, a Done chain (§30) |
| `relay-desk` | **three wires an author drew wrong** (§31, §32) |
| `deadline-desk` | **all six date nodes**, plus `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter Collection → Map Collection → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; EXP-004 markers, the README comprehension test, §35's orphan-node graft |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |
| `ticket-desk` | **the three small utilities** — `Substring`, `String Mapper`, `Number Remapper` |
| `badge-desk` | **the id pair** — both generators, both rows, both Done chains reading the chain-local, and `UUID`'s `Error` from the render *and* the Failure arm |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored
value, a refused script on a node that is not a Function, **a `dynamicports` entry on a repeater**
(§33.3 — the field 48 of 62 real projects carry), **a child authored inside a component instance**
(§34.5), or **a deferred node with no wires at all** (§35.5 — grafted by the test rather than on disk).
