# Phase 80 — next session

🟡 **44 of 45 rows in the table are ✅. The one that is open needs Richard, not a session.**

Session 44 (2026-09-03) answered Richard's *"are there defects recorded but not scoped for 0.2.2?
I'd like to tackle them"* — thirteen were, he picked three, and all three are built and gated as
**DEF-044 / DEF-045 / DEF-046**.

🔴 **Derive the board from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row
out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$3); print ($3 ~ /^✅/) ? "done" : "open"}' | sort | uniq -c
```
Reads **44 done / 1 open** over **45 rows** at the time of writing.

⚠️ **Next free id is `DEF-047`.** 🔴 **`DEF-043` is CLAIMED BY PHASE 82 and has no row here** — the
deprecated `DbCollection`'s copy of the failed-fetch defect, measured but unwritten. **Read the
claim line in the header of [UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md), not the
highest number in the table** — s44 took an id, and a peer had claimed the next one **while s44 was
building in another repository**.

---

## 🔴 FIRST: NOTHING IS COMMITTED, AND TWO SESSIONS' WORK IS IN THE TREE

**s44's changes span two repositories and neither is committed:**

| repo | files |
| --- | --- |
| `nodegx-community` (`/Users/richardosborne/vscode_projects/nodegx-community`, on `2bce720`) | `src/lib/projecttemplates.ts` + 5 spec files — **DEF-044** |
| `OpenNoodl` | `nodegx-backend/src/server/HttpServer.ts`, `tests/ops-{request-id,rate-limit}.test.ts`, new `tests/def045-nested-function-address.test.ts`, `noodl-editor/tests/cloud/cloudFunctions.test.ts` — **DEF-045** |
| `OpenNoodl` | `noodl-runtime/src/{node.ts,run-on-value-change.ts}`, 10 node files, `test/corpus/nda-012-…`, new `test/corpus/def046-unchanged-value-reruns.test.ts`, `noodl-types/src/runtime/node-definition.d.ts`, `nodegx-node-kit-types/src/index.d.ts` — **DEF-046** |

🔴 **AND s43's cluster is still uncommitted and unowned** — a phase-82 session named it in
`7d651798` and had to carry two of its files in `eff946c6` because the hunks interleaved.
Reportedly: `NodeGraphModel.ts`, `NodeOperations.ts`, `NodeGraphEditorConnection.ts`,
`ComponentLoader.ts`, `projectmodel.editor.ts`, `io/Project{Ex,Im}porter.ts`,
`nodegraphmodel/connectionEnds.ts`, `tests/models/index.ts`, plus untracked
`tests/models/RootNodeUndo.test.ts` and `tests-unit/def-039..041`. ⚠️ **That set came from mtime
clustering — a heuristic, not a measurement. Confirm before committing.** TASKS.md records
DEF-039/040/041 as BUILT, so **the register and the tree disagree**, and they will keep disagreeing
until somebody lands it.

✅ Use `git commit <pathspecs>`, **never stage** — a sibling's commit sweeps staged files, and this
checkout has live peers. ⚠️ `git add` untracked files first; a pathspec commit **skips them
silently**.

---

## 🧭 THE ONE OPEN ROW IS RICHARD'S — DEF-042

[DEF-042](DEF-042-A-THROWING-LISTENER-KILLS-THE-BACKEND.md) is **measured, diagnosed and
deliberately unbuilt**. A session cannot advance it; it needs a decision about blast radius.

**Reproduced at HEAD** against the committed `dist/cli.js`, no editor: two `PUT`s declaring the
same cloud component name → PUT 1 **200**, PUT 2 **no response at all**, status **refused**,
`EXIT=1`.

🔴 **The row's own recommendation measured WRONG.** It called *"catch the rejection so the PUT
answers 400"* small, clearly right and ruling-free. **That try/catch has been in `loadWorkflow`
since WFA-001** — verified in the built bundle — and **never runs**. `EventSender.emit` is `async`;
`GraphModel.addComponent` calls it **without awaiting**; the listener's throw rejects a promise
nobody holds, so it never joins the chain the catch is watching and Node exits instead.

**The decision:** awaiting the emit makes `addComponent` async and ripples into **`noodl-runtime`,
shared with the viewer**. A backend-local `unhandledRejection` guard is cheap and *wrong alone* —
it returns `{success:true}` for a half-written component registry, replacing a loud failure with a
quiet one on the one code path whose whole design is *"only a complete success swaps it in."*

⚠️ `graphmodel.ts` has **15** un-awaited `this.emit(...)` calls. `componentAdded` is only the one a
person has met. ⚠️ s43 left a spec at `nodegx-backend/tests/def-042-detached-emit.test.ts`.

---

## What session 44 did, and 🔴 the lesson that outranks all three fixes

| row | outcome |
| --- | --- |
| §9 → [DEF-044](DEF-044-A-TEMPLATE-WITH-NO-HOME-REACHES-THE-SHELF.md) | ✅ built — the home gate at **both curated doors**, in the `nodegx-community` repo |
| folder-404 → [DEF-045](DEF-045-A-CLOUD-FUNCTION-IN-A-FOLDER-HAS-TWO-ADDRESSES.md) | ✅ built — 🔴 **the row's headline claim was FALSE** |
| RoVC → [DEF-046](DEF-046-AN-UNCHANGED-VALUE-RE-RUNS-THE-NODE.md) | ✅ built — 🔴 **the row's SIZING was wrong by 3×** |

Read each row's own file, not this table.

### 🔴 ALL THREE DEFECTS WERE REAL AND TWO ROWS WERE WRONG ABOUT THEMSELVES

**A staleness check would have confirmed every one of them and shipped the wrong fix.** This is the
fourth session running to find that a register row decays in a way *"is this still true?"* cannot
detect.

1. **DEF-045 — the row said *"unreachable over HTTP"*. It was reachable.**
   `POST /functions/site%2FpublishPage` answered **200** at HEAD, and every in-product caller
   percent-encodes. Only the **raw-slash** address 404'd. 🔴 **A second file in the same repo had
   already measured the other half** — `newFunctionFromStep.ts:44-52` (SB-003) records *"nested
   names are shipped practice … and work on every call path"* — **and neither row knew the other
   existed.** Two half-measurements, each reading as a verdict on the other's question.
   ✅ **Before believing a register row, grep the SOURCE for a second measurement of the same
   mechanism.**

2. **DEF-046 — the row was real and mis-SIZED.** *"Four lines per family, twelve families"*
   re-derives as **39 call sites across 15 files in three shapes**, and **nine are event handlers
   with no previous value to compare** (`cloudStoreEvents`, `onModelChangedCallback`,
   `collectionChangedCallback`). Building it as one idiom would have broken the data nodes.
   ✅ **Re-derive a row's SIZE, not just its truth — the size is what decides the design.**

3. **DEF-044 — the row waited three days for a ruling it already had.** It recorded the choice as
   🧭 *a decision*, noting *"only the person's door has been ruled on"*. Richard's **2026-08-31**
   words are unqualified: *"A project with no home page must not publish as a template."*
   ✅ **When a row says *needs a ruling*, check whether the ruling exists and is BROADER than the
   row that prompted it.**

---

## 🔴 The harness fact that will cost you an hour if nobody tells you

**`better-sqlite3` is not installed on this machine and Node is 20.11.1** (no usable `node:sqlite`,
which wants ≥ 22.13). Measured 2026-09-03:

- **Every `nodegx-backend` spec that constructs a `BackendService` dies in `beforeAll`.** Six
  route-table suites read **59 failed / 40 passed** and *all 59* are that one error.
  `cloud-csv-nodes`, `cloud-secret-node`, `sb008-public-site-drive`, `ops-request-id`,
  `ops-rate-limit`, `service-http` — **none of them can run here.**
- **`noodl-runtime`'s floor on this box is 146 passed / 5 failed** — `LocalSQLAdapter.*`,
  `QueryBuilder`, `SchemaManager.changeColumnType`, all *"No SQLite engine available"*. **That is
  the floor, not a regression.**
- ✅ **`new BackendService({ …, allowEphemeral: true })` runs a test that needs no database.** No
  shipped spec passes it, which is exactly why none of them run.
- ⚠️ `tsc -p packages/nodegx-backend/tsconfig.tests.json` **cannot complete here** — OOM at the 4 GB
  default (**exit 134**) and SIGTERM at 9 GB after 10 minutes (**exit 143**), with **0 `error TS`
  lines either way**. CI runs it. Gate on the exit status, never the error count.

🔴 **A fix whose own gate cannot run is verified by nothing.** DEF-045 renames a route pattern that
`ops-request-id` and `ops-rate-limit` assert; both are unrunnable, so **both assertions are re-made
inside `def045-nested-function-address.test.ts`**, which does run. Do the same, or say plainly that
the gate was not taken.

---

## Gate readings actually taken by s44 (2026-09-03, on top of `7d651798`)

| gate | reading |
| --- | --- |
| `nodegx-community` — the two target suites | **96 passed (96), exit 0** |
| `nodegx-community` — 4 neighbouring publish suites | **92 passed (92), exit 0** |
| **DEF-044 reverted arm** (guard disabled with `false &&`) | **exit 1 — exactly 4 refusal specs red, 92 controls green** |
| `tsc` community | exit 0 |
| `def045-…test.ts` before / after | **exit 1 (1 red of 4)** / **exit 0 (6/6)** |
| `tsc -p packages/nodegx-backend` | exit 0 |
| `def046-…test.ts` before / after | **exit 1 (3 red of 7, every control green)** / **exit 0 (7/7)** |
| full `noodl-runtime` suite | **146 suites, 2566 passed**, 5 red = the SQLite floor above |
| `tsc -p packages/noodl-runtime` · `packages/noodl-viewer-react` | exit 0 · exit 0 |
| `nodegx-node-kit-types` | 77 passed, **5 failed — identical before and after**: pre-existing mirror drift on `placeholder` (added to `noodl-types` 2026-08-24, `06520033`) |

🔴 **`test:ci` was NOT run by s44.** The last reading is s43's: **2938 specs, 4 failures, seed 60967,
HEAD `da055635`**, all four the known **`AIX-006 style vocabulary`** floor checked **BY NAME**. A
phase-82 peer reported **2943 specs / 4 AIX-006** later the same day with s43's pile present.
**s44 changed `noodl-runtime`, `noodl-types` and `nodegx-backend`, and none of that is covered by
either reading. Run it.**

---

## What is left, in the order a session should take it

### An agent can do these alone

1. **§3 — the backend card cannot see a backend-side change.** Never re-measured (needs a screen).
   The `missing` row can only ever render after a *failed* push. ⚠️ Not a defect in DEF-015's fix
   and the header is honest; **the rows overclaim**. The cheapest candidate — *reword to say “at
   last push”* — may simply be right.
2. **A stale cloud function renders twice** — a green ✓ and a warning triangle, one line apart.
   `CloudFunctionsSection.tsx:138` maps the unfiltered list above `:162`'s `stale.map`. **Trivially
   fixed**; the only reason it is not done is that it is a rendering choice DEF-015 did not touch.
3. **§6 — `group.ts` cannot be imported from a test**, so the most-used visual node is ungraded and
   the failure mode reads as `Tests: 0 total`. Already measured. ⚠️ **Measure the blast radius
   first**: whether a `.js` transform in that package's jest config moves any of its 86 suites.
4. **§5 — the `domelement` port cannot reach the destination its own description names.** ⚠️ **Four
   generated copies of the description.** 🔴 And the wire would not have worked if it had connected
   (`Group.tsx:113` wants the node, `Video.tsx:217` sends the element).
5. **The configured site address is unreachable from a graph** — DEF-022's broader half; wants a
   read-only `Site Address` node on the same seam `Secret` uses.
6. **Nothing gives an auto-created class the columns its project has already declared.** It is the
   only route to a real *typo vs unwritten* distinction.
7. **A workflow step pointing at a cloud *helper* is told to deploy it**, and deploying can never
   help. The honest answer is a **sixth state**, not a rewording.

### These need Richard

- **DEF-042** — above. The first thing to put in front of him.
- **§4 — `Record.Fetched` fires when the `Id` merely binds.** The description half is fixed. The
  behaviour half needs **a corpus count of graphs relying on the bind-time firing** — get the
  number, *then* ask him. The number is the decision.
- **No semantic token for error TEXT.** `--destructive` is **4.38:1** as 14px type on `--surface`;
  `fieldError` ships `--red-700`, which **no preset re-themes**. Needs a value in `DefaultTokens.ts`
  **and in all five presets**, each chosen against the contrast floor.

### 🆕 Four rows s44 registered at `NONE` (all small, none blocking)

- **`ComponentItem.tsx:188` refuses a cloud function inside a cloud function and its stated reason
  is now FALSE** — *"a name the backend's `/functions/:name` route cannot address"*. It can now.
  The **behaviour** was deliberately left alone (SPR-005 made it a visible disabled row); the
  comment is what is stale.
- **The `/functions` 404 body still cannot tell *"no such function"* from *"wrong address"*.**
- **`variablenode2.ts`'s `name` setter** was excluded from DEF-046 because its `else` branch does
  real work — a comparison there would change *which branch runs*, which is a behaviour question.
- **The missing SQLite engine** blinds every backend HTTP drive on this box. An environment row.

---

🔴 **A closed phase is not a sealed one.** This is the **fourth** session in a row to find real work
behind a DONE banner — and the second to find that the work was not shaped like the row describing
it.
