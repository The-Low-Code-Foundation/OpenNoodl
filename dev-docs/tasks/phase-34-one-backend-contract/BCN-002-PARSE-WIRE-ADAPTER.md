# BCN-002: Parse-Wire Behind the Contract, With No Behaviour Change

## Metadata

| Field | Value |
|-------|-------|
| **ID** | BCN-002 |
| **Phase** | Phase 34 — One Backend Contract (Track S) |
| **Tier** | 1 — the contract |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium — mechanical, but the success condition is "nothing observable changed" |
| **Estimated Time** | 4–6 days |
| **Prerequisites** | BCN-001 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — a mostly-mechanical move, with a diagnosis step (the nine Parse-concept leaks) that is not |

## Objective

Move the existing Parse-wire implementation behind `IDataAdapter` as `ParseWireAdapter`, with **zero
behaviour change** to any node, against both `nodegx-backend` and a legacy external Parse server. This
is the task that proves the seam is real before anything depends on it.

## Background

`CloudStore`'s Parse-ness is concentrated in `_makeRequest` ([cloudstore.js:54](../../../packages/noodl-runtime/src/api/cloudstore.js#L54)):
the `/classes/` path prefix, the `X-Parse-Application-Id` header, the master-key header when
`_noodl_cloudservices` is defined (cloud-runtime only — not a browser leak), the
`localStorage['Parse/<appId>/currentUser']` session lookup, and the `{_method: 'GET'}` POST tunnel that
`query` uses to send a body on a read.

Everything above that line is already neutral. The move is therefore: rename the class, implement the
interface, and leave the request layer exactly where it is.

**The one diagnostic step:** grepping `dbmodelnode2.ts`, `dbcollectionnode2.ts` and
`dbmodelcrudbase.ts` for `objectId|className|__type|Pointer` returns **nine matches**. Two of them (in
`dbmodelcrudbase.ts` around line 529) read the current user's `objectId`. The other seven have not been
individually examined. They are this task's audit list — each is either genuinely neutral, or a leak
that must move into the adapter before another backend rides the same code path.

## Current State

| Piece | State |
|---|---|
| `CloudStore` | 18 methods, one Parse-wire implementation, singleton-resolved |
| `_makeRequest` | two branches — browser XHR and cloud-runtime; master key only in the latter |
| `queryutils.ts::convertFilterOp` | neutral filter model → Parse `where`; **stays put**, BCN-003 owns its relocation |
| `records.js` | four more `convertFilterOp` call sites — the server-side record API |
| Node layer | 9 matches for Parse-shaped identifiers across the three main record-node files |
| Tests | `cloudstore-files.test.ts` exists; broader coverage unmeasured |

## Desired State

1. **`ParseWireAdapter implements IDataAdapter`**, containing the whole of today's `CloudStore`
   including `_makeRequest` unchanged.
2. **`CloudStore` is either the adapter or a thin alias**, decided by what the call sites need — do not
   keep two live copies.
3. **The nine Parse-concept references are triaged**, each recorded as neutral-after-inspection or moved
   into the adapter with a normalised replacement (a record's identity is `id` at the contract, whatever
   the backend calls it on the wire).
4. **Record identity is normalised at the adapter boundary.** Parse returns `objectId`; Directus,
   Supabase and PocketBase return `id` under a schema-declared primary key. The contract exposes one
   name. This is the single highest-leverage normalisation in the phase and it belongs here, in the
   first adapter, where it can be proven against a backend that already works.
5. **No node file changes behaviour.** Import paths may change; port definitions, signal ordering and
   output shapes may not.

## Implementation Steps

1. Introduce `ParseWireAdapter` implementing BCN-001's `IDataAdapter`, moving `CloudStore`'s body
   wholesale. Resolution comes in as an argument rather than from the singleton.
2. Triage the nine Parse-concept references; move the leaks, document the neutrals inline.
3. Normalise record identity at the adapter boundary, with the Parse `objectId` ↔ contract `id` mapping
   as the first implementation of a rule every later adapter follows.
4. Repoint call sites. `records.js`'s four `convertFilterOp` uses are server-side and must keep working
   — verify against the cloud runtime, not only the browser.
5. **Live pass, both directions**: a project against `nodegx-backend` (Parse-wire surface) and a project
   against an external Parse server, each exercising query with a filter, create, save, delete,
   addRelation, uploadFile and signFileUrl. Compare against the same operations on the pre-change build.
6. Flip the verified capability cells in BCN-001's descriptor for the `parse` and `nodegx` types.

## Success Criteria

- [ ] `ParseWireAdapter` implements the full 18-method contract; no second live copy of the request layer.
- [ ] All nine Parse-concept references are triaged, with the disposition of each recorded.
- [ ] Record identity is normalised at the boundary, and a test asserts a node sees `id` for a Parse
      record whose wire payload said `objectId`.
- [ ] **No node file's observable behaviour changed** — same ports, same signals, same output shapes.
- [ ] Live pass green against `nodegx-backend` *and* an external Parse server.
- [ ] Server-side `records.js` paths verified in the cloud runtime, not just the browser.
- [ ] Runtime and editor suites green.

## Out of Scope

- **The filter translator's relocation.** `convertFilterOp` stays where it is; BCN-003 moves it.
- **Auth.** `UserService` is BCN-006's. Do not half-move it here because it looks similar.
- **Promisifying.** Excluded by BCN-001.
- **Improving anything.** If a bug is found in `CloudStore` during the move, record it and fix it in a
  separate commit — a behaviour-change commit inside a no-behaviour-change task destroys the only signal
  this task produces.

## Traps

- **"No behaviour change" is not provable by unit tests alone.** The nodes are the consumers and their
  behaviour is signal ordering and port timing. The live pass is the test; a green suite is a
  precondition, not evidence.
- **`_noodl_cloudservices` is a cloud-runtime global, not a browser one.** The master-key branch at
  `cloudstore.js:77` and `:114` only fires server-side. Moving it into a shared adapter without
  preserving that distinction would put a master key in a browser request. Assert the browser path never
  sets the header.
- **The `{_method: 'GET'}` POST tunnel looks like cruft and is not.** It exists so a query can carry a
  body. Any "simplification" to a real GET will silently truncate large filters at the URL length limit.
- **`localStorage['Parse/<appId>/currentUser']` is the session seam** and BCN-006 will want to own it.
  Leave it in the adapter for now; a shared session store invented here will be wrong before auth lands.
- **The editor's Data Browser reads `/api/:table`, not the Parse wire** — `byob-admin.ts` — so it is
  *not* a regression surface for this task. Do not let a green Data Browser be read as evidence the
  Parse path works.
- **Live-verify from the primary checkout.** The [parallel worktree traps](../../reference/) apply:
  worktrees are created from `origin/main`, and `lerna exec` runs the main checkout.