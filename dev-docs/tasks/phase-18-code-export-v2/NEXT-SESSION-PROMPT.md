# Next session — a picker node landed for the first time in seventeen sessions

## The board, re-derived from the task files

| task | status |
|---|---|
| EXP-001 `@nodegx/core` | ✅ Built |
| EXP-002 deterministic generators | 🟡 in progress, re-aimed at the picker |
| EXP-003 AI logic translation | not started |
| EXP-004 report & honesty UX | 🟡 built and driven; **three lines need Richard, not a session** |
| EXP-005 / 006 / 007 | not started |
| EXP-008 coverage ledger + gate | ✅ Built |
| EXP-009 backend connection | 🟢 built + driven; AC4 waits on a Cloud Services node |
| EXP-010 custom nodes & modules | 🔴 open |
| **EXP-011 picker coverage** | 🟡 **Tier 1 complete; Tier 2.7's three pure utilities built s65 — 73/127 (57.5%)** |

**Tier 2's open remainder:** the **id pair** (`Unique Id`, `UUID` — §36.9, no design question),
**Cloud Services (9)**, and the **component stack pair** (§15.6 says it is a routing question).

## What session 65 did

Built **EXP-011 Tier 2.7's three pure utilities** — `Substring`, `Number Remapper`,
`String Mapper` — each as one call into a new emitted `src/lib/util.ts`. **§36** has the long form.

- ✅ **Picker 70 → 73 of 127 (57.5%)**, floor raised in the same commit. AC1 moved.
- ✅ **AC3's project is `tests/fixtures/ticket-desk`** — routed, rendering, and picked up
  automatically by the five suites that enumerate `tests/fixtures`, so it gates without a list.
- 🔴 **DEF-033 registered** (P80's register): `Substring`'s panel says `End = 0`, the node answers
  as `End = -1`, and the two are opposite results rather than a near-miss.
- ⚠️ **A clause added on this file's own standing warning was measured dead and removed** — §36.5.

## 🔴 Read this before planning anything

1. 🔴 **A declared default can contradict the node, and the panel is the one that is wrong.**
   `registerInput` writes a declared default into `_inputValues` **without calling the setter**, so
   an untouched port holds whatever `initialize` wrote. For `Substring.end` that is `-1` against a
   declared `0` — the rest of the string against the empty string, for every input. The only
   instrument that can see it is a harness that leaves an unset port **genuinely unset**.
2. 🔴 **"Never one edit" was right as a warning and wrong as arithmetic.** Both opt-in sites were
   wired on §9's instruction; M4 alone killed **0** rows, M6 alone killed **0**, and M7 (both)
   killed **12**. Pass 4c runs first and consumes the wire, so the later predicate was unreachable
   for this family. ✅ **Measure which site a new node needs** — pure expression ⇒ Pass 4c's
   whitelist, needs a state row ⇒ Pass 4f's predicate. Shipping both is not the safe option.
3. ⚠️ **A differential §A does not cover a planner fallback.** Mutating `end`'s fallback killed one
   §B row and left all ten §A rows green. The measurement and the *use* of the measurement are two
   assertions and they needed two rows.
4. 🔴 **The corpus red that fits perfectly is not this slice's.** `TS7053` on
   `{ moderator: string; member: string }` indexed by a `string` reads exactly like a `mapString`
   table. It is a **preserved Function body**, and the control against the pre-change `src`
   produces the identical diagnostic at the identical line.
5. ✅ **The corpus cannot grade a picker slice.** All three node types read **0 instances** across
   the 60 v2 projects, against controls of 1564 `Text`, 4 `String Format`, 1 `Date Add` over the
   same 2667 files. A new fixture was the only possible instrument.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1211/1211, 48 suites, 48 files on disk
npm run export-ledger:picker                  # from the repo root — 73/127 (57.5%), floor 73
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle — **and it is 60 projects, not 101**
(`parseProject` reads `nodegx.project.json` only; 40 are classic, 1 neither).
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why.
⚠️ `build-corpus.ts` reads **59/60**, and the red is **pre-existing**: `Members area (TPL-001)`,
`MemberRow.tsx(16,15)`, `TS7053` on `LABELS[standing]` inside a **preserved Function body**
(EXP-003's). Controlled against the pre-change `src` — identical diagnostic, identical line.
**Do not read it as a regression, and do not re-derive that.** Owner `NONE`.
⚠️ It takes **~4 minutes** and exceeds the 120s tool timeout — background it.

## Do this next — in the order they are worth doing

### 1. 🟢 Finish Tier 2.7 — `Unique Id` and `UUID`, the id pair *(the natural next build)*

The other half of the tier §36 built, and the **only remaining Tier 2 item with no design question
in front of it**. Both hold a generated id and both have a `New` action with `done`/`failure`, so
neither is a pure call: they want **`Now`'s treatment** — a state row seeded by a lazy `useState`
initializer (`nowStateOf`), an action that writes it (`date-now-read`'s shape), and a chain-local
read inside the action's own chain so the write is visible to what follows it.

- `Unique Id` is `Model.guid()` — **10 characters from `Math.random()`**, not a UUID. `model.ts`'s
  `_randomString` is the thing to transcribe. Outputs `guid` + `done`; **no `failure`**, and the
  node's own comment says why (`Model.guid()` cannot fail).
- `UUID` is `crypto.randomUUID` with a `getRandomValues` fallback (`std-library/crypto/encoding.ts`
  `randomUuid`), and it has a **`failure` arm and an `Error` output** — §14's
  row-allocated-by-the-read rule for the third time.
- ⚠️ Both seed one id at construction, so the value output is **never empty** — that is what makes
  the lazy initializer the faithful `useState`, exactly as `Now`'s is.
- Picker **73 → 75**. §36.9 has the sketch; §9's `Now` half is the code to copy.

### 2. 🔴 The row-owned write, with the question §34 sharpened *(carried, unstarted)*

Not *"can a row write to itself"*. The measured question: **does the write need an id at all?**
`Collection.updateWhere(match, update)` matches **by predicate**, and §29/§30 established the emitted
row closes over its own `item` — so "the record this row is bound to" has a referent on this side
that is not a string id. §5.3 refuses because a row has no *id*; the shape may never have needed one.

⚠️ Derive before building: `updateWhere` **replaces** the row object, so `item` goes stale for
anything later in the same handler (a write then a removal removes nothing). Owner **`NONE`** — a
design question. **1 independent graph exportable, 6 corpus-wide, 14 nodes, and 100% of every
`Set Object Properties` anybody has authored.**

### 3. ⚠️ The 36 the sweep could not reach — and it is a `report.ts` change

Nodes beside the **router shell**. The App component has `file === null`, so `renderReport`'s
`attention` filter drops all of its notes and no `plan.ts` push can surface them. `withPreserved`
(§27.6) already rescues the script-bearing ones; a plain `Group` beside the Router is mentioned
nowhere in the export. Decide whether the report grows a section for scaffolded components' dropped
nodes, or whether being outside `src/App.tsx` is adequately implied. Owner **`NONE`**, §35.6.

### 4. Children authored inside a component instance — unowned, instrument broken first

**19 instances in 8 projects, 217 nodes in those subtrees.** `walk` descends into them, but
`renderInstance` emits `<Shell … />` self-closing, so anything below is unreachable and any marker is
orphaned. ⚠️ **`instkids.ts`'s 96/217 split separates nothing** — `src.includes(id)` counts *rendered*
and *named in a marker* alike. Split those before drawing any conclusion. Owner **`NONE`**.

### 5. The fixture that exercises the branch real projects take first

One arm: give a fixture's `For Each` a `dynamicports` entry so `resolveSourcePortKind` answers from
the file rather than falling through. **Zero** fixtures do; **48 of 62** real projects with a repeater
do. Cheap, and it puts the real path under the corpus audit permanently. *(Carried from s62/s63
unstarted.)*

### 6. §31.1's limit #2 — the target-port side

Still examined by nothing. Limit #1 closed in §33.3. Cheap to scope, unknown to close.

### 7. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact: the **README comprehension test**
(`tests/fixtures/puppy-test-3` exports the richest example), the **external review of the
verification wording**, and **whether the preserved source block actually helps**.

### 8. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export is
`ts-node scripts/emit-app.ts` by hand. Owned by **`NONE`**, §21.1 has the evidence.
**Ask before building it.**

### 9. Smaller, and each decidable on its own

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

## 🔴 What session 65 would tell you if it could only say three things

1. **Ask what an unset port is actually holding, not what it declares.** A declared default is
   written into `_inputValues` and never runs its setter, so `initialize` is the truth. One port in
   three had a default that contradicted its node, and the contradiction was total.
2. **A warning in the source is a hypothesis about the code, not a measurement of it.** Both opt-in
   sites were wired because the file says to wire both; the mutants said one of them cannot
   execute. Wire what you measured and leave the reasoning where the next author will read it.
3. **Build the node the corpus cannot see.** All three types are absent from all 60 projects. Every
   instrument that could have graded this slice had to be built for it — the differential harness
   against the real node definitions, and the fixture.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test file
or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it — `git add` it
and commit in the same command so the staging window stays closed. ✅ s64 and s65 both did exactly this.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** — and
**reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`). 48 files, 48 suites at the
end of s65.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

🔴 **Check for a peer's suite before running yours** — `ps` for `jest`/`vitest`. s65's checkout was
clear throughout.
⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` and `dev-docs/` was touched.

⚠️ **The shell's cwd is reset between calls and parallel `cd`s race** — use absolute paths in
anything you send in parallel (s64 lost one call to exactly this). 🔴 **A glob stored in a shell
variable does not expand in zsh**. 🔴 **`cmd | head; echo $?` reads `head`'s exit code** — redirect to
a file and echo `$?` on its own. ⚠️ **`timeout` is not on this machine** (BSD), and **`uniq -w` is
not either**.

## Instruments

s65 scratchpad `ff4cafc5-…/scratchpad`:
- **`mut.py`** — the anchor-asserting mutator, with `restore` restoring from `snap-src-post/`.
- **`snap-src-pre/`** and **`snap-src-post/`** — `src` either side of this session. `snap-src-pre`
  is what the corpus **control** in §36.8 was run against; swap it in with `mv`/`cp -a`, never
  `git checkout`, and `diff -rq` back afterwards.
- **`harness/`** — a built export harness with `node_modules` (copied from `1a63a0f6-…`), which is
  what `build-corpus.ts --app` needs. ⚠️ **s53's harness at `efd50c1e-…` is gone**; several other
  scratchpads still have one, and `for h in …/scratchpad/harness; do [ -x "$h/node_modules/.bin/tsc" ]`
  finds a live one in a second.
- `corpus.log` / `corpus-control.log`, `jest-final.log`, `tsc.log`, `m_M*.log` (the mutant arms),
  `ticket-out/` and `members-out/` (two emitted apps).

s64 `a893227f-…` — **`reportreach.ts`** (deferred node vs its own report, split by whether a note
could render at all), `silentreason.ts`, `sweepfires.ts`, `oneid.ts`, `snap-src-post/`.
s63 `da3e8895-…` — **`silenthole.ts`**, **`instkids.ts`** (⚠️ its split separates nothing — §34.5).
s62 `898de7ef-…` — **five reusable from-disk sweeps**, plus 🔴 **`v2only/` and `classiconly/`**,
symlink farms splitting the corpus by format. **s64 and s65 both used `v2only` throughout.**
s61 `759e5e4b-…` — `probe.js`. s60 `3685c239-…` — `fallback_probe.py`.
s59 `1d23bd1f-…` — `drive.mjs`, `app/`, `EXPECTED.md`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4, §30.4, §31.3, §32.5 and §35.5:

1. `cp -a src <scratchpad>/snap-src/` first — and take a **second** snapshot *after* the fix, because
   the pre-fix one is not a mutant undo (§28's trap). ✅ s65's is `snap-src-post/`, and the **pre**-fix one earned its keep as the corpus control (§36.8).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == n` that fails leaves the source untouched (`mut.py`).
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** Check `tsc` on
   each mutant. ✅ s65 did, on all seven.
4. Run **both** the new rows and the control rows. The finding is the *disagreement*.
5. ✅ **Read what the mutant does to your own rows, and what your rows do to the code** — s65 found
   a **clause no mutant could kill**, which is the same measurement pointing the other way: not a
   weak row, a dead branch. Removing it made the surviving site load-bearing, and its mutant then
   killed 12.
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

## The ten fixtures, and what each one already covers

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

| `ticket-desk` | **the three small utilities** — `Substring`, `String Mapper`, `Number Remapper` off one text input, and §36's empty-String divergence note |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored value,
a refused script on a node that is not a Function, **a `dynamicports` entry on a repeater** (§33.3 —
the field 48 of 62 real projects carry and `resolveSourcePortKind` reads first), **a child authored
inside a component instance** (§34.5), **a deferred node with no wires at all** (§35.5 — grafted by the
test rather than present on disk), **or a `Unique Id`/`UUID`** (§36.9's remainder).
