# Phase 34 — Progress

**Track S — One Backend Contract**

**All 10 tasks specced as of 2026-07-31. BCN-001 COMPLETE — the contract exists. BCN-002 and BCN-003 are unblocked and run concurrently.**

| Task | Tier | Status | Notes |
|---|---|---|---|
| BCN-001 The adapter contract & capability descriptor | 1 | ✅ **Complete** | Prose contract circulated first, then [`packages/nodegx-backend-contract`](../../../packages/nodegx-backend-contract/). **Four stale premises found (§0 + §9); the two unverified cells were probed, not deferred.** All 9 decisions answered |
| BCN-002 Parse-wire behind the contract | 1 | 📋 Specced | Success condition is "nothing observable changed". The nine Parse-concept references in the record nodes are the audit list; only two have been examined |
| BCN-003 The filter dialect | 1 | 📋 Specced | Largest per-backend surface, best precedent. **One translator per backend, shared editor+runtime** — two copies is how RUN-003 shipped a 403 |
| BCN-004 REST data adapter & the end of BYOB | 2 | 📋 Specced | Retires 4 of the 5 BYOB types (realtime waits for BCN-008). Closes RUN-003's Supabase/PocketBase "believed to work" residuals |
| BCN-005 Relations across five backends | 2 | 📋 Specced | Opens with RUN-003's recorded residual: O2M/M2M need `GET /relations`. Parse's junction-less `Relation` is what the contract shape must accommodate |
| BCN-006 Auth & the token lifecycle | 2 | 📋 Specced | **The only task with no precedent in this repo.** Parse tokens never expire, so refresh/single-flight/cross-tab is new machinery. Budget accordingly |
| BCN-007 Files across five backends | 2 | 📋 Specced | The scoping assumption that no backend has native file storage was wrong — all five do. Cheaper than expected |
| BCN-008 Realtime across three transports | 2 | 📋 Specced | Retires the fifth BYOB type. Parse LiveQuery is the `conditional` case that justifies the whole four-state descriptor |
| BCN-009 One backend list, picker & disclosure | 3 | 📋 Specced | The security disclosure is the deliverable; the panel plumbing is not. Feeds OPS-006 rather than duplicating it |
| BCN-010 Capability gating & catalog reconciliation | 3 | 📋 Specced | **The task that makes the phase's claim true or false.** A merged family with silent gaps is worse than two honest ones. Unblocks phase 30 |

## The exit criterion

The phase is done when all six of these hold:

1. A user picks one backend from one list and every data, auth and file node points at it without being
   told to. *(BCN-004, BCN-009)*
2. There is exactly one node that reads "Delete Record", and one that reads "Create Record". *(BCN-010)*
3. Anything a chosen backend cannot do is **visible in the editor, with a sentence saying why** —
   before it is discovered at runtime. *(BCN-010, on BCN-001's descriptor)*
4. A logged-in user stays logged in across an access-token expiry, on every backend that has one.
   *(BCN-006)*
5. The same filter returns the same rows from every backend that can express it. *(BCN-003)*
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

### Still open

| # | Question | Why it is his call |
|---|---|---|
| 3 | **Does the phase ship before or after the alpha?** Tier 3 is what removes the duplicate nodes a stranger would see. Tier 1 alone is invisible to users. | Sequencing against Phase 33; the answer changes whether ALPHA-001's cold-install pass has to account for two record families. |
| 6 | **Are the four maturity levels the right gate for the security disclosure?** BCN-009 shows it always; OPS-001's Playing level shows nothing. A lesson project on a shared backend is the awkward case. | Cross-phase interaction between two of his own decisions. |

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
| Apply `DIRECTUS_OPERATOR_MIGRATION` to saved project filters; re-target the BYOB builder to emit the neutral vocabulary | BCN-003 |
| `custom` now has auth + filter surface: accept a **declared** dialect and token lifecycle | BCN-003, BCN-006 |
| Fix `queryutils.ts:373` — `$maxDistanceInMiles` read with `$`, the other two without; only one can be receiving what its caller writes | BCN-003 |
| Fix `pointsTo` reaching into the global `CloudStore._collections` cache; the schema must be passed in | BCN-003 |
| Rename `targetClass` to a neutral name, or decide it stays | BCN-005 |
| Build refresh/single-flight/cross-tab **once**, driven by `TokenLifecycle` | BCN-006 |
| Resolve Parse's documented-not-probed cells against a real Parse Server, if one is ever stood up | BCN-002 |
| **Unowned:** built-in backend drops geo filters; `matchesRegex` is not a regex | — |

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