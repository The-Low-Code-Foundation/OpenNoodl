# Phase 80 — next session

🔴 **Both open rows now need a HUMAN, not a build.** Session 40 built and drove DEF-036's
parts 1 and 2 — AC1 through AC5 — and what is left of that row is a single 🧭 question about
part 3. DEF-007's last AC is still blocked on a curated template being publishable at all.
**So the first job of the next session is to put the two questions below to Richard, and then
to pick up whichever row he opens.** ⚠️ **Do not build part 3 speculatively**: under Option B
it contradicts DEF-034, which was ruled deliberately.

🔴 **Read [DEF-036 §9](DEF-036-THE-USER-FAMILY-HAS-NO-NET.md) first** — what shipped, what it
was driven against, and the three things it deliberately does not cover. Then §6's close for the
part-3 question. ⚠️ **§8 is the OVERRULED Option A set, evidence only — do not build it.**

---

## The board

**37 rows. 35 ✅ · DEF-007 🟡 · DEF-036 🟡.**

🔴 **Derive it from the STATUS COLUMN, never `grep -av '✅'`** (a ✅ in prose filters the row out):

```
grep -aE '^\| DEF-0[0-9]{2} \|' TASKS.md | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2" :: "$3}'
```

🔴 **Re-derive any "owed" list from the ROW FILES, never from this handoff.**

---

## What session 40 did

**Built DEF-036 parts 1 and 2 — Option B, as ruled. No wire declares a column.** Commit
`ac28160d`, 16 files, 1364 insertions.

The change that made everything else possible was one retained field. §5 said the sentence AC1
wants *"is already computed and then thrown away"*, and it was: `fetchBuiltInSchema` has told
*no backend attached* from *attached but not running* since DEF-035, and `_fetch` reduced the
whole outcome to `decision.write`, a boolean. **Nothing in the editor could show it because
nothing kept it.**

| # | what | where |
| --- | --- | --- |
| 1 | the outcome carries a `cause` **code** — never prose to match — and a ref to the backend that answered | `utils/schemaCachePolicy.ts` |
| 2 | `SchemaHandler.lastOutcome` keeps it; `SCHEMA_OUTCOME_CHANGED` fires only when the answer changes | `utils/schemahandler.ts` |
| 3 | the judgement: which state gets which sentence, and where an Add-a-field button may point | `utils/schemaFieldNotice.ts` |
| 4 | the note and the button, drawn from **one subject** so AC2 is structural | `propertyeditor/…/SchemaFieldNoticeView.tsx`, `SchemaAddFieldButton.tsx`, `DataTypes/Ports.ts` |
| 5 | the schema editor opens on a named table | `schemamanager/SchemaPanel.tsx` |
| 6 | AC5's ignore list, in a module a spec can import | `schemamanager/serverOwnedColumns.ts` |

### The drive, in one table

Real `dev:debug` editor, fixture `NodeGX test projects/def036-dash-drive` with
`dbCollections` / `systemCollections` / `dbVersionMajor` **absent from `project.json` on a cold
load**. Live retained outcome:
`{ status: 'unavailable', cause: 'not-registered-yet', reason: 'no managed backend matches the endpoint yet' }`.

| AC | driven |
| --- | --- |
| **AC1** | a `net.noodl.user.User` node draws **“This project’s backend is still starting … this node has no fields to read …”** |
| **AC2** | same node, same moment: **0** Add-a-field buttons |
| **AC3** | `setMetaData('dbCollections', …)` live ⇒ notice **1 → 0**, `prop-*` ports **0 → 9**, **no reopen** |
| **AC4** | button reads **“Add a field to `_User`”**, `elementFromPoint` says it is the top element, click opens `backend-schema` with `panelProps.initialTable = '_User'` |
| **AC4 landing** | surface opened on a real running backend: the named row is **expanded, its columns drawn** |
| **control** | stale schema present + backend unreachable ⇒ **0 notices, 0 buttons** — a working node is never warned about |

---

## Needs a human — do not decide these alone

1. 🧭 **DEF-036 part 3: canvas or build?** *"A wire to a deleted field stays on the canvas, drawn
   dotted, and errors."* **The canvas half already ships and has been driven twice** (§6). The
   only reading left is *"and the wire should also survive the export"*, which **reverses
   DEF-034** — ruled deliberately, an `error` means *this cannot work at all* and still deletes.
   Under Option B the column genuinely does not exist, so an exported wire would deliver a value
   to nothing. **Read as the canvas — his words are *"it would remain … and the errors would
   flag"* — it is done and the row closes.** Ask it as: *did you mean the canvas, or the build?*
2. 🧭 **DEF-007 AC2** — a curated template installed **through the picker** opens on its home
   component. The picker cannot reach a curated template until one is published, so this is not
   workable from this lane. **Unchanged since s38.** Worth asking whether the row stays open on
   AC2 alone.

---

## Still owed on rows marked ✅ or 🟡 — say this before quoting them

- ⚠️ **DEF-036 AC5's RENDERING half is graded by rule only.** `serverOwnedColumns.ts` decides
  that `password`, `username`, `email`, `emailVerified`, `authData`, `createdAt`, `updatedAt`
  are the backend's on `_User`, and `tests-unit/def-036/accounts-table-columns.test.ts` grades
  that decision and the validator. **That `TableRow` applies it was not driven** — no backend
  reachable in this session had a `_User` table, and `TableRow.tsx` imports `Icon`, so a spec
  importing it fails *to run* rather than fails. Unmeasured: whether the rename affordance
  actually disappears.
- ⚠️ **DEF-036: `SignUp` was not the node driven** (it was `net.noodl.user.User`), and **no
  external-backend arm was driven**. Both have sentences and tests; neither has a drive.
- ⚠️ **DEF-036: the `status: 'schema'` arm of AC4 was driven with an INJECTED outcome**, because
  no local backend was bound to that project. What that grades is the panel wiring, not the
  fetch.
- ⚠️ **DEF-007's wiring is graded by the DRIVE ALONE.** `EditorClipboard` cannot be imported
  under this jest — it reaches `bugtracker.ts`, which calls `platform.getUserDataPath()` at
  module scope.
- ⚠️ **DEF-007: the publish refusal was never driven through the real share UI** — it needs a
  signed-in community session and a live route.
- ⚠️ **DEF-007 AC4's scan cannot see a reader that never constructs a `ProjectModel`** — code
  export, the MCP server, template generation.
- ⚠️ **DEF-037's deployed-app arm is untested end to end**; `borderColor` on Checkbox and Radio
  Button were not driven.
- ⬜ **DEF-031's and DEF-029's panel halves** both still need the property panel read out of the
  DOM. ✅ `cdp click` takes a SELECTOR — stamp an id first.
- ⬜ **DEF-005's `Roles` output has still not been driven** in a real editor.

---

## Gates — run this session, at `ac28160d`

| gate | result | exit |
| --- | --- | --- |
| `npx jest` in `packages/noodl-editor` | **6562 passed, 5 failed** | 1 |
| `npx tsc --noEmit -p packages/noodl-editor` | **0 `error TS`** | 0 |

The 5 are `sb-007` (2), `sb-018` (2), `aib-007` (1) — **the floor exactly, somebody else's open
work; do not read them as this phase's and do not "fix" them.**

🔴 **Gate on the EXIT STATUS**, captured from the command you care about. ⚠️ In zsh
`${PIPESTATUS[0]}` is empty — it is `$pipestatus[1]`, and `$?` after a pipe is the LAST command's.
Write `cmd > log 2>&1; EXIT=$?`. ⚠️ `typecheck:backend-tests` cannot complete on this box (OOM,
exit 134, zero `error TS` lines — it reads as a pass). CI runs it.

---

## Traps this session added

- 🔴 **A DECLARED DEFAULT IS NOT AN AUTHOR'S CHOICE.** The `backendId` port declares
  `default: '_active_'`, and `schema-ports.ts:490` reads that value and an absent parameter **on
  the same line** as the same thing. Asking `Boolean(getParameter('backendId'))` to mean *"this
  node names its own backend"* is **true for every Record node whose author ever chose the
  default** — the whole feature would have been off for them, silently, and the tests would have
  been green because they would have been written against the same boolean. ✅ **Put the rule in
  the graded module and write the control that asserts the default still speaks.**
- 🔴 **A COMMENT CLAIMING A REMOUNT IS NOT A MEASUREMENT OF ONE.** `SchemaPanel`'s docblock said
  a re-opened surface gets a remount, from reading `openBackendSurface`. It does not: the new
  props **do** arrive (the header changed to a marker name) and `useState` had already latched.
  Second press of the button ⇒ first node's table. ✅ **Discriminate with a marker prop**, then
  key the effect on a token, then re-drive both opens.
- 🔴 **A MUTANT THAT DOES NOT COMPILE GRADES NOTHING.** `ts-jest` typechecks `tests-unit/`, so a
  sabotage that adds an impossible `case` makes the suite report **`Tests: 0 total`** — which
  reads exactly like a passing absence. ✅ **Mutate a VALUE, not a type**: collapsing two arms to
  the same message failed 3 tests, which is the proof the first attempt could not give.
- ✅ **A `cause` CODE, NOT A `reason` STRING.** The outcome's prose interpolates a backend id and
  two of the sentences differ by one word. Choosing a user-facing message by matching substrings
  of English is how `DELIVERED-B` matched inside `NOT-DELIVERED-B`. The discriminator is its own
  field, decided in one place.
- ✅ **ONE SUBJECT FOR TWO SURFACES.** The warning and the button are both derived from a single
  read, so *"no button in the state the warning explains"* is structural. Two reads would make it
  a coincidence, and the failure would be silent in the worst direction — the button draws
  because one predicate said yes, the click goes nowhere because the other said no.

---

## The drive harness

- ✅ **The webpack seam**:
  `window.webpackChunknoodl_editor.push([['tag'],{},(r)=>{window.__req=r;}])`, then
  `__req('./src/editor/src/models/projectmodel.ts')`. **Module ids are readable source paths and
  the extension is real** — `NodeGraphContext.tsx`, not `.ts`. ✅ **List them first:**
  `Object.keys(window.__req.m).filter(k=>/name/.test(k))`. It costs one call and saves a guess.
- ✅ **To select a node**: `__req('./src/editor/src/contexts/NodeGraphContext/NodeGraphContext.tsx')
  .NodeGraphContextTmp.switchToComponent(comp, {pushHistory:true})`, then
  `ctx.nodeGraph.findNodeWithId(id)` and `ed.selectNode(view)`. ⚠️ **`ed.model.roots` are MODEL
  nodes; `ed.roots` are the views** — `findNodeWithId` takes the guesswork out of both.
- ⚠️ **`project.forEachComponent` gives components whose graph has `roots`, not `nodes`.** Walk
  `graph.roots` and recurse `n.children`. And **never return a truthy value** from the callback.
- 🔴 **A reload drops you back to the LAUNCHER and unregisters the backend surfaces** — they are
  installed by `installSidePanel` on project open. Reopen the project before calling
  `openBackendSurface`, and push the seam again.
- 🔴 **HMR does not re-render an already-mounted component with new module code.** After an edit,
  wait for `compiled successfully` in `.logs/dev.log`, then `cdp reload`, then **verify** with
  `Component.toString().includes('yourNewIdentifier')` before believing a negative reading.
- ✅ **A real local backend is one IPC call away**: `ipc.invoke('backend:list')`,
  `backend:start`, `backend:status`, `backend:getSchema`. **Stop it again when you are done.**
- ✅ **To open a project**: stamp the launcher card (`div[class*=Card--]`), `scrollIntoView` —
  the grid is thousands of px tall — then `cdp click`. 🔴 **Settle which project is loaded by
  `_retainedProjectDirectory`, never the card title.**
- ⚠️ **Filter `[class*=MeasuringContainer]` out of every DOM count** — `BaseDialog` renders twice.
- ⚠️ **`def036-dash-drive` has been restored to its COLD state** (schema keys absent from
  `project.json`). Opening it and letting the editor run will not repopulate them — there is no
  managed backend for its endpoint — but **a live `setMetaData` will**, so strip them again if
  you use it as the empty arm.
- ✅ `npm run dev:stop` reaped 26 of its own processes and shielded the peers' MCP servers.

## Unowned rows — eight

[UNOWNED-ROWS-TO-MEASURE.md](UNOWNED-ROWS-TO-MEASURE.md). **Row 8 is the strongest**: *undo
restores the deleted home NODE and leaves the project with no home*, so the damage is not fully
undoable. **Measure one row fully before starting the next.**
⚠️ Next free id is **`DEF-038`**.
