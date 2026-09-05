## §62 Tier 2.8 row 12 — the relation pair: `Add Record Relation` and `Remove Record Relation`, the record verbs' shape with a Pointer on the wire (session 86, 2026-09-05)

Type ids `AddDbModelRelation` / `RemoveDbModelRelation`, display names *Add Record Relation* / *Remove Record
Relation* — the twelfth row of §50's list, designed in session 28 (RECORD-VERBS-TARGET §17) and refused since
with *"a relation write has no shape in the api stub"*. Both are in the picker population, so the floor moves
**105 → 107**.

### §62.0 Design — what the pair is on disk, and what it becomes

**The port sets**, assembled by `dbmodelcrudbase` exactly as the three record verbs are (`addBaseInfo` +
`addModelId` + `addRelationProperty`; `-addrelation.ts`, `-removerelation.ts`): inputs `collectionName`
(Class), `idSource` (explicit | foreach), `modelId` (Id — "a record itself is accepted here as well as its Id"),
`repeaterComponent`, `backendId`, `relationProperty` (Relation — an `allowEditOnly` enum the schema fills,
**no default**), `targetId` (Target Record Id — `allowConnectionsOnly`), `store` (Do); outputs `id`, `done`,
`failure`, `completed` (the family's outcome trio, declared once in `addBaseInfo`), `error` (Error — "kept
after a later attempt succeeds"). **No `Unchanged`** on either; the Remove sibling's file records why.

**What the runtime does on Do** (`scheduleAddRelation` / `scheduleRemoveRelation`): one token into the
batch, `scheduleOnce`, then `validateInputs()` — the whole pre-flight, in this order: *No class specified* →
*No relation property specified* → *No target record Id (the record to add a relation to) specified* → *No
record Id specified (the record that should get the relation)* → the NDA-012 class check (*The target record
"<id>" has not been loaded, so its class is unknown …*). The first problem is `setError`'d (Error written,
`record/storage-op-failed` raised, Failure pulsed) and the backend is never called. Otherwise
`cloudstore.addRelation({ collection, objectId: model.getId(), key, targetObjectId, targetCollection })`, which
`ParseWireAdapter.addRelation` sends as **`PUT /classes/<collection>/<objectId>` with body
`{ [key]: { __op: 'AddRelation', objects: [{ __type: 'Pointer', objectId, className }] } }`** (`RemoveRelation`
for the sibling). The backend (`parse-wire.ts classUpdate`) walks the ops, calls `facade.addRelation` per
Pointer and answers `{ updatedAt }`; the runtime merges that into the in-process record and reports `done`.
Error is never cleared by a later success.

**The design: the record verbs' shape, verbatim — an `api-call`.** The pair is the same assembly as
Create/Update/Delete with two more inputs, so it takes the same action kind rather than a sibling one (USER-FAMILY
§4e's rule: a new discriminant recruits every switch site silently; the existing one is walked by all of them).
The verb union widens to `'add-relation' | 'remove-relation'`; `MutationPlan.verb` too; the api module prints
`add<Type>Relation(id, relation, targetId, targetClass): Promise<void>` / `remove<Type>Relation(…)` beside the
class's other verbs, calling two new client functions `addRelation` / `removeRelation` (the wire above,
transcribed) — or the stub that throws, where the project declares no backend. The handler is the record verbs'
try/catch: the dynamic guards **in the runtime's order** (target first, then id — each `throw new Error(<the
runtime's own sentence>)`, emitted only where the argument is not a literal), the awaited call, the done chain,
and the catch that writes the Error row and raises `record/storage-op-failed`.

**Where the four arguments come from:**
- `id`: a wire (through `resolveExpr` — a Variable prints `.get()`, a prop its name) or the authored literal;
  two wires refused; a boolean refused; `''`/`undefined` at run time throws *"No record Id specified (the record
  that should get the relation)"* / *"(… should lose the relation)"* — `setModelID` clears the binding on those.
- `relation`: the authored literal, always — a wired one is refused (`allowEditOnly`, but a project can hold it).
- `targetId`: the one wire, whose source must be a `DbModel2` / `DbCollection2` (NDA-012's static form,
  `LOADED_RECORD_SOURCES`, unchanged); the expression it resolves to (a `Record`'s Id is its feeder — a literal or
  a Variable); a list (Query Records' Items) refused.
- `targetClass`: the source node's literal `collectionName` — the runtime reads it off the loaded record, and
  statically the record a `Record`/`Query Records` loads is of the class it names.

**Refused by name** — every sentence predicted here, graded in §D of the spec:
- the five pre-flight sentences (unchanged from §17, now shared by the compiler and the sweep): *no class is
  named, so the runtime answers Failure with "No class specified" and never calls the backend* · *no relation
  property is named, so the runtime answers Failure with "No relation property specified" and never calls the
  backend* · *no Target Record Id is wired, so the runtime answers Failure with "No target record Id ...
  specified" and never calls the backend* · *it names no record to put the relation on, so the runtime answers
  Failure with "No record Id specified" and never calls the backend* · *its Target Record Id comes from <type>
  rather than a Record or Query Records output, so the target's class is unknown and the runtime refuses the write*;
- the static-value gates, the record verbs' sentences where they have one: *its class name is not a literal* ·
  *its Relation is wired — which relation column is written is not statically knowable* · *it names a specific
  Backend — one api module per class is all this slice emits* · *its Id Source is the enclosing repeater's row —
  row identity is not statically knowable in this slice* · *its Target Record Id comes from a Record or Query
  Records whose class is not a literal, so the target's class is not statically known*;
- the consumed outputs: *its failure|completed output is consumed — only the done chain and the Error value are
  translated in this slice* (the record verbs' sentence — the pair's Failure has the same standing as Create's) ·
  *its Id output is consumed — it republishes the Id it was given, and that read is not translated in this slice*;
- the wires: *two wires feed its Id — last-writer-wins is not statically ordered* · *two wires feed its Target
  Record Id — last-writer-wins is not statically ordered* · *its Id is fed a logic truth value — only truthiness
  sinks take one in this slice* · *its Id has no statically known source* / the feeder's own sentence · *its
  Target Record Id has no statically known source* / the feeder's own · *its Target Record Id is fed the Query
  Records' Items list rather than one record's Id — a row's Id reaches the page only through a repeater, which
  this slice does not translate*;
- the chains: the done chain's own refusal; an Error read while Do is never attached: *its Do is never fired by a
  translatable trigger* (the record verbs' rule, `attachedRecordVerbs`); the sweep for a well-formed node nothing
  fires: *its Do is never fired by a translatable trigger*.

**Deliberately not done, recorded**: a Failure *chain* (the record verbs refuse it too — one funnel for the
family, and a `failThen` on `api-call` is a second pipeline through every walker); §4c's chain-local
`created.id` (a Create's consumed Id stays gate 11 — the Create's refusal, not this node's); the runtime's merge
of `updatedAt` into the in-process record (the export holds none — `Promise<void>`); `encodeURIComponent` on the
id, the client's convention where the wire adapter concatenates raw (a backend never mints an id that differs).

### §62.1 What is emitted

- **`src/api/client.ts`** gains `addRelation` / `removeRelation(collection, id, relation, targetId, targetClass): Promise<void>` beside
  `update` / `remove`: `PUT /classes/<collection>/<encodeURIComponent(id)>` with body `{ [relation]: { __op: 'AddRelation' |
  'RemoveRelation', objects: [{ __type: 'Pointer', objectId: targetId, className: targetClass }] } }` — `ParseWireAdapter.addRelation`
  / `removeRelation` transcribed; the `{ updatedAt }` answer is not returned (the export holds no in-process record to merge it into).
  The golden `tests/goldens/exp009/client.ts.golden` regenerated; the diff is exactly that block (`client-golden.diff`).
- **`src/api/<plural>.ts`**: `add<Type>Relation` / `remove<Type>Relation(id, relation, targetId, targetClass)` beside the class's other
  verbs, the client import naming both; the stub form throws `'<fn> is not connected to a backend yet'` (the write stubs' rule).
- **The page**: the record verbs' try/catch. Each dynamic guard binds a local first and the call reads it —
  `const linkTargetId = puppyId.get(); if (!linkTargetId) throw new Error('No target record Id (the record to add a relation to) specified');`
  then the record's — in `validateInputs`' order; a literal argument prints no guard. Then
  `await addInquiryRelation(linkRecordId, 'puppies', 'pup-1', 'Puppy');`, the done chain, and the catch that writes the Error row and
  raises `record/storage-op-failed` with the node's own type. The Error Text folds (`{linkError ?? ''}`).
- **plan.ts**: `RelationVerb`, `RELATION_NODES` (the verb, the fn prefix, the two "specified" sentences per node), `relationPreflight`
  (module-level, shared by `compileRelationOp`, the record-verb sweep and the logic-only path), `compileRelationOp` (`api-call` with
  `verb: 'add-relation' | 'remove-relation'`, `guardId: false`, `guards: [{ index, local, message }]`, `MutationPlan` with `writes: []`),
  `TRIGGER_PORTS` (both `store`), the sink ladder, the `error` read (`attachedRecordVerbs`, unchanged rule), the record-verb sweep, the
  render pass's `isRecordErrorRead` (the family's THIRD enumeration), and the corpus idiom's own sentence (a record verb's `id` into
  the verb's Id). **component.ts**: `API_CALL_ERROR_CODES` two rows; the `guards` print in the `api-call` case. **emitApp.ts**: the
  module print, the client import, the two client functions. **No new lib, no new action kind, no new expression kind** — nothing in
  the hook-gap `||` chain and nothing in the expression switches; the `resolveExpr` if-ladder gained no branch (the `error` clause widened).
- **Ledger**: both rows `translated`; floor **105 → 107**; eight pins moved (the brief said seven; `grep` found eight —
  `animation-pair`, `browser-utilities`, `filter-records`, `on-app-error`, `object-store`, `run-tasks`, `script`, `streaming-trio`).

### §62.2 The fixture — `tests/fixtures/link-desk`

`App`: the Router. `Pages/Home`: a Record `puppy` (class Puppy, literal Id `pup-1`, Fetch unwired — §43's effect form) whose `Id` feeds
both verbs' Target Record Id and whose `name` is a Text; a text input → `inquiryId` Variable (§56 E2's write-through) → both verbs' Id;
"Link the puppy" → `link.store` (class Inquiry, relation `puppies`); "Unlink the puppy" → `unlink.store`; each `done` → a Set Variable
`status` fed by a String (`savedValue`); each `error` → a Text; `status` → a Text. Backend `backend_linkdesk` at `localhost:8581`, a
schema snapshot for Inquiry (`message`) and Puppy (`name`).

**The reverted arm** (`probe-reverted.log`, HEAD 2a2dd4fa): both verbs on *"a relation write has no shape in the api stub …"*, the two
Set Variables silenced with *"the trigger is not a rendered element event or a receiver"* (the attach pass speaks, not the "never fired"
sentence I predicted — §59.4 item 3 again), the two Strings behind them, **16 refusals**, `whole: []`, the verdict naming both verbs,
`pathway: true`. **Built**: 18 files, **0 refusals**, the shell note and the backend note only; the page reads as §62.1.

### §62.3 The gates and the arms

```
packages/nodegx-export: tsc --noEmit 0 (after every stitch, four runs) · relation-pair.test.ts 47/47
  §A the fixture whole + the real ts.Program (10) · §B the client under node against a fake fetch — the PUT, the op, the typed Pointer,
  the header pair, encodeURIComponent, the backend's own message, the status-only failure, the unreachable sentence, the session token (6)
  · §C the shapes a wire changes — the stub form, the wired target's guards in the runtime's order (typechecked), a literal record Id (4)
  · §D refusals by mutation, each sentence exact (24) · §E the corpus shape and the logic-only path (3)
relation-verbs.test.ts 24/24 (the well-formed row re-pinned: the verb names §4c's unbuilt chain-local read from its own side)
neighbours re-run alone, green: backend-client 17 (golden regenerated), in-code-markers 57, unreported-deferrals 7, logic 29, cascade 83,
  record 29, file-record 26 (B10 re-pinned: the client's `__type` count 3 → 5, the two Pointers named and counted — writes, not File envelopes)
whole package jest ONCE at load 5.2: 72 files (72 on disk = 71 + this spec), 2508 rows — 2507 green + file-record B10, re-pinned and re-run alone
export-ledger:check OK — 176 types, 114 translated · picker 107/127 (84.3%), --check exit 0 (was 105)
arms 16/16 KILLED (mut-summary.txt), sources restored md5-identical after each: M1 pre-flight check — 2 · M2 NDA-012 rule inverted — 30 ·
  M3 op misspelt — 2 · M4 Pointer without className — 2 · M5 guards reordered — 1 · M6 target guard dropped — 1 · M7 guard not rebound
  (TS2345) — 8 · M8 Failure/Completed allowed — 2 · M9 list gate — 1 · M10 logic-only pre-flight dropped — 1 · M11 render-pass Error read
  reverted — 3 · M12 record-verb Id sentence — 1 · M13 family code dropped — 7 · M14 POST — 2 · M15 wired target class — 1 · M16 the
  source class sent as the target's — 7
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §62.4 Traps found

- 🔴 **The first reverted arm measured a fixture defect, not the product.** A `String` node's output is `savedValue`, not `value`
  (roster-desk wires `savedValue`); the Set Variables read *"the value wire has no statically known source"* and I read that as the
  cascade. Re-run with the wire fixed; the control is the fixed one. *Copy a fixture's wire, not its display name.*
- 🔴 **`if (!x.get()) throw …; await f(x.get())` does not typecheck** — the guard narrows nothing for a second call (TS2345 in the emitted
  program, caught only by the real tsc, A2). The guards now bind a local and the call reads it, which is also what the runtime does
  (the setter stored the value once). **The record verbs' own `guardId` has the same hole for a Variable-fed Id** — registered below.
- 🔴 **The family's THIRD enumeration.** `RECORD_VERBS[…] || USER_VERBS[…]` appears in `resolveExpr`'s `error` clause AND in the render
  pass's `isRecordErrorRead`; the Error Text was dropped with the step-5 note until the second was widened (§43's "second consumer"
  rule, s19's dispatcher rule). Arm M11.
- 🔴 **A sweep-side pre-flight fallback was dead code, and the arm that could not kill it said so.** Every trigger sink is compiled
  diagnostically before the sweeps (`compiledOf(node, TRIGGER_PORTS[node.type])`, plan.ts ~14005), so the record-verb sweep always
  reports the compiler's verdict. Removed; the logic-only path is the one place the sweep-side pre-flight runs (E3, M10 re-aimed).
- 🔴 **The compiler speaks before the sweep for the corpus shape too.** I predicted the gate-11 graph would leave the verb on *"never
  fired"*; the sink is compiled from the wire side and refused on its Id — now with its own sentence naming §4c's unbuilt chain-local read.
- ⚠️ **The ledger is mostly raw UTF-8** (89 raw `—` lines, 4 escaped): `json.dump(ensure_ascii=True)` rewrote 218 lines. Edited as text on
  HEAD's bytes instead; the diff is 6/6.
- ⚠️ **Three substring traps in one spec** (§57.4's): `linkError` ⊂ `linkErrorText` (the marker names the node id), `linkRecordId` ⊂
  `unlinkRecordId`. Every absence narrowed to a declaration.
- ⚠️ The first spec run pinned `into: HOME_FILE` for handler actions; a handler action collapses into its **button**, a render read into the file.

### §62.5 Residuals (owner NONE unless named)

- **`api-call`'s `guardId` for a Variable-fed Id does not narrow** (`if (!x.get()) … await f(x.get())`) — an Update/Delete Record whose Id
  is a Variable would fail the emitted tsc with TS2345. The record verbs' shape, older than this row; the fix is the `guards` print (bind a
  local). Owner NONE — a one-line change plus a row in `record-verbs`' spec.
- **§4c's chain-local `created.id`** — the corpus idiom (`NewDbModelProperties.id → AddDbModelRelation.modelId`) stays refused on both
  sides (gate 11 on the Create; the verb's own sentence). Owner NONE.
- **A Failure chain on the pair** is refused as the record verbs' is — one funnel for the family; translating it is a `failThen` on
  `api-call` through every walker. Owner NONE.
- **A Query Records' `firstItemId`** — the one Query Records string output that names a loaded record — resolves to nothing (§56 reads
  Items and Count), so a relation fed by it is refused with the feeder's sentence, not built. Owner NONE.
- **`pathwayVerdict`'s consequence clause** (`src/emit/report.ts`): when a root pathway node silences no other pathway node, the verdict
  says *"the app has no error pathway"* — written for `On App Error` (§54), reached by any refused backend verb with only Set Variables
  behind it (the reverted arm read it for the relation pair). EXP-013 is closed; owner NONE. Pre-existing, not this row's.
- The runtime's `updatedAt` merge into the in-process record, and its raw (un-encoded) id in the path, are recorded divergences (§62.0).
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed.
