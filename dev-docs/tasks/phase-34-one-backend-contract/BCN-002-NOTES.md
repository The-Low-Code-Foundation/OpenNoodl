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
2026-07-31: stand one up.** `parseplatform/parse-server:7.3.0` on Mongo 7, a `parse` profile
on the [uba-e2e compose file](../phase-16-runtime-deploy-health/uba-e2e/). It found three
wrong descriptor cells and one defect in our own client — see §6.

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

**None of that is the live pass**, which is §6.

---

## 6. The live pass

Two halves, because the two transports are different code and only one of them runs in Node.

### 6.1 Headless, both wires — 40 checks

[`bcn-002-parse-driver.ts`](../phase-16-runtime-deploy-health/uba-e2e/bcn-002-parse-driver.ts)
bundles the **real `ParseWireAdapter`** from the runtime sources and drives it against
`nodegx-backend` and upstream `parse-server:7.3.0`. Recorded run:
[`BCN-002-PARSE-WIRE-OUTPUT.txt`](../phase-16-runtime-deploy-health/uba-e2e/BCN-002-PARSE-WIRE-OUTPUT.txt).

This is the **fetch** branch — the cloud runtime's. It covers BCN-002 step 5's list (query
with a filter, create, save, delete, addRelation, uploadFile, signFileUrl) plus count,
distinct, aggregate, increment, fetch, the adapter events, and `records.js`.

The four failures in the recorded run are all upstream Parse refusing things it documents
itself as refusing. The `nodegx` column is clean.

### 6.2 Browser XHR, in the real editor

The driver cannot reach the XHR branch — Node has no `XMLHttpRequest` — and that branch is
the one every viewer runs. So: the editor, the Backend Services panel, its own SQLite
backend started from the panel, and the real `Noodl.Records` API driven in the preview
window over CDP.

```
create              -> id ec34c950-…  title "browser xhr"
query(equalTo)      -> 2 row(s)
count(greaterThan)  -> 2
save                -> title now "edited in the browser"
increment           -> views=7
aggregate(sum)      -> {"total":10}
fetch               -> title="edited in the browser"
delete              -> 0 row(s) remain
```

Every value propagated into the `Model` objects the nodes read, and the renderer logged no
errors. That exercises project metadata → `CloudStore._handle()` → the XHR branch → the
fourteen methods, in the real app.

### 6.3 What the live pass does *not* establish

Stated plainly, because a live pass that overclaims is worse than none.

**Node signal ordering was not A/B'd against a pre-change build.** §6.2 drives the API the
nodes call, not the nodes themselves, so "the Query Records node fires `fetched` at the same
moment it used to" rests on the adapter being byte-faithful and on the runtime suite's node
corpus, not on a before/after measurement. The right instrument exists — RUN-001's
[corpus harness](../phase-16-runtime-deploy-health/corpus/) diffs probe event *ordering*,
DOM and screenshots — but it compares runtime *versions*, not builds, and pointing it at two
builds is a harness change this task did not make.

**`noodl-preview` cannot host a data-node pass at all.** `loader.ts:205` passes
`environment: null` deliberately, so a local preview never inherits a backend. Worth knowing
before someone tries it: `probe-cloud-query` under `noodl-preview` issues
`POST undefined/classes/Message` and renders its placeholder — which is correct behaviour,
not a regression, and is what the old code did too.

---

## 7. Two defects found, both fixed in their own commits

Per BCN-002's own rule that a behaviour-change commit inside a no-behaviour-change task
destroys the only signal the task produces.

### 7.1 A missing master key was sent as the four-letter string `undefined`

`203469c7`. `Object.assign({'X-Parse-Master-Key': masterKey, …})` with no master key
produces a property whose value is `undefined`. **`JSON.stringify` drops that; `new Headers()`
keeps it**, as the literal text. So a cloud runtime with no baked `_noodl_cloudservices` —
a configuration `globals.d.ts` describes explicitly — sent
`X-Parse-Master-Key: undefined` on every request. `nodegx-backend` counts each as a failed
credential attempt and **locks the caller out for 300 seconds**, so the symptom is not a 401
on one call, it is a backend that stops answering.

Pre-existing in `cloudstore.js`. Found on the live pass's *first run* and reachable by
nothing else in the repo: every unit suite takes the XHR branch, and upstream Parse ignores
a master key it does not recognise rather than rejecting it. **The one server that fails
loudly here is our own.**

The XHR branch had the same hole for a narrower input — `masterKey` is optional on
`_noodl_cloudservices` — and is guarded too.

### 7.2 The moved wire has to carry its own ambients

`37d23adb`. Two viewer suites failed to *compile*: nine `TS2304`s on the `typeof` guards
around the two runtime globals. `src/globals.d.ts` has always declared them, and that was
enough while the wire was `.js` — never typechecked, and passed through untransformed by
consumers' `ts-jest`. A `.ts` file is compiled by each consumer with *their* tsconfig, where
this package's ambients are out of scope. `noodl-viewer-react/tsconfig.json` already carries
a long comment about this exact failure; PLAT-003 slice 13 reverted seven modules to it.

Fixed with a triple-slash reference so the file carries its own ambients. **Not** with
`globalThis._noodl_cloudservices`, which would satisfy the compiler and quietly break the
deploy bundles — webpack's DefinePlugin substitutes the *identifier*, and a property access
is not a substitution site.

Caught only by running **every** package suite. The runtime's own program was green
throughout.

---

## 8. What the descriptor gained

| Backend | Change |
|---|---|
| `parse` | Aggregate and distinct refusals **measured**, in the server's own words (`unauthorized: master key is required`), settling BCN-001 §0.2's separate-columns argument. Three file cells corrected (§1.4 of the phase notes and the commit). The rest of the data and relation cells upgraded from documented to probed |
| `nodegx` | Thirteen cells from read-in-the-handler to driven-live. The six that were **not** driven — `data.acl`, `data.search`, the two pointer/relation reads, `files.private`, `files.progress` — keep their old evidence and say so |

Contract suite 36 → 40, with the three corrected cells pinned by name.

---

## 9. Suites

| Package | Result |
|---|---|
| `@noodl/runtime` | 1256 passed, 13 skipped |
| `@noodl/backend-contract` | 40 passed |
| `@noodl/nodegx-backend` | 728 passed, 10 skipped |
| `@noodl/noodl-viewer-react` | 367 passed *(347 before — two suites could not run)* |
| `@noodl/cloud-runtime` | 57 passed *(52 before)* |
| `@noodl/preview` / `@noodl/noodl-core-ui` | 14 / 44 passed |
| `noodl-editor` (Jasmine) | 1894 specs, 0 failures |

⚠️ **`@noodl/mcp` fails one test** (`create_component validates, writes and updates the
registry` — `validate_project` reports 3 errors where it expects 0). **Pre-existing**:
verified by checking out the pre-BCN-002 tree for `noodl-runtime` and
`nodegx-backend-contract` and re-running, which fails identically. Unowned.

⚠️ **The TSFixme ratchet is RED** at `+26 TSFixme` / `+26 any`, inherited from other
sessions' viewer and editor test work. None of the growing files are this task's, and it is
**not** re-baselined.
