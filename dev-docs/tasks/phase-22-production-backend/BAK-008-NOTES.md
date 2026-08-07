# BAK-008 — Full-Text Search (FTS5): implementation notes

Status: shipped (Tier 3). Branch `task/bak-008-full-text-search`.

## 1. FTS5 availability — verified against the real engine

WF-004's engine decision is `node:sqlite` (`DatabaseSync`), resolved by
`packages/noodl-runtime/src/api/adapters/local-sql/engine.js`. `better-sqlite3`
is intentionally not a dependency of anything.

**Verified directly**, not assumed:

```js
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
db.exec('CREATE VIRTUAL TABLE t USING fts5(body)');
db.exec("INSERT INTO t(body) VALUES ('hello world')");
db.prepare('SELECT * FROM t WHERE t MATCH ?').get('hello'); // => { body: 'hello world' }
```

Ran on the dev environment's Node (v22.22.0, above the engine module's
`NODE_SQLITE_MIN` of 22.13) — **FTS5 is compiled in**. `SchemaManager.hasFts5Support()`
now makes this a live, callable check (not just a one-time finding): it creates
and drops a throwaway `USING fts5(x)` virtual table and returns a boolean.
`SearchIndexer.assertReady()` calls it before every schema mutation, and
`BackendService.start()` calls `reconcileAll()` at startup, which calls it too —
so if a *future* deploy environment's SQLite build genuinely lacks FTS5, that
surfaces as a loud, specific error (`SearchCapabilityError` → `SearchStartupError`
if it happens at startup with search already configured; `HttpError(503, ...)`
if it happens live via the admin route), never a silent LIKE fallback. No JS
search index was built as a workaround, per the task's explicit constraint.

**Feeds the WF-004 engine ledger**: this is a point *for* `node:sqlite`, not
against it — the fear in that decision's risk table ("`node:sqlite` API gaps")
did not materialize for FTS5.

## 2. Wire-shape decision: `search` param, not `$text`

Checked `packages/noodl-runtime/src/api/cloudstore.js`'s `query()` — the only
place the runtime client builds a query request. It sends
`{ _method:'GET', where, limit, skip, include, keys, order, count }`. **It does
not, and never did, emit `$text`.** `QueryBuilder.js` has a `case '$text':`
handler, but it predates this task, does a plain `LIKE %term%`, and nothing in
the runtime produces that shape — it was dead code from the client's
perspective (kept as-is; see §6).

Decision: **a dedicated `search` field**, sibling to `where` in the same POST
body, not `$text` inside `where`. Reasons, in order of weight:

1. **BM25 ranking + snippet extraction don't fit inside a boolean WHERE
   predicate.** `$text` as a query *operator* can only ever contribute a
   true/false condition; it has no way to carry "and also rank by relevance"
   or "and also give me a highlighted excerpt." Those need their own SELECT
   list entries (`bm25(...)`, `snippet(...)`) and their own default ORDER BY —
   a different query shape, not an extra WHERE clause.
2. **No compatibility to preserve.** Since no client ever emitted `$text`,
   there was no existing wire contract to keep working — the choice was free.
3. **Composability was simpler to reason about.** `search` + `where` + `sort`
   + `limit`/`skip` + ACL are five independent, ANDed concerns; keeping them
   as five sibling fields (instead of folding one into another) matched how
   `QueryBuilder.buildSelect` already composed `where` and the ACL predicate.

Implemented in `LocalSQLAdapter.search()` (new method, sibling to `query()`),
`QueryBuilder.buildSearchSelect`/`buildSearchCount` (new functions, sibling to
`buildSelect`/`buildCount`), `AdapterFacade.rawSearch`/`wireSearch` (sibling to
`rawQuery`/`wireQuery`), and `ParseWireRoutes.classesPost`: when
`body._method === 'GET'` and `body.search` is a non-empty string, the request
goes through `wireSearch` instead of `wireQuery`; an empty/absent `search` is
byte-for-byte the old behavior. `cloudstore.js`'s `query()` now forwards
`options.search` in the POST body when present.

**The old `case '$text'` LIKE handler in `QueryBuilder.js` was left alone.**
It's unrelated to this feature (no client emits it, and this task didn't touch
`buildWhereClause`'s operator table beyond adding the optional `tableAlias`
param — see §3). Flagging so nobody mistakes it for BAK-008's mechanism: if a
future JSON-filter script hand-writes `{ $text: { $search: '...' } }`, it will
still get the old plain-LIKE behavior, not FTS5/ranking/ACL-composed search.

## 3. Design decisions

### Shadow table shape
External-content FTS5, one shadow table per opted-in collection:
`CREATE VIRTUAL TABLE "<table>_fts" USING fts5(<indexed cols>, content='<table>', content_rowid='rowid', tokenize='<tokenizer>')`.
The real table's PK is `objectId TEXT PRIMARY KEY` (not an `INTEGER PRIMARY
KEY` alias), so it keeps SQLite's ordinary implicit `rowid` — that's exactly
what `content_rowid='rowid'` (the FTS5 default) needs. **Known caveat,
documented not hidden**: a plain `VACUUM` on the live database file can
renumber rowids for tables without an `INTEGER PRIMARY KEY` alias, which would
desync an external-content FTS index. BAK-007's backup path uses `VACUUM
INTO`, which copies to a new file and does **not** renumber the live database
— so the ordinary backup path is safe. A manual `VACUUM` on the live file is
not something any code path in this repo runs today; if one is ever added,
the explicit rebuild path (below) is the documented recovery.

### Sync: SQL triggers, not application code
`SchemaManager.createSearchIndex()` generates three triggers
(`<table>_fts_ai`/`_ad`/`_au`, AFTER INSERT/DELETE/UPDATE) using the FTS5
external-content special-command pattern (`INSERT INTO fts(fts, rowid, ...)
VALUES('delete', old.rowid, ...)` then re-insert on UPDATE). Because these are
database triggers, not adapter method wrappers, **every write path is covered
automatically** — `LocalSQLAdapter.create/save/delete`, the BYOB `/api/:table`
routes (which call the same adapter methods), workflow steps, BAK-007 import
(`AdapterFacade.upsertSync`, which uses `QueryBuilder.buildInsert/buildUpdate`
directly against the same table), and even a raw `db.prepare(...)` statement
that bypasses the adapter object entirely all stay in sync — proven in
`LocalSQLAdapter.search.test.js`'s "a write that bypasses the adapter
entirely" test, which issues raw SQL and confirms the trigger still fires.

### Rebuild: drop-recreate-repopulate, always
`rebuildSearchIndex(table, fields, tokenizer)` always does: drop the old
shadow table + triggers (if any) → create fresh ones for the *current* field
list → run FTS5's `INSERT INTO fts(fts) VALUES('rebuild')` special command to
repopulate from the live content table. This is deliberately the **one and
only** path for "enable search," "fields changed," and "explicit
reindex/recovery" — not three similar-but-different code paths that could
drift. It is idempotent by construction (drop+recreate+repopulate from the
current live table always converges to the same state) and is exercised
directly by a "call it three times in a row" test.

Note: `CREATE VIRTUAL TABLE ... USING fts5(..., content=...)` does **not**
backfill existing rows on its own — external-content FTS5 tables start empty
regardless of what the content table already holds. The `rebuild` command
after creation is not optional; `rebuildSearchIndex` always runs it.

### Query composition & ACL
`buildSearchSelect`/`buildSearchCount` (`QueryBuilder.js`) build:
```sql
SELECT "<table>".*, bm25("<table>_fts") AS "_rank",
       snippet("<table>_fts", -1, '<mark>', '</mark>', '…', 24) AS "_snippet"
FROM "<table>" JOIN "<table>_fts" ON "<table>_fts".rowid = "<table>".rowid
WHERE "<table>_fts" MATCH ?
  AND (<user where, qualified to "<table>">)
  AND (<ACL predicate, buildAclPredicate() UNCHANGED>)
ORDER BY "_rank" ASC   -- or a caller-supplied sort
```
`buildAclPredicate` (BAK-003) is reused **verbatim** — it already qualifies
its own column (`"<table>"."ACL"`) by table name, so it composes with the join
with zero changes. `buildWhereClause`/`buildOrderClause` gained one new
**optional, backward-compatible** 4th/2nd parameter, `tableAlias`: when
present, every column reference gets qualified (`"<table>"."col"` instead of
`"col"`). This was necessary because the JOIN puts the FTS5 shadow table's
columns (named after the indexed fields, by FTS5 convention) into the same
scope as the content table's columns of the same name — an unqualified
`"title" = ?` would be genuinely ambiguous SQL. Every pre-existing call site
omits the parameter, so `buildSelect`/`buildCount`/`buildAggregate`/
`buildDistinct` are byte-for-byte unchanged (confirmed: the full pre-existing
`QueryBuilder`/`LocalSQLAdapter` test suites pass unmodified).

ACL composition is covered by tests shared in spirit with BAK-003's own suite
(same fixture shape — public/private/role rows, same `read(keys)`/`write(keys)`
helpers) in both `LocalSQLAdapter.search.test.js` (adapter level) and
`search-http.test.ts` (HTTP level, two real users on a locked backend).

### Ranking
`bm25()` in SQLite FTS5 returns **lower-is-better** (often negative) values.
`LocalSQLAdapter.search()` sign-flips it into `_score` (higher = better) before
returning, because "higher score wins" is the intuitive default for anyone
consuming this from a Function node or a repeater sort, and burying a
sign-flip convention in end-user script code would be a footgun.

### FTS5 query-syntax sharp edge — found and fixed, not just documented
FTS5's default query grammar is **not** a plain-text search box: a bare `-`
means "exclude the next term," `:` prefixes a column filter, `*` is a prefix
wildcard, unbalanced `"` is a syntax error. A naive pass-through of a
user-typed term broke on the very first non-trivial test value
(`zzz-unique-tag-value` → `no such column: unique`, because a bare `-`
inside a bareword token is parsed as an exclusion). Fixed with
`QueryBuilder.toFts5MatchQuery(term)`: split on whitespace, wrap **each**
resulting chunk in its own double-quoted FTS5 string literal (escaping
embedded `"` per FTS5's literal-quoting rule), rejoin with spaces. This keeps
every character inside a chunk literal (no operators) while preserving the
already-validated "quick brown" → implicit-AND-across-words, order-insensitive
behavior (each single word becomes a trivial one-token "phrase", and multiple
words stay independent ANDed phrases rather than becoming one big
order-sensitive phrase). Covered by a dedicated unit-test block in
`QueryBuilder.test.js` and exercised end-to-end by the HTTP suite.

### The Live/BAK-001 question — scoped down, deliberately, with a reason
The spec's desired-state prose says search should "work with BAK-001's Live
option (a changed record re-matches)." `DbCollection2`'s existing live-update
path (`cloudStoreEvents`) incrementally adds/removes a single changed record
from the current in-memory `Collection` by re-checking it against
`QueryUtils.matchesQuery(m, currentQuery.where)` — a JS-side re-evaluation of
the *structured* filter only. There is no JS-side FTS5/BM25 evaluator, and
BAK-001's own filter matcher is *property-tested to agree with SQL* precisely
because hand-rolling a second implementation of a matching semantics is where
these subtly diverge — building a third (an FTS5 twin) for this Tier-3 task
was not a good trade. It is also not just an effort-avoidance call: BM25
ranking means a single changed record can change **every** other result's
position, which a single-record incremental splice literally cannot express,
correct or not.

**What ships**: when `_internal.search` is truthy, `cloudStoreEvents` skips the
incremental add/remove path entirely and calls `scheduleFetch()` — a full
re-search through the real server-side FTS5 query. This *is* "a changed record
re-matches," delegated to the one place relevance matching is actually
correct (the database), at the cost of being coarser-grained (a full
re-query instead of an in-place splice) than the non-search live path. This is
not scoped out of the Success Criteria checklist (which asks for the Search
port to "work live in a running app," not for incremental live diffing under
search specifically) — it is a design decision, recorded here with its
reasoning, not a silent gap.

### Node surface: no new outputs needed
`_score`/`_snippet` come back as ordinary keys on each wire-search result
object. `cloudstore.js`'s `_fromJSON` already does `for (var key in item) {
... m.set(key, ...) }` — every key on the wire object becomes a model
property, unconditionally. So `Item._score` and `Item._snippet` are usable in
a repeater binding exactly like any schema field, with **zero** changes to
that deserialization path and no new node output ports. Checked this by
reading `_fromJSON` before assuming it — it was not obvious without reading
the code that this "just worked."

### Tokenizer
Default `unicode61`, matching the spec's explicit "no language-specific
stemming promises." `porter`/`ascii`/`trigram` are accepted (they're
real FTS5-shipped tokenizers) but not exercised beyond validation-model tests
— no stemming/CJK-segmentation behavior is asserted or promised for them.

## 4. Catalog

`node-catalog.json`'s `DbCollection2` (Query Records) entry already models
its **entire** input surface as `dynamicPorts: { mechanisms: [...],
description: '...' }` rather than enumerating individual ports — every
existing input (`collectionName`, `storageFilterType`, `visualFilter`,
`storageLimit`, ...) is generated at editor-runtime by `updatePorts()` /
`registerInputIfNeeded`, none are captured as static `inputs[]` in the
catalog. The new `search` port is added the same way (a `ports.push(...)` in
`updatePorts()`, a `search` entry in `dynamicSetters`), so it falls under that
same existing `dynamicPorts` umbrella. Ran `npm run catalog:check` after the
change: **"Committed catalog is up to date"** — zero drift, nothing to
regenerate. (Verified this wasn't a mistake by inspecting the actual
`node-catalog.json` entry for `DbCollection2` before and reasoning through
why: `inputs: []` in the committed JSON is correct/expected for this node
family, not a sign the generator missed something.)

## 5. What was verified, and how

- **FTS5 availability**: live `node:sqlite` probe (§1), plus
  `SchemaManager.hasFts5Support()` exercised in
  `LocalSQLAdapter.search.test.js`.
- **Sync under every write path**: `LocalSQLAdapter.search.test.js`,
  "index sync under every write path" block — adapter `create`/`save`/`delete`
  AND a raw `db.prepare()` statement bypassing the adapter, each followed by a
  real `search()` call proving the index reflects the change.
- **Rebuild idempotence**: same file, "rebuild: explicit, reported,
  idempotent" block — calls `rebuildSearchIndex` three times consecutively and
  asserts identical, correct results; a separate test proves a field-set
  change is picked up only after an explicit rebuild (not silently, not never).
- **ACL composition**: `LocalSQLAdapter.search.test.js` ("ACL composition")
  at the adapter/SQL level, and `search-http.test.ts`'s second describe block
  ("ACL composition (locked backend)") at the full HTTP level with two real
  signed-up users on a `devOpen:false` backend — mirrors
  `security-enforcement.test.ts`'s cross-user-isolation style.
- **Ranking sanity**: a fixture with dense repeated matches vs. one incidental
  match; asserts the denser match's `_score` is strictly higher.
- **Snippets**: asserts the `<mark>` highlight appears in `_snippet`.
- **Wire-level end-to-end**: `search-http.test.ts`, first describe block —
  real `BackendService` over real HTTP: admin enable/disable/rebuild,
  unknown-field rejection, system-collection rejection, "search before
  enabled" clear-error, combined search+`where`, empty-search-is-a-no-op,
  post-enable-write-then-search sync, rebuild idempotence over HTTP.
- **MCP tools, live**: `packages/noodl-mcp/tests/backendTools.test.ts`, new
  "search tools (BAK-008)" describe block — the **real, esbuild-built**
  `dist/cli.js` spawned as a child process (rebuilt from this branch's source
  specifically so the bundle contains these changes — see §7), driven purely
  through the `get_backend_search_config` / `set_collection_search` /
  `rebuild_search_index` / `disable_collection_search` MCP tools, verifying a
  search actually finds a seeded record and highlights it.
- **Loud failure without FTS5**: `SearchIndexer.assertReady()` throws
  `SearchCapabilityError` before any schema mutation when
  `hasFts5Support()` is false; `admin-search.ts` turns that into
  `HttpError(503, ...)`; `service.ts` turns it into a startup-refusing
  `SearchStartupError` if a persisted config already has search enabled on an
  engine that can't support it. **Not exercised against a real FTS5-less
  build** (none was available to test against — see Residuals) — verified by
  code inspection and by the fact `hasFts5Support()` is a real runtime probe,
  not a hardcoded constant, so it would actually return `false` on such a
  build.
- Full regression: `noodl-runtime` 384/384, `nodegx-backend` 379/379,
  `noodl-mcp` 54/54, all typechecks clean (exact numbers in the final report).
- Editor panel/IPC/catalog: `tsc --noEmit` clean on `noodl-editor` (both
  before and after these changes, run standalone — see §7 for why "standalone"
  matters), `node --check` on the edited `.js` files, `catalog:check` clean.
  **Not live-smoke-tested in the running app** — see Residuals.

## 6. Files touched outside the obvious search-only set

- `packages/noodl-runtime/src/api/adapters/local-sql/QueryBuilder.js` — added
  an optional `tableAlias` param to `buildWhereClause`/`buildOrderClause`
  (backward compatible; every existing call site omits it).
  `case '$text':` in `translateOperator` was **not** touched (see §2).
- `packages/nodegx-backend/src/server/parse-wire.ts` (declared shared file) —
  one additive branch inside the existing `body._method === 'GET'` block in
  `classesPost`. No reorganization.
- `packages/nodegx-backend/src/server/HttpServer.ts` (declared shared file) —
  additive: one new import, one new `HttpServerDeps` field (`search`), one new
  private field + constructor line, one new `dashboardFeatures` key, four new
  routes appended before the dashboard routes. No reorganization.
- `packages/nodegx-backend/src/service.ts` — not on the declared shared list,
  but is the composition root every BAK-0xx task wires into; touched
  additively (one new `1.6` startup step, `search` in `HttpServerDeps`,
  `search` in the `StartedService` return, `this.search = null` in `stop()`).
- `packages/nodegx-backend/src/admin/AdminDashboardRoutes.ts` — added one
  `search: boolean` field to the `DashboardFeatures` interface (required for
  `HttpServer.ts`'s `dashboardFeatures()` to typecheck) and set it in
  `HttpServer.ts`. **The served dashboard's actual Search tab/section was NOT
  built** — see Residuals; the flag exists so a future pass can add the
  section without another interface change.
- `packages/noodl-editor/src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/LocalBackendCard.tsx`
  and `packages/noodl-editor/src/main/src/local-backend/BackendManager.js` —
  not on the declared shared list, but are the natural (and only) place a new
  per-backend panel button/IPC surface is wired, mirroring every existing
  panel (Schema/Data/Permissions/Triggers/Email). Additive: one import, one
  `useState`, one button, one portal block; one new IPC-handler section
  appended after the existing API-key handlers.

## 7. Environment traps hit (for the next agent in a nested worktree)

**A sharper, more general version of the documented "`lerna exec` runs the
main checkout" trap.** This worktree lives *nested inside* the main
checkout's directory
(`.../OpenNoodl/.claude/worktrees/agent-.../`, under `.../OpenNoodl/`). Plain
Node module resolution (`require('@noodl/runtime')`, no lerna involved at
all) walks UP the directory tree from the requiring file looking for
`node_modules`. Because this worktree has **no `node_modules` of its own**,
resolution walks straight past the worktree root and finds the **main
checkout's** `node_modules/@noodl/runtime` symlink instead — silently running
stale code. This bit both `nodegx-backend`'s own `jest` suite (`tests/*.test.ts`
failed with `hasFts5Support is not a function` because the main checkout's
`noodl-runtime` didn't have my new SchemaManager methods) and would have
equally silently affected `nodegx-backend`'s *production* code path
(`AdapterFacade.ts` does `require('@noodl/runtime/src/...')` directly).

Confirmed via `require.resolve('@noodl/runtime')` from inside the worktree's
`packages/nodegx-backend` — it printed a path under the **main checkout**,
not this worktree.

**Fix applied** (local to this worktree, not committed — `node_modules/` is
gitignored, confirmed): created
`<worktree>/node_modules/@noodl/runtime -> ../../packages/noodl-runtime`,
mirroring the exact relative-symlink convention the root `package.json`'s npm
workspaces already use (checked the main checkout's real
`node_modules/@noodl/*` symlinks to copy the convention exactly). This shadows
the further-up main-checkout resolution with the correct in-worktree one.
After this, `nodegx-backend`'s full suite went from 114 failing / 237 passing
to 351/351 passing with zero other changes.

**Why this matters for the orchestrator**: this was *my* environment
correcting itself, not a repo change — nothing to review in the diff. But it
means test runs from a nested worktree that *don't* hit this fix (i.e., ran
before I added the symlink, or a future agent that doesn't know to check) can
report false negatives (real bugs mistaken for missing methods) or, worse,
false positives (a suite "passing" against stale main-checkout code that
doesn't reflect the worktree's actual diff at all — this is the dangerous
direction, and is exactly the kind of failure the existing "parallel worktree
traps" memory note warns about, just via a different mechanism than `lerna
exec`). Building `nodegx-backend`'s `dist/cli.js` (`npm run build`, esbuild)
is unaffected by this — esbuild resolves `@noodl/runtime` via a relative
`alias` path (`scripts/build.js`), not node_modules, so the built bundle
always reflects the worktree's actual source; the `noodl-mcp` live test
(§5) that spawns the built `dist/cli.js` is trustworthy regardless of the
node_modules issue, which is one reason it was worth the time to build and run
it rather than rely on the unit suites alone.

## 8. Residuals (honest list)

- **Editor panel not live-smoke-tested.** `tsc --noEmit` is clean (both
  baseline and after), `node --check` passes on the touched `.js`, but nobody
  has opened the running NodeGX editor, clicked the new "Search" button on a
  local backend card, and confirmed the panel renders/round-trips against a
  live backend. Per the documented `lerna exec` trap, this genuinely cannot be
  done meaningfully from this worktree — `npm run dev:debug` would run the
  MAIN checkout's editor bundle, not this diff. Flagging as a residual for the
  orchestrator rather than faking it.
- **Query Records Search port not live-smoke-tested in the running app**
  either, for the identical reason. The port's plumbing (`setSearch`,
  `fetch()`'s `search` param, the live-refetch-on-change branch) is exercised
  only by reading/typechecking, not by driving the actual editor + a real app
  build. `LocalSQLAdapter`/HTTP-level search itself IS live-tested (§5); it's
  specifically the *node/port* wiring inside the editor+viewer runtime that
  isn't.
- **BAK-005's served admin dashboard has no Search section.** The
  `DashboardFeatures.search` flag now exists and is set correctly, but no
  markup/JS was added to the dashboard's client bundle. An operator with the
  editor closed cannot configure search from the dashboard yet — only via the
  editor panel or MCP. Scoped out for time; the flag makes adding it later a
  self-contained follow-up, not another interface change.
- **Loud-failure-without-FTS5 path not exercised against a REAL FTS5-less
  SQLite build** — none was available in this environment (`node:sqlite`
  ships FTS5; no non-FTS5 `better-sqlite3` build was installed to substitute).
  Verified by code path inspection and by `hasFts5Support()` being a genuine
  runtime probe rather than a hardcoded assumption, but this is inference, not
  a witnessed failure.
- **`porter`/`ascii`/`trigram` tokenizers are accepted but not behaviorally
  tested** beyond config validation — only `unicode61` (the documented
  default) has ranking/snippet/matching behavior actually exercised.
- **No cross-collection global search** — out of scope per the spec (v1 is
  per-collection only); not attempted.
- **Query-time field restriction** (search only some of a collection's
  indexed fields per-call) was not built — `options.search` is a plain string;
  a search always matches against every field the collection has indexed.
  Not required by the spec; noted as a possible v2 knob.
