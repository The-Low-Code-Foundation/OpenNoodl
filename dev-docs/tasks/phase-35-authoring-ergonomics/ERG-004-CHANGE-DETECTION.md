# ERG-004 — Change detection inside objects and arrays

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Prerequisites** | NDA-002 (the reactivity contract — done, and it is what makes this cheap) |
| **Recommended executor** | Sonnet for §1–§2; 🔴 Opus for §3, the per-item watching, because it is a lifecycle problem |
| **Origin** | Richard, 2026-08-01 |

## The ask

> I would love to have the value changed node be able to detect in objects: same object, new key
> added or one key value changes, or object id has changed. For arrays: the length has increased or
> decreased, one of the objects in the array has changed id, one of the objects in the array has
> changed its form (new key, new key value, etc) but maybe that's a step too far and not useful?

**It is not a step too far. Four of the five are already being broadcast and nothing is listening.**

## §0 — What the runtime already carries (measured 2026-08-01)

| What Richard asked for | Status |
|---|---|
| Object: which key changed, and its old → new value | **Already carried.** `Model.notify('change', { name, value, old })` on every write — `model.ts:308`, `:318`, `:346` |
| Object: a *new* key was added | **Already derivable** — the same event with `old === undefined` |
| Object: the object id changed | **Already** what `Value Changed` does — it is the identity comparison |
| Array: length up / down, which item, at which index | **Already carried.** `Collection.notify('add' \| 'remove', { item, index })` — `collection.ts:206`, `:212`, `:600`, `:624`, `:637` |
| Array: an item *inside* it changed | **The one genuinely new piece.** A Collection does not watch its members |

This is a dividend of NDA-002: making the data layer notify correctly produced a fine-grained event
stream that no node consumes.

### What `Value Changed` does with it today

```
set: function (value) {
  if (this._internal.lastValue === value) { return; }   // identity, and that is all
  ...
}
```

[`valuechanged.ts`](../../../packages/noodl-viewer-react/src/nodes/std-library/valuechanged.ts).
The port's own description already admits the limitation — *"changes are detected by identity, so
editing an Object or Array in place is not a change here"* — which is honest and useless. Every one of
the events above is discarded.

### ⚠️ And the gap in the plumbing

`Collection.notify('change')` at `collection.ts:180` and `:192` is **bare — no payload.** That is the
whole-array-replacement path. So a wholesale `set` can report *that* the array changed and nothing
about how. Either enrich those two calls or have the node report `Replaced` and be explicit that it
knows no more.

## §1 — Shape: new nodes, not modes on `Value Changed`

**Two new nodes — `Object Changed` and `Array Changed`** — rather than overloading `Value Changed`
with a mode enum.

Reasons, all of them things phase 30 measured:

- A mode enum makes the node's ports dynamic, and **dynamic ports are second-class**: `nonexistentPort`
  *skips* their connections instead of checking them (NDA-009 §2 chose static ports over an enum for
  exactly this), and three of the four dynamic-port mechanisms carry no `description` channel at all
  (FINDINGS **SR-ii**).
- `Value Changed` keeps working, unchanged, for the case it is right for.
- Each node's ports can be static, documented, and visible to the catalog, the validator and the AI
  loop.

### `Object Changed`

| Port | Kind | Meaning |
|---|---|---|
| `Object` | input | The object to watch |
| `Key Added` | signal | A key that did not exist now does |
| `Key Changed` | signal | An existing key's value changed |
| `Object Replaced` | signal | The input is now a *different* object (today's identity change) |
| `Key` | output | Which key the last signal was about |
| `Value` / `Previous Value` | output | New and old |

### `Array Changed`

| Port | Kind | Meaning |
|---|---|---|
| `Array` | input | The array to watch |
| `Item Added` / `Item Removed` | signal | With `Index` and `Item` |
| `Item Changed` | signal | §3 — an object *inside* the array changed |
| `Array Replaced` | signal | A different array arrived |
| `Index` / `Item` / `Count` | output | |

⚠️ **Announce after you update, and emit the signal last.** The single most-repeated defect in phase 30
is a signal sent before the values it describes — four nodes, across three categories, and in each of
them carrying data alongside a signal was the node's entire purpose (FINDINGS **NV-ii**). These two
nodes are that exact shape and will get it wrong by default.

⚠️ **And a test that exercises the node once cannot see it.** NV-ii's second half: whether the class is
*visible* depends on whether the paired value port held a non-`undefined` value at connect time. "Does
a test catch it" is not the test — write the row that drives it twice.

## §2 — Build order

1. **`Object Changed` first.** Every signal it needs is already in the event payload, so it is pure
   consumption and it proves the shape.
2. **`Array Changed` minus `Item Changed`.** `add`/`remove` are carried; the bare `change` needs the
   §0 decision.
3. **§3 last**, on its own, because it is the only part with a new mechanism.

## §3 — ⚠️ Per-item watching is a lifecycle problem, and this phase has a bad record with those

Watching the objects *inside* an array means subscribing to each member's `change` and unsubscribing
when it leaves, when the array is replaced, and when the node is deleted.

**Phase 30 found five separate listener/timer leaks, and the defining property was never the folder:**

- `Drag` leaked a snap timer on unmount and delete — the fifth site of SR-vi's shape and the first
  outside Animation/Utilities, *"because the defining property is `createTimer`, not the folder."*
- `Dropdown` re-sent a collection and left **two** `change` listeners behind, and never removed the
  listener on delete at all — three defects in an eleven-line setter.
- The deprecated `Animation` node held *n+1* timers, none stopped.

`Dropdown` is the near-exact precedent: a node subscribing to a collection's `change`. Read its fix
before writing this, and use the `addDeleteListener` shape `Drag` uses.

Requirements:

- Unsubscribe on: item removed, array replaced, input cleared, **node deleted**.
- A corpus row for each of those four, and one that adds and removes 100 items and asserts the
  listener count returns to its start.
- ⚠️ **A new warning beside a green test count is a signal.** Phase 30's Data batch grew *"a worker
  process has failed to exit gracefully"* with 0 failures, and it took a bisect to find an open
  transaction holding a rollback timer. The bar is **0 failures *and* no new noise.**

## Success criteria

1. `Object Changed` reports key-added, key-changed and replaced, each with the key and both values,
   and each pinned by a corpus row driven **twice** so the signal-before-value class cannot hide.
2. `Array Changed` reports add and remove with index and item.
3. The `Collection.notify('change')` payload decision is recorded — enriched, or reported as
   `Replaced` and documented as carrying no detail.
4. `Item Changed` fires for an in-place edit of an object inside the array, and the listener count
   returns to baseline after 100 add/remove cycles and after node deletion.
5. `Value Changed` is unchanged, and its description still says what it does not do.
6. All ports documented; catalog regenerated; all three catalog gates pass.
7. ⚠️ Live QA — these nodes need a real frame clock, which `renderToStaticMarkup` cannot provide.
   Three Visual fixes are still owed live verification for exactly this reason; do not add a fourth.
