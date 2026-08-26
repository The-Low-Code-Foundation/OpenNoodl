# SB-011 — A query that widens when it cannot narrow

**Status: ⬜ OPEN — measured, worked around in SB-004, not fixed.** Two independent ways a
`Query Records` node inside a cloud function returns **every row in the class** when it was asked
for a few, both found by SB-004 §7's real-backend run (2026-08-26 s4).

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

## Related

- SB-004 §6 **F12** and **F13** — the findings, with the workarounds SB-004 took, and §2's
  `Pointer → String` fallback.
- SB-010 — the sibling: a derivation that is correct and lives behind `isRunningLocally()`. Here it
  is the *error report* that does.
