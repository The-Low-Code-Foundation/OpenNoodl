# Next session — the export is IN THE PRODUCT; whether it rides 0.2.2 is Richard's call

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Built, gated, not consumed by the emitted code (by design) |
| EXP-002 deterministic generators | 🟡 in progress, re-aimed at the picker |
| EXP-003 AI logic translation | not started |
| EXP-004 report & honesty UX | 🟡 built and driven; **in-editor pre-flight + toast now exist (EXP-012)**; the drill-down panel and the three lines that need Richard remain |
| EXP-005 / 006 / 007 | not started (006/007 blocked on 002 having a generator to inject into) |
| EXP-008 coverage ledger + gate | ✅ Built |
| EXP-009 backend connection | 🟢 built + driven; AC4 waits on a Cloud Services node |
| EXP-010 custom nodes & modules | 🟢 Route B built + driven; Route A not owed |
| EXP-011 picker coverage | 🟡 Tier 1 COMPLETE, Tier 2.7 COMPLETE — 75/127 (59.1%); the two Tier 2 leftovers each have a design question in front of them |
| **EXP-012 the editor export command** | 🟢 **BUILT + DRIVEN s67** — [EXP-012](EXP-012-THE-EDITOR-EXPORT-COMMAND.md) |
| DEF-033 (Substring's declared End) | ✅ **BUILT s67** — §36.2 |

## 🔴 What session 67 did, and the one decision it left for Richard

Richard opened the session with *"if we make good progress we can include it in the 0.2.2 launch."*
A launch can only include what a user can reach, so the session built the thing §21.1 had listed as
`NONE` for eighteen sessions: **the editor command.** Settings → Project → *Export as React code…*
shows the exact pre-flight, takes a folder, refuses one inside the project, asks before overwriting a
non-empty one, writes the app, and points at `EXPORT-REPORT.md`. Driven end to end over CDP on a
renamed copy of `ticket-desk`; the written folder is **byte-identical** to `emit-app.ts`'s.

🔴 **Richard decides whether it rides 0.2.2.** Nothing in P82's board names it. The facts he needs:
it touches four editor files plus one alias, its gates are green (editor `tsc` 0, export jest
1248/1248, runtime jest 2615 passed, tests-unit 9/9), it changes nothing for a project that never
presses the button, and the honest caveat is that **the exported app has been built and driven from
the script path many times but not from the editor path** — the bytes are identical, so that is a
statement about instruments, not about risk. If it rides: P82's run-sheet gets a row and the release
notes a line (*"Export as React code — Settings → Project"*); if it holds: nothing to undo.

Also built: **DEF-033** (Richard's ruling from P80 — Substring's panel now says `-1`, the number
that runs; description rewritten; catalog regenerated; graded by declaration-vs-`initialize`, with
`result` rows kept as controls).

## 🔴 Read this before planning anything

1. 🔴 **The exporter is now compiled TWICE — under its own strict tsconfig and under the editor's
   non-strict one.** Ten `x !== null && 'defer' in x` sites in `plan.ts` typed only under the first.
   Fixed with an `isDefer()` predicate. **Run the editor's `tsc -p packages/noodl-editor/tsconfig.json
   --noEmit` after any exporter edit** — the package's own `tsc` cannot see this class of error.
2. 🔴 **A peer's edit hot-reloads your running editor mid-drive.** Two HMR updates from a P77 peer
   re-rendered the settings panel and dropped a stamped attribute; re-stamp after any `[HMR]` line and
   count the flow through a patched `chooseDirectory`. One phantom overwrite during an HMR update is
   recorded in EXP-012 as **unexplained, not reproduced**.
3. ⚠️ **`filesystem.js` is CommonJS**: `__req(...)` is the object, `.default` is undefined — a wrong
   patch throws inside a one-line eval and the previous patch stays live.
4. ⚠️ **Peer hunks share your catalog files.** `node-catalog.json` carried a peer's uncommitted Text
   Input placeholder change; the enriched catalog carried *only* theirs. Commit the catalog by a
   filtered patch, never by pathspec, while a peer's `text-input.ts` edit is uncommitted.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1248/1248, 49 suites, 49 files on disk
cd ../noodl-editor && ../../node_modules/.bin/tsc -p tsconfig.json --noEmit   # exit 0 — NEW gate, see above
../../node_modules/.bin/jest tests-unit/exp-012                               # 9/9
npm run export-ledger:picker                  # from the repo root — 75/127 (59.1%), floor 75
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle — **and it is 60 projects, not
101**. ⚠️ `build-corpus.ts` reads **59/60** with a **pre-existing** red (TPL-001 `MemberRow.tsx`
`TS7053` inside a preserved Function body), ~4 minutes, background it. Not re-run this session.

## Do this next — in the order they are worth doing

### 0. If Richard says it rides: the two lines that make it visible
A row on P82's `TASKS.md` and a release-notes line. Then **build and run one editor-path export**
(`npm install && npm run build` in the folder the button wrote) so the caveat above closes.

### 1. 🔴 The row-owned write, with the question §34 sharpened *(carried, unstarted)*
Not *"can a row write to itself"* — **does the write need an id at all?** `Collection.updateWhere`
matches by predicate and the emitted row closes over its own `item`. ⚠️ `updateWhere` **replaces**
the row object. Owner `NONE`. 1 independent graph exportable, 6 corpus-wide, 14 nodes, and 100% of
every `Set Object Properties` anybody has authored.

### 2. EXP-004's drill-down panel — now a UX decision, not a blocked one
The pre-flight modal renders `PreflightSummary` as data; a post-export panel would render
`ExportReportData` the same way. Decide whether a toast + the file is enough for 0.2.x.

### 3. A launcher entry for the export
`parseProject` reads disk, so a project need not be open. Three files (`ProjectsPage.tsx`, the
core-ui `Projects.tsx` card menu, `LauncherContext`). Owner `NONE`.

### 4. `Unique Id`'s `Completed` *(from §37.4)* — small, fully scoped; decide the both-wired case.

### 5. The 36 the sweep could not reach — a `report.ts` change *(§35.6)*, owner `NONE`.

### 6. Children authored inside a component instance — instrument broken first *(§34.5)*, owner `NONE`.

### 7. The fixture with a `dynamicports` entry on a repeater *(§33.3)* — zero fixtures, 48/62 real projects.

### 8. §31.1's limit #2 — the target-port side. Still examined by nothing.

### 9. Three EXP-004 lines still need Richard, not a session
The README comprehension test, the external review of the verification wording, and whether the
preserved source block helps.

## What session 66 did (kept for the three things below)

Built **EXP-011 §37 — the id pair**, `Unique Id` and `net.noodl.UUID`, finishing Tier 2.7: picker
73 → 75/127, `src/lib/id.ts`, fixture `badge-desk`. §37 has the long form.

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
