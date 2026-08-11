# LEG-007 — paste already carries labels and comments. Nothing notices if it stops

**Status:** 📋 open · **Est. 0.5 d** (README said 2) · **Track: regression** · after **LEG-001**

## The premise, and why it is false

The README:

> Paste remints node ids (`NodeGraphNodeSet.ts:40`) — correct and necessary. But the **label and
> comment must be carried**, or duplicating a component produces a diff where nothing correlates
> *and* the copy is anonymous.

The id-reminting half is right. The loss is not happening. Read in source:

```ts
// NodeGraphNodeSet.clone()
clones.push(NodeGraphNode.fromJSON(this.nodes[i].toJSON()));
```

`toJSON` emits `label: this._label` and `metadata: this.metadata`
([`NodeGraphNode.ts:1571-1612`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts));
`fromJSON` restores both, passing metadata through `stripCodeHistoryMetadata` on the way
(line 180). Reminting happens *after* that, and touches only `node.id` and the connection endpoint
map. The only field deliberately dropped for the clipboard is `dynamicports`, in `strip()`.

**So labels and comments already survive copy, paste and duplicate.** This task is not a fix.

## Why it is still worth half a day

Nothing in the suite asserts it. `clone()` is a `toJSON`/`fromJSON` round trip, which means it
inherits every future change to either — including the one this phase is about to make. LEG-001 adds
a comment field to the authoring vocabulary and maps it onto the metadata bag; the day someone adds
a second strip beside `stripCodeHistoryMetadata`, or narrows `toJSON` to an allowlist, paste starts
producing anonymous copies and **no gate says a word**.

This is the phase's cheapest insurance, and it is a spec against a behaviour that is currently
correct — which is the only time such a spec is easy to write.

## The spec

`packages/noodl-editor/tests/nodegraph/`, beside the existing `extract-to-component.spec.ts`.

⚠️ **A spec not exported from its `index.ts` never runs**, and the suite reports green. That has
happened here before. Export it in the same commit.

Three assertions, one fixture:

1. **Labels and comments survive.** A set of nodes with labels and `metadata.comment` on some of
   them, cloned: every clone carries the same `label` and the same comment.
2. **Ids are reminted and connections follow.** Every clone has a fresh id, no id collides with the
   source set, and every cloned connection's `fromId`/`toId` resolve to clones rather than to
   originals. Include a **nested child**, because reminting walks children via `forEach` and a
   parent-only test passes with the recursion broken.
3. **`metadata.merge` survives and code history does not.** A node with a source-code port carries
   `merge.soureCodePorts` through the clone; a node carrying code history loses it, because
   `fromJSON` strips it deliberately and a spec that does not pin the strip will be "fixed" by
   someone restoring it.

## The half nobody has checked

Copy/paste **across components and across projects** goes through `EditorClipboard`, not only
`clone()`, and extract-to-component goes through `ExtractToComponent.ts`. ⚠️ **Both files are
currently modified in the working tree** by other work — read them at the state they land in, do not
spec against a half-finished diff, and do not assume the in-memory `clone()` result is what crosses
the clipboard boundary. A serialise/deserialise step is exactly where an allowlist gets introduced.

If the cross-project path turns out to lose either field, that **is** a fix and this task grows —
say so, do not fold it into the spec as an expected value.

## Acceptance

- The spec exists, is exported from `tests/nodegraph/index.ts`, and **fails when the carry is
  removed** — proven by deleting `label` from `toJSON` locally and watching it go red. A guard that
  has never been seen to fail is decoration.
- Copy → paste within a component, and duplicate-component, both preserve every label and comment,
  including on nested children.
- The cross-component and cross-project clipboard paths are **checked and the result written down**,
  whichever way it falls.
- ⚠️ Only the `Jasmine:` line counts as the suite result. Do not read a process exit code, and do
  not run the suite with a dev stack live.

## Register

| # | Finding | State |
|---|---|---|
| L19 | Paste **already** carries labels and comments — `clone()` round-trips `toJSON`/`fromJSON` and `strip()` drops only `dynamicports`. The README's premise is false | ⚠️ corrected |
| L20 | Nothing asserts it, and LEG-001 is about to change the shape of what is being carried | 📋 the task |
| L21 | Invert the guard before believing it. A behavioural spec that has never gone red is decoration | ⚠️ standing |
| L22 | `EditorClipboard.ts` and `ExtractToComponent.ts` are unread here and both are dirty in the tree. The cross-project path is genuinely unknown | 📋 open |
