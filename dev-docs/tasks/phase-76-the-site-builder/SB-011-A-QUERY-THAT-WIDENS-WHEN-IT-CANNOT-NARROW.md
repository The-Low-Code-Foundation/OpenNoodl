# SB-011 — A query that widens when it cannot narrow

> 🔴 **PHASE 76 IS CLOSED. THIS TASK IS OWNED BY PHASE 80 AS DEF-012.**
> Carried forward by reference on 2026-08-29 — this file keeps the measurements; phase 80
> keeps the schedule. See
> [phase 80's task list](../phase-80-the-defects-the-templates-found/TASKS.md).

**Status: 🟡 §1 CLOSED (2026-08-30, phase 80 s15) — §2 measured and left open with a
finding.** §5 below records what landed and what the re-measurement corrected. Two independent
ways a `Query Records` node inside a cloud function returns **every row in the class** when it
was asked for a few, both found by SB-004 §7's real-backend run (2026-08-26 s4).

Filed together because they share a consequence and a direction: a filter that cannot be applied
becomes no filter, and the caller is told nothing. In a read-only view that shows too much; in
SB-004's publish flow, whose next act was to rewrite access control on everything it was handed,
**publishing one page opened every Section on the site**.

Evidence: `packages/nodegx-backend/tests/sb004-publication-invariant.test.ts` — the last describe
(*"a `points to` filter cannot narrow inside a cloud function"*, two arms differing in one thing),
and the `🔴 left every OTHER page and section exactly where they were` control, both graded by
mutants.

## 1. `pointsTo` has no schema in the cloud runtime, and the refusal is swallowed

`pointsTo` is the one operator that needs the collection schema — it has to know the `targetClass`:

```ts
// backend-contract translators/parse.ts:219-231
case 'pointsTo': {
  const property = schema?.properties?.[field];
  if (!property?.targetClass) {
    // Previously this emitted `className: undefined`, which Parse reads as
    // a pointer to nothing and answers with an empty result set …
    return ctx.fail('Filtering "…" by the record it points to needs the collection schema, …');
  }
```

The refusal is right and the message is good. The schema, though, comes from
`CloudStore._collections` (`noodl-runtime/src/api/queryutils.ts:106-121`), and **nothing in the
cloud runtime populates that cache** — its own comment already notes that `records.js` is a context
where the ambient state is not guaranteed. So `schema` is `undefined` on every cloud query.

Then the refusal is caught and reported through the one channel a backend does not have:

```ts
// dbcollectionnode2.ts:925-932
} catch (e) {
  this.context.editorConnection.sendWarning(…);   // no editorConnection on a backend
}
```

`_where` stays `undefined`, an undefined filter is a query with no `where`, and no `where` is every
row. **Measured**: identical rows carrying both a `Pointer` column and a `String` column with the
same id; filtering the String returns the 2 asked for, filtering the Pointer returns all 3, as a
200.

⚠️ SB-004 §6b predicted the opposite — *"the bet fails loudly rather than returning an empty set,
which is the one mercy here"*. Reading `ctx.fail` and stopping there is what produced that
prediction. The `catch` two files away is where it goes quiet.

**Two candidate fixes, and they are not alternatives:**

- **Give `schemaFor` a source in the cloud runtime.** The backend has the schema — `_ensureTable`
  and `SchemaManager` both know `Section.pageId` is a Pointer to `Page`. This is the one that makes
  the Pointer idiom usable from a cloud function at all, and the product teaches that idiom.
- **Stop a failed translation from becoming an unfiltered query**, whatever the reason. The `catch`
  should leave the node in a state that does not answer — `failure`, which every graph can wire —
  rather than one that answers wrongly. `convertVisualFilter` already takes an optional
  `options.error` for exactly this; the caller does not pass one.

The second is the one that matters for safety, because it is not specific to `pointsTo`: **any**
translation failure widens the query today.

## 2. A Query Records node fetches once, unfiltered, before any graph has run

Independent of the above, and it fires on a filter that works perfectly.

`setCollectionName` (`dbcollectionnode2.ts:564`) and `setVisualFilter` (`:1050`) each call
`scheduleFetch` when their `runOnValueChange` box is ticked — and *absent means ticked*
(`run-on-value-change.ts:186-189`). Both are set from **parameters**, at node-creation time. So a
Query Records node queries the instant the graph is built, before any request value can exist, with
no `qp-` parameter set. `visualQueryToNeutral` drops a rule whose value is `undefined`
(`saved.ts:287`) — deliberately, because that is how an optional filter port works — and the
unfiltered result fires `fetched`.

The graph then acts on it. The narrowed re-query does arrive, a pass later, when the parameter
lands; by then the first result has already been through `Run Tasks`.

**SB-004's workaround** is three properties on every filtered query, pinned by assertion in
`noodl-mcp/tests/sb004Authoring.test.ts`: `runOnChange-collectionName: false`,
`runOnChange-querySettings: false`, and **no `Do` wire at all** — which leaves the filter
parameter's own arrival as the only trigger, the one ordering that cannot invert.

⚠️ **It is a workaround, not a fix, and it has a sharp edge.** Applied to an *unfiltered* query the
same setting is harmful: with no load-time fetch, `claimSite`'s `SiteSettings` node reported
`isEmpty: true` for a collection that had a row in it, which opened the door that mints the site's
first admin. So the correct setting depends on whether the query has a filter parameter — which is
not a thing an author should have to know, and is the argument for fixing it in the node.

Candidate: a query with declared filter parameters should not run until they have been supplied at
least once, rather than running immediately and dropping them. That changes long-standing behaviour
for browser graphs too, so it **needs a corpus sweep, not an argument** — same disposition as
SB-009.

## 5. What phase 80 s15 measured and built (2026-08-30)

**Re-driven before building** (the standing instruction): the defect reproduced at HEAD exactly
as §1 records — string arm 2 rows, pointer arm all 3 as a 200. But two of this file's readings
had to be corrected by measurement first:

- 🔴 **"Nothing in the cloud runtime populates `_collections`" was too wide.** The cache is a
  lazy getter over `NoodlRuntime.instance.getMetaData('dbCollections')` — and a deployed cloud
  bundle carries the **whole** `project.metadata` (`exporter/cloudFunctions.ts:298`). What was
  actually absent was the *metadata*: the §1 probe's bundle carried `metadata: {}`, and no
  built-in-backend project had `dbCollections` in a shape `schemaFor` could read.
- 🔴 **The corpus says who this bites, and it is not who §1 implies.** 280 `points to` rules in
  14 projects: **264 carry a legacy Parse-era `schema.properties` entry with `targetClass`** —
  those translate today, in cloud functions too, and were not touched. **16 rules (4 projects)
  had no usable schema** — those were silently widening and now fail loudly. **0 rules** sat on
  the built-in backend's `columns` shape — the gap was fully forward-looking, i.e. exactly the
  thing SB-004 hit.

**What landed — both §1 candidate fixes, plus the schema chain end to end:**

1. **A failed translation can no longer widen** (`dbcollectionnode2.ts::getStorageFilter`): the
   catch returns `{ failed }`, `fetch()` answers it with `setError` — `error` port, `failure`
   signal, `raiseRuntimeError` (which DEF-004's step record now carries on a backend). The same
   guard went into the cloud `Aggregate Records` node, whose translation failure previously
   **threw out of the update pass** — a hang, neither fetched nor failed
   (`aggregatenode.js`; graded by `nda-012` C6).
2. **`schemaFor` reads the built-in backend's cache shape** (`queryutils.ts`): a `dbCollections`
   entry carrying `columns: [{name, type, targetClass}]` — the shape `SchemaHandler` caches from
   `backend:getSchema` — now yields a `FilterSchema`; only the legacy `.schema.properties` shape
   did before.
3. **A first-write Pointer column records its `targetClass`** (`LocalSQLAdapter` create/save +
   `AdapterFacade.ensureImportShape`): the Pointer value's own `className` was being dropped, so
   nothing the editor could ever cache would have carried a target class. `_Schema` →
   `/admin/schema` → `backend:getSchema` → `dbCollections` all pass it through verbatim, so the
   chain closes without touching any of them.

**Specs** — `sb004-publication-invariant.test.ts`: the pinned pointer arm **inverted in place**
(it asserted the defect: 200 with n=3; it now asserts the meaning: the graph's own failure route
answers, 400) and a new `DEF-012` describe pins the same filter **narrowing to 2** once the
bundle carries its schema, plus the write-half (`targetClass` visible in `/admin/schema/Chunk`).
`queryutils.test.ts` — the `columns` shape translates; a column with no `targetClass` still
refuses. **Three mutants, each killed by exactly the arm built for it** (columns branch off →
narrow arms red; swallow restored → refusal arm red; targetClass dropped → write-half red).

⚠️ **Known limits, on record:**
- `_collections` is still module-global and materialises **once** per process from whichever
  runtime constructed last. On a shared local backend serving several bundles, the schema a
  filter translates against is the last-loaded bundle's. Pre-existing; the duplicate-name crash
  (phase 80 TASKS.md, owner `NONE`) sits in front of it in every real shared arrangement.
- A Pointer column created **before** this fix keeps its bare `Pointer` type — `addColumn`
  swallows the duplicate and never updates `_Schema`. Backfilling belongs with *"nothing gives an
  auto-created class its declared columns"* (same register, owner `NONE`).
- An MCP-authored project with no editor never gets `dbCollections` cached at all, so its cloud
  `points to` fails loudly rather than working. Loud is the fix's floor, not its ceiling.

**§2 measured, not built.** 270 parameter-fed `Query Records` nodes in the corpora: **265 sit at
the run-on-change default** (78 in cloud components, 15 projects) — the population the load-time
unfiltered fetch fires for. 🔴 **The candidate fix as §2 states it collides with the
optional-filter contract**: `dropUnresolvedConnected: true` exists because *a rule whose port
supplies nothing does not narrow* — so "wait until the parameters have been supplied" cannot
distinguish *not yet arrived* from *deliberately absent*, and would leave an optional-filter
query never running at all. The honest candidate is narrower: a **door-side precondition** (the
DEF-002 family) on cloud-function queries whose filter has connected parameters and whose
run-on-change boxes are on — SB-004's own workaround, taught at authoring time, no runtime
behaviour change to sweep. Left open with this note.

**§2 BUILT — phase 80 s22 (2026-08-30), exactly the door precondition above.**
`query-fetches-before-its-filter` (`queryBeforeFilter.ts`, advisory warning, both doors via
`authoredPreconditionDiagnostics`): fires on a cloud `DbCollection2` whose filter names a
connected value with a real wire on its `qp-` port while either run-on-change box is not
authored `false` (the exact runtime contract — absent means ticked). Abstains: browser
components (the same first fetch is long-standing behaviour there — 180 corpus instances left
alone, by decision with numbers), a wired collection name (fetch ordering undecidable), static
filters, and the applied workaround whatever else is wired. Corpus
(`npm run calibrate:query-timing`, 178 projects): 625 Query Records nodes, 325 with a wired
filter parameter, **59 cloud firings in 12 projects** — sampled from disk, true, including a
`fetched → response.send` whose caller receives every row in the class — and 34 cloud queries
already carrying SB-004's workaround, all silent. The traversal is duplicated from
`collectFilterParameters` (this layer must not import the runtime); a parity spec arm runs both
over the same filters. Details in phase 80 TASKS.md s22.

## Related

- SB-004 §6 **F12** and **F13** — the findings, with the workarounds SB-004 took, and §2's
  `Pointer → String` fallback.
- SB-010 — the sibling: a derivation that is correct and lives behind `isRunningLocally()`. Here it
  is the *error report* that does.
