# Phase 48 — The Data Ceiling (Track D)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 7 tasks. Post-alpha.
**Origin:** [NODEGX-VS-CODE-A-REAL-APP.md](../../reviews/NODEGX-VS-CODE-A-REAL-APP.md) §4.3, and the
follow-up probe that corrected it.

## The finding that reframes the phase

The review said the data layer was *"a document store wearing a relational costume"* and implied
SQLite was the limit. **A direct probe of `node:sqlite` on Node v22.22.0 says otherwise:**

```
loadExtension: function      enableLoadExtension: function      function(): function
fts5: ok      joins: ok      window fns: ok      json1: ok
```

Joins, window functions, CTEs, FTS5, JSON — all present. And `loadExtension` is available, which
means `sqlite-vec` is loadable and vector search does not require leaving the platform.

**So the constraint is the CloudStore contract, not the database.** Fifteen methods, Parse-shaped,
one collection at a time. `QueryBuilder` only ever emits `JOIN` for FTS and relation subqueries
because that is the entire set of questions the contract knows how to ask. SQLite has been carrying
far more capability than anything above it exposes.

That is good news structurally: the ceiling can be raised **without a data migration**, and the
Postgres question becomes about *scale* rather than *capability*.

## The three real limits, separated honestly

| Limit | Is it SQLite's fault? | Answer |
|---|---|---|
| No multi-collection queries, no aggregation beyond `Aggregate Records` | **No** — contract | DAT-002, Query Views |
| No vector similarity | **No** — nothing loaded it | DAT-001, `sqlite-vec` |
| No per-role `GRANT`s | **Yes** | DAT-003 — a different boundary, designed deliberately |
| Single writer | **Yes** — WAL gives many readers, one writer | Fine to low thousands of active tenants. A cliff, not a wall. |
| One box, no replicas, no failover | **Yes** | DAT-005, and only DAT-005 |

## DAT-002 — Query Views, the centrepiece

**An author-defined, named, parameterised, read-only SQL view, registered in the project and
surfaced to the graph as a collection with typed columns.**

Why this shape and not "an SQL node":

- **The SQL lives in one reviewable place.** A project has N views, each named, each in a file, each
  diffable. Ad-hoc SQL scattered through a hundred Function nodes is the n8n melting pot arriving by
  a different door — and the argument against that door is already written in
  [BACKEND-AUTHORING-MODEL.md](../../reference/BACKEND-AUTHORING-MODEL.md).
- **The graph stays declarative.** A view is a collection. Query Records points at it. Every
  existing filter operator, sort and pagination works unchanged. Nothing in the app layer learns SQL.
- **An agent writes a view definition, not a query.** Reviewable, testable (phase 46), and bounded.
- **It is a natural security boundary** — see DAT-003.

Views are **read-only, always**, and parameters are bound, never interpolated. Both rules are
structural, not stylistic.

## DAT-003 — the view *is* the boundary

The reference app's NL→SQL analyst is guarded by a dedicated Postgres role: `SELECT` on an
`analytics` schema, **no privilege at all** on `public`. Its own docstring is the best security
writing in either repo:

> *"The security boundary is the database, not this module… every NL→SQL incident published in the
> industry has been a filter bypass, never a privilege bypass."*

SQLite has no roles, so that exact design is unavailable. The replacement must be **structural, not
a filter**, or we reproduce the industry's entire failure history:

**A generated query may reference only registered views. Enforced at resolution — the resolver
cannot name a base table — never by inspecting SQL text.** A model that emits
`SELECT * FROM users` fails because `users` does not resolve in that namespace, not because a regex
caught it.

This is arguably cleaner than a role for the *privilege* question, because the allowed surface is an
explicit artifact an author wrote rather than a grant someone remembered to narrow.

### ⚠️ But it only replaces one of five layers, and the other four are not implementable here

Added 2026-08-06 after an adversarial review
([counter-review §A.3](../../reviews/NODEGX-VS-CODE-THE-COUNTER-REVIEW.md)), independently verified.
This paragraph is the honest correction to the one above.

comcoi's analyst boundary is five layers, not one:

| Layer | Where | DAT-003 |
|---|---|---|
| `SELECT` on `analytics`, `REVOKE ALL` on `public` | `072_analyst_role_grants.py:101-125` | ✅ replaced by the view namespace |
| `default_transaction_read_only = on` at **role** level | `:118-125` | ❌ no roles |
| `statement_timeout = '5s'` — role, connection **and** transaction | `072`; `analyst_sandbox.py:96-113, 303-309` | ❌ **impossible** |
| `idle_in_transaction_session_timeout = '10s'` | same | ❌ no equivalent |
| Row cap + explicit `ROLLBACK` in `finally` | `analyst_sandbox.py:285, 341-346` | ✅ implementable |

Row three is the one that matters and it is not a scheduling problem. Probed on the platform's own
Node (v22.22.0):

```
DatabaseSync methods: open, close, prepare, exec, function, location,
  aggregate, createSession, applyChangeset, enableLoadExtension, loadExtension
```

**No `interrupt()`, no progress handler, no statement timeout — and `DatabaseSync` is synchronous.**
So a model-written query joining three registered views without a usable predicate runs to completion
on the single-threaded event loop and **blocks every other request for every other tenant** until
SQLite finishes. In comcoi the same query is killed at 5,000ms by the database and the model is
handed a typed retry error.

**So: DAT-003 delivers a privilege boundary and cannot deliver an availability boundary.** An
adversarial suite tests a namespace; it cannot test a resource limit that does not exist. Say this in
the product rather than discovering it — and note that for multi-tenant SaaS the availability
boundary is the one that pages you at 3am.

**What follows for the roadmap:** the NL→SQL analyst is 🟡 on SQLite and only goes ✅ with
**DAT-005**, where a real role and a real `statement_timeout` exist. DAT-005 is therefore not
optional-for-scale where this feature is concerned — it is the feature's prerequisite. Anyone
building an analyst on the SQLite path must bound it out of process (a worker with a kill switch),
and that work is not costed in this phase.

DAT-003 still ships with an adversarial test suite as a gate, not as a follow-up.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **DAT-001** | Vector search | 1 wk | `sqlite-vec` as an optional loaded extension; an Embed node (pluggable provider) and a `nearestTo` filter operator. ⚠️ **A native extension costs the zero-ABI-matrix property WF-004 explicitly chose `node:sqlite` to get.** So: optional, per-platform prebuilt, and a backend without it reports the capability as absent rather than failing a query. Closes RAG. |
| **DAT-002** | Query Views | **3–4 wks** | Definition format, registration, typed column introspection, parameter binding, editor authoring surface, catalog exposure. The centrepiece. |
| **DAT-003** | The view as the NL→SQL boundary | 1 wk | Resolution-level enforcement + adversarial tests as the gate. Depends on DAT-002. ⚠️ Delivers the **privilege** boundary only — the availability boundary needs DAT-005 or an out-of-process worker; see above. |
| **DAT-004** | Aggregation, revisited | 4 d | CWF-004 ruled aggregation out of *workflow steps* for a good reason (a workflow references and reshapes; it does not compute). Views make the same capability available where it belongs — at rest, in the data layer — without reopening that decision. This task is mostly writing down why those two facts are consistent. |
| **DAT-005** | The Postgres adapter | 3 wks | For **scale**, not capability. The contract already carries translators for Directus, PostgREST, PocketBase and Parse, so the seam is proven. Views map to real views; DAT-003's boundary can additionally use a real role, belt and braces. |
| **DAT-006** | Schema changes as reviewable artifacts | **3 wks** | Today schema evolves through an admin surface with no reviewable record. The reference app has **83** Alembic revisions. A 54-collection project needs an ordered, diffable, replayable change log with data backfills — otherwise "what shape is production" is unanswerable. |
| **DAT-007** | Capability honesty | 3 d | Every one of the above is optional or backend-dependent. `capabilities.ts` already exists as the place a client asks what a backend can do; each new capability declares itself there, and the editor greys rather than lies. |

⚠️ **Two estimates raised 2026-08-06 under review.** DAT-002 at 2 weeks covered "definition format,
registration, typed column introspection, parameter binding, editor authoring surface, catalog
exposure" — that is a mini-ORM plus an IDE surface, and the introspection alone is not two weeks.
DAT-006 at 1.5 weeks is rebuilding Alembic: comcoi's 82 revisions include guarded destructive
backfills, a heuristic money correction that deliberately does not reverse, two no-op migrations kept
purely as audit record, and one that **imports Python constants from application code** so a view's
cohort boundaries cannot diverge from the classifier (`071_analytics_views.py:74-79`).

⚠️ **And exit criterion 4 is not free.** DAT-002's premise is author-written **SQLite** SQL. "Moves to
Postgres with no graph changes" holds for the graph and **not for the views** — type affinity, `||`,
`strftime` vs `to_char`, JSON operators, window-frame defaults and `GROUP BY` strictness all diverge.
Every view is a hand-port, and that is uncosted.

**Total: ~12 weeks** (was ~9). DAT-001 + DAT-002 + DAT-003 (~4 wks) is the shippable first half and closes
both 🔴s from the comparison.

## Exit criteria

1. A RAG query over 10k documents returns semantically ranked results with no external service.
2. A monthly report joining six collections across a fiscal window is one Query Records against one
   view — the reference app's hardest read.
3. An NL→SQL agent asked for `users.password_hash` fails at **resolution**, and the adversarial
   suite covers comment injection, unicode homoglyphs, nested CTEs and string concatenation.
4. A project moves SQLite → Postgres with no graph changes.
5. `git log` answers "what shape was production on 12 March".
