# FH-022 — When `Completed` is `Done`, the port should say so

Out of [TALK-006](TALK-006-THE-THREE-SIGNALS.md) decision 1 (had 2026-08-05). Covers the half of
reported item **0** that words can fix on their own, plus the `Counter.Reset` defect that rode along.

## The mechanism

On **8** of the 82 outcome-contract nodes there is no `Unchanged` port and no `Failure` port, so
`Done` and `Completed` fire on the same path, every time, with nothing between them. Measured from
the generated catalog:

| Type | Display name | Category |
|---|---|---|
| `Collection2` | Array | Data |
| `CollectionNew` | Create New Array | Data |
| `Condition` | Condition | Logic |
| `NewModel` | Create New Object | Data |
| `Page` | Page | Visual |
| `Unique Id` | Unique Id | String Manipulation |
| `net.noodl.ComponentObject` | Component Object | Component Utilities |
| `net.noodl.SetComponentObjectProperties` | Set Component Object Properties | Component Utilities |

Richard hit this on `Condition` — a Logic node, one of the first any author wires — and read two
identically-behaving ports as the vocabulary doubling up. It is not doubling up; it is the contract's
universality landing on a node with only one outcome, which is the price of `Completed` being the one
port with no exemption.

**Both ports stay.** The value of `Completed` is that wiring it is *never* a per-node decision, and
[TALK-006 correction 1](TALK-006-THE-THREE-SIGNALS.md#correction-1--the-argument-for-pruning-done-does-not-work)
shows pruning `Done` here would buy back nothing for the validator either. What is missing is that
nothing tells the author the two are the same *on this node*:

- `done` has **77 distinct descriptions** across its 82 nodes — bespoke and correct.
- `completed` has **1** across all 82 — the generic sentence from
  [`outcome.ts:90-92`](../../../packages/noodl-runtime/src/outcome.ts#L90-L92).

So on the 8, an author reads two different sentences describing one pulse.

## What to build

### Slice 1 — `outcomeOutputs` says it, generated

In [`outcome.ts:77-115`](../../../packages/noodl-runtime/src/outcome.ts#L77-L115), when the node has
neither an `unchanged` nor a `failure` port, append to the `completed` description that this node has
no other outcome, so `Completed` always fires together with `Done`.

The presence test is the same one the function already uses twice — `!== false && !== undefined` —
and it must be written from the same `options` object that builds the outputs, so the wording and the
port set cannot disagree. That is the pattern `outcomeInputs` already follows for deriving its enum
(`:158-164`), and the reason it follows it.

⚠️ **One branch, in one place, 8 nodes affected, zero call sites edited.** Do not hand-write the
sentence into 8 node definitions — the whole reason `outcome.ts` exists is
[its own opening note](../../../packages/noodl-runtime/src/outcome.ts#L9-L14): the eight ports that
displayed as "Done" before the contract carried **four** different internal names, because eight
nodes each picked one.

### Slice 2 — regenerate both snapshots

The description is in generated artefacts, and two separate gates read them:

- `npm run catalog:generate` → `packages/noodl-types/src/node-catalog.json`. `catalog:check` fails
  until this is run.
- `npm run cloud-library:generate` → `cloud-node-library.json`. It carries **38** `completed`
  descriptions today and includes 3 of the 8 (`NewModel`, `Condition`, `Unique Id`).
  `cloud-library:check` is the gate — and it has been **omitted from CI before**, which is how a
  generator fix left a snapshot stale and red for a run of commits. Run it explicitly; do not assume
  the suite would have caught it.
- Then `npm run catalog:merge:check` (enrichment coverage) — a changed description is a changed merge
  input.

### Slice 3 — `Counter.Reset`'s guard

[`counter.ts:79-101`](../../../packages/noodl-runtime/src/nodes/std-library/counter.ts#L79-L101).
The early return reads `this.currentValue`, but the count lives at `this._internal.currentValue`, so
the guard has never once fired and `Reset` always reports `Done`. ERG-001 kept it verbatim
deliberately and said why, in the code.

⚠️ **The obvious repair is also wrong.** The guard compares against `0`:

```ts
if ((this as unknown as { currentValue?: number }).currentValue === 0) {
```

but `Reset` sets the count to `_internal.startValue`. Pointing the read at `_internal` without
changing the comparison would report `Unchanged` for "the count is zero", which is a different
condition and wrong on any counter that starts anywhere else. The correct post-condition is
`_internal.currentValue === _internal.startValue`.

That is a **behaviour change**, not a rename: with the guard live, `Count Changed` stops firing on a
Reset that changes nothing, and `Reset` starts reporting `Unchanged` on a node that has never emitted
it. Both are what the contract says should happen. Ship it as its own commit with its own test so it
can be reverted alone if a project depended on the old pulse.

`Counter` already has an `unchanged` port (`Increase`/`Decrease` use it at `:51` and `:67`), so no
port set changes and `Treat Unchanged as` already applies.

## Criteria

1. On all 8 nodes, `Completed`'s description says it fires together with `Done` and that there is no
   other outcome. On the other 74, the description is byte-identical to today's.
2. `catalog:check`, `cloud-library:check` and `catalog:merge:check` are green **after** an explicit
   run of each — not inferred from a green suite.
3. `Reset` on a counter already at `Start Value` reports `Unchanged`, fires `Completed`, and does
   **not** fire `Count Changed`. `Reset` on a counter anywhere else reports `Done` exactly as before.
4. A corpus test pins the 8-node wording rule against the *option set*, not against a hardcoded list
   of 8 type names — the list is a consequence, and a node gaining a `Failure` port later must lose
   the sentence automatically.

## Traps

- ⚠️ **`graph-harness` does not call a module's `setup`.** Three phase-30 findings lived there. If a
  test derives the port set through `setup`, no corpus test sees it.
- The 8 are a *derived* set. Anything that hardcodes them — a test, a doc table, this file — is
  stale the moment a node gains an `Unchanged`. Derive from the catalog when checking.
- This ships before or after [FH-020](FH-020-THE-PORTS-TAB.md) in either order, but the pair is the
  point: FH-022 makes the words right, FH-020 is where anyone reads them. Neither alone closes
  item 0.
