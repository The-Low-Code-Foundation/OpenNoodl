# BCN-004 step 6 — the live pass per backend, through the nodes

**Status: done. 101 live checks, 0 failures, across all five backends.**

Driver: [`bcn-004-node-driver.ts`](../phase-16-runtime-deploy-health/uba-e2e/bcn-004-node-driver.ts),
output recorded in `bcn-004-node-driver.output.txt`. Run it with the build script beside it.

Backends exercised: **Directus 11**, **PostgREST 12.2.3** (as Supabase, behind a
`/rest/v1/` proxy), **PocketBase 0.30.0**, **nodegx-backend**, **upstream Parse Server 7.3.0**.

## What this asked that the transport driver did not

`bcn-004-rest-driver.ts` drove `RestDataAdapter` and proved the adapter builds the right
requests. This registers the four Record nodes into a real `NodeContext` and drives them
through `registerInputIfNeeded`, so the layer step 5 built is live for the first time:
`CloudStore.forBackend` routing, `resolveBackendTarget`, `getStorageFilter`'s two filters,
and `CloudStore._fromJSON`. The picker had been *seen rendering*; nothing had run a query
through the store it selects.

Per backend: the one filter, the filtered total, filtered pagination at `limit=1, skip=2`,
and create → re-read → update → re-read → delete → re-read, all through node ports.

## ⚠️ The defect it found — an empty sort kills a create

`dbcollectionnode2.ts::_addModelAtCorrectIndex` guarded its sort with `sort !== undefined`
and then read `sort[0][0]`. **An empty array passes that guard**, so `sort[0]` is
`undefined` and the read throws.

It is reachable from an ordinary configuration, not a contrived one:

- the **Javascript** filter path initialises its sort to `[]` and fills it only if the
  user's script calls `sort(...)` — most do not;
- **Use limit** is on;
- a record is created or saved on the same backend and matches the query.

The third condition is what makes it more than a cosmetic throw. That code runs inside the
store's `create`/`save` event emit, and the adapter raises that event **inside the
originating node's success callback** — so the exception escaped through Create New
Record's `success`, which therefore never reached `sendSignalOnOutput('created')`. **A
record that had already been written to the backend reported nothing at all.**

Fixed, with six regression tests (`test/nodes/query-records-empty-sort.test.ts`) that need
no rig. Reverting the expression fails two of them and leaves the four controls green.

## ⚠️ Two instrument defects, both of which manufactured a false result

Recorded because both looked exactly like product defects, and one of them looked like
*the* product defect this task was hunting.

1. **The XHR shim's `catch` spanned the `onreadystatechange` dispatch.** An exception
   thrown by the adapter's own `success` callback landed in the catch, which re-fired the
   handler as `status: 0` — so every successful create and update in the run *also* took
   the error path and raised `record/storage-op-failed`. A real `XMLHttpRequest` lets a
   listener's exception escape; it does not convert it into a transport failure. Until
   this was fixed, the genuine crash above was invisible underneath it.

2. **The routing check was vacuous.** Every per-backend run configures one backend and
   makes it `activeBackendId`, so a `backendId` input that was ignored *entirely* still
   returned the right rows from the right server — the node falls back to the active
   backend, which is the same one. Mutation-testing proved it: disabling
   `registerInputIfNeeded`'s `backendId` branch left **all 95 per-backend checks green**
   and failed only the unknown-id case. There are now two backends configured at once with
   the node pointed at the non-active one, and that mutation fails it with numeric Directus
   ids where PocketBase strings were named.

## Mutation testing — what each headline check can actually catch

| Mutation | Caught by | Not caught by |
|---|---|---|
| `page = skip` (row offset as page number) | PocketBase `limit=1, skip=2` — the only page-based wire | everything else; `limit=2, skip=2` would pass, since `floor(2/2)+1` and `2` are both `2` |
| `backendId` dropped in `registerInputIfNeeded` | the two-backend routing check, the unknown-id check | all 95 per-backend checks |
| `sort[0][0]` restored | 2 of 6 empty-sort tests | the 4 control cases, correctly |
| `backendEntries` counts only `backendServices.backends` | 4 of 10 picker tests, incl. the near-miss | the rest, correctly |

## `objectId` as a `number` — measured

The register flagged this as *"the likeliest place a real defect is still hiding."*
Measured at the node layer, on every backend:

| Backend | `firstItemId` | Create's `Id` | typeof |
|---|---|---|---|
| Directus 11 | `28` | `33` | **number** |
| Supabase (PostgREST) | `24` | `29` | **number** |
| PocketBase | `"wtkwmsccgjgwhjm"` | `"i9fo3fr17w48aem"` | string |
| nodegx-backend | `"75fc3725-…"` | `"bf7ed282-…"` | string |
| Parse Server | `"o9FVp2zMXX"` | `"6ZAy6meFgB"` | string |

**What now has evidence:** a numeric id survives `_fromJSON` into the Model store, every
item in a returned collection agrees on the id type, and a numeric id fed **back into a
`Record Id` input** drives a successful update and a successful delete, each confirmed by
re-reading the collection. So the `Record Id` half of the risk is closed.

**What does not:** the **repeater binding** has not been driven. That needs a rendered
Repeater in the viewer, which this headless driver has no way to stand up — see
"could not verify".

## Parse schema introspection — the open question, settled

The register carried this as *"may be structurally impossible today"*. Measured:

| Endpoint | Result |
|---|---|
| upstream Parse `GET /parse/schemas`, no master key | **403** |
| upstream Parse `GET /parse/schemas`, with master key | **200**, real schema |
| nodegx-backend `GET /schemas` | **404** |
| nodegx-backend `GET /api/schemas` | **200 — `{"results":[],"count":0}`** |
| nodegx-backend `GET /api/_schema` | **200**, real schema, shape `{"tables":[…]}` |

So the conclusion is sharper than the prediction, and in two directions:

1. **For upstream Parse the preset's path `/schemas` is correct.** What is missing is a
   master-key field on the preset, so the editor can never supply the credential the route
   requires. Structurally impossible *for want of a field*, not for want of a route.
2. ⚠️ **For `nodegx` the preset's path is simply wrong.** `BackendServices.ts:327/422`
   builds `schemaUrl = url + endpoints.schema` and fetches it, so a `nodegx`-type external
   backend added through the Backend Services panel **can never introspect its schema** —
   it 404s.
3. ⚠️ **And the obvious correction is a trap.** `/api/schemas` answers **200 with an empty
   Parse-shaped list**, indistinguishable from "this backend has no collections". An
   adapter repointed there would silently conclude the backend is empty. The real endpoint
   is `/api/_schema` and it returns a **different shape** (`tables`, not `results`), so
   this is not a one-line path fix and should not be done as one.

**Not fixed here**, deliberately: `BackendServices.ts` is in the uncommitted change set of
the (interrupted) BCN-009 step 2 work, and a path-only fix would swap a 404 for a
200-with-the-wrong-shape, which is worse. It needs the path *and* a parser.

## `hideWhenSingleBackend` — the branch that could move every node

Previously unexercised: every project tested had five backends, and `schema-ports`' own
test asserts only that a synthetic one-backend context yields no ports, which says nothing
about *what counts as one backend*.

Now covered by `test/nodes/record-picker-single-backend.test.ts` across the shapes that
actually occur, each pairing picker visibility with what `_active_` resolves to:

| Project | Backends | Picker | `_active_` resolves to |
|---|---|---|---|
| built-in only | 1 | hidden | `_endpoint_` |
| one external only | 1 | hidden | that backend |
| **built-in + one external** | **2** | **shown** | **`_endpoint_`**, *not* `activeBackendId` |
| nothing configured | 0 | hidden | `undefined` — no backend invented |

The third row is the near-miss. A count over `backendServices.backends` alone reports
**one**, and the mutation confirms four tests fail when it does.

## Could not verify

1. **The repeater binding with a numeric `objectId`.** Needs a rendered Repeater in the
   viewer. The `Record Id` input half is verified; this half is not.
2. **The picker rendering with the hide-at-one branch live in the editor.** Verified at the
   port-generation layer against real metadata, not on screen.
3. **Sorting through the nodes.** The driver's filter never calls `sort(...)` — which is
   what exposed the empty-sort defect, but means sort *ordering* per backend is unmeasured
   here. Pagination is asserted on set membership, not on backend-chosen order.
4. **Directus system collections** (`directus_users` → `/users`). Still a BYOB capability
   `RestDataAdapter` does not have; untouched by this pass.
5. **Concurrency.** One node at a time. Two Record nodes on the same backend racing a
   create is not covered, and the store's event fan-out is exactly where the defect above
   lived.
6. **PostgREST namespacing used `body`, not `status`.** The rig's `articles.status` is a
   Postgres enum (`article_status`), so a namespaced status value answers `22P02`. The
   filter's *shape* is unchanged — equality on a free-text field — but it is not literally
   the same column as on the other four.

## Also observed

- **`_getCurrentUser` (`dbmodelcrudbase.ts:540`) dereferences `modelScope` without a
  guard** on its cloud-runtime branch, though the parameter is typed
  `ModelScopeLike | undefined`. A real cloud function always has one, so it never bites
  there — but it is the reason this driver runs the browser path, and it is a latent
  unguarded deref on a parameter the signature says is optional.
- `storageType` is **not** an input on Set Record Properties or Delete Record; the node
  rejects it with a console warning. `collectionName` is the one that matters.
- The baseline **"84/84 suites, 1556 tests" conflated two columns.** One suite
  (`agent-live-endpoint`) is env-gated and wholly skipped, and 13 tests are skipped across
  the run. The honest prior state is **83 passing of 84 suites, 1556 passing of 1569
  tests**.
