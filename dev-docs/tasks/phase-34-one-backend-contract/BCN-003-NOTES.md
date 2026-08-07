# BCN-003 — Notes

**One translator per backend, and the eleven operators that were quietly
returning everything.**

Read alongside [BCN-003-FILTER-DIALECT.md](./BCN-003-FILTER-DIALECT.md), whose
premises §1 corrects, and [BCN-003b](./BCN-003b-ONE-FILTER-BUILDER.md), which is
the half Richard split out.

---

## 1. Premises that were wrong

Four, and two of them came from the handover into this task rather than from the
spec. Recorded so nobody re-derives them.

### 1.1 ⚠️ The two `toDirectusFilter` copies had **not** materially diverged *(handover)*

The handover called this "the biggest correction" and said it inverted the
spec's own trap:

> *the editor converter **unwraps a single non-group condition** and emits it
> bare; the runtime converter always wraps in `_and`. The same saved filter
> therefore produces two different Directus payloads depending on which side
> builds it. That is the RUN-003 two-copies bug, present right now and
> undiagnosed.*

**It is not.** Both copies unwrap a single surviving child — the runtime at
[`byob-query-data.ts:745`](../../../packages/noodl-runtime/src/nodes/std-library/data/byob-query-data.ts),
and its own unit test was *named* `unwraps a single condition and keeps OR
groups`. The handover also described the runtime copy as "not exported"; it was
exported on the node module, for that test.

The one real divergence was narrower and in the other direction: the runtime
skipped a condition whose `operator` was missing, while the editor emitted
`{field: {undefined: value}}` — a document Directus rejects. Neither produces
two different payloads for the same saved filter.

The spec's original trap ("they were made identical deliberately") was closer to
right than the correction. **The argument for one copy is the RUN-003 precedent,
not a defect sitting in the tree** — and it still holds, because a second copy is
a second place for the next relation-path bug to live.

### 1.2 `dbcollectionnode2.ts`'s leaked type was the wrong type, not just a misplaced one *(handover)*

BCN-002 recorded the `WhereClause` import from the server-side persistence types
and predicted *"the type it wants is the contract's `Filter`"*. Reading it here:
`getStorageFilter` returns the output of `convertVisualFilter`/`convertFilterOp`,
which is already **translated** — a Parse `where` document on its way to
`CloudStore.query`. The type is `ParseWhere`. The leak was a wrong type as well
as a misplaced one.

### 1.3 `$options` was already handled correctly *(handover)*

The handover flagged `QueryBuilder.ts:371` as *"treats `$options` as a standalone
operator with the same `LIKE`"*. It did not — the branch read
`case '$options': // This is used with $regex, ignore here; return null;`. It is
handled differently now (read from the sibling key by `$regex`) but it was not
broken.

### 1.4 The spec's Current State table, on `toDirectusFilter`'s location *(known)*

Already corrected in the handover: it is not in `byob-utils.ts`. Both copies are
now gone.

---

## 2. The defect the task exists for, found in our own code

`convertFilterOp` — the function every Filter Records node's `filter` input goes
through — **had no branch for eleven of the operators the vocabulary defines**:
`contains`, `notContains`, `containsIgnoreCase`, `startsWith`, `notStartsWith`,
`startsWithIgnoreCase`, `endsWith`, `notEndsWith`, `endsWithIgnoreCase`,
`between`, `notBetween`.

It walked an if/else chain, fell off the end, left `res[key]` unset and returned
`{}`. So `{name: {contains: 'Ada'}}` did not narrow anything: **the query
succeeded and returned every record in the collection**, with no error and
nothing in the app to see. Meanwhile the `parse` descriptor had claimed since
BCN-001 that each of these was "lowered to `$regex`".

That is the exact failure the spec names as the worst outcome available in this
task — *"silently dropping an unexpressible operator returns more rows, not
fewer"* — and it was in the shipping code, not a hypothetical.

Three more widenings closed with it:

| What | Effect |
|---|---|
| A leaf with two operators took the first | `{price: {greaterThan: 1, lessThan: 5}}` asked for `price > 1` |
| `pointsTo` with no cached schema emitted `className: undefined` | Backend answers with an empty result set, no error |
| Values were unescaped before becoming regexes | `contains 'a.b'` also matched `axb`; `contains 'C++'` was a pattern the backend rejected |

---

## 3. The design decision worth arguing with

**The spec asks each translator to declare which operators it can express. The
declaration stays in the descriptor instead, and the translator reads it.**

The descriptor already declares exactly that, once per backend, in a sentence
written for the user, and BCN-010 greys the port out using the same cell. Two
declarations of one fact drift — and this phase has already paid for that.

Consequences, which are the point:

- The message thrown at runtime is *character-for-character* the sentence the
  editor shows under the greyed-out port. It cannot be otherwise.
- `custom` works with no extra machinery. The user fills in a capability table
  in the Backend Services panel and the gate reads theirs.
- `translators.test.ts` walks **every backend × every operator** and fails if a
  cell says `supported` while the translator produces no condition — the only
  test shape that can catch the §2 defect class.

### What it costs, measured rather than estimated

The gate needs the descriptors, so they enter the viewer bundle. BCN-002
deliberately kept the contract to `import type` only so this decision would be
taken on purpose.

Bundling `noodl-runtime`'s entry with esbuild, minified and gzipped:
**103,668 → 115,883 bytes, +12.2 KB (+11.8%)**. About 8 KB is the descriptors,
the rest the five dialects. An earlier draft of the code comment guessed 8 KB
for the whole thing, which was wrong in the flattering direction.

---

## 4. The two built-in-backend defects, and why geo turned out to be worth it

Both were BCN-001's findings, left unowned; Richard assigned both here on
2026-07-31 and asked first whether geo was worth the performance claim it would
make us own — *"a distance function in SQL with no spatial index is a
performance claim we would then own"*.

**What changed the answer: `node:sqlite` exposes `db.function()`.** SQLite can
call back into JavaScript, so neither fix is an approximation:

| Defect | Before | After |
|---|---|---|
| `matchesRegex` | `LIKE '%value%'` — `^Ada$` searched for that literal text | `nodegx_regexp()`, the same `RegExp` engine the user's browser runs |
| `$nearSphere` / `$within` / `$geoWithin` | Warned to the console and returned `null`, so the condition never reached the `WHERE` clause and "within 5 km" returned **every record** | Haversine, coordinate ranges, and ray casting |

Driven against a real database: `^Ada$` returns `Ada` and not `Adam`; 250 km of
London returns London and Bristol; 100 miles returns London alone (Bristol is
171 km).

What we own is one sentence, and the descriptor now says it: there is no spatial
index, so these scan. `nearSphere` is `degraded` rather than `supported` for a
second reason — Parse reads a bare `$nearSphere` as a proximity *sort*, and
sorting is explicitly out of BCN-003's scope.

An unknown operator reaching the SQL translator now **throws** instead of being
dropped with a warning.

### ⚠️ The find only running every package's suite could produce

`nodegx-backend` keeps a **JS twin** of the SQL `WHERE` clause, for deciding
whether a changed record matches a realtime subscription's filter, with a
property test asserting the two never disagree across a generated matrix.

Fixing the SQL side broke it **on the first generated case**. Both sides had
agreed that `DA` matched `Date` (both were case-insensitive `LIKE`), and both
had agreed that a geo filter constrained nothing — agreeing, and both wrong: a
"within 5 km" subscription received every change in the collection.

The twin now *shares* the implementation rather than mirroring it a second time,
and `assertFilterSupported` refuses an unknown operator at subscribe time rather
than at whichever delivery fails first.

There is a **third** twin: `queryutils.ts::matchesQuery`, which decides whether a
locally created record belongs in a Query Records node's results. It evaluated
one operator per field, which was survivable until `between` started lowering to
`{$gte, $lte}` on one field. Fixed, along with the two defects PLAT-003 recorded
and left verbatim (`$lte` compared against `$lt`; `$nin` read `$in`) — both sit
on that same path — and `{$exists: false}`, which was read as its own negation,
so "has no email" matched exactly the records that had one.

---

## 5. The live equivalence pass

**The deliverable.** 106 checks across five real backends, from one corpus, driving
the translators that ship.

[`bcn-003-equivalence-driver.ts`](../phase-16-runtime-deploy-health/uba-e2e/bcn-003-equivalence-driver.ts),
recorded run in
[`BCN-003-EQUIVALENCE-OUTPUT.txt`](../phase-16-runtime-deploy-health/uba-e2e/BCN-003-EQUIVALENCE-OUTPUT.txt).

### What it asserts, which is not "they all agree"

They do not all agree, and a run demanding that would be measuring the world
rather than our claims about it.

> **A backend whose capability cell says `supported` returns exactly the expected
> rows. A backend that returns anything else has a cell that already said so.**

A `degraded` cell buys a divergence; nothing else does. **All eight divergences
in the recorded run were `supported` cells before it.** The pass is what turned
them into `degraded` ones with a sentence attached — the capability model doing
the job it exists for.

Result: **106 checks, 0 failures, 8 declared divergences, 4 refusals before
anything reached the wire.**

### Four translator defects no unit test could see

1. ⚠️ **PostgREST 12.2 does not strip quotes at the top level.**
   `?city=eq."London"` matches nothing — the quotes join the value. The draft
   quoted anything carrying a reserved character, so the injection-case filter
   returned **zero rows** from PostgREST and the right row from the other four.
   Quoting *is* honoured inside `or=(…)`, where a bare comma is a PGRST100 parse
   error. **The two positions need opposite encodings.**
2. ⚠️ **Parse `$exists` tests key presence, not null-ness.** A record whose `bio`
   was explicitly null satisfied "is set" and was missed by "is not set".
   `$ne: null` / `$eq: null` asks the question the user means — and compiles to
   the identical SQL on our own backend, so it is a no-op there and a fix
   upstream.
3. **Directus and PocketBase honour no `LIKE` escape.** `%` and `_` in the user's
   text are wildcards; a backslash is matched literally. Postgres *does* honour
   it, so PostgREST escapes and the other two declare `degraded`.
4. **Escaping was measurably worse than not escaping** on those two: it returns
   *nothing* rather than a superset, and `_` is common in real text (`user_id`),
   so it would break ordinary searches completely. Against this task's usual
   rule, and deliberately: that rule exists to stop a condition being *dropped*,
   and this is not that — the condition is applied, slightly broader than asked.

### Four wrong descriptor cells, all written from documentation

| Cell | Was | Is | Why |
|---|---|---|---|
| `directus.matchesRegex` | supported | **unsupported** | Directus 11 answers `_regex` on a string column with a 400 in its own words |
| `directus`/`pocketbase` string family (9 each) | supported | **degraded** | wildcards, and case-insensitive whatever the operator says |
| `directus.isEmpty`/`isNotEmpty` | supported | **degraded** | `_empty` matches a NULL too |
| `pocketbase.exists`/`isEmpty`/`isNotEmpty` | supported | **degraded** | PocketBase has no NULL for a text field |

Plus one corrected without a probe, on this package's own rule #1 — *probe the
exact thing*: **Supabase's three geo cells** were `conditional` on a
`/rpc/postgis_version` check. Whether PostGIS is installed is a real question but
not *the* question: PostgREST's filter grammar has no geo operator either way, so
the probe would have reported `supported` on an instance where the filter still
could not be written. Now `unsupported`.

---

## 6. The migration

BYOB stored Directus's own operator names (`_eq`) verbatim in project data. That
is what made every saved BYOB filter a Directus filter regardless of which
backend the node pointed at.

Applied in **both** places that read a saved filter — the editor on load, and the
runtime, because a deployed app never opens the editor. `needsOperatorMigration`
keeps it idempotent, so opening a project does not rewrite filters nobody
touched.

The one operator where the two models genuinely disagree is presence: Directus
splits it into the nullary `_null`/`_nnull`, the contract has one boolean-valued
`exists`. The dropdown keeps two rows ("is set" / "is not set") by identifying a
row by its own key rather than by its operator.

**The acceptance criterion, pinned by a test in two packages:** a filter saved by
the old builder — nested groups, a relation path, a nullary operator and a range
— migrated and re-translated, produces *exactly* the Directus payload the old
converter produced. "Migrate rather than break" is only true if that holds.

---

## 7. Evidence

| Claim | How it is evidenced |
|---|---|
| One translator per backend | Both `toDirectusFilter` copies deleted; `convertFilterOp` and `convertVisualFilter` are wrappers. A grep for a second implementation returns nothing |
| No operator is dropped | The sweep: every backend × every operator, asserting a `supported` cell produces a real condition |
| Filters agree across backends | 106 live checks, 0 failures |
| The descriptor tells the truth | 8 divergences, each printed with the `degraded` reason that predicted it |
| The migration preserves behaviour | Old-builder filter → identical Directus payload, in `@noodl/backend-contract` and in the editor's Jasmine spec |
| PocketBase cannot be injected | The expression carries only placeholders; a value with `"` and `&&` binds and round-trips live |

| Package | Result |
|---|---|
| `@noodl/backend-contract` | 89 passed |
| `@noodl/runtime` | 1271 passed, 13 skipped |
| `@noodl/nodegx-backend` | 729 passed, 10 skipped |
| `@noodl/noodl-viewer-react` | 367 passed |
| `@noodl/cloud-runtime` | 57 passed |
| `@noodl/noodl-core-ui` / `@noodl/preview` | 44 / 14 passed |

---

## 8. What this task did *not* establish

Stated plainly, because a live pass that overclaims is worse than none.

- **The filter builder has not been driven in the real editor.** The migration,
  the neutral vocabulary and the two presence rows are covered by unit tests and
  by the editor's Jasmine spec, but nobody has opened the Backend Services panel,
  built a filter with the mouse and watched the request go out. That is
  **BCN-003b's** live QA, and it is owed.
- **BYOB still speaks Directus to every backend type.** `toDirectusFilter` is
  used unconditionally by the Query Data node because that node builds a
  Directus-shaped URL and Directus-shaped parameters whatever the backend says
  it is. `toPostgrest` and `toPocketBaseFilter` are proven by the equivalence
  driver, not by a node. **BCN-004** is what makes them reachable from a graph.
- **Relations are translated but not exercised.** The dotted-path nesting that
  caused RUN-003's 403 is pinned by a unit test and the PostgREST embed list is
  produced, but the corpus has no relation in it. **BCN-005** owns that.
- **`custom`'s declared dialect has no UI.** `toCustomFilter` accepts one of five
  syntaxes plus a flat `params` floor, and the Backend Services panel cannot yet
  say which. BCN-009's form.

---

## 9. Carried forward

| Item | Owner |
|---|---|
| One filter builder; fold `QueryPointerRule` in; live QA in the editor | **BCN-003b** |
| Make `toPostgrest` / `toPocketBaseFilter` reachable from a node — the request envelope, not the filter | BCN-004 |
| A relation in the equivalence corpus | BCN-005 |
| A dialect picker for a `custom` backend | BCN-009 |
| Proximity *sorting* for `nearSphere` on the built-in backend — the filter works, the ordering is not implemented | — |
| `CloudStore._handle()` still answers `nodegx` unconditionally, so the capability gate is reading a floor rather than the truth | BCN-009 |
