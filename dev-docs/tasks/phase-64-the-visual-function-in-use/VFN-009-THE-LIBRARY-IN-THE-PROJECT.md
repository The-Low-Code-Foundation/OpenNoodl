# VFN-009 — The library, in the project

**Status:** 📋 open · ⭐ **Tier 2** · ~2 days · depends on VFN-008 · blocks VFN-010

## The report

> *"When you've saved blocks, we need a way to access them to edit them. I'm guessing this would be:
> some sort of global menu in your project, maybe in app settings or something? Where you can open
> the blockly editor of the blocks you saved and edit them, with a big warning that 'this block has
> already been used 5 times in your project, and your changes will propagate everywhere, are you
> sure?'"*

and, separately:

> *"When changing a saved block, the warning about where it's already used should be able to maybe
> warn the user about how the changes have broken certain flows? Or maybe that comes when we do the
> unit testing system we've scoped for one of the untouched phases?"*

## ✅ Ruled 2026-08-13 — build it in full, in app settings

And **Richard's second question answers itself in the direction he suspected**: the deep half of the
breakage warning waits for the testing phase. See *"What this warning may and may not claim"* below —
the line is drawn on evidence, not on effort.

## 🔴 The engine is complete and has no way in

Every operation this task needs already exists, is already specced in the plain-Node runner, and has
**zero callers outside its own tests**
([`myblocks/store.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/store.ts)):

| Operation | Line | State |
|---|---|---|
| `save({ id, … })` — overwrite, not create | `:173-214` | ✅ built. *"Supply to overwrite — which is how 'edit a definition' arrives here"* |
| `rename(id, name)` | `:216-226` | ✅ built. Safe by construction: call blocks store the **id**, never the name |
| `referencesTo(id)` — which definitions call it | `:229-233` | ✅ built |
| `remove(id, { referencingNodeIds })` → `MyBlocksInUseError` | `:245-264` | ✅ built, refuses with the names |
| `detachDefinition` — inline-and-detach, then force-remove | `expand.ts` | ✅ built |
| `exportDefinitions` / `importLibrary` with id remapping | `:274-338` | ✅ built |

**The one thing the store deliberately cannot do is find the nodes.** `remove` takes
`referencingNodeIds` as an argument and says why: *"The store cannot find these itself — it has no
project."* Supplying that list is this task's real work, and it is the same list the warning needs.

## Finding the call sites

A saved block is referenced from two kinds of place:

1. **Other definitions** — `store.referencesTo(id)`, already built.
2. **Logic Builder nodes** — every node in the project whose `workspace` parameter contains a call
   block pointing at the id.

For (2): walk every component's graph for nodes of type `Logic Builder`, parse the `workspace`
parameter, and run the existing `collectReferences`
([`myblocks/references.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/references.ts))
over it. That function is already the authority on what a reference is, and reusing it is what keeps
the count in the warning and the refusal in `remove` the same number.

⚠️ **Recompute; never trust a stored index.** `store.graph()` already refuses to read edges off the
stored `requires` for exactly this reason — *"the case it is guarding against is a stored `requires`
that no longer matches the body it claims to describe."* A usage index cached in project settings
would be that mistake one level up.

⚠️ **A node open in a tab may have unflushed blocks.** An edit lands on the model 300 ms after it
settles. Count from the model, and take the count *at the moment the warning is shown*, not when the
panel was opened.

## What to build

### 1. A *Saved blocks* section in project settings

Beside `VariablesSection` and `LibrariesSection` in
[`ProjectSettingsTab.tsx`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/ProjectSettingsTab.tsx),
which is already where app-wide project furniture lives.

One row per definition: name, shape, description (VFN-008), **where it is used** (n nodes, m blocks),
and its shelf. Both shelves are listed, marked — a backpack block is visible from the project that
uses it, and that is the affordance VFN-010's marking in the picker mirrors.

Row actions: **Edit blocks**, **Rename**, **Duplicate**, **Delete**, **Export**.

### 2. Edit blocks opens the Logic Builder on the definition

The window is already a tab host and the tab is already keyed by a `nodeId`. A definition tab is the
same window with a different subject: its blocks are `definition.body`, its title says it is a saved
block, and its save writes `store.save({ id, … })` rather than a node parameter.

🔴 **Do not widen `Tab.nodeId` to mean "either a node id or a definition id".** That is one field
carrying two kinds of identity, and every consumer — `BlockTraceClient`, `attachDoIt`,
`attachBlockValues`, `onWorkspaceChange` — would have to learn the difference or silently do the
wrong thing to one of them. Give `Tab` a discriminated `subject`, and let the three overlays that
need a live node decline cleanly when there is not one. **They already have that path**: every one of
them was written to explain a missing `nodeId` rather than vanish.

⚠️ Do It and live values are **meaningless** on a definition tab — there is no node, no inputs, no
run. Say so in the strip (`STATUS_COPY` already has a slot for exactly this shape of message) rather
than showing an empty bar. **VFN-011's bench is the thing that makes a definition tab genuinely
runnable**, and it is worth doing them in that order if both are scheduled.

### 3. The propagation warning

Before the definition tab opens, and again if the shape changes:

> **`Discount` is used in 5 places** — 4 Logic Builder nodes across 3 components, and 1 other saved
> block. Editing it changes all of them.
>
> *Where it is used:* Pages/Checkout · `Order total`, …

Naming them, not counting them. A count is a number to dismiss; a list is a thing to check.

### 4. Delete uses the refusal that already exists

`remove` throws `MyBlocksInUseError` with both id lists. Render it, and offer the inline-and-detach
path (`detachDefinition`) as the alternative — that is §4's stated design and the code for it is
written.

## What this warning may and may not claim

🔴 **This is the boundary Richard asked about, and it is a matter of evidence rather than ambition.**

**It may claim, because these are facts it can compute:**

- where the definition is used, by node and component;
- that the **shape changed** — `value` ⇄ `statement`. `expandWorkspace` already refuses this by name
  (`MyBlocksShapeError`), so the warning is reporting a refusal that is real and about to happen:
  *"3 call sites will stop generating until you replace them."*
- that the **parameters changed** — a removed parameter leaves a socket with nowhere to go, an added
  one leaves an empty socket. Both are computed from `inferSignature`, which already runs on save.

**It may not claim that a flow is broken.** Nothing in this system knows what a program is *for*.
A warning that guesses at behavioural breakage will be believed, and being believed wrongly is worse
than being silent — this register has already filed a guard that was decoration and a cost model that
argued against its own best feature.

Semantic breakage waits for the unit-testing phase, where a saved block can have expectations
attached and a change can be graded against them. **Filed there, explicitly, and not attempted here.**

## Acceptance criteria

1. Every definition on either shelf appears in the section, with its correct usage count, computed
   live.
2. *Edit blocks* opens the definition's body, an edit is written back to the same id, and every call
   site's next generate reflects it.
3. 🔴 An edit to a definition **does not** rewrite the `generatedCode` of nodes that use it — they
   regenerate on their own next edit. This is measured behaviour from LGC-007 §6, not a guess, and
   the section must not claim otherwise. If a sweep is wanted, it is a separate, explicit action.
4. Rename does not break a single call site.
5. Delete of an in-use definition is refused with every call site named, and inline-and-detach
   succeeds and leaves the referencing programs generating identical output.
6. A shape change names the call sites that will be refused, before the edit is committed.
7. A cycle is still refused at save time, with the loop named.
8. Nothing in this section can write a definition without going through `store.save`.

## How to prove it

Most of it is already gradeable: the store's operations have 66 + 5 specs in the plain-Node runner.
Add the **project usage scan** there — it is a pure function of (project graph JSON, definition id)
if the graph walk is kept out of the model.

A drive for the round trip: save a block, use it in two nodes, edit it from settings, and assert both
nodes' generated code after each has been touched. Compare the *output*, not the fact that a function
ran.
