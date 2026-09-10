# FLD-008 — An aggregation that cannot answer says so

A filter is refused, correctly. The refusal is reported down a channel that does not exist in
production. The throw is swallowed. The aggregation then runs **over the whole class** and returns
a number. A wrong answer where there should have been a loud failure.

## 1. The person sentence

**Someone whose filter cannot be translated gets an error on the node, not a plausible total.**

## 2. What was reported, and what the code says

[#14](https://github.com/The-Low-Code-Foundation/NodeGX/issues/14): Aggregate Records with a filter
returns 250 where 125 was expected, and *"in some cases it seems to ignore the filter conditions"*.

Measured 2026-09-09. **Two findings, and the first is a setup correction the reporter is owed:**

🔴 **Aggregate Records does not inherit the filter from a connected Query Records node.** It has its
own `Class` and `Filter` ports (`aggregatenode.js:381-413`, `:496-550`) and builds its own `where`
in `getStorageFilter()` (`:173`). Wiring a filtered query node into it changes nothing about what
the aggregate matches. That alone produces "it ignores the filter entirely".

🔴 **And when the filter *is* set on the node, a refusal becomes a wrong answer.** The reporter's
filter has **two top-level keys**:

```js
where({ campaignId:{equalTo:"…"}, status:{equalTo:"approved"} })
```

which violates the one-key rule. The refusal is real and correct —
`nodegx-backend-contract/src/translators/walk.ts:52-57`:

> `A filter must have exactly one key, found 2: campaignId, status. Combine conditions with { and: [ … ] } or { or: [ … ] }.`

**And it is thrown away, twice:**

- `noodl-runtime/src/api/queryutils.ts:481-488` — `convertFilterOp` catches the translation error,
  calls `options.error(msg)`, and **returns `{}`** — an empty `where`.
- `aggregatenode.js:218-232` — that callback is `context.editorConnection.sendWarning(...)`. **There
  is no `editorConnection` in a deployed cloud function**, so it throws a `TypeError`.
- `aggregatenode.js:248-252` — swallowed: `catch (e) { console.log('Error while running filter script: ' + e); }`.
- `:214`/`:254` — `_filter` stays `{}` and `{ where: {} }` reaches `CloudStore.aggregate`.

**Which hypothesis:** the filter is **dropped**, not double-counted. `_internal.aggregateValues` is
*replaced* on every success (`:161`), never accumulated, and there is no pagination loop —
`ParseWireAdapter.aggregate` issues one request (`:408-425`). The 250 is the sum over the wider set.

⚠️ **Not the Parse `$match` foot-gun.** `ParseWireAdapter.ts:394-405` does place the filter in
`$match`, and the backend reads both spellings. That path is correct; the filter never reaches it.

🔴 **The same hole is in Query Records** — `dbcollectionnode2.ts:1031-1040`, same unguarded
`editorConnection` call. And DEF-012 (`6deabdd4f`) already fixed exactly this **on the visual-filter
path only** (`aggregatenode.js:145-152`, `:178-187`); the JavaScript path was not touched. **The
shape of the fix is already in the file.**

## 3. Scope

- Capture the translation error into a `failed` string instead of calling `editorConnection`
  unconditionally, and return `{ failed }` so the existing `setError` guard (`:146-152`) answers it —
  `error` port, `Failure` signal, `raiseRuntimeError`. This is DEF-012's shape, applied to its second
  caller.
- Guard the `editorConnection` call itself. That unguarded call is a latent crash on **every**
  backend, independent of filters.
- Do both nodes. One is not a fix.
- ⚠️ **Out of scope, filed instead:** the aggregate node has no `runOnValueChange` gating, so with no
  `Do` wire it fetches on every parameter change including at graph-build time. The authoring
  precondition built for this (`validation/queryBeforeFilter.ts`) fires only on `DbCollection2`, not
  on `noodl.cloud.aggregate`. Register row.

## 4. Acceptance criteria

1. **(person)** An aggregation with an untranslatable filter pulses `Failure`, populates `error` with
   the translator's own sentence, and **returns no result**. It does not answer.
2. The same filter rewritten with `and:` returns the correct total. Both arms in one spec — a
   refusal test with no success beside it cannot tell "refuses everything" from "refuses correctly".
3. 🔴 **Graded in a context with no `editorConnection`**, i.e. the cloud-function shape, not the
   editor's. The defect is invisible in any arm that has an editor connection, which is why it
   survived DEF-012.
4. Query Records is asserted on the same two arms. Reverted arm on both: restore the unguarded call
   and the cloud-shaped arm throws and swallows.
5. A spec asserts Aggregate Records **does not** read a connected Query Records node's filter, so the
   documented behaviour and the code agree and the next reporter is not surprised the same way.

## 5. Traps

- 🔴 **This changes behaviour for graphs that are silently getting a wrong answer today.** They will
  start pulsing `Failure`. That is the intended correction and it is the same call DEF-012 already
  made — say it in the release note.
- ⚠️ `console.log` in the catch is the only reason anyone could ever have seen this. Do not remove it
  while replacing it; a swallowed error with no log is worse than one with a log.
- ⚠️ The reporter's exact 250 is data-dependent and is **not** a doubled 125. Do not build a fixture
  that reproduces "double" — build one that reproduces "unfiltered".
- ⚠️ The reply should give them the working `and:` rewrite. They are blocked today and the fix ships
  later.

## 6. What was built — 2026-09-10, session 4 🟢 **BUILT**

### The change, in both nodes

Four lines in each of `aggregatenode.js:218-252` and `dbcollectionnode2.ts:1031-1083`. The
`convertFilterOp` error callback used to do exactly one thing with the refusal —
`context.editorConnection.sendWarning(…)` — and now does two, **in this order**:

1. `_filterFailed = err` — keep the translator's own sentence.
2. `if (_this.context.editorConnection) { sendWarning(…) }` — the editor surface, when there is one.

`getStorageFilter` then returns `{ failed: _filterFailed }`, which both callers already knew how to
handle: DEF-012 built that seam for the **visual** filter path and it needed no change here. The
`console.log` in the swallowing catch is kept, with a comment saying why (§5's second trap).

🔴 **The ordering is the fix, not the guard.** A guard alone would still lose the refusal if the
connection were present and threw for some other reason. The capture happens first, so the message
survives whatever the warning does. There is an arm on exactly that.

### What was measured

`packages/noodl-viewer-cloud/tests/fld-008-an-aggregation-that-cannot-answer-says-so.test.ts`
(7 arms) and `packages/noodl-runtime/test/nodes/fld-008-query-records-refuses-out-loud.test.ts`
(4 arms). Both are in `npm run test:packages`, which gates every PR (`pr.yml:160`) — not suites
run by hand.

Every arm runs with **`context.editorConnection` undefined** (AC3): the deployed cloud-function and
published-app shape. With an editor connection present the callback succeeds, the warning appears,
and the widening never happens — which is the whole reason this survived DEF-012.

| arm | filter | result |
|---|---|---|
| AC1 Aggregate | two top-level keys | `failure` pulses, `error` port carries the translator's sentence verbatim, `aggregate-records/aggregate-failed` raised, **zero requests issued** |
| AC2 Aggregate | `and:` rewrite | one request, `where` = `{$and:[{campaignId:{$eq:…}},{status:{$eq:…}}]}`, `fetched` pulses, `error` empty |
| AC1 ordering | two keys, connection present and **throwing** | still fails out loud, still no request |
| AC4 Aggregate reverted | two keys | 🔴 **one request, `where: {}`** — the whole class — no failure, no error, nothing raised |
| AC4 Aggregate reverted control | `and:` rewrite | filters correctly — the old node was not "never filtering", it turned a *refusal* into an unfiltered answer |
| AC5 ports | — | the only wireable input on the node is `storageFetch` (`Do`); `Class`, `Filter`, the visual filter and the JS filter are all `allowEditOnly` |
| AC5 control | `and:` rewrite | the `where` sent came entirely from the node's own parameters |
| AC1/AC2/AC4 Query Records | same two payloads | same results; reverted, the two-key filter returns **every row** as a success with `error: undefined` |

### The reverted arms are real reverts, not simulations

`withReverted` reads the node's own source, applies two textual replacements — delete
`_filterFailed = err;`, turn `if (_this.context.editorConnection) {` into `if (true) {` — writes the
result **beside the original** so its own imports resolve identically, and requires it. Both
replacements are `expect(…).toContain(…)`-asserted first: if the source moves, the arm fails loudly
instead of quietly grading a file that no longer contains the defect it claims to restore.

The reverted arms log the real thing on the way past:
`Error while running filter script: TypeError: Cannot read properties of undefined (reading 'sendWarning')`.

### Gates

`test:main` **446 suites / 7359 passing, exit 0** · `npm run typecheck` **exit 0** ·
`typecheck:editor` **exit 0** · `@noodl/runtime` **157 suites / 2686 passing** ·
`@noodl/cloud-runtime` **14 suites / 226 passing**.

### What was found and NOT fixed

`noodl-viewer-react/src/nodes-deprecated/std-library/data/dbcollectionnode.ts:454-465` has the same
unguarded `editorConnection.sendWarning` in the same callback shape, against its own local
`_convertFilterOp`. Deprecated, and outside the two nodes §3 named. **Register row P20.**

## 7. The reply to [#14](https://github.com/The-Low-Code-Foundation/NodeGX/issues/14) — @theMeysam

Ready to send. Two halves, and the first one unblocks them today:

> **Two things are going on, and the first is a setup correction that will get you working now.**
>
> **1. Aggregate Records does not inherit a filter from a Query Records node wired into it.** It has
> its own `Class` and `Filter` and builds its own query; there is no input on it through which
> another node's filter could arrive (the only wireable input is `Do`). If the filter you were
> counting on was on the query node, the aggregate was always running over the whole class.
>
> **2. If the filter was on the aggregate node itself, this one is ours.** Your filter has two
> top-level keys:
>
> ```js
> where({ campaignId: { equalTo: '…' }, status: { equalTo: 'approved' } })
> ```
>
> The filter language allows exactly one key per level, and we do refuse this — with a message
> naming both keys. But the refusal was only ever reported to the editor, and **there is no editor
> in a deployed cloud function**, so reporting it threw, the throw was swallowed, and the node
> aggregated with no filter at all and returned a number. Your 250 is the total over every row in
> the class. It is not a doubled 125.
>
> **Rewrite it like this and it works today, on the version you have:**
>
> ```js
> where({ and: [ { campaignId: { equalTo: '…' } }, { status: { equalTo: 'approved' } } ] })
> ```
>
> **What we changed:** a filter that cannot be translated now fails the node — `Failure` pulses,
> `Error` carries the message, and **no aggregation is run**. Same fix in Query Records, which had
> the identical hole and where the consequence was worse: it returned every row in the collection.
>
> ⚠️ **This will change behaviour for anyone whose graph is quietly getting a wrong answer today.**
> They will start seeing a failure where they used to see a plausible total. That is the point.
