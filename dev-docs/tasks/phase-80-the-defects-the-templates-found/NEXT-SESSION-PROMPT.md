# Phase 80 — next session

🟢 **46 of the 46 rows in the table are ✅. The phase is closed — DEF-042 was ruled on and built
in session 45.**

🔴 **Derive the board from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row
out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$3); print ($3 ~ /^✅/) ? "done" : "open"}' | sort | uniq -c
```

Reads **46 done / 0 open** over **46 rows** at the time of writing. ⚠️ **Next free id is
`DEF-048`.** 🔴 **`DEF-043` is still CLAIMED BY PHASE 82 with no row here** — read the claim line in
the header of [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md), never the highest number in
the table.

---

## What session 45 did

**s44's work was entirely uncommitted in a shared checkout when this session opened. It is all
landed now**, in four commits across two repositories:

| commit | what |
| --- | --- |
| `3cb68903` | **DEF-045** — `functions/:name` → `functions/*name`, and the two pattern consumers |
| `fc0ada95` | **DEF-046** — `valueDidChange` + `shouldRunOnValueChanged`, 17 setters, the type mirrors |
| `ef5e90f5` | the register: DEF-039/040/041/042/044 rows, DEF-042's mechanism spec, TASKS.md, and s41's 08-31 updates to DEF-007/DEF-036/the rulings |
| `b782c08` (`nodegx-community`) | **DEF-044** — the home gate at both curated doors |
| `22bdb473` | 🆕 **DEF-047** — the stale-function double render |
| `2f5c7ef5` | s43's **DEF-039/040/041**, with the Electron gate that had never run |
| `ccfa88b5` | 🆕 **DEF-042** — the throwing listener, built on Richard's ruling |

🔴 **Two files held BOTH s44's hunks and a live P77 peer's** — `noodl-types/src/runtime/node-definition.d.ts`
and `noodl-runtime/src/nodes/std-library/data/dbmodelnode2.ts` carry `wireDeclaredPortPrefix`
(SBR-008 §9) beside DEF-046. A `git commit <pathspec>` would have swept them into my commit under
my message. **The recipe, now in memory:** `git diff -- <files>` → drop the peer's hunks from the
patch → `git apply --cached` → `git add` the clean files → **read `git diff --cached --stat`** →
`git commit` with *no* pathspec. Afterwards their `+6` and `+14` were still unstaged and intact.
⚠️ **Cluster by mtime before trusting a hand-off's file list**: s44's said "10 node files", the diff
touched **11**, and the eleventh (`dbmodelcrudbase.ts`, a day older) was the peer's.

### 🆕 DEF-047 — and the lesson that outranks the fix

[DEF-047](DEF-047-A-STALE-CLOUD-FUNCTION-RENDERS-TWICE.md): the backend card mapped
`backendFunctions` with a green ✓ and, one line below, mapped `stale` — **which is defined as a
subset of it** — with a warning triangle. A function the backend still serves that the project no
longer has was drawn as a healthy row *and* a problem row, one line apart.

🔴 **"TRIVIALLY FIXED" IN A REGISTER DESCRIBES THE EDIT, NOT THE GATE.** The row said *trivially
fixed by rendering the ticks over `backendFunctions` minus `stale`* and sat there, owner `NONE`,
after being found in a control frame **and screenshotted**. The one-line filter is trivial and
**ungradeable**: the classification lived in the JSX, `tests-unit` is plain Node (no jsdom, and
`Icon` alone makes a spec fail *to run*), and a grep proved **no spec in `tests/` or `tests-unit/`
names the component at all**. Built instead as a pure `cloudFunctionRows` returning ONE ordered row
list — a name drawn twice is now unrepresentable rather than filtered — which is also what let the
**reverted arm** exist at all. ⚠️ The register's own citation was backwards: `:123` *defines*
`stale` from `backendFunctions` and filters nothing out of it.

⚠️ **One deliberate behaviour change**, written up in §3.1 of the row: `stale` is measured against
**every** cloud component rather than endpoints only, because the old set can hold a name the
project has as a *worker*, of which the row's own sentence (*"not in the project"*) is false. The
populations coincide today.

---

## ✅ s43's DEF-039/040/041 IS LANDED TOO — the register and the tree agree again

TASKS.md recorded all three as **BUILT** while none of the code was in HEAD. It was **one clean
mtime cluster, 11:36–12:15 on 2026-09-03, nothing live in it** — this was the set:

```
 M src/editor/src/io/ProjectExporter.ts · ProjectImporter.ts
 M src/editor/src/models/nodegraphmodel/NodeGraphModel.ts · projectmodel.editor.ts
 M src/editor/src/services/ProjectStructure/ComponentLoader.ts
 M src/editor/src/views/nodegrapheditor/NodeGraphEditorConnection.ts · NodeOperations.ts
 M tests/models/index.ts
?? src/editor/src/models/nodegraphmodel/connectionEnds.ts
?? tests/models/RootNodeUndo.test.ts   ?? tests-unit/def-039/ def-040/ def-041/
```

✅ **LANDED as `2f5c7ef5`.** `tests/models/RootNodeUndo.test.ts` — registered in
`tests/models/index.ts`, needs Electron, and had **never run** — ran in `test:ci` and **passed**,
which is what made landing it defensible. Neither `eff946c6` nor `3214ef4d` had touched any of these
files, so no hunk was interleaved; `tests-unit/def-039|040|041` read 3 suites / 18 tests, exit 0.

---

## ✅ THE GATE WAS TAKEN — and the 5th red is NOT ours, proved with a seeded control

**`test:ci` — 2943 specs, 5 failures, seed 13203, HEAD `2f5c7ef5`, fresh `test-results.json`.**
Four are the `AIX-006 style vocabulary` floor, checked **by name**. The fifth is
`pending project saves survive the way out > re-arms a held save when saving is switched back on`
([`tests/project/projectsaveflush.js:87`](../../../packages/noodl-editor/tests/project/projectsaveflush.js#L87)),
`Expected Object({ written: true }) to be undefined`.

🔴 **It reproduces deterministically at seed 13203 and it is NOT this session's work.** Evidence, in
the order it was taken:

1. **DEF-007 s38 already met this exact spec** as a lone fifth red, re-seeded it away (70598 →
   76055), and recorded the right standard: *"a lone red that a session quietly re-rolls until it is
   green is how a real regression gets attributed to luck — the attribution here is the spec's
   content"*. See [DEF-007 §Gates](DEF-007-DISK-AND-LOAD-DISAGREE.md).
2. **Re-run pinned to the same seed: red again.** So it is order-dependent, not random. Seed 13203
   puts six `SUB-007` merger specs immediately before it; seed 09154 (green, 40 minutes earlier)
   put `the operator dropdown` specs there. The spec's own header says why that matters:
   *"`saveOnModelChange`, `savePending` and `ProjectModel.instance` are module globals. Leaving any
   of them dirty makes the NEXT spec file's result depend on execution order."*
3. **THE CONTROL — the same seed with DEF-047 reverted in the tree: the same 5 failures.**
   ✅ **Reverting source only, never a spec**, because the seeded shuffle depends on the SPEC SET:
   remove or add one spec and the same seed gives a different order, and the control stops being
   one. DEF-047's spec lives in `tests-unit/`, which this bundle does not compile, so the set was
   provably identical (2943 both arms).

⚠️ **The row that is owed: `projectsaveflush.js` leaks module state across spec files under some
orders.** It is a real, seed-dependent gate defect, twice sighted, still unowned — not a product
defect, so it did not become a DEF row. **A session that meets a fifth red should check this name
first.**

🔴 **`tests/models/RootNodeUndo.test.ts` RAN FOR THE FIRST TIME AND PASSED.** It is s43's DEF-040
gate, needs Electron, and had never executed. That is why s43's pile could be landed.

### 🔴 The trap that cost this session four wasted runs

**The editor `test:ci` webpack typechecks a sibling package's UNTRACKED spec, and caches its
failure.** Run 1 exited 1 after **109 log lines with no spec count at all**: 4 webpack errors, two
of them `TS2532`/`TS18048` inside `packages/nodegx-export/tests/run-tasks.test.ts` — an untracked,
in-progress file belonging to the P18 session, mtime four minutes before my launch. ts-loader then
emitted no output for `nodegx-export/src/index.ts` and `src/ledger.ts`, which `CodeExportModal.tsx`
and `NodePicker.search.ts` import.

- **`tsc -p packages/noodl-editor` exits 0 on this.** Mine did; so did the owning session's, minutes
  earlier. The editor tsconfig does not include a sibling package's tests; the test-CI webpack
  reaches them **through the import chain** and is the only instrument that sees them.
- 🔴 **`TypeScript emitted no output` with NO TypeScript error above it is a POISONED
  `.webpack-cache`** — ts-loader's failure state, kept. It cost runs 2 and 5. ✅ **`rm -rf
  packages/noodl-editor/.webpack-cache` after anything reds the webpack, before believing the next
  reading.** The cache is cleared as of this hand-off.
- ✅ **A `test:ci` that fails with no `N specs, M failures` line DID NOT RUN.** Read the log for
  `ERROR in`, and **check the mtimes of the files it names** before assuming the failure is yours.
- ✅ **Message the owner; never edit their live file to unblock yourself.** `opennoodl-54` fixed both
  errors within minutes, then held every write into that package for a clean window.
- ✅ **Pin the seed with `NOODL_SPEC_SEED=<n>`** (`tests/SpecRunner.html:42`), not a `--seed` flag.
- ✅ **Delete `packages/noodl-editor/tests/test-results.json` before every run** — the P63 gate needs
  a fresh one, and a stale file reads as a perfect pass. Check its mtime after.

## What is left, in the order a session should take it

### An agent can do these alone

1. **§6 — `group.ts` cannot be imported from a test**, so the most-used visual node is ungraded and
   the failure mode reads as `Tests: 0 total`. Already measured. ⚠️ **Measure the blast radius
   first**: whether a `.js` transform in that package's jest config moves any of its 86 suites.
   **This is now the biggest agent-doable row, and DEF-047 is the argument for it** — an ungradeable
   surface is where defects sit unfixed for months with a screenshot attached.
2. **§5 — the `domelement` port cannot reach the destination its own description names.** ⚠️ **Four
   generated copies of the description.** 🔴 And the wire would not have worked if it had connected
   (`Group.tsx:113` wants the node, `Video.tsx:217` sends the element).
3. **The configured site address is unreachable from a graph** — DEF-022's broader half; wants a
   read-only `Site Address` node on the same seam `Secret` uses.
4. **Nothing gives an auto-created class the columns its project has already declared.** The only
   route to a real *typo vs unwritten* distinction.
5. **A workflow step pointing at a cloud *helper* is told to deploy it**, and deploying can never
   help. The honest answer is a **sixth state**, not a rewording.

### These need Richard

- ✅ **DEF-042 is BUILT (`ccfa88b5`)** and is no longer his to decide. 🔴 **Keep the lesson: the
  "blast radius" that made the row need a ruling had never been counted.** `graphModel.addComponent`
  has **exactly ONE caller** across the runtime, both viewers and the backend — twelve lines above
  it — and that caller was **already `async`**, as was every link above it, **already awaited**. The
  guard in `loadWorkflow` was **starved by two missing `await`s in one file**, not missing. A naive
  `grep -c addComponent` said 69; 68 were unrelated methods on other classes. ⚠️ **The class is
  narrowed, not closed**: 15 emits in `graphmodel.ts` are still un-awaited, and
  `editormodeleventshandler.ts:225` still detaches on the editor's live-edit path — the gate's last
  arm **measures** the `nodeAdded` gap so this and the code cannot drift. ⚠️ **The semantics question
  is untouched** and is still his if he wants it: whether two projects on one backend *should*
  collide at all (namespace per bundle / refuse the second / last-writer-wins). Today the second
  deploy is refused, loudly, with the previous version still serving.
  ✅ **The drive is committed**: `scripts/devtools/drive-def042-duplicate-component.js` — build
  **both** arms, `dist/` is gitignored and the artefact on disk may be days old.
- **§3 — the backend card cannot see a backend-side change.** Never re-measured (needs a screen).
  ⚠️ Not a defect in DEF-015's fix and the header is honest; **the rows overclaim**. Three
  candidates — refresh on open, poll while visible, or reword to *"at last push"*. 🆕 **DEF-047
  makes the reword a one-line change**: every row's sentence now lives in `cloudFunctionRows` and
  nowhere else. It is still a design choice with a cost, so it is his.
- **§4 — `Record.Fetched` fires when the `Id` merely binds.** The description half is fixed. The
  behaviour half needs **a corpus count of graphs relying on the bind-time firing** — get the
  number, *then* ask him. The number is the decision.
- **No semantic token for error TEXT.** `--destructive` is **4.38:1** as 14px type on `--surface`;
  `fieldError` ships `--red-700`, which **no preset re-themes**. Needs a value in `DefaultTokens.ts`
  **and in all five presets**, each chosen against the contrast floor.

### Rows registered at `NONE` (all small, none blocking)

- **`ComponentItem.tsx:188` refuses a cloud function inside a cloud function and its stated reason
  is now FALSE** — *"a name the backend's `/functions/:name` route cannot address"*. Since DEF-045
  it can. The **behaviour** was deliberately left alone (SPR-005 made it a visible disabled row);
  the comment is what is stale.
- **The `/functions` 404 body still cannot tell *"no such function"* from *"wrong address"*.**
- **`variablenode2.ts`'s `name` setter** was excluded from DEF-046 because its `else` branch does
  real work — a comparison there would change *which branch runs*.
- **The missing SQLite engine** blinds every backend HTTP drive on this box. An environment row.

---

## The harness facts that will cost you an hour if nobody tells you

- **`better-sqlite3` is not installed and Node is 20.11.1.** Every `nodegx-backend` spec that
  constructs a `BackendService` dies in `beforeAll` — six route-table suites read **59 failed / 40
  passed** and *all 59* are that one error. `noodl-runtime`'s floor here is **146 passed / 5
  failed** (`LocalSQLAdapter.*`, `QueryBuilder`, `SchemaManager.changeColumnType`). ✅
  `new BackendService({ …, allowEphemeral: true })` runs a test that needs no database; no shipped
  spec passes it. 🔴 **A fix whose own gate cannot run is verified by nothing** — re-make the
  assertion in a spec that runs, or say plainly that the gate was not taken.
- ⚠️ `tsc -p packages/nodegx-backend/tsconfig.tests.json` **cannot complete here** — OOM at 4 GB
  (exit 134) and SIGTERM at 9 GB after ten minutes (exit 143), with **0 `error TS` lines either
  way**. CI runs it. **Gate on the exit status, never the error count.**
- ⚠️ **The shell cwd persists between Bash calls.** A `cd` in one call made a later
  `git diff -- packages/...` print nothing, which reads exactly like *"that file is clean"*; the
  only tell was a `warning: could not open directory`. Put `cd <repo root> &&` in front of any call
  whose answer is an **absence**.

---

🔴 **A closed phase is not a sealed one.** This is the **fifth** session running to find real work
behind a DONE banner, and the fourth to find the work was not shaped like the row describing it.
The failure mode has now repeated in three distinct forms: a row **wrong about its own reach**
(DEF-045), **wrong about its own size** (DEF-046), and **wrong about what would make it cheap**
(DEF-047). *"Is this still true?"* catches none of them.
