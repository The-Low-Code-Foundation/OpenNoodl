# Phase 34 — Progress

**Track S — One Backend Contract**

**11 tasks. TIER 1 IS COMPLETE — BCN-001, BCN-002, BCN-003 and BCN-003b. The contract exists, the first adapter is behind it, one translator per backend is proved against five live servers, and there is one filter builder.**

**BCN-004's transport now exists.** `RestDataAdapter` implements all fourteen `IDataAdapter`
methods for Directus, Supabase and PocketBase, on the measured wire profiles rather than the
editor's `BackendPreset`, consuming BCN-003's translators with no second translator anywhere.
45 unit tests and **42/42 live checks against all three real servers**. The schema-driven port
generator is out of the BYOB nodes and into a shared module. `IRealtimeAdapter` exists and the
`realtime.*` descriptor cells are set from measurement. See the rows below for what each still owes.

**The live verification owed on 2026-07-31 has all been run.** Every item is closed; each one
found something a unit test could not.

### Live verification — done (2026-07-31)

| Owed | Result |
|---|---|
| BCN-009 — the 11-step panel script | ✅ **All eleven steps pass**, incl. the switch dialog and the token-change line that proves it is not boilerplate. ⚠️ **Two cards say ACTIVE at once**; the endpoint badge is unconditional and also says ACTIVE for a *stopped* backend; the first external backend activates without the switch dialog — [BCN-009-LIVE-QA.md](./BCN-009-LIVE-QA.md) |
| BCN-006 — login → log out → sign up → reset password | ✅ **Run in the preview window against a running backend** — the XHR branch, first time. ⚠️ **`Current.email` is `undefined` after `signUp`** and populated only after `logIn`; **`emailVerified` never populates at all**. `requestPasswordReset` is not on the public API — [BCN-006-007-LIVE-QA.md](./BCN-006-007-LIVE-QA.md) |
| BCN-007 — a real upload against a running backend | ✅ **The 201 exists and carries `size` and `contentType`** — the assumption was right at the wire. ⚠️ **`CloudFile` throws both away**, so they are correct at the adapter boundary and unreachable from a graph |
| BCN-007's Directus file field map (*"documented, not probed"*) | ✅ **Probed — the map is correct.** 16 checks, 0 failures. ⚠️ `/assets/{id}` **403s unauthenticated**, so the URL the adapter synthesises is a broken `<img>`; and 403 also means "never existed", so an adapter cannot tell a deleted file from a forbidden one — [BCN-004-FILE-FACTS.md](./BCN-004-FILE-FACTS.md) |

### ⚠️ Two pieces of received wisdom about driving the editor are wrong

Both cost time in this batch; recorded in [BCN-009-LIVE-QA.md](./BCN-009-LIVE-QA.md) §4.

- **`BaseDialog` mounts a hidden *measuring* copy of every dialog**, so every `[data-test]` inside
  one matches twice, permanently. `cdp click` uses `querySelector` and therefore always targets the
  copy — harmless where the two overlay, silently wrong where they do not (the security disclosure's
  copy sits 50px high). Scope selectors with
  `[class*=VisibleDialog] > [class*=ChildContainer] …`. The partial run blamed *"two React trees
  across a reload"*; there is no reload and it never goes away.
- **`--target=dashboard` attaches to the preview window.** It is not a known needle in this
  checkout's `cdp.js`, so it falls through to "the first page". **`--target=editor` is correct.**

### ⚠️ The 2026-07-31 parallel batch was interrupted — four tasks have uncommitted work

Four workers were launched in worktrees for **BCN-005** (relations), **BCN-006 steps 4–8**
(auth), **BCN-008** (realtime transports) and **BCN-009 step 2** (converging the metadata
keys). **All four were terminated part-way by an org monthly spend limit**, not by anything
about the work.

None of them committed, so the orchestrator **preserved each one as a labelled WIP commit on
its own branch** — the work is safe even though the scratchpad worktrees are not:

| Branch | Commit | Contents | State |
|---|---|---|---|
| `wt-bcn005` | `1ee878e7` | 15 files, +2795/−87 — a new contract `relations.ts` + tests, `data.ts`, three descriptors, two translators, `ParseWireAdapter`, `RestDataAdapter`, `restSerialize`, two live relation probes | **mid-implementation** |
| `wt-bcn006` | `3cdbe12d` | 4 files, +1438/−45 — a new `RestAuthAdapter`, plus `ParseAuthAdapter`, `TokenLifecycle`, `userservice.ts` | **mid-implementation** |
| `wt-bcn008` | `63241566` | 9 files, +2265 — a realtime driver and a new `api/backends/realtime/` tree. ⚠️ `realtime.ts` landed in the contract package **root**, not `src/` — wrong path, must move | **mid-implementation** |
| ~~`wt-bcn009`~~ | `5f35222d` | 13 files, +1530/−89 | ✅ **COMPLETE and MERGED** (`23179bf2`) |

⚠️ **Do not treat the first three as equivalent to the fourth.** They stopped part-way
through implementation and reached no test run — draft to review, not work to trust, and
this phase's record is that roughly every second confident change rests on a stale premise.

⚠️ **And a correction worth keeping.** The orchestrator first preserved all four with a
commit message reading *"INTERRUPTED DRAFT … none of the workers reached a test run, let
alone a live pass."* **That was wrong about BCN-009 step 2**, which had by then run every
gate and a thirteen-check live pass; the worker amended its own message to the truth. The
lesson generalises: *"the batch was interrupted"* is a fact about the batch, not evidence
about any particular worker's state, and it was applied as though it were.

**BCN-009 step 2 is merged, and [BCN-009-NOTES-STEP2.md](./BCN-009-NOTES-STEP2.md) is worth
reading before anything else in this phase is decided.** It records a full live pass in a
real editor against a *legacy two-active-backend project*, and answers the phase's
highest-risk question:

- **`_endpoint_` survives because the convergence adopts it rather than replacing it.**
  `backendServices.activeBackendId` is now allowed to hold the literal `'_endpoint_'`,
  meaning what it already means to the runtime. **No node parameter changes value, ever** —
  verified round-tripping through real project metadata (§6.4) and re-resolved by the
  runtime (§6.5).
- ⚠️ **A deliberate deviation from the spec**: the *selection* converged, the
  *configuration* did not. `cloudservices` still holds the endpoint's URL and app id,
  because that key is read or written in **eight places outside the task's territory**
  (the exporter, the deploy build context, the project merger and its version-control UI),
  and moving it is a cross-cutting change that must land with its runtime reader in one
  commit. The defect is closed without it.
- ⚠️ **It is not self-sufficient.** §8 lists three runtime follow-ups, with exact code. The
  load-bearing one is `defaultBackendId`, which is still endpoint-first unconditionally —
  so a user who switches the project to Directus in the panel gets **a badge that moves and
  record nodes that do not**. §8.1's patch is gated on `backendServices.version >= 2`, and
  applying it **ungated would move every Record node in every legacy project onto whichever
  REST backend was added last**.
- It also overturns a stale premise worth keeping: **an editor *can* be driven from a
  worktree** (`npm run dev:debug` compiles the worktree's own sources; the `node_modules`
  symlink affects where *packages* resolve, not where *sources* are read). BCN-009-NOTES §6.1
  says otherwise and that cost the previous run its live pass.

**Consequence for BCN-004:** step 7 is deliberately not done. It deletes four
`noodl.byob.*` types and was gated on BCN-008 retiring the fifth so that `register-nodes`
and `nodelibraryexport.js` are touched once, with all five deletions landing together.

| Task | Tier | Status | Notes |
|---|---|---|---|
| BCN-001 The adapter contract & capability descriptor | 1 | ✅ **Complete** | Prose contract circulated first, then [`packages/nodegx-backend-contract`](../../../packages/nodegx-backend-contract/). **Four stale premises found (§0 + §9); the two unverified cells were probed, not deferred.** All 9 decisions answered |
| BCN-002 Parse-wire behind the contract | 1 | ✅ **Complete** | `ParseWireAdapter` + a `CloudStore` reduced to resolution. **Four more stale premises, three wrong contract shapes, three wrong `parse` descriptor cells and two defects** — see [BCN-002-NOTES.md](./BCN-002-NOTES.md). A real Parse Server now runs in the rig |
| BCN-003 The filter dialect | 1 | ✅ **Complete** | Five translators, gated by the descriptor. **`convertFilterOp` had no branch for eleven operators, so `contains` returned the whole collection.** Both built-in-backend defects fixed. 106 live checks, 0 failures — see [BCN-003-NOTES.md](./BCN-003-NOTES.md) |
| BCN-003b One filter builder | 1 | ✅ **Complete** | `QueryEditor`'s filter half deleted; one builder for both ports. **The "no data-format change" premise was wrong** — the Parse saved format moves, so the runtime reads both shapes. ⚠️ **The live pass found the Parse filter builder has been unreachable in the editor since WF-007** — see [BCN-003b-NOTES.md](./BCN-003b-NOTES.md) §3 |
| BCN-004 REST data adapter & the end of BYOB | 2 | 🔨 **Steps 1–6 and 8 of 8** | Wires measured first — [BCN-004-WIRE-FACTS.md](./BCN-004-WIRE-FACTS.md) — then `RestDataAdapter` built on the **wire profiles, not the preset** (the preset's Directus total ignores the filter). **45 unit tests, 42/42 live across all three servers**, and the driver was mutation-tested to prove it discriminates. ⚠️ **The two obvious pagination checks pass under a broken implementation** — `limit=2, skip=2` makes a raw skip and `floor(skip/limit)+1` both `2`. Port generator moved to `schema-ports.ts`; ⚠️ **the catalog was never the doubled-port check** for this family (`parameterEncoding.known: false`). Step 5 done: one `resolveBackend`, a `CloudStore` router, and the picker on all six nodes. ⚠️ **A project has TWO active backends** — `cloudservices` binds the record/auth/file nodes, `backendServices.activeBackendId` binds the BYOB ones — so the backend the Record nodes already use is in neither list and has no id. `hideWhenSingleBackend` would have counted built-in-plus-Directus as **one**, hidden the picker and **silently moved every Record node onto Directus**; a synthetic `_endpoint_` entry fixes it. Same defect as the double ACTIVE badge, from the other side. `serializeObject` is wired, so RUN-003's JSON-column/date normalisation is no longer lost. **Step 6 is done — 101 live checks, 0 failures, through the *nodes*, across all five backends** ([BCN-004-NOTES-STEP6.md](./BCN-004-NOTES-STEP6.md)). It found ⚠️ **an empty sort that killed a create**: `_addModelAtCorrectIndex` guarded `sort !== undefined` and then read `sort[0][0]`, and the Javascript filter path always initialises its sort to `[]` — so a JS filter with no `sort()` plus Use limit meant a created record **never fired `Created`**, because the throw escaped through the adapter's event emit inside the create's own success callback. Fixed, six regression tests. ⚠️ **Two of its own checks were instrument defects first**: an XHR shim whose `catch` spanned the callback dispatch made every successful write also raise `record/storage-op-failed`, and the routing check was **vacuous** — 95 per-backend checks stayed green with `backendId` disabled entirely, because each backend was the active one in its own run. **Step 8 has nothing left to flip**: the data cells were set *from* the transport measurements when they were taken, step 6 corroborated them at the node layer, and no capability cell exists for schema introspection. ⚠️ **Step 7 is RE-SCOPED and the four types are NOT deleted — deliberately, and this needs a decision.** BCN-008 retired the fifth (`SubscribeToChanges`) and its tail is cleaned up (`b2333398`). The other four are *not* deleted because **two of the step's premises turned out to be false**: (1) **LIB-006 is "Not started"**, so the migration registry the step says to add entries to does not exist; and (2) ⚠️ **deleting them removes a working capability with no replacement** — `byob-query-data.ts` has an `apiPathMode` port that reaches Directus **system collections** (`directus_users` → `/users`), `RestDataAdapter` has **zero** references to `apiPathMode`, and `record-ports.ts` sets `filterByApiPathMode: false` deliberately. Deleting the family while the merged one cannot do system collections **creates exactly the silent gap BCN-010 exists to prevent** ("a merged family with silent gaps is worse than two honest ones"). Criterion 2 — one node that reads "Delete Record" — is BCN-010's, so **the deletion belongs there with the system-collections gap as its precondition** — [BCN-004-NOTES-TRANSPORT.md](./BCN-004-NOTES-TRANSPORT.md), [BCN-004-NOTES-PORTGEN.md](./BCN-004-NOTES-PORTGEN.md), [BCN-004-NOTES-STEP5.md](./BCN-004-NOTES-STEP5.md) |
| BCN-005 Relations across five backends | 2 | ✅ **Complete** | A neutral relation model shaped **around Parse** — `RelationWrite`'s first union member is the junction-less `op`, with `foreignKey`/`arrayField`/`junction` fitting around it — plus four metadata parsers and a fifth for what a running app actually holds. `addRelation`/`removeRelation` implemented on Directus, PostgREST and PocketBase where the wire was measured; **55 live checks, 0 failures** across four real servers; `relatedTo` executed for the first time and a relation added to the equivalence corpus. **Three measurements are the phase's own failure mode — a plausible wrong answer, not an error**: ⚠️ Directus's M2M include is **two hops** (`fields=*,tags.*` returns the *junction* rows; only `tags.tag_id.*` returns tags) and the same mistake in a *filter* is a **403 — the status a real permission failure gives**; ⚠️ PostgREST **cannot see a junction with a surrogate `id` PK** (`PGRST200` vs 200 with a composite PK), so that junction is not emitted at all; ⚠️ PocketBase needs `?=` across a to-many, because `=` means *every* related record matches and returns an empty set with a 200. `targetClass` → `targetCollection`, old name kept as a deprecated alias because `Noodl.Records.addRelation({targetClassName})` is public scripting API. **Seven mutations, seven discriminate — but two passed 50/50 first time**, because a one-tag corpus cannot tell `?=` from `=` — see [BCN-005-NOTES.md](./BCN-005-NOTES.md) |
| BCN-006 Auth & the token lifecycle | 2 | ✅ **Complete — steps 1–8** | The lifecycle designed in prose, `IAuthAdapter` + the Parse wire behind it, and refresh/single-flight/cross-tab under test on injected timers. ⚠️ **Exit criterion 4 cannot be claimed — nothing in the product refreshes a token yet.** One `SessionStore` replaced *four* separate opinions about who is signed in, three of them in no spec. Two more wrong contract shapes. **Step 4 is done: `RestAuthAdapter` gives the product its FIRST `performRefresh`**, for Directus and PocketBase, and criterion 4 is met on a *genuine* expiry rather than a mocked clock. Probing before implementing paid four times, each a silent failure: ⚠️ **Directus's `expires` is milliseconds of remaining lifetime**, not an absolute time and not seconds — stored naively it puts the deadline in 1970 and refreshes forever while appearing to work; ⚠️ **PocketBase has no refresh token** and refreshes with the access token, so `TokenLifecycleController`'s guard **would have signed every PocketBase user out at the first scheduled refresh** — unreachable by any Parse-based test, because Parse never schedules one; a refresh is not guaranteed to move the deadline, so `arm` could hot-loop; and Directus rotates and rejects a replay with 401, making single-flight correctness rather than optimisation. Both live-QA defects addressed: `Current.email` fixed, **`emailVerified` half fixed and said so** — a new sign-up stores `false`, a pre-existing user still reads `undefined`, and the real close is one line in `nodegx-backend`. The `indexOf` bug is **fixed**, and measuring it found a worse one beside it that was in no register: ⚠️ **an entire HTML document was arriving as the node's `error` string** for a builder to wire to a text label; `resetPassword`'s failure messages were also copied from `verifyEmail`, so a user resetting a password was told their *email* had failed to verify. ⚠️ **Steps 5 (OAuth) and most of 6 are not done, and Supabase auth is gated rather than implemented** — see [BCN-006-NOTES.md](./BCN-006-NOTES.md). **Live-verified in the preview window** ([BCN-006-007-LIVE-QA.md](./BCN-006-007-LIVE-QA.md)): sign-up/log-out/log-in all work through the XHR branch and a wrong password rejects with a string, but ⚠️ **`Current.email` is `undefined` after `signUp`** — so the "we sent a link to {email}" screen renders `undefined` — and ⚠️ **`emailVerified` never populates** |
| BCN-007 Files across five backends | 2 | ✅ **Complete — steps 1–7** | The normalised `FileRef` and the Parse wire behind it, plus step 4's contract half (`kind`) and step 5 for the two backends that could be evidenced. **A fourth wrong contract shape**: `UploadFileOptions.data` was required and nothing in the repo has ever set it. ⚠️ The normalised reference **stops meaning what the spec assumes one save later**. Steps 2, 3, 6, 7 need BCN-004 — see [BCN-007-NOTES.md](./BCN-007-NOTES.md). **Both of its unprobed claims are now measured** ([BCN-006-007-LIVE-QA.md](./BCN-006-007-LIVE-QA.md), [BCN-004-FILE-FACTS.md](./BCN-004-FILE-FACTS.md)): the 201 exists and carries `size`/`contentType`, and the Directus field map is right — but ⚠️ **`CloudFile` drops both fields**, so BCN-007 added fields to `FileRef` that no graph can read, and ⚠️ **Directus `/assets/{id}` 403s unauthenticated**, so the synthesised URL is a broken `<img>` |
| BCN-008 Realtime across three transports | 2 | ✅ **Complete** | `IRealtimeAdapter` with the lifecycle as its substance, and the `realtime.*` cells set from a probe of every backend the rig can reach — [BCN-008-NOTES.md](./BCN-008-NOTES.md). ⚠️ **The `onclose` trap is worse than recorded**: across four failure modes `close` never fired once, and a WS on a non-upgrading path fires *neither* `error` nor `close` — `byob-realtime.ts` has no connect deadline, so that case never connects and never reports. ⚠️ **Two descriptor probe paths would report `unsupported` on working servers** (Directus `/server/info`, Parse `/serverInfo`); both repointed at the handshake. ⚠️ **Supabase Realtime has never been in the rig** — every Supabase cell is `measured: false`; Parse LiveQuery was **measured absent**. **Built and live-verified**: one `RealtimeSubscription` lifecycle with four transports — SSE for NodeGX and PocketBase, WebSocket-with-handshake for Directus, and for Parse a probe and a reason rather than a protocol. `SubscribeToChanges` is retired and the capability now lives on **Query Records itself**. **The restart test is closed for the first time** — reconnect had never been verified for *any* transport, including the Directus one that was supposedly shipped. Each backend was restarted *underneath a live subscription and then written to*, deliberately that way round: a status returning to `subscribed` proves a socket reconnected and says **nothing about resubscription**, because both SSE servers mint a fresh `clientId` and treat the POST as replacing the set. ⚠️ NodeGX was a *process* restart, not a container — the rig has no such service. **70 transport + 29 node-level checks, 0 failures.** The mutation test is the reason to believe them and one result is the warning itself: **with the pong removed only one check failed and the delivery check still passed**. ⚠️ **Supabase still has no transport and no cell was flipped** — see [BCN-008-NOTES.md](./BCN-008-NOTES.md) §8–13 |
| BCN-009 One backend list, picker & disclosure | 3 | 🔨 **Steps 1, 3, 5, 6, 7 of 7** | One list from *three* mechanisms, one add flow, and **the security disclosure on every card — the deliverable**. **Step 7's live pass is now done in full — all eleven steps pass** ([BCN-009-LIVE-QA.md](./BCN-009-LIVE-QA.md)), including a real Directus connecting in 203ms. ⚠️ **Two ACTIVE badges at once**, because the endpoint card renders it unconditionally while the external card renders it on `activeBackendId` — the two-config-surface split this phase exists to end, still on screen. ⚠️ **OPS-003's findings store does not exist**, so step 6 could not mean what the spec says. **Step 2 is DONE and MERGED** (`23179bf2`), live-verified — see the batch note above. It closes all four symptoms of the two-active-backends defect with one converged *selection*, keeps `_endpoint_` by adopting it, and deliberately leaves the two *configuration* homes alone with an eight-site argument for why. ⚠️ **It needs three runtime follow-ups (its §8) that are not written**, the load-bearing one being `defaultBackendId` — until that lands, switching backend in the panel moves the badge but not the record nodes. **Step 4 is answered and stays open, re-scoped**: BCN-004 step 5 closes about *half* of it. The six Record and two relation nodes have a `backendId` port and the four BYOB nodes always did — but `user/user.ts`, `user/setuserproperties.ts`, `data/cloudfilenode.ts` and `data/signfileurl.ts` have **no `backendId` port at all**, so step 4 is now "the picker on the auth and file families" |
| BCN-010 Capability gating & catalog reconciliation | 3 | 📋 Specced | **The task that makes the phase's claim true or false.** A merged family with silent gaps is worse than two honest ones. Unblocks phase 30 |

## The exit criterion

The phase is done when all six of these hold:

1. A user picks one backend from one list and every data, auth and file node points at it without being
   told to. *(BCN-004, BCN-009)*
2. There is exactly one node that reads "Delete Record", and one that reads "Create Record". *(BCN-010)*
3. Anything a chosen backend cannot do is **visible in the editor, with a sentence saying why** —
   before it is discovered at runtime. *(BCN-010, on BCN-001's descriptor)*
4. A logged-in user stays logged in across an access-token expiry, on every backend that has one.
   *(BCN-006 — **met for Directus and PocketBase**, and on a **genuine expiry**: PocketBase's users
   collection was reconfigured to issue 25-second tokens, one was allowed to really expire with the
   session open, the original token confirmed 401, and the user was still signed in on a silently
   replaced one. Parse's tokens never expire, so it is vacuously met there. ⚠️ **Supabase is
   deliberately gated, not implemented** — there is no GoTrue in the rig and writing an auth flow
   from documentation is how a user gets locked out of their own app. The criterion says "on every
   backend that has one"; Supabase has one and we do not serve it, so read this as met for three of
   five with the fourth stated rather than hidden)*
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

## What BCN-003b found

Full detail in [BCN-003b-NOTES.md](./BCN-003b-NOTES.md).

- ⚠️ **The Parse-family visual filter has been unreachable in the editor since WF-007, and so
  has the class picker.** `SchemaHandler._fetch()` is a stub whose `haveCloudServices` is only
  ever assigned `false`, so `dbCollections` metadata is wiped on every window focus — and both
  Parse data nodes read that metadata to decide whether to declare their filter, sort and class
  ports at all. Query Records currently has **no class dropdown, no visual filter and no visual
  sort**. Verified from the source, the running editor and the saved project file. The Data
  Browser still works because it asks the backend directly, which is why this is not obvious.
  **Unowned; BCN-004 or BCN-009 is the natural home.**
- ⚠️ **"A pure UI retirement, no data-format change" was wrong.** That was true of the BYOB
  format BCN-003 moved, not of the Parse one this task retires. The saved shape changes in
  project data, and the runtime reads it in *two* places beyond translation — `_collectInputs`
  builds the dynamic `qp-`/`fp-` ports from it. Both shapes are read at runtime now, for the
  same reason BCN-003 migrated in two places: a deployed app never opens the editor.
- ⚠️ **`neutralToSavedFilter`, which the spec asks for, would have destroyed connected values.**
  The neutral model *resolves* `input: 'term'` into a value, so the port's name is gone by the
  time a filter is neutral. Round-tripping through it turns every connected rule into a stale
  literal — and looks correct on any filter without one. The two saved formats convert directly.
- **The port name is what this rewrite could have broken in silence.** `QueryEditor` stored a
  parameter name and the node prefixed it; the builder stores the port name whole. Regenerating
  it renames a port that may have a wire on it, and the connection is dropped without a word.
  `valuePortPrefix` is therefore a required parameter, declared by the node beside the schema.
- **`QueryEditor/` could not be deleted as the spec asks** — the sorting editor lives there and
  sorting is explicitly out of scope. The filter half went; the directory is renamed
  `QuerySorting/`.
- **The two builders disagreed about an unresolved connected value and both were right.**
  `QueryEditor` dropped the rule (that is how an optional filter port works); BYOB kept the last
  literal. Made a parameter rather than a choice — picking one globally would have changed what
  existing apps ask for.
- **The live pass ran the whole chain**: a `QueryEditor`-format filter in a real project opened
  in the new builder showing all four rules, kept `qp-SearchTerm` through a real save, and the
  runtime sent `{"$and":[{"city":{"$eq":"London"}},{"$or":[{"age":{"$gt":40}},{"active":{"$ne":null}}]}]}`
  to a live backend — with the unconnected rule correctly absent — returning exactly the two
  Londoners.

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
| ~~One filter builder; fold `QueryPointerRule` in; **live QA in the editor**~~ | ✅ BCN-003b — done, and the live pass drove the whole chain to a real backend |
| ⚠️ **`SchemaHandler` never populates `dbCollections`, so Query Records has no class picker, no visual filter and no visual sort in the editor.** Since WF-007 | **unowned — BCN-004 or BCN-009** |
| A live pass on the **BYOB** side of the converged builder, against Directus | BCN-004 |
| `relatedTo` executed against a backend rather than only authored | BCN-005 |
| Make `toPostgrest` / `toPocketBaseFilter` reachable from a node — the request envelope, not the filter | BCN-004 |
| A relation in the equivalence corpus | BCN-005 |
| Proximity *sorting* for `nearSphere` on the built-in backend — the filter works, the ordering does not | — |
| `CloudStore._handle()` still answers `nodegx` unconditionally, so the capability gate reads a floor rather than the truth | BCN-009 — **its step 4, unstarted** |
| Promisifying the fourteen callback methods — deliberately not done, recorded as a follow-up | — |
| `AdapterRegistry.createAdapter`'s `case 'parse'` still throws "not yet refactored". That stub is for a **server-side** Parse adapter, not the client one BCN-002 built | — |
| ⚠️ **Two cards say ACTIVE at once.** `CloudServicesEndpointSection.tsx:178` renders the badge unconditionally; `BackendCard.tsx:115` renders it on `activeBackendId`. Same badge also says ACTIVE for a **stopped** backend | **BCN-009 step 2** — converging the metadata keys is the fix |
| ⚠️ **The first external backend goes ACTIVE on creation**, skipping the switch dialog — the one change that takes a project from publishing nothing to publishing a token happens silently | BCN-009 |
| ⚠️ **`Current.email` is `undefined` after `signUp`**, populated only after `logIn`; **`emailVerified` never populates at all** | BCN-006 step 4+ |
| ~~⚠️ **`CloudFile` drops `contentType` and `size`.**~~ | ✅ **Fixed** (`7cb23527`) — `CloudFile` reads all four and the Cloud File node grows two ports. Both stay **optional and absent** rather than `''`/`0`: upstream Parse reports neither, and a file read back from a saved record property has neither either, because `_serializeJSON` writes a File as `{__type, url, name}`. Defaulting would make "the backend never said" and "a save discarded it" the same value. **That second case is pinned by a test and remains BCN-007's** |
| ⚠️ **Directus `/assets/{id}` 403s unauthenticated**, so the URL an adapter synthesises is a broken `<img>`; and 403 also means "never existed", so **deleted and forbidden are indistinguishable** on that wire | BCN-007 step 2 |
| ⚠️ **`byob-realtime.ts` has no connect deadline.** A WS on a non-upgrading path fires neither `error` nor `close`, so the subscription never connects and never reports. `REALTIME_TIMING` now requires one | BCN-008 |
| ~~⚠️ **Parse schema introspection may be structurally impossible today**~~ | ✅ **Measured** (BCN-004 step 6). Upstream Parse `/schemas` is **403 without the master key and 200 with it** — the preset's *path* is right and what is missing is a field to hold the credential. Our own backend **404s `/schemas`**, so a `nodegx` external backend can never introspect. ⚠️ **The obvious correction is a trap**: `/api/schemas` answers **200 with an empty Parse-shaped list**, indistinguishable from "no collections"; the real route is `/api/_schema` with a **different shape** (`tables`, not `results`). Needs a path *and* a parser — **still unowned; BCN-009/BCN-010** |
| ~~`RestDataAdapter`'s `serializeObject` defaults to identity, so RUN-003's JSON-column/date normalisation is not ported~~ | ✅ BCN-004 step 5 — wired from the one place that builds the adapter; deleting the hook fails a named test |
| ⚠️ **`Upload File` and `Sign File URL` called `CloudStore.instance`** — the singleton that always resolves the legacy `cloudservices` endpoint — while BCN-004 gave the six Record nodes `CloudStore.forBackend`. **The entire file adapter would have been correct and unreachable from any graph.** Caught on the file driver's first run, on four backends at once | ✅ **Fixed** BCN-007 (`fc3d1c61`) — both nodes route, refuse an unknown backend id rather than falling back, and emit the Backend picker |
| ⚠️ **A `Blob` uploaded through the Parse wire is silently JSON-stringified and stored as `{}`, with a Success signal.** `_makeRequest` branches on `instanceof File`, and both `canvas.toBlob()` and `fetch().blob()` produce a `Blob` | **unowned — `ParseWireAdapter` / BCN-002** |
| ⚠️ **A `CloudFile` written into a REST record property is sent as a JSON object**, where a Directus file column expects a UUID string. `makeRestSerializer` passes it through `toJSON` unchanged | **unowned — BCN-004/005 record write path** |
| ⚠️ **nodegx `files.delete` defaults to `"nobody"`**, so a Delete File node against a fresh backend answers 403 for everyone but an admin. **Is that the intended default for an app?** | **Richard / BAK-003/006** |
| ⚠️ **A private nodegx upload made by a non-user principal has no owner and is not actually private** — `files.private` is now `degraded`. And **an expired signature on a *public* nodegx file still serves**, so signing a public file produces an expiry that does nothing | **unowned — BAK-006**; both recorded on their cells |
| ~~⚠️ **Directus system collections** are a capability BYOB had and `RestDataAdapter` does not~~ | ✅ **IMPLEMENTED**, BCN-007 §2.3 — not declared `unsupported`. `/items/directus_users` is 403 and `/users` is 200 on the same query dialect, so `directusSystem.ts` derives `apiPathMode` rather than carrying it. **BCN-010's precondition is closed and the four `noodl.byob.*` deletions are unblocked** |
| ⚠️ **`Logged Out` fires on every `User` node whichever backend signed out.** The *model* is now per-backend; the *signals* are not, and narrowing them would change when existing graphs run | **unowned — BCN-006 residual** |
| ~~⚠️ **`emailVerified` is HALF closed** — a pre-existing user still reads `undefined`~~ | ✅ **Closed at the backend**, BCN-006 step 5/6 — the one line BCN-006 itself named as "owed, unowned" |
| ⚠️ **Directus `auth.oauth` moved `conditional` → `unsupported`, deliberately.** `conditional` claimed *"your instance decides"*; it does not. Directus returns the session as an **httpOnly cookie**, which needs a second session model beside `SessionStore` — not a fifth redirect shape | recorded; the cookie-session decision is **unowned** |
| ⚠️ **Supabase `auth.magicLink` was still `supported`** — the last cell claiming a capability the product refuses before issuing a request | ✅ fixed, BCN-006 step 5/6. **All six Supabase auth cells now say what the code does** |
| **A probe runner for `conditional` cells does not exist** — BCN-006 calls it the largest of its three residuals and *"the one most visible to a builder today"* | **BCN-010 step 2** |
| ~~**BCN-005's authoritative relation parsers have no caller**~~ | ✅ **Closed** — the editor's `fetchSchema` now reads each backend's relation metadata with the admin credential in hand, parses it with the contract's own parsers (no copies), and stores `RelationDescriptor[]` on `CachedSchema.relations`. Live-verified: M2M stored under the parent's own alias with its junction and two-hop `readPath`, **app quit and relaunched**, relation came back byte-identical. ⚠️ **The §5 call site was a stale premise** — it asks for a second request on Supabase and PocketBase, but those are the *same URLs* `fetchSchema` already fetched; only Directus has a separate relation document, and following it literally would double every sync and let the two halves describe two different backend states |
| ⚠️ **Three runtime edits are owed so the stored relations are actually read** — exact code in [BCN-005-NOTES-SCHEMASYNC.md](./BCN-005-NOTES-SCHEMASYNC.md) §8: the `relations` field on `schema-types.d.ts`, carrying it through `resolveBackend.ts`, and preferring it over `relationsFromCachedCollections` in `cloudstore.js`. ⚠️ **`relations.length &&`, not just `relations &&`** — a `custom` and an unsynced backend both want the fallback, and an empty stored array must not silence it. **Until these land, the relations are stored and nothing reads them** | **orchestrator — landing after the batch merges** |
| ⚠️ **Three more `parsePocketbaseSchema` defects below the `fields` rename**: a relation's **target was dropped entirely** (named by `collectionId`, never by name); **`hidden` was not propagated**, so `users.password`/`tokenKey` became ports; and **`GET /api/collections` is paginated at 30** and the preset never asked for more — past thirty collections you lose collections *and* the relations pointing at them | ✅ all fixed, BCN-005 schema sync |
| ⚠️ **Directus's M2M alias arrives as `{type: 'alias', schema: null}`** — a writable-looking port for something that is not a column; and every seeded column has `meta: null`. **Parse has no `Pointer` on any live class**, so that parser branch is fixture-only | recorded; the Parse branch stays **unverified against a live server** |
| ⚠️ **`exportToJSON` returns `undefined` on a rootless project**, which reads exactly like a broken export rather than a missing root | **unowned** |
| ⚠️ **The `nodegx` preset points schema introspection at `/schemas`**, which our own backend does not implement — the real route is `/api/_schema` with a different shape. Still true, still unowned | **unowned — BCN-009/BCN-010** |
| ⚠️ **The deployed bundle published every backend's `adminToken`** | ✅ **Fixed** (`b6a8507c`), orchestrator pass — [BCN-ORCH-NOTES.md](./BCN-ORCH-NOTES.md) §2. `exportToJSON` deep-copies the whole metadata block and overrides only `cloudservices`, so `backendServices` rode along verbatim and `serializeBackend` is `{...backend}`. `types.ts` declares the field *"NOT published to the deployed app"* and nothing kept the promise. **Measured in a real browser against a real deploy bundle** — readable from `window.projectData` on the shipped site, and on Directus/PocketBase an admin token reads and writes every collection including users. One sanitiser feeds both export paths; strips `adminToken` only (zero runtime readers), keeps `publicToken` (documented as published, and `handleFor` hands it to every adapter) and `username`/`password` (a basic-auth backend needs them; a silent strip would break the app rather than protect it). Four specs, mutation-tested. ⚠️ **The disclosure half is unowned**: any project already deployed with an external backend has shipped its admin token and nothing tells the user to rotate it — **Richard's call** whether BCN-009's disclosure should say so |
| ⚠️ **`noodl.deploy.js` is a gitignored build artifact that nothing rebuilds** | **unowned — and it is the reason "a *deployed* app" is a distinct criterion.** The copy on disk predated `4e46a6f6`, so the first criterion run tested the previous day's runtime and **looked exactly like a real defect** (a converged project resolving to the endpoint's Parse wire). Three hypotheses were tested and all three were wrong — the logic reproduces correctly in Node, the metadata *is* readable, and a pre-page probe timestamped metadata at 108ms against a request at 117.7ms — before the artifact's date settled it. **A runtime change can land in source, pass every unit test and every node-driver live check, and still not reach a deployed app.** Rebuild the viewer before any deploy-level claim |
| ⚠️ **The rig's Directus has CORS disabled**, so a *browser* on another origin cannot read it — the preflight returns 200 with no `Access-Control-Allow-Origin`. **Every live pass in this phase ran in Node**, where the same-origin policy does not exist, so none of ~400 live checks could see it. A rig fact rather than a product defect, but a real deployment prerequisite nothing in the product mentions, and a user meets it as *"my app works in preview and not deployed"* | **unowned — BCN-010 docs step?** |
| ~~**The repeater binding with a numeric `objectId`**~~ | ✅ **Closed**, orchestrator pass — [BCN-ORCH-NOTES.md](./BCN-ORCH-NOTES.md) §6. Three item components mount in a **real deploy bundle in a real browser** and render Directus's integer ids (`wireIdTypes: ["number","number","number"]`). The DOM assertion is not vacuous — the legacy-metadata mutation renders an empty body through the same assertion. Corroborates the register's warning: `Collection.set` diffs on a **plain object** key (`collection.ts:492`), so a numeric id coerces to its string form — **do not convert `models` to a `Map`** |
| ~~⚠️ **Still owed: an actual export/deploy** of a converged project~~ | ✅ **Closed**, orchestrator pass — [BCN-ORCH-NOTES.md](./BCN-ORCH-NOTES.md) §5. With the baked `cloudservices` endpoint on a **dead port** and the Query node on `_active_`, the deployed app reaches the Directus backend named only by `activeBackendId`. **Mutation-tested**: drop the `version` marker and it falls back to the endpoint's Parse wire and renders nothing — BCN-009's legacy gate, demonstrated live rather than in-process. ⚠️ **The first version of this check was vacuous** — the node carried an *explicit* `backendId`, which short-circuits `resolveBackendTarget` before the converged gate is ever consulted, so the mutation changed nothing. Same failure mode as BCN-004 step 6's routing check |
| ⚠️ **`objectId` can now arrive as a `number`** — **two thirds closed** (BCN-004 step 6). Measured live: Directus and PostgREST hand back **numbers** on `firstItemId` and Create's `Id`; PocketBase, nodegx-backend and Parse hand back strings. A numeric id survives `_fromJSON` into the Model store, every item in a collection agrees on the type, and a numeric id fed **back into a `Record Id` input** drives a successful update *and* delete, each confirmed by re-reading. ✅ **The repeater third is now closed too** — rendered in a real deploy bundle in a real browser, orchestrator pass — so this row is **fully closed** as a *behaviour*. The **declaration** is still `string` | ✅ closed; the type widening is the row below |
| ⚠️ **Directus system collections** (`directus_users` → `/users`) are a capability BYOB had and `RestDataAdapter` does not — `byob-query-data.ts` has an `apiPathMode` port, `RestDataAdapter` has **zero** references to it, and `record-ports.ts` sets `filterByApiPathMode: false`. **This is now the blocker on deleting the four `noodl.byob.*` types**, because deleting them without it removes a working capability | **BCN-010 — its precondition** |
| ⚠️ **`catalog:check` passes while `catalog:merge` fails.** Deleting a node type leaves the enrichment layer dangling (an example, a `relatedNodes` reference, the type's own file) and the cheaper gate does not see it. CI runs `catalog:merge:check`, so it fails the build rather than shipping — but **run both after any node deletion** | ✅ recorded, BCN-008 tail |
| **BCN-008 could not verify: no browser was used** — both SSE transports ran on a hand-written `EventSource` shim — and **`client-only` SSR has no evidence behind it**; the mechanism moved to a per-capability `isSSRServer()` guard and nothing has rendered | BCN-008 remainder |
| ⚠️ **Supabase Realtime still has no transport and every cell is `measured: false`** — standing the Elixir service up needs a logical-replication restart, a publication, three secrets and a tenant POST. **No cell was flipped**; the descriptor's *reason* text was corrected, since it said "turn Realtime on in your dashboard" and was actively wrong | BCN-008 remainder |
| The contract's `objectId?: string` should widen to `string \| number` — Directus and PostgREST hand back integers, and coercing only the PK breaks `author.objectId === article.author_id`. `CloudStore._fromJSON`'s declaration says `string` while the value is a number. **The behaviour is now verified end to end** (render included); only the *declaration* is wrong | **unowned — orchestrator deferred it deliberately.** It recompiles every consumer including `RestDataAdapter.ts` and `capabilities.ts`, both owned by in-flight workers. Do it in one commit once the batch has merged |
| ~~⚠️ **BCN-009 step 2's THREE runtime follow-ups**~~ | ✅ **All three landed** (`4e46a6f6`), behind the `version >= 2` gate its notes insisted on, with 17 tests of which the legacy-safety ones are the load-bearing half — removing the gate fails three. `isConvergedSelection` is exported because three call sites must agree on what converged means. **Live-verified too** (`28972cdc`): six checks in the node driver drive the ambiguous shape — an endpoint plus an `activeBackendId` naming something else — where the two runs differ **only** by the `version` marker, with the endpoint returning string ids and the selection numeric ones so the id type says which server answered. Legacy stays on the endpoint; converged follows the selection and returns the same filtered set from a different server; `_endpoint_` as the project's own selection still resolves. Mutation-tested live: **remove the gate and a legacy project's Record node comes back with numeric Directus ids.** ⚠️ **Still owed: an actual export/deploy.** Every check is in-process, so *"a **deployed** app resolves its backend from the unified metadata"* is demonstrated for the resolver, not for a bundle |
| ~~⚠️ **BCN-009 step 2's THREE runtime follow-ups, none written.**~~ *(superseded by the row above; kept for the exact edits)* Exact edits in [BCN-009-NOTES-STEP2.md §8](./BCN-009-NOTES-STEP2.md). **(1)** `defaultBackendId` must honour a converged selection — the load-bearing one; without it, switching backend in the panel moves the badge and not the record nodes, and BCN-009's own criterion *"a deployed app resolves its backend from the unified metadata"* stays unmet. ⚠️ **Must be gated on `backendServices.version >= 2`** — ungated it moves every Record node in every legacy project. **(2)** `byob-utils.ts:90` must pass `cloudservices`, or a BYOB node cannot resolve `_endpoint_` at all; same gate. **(3)** `endpointBackendEntry`'s `name` prefers the app id, so the *runtime* picker still reads `backend_ms94j6xso72rl` — a label, not an id, so no saved value changes | **unowned — the phase is not finished without (1)** |
| ~~⚠️ **`parsePocketbaseSchema` recovers NO fields at all from PocketBase 0.23+**~~ | ✅ **Fixed** (`0b8a0912`). Both names read, newest first; the fixture is the real measured 0.30.0 payload. ⚠️ **The old test is why it went unnoticed** — it only ever used the old shape, so parser and test agreed with each other and with nothing else |
| ⚠️ **`emailVerified` is HALF closed.** A new sign-up now stores `false`, but a **pre-existing user still reads `undefined`**, because `nodegx-backend`'s password signup never writes the column. One line, outside BCN-006's territory | **unowned — `nodegx-backend`** |
| ⚠️ **An entire HTML document arrives as a node's `error` string** on the Parse wire's `verifyEmail`/`resetPassword` paths, for a builder to wire to a text label. Found beside the `indexOf` bug | ✅ fixed, BCN-006 |
| **BCN-006 steps 5 (OAuth) and most of 6 (schema-driven user ports) are not done**, and **Supabase auth is gated rather than implemented** — no GoTrue exists to probe | BCN-006 remainder |
| ~~⚠️ **The `supabase.ts` descriptor knowingly disagrees with reality** (`auth.password: supported`)~~ | ✅ **Fixed** (`fcc34a44`) — four cells moved to `conditional`, the same treatment `realtime.subscribe` already gets, each carrying DOCUMENTED, NOT PROBED |
| **BCN-005's authoritative relation parsers have no caller** until the editor's schema sync stores their output; what runs today is the strict subset derivable from the cached schema. Exact call site in [BCN-005-NOTES.md](./BCN-005-NOTES.md) §5 | **unowned — editor territory** |
| ⚠️ **Relation metadata is admin-only on every REST backend** (Directus 403, PostgREST has no endpoint, PocketBase 401), so a running app holding a user token cannot look one up. This is *why* a relation the synced schema does not describe stays refused — the only alternative is guessing a junction table's name and writing to it | ✅ decided, BCN-005 |
| ⚠️ **A Query Records node with an empty sort crashed a create.** `_addModelAtCorrectIndex` read `sort[0][0]` behind a `!== undefined` guard; the Javascript filter path always initialises its sort to `[]`. The throw escaped through the adapter's event emit **inside the create's own success callback**, so Create New Record never fired `Created` for a record it had already written | ✅ **Fixed** BCN-004 step 6 (`be572835`), six regression tests |
| ⚠️ **`_getCurrentUser` (`dbmodelcrudbase.ts:540`) dereferences `modelScope` without a guard** on its cloud-runtime branch, though the parameter is typed `ModelScopeLike \| undefined`. A real cloud function always has one, so it never bites there | — |
| **The repeater binding with a numeric `objectId`** — the one third of the `objectId` risk a headless driver cannot reach | unowned |
| **Sorting through the Record nodes** is unmeasured per backend. Step 6's filter never calls `sort(...)` — which is what exposed the empty-sort defect, but leaves ordering unasserted | — |
| The baseline **"84/84 suites, 1556 tests" conflated two columns.** One suite (`agent-live-endpoint`) is env-gated and wholly skipped, and 13 tests are skipped. The honest prior state is **83 passing of 84 suites, 1556 of 1569 tests** | ✅ corrected here |
| `wire.ts`'s `createRequestHeaders` is needed on **`PATCH`** too — a PostgREST `PATCH` without `Prefer: return=representation` answers 204 empty, so `save` would call `success` with nothing. Read through a helper; the field wants renaming | BCN-004 |

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
- The [editor CDP driving traps](../../reference/) apply to every live pass: launch detached, never
  `cdp reload`, and relaunch rather than reload after touching node registrations. ⚠️ **This line used
  to say `--target=editor` attaches to the preview window. That is backwards** — `--target=dashboard`
  is the one that falls through to "first page", i.e. the preview; `--target=editor` is correct. See
  the correction near the top of this file.