# Phase 34 — Progress

**Track S — One Backend Contract**

**11 tasks. BCN-001, BCN-002 and BCN-003 COMPLETE — the contract exists, the first adapter is behind it, and one translator per backend is proved against five live servers. BCN-003b (the filter-builder convergence, split out by Richard) is next, and is the last Tier 1 item.**

**Three Tier 2/3 tasks are partially landed** from parallel sessions — BCN-006 (steps 1–3), BCN-007
(step 1) and BCN-009 (steps 1, 3, 5, 6). All three stop at the same wall: **BCN-004's REST transport
does not exist**, and none of them invented a second one. Their rows below say exactly which steps
are done.

| Task | Tier | Status | Notes |
|---|---|---|---|
| BCN-001 The adapter contract & capability descriptor | 1 | ✅ **Complete** | Prose contract circulated first, then [`packages/nodegx-backend-contract`](../../../packages/nodegx-backend-contract/). **Four stale premises found (§0 + §9); the two unverified cells were probed, not deferred.** All 9 decisions answered |
| BCN-002 Parse-wire behind the contract | 1 | ✅ **Complete** | `ParseWireAdapter` + a `CloudStore` reduced to resolution. **Four more stale premises, three wrong contract shapes, three wrong `parse` descriptor cells and two defects** — see [BCN-002-NOTES.md](./BCN-002-NOTES.md). A real Parse Server now runs in the rig |
| BCN-003 The filter dialect | 1 | ✅ **Complete** | Five translators, gated by the descriptor. **`convertFilterOp` had no branch for eleven operators, so `contains` returned the whole collection.** Both built-in-backend defects fixed. 106 live checks, 0 failures — see [BCN-003-NOTES.md](./BCN-003-NOTES.md) |
| BCN-003b One filter builder | 1 | 📋 Specced | The UI half of BCN-003, **split out by Richard 2026-07-31**. No data-format change — BCN-003 already moved the saved vocabulary. Ends in live QA the parent task did not do |
| BCN-004 REST data adapter & the end of BYOB | 2 | 📋 Specced | Retires 4 of the 5 BYOB types (realtime waits for BCN-008). Closes RUN-003's Supabase/PocketBase "believed to work" residuals |
| BCN-005 Relations across five backends | 2 | 📋 Specced | Opens with RUN-003's recorded residual: O2M/M2M need `GET /relations`. Parse's junction-less `Relation` is what the contract shape must accommodate |
| BCN-006 Auth & the token lifecycle | 2 | 🔨 **Steps 1–3 of 8** | The lifecycle designed in prose, `IAuthAdapter` + the Parse wire behind it, and refresh/single-flight/cross-tab under test on injected timers. ⚠️ **Exit criterion 4 cannot be claimed — nothing in the product refreshes a token yet.** One `SessionStore` replaced *four* separate opinions about who is signed in, three of them in no spec. Two more wrong contract shapes. Steps 4–8 need BCN-004 — see [BCN-006-NOTES.md](./BCN-006-NOTES.md) §6 |
| BCN-007 Files across five backends | 2 | 🔨 **Step 1 of 7** | The normalised `FileRef` and the Parse wire behind it, plus step 4's contract half (`kind`) and step 5 for the two backends that could be evidenced. **A fourth wrong contract shape**: `UploadFileOptions.data` was required and nothing in the repo has ever set it. ⚠️ The normalised reference **stops meaning what the spec assumes one save later**. Steps 2, 3, 6, 7 need BCN-004 — see [BCN-007-NOTES.md](./BCN-007-NOTES.md) |
| BCN-008 Realtime across three transports | 2 | 📋 Specced | Retires the fifth BYOB type. Parse LiveQuery is the `conditional` case that justifies the whole four-state descriptor |
| BCN-009 One backend list, picker & disclosure | 3 | 🔨 **Steps 1, 3, 5, 6 of 7** | One list from *three* mechanisms, one add flow, and **the security disclosure on every card — the deliverable**. Its prose is reproduced in [BCN-009-NOTES.md](./BCN-009-NOTES.md) §1 so Richard can mark it up without running the editor. ⚠️ **OPS-003's findings store does not exist**, so step 6 could not mean what the spec says. Steps 2 (converging the metadata keys), 4 (the per-node picker) and 7 (the live pass) not started |
| BCN-010 Capability gating & catalog reconciliation | 3 | 📋 Specced | **The task that makes the phase's claim true or false.** A merged family with silent gaps is worse than two honest ones. Unblocks phase 30 |

## The exit criterion

The phase is done when all six of these hold:

1. A user picks one backend from one list and every data, auth and file node points at it without being
   told to. *(BCN-004, BCN-009)*
2. There is exactly one node that reads "Delete Record", and one that reads "Create Record". *(BCN-010)*
3. Anything a chosen backend cannot do is **visible in the editor, with a sentence saying why** —
   before it is discovered at runtime. *(BCN-010, on BCN-001's descriptor)*
4. A logged-in user stays logged in across an access-token expiry, on every backend that has one.
   *(BCN-006 — **not met**: the machinery ships wired but inert, because no adapter has a
   `performRefresh` to give it and only Parse, whose tokens never expire, is behind the contract)*
5. The same filter returns the same rows from every backend that can express it. *(BCN-003 — **met**:
   106 live checks, 0 failures, and every divergence carries the `degraded` cell that predicted it)*
6. Phase 30 can audit the data nodes against a library that will not move under it. *(BCN-010)*

Criterion 3 is the one that justifies the phase. Criteria 1 and 2 are what the user asked for; 3 is what
makes granting it an improvement rather than a trade.

## Open questions for Richard

### Answered 2026-07-31

| # | Question | Answer |
|---|---|---|
| 1 | What is the built-in backend called in the preset list? | **"Built-in"** — says least, ages best |
| 2 | Who writes the ~30 capability reason strings? | **Claude drafts, Richard reviews.** Voice approved; all ~30 written, and the three rules are now enforced by a test rather than by memory |
| 4 | **Is `custom` really data-only?** | **No — it is a *declared* backend.** The user fills in the capability descriptor themselves in the Backend Services panel. No plugin API, no versioned interface. `customDescriptor` ships `declarable: true` and a floor of the five operations the preset form already requires. **Consequence: BCN-003 and BCN-006 must accept a declared dialect and lifecycle**, not just one of five known ones |
| 5 | Do we keep the Parse Server preset, or only the wire? | **Keep the preset.** Descriptor ships 6 backend types. Note BCN-001 §0.2 found `nodegx` and `parse` must be *separate columns* — same wire, different capabilities |
| — | Migrate saved BYOB filters, or accept the break? | **Migrate.** `DIRECTUS_OPERATOR_MIGRATION` ships the 24-operator map; BCN-003 applies it. **BCN-003 raised to ~2 weeks** |
| — | New package, or a folder in an existing tree? | **New package.** `packages/nodegx-backend-contract`. Its stated cost was overstated — see [§9](./BCN-001-CONTRACT.md) |
| — | Stand up a Parse Server in the rig, or descope BCN-002's external live pass? | **Stand one up.** Done — `parse` profile, `parseplatform/parse-server:7.3.0` + Mongo. It paid for itself immediately: three wrong descriptor cells and one defect in our own client |
| — | Who owns the two defects BCN-001 found in our own backend? | **Both in BCN-003** — the `matchesRegex`-is-a-`LIKE` one *and* the silently-dropped geo filters. ⚠️ **This widens BCN-003 beyond its ~2-week re-estimate**: geo needs a distance function in SQL and an indexing story we would then own |
| — | **Does the geo fix really belong in BCN-003, given what it adds?** | **Fix all three properly.** What changed the answer: `node:sqlite` exposes `db.function()`, so SQLite can call back into JavaScript and neither fix is an approximation — the regex is the browser's own engine, the geometry is ordinary JS. What we own is one sentence (no spatial index, so these scan) and the descriptor says it. **Done and driven against a real database** |
| — | **Does the filter-builder convergence stay in BCN-003?** | **Split out as BCN-003b.** BCN-003 ships the translators, the migration and the live equivalence pass — all headless. The editor-UI convergence gets its own task and its own live QA, so the commit that proves filter equivalence is not also the one that rewrites the thing that builds filters |

### Still open

| # | Question | Why it is his call |
|---|---|---|
| 3 | **Does the phase ship before or after the alpha?** Tier 3 is what removes the duplicate nodes a stranger would see. Tier 1 alone is invisible to users. | Sequencing against Phase 33; the answer changes whether ALPHA-001's cold-install pass has to account for two record families. |
| 6 | **Are the four maturity levels the right gate for the security disclosure?** BCN-009 has now *written* the prose and shipped it always-on — it is reproduced in [BCN-009-NOTES.md](./BCN-009-NOTES.md) §1 for markup. Its §2 offers the concrete alternative: **disclosure always-on, only the `publicToken` finding gated**, which needs no new machinery. | Cross-phase interaction between two of his own decisions. |

## What BCN-003 found

Full detail in [BCN-003-NOTES.md](./BCN-003-NOTES.md).

- ⚠️ **`convertFilterOp` had no branch for eleven of the operators the vocabulary defines** —
  `contains`, `startsWith`, `between` and their siblings. It fell off the end of its if/else
  chain, returned `{}`, and so a "name contains Ada" filter **returned every record in the
  collection**, with no error. Meanwhile the `parse` descriptor had claimed since BCN-001 that
  each was "lowered to `$regex`". This is the exact failure the spec names as the worst outcome
  available in the task, and it was in the shipping code.
- **Three more widenings closed with it:** a leaf carrying two operators kept only the first;
  `pointsTo` with no cached schema emitted `className: undefined` (empty result set, no error);
  and values were unescaped before becoming regexes, so `contains 'a.b'` also matched `axb`.
- **Both built-in-backend defects are fixed, not merely declared.** `node:sqlite` exposes
  `db.function()`, so `matchesRegex` is now the same `RegExp` engine the user's browser runs and
  the three geo operators are real geometry. Driven against a real database: `^Ada$` returns
  `Ada` and not `Adam`; 250 km of London returns London and Bristol.
- ⚠️ **A JS twin of the SQL WHERE clause exists in `nodegx-backend`**, for realtime subscription
  filters, with a property test. Fixing the SQL side broke it on the first generated case — both
  sides had agreed that `DA` matched `Date`, and both had agreed that a geo filter constrained
  nothing. There is a **third** twin (`matchesQuery`) which evaluated one operator per field, and
  `between` made that wrong. All three now agree.
- **The live equivalence pass: 106 checks across five real backends, 0 failures, 8 declared
  divergences.** What it asserts is not "they all agree" but *"a backend whose cell says
  `supported` returns exactly the expected rows, and one that returns anything else has a cell
  that already said so."* All eight divergences were `supported` cells before the run.
- ⚠️ **Four wrong descriptor cells, all written from documentation**: Directus refuses `_regex` on
  a string column outright; Directus and PocketBase honour no `LIKE` escape; Directus's `_empty`
  matches a NULL; PocketBase has no NULL for a text field at all. A fifth was corrected without a
  probe — Supabase's geo cells were `conditional` on PostGIS, but PostgREST's filter grammar has
  no geo operator whether or not PostGIS is installed, so the probe asked a real question that
  was not *the* question.
- ⚠️ **Parse's `$exists` tests key presence, not null-ness** — a record whose field was explicitly
  null satisfied "is set". `$ne: null` / `$eq: null` asks what the user means and is a no-op on
  our own backend.
- **Two handover premises were wrong.** The two `toDirectusFilter` copies had *not* materially
  diverged (both unwrapped a lone child; the runtime's own test was named for it), and
  `dbcollectionnode2`'s leaked type wanted `ParseWhere`, not the contract's `Filter` — the value
  is already translated by the time it is held.
- **Cost, measured rather than estimated:** the capability gate puts the descriptors in the viewer
  bundle. `noodl-runtime`'s entry goes from 103,668 to 115,883 bytes gzipped — **+12.2 KB,
  +11.8%**. Bought deliberately: it is what makes the sentence thrown at runtime and the sentence
  under a greyed-out port the same string.

## What BCN-002 found

Full detail in [BCN-002-NOTES.md](./BCN-002-NOTES.md).

- **Three of the contract's own shapes were wrong**, and only putting the wire behind it could show
  that: the three file methods' `error` takes an envelope rather than a string, `signFileUrl`'s
  `expiresAt` is an ISO string rather than a number, and `deleteFile`'s `success` receives the
  response rather than nothing. Corrected in the contract — types only, no consumers yet — rather
  than cast away in the adapter, which would have hidden three facts from BCN-004 onwards.
- **The record-identity criterion pointed the wrong way.** BCN-002 asked for a node to see `id`;
  the contract shipped `objectId` everywhere, and the naming decision chose it. Normalisation runs
  *towards* `objectId`, is the identity function for Parse, and the direction BCN-004 needs is
  tested anyway.
- **A real Parse Server now runs in the rig** (`parse` profile, `parseplatform/parse-server:7.3.0`).
  BCN-001 §0.2's separate-columns argument is a measurement now — Parse answers `/aggregate` and
  `/aggregate?distinct=` with `unauthorized: master key is required`, and answers both with 200
  when given the master key.
- ⚠️ **Three `parse` file cells were wrong**, all read carefully from Parse's own documentation, all
  wrong in the direction that only surfaces in a user's app. A stock Parse Server **refuses uploads
  outright**; **deleting a file needs the master key** (the cell said it did not); and
  `GET /files/:name/sign` **does not exist on Parse at all** — it is BAK-006's, ours. This is the
  clearest evidence in the phase that "documented, not probed" is a real distinction and not a
  formality.
- ⚠️ **A defect in our own client**, pre-existing and reachable by nothing else in the repo: with no
  baked `_noodl_cloudservices`, the cloud-runtime branch sent `X-Parse-Master-Key: undefined` —
  `JSON.stringify` drops an undefined property but `new Headers()` keeps it as the four-letter
  string. `nodegx-backend` counts each as a failed credential attempt and locks the caller out for
  300 seconds. Upstream Parse ignores a master key it does not recognise, so **ours is the only
  server that fails loudly**. Fixed separately (`203469c7`).
- **Moving a `.js` file to `.ts` makes every consumer compile it.** Two viewer suites stopped
  compiling on the runtime's ambient globals — the PLAT-003 slice 13 failure, which
  `noodl-viewer-react/tsconfig.json` already documents. Fixed with a triple-slash reference, *not*
  with `globalThis.…`, which would satisfy the compiler and break the deploy bundles where webpack's
  DefinePlugin substitutes the identifier. **Caught only by running every package's suite.**

## Spec corrections found by BCN-001

Recorded so they are not re-derived. Full detail in [BCN-001-CONTRACT.md §0](./BCN-001-CONTRACT.md).

1. **14 contract methods, not 18.** The count included `_makeRequest`, `_initCloudServices`, `on` and
   `off` — none of which are contract material. BCN-001's success criterion is unsatisfiable as
   written and should read 14.
2. **`nodegx-backend` serves aggregate under ordinary ACLs, no master key** — README footnote 2
   resolved. Upstream Parse is still master-key-only, which is why the two need separate columns.
3. ⚠️ **The two filter models did not converge.** `byob-utils.ts::toDirectusFilter` does not exist —
   the translator is in `byob-query-data.ts:706`, and the BYOB *saved model* stores Directus operator
   names (`_eq`) verbatim in project data. BCN-003's "additive, not inventive" premise is half wrong:
   the BYOB saved model needs re-targeting plus a migration. **BCN-003 raised from 1–1.5 wks to
   ~2 wks.**
4. **The new package's cost was overstated — and that one was mine, not the spec's.** No PLAT-004
   re-baseline (the ratchet targets `packages` wholesale and the package adds zero escape hatches), no
   hex-ratchet entry (it targets only `noodl-editor/src` and `noodl-core-ui/src`). One `--scope` in
   `test:packages` was the whole cost.

## What the live probe found

Full detail in [BCN-001-CONTRACT.md §8](./BCN-001-CONTRACT.md). Rig extended, not rebuilt: an
`aggregate` profile on [uba-e2e](../phase-16-runtime-deploy-health/uba-e2e/), recorded output in
`BCN-001-AGGREGATE-PROBE-OUTPUT.txt`.

- **PocketBase aggregate does not fail — it lies.** Every spelling returns HTTP 200 with ordinary
  un-aggregated rows, indistinguishable from an invented parameter. One returns 200 with
  `Content-Length: 0`. An Aggregate Records node pointed at PocketBase **would return wrong numbers
  with nothing to catch.** This is the concrete case BCN-010 exists for, and the strongest single
  argument for the capability model.
- **Supabase aggregate is `conditional`, proved** by two PostgREST containers one setting apart.
  ⚠️ Do not probe it with an embedded-relation count — those answer 200 with aggregates *disabled*.
- **Two defects in our own backend.** The SQL translator drops `$nearSphere`/`$within`/`$geoWithin`
  silently (a "within 5km" query returns every record), and `matchesRegex` is `LIKE '%value%'` rather
  than a regex. Both recorded honestly in the descriptor; **neither is owned by a task yet.**
- **Directus `?search=` is an unranked substring match across every field**, materially different from
  BAK-008's FTS5 ranking on the same port. `degraded`.

## Carried into later tasks

| Item | Owner |
|---|---|
| ~~Apply `DIRECTUS_OPERATOR_MIGRATION` to saved project filters; re-target the BYOB builder~~ | ✅ BCN-003 — migrated in both the editor and the runtime, idempotently |
| ~~`custom` now has a filter surface: accept a **declared** dialect~~ | ✅ BCN-003 — **but neither the filter dialect nor the lifecycle has a form to declare it in.** BCN-006 shipped `validateTokenLifecycle` for the panel to call; the panel is BCN-009's step 2 |
| ~~Fix `queryutils.ts:373` — `$maxDistanceInMiles` read with `$`, the other two without~~ | ✅ BCN-003 |
| ~~Fix `pointsTo` reaching into the global `CloudStore._collections` cache~~ | ✅ BCN-003 — the schema is a parameter |
| Rename `targetClass` to a neutral name, or decide it stays | BCN-005 |
| ~~Build refresh/single-flight/cross-tab **once**, driven by `TokenLifecycle`~~ | ✅ BCN-006 steps 1–3 — built and tested on injected timers, **inert until an adapter supplies a `performRefresh`** |
| Every `performRefresh` — Directus, Supabase, PocketBase have none, for want of a REST transport | BCN-004 → BCN-006 step 4 |
| `dist-types/src/api/cloudstore.d.ts` carries a dangling `packages/…` import; the viewer typecheck needs `--skipLibCheck`. Pre-existing, from BCN-002 | — |
| `listAuthProviders` has no consumer anywhere in the repo. Moved with the wire rather than deleted | — |
| A saved File-typed record property is `{__type, url, name}` — the normalised `FileRef` does not survive a round-trip through `cloudstore.js` | BCN-007 remainder |
| ~~Resolve Parse's documented-not-probed cells against a real Parse Server~~ | ✅ BCN-002 — one runs in the rig now |
| ~~Built-in backend drops geo filters; `matchesRegex` is not a regex~~ | ✅ BCN-003 — both fixed with `node:sqlite` user-defined functions, driven live |
| ~~`dbcollectionnode2.ts:25` imports `WhereClause` from the *server-side* persistence types~~ | ✅ BCN-003 — the type it wanted was `ParseWhere`, not `Filter` |
| One filter builder; fold `QueryPointerRule` in; **live QA in the editor** | **BCN-003b** |
| Make `toPostgrest` / `toPocketBaseFilter` reachable from a node — the request envelope, not the filter | BCN-004 |
| A relation in the equivalence corpus | BCN-005 |
| Proximity *sorting* for `nearSphere` on the built-in backend — the filter works, the ordering does not | — |
| `CloudStore._handle()` still answers `nodegx` unconditionally, so the capability gate reads a floor rather than the truth | BCN-009 — **its step 4, unstarted** |
| Promisifying the fourteen callback methods — deliberately not done, recorded as a follow-up | — |
| `AdapterRegistry.createAdapter`'s `case 'parse'` still throws "not yet refactored". That stub is for a **server-side** Parse adapter, not the client one BCN-002 built | — |

## Decisions already taken

Recorded in [README.md](./README.md): the Parse-family names win but the better implementation does;
capability gaps are declared not discovered; permissions are not unified; cloud functions are out; we
never push code to a user's backend; the WF-005 webhook trigger is the universal inbound seam; `custom`
stays data-only; one backend per project is a default, not a constraint.

## Notes for whoever starts

- **BCN-001's contract goes out in prose before any TypeScript.** Nine tasks register against its method
  names and capability keys. This is the OPS-001 precedent and it exists for the same reason.
- BCN-002 and BCN-003 have disjoint territories and run concurrently once the contract is agreed. So do
  BCN-005, BCN-007 and BCN-008 once BCN-004 lands.
- **Every task in this phase has a live pass and none are optional.** RUN-003 produced four separate
  defects that unit tests could not reach — a flat dotted filter path Directus rejected with 403, a
  cached-schema shape mismatch that silently killed enum dropdowns, a `total_count` that paginated
  against the wrong number, and a WebSocket that never fired `close`. Every one was found by a real
  request. This phase touches the same surface five times over.
- The [uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/) already containerises Directus and a
  PostgREST stack. Extend it; do not rebuild it. It is deliberately kept despite the stale name.
- `nodegx-backend` answering both wires (`parse-wire.ts` and `byob-admin.ts`) is a safety net **and a
  trap**: a green pass against our own backend proves adapter shape, never third-party correctness.
- The [parallel worktree traps](../../reference/) apply — worktrees are created from `origin/main`, so
  read `git reflog` rather than trusting `HEAD`, and live-verify from the primary checkout.
- The [editor CDP driving traps](../../reference/) apply to every live pass: `--target=editor` attaches
  to the preview window, launch detached, never `cdp reload`, and relaunch rather than reload after
  touching node registrations.