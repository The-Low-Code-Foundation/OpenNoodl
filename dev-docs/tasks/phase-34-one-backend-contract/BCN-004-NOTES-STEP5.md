# BCN-004 step 5 — the Record nodes, repointed, and the second "active backend" nobody had counted

**Scope**: BCN-004 implementation steps 3 and 5 / Desired State 2 only — *"Generalise
`resolveBackend` to serve every adapter"* and *"Repoint the six record nodes at the contract; add
the backend picker with its hide-when-one rule."* Steps 6 (the live pass), 7 (deleting the five
`noodl.byob.*` types) and 8 (flipping descriptor cells) are untouched, and `SubscribeToChanges` is
exactly where BCN-008 left it.

---

## 1. What was built

| Piece | Where |
|---|---|
| One resolver for every adapter — `_active_`, the single-backend default, and the `cloudservices` endpoint as a first-class entry | **`packages/noodl-runtime/src/api/backends/resolveBackend.ts`** (new) |
| The store router: `CloudStore.forBackend(modelScope, backendId)`, picking `RestDataAdapter` or `ParseWireAdapter` from the resolved type | `packages/noodl-runtime/src/api/cloudstore.js` |
| `RestDataAdapter`'s `serializeObject` and `schemaFor` hooks, with `normalizeValue` moved to a home `api/` may import | **`packages/noodl-runtime/src/api/backends/restSerialize.ts`** (new) |
| The Record family's port vocabulary on top of the shared generator | **`packages/noodl-runtime/src/nodes/std-library/data/record-ports.ts`** (new) |
| The neutral half of the visual-filter conversion | `packages/noodl-runtime/src/api/queryutils.ts::convertVisualFilterToNeutral` |
| Six nodes repointed | `dbmodelnode2`, `dbcollectionnode2`, `newdbmodelpropertiesnode`, `setdbmodelpropertiesnode`, `deletedbmodelpropertiesnode`, `filterdbmodelsnode` (+ `dbmodelcrudbase`, the shared base) |

Every one of the six now: resolves an adapter from the `Backend` input, builds its Class dropdown
and its property ports from that backend's introspected schema through `schema-ports.ts`, and ends
with one `sendSchemaPorts` (so the RUN-003 doubled-port guard covers them).

---

## 2. Stale premises found

### 2.1 ⚠️ A project has **two** active backends, and the spec's picker sentence assumes one

This is the headline, and it invalidates the obvious implementation of both halves of the phase
decision. The editor's own `backendList.ts` says it in prose:

> two entries can be active at once today, and that is not a bug in this function:
> `cloudservices` binds the record/auth/file nodes while `backendServices.activeBackendId` binds
> the BYOB nodes.

So the backend the six Record nodes have been talking to all along — the project's `cloudservices`
endpoint — **is not in `backendServices.backends` and has no id of its own.** Two consequences,
and the second is harmful:

1. A picker built only from `backendServices.backends` could not list, or select, the backend the
   node is already using.
2. `hideWhenSingleBackend` counting only `backendServices.backends` gets the count wrong **in the
   dangerous direction**: a project with the built-in backend *and* one Directus counts **one**,
   hides the picker, and — since `_active_` would then resolve to `activeBackendId` — silently
   moves every Record node in the project onto Directus. No error, no port, no way to notice.

Fixed by giving the endpoint a synthetic entry (`ENDPOINT_BACKEND_ID = '_endpoint_'`) that sits
first in one combined list, and by resolving the Record family's `_active_` to it whenever the
project has one. Pinned in `test/backends/resolve-backend.test.ts` and
`test/byob-dynamic-ports.test.js` ("the picker lists the cloudservices endpoint, which is in no
backendServices entry"); removing `extraBackends` fails 7 tests (§5).

Converging the two storage mechanisms is BCN-009 step 2, which `backendList.ts` already names as
separate work. Nothing here pre-empts it.

### 2.2 ⚠️ Worker B's §7 recipe needs two parameters step 4 said would not be needed

BCN-004-NOTES-PORTGEN §1: *"Step 5 should need no new parameters, only to pass these."* Two were
needed, both on `resolveSchemaPortContext`, both additive and both defaulted so the four BYOB
nodes are byte-identically unaffected:

- **`extraBackends`** — §2.1. There is no way to express "a backend that is not in
  `backendServices`" without it.
- **`activeBackendId`** — the same finding: `_active_` means the BYOB active backend to a BYOB
  node and the `cloudservices` endpoint to a Record node, and neither is wrong.

Everything else in §7 held exactly as written: `collectionParam: 'collectionName'`,
`placeholderLabel: null`, `filterByApiPathMode: false`, the `_User`/`_Role` `extraEnums`, and
`hideWhenSingleBackend`.

### 2.3 The `Date`-vs-`dateTime` port type question §7 flagged has an answer, and it is "do not change it"

PORTGEN §7 called this *"a real difference to decide on"*. Decided: **the Parse family's port types
do not change.** `getEnhancedFieldType` would re-type a `Date` column's port from `date` to
`string` and a `Pointer`'s from `*` to `string`, and re-typing a shipped port drops the wires
attached to it in projects that already work. So `recordPortType` reads the family's historic table
whenever the column carries a Parse type name (`SchemaField.nativeType`), and
`getEnhancedFieldType` — enum dropdowns, the step-4 `number` fix, placeholders — decides for every
other backend. The two never meet: a Parse class has no enum columns and a Directus table has no
`Pointer`. Pinned both ways in `test/byob-dynamic-ports.test.js`.

### 2.4 `endpointBackendType` disagrees between the editor and the runtime, and the runtime's answer wins here

The editor's `backendList.ts::endpointBackendType` reads a *missing* `cloudservices.type` as
`parse` (deliberately, "guessing wide would offer aggregate on a server that answers it with master
key is required"). The runtime's `CloudStore._handle()` has always answered `nodegx` for the same
metadata, and `queryutils.backendType()` reads that answer to pick which capability table greys the
visual filter builder's operators out. Adopting the editor's rule would have **narrowed the
operator list in every project saved before WF-007 started writing the field.**

So `resolveBackend.ts::endpointBackendType` honours a recorded type and keeps `nodegx` as the floor
for an unrecorded one. The disagreement is now written down in both files rather than latent. Whoever
does BCN-009 step 2 should reconcile them deliberately.

### 2.5 `RestDataAdapter`'s `schemaFor` is not read by any REST translator

Worker A's handover says *"without `schemaFor` a `pointsTo` filter cannot resolve its target."* That
is true of `translators/parse.ts`. `directus.ts`, `postgrest.ts` and `pocketbase.ts` never touch
`options.schema` at all — only `parse.ts` and `translate.ts` reference it. The hook is passed anyway
(the adapter asks for it, the port generator already holds the data, and a translator that starts
reading it will find it there), but it is not currently load-bearing and the note says so at the code.

---

## 3. Deviations, with reasoning

### 3.1 `_active_` resolves to the endpoint first, not to `backendServices.activeBackendId`

The resolution order in `defaultBackendId` is: the `cloudservices` endpoint → the BYOB
`activeBackendId` → the only backend there is. The middle and last are the spec's step 3; the first
is §2.1's finding. It is what makes this whole change a **no-op for every project that exists
today**, which is the floor a task that touches twenty-five nodes' data path has to clear.

### 3.2 A backend id that names nothing is an error, not a fallback

`CloudStore.forBackend` answers `undefined` for an id the project no longer has, and each node
reports `The backend this node is set to ("x") is not configured in this project.` through its
existing `setError` funnel. Falling back to the default would write the record to a **different
backend than the graph names**, silently — the same failure class as a dropped filter condition.

The one exception, and it is deliberate: an *unset* picker in a project with no metadata at all
returns the legacy store, because that is a brand-new project and there is nothing to be wrong about.

### 3.3 A resolution landing on the endpoint returns the legacy store **by identity**

Not an equivalent one. `dbcollectionnode2` subscribes to save/create/delete notifications on a
store and patches its collection in place; two `CloudStore` objects for one backend would mean a
record created by a Create node never reaching the Query node watching for it. Pinned with `toBe`.

### 3.4 The event subscriptions follow the picker

`dbcollectionnode2` and `filterdbmodelsnode` bound their store subscriptions in `initialize`, where
no input has been set yet. Both now have one `bindStoreEvents(store)` that owns both halves of the
subscribe/unsubscribe pair, bound to the legacy store at `initialize` exactly as before and moved on
the first query (or when the picker changes). One function owning both halves is what stops PLAT-003
slice 13's leak returning now that there are two places a store can come from.

### 3.5 The wire gets the **neutral** filter; the local matcher keeps the Parse one

`queryutils.convertVisualFilter` translates all the way to Parse, which is right for
`ParseWireAdapter` and wrong for `RestDataAdapter` — the REST adapter takes a neutral filter and runs
BCN-003's translator for its own dialect. Handing it a Parse document would be translating an
already-translated filter, which is how RUN-003's second Directus converter came to emit a key a live
server answers with a 403.

So `getStorageFilter` returns both: `neutralWhere` goes on the wire when
`store.usesNeutralFilter`, and `where` (Parse) stays in `currentQuery` because `matchesQuery` — the
local test that decides whether a record created elsewhere belongs in the result set — reads `$eq`
and `$gte`. The JavaScript-filter path needed no conversion at all: the script's own vocabulary
(`{price: {greaterThan: 1}}`) *is* the neutral one, and `convertFilterOp` was already the lowering
step.

**Filter Records is untouched by this**, and correctly: it filters an in-memory array with
`matchesQuery`, so it wants the Parse document whatever backend the class came from.

### 3.6 The filter builder is told which backend it is building for

`visualFilter`'s port type carried `backend: QueryUtils.backendType()`, which can only answer
`nodegx` or `parse` because it reads the singleton's handle. A Query Records node pointed at Directus
was therefore offered the **Parse** operator list. It now carries the resolved backend's type, and
falls back to `QueryUtils.backendType()` when there is nothing resolved. The schema goes with it:
`{properties, relations}` (Parse shape, including the reverse-relation scan, byte-for-byte) for a
Parse-wire backend, `{collection, fields}` (BYOB shape) for a REST one. The editor's
`parseSchema.ts` already accepts both.

### 3.7 The two relation nodes were repointed too, though they are not among the six

`dbmodelnode-addrelation` and `dbmodelnode-removerelation` share `addBaseInfo` with the Record
family, so they get the picker port whether or not they are in scope. Leaving them on
`CloudStore.forScope` would have shipped a picker that does nothing — worse than not having one. They
resolve like the rest and get `RestDataAdapter`'s explicit refusal (carrying the descriptor's own
sentence) on a REST backend, which is what BCN-005 will replace.

### 3.8 `normalizeValue` moved out of `byob-utils.ts`

`api/` may not import `nodes/`, and both families need it now. Moved to
`api/backends/restSerialize.ts` and re-exported from `byob-utils.ts` under the same name — the same
pattern step 4 used for the schema helpers, so `test/byob-utils.test.js` is untouched and still pins it.

### 3.9 A PLAT-003 defect is fixed as a side effect, and the catalog noticed

`filterdbmodelsnode`'s port builder guarded on `collectionName` but not on the metadata, so a Filter
Records node with a class selected threw `TypeError: Cannot read properties of undefined (reading
'find')` whenever `dbCollections` had not arrived. It was documented and left verbatim. The
replacement has nowhere to dereference, so the crash is gone — and **the generated catalog changed
because of it**: `FilterDBModels`'s `parameterEncoding` went from

```json
{"known": false, "reason": "The port helper could not be run headlessly … (Cannot read properties of undefined (reading 'find'))."}
```

to a real, observed four-pattern encoding. That is the only catalog diff in this change, and it is
the defect fix showing up as evidence rather than as a claim.

### 3.10 Filter Records' Class dropdown gained `_User` and `_Role`

It was the only one of the four Parse-family class dropdowns that did not offer them — Query Records,
Record and the CRUD base all did. Sharing one builder makes them agree. An addition, not a removal.

### 3.11 Server-owned Parse columns still get ports

`recordFieldPorts` defaults `readOnlyFields` to **empty**, not to `PARSE_READONLY_FIELDS`, even
though §7 suggested the latter. Today's builders emit a port for every key in
`schema.properties`, so `objectId`/`createdAt`/`updatedAt` already have ports on Create and Set in
shipping projects. Passing the read-only list would have removed four ports and any wires on them.
`ACL` is the exception and is already hidden, by `parseFieldToSchemaField`.

---

## 4. What was done about `serializeObject` — explicitly

Worker A flagged this as the live correctness issue this task inherits:

> The schema-aware normalisation `byob-utils::normalizeValue` did … **has not been ported**, so a
> `json`-typed Directus column written from an object-typed port will double-encode exactly as it
> did before RUN-003 fixed it. Whoever wires the nodes must pass the hook.

**The hook is passed, from the one place that constructs the adapter.** `CloudStore`'s REST branch
builds it with `makeRestSerializer({collections, toJSON})`:

- **`normalizeValue` per column**, keyed on the selected backend's cached schema — so a `json`/`array`
  column's text is parsed rather than double-encoded, and a `date`/`dateTime`/`timestamp`/`time`
  column is coerced to ISO 8601. The function is RUN-003's, moved rather than rewritten.
- **`toJSON`** unwraps a Noodl `Model`/`Collection`, which a property port can legitimately hold and
  which `JSON.stringify` would otherwise send as a class instance. `cloudstore.js` owns the unwrapper
  (now exported as `CloudStore._toJSON`) and it is passed in rather than imported, so
  `restSerialize.ts` does not have to require the module that requires it.
- **The collections are read per call**, not captured, so a re-introspection lands on a live store.
- **It returns a copy.** The Parse serialiser mutates its argument in place; that is survivable
  there and not worth reproducing.

Evidence, at two levels:
- `test/backends/resolve-backend.test.ts` — the hook in isolation, including the "column I have no
  schema for is passed through untouched" case.
- `test/nodes/record-backend-routing.test.ts` — a real **Create New Record** node with the Directus
  backend selected, driven through its real `storageInsert`, whose captured request body is
  `{title: 'Ada', payload: {a: 1}, published_at: '2026-07-31T00:00:00.000Z'}`. Deleting the hook from
  `cloudstore.js` fails a named test (§5).

`schemaFor` is passed as well, with the caveat in §2.5.

---

## 5. Results — actual numbers

| Check | Result |
|---|---|
| `noodl-runtime` jest, full — **before** any edit | 80 suites passed / 81 total, **1474 passed**, 0 failed, 13 pending |
| `noodl-runtime` jest, full — **after** | 83 suites passed / 84 total, **1556 passed**, 0 failed, 13 pending |
| New `test/backends/resolve-backend.test.ts` | 25 tests, all pass |
| New `test/backends/cloudstore-router.test.ts` | 12 tests, all pass |
| New `test/nodes/record-backend-routing.test.ts` | 6 tests, all pass |
| `test/byob-dynamic-ports.test.js`, extended to the six Record nodes | 39 → **64** tests, all pass |
| `npx tsc --noEmit -p packages/noodl-runtime/tsconfig.json` | **0 errors** (after `npm run build:types`; the 4 corpus suites also need `dist-types` to start) |
| `npx tsc --noEmit -p tsconfig.json` (root) | **18 errors, all `Cannot find module '@noodl-versioning'`**, pre-existing, none in a file touched here |
| `nodegx-backend-contract` jest / tsc | **146 passed, 0 failed** / 0 errors — a control, the package was not edited |
| Editor `npm run test:ci` | **Jasmine: 1932 specs, 0 failures**, exit 0 |
| `npm run catalog:check` | `156 node types, 89 with dynamic ports, 24 port value types` — regenerated; **one diff**, and it is §3.9 |
| `npm run catalog:merge:check` | `156/156 nodes documented` — regenerated to match |
| `npx eslint` on the three new files | clean (the `no-this-alias` errors across `nodes/std-library/data/` are pre-existing and in untouched files too) |

⚠️ The jest numbers were taken with a minimal custom reporter. `packages/noodl-runtime`'s `npx jest`
crashes in `@jest/reporters/getResultHeader` (`Cannot find module 'terminal-link'`) and prints a
meaningless "1 of 23 total" that looks exactly like a failing suite.

### Proof the new tests discriminate

A green run proves nothing on its own, so three mutations were run against the shipped code:

| Mutation | Result |
|---|---|
| `defaultBackendId` prefers `backendServices.activeBackendId` over the endpoint (§3.1) | **2 tests fail**, both named for the rule |
| `serializeObject` removed from `CloudStore`'s REST branch (§4) | **1 test fails** — *"passes the serializeObject hook, which is what stops a json column double-encoding"* |
| `extraBackends` removed from `recordSchemaContext` (§2.1) | **7 tests fail** — the picker vanishes for all six nodes and the endpoint leaves the enum list |

---

## 6. ⚠️ Could not verify — the honest list

1. **No live backend was contacted. At all.** No Directus, Supabase, PocketBase, Parse Server or
   `nodegx-backend`. Every response in `test/nodes/record-backend-routing.test.ts` is written by the
   test. What it pins is everything on *this* side of the socket — the URL, the method, the headers,
   the serialised body — and nothing on the other. **The spec's success criterion "the six record
   nodes work against all five backends, verified live against each" is step 6's and is untouched by
   this work.**
2. **No editor was launched, and one cannot be driven from a worktree.** So: the picker has never
   been *seen*; nobody has watched it disappear in a single-backend project; no Class dropdown has
   been opened; no property port has been looked at in the property panel; the `query-filter` builder
   has never been drawn from the `{collection, fields}` schema on a Record-family node. All of it is
   asserted at the `sendDynamicPorts` boundary, which is one layer short of the eye.
3. **HMR.** The usual "relaunch, do not reload" caveat is untested for this change, because of (2).
4. **A `date`-typed port fed by a REST backend.** §2.3 keeps the Parse table for Parse-typed columns
   and `getEnhancedFieldType` for everything else, which means a Directus `dateTime` column gets a
   **`string`** port on a Record node where a Parse `Date` gets a `date` port. That asymmetry is
   deliberate and tested, but nobody has seen what the property panel draws for either against a real
   schema.
5. **`objectId` as a number.** Worker A's §2.5 decision means a Directus record arrives with
   `objectId: 7`. `CloudStore._fromJSON` passes that straight into `Model.get(7)`, and every Record
   node's `Id` output therefore carries a number where it has always carried a string. Nothing here
   coerces it (deliberately — the whole point of §2.5), and **nothing here proves the Model store,
   the repeater binding, or a `Record Id` input wired from one behaves.** This is the most likely
   place for a real defect in this slice.
6. **The `include`/relation read path.** No Record node passes `include` to the adapter; the family
   has never had an Include port. So a Directus M2O relation is a raw foreign key on a Record node
   even though `RestDataAdapter` can expand one. BCN-005's, and not attempted.
7. **`storageTotalCount` against a REST backend.** `count: true` reaches `RestDataAdapter.query`,
   which reads the profile's total rule (the `filter_count` fix). Never exercised with a real
   response here — the unit coverage for that is Worker A's, against the live rig, at the adapter.
8. **`search` against a REST backend.** A Query Records node with a term set and Supabase or
   PocketBase selected will get an explicit refusal from the adapter (Worker A's §2.7), surfaced on
   the node's `Error` port. That path was not driven; the port is not gated, so it is a refusal at
   runtime rather than a greyed-out port. BCN-010 owns the gating.
9. **The ACL on a REST backend.** `_getACL()` still runs and its result still reaches
   `create`, where `RestDataAdapter` logs a warning and drops it. Not exercised; the warning goes to
   the console, not to the node's `Error` port.
10. **Two model scopes against one REST backend.** The per-scope cache is tested with plain objects
    standing in for scopes; no sandboxed preview was run.
11. **The cloud runtime.** `runtimeMetaDataSources` returns `{}` when `NoodlRuntime.instance` is
    absent, so `forBackend` degrades to the legacy store — which is the pre-existing behaviour and is
    tested. Whether `records.js`'s cloud-function path *should* be able to name a backend was not
    asked; it cannot today.
12. **The `custom` backend type.** `restWireProfileFor('custom')` is `undefined` and the adapter
    refuses with a sentence. A Record node pointed at a `custom` backend therefore fails on every
    operation. Deliberate (`custom` is outside the profile family), untested here.
13. **`filterdbmodelsnode`'s global-`Model` defect** (it looks records up in the process-wide store
    rather than `nodeScope.modelScope`) is untouched and still there. It now applies per-backend
    rather than globally, which changes nothing about it.
14. **Whether the Backend picker belongs on Filter Records at all** is a product question nobody has
    answered. It gets one because the class it filters, and therefore the filter schema, comes from a
    backend — but it sends nothing anywhere, and a user may reasonably read the port as meaning it
    does.
15. **The editor's `BackendServices` panel does not know `_endpoint_` exists** as a selectable id. It
    is synthesised in the runtime from `cloudservices` metadata. If BCN-009 step 2 converges the
    storage, the id has to survive the conversion or every saved picker value pointing at it breaks.
16. **1932 editor specs, where step 4 recorded 1931.** One more spec, zero failures, and no editor
    file was touched here. Not chased.
