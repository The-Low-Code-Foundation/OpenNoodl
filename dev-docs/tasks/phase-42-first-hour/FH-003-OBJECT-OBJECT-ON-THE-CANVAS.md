# FH-003 — "[object Object]" as the auto-name of an expression-valued node

Covers reported item **1**.

## What was reported

> When I set certain node main values to an expression, like Noodl.Variables.foo, it still showed
> [Object Object] as the autorenamed name of the node after setting the value.

## The mechanism — confirmed, and it was diagnosed once already

Setting fx stores `{ mode: 'expression', expression, fallback, version }` as the parameter value
(`ExpressionParameter.ts:135-147`). The auto-label reads that parameter raw:

[`BasicNodeType.ts:57-73`](../../../packages/noodl-editor/src/editor/src/models/nodelibrary/BasicNodeType.ts#L57-L73)
— `labelForNode` does `let labelName: string = node.parameters[node.type.usePortAsLabel]` and
returns the object. (`TSFixme` typing is why the compiler never caught the object-as-string.) The
canvas painter then stringifies it: `NodeGraphEditorNodePainter.ts:29-30` `String(text || '')` →
`"[object Object]"`.

**This exact failure is named in TASK-006B** (phase 3, `TASK-006B-expression-canvas-rendering/README.md:319`)
which rejected the `String(text)` guard as a band-aid and chose a "Parameter Value Resolution
Layer". What landed: `ParameterValueResolver` was built (`ParameterValueResolver.ts:124-133` is
precisely the needed guard), the rejected band-aid was *also* added, and the audit step never
reached `labelForNode`. The convenience method built for this —
`NodeGraphNode.getParameterDisplayValue` (`NodeGraphNode.ts:837-840`) — has **zero call sites**.
The property panel is guarded (`NodeLabel.tsx:89,97,138,143` wrap in
`ParameterValueResolver.toString`), which is why the panel looks fine and the canvas doesn't.

Affected: every node with `usePortAsLabel` whose label port offers fx — ~30 node types (`Object`,
`String`, `String Format`, `Button`, `Checkbox`, `Text`, …).

### Three collateral bugs from the same object

- **Label-height cache poisoning** — `NodeGraphEditorNode.ts:312` keys the wrap-height cache on
  `this.model.label + …`; every expression-labelled node shares the key `"[object Object]"`.
- **Spurious sub-label** — `NodeGraphEditorNode.ts:348` and `NodeGraphEditorNodePainter.ts:251`
  test `label !== typeDisplayName()`; an object never equals a string, so the node always renders
  as if user-labelled.
- **Latent crash** — `BasicNodeType.ts:64` calls `labelName.split('/')` under
  `portLabelTruncationMode === 'filename'` (no current node declares it; the first that does will
  throw).

## What to build

One fix at the source, `BasicNodeType.labelForNode`: resolve the parameter before the truncation
branches. Two candidates that currently disagree:

- `getParameterDisplayValue` (`ExpressionParameter.ts:80-85`) → shows the **expression text**
  (`Noodl.Variables.foo`) — what an author wants on the card;
- `ParameterValueResolver.toString` → shows the **fallback value** — what `NodeLabel.tsx` shows in
  the panel today.

**Take the expression text on the canvas, and change `NodeLabel.tsx` to match** — the node card and
its panel header should say the same thing, and `Noodl.Variables.foo` is the name the author typed.
Then harden the two comparison sites (`:348`, painter `:251`) and the cache key (`:312`) to use the
resolved string.

Length-truncate the expression through the existing `'length'` branch so a long expression doesn't
blow up the card.

## Criteria

1. fx a Button label to `Noodl.Variables.foo` → the canvas card reads `Noodl.Variables.foo`
   (truncated at 36 chars), not `[object Object]`.
2. The property panel header shows the same string.
3. Two nodes with different expressions no longer share a cached wrap height.
4. A node whose expression equals nothing set → falls back to `displayName`, no sub-label artifact.
5. Unit spec on `labelForNode` with an expression parameter (jasmine — editor specs are jasmine).
6. Eyeballed in the running editor (canvas paint is outside jasmine's reach).
