# The Reactivity Contract

**Status:** Normative. Decided 2026-07-29 (phase 30, NDA-002 §1); decisions confirmed by Richard.
**Applies to:** every stateful value in the runtime — `Model` (Noodl.Object), `Collection`
(Noodl.Array), Variables, `States`, and any node added after this date that holds observable state.
**Enforced by:** the NDA-001 behaviour corpus (rows R1–R10). A stateful node that cannot satisfy
these rules must document the exception on the node itself, not merely diverge.

## The rule

> **Any observable mutation of a Noodl value notifies its listeners, exactly once per mutation,
> synchronously, regardless of which API performed it.**

Each clause is load-bearing:

### "Any observable mutation"

Not "any mutation performed through a blessed verb". If code — a Function node, a workflow step, an
exported module, user JS — can change the value in a way a subsequent read can observe, listeners
are told. This is the clause that outlaws the historical `Collection` behaviour where exactly five
verbs (`add`, `addAtIndex`, `remove`, `removeAtIndex`, `set`) notified and the other ten-plus ways
of mutating an array (`push`, `splice`, `sort`, `arr[0] = x`, `arr.length = 0`, …) were silent.

Consequences:

- A value type must not hand out a raw mutable reference to its backing store. `Collection.items`
  returning `this` (the raw patched array) is the canonical violation: the moment a caller holds the
  raw array, every mutation bypasses notification. Hand out a `Proxy` that writes through, as
  `Model.get` already does (`model.ts` — `_modelProxyHandler`).
- "Observable" is judged from the outside. Internal bookkeeping (caches, private copies) may change
  freely; the moment the change is visible through the public read API, it notifies.

### "Exactly once per mutation"

- One logical mutation → one notification to each listener. A bulk operation notifies **per change,
  not per call and not per call *and* per change**. `Collection.set` replacing a 100-item collection
  must not emit 200 events (the historical `add`/`remove` + `change`-per-item behaviour,
  `collection.ts:196-233`, violates this).
- Setting a value to the value it already holds is **not** a mutation and must not notify. The
  `!==` guard is the correct default (`Model.set`, `variablebase.ts:98`). Two corollaries:
  - The guard must compare against what the *author* last observed, not against internal seeding.
    A Variable seeded with its `startValue` at initialise time has never been *set*; the first
    explicit set fires `changed` even if it equals the start value. Track "has been set"
    explicitly (a flag), never infer it from equality (corpus R7).
  - `NaN` must never be stored, because `NaN !== NaN` turns the guard into "always changed,
    forever". See the Empty-Value Contract.
- Coalescing that can *discard* a transition is a violation. `States` A→B→A in one frame emitting
  zero signals (`states.ts:416-434`) is the canonical case: an author who requested two transitions
  observed none. Coalescing the *animation* is fine; coalescing the *notification to nothing* is not
  (corpus R8/R9).

### "Synchronously"

The notification runs before the mutating call returns. `Model.notify` is synchronous and is the
reference implementation; `Collection.notify` being `async` and `await`ing each listener
(`collection.ts` — `notify`) is the violation: `arr.add(x)` settles a turn after the caller expects,
and a throwing listener rejects a promise nobody holds. Listener exceptions must surface through
the runtime error channel (Failure Contract, NDA-004), not vanish into an unhandled rejection.

## Mutations inside listeners (decided: no coalescing)

A mutation performed inside a change listener notifies immediately and synchronously, like any
other. The runtime does **not** batch or defer it. Infinite loops remain the author's
responsibility, guarded by the existing cycle breakers — 500 sends per iteration
(`outputproperty.ts:123`) and 100 update iterations (`node.ts:495`). When a breaker trips it must
**say so through the runtime error channel** (NDA-004), naming the node, rather than silently
stopping. Rationale: deferred/coalesced delivery reintroduces the `States` class of "your change
was silently discarded", which is the defect class this contract exists to eliminate.

## Collection notification mechanism (decided: Proxy, like Model)

`Collection` adopts the `Model` pattern: consumers receive a `Proxy` whose mutation traps notify.
This is the only mechanism that covers index assignment and `length` assignment, and it retires
`items`-as-leak — `items` returns the Proxy, not the raw array.

Compatibility notes, binding on the implementation (NDA-002 §2):

- `arr.items.forEach(…)` and all read paths keep working. Code relying on `arr.items === arr`
  (reference identity with the raw array) is the one behaviour change; audit the QA fixture and the
  docs-repo library content before landing.
- The existing `Array.prototype` patches are **load-bearing** (PLAT-003). Add the Proxy alongside;
  do not remove patches in the same change.
- `items` already has a *setter* delegating to `set(data)` — preserve it on the Proxy.

## Event vocabulary

Listeners subscribe to at minimum:

- `change` — fired for every observable mutation, with `{ name?/index?, value, old }` where the
  shape applies. This is the event the fourteen `on('change')` consumers in the node library rely
  on.
- `add` / `remove` (collections) — fired *in addition to* `change` for structural mutations, with
  `{ item, index }`. "Exactly once" is judged per event stream: one `add` + one `change` for one
  insertion is one notification of each kind, not a double-fire.

## Escape hatches

`silent: true` and `forceChange: true` (as on `Model.set`) remain available. They are per-call,
author-explicit opt-outs — a node must never make silent the default, and a silent write is the
caller accepting that downstream will not know.

## Conformance

| Corpus row | Behaviour pinned |
|---|---|
| R1–R5 | `push` / `splice` / `arr[0]=x` / `items.push` / `length=0` all notify |
| R6, R10 | the already-correct verbs stay correct |
| R7 | first explicit set to `startValue` fires `changed` |
| R8, R9 | `States` A→B→A observably fires; `reached-*` for requested states |

A new stateful node is not done until it has corpus rows of its own.
