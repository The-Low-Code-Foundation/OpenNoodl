# NDA-002: The Reactivity Contract

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-002 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical — the phase's headline defect |
| **Difficulty** | 🟠 Medium–High — the change is small, the blast radius is the whole library |
| **Estimated Time** | 1–2 weeks |
| **Prerequisites** | NDA-001 (the corpus must be red first) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for §1 (the contract), then 🟠 **Opus 4.8** for §2–4 |

## Objective

Write down what "changed" means, then make `Collection`, `Variable` and `States` obey it. Today each
answers differently, and the difference is invisible to the author — which is the whole complaint.

## §1 — The contract (decide this first, it is expensive to reverse)

The proposed rule, for review before implementation:

> **Any observable mutation of a Noodl value notifies its listeners, exactly once per mutation,
> synchronously, regardless of which API performed it.**

Three clauses, each of which rules something out:

- **"any observable mutation"** — not "any mutation performed through a blessed verb". This is the
  clause that kills the current five-verbs-out-of-fifteen behaviour.
- **"exactly once per mutation"** — a bulk operation notifies per change, not per call, and not per
  call *and* per change. `Collection.set` currently emits an `add`/`remove` **and** a `change` per
  item (`collection.ts:196-233`), so replacing a 100-item collection emits 200 notifications.
- **"synchronously"** — `Collection.notify` is currently `async` and `await`s each listener
  (`collection.ts:171-179`), so `arr.add(x)` settles a turn after the caller expects. `Model.notify`
  is synchronous (`model.ts:284-292`). They must agree, and `Model` is the one that is right.

**Open question for Richard:** should a mutation performed *inside* a listener coalesce? The runtime
has cycle breakers at `outputproperty.ts:123` (500 sends/iteration) and `node.ts:495` (100
iterations), which suggests the answer today is "no, and we catch the loop". Making `push` notify
increases how often that path is hit. Recommend keeping the breakers and *raising a warning through
the NDA-004 error channel* rather than adding coalescing, which would reintroduce the `States`
class of "your change was silently discarded".

## §2 — Make `Collection` notify on all mutations

`Collection` is not a class; it is properties patched onto `Array.prototype`
([`collection.ts:63-235`](../../../packages/noodl-runtime/src/collection.ts#L63-L235)). Notifying
verbs: `add`, `addAtIndex`, `remove`, `removeAtIndex`, `set`. Silent: `push`, `pop`, `shift`,
`unshift`, `splice`, `sort`, `reverse`, index assignment, `length` assignment.

Two candidate approaches. **Recommend B.**

**A — patch the mutating prototype methods.** Wrap `push`/`splice`/… to notify. Cheap, and covers
R1/R2/R5 in the corpus. Does **not** cover R3 (`arr[0] = x`) or R4 in the general case, and adds more
`Array.prototype` patching to a file whose existing patching is already a documented hazard.

**B — hand out a `Proxy`, as `Model` already does.** `Model.get` returns a Proxy so `record.title = 'x'`
writes through to `set` ([`model.ts:97-120`](../../../packages/noodl-runtime/src/model.ts#L97-L120)).
The same pattern on collections covers *every* mutation including index and `length` assignment,
matches the precedent set by the other half of the data model, and removes the need for `items` to
be a leak.

The blocker for B is `items`:

```js
// collection.ts:63-71 — hands out the raw array
Object.defineProperty(Array.prototype, "items", { get() { return this; } });
```

`items` must return the Proxy, not `this`. That is the actual fix for R4 and for Richard's reported
symptom, and it is a **behaviour change for existing projects** — code doing `arr.items.forEach(…)`
keeps working, code relying on `arr.items === arr` does not. Search the QA fixture and the docs-repo
library content before committing to it.

⚠️ `Array.prototype` patching is load-bearing (recorded in PLAT-003). Do not remove the existing
patches as part of this task; add the Proxy alongside and migrate `items` only.

## §3 — `Variable`: stop swallowing the first change

[`variablebase.ts:96-106`](../../../packages/noodl-runtime/src/nodes/std-library/variables/variablebase.ts#L96-L106)
fires `changed` only when `currentValue !== value`, and `initialize` seeds `currentValue` with
`startValue` — so setting a Variable *to* its start value fires nothing. Corpus R7.

The `!==` guard is right in principle and should stay. What is wrong is that the seeded initial value
is indistinguishable from a value the author set. Track initialisation explicitly (a `hasBeenSet`
flag) rather than inferring it from equality.

## §4 — `States`: stop discarding coalesced transitions

The bug, in full:

```ts
// states.ts:416-428
scheduleGoToState(state) {
  this._internal.goToState = state;
  if (this.hasScheduledGoToState) return;   // second call only overwrites the target
  ...
}
// states.ts:430-434
goToState(state) {
  if (internal.state === state) return;      // ...and if it overwrote back to the current state,
                                             //    nothing fires at all
}
```

A→B→A in one pass produces **no** `stateChanged`, no `reached-*`, and no port updates. Corpus R8/R9.

Coalescing itself is defensible — a state machine animating between values should not start two
transitions in a frame. What is not defensible is coalescing to a no-op *silently*. Minimum fix:
when the coalesced target equals the current state but intermediate states were requested, still
fire `stateChanged` and the `reached-*` port for the settled state. Preferred fix: queue the
transitions and run them, which is what an author wiring A→B→A actually meant.

Note the separate, deliberate first-transition swallow at
[`states.ts:407-412`](../../../packages/noodl-viewer-react/src/nodes/std-library/states.ts#L407-L412)
(`valuesAreInitialised`). Leave it — it is intentional — but document it on the node, because it
contributes to the impression that the node fires at random.

## Success criteria

1. Corpus rows R1–R9 green; R6 and R10 still green.
2. The contract from §1 is written into `dev-docs/reference/` as a reference document, not just into
   this task file — nodes written after this phase have to be able to find it.
3. No new cyclic-loop warnings in the QA fixture, and no render regressions in the screenshot corpus.
4. Live-verified in the editor with the `run-editor` skill, not only under jest. ⚠️ `--target=editor`
   silently attaches to the preview window; use `--target=dashboard`.

## Risks

- **B changes `items` semantics.** Highest-risk item in the phase. Audit consumers first.
- **More notifications means more update work.** The Repeater and the Cloud Data nodes are the
  likeliest places for a perf regression; measure the QA fixture before and after.
- **`Collection.set` already double-notifies** (`add`/`remove` *and* `change`). Fixing that inside
  this task is correct per §1 clause 2, but it is a second behaviour change — land it separately
  from the Proxy work so a bisect can tell them apart.
