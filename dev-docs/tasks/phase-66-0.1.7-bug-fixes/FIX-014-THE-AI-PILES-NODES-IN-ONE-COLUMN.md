# FIX-014 — The AI piles nodes in one column

**Report 9** · Tier 2 · Effort **S** (prompt) + **M** (layout pass)

> *"When the MCP or AI builds something with visual and logic nodes, it seems to tend to put all
> nodes in the same central column."*

## Mechanism — pinned: there is no layout algorithm anywhere

`x`/`y` are whatever the model typed, copied verbatim (`candidate.ts:171-172`; MCP passes them
through untouched; omitted values become `undefined` and draw stacked at the origin — the
phase-42 fixture symptom). The **only** placement instruction in the product is one line:

> `authoring.ts:65` — *"Lay nodes out readably: flow left-to-right or top-to-bottom, roughly
> 150–300 units apart."*

— which is literally a spec for one column. `ContextBuilder.ts:379` gives visual nodes a placement
sentence and logic nodes silence. The MCP's instructions say **nothing about placement at all**.
This report is new — no prior finding in phases 40/55/58.

The discriminator needed already exists on both sides: `catalogVisualPredicate`
(`noodl-mcp/src/visualRoots.ts:56`) and `CatalogNode.isVisual` (editor).

## Fix direction

1. **Prompt (S):** replace `authoring.ts:65` with a two-family rule — the visual tree flows down
   a left column at its hierarchy depth; logic nodes sit in a column offset to the right
   (e.g. `x ≥ maxVisualX + gutter`), grouped beside the visual node they feed. Mirror line in
   `ContextBuilder.ts:380` for `!node.isVisual`; add the same sentence to the MCP `instructions.ts`.
2. **Structure (M):** a pure `layoutAuthoredNodes(nodes, isVisual)` in a module both clients
   import (the `traps.ts`/`visualRoots.ts` containment pattern): walk the visual tree for the left
   column, place logic nodes in a right column ordered by their first connection target's `y`.
   Run in `candidate.ts` (after `reconcileHierarchy`) and in the MCP apply path — **only for nodes
   whose `x`/`y` the model omitted or which collide**. Never move a human's arrangement.
3. **Nice-to-have (L, file separately):** an editor "Tidy this component" command reusing the same
   pass — gives the layout function a non-AI consumer and a reason to be good.

## Rulings

- Is model-supplied `x`/`y` **authoritative or advisory**? (Recommend: authoritative; the pass
  fills gaps and resolves collisions only.)
- Offset: fixed `x` vs `maxVisualX + gutter`? Do comment/annotation nodes participate?
- `update_component` on a hand-arranged component must be strictly opt-in for any repositioning —
  decide before writing the pass, not after.

## Acceptance criteria

1. Ask the internal AI for a page with a visual tree + 3 logic nodes: logic lands in its own
   column beside the visuals, no overlap — driven, both clients (Build panel and MCP).
2. A model-positioned node is never moved by the pass (control).
3. Two nodes emitted at identical coordinates are separated.
4. Pure-function specs for `layoutAuthoredNodes` (tree shapes, collisions, all-logic, all-visual).
