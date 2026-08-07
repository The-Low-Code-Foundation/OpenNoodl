# DEBT-014 — implementation notes

**Status:** implemented, runtime-tested, **not live-verified** (see §7 — nothing here has been
run in the Electron editor or a real preview).

**Branch:** `worktree-agent-acd5b8ae53bff6813`

---

## 1. The lifetime decision

> **The registry owns names, not objects.**
>
> An entry is owned by the global table if, and only if, the id was **chosen by a caller**.
> Ids the registry mints itself are held weakly: the caller's reference is what keeps such a
> record alive.

Implemented as two tiers in both registries:

| Call | Tier | Behaviour |
|---|---|---|
| `Model.get('someId')`, `Model.create({ id, … })` | **named** — strong | Unchanged: process-lifetime, exactly as before |
| `Model.get()`, `Model.create({ … })` with no `id` | **anonymous** — weak | Freed once nothing else holds the record |
| `Collection.get('someName')` | **named** — strong | Unchanged |
| `Collection.get()`, `Collection.create(items)` | **anonymous** — weak | Freed once nothing else holds it |

Plus one rule that makes the split safe:

- **Promotion.** Spelling an anonymous id explicitly (`Model.get(x.getId())`) moves the entry
  into the named tier. An id that escapes and is later used *as a name* becomes durable at that
  moment. This is what closes the only route by which an anonymous id can be re-resolved.
- **`exists()` answers from both tiers.** An anonymous record that is still referenced *does*
  exist. Ownership is not the same question as visibility.

### 1.1 Why this and not the alternatives

The spec listed four candidates. The reasoning that picked between them:

**The spec's stated objection to a weak registry is based on a false premise, and this is the
key finding.** The spec says a weak registry would make "`Model.get(id)` on a Model nothing
else holds start returning `undefined` where it currently succeeds". `Model.get` is
**create-on-read** (`model.ts`: `if (!models[id]) { models[id] = new Model(id, {}) }`) — it has
never returned `undefined` for any input, and cannot. What a weak registry actually changes is
subtler and more dangerous than the spec describes: `Model.get(id)` returns a *fresh empty
record* instead of the one that held the data. No error, no `undefined` — a silent identity
split. That reframing is what drove the design.

So a blanket weak registry was rejected: applied to *named* ids it would silently break every
one of the twelve re-resolve-by-id paths in the runtime (audited in §2).

- **Reference counting** — rejected. Every reach through `Model.get(id)` is an untracked
  reference today, so the count starts wrong, exactly as the spec says. Worse: nothing tracks
  how many collections a Model belongs to, and a Model is legitimately in several at once
  (`filterdbmodelsnode`, `mapcollectionnode` and `dbcollectionnode2` all build parallel
  collections over the same records).
- **Scope-owned Models** — rejected. Breaks the cross-component reach that is the table's
  entire purpose. The one existing scope mechanism (`Model.Scope`) is used in exactly one
  production place (`noodl-viewer-cloud/src/index.ts`, one per cloud-function request) and the
  browser viewer never sets one.
- **Explicit disposal** — rejected as the spec argues: it pushes memory management onto visual
  app authors.
- **Tiering by who chose the id** — chosen. It is the *smallest* rule that is also *sufficient*,
  because the two jobs the table was conflating have opposite lifetime requirements:
  - a **rendezvous table** for reach-by-name — wants strong retention, and is inherently
    bounded because a human or a schema wrote those names;
  - an **identity map** for anonymous records — wants weak retention, and is what actually
    grew without bound.

### 1.2 Which layer owns the release trigger — and why it is none of the three the spec proposed

The spec asked whether the trigger belongs to Collection, Repeater, or the component instance
lifecycle. **The answer is none of them: there is no trigger.** Reachability is the trigger.

This was deliberate. Every event-based trigger considered was wrong:

- *"Free on removal from a collection"* — wrong, because a Model can be in several collections
  at once. `collection.ts:removeAtIndex` already notifies `item.notify('remove')`, so the hook
  existed and was tempting; using it would evict live members of other collections. There is a
  regression test for exactly this (`does not collect a record that is still a member of a
  *second* collection`).
- *"Free on Repeater delete"* — wrong layer, and insufficient. The Repeater is one of six
  high-volume anonymous-allocation sites; fixing it would leave the other five.
- *"Free with the component instance"* — wrong, because component-state records
  (`'componentState' + instanceId`) are *named* and are read and written by two different nodes
  that each re-resolve by id.

Reachability subsumes all three correctly and needs no new bookkeeping at any call site.

---

## 2. What was audited before changing anything

A full census of both registries' consumers (call sites, tiers, and re-resolve-by-id hazards)
was taken first. The twelve paths that depend on `Model.get(sameId)` returning the same live
object — and which a naive fix would have silently broken — are:

`CloudStore._fromJSON` identity · live-query reconciliation in `dbcollectionnode2` ·
`Model.exists` as a serialization discriminator in `cloudstore` · `Noodl.Records` deriving
`_class` from an id · Array Insert/Remove-by-id · component state · the AIX-005 agent global
store · expression `subscribeToChanges` · state-history snapshots · `Noodl.Object` /
`Noodl.Objects` user JS · `modelnode2`/`dbmodelnode2` id-dereferencing · the Repeater's own
`itemActionItemId` output.

**Every one of them resolves an explicit id, so every one of them is in the named tier and is
untouched by this change.** That is not a coincidence — it is the property that made the
name/anonymous split the right cut.

### 2.1 The one behaviour that could in principle have depended on the leak

`cloudstore.js:518–521` is the only production caller of `exists()`:

```js
} else if (_type === 'Array'  && typeof data[key] === 'string' && Collection.exists(data[key])) {
} else if (_type === 'Object' && typeof data[key] === 'string' && (modelScope || Model).exists(data[key])) {
```

It asks "is this string actually a live record id?" to decide whether to serialize a nested
object or write the raw string. This is the one place where a Model surviving its Collection
could be load-bearing. Two reasons it is safe here:

1. `exists()` answers from **both** tiers, so it stays true for as long as there is an object to
   serialize.
2. In the only window where the answer changes — the referent is genuinely unreachable — there
   is no longer any object to serialize, so writing the raw id is the honest outcome. (Before
   this change the branch would have serialized a record that nothing could reach.)

I could not construct a case where existing behaviour genuinely depends on the leak. That is a
negative result from a source audit, **not** from running a real project (§7).

---

## 3. What changed

| File | Change |
|---|---|
| `packages/noodl-runtime/src/weak-registry.ts` | **New.** Generic `WeakRegistry<T>`: id-keyed table that does not retain its entries. `WeakRef` + `FinalizationRegistry`, with key sweeping so the Map itself cannot grow with dead husks. Degrades to a strong table where `WeakRef` is absent. |
| `packages/noodl-runtime/src/model.ts` | Tiered `Model.get`; `exists` reads both tiers; promotion on explicit id; same treatment for `Model.Scope` (its own tier, cleared by `reset()`); added `_registrySize()` diagnostic. |
| `packages/noodl-runtime/src/collection.ts` | Same tiering for `Collection.get`/`create`/`exists`, plus `_registrySize()`. `Array.prototype` patching untouched. |
| `packages/noodl-runtime/test/model-registry-lifetime.test.ts` | **New**, 26 tests. |

### 3.1 Two implementation details that matter

**Mutual reachability of instance and Proxy.** Consumers are handed a `Proxy`, never the
instance. The Proxy holds the instance (as its target); the instance now holds the Proxy via a
symbol-keyed backreference. So the pair is collected together and never half-collected — which
would otherwise let `Model.get(id)` mint a second Proxy over a still-referenced instance and
split identity. Only the instance is weakly referenced.

**`configurable: true` on that backreference is required, not cosmetic.** This was a real bug I
introduced and then caught. `_modelProxyHandler.ownKeys` reports the keys of `target.data`, not
the instance's own keys, and a Proxy must report every *non-configurable* own key of its target.
Defining the slot with `Object.defineProperty`'s `configurable: false` default made
`Object.keys(record)`, `{ ...record }` and `Reflect.ownKeys(record)` **all throw**
`TypeError: 'ownKeys' on proxy: trap result did not include 'Symbol(noodl.model.proxy)'`.

That would have broken every Function node that spreads or enumerates a Noodl Object, and none
of the 20 tests I had written at that point caught it — nothing else in the runtime suite
enumerates a record. There are now six tests that do (`the record Proxy is still fully
enumerable`), and I verified they fail against the non-configurable version before fixing it.

### 3.2 Deliberately not changed

- **`Array.prototype` patching in `collection.ts`** — load-bearing (PLAT-003), untouched.
  Related trap I hit: the patch is installed with `configurable: false`, so **`collection.ts`
  cannot be re-required** (e.g. under `jest.isolateModules`) — the second load throws
  `TypeError: Cannot redefine property`. The no-`WeakRef` fallback test therefore isolates
  `model` only, and says so in a comment.
- **`foreach.tsx`** — `_onNodeDeleted` still does not clear `_internal.collection`. The weak
  tier already releases that collection (and its members) once the Repeater node itself is
  released, so the reported leak is fixed without touching the Repeater. Nulling it in teardown
  would be belt-and-braces, but `mountedOperations` holds closures over
  `this._internal.collection` and I cannot run a preview from a worktree to prove that
  reordering is safe. **Recommended follow-up, not done.**
- **`Model._models = {}` is a no-op** — a latent test bug I found and left alone.
  `model.ts` does `const models = (Model._models = {})`; reassigning the *property* does not
  rebind the closed-over `models`. So `expression-evaluator.test.js:7`'s reset has never done
  anything. I kept reads going through the `models` const precisely to preserve that
  (mis)behaviour rather than change test isolation as a side effect of a leak fix.
  `delete Model._models[id]` does still work, since that mutates the shared object.

---

## 4. The failing-first evidence

The new suite was written to compile and run against the **unfixed** sources, so the
before/after is reproducible: check out `src/model.ts` and `src/collection.ts` at `ed04fc16`,
remove `src/weak-registry.ts`, and re-run. The deterministic assertions use the pre-existing
`Model._models` / `Collection._collections` rather than the new `_registrySize()` for this
reason, and the one place that needs `_registrySize()` reaches it through a documented cast.

Measured **before** the fix:

```
✕ does not register a record whose id it minted itself       Expected: 0    Received: 200
✕ does not register a record created from data with no id     Expected: 200  Received: 400
✕ does not register an anonymous collection                   Expected: 0    Received: 400
✕ promotes an anonymous record when its id is spelled          Expected: 407  Received: 406
✕ holds the named tiers flat across a bounded transcript      Expected: 609  Received: 6419
Tests: 5 failed, 6 skipped, 8 passed, 19 total
```

The headline number is the last one: **a chat bounded to 20 visible messages leaked 5,810
Models over 300 turns** (609 → 6,419). Note that is ~20 per turn, not one — because
`Collection.prototype.set` re-mints a Model for *every* element on *every* `set`, so the leak
rate scales with list length × update count, not with message count. The defect is materially
worse than "one Model per item".

The 8 tests that passed before the fix are the cross-graph-reach guarantees. They are supposed
to pass in both trees — they are the regression guards proving the fix did not break
reach-by-id.

**After** the fix: `Tests: 26 passed, 26 total` (with `--expose-gc`).

---

## 5. Verified

Run directly against this worktree, never through `lerna`.

| Check | Command | Result |
|---|---|---|
| Runtime suite (baseline, before any change) | `jest` in `packages/noodl-runtime` | **973 passed**, 0 failed |
| Runtime suite (after) | same | **993 passed**, 0 failed, 13 skipped |
| DEBT-014 suite incl. GC group | `node --expose-gc … jest model-registry-lifetime` | **26 passed** |
| GC group stability | same, 3 consecutive runs | 19/19, 19/19, 19/19 — no flake |
| No-`WeakRef` degradation | in-suite, via `jest.isolateModules` with the globals deleted | passes — retained, found, no crash |
| viewer-react suite | `jest` in `packages/noodl-viewer-react` | **59 passed**, 0 failed |
| Runtime typecheck | `tsc -p packages/noodl-runtime/tsconfig.json` | clean |
| Declaration emit | `tsc -p tsconfig.types.json` + `copy-handwritten-types.js` | clean; `weak-registry.d.ts` emitted, no dangling import |
| viewer-react typecheck | `tsc -p packages/noodl-viewer-react/tsconfig.json --noEmit` | clean (resolves runtime via `dist-types`) |
| viewer-cloud typecheck | `tsc -p packages/noodl-viewer-cloud/tsconfig.json --noEmit` | clean (the only `Model.Scope` consumer) |
| editor typecheck | `tsc -p packages/noodl-editor/tsconfig.json --noEmit` | clean |

Memory is *actually* released, not merely unregistered — the GC-gated group proves collection
via `WeakRef.deref()` after forced GC, including that a dropped anonymous collection releases
the 200 Models it held, and that a record still held by a live collection (or by a second
collection) is **not** collected.

Root `tsc -p tsconfig.json` reports 18 errors, all `TS2307: Cannot find module
'@noodl-versioning'`. Pre-existing and unrelated: `@noodl-versioning` is mapped in
`packages/noodl-editor/tsconfig.json` but not in the root config, I did not touch either file,
and none of the 18 errors is in a file I changed. The editor's own tsconfig is clean.

---

## 6. Known and deliberate remaining bound

**Named records are still process-lifetime.** A Repeater over rows fetched from a backend gets
records keyed by `objectId` — named, therefore strong, therefore retained for the life of the
page. An app that streams thousands of *DB-backed* rows through a bounded list still grows.

This is intentional, not an oversight: freeing them is precisely what would break the twelve
paths in §2. Narrowing it further is a separate decision (reference-counted or explicitly
scoped named records) and should not be smuggled in under a leak fix.

Practically, the reported AIX-005 case is covered because `TextAccumulator.messages` is an
array of plain **strings** with no ids, so every record the Repeater derives from it is
anonymous. An author who hand-assigns `{ id: 'msg-' + n, … }` opts back into retention — and
into durable reach-by-id, which is the trade they are making.

---

## 7. NOT verified — explicitly

1. **Nothing was run in the real app.** No Electron editor, no preview, no packaged build. A
   worktree cannot do this: `lerna exec` runs the *main* checkout, so anything "verified" that
   way would describe a different tree. Everything above is jest + `tsc` in this worktree.
2. **The spec's "verify against the corpus" is NOT done.** I did not run the project corpus.
3. **The spec's "confirm AIX-005's agent-chat example no longer grows unboundedly" is NOT done
   as written.** I confirmed the *mechanism* (a Repeater-shaped workload keeps both registries
   flat, and the accumulator's items carry no ids so they land in the weak tier). I did not open
   the example and watch heap over a long conversation.
4. **No heap-profiler measurement.** Evidence is registry-entry counts plus `WeakRef` liveness,
   not `process.memoryUsage()` or a DevTools snapshot. Registry entries were the leak's
   mechanism, but a real heap trace would be stronger.
5. **Browser GC behaviour unverified.** Collection was proven under Node 22 with `--expose-gc`.
   `WeakRef`/`FinalizationRegistry` are ES2021 (Chrome 84+, Safari 14.1+, Firefox 79+) so
   Electron is fine, but I have not observed a real browser actually reclaiming these.
6. **The no-`WeakRef` path is verified only by deleting the globals in Node**, not on a genuinely
   old engine.
7. **`Model.Scope` tiering is untested against a live cloud function.** The scope path has no
   test coverage in the repo at all; it typechecks and its `reset()` clears the new tier, and
   that is the whole of the evidence.
8. **Long-session soak untested.** The transcript test is 300 turns in milliseconds, not an app
   left open for hours.
9. **`foreach.tsx` teardown unchanged** — see §3.2.
10. **Concurrency/merge:** committed on the worktree branch only, not merged to `cline-dev`.
