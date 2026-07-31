# BCN-004 step 4 — the port generator moved, and what moving it exposed

**Scope**: BCN-004 implementation step 4 / Desired State 3 only — *"Move the schema-driven port
generator out of the BYOB nodes and into a shared place the record nodes use, then wire Parse-wire
`/schemas` introspection into it."* The six Record nodes are **not** repointed here (that is step 5,
and it needs the `RestDataAdapter` first). What is delivered is a generator the Record family can
call, and a Parse-wire schema it can call it with.

---

## 1. What moved, and where

| Piece | Was | Is |
|---|---|---|
| Schema/field helpers (`shouldShowField`, `getEnhancedFieldType`, `getRelationFields`, `expandRelationFields`, `filterCollectionsByMode`, `isSystemCollection`) | `byob-utils.ts` | **`schema-ports.ts`**, re-exported from `byob-utils.ts` under the same names |
| Backend/collection/field/relation port building, duplicated 4× | inline in each `byob-*` node's `updatePorts` | **`schema-ports.ts`** composable builders |
| The schema vocabulary (`SchemaField`, `SchemaCollection`, `BackendServiceEntry`, …) | `byob-types.d.ts` | **`schema-types.d.ts`**, re-exported from `byob-types.d.ts` |
| Parse-typed schema → normalised collections | did not exist | `schema-ports.ts::collectionsFromParseClasses` (runtime) and `schemaParsers.ts::parseParseSchema` (editor) |
| Wire helpers (`resolveBackend`, `buildUrl`, `buildHeaders`, `normalizeValue`, `buildFieldsParam`, `pickTotalCount`) | `byob-utils.ts` | **unchanged** — that half is Worker A's `RestDataAdapter` to absorb |

The four BYOB `updatePorts` functions now compose from the shared builders and end with one
`sendSchemaPorts` call. Their emitted port sets are unchanged, pinned test-by-test (§4).

New public surface in `schema-ports.ts`:

```
resolveSchemaPortContext({graphModel, parameters, backendIdParam?, collectionParam?}) -> SchemaPortContext
backendPickerPorts(ctx, {group?, hideWhenSingleBackend?, name?, displayName?})
apiPathModePorts(ctx, {group?})
collectionPorts(ctx, {name?, displayName?, group?, placeholderLabel?, filterByApiPathMode?, extraEnums?})
fieldPorts(ctx, {prefix?, group?, readOnlyFields?, skipRelations?})
relationIncludePorts(ctx, {group?, prefix?})
getFilterFields(ctx)
dedupeSchemaPorts(ports, staticPorts?) / sendSchemaPorts(conn, nodeId, ports, {staticPorts}) / staticPortNames(nodeDefinition)
collectionsFromParseClasses(data) / parseFieldToSchemaField(name, field)
PARSE_TYPE_MAP / PARSE_READONLY_FIELDS / PARSE_WIRE_BACKEND_TYPES / TRAVERSABLE_RELATION_TYPES
```

Every option that exists is one the Record family needs and BYOB does not: `collectionParam:
'collectionName'`, `prefix: 'prop-'`, `extraEnums` for `_User`/`_Role`, `placeholderLabel: null`,
`hideWhenSingleBackend` for the phase's hide-when-one rule, `readOnlyFields:
PARSE_READONLY_FIELDS`. Step 5 should need no new parameters, only to pass these.

---

## 2. Stale premises found

### 2.1 ⚠️ "The generated catalog is the check" — it is not, for this family

The spec's trap list says the doubled-port fix's guard is the generated catalog. It cannot be. Every
`noodl.byob.*` entry in `node-catalog.json` reads:

```json
"parameterEncoding": { "known": false,
  "reason": "No parameter on this node carries the list its ports are generated from,
             so the port set could not be observed headlessly." }
```

Their ports come from **project metadata** (`backendServices`), and the catalog's observer
(`scripts/node-catalog/lib/observe-ports.js`) seeds *parameters*, not metadata. The catalog records
only the four nodes' static ports (`inputs: ['fetch']` for Query Data) plus a prose note that the
rest are runtime-discovered. **A doubled dynamic port would not appear in a catalog diff at all.**

The catalog was regenerated anyway and is byte-identical (§4) — which honestly proves that the
modules still load, the node definitions are unchanged and no *static* port moved, and nothing more.
The real check is the new `test/byob-dynamic-ports.test.js`, which drives each node's real
`setup()` and reads what `sendDynamicPorts` was called with.

### 2.2 ⚠️ Parse `/schemas` introspection did not exist in any useful sense

The spec says *"Parse-wire schema introspection exists (`/schemas`); wire it to the same port
generator."* What existed:

- `endpoints.schema: '/schemas'` on the `parse` and `nodegx` presets;
- `BackendServices.fetchSchema` will `GET` whatever that endpoint says;
- **no parser.** `parseSchemaResponse` had no `parse`/`nodegx` branch, so a Parse response fell
  through to `parseGenericSchema`, which looks for `collections`/`tables` arrays of `{name, fields}`
  and would have produced **zero collections, silently**.

Also, `packages/noodl-runtime/src/api/backends/ParseWireAdapter.ts` — named in the task brief as
"for how Parse `/schemas` introspection is reached" — contains **no schema introspection**. Two
prose mentions of the word "schema" and no route. The premise was stale.

### 2.3 ⚠️ Our own backend does not serve `/schemas`, and the `nodegx` preset points at it anyway

`packages/nodegx-backend/src/server/parse-wire.ts` says in its own header:

> Explicitly NOT implemented (the clients never call them): live queries, push, GraphQL, **client
> schema management**.

The NodeGX backend's schema lives at **`GET /api/_schema`** (and `/admin/schema`), answering
`{tables: [{name, columns: [{name, type, targetClass}]}]}` — a *different envelope* carrying the
*same* Parse type names (`SchemaManager`'s `TYPE_MAP` is `String`/`Number`/`Pointer`/…). So:

- `nodegx`'s `endpoints.schema: '/schemas'` would 404. `BackendServices.testConnection` uses the
  schema endpoint as its **connectivity probe**, so a built-in backend would also report a failed
  connection through that path. Not reproduced live — see §6.
- Both parsers therefore accept **three** Parse-typed envelopes: `{results}` (Parse), `{tables}`
  (NodeGX), and a bare array of `{name, schema.properties}` (the legacy `dbCollections` metadata).

**The preset cell is not corrected here.** `presets.ts` is not in this worker's territory, and
BCN-004-WIRE-FACTS §3 already proposes reworking preset endpoint/response cells wholesale. Recorded
for whoever owns that: `nodegx.endpoints.schema` should be `/api/_schema`, or `/schemas` should be
implemented in `parse-wire.ts`.

### 2.4 The legacy `dbCollections` cache has had nothing writing it since WF-007

`schemahandler.ts` — the thing that used to populate `dbCollections` from a Parse server — was
gutted in WF-007; `_fetch()` now sets `dbCollections = []` and stores that. So the Record family's
Class dropdown has had only the hard-coded `_User`/`_Role` in it since then. The `dbCollections`
fallback in `resolveSchemaPortContext` is therefore **dead in practice today**; it exists so that a
project carrying older metadata still works, and it is tested. The live path for step 5 is
`backendServices` + `parseParseSchema`, which now exists.

### 2.5 A neutral `number` column has been getting a string port

`getEnhancedFieldType`'s numeric branch was written against Directus' type names (`integer`,
`bigInteger`, `float`, `decimal`). Supabase's OpenAPI says `number` or `integer`; the Parse map says
`number`. So **every Supabase numeric column has been producing a string input port**. Fixed (§3.1).
The same class of gap remains for PocketBase and is deliberately left (§3.1).

---

## 3. Deviations, with reasoning

### 3.1 `number` added to the numeric branch — a fix, not a tidy-up

Behaviour change, deliberate, tested. It affects Supabase (previously string ports on numeric
columns) and the new Parse path. Directus is untouched — it never says `number`.

**Not fixed**: PocketBase's type names (`text`, `bool`, `json`, `select`, `relation`, `file`) still
fall through to `string`, so a PocketBase checkbox gets a string port. That wants a per-backend type
map checked against a live PocketBase, which is BCN-004 step 6's live pass, not a guess made here.
The gap is commented at the code.

### 3.2 `apiPathMode` is still emitted unconditionally

It is a Directus-only concept, and gating it on the resolved backend type was tempting. Rejected:
the ports a node offers must not depend on which backend happens to be selected when the catalog is
generated (there is no project metadata at all then), and gating would have changed the four nodes'
port sets. Callers who do not want it simply do not call `apiPathModePorts`.

### 3.3 `hideWhenSingleBackend` exists but is off

The phase decision (picker hidden in a single-backend project) is implemented as an option and left
**off** for the BYOB nodes, whose port set must not change here. Step 5 turns it on for the Record
family.

### 3.4 The Parse type map is duplicated across the editor/runtime boundary

`PARSE_TYPE_MAP` exists in both `schema-ports.ts` and `schemaParsers.ts`. The runtime may not import
the editor and the editor may not import the runtime; `@noodl/backend-contract` would be the third
home but it is another worker's territory this week. Both copies are driven by the **same fixture**
in their respective tests, so a drift fails an expectation rather than producing a quietly wrong
port type. If a third copy is ever wanted, that is the signal to promote it.

### 3.5 The doubled-port guard is structural, not a comment

RUN-003 slice 8's fix was three comments saying "do not push outputs here". Comments do not travel
to a new node family. `sendSchemaPorts` now **drops** (and warns about) any generated port whose
name collides with one the node declares statically, plus any duplicate within the generated list.
`staticPortNames(nodeDefinition)` derives the collision set from the definition, so a port added
later is covered without anyone updating a list.

### 3.6 The filter-builder helpers stayed in `byob-query-data.ts`

`parseFilterForConnectedPorts` and `toDirectusFilter` are exported for unit tests and belong to
BCN-003's filter-builder convergence, not to the port generator. Only the *port* half moved; the
`filter`/`sortField` ports are still built in the query node because only a query node has them.

### 3.7 The documented dead `fieldSchema` stash was kept

`byob-create/update`'s `setup` writes a field schema onto the editor-side `GraphNodeModel`, which
the runtime instance never reads — a DEFECT already documented verbatim in the instance type. It was
rewritten to use the shared context (less duplication) and left **behaviourally identical**. Making
it work is a different change from moving the generator.

---

## 4. Results — actual numbers

| Check | Result |
|---|---|
| `noodl-runtime` jest, full | **79/80 suites, 1428 tests passed, 0 failed.** The 80th is `agent-live-endpoint.test.ts`: 7 skipped tests, 0 run (pre-existing, needs a live API key) |
| New `test/schema-ports.test.js` | 39 tests, all pass |
| New `test/byob-dynamic-ports.test.js` | 25 tests, all pass |
| Existing `test/byob-utils.test.js` | 49 tests, unchanged file, all pass after the move |
| `npx tsc --noEmit -p packages/noodl-runtime/tsconfig.json` | **0 errors** (after `npm run build:types`; without `dist-types` present it reports 7 pre-existing `Cannot find module '@noodl/runtime'` in `noodl-viewer-react`) |
| `npx tsc --noEmit -p tsconfig.json` (root) | 18 errors, **all** `Cannot find module '@noodl-versioning'`, pre-existing, none in a file touched here |
| `npm run catalog:check` | `156 node types, 89 with dynamic ports, 24 port value types` — **committed catalog up to date, zero diff** (baseline before any edit: identical numbers) |
| `npm run catalog:merge:check` | `156/156 nodes documented` — enriched catalog up to date |
| Editor jest (`test:main`) | not applicable — the editor's specs are jasmine-style, run through webpack + Electron via `npm run test:ci` |
| Editor `npm run test:ci` (webpack + Electron, jasmine) | **1931 specs, 0 failures**, exit 0. `tests/models/BYOBSchemaParsers.test.ts` is registered through `tests/models/index.ts` and now carries 28 cases including the Parse ones |

### The two RUN-003 fixes, and what protects each

**Fix 1 — both field shapes must reach the ports.**
`test/schema-ports.test.js`, `describe('fieldPorts — RUN-003 fix 1: both field shapes must reach the
PORTS')`. The first two cases feed the **cached** `SchemaField` (parsed `hidden`, `enumValues`, no
`meta`) — the shape the nodes actually receive — and assert an enum dropdown is built and the hidden
column is skipped. The next case does the same with a **raw Directus** entry (`meta.options.choices`,
`meta.hidden`, `presentation-*`). RUN-003's bug was that only the raw shape was ever tested. There is
also an end-to-end assertion in `test/byob-dynamic-ports.test.js` (*"Create Record: one port per
writable column…"*) that `field_status` arrives at the editor as an `enum` port from the cached
shape, through the node's real `setup`.

**Fix 2 — no static port re-announced as a dynamic one.**
`test/schema-ports.test.js`, `describe('sendSchemaPorts — RUN-003 fix 2 …')` pins the guard
(collision with a static output, with a static input, duplicate in the list, input/output sharing a
name is fine). `test/byob-dynamic-ports.test.js` pins that the guard is *reached*: for all four
nodes it asserts no announced port repeats, none collides with a static input or output, and every
announced port is an input. Its last case proves the guard is not vacuous by feeding a port list
that *has* the defect and asserting it is dropped before `sendDynamicPorts`.

---

## 5. Behaviour deliberately preserved

The four nodes' announced port lists are asserted verbatim in `byob-dynamic-ports.test.js`:

- **Query Data** — `backendId, apiPathMode, collection, filter, sortField, sortOrder, limit, offset,
  fields, live, include_<relation>…, filter_<condition>…`; the `byob-filter` port still receives
  `{collection, fields}` with the dotted one-hop relation paths.
- **Create Record** — `backendId, apiPathMode, collection, field_<column>…`, read-only
  `id, date_created, date_updated, user_created, user_updated`.
- **Update Record** — the same plus `recordId`, read-only `id, date_created, user_created` (so
  `date_updated` *is* writable on an update, and Create's is not — asserted).
- **Delete Record** — `backendId, apiPathMode, collection, recordId`.

---

## 6. Could not verify — the honest list

1. **No live backend was contacted. At all.** No Parse Server, no NodeGX backend, no Directus,
   Supabase or PocketBase. Every Parse claim below is from reading code and the Parse documentation,
   not from a response.
2. **`parseParseSchema` has never seen a real `/schemas` response.** Its fixture is hand-written to
   the documented `{results:[{className, fields:{name:{type,targetClass}}}]}` envelope. WIRE-FACTS §4
   explicitly records Parse as *not probed* in this phase's probe. If the real response differs (a
   `classLevelPermissions` interaction, a field shape for `Relation` we did not anticipate), the
   parser is wrong in a way no test here would catch.
3. **Whether a Parse `/schemas` request is even permitted.** Upstream Parse gates `/schemas` behind
   the **master key**, and the `parse` preset's own help text says the master-key admin surface was
   retired and there is no admin key field. So schema introspection for a third-party Parse backend
   may be structurally impossible in NodeGX today. If so, `parseParseSchema` only ever serves the
   NodeGX `{tables}` envelope in practice. **This is the biggest open question in this slice** and it
   belongs to step 6's live pass.
4. **Whether `GET /api/_schema` needs auth, and what it answers on a running backend.** The
   `{tables:[{name, columns}]}` shape was read from `byob-admin.ts::getSchema` and
   `SchemaManagerLike`, not observed. Whether `columns` on a *live* backend carry `targetClass` for
   Pointers is likewise unverified.
5. **The `nodegx` preset's 404.** §2.3's claim that `testConnection`/`fetchSchema` would fail for the
   built-in backend follows from the route table but was not reproduced. `configuredBy:
   'managed-process'` may mean that code path is never taken for `nodegx`.
6. **No editor was launched.** The Backend Services panel's schema fetch was never clicked for a
   Parse or NodeGX backend; no node was dropped on a canvas; no port was seen in a property panel.
   Everything here is unit-level plus catalog generation.
7. **The `relation` port type is untested in the UI.** A Parse `Relation` field gets `type:
   'relation'`, which `getEnhancedFieldType` does not recognise and therefore renders as a **string**
   port. That is intentional (the Record family offers relations through its own `relationProperty`
   dropdown), but what the property panel actually draws was not looked at.
8. **`getEnhancedFieldType`'s `placeholder` is computed and thrown away.** Every port builder uses
   only `fieldType.type`; the ISO-8601 / `YYYY-MM-DD` / uuid placeholders never reach a port. That is
   pre-existing behaviour, preserved, and not investigated.
9. **Directus / Supabase / PocketBase were not re-verified live** after the move. Their code paths are
   unchanged except for the `number` fix (§3.1), which is exactly the sort of "unchanged, therefore
   fine" claim this phase has been burned by twice.
10. **The editor tests are outside the root `tsconfig`.** They pass (1931 specs, 0 failures), but
    the new `parseParseSchema` cases in `packages/noodl-editor/tests/models/BYOBSchemaParsers.test.ts`
    are typechecked only by the webpack test build — the root `tsconfig.json` includes
    `packages/noodl-editor/src/**`, not `tests/**`. A type error there would not fail a `tsc` gate.
11. **HMR.** Node registries go stale on reload; nothing here was exercised against a running editor,
    so the usual "relaunch, do not reload" caveat is untested for this change.

---

## 7. For step 5 (repointing the Record nodes)

- Use `resolveSchemaPortContext({graphModel, parameters, collectionParam: 'collectionName'})`.
- `collectionPorts(ctx, {name: 'collectionName', displayName: 'Class', group: 'General',
  placeholderLabel: null, filterByApiPathMode: false, extraEnums: [{label:'User', value:'_User'},
  {label:'Role', value:'_Role'}]})` reproduces today's Class dropdown, with the introspected classes
  appended instead of absent.
- `fieldPorts(ctx, {prefix: 'prop-', group: 'Properties', readOnlyFields: PARSE_READONLY_FIELDS})`
  reproduces today's property ports. Note the Record family currently maps `Date` to a `date` port
  type of its own; `getEnhancedFieldType` maps `dateTime` to `string` with a placeholder. **That is a
  real difference to decide on**, not an oversight of the move.
- `backendPickerPorts(ctx, {hideWhenSingleBackend: true})` is the phase's hide-when-one rule.
- End with `sendSchemaPorts(conn, nodeId, ports, {staticPorts: staticPortNames(def.node)})` — the
  Record family's `_additionalDynamicPorts` hook pushes ports too, and the dedupe covers it.
- The Record nodes' relation dropdown wants `relationType === 'many-to-many'` fields, which
  `collectionsFromParseClasses` and `parseParseSchema` both now mark.
