# DEF-040 — undo brings the node back and not the home

**Status: ✅ BUILT AND GATED — 2026-09-03, session 43.** Promoted from
[UNOWNED-ROWS-TO-MEASURE.md §8](UNOWNED-ROWS-TO-MEASURE.md), owner `NONE` since 2026-08-31, where
the finding was **driven** and three bullets were left marked *"measure before fixing"*. All three
are now answered, and the second one found a **worse** failure than the row it belongs to.

## Who it bites, and in what words

> *"I deleted a group, realised straight away, pressed undo — and the editor still says my project
> has no home page."*

Driven in DEF-007 s38 on a real editor (`def007-drive`): delete the home node, press *"Delete it
anyway"*, `UndoQueue.undo()`. The `Group` came back into the graph and
`ProjectModel.getRootNode()` was **still `null`**.

## Why it is not tidiness

DEF-007 §7.2 shipped a **confirm** rather than a refusal, on the argument that a person may
legitimately restructure their project and undo exists. 🔴 **Undo did not in fact repair this**,
which made that confirm the only protection there was — and makes Richard's *"you might not
remember what you deleted"* sharper here than in the lesson case FIX-025 addressed.

## The mechanism, and it is small

`NodeGraphModel.removeNode` pushes an undo action that re-adds the node. The home pointer is
cleared somewhere else entirely — a module-scope listener at
[`projectmodel.ts`](../../../packages/noodl-editor/src/editor/src/models/projectmodel.ts):

```ts
EventDispatcher.instance.on('Model.nodeRemoved', function (e) {
  if (ProjectModel.instance && ProjectModel.instance.getRootNode() === e.args.model) {
    ProjectModel.instance.setRootNode(undefined);
  }
});
```

`setRootNode(undefined)` runs as a **side effect of an event**, not as part of the undoable act, so
nothing in the undo group knows to reverse it.

## The three bullets

### Bullet 1 — does the same hole exist on the component path? **Yes, and on a path that is not refused.**

`removeComponent` clears the root at `projectmodel.ts:414` (`this.rootNode?.owner?.owner ===
component` → `setRootNode(null)`), and the undo it pushes is
`undo: function () { _this.addComponent(component); }` — **the component comes back, the home does
not.** Same shape, same cause.

⚠️ The row noted this is refused from the Components panel today. It is **not** refused for
`utils/import-engine/apply.ts`, which calls `removeComponent` directly — so an import that
replaces the component holding the home reaches this branch.

### Bullet 2 — is the listener reachable for a node that is not the top of the removal set? **No, and that is the defect.**

`removeNode` drops **every descendant** from `nodeMap`:

```ts
this.nodeMap.delete(model.id);
model.forEach((child) => { this.nodeMap.delete(child.id); });
this.notifyListeners('nodeRemoved', { model: model });
```

…and notifies for **the node it was handed and nothing else**. So a home node sitting *inside* a
deleted Group left `getRootNode() === e.args.model` reading `false`: the home was gone from the
graph while `rootNode` went on pointing at it.

🔴 **A dangling root, not a null one — the opposite failure, and the worse of the two.** A null
root shows *"No HOME component selected"* and offers **Make home**. A dangling root answers a node
no component contains, and `toJSON` writes its id into `rootNodeId` for a node that is not in the
file. The row guessed this *"may be worse"*; it is.

### Bullet 3 — undo group, or make the root change undoable in its own right? **Neither, quite.**

Making `setRootNode` globally undoable would put a second writer on a pointer that four other
paths set deliberately (load, `Make home`, migration, template install), and every one of them
would start pushing undo entries nobody asked for. The change here is narrower: **`removeNode` and
`removeComponent` each capture the home before the removal and restore it in the undo action they
already push** — the pointer change becomes part of the act that caused it, and nothing else moves.

## What was built

1. **The listener is subtree-aware** — the home is cleared when it is the removed node *or any
   node beneath it*. Closes the dangling-root hole.
2. **`removeNode`'s undo restores the home**, read before the removal (afterwards the listener has
   already cleared it) and set **after** the re-add, so the project never points at a node it does
   not contain. It finds the project as `graph.owner.owner`, the chain `getModule()` already uses.
3. **`removeComponent`'s undo restores the home** the same way.
4. 🔴 **The predicate was extracted to `nodegraphmodel/rootNodeRemoval.ts`** so the listener and
   `removeNode` **share one definition**. They have to agree exactly — a disagreement shows up
   only for a home nested inside a deleted Group, which is the case that was already wrong — and
   neither `projectmodel` nor `NodeGraphModel` can be imported outside Electron, so a predicate
   written inside either could only be graded by a copy of itself.

⚠️ `NodeGraphNode.forEach` visits the node itself first and **stops on the first truthy return** —
it is a `find` wearing a `forEach`'s name. That is what makes one call cover both the `===` case
and the nested one, and it is stated at the call site because the name says otherwise.

## The gates

| gate | where | why there |
| --- | --- | --- |
| `tests-unit/def-040/rootNodeRemoval.test.ts` — **6 tests** | jest | the predicate is pure, so it can be graded cheaply and often |
| `tests/models/RootNodeUndo.test.ts` — **4 specs** | jasmine (`test:ci`) | real `removeNode`, real `UndoQueue`. Measured: `NodeGraphModel` cannot be required under jest — the chain is `NodeGraphModel → NodeGraphNode → capability-gating → projectmodel → projectmodel.modules → bugtracker.ts:208` (`platform.getUserDataPath()` at module scope) |

**Both control arms are load-bearing.** *"An unrelated subtree does not clear the home"* and
*"undoing an unrelated deletion does not touch the home"* exist because a fix that restores the
home on **every** undo passes every positive arm and is wrong — and because `home === null` is
also what the defect produced, so the positive arms alone cannot tell a fix from a coincidence.

### Mutants — two, each killed by the arm that should kill it

| mutant | what it reverts | killed by |
| --- | --- | --- |
| 1 | the predicate back to identity only (the original `===`) | *a home nested inside a deleted Group* + *the walk stops early* |
| 2 | the predicate always true (clears the home on every deletion) | **the CONTROL** — *an unrelated subtree does not clear the home* |

Restored green afterwards; md5 matched the pre-mutation snapshot.

## Gates run

| gate | result |
| --- | --- |
| `tests-unit/def-040` | **6 passed**, exit 0 |
| `jest --findRelatedTests` over the 3 changed files | **12 suites / 146 tests passed**, exit 0 |
| `typecheck:editor-tests` | exit 0, **0 errors** |
| `typecheck:editor` | exit 0, **0 errors** |

✅ **`test:ci` RUN — 2938 specs, 4 failures, seed 60967, HEAD `da055635`.** All four are the known
`AIX-006 style vocabulary` floor, checked **by name**; no new red.

🔴 **And the four new specs were confirmed to have RUN, not merely to have not failed** — a spec
that fails *to* run vanishes silently from a jasmine suite. All four `[spec-start] DEF-040` lines
are in the log and none appears among the failures.

## Bounds — stated so this is not over-read

- ✅ **The jasmine spec has now run and passed** (`test:ci`, above), so the integration claim is
  measured rather than typechecked.
- The jasmine spec uses a **narrow structural double** for the project, not a real `ProjectModel`
  — `removeNode` reaches its project as `graph.owner.owner` and uses two methods. It therefore
  grades the undo half; the **listener** half is graded by the predicate specs, not end-to-end.
  An end-to-end reading is what the original s38 drive gave, and re-driving it after this fix is
  the honest closing act.
- **`setRootNode` is still not undoable in general.** Four other paths set it deliberately and
  none of them is covered here.
