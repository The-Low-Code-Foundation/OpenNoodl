# BCN-004 — the transport layer, and what it could not prove

`RestDataAdapter` — Directus, Supabase (PostgREST) and PocketBase behind
`IDataAdapter`. Built 2026-07-31 against the live
[uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/).

| | |
|---|---|
| Adapter | [`packages/noodl-runtime/src/api/backends/RestDataAdapter.ts`](../../../packages/noodl-runtime/src/api/backends/RestDataAdapter.ts) |
| Unit suite | `packages/noodl-runtime/test/backends/rest-data-adapter.test.ts` — **45 tests, 45 passing** |
| Live driver | `uba-e2e/bcn-004-rest-driver.ts` → `.cjs`; output in `bcn-004-rest-driver.output.txt` |
| Live result | **42 checks, 42 passing, 0 failing**, across all three backends |
| `tsc --noEmit` | `noodl-runtime`: **7 errors, all pre-existing** (see §5). `nodegx-backend-contract`: **0** |
| Runtime suite | 1368 passing, 0 failing; 5 suites fail to *start* for the same pre-existing reason (plus one flake — §5) |
| Contract suite | 127 passing, 0 failing (unchanged; that package was not edited) |

---

## 1. Stale premises found

### 1.1 ⚠️ "Configured per backend type by the existing `BackendPreset`" — do not

The spec's Desired State §1. Doing it literally ships three known bugs, all
measured before any adapter code existed (`BCN-004-WIRE-FACTS.md`):

| Preset cell | What it says | What the server does |
|---|---|---|
| Directus `totalCountPath` | `meta.total_count` | ignores the filter — 5 where the answer is 3 |
| PocketBase `offsetParam` | `'page'` | a **1-based page number**, not a row offset |
| Supabase `totalCountPath` | `''` | the total is a `Content-Range` **header** |

The adapter is driven by `REST_WIRE_PROFILES` instead. The load-bearing half of
that argument is not tidiness: **preset values are copied into project metadata
when a backend is added**, so a project saved today would keep the wrong
Directus total forever, even after the preset was corrected.

The live driver prints the negative control that makes this checkable rather
than asserted:

```
control: raw Directus meta on the filtered query is {"total_count":5,"filter_count":3}
```

### 1.2 ⚠️ "BYOB becomes the REST adapter" is half wrong — confirmed, and worse than stated

The task briefing already flagged this and it holds. The runtime BYOB path is
Directus-only with **no branch on backend type anywhere**: `buildEndpoint`
returns `items/{collection}` unconditionally, `buildHeaders` always sends
`Bearer`, `pickTotalCount` reads Directus `meta`, and `byob-query-data.ts:729`
says so about itself. Supabase and PocketBase transports were **written here**,
not moved. Of `byob-utils.ts`'s 468 lines, the parts that generalised were
`pickTotalCount`'s *rule* (now the profile's `totalCount`) and the
`fields=*,author.*` relation expansion. The rest is schema/port work that Worker
B owns.

### 1.3 The spec's `distinct`/`aggregate` framing assumes every backend tries

It does not say so, but the implementation steps read as though each backend
answers each method. Two of the three refuse, and one of those refusals is the
most valuable line in the file — see §2.1.

### 1.4 `SaveOptions`' server-owned-field list is not the whole story for PostgREST

The contract's `SaveOptions` comment names `date_created` on Directus and
`created` on PocketBase. PostgREST has **no server-owned-column convention at
all** — a `created_at` there is an ordinary column the app may be writing on
purpose. Its exclusion list is therefore the identity fields only, and stripping
more would silently drop a legitimate write.

---

## 2. Deviations, with reasoning

### 2.1 `aggregate` and `distinct` refuse rather than attempt — and PocketBase is why

`begin()` gates every method on the descriptor before a request is built. On
PocketBase both cells are `unsupported`, so the adapter never sends the request.

This is not defensive coding. BCN-001 measured that **PocketBase does not reject
an aggregate — it ignores it**, answering `200` with ordinary un-aggregated rows
for every spelling tried, and answering an *invented* parameter identically. An
Aggregate Records node pointed at PocketBase would show wrong numbers with
nothing anywhere to catch, because there is no error to catch. The descriptor
gate is the only thing that can stop it. The live driver asserts the refusal
happens and that **no request is made**:

```
PASS  ⚠️ aggregate REFUSED rather than answered with wrong numbers
        refused with: PocketBase can't total or average records on the server. …
```

The sentence is the descriptor's own, so what a developer reads in the console
is character-for-character what BCN-010 will write on the greyed-out port.

⚠️ **A probe cannot un-refuse an `unsupported` cell.** `probedCapabilities`
settles `conditional` only. There is a unit test for this, because the obvious
implementation of "probed" would have opened the door.

### 2.2 An inexact row offset is **refused**, not rounded

`paginationParams` reports `inexact: true` when `skip` is not a whole number of
pages. The adapter turns that into an error whose sentence names the fix.

The alternative — rounding — returns rows 0–9 *as if they were* rows 5–14: right
count, right shape, wrong rows, green tick everywhere. That is the same failure
class as a dropped filter condition, which is the thing this phase keeps
finding.

The other alternative considered and **rejected**: fetch `gcd(skip, limit)`-sized
pages and concatenate. It is correct, and it turns one request into up to `limit`
of them when the two are coprime (`skip=5, limit=7` → seven round trips). A
pagination control that silently costs seven requests is a worse thing to ship
than one that says it cannot do this.

In practice nothing reaches the refusal: every paging node computes
`skip = page * limit`, which is exact by construction. It is for the hand-set
offset — the case that would otherwise lie.

### 2.3 `Prefer: return=representation` is sent on `save` too, which the profile only names for `create`

⚠️ **A new finding, measured here.** `RestWireProfile.createRequestHeaders` is
named for a create because the BCN-004 probe found the empty-body trap on a
`POST`. It is also true of a `PATCH`:

```
patch no Prefer   -> 204 ""
patch WITH Prefer -> 200 [{"id":3,"title":"…"}]
```

So `save` on Supabase without the header would call `success` with **nothing**,
on a success status, with no error anywhere — the identical defect on the method
the profile does not mention. The adapter reads the field through a helper
named `representationHeaders()` rather than `createRequestHeaders`, so the call
sites read for what the header does.

**Recommendation for `wire.ts`'s owner** (not edited — that file is read-only to
this worker): rename the field `representationRequestHeaders`, or document that
it applies to every write. Nothing needs to change behaviourally.

### 2.4 A missing record on a success status is an **error**

`create`, `save`, `fetch` and `increment` all call `options.error` when
`readRecord` returns `undefined`. `readRecord`'s own comment says this case
"must not be mistaken for success with an empty record"; this is that rule
enforced at the four call sites. The unit suite pins it and the mutation test in
§4 confirms it fires.

### 2.5 `objectId` is carried across **as the wire's type**, not coerced to a string

⚠️ **The decision `recordIdentity.ts` deferred to this task**, quoted from its
own comment: *"`String(4)` and `'4'` are not the same value to send back in a
`PATCH` URL, and BCN-004 is where a backend that does that has to decide."*

Directus and PostgREST key on integer primary keys and hand back `objectId: 4`.
The contract types `AdapterRecord.objectId?: string`, so the two disagree.

**Decided: preserve the wire's value.** The reason is concrete rather than
aesthetic — *the same integer appears as a foreign key inside related records*.
An `articles` row carries `author_id: 1` and the `authors` row's identity is
`1`. Coercing only the primary key would make `author.objectId === article.author_id`
**false for the same row**, which is a comparison an app author will write on
day one. The `PATCH`-URL concern the old comment raised turns out to be void:
`4` and `'4'` serialise identically into a URL, which the live pass exercises on
every update and delete.

**Consequence, recorded for BCN-009/BCN-010:** the contract's `objectId?: string`
is too narrow for the REST family and should become `string | number`. Not
changed here — `nodegx-backend-contract` is another worker's file this batch, and
widening a field twenty-five nodes pass through is not a change to make in a
side note.

### 2.6 A total is reported **only when asked for**

PocketBase volunteers `totalItems` on every list response; Directus volunteers
nothing without `meta=`. Passing it through whenever it happened to be there
would give a node a count on one backend and not another — the per-backend
divergence this phase exists to remove. `options.count` decides, uniformly.

### 2.7 Whole-record `search` is refused on Supabase and PocketBase

Directus has `?search=` and it is passed through (its descriptor marks it
`degraded` and explains that it matches every field, unranked — verified in
BCN-001).

The other two have no such parameter, and neither refusal is comfortable:

- **Supabase** — `data.search` is `conditional`. Even settled affirmatively,
  PostgREST's `fts` operator is **per column** and `QueryOptions.search` names no
  column. Refused with a sentence pointing at a column filter.
- **PocketBase** — ⚠️ **the descriptor and this implementation disagree.**
  `data.search` is `degraded` there and its reason says *"NodeGX searches by
  looking for your text inside each field"*, i.e. lowered to ORed `~` conditions.
  That lowering needs the collection's list of text fields, and the adapter has
  no schema. So the cell says "degraded but usable" and the adapter refuses.

  This is a real gap, not a rounding. It is recorded rather than resolved
  because the fix belongs where the schema is — either the node passes a field
  list into `search`, or the port generator lowers it before the adapter is
  called. **BCN-010 will gate the port as available and the call will fail.**

### 2.8 `increment` is atomic on one backend and racy on two, as declared

- **PocketBase**: `{'rating+': 3}`, one request, verified live (5 + 3 = 8).
- **Directus / Supabase**: `data.increment` is `degraded` in both descriptors,
  whose reason already tells the user in their own words that NodeGX reads the
  value and writes it back and that a simultaneous increment can lose one. The
  adapter does exactly that: `fetch` then `save`. Implementing the honest racy
  version beats refusing a thing the backend can nearly do — and the warning is
  already written, in the cell.

  ⚠️ Supabase's cell says *"a database function would avoid this"* and BCN-001
  notes *"BCN-004 may offer to detect one"*. **It does not.** RPC detection is
  not implemented; see §3.

### 2.9 Files and relation mutation refuse loudly

Out of scope per the spec (BCN-005 / BCN-007). They are **explicit refusals
carrying the descriptor's reason**, not silent no-ops. The file methods refuse
with the `FileError` envelope (`{error}`) that `FileCallbacks` declares, not the
bare string the eleven data methods take — a BCN-002 correction that two node
call sites depend on to tell a 403 from a 500.

⚠️ Note the descriptor disagreement this leaves: all three backends have
`files.upload` **supported**, because their APIs do support it. The gap is this
adapter, not the backend, and flipping the cell would be a lie about Directus.

### 2.10 The live driver mounts the rig's PostgREST at `/rest/v1/`

The Supabase profile's paths carry Supabase's `/rest/v1` prefix, which is right
for the product — a user's base URL is `https://xxx.supabase.co`. The rig runs
**bare PostgREST at the root**. Rather than teach the adapter a prefix-stripping
rule that exists only for the rig, the driver stands up a 20-line reverse proxy
that mounts the rig where Supabase mounts it. The path the adapter builds is the
path that ships.

---

## 3. ⚠️ Could not verify

Ruthlessly, and each with what would settle it.

1. **Hosted Supabase.** Everything labelled "Supabase" was measured against
   **PostgREST 12.2.3**, which is Supabase's REST layer but not the platform.
   Not exercised: the real `apikey`/JWT auth pair (the rig's `web_anon` needs no
   token, so the `tokenHeaders` code path **ran but was never authenticated**),
   RLS interaction, and Supabase's own defaults for `db-aggregates-enabled`.
   *Settled by:* a live pass against a free Supabase project.
2. **Supabase `aggregate` on the instance a user would have.** Verified against
   `agg-rest-enabled` (port 8058, `PGRST_DB_AGGREGATES_ENABLED=true`). Whether a
   given Supabase project has it on is exactly why the cell is `conditional` —
   and **the probe that would settle it is not implemented here**. Nothing calls
   `probedCapabilities` yet; today it is an option a caller must pass by hand.
3. **PostgREST aggregate RPC detection.** Not implemented (§2.8).
4. **Relation *reading* beyond one hop.** `include` is translated to
   `fields=x.*` / `select=*,x(*)` / `expand=x` and the Supabase `!inner` embed is
   emitted from the translator's `embeds`. Only the Supabase `!inner` path is
   exercised by a unit test; **no live check reads a related record back** on any
   backend. BCN-005 owns relations and this was left where the spec put it.
5. **Directus system collections.** `byob-utils.ts` maps `directus_users` →
   `/users` etc. via `SYSTEM_ENDPOINTS`. The adapter does **not**: every
   collection goes to `/items/{collection}`. A node pointed at `directus_users`
   through this adapter will 403. Deliberate — the mapping is Directus-specific
   and belongs with the collection picker — but it is a **capability the BYOB
   path had and this one does not**.
6. **`data.acl`.** Passing an `acl` to `create` logs a warning and drops it. Not
   tested live; no backend here accepts one.
7. **The `serializeObject` hook is never exercised with a real serialiser.** It
   defaults to the identity and every test and the live driver use the default.
   The schema-aware normalisation `byob-utils::normalizeValue` did — parsing a
   JSON column's text, coercing a date column to ISO 8601 — **has not been
   ported**, so a `json`-typed Directus column written from an object-typed port
   will double-encode exactly as it did before RUN-003 fixed it. Whoever wires
   the nodes must pass the hook.
8. **Dates.** No date column was written or read in any check. `JSON.stringify`
   turns a `Date` into ISO 8601, which is what all three want, but that is an
   argument rather than a measurement.
9. **Large filters.** The Parse wire has a `{_method:'GET'}` POST tunnel because a
   long filter truncates at the URL length limit. **All three REST wires put the
   filter in the query string and none of them has a tunnel.** A large enough
   `containedIn` list will fail, and the failure mode (server-dependent 414 or
   silent truncation) was not probed.
10. **Concurrency / the increment race.** The degraded read-modify-write is
    implemented and its race is declared. Nothing here demonstrates the race, and
    nothing serialises it.
11. **`custom` backends.** `restWireProfileFor('custom')` is `undefined` and the
    adapter refuses. Reading the saved `endpoints`/`responseConfig` is not
    implemented; the spec places `custom` outside the profile family and this
    task did not take it on.
12. **Nothing calls this adapter yet.** No node, no `CloudStore` route, no
    registration. Worker B owns the node layer. The claim "the record nodes work
    against all five backends" in the spec's success criteria is **untouched by
    this work**.
13. **The browser.** Every request goes through `fetch`. The Parse adapter has an
    XHR branch for the browser and a `fetch` branch for the cloud runtime; this
    one has only `fetch`, which is why `files.progress` would be `degraded` here
    if files were implemented. Not exercised in a browser.
14. **Deleting a record that does not exist looks like success** on Directus and
    PostgREST — both answer `204` for an unknown id (measured). There is no
    status the adapter can read to tell the two apart, so `delete` reports
    success either way. PocketBase alone answers `404`. This is a **behaviour
    difference between backends that the contract cannot currently express**.

---

## 4. Evidence: the live pass, and proof that it discriminates

Full output: `uba-e2e/bcn-004-rest-driver.output.txt`.

```
DIRECTUS 11        13 checks   all passing
POSTGREST 12.2.3   14 checks   all passing
POCKETBASE 0.30.0  15 checks   all passing
                   42 passed, 0 failed
```

A green run proves nothing on its own, so three **mutation tests** were run
against the bundled driver to show each headline check can fail:

| Mutation | Result |
|---|---|
| `meta.filter_count` → `meta.total_count` | **3 checks fail** (`the total is the FILTERED count`, `count()`, and the post-delete count) |
| page number ← raw `skip`, inexact refusal removed | **2 checks fail** (`row 3 of the filtered set`, `an offset that is not a whole page is REFUSED`) |
| `Prefer: return=representation` removed | **1 check fails** (`create hands back a record carrying its identity`) |

⚠️ **The second mutation is the one worth reading.** "page 1 of the filtered set"
and "page 2 of the filtered set" both **passed** under the broken
implementation — with `limit=2, skip=2`, `floor(2/2)+1` and a raw `skip` are both
2, so the two implementations agree exactly there. Only `limit=1, skip=2` (page 3
= Grace, versus page 2 = Alan) tells them apart. A driver with the obvious two
pagination checks and not the third would have shipped this bug with a green
run — which is the shape of the original defect, one level up.

---

## 5. The pre-existing failures, named honestly

`npx tsc --noEmit` in `noodl-runtime` reports **7 errors, none in any file this
task touched**. All seven are
`TS2307: Cannot find module '@noodl/runtime'` in `packages/noodl-viewer-react`,
because `noodl-runtime/dist-types` is a build artefact (`npm run build:types`)
that does not exist in a fresh worktree. The same cause fails 5 of 79 jest
suites to *start*; the 74 that run are 1368 passing, 0 failing.

`nodegx-backend-contract` typechecks clean and its 127 tests pass. That package
was **not edited** — it is another worker's this batch — so those numbers are a
control rather than a result.

⚠️ **One pre-existing flake, named so nobody re-discovers it.** Across repeated
full runs, `test/nodes/completion-signals.test.ts` → *"NDA-004 §3: an async
script signals Success only after it resolves"* failed **once** in a full
parallel run and passed 3/3 in isolation. It is a timing assertion about a
microtask ordering, in a file this task did not touch, and it is load-sensitive.
Counted as 1367/1381 on that one run and 1368/1381 otherwise.

⚠️ **`packages/noodl-runtime`'s `npx jest` crashes in
`@jest/reporters/getResultHeader`** (`Cannot find module 'terminal-link'`) and
prints a meaningless "1 of 23 total" that looks exactly like a failing suite. All
numbers above were taken with a minimal custom reporter
(`--reporters=<path>` implementing `onTestResult`/`onRunComplete`). Note that
`--reporters` swallows a following positional argument, so a test path must be
given as `--testPathPattern=`.

---

## 6. Handover

For the node layer (Worker B / BCN-010):

- `new RestDataAdapter({ serializeObject, schemaFor })` — **pass both**. Without
  `serializeObject` the JSON-column and date normalisation RUN-003 fixed is gone
  (§3.7); without `schemaFor` a `pointsTo` filter cannot resolve its target.
- Gate ports on `descriptorFor(type).capabilities[key]`, the same table
  `begin()` reads. Where the two disagree today: `data.search` on PocketBase
  (§2.7) and the three `files.*` cells (§2.9).
- `objectId` may be a **number** (§2.5).
- `skip` must be a whole multiple of `limit` or a PocketBase query is refused
  (§2.2). Every `page * limit` control satisfies this.

For `wire.ts`'s owner: one rename suggested, no behaviour change (§2.3).
