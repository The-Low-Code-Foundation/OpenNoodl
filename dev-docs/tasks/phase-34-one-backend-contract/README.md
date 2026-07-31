# Phase 34 — One Backend Contract (Track S)

**Created:** 2026-07-31
**Origin:** not the roadmap. Richard asked why NodeGX ships two node families that appear to do the
same thing — one for Directus/Supabase/PocketBase, one for Parse — and whether they should be merged.
The investigation that followed found that the merge was already decided, never carried out, and is
cheaper than it looks.

## The question that started it

> "Why do I have one set of nodes for PocketBase, Directus, Supabase, but then another set of nodes
> just for Parse Server, that actually appear to do the same thing?"

The honest answer is that **nobody decided to keep both.** Richard decided the opposite on 2026-07-25,
recorded in [RUN-003-ASSESSMENT.md](../phase-16-runtime-deploy-health/RUN-003-ASSESSMENT.md):

> consolidate on BYOB… BYOB becomes the *single* external-backend story… **phase 19's `nodegx-backend`
> must surface as one more preset in `BackendServicesPanel` — one panel, one node UX, no fifth backend
> story.**

Half landed. The panel merged. The node UX did not — and then
[WF-007:43](../phase-19-cloud-workflows/WF-007-PARSE-FRAMEWORK-RETIREMENT.md#L43) explicitly fenced the
other family out of its scope ("Keep (not this task's to touch): … BYOB nodes + `BackendServices`
model/panel"). Each spec's scope fence excluded the other family, so the duplication survived by drift
rather than by decision. Phase 30 hit the symptom on 2026-07-30 —
[FINDINGS.md](../phase-30-node-library-audit/FINDINGS.md) records two *creatable* nodes both reading
"Delete Record" — and deferred it as "a naming decision and not a mechanical one."

## The three findings that set the scope

### 1. The contract already exists in the code

`CloudStore` is not a Parse client with node wrappers around it. It is an **18-method data interface**
whose signatures are already backend-neutral — [cloudstore.js](../../../packages/noodl-runtime/src/api/cloudstore.js),
691 lines:

```
query({collection, where, limit, skip, include, select, sort, count, search})
aggregate  count  distinct  fetch  create  increment  save  delete
addRelation  removeRelation  uploadFile  signFileUrl  deleteFile
```

`UserService` is the same shape — **ten methods**, [userservice.ts](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts):
`logIn`, `logOut`, `signUp`, `fetchCurrentUser`, `verifyEmail`, `sendEmailVerification`,
`resetPassword`, `requestPasswordReset`, `signInWithProvider`, `requestMagicLink`.

Parse-ness lives in two places and two only: `_makeRequest` (`cloudstore.js:54` — the `/classes/` path,
the `X-Parse-*` headers, the `_method: 'GET'` POST tunnel) and the `where` dialect. Grepping the three
main record-node files for `objectId|className|__type|Pointer` returns **nine matches total**.

**So the node layer is already written against the adapter contract this phase wants to formalise.**
That is what makes this an adapter job behind an existing seam rather than a rebuild, and it is why the
Parse-family nodes — not the BYOB ones — are the shape everything converges on.

### 2. The neutral filter model already exists, in two places

Both filter builders emit the same `{and:[…], or:[…], <field>:{op:value}}` shape, and each side already
has exactly one pure translator from it:

| | Builder | Property-editor type | Translator |
|---|---|---|---|
| Parse-wire | `components/QueryEditor/` | `QueryFilterType.ts` | [`queryutils.ts::convertFilterOp`](../../../packages/noodl-runtime/src/api/queryutils.ts) |
| BYOB | `components/ByobFilterBuilder/` (~1.9k lines) | `ByobFilterType.ts` | `byob-utils.ts::toDirectusFilter` |

Nobody has to invent a filter model. The work is **one more translator per backend**, against a model
that two independent implementations have already converged on.

### 3. Our own backend already speaks both wires

[`nodegx-backend/src/server/`](../../../packages/nodegx-backend/src/server/) contains `parse-wire.ts`
**and** `byob-admin.ts`. The latter's own header:

> BYOB (`/api/:table`) is the existing local-backend REST surface the BYOB nodes and the Data Browser
> speak

The built-in backend answers *both* node families today, on two URL surfaces. For our own backend the
user's choice of node family is a coin flip with no functional consequence. This is the strongest
evidence that the split is accidental — and it is also a free safety net: during migration either wire
keeps working against `nodegx-backend` while adapters land for everything else.

## The thesis

> **One data contract, one auth contract, one node family, five backends behind them — and every gap
> between them stated in the editor rather than discovered at runtime.**

The second clause is not decoration. The five backends are *not* equivalent, and a merge that hides
that produces apps that look wired and are not. Every capability the contract exposes carries a
per-backend declaration, and where a backend cannot do something the port is visibly disabled with the
reason on it.

## The capability matrix this phase commits to

| Capability | NodeGX | Parse | Directus | Supabase | PocketBase | Disposition |
|---|---|---|---|---|---|---|
| CRUD + query | ✅ | ✅ | ✅ | ✅ | ✅ | **contract** |
| Filter / where | ✅ | Mongo-ish | `_eq` | PostgREST | string DSL | **contract**, one translator each (BCN-003) |
| Relations, M2O read | ✅ | Pointer | ✅ | FK embed | `expand=` | **contract** (BCN-005) |
| Relations, O2M/M2M write | ✅ | Relation | ✅ | join table | ✅ | contract, ragged — gated per backend |
| Files | ✅ | ✅ | ✅ | ✅ | ✅ | **contract** (BCN-007) |
| Auth: password/signup/reset/verify | ✅ | ✅ | ✅ | ✅ | ✅ | **contract** (BCN-006) |
| Auth: OAuth | ✅ | authData | SSO | ✅ | ✅ | contract, provider lists differ |
| Auth: magic link | ✅ | ❌ | ❌ | ✅ | OTP | **gated** |
| Realtime | SSE | LiveQuery¹ | WS | Realtime WS | SSE | contract, three transports (BCN-008) |
| Aggregate / count / distinct | ✅ | master-key² | ✅ | RPC/opt-in | ❌ | **gated** |
| Permissions model | CLP+ACL | ACL | roles | RLS | API rules | **not unified — see decisions** |
| Cloud functions | workflows | Cloud Code | Flows | Edge Fn | pb_hooks | **out** |
| DB triggers | ✅ | Cloud Code | Flows | webhooks | hooks | **out — webhook seam instead** |

¹ LiveQuery is a separate server most Parse deployments do not run — BCN-008 must treat it as absent by
default. ² Parse's `/aggregate` is master-key-only upstream; BCN-001 verifies what `nodegx-backend`
actually does before the descriptor asserts anything.

## Task table

| Order | ID | Title | Tier | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|---|
| 1 | [BCN-001](./BCN-001-ADAPTER-CONTRACT.md) | The adapter contract & the capability descriptor | 1 — the contract | 🔴 Critical | 1–1.5 wks | none | 🔵 Fable 5 |
| 2 | [BCN-002](./BCN-002-PARSE-WIRE-ADAPTER.md) | Parse-wire behind the contract, with no behaviour change | 1 — the contract | 🔴 Critical | 4–6 days | BCN-001 | 🟠 Opus 4.8 |
| 2 | [BCN-003](./BCN-003-FILTER-DIALECT.md) | The filter dialect — one translator per backend | 1 — the contract | 🔴 Critical | 1–1.5 wks | BCN-001 | 🟠 Opus 4.8 |
| 3 | [BCN-004](./BCN-004-REST-DATA-ADAPTER.md) | The REST data adapter & the end of the BYOB node family | 2 — the adapters | 🔴 Critical | 1.5–2 wks | BCN-002, BCN-003 | 🟠 Opus 4.8 |
| 4 | [BCN-005](./BCN-005-RELATIONS.md) | Relations across five backends | 2 — the adapters | 🟠 High | 1–1.5 wks | BCN-004 | 🟠 Opus 4.8 |
| 4 | [BCN-006](./BCN-006-AUTH-CONTRACT.md) | Auth across five backends & the token lifecycle | 2 — the adapters | 🔴 Critical | 2–2.5 wks | BCN-001, BCN-004 | 🔵 Fable 5 |
| 5 | [BCN-007](./BCN-007-FILES.md) | Files across five backends | 2 — the adapters | 🟡 Medium | ~1 wk | BCN-004 | 🟠 Opus 4.8 |
| 5 | [BCN-008](./BCN-008-REALTIME.md) | Realtime across three transports | 2 — the adapters | 🟡 Medium | 1–1.5 wks | BCN-004 | 🟠 Opus 4.8 |
| 6 | [BCN-009](./BCN-009-BACKEND-PICKER.md) | One backend list, one picker, one security disclosure | 3 — the surface | 🟠 High | 1–1.5 wks | BCN-001, BCN-006 | 🔵 Fable 5 |
| 7 | [BCN-010](./BCN-010-GATING-AND-CATALOG.md) | Capability gating & the node-library reconciliation | 3 — the surface | 🔴 Critical | 1–1.5 wks | all | 🟠 Opus 4.8 |

Serial worst case ~13 weeks; realistic with parallelism ~7. BCN-002 and BCN-003 have disjoint
territories and run concurrently the moment BCN-001's contract is agreed; so do BCN-005/007/008 once
BCN-004 lands.

**Tiers are stopping points.** Tier 1 alone is worth shipping: the contract is explicit, Parse-wire
rides it with no behaviour change, and the filter translators exist — a structural improvement with no
user-visible risk. Tier 2 is where the backends actually become equivalent. Tier 3 is where the user
stops seeing two of everything.

## The decisions this phase starts from

| Decided | Decision | Why |
|---|---|---|
| 2026-07-31 | **The Parse-family node names win.** "Query Records" not "Query Data", "Create Record" not "Create New Record", "Update Record" replacing "Set Record Properties". The five `noodl.byob.*` types are retired. | They are the better names, the node layer is already contract-shaped, and the [fresh-start policy](../../reference/COMPATIBILITY-POLICY.md) removed the compatibility argument for preserving either set. Note the direction is *names from Parse, implementation from whichever is better* — BYOB's filter builder wins on merit (RUN-003 slice 5 measured it ahead). |
| 2026-07-31 | **Capability gaps are declared, not discovered.** Every contract method carries a per-backend support declaration; unsupported ports render disabled with the reason. | This is the whole justification for merging. A single node family that silently no-ops on some backends is strictly worse than two honest ones. |
| 2026-07-31 | **Permissions models are not unified.** CLP/ACL stays NodeGX-and-Parse; Directus roles, Supabase RLS and PocketBase API rules are configured in those products' own admin UIs and NodeGX links to them. | They differ in *where enforcement lives*, not in spelling. A unified permissions panel would produce apps that look secured and are not. The [BAK-003](../phase-22-production-backend/BAK-003-ACCESS-CONTROL.md) work stays scoped to our backend. |
| 2026-07-31 | **Cloud functions are out of the contract.** The Cloud Function node binds to `nodegx-backend` only and is capability-gated off elsewhere. | WF-001's workflow engine replaced it, and the deploy machinery was deliberately deleted by WF-007. Users on other backends use HTTP/REST nodes against their own function runtime. |
| 2026-07-31 | **We never push code to a user's backend.** No Parse Cloud Code deploy, no PocketBase `pb_hooks` upload. | Both are filesystem deploys, not APIs; both require credentials WF-007 removed on purpose; and both make us responsible for code running on infrastructure we do not control. |
| 2026-07-31 | **The webhook trigger is the universal inbound seam.** Directus Flows, Supabase Database Webhooks and PocketBase hooks all call a WF-005 webhook trigger. | Triggers stay authored in NodeGX and fired by whatever the user's backend natively supports. Costs nothing — WF-005 already ships the receiving end. |
| 2026-07-31 | **`custom` stays data-only.** No user-authored adapter plugin API in this phase. | A real plugin API means versioning and supporting third-party auth token lifecycles and filter serialisers. Config-driven endpoints plus HTTP nodes covers the actual demand; revisit only if it materialises. |
| 2026-07-31 | **One backend per project is the default assumption, not a constraint.** The per-node backend picker stays (BYOB's `_active_` already works) but is **hidden entirely when a project has one backend**. | Gets the simple UX Richard described without breaking multi-backend projects or needing a migration when someone adds a second. |

## What this phase is not

- **Not a new backend.** `nodegx-backend` gains nothing here. Phase 22 owns its capabilities; this
  phase owns how nodes reach it and four others.
- **Not a rewrite of the record nodes.** The node layer is already contract-shaped. If a task finds
  itself editing node port definitions to make an adapter fit, the adapter is wrong.
- **Not a permissions or security-model unification.** See decisions.
- **Not a hosting or provisioning story.** Connecting to a Supabase project is in scope; creating one
  is not.
- **Not a migration tool.** Moving a project's data from Parse to Supabase is a different product.
  Switching a project's *backend binding* is in scope; moving its rows is not.

## Relationship to other phases

| Phase | Relationship |
|---|---|
| **30 — Node Library Audit** | **Blocking, and this is why the phase exists now.** Phase 30 stopped short of auditing the data nodes deliberately — `audit/data.md` has 46 entries and `audit/cloud-services.md` has 22, against a node set this phase reshapes. BCN-010 hands phase 30 a settled node list. Auditing before this lands would document a library that is about to change. |
| **16 — Runtime & Deploy Health** | Executes the half of [RUN-003's decision](../phase-16-runtime-deploy-health/RUN-003-ASSESSMENT.md) that never landed. RUN-003's residuals (O2M/M2M unparsed, Supabase CRUD unverified live, PocketBase parser unexercised) are absorbed by BCN-004/005. |
| **19 — Cloud & Workflows** | Reopens the one line WF-007 fenced off. WF-005's webhook trigger becomes the universal inbound seam for backends that cannot host our triggers. |
| **22 — Production Backend** | `nodegx-backend` is a *consumer* of the contract, not a subject. Its CLP/ACL model stays scoped to itself by decision. |
| **26 — Deployment** | DEP-001's un-frozen backend endpoint is what lets a deployed app's backend binding change without a rebuild. Not a hard prerequisite; BCN-009 is cleaner after it. |
| **31 — Readiness & Operations** | OPS-006's security sweep gains a real check from BCN-009's disclosure: a published `publicToken` is exactly the "key on a frontend node ships to every visitor" case OPS-006 exists to catch. |
| **33 — Alpha Launch** | The duplicate-node confusion is a first-hour problem. If the alpha ships before Tier 3, ALPHA-001's cold-install pass must account for two record families still being visible. |
