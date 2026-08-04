# AAQ-002 — The provisioned backend is first-class

**Findings:** #4 (a "Built-in backend" card that can only edit/disconnect; disconnect makes it
vanish), #7 (`prop-age` / `prop-bio` port errors on Create Record)
**Status:** slices 1–3 built (2026-08-04); slice 4 open. Criterion 5 has now been answered **three
times, by three different mechanisms**, and the live pass produced the third — read the next section
first. Criterion 2 **fails live**, for a cause nobody had identified.

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

### Still open

- **Slice 4 — the agent knows the schema.** The authoring context carries no backend schema block at all
  (`ContextBuilder` has none), so the agent still writes `prop-*` names from the scope's prose rather
  than from the collections that exist. With slice 3 in place the ports now *exist*, so a wrong name is
  a caught diagnostic rather than a phantom port — which is why this is the remainder rather than the
  blocker.
- Criteria 1–3 are live-QA criteria and have not been driven.

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
