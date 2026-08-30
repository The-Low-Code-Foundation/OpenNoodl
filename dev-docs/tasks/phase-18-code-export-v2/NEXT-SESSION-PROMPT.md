# Next session — the top row is unchanged, and one bullet under it turned out to be a class

## Where the phase stands

Session 64 took §34.7's second bullet — *"a deferred logic node's reason reaches the report only by
accident; one `notes.push` and a decision about noise"* — and measured the class before building.
The premise held and its instance count was **zero**: `model2ForeachGate`'s ids always reach the
report anyway, via wire notes. What is actually invisible is a **deferred node with no wires**, and
there were 19 of those the report could have named and did not. Fixed, under seven rows that assert
the report file. §35 has the long form. **The ranked row — the row-owned write — is untouched and
still first.**

- 🔴 **`report.ts` renders `notes` and never `dispositions`.** So "nothing dropped silently" was
  the claim that all **42** gates filing a deferral also remembered a `notes.push`. Nothing checked
  it.
- ✅ **Fixed: 76 → 57 absent, the renderable bucket 19 → 0.** `sweepUnreportedDeferrals()` at all
  three exits of `planComponent`, pushing only for a node no note already mentions.
- ✅ **§34.7's grep bullet, done.** 30 candidates, 27 already assert `result.files`; the 3 that did
  not now do.
- ⚠️ **36 router-shell nodes still unreported and `plan.ts` cannot fix them** — see below.

## 🔴 Read this before planning anything

1. 🔴 **Ask what a fix could possibly move before grading it.** The headline was 76 unreported
   nodes; only **19** sat in components where `report.ts` renders a note at all (`c.file !== null`).
   Grading against 76 would have scored a correct fix as two-thirds broken.
2. ✅ **A control that shares the finding's shape is worth more than a big control.**
   `logic node (…)` reads **212 present / 39 absent** — so the absence is about those nodes, not an
   unreportable family. "76 missing" alone could not have said that.
3. 🔴 **A corpus hides the unwired case.** Both gates that look silent in the source
   (`model2ForeachGate`, and DbCollection2's at `plan.ts:9403`) are silent **0** times in 60
   projects, because every real instance has dropped wires whose notes name it. The defect only
   shows on a node nobody wired.
4. 🔴 **Zero fixtures exercised the new sweep** — checked before writing rows. *"Over every fixture,
   nothing is unreported"* would have been `all([])`: true, vacuous, green against a deleted sweep.
5. ⚠️ **`planProject` takes a `CatalogIndex`, `emitApp` takes the raw `Catalog`.** One line, one
   `TSError`, and easy to lose a run to.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1168/1168, 47 suites, 47 files on disk
npm run export-ledger:picker                  # from the repo root — 70/127 (55.1%), unchanged
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle — **and it is 60 projects, not 101**
(`parseProject` reads `nodegx.project.json` only; 40 are classic, 1 neither).
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why.

## Do this next — in the order they are worth doing

### 1. 🔴 The row-owned write, with the question §34 sharpened *(carried, unstarted)*

Not *"can a row write to itself"*. The measured question: **does the write need an id at all?**
`Collection.updateWhere(match, update)` matches **by predicate**, and §29/§30 established the emitted
row closes over its own `item` — so "the record this row is bound to" has a referent on this side
that is not a string id. §5.3 refuses because a row has no *id*; the shape may never have needed one.

⚠️ Derive before building: `updateWhere` **replaces** the row object, so `item` goes stale for
anything later in the same handler (a write then a removal removes nothing). Owner **`NONE`** — a
design question. **1 independent graph exportable, 6 corpus-wide, 14 nodes, and 100% of every
`Set Object Properties` anybody has authored.**

### 2. ⚠️ The 36 the sweep could not reach — and it is a `report.ts` change

Nodes beside the **router shell**. The App component has `file === null`, so `renderReport`'s
`attention` filter drops all of its notes and no `plan.ts` push can surface them. `withPreserved`
(§27.6) already rescues the script-bearing ones; a plain `Group` beside the Router is mentioned
nowhere in the export. Decide whether the report grows a section for scaffolded components' dropped
nodes, or whether being outside `src/App.tsx` is adequately implied. Owner **`NONE`**, §35.6.

### 3. Children authored inside a component instance — unowned, instrument broken first

**19 instances in 8 projects, 217 nodes in those subtrees.** `walk` descends into them, but
`renderInstance` emits `<Shell … />` self-closing, so anything below is unreachable and any marker is
orphaned. ⚠️ **`instkids.ts`'s 96/217 split separates nothing** — `src.includes(id)` counts *rendered*
and *named in a marker* alike. Split those before drawing any conclusion. Owner **`NONE`**.

### 4. The fixture that exercises the branch real projects take first

One arm: give a fixture's `For Each` a `dynamicports` entry so `resolveSourcePortKind` answers from
the file rather than falling through. **Zero** fixtures do; **48 of 62** real projects with a repeater
do. Cheap, and it puts the real path under the corpus audit permanently. *(Carried from s62/s63
unstarted.)*

### 5. §31.1's limit #2 — the target-port side

Still examined by nothing. Limit #1 closed in §33.3. Cheap to scope, unknown to close.

### 6. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact: the **README comprehension test**
(`tests/fixtures/puppy-test-3` exports the richest example), the **external review of the
verification wording**, and **whether the preserved source block actually helps**.

### 7. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export is
`ts-node scripts/emit-app.ts` by hand. Owned by **`NONE`**, §21.1 has the evidence.
**Ask before building it.**

### 8. Smaller, and each decidable on its own

- The fixtures nothing reaches (§26.1): a `PageInputs` node, a braced `urlPath`, an `External Link`,
  a `Navigate To Path`, an untyped store key, a wire into a port that already carries an authored
  value, a refused script on a node that is not a Function.
- `plan.ts`'s `For Each → Component Outputs` **value**-port branch — **left alone deliberately**
  (0 exportable wires, 0 fixture wires, §33.4). Split it only if a real project lands there.
- `Navigate To Path`'s `Completed` chain (§24.6) — **decide before starting; not obviously worth it.**
- The date family's signals and the repeater's lifecycle pulses — one `effect()` slice (§9.6, §29.5).
  ⚠️ §31's census found **zero** such wires anywhere.
- EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 64 would tell you if it could only say three things

1. **Find out what your fix could move before you measure whether it moved it.** 76 unreported
   nodes, 57 of them in components where no note can render. The fix was complete at 19.
2. **A gate that looks silent in the source can be silent zero times in practice.** Two gates with
   an obviously missing `notes.push` are both fully covered by wire notes across 60 projects. The
   real hole was the shape the corpus contains least — a node with no wires.
3. **Check whether a fixture exercises your change before writing a row over the fixtures.** None
   did, so the invariant row would have been vacuous, and only a built case could kill a mutant.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test file
or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed. ✅ s64 did exactly this.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** — and
**reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`). 47 files, 47 suites at the
end of s64.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

🔴 **Check for a peer's suite before running yours** — `ps` for `jest`/`vitest`. s64's checkout was
clear throughout.
⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched.

⚠️ **The shell's cwd is reset between calls and parallel `cd`s race** — use absolute paths in
anything you send in parallel (s64 lost one call to exactly this). 🔴 **A glob stored in a shell
variable does not expand in zsh**. 🔴 **`cmd | head; echo $?` reads `head`'s exit code** — redirect to
a file and echo `$?` on its own. ⚠️ **`timeout` is not on this machine** (BSD), and **`uniq -w` is
not either**.

## Instruments

s64 scratchpad `a893227f-…/scratchpad` — all four need copying into
`packages/nodegx-export/scripts/` to run (the relative imports need to live there):
- **`reportreach.ts`** — §35.2's table. Every deferred node, *is its id in its own
  `EXPORT-REPORT.md`*, bucketed by reason shape **and by whether a note in that component could
  render at all**. This is the one to reach for; the file-split is what keeps a fix honestly graded.
- **`silentreason.ts`** — the `plan.notes`-level version, with the three-way split
  (reason quoted / id named by another note / neither). Its header records why two buckets was the
  wrong shape.
- **`sweepfires.ts`** — does the new sweep produce a line in any project under a directory. This is
  what proved no fixture exercises it.
- **`oneid.ts`** — dumps every report and note line naming one component's deferred ids. This is
  what showed the "accidental" nodes are reported *via their wires*.
- `mut.py` — the assert-uniqueness mutator; `snap-src-post/` — `src` after §35's change.
- `tsc.log`, `jest.log`, `picker.log`, `check.log`, `reportreach-pre2.log` / `reportreach-post.log`
  (the before/after pair).

s63 `da3e8895-…` — **`silenthole.ts`** (the §34.3 table with its control arm), **`instkids.ts`**
(⚠️ its split separates nothing — see §34.5), `dump_row.py`, `cn019-out/`, `def015-out/`.
s62 `898de7ef-…` — **five reusable from-disk sweeps**, all sharing one loader: `rowvalue_sweep.py`,
`declared_sweep.py`, `disagree_sweep.py`, `outsink_sweep.py`, `setmodel_sweep.py`, plus
`foreach_sweep_fixed.py`. 🔴 **`v2only/` and `classiconly/`** — symlink farms splitting the corpus by
format; point any sweep at these and every number arrives pre-split. **s64 used `v2only` throughout.**
s61 `759e5e4b-…` — `probe.js` (opens a project over CDP and dumps every warning), `fixed-src`.
s60 `3685c239-…` — `fallback_probe.py`, `mut.py`. s59 `1d23bd1f-…` — `drive.mjs`, `app/`, `EXPECTED.md`.
s53 `efd50c1e-…` — `harness/` (a built export with `node_modules` and the `@nodegx/core` symlink),
`drive.mjs`, `arm.sh`. **The harness is intact and s59 used it.**

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4, §30.4, §31.3, §32.5 and §35.5:

1. `cp -a src <scratchpad>/snap-src/` first — and take a **second** snapshot *after* the fix, because
   the pre-fix one is not a mutant undo (§28's trap). ✅ s64's is `snap-src-post/`.
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == n` that fails leaves the source untouched (`mut.py`).
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** Check `tsc` on
   each mutant. ✅ s64 did, on all four.
4. Run **both** the new rows and the control rows. The finding is the *disagreement*.
5. ✅ **Read what the mutant does to your own rows** — s64's wording row survives the
   sweep-deleted mutant (nothing is pushed, so nothing stutters) and only kills the wording mutant.
   A row that kills nothing on its own is worth knowing about.
6. Name the killed rows with `--verbose` — jest prints no per-test lines for a multi-suite run.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>`. ✅ It runs against a project **outside** `tests/fixtures`.
  🔴 **It only accepts a v2 project** (`nodegx.project.json`); a classic `project.json` is `ENOENT`.
  ⚠️ `--preflight` prints per-component *counts*, not per-wire reasons — export for those.
- ✅ **For a corpus-wide question, call `parseProject` + `planProject`/`emitApp` in-process** rather
  than shelling `emit-app.ts` 60 times — s63's and s64's sweeps do this and finish in one run.
  ⚠️ `planProject` wants `new CatalogIndex(catalog)`; `emitApp` wants the raw `Catalog`.
- 🔴 **The build is still the only instrument for the real third-party libraries.**
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — use it on
  any row asserting emitted text, because **a `toContain` passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. ⚠️ The emit **does** overwrite `package.json`.
- 🔴 **Author a fixture project by copying an existing one**, and ⚠️ **watch the collateral**.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.**
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`.**
- ⚠️ **A React input needs the native value setter plus an `input` event.**
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** — and
  pick the case that *excludes*, not the one that merely fits (§30.4: the **middle** row).
- ⚠️ **An error row is never cleared** — a success row must run **before** any failure row.

## Driving the editor, if the next question needs it

- 🔴 **Check for a peer's suite before launching.** A webpack build beside a peer's suite gives both
  of you flakes.
- 🔴 **Open a COPY, and rename its `name` field.** `cn027-drive`'s project file reads
  `"name": "cn019-drive"`, so two launcher cards are indistinguishable.
- 🔴 **`route({to:'editor', project})` does NOT swap an already-open project.** Reload between projects
  and assert the loaded name in the readout — s61's `probe.js` prints it.
- ✅ **The module cache reaches everything**:
  `webpackChunknoodl_editor.push([[Symbol()],{},r=>{window.__req=r}])`, then
  `__req('./src/editor/src/models/warningsmodel.ts')`. `nodelibrary` is at
  `models/nodelibrary/index.ts`, not `models/nodelibrary.ts`.
- ✅ **`WarningsModel.instance.warnings` is the whole readout** — component → ref → key, each entry
  keeping its `ref.connection`.

## The nine fixtures, and what each one already covers

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each`; **the `Showcase` graft the visual-control rows use** |
| `note-desk` | **a delete button in a list row** — the relayed row signal, `Remove Object From Array`, a Done chain (§30) |
| `relay-desk` | **three wires an author drew wrong** — a bare relay name, a signal prefix over a value output, beside a real lifecycle pulse (§31, §32) |
| `deadline-desk` | **all six date nodes**, plus `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter Collection → Map Collection → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; EXP-004 markers, the README comprehension test, **and §35's orphan-node graft (`Components/PuppyCard`)** |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored value,
a refused script on a node that is not a Function, **a `dynamicports` entry on a repeater** (§33.3 —
the field 48 of 62 real projects carry and `resolveSourcePortKind` reads first), **a child authored
inside a component instance** (§34.5), **or a deferred node with no wires at all** (§35.5 — grafted
by the test rather than present on disk).
