# DEF-014 — A filter on a column nothing has written is a 500

**Found by phase 77's SBR-015 drive, 2026-08-29.** A query that filters on a property no row
has ever carried does not return zero rows. It returns **HTTP 500**, and every graph
downstream of it takes its `failure` path.

## 1. The person sentence

**Someone who has just made their first site can publish their first page.** Today they
cannot: the site-builder's Publish refuses every page on a brand-new site, and keeps
refusing until some unrelated record happens to create the column it needs.

## 2. The evidence

A site-builder project minted by the wizard, its own backend, claimed, two pages created
through the admin dialog, **no sections authored anywhere** — which is the state of every
site on the day it is made.

```
GET /classes/Section?where={"pageId":"baa851b3-…"}
→ 500 {"error":"no such column: \"pageId\" - should this be a string literal in single-quotes?"}
```

The `Section` table exists — the first query auto-created it — and holds exactly the four
system columns:

| table | columns | rows |
|---|---|---|
| `Section` | `objectId`, `createdAt`, `updatedAt`, `ACL` | **0** |

An empty class and a filter naming a property of it is not an error condition from the
caller's side. It is the ordinary shape of "nothing matches yet".

### 2.1 The control pair

One variable moved: whether `Section` has a `pageId` column. The column was created by
writing a Section row against a **different** page, so the page under test carried **zero**
sections in both arms. Same page, same user, same backend, same request body.

| `Section.pageId` | `POST /functions/publishPage {pageId, publish:true}` |
|---|---|
| absent | **400** `This page could not be published.` — 12 ms |
| present | **200** `{"pageId":"baa851b3-…","published":true}` — 24 ms |

The template's graph is not at fault in either arm. `publishPage` is *correct* to refuse a
query that errored; there is nothing sensible for it to do with a 500.

### 2.2 Why this bites the whole story, not one screen

The site-builder's first-run story is: claim the site, create a page, publish it. The third
step fails on every new site, every time, and keeps failing until a Section row exists
somewhere in the backend — which only happens if the owner authors a section on some page
first. Nothing in the product says so.

🔴 **And it is not specific to the site builder.** Any app that queries a class before its
first row is written meets this: a dashboard filtering `Order.status`, a list filtering
`Task.done`. The template is where it was found, not where it lives.

## 3. Scope

- `nodegx-backend` — the query path that translates a `where` clause into SQL. A filter on a
  column absent from the table should match **nothing**, not raise. The current behaviour is
  SQLite's `no such column` surfacing verbatim.
- 🔴 **Decide the boundary deliberately**: "column absent from a class that exists" is not the
  same case as "class absent entirely", and neither is the same as a genuine typo the author
  would want told about. A silent empty result for every misspelling is its own defect — the
  `_Schema` table is what separates a declared-but-unwritten property from a nonexistent one,
  and the answer probably lives there.
- Whether auto-created classes should be given their declared columns at creation, which would
  make the question moot for anything the schema knows about.

## 4. Acceptance criteria

1. **(person)** A project minted from the site-builder template, claimed, one page created,
   **no sections anywhere**: Publish succeeds. Driven end to end, not asserted from a unit.
2. A query filtering on an absent column returns `200` with `results: []` — with a **negative
   control** in the same spec: the same query against a column that *does* exist and *does*
   match still returns its rows. An always-empty implementation passes AC2 alone.
3. 🔴 **The typo case is decided and graded either way.** If a misspelled property is to be
   an error, a test says so and names the mechanism that tells it apart from an unwritten one.
   If it is to be empty, a test pins that choice so nobody re-derives it as a bug.
4. A mutant: reintroduce the raise and AC1's drive-equivalent spec reddens.

## 5. Traps

- 🔴 **Do not fix this in the template.** Wiring around a 500 in `publishPage` would make the
  site builder work and leave every other app broken — and would remove the only place the
  defect is currently visible.
- ⚠️ **The failure is invisible from the graph's side.** `DbCollection2` reports `failure`
  identically for a 403, a 500 and a network drop. A drive that only reads the node cannot
  tell which; issue the query directly with the session token and read the body.
- ⚠️ The class is created lazily by the first query, so a backend inspected *before* any
  publish shows **no `Section` table at all** and one inspected after shows an empty one.
  Both readings are of the same defect.

---

## 6. Built and measured — 2026-08-29 (s10)

**Fixed at the cause. The scope sentence held, one of §3's three bullets did not, and the fix is
wider than "a filter" because the same column reference sits in four other clauses.**

### 6.1 🔴 §3's second bullet has no mechanism behind it — `_Schema` cannot tell a typo from an unwritten property

§3 says the `_Schema` table *"is what separates a declared-but-unwritten property from a nonexistent
one, and the answer probably lives there."* Measured at HEAD, it does not, because **the state it
would separate does not exist in this backend.**

- A collection is created by its first use with **no user columns at all**
  (`LocalSQLAdapter._ensureTable` → `createTable({columns: []})`), and columns appear one at a time
  as writes arrive (`create`/`save` → `SchemaManager.addColumn`).
- `_Schema` is written **in the same call** as the `ALTER TABLE`. So a column is declared at the
  moment it exists and never before it. Queried on a table brought into being by a query and never
  written to, `_Schema` reports `{"name":"Section","columns":[]}` while the table carries the four
  system columns — it knows strictly **less** than the table does, and nothing at all about the
  properties the app is about to filter on.
- It can also know less in the other direction: `addColumn` swallows a duplicate-column `ALTER` and
  **skips its `_Schema` update**, so a column can exist, hold data, and be missing from the tracking
  table. A check that trusted `_Schema` would answer a *working* query with no rows — silently, and
  that is a worse defect than the one being fixed.

✅ **The instrument is `PRAGMA table_info`, read on the live connection at build time.** Both
readings are pinned as specs, including the second as a control that reddens if anybody swaps the
instrument back.

⚠️ **Which leaves §3's third bullet — give auto-created classes their declared columns — as the only
route to a real typo/unwritten distinction, and it is not this fix.** It needs the project's
`dbCollections` metadata to reach the backend, and today it does not: **every** `createAdapter` call
site in `nodegx-backend` (`service.ts:203`, three in `cli.ts`, and all of `tests/`) omits the
`collections` option, so `_collections` is `{}` in every running backend. `provisionBackend.ts`
creates collections per plan for the AI-authoring path only, and its own comment already calls that
step advisory *"because the backend creates a collection on first write anyway"*. **Registered as a
finding rather than done here — see §6.6.**

### 6.2 The boundary, decided and graded: absent ≡ present-and-never-filled

**A column the table does not have behaves exactly like a column it does have and no row has filled
in.** That is not a convenience — it is the only rule that keeps every operator consistent without a
second set of semantics for absence, and it is stated as an **equivalence** so that the specs assert
something an always-empty implementation cannot fake.

Mechanically it is one substitution: `columnRef()` emits the SQL literal `NULL` in place of the
column reference. Every operator then falls out with the same answer an all-NULL column already
gives — `= ?`, `!= ?`, `IN`, `NOT IN`, `>`, `LIKE` and `REGEXP` all evaluate to NULL and match
nothing; `IS NULL` (`$exists: false`) matches **every** row; `IS NOT NULL` matches none.

Measured before the change, an absent column raised on all 17 operator shapes and an all-NULL column
answered 0/0/0/0/0/**1**/0…; after it, the two arms agree term for term. The `$exists: false` arm is
what makes the equivalence non-vacuous, and it is the arm the lazy fix fails.

### 6.3 The fix is one seam, and it was in five clauses rather than one

`QueryBuilder.columnRef(name, scope, tableAlias)` — with `ColumnScope` supplied by
`LocalSQLAdapter._columnScope()`. Threaded through `buildWhereClause`, `buildOrderClause`,
`buildSelect` (the `select` list), `buildCount`, `buildDistinct`, `buildAggregate`,
`buildSearchSelect`, `buildSearchCount`; supplied by `query`, `count`, `search`, `aggregate`,
`distinct`.

🔴 **The task's scope sentence said "a filter", and a filter was not the only place it bit.**
Measured on the same fixture, before the fix: `sort` on an unwritten property raised, `select` on one
raised, `count` on one raised. A list page ordering by a property no row carries yet failed exactly
the way the publish query did. Fixing only `where` would have left a person one screen away from the
same 500.

✅ **Read fresh per query, never cached — and the cost was measured before that was decided.**
`PRAGMA table_info` on the live connection is **11.4 µs**, against **402 µs** for a 200-row query on
the same fixture: **2.8%**. A cache would have to be invalidated by every `addColumn`, and a stale
one would call a real column absent and answer a working query with no rows — the same silent-wrong
failure §6.1 rejects `_Schema` for. 3% is the price of not having that failure mode at all.

⚠️ **Writes are deliberately untouched.** `buildInsert`/`buildUpdate`/`buildIncrement` still name
columns directly, because a write is what *creates* the column — substituting there would silently
drop data.

### 6.4 The typo case (AC3), decided and not decided silently

**A misspelled property reads as empty, and says so once in the backend log.** Nothing in this
backend can tell it from an unwritten one (§6.1), so a check that claimed to would be inventing a
distinction it cannot make. The result is correct either way; what the log carries is the case that
is *not* correct — `LocalSQLAdapter: collection "Section" has no column "titel" — no record has ever
carried that property, so it is read as empty. If the name is a typo, nothing else will say so.`

Reported once per collection+column per adapter, so a hot query does not flood the log. Pinned by a
spec that asserts it fires **once** for the absent column and **not at all** for a real one.

⚠️ **This moves a diagnostic from the browser console to the backend log**, and that is a real cost,
stated rather than hidden: before, a query against an unwritten property surfaced in the app as
`query-records/query-failed`. It now surfaces nowhere the app can see. §5's own trap says the graph
cannot tell a 403 from a 500 from a drop anyway — but the honest summary is that the signal moved,
it did not multiply.

### 6.5 What was run

| | |
|---|---|
| `noodl-runtime` (full jest) | **2594 passed, 13 skipped, 145 suites** — 114 pre-existing adapter specs unchanged, **30 new** |
| `nodegx-backend` (full jest) | **117/117 suites, 1384 passed, 10 skipped** |
| `tsc --noEmit` both packages | clean |
| **Mutant 1** — reintroduce the raise (`columnRef` never substitutes) | **25 failures** in `noodl-runtime`; **2** in the HTTP spec, both naming `no such column` |
| **Mutant 2** — the lazy fix (short-circuit an absent-column query to empty) | **7 failures**, and they are the arms built for it: `$exists false`, `$eq null`, the two mixed `$or`/`$and`, sort, select, and the non-vacuity check |

New specs:
- `packages/noodl-runtime/test/adapters/LocalSQLAdapter.absentColumn.test.js` — the equivalence,
  operator by operator; three negative controls; the two `_Schema` readings; the ephemeral-mock
  control.
- `packages/nodegx-backend/tests/def014-day-one-query.test.ts` — AC1's drive-equivalent: a real
  service on a real database, **the exact request the drive issued**
  (`GET /classes/Section?where={"pageId":…}`), now `200` with `results: []`, with the record-level
  control pair beside it.

✅ **A control that mattered: ephemeral (in-memory mock) mode.** There is no PRAGMA to read there,
and `_columnScope` must answer **unknown** rather than "no columns" — the latter would empty every
query in that mode. Verified as a reading (`undefined`) *and* as behaviour (a query on a real column
still returns its row), because the failure it guards against is silent.

### 6.6 🔴 Three things this found that the row did not say

- 🔴 **The product had already paid for this defect twice at call sites and once in a comment, and
  never at the cause.** `service.ts::ensureSystemTables` pre-creates `_User` and `_Session` *with
  their columns*, and its docstring gives the reason verbatim: *"pre-created so the session endpoints
  can query them before any row exists (a `where` on a column of a not-yet-created table is a SQL
  error, not an empty result)"* — the backend worked around this for its own classes and nothing did
  it for a user's. And `DataBrowser.tsx:252` carries POL-014's fix for the same shape: search said
  `id`, *"which the adapter turns into `"id" LIKE ?` against a table that has no such column — so
  every search failed at the database"*. **§2.2's claim that this is not specific to the site builder
  is now three independent sightings, two of them fixed at the caller.**
- 🔴 **A phase 77 spec pinned this defect as correct behaviour, and I moved it.**
  `nodegx-backend/tests/sb015-first-local-run.test.ts` asserted the unclaimed arm's page query
  **fails** (`query-records/query-failed`) rather than coming back empty — true when written, and it
  was the evidence for SB-015 §6.4a's screen fix. With the cause fixed the arm now reports **zero**
  browser errors and the screen still names the state, so the assertion is inverted in place with
  the old text kept above it. **The screen's sentence never depended on the error**, which is the
  stronger version of their fix. Owner of the red is whoever moved the measured thing; recorded here
  and flagged to phase 77.
- 🔴 **Nothing gives an auto-created class the columns its project has already declared** (§6.1's
  last paragraph). That is §3's third bullet, it is unowned, and it is the only route to a real
  typo/unwritten distinction. It is also the fix that would make a *misspelling* answerable rather
  than merely reported. **Owner: `NONE`.**

## 7. Acceptance criteria — status

| AC | status |
|---|---|
| 1. (person) a new site publishes its first page | 🟡 **drive-equivalent green, the drive itself owed.** The exact failing request now answers `200 []` against a real service over HTTP. What is **not** yet observed is the site-builder's own `POST /functions/publishPage` returning 200 on a wizard-minted, claimed project with no sections — the control pair §2.1 measured. |
| 2. absent column → `200` + `results: []`, with a negative control | ✅ both, at the adapter and over HTTP |
| 3. the typo case decided and graded | ✅ decided as **empty + reported**, with the reason it cannot be decided any other way measured rather than asserted (§6.1) |
| 4. a mutant reintroducing the raise reddens the drive-equivalent spec | ✅ 2 failures in the HTTP spec, 25 in the adapter specs — **plus a second mutant for the always-empty implementation the row warned about** |
