# BCN-001 — The Contract, in Prose

**Status:** ✅ **Reviewed and shipped — 2026-07-31.** All eight §7 decisions answered, plus the
`custom` question. The types now exist at [`packages/nodegx-backend-contract`](../../../packages/nodegx-backend-contract/).
**Reviewer:** Richard. Nine sibling tasks register against the names in this document; changing them
after Tier 1 starts touches all nine.

This is the deliverable BCN-001 step 1 asks for: the contract in prose, circulated *before* the types.
Everything below is transcribed from code that exists, with the line numbers to check it against. Where
something could not be verified it says so rather than asserting.

> **What changed after review.** §5.3's two unresolved cells were settled by a live probe (§8), which
> also found two defects in our *own* backend and one in Directus's search. §6's stated cost was wrong
> — see §9. Everything else shipped as written.

---

## 0. Three corrections to the phase spec

These were found while transcribing. Two are cosmetic; **the third changes BCN-003's shape and estimate.**

### 0.1 There are 14 contract methods, not 18

The README and BCN-001 both say "18-method data interface", and the success criterion reads
"`IDataAdapter` has exactly the 18 methods `CloudStore` has." As written that criterion is
unsatisfiable. `CloudStore` has 18 methods excluding its constructor, but four of them are not contract
material:

| Method | Line | Why it is not a contract method |
|---|---|---|
| `_initCloudServices` | 33 | Construction/config resolution — replaced by the resolved handle (§3) |
| `_makeRequest` | 54 | **This is the Parse-ness.** It is the thing each adapter replaces |
| `on` / `off` | 46 / 50 | Event subscription, not a data operation — see §2.3 |

The remaining **14 are the data contract**, and they are exactly the 14 rows the README's own table
lists. The count "18" came from counting methods on the class rather than the table beneath it.

**Proposed:** `IDataAdapter` has 14 methods; the event surface is separate (§2.3); success criterion
amended to read 14.

### 0.2 `nodegx-backend` serves aggregate with no master key — cell resolved

README footnote 2 asks what `parse-wire.ts` actually does. It is answered in the handler's own comment
at [parse-wire.ts:246-252](../../../packages/nodegx-backend/src/server/parse-wire.ts):

> Both are governed by the `find` permission and the read ACL — they reveal exactly what find reveals.

There is **no master-key check anywhere in `parse-wire.ts`** (grep for `masterKey|X-Parse-Master-Key`
returns nothing). So `aggregate` and `distinct` work from a browser against our backend under ordinary
ACLs. Upstream Parse Server is still master-key-only for `/aggregate`.

**This is why `nodegx` and `parse` must be separate columns in the descriptor and not one "Parse-wire"
column** — they speak the same wire and have different capabilities. Worth noting given you chose to
keep the Parse preset.

### 0.3 ⚠️ The two filter models did *not* converge — this is the load-bearing correction

The phase's finding #2 says both builders emit `{and,or,<field>:{op:value}}` and that
`byob-utils.ts::toDirectusFilter` is the BYOB translator. Neither half holds.

- **`byob-utils.ts` contains no filter translator at all.** It is 468 lines of backend resolution, URL
  building, schema helpers and 17 `directus_*` system-endpoint mappings. `toDirectusFilter` actually
  lives in [byob-query-data.ts:706](../../../packages/noodl-runtime/src/nodes/std-library/data/byob-query-data.ts#L706).
- **The two models are genuinely different shapes**, and the BYOB one is not neutral:

| | Saved model | Operator vocabulary |
|---|---|---|
| Parse-wire | `{and:[…]}` / `{or:[…]}` / `{<field>: {equalTo: v}}` | **long-form, neutral** — `equalTo`, `greaterThan`, `containedIn` |
| BYOB | `{id, type:'and'\|'or', conditions:[{id, field, operator, value}]}` | **`_eq`, `_gt`, `_in` — Directus wire names, stored verbatim in project data** |

The BYOB types file says so in its own header: *"Data models for the visual filter builder that
generates Directus-compatible filter JSON."* The saved project data contains Directus's dialect.

**What this changes.** BCN-003's premise — "nobody has to invent a filter model; the work is one more
translator per backend, against a model two implementations already converged on" — is half wrong. The
Parse-side vocabulary *is* neutral and is the only candidate. But the BYOB side needs its **saved model
re-targeted**, not just a new translator hung off it.

**What rescues it.** The README already decided "names from Parse, implementation from whichever is
better — BYOB's filter builder wins on merit." That decision resolves this cleanly: **keep BYOB's
builder UI, re-target it to emit the neutral vocabulary.** The UI work is untouched; the converter and
the saved shape change.

**Cost.** BYOB filters saved in existing projects carry `_eq`. Under the
[fresh-start policy](../../reference/COMPATIBILITY-POLICY.md) legacy Noodl projects are not a
constraint, but these are *NodeGX* projects — including the QA fixture. Either a one-shot migration in
BCN-003 or an accepted break. **Recommend the migration**: the shape is mechanical (`_eq` → `equalTo`)
and there are only 24 operators.

**BCN-003's estimate should go up.** It is specced at 1–1.5 weeks on the "additive, not inventive"
premise. Re-targeting a saved model plus a migration is closer to **2 weeks**.

---

## 1. `IDataAdapter` — 14 methods

Transcribed from [cloudstore.js](../../../packages/noodl-runtime/src/api/cloudstore.js). Every option
key below is one the code actually reads. `{success, error}` callbacks stay callbacks — promisifying is
an out-of-scope follow-up, because BCN-002's entire safety argument is that no node changes.

### Query & read

| Method | Line | Options it reads |
|---|---|---|
| `query` | 157 | `collection, where, limit, skip, include, select, sort, count, search` |
| `count` | 247 | `collection, where` |
| `distinct` | 264 | `collection, where, property` |
| `aggregate` | 186 | `collection, group, where, limit, skip` |
| `fetch` | 280 | `collection, objectId, include` |

Notes that must survive into the adapters:

- `include`/`select`/`sort` accept **an array or a pre-joined string** — `Array.isArray(…) ? join(',') : …`
  at :165–167. Adapters take the array form; normalising is the contract's job, not each adapter's.
- `search` is **not** a filter operator. BAK-008 made it a dedicated parameter that switches our backend
  to FTS5 ranking, composed with `where` (:169–175). It is a separate capability key from `filter.text`.
- `count` is `query` with `limit=0&count=1` on the wire but a distinct method to callers. Keep both.
- `aggregate` carries a **live version fork** at :212 — `dbVersionMajor > 4` switches `$group`/`$match`
  to `group`/`match` and the grouping key from `_id` to `objectId`. That is Parse-server-version
  knowledge and it belongs inside the Parse adapter, not the contract.

### Write

| Method | Line | Options it reads |
|---|---|---|
| `create` | 306 | `collection, data, acl` |
| `save` | 348 | `collection, objectId, data, acl` |
| `increment` | 329 | `collection, objectId, properties` |
| `delete` | 373 | `collection, objectId` |

- `save` strips `createdAt`/`updatedAt` before sending (:350–351). Every adapter needs the same
  server-owned-field exclusion; the *field names* differ per backend, so this is a per-adapter list,
  not a contract constant.
- `acl` is passed straight through on `create`/`save`. Per the phase decision that permissions are not
  unified, this is `nodegx`+`parse` only and is `unsupported` elsewhere — it is a capability key.
- `increment` is a genuine contract method, not sugar: it maps to `__op: 'Increment'` on Parse and must
  map to an atomic increment elsewhere or be declared `degraded` (read-modify-write, racy).

### Relations

| Method | Line | Options it reads |
|---|---|---|
| `addRelation` | 390 | `collection, objectId, key, targetObjectId, targetClass` |
| `removeRelation` | 414 | `collection, objectId, key, targetObjectId, targetClass` |

`targetClass` is the one place a Parse concept leaks into a signature. BCN-005 owns whether it
generalises to "target collection" (it should — every backend has one) or stays Parse-only.

### Files

| Method | Line | Options it reads |
|---|---|---|
| `uploadFile` | 438 | `file, private, data, onUploadProgress` |
| `signFileUrl` | 461 | `name` → `{url, expiresAt, ttlSeconds}` |
| `deleteFile` | 478 | `file.name` |

- `private` is carried as the `X-NodeGX-File-Private` header (:446) — **ours, not Parse's**. On other
  backends privacy is a different mechanism entirely; capability key `files.private`.
- `signFileUrl` is a real per-backend divergence: S3 presign, Directus asset token, Supabase signed URL,
  PocketBase file token. All five can do it, none the same way. BCN-007.
- `onUploadProgress` only exists on the XHR path. If an adapter uses `fetch`, progress is `degraded`.

### 1.1 What is deliberately *not* in the contract

`_makeRequest` (the Parse seam), `_initCloudServices` (config), the module-level `_serializeObject` /
`_removeProtectedFields` / `_toJSON` helpers (Parse type coercion — each adapter needs its own), and
`CloudStore._collections` (the schema cache, which `queryutils.ts:311` reaches into globally — see §4.3).

---

## 2. `IAuthAdapter` — 10 methods

All ten confirmed present at the stated lines in
[userservice.ts](../../../packages/noodl-viewer-react/src/nodes/std-library/user/userservice.ts).

| Method | Line | Signature |
|---|---|---|
| `logIn` | 247 | `{username, password}` |
| `logOut` | 268 | `{}` |
| `signUp` | 285 | `{username, password, email, …properties}` |
| `fetchCurrentUser` | 356 | `{sessionToken?}` |
| `verifyEmail` | 378 | `{username, token}` |
| `sendEmailVerification` | 401 | `{email}` |
| `resetPassword` | 414 | `{username, token, newPassword}` |
| `requestPasswordReset` | 440 | `{email}` |
| `signInWithProvider` | 542 | `{provider, redirect?}` |
| `requestMagicLink` | 574 | `{email, redirect?}` |

### 2.1 The token lifecycle is the gap, and it is not a method

`fetchCurrentUser` takes `sessionToken` — a Parse session token, which **never expires**. Every other
backend issues a short-lived access token with a refresh token. There is no `refresh` method here
because Parse never needed one.

**Proposed:** the contract gains an 11th member that is *not* a method — a `TokenLifecycle`
declaration per adapter:

- `eternal` — Parse, NodeGX. Token is valid until logout.
- `refresh` — Directus, Supabase, PocketBase. Carries `{accessTtl, refreshEndpoint, refreshBeforeExpiry}`.

BCN-006 builds the scheduler, single-flight and cross-tab machinery once, driven by this declaration.
Flagging it here because BCN-006 is the one task in the phase with no precedent in the repo, and
declaring the lifecycle in BCN-001 is what stops it becoming three per-adapter implementations.

### 2.2 `signUp` takes arbitrary extra properties

It writes user-profile fields alongside credentials. Directus and Supabase split credentials from
profile across two calls/tables. Adapters must fan out; capability key `auth.signUpProperties` with
`degraded` where it costs a second round trip that can partially fail.

### 2.3 The event surface

`CloudStore.on/off` (46/50) emit `fetch`, `create`, `save`, `delete` after successful writes. Local
nodes depend on this — it is **not** backend realtime (BCN-008). Keep it in the contract as
`IAdapterEvents`, implemented once in a base class rather than per adapter, since it fires on our own
completed calls and needs nothing from the backend.

---

## 3. Resolution: the contract takes a handle

Two resolution paths exist today and disagree, exactly as BCN-001's traps warn:

| Path | Reads | Multi-backend |
|---|---|---|
| `CloudStore` | a singleton, one implicit backend | no |
| [`byob-utils.ts::resolveBackend`](../../../packages/noodl-runtime/src/nodes/std-library/data/byob-utils.ts#L53) | `NoodlRuntime.instance.getMetaData('backendServices')`, `_active_` sentinel | yes |

**Proposed:** every contract method takes a resolved `BackendHandle` as its first argument.
`resolveBackend` is promoted out of `byob-utils.ts` and becomes the single resolver — it is already the
more capable of the two. `CloudStore`'s singleton becomes "resolve `_active_`".

This is what stops the phase decision "one backend per project is a default, not a constraint" from
being re-litigated in every adapter.

---

## 4. The neutral filter model

### 4.1 The vocabulary is the Parse-side one

Per §0.3 the BYOB vocabulary is Directus's. The neutral model is the long-form vocabulary in
[queryutils.ts::convertFilterOp:255](../../../packages/noodl-runtime/src/api/queryutils.ts#L255),
because it names no backend.

**Shape:**

```
Filter    := {and: Filter[]} | {or: Filter[]} | {<field>: OpAndValue} | IdOp | RelOp
OpAndValue:= {<operator>: value}
```

Exactly one key per node — `convertFilterOp` errors on more (:258).

### 4.2 The operator set is a union, not either existing set

Neither vocabulary covers the other. This table is the input to BCN-003 and BCN-010's gating.

| Neutral operator | Parse | Directus | Notes |
|---|---|---|---|
| `equalTo` / `notEqualTo` | `$eq` / `$ne` | `_eq` / `_neq` | universal |
| `lessThan` / `greaterThan` | `$lt` / `$gt` | `_lt` / `_gt` | universal |
| `lessThanOrEqualTo` / `greaterThanOrEqualTo` | `$lte` / `$gte` | `_lte` / `_gte` | universal |
| `containedIn` / `notContainedIn` | `$in` / `$nin` | `_in` / `_nin` | universal |
| `exists` | `$exists` | `_null` / `_nnull` | inverted mapping |
| `matchesRegex` (+`options`) | `$regex` | `_regex` | Supabase/PocketBase: partial |
| `contains` / `startsWith` / `endsWith` (+ `i` variants) | ❌ — **regex-lowered** | native | 9 Directus operators, no Parse equivalent |
| `between` / `notBetween` | ❌ — **lowered to two conditions** | `_between` | |
| `isEmpty` / `isNotEmpty` | ❌ | `_empty` / `_nempty` | distinct from null |
| `text.search` | `$text` | ❌ | superseded by `search` param on our backend (BAK-008) |
| `pointsTo` | Pointer | relation `_eq` | BCN-005 |
| `relatedTo` `{id, key, className}` | `$relatedTo` | ❌ — junction query | BCN-005; **Parse-only shape** |
| `idEqualTo` / `idContainedIn` | `objectId` | pk field | pk name differs per backend |
| `nearSphere` / `withinBox` / `withinPolygon` | GeoPoint | ❌ | **gated — Parse/NodeGX only** |

**Two operators must be *lowered*, not gated.** `contains`/`startsWith`/`endsWith` and `between` have
no Parse operator but are trivially expressible (regex; two comparisons). Lowering keeps them
`supported` everywhere rather than producing a filter builder where half the string operators grey out
on our own backend. This is a BCN-003 implementation note with a capability consequence, which is why
it is here.

### 4.3 Two defects found in the existing translator

Both pre-existing, both should be fixed by whoever owns BCN-003 rather than carried forward:

1. **`nearSphere` distance options are inconsistent** —
   [queryutils.ts:373-375](../../../packages/noodl-runtime/src/api/queryutils.ts#L373) reads
   `_v.$maxDistanceInMiles` (with `$`) but `_v.maxDistanceInKilometers` and `_v.maxDistanceInRadians`
   (without). The code's own comment says *"Only one of the three can be receiving what its caller
   writes."* Left verbatim by a previous pass; still wrong.
2. **`pointsTo` reaches into a global schema cache** — `CloudStore._collections[collectionName]` at
   :311. A pure translator reading module-global mutable state is why the "shared editor+runtime, one
   translator per backend" rule in BCN-003 matters. The schema must be passed in.

---

## 5. The capability descriptor

### 5.1 Four states, as specced

| Value | Editor behaviour |
|---|---|
| `supported` | normal |
| `unsupported` | port disabled, reason shown |
| `conditional` | probed at connect; **treated as `unsupported` until proven** |
| `degraded` | normal, caveat surfaced in the property editor |

### 5.2 Key vocabulary

Derived from §1, §2 and §4 — one key per thing a node can attempt:

```
data.query  data.count  data.distinct  data.aggregate  data.fetch
data.create data.save   data.increment data.delete     data.acl
data.search
relations.pointerRead relations.relatedTo relations.addRemove
files.upload files.sign files.delete files.private files.progress
auth.password auth.signUp auth.signUpProperties auth.emailVerify
auth.passwordReset auth.oauth auth.magicLink
realtime.subscribe
filter.<operator>   — one per §4.2 row
```

Roughly 30 keys before the filter operators, which matches the "~30 reason strings" estimate.

### 5.3 Verified vs. asserted

Honesty about evidence, since a descriptor built on assumptions is wrong where users hit first.

| Cell | State | Evidence |
|---|---|---|
| NodeGX `aggregate` / `distinct` | ✅ **verified** | `parse-wire.ts:246-284`, ACL-governed, no master key. Read in this task |
| Parse `aggregate` | ⚠️ **documented, not probed** | Upstream Parse Server restricts `/aggregate` to master key. Not tested against a real Parse Server — we do not run one |
| PocketBase `aggregate` | ❌ **not verified** | Believed absent (no group-by in the records API). **Needs a live probe** |
| Supabase `aggregate` | ❌ **not verified** | Believed opt-in — PostgREST 12 `db-aggregates-enabled`. **Needs a live probe; the default has changed at least once** |

**The last two cannot be resolved from this repo.** They need the
[uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/), which already containerises Directus and
PostgREST. Recommend BCN-001 ships with both marked `conditional` — which is the correct value anyway
if the answer is "depends on instance config" — and BCN-004's live pass resolves them.

> ✅ **Both were probed rather than deferred — see [§8](#8-the-two-unresolved-cells-resolved).**
> Supabase is `conditional` and now provably so; PocketBase is `unsupported` and **fails silently**,
> which is a materially worse answer than "believed absent". Parse `/aggregate` remains
> documented-not-probed, and the descriptor says so in its `evidence` field.

### 5.4 Reason strings — draft voice, for your review

You asked me to draft and you to review. Proposed voice, three rules:

1. **Name the backend and the thing, not the key.** "Directus has no magic-link login" — not
   "capability `auth.magicLink` unsupported".
2. **Say what to do instead, when there is something.** "PocketBase can't group records. Query them and
   total in your app, or switch this node's backend."
3. **Never say "not implemented" or "coming soon"** — these are product facts about someone else's
   backend, not our backlog.

> ✅ **Voice approved; all ~30 written**, across the six descriptors. The three rules are enforced by a
> test rather than by memory: no reason string may contain its own capability key, the word
> "capability", or backlog language ("not implemented", "coming soon"), and each must be a sentence
> ending in punctuation rather than a label.

Sample of six, for you to react to before I write the other ~24:

| Key / backend | Draft string |
|---|---|
| `auth.magicLink` / Directus | Directus has no magic-link login. Use email and password, or an OAuth provider. |
| `data.aggregate` / PocketBase | PocketBase can't total or average records on the server. Query the records and calculate in your app. |
| `data.acl` / Supabase | Supabase controls access with Row Level Security, set up in your Supabase dashboard — not per record from here. |
| `realtime.subscribe` / Parse | Live queries need a Parse LiveQuery server, which most Parse setups don't run. Check with whoever hosts yours. |
| `filter.nearSphere` / Directus | Location filters aren't available on Directus. |
| `files.progress` / Supabase | Upload progress isn't reported by Supabase — the file still uploads. |

---

## 6. Where the code lives

BCN-001 rules out `noodl-runtime/src/api/` (beside the Parse client it abstracts) and the editor. Both
the runtime (nodes) and the editor (Data Browser, schema sync, filter builders) consume adapters, so
neither tree can own it without forcing the other to import across.

**Proposed: a new package, `packages/nodegx-backend-contract`.**

- Types, the descriptor, the filter model and the per-backend translators. No I/O.
- Depended on by `noodl-runtime`, `noodl-editor` and `nodegx-backend`.
- A package rather than a folder because the nx/lerna graph is what actually enforces "the editor does
  not import from the runtime's tree" — a shared folder gets violated in a fortnight.
- **Cost, stated plainly:** a new package means a PLAT-004 TSFixme re-baseline, a new jest project, and
  a new entry in the per-package hex ratchet. That trap is recorded in the parallel-batch notes; it is
  worth paying once here rather than discovering it in BCN-004.

---

## 7. Decisions — all answered 2026-07-31

| # | Question | Answer |
|---|---|---|
| 1 | **§0.1** — amend the success criterion from 18 methods to 14? | ✅ **Yes.** Now asserted at compile time in `tests/contract.test.ts`, so the count cannot drift back |
| 2 | **§0.3** — migrate saved BYOB filters, or accept the break? | ✅ **Migrate.** Map shipped as `DIRECTUS_OPERATOR_MIGRATION`; BCN-003 applies it |
| 3 | **§0.3** — raise BCN-003 from 1–1.5 wks to ~2 wks? | ✅ **Yes** |
| 4 | **§2.1** — `TokenLifecycle` as a declaration rather than three implementations in BCN-006? | ✅ **Yes.** Declared per descriptor |
| 5 | **§4.2** — lower `contains`/`startsWith`/`between` rather than gating them? | ✅ **Yes.** `LOWERED_OPERATORS`, with a test that they are never `unsupported` on the Parse-family backends |
| 6 | **§5.3** — ship PocketBase/Supabase aggregate as `conditional`? | ✅ **Superseded — both were probed instead.** See §8 |
| 7 | **§6** — new package, accepting the re-baseline cost? | ✅ **Yes**, and the cost was smaller than stated. See §9 |
| 8 | **§5.4** — is that voice right? | ✅ **Yes.** All ~30 written, with a test that enforces the three rules |

### And the one you reopened

You reopened **"is `custom` really data-only?"** — the spec had decided yes.

I have not expanded the contract to accommodate a plugin API, because doing so silently would commit
the phase to versioning third-party auth token lifecycles and filter serialisers. But the question has
a cheaper middle answer than the binary the spec offered, and §5's descriptor is what makes it cheap:

- **Data-only (spec's answer).** `custom` gets config-driven REST endpoints, no auth, no realtime.
- **A plugin API (open-ended).** Users author adapters. We version `IDataAdapter`, support their token
  refresh, their filter dialect. This is a platform commitment, not a phase.
- **Middle: `custom` is a *declared* backend, not a coded one.** A user supplies endpoint config **and
  fills in the capability descriptor themselves** — the same four-state table, in the Backend Services
  panel. No code, no plugin API, no versioned interface. They declare "my API can do `_gt` but not
  `_between`", and the editor gates ports off exactly as it does for PocketBase.

The middle option costs almost nothing *because* the descriptor already has to exist and be
data-driven. It gets you a genuine custom-backend story without the support tail. **That is what I'd
recommend** — but it does mean `custom` gains auth and filter capability, so it is your call, not a
detail I should absorb.

**✅ Answered: the declared backend.** `customDescriptor` ships `declarable: true` and a floor of the
five operations the custom preset form already requires by name (`list`/`get`/`create`/`update`/
`delete`) — configuring a custom backend is already a claim that those exist. Everything else is
`unsupported` with a reason that points at the Capabilities tab the user fills in. BCN-003 and BCN-006
must now accept a *declared* dialect and lifecycle rather than assuming one of five known ones; that is
the price, and it is bounded.

---

## 8. The two unresolved cells, resolved

§5.3 said PocketBase and Supabase aggregate "cannot be resolved from this repo" and recommended
shipping both `conditional`. Both were probed instead. Rig extended, not rebuilt: a new `aggregate`
profile on [uba-e2e](../phase-16-runtime-deploy-health/uba-e2e/), recorded run in
`BCN-001-AGGREGATE-PROBE-OUTPUT.txt`.

### 8.1 Supabase — `conditional`, and now provably so

Two PostgREST 12.2.3 containers, the same rows, differing in exactly one setting. Stock config refuses
every aggregate with `PGRST123 "Use of aggregate functions is not allowed"`. The same binary with
`db-aggregates-enabled=true` answers `count()`, `sum()`, `avg()`, `GROUP BY` and a composed `WHERE`.
It is per-instance, which is what `conditional` means — so the recommendation was right, but it is now
a finding rather than a hedge, and the descriptor carries the probe request that settles it.

**Trap recorded in the descriptor.** `?select=name,articles(count)` — an embedded-relation count —
returned **200 on both servers**. Probing with that reports `supported` on an instance that cannot sum
anything. The probe has to be the exact question.

### 8.2 PocketBase — `unsupported`, and it fails silently

Worse than expected, and it is the single best argument for the phase. PocketBase does not *refuse*
aggregation, it **ignores** it. Every spelling — `?group=`, `?groupBy=`, `?fields=count(*)` — returned
**HTTP 200 with ordinary un-aggregated rows**, indistinguishable from an invented parameter used as a
control. `?fields=rating:sum` returned 200 with `Content-Type: application/json` and
`Content-Length: 0`: an empty body that `JSON.parse` throws on.

So an Aggregate Records node pointed at PocketBase would not error. **It would return wrong numbers,
and the app would show them.** There is nothing for a runtime handler to catch, which means the
descriptor gate is the only thing that can stop it. That is BCN-010's job, stated concretely.

(PocketBase *can* aggregate — through a hand-authored `view` collection wrapping a `GROUP BY`, verified
working. But that is schema authored in the admin UI, not something a node can express, so it belongs
in the reason string rather than in the cell.)

### 8.3 Three findings nobody asked for

Directus was probed too, because its container was already in the rig and "documented, not probed" is a
choice rather than a limit when the backend is one command away.

| Finding | Where | State |
|---|---|---|
| **The built-in backend drops geo filters on the floor.** `$nearSphere`/`$within`/`$geoWithin` warn to the console and return `null` from the SQL translator, so the condition never reaches the WHERE clause and a "within 5km" query returns **every record** | `local-sql/QueryBuilder.ts:394` | `unsupported` |
| **The built-in backend's `matchesRegex` is `LIKE '%value%'`**, not a regex. `^Ada$` searches for that literal text, silently | `local-sql/QueryBuilder.ts:366` | `degraded` |
| **Directus `?search=` matches every field, unranked.** Searching "Published" returned three articles matched on their *status*, with titles that do not contain the word. Materially different from BAK-008's FTS5 ranking on the same port | probe output | `degraded` |

The first two are ours. Fixing SQLite geo is out of scope for phase 34; recording it is not.

---

## 9. §6's cost was overstated

The contract doc priced the new package at "a PLAT-004 TSFixme re-baseline, a new jest project, and a
new entry in the per-package hex ratchet". Measured after the fact, **two of the three do not exist**:

- **No TSFixme re-baseline.** `.tsfixme-baseline.json` targets `packages` wholesale, so the new package
  is scanned automatically — files scanned went 2,294 → 2,310 and every marker count stayed put. It is
  `strict: true` with no `any` and no `TSFixme`, which is achievable because the package is types and
  frozen data.
- **No hex-ratchet entry.** That ratchet targets only `noodl-editor/src` and `noodl-core-ui/src`.
- **The jest project was real**, and cost one `--scope` in the root `test:packages` script.

Recorded because it is the fourth stale premise this task has turned up, and the first one that was
mine rather than the spec's.

> ⚠️ **Unrelated, and pre-existing:** the TSFixme gate is currently **RED on `cline-dev`** — `TSFixme`
> and `any` each +26 over baseline, concentrated in `noodl-viewer-react/tests` and editor canvas tests
> from other sessions' work. Nothing in this task contributed to it, and it needs an owner.
