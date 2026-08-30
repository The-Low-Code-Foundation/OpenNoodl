# Next session — the carve-out was real and worth nothing, and 40% of "the corpus" was never readable

## Where the phase stands

Session 62 answered the question §32 put at the top of this file — *does a relayed row **value**
have a pass-through carve-out, and does `Set Object Properties` unblock with it?* — and the answer
is **no**, with the measurement. Nothing was translated; the picker is unchanged at 70/127. §33 has
the long form. Three recorded numbers were corrected and one scope fact now applies to every
from-disk sweep this phase has ever run.

- ✅ **The carve-out is real where it occurs and it unblocks nothing.** Corpus-wide there is
  exactly **one** correctly-spelled `itemOutput-<name>` wire, and its template output genuinely
  *is* a pass-through of a prop — in `fb020b-drive`, a project **the exporter cannot open**. Over
  the 60 projects it *can* parse the count is **zero**.
- 🔴 **The shape the carve-out was meant to unblock is built by nobody.** All **14** authored
  `Set Object Properties` (11 projects, **6** independent graphs by `md5`, **1** of them
  exportable) sit **inside a repeater template**. Not one is on a page. §30.2's page-side shape —
  `Id ← Item Id`, value `← itemOutput-<name>` — has never been drawn.
- 🔴 **`parseProject` reads `nodegx.project.json` only.** A classic `project.json` is not a bad
  export, it is not an export at all: `ENOENT` before any wire is examined. The corpus is
  **60 v2 / 40 classic / 1 neither**. Every from-disk row since §30.3 was measured over a
  population 40% of which the exporter refuses at the front door.
- ✅ **§31.1's limit #1 is measured and clean on the half that matters**: over the 60 v2 projects,
  `dynamicports` and the template declaration **agree on all 33** relay wires. The 4 disagreements
  that exist are all in `fb020b-drive`, and `dynamicports` is the stale one.

## 🔴 Read this before planning anything

1. 🔴 **`itemOutput-<name>` is off the top of the list.** §30.5 and §32.6 both called it "the
   single port in front of the rest of the collection-state slice". It gates **zero** exportable
   wires. Both entries are struck in place; do not re-inherit them from an older read.
2. 🔴 **A per-project `try/except` in a sweep manufactures absences.** My first `declared_sweep.py`
   run printed **9** wires while **69 of 101 projects** were throwing into a stderr file I had not
   read. Nine is small, plausible, and shaped like a finding. **Read the stderr, and count the
   projects reached.**
3. ✅ **What caught it was running s61's census unmodified, first, as a control** — 76 against a
   recorded 76. A known-firing arm beside the new instrument is the whole defence.
4. 🔴 **Split every from-disk count by v2/classic before it argues a priority.** §32.3's *"12 wires
   in 10 project directories"* is **8 exportable + 4 unreachable**, and the 8 are one graph copied.
5. ⚠️ **No fixture carries `dynamicports`; 48 of 62 real projects with a repeater do.** Every
   fixture row exercises the fall-through in `resolveSourcePortKind`; none exercises the branch
   real projects hit **first**.

## The objective, so it cannot drift

**An app somebody builds in NodeGX today — 0.2.0 editor, picker nodes, MCP-written custom nodes,
a deployed NodeGX backend — exports to a React repo that builds, runs, and still works.**

## The numbers

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit          # exit 0
../../node_modules/.bin/jest                  # 1158/1158, 46 suites, 46 files on disk; ~208 s
npm run export-ledger:picker                  # from the repo root — 70/127 (55.1%), unchanged
npm run export-ledger:check                   # 175 types
```

🔴 The corpus audit is a regression net, never a priority oracle — **and now it is also 60
projects, not 101.**
🔴 Custom node types are **deliberately** outside the picker number — `$customNodesComment` in
`packages/nodegx-export/coverage-ledger.json` says why.

## Do this next — in the order they are worth doing

### 1. 🔴 The row-owned write — the shape actually in front of the collection-state slice

Measured, not guessed: a control **inside a row** writing onto that row's record.
`checkbox.onChange → Set Object Properties.store`, `checkbox.checked → prop-Checked`,
`Model2.id → modelId`. **1 independent graph in the exportable corpus, 6 corpus-wide, 14 nodes,
and 100% of every `Set Object Properties` anybody has authored.**

Nobody has asked whether it translates *against the code* since §4 wrote it off as "state the
enclosing list owns". The fact that unblocked §29 and §30 applies here too: **the emitted row
closes over its own `item`**, so "the record this row is bound to" has a referent on this side.
⚠️ Two things to derive before building, not after: `Collection.updateWhere` **replaces** the row
object (§30.2's third warning), and a row-local write has to reach the parent's array to re-render.
Owner **`NONE`** — a design question, not a wiring one.

### 2. The fixture that would exercise the branch real projects take first

One arm: give a fixture's `For Each` a `dynamicports` entry, so `resolveSourcePortKind` answers
from the file rather than falling through. Today **zero** fixtures do and **48 of 62** real
projects do. Cheap, and it puts the real path under the corpus audit permanently.

### 3. §31.1's limit #2 — the target-port side

Still examined by nothing. Limit #1 is now closed (§33.3); this is the one that is left. Cheap to
scope, unknown to close.

### 4. The product finding, scoped — still `NONE`, and no longer a phase

Not *"the editor hides it"*. The **write path** that authors these wires cannot see them
(`rules/nonexistentPort.ts` abstains because `catalog.isDynamicNode('For Each')` is true, and
correctly), while the **surface that reports it** has no suggestion to offer. Both halves named in
§32.1. ⚠️ **The design question is already answered and should not be re-derived** — FIX-007
§fix-3 named the layer (*"an eleventh check in `authoredPreconditionDiagnostics`"*) and LAS-012's
`repeaterTemplate.ts` is a precondition of exactly that shape. **Ask before building it** — editor
work, not export work.

### 5. Three EXP-004 lines still need Richard, not a session

None can be closed by whoever wrote the artefact; all three are recorded as unrun, not ticked:
the **README comprehension test** (`tests/fixtures/puppy-test-3` exports the richest example), the
**external review of the verification wording**, and **whether the preserved source block actually
helps**.

### 6. Decide whether the editor gets an export command at all — Richard's call

`@nodegx/export` still has **no consumer anywhere in the product**; the only way to run an export
is `ts-node scripts/emit-app.ts` by hand. Owned by **`NONE`**, §21.1 has the evidence.
**Ask before building it.**

### 7. Smaller, and each decidable on its own

- The fixtures nothing reaches (§26.1): a `PageInputs` node, a braced `urlPath`, an
  `External Link`, a `Navigate To Path`, an untyped store key, a wire into a port that already
  carries an authored value, a refused script on a node that is not a Function.
- `plan.ts`'s `For Each → Component Outputs` **value**-port branch still carries the sentence §29
  disproved and serves several populations. **Left alone deliberately** — 0 exportable wires, 0
  fixture wires (§33.4). The comment now records the measurement; split it only if a real project
  lands there.
- `Navigate To Path`'s `Completed` chain (§24.6) — **decide before starting; not obviously worth
  it.**
- The date family's signals and the repeater's lifecycle pulses — one `effect()` slice (§9.6,
  §29.5). ⚠️ §31's census found **zero** such wires anywhere.
- EXP-009 leftovers — drive the exported login/admin forms; delete the drive-residue user
  `exp009-drive` from the local Puppy backend's `_User`.

## 🔴 What session 62 would tell you if it could only say three things

1. **Count the population a blocker guards before you build past it.** The recorded "single port in
   front of the slice" gated a shape no author has ever drawn, and it had been at the top of this
   file for three sessions. One afternoon of counting moved the whole next slice.
2. **Read the stderr of your own sweep.** 69 projects crashed silently and the surviving number
   looked like a result. The control — s61's census, unmodified, run first — is what made the gap
   visible; without it "only 9 wires exist" would have been written down as a finding.
3. **A count is a claim about a population, and the population is usually smaller than the
   directory listing.** `md5` shrank 14 nodes to 6 graphs; the format check shrank 101 projects to
   60. Both were needed before any number here meant anything.

## Standing practice

Work on `cline-dev`; commit by **exact file pathspecs** (never a directory, never stage).
🔴 **`git status | grep '^??'` first** — a pathspec commit skips untracked files. ⚠️ A *new* test
file or fixture is untracked, and `git commit <pathspec>` **errors** rather than skipping it —
`git add` it and commit in the same command so the staging window stays closed.
⚠️ **Delete scratch scripts from `scripts/` and probe specs from `tests/` before committing** —
and **reconcile the suite count against disk** (`ls tests/*.test.ts | wc -l`). 46 files, 46 suites
at the end of s62.
ts-morph and Prettier stay uninstalled; `packages/nodegx-export` is not in root `test:packages`.

🔴 **Check for a peer's suite before running yours** — `ps` for `jest`/`vitest`. s62 waited ~30
minutes on a `nodegx-backend` run and lost nothing by doing the reading first.
⚠️ **`test:ci` was not run by this session and was not needed** — nothing outside
`packages/nodegx-export` was touched. If you touch `noodl-runtime`, run it yourself rather than
inheriting a relayed floor.

⚠️ **The shell's cwd is shared and parallel `cd` calls race** — use absolute paths in any command
you send in parallel. 🔴 A `cd` inside a compound command persists into later tool calls; s62 lost
one call to exactly that, as s61 lost one and s60 two. 🔴 **`cmd | head; echo $?` reads `head`'s
exit code** — redirect to a file and echo `$?` on its own. ⚠️ **`timeout` is not on this machine**
(BSD), and **`uniq -w` is not either**.

## Instruments

s62 scratchpad `898de7ef-…/scratchpad` — **four reusable from-disk sweeps**, all sharing one
loader, all of which take any number of base directories:
- **`rowvalue_sweep.py`** — every `itemOutput-<name>` wire, classified by what feeds the template's
  output (`PASS-THROUGH-OF-PROP` / `ROW-LOCAL` / …) and by where it goes.
- **`declared_sweep.py`** — is the relay port declared on the source node (`dynamicports`), the
  field `resolveSourcePortKind` reads **first**.
- **`disagree_sweep.py`** — `dynamicports` vs the template declaration (§31.1 limit #1), plus every
  wire into a `SetModelProperties`.
- **`outsink_sweep.py`** — the `For Each → Component Outputs` population, split by source port.
- **`setmodel_sweep.py`** — every `SetModelProperties`, and whether its host component is used as a
  repeater template.
- **`foreach_sweep_fixed.py`** — s61's census with the non-dict-`children` guard. ⚠️ In some v2
  components a node's `children` holds **id strings**, not objects; any walker must skip non-dicts.
  Checked: walking children changes the corpus count **not at all** (76 either way).
- **`v2only/` and `classiconly/`** — symlink farms splitting the corpus by format. Point any sweep
  at these instead of the raw directory, and every number arrives pre-split.
- `snap-src` (pre-§33), `tsc.log`, `jest.log`, `picker.log`, `check.log`, `fb020b-emit.log` (the
  `ENOENT` that started §33.2).

s61 `759e5e4b-…` — `probe.js` (opens a project over CDP and dumps every warning), `foreach_sweep.py`,
`fixed-src`, `editor-warning.png`. s60 `3685c239-…` — `fallback_probe.py`, `snap-src`, `mut.py`.
s59 `1d23bd1f-…` — `drive.mjs`, `app/` (a built, driven export of `note-desk`), `EXPECTED.md`.
s58 `85b9297a-…`; s57 `2fc5fa30-…`; s56 `0258c50b-…`; s55 `756fcbe6-…`; s54 `61e7da69-…`.
s53 `efd50c1e-…` — `harness/` (a built export with `node_modules` and the `@nodegx/core` symlink),
`drive.mjs`, `arm.sh`. **The harness is intact and s59 used it.**
s52 `e4b8cbef-…`; s51 `9fcea17d-…`; s50 `e54aeffc-…`; s49 `481a2793-…`; s48 `e6b5ff80-…`.

⚠️ `packages/nodegx-export/src/analyze/appState.ts` contains **four raw NUL bytes**. `grep` and `rg`
treat the whole file as **binary and print nothing** — use `rg -a` / `grep -a`.

## Mutating to prove a checker's reach

The pattern that produced §26.3, §27.5, §29.4, §30.4, §31.3 and §32.5 (s62 changed no behaviour, so
it ran no mutants):

1. `cp -a src <scratchpad>/snap-src/` first — and take a **second** snapshot *after* the fix,
   because the pre-fix one is not a mutant undo (§28's trap).
2. Mutate **by asserting the anchor's uniqueness before replacing it** — a python
   `assert s.count(old) == 1` that fails leaves the source untouched. ✅ s62 used exactly this for
   its comment edits and one anchor failed, changing nothing.
3. ⚠️ **A mutant that breaks the typecheck reads as `Tests: 0 total`, not as a kill.** Check `tsc`
   on each mutant.
4. Run **both** the new rows and the control rows. The finding is the *disagreement*.
5. ✅ **Read what the mutant does to your own rows** — §32's mutant A caught a row that passed on a
   note that never fired.
6. Name the killed rows with `--verbose` — jest prints no per-test lines for a multi-suite run.

## Building and driving an exported app

- **`scripts/emit-app.ts` is the honest runner** — `emit-app.ts <project> <outDir>`, or
  `--preflight <project>`. ✅ It runs against a project **outside** `tests/fixtures`.
  🔴 **It only accepts a v2 project** (`nodegx.project.json`); a classic `project.json` is `ENOENT`.
  ⚠️ `--preflight` prints per-component *counts*, not per-wire reasons — export for those.
- 🔴 **The build is still the only instrument for the real third-party libraries.**
- ✅ **`typecheckEmittedApp` (`tests/helpers/typecheckApp.ts`) is the cheap instrument** — use it on
  any row asserting emitted text, because **a `toContain` passes on dead code** (§24.3).
- Harness: `cp -a` a prepared harness (so the `@nodegx/core` symlink survives), `rm -rf src dist
  tsconfig.tsbuildinfo`, then emit into it. ⚠️ The emit **does** overwrite `package.json`.
- 🔴 **Author a fixture project by copying an existing one**, and ⚠️ **watch the collateral** —
  §32 added one output port to `NoteRow` and re-read the *whole* report to find the extra line.
- Serve with `npx vite preview --port 53xx --strictPort`; stop it by port
  (`lsof -ti :53xx -sTCP:LISTEN | xargs kill`). ⚠️ **`vite preview` binds `localhost`, and
  `curl 127.0.0.1` gets nothing.**
- 🔴 **Poll for readiness, never sleep.**
- 🔴 **The scaffold's router has `<Route path="*" element={<Navigate to="/" replace />} />`.**
- ⚠️ **A React input needs the native value setter plus an `input` event.**
- 🔴 Click with `Input.dispatchMouseEvent`, never `element.click()`. Read `textContent` per element.
- 🔴 **Write the expected answers down before the app runs**, then **sabotage in separate arms** —
  and pick the case that *excludes*, not the one that merely fits (§30.4: the **middle** row).
- ⚠️ **An error row is never cleared** — a success row must run **before** any failure row.

## Driving the editor, if the next question needs it

- 🔴 **Check for a peer's suite before launching.** A webpack build beside a peer's suite gives
  both of you flakes.
- 🔴 **Open a COPY, and rename its `name` field.** `cn027-drive`'s project file reads
  `"name": "cn019-drive"`, so two launcher cards are indistinguishable.
- 🔴 **`route({to:'editor', project})` does NOT swap an already-open project.** Reload between
  projects and assert the loaded name in the readout — s61's `probe.js` prints it.
- ✅ **The module cache reaches everything**:
  `webpackChunknoodl_editor.push([[Symbol()],{},r=>{window.__req=r}])`, then
  `__req('./src/editor/src/models/warningsmodel.ts')`. `nodelibrary` is at
  `models/nodelibrary/index.ts`, not `models/nodelibrary.ts`.
- ✅ **`WarningsModel.instance.warnings` is the whole readout** — component → ref → key, each entry
  keeping its `ref.connection`.

## The nine fixtures, and what each one already covers

| Fixture | Covers |
|---|---|
| `cheer` | the base for most hand-built graphs; `GlobalStore.Set/Subscribe`, popups, component IO, `For Each` |
| `note-desk` | **a delete button in a list row** — the relayed row signal, `Remove Object From Array`, a Done chain (§30) |
| `relay-desk` | **three wires an author drew wrong** — a bare relay name, a signal prefix over a value output, beside a real lifecycle pulse (§31, §32) |
| `deadline-desk` | **all six date nodes**, plus `Now → Set Variable → Variable2 → Text` |
| `quote-desk` | `net.noodl.HTTP` with response mappings, `error`, `failure`, `canceled` |
| `reading-shelf` | `Collection2 → Filter Collection → Map Collection → For Each`, `Model2` prop minting |
| `puppy-test-3` | the richest export; EXP-004 markers and the README comprehension test |
| `variable-dial` | variable typing |
| `kits` | custom nodes / modules |

**No fixture has**: a `PageInputs` node, a braced `urlPath`, an `External Link`, a
`Navigate To Path`, an untyped store key, a wire into a port that already carries an authored
value, a refused script on a node that is not a Function, **or a `dynamicports` entry on a
repeater** (§33.3 — the field 48 of 62 real projects carry and `resolveSourcePortKind` reads first).
