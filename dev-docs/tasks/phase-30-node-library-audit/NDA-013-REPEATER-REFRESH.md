# NDA-013: The Repeater must re-read its source on Refresh

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-013 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | **1** — small, standalone, and it makes the Repeater recoverable before NDA-002 lands |
| **Priority** | 🔴 Critical — the Repeater is the most-used node in the library and there is currently no escape hatch |
| **Difficulty** | 🟢 Low — the cause is confirmed and the fix is small |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | NDA-001 (add the corpus row first) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟢 **Sonnet 5** |

## Objective

Make the `Refresh` signal do what its name says: re-read `items` and rebuild from it.

## The defect

Richard: "when an array feeding into the repeater is changed, for example filtered or stuff added to
it, and not through the standard Noodl node system (maybe in a JS node), the repeater doesn't update,
and using the Refresh signal does fuck all."

Two bugs, and this task is the second one.

**The first** is defect class A1 — the source collection never notifies on `push`, so
`onItemsCollectionChanged` never runs. The `items` setter also early-returns on an unchanged reference
([`foreach.tsx:209`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L209)),
so re-sending the same mutated array does nothing either. That is NDA-002's job.

**The second** is that the escape hatch is broken too. The Repeater keeps a private copy of the
collection — "so we don't have to refresh all content if the input items collection changes"
([`foreach.tsx:162`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L162)) —
and `refresh()` rebuilds from **that copy**, never from `items`:

```ts
// foreach.tsx:509-527
refresh: async function () {
  this._deleteAllItemNodes();
  ...
  for (let i = 0; i < internal.collection.size(); i++) {   // <-- the private copy
    const model = internal.collection.get(i);
    await this.addItem(model, baseIndex + i);
  }
}
```

`internal.collection` is only resynced by `internal.collection.set(internal.items)`, which runs from
`onItemsCollectionChanged` (never fires, see above) and `scheduleCopyItems`
([`foreach.tsx:592-610`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L592-L610),
only when a *different* array object arrives).

So Refresh tears down every item node and rebuilds them from stale data. **It does not do nothing — it
does a full re-render and changes nothing**, which is worse, because it also looks like the node tried.

## Why this is Tier 1 despite being small

It is the only fix in the phase that restores a working escape hatch **without** touching the
reactivity contract. Land it and an author hitting the A1 defect has a reliable recovery — a Refresh
that actually works — while NDA-002 is still being designed. That makes the Repeater usable now rather
than at the end of the phase.

## The fix

`refresh()` must resync from `items` before rebuilding:

```ts
refresh: async function () {
  const internal = this._internal;
  internal.hasScheduledRefresh = false;
  if (!(internal.template || internal.templateFunction) || !internal.items) return;

  internal.collection.set(internal.items);   // <-- re-read the source
  this._deleteAllItemNodes();
  ...
}
```

Two things to get right rather than assume:

1. **`Collection.set` diffs by `getId()`** ([`collection.ts:104-165`](../../../packages/noodl-runtime/src/collection.ts#L104-L165))
   and emits `add`/`remove` per item — which the Repeater listens to
   ([`foreach.tsx:167-181`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/foreach.tsx#L167-L181))
   and turns into queued add/remove operations. Calling `set` and *then* `_deleteAllItemNodes()` will
   race those queued operations. Order matters; work out the correct sequence against the queue rather
   than pasting the line in.
2. If `set` already produces the right add/remove operations, the full teardown may be unnecessary —
   a Refresh that diffs is far cheaper than one that rebuilds. Worth doing if it falls out; not worth
   blocking the fix on.

## Also in scope

`Array Filter` and `Array Map` are downstream of the same A1 defect
([`filtercollectionnode.ts:243`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/filtercollectionnode.ts#L243),
[`mapcollectionnode.ts:136`](../../../packages/noodl-viewer-react/src/nodes/std-library/data/mapcollectionnode.ts#L136))
and **neither has a Refresh input at all**. Add one, with the same semantics, so the escape hatch
exists across the whole Array family rather than only on the Repeater.

## Success criteria

1. New corpus row: mutate a bound array in place from a Function node, pulse `Refresh`, the rendered
   list matches the array. Fails today.
2. Refresh with an unchanged array does not destroy and rebuild item nodes unnecessarily — or if it
   does, that is a deliberate, documented choice.
3. `Array Filter` and `Array Map` have working Refresh inputs.
4. No regression in the queued add/remove path; the QA fixture's repeater graphs render identically.
5. Live-verified in the editor.
