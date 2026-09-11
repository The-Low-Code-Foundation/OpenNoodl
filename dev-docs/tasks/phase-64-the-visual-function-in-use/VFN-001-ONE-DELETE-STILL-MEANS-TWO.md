# VFN-001 — One Delete still means two

**Status:** ✅ **BUILT** (`0067304d`) · ✅ **SPEC-PROVED** (13 specs, control watched red) · ✅ **DRIVEN
2026-08-13 — criteria 1–4 all pass** · **nothing owed** · ⭐ **Tier 1** · no dependencies

> ## ✅ Driven 2026-08-13. All four criteria, each with a negative control.
>
> Fixture: `lgc010-drive` copied to a scratch directory, component `/ErgCodes`, Logic Builder node
> `c6`, window opened via `LogicBuilder.OpenTab`. Real trusted `Input.dispatchKeyEvent`, never a
> synthesised `KeyboardEvent` — a synthetic event would let the drive *construct* the composed path
> this fix is supposed to *observe*.
>
> **🔴 Both preconditions asserted before any key was pressed**, because LGC-010 logged two vacuous
> passes on exactly this test. The run aborts rather than reporting a pass it did not earn.
>
> ### Criteria 1 and 2 — three consecutive Deletes
>
> ```
> after selectNode(c4)    canvasNodes=8 blocks=8 blocklySel=null   canvasSel=[c4] active=BODY (outside)
> after click on block    canvasNodes=8 blocks=8 blocklySel=getQty canvasSel=[c4] active=path (IN OVERLAY)
> ✅ preconditions met: node selected on canvas, focus inside overlay, block selected
> after Delete #1         canvasNodes=8 blocks=7
> after Delete #2         canvasNodes=8 blocks=5
> after Delete #3         canvasNodes=8 blocks=4
> ```
>
> **Canvas nodes 8 → 8 → 8 → 8. Blocks 8 → 7 → 5 → 4.** The keystroke reached Blockly every time and
> the canvas never lost a node. Criterion 2 — the one the old fix failed — holds on presses 2 and 3.
>
> ### The negative control (criterion 1's second half)
>
> Focus moved out with a real click on the node canvas, `c4` re-selected, same keypress:
> **`nodes=8 → 7`, `c4` gone.** ✅ So the canvas delete path is live and the counter can see a
> deletion — which is what makes "no node was deleted" above a result rather than an absence.
>
> ### Criterion 3 — deleting the node closes the tab and the window
>
> `c6` selected, Delete: node gone, `tabs 1 → 0`, `windowPresent false`, `injectionDiv false`. ✅
>
> ### Criterion 4 — nothing is disabled with nothing focused
>
> Instrumented `executeCommandMatchingKeyEvent` and counted arrivals. With `activeElement === BODY`:
> ⌘F, Backspace, ArrowLeft and ArrowUp **all reached the dispatcher**. ✅ And the control that makes
> that mean something: with focus inside the overlay, ⌘F and ArrowLeft reached it **zero** times, so
> the counter discriminates rather than only ever going up. ✅
>
> ⚠️ One observation for whoever touches this next: after each Delete, Blockly's `FocusManager`
> moves focus to the deleted block's **parent**, so `activeElement` reads back inside the overlay
> once the dispatch settles. The stale read this fix repairs happens *within* one dispatch and is
> not visible in an after-the-fact sample — which is exactly why the criterion is stated as an
> outcome (node count) and not as a focus reading.

> **What landed.** `keyboardTargetOf` in
> [`utils/keyboardhandler.ts`](../../../packages/noodl-editor/src/editor/src/utils/keyboardhandler.ts)
> reads the composed path instead of `document.activeElement`, and both `onKeyDown` and `onKeyUp`
> use it. Tab-closing is a pure module,
> [`contexts/canvasTabsNodeRemoval.ts`](../../../packages/noodl-editor/src/editor/src/contexts/canvasTabsNodeRemoval.ts),
> subscribed from `CanvasTabsContext` on `Model.nodeRemoved`. Criteria 1, 2 and 4 are asserted in
> `tests/utils/keyboardhandler.spec.ts` (6 new specs) and criterion 3 in
> `tests-unit/vfn-001/` (7 specs). 🔴 **Not driven** — the three-consecutive-Delete drive is
> still owed.
>
> 🔴 **The task's own fix sketch was insufficient, and the spec is what caught it.** `path[0]`
> alone does not answer: a detached element has no ancestors, so `target.closest('[data-keyboard-scope]')`
> returns `null` on the very block the deletion removed — the same `'none'`, from a different
> stale read. The composed path is captured at dispatch and outlives the removal, so the resolver
> walks it and takes the first element the document still holds (the workspace, which was never
> going anywhere). See **VFN-001b** below.
>
> ⚠️ **One extra thing was made correct rather than left as found**: closing tabs is now a single
> transition (`closeTabs`), because a loop of `closeTab` calls is batched into one render — every
> iteration reads the same `activeTabId`, so with two tabs open nothing emits
> `LogicBuilder.AllTabsClosed` and the window never closes. Deleting a group containing two
> Visual Functions does exactly that, and so does *Done*.

## The report

> *"When you hit backspace or delete on the keyboard in the blockly editor, it deletes the block
> selected, but also whatever node was selected on the node canvas (including potentially the very
> logic node you're editing, and then the editor stays open which shouldn't happen)."*

A node the builder never touched is deleted, silently, by a keystroke aimed at something else. This
is the only report in the phase that destroys work.

## 🔴 This is the defect L30 already fixed, arriving through a door L30 does not cover

[LGC-010](../phase-59-logic-seam/LGC-010-A-WINDOW-NOT-A-PANE.md) fixed exactly this symptom on
2026-08-12 and **proved it with a negative control** — node selected on the canvas, focus inside the
window, Delete, node survives; focus outside, node deleted. That control was correct and the fix it
proved is real. It is also not sufficient, and understanding why is the whole task.

**The guard reads a value that the event itself has already invalidated.**

[`utils/keyboardhandler.ts:103-129`](../../../packages/noodl-editor/src/editor/src/utils/keyboardhandler.ts):

```ts
function getActiveElement(): HTMLElement | null {
  const element = document.activeElement as HTMLElement | null;
  ...
}

export function getKeyboardFocusKind(element: HTMLElement | null): KeyboardFocusKind {
  ...
  if (element.closest(OWN_SURFACE_SELECTOR)) return 'own-surface';
  ...
}
```

and [`:166-188`](../../../packages/noodl-editor/src/editor/src/utils/keyboardhandler.ts):

```ts
this.onKeyDown = (event) => {
  ...
  const focusedElement = getActiveElement();      // ← read here
  const focusKind = getKeyboardFocusKind(focusedElement);
  ...
  if (keystrokeBelongsToFocus(event, focusKind)) return;
  this.executeCommandMatchingKeyEvent(event, 'down');
};
```

Three facts about Blockly 12, all read in `node_modules/blockly/blockly_compressed.js`:

1. **Blockly binds `keydown` on its own injection container, not on `document`.** The only such bind
   in `inject` is `conditionalBind(d, "keydown", null, globalShortcutHandler)`, where `d` is the
   container div. It therefore runs **before** our `document` listener on the way up the tree.
2. **Blockly 12 has a `FocusManager`, and individual blocks are focusable DOM nodes.** 82 references
   to `FocusManager`, 37 each to `getFocusableElement` and `canBeFocused`, and an
   `ACTIVE_CLASS_NAME = "blocklyActiveFocus"` applied to the focused node's element. Clicking a
   block puts DOM focus on that block's own SVG element.
3. So Blockly's handler deletes the block, **which removes the focused element from the document**.
   `document.activeElement` immediately falls back to `<body>`.

Our listener then runs, on the same event, and reads an `activeElement` that is now `<body>` —
`getActiveElement()` returns `null`, `getKeyboardFocusKind(null)` returns `'none'`, and
`nodeGraph.delete()` runs against the canvas selection.

**One keypress. Two deletions. And the guard was working the entire time** — it was answering a
question about a DOM that no longer existed.

## The fix

Read the element the event was **dispatched to**, not the element that happens to be focused when
our handler is reached. `event.target` is fixed at dispatch and cannot be invalidated by anything a
prior handler does.

```ts
function keyboardTargetOf(event: KeyboardEvent): HTMLElement | null {
  // `composedPath()[0]` rather than `target`, so a keystroke inside a shadow root
  // reports the real element rather than the host.
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const target = (path[0] as HTMLElement) ?? (event.target as HTMLElement | null);
  if (!target || target === document.body || target === document.documentElement) {
    // Nothing meaningful was targeted — fall back to focus, which is the correct answer
    // for a keystroke that really did land on the document.
    return getActiveElement();
  }
  return target;
}
```

and use it in both `onKeyDown` and `onKeyUp`.

### 🔴 VFN-001b — the sketch above is not sufficient, and it fails the same way for the same reason

**`path[0]` is the deleted block.** `Element.closest()` walks the element and its ancestors *in
the tree it is in*, and a detached element has no ancestors — so
`target.closest('[data-keyboard-scope]')` answers `null` on exactly the element whose removal
started this, and the predicate returns `'none'` again. Swapping one stale read for another.

What survives the removal is the **path**, which is captured at dispatch. So walk it and take the
first element the document still holds:

```ts
for (const node of composedPath) {
  if (!node || typeof node.closest !== 'function') continue;      // `document`, `window`
  if (node === document.body || node === document.documentElement) break;  // fall through to focus
  if (node.isConnected === false) continue;                        // removed mid-dispatch
  return node;
}
return getActiveElement();
```

The `isConnected === false` line is the fix; everything else is the sketch. The block's workspace
is the next connected element up, it is inside the scope, and it was never going anywhere.

⚠️ Also `document` — not just `<body>` — has to fall through to focus, because a synthesised
`document.dispatchEvent` carries `document` as the target and every existing F21 spec is written
that way. Without that line those specs go red for a reason that has nothing to do with them.

⚠️ **The fallback is not padding.** A keystroke with no focused element genuinely targets `<body>`,
and every canvas shortcut is supposed to run then. Removing the fallback would disable ⌘F, ⌫ and the
arrow keys on a freshly loaded editor, which is the exact class of defect F21 was written for — read
its comment at [`:22-41`](../../../packages/noodl-editor/src/editor/src/utils/keyboardhandler.ts)
before touching this function.

⚠️ **`element.closest` is still the predicate, and `[data-keyboard-scope]` is still the contract.**
Nothing about L30's design is wrong. Only the source of the element changes.

## The second half of the report

> *"including potentially the very logic node you're editing, and then the editor stays open which
> shouldn't happen"*

Even with the above fixed, **deleting a Logic Builder node by any route leaves its tab open**, and
that tab then holds a `nodeId` that resolves to nothing: `BlockTraceClient` keeps arming a node that
is gone, and the 300 ms debounce writes the workspace back to a model that no longer exists.

Close the tab when its node is deleted. [`CanvasTabsContext.tsx`](../../../packages/noodl-editor/src/editor/src/contexts/CanvasTabsContext.tsx)
already owns `closeTab`, and the node graph already emits on deletion — subscribe, and close any tab
whose `nodeId` is in the deleted set. When that was the last tab, `LogicBuilder.AllTabsClosed` fires
and the window closes itself, which is the existing and only route.

🔴 **Do not add a "hide the window" state for this.** The window's open-ness is derived from which
tabs are open and from nothing else ([`CanvasTabs.tsx:97-108`](../../../packages/noodl-editor/src/editor/src/views/CanvasTabs/CanvasTabs.tsx)),
and a second source of truth for it is exactly the one-fact-two-stores shape this directory keeps
finding.

## What to do about the 200 ms guard

[`EditorClipboard.delete():78-84`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/EditorClipboard.ts)
carries a `lastBlocklyTabCloseTime` window that ignores Delete for 200 ms after a tab closes.

**Leave it.** L30's comment already records why: it guards a *different* window — the moment after a
tab closes, when focus has legitimately left the surface and the predicate correctly answers
`'none'`. It is not the fix for this task and removing it re-opens a defect that has been observed.

## Acceptance criteria

1. With a node selected on the canvas **and** a block selected in the window, one Delete deletes the
   block and leaves the node. Proved with a **negative control**: with focus outside the window, the
   same keypress deletes the node.
2. The same holds for the **second** consecutive Delete, and the third. This is the criterion the
   existing fix fails and it is the one that matters — the failure is a stale read, so a single-press
   test can pass vacuously.
3. Deleting a Logic Builder node closes its tab. Deleting the last open one closes the window.
4. No editor shortcut is disabled on a freshly loaded editor with nothing focused (⌘F, ⌫, arrows).

## How to prove it

Specs, in `packages/noodl-editor/tests/`, against `getKeyboardFocusKind` and the new target
resolver — a synthetic `KeyboardEvent` with a `target` inside a `[data-keyboard-scope]` subtree,
**with that element then removed from the document before the assertion**, which is the whole
mechanism in one test.

🔴 **A spec that only checks `activeElement` proves nothing here** — it is the value that lies.

Then a drive: open the window, select a canvas node, select a block, press Delete three times,
count nodes on the canvas each time. Remember that a spec file not exported from
`tests/nodegraph/index.ts` never runs.
