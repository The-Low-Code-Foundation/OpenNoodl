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
