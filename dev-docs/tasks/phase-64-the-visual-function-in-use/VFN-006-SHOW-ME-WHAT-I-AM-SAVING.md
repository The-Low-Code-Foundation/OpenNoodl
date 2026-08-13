# VFN-006 — Show me what I am saving

**Status:** 📋 open · **Tier 2** · ~half a day · no dependencies

> ## 🔴 The outline was white in the light theme — found and fixed 2026-08-13, lane D
>
> The module's own sentence describing the mark is *"a dark casing underneath, the accent on top"*.
> The casing was `--theme-color-bg-1`, which is `#12161b` in the dark theme and **`#ffffff`** in the
> light one. So in half the app the casing was not dark, and the outline's outer edge measured:
>
> | casing | worst hue | My Blocks hue 55 | App Config hue 90 | bar |
> |---|---|---|---|---|
> | `--theme-color-bg-1`, light (`#ffffff`) | **2.58:1** (hue 60) | **2.72:1** | 2.82:1 | 3.0 🔴 |
> | `--theme-color-bg-1`, dark (`#12161b`) | 3.01:1 (hue 240) | 6.67:1 | 6.44:1 | 3.0 ✅ (barely) |
> | `#0b0e12`, both themes — **now** | **3.21:1** (hue 240) | **7.10:1** | **6.86:1** | 3.0 ✅ |
>
> 🔴 **2.58:1 is the same number VFN-013 measured**, one token over. This register keeps finding one
> failure in different costumes: *a theme token painted onto a Blockly surface*. A block body is on
> Blockly's hue scale and is theme-independent by design, so a mark drawn on one has no theme to
> follow — the standing rule for anything painted on a wire or a block. And the hue it failed worst
> against is **55, the My Blocks hue**: the blocks a save outline is most often wrapped around.
>
> **Changed:** `MyBlocksSaveOutline.ts` — `OUTLINE_TOKENS` now carries **no `css` on either stroke**,
> using VFN-013's own two values (`#0b0e12` casing, `#4da3ff` accent, 7.37:1 between them), so the
> two marks that share a block share a palette. `OUTLINE_TOKENS` is exported for the gate.
> **Gated:** `tests-unit/vfn-006/save-outline-contrast.spec.ts` (9 cases), sweeping the whole hue
> circle in both themes. ⚠️ It grades the **resolved** colour, not `spec.fallback` — the broken
> casing's fallback was dark, so a spec that graded the fallback would have stayed green through the
> entire defect.
>
> **Negative controls, watched red:** restoring `css: '--theme-color-bg-1'` failed three of the nine
> (the no-token assertion, the light-theme circle at 2.58, and the light-theme named hues); and the
> sweep is shown to tell `#000000` from `#ffffff` and to give different answers for different hues.
>
> 🔴 **Owed to the drive:** that the outline is *painted* at all — the clone landing inside the
> block's `<g>`, `vector-effect` holding both widths under zoom, and nothing painting over it. A
> ratio is not a screenshot.

## The report

> *"The 'Save as a block' right click option is confusing. It's not clear which blocks are going to
> be saved. It explains 5 blocks but it'd make more sense if you like drag highlighted them or
> something no? Or maybe it's just 'the blocks that are currently all attached here will be saved'
> and that's clear enough?"*

## ✅ Ruled 2026-08-13 — outline the group on the workspace

Both of Richard's suggestions were offered and the first is taken, in the form the editor can
actually deliver: **highlight the exact blocks, on the workspace, while the choice is live.**

🔴 **Drag-highlighting is not available and this is not a matter of effort.** Blockly 12 core has no
multi-select — one block is selected at a time — and LGC-006 already ruled that adopting the
multi-select plugin pins a frozen Blockly 12 release, because every official plugin's `latest` now
peer-depends on Blockly 13. The gesture is one right-click on the top block of the group, and
`MyBlocksSave.ts`'s own header says so at length.

The second suggestion — better copy — is taken **as well**, not instead. It is one string and the
outline needs a caption anyway.

## What is on disk

The count is already correct and already shown. `prepareSaveRequest` computes it
([`MyBlocksSave.ts:149-174`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSave.ts))
from the body it is actually going to store:

```ts
const body = bodyFromBlocks(blocks);
return { body, blockCount: countSavedBlocks(body), signature: previewSignature(body), … };
```

and the dialog renders it
([`MyBlocksSaveDialog.tsx:147-150`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.tsx)):

```tsx
{request.blockCount === 1 ? 'This block becomes ' : `These ${request.blockCount} blocks become `}
```

**Nothing here is wrong. The number is true.** The problem is that "these 5 blocks" is deictic — it
points at something — and there is nothing on screen it points *to*. The dialog is modal and centred;
the blocks are behind it.

`selectionFor` ([`:131-133`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/MyBlocksSave.ts))
already returns an array and is already the single seam that decides what goes in. That is where the
highlight reads from, so the outline and the count can never disagree — they are the same answer
rendered twice.

## What to build

### 1. The outline

An imperative SVG overlay over the workspace, drawn from the block ids in the prepared body, shown:

- while the *Save as a block…* context-menu item is hovered, and
- for as long as the dialog is open.

⚠️ **An overlay, never a model change.** Do not call `select()`, `setHighlighted()`,
`addSelect()` or anything that touches block state: `BlocklyWorkspace` serialises on every non-UI
event, and a highlight that flows through the model gets written into the saved program through the
300 ms debounce. This is the same rule `BlockValueBadges` and `DoItBalloons` are both built on, and
LGC-003 §2 was reverted for breaking it in a subtler way — `setDisabledReason` is model state, and it
reached `project.json`.

The existing badge layer is the shape to copy: a sibling SVG group, cleared on dispose, cleared on
any workspace change.

### 2. The caption

Replace the deictic sentence with a definite one, whether or not the outline is on screen:

> **This block and everything inside it and stacked under it** — 5 blocks, outlined behind this
> dialog.

and singular when `blockCount === 1`, where the second clause is a lie by implicature and must not
appear.

The sentence lives in
[`myblocks/saveIntent.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/myblocks/saveIntent.ts)
with the rest of the copy, so it stays reachable from the plain-Node runner. The dialog owns no
sentences; that split is deliberate and is the reason this feature's copy is testable at all.

### 3. Say when the click landed mid-stack

The surprise being reported is specifically the one the header predicted: a right-click in the middle
of a stack takes everything below it. When the clicked block has a previous connection that is
occupied — i.e. there is something *above* it that is **not** coming — say so:

> The 3 blocks above this one stay where they are.

## Acceptance criteria

1. Hovering *Save as a block…* outlines exactly the blocks that a save would store, and no others.
2. The outline persists while the dialog is open and disappears on save, on cancel and on Escape.
3. The outlined count and the dialog's number are the same number, derived from one call to
   `selectionFor`/`bodyFromBlocks`.
4. Right-clicking mid-stack states what is being left behind.
5. 🔴 **A save preceded by hover, dialog, and cancel leaves `workspace` and `generatedCode`
   byte-identical.** This is the criterion that catches an overlay that reached the model, and it is
   the one LGC-004 #13 and LGC-007 §6 both graded a fix by. A vacuous pass is possible here: make an
   edit *first* so a flush is actually pending, then hover and cancel, then compare.
6. The hat block still refuses by name — `canSaveBlock` is untouched.

## How to prove it

The selection and the sentences are already plain-Node testable; extend
`saveIntent`'s specs with the mid-stack case and the singular/plural boundary.

The outline needs a drive: right-click a stack of five, screenshot, count outlined blocks, cancel,
screenshot again and assert the overlay is gone. Then the byte-identity check on the node's two
parameters.
