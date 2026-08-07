# BCN-009: One Backend List, One Picker, One Security Disclosure

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-009 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 3 — the surface |
| **Priority** | 🟠 High |
| **Difficulty** | 🟠 Medium-Hard — the engineering is modest; the security disclosure is a product-voice problem |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | BCN-001, BCN-006 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — the disclosure decides what a beginner understands about their own app's security, and the wording is the deliverable |

## Objective

One list of six backends in one panel, one `cloudservices`-and-`backendServices` metadata surface
instead of two, and an honest, legible statement of what each backend's security model means for the app
the user is about to publish.

## Background

Richard's target:

> The backend panel gives a clear choice between Directus, Supabase, PocketBase, Parse Server, custom,
> SQLite or whatever you want to call our NodeGX internal one. In the end a user will likely never have
> more than one backend, so that choice is a kind of definitive one for their project.

Most of the panel already exists. [`BackendServicesPanel/`](../../../packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/)
holds `LocalBackendCard` and `CloudServicesEndpointSection` (the Parse-wire side, where WF-007 relocated
endpoint config) directly beside `BackendCard` and `AddBackendDialog` (the BYOB presets). **One panel,
two unrelated mechanisms, which is exactly why the duplication reads as intentional to a user.**

The missing pieces are the preset entries — `BackendType` is still
[`'directus' | 'supabase' | 'pocketbase' | 'custom'`](../../../packages/noodl-editor/src/editor/src/models/BackendServices/types.ts#L20),
with no Parse and no NodeGX — and the metadata unification underneath.

The part that is not merely plumbing is the **security disclosure**. Today the two families sit on
different models and the difference is invisible:

- BYOB publishes a `publicToken` into the deployed app, **visible to every visitor**, and relies on the
  backend's anon role being locked down. The type comments say so
  ([types.ts:49-54](../../../packages/noodl-editor/src/editor/src/models/BackendServices/types.ts#L49-L54));
  nothing in the UI does.
- Parse-wire publishes an appId and relies on ACLs enforced server-side.

Under one merged node family, a user could change backends in a dropdown and **silently change their
app's security model.** That is the thing this task exists to prevent.

## Current State

| Piece | State |
|---|---|
| Panel | one panel, two mechanisms — local card + endpoint section, and preset-based backend cards |
| `BackendType` | four values; no `parse`, no `nodegx` |
| Metadata | `cloudservices` (Parse-wire) and `backendServices` (REST) — two keys, two shapes |
| Data Browser | mounted under `LocalBackendCard` (`backendSurfaces.tsx:100`), speaks `/api/:table` |
| Token disclosure | a comment in a type definition |
| Per-node backend selection | BYOB nodes have it with `_active_`; Parse nodes have no picker at all |

## Desired State

### 1. Six presets, one list

Directus, Supabase, PocketBase, **Parse Server**, **NodeGX** (the built-in one), Custom. Parse Server is
nearly free — we already speak the wire. NodeGX as a preset finally delivers the half of
[RUN-003's decision](../phase-16-runtime-deploy-health/RUN-003-ASSESSMENT.md) that never landed.

**The NodeGX preset's name is Richard's call** — "SQLite", "NodeGX", "Built-in" all say different things
to a beginner. Recorded as an open question.

### 2. One metadata surface

`cloudservices` and `backendServices` converge. The exporter injects one shape into deployed apps; the
runtime resolves one shape. Two keys with overlapping meaning is how the drift happened and leaving them
is how it recurs.

DEP-001's un-frozen backend endpoint matters here: a deployed app whose backend binding is baked cannot
be repointed without a rebuild. This task does not depend on DEP-001, but it is cleaner after it and
should not design *against* it.

### 3. The picker, defaulted and hidden

Every data, auth and file node takes a backend, defaulting to the project's active backend. **When a
project has exactly one backend the input is not rendered at all** — no port, no property row, no
mention. It appears when a second backend is added. This is the phase decision, and it delivers
Richard's "a data node should automatically point to the backend chosen" without removing the capability.

### 4. The security disclosure

Each preset states, in the panel and before publish, in a builder's language:

- whether a token will be **visible to every visitor** of the deployed app,
- where access rules are enforced and **which product's admin UI configures them**,
- what changing backends would change about both.

This must be legible to someone who has never heard of RLS. It is not a warning banner and not a wall of
text — it is one honest sentence per backend, plus a link.

### 5. It feeds OPS-006

A published `publicToken` is precisely the "a key on a frontend node ships to every visitor" case
[OPS-006](../phase-31-readiness-and-operations/OPS-006-SECURITY-SWEEP.md) exists to catch. This task
registers the finding; OPS-006 owns the sweep. Do not build a second security-findings mechanism.

## Implementation Steps

1. Add the `parse` and `nodegx` preset entries with endpoints, auth help and capability descriptors.
2. Converge the two metadata keys, with a migration for existing projects and a matching change in the
   exporter's injection.
3. Unify the panel: one list, one card shape, the Data Browser available for any backend whose adapter
   supports the browse operations rather than only the local one.
4. The backend picker with the hide-when-one rule, across every node that takes one.
5. Write the security disclosure — **prose first, circulated**. This is the deliverable, not the plumbing
   around it.
6. Register the `publicToken` visibility finding with OPS-003's findings store for OPS-006 to consume.
7. **Live pass**: create a project, add each of the six backends in turn, confirm the picker disappears
   at one backend and appears at two, confirm the disclosure is reachable before publishing, and confirm
   a deployed app resolves its backend from the unified metadata.

## Success Criteria

- [ ] Six presets in one list; Parse Server and NodeGX among them.
- [ ] One metadata key; existing projects migrate; the exporter injects the unified shape.
- [ ] The backend input is invisible in a single-backend project and present in a two-backend project.
- [ ] Every preset carries a security disclosure legible to a non-engineer, reachable before publish.
- [ ] Switching a project's backend surfaces what changes about token visibility and rule enforcement.
- [ ] The `publicToken` visibility case is registered as an OPS-006 finding, not reimplemented.
- [ ] A deployed app resolves its backend from the unified metadata — verified in a real export.

## Out of Scope

- **Provisioning.** Connecting to a Supabase project is in scope; creating one is not. Phase 31's
  OPS-010 owns walking a user through a provider's console.
- **Unifying permissions UI.** Phase decision. Linking out to each product's admin is the whole story.
- **Data migration between backends.** Switching the binding is in scope; moving rows is a different
  product.
- **The security *sweep*.** OPS-006's. This task produces the input.

## Traps

- **Two metadata keys with a migration is where projects break silently.** A project that half-migrates
  resolves a backend that does not exist and every data node fails at once. Migrate on load, write once,
  and test with a project saved by the previous build.
- **`cloudservices` is inlined into `index.js` at export** (`{{#export#}}`) — unifying the metadata
  changes the export path, and OPS-002's build identity was explicitly warned not to be built *out of*
  the frozen endpoint. Coordinate rather than colliding.
- **The disclosure will be tempting to write as a warning.** A red banner on every backend teaches
  nothing and gets dismissed. One sentence that is true is worth more than a modal.
- **"SQLite" as the NodeGX preset name leaks an implementation detail** that stops being true if the
  persistence layer ever changes. "Built-in" ages better and says less. Richard's call.
- **The Data Browser currently assumes the local backend.** Generalising it is in scope, but it speaks
  `/api/:table` and will need the adapter, not the URL — a shortcut that points it at another backend's
  REST surface directly re-creates the coupling this phase is removing.
- **A hidden input still has a saved value.** When the second backend is added and the picker appears,
  every existing node must already hold a valid binding — not an empty one that silently meant "active".