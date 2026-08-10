# LGC-005 — make the wrong connection impossible

**Status:** 📋 open · **Track: the seam** · smallest task with the largest beginner effect

## The claim

Blockly has a real type system. Connections carry checks, and the built-in blocks use the values
`'Array'`, `'Boolean'`, `'Colour'`, `'Number'` and `'String'`; when an input's types intersect an
output's types the connection is allowed, and when they do not **the blocks do not snap together**.
Type is also encoded as colour — each expression block is coloured by its type, and each empty socket
shows the colour it accepts.

We do not use it. Our custom blocks
([`NoodlBlocks.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlBlocks.ts))
and generators
([`NoodlGenerators.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlGenerators.ts))
predate the typed-port work, and `detectIO` already reports **a Noodl port type name, or `'*'` when
the blocks do not declare one** — so the type information exists on our side and stops at the block
boundary.

**Wiring it through is a labelling pass, and it buys the strongest beginner affordance in the whole
phase: a mistake that cannot be made.** Structure, not documentation — the phase's own ordering rule
puts this above every explanatory fix in it.

## §1 — Map Noodl port types to connection checks

Write the map once, in one place, both directions:

| Noodl port type | Blockly check |
|---|---|
| `number` | `'Number'` |
| `string` | `'String'` |
| `boolean` | `'Boolean'` |
| `array` | `'Array'` |
| `color` | `'Colour'` |
| `object` | `'Object'` (ours; declare it) |
| `signal` | not a value connection — statement blocks only |
| `*` | **no check** — connects to anything |

⚠️ **`'*'` must mean permissive, not `'Any'`.** `detectIO` returns `'*'` when the blocks declare no
type, which is the common case for an undeclared port. If that becomes a check value it will refuse
to connect to everything instead of everything, and the failure will look like Blockly being broken.

⚠️ **Noodl's coercing ports are the trap.** The registers already record that Units ports write
strings, that `stringlist` stays comma-separated, and that `var()` on a coercing port produced
`"NaNpx"`. A Blockly check that says `Number` where the runtime will hand over a string is worse than
no check — it promises safety the port does not provide. **Where the runtime coerces, use no check**,
and note which ports those are.

## §2 — Colour follows type

Blockly's convention is that block colour *is* the type. Our theme
([`BlocklyTheme.ts`](../../../packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyTheme.ts))
colours by toolbox category instead, which is also a legitimate scheme — MakeCode does it, and users
learn it.

**Do not change both at once.** Pick one and say why in the file. If colour stays category-based, the
type signal is the socket shape and the refusal to snap, which is still the important half.

⚠️ **Colour-as-type is a colourblindness hazard**, and this repo has already been through one
accessibility phase where a fix deleted every focus ring. Blockly ships `theme-deuteranopia`,
`theme-tritanopia` and `theme-highcontrast`; taking them (LGC-006) is the shipped answer and is
cheaper than auditing our own palette.

## §3 — `strict-connection-checker`

`@blockly/strict-connection-checker` tightens Blockly's default rules. ⚠️ **Unverified** — confirm
what it actually tightens before adopting, because the default checker already refuses type
mismatches and the marginal gain may be small.

## Acceptance

- A `Get input` block declared `number` refuses to snap into a socket that requires a string, and the
  refusal is visible (Blockly's own bump/reject animation).
- An undeclared port (`'*'`) connects anywhere, and a spec pins that — this is the regression most
  likely to escape, because it looks like correctness.
- A port whose runtime coerces has **no check**, and the list of those ports is written down in this
  file rather than only in the map.
- Every existing example project's Visual Functions still load and run —
  `code-logic-builder-greeting.json` at minimum. ⚠️ A tightened checker can invalidate saved
  programs; if it does, that is a migration and this task stops until it is decided.
- Colour scheme decision recorded, and if colour encodes type, the three a11y themes are available.

## Register

| # | Finding | State |
|---|---|---|
| L13 | Blockly's connection checks are a real type system we are not using, while `detectIO` already reports the types. **The information exists and stops at the boundary** | 📋 open |
| L14 | `'*'` from `detectIO` means "unknown", and as a check value it would mean "matches nothing". Opposite meanings, same string | ⚠️ the bug this task will produce if unattended |
| L15 | Coercing ports make a `Number` check a lie. Registers already hold three instances of coercion surprising us | ⚠️ standing |
