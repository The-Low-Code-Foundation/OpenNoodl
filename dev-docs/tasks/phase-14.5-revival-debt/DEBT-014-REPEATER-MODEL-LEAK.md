# DEBT-014: Repeater items become process-global Models that are never freed

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-014 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🟠 High for long-running apps; invisible in short sessions |
| **Difficulty** | 🟡 Medium — the lifetime question is the hard part, not the code |
| **Estimated Time** | 2–3 days |
| **Found by** | AIX-005, 2026-07-27, building the agent-chat example |
| **Recommended executor** | 🟠 **Opus 4.8** — touches a load-bearing runtime primitive with unclear ownership semantics |

## The defect

Items added to a Collection that a Repeater renders become **process-global Models that are never released**:

`Collection.set` → `Model.create` → registered in `Model.get(id)`'s global registry.

Nothing removes them. Removing the item from the Collection, unmounting the Repeater, and navigating away all leave the Model in the registry. For a list that grows over a session — a chat transcript, a log, a feed, an activity stream — memory grows monotonically for the life of the page.

Found while building the AIX-005 agent-chat example, where it is directly on the intended path: a streamed agent conversation appends a message per turn, and `net.noodl.TextAccumulator`'s `maxMessages` bounds the *accumulator* but not the Models the Repeater created from them. An app author who correctly bounds their visible list still leaks.

## Why this is debt rather than a bug fix

The global Model registry is deliberate and load-bearing. `Model.get(id)` is how a Function node, a `Noodl.Object`, and a component in another part of the graph all reach the same object by id — the same mechanism AIX-005's global store is built on, and the reason a store is visible to Function nodes at all. So the registry cannot simply be made weak or scoped without deciding a question nobody has answered:

**What owns a Model's lifetime?**

The plausible answers all have costs:

- **Reference counting** — correct, but every reach through `Model.get(id)` is an untracked reference today, so the count would be wrong from the start.
- **Scope-owned Models** (freed with the component that created them) — matches intuition, but breaks the cross-component reach that is the registry's purpose.
- **Weak registry** — the smallest change, but `Model.get(id)` on a Model nothing else holds would start returning `undefined` where it currently succeeds, and some of that is load-bearing.
- **Explicit disposal** — honest and cheap, but pushes a memory-management concern onto visual app authors, which is against the product's premise.

Picking one is the task. `PLAT-003`'s notes already record that `collection.js` patches `Array.prototype` and that this is load-bearing — treat the registry with the same caution.

## Scope

### In Scope
- [ ] Characterise the leak with a failing test: N items added and removed, assert the registry does not grow
- [ ] Decide the ownership model, **with the reasoning recorded** — this is the deliverable, not the code
- [ ] Implement it without breaking cross-component `Model.get(id)` reach
- [ ] Verify against the corpus, and specifically against a long-running Repeater over a growing Collection
- [ ] Confirm AIX-005's agent-chat example no longer grows unboundedly over a long conversation

### Out of Scope
- Reworking the Collection/Model API surface
- `Array.prototype` patching in `collection.js` — load-bearing, leave it
- The global store's own Model (one per named store; bounded by design)

## Success Criteria

- [ ] Adding and removing N Repeater items leaves the Model registry at its starting size
- [ ] Cross-component `Model.get(id)` still works, with a spec proving it
- [ ] The ownership decision and rejected alternatives are written down
- [ ] Runtime suite green; corpus green

## References

- `dev-docs/tasks/phase-15-ai-collaboration/aix005-notes/EXAMPLE-AND-DOCS.md` — where this was found
- `packages/noodl-runtime/src/collection.js`, `packages/noodl-runtime/src/model.js`
- PLAT-003 notes on `collection.js`'s load-bearing `Array.prototype` patching
- AIX-005 `net.noodl.TextAccumulator` (`maxMessages` bounds the accumulator, not the Models)
