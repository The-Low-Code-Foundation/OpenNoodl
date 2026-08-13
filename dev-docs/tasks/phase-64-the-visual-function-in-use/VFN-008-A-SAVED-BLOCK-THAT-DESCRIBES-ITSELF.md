# VFN-008 — A saved block that describes itself

**Status:** 📋 open · ⭐ **Tier 2** · ~1 day · blocks VFN-009

## The report

> *"Once saved, it's not easy to know what your saved block actually does. If you put it on a canvas
> later on, how do you know what inputs and outputs it has? What it's supposed to do? How you're
> supposed to hook it up? If the block declares inputs, outputs, variables etc. do they get ported
> into the current logic node editor by default when you place the saved block?"*

Four questions. The first three are the same absence. **The fourth is a different question and has a
factual answer**, given in full below, because it is the one a builder will get wrong silently.

## The absence, in three places

### 1. Nothing asks for a description

`MyBlockDefinition.description` exists in the format and `save()` writes it
([`myblocks/store.ts:81-89`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/store.ts)),
`SaveChoice.description` exists on the request type
([`MyBlocksSave.ts:67-71`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSave.ts))
— and **the dialog has no field for it**, so every definition ever saved has `description:
undefined`. The plumbing was built and the tap was never fitted.

### 2. Nothing shows one

The call block's tooltip is one hard-coded sentence, identical for every saved block
([`MyBlocksBlocks.ts:65`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksBlocks.ts)):

```ts
this.setTooltip('A group of blocks you saved. Editing the saved block changes it everywhere.');
```

### 3. The flyout shows a name and nothing else

`myBlocksFlyout` maps each definition to `callBlockJson(definition)`
([`:121-171`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksBlocks.ts)),
which carries the label and the argument names — so a builder browsing the category sees `▣ Discount`
and has to drag it out and read its sockets to learn anything.

**Meanwhile the answer already exists and is already computed.** `inferSignature` runs on every save
and stores `shape` and `params`, and `describeShape`
([`myblocks/saveIntent.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/saveIntent.ts))
already renders a plain-English sentence about them — the dialog shows it at save time and then it is
thrown away. This task is largely **plumbing an existing answer to the places it is needed**, not
computing a new one.

## ⚠️ The fourth question: no, and it must not

> *"If the block declares inputs, outputs, variables etc. do they get ported into the current logic
> node editor by default when you place the saved block?"*

**Ports: yes, automatically, and not by "porting" anything.** The workspace is the single source of
truth for ports — `detectIO` reads the blocks, and a saved block's body is *inlined into the
workspace's program at generate time* (`generateWithMyBlocks` → `expandWorkspace`). So a definition
containing `set output "total"` gives the host node a `total` output the moment the call block is
placed and the program regenerates. There is no copy step and no second store, which is exactly what
the phase-59 constraint requires.

**Blockly variables: no, and this is the hazard.** A definition body that uses a Blockly `variables_get`
refers to a variable in the workspace it was *saved from*. Placed in a different Visual Function,
that variable does not exist. The inliner has no remapping for it — `remapCallTargets` remaps
*definition ids*, not variable ids
([`myblocks/store.ts:356-367`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/store.ts)).

So the honest answers, in order of preference:

1. **State it at save time.** If the body references workspace variables, the save dialog says so:
   *"This uses the variable `n`, which will not travel with the block."* One sentence, in
   `saveIntent.ts`, computed from the same `walkWorkspace` that `collectReferences` already uses.
2. **State it at placement.** The call block's tooltip names the variables it expects.
3. 🔴 **Do not silently create them.** Auto-declaring a variable in the host workspace on placement
   would be a definition quietly authoring the program it was dropped into, and it is unrecoverable
   by undo in the way builders expect. Filed as a possible later affordance — an explicit *"create
   the 2 variables this block needs"* button — and deliberately not built here.

**Signals: refused already.** The hat block cannot go inside a saved block (`HAT_REFUSAL`), so a
definition cannot carry a program's entry point.

## What to build

### 1. A description field on the save dialog

Optional, one line, placed under the name. Placeholder: *"What does it do, and when would you use
it?"* Stored through the `SaveChoice.description` that already exists.

Optional and not required: a required field on a save dialog is a field that gets filled with `x`.

### 2. The block says what it is

The call block's tooltip becomes, for a definition with a description:

```
Discount — takes a price and a rate, gives a number.
Applies the current seasonal discount band.
Editing the saved block changes it everywhere.
```

and without one, the shape sentence and the standing warning. The shape sentence is `describeShape`,
which already exists and already reads well; the third line is the existing hard-coded one and stays,
because it is the fact with the largest blast radius.

⚠️ Tooltips are set in `init()`, before `loadExtraState` has run — the state is a stub at that point.
Set it in `rebuildInputs_`, which runs from both, or pass a function to `setTooltip` so it resolves
when shown.

### 3. The flyout shows the shape

Each entry in the My Blocks category gets a label above it carrying the shape sentence, using the
`kind: 'label'` entries the empty state already demonstrates
([`:146-171`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksBlocks.ts)).

⚠️ The flyout is rebuilt on **every open**, so this is free to keep current and must not cache.

### 4. The dialog shows what it will look like

The save dialog already shows the shape sentence. Add the resolved parameter list — the socket labels
the call block will actually have — so the name being typed is being attached to a visible signature.

## Acceptance criteria

1. A description typed at save time survives a reload and appears on the call block's tooltip and in
   the flyout.
2. A definition saved **without** a description still shows its shape and the propagation warning —
   the absence degrades, it does not blank.
3. A definition whose body uses a workspace variable produces the named warning at save time.
4. Placing a call block for a definition that sets an output gives the host node that output port
   after the next generate, and no port is created for a definition's internal variables.
5. Every sentence rendered is produced by `saveIntent.ts` and is asserted in the plain-Node runner.
6. Old definitions on disk — every one of which has `description: undefined` — load and render
   without a diagnostic.

## How to prove it

Specs in the existing `myblocks/` plain-Node runner for the sentence builders and the
variable-reference detector.

A drive for the surfaces: save a block with a description, close and reopen the editor, hover the
call block, screenshot the tooltip, open the My Blocks category, screenshot the flyout.

🔴 Reopen the editor between saving and reading. A tooltip built from an in-memory definition and a
tooltip built from one that round-tripped through `project.json` are different claims, and only the
second is the one being made.
