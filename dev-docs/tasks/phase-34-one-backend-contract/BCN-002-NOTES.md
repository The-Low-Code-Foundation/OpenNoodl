# BCN-002 — Notes

**The Parse wire behind the contract, with nothing observable changed.**

Read alongside [BCN-002-PARSE-WIRE-ADAPTER.md](./BCN-002-PARSE-WIRE-ADAPTER.md), whose
premises §1 corrects.

---

## 1. Spec premises that were wrong

Two were known before this task started; two more fell during it. All four are recorded so
nobody re-derives them.

### 1.1 Fourteen methods, not eighteen *(known)*

The success criterion says "the full 18-method contract". `DATA_ADAPTER_METHODS` asserts
fourteen at compile time and a test asserts the adapter implements exactly those. The four
extra were `_initCloudServices` (construction), `_makeRequest` (**the Parse seam the
adapter replaces**), and `on`/`off` (events, implemented once in `AdapterEvents`).

### 1.2 There is no external Parse Server *(known — now resolved)*

Step 5 demands a live pass against one and none existed in the repo or the rig. **Decision
2026-07-31: stand one up.** A `parse` profile on the uba-e2e compose file — see §4.

### 1.3 ⚠️ The record-identity criterion points the wrong way *(found here)*

> Desired State §4 and success criterion 3: *"a test asserts a node sees `id` for a Parse
> record whose wire payload said `objectId`."*

This inverts the contract BCN-001 shipped. `AdapterRecord.objectId`, and the `objectId`
field on the fetch, save, delete, increment and relation option shapes, make **`objectId`
the contract's neutral identity name** — which also follows the 2026-07-31 decision that
the Parse-family *names* win while the implementation comes from whichever side is better.
Renaming it to `id` would change a field twenty-five nodes pass through, in the one task
whose entire value is that nothing observable moved.

**Implemented in the direction the contract actually chose.**
[`recordIdentity.ts`](../../../packages/noodl-runtime/src/api/backends/recordIdentity.ts)
is the rule: an adapter declares what its wire calls the identity field, and the boundary
renames it *towards* `objectId`. For the Parse wire that is the identity function and
records come back **by reference**, which is what makes "no behaviour change" provable
rather than argued. The rename direction BCN-004 needs is tested anyway, so the second
adapter inherits a proven helper instead of writing its own.

### 1.4 Three contract shapes were wrong, and only the move could show it *(found here)*

Putting the wire behind the contract is what surfaced these. Each was corrected in
`@noodl/backend-contract` — types only, no consumers yet, no behaviour risk. Casting them
away in the adapter would have hidden three facts from BCN-004 through BCN-008.

| Shape | BCN-001 said | Reality |
|---|---|---|
| `uploadFile` / `signFileUrl` / `deleteFile` `error` | `(err?: string)` | An envelope. Both node call sites already declare `{error, code, status}` and read `status` to tell a 403 from a 500. Now `FileError` / `FileCallbacks` |
| `signFileUrl` `expiresAt` | `number` | An **ISO string**. `nodegx-backend`'s `FileRoutes.signUrl` sends one and the Sign File URL node publishes it on a `string` port. A wrong type here would have had BCN-004's adapters minting epochs for a port that renders them verbatim |
| `deleteFile` `success` | `() => void` | Receives the response. `cloudstore.js:481` calls it with the merged body and `noodl-viewer-cloud/src/api/files.js` accepts a `response` parameter — the zero-argument form could not have been implemented without changing a caller |

---

## 2. What moved, and what deliberately did not

| Piece | Where it is now |
|---|---|
| `_makeRequest` and all fourteen methods | [`ParseWireAdapter.ts`](../../../packages/noodl-runtime/src/api/backends/ParseWireAdapter.ts) — **the only live copy** |
| `on`/`off` and the four write events | `AdapterEvents`, implemented once for every adapter |
| `_protectedFields` / `_removeProtectedFields` | Into the adapter; the copies in `cloudstore.js` are gone |
| Backend resolution | `CloudStore._handle()` — the singleton, made explicit |
| `_fromJSON` / `_deserializeJSON` / `_serializeObject` | **Stayed** in `cloudstore.js`. They convert between backend JSON and Noodl `Model`/`Collection`, twenty-five nodes reach them through the class, and the serialiser is handed to the adapter as an injected hook rather than owned by it |
| `convertFilterOp` | **Stayed.** BCN-003 owns its relocation, as specced |
| Every node call site | **Unchanged.** `query(options)`, not `query(handle, options)`. Nothing about "nothing changed" is provable if the callers move at the same time as the implementation. BCN-004 and BCN-009 repoint them |

### Why `api/backends/` and not `api/adapters/`

`api/adapters/` already exists and is **a different layer**: `CloudStoreAdapter` and
`LocalSQLAdapter` are the *server-side* persistence stack `nodegx-backend` runs behind its
Parse wire. They answer requests; these make them. The shapes resemble each other because
both sides of one protocol do, and filing a client adapter in there would make that
coincidence look like a hierarchy.

Not in either spec, and worth knowing: `AdapterRegistry.createAdapter`'s `case 'parse'`
throws *"Parse adapter not yet refactored. Use existing CloudStore."* That is a stub for a
**server-side** Parse adapter, not for this one, and BCN-002 does not fill it.

---

## 3. The nine Parse-concept references, triaged

The audit list, each read in context. **Seven neutral, two moved.** The grep now returns
five live references.

| # | Site | Disposition |
|---|---|---|
| 1 | `dbmodelnode2.ts:323` — `objectId: internal.modelId` | **Neutral.** `FetchOptions.objectId`; the contract's own field name |
| 2 | `dbmodelnode2.ts:337` — `delete response.objectId` | **Neutral.** Strips the identity before iterating keys to flag `prop-` outputs. Reads an `AdapterRecord` at the contract's name. Mutates the record, which is safe in both directions: Parse returns the same reference, a renaming adapter returns a fresh copy |
| 3–5 | `dbcollectionnode2.ts:211, 220, 240` — `args.object.objectId`, `args.objectId` ×2 | **Neutral.** All three read the *adapter event* payload, whose contract type `AdapterEvent` declares `objectId` |
| 6–7 | `dbcollectionnode2.ts:68–69` — the local `CloudStoreEventArgs` interface | **Moved.** A hand-written copy of what is now `AdapterEvent`, and the two had already drifted: the local copy made `type` and `collection` optional, which they never are. Now `type CloudStoreEventArgs = AdapterEvent` |
| 8–9 | `dbmodelcrudbase.ts:527–534` — `localStorage['Parse/' + CloudStore.instance.appId + '/currentUser']`, then `cu.objectId` | **Moved — the one genuine leak.** Node code that knew the storage key, its Parse-shaped name, and which singleton to get an `appId` from. Now `CloudStore.instance.currentUserId()`, forwarding to the adapter |

**`currentUserId` is not a contract method**, and the test that pins the adapter's public
surface names it as a deliberate exception. Auth is BCN-006's and `IAuthAdapter` is where a
real answer belongs; adding a fifteenth data method for it would make the contract's shape
a matter of whichever task needed something next.

### One leak found that is *not* on the audit list

`dbcollectionnode2.ts:25` imports `WhereClause` from `api/adapters/types` — a node
importing the **server-side persistence** types. Recorded, not fixed: the type it wants is
the contract's `Filter`, and moving half the filter model here would give **BCN-003** two
starting points instead of one.

---

## 4. Preserved on purpose

A no-behaviour-change task may not improve anything, so these travelled verbatim. Each is
commented at its site.

- **The `{_method: 'GET'}` POST tunnel.** It exists so a query can send a body.
  "Simplifying" it to a real GET truncates large filters at the URL length limit, silently.
  Pinned by a test.
- **The master-key guard.** `_noodl_cloudservices` is a cloud-runtime global; in a browser
  it and `_noodl_cloud_runtime_version` are both absent. A shared adapter that dropped the
  `typeof` guard would put a master key in a request from a user's machine. Pinned by a test.
- **`uploadFile`'s `contentType`**, which `_makeRequest` never reads. Dead before, dead after.
- **`create`'s event `objectId`**, always `undefined` because `CreateOptions` has no such field.
- **The session header when the stored user has no `sessionToken`** — it sends the literal
  string `undefined`. Guarding it is a fix, and a fix here spends the only signal this task
  produces.
- **`create`/`save` serialising through the module-scope serialiser**, which ignores
  `modelScope`, though the constructor builds a scope-bound copy. A sandboxed preview
  therefore serialises against the process-wide Model store. Pre-existing; PLAT-006 records
  the sibling case in `_fromJSON`.

Every one of these is a candidate for a **separate** commit, deliberately not taken here.

---

## 5. Evidence

| Claim | How it is evidenced |
|---|---|
| One live request layer | `cloudstore.js` 691 → 384 lines; the fourteen methods are one-line forwards; no second `_makeRequest` outside `configservice`/`userservice`, which are BCN-006's |
| The wire still behaves | `test/cloudstore-files.test.ts` is **untouched by this task** and passes against the moved wire — worth more than anything written for it |
| No bundle weight | The contract enters `noodl-runtime` as `import type` only. The rebuilt viewer bundle carries the moved wire (`_method:"GET"`) and **zero** contract symbols |
| Contract surface | 12 new tests in `test/backends/parse-wire-adapter.test.ts` |
| Suites | Runtime 1255 passing / 13 skipped; contract 36 passing |

**None of that is the live pass**, which is §6 and is not optional.
