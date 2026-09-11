# DEF-036 — the Record family keeps its wires without a schema; the User family does not

**Status:** 🟡 **AC1–AC5 BUILT AND DRIVEN (s40). AC6 driven. AC7 at the floor.** Owner: **phase 80**.
🔴 **What is left is part 3 alone, and it is a 🧭 question for Richard, not a build** — see §6's
close and the handoff. Read **§9** for what shipped, what it was measured against, and the two
things it deliberately does not do.
**Found by:** DEF-035's AC5 drive (2026-08-31, s34), §6.3.
**Who it bites:** every app whose sign-up or profile screen wires a custom column on the
accounts table — **271 wires across 21 of the 118 corpus projects.**

---

## 1. The person sentence

**Your sign-up form quietly stops writing the fields you added to it, and your build is
the first place you find out.** Nothing is reported: the wires are on the canvas, they
are absent from the artefact, and the artefact does not say what it dropped.

## 2. The mechanism

Both families mint their `prop-<column>` ports from the introspected schema through
`resolveSchemaPortContext`. Only one of them has a second producer for when there is no
schema to read.

⚠️ **The User family is not one code path but two**, and neither has a net. Naming both
matters: a fix applied to one leaves the other exactly as it is.

| | Record family | User family — path 1 | User family — path 2 |
| --- | --- | --- | --- |
| nodes | `DbModel2`, `NewDbModelProperties`, `SetDbModelProperties` | `net.noodl.user.User`, `net.noodl.user.SetUserProperties` | `net.noodl.user.SignUp` |
| where | `noodl-runtime/…/data/` | `noodl-runtime/…/user/user-ports.ts` | `noodl-viewer-react/…/user/signup.ts` |
| schema-half producer | `recordFieldPorts` | `userPropertyPorts` via `userSchemaContext` | an inline loop in `updatePorts` |
| reads | the introspected schema | `ctx.selectedCollection` | **`systemCollections` metadata**, looking for `_User` |
| gives up when it is empty | — | `if (!ctx.selectedCollection) return ports` (`user-ports.ts:242`) | `if (c && c.schema && c.schema.properties)` never enters (`signup.ts:215`) |
| **wire-half producer** | **`recordWiredFieldPorts`** — `dbmodelcrudbase.ts:392`, `dbmodelnode2.ts:554` | **none** | **none** |
| ports with the schema empty | every field a wire names, typed `'*'` | **none at all** | **none at all** |

🔴 `_store()` writes `dbCollections` **and** `systemCollections` in the same act, so one
wipe takes out both paths at once — which is why the drive lost wires on `User` and on
`SignUp` in the same export.

`recordWiredFieldPorts` (`record-ports.ts:312`, built by P77 **SBR-008** for the deploy
path) walks the node's own connections and mints `prop-<field>` for any field a wire
names that the schema half did not cover. Its docblock states the rule plainly: **"the
wire is the declaration."**

`user-ports.ts` has no such call. `userSchemaContext` resolves the accounts table out of
`base.collections`; with the schema cache empty that list is empty, `selectedCollection`
is `undefined`, and the node offers no `prop-*` port. The wires into and out of it are
then `con-no-target-port` / `con-no-source-port`, both **`level: 'error'`** — and
DEF-034 established that an error is exactly what still deletes a wire from an export.

⚠️ **This is not DEF-035.** DEF-035 stopped the cache being *wiped over an answer we did
not get*. This is what happens on a read that is genuinely empty, or before the first
successful read of a project's life — a case DEF-035 deliberately leaves alone, because
"the backend says it has no tables" is an answer and must be recorded as one.

## 3. The measurement

Driven, not derived — DEF-035 §6. A copy of `LearnBook`, real editor, real export:
with the schema cache emptied, **14 wires left the build and all 14 were
`net.noodl.user.*`.** No Record wire moved. The corpus predicate agrees on the same
fixture at 14, and over all 118 projects splits the population:

| | wires | projects |
| --- | ---: | ---: |
| Record family — protected by `recordWiredFieldPorts` | 3,579 | — |
| **User family — unprotected** | **271** | **21** |

Worst: `emdashdev` 53 · `Resourceful` 33 · `30d29729-…` 26 · `SuntappedX` 16 ·
`LearnBook` 14.

🔴 **The corpus is a regression net, not a ranking.** These are the projects on this
machine; the product surface is every app anyone builds a sign-up form in.

## 4. Acceptance criteria — 🔴 **REWRITTEN for Option B, 2026-08-31 (s39)**

⚠️ **The Option A criteria this section used to hold are preserved in §8**, because the
measurements taken against them (the 271 wires, the 14-wire drive) are still the evidence for
this row and a reader who finds only the new ACs will not know what was rejected or why.
🔴 **Do not build §8. It was overruled** — see [RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) §1.

**The shape Richard ruled:** a wire must NOT declare a column on the accounts table. The schema is
meant to be thought about first, and the fix is to **make the schema visible from where the person
is standing**, not to route around it. So every criterion below is about the node's own surface.

⚠️ **Our internal DB only.** Richard said so explicitly. `Add a field` must not offer itself for a
project pointed at an external Parse or REST backend — there is no schema editor to jump into.

### The part that closes the person sentence

- **AC1 — the explanation exists.** A User-family or Record-family data node whose schema cannot
  be read **says so on its own surface**, in place of the field list: distinguishing *no backend is
  attached to this project* from *a backend is attached but is not running / could not be reached*.
  🔴 **These are two different sentences with two different next actions** and one message covering
  both is the defect restated. Today the node shows **no ports and no explanation** — that silence
  is what makes the dropped wires unreadable.
- **AC2 — nothing pretends.** In that state the node offers **no `prop-*` ports and no Add-a-field
  button**. An Add button that cannot reach a schema editor is a second dead end.
- **AC3 — it clears itself.** When a backend becomes reachable and the schema arrives, the warning
  goes and the field list appears **without reopening the project**. ⚠️ Driven, not asserted:
  s39 measured that `setMetaData('dbCollections', …)` re-mints the ports on the live nodes within
  one repaint, so the seam for this already exists.

### The way out

- **AC4 — the button is where the question is asked.** An **"Add a field"** control on the data
  node's own panel, opening the schema editor **for the table already chosen in that node's
  dropdown** — not the data editor's front door. If no table is chosen, it must not silently pick
  one.
- **AC5 — the ignore lists are still honoured.** The schema editor reached this way must not
  present `authData`, `password`, `username`, `createdAt`, `updatedAt`, `emailVerified` or `email`
  on `_User` as ordinary author-editable columns. **This is the surviving half of the old AC3**:
  Option A had to keep a *wire* from resurrecting one of these; Option B has to keep a *person*
  from being invited to. The list is the same list.

### Unchanged from Option A

- **AC6 — driven.** Reproduced on `NodeGX test projects/def036-dash-drive` (§6's fixture, cold,
  schema absent from disk): the node shows the explanation, and the Add button reaches the right
  table. ⚠️ **The old AC4 asked that the 14 wires export; under Option B they still do not, and
  that is intended.** What is graded now is that the person is told why.
- **AC7 — `test:ci` returns to its known floor.**

🔴 **What Option B deliberately does NOT fix.** The 271 wires across 21 projects still leave the
build when the schema is cold, silently, and this row will close with that still true. **DEF-035
is what stops the cache being wiped**; this row makes the remaining case legible rather than
survivable. If that trade is wrong the place to reopen it is the ruling, not these criteria.

## 5. What to read first

- `packages/noodl-runtime/src/nodes/std-library/data/record-ports.ts:312` —
  `recordWiredFieldPorts`, including the cost its own docblock states: a mistyped
  `prop-titel` writes a `titel` column instead of warning. **The same cost transfers**,
  and it is Richard's call whether the accounts table should accept it — a stray column
  on `_User` is not the same kind of accident as one on an app table.
- `packages/noodl-runtime/src/nodes/std-library/user/user-ports.ts:237` —
  `userPropertyPorts`, whose first line is the give-up; its callers are
  `user.ts:492` and `setuserproperties.ts:257`.
- `packages/noodl-viewer-react/src/nodes/std-library/user/signup.ts:203` — the second
  path, in a different package, keyed on a different metadata key. ⚠️ **It is not
  reachable from `user-ports.ts` and will not be fixed by fixing that file.**
- P77 `SBR-008-THE-DEPLOY-KEEPS-THE-PANELS-WIRES.md` §the-writers-table — the design
  that already exists, and the reason it was only ever pointed at one family.

### 🔴 The three seams Option B needs — located 2026-08-31 (s39), so the next session plumbs rather than hunts

**1. The sentence AC1 wants is already computed, and then thrown away.**
`packages/noodl-editor/src/editor/src/utils/schemahandler.ts:213` — `fetchBuiltInSchema` returns a
**`SchemaFetchOutcome` carrying a `reason` string**, and it already draws exactly the line AC1
draws:

| outcome | reason | AC1's sentence |
| --- | --- | --- |
| `not-applicable` | *"the project has no backend endpoint"* | **no backend is attached** |
| `not-applicable` | *"the endpoint is a `<type>` server we hold no key for"* | external backend — ⚠️ **out of scope, Richard's rider** |
| `unavailable` | *"backend `<id>` is not running"* | **attached, not running** |
| `unavailable` | *"no managed backend matches the endpoint yet"* | attached, still starting — DEF-035's heal window |
| `unavailable` | *"returned no readable table list"* | attached and running, but not answering |
| `schema` | — | fine; show the fields |

🔴 **`_fetch` (`:140`) consumes the outcome only through `decideSchemaCache` and keeps nothing.**
`decision.write` is a boolean; the `reason` is dropped on the floor. **Nothing in the editor can
display it because nothing retains it.** Retaining the last outcome on the `SchemaHandler` is the
smallest change that makes AC1 possible, and it is the whole reason the node can say *no ports*
today but not *why*.

⚠️ **Do not re-derive this state in the panel.** A second computation of "is there a backend" is
the [second-palette-copy](../../../dev-docs) shape — two answers that drift. Read the one
`schemahandler` already has.

**2. Where the node's field list is rendered.**
`packages/noodl-editor/src/editor/src/views/panels/propertyeditor/` — `propertyeditor.ts` and
`components/PortsTab/PortsTab.tsx`. ⚠️ **`PortsTab.buildRows(model, direction)` is the function
P80 DEF-029 already found filters dynamic ports**, so it is the surface that renders *nothing*
today when `userPropertyPorts` returns `[]`.

**3. Where AC4's button can jump to.**
`views/panels/BackendServicesPanel/LocalBackendCard/backendSurfaces.tsx:111` registers the
`data` surface (`DataBrowser`), reached by `openSurface('data')`
(`LocalBackendCard.tsx:460`). ⚠️ **No table-selection argument was found on that call** — whether
`DataBrowser` can be opened *on a named table* is **unmeasured**, and AC4 says the front door is
not good enough. **Settle that before promising AC4**; if it cannot, adding the argument is part
of the job rather than a surprise in the middle of it.

🧭 **A decision, not only a fix.** AC1 is straightforward; whether the accounts table
should get the same "the wire is the declaration" rule as an app table is a product
judgement, and this row should not be built as if it were not.

---

## 6. 🔴 Part 3 measured before building — 2026-08-31, s38. **The canvas half already ships.**

The ruling's *"what to check before building"* asked whether a missing schema field reaches the
dashed state or goes straight to `level: 'error'` and silent deletion. **Checked at HEAD, and the
answer splits the sentence in two.** Read from source, not driven — see the boundary at the end.

| Richard's clause | today | where |
| --- | --- | --- |
| *"it would remain"* on the canvas | ✅ **already true** | nothing prunes it — see below |
| *"but be a dotted line"* | ✅ **already true** | `NodeGraphEditorConnection.ts:1081` in `paint` — `:960` is `restoreWireDash`, the same rule re-applied after a solid mark |
| *"the errors would flag that the port doesn't exist anymore"* | ✅ **already true** | `con-no-target-port`, `level: 'error'`, `showGlobally: true` |
| dropped from the **build** | 🔴 **true, and this is the whole gap** | `utils/exporter/util.ts:122`, `{ levels: ['error'] }` |

**The three readings.**

1. **Nothing prunes the connection.** `removeConnection` is reached only from
   `removeConnectionsForNode` (a node being deleted) and explicit gestures.
   `evaluateConnectionHealth` *records a warning* and never deletes. A wire whose port vanished
   stays in `comp.graph.connections`.
2. **It is already dashed, and for the error level specifically.**
   `NodeGraphEditorConnection.paint` reads `if (!this.getHealth().healthy) ctx.setLineDash([5])` (`:1081`).
   🔴 **The canvas passes no `levels` narrowing** — that argument is `exportComponent`'s alone —
   so an `error` verdict dashes exactly like a `warning` one. DEF-034's own note says so in
   passing: *"The dash comes free either way — `getConnectionHealth` turns any unhealthy verdict
   into `setLineDash([5])` in every paint path."*
3. **The export is the only place the wire disappears.** `exportComponent` asks with
   `{ levels: ['error'] }` and pushes only `health.healthy` connections.

### 🔴 So the ruling's sentence *"today they are dropped, not dashed"* is HALF right

**Dropped from the build: yes. Not dashed: no — they are already dashed and already flagged.**
That phrasing entered this file from the ruling summary and I am correcting it here rather than
leaving two documents disagreeing. ⚠️ **A session that took it literally would go looking for a
dash that already exists and would report the work as done without changing anything.**

### 🧭 What is left is a DECISION, and it should not be guessed at

The only thing part 3 could still change is **whether such a wire survives the export**, and that
is not obviously what Richard asked for:

- His sentence is about the **canvas** — *"it would remain … and the errors would flag"* — which
  is the surface that already behaves that way. Read narrowly, **part 3 is already satisfied and
  the correct action is to close it, not build it.**
- Read as *"and it should also still be in the build"*, it **contradicts DEF-034**, which was
  ruled deliberately: an `error` means *"this cannot work at all"* and still deletes. Under
  Ruling B the column genuinely does not exist, so an exported wire would deliver a value to
  nothing — and the runtime has no port to receive it.

⚠️ **Ask before building.** The cheap, non-contradicting reading is that part 3 is already met,
and the remaining value in this row is **parts 1 and 2** — which the ruling itself calls the part
that closes the person-sentence: *"an empty schema today produces no ports **and no
explanation**."* The explanation is still missing, and nothing measured here changes that.

### ⚠️ The boundary on this measurement

**Read at HEAD, not driven.** The three readings above are source; no wire to a deleted schema
field was watched being painted in a running editor this session. What would settle it is opening
a project with a `net.noodl.user.*` node, emptying the schema cache (DEF-035 §6's recipe), and
looking at the canvas — the dash and the Problems-panel entry are both observable there.

### ✅ The boundary is closed — DRIVEN 2026-08-31, s39. All four clauses observed.

The measurement above was read at HEAD. **It has now been driven, and it holds.** A real
`npm run dev:debug` editor, a real project, the schema cache genuinely absent from disk.

**Fixture.** `NodeGX test projects/def036-dash-drive` — a **copy** of `Noodl projects/LearnBook`
(`md5 2bd73d17faf57d1629870e0cf528fe87`, the same pristine copy DEF-035 §6 used), with
`dbCollections`, `systemCollections` and `dbVersionMajor` **deleted from `project.json` on disk**
before it was ever opened. 2,719 connections on disk, 211 components, **14** `net.noodl.user.*`
`prop-*` wires — derived from the file, and the same 14 DEF-035 measured independently.
Identity settled by `_retainedProjectDirectory`, not by the card title.

**Instrument.** `NodeGraphEditorConnection.prototype.paint` wrapped to record, per wire and per
paint, `getHealth().healthy`, whether each endpoint port resolved, and **every `setLineDash`
argument passed while that wire was painting** — `ctx.setLineDash` swapped for the duration of
the call and restored in a `finally`. That is a reading of the real canvas context in the real
paint, not a re-derivation of the condition.

| Richard's clause | driven result |
| --- | --- |
| *"it would remain"* | ✅ still in `comp.graph.connections`, and still painted — it appears in the paint log at all |
| *"but be a dotted line"* | ✅ **`setLineDash([5])` recorded inside its own paint** — `net.noodl.user.User:prop-trainer -> Expression:trainer`, `healthy:false`, `fromPortResolved:false` |
| *"the errors would flag …"* | ✅ `con-no-source-port`, `level:'error'`, `showGlobally:true`, message *"Source port doesn't exist."*; topbar read **⚠ 174**, `getTotalNumberOfWarnings({levels:['error']})` = **178** |
| dropped from the **build** | ✅ **2,587 → 2,573**, and by name **14 lost, 0 gained** |

### The controls, run from the searched population

- 🔴 **Same paint pass, same command, healthy wires recorded no dash.** Nine other wires painted
  in that pass (`Router:didMount -> Do`, `orgAdminRole -> prop-adminRole`, `Expression:isTrueEv
  -> Do`, …) all reported `healthy:true`, both ports resolved, and `setLineDash` arguments of
  `[]` or nothing — **never `[5]`**. So the dash is not something every wire on this canvas gets.
- 🔴 **The same wire goes solid when the schema returns.** `setMetaData('dbCollections' |
  'systemCollections', …)` restored from the pristine LearnBook, one repaint, and
  `net.noodl.user.User:prop-trainer -> Expression:trainer` reads `healthy:true`,
  `fromPortResolved:true`, dashes `[]`. Its `con-no-source-port` warning is **gone** and the error
  total falls **178 → 164** — fourteen. **Only the schema cache was varied**, so the dash is
  caused by the absent field and not by anything else about this project.
- ✅ **The export diff is by name, and it is the 14.** With the schema present: 2,587 connections,
  38 `prop-{trainer,firstName,lastName,defaultOrg,profilePhoto}` wires. Cold with it absent:
  2,573 and 24. `comm` on the two sorted name lists gives **14 lost, 0 gained**, and the 14 are
  exactly the `net.noodl.user.*` wires enumerated from disk — `/App::prop-trainer`, the four
  `Get user info` wires, the four `defaultOrg` wires, and the five `SignUp` wires. The 24 that
  survive are Record-family `prop-*` wires on the same column names, which is
  `recordWiredFieldPorts` doing precisely what §2 says it does.

### ⚠️ Two instrument failures worth keeping, because both read ZERO in both arms

- 🔴 **The first export counter read `k.fromProperty`; `exportConnection` emits `sourcePort` /
  `targetPort`** (`utils/exporter/util.ts:7`). It reported **0 user wires in both arms** — the
  arm where they are dropped and the arm where all 38 are present. A counter that cannot tell the
  two apart is not a weak measurement, it is no measurement, and it would have been quoted as
  *"0 exported, confirmed"*. **Read the control first: a zero in both arms names a broken
  instrument, never a finding.**
- 🔴 **Wiping the metadata mid-session does not reproduce the cold state.** `setMetaData(…,
  undefined)` left the already-minted ports on the nodes, and the export still returned
  2,587 / 38. The empty arm is only real on a **cold load** of a project whose `project.json`
  never had the key. The pair above was retaken that way (renderer reloaded, project reopened).

🔴 **So the correction in this section stands, now measured rather than read**: *"today they are
dropped, not dashed"* is **half right — dropped from the build only.** The canvas already
remains, already dashes, already flags. §7's decision is unchanged by this drive.

⚠️ **What this drive still does not show.** The path driven is `con-no-source-port` on a `User`
node reading a field. The `SignUp` path (§2's path 2, `signup.ts`, keyed on `systemCollections`)
loses its wires in the same export — they are among the 14 by name — but no `SignUp` wire was
watched being painted. Nothing suggests it differs; the canvas code is shared and knows nothing
about which family a node belongs to.

## 7. ✅ The Option A ACs were rewritten — 2026-08-31 (s39)

**s38 found that §4 still described the option Richard overruled**: *"a User-family node with an
empty schema still offers a `prop-<field>` port for every field one of its own wires names"* is
the wire declaring the column. **AC2 and AC3 were its cardinality and ignore-list criteria and
went with it.**

✅ **Done this session.** §4 now holds Option B's criteria; the Option A set is parked verbatim in
**§8**, marked do-not-build, because §3's corpus measurement and DEF-035's drive were taken
against it and a reader meeting only the new ACs cannot tell what was weighed. The old AC3's
ignore list survives as the new **AC5** — the same list, keeping a *person* from being invited to
edit `password` rather than keeping a *wire* from resurrecting it.

🔴 **The trap this closes, and it has now happened twice in this phase** (DEF-037's AC3 was the
first): **when a ruling reverses a recommendation, rewrite the acceptance criteria in the same
session.** A row's ACs outlive the option they were written for, and the next reader takes them
top-down.

---

## 8. The Option A acceptance criteria, kept for the record — 🔴 **OVERRULED, DO NOT BUILD**

These are §4 as it stood before the 2026-08-31 ruling. They describe *the wire declaring the
column* — the option Richard rejected on product shape. They are here because §3's corpus
measurement and DEF-035's 14-wire drive were taken against them, and a reader who meets only
the Option B criteria cannot tell what was weighed.

- **AC1** — a User-family node with an empty schema still offers a `prop-<field>` port
  for every field one of its own wires names, so the wire survives an export.
- **AC2** — where the schema *is* available, the schema half still wins: one port per
  name, keeping the narrowed column type. Asserted by cardinality, not by presence —
  two producers meeting is how a double gets shipped green.
- **AC3** — the account columns each path already refuses stay refused:
  `USER_INPUT_IGNORE_PARSE_BROWSER` / `USER_OUTPUT_IGNORE_PARSE` / the REST pair on path
  1, and `signup.ts`'s `_ignoreKeys` (`authData`, `password`, `username`, `createdAt`,
  `updatedAt`, `emailVerified`, `email`) on path 2. **A net that resurrects a port from
  a wire must not resurrect one of these** — a wire naming `prop-password` is the case
  to write the spec around.
- **AC4** — driven: the `LearnBook` copy exports its 14 User wires with the cache cold.
- **AC5** — `test:ci` returns to its known floor.


---

## 9. 🟢 Parts 1 and 2 built and driven — 2026-08-31, s40

**Option B, as ruled.** No wire declares a column. What was added is the explanation the node
never gave, and the way out from where the question gets asked.

### What shipped

| # | change | file |
| --- | --- | --- |
| 1 | `SchemaFetchOutcome` carries a `cause` **code**, and a `SchemaBackendRef` on a successful read | `utils/schemaCachePolicy.ts` |
| 2 | `SchemaHandler.lastOutcome` retains it; `SCHEMA_OUTCOME_CHANGED` is raised **only when the answer changes** | `utils/schemahandler.ts` |
| 3 | the judgement: which state gets which sentence, and where an **Add a field** button may point | `utils/schemaFieldNotice.ts` |
| 4 | the panel-level note, and the button | `propertyeditor/components/SchemaFieldNoticeView.tsx`, `SchemaAddFieldButton.tsx` |
| 5 | both drawn from **one subject**, so AC2 is structural rather than a coincidence | `propertyeditor/DataTypes/Ports.ts` |
| 6 | `SchemaPanel` opens on a named table — `initialTable` + `openToken` | `schemamanager/SchemaPanel.tsx` |
| 7 | AC5's ignore list, and the column-name validator moved somewhere a spec can reach | `schemamanager/serverOwnedColumns.ts` |

🔴 **The change that made the rest possible was deleting nothing and adding one field.** §5 said
the sentence AC1 wants *"is already computed and then thrown away"*, and it was: `_fetch` reduced
a six-way outcome to `decision.write`, a boolean. Retaining it is the whole of AC1's mechanism.

### The drive — real editor, `def036-dash-drive`, schema absent from disk

| what | reading |
| --- | --- |
| the retained outcome | `{ status: 'unavailable', cause: 'not-registered-yet', reason: 'no managed backend matches the endpoint yet' }` |
| **AC1** — a `net.noodl.user.User` node | draws **“This project’s backend is still starting … this node has no fields to read …”** |
| **AC2** — same node, same moment | **0** Add-a-field buttons |
| **AC3** — `setMetaData('dbCollections', …)` restored live | notice count **1 → 0**, `prop-*` ports **0 → 9** (`prop-firstName`, `prop-lastName`, …), **no reopen** |
| **AC4** — button on the `User` node | reads **“Add a field to `_User`”**, `elementFromPoint` says it is the top element, click opens `backend-schema` with `panelProps.initialTable = '_User'` |
| **AC4 landing** — surface opened on a real running backend | `Person` row **expanded, its columns drawn** |
| **control** — stale schema present, backend unreachable | **0 notices, 0 buttons** — a working node is not warned about |

⚠️ **The `status: 'schema'` arm of AC4 was driven with an injected outcome**, because no local
backend was bound to that project. What that grades is the panel wiring — button → props →
surface → expanded row. That `fetchBuiltInSchema` produces such an outcome is graded by
`tests-unit/def-035` and by the live `not-registered-yet` reading above, not by this drive.

### 🔴 Two defects the drive found in the work itself

**1. `_active_` is not a backend, and the obvious boolean would have switched this off silently.**
The `backendId` port is *declared* with `default: '_active_'`, and `schema-ports.ts:490` reads it
and an absent parameter **on the same line** as the same thing. The first version asked
`Boolean(getParameter('backendId'))` to mean *"this node names its own backend"* — which is
**true for every Record node whose author has ever chosen the default**, so the whole feature
would have been off for them, with nothing on screen to say so. ✅ The rule now lives in
`namesOwnBackend` in the graded module, with a control asserting the `_active_` node still
speaks.

**2. A second press of the button landed on the first node's table.** `SidebarModel` reuses an
already-mounted surface: the new props *do* arrive (the header changed to a marker name) but
`useState(initialTable)` had already latched. Measured — opened on `Person`, re-opened for
`Orders`, header updated, **`Person` still the expanded row**. That is AC4's own dead end,
reintroduced on the second use of the button that removes it. ✅ Fixed with an effect keyed on
`[initialTable, openToken]`, and re-driven: first open `Person` ✅, second open `Orders` ✅ with
`Person` collapsed. 🔴 **The docblock that asserted the opposite was written from reading the
code and was wrong.** A comment claiming a remount is not a measurement of one.

### 🔴 Still owed — say this before quoting the row as done

- ⚠️ **The rendering half of AC5 is graded by rule only.** `serverOwnedColumns.ts` decides that
  `password`, `username`, `email`, `emailVerified`, `authData`, `createdAt`, `updatedAt` are the
  backend's on `_User`, and `tests-unit/def-036/accounts-table-columns.test.ts` grades that
  decision and the validator. **That `TableRow` applies it was not driven** — no backend
  reachable in this session had a `_User` table, and `TableRow.tsx` imports `Icon`, so a spec
  importing it fails *to run* rather than fails. What is unmeasured is whether the rename
  affordance actually disappears.
- ⚠️ **`SignUp` was not the node driven.** The panel code is family-blind — one subject, one
  table of six type names — and `SignUp` is in it, but the node watched drawing the notice was
  `net.noodl.user.User`. The same gap §6 records for the export.
- ⚠️ **No external-backend arm was driven.** `external-endpoint` has a sentence and a test; no
  project pointed at a foreign Parse server was opened.
- 🔴 **The 271 wires still leave the build**, by design. §4's closing note is the ruling, not an
  oversight.

## 10. ✅ CLOSED — part 3 ruled to be the canvas, 2026-08-31 (s41)

🧭 **Richard ruled: the canvas.** Put to him exactly as §6 framed it — his sentence is about what
a wire looks like on the canvas, all three clauses of it already ship, and the only remaining
reading (*"and it should survive the export too"*) reverses DEF-034. He chose the canvas.

**So part 3 is satisfied by what already ships, nothing is built for it, and DEF-034 stands.** The
271 wires still leave the build, by design — see §4's closing note and
[RICHARD-RULINGS-2026-08-31.md](RICHARD-RULINGS-2026-08-31.md) §6.

**The row closes on:** AC1–AC5 built and driven in s40 (§9), part 3 measured in s38 and driven in
s39 (§6).

### 🔴 What closing does NOT discharge — say this whenever the row is quoted

A closed row is not a fully measured one. Four boundaries survive it, all recorded in §9:

- **AC5's rendering half is graded by rule only.** `serverOwnedColumns.ts` decides which columns
  are the backend's on `_User`, and a unit test grades that decision. **That `TableRow` applies
  it was never driven** — no reachable backend in s40 had a `_User` table, and `TableRow.tsx`
  imports `Icon`, so a spec importing it fails *to run* rather than fails. Whether the rename
  affordance actually disappears is **unmeasured**.
- **`SignUp` was not the node driven.** The panel code is family-blind and `SignUp` is in its
  table of six type names, but the node watched drawing the notice was `net.noodl.user.User`.
- **No external-backend arm was driven.** `external-endpoint` has a sentence and a test; no
  project pointed at a foreign Parse server was opened.
- **The `status: 'schema'` arm of AC4 was driven with an INJECTED outcome**, so what it grades is
  the panel wiring, not the fetch.

⚠️ Each is a candidate row for a later phase, not a defect in this one.
