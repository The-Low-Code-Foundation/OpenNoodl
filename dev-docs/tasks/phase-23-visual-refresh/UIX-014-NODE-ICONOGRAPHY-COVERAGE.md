# UIX-014: Node iconography coverage

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-014 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 3 — polish |
| **Priority** | 🟡 Medium (every node card and preview in the picker; not blocking) |
| **Difficulty** | 🟢 Low code, 🟠 real design work (≈115 glyphs) |
| **Prerequisites** | UIX-013 (landed), UIX-010 (icon stroke/grid redraw — same drawing standard) |
| **Filed by** | UIX-013, 2026-07-26 |
| **Branch** | commit directly to `cline-dev` |

## Objective

Give the node types that have no glyph one, so the picker stops falling back to
a letter for most of the library.

## Background

`nodeNameToIconName` — now `NodePicker.icons.ts`, previously a switch inside
`noodl-core-ui`'s `EditorNode` — maps **14** node types to an icon. The library
has ~130. Everything else renders with no icon at all; UIX-013 replaced the
resulting empty square with a **category-tinted letter** (the node's initial) so
a card degrades gracefully, but a grid where most cards show `P`, `N`, `S` is
recognisably a gap rather than a design.

The mapping is keyed by node *type name* (`net.noodl.controls.button`, `Group`),
so it is a flat lookup — the code side of this is trivial. The work is drawing
~115 glyphs to the UIX-010 standard and deciding which nodes genuinely need a
distinct mark versus a shared category mark.

## Scope

- Extend `NodePicker.icons.ts` (and, if the references panel and property editor
  should benefit, the `EditorNode` switch it was copied from — consider merging
  the two into one exported map rather than keeping two).
- Draw the missing glyphs into `noodl-core-ui`'s icon set, `currentColor`-clean
  and on the UIX-010 grid.
- Decide the fallback policy: a per-*category* mark is an option, but note that
  UIX-013 rejected it as actively misleading ("everything looks like a cloud")
  compared with the letter.

## Out of scope

- The letter fallback itself — it stays as the last resort for anything still
  unmapped, including third-party module nodes, which can never be exhaustively
  covered.

## Acceptance

1. Every node in the core library's picker index renders a glyph, or is listed
   in the notes as a deliberate letter.
2. Both themes; glyphs tint from `--cat` like the existing ones.
3. Hex ratchet unchanged; core-ui icon assets carry `currentColor`.
