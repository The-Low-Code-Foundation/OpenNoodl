# NDA-015: Explicit targeting for scope-resolved nodes

> **Status: §1, §2 and §3 complete — 2026-07-29.** The contract is written
> (`dev-docs/reference/BINDING-CONTRACT.md`), both named nodes obey all three clauses, the walk is
> shared, and the sweep is recorded in [FINDINGS.md](./FINDINGS.md#the-class-f-sweep--done-2026-07-29-nda-015-2-criterion-4).
> Corpus: `noodl-viewer-react/tests/corpus/nda-015-explicit-binding.test.ts` (9 rows) and
> `nda-010-close-popup-targeting.test.ts` (7 rows).
>
> **Two of this spec's premises did not survive implementation.** Read these before the body:
>
> 1. **§1's suggestion to reuse phase 28's CAN-001/002 label mechanism does not apply.** Those are
>    *connector* labels — text on a wire — and carry nothing about a node. The surface that worked is
>    the node card's **sub-label**, which the painter already draws
>    (`NodeGraphEditorNode.typeDisplayName`) and which nothing at runtime could previously reach. A
>    new one-way message (`nodesublabel`) feeds it. Deliberately *not* `metadata.typeLabelOverride`,
>    the other writer of that slot: metadata is persisted, and a runtime value written there would
>    dirty `project.json` on every preview.
> 2. **§3's FIXME is load-bearing and was already correct.** See the §3 note below.
>
> **The sweep found the class is wider than this spec's two nodes** — see F-i and F-ii in FINDINGS.
> F-ii (`_forEachModel`, five sites) is unfixed and is the remaining work in this class.

## Metadata

| Field | Value |
|-------|-------|
| **ID** | NDA-015 |
| **Phase** | Phase 30 — Node Library Audit & Remediation (Track O) |
| **Tier** | 2 |
| **Priority** | 🟠 High — silent wrong-target binding is the hardest class of bug to diagnose from the canvas |
| **Difficulty** | 🟠 Medium |
| **Estimated Time** | 2 weeks |
| **Prerequisites** | None. Share §2 with [NDA-010](./NDA-010-POPUPS.md) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Fable 5** for §1, 🟠 **Opus 4.8** for §2 |

## Objective

When a node targets another node by walking scope, let the author say **which one**, and show them
**which one it found**.

## The class

Two nodes resolve a target implicitly, both reported independently by Richard as broken, both with the
same underlying shape.

### Parent Component Object

[`parentcomponentobject.ts:149-186`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L149-L186)
walks up and returns the **first** ancestor containing a `net.noodl.ComponentObject`:

```ts
if (parent.nodeScope.getNodesWithType('net.noodl.ComponentObject').length > 0) {
  return parent;
}
return getParentComponent(parent);
```

No name input, no id input, no depth input. Nest two components that each own a Component Object and
the inner node binds to the nearer one, silently. Richard's "sometimes the wrong Component Object will
be updated" is deterministic, not random — but two things make it *feel* random:

- one branch walks `getVisualParentNode()`
  ([`:159`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L159)),
  so the binding can change when the visual tree changes;
- a standing `//FIXME: temporary hack` at
  [`:88`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L88)
  defers resolution by a frame because the parent's node scope may not exist yet.

The resolved name *is* exposed, but only in `getInspectInfo`
([`:101-103`](../../../packages/noodl-viewer-react/src/nodes/std-library/componentutils/parentcomponentobject.ts#L101-L103))
— visible only while inspecting, never on the canvas.

### Close Popup

`Close Popup` does not resolve at all — it waits to be handed a callback by whatever mounted the popup
([`closepopup.ts:64-66`](../../../packages/noodl-viewer-react/src/nodes/navigation/closepopup.ts#L64-L66),
[`showpopup.ts:78`](../../../packages/noodl-viewer-react/src/nodes/navigation/showpopup.ts#L78)). Whether
it works depends on which component scope it sits in, with no indication either way.

## §1 — The binding contract (decide first)

Proposed:

> **A node that resolves a target implicitly must (a) accept an explicit target, (b) show what it
> resolved, and (c) warn when it resolves nothing — rather than doing nothing quietly.**

All three clauses matter, and (b) is the one that would have saved the most time here: an author
seeing "bound to: CardList" on the node card would have diagnosed the nested-component case in
seconds.

Where should (b) surface? `getInspectInfo` already carries it but is inspect-only. Options: a subtitle
on the node card, a port-style read-only display, or a badge. Phase 28's canvas work (CAN-001/002) is
adjacent — check whether its label mechanism can carry this before adding a new one.

## §2 — Apply it

**Parent Component Object** — add an optional target input naming the ancestor component. Default
stays "nearest", so existing projects are unaffected. Show the resolved component name on the card.
Warn when no ancestor has a Component Object, which today is silent.

**Close Popup** — add an optional target, and resolve by walking scope explicitly when it is absent
rather than waiting to be handed a callback. Warn when nothing resolves. Do this with
[NDA-010](./NDA-010-POPUPS.md) §2.

**Sweep for others.** These two were found by report, not by search. Before building, grep for the
pattern — `getNodesWithType`, `parentNodeScope`, `getVisualParentNode`, `componentOwner` walks — and
audit each hit against the contract. The [NDA-012](./NDA-012-PER-NODE-AUDIT.md) worksheets ask this as
check F1, so the Component Utilities and Navigation categories are the right input here.

## §3 — The FIXME

The one-frame deferral at `parentcomponentobject.ts:88` is a real ordering problem, not just untidy
code: resolution runs before the parent's node scope exists. An explicit target does not remove the
need to resolve it at the right time. Work out whether the scope-ready point can be observed properly
rather than waited for; if it cannot, document why the deferral is load-bearing so the next person
does not delete it.

> **Answered 2026-07-29: the deferral is load-bearing, it is not a sleep, and the old comment's own
> proposed fix was a description of what the code already did.**
>
> The ordering problem is real. `nodeScopeDidInitialize` fires from the *child's*
> `NodeScope.setComponentModel`, which runs part-way through the parent's node-creation loop — so any
> of the parent's nodes created after this instance, possibly including the Component Object being
> looked for, do not exist yet.
>
> But `context.scheduleAfterUpdate` is not a timer. It pushes onto `callbacksAfterUpdate`, which
> `NodeContext.updateDirtyNodes` drains *after the dirty-node loop within the same update pass*,
> re-looping until both queues are empty (`nodecontext.ts:233-245`). By the time it runs, the whole
> tree for that pass exists. That is a defined scope-ready point — which is exactly what the comment
> proposed ("call this code when the entire node tree has been created, before running the next
> update") as the fix it was waiting for.
>
> What the comment got right is the cost: outputs propagate a pass later than the rest of the graph.
> That is inherent to resolving after creation, not a defect of this call, and removing it would need
> `NodeScope` to announce readiness upwards — beyond this contract.
>
> The deferral now also gates *reporting*: before it, a miss is expected and silent; after it, a miss
> is a genuine failure and is raised. Without that gate every correctly-wired graph in the project
> would raise a failure on load, which is worse than the silence the contract set out to fix.

## Success criteria

1. Parent Component Object can name its target; the default is unchanged; the resolved target is
   visible on the canvas.
2. Close Popup works from anywhere in the popup's tree, or warns.
3. Neither node ever fails silently.
4. The sweep in §2 is done and its results recorded — even if it finds nothing further, that is the
   fact worth having.
5. The contract from §1 is written into `dev-docs/reference/` with the other contracts.
