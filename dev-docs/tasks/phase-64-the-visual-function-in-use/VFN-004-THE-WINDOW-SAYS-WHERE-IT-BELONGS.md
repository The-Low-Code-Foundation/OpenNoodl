# VFN-004 — The window says where it belongs

**Status:** 🟡 **built on `vfn-window`, four criteria owe a live drive** · **Tier 2** · no dependencies

> Built 2026-08-13. Every decision is a pure module under `views/CanvasTabs/tabLocation.ts` and is
> graded by `tests-unit/vfn-004/tab-location.test.ts` (52 specs, each block's negative control
> **driven red** by mutation, not merely written). Gate: 158 suites / 2317 passing, `tsc` clean.
>
> ✅ AC 1 and AC 5 are proved. 🟡 AC 2, 3, 4 and 6 have their *decision* proved and their
> *consequence* owed — the canvas moving, the ring in a screenshot, and the toast all need the
> real app, which this worktree may not run.
>
> 📋 **Read [`NOTES-window.md`](NOTES-window.md) before the drive.** It lists the seven things to
> check, in order, and two of them are quiet failures that will not announce themselves.

## The report

> *"If you navigate away from the node canvas to another component, the logic editor stays there.
> Maybe there's an argument for this? But it could be confusing, unless we maybe label the logic
> editor top left tab with the name of the component it lives in? Or have a way of getting back to
> the logic node the editor is part of?"*

## ✅ Ruled 2026-08-13 — the window stays, and it says where it belongs

**Do not re-litigate this.** Closing the window on navigation was considered and rejected: LGC-010's
entire premise is that a builder can leave the blocks open, go and poke at the running app or another
component, and come back. A window that closes when you look away is a takeover with extra steps.

There *is* an argument for it staying — Richard supplied it in the same sentence — and the confusion
is not that it stays, it is that **it does not say what it is looking at**. Both remedies he offered
are taken, because they are the same remedy: name the component, and make the name the way back.

## What is on disk

The tab label is built from one field
([`CanvasTabs.tsx:158`](../../../packages/noodl-editor/src/editor/src/views/CanvasTabs/CanvasTabs.tsx)):

```tsx
<span className={css['TabLabel']}>Logic Builder: {tab.nodeName || 'Unnamed'}</span>
```

`nodeName` is set once when the tab opens, at the only emit site
([`LogicBuilderWorkspaceType.ts:85-99`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/LogicBuilderWorkspaceType.ts)):

```ts
const nodeId = this.parent?.model?.model?.id;
const nodeName = this.parent?.model?.model?.label || this.parent?.model?.type?.displayName || 'Logic Builder';
```

**The component is reachable from exactly the same object** — a `NodeGraphNode` knows its graph and
the graph knows its component — and it is simply not read. Nothing new has to be plumbed; one more
field goes into the event, through
[`CanvasTabsContext.tsx`](../../../packages/noodl-editor/src/editor/src/contexts/CanvasTabsContext.tsx)'s
`Tab` type, and out to the label.

⚠️ **`Tab.nodeName` is a snapshot and always was.** Renaming the node after the tab is open leaves
the tab reading the old name. That is pre-existing and out of scope, but do not make it *worse* by
snapshotting the component name and then having navigation depend on the stale copy — navigate by
**id**, resolve the name for display.

⚠️ Component names are **not** leading-slash normalised in this codebase. Display what the model
holds; do not construct a path by string surgery.

## What to build

### 1. The tab names the component

`Sales dashboard · Discount rules` — component first, node second, because the component is the
thing that has just stopped being visible. The word "Logic Builder" comes out of the tab: the window
is already labelled `aria-label="Logic Builder"` and the title bar is right there. A tab that spends
its width repeating the window's name has none left for the answer.

Truncate the **component** side first with an ellipsis, not the node side. The node name is the more
specific of the two and is what distinguishes two open tabs from each other.

### 2. Clicking the tab takes you back

Clicking a tab currently only switches which workspace is shown (`switchTab`). It should also
navigate the node graph to the owning component and **select the node**, so the answer to "where does
this live" is the canvas itself rather than a sentence.

- Already on that component: switch tabs, select the node, do not navigate.
- Component deleted from under the tab: refuse **out loud** — a toast naming the component — and
  leave the tab open with its blocks. Do not close it: those blocks are still the builder's, and
  this feature has already shipped a refusal that published its silence.
- 🔴 **`Router.route()` is a silent no-op editor→editor.** If the navigation is written over the
  editor's router rather than through the node graph's own component navigation, it will do nothing
  and look exactly like this bug. Use the same path the components panel uses.

### 3. An away state

The tab is visibly marked when the graph on screen is **not** its component — a dot, a dimmed
component segment, something that survives a screenshot. Not a colour alone.

This is the half that makes the ruling honest. The window staying open is only safe if "these blocks
are not the graph you are looking at" is *stated*; inferring it from a name you have to read and
compare is the same failure one step later.

## Acceptance criteria

1. The tab reads `Component · Node` for a node in a named component, at open.
2. Clicking the tab navigates to that component and leaves the node selected, from any other
   component.
3. Clicking the tab while already on that component selects the node and navigates nowhere.
4. The away mark is present exactly when the active component is not the tab's, and it is visible in
   a screenshot in both themes.
5. Two tabs open on nodes in different components are distinguishable from the labels alone.
6. A deleted component leaves the tab open, the blocks intact, and produces a named refusal.

## How to prove it

Specs for the label builder and the away predicate — both are pure functions of
(tab, active component id) and belong in the plain runner.

A drive for the navigation: open a Logic Builder in component A, navigate to B, screenshot the tab,
click it, and assert the node graph's active component **and** the canvas selection. Assert the
*consequence* (which component is rendered) rather than that a function was called.
