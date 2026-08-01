# BCN-005 — relations across five backends, and the six things a live request had to teach it

Relations behind `IDataAdapter` for Directus, Supabase (PostgREST), PocketBase and the
Parse family. Built 2026-07-31/08-01 against the live
[uba-e2e rig](../phase-16-runtime-deploy-health/uba-e2e/).

| | |
|---|---|
| Neutral model | [`packages/nodegx-backend-contract/src/relations.ts`](../../../packages/nodegx-backend-contract/src/relations.ts) |
| Adapter | [`packages/noodl-runtime/src/api/backends/RestDataAdapter.ts`](../../../packages/noodl-runtime/src/api/backends/RestDataAdapter.ts) |
| Wire probe (written **first**) | `uba-e2e/bcn-005-relation-probe.mjs` + `-probe2.mjs`; output in `BCN-005-RELATION-PROBE-OUTPUT.txt` |
| Live driver | `uba-e2e/bcn-005-relation-driver.ts`; output in `BCN-005-RELATION-DRIVER-OUTPUT.txt` |
| Live result | **55 checks, 55 passing, 0 failing**, across Directus, PostgREST, PocketBase and Parse |
| Mutation tests | **7 run, 7 discriminate.** ⚠️ Two of them passed 50/50 first time — see [§4](#4-the-live-pass-and-the-two-checks-that-proved-nothing) |
| Contract suite | **169 passing** (was 146; +23) |
| Runtime suite | **86/87 suites, 1605/1618 tests, 0 failures** (was 1580/1593; +25). One suite env-gated, 13 tests skipped |
| `tsc --noEmit` | `nodegx-backend-contract` **0**; `noodl-runtime` **7, all pre-existing** (the `@noodl/runtime` dist-types artefact) |
| `catalog:check` | clean — 156 node types, committed catalog up to date |

---

## 1. Stale premises found

Seven across the phase before this task; here are five more. Every one was found by a
request, not by reading.

### 1.1 ⚠️ "PocketBase's multi-valued relation fields are arrays on the record itself, so
'add a relation' is a read-modify-write with a lost-update window"

The spec's fourth trap, and it asks for that window to be declared as a capability caveat.
**There is no window.** PocketBase 0.30.0 has server-side field operators:

```
PATCH {"tags+": "ew2s8l95kudwcb6"}   -> 200, tags ["ew2s8l95kudwcb6"]
PATCH {"tags+": "zsfhmskv8ilycxq"}   -> 200, tags ["ew2s8l95kudwcb6","zsfhmskv8ilycxq"]
PATCH {"tags+": "ew2s8l95kudwcb6"}   -> 200, tags ["ew2s8l95kudwcb6","zsfhmskv8ilycxq"]   <- already there, no-op
PATCH {"tags-": "ew2s8l95kudwcb6"}   -> 200, tags ["zsfhmskv8ilycxq"]
```

One request, applied server-side, and **set-shaped**: appending a member already present
leaves the list alone. That is exactly what a Parse `Relation` does, so PocketBase is the
one REST backend whose `relations.addRemove` cell is plain `supported`. A unit test asserts
the adapter makes *one* request, so a future read-modify-write "fix" fails.

⚠️ What *is* worth knowing, and what the cell now says instead: on a `maxSelect: 1`
relation, `+` **replaces** the current value rather than refusing, and `-` clears the field
to `""` **whether or not the id given is the one that was set**. So `removeRelation` with
the wrong target id still clears the relation, with a 200.

### 1.2 ⚠️ "Supabase embeds require the relation to be selected before it can be filtered
on … it errors or, worse, ignores"

The spec's third trap hedges. Measured, it is **both**, and which one depends on something
the trap does not mention:

```
select=id,title&bcn005_authors.city=eq.London                    -> 400 PGRST108
                                                                    "'bcn005_authors' is not an embedded resource"
select=id,title,bcn005_authors(*)&bcn005_authors.city=eq.London  -> 200, BOTH parents,
                                                                    the embed null on the one that does not match
select=id,title,bcn005_authors!inner(*)&…                        -> 200, the one parent
```

So: **no embed at all is a loud 400**, and **a plain embed is the silent one** — a filter
that does not filter, returning every parent row with a `null` where the related record
should be. BCN-003's translator already reports `embeds` and BCN-004's adapter already
emits `!inner` from them, so this was right before this task started; it is recorded because
the trap describes the dangerous case as the one that errors, and it is the other one.

### 1.3 ⚠️ Relation metadata is **admin-only on every backend**, so the spec's step 1
cannot happen where the spec implies

*"`GET /relations` (and each backend's equivalent) is read at schema sync"* — right, and
the emphasis has to be on **schema sync**. Measured without credentials:

```
GET /relations              (Directus)   -> 403
GET /fields/bcn005_articles (Directus)   -> 403
GET /api/collections        (PocketBase) -> 401
```

A running app holds an end user's session token or a project's public token, never an admin
key — BCN-009's whole security disclosure is about keeping the privileged one out of a
published project. So the runtime **cannot discover a relation**, and the adapter takes a
`relationsFor` hook instead. The consequence is the shape of the refusal in §2.3.

### 1.4 ⚠️ `parsePocketbaseSchema` recovers **no fields at all** from PocketBase 0.23+

`packages/noodl-editor/src/editor/src/models/BackendServices/schemaParsers.ts` reads
`col.schema`. PocketBase renamed that to `fields` in 0.23, and the rig runs 0.30.0:

```
does the collection carry `schema` (the parser reads this)? -> false
does it carry `fields`?                                     -> true
```

So the editor's PocketBase schema parser produces collections with **zero fields** against
any currently-supported PocketBase. Not only relations — every port, every filter field.
This is **unowned and not fixed here**: `packages/noodl-editor/` is another worker's
territory this batch. `pocketBaseFields()` in `relations.ts` reads both spellings and has a
test naming the rename, so the editor-side fix is a one-line call.

A second PocketBase fact the parser would need either way: a relation field names its
target by **collection id** (`collectionId: "pbc_1390417582"`), never by name, so resolving
`relationTarget` requires the whole collection list.

### 1.5 The Current State table's "PocketBase relations: parser exists, never exercised"
undersells it

It says the parser exists. It does (§1.4 is what it does). What "never exercised" hides is
that **no live check had ever read a related record back on any REST backend** —
BCN-004-NOTES-TRANSPORT §3.4 says so plainly and it was the right thing to open this task
with. Everything in §2 below is downstream of taking that seriously.

---

## 2. Deviations, with reasoning

### 2.1 ⚠️ Directus's M2M `include` is **two hops**, and one hop returns junction rows with a 200

The single most valuable thing this task measured. RUN-003's `fields=*,{relation}.*` rule is
correct for a many-to-one and **wrong for a many-to-many**, in the plausible-wrong-value
direction:

```
fields=*,tags.*         -> "tags": [{"id":4,"article_id":1,"tag_id":1}]
fields=*,tags.tag_id.*  -> "tags": [{"tag_id":{"id":1,"label":"algebra"}}]
```

Both 200. A repeater bound to `tags` would render one item per tag, each carrying two
integers and no label, and nothing anywhere would report a problem.

So `RelationDescriptor` carries a `readPath` and a `readUnwrapKey`, the adapter asks for the
two-hop path, and it **flattens the junction wrapper back out** so a node receives
`[{id, label}]` — the same shape every other backend gives. The contract option is one
(`include: ['tags']`); the wire divergence stays inside the adapter, which is the point of
the phase.

The same fact broke the **filter**, and that one came out of the first live run rather than
the probe:

```
filter={"tags":{"label":{"_eq":"algebra"}}}          -> 403 You don't have permission to
                                                        access field "label" in collection
                                                        "bcn005_articles_tags"
filter={"tags":{"tag_id":{"label":{"_eq":"algebra"}}}} -> the row
```

⚠️ **That 403 is the same status a genuine permission failure gives**, which is precisely
the RUN-003 defect one level along. `FilterFieldSchema` gained a `path`, the Directus
dialect expands the relation prefix with it, and the adapter merges `readPath` into the
schema it hands the translator — so the include path and the filter path are **one recorded
fact**, not two places to get it wrong.

### 2.2 ⚠️ PostgREST can only see a junction whose **primary key is the pair**

Measured on the identical two tables with the identical two foreign keys, one setting apart:

| Junction primary key | `select=*,bcn005_tags(*)` |
|---|---|
| `id SERIAL PRIMARY KEY` | **400 `PGRST200`** — "Searched for a foreign key relationship … no matches were found" |
| `PRIMARY KEY (article_id, tag_id)` | **200**, the tags nested |

There is no request that recovers the relation in the first case. So
`relationsFromPostgrestSpec` **does not emit** a junction that fails the test — emitting one
would create a port whose every use is a 400 — and falls back to describing the junction's
two ordinary many-to-ones, which do work. The `supabase` descriptor's `relations.addRemove`
cell is `degraded` and says this in the user's own words.

The same primary key is what makes the add idempotent:

```
POST the same pair twice                                 -> 201, then 409 23505
POST with Prefer: resolution=merge-duplicates            -> 200
```

so `RelationWrite` carries `idempotent`, and PostgREST's add is **one request**.

### 2.3 Two refusals stayed, and the more important one is new

BCN-004 shipped `addRelation`/`removeRelation` as blanket refusals carrying the descriptor's
sentence. Constraint 3 of this task says a refusal may only be replaced where the wire has
been measured. Three write shapes were measured and implemented; **two refusals remain**:

- **`custom`** — no profile, no relation model. `begin()` refuses first, as before.
- ⚠️ **A relation the synced schema does not describe.** This is the new one and it is not
  a gap. Because of §1.3 the runtime cannot look a relation up, so the alternative to
  refusing is *guessing a junction table's name and writing to it*. The refusal names the
  field, the collection and the fix:

  > NodeGX does not know how "tags" relates bcn005_articles to "bcn005_tags" on this
  > directus backend. Refresh the backend schema in the Backend Services panel — relation
  > details are only readable with admin credentials, so they are read when you connect and
  > not while the app runs.

  Mutation M7 replaced it with a guessed junction and the live pass answered
  `relation "public.bcn005_articles_no_such_relation" does not exist` on PostgREST and
  `Missing collection context.` on PocketBase — two error messages a user could do nothing
  with, from a request that should never have been sent.

### 2.4 Directus's add reads before it writes, and that is set semantics bought with a race

A Directus junction has a surrogate `id` and no unique constraint on the pair, so `POST`ing
the same pair twice stores it twice — and the relation then holds one member while the
collection holds two rows, which nothing in the app can see until a count is wrong. Parse's
`Relation` is a **set** and the contract's shape is Parse's, so `addRelation` looks for the
pair first and succeeds without writing when it is already there. Two devices adding the
same pair simultaneously can still both miss; the `directus` cell says so, in the same
register `data.increment` already uses there.

`removeRelation` deletes **every** row for the pair, not the first one, for the same reason:
a remove that left a second copy behind would report success with the relation still in
place.

### 2.5 ⚠️ PocketBase does not nest the related record onto the field — it is hoisted

Found by the first live run, and it is the reason Desired State 2 is worth having as a
sentence. `?expand=author` leaves `author` holding the 15-character id and puts the record
under a **sibling `expand` object**:

```
{"author":"nqebu62mpoq959g","expand":{"author":{"city":"London",…}}}
```

Directus and PostgREST both give the record on the field. The adapter hoists
`expand[field]` onto `record[field]`, leaves `expand` in place (it is stripped on write by
`SERVER_OWNED_FIELDS`, and anything already reading it keeps working), and the contract's
one `include` option now means one thing on all three.

### 2.6 ⚠️ A PocketBase filter across a to-many relation needs `?=`, or it returns nothing

```
tags.label='algebra'   -> []                            <- 200, empty, no warning
tags.label?='algebra'  -> [{"title":"Notes on the …"}]
```

The plain form means *every* related record matches. On a record with two tags a filter for
one of them therefore matches nothing — a silent empty result set, which is the failure
class this phase exists to remove.

`toPocketBaseFilter` emitted the plain form for every operator. It now emits the `?`-prefixed
form when the path's first segment is a to-many relation, for **all** of them
(`?=`, `?!=`, `?~`, `?>=`, …), and `FilterFieldSchema` gained `cardinality` to carry the
fact. `type` alone cannot decide it: PocketBase calls both cardinalities `relation`.

Cardinality reaches the translator from **two** sources — `filterSchemaFor` maps the cached
schema's `relationType`, and the adapter merges the relation descriptors over the top. The
second is what makes the live pass meaningful: it constructs the adapter with **no
`schemaFor` at all**, so what it exercises is the product path rather than a schema the
driver helpfully filled in.

### 2.7 The `targetClass` rename: **`targetCollection` wins, `targetClass` stays as an alias**

The register item, decided both ways on purpose.

- **The neutral name wins**, because half a name is worse than either whole one. The source
  side of `RelationOptions` is already `collection`, not `className` — so today the same
  concept is spelled two ways in one options object, one line apart. Both relation nodes,
  `records.js` and `ParseWireAdapter` now pass and read `targetCollection`.
- **The alias stays**, because the field is not only ours. `Noodl.Records.addRelation`
  exposes `targetClassName` on the **public scripting API** and maps it here; a user's
  Function node calling it is not a call site anyone can grep. Both spellings are read
  through one exported `relationTarget()` helper, so precedence is written down once, and
  the live pass asserts **both** reach the same Parse wire.

Removing the alias is a separate, announceable change. It is not this task's to make
silently.

### 2.8 One hop stays the limit — recorded as a decision

Success criterion 7 asks for this in writing rather than by omission. RUN-003 chose one hop;
this task keeps it, and the Directus M2M is the argument *for* rather than against: its
`tags.tag_id.*` is physically two segments and is still **one relation hop** — the junction
is plumbing, not a hop a user chose. Depth-2 would multiply the port surface and the query
cost with no demonstrated demand, and `expandRelationFields` already declines to expand a
target field that is itself a relation.

### 2.9 `relatedTo` stays `unsupported` on the three REST backends, with a **new** reason

The old reasons said "not available yet … BCN-005 owns this". That is now wrong in a way
worth correcting: filtering *across* a relation is measured working on all three. What has
no spelling anywhere but Parse is `$relatedTo`'s actual question — *"the members of this one
record's relation set"*. The cells now say so and point at the dotted-path filter as the
replacement, which is a sentence a user can act on rather than a promise.

---

## 3. ⚠️ Could not verify

Every claim shipping without a real request behind it.

1. **Hosted Supabase.** Everything labelled "Supabase" is **PostgREST 12.2.3**. Not
   exercised: the `apikey`/JWT pair, RLS interaction with an embed (RLS on the *target* of a
   join is exactly where an embed can silently return fewer rows), or Supabase's own junction
   conventions. *Settled by:* a live pass against a free Supabase project.
2. **The Directus one-to-many `include`.** The **write** direction is verified (§4, the
   `on: 'target'` check). The **read** is not: `?fields=*,articles.*` on the authors side
   answers **403 "You don't have permission to access field \"articles\" … or it does not
   exist"**, because Directus recorded `meta.one_field: 'articles'` in `/relations` without
   creating the alias *field*. So `relationsFromDirectus` emits a reverse descriptor that
   `/relations` describes and that this instance cannot read — and the 403 is
   indistinguishable from a permission failure. Whether a Directus project built through the
   admin UI (which does create the alias) reads it is untested. *Settled by:* seeding through
   the admin UI, or by `POST /fields` for the alias explicitly.
3. **PocketBase back-relations (`bcn005_articles_via_author`).** The probe measured that
   `expand=<collection>_via_<field>` works (200, the child rows). `relationsFromPocketBase`
   **does not emit** these, so a PocketBase one-to-many is invisible to NodeGX. Deliberate —
   naming it needs a convention the parser would have to invent — but it is a capability the
   backend has and this does not.
4. **`custom` backends.** No profile, no relation model, refused. Unchanged from BCN-004.
5. **The nodes.** `AddDbModelRelation`/`RemoveDbModelRelation` pass `targetCollection` now
   and their comments are updated, but **neither node was driven** — the live pass drives the
   adapters. The orchestrator's `bcn-004-node-driver.ts` is the harness that would close
   this and it was not extended here.
6. **The editor.** Nothing was changed under `packages/noodl-editor/`, so the authoritative
   parsers (`relationsFromDirectus` and friends) have **no caller in the product**. What runs
   today is `relationsFromCachedCollections`, a strict subset — see §5.
7. **Concurrency.** Directus's read-before-write race is declared and not demonstrated.
   Nothing serialises it.
8. **A junction with extra columns.** `relationsFromCachedCollections` requires a junction to
   have nothing but its key and two foreign keys. A real project's join table often carries a
   `sort` or `created_at`; that junction will not be recognised and the relation will refuse.
   Not measured, because the rig's junctions are minimal.
9. **`relations.acl` interaction.** A junction row's own permissions are a separate grant on
   every backend. The rig grants them; a user's Directus role may not, and the failure would
   be a 403 on the junction rather than on the parent.
10. **Deleting a relation member that never existed** reports success on all three, because
    Directus answers `204` and PostgREST `200 []` for a pair that was never there.
    ⚠️ PostgREST's `Prefer: return=representation` **can** tell them apart (measured: `[]`
    versus the row). Directus cannot, and the contract has no way to say "removed nothing",
    so both report success. A real difference the contract cannot currently express — the
    same shape as BCN-004's finding about `delete`.
11. **The browser.** `fetch` only, as with the rest of `RestDataAdapter`.

---

## 4. The live pass, and the two checks that proved nothing

Full output: `uba-e2e/BCN-005-RELATION-DRIVER-OUTPUT.txt`.

```
DIRECTUS 11        17 checks   all passing
POSTGREST 12.2.3   14 checks   all passing
POCKETBASE 0.30.0  13 checks   all passing
PARSE SERVER 7.3.0  6 checks   all passing
                   55 passed, 0 failed
```

The driver imports `RestDataAdapter`, `ParseWireAdapter` **and the relation parsers**; it
never writes a descriptor by hand and never builds a URL. Four negative controls are printed
rather than asserted, each one the evidence that the check beside it could have failed —
including the two Directus include shapes side by side, and the PostgREST duplicate insert
answering `201 then 409` without the header that makes the add idempotent.

### The mutation tests

A green run proves nothing on its own, so seven mutations were run against the bundled
driver:

| Mutation | Result |
|---|---|
| M1 Directus M2M read path: two hops → one | **5 checks fail** |
| M2 PocketBase `?` quantifier never emitted | **1 check fails** |
| M3 `Prefer: resolution=merge-duplicates` removed | **1 check fails** |
| M4 Directus read-before-write skipped | **1 check fails** — `["algebra","algebra","compilers"]` |
| M5 PocketBase `expand` not hoisted | **1 check fails** |
| M6 `foreignKey` always written on the source | **1 check fails** |
| M7 an unknown relation guesses a junction instead of refusing | **3 checks fail** |

⚠️ **M2 and M3 both passed 50 out of 50 on the first attempt**, and that is the finding worth
carrying forward more than any of the wire measurements.

- **M2** passed because the driver related **one** tag and then filtered for it. On a parent
  holding exactly one related record, *"every related record matches"* and *"at least one
  does"* are the same question, so the plain and the quantified spellings agree exactly.
  Only a parent with **two** members tells them apart. The corpus now relates two tags to one
  article and one tag to the other, so the filter has a row it must find and a row it must
  exclude.
- **M3** passed because only the **rows** were asserted, never the **callback**. The first
  insert had already succeeded, so the state was right; what the mutation broke was that the
  duplicate add answers `409` and calls `error`, which means an Add Record Relation node's
  Success signal never fires. Set semantics is a claim about the answer as much as about the
  rows, and it is asserted as one now.

This is BCN-004's pagination trap — where `limit=2, skip=2` made a raw offset and
`floor(skip/limit)+1` agree exactly — one task later, twice, in a new place. The general
shape: **a corpus small enough to be convenient is often small enough that two different
implementations agree on it.**

---

## 5. ⚠️ What runs in the product today, and what does not

The honest boundary, because the difference is not visible from the code.

`RestDataAdapter` takes `relationsFor`. `cloudstore.js` supplies it from
**`relationsFromCachedCollections`** — derived from the schema NodeGX has already stored, with
no further requests, because of §1.3. The three authoritative parsers
(`relationsFromDirectus`, `relationsFromPostgrestSpec`, `relationsFromPocketBase`) are shipped,
tested against verbatim fixtures and exercised live — and have **no caller in the product**,
because their caller belongs in the editor's schema sync and `packages/noodl-editor/` is
another worker's territory this batch.

| | Cached (runs today) | Needs the editor to store the parsers' output |
|---|---|---|
| many-to-one | ✅ | |
| one-to-many reverse | ✅ | |
| many-to-many via a junction | ✅ — but named after the **target collection**, not the parent's own alias | the alias name (`tags` rather than `bcn005_tags`) |
| PocketBase relation fields | ❌ | ⚠️ blocked on §1.4 — the editor parser recovers no fields at all |
| junction with extra columns | ❌ | ✅ |

The M2M naming difference is asserted by the live pass rather than assumed. It is the right
trade: a relation found under the wrong name **refuses with a sentence**; a relation found
under a guessed name **writes somewhere**.

**The one call site that closes this**, for whoever owns `schemaParsers.ts` next:

```ts
// after parseSchemaResponse(type, data), with the admin token still in hand
const relations =
  type === 'directus'   ? relationsFromDirectus((await get('/relations')).data) :
  type === 'supabase'   ? relationsFromPostgrestSpec(await get('/')) :
  type === 'pocketbase' ? relationsFromPocketBase((await get('/api/collections')).items) :
  relationsFromParseClasses(parseClassList(data));
// store beside `collections` in the cached schema; `resolveBackend` carries it to the adapter
```

---

## 6. Success criteria, answered

| Criterion | Status |
|---|---|
| O2M and M2M appear in the parsed schema for every backend that has them | ✅ for Directus, PostgREST and Parse — `relationsFrom*` emit both, verified against real metadata. ⚠️ PocketBase O2M back-relations are **not** emitted (§3.3), and the editor cannot store any of it yet (§5) |
| Relation reads return a nested related record from all five backends through one contract option | ✅ Directus, PostgREST, PocketBase, Parse, NodeGX — measured. This is BCN-004's *"no live check reads a related record back"*, closed |
| Relation writes work where declared, and the port is disabled with a reason where not | ✅ three write shapes implemented; two refusals stay and both carry a sentence (§2.3). BCN-010 owns the port half |
| Dotted-path filters across a relation return correct row sets on every backend — verified live | ✅ and the two-tag corpus is what makes it mean something (§4) |
| PocketBase relations exercised against a real instance | ✅ first time, and it produced §1.1, §1.4, §2.5 and §2.6 |
| Stale-include validation still holds for every backend | ⚠️ **not re-verified.** That validation is in the editor's port generator; nothing here changed it, and nothing here tested it |
| The one-hop limit is recorded as a decision | ✅ §2.8 |

## 7. For the register

- ⚠️ **`parsePocketbaseSchema` recovers no fields from PocketBase 0.23+** — reads `schema`,
  renamed to `fields`. Unowned; editor territory (§1.4).
- ⚠️ **The authoritative relation parsers have no caller** until the editor's schema sync
  stores their output (§5, with the call site written out).
- ⚠️ **A Directus reverse O2M that `/relations` describes may not be readable**, and the
  403 is indistinguishable from a permission failure (§3.2).
- **PocketBase back-relations are a capability the backend has and NodeGX does not** (§3.3).
- **The two relation nodes are untested end to end** — `bcn-004-node-driver.ts` is the
  harness (§3.5).
- **`targetClass` is deprecated, not removed.** Its last public consumer is
  `Noodl.Records.addRelation({targetClassName})` (§2.7).
