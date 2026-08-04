# AAQ-002 — The provisioned backend is first-class

**Findings:** #4 (a "Built-in backend" card that can only edit/disconnect; disconnect makes it
vanish), #7 (`prop-age` / `prop-bio` port errors on Create Record)
**Status:** open

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
