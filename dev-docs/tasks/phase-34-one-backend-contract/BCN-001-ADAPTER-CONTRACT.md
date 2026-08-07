# BCN-001: The Adapter Contract & the Capability Descriptor

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-001 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 1 — the contract |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟠 Medium-Hard — almost no code, and every later task inherits the shape |
| **Estimated Time** | 1–1.5 weeks |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** — this task *defines* an interface that nine sibling tasks implement against. Getting it wrong is expensive to reverse; the implementation work it unlocks is Opus- and Sonnet-tier |

## Objective

Write down the data and auth contracts that `CloudStore` and `UserService` already implicitly are,
plus the capability descriptor that says what each backend can actually do — **in prose and types
first, circulated before any adapter is written.**

## Background

The investigation that produced this phase found the contract already exists, unlabelled.
[`cloudstore.js`](../../../packages/noodl-runtime/src/api/cloudstore.js) (691 lines) is an 18-method
data interface whose signatures name no Parse concept:

| Method | Line | Shape |
|---|---|---|
| `query` | 157 | `{collection, where, limit, skip, include, select, sort, count, search}` |
| `aggregate` | 186 | `{collection, group, limit, skip}` |
| `count` | 247 | |
| `distinct` | 264 | |
| `fetch` | 280 | |
| `create` | 306 | |
| `increment` | 329 | |
| `save` | 348 | |
| `delete` | 373 | |
| `addRelation` / `removeRelation` | 390 / 414 | |
| `uploadFile` / `signFileUrl` / `deleteFile` | 438 / 461 / 478 | |

[`userservice.ts`](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts) (626
lines) is the same: ten methods, `logIn` (247), `logOut` (268), `signUp` (285), `fetchCurrentUser`
(356), `verifyEmail` (378), `sendEmailVerification` (401), `resetPassword` (414),
`requestPasswordReset` (440), `signInWithProvider` (542), `requestMagicLink` (574).

Parse lives in `_makeRequest` (`cloudstore.js:54`) and the `where` dialect. That is the whole seam.

**The hard part of this task is not the interface — it is the capability descriptor.** Five backends
that each do 90% of the same thing, differently, with a different 10% missing, is precisely the
situation where an under-specified capability model produces a merged node family that lies.

## Current State

| Piece | State |
|---|---|
| Data interface | implicit in `CloudStore`'s 18 methods; one implementation (Parse-wire) |
| Auth interface | implicit in `UserService`'s 10 methods; one implementation (Parse-wire) |
| REST data path | `byob-*.ts` nodes call `byob-utils.ts` directly — no interface at all |
| Capability model | **does not exist anywhere**, in either family |
| Backend config | `BackendType = 'directus' \| 'supabase' \| 'pocketbase' \| 'custom'` — [types.ts:20](../../../packages/noodl-editor/src/editor/src/models/BackendServices/types.ts#L20); no Parse, no NodeGX |
| Preset shape | `BackendPreset` in `presets.ts` — endpoints, responseConfig, auth help text. No capabilities |

## Desired State

### 1. `IDataAdapter` and `IAuthAdapter`, extracted not invented

The method signatures come **from what CloudStore and UserService already take**, normalised:

- Callback-style `{success, error}` options objects are the existing idiom across both. Converting
  them to Promises is a defensible modernisation *and it is out of scope here* — it multiplies the
  diff of BCN-002 by an order of magnitude and buys nothing this phase needs. Record it as a follow-up.
- Every method takes a resolved backend handle, not a global. Today `CloudStore` reads a singleton and
  `byob-utils.ts::resolveBackend` reads `backendServices` metadata; the contract takes the resolution
  as an argument so a project with two backends is not a special case.

### 2. The capability descriptor

A declaration attached to each backend *type*, not each instance, answering for every contract method:

| Value | Meaning | Editor behaviour |
|---|---|---|
| `supported` | works as specified | normal |
| `unsupported` | the backend has no such concept | port disabled, reason shown |
| `conditional` | depends on instance config | probed at connect; treated as `unsupported` until proven |
| `degraded` | works with a stated caveat | normal, caveat surfaced in the property editor |

`conditional` is the row that earns its keep. Parse LiveQuery is a separate server most deployments do
not run; Supabase aggregate needs opt-in; a Directus instance may not have WebSockets enabled. **Every
one of these is a runtime 404 today and a disabled port with a sentence after this phase.**

The descriptor must also carry, per capability, a **reason string written for a builder, not an
engineer**. "Directus has no magic-link login" — not "capability `auth.magicLink` unsupported".

### 3. The capability matrix, verified rather than asserted

The [README's matrix](./README.md) is the starting hypothesis. This task **verifies every cell it can
reach** and marks the rest as open. Specifically, three cells are currently assumptions:

- Parse `/aggregate` is master-key-only upstream — what does `nodegx-backend`'s `parse-wire.ts`
  actually do, and does the `Aggregate Records` node work today against it from a browser?
- PocketBase aggregate: believed absent. Confirm.
- Supabase aggregate: believed opt-in via PostgREST settings. Confirm which.

A descriptor built on three unverified cells will be wrong in exactly the places users hit first.

### 4. The `where` model, named

BCN-003 owns the translators. This task owns **naming the neutral model they translate from**, because
it already exists twice and has never been written down: the `{and:[…], or:[…], <field>:{op:value}}`
shape that both `QueryFilterType` and `ByobFilterType` emit. Enumerate the operator set, and mark which
operators each backend can express. That enumeration is the input to BCN-003 and to BCN-010's gating.

### 5. Where the code lives

A new module — not inside `noodl-runtime/src/api/` beside the Parse client it is abstracting, and not
inside the editor. The adapters are consumed by the runtime (nodes) and by the editor (Data Browser,
schema sync, filter builders); a home that forces one to import from the other's tree is the shape that
produces the next god-file.

## Implementation Steps

1. **Write the contract in prose first** and circulate before writing a line of TypeScript. Everything
   downstream registers against these method names and capability keys; moving them later touches nine
   tasks.
2. Extract `IDataAdapter` / `IAuthAdapter` from the existing signatures. Do not add methods no node
   calls; do not drop methods a node calls. The list is exactly 18 + 10 until a later task justifies a
   change.
3. Define the capability key vocabulary and the four-state descriptor, with builder-facing reason
   strings.
4. **Verify the matrix**, including the three unverified cells above, and record the evidence inline in
   the descriptor source so the next reader does not re-derive it.
5. Name and enumerate the neutral filter model and its operator set.
6. Choose the module home; wire nothing yet.
7. Ship the descriptors for all six backend types with everything `unsupported` except where verified —
   later tasks flip cells on as they land, and the descriptor is the checklist.

## Success Criteria

- [ ] The contract exists in prose, and was circulated before the types were written.
- [ ] `IDataAdapter` has exactly the 18 methods `CloudStore` has, with backend-neutral signatures.
- [ ] `IAuthAdapter` has exactly the 10 methods `UserService` has.
- [ ] Every capability key has a four-state value per backend type and a builder-facing reason string.
- [ ] The three unverified matrix cells are resolved with recorded evidence.
- [ ] The neutral filter model and operator set are enumerated, with per-backend expressibility marked.
- [ ] No adapter is implemented in this task, and no node file is edited.

## Out of Scope

- **Any adapter implementation.** BCN-002 onwards.
- **Promisifying the callback idiom.** Recorded as a follow-up; doing it here would swamp BCN-002's
  no-behaviour-change property, which is the only thing making that task safe.
- **Adding capabilities no node consumes.** The contract is derived from what exists. If Supabase can
  do something no node exposes, that is a future node, not a contract method.
- **The permissions model.** Explicitly excluded by phase decision.

## Traps

- **The temptation to design the ideal data API.** This contract's job is to be the shape 25 existing
  nodes already call. An improved API that requires touching node code has failed the task, because
  BCN-002's safety comes entirely from the nodes not changing.
- **`conditional` will feel like over-engineering until the first support ticket.** Parse LiveQuery
  alone justifies it: a user enables realtime, gets nothing, and there is no error because the node
  never connected. Resist collapsing it into supported/unsupported.
- **Two resolution paths already exist and disagree.** `CloudStore` reads a singleton with one implicit
  backend; `byob-utils.ts::resolveBackend` reads `backendServices` metadata with an `_active_` sentinel
  and multi-backend support. The contract must take a resolved handle, or every adapter re-implements
  resolution and they will drift again.
- **Reason strings are product voice, not error messages.** They appear on a disabled port in a
  hobbyist's editor. If they read like a stack trace the phase has failed its own justification. This
  is the LEARN-002 precedent — worth Richard's eye.
- **`byob-utils.ts` has Directus system-collection knowledge baked into a module-level constant** (17
  `directus_*` endpoint mappings). That is adapter-specific detail sitting in what is currently the
  shared utility. It must land inside the Directus adapter, not in the contract.
