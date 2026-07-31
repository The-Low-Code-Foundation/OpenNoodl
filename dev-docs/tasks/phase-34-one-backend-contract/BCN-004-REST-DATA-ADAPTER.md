# BCN-004: The REST Data Adapter & the End of the BYOB Node Family

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-004 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 2 — the adapters |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium-Hard — three backends, one retirement, and the first task with a user-visible node change |
| **Estimated Time** | 1.5–2 weeks |
| **Prerequisites** | BCN-002, BCN-003 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** |

## Objective

Implement `RestDataAdapter` for Directus, Supabase and PocketBase against `IDataAdapter`, then **retire
the five `noodl.byob.*` node types** — their behaviour absorbed by the record nodes, which from this
task forward serve every backend.

## Background

The five BYOB nodes are the whole reason a user sees two families:

| Type | Label | Replaced by |
|---|---|---|
| `noodl.byob.QueryData` | Query Data | `DbCollection2` — Query Records |
| `noodl.byob.CreateRecord` | Create Record | `NewDbModelProperties` — Create New Record |
| `noodl.byob.UpdateRecord` | Update Record | `SetDbModelProperties` — Set Record Properties |
| `noodl.byob.DeleteRecord` | Delete Record | `DeleteDbModelProperties` — Delete Record |
| `noodl.byob.SubscribeToChanges` | Subscribe To Changes | BCN-008 |

The right-hand column is also the [phase-30 duplicate-label finding](../phase-30-node-library-audit/FINDINGS.md):
"Delete Record" is the only pair where the disambiguating word ran out, and the other three only avoided
collision by padding the Parse-family names ("Create **New** Record"). Retiring the left column lets
BCN-010 drop the padding.

**What is being retired is the node types, not the work.** The BYOB implementation is better than the
Parse family's in several measured places — RUN-003 slices 4–7 fixed relation parsing, enum dropdowns,
`totalCount` against filtered queries, dotted-path filters and a cross-host WebSocket defect, all
verified live. That code becomes the REST adapter. The nodes it hangs from change.

## Current State

| Piece | State |
|---|---|
| BYOB runtime nodes | `byob-{query-data,create-record,update-record,delete-record,subscribe}.ts` + `byob-realtime.ts`, `byob-utils.ts` (468 lines), `byob-types.d.ts` |
| Schema parsers | `schemaParsers.ts`, 271 lines — Directus, Supabase (PostgREST), PocketBase; unit-tested pure |
| Backend resolution | `byob-utils.ts::resolveBackend`, `_active_` sentinel, reads `backendServices` metadata |
| Dynamic ports | schema-driven via `sendDynamicPorts`; enum ports, hidden-field skipping, relation includes |
| Live verification | Directus **and** a live PostgREST stack verified (RUN-003 slices 4–6) |
| Known residuals | O2M/M2M unparsed (needs `GET /relations`); full live-Supabase CRUD pass never run; PocketBase parser never exercised against a real instance |
| Our own backend | already answers `/api/:table` — `nodegx-backend/src/server/byob-admin.ts` |

That last row is this task's safety net: `nodegx-backend` speaks both wires, so the REST adapter can be
exercised against a backend we control before any third-party instance is involved.

## Desired State

### 1. `RestDataAdapter implements IDataAdapter`

One adapter, configured per backend type by the existing `BackendPreset` (endpoints, response envelope,
pagination style) plus BCN-003's translator. The three backends are configuration and a translator, not
three adapters — that is what the preset system was built for.

### 2. The record nodes serve every backend

`DbModel2`, `DbCollection2`, `NewDbModelProperties`, `SetDbModelProperties`, `DeleteDbModelProperties`
and `FilterDBModels` resolve an adapter from the selected backend and call the contract. A backend
picker input appears on each, defaulting to the active backend and **hidden when the project has one
backend** (phase decision).

### 3. Schema-driven dynamic ports, generalised

The BYOB nodes' best feature — ports generated from the introspected schema, with enum dropdowns,
hidden-field skipping and relation includes — becomes how the record nodes work against *every* backend
including Parse and NodeGX. Parse-wire schema introspection exists (`/schemas`); wire it to the same
port generator.

### 4. The five BYOB types are gone

Deleted from the runtime, the viewer's `register-nodes`, and `nodelibraryexport.js`. Projects using them
break — that is the [fresh-start policy](../../reference/COMPATIBILITY-POLICY.md) applied deliberately,
and LIB-006's honest-import report is where a converted project learns about it. **Add a migration entry
so the report names the replacement node**, rather than reporting an unknown type.

### 5. RUN-003's residuals closed

The full live-Supabase CRUD pass and the PocketBase parser exercise against real instances both happen
here. They were deferred out of RUN-003 and this is the task that cannot ship without them, because
this is where those two backends stop being "believed to work."

## Implementation Steps

1. `RestDataAdapter` against `IDataAdapter`, preset-configured, consuming BCN-003's translators.
2. Normalise the response envelope — data path, total count, pagination — into the contract's shape.
   RUN-003's `pickTotalCount` (`filter_count` preferred over `total_count` on filtered queries) is a
   fix that must survive; it is exactly the class of bug that returns a plausible wrong number.
3. Generalise `resolveBackend` to serve every adapter, with `_active_` and the single-backend default.
4. Move the schema-driven port generator out of the BYOB nodes and into a shared place the record nodes
   use, then wire Parse-wire `/schemas` introspection into it.
5. Repoint the six record nodes at the contract; add the backend picker with its hide-when-one rule.
6. **Live pass per backend** — Directus, Supabase, PocketBase, `nodegx-backend` via `/api/:table`, and
   Parse-wire — each exercising query-with-filter, create, update, delete, and pagination against a
   filtered set.
7. Delete the five BYOB node types and their registrations; add the migration entries.
8. Flip the descriptor cells.

## Success Criteria

- [ ] One `RestDataAdapter` serves all three REST backends via preset configuration.
- [ ] The six record nodes work against all five backends, verified live against each — including the
      **first full live-Supabase CRUD pass** and the **first real PocketBase exercise**.
- [ ] Dynamic ports are schema-driven for every backend, Parse and NodeGX included.
- [ ] The backend picker defaults to active and is invisible in a single-backend project.
- [ ] `filter_count`-style total-count correctness holds on filtered queries in every backend.
- [ ] The five `noodl.byob.*` types no longer exist in the runtime, the viewer registry, or the export.
- [ ] The import report names the replacement node for each retired type.
- [ ] Runtime and editor suites green; the catalog regenerates without the retired types.

## Out of Scope

- **Relations beyond what exists.** M2O read already works for Directus and Supabase; BCN-005 owns the
  rest. Do not start `GET /relations` here.
- **Auth, files, realtime.** BCN-006/007/008. `SubscribeToChanges` keeps working from its current
  implementation until BCN-008 moves it; retire that fifth type **in BCN-008, not here**.
- **The filter builder convergence.** BCN-003 owns it.
- **Deleting `uba-e2e/`.** It is the e2e rig despite the name (RUN-003 slice 8 kept it deliberately).

## Traps

- **`nodegx-backend` answering `/api/:table` makes the REST adapter look finished before it is.** A
  green pass against our own backend proves the adapter's shape, not its Directus/Supabase/PocketBase
  correctness. Each third-party backend needs its own live pass; this trap is the reason RUN-003 shipped
  with Supabase and PocketBase unverified.
- **Retiring `SubscribeToChanges` here would leave realtime dead** between this task and BCN-008. It is
  the one of the five that must wait.
- **The BYOB nodes' `updatePorts` once re-pushed every static output as a dynamic port**, so
  `getPorts()` listed each output twice — fixed in RUN-003 slice 8. When the port generator moves, the
  fix must move with it; the generated catalog is the check.
- **Schema caches are the seam that has already bitten.** RUN-003 slice 4 found `byob-create/update`
  feeding cached `SchemaField`s (no `meta`) into utilities that only read raw Directus `meta` — enum
  dropdowns and hidden-field filtering were silently dead in the real editor flow while every test
  passed. Any utility the generalised port generator calls must accept both shapes or the same class of
  bug returns for five backends instead of one.
- **A retired node type is not the same as a deprecated one.** Phase 30's picker duplicates are mostly
  deprecated-shadowing-modern pairs that still resolve. These five are being *deleted*; a project
  referencing them fails to load a node, and the import report is the only thing standing between that
  and a blank canvas.
- **HMR keeps stale node registries.** Relaunch the editor rather than reloading after touching
  `register-nodes` — a reload against a stale registry produces "the node does not exist" for a node
  that does.