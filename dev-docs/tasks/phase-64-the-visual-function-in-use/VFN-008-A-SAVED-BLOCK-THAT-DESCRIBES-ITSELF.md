# VFN-008 — A saved block that describes itself

**Status:** 🟡 **BUILT 2026-08-13 on `vfn-saveblock`, NOT DRIVEN** · ⭐ **Tier 2** · blocks VFN-009

> ## 🔴 Criterion 4 is FALSE AS WRITTEN, and it is the most important thing on this page
>
> > *"Placing a call block for a definition that sets an output gives the host node that output
> > port after the next generate."*
> >
> > **It does not.** Measured and pinned by `tests-unit/vfn-008/self-describing-block.test.ts`
> > → *"🔴 FINDING: a placed saved block publishes no ports"*.
>
> The reasoning below — the workspace is the single source of truth for ports, and a saved
> block's body is inlined at generate time — is right in both halves. The conclusion does not
> follow, because **the two happen to different copies of the workspace**:
>
> - `updatePorts` → `detectIO(workspace)` reads the **raw** serialised workspace, the same
>   string persisted as the node's `workspace` parameter;
> - `expandWorkspace` runs inside `generateWithMyBlocks`, and its expanded copy is discarded as
>   soon as the JavaScript is generated.
>
> `detectIO` has never heard of `myblocks_call_value` / `myblocks_call_statement`, so a call
> block contributes no port mentions at all:
>
> ```
> detectIO(workspace containing the call block)  → outputs: []
> detectIO(the same body, inlined)               → outputs: [{ name: 'total', type: '*' }]
> generateWithMyBlocks(...)                      → 'Outputs["total"] = 7;\n'
> ```
>
> **The program is right and the node is deaf.** The generated code writes `Outputs["total"]` and
> there is no `total` port for anyone to wire to. A builder saves a block that sets an output,
> drops it into another Visual Function, and the output they were promised never appears.
>
> 🔴 **Not fixed here, deliberately.** `detectIO` lives in `noodl-runtime` and has no access to
> the definition shelves, which live in `project.json` settings and `EditorSettings`. Either the
> definitions get plumbed through to port detection, or the expansion happens before the
> workspace parameter is written — and the second destroys the property that makes the workspace
> the source of truth. That is a design decision and belongs in its own task, with LGC-007's
> constraints in front of it. The spec asserts the **true** behaviour so that the fix turns a
> line red at exactly the right moment.
>
> The second half of criterion 4 — *"no port is created for a definition's internal variables"* —
> ✅ holds, and would still hold after the above is fixed.
>
> ## ✅ Everything else is built
>
> - **§1 a description field** on the dialog, optional, normalised so blank is `undefined` and
>   never `''`. Stored through the `SaveChoice.description` that already existed; no format change.
> - **§2 the block says what it is** — `setTooltip` now takes a **function**, resolved when the
>   tooltip is shown rather than in `init()` where the state is still a stub. It prefers the live
>   definition (injected from `BlocklyWorkspace`, never imported — see below) and falls back to
>   the block's own `extraState`.
> - **§3 the flyout shows the shape** — `kind: 'label'` entries above each definition's block.
> - **§4 the dialog shows what it will look like** — `▣ Discount   price   rate`, wearing the same
>   `MY_BLOCKS_BLOCK_GLYPH` the call block's header field renders.
> - **The variable hazard** — `collectVariableReferences` finds Blockly `VAR` fields in both the
>   `{id}` and bare-name spellings, and the warning is shown at save time *and* on the tooltip.
>   ⚠️ Noodl variables are deliberately **not** flagged: they are global and they do travel, and a
>   false alarm on the mechanism that works is worse than no alarm.
>
> ⚠️ **`MyBlocksBlocks.ts` must never import `MyBlocksShelves`.** It is in the import graph of the
> `lgc-007` specs in the plain-Node runner, and `myBlocksStore` reaches `ProjectModel` and
> `EditorSettings`; one import there fails two suites *to run*, which counts as a failure and does
> not look like one. Hence the injected definition source.
>
> Full write-up, including what still needs a drive:
> [`NOTES-saveblock.md`](NOTES-saveblock.md).

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

1. 🟡 **Round trip proved, restart owed.** A description typed at save time survives a reload and
   appears on the call block's tooltip and in the flyout. The spec puts a saved definition through
   `JSON.parse(JSON.stringify(...))` and `validateLibrary` — the same journey `project.json` gives
   it — and asserts both surfaces. It does not restart Electron, and the task file is right that
   those are different claims.
2. ✅ **DONE.** A definition saved **without** a description still shows its shape and the
   propagation warning — the absence degrades, it does not blank. `''`, `'   '` and `undefined`
   all produce the identical tooltip, and no line of it is blank.
3. ✅ **DONE.** A definition whose body uses a workspace variable produces the named warning at
   save time — and on the call block's tooltip as well, which is honest-answer 2 from above.
4. 🔴 **FALSE AS WRITTEN — see the top of this file.** A call block publishes **no** ports; the
   generated code writes the output and nothing can be wired to it. The second half — no port for
   a definition's internal variables — ✅ holds.
5. ✅ **DONE.** Every sentence rendered is produced by `saveIntent.ts` and is asserted in the
   plain-Node runner.
6. ✅ **DONE.** Old definitions on disk — every one of which has `description: undefined` — load
   and render without a diagnostic.

## How to prove it

Specs in the existing `myblocks/` plain-Node runner for the sentence builders and the
variable-reference detector.

A drive for the surfaces: save a block with a description, close and reopen the editor, hover the
call block, screenshot the tooltip, open the My Blocks category, screenshot the flyout.

🔴 Reopen the editor between saving and reading. A tooltip built from an in-memory definition and a
tooltip built from one that round-tripped through `project.json` are different claims, and only the
second is the one being made.
