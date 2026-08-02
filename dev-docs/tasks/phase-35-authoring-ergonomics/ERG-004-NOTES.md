# ERG-004 — build notes

Built 2026-08-02, in the spec's order: `Object Changed`, then `Array Changed` (§2 and §3
together, see the deviation below). Every claim here is measured; where measurement and the
spec disagree, the spec has been corrected in place and the correction is listed in §3.

---

## §0 — the payloads, re-measured

Pinned by `packages/noodl-runtime/test/corpus/erg-004-s0-event-payloads.test.ts`, so these stay
checkable rather than being a snapshot of one afternoon.

| §0 claim | Verdict |
|---|---|
| `Model.notify('change', { name, value, old })` at `model.ts:308`, `:318`, `:346` | **Holds**, all three lines, exact payload |
| A new key is the same event with `old === undefined` | **Holds** |
| `Collection.notify('add'\|'remove', { item, index })` at `collection.ts:206`, `:212`, `:600`, `:624`, `:637` | **Holds**, all five lines, exact payload |
| `Collection.notify('change')` at `:180`, `:192` is bare | **Holds** — it carries no payload |
| …and that is **the whole-array-replacement path**, so a wholesale `set` "can report *that* the array changed and nothing about how" | **WRONG.** See below |

One further measurement the spec did not make, and which changes nothing but is worth having:
`Model.set` does not notify at all when the value is unchanged (`model.ts:344`). Identity
guarding is the runtime's job on this path, not the node's.

### The one premise that did not survive

`notifyChange` is **not** a replacement path. It is the *coalesced companion* to every
structural event:

- `announceAdd` calls it (`collection.ts:207`) and so does `announceRemove` (`:213`), so every
  `add` and every `remove` is followed by one `change`.
- `withBatch` holds it back so that one logical operation emits one `change` however many items
  it moved — that is all `:180` is: the flush at the end of a batch.
- `Collection.set` runs its **whole diff inside `withBatch`** (`:512`). So replacing a
  collection's contents emits a full per-item `add`/`remove` stream *and then* one summary
  `change`.

So the detail §0 believed was unavailable on the replacement path is already being broadcast,
item by item, on the events beside it. `erg-004-s0-event-payloads.test.ts` row S0-C pins this;
`erg-004-array-changed.test.ts` row AC-4 pins the same fact as observed through the node.

There is exactly one mutation class that emits `change` **alone**, with no `add`/`remove`:
a reorder or in-place overwrite — `sort`, `reverse`, `fill`, `copyWithin` (`:277`) — and
growing an array by writing `length`, which leaves holes rather than items (`:387`).

## §0 decision — `Collection.notify('change')` was NOT enriched

**Decision: leave both call sites exactly as they are.** Three reasons, in order of weight.

1. **There is nothing to enrich it with.** Line `:180` is a batch flush covering *N*
   heterogeneous events — some adds, some removes, at different indices. No `{ item, index }`
   describes it. The only honest payload would be an array of the events already emitted
   individually, which is a strictly worse copy of what the listener has already received.
2. **The information the spec wanted is already there.** A node that listens to `add`/`remove`
   knows exactly which items arrived and left in a wholesale `set`. `Array Changed` does, and
   AC-4 proves it. Enriching `change` would add a second, redundant channel for the same facts.
3. **Fourteen production consumers treat it as a payload-free ping.** `collectionnode2`,
   `filtercollectionnode`, `mapcollectionnode`, `foreach`, `dbcollectionnode2`,
   `filterdbmodelsnode`, `options` and the deprecated twins all take `change` to mean "re-read
   the collection" and ignore its argument. Adding a payload would be additive and harmless
   today, but it would create a shape that looks authoritative and is not — a summary that
   necessarily lies for any batch of more than one event.

The instruction to check the autosave allowlist before enriching was followed and is moot,
since nothing was changed. For the record: the allowlist is sensitive to *which events fire*,
and this decision fires exactly the events that fired before.

**What the node reports instead.** `Array Changed` consumes `add` and `remove` for its signals
and derives `Array Replaced` from the *input port's* identity, not from `change`. `change` is
used for one narrow purpose — repairing `Count` after a reorder or a `length` write, which move
an array with no structural event — and sends no signal and re-sends `Count` only when it
actually differs. The consequence is stated on the ports and in the enrichment: **a pure
reorder is not reported as a change**, because nothing was added or removed.

---

## §1 — the defect the "drive it twice" rule caught, which was not in this node

This is the most useful thing the build found, and it is a general runtime hazard that is not
written down anywhere else.

`Node.prototype.sendValue` returns early when the value is `undefined` (`node.ts:706`), so a
port whose first emit is `undefined` queues **nothing** on the receiver. The receiver drains its
input queues with:

```js
const inputNames = Object.keys(this._inputValuesQueue);   // node.ts:566
```

— **insertion order of the queue keys**, and each key is created lazily on that port's first
delivery. So a value port that was `undefined` the first time has its key created *after* the
signal port that did fire, and from then on is drained **after that signal, permanently**.

That is `NV-ii` — a signal arriving before the value it describes — reached by a cause phase 30
did not record: the node's own ordering was already correct (values written, all outputs
flagged, signal last) and was defeated underneath by queue-key creation order.

It cost `Previous Value` on the second and every subsequent `Object Replaced`. A row that drove
the node once could not see it: on the first pass "there was no previous value" and "the value
did not arrive" are the same observation. Row **OC-3b** exists to pin it.

**The fix is also the contract-correct spelling.** A value port emits `null`, never `undefined`
(`emptyToNull` in both node files). Per `EMPTY-VALUE-CONTRACT.md`, `undefined` on a port means
"no opinion", and "there was no previous value" is a statement, not an abstention. No
information is lost: `Key Added` and `Key Changed` already distinguish "the key did not exist"
from "it held null".

**This is worth generalising and is left as a finding, not a fix:** any node in the library that
pairs a signal with a value port that can be `undefined` on its first emit has this bug latent.
Auditing for it is not in ERG-004's scope.

### Two crash-shaped traps guarded on the way in

- **`Model.instanceOf(null)` throws.** It reads `(value as { target? }).target` after the
  `instanceof` check fails (`model.ts:260`). Both nodes test for nullish first.
- **Arrays carry `on`/`off`.** `collection.ts:643` installs them on `Array.prototype`, so a
  duck-type test for `typeof x.on === 'function'` says yes to every array — and an array's
  `change` payload is `undefined`, so a Model-shaped listener would read `.name` off nothing.
  `Object Changed` declines arrays outright.

### Also measured, because the obvious spelling does nothing

`push` on a **bare** array is silent. The nine mutator wrappers live on the collection Proxy
(`collection.ts:356-428`), and a raw array never goes through it, so `push` is the native
method. `add` is an `Array.prototype` patch (`:590`) and notifies on any array; `arr.items.push(x)`
notifies too, because `items` returns the Proxy. Row AC-7 pins all three, and the enrichment
warns authors about it.

---

## §2 — deviations from the spec, and why

1. **§2 and §3 landed in one commit, not two.** The spec asks for `Array Changed` minus
   `Item Changed` first. The per-item lifecycle is the whole difficulty of the node and it
   reaches into the same `set` handler, the same unbind method and the same delete listener;
   splitting it would have meant writing the binding path twice and landing an intermediate
   state whose lifecycle rows did not yet exist. `Object Changed` still landed first and alone,
   which is what the build order was for — proving the shape on pure consumption.

2. **`Array Changed` has a `Key` output the spec's port table does not list.** The spec lists
   `Index` / `Item` / `Count`. Richard's ask was "one of the objects in the array has changed
   its form (new key, new key value)" — *which* key is the substance of that, and it is the one
   fact not recoverable from `Item` downstream. One static port, documented, no dynamism.

3. **Namespaced type names** (`net.noodl.ObjectChanged`, `net.noodl.ArrayChanged`) with
   `displayName`, rather than the bare names the rest of the `Logic` category uses
   (`Condition`, `And`, `Switch`, `Value Changed`). Every node added to this repo recently is
   namespaced — `net.noodl.SSE`, `net.noodl.TextAccumulator`, `net.noodl.controls.options` —
   and a bare name is a collision surface. Deviation is from local convention, not from the spec.

4. **`Object Replaced` / `Array Replaced` clear `Key` and `Index` rather than leaving them.**
   A replacement implicates no single key or index, and a stale key beside a fresh signal is
   the same defect class the node exists to avoid, one port over. Rows OC-3 and AC-3 pin it.

5. **The corpus lives in `packages/noodl-runtime/test/corpus/` although the nodes live in
   `packages/noodl-viewer-react/`.** `helpers/node-harness.ts` is native there;
   `noodl-viewer-react`'s tsconfig compiles at `module: es6` and excludes `tests`. The corpus
   already crosses this boundary in the other direction, and the node modules import nothing
   but `@noodl/types`, so they compile cleanly in the runtime's program. Both node files *are*
   typechecked by that run, via ts-jest.

6. **`Collection.notify('change')` unchanged** — §0 above.

---

## §3 — corrections written back into the spec

`ERG-004-CHANGE-DETECTION.md` §0 has been corrected: the "⚠️ And the gap in the plumbing"
section claimed `:180`/`:192` was the whole-array-replacement path carrying nothing about how a
`set` changed the array. It now states what was measured, names the test that pins it, and
records the decision not to enrich. The five payload claims that held are marked as verified
with the date, so a later reader can tell measurement from inheritance.

---

## §4 — could not verify

Named explicitly, because an unchecked claim is not a result.

1. **Success criterion 7 — live QA. NOT DONE, and it is the headline gap.** The editor takes a
   single-instance lock and another session held it for this whole build; the spec also notes
   these nodes need a real frame clock that `renderToStaticMarkup` cannot provide. Nothing in
   this task has been seen running in the editor or a browser.

   What a later session must actually drive — this is the list, not a gesture at one:

   - Both nodes appear in the node picker under **Logic**, with the display names
     `Object Changed` and `Array Changed`, and their ports carry the descriptions written here.
   - Wire an **Object** node → `Object Changed`, and a Text node to `Key`, `Value` and
     `Previous Value`. Edit a property in the editor **twice**. The values shown must be the
     ones the signal is about, both times — that is the class OC-3b caught in jest, and it is
     the one a frame clock could still reintroduce, because a real graph batches within a frame
     where the corpus settles between events.
   - Set a key that does not exist and confirm **Key Added** fires and **Key Changed** does not;
     then edit it and confirm the reverse.
   - Wire an **Array** node → `Array Changed` with `Count` on screen. Add and remove items and
     confirm Index and Item track. Then **sort** the array and confirm no signal fires and Count
     stays correct.
   - Edit an object *inside* the array and confirm **Item Changed** fires with the right `Key`
     and `Index`.
   - Delete an `Array Changed` node while its array is still live, then mutate the array, and
     confirm nothing throws and nothing re-renders. That is the leak `Dropdown` actually had,
     and jest checks it by counting listeners — a real run checks it by not misbehaving.
   - The editor's Problems panel must be clean for a graph using both nodes.

   ⚠️ Three Visual fixes were already owed live verification for exactly this reason. This is a
   **fourth** debt, recorded rather than disguised.

2. **`npm run typecheck:viewer` could not be run.** It resolves `@noodl/runtime` through the
   symlinked `node_modules` to the *primary checkout's* sources and needs `build:types` run
   there first, which is a write to another session's tree. The two new node files were
   typechecked directly (`tsc --noEmit` with the viewer's target/module settings) and by
   ts-jest under the runtime's program; both clean. The full viewer program was not.

3. **`npm run test:packages`, `test:ci`, `test:platform` were not run** — they go through
   `lerna exec`, which resolves package roots to the primary checkout. The runtime package's
   suite was run directly with `npx jest` instead; the viewer package's was not run at all, and
   nothing in this task changes a file that its suites cover except `register-nodes.js`
   (two appended lines).

4. **`catalog:examples` is red, and was red at the base commit `2a1138a8`.** Three
   `nonexistent-port` errors — `Number.stored`, `CollectionNew.created`, `String.stored` — from
   examples left behind by ERG-001's port renames. Verified as pre-existing rather than assumed:
   the structural catalog diff against the base is *purely additive* (209 insertions, 0
   deletions, and the only new typeNames are the two added here), and `Number`'s outputs at the
   base commit are `changed/completed/done/savedValue/unchanged` with no `stored`.
   `docs/node-catalog/examples/` is outside this task's territory.

5. **Neither new node has a worked example**, so `catalog:merge:check` emits the same "no
   examples listed" warning it already emits for three existing nodes. Adding one means adding
   a file under `docs/node-catalog/examples/`, which is outside this task's territory. Debt.

6. **The generalised `undefined`-first-emit audit from §1 was not done.** The hazard is fixed in
   these two nodes and documented; how many other nodes pair a signal with a possibly-undefined
   value port is unmeasured.

---

## §5 — test results

Run with a custom reporter, because the default one crashes in `@jest/reporters/getResultHeader`
with `Cannot find module 'terminal-link'` and aborts mid-run looking exactly like a failure.

| Run | Suites | Tests | Failures |
|---|---|---|---|
| `packages/noodl-runtime`, whole package, **with** ERG-004 | 111 passed / 112 | 2089 passed, 13 pending | **0** |
| same, **excluding** the three ERG-004 files (baseline) | 108 passed / 109 | 2044 passed, 13 pending | **0** |
| Delta | +3 suites | +45 tests | — |

**Noise: none added.** The bar was "0 failures *and* no new noise". Stderr for the full run
contains exactly one warning — `ExperimentalWarning: SQLite is an experimental feature` — and
the baseline run excluding the ERG-004 files produces the identical warning, so it is
pre-existing. No "worker process has failed to exit gracefully", which is the specific shape
phase 30's Data batch grew.

`npx eslint` on all five new/changed source files: clean.
`tsc -p packages/noodl-runtime --noEmit`: clean.

## §6 — success criteria

| # | Criterion | Status |
|---|---|---|
| 1 | `Object Changed` reports key-added / key-changed / replaced with key and both values, each pinned by a row driven **twice** | **Met.** OC-1, OC-2, OC-3, and OC-3b for the ordering class the double drive exposed |
| 2 | `Array Changed` reports add and remove with index and item | **Met.** AC-1, AC-2 |
| 3 | The `Collection.notify('change')` decision recorded | **Met.** Not enriched; §0 above, with reasoning and the measurement that overturned the premise |
| 4 | `Item Changed` fires for an in-place edit; listener count returns to baseline after 100 add/remove cycles and after deletion | **Met.** AC-5, and AC-6 with a row for each of the four unsubscribe cases plus two 100-cycle checks in both orders |
| 5 | `Value Changed` unchanged, description still says what it does not do | **Met.** `git diff` against the base for `valuechanged.ts` and `value-changed.json` is empty |
| 6 | All ports documented; catalog regenerated; all three catalog gates pass | **Partially met.** Ports documented, catalog regenerated, 153/153 enriched. `catalog:check` and `catalog:merge:check` green. `catalog:examples` **red, pre-existing at the base commit** and outside this territory — see §4.4 |
| 7 | Live QA | **Not done — blocked.** Editor lock held by another session. Debt named in §4.1 with the specific list to drive |
