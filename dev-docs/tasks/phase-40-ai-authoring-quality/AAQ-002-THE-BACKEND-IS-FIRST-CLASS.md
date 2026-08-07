# AAQ-002 — The provisioned backend is first-class

**Findings:** #4 (a "Built-in backend" card that can only edit/disconnect; disconnect makes it
vanish), #7 (`prop-age` / `prop-bio` port errors on Create Record)
**Status:** ✅ **CLOSED.** All four slices built (1–3 on 2026-08-04, F4/F5 and slice 4 on
2026-08-05) and **all five criteria driven live on 2026-08-05**. Finding #7 needed a **fourth**
mechanism, which the criterion-2 drive found and which had nothing to do with backends at all —
see below. Editor suite **2198 specs, 0 failures**; runtime suite **2144 passed**; both typechecks
clean.

## ⚠️ The fourth mechanism, and it is the one that mattered

Criterion 2 was driven with **every earlier mechanism fixed**: the project had its own backend
(F4), `Puppy` was created *with* its three columns (F5), and `dbCollections` cached them exactly.
The Class dropdown listed `Puppy`. And there were still **no `prop-*` ports**.

The cause is in the Record family's mixin assembly, not in any schema:

```ts
// dbmodelcrudbase._addBaseInfo, before this task
const _includeInputProperties = opts === undefined || opts.includeInputProperties;
```

That expression is only right while **no other option exists**. ERG-001 §4 (`67d2c339`) added a
`done` sentence to the same options object, so `addBaseInfo(def, { done })` made `opts` defined,
`opts.includeInputProperties` was `undefined`, and the whole thing went falsy. **Create Record and
Update Record stopped emitting a single `prop-<field>` port** — on every backend, in every project,
from that commit onward. The two relation nodes already passed `{ includeRelations: true }` and were
unaffected; Delete Record's `includeInputProperties: false` was already correct.

Two things make this worth reading twice:

1. **It presents exactly like a schema bug.** `recordClassPorts` kept working throughout, so the
   node *knew the collection existed* and offered no way to write to it. That is precisely the shape
   of Richard's report, and it is why three plausible schema mechanisms were proposed and fixed
   before anyone looked at the flag.
2. **The discriminating probe took one minute and should have come first.** A `DbModel2` (Record)
   node added to the same project with `collectionName: 'Puppy'` came back with `prop-name`,
   `prop-age`, `prop-bio` — it gates only on `ctx.selectedCollection`. Same project, same cache, same
   collection, ports present. That isolates the flag and rules out the entire schema chain in one
   step.

### The fix, and why it is not a corrected default

The flags are **gone**, not re-defaulted. `_hasInputProperties` is set by `addInputProperties` and
`_hasRelationProperty` by `addRelationProperty` — the mixins that actually build the things those
flags gate — and both are read inside `_updatePorts` rather than captured, because `addBaseInfo`
runs *first* in every one of these files. Writing `opts?.includeInputProperties !== false` would
have fixed today's symptom and left the next person who adds an option to `addBaseInfo` holding the
same loaded gun. This is the **one-fact-in-two-places** class the Layer-1 live pass named, and the
phase has now paid for it twice.

`record-property-ports.test.ts` is the gate, and it is deliberately written at the altitude the
defect lives at: it drives the **assembled node modules** through `setup()` and asserts what reaches
`sendDynamicPorts`. `schema-ports.test.js` and `record-picker-single-backend.test.ts` both exercise
the pure generators, which were never broken, and both stayed green for the whole year. Confirmed to
fail 4/10 against the old behaviour before being kept.

## The live pass, 2026-08-05 — criteria 1, 2 and 3

Driven with `scripts/aaq40-live/` into a scratch project, then **re-opened cold after a full editor
restart**, which is what "at first load" has to mean.

**Criterion 1 — one card. PASSES.** Exactly one card for the provisioned backend, exactly one
`ACTIVE` badge, exactly one "This project uses this backend", and **no `CloudServicesEndpointSection`
at all** — the second, crippled "Built-in backend" card of finding #4 is gone. Schema opens and lists
`Puppy` with `name`/`age`/`bio` at the right types; Data opens from the card's own button and shows
the row.

**Criterion 2 — live ports and a real write. PASSES.** On the cold-opened project the Create Record
node carries `prop-name`, `prop-age`, `prop-bio`, and the editor holds **zero** port warnings.
Setting real values and clicking the authored form's button in a real preview wrote
`{name: "Biscuit", age: 4, bio: "A beagle mix…"}` into `Puppy`, visible in the Data Browser, and the
node's `done` fired the navigation back to the listing page. Finding #7 is closed end to end.

**Criterion 3 — disconnect. PASSES.** The dialog reads *"This project stops using this backend. The
backend keeps running on this computer and none of its data is deleted — it stays in this list, and
you can connect the project to it again at any time."* After confirming: `cloudservices` is `{}`, the
backend is still running, the card is **still listed**, and the `ACTIVE` badge and the "uses this
backend" line are gone. Nothing vanished.

**F4 and F5 confirmed live, not merely spec-covered.** The provision created a *new* backend named
`aaq002-pass backend` (so `backendNameForProject` is reaching production), stamped
`projectIds: ["cad96fbb-…"]`, and did **not** adopt the machine's legacy `App backend` — which still
sits there with `projectIds: []`, owned by nobody and now reusable by nobody, which is the point.

**And one designed behaviour confirmed by accident:** after the restart the backend process was
*stopped*, and the `prop-*` ports were still there. `fetchBuiltInSchema` returning `undefined`
rather than `[]` for a sleeping backend is what keeps the saved cache — the rule its docblock states,
observed working.

Three defects were found along the way and filed rather than patched: **AAQ-011 F9** (every
wizard-built app carries a permanent *false* "this Router has no Pages" warning), **F10** (nothing
starts a project's backend when the project opens), **F11** (the Data Browser's first open reports
"Failed to load tables" when nothing is selected).

## What changed on 2026-08-05, after Richard's two decisions

The live pass left criterion 2 failing for a cause it had correctly identified but deliberately not
patched, because both halves were product decisions. Richard took them:

- **A project gets its own backend** (F4). Reuse now requires **ownership *and* name**. Ownership lives
  in `config.projectIds`, stamped by `backend:create` — a field that had been written empty and read by
  nobody since the backend manager was written, with three separate modules carrying a comment saying so.
  A backend one project owns can never be adopted by another, and every backend that predates the stamp
  is owned by nobody and therefore reused by nobody. That last part is the point, not an edge case: a
  legacy "App backend" holding three apps' collections is exactly what must not be picked up again.
  The name is no longer a constant either — `backendNameForProject` gives
  `PlanFromScopeOptions.backendName` its first production caller in two phases, and the wizard reports
  its draft name to the launcher so the review screen names the backend the apply will actually create.
- **Provisioning may fully reconcile an existing collection, type changes included** (F5).
  `planSchemaReconciliation` is the pure difference between what exists and what the plan wants; the
  provisioner adds the missing columns and retypes the mismatched ones, advisory throughout.

⚠️ **A type change did not exist anywhere in the stack.** The admin surface had four actions — create,
add, rename, delete — and SQLite has no `ALTER COLUMN`. `SchemaManager.changeColumnType` is the fifth:
metadata-only when both types share a storage class (`TYPE_MAP` collapses nine Noodl types onto three SQL
ones, so most changes are), and add-copy-drop-rename when they do not. It refuses system columns and
refuses `Relation` in both directions — a Relation lives in a junction table, so "converting" one creates
or destroys associations. **It is lossy by SQLite's own CAST rules** (`'sold out'` becomes `0`), which is
pinned in a spec and reported to the user as a count of converted values. What makes that defensible is
F4: the collection being reconciled now always belongs to *this* project.

Two traps in the mechanisms, both of which would have failed silently:

- **Column matching must be case-insensitive.** SQLite identifiers are, so `ADD COLUMN age` against a
  table holding `Age` fails with `duplicate column name` — which `SchemaManager.addColumn` **swallows**.
  A case-sensitive compare would emit an addition that does nothing and reports success.
- **A column whose recorded type is unknown** (an import, an older schema) has no `TYPE_MAP` entry, so a
  rebuild would emit `ADD COLUMN "x" undefined`. That case corrects metadata and touches no data.

## ⚠️ The live pass, 2026-08-05 — `prop-*` still does not exist, and the reason is new

Driven end to end through the launcher (`scripts/aaq40-live/`). Slice 3 works: `dbCollections` is
populated the moment the binding lands, with `Puppy` in it. The ports still do not appear, and the
chain — measured, not reasoned — is:

1. **The provision bound the new project to ANOTHER PROJECT'S BACKEND.** `findReusableBackend` matches
   on **name alone**, and `provisionFromScope` always names it *"App backend"*. So every AI-created
   project on a machine binds to the first one ever provisioned there. The new puppy project came up
   pointing at a backend created two days earlier, carrying `Conversation`, `Message` and `Inquiry` from
   unrelated apps. The docblock justifies name-matching by *idempotence within one plan* — which it
   achieves — but the lookup is machine-wide and the name is a constant. **Two unrelated apps silently
   share one datastore.** Verified: `backend:list` shows one "App backend", created 2026-08-03, bound to
   a project created 2026-08-05.
2. **`backend:createTable` does not reconcile an existing table.** It returns `created: false` and adds
   nothing. Proven both ways in one session: a *new* table created with columns comes back with those
   columns; `Puppy`, which already existed in the reused backend, came back with `columns: []`.
3. `SchemaHandler` then caches `columns: []` **faithfully** — slice 3 is not at fault — and
   `recordFieldPorts` iterates a field list that is empty, so no `prop-*` port is generated.

So finding #7's third and actual mechanism is **backend reuse plus a non-reconciling createTable**, not
timing (the task's original claim) and not the missing cache write (Layer 1's correction, which was real
and is fixed). Both parts of the new mechanism are **product decisions, not bugs to quietly patch** —
whether a second project gets its own backend, and whether provisioning may alter an existing schema —
so they are filed here rather than fixed. They are the top of AAQ-002's remaining work.

### The other thing the live pass found: the parameter is `collectionName`

The Record family passes `collectionParam: 'collectionName'` to `resolveSchemaPortContext`, **whose own
default is `'collection'`**. Setting `collection` on a Create Record node is completely inert: it is a
runtime-discovered port, so the catalog does not declare it, `checkParameterValues` skips dynamic-port
nodes entirely, and nothing diagnoses it. This is AIB-010's lesson again — a name-typed parameter checked
for being a string and never for resolving — and it is the strongest argument for slice 4 there is: a
careful reader with the source open got it wrong by reading the resolver instead of the caller.

## ⚠️ Criterion 5 (Layer 1) — the hypothesis was wrong, and it mattered

This file said the `prop-*` ports come from a schema cache that *something else* fills, so the agent's
parameters land before it happens — a **timing** problem, with the trigger to be identified live.

There is no trigger. `SchemaHandler._fetch()` — the only writer of the `dbCollections` metadata the
Record family's port generator falls back to — had been a **stub since WF-007**: it set
`dbCollections = []`, `haveCloudServices = false`, and `_store()` then wrote `undefined`, on **every
`window-focused` and every `cloudServicesChanged`**. The other source, `backendServices.backends[]`,
only ever holds BYOB configs, and the synthetic entry the runtime builds for a `cloudservices` pointer
(`endpointBackendEntry`) carries no `schema` at all.

So `prop-*` ports for a built-in backend could not exist **at any point**, for any project, no matter
what order anything happened in. Provisioning was never late; the cache was never written, and was
actively cleared twice a minute.

Chain, for the next reader: `record-ports.ts` → `resolveSchemaPortContext` (`schema-ports.ts:477`) →
`selectedBackend?.schema?.collections` (empty for an endpoint) → `dbCollections` fallback →
`schemahandler.ts`.

## What was built

**Slice 1 — one card per backend.** `matchEndpointToManaged` (pure, in `backendList.ts`) resolves the
endpoint pointer to the managed process it names: by `instanceId` first — `provisionBackend` writes it,
so the match is exact — and by **localhost** port second, for bindings that predate it. `buildBackendList`
folds the pair into the managed entry, which carries `isProjectEndpoint` and the ACTIVE badge; the
endpoint entry survives only for a deployed or foreign server, where there is no process to fold into.

The panel does the same, and this is where the *user-visible* defect actually lived: the endpoint card
and the local card are **two different components**, not two entries of one list. `LocalBackendCard`
gained the badge, the "This project uses this backend" line, Set active, and Disconnect;
`CloudServicesEndpointSection` is not rendered when the endpoint is one of ours.

**Slice 2 — disconnect tells the truth.** A confirmation dialog that says the backend keeps running,
none of its data is deleted, it stays in the list, and the project can be reconnected. The card does not
vanish, because the card is now the managed one.

**Slice 3 — the schema cache is written.** `SchemaHandler._fetch()` introspects the built-in backend the
project points at, over the same IPC the Data Browser uses (`backend:list` → `backend:status` →
`backend:getSchema`), and caches `{ tables }` — the shape `collectionsFromParseClasses` already
normalises. A foreign Parse server still yields nothing, for WF-007's reason: no master key is stored and
we must not pretend to have one. **No provision-time write was needed**: `setCloudServices` raises
`cloudServicesChanged`, which is one of this handler's two triggers, so the cache fills the moment the
binding lands.

### Corrections to this file's stated mechanisms

- **`dataBrowserAvailability`'s `kind !== 'managed'` refusal is not what Richard hit.** That function has
  exactly one production caller — `LocalBackendCard`, which always passes `'managed'` — and
  `buildBackendList` has **no production caller at all**. The panel composes three separate card
  components. The model seam and the view are now consistent, but the fix that a user will see is the
  panel's.
- `endpointLocalStatus`'s port match is left in place for the case where an endpoint cannot be resolved
  to a managed process.

### Slice 4 — the agent knows the schema (built `437ec919`)

The authoring context carried **no backend block at all**, so the agent wrote `prop-*` names from the
scope's prose. It now carries one, and the argument for it is not the model's failure but a human's: the
`collectionName` mistake below was made by a careful reader with the source open. If reading the code
gets the parameter *name* wrong, guessing field names from prose was never going to come out right. So
the block spells out `collectionName`, the `prop-` prefix, and that `objectId`/`createdAt`/`updatedAt`
belong to the backend — none of which any catalog entry declares.

⚠️ **The list needs two sources, and a one-source version is wrong in the common case.** At authoring
time a wizard-built project has **no backend**: the provision is an operation in the same plan and
applies at Apply, *after* every authoring turn has finished. So the plan's own `PlanProvisionSpec` is the
only description of the collections that exists while the graph is being written; a project that already
has a backend has the opposite. `mergeSchemaCollections` unions them, the plan winning on a disagreement
because it is the newer statement of intent and the user approved it at plan review. Bound in
`ProjectAuthoringView` beside `backendFacts`, for the reason that function already gives: nothing else in
the product knows both halves.

The handout follows `libraryOverview`'s absent-means-omitted convention, so a project with no backend and
no planned provision sends a **byte-identical** opening turn to before — AIX-007's cache-stable prefix is
untouched. The block sits in the stable half right after the catalog, because the agent needs it *before*
it reaches a Record node.

### Still open

Nothing in this task. What it leaves behind, all in the register:

- ✅ **AAQ-011 F8 — closed `61579634`.** The *review* path told the model the built-in backend's
  collections were "unknown, not absent", on a premise Layer 1 made stale; it now reads that Layer 1
  cache through `builtInSchemaCollections`.
- ✅ **AAQ-011 F9 — closed `339b3009`.** The false `⚠ 1` on every wizard-built app was a missing
  `clearWarning`, not a wrong diagnosis.
- **AAQ-011 F10, F11** — found during the criteria 1–3 drive; F10 in particular decides whether a
  wizard-built app works the second time it is opened.

## The mechanisms

### One backend, two identities (verified)

`provisionBackend.ts` creates a **managed** local process, then binds the project by writing
`cloudservices` (`provisionBackend.ts:198`). The Backend Services panel builds its list from three
sources (`backendList.ts:150-213`); the binding surfaces as the **endpoint** entry, named "Built-in
backend" (`backendList.ts:127`), and
[`dataBrowserAvailability`](../../../packages/noodl-editor/src/editor/src/models/BackendServices/backendList.ts#L270)
refuses the Data Browser for any `kind !== 'managed'` — with a reason string written for *foreign*
Parse servers ("edited in its own admin"), shown here about a process this very editor started.
The schema surface is gated the same way. So the card wearing the ACTIVE badge is the crippled one,
while the managed entry that could open everything sits beneath it (or isn't distinguishable as the
same backend at all). "Disconnect" removes the pointer; the process and its data survive, which to
the user reads as deletion.

### The ports come from a cache nobody fills (mechanism verified, timing hypothesis)

`prop-<field>` ports on the Record family are generated from a **normalised, cached schema**
(`record-ports.ts:161-183`, fed by `schema-ports.ts`, cached in `backendServices` metadata; the
editor's `schemaParsers.ts` normalises introspection results). Provision creates the collections
with columns (`backend:createTable`, advisory) — but nothing in the provision path introspects the
running backend and writes the schema cache. The agent authors `parameters: { 'prop-age': … }`
against ports that will not exist until something else (opening the Data Browser?) triggers
introspection. *Hypothesis to verify live: what exactly populates the cache today, and when.*

## What to build

### Slice 1 — one card per backend

`buildBackendList` matches the endpoint pointer to a managed entry (localhost endpoint + port ↔
managed process port, or the `cloudservices.id` it already writes — `provisionBackend.ts:198` binds
`id: meta.id`, which IS the managed id; use that, it is exact). One entry, kind `managed`, carrying
the ACTIVE state, with schema/data/Data Browser available. The module note in `backendList.ts` says
BCN-009 step 2 already converged selection ids — this is the display-side completion of that work.

### Slice 2 — disconnect tells the truth

Disconnecting a bound managed backend says what will happen: the project stops pointing at it, the
backend and its data remain, and where to find it (the managed list). The managed entry must remain
visible after disconnect.

### Slice 3 — the schema cache is written at provision

After `backend:createTable` succeeds, the provisioner introspects the running backend (it is up —
`waitForRunning` already gated on that) and writes the normalised schema into the same metadata the
Record ports read, so `prop-*` ports exist the moment the plan's graph operations apply. The undo
story follows the provision's existing rule: the cache write is machine-convenience, not undo-group
state.

### Slice 4 — the agent knows the schema

The authoring context already knows the provision's collections (`spec.collections`). The plan
context / authoring reference material must carry the collection names and fields so `prop-*`
parameters are written against the real schema rather than the scope's prose. (This is the AIB-010
lesson — named references resolve — applied to schema fields.)

## Acceptance criteria

1. Cold replay: after Apply, Backend Services shows **one** card for the provisioned backend, ACTIVE,
   with Schema and Data both openable, showing the provisioned collections.
2. The Create Record node in the authored admin page has live `prop-*` ports at first load — zero
   port-doesn't-exist errors — and creating a record through the built UI writes a row visible in the
   Data Browser.
3. Disconnect: pointer removed, managed card still listed and running, copy states both facts. No
   entry silently vanishes.
4. Jasmine/jest coverage for the list unification (pure `buildBackendList` — it's already a seam) and
   for the provision-time schema write.
5. The timing hypothesis is confirmed or corrected in this file before the fix lands.

## Traps

- The Data Browser speaks **IPC to the local process manager, not HTTP** (`backendList.ts` module
  note) — unification must route by managed id, not by URL, or gate 2 re-opens.
- `getCloudServices` is a lossy projection (AIB-007's `workspaceId` lesson). Any new read/write of
  that metadata goes through raw `getMetaData`/`setMetaData` when round-tripping.
- The editor test suite lies three ways; only the `Jasmine:` line counts for editor specs.
