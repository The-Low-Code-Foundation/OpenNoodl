# DSG-002 — A design doctrine, in the one place both clients read

**Status:** ✅ **done** 2026-08-08 · `2ef44128` · **Track B2** · the shape was chosen, not invented

## What was absent

Measured before anything was written, and the measurement is the whole argument:

| Seam where design knowledge could live | What was in it |
|---|---|
| `authoring.ts` | **Zero** occurrences of composition, hierarchy, rhythm, whitespace, grid, imagery |
| `decomposition.ts` | AAQ-008's doctrine, shipped — but about *factoring*, not about what the result looks like |
| 51 validated catalog examples | **One** was visual composition |
| `get_style_vocabulary` | Tokens and per-element variants — **atoms**, never an arrangement |

## §1 — The module, and why it has no new shape

[`design.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/design.ts)
— 254 lines, **importing nothing** — follows
[`decomposition.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/decomposition.ts)
exactly rather than inventing a second pattern. That was the README's instruction and it was
followed: *a doctrine module wired into both clients through one export is a shape that has already
shipped once; do not invent a second one.*

Three exports, three consumers, matching decomposition's:

| Export | Reaches |
|---|---|
| `DESIGN_DOCTRINE_MD` (`:67`) | `get_project_info.designDoctrine` for an external agent ([`read.ts:76`](../../../packages/noodl-mcp/src/tools/read.ts), typed at [`responses.ts:99`](../../../packages/noodl-mcp/src/tools/responses.ts)), re-exported through [`editor-deps.ts`](../../../packages/noodl-mcp/src/editor-deps.ts) |
| `DESIGN_PLANNING` (`:234`) | `planning.ts` — short on purpose; the planner decides what components exist, not how they look |
| `DESIGN_AUTHORING` (`:246`) | `authoring.ts` — the two failures specific to authoring one component at a time |

**The text an external agent reads and the text the in-editor planner is prompted with are the same
bytes.** Pinned by `tests-unit/phase-55/designAuthoringPrompt.test.ts`.

## §2 — What is in it, and where each rule came from

Twelve sections (`§0`–`§11`). Not taste asserted in the abstract — **every rule was applied or
discovered building [DSG-001](DSG-001-THE-REFERENCE-BUILD.md) and measuring the result**:

- `§0` a page is an assembly of components · `§1` bands and a centred shell · `§2` sections are
  announced · `§3` the whole type scale, three weights minimum · `§4` one accent, spent carefully ·
  `§5` images are not decoration · `§6` reuse recipes, do not re-decide
- `§7` **`Columns` is the only thing that reflows.** A `Group` never responds to width; there are no
  media queries anywhere in the runtime except on one node. `autoFit`/`minWidth` for unknown-length
  grids, `layoutString` + `mediumLayout`/`smallLayout` for fixed arrangements. Breakpoints are
  measured against the **container**, not the viewport
- `§8` **the mechanics that silently undo layout** — the wrapped flex row that does not shrink its
  children, `sizeMode` gating `width`/`height`/`objectFit`, `{value, unit}` dimensions defaulting to
  `%`, falsiness wired into `visible` as free conditional rendering, `Text` is not a box
- `§9` design the empty and the loading state · `§10` words are part of the visual design ·
  `§11` **you have not finished until you have looked at it**, with three DOM checks that catch most
  of it

`§8` is the load-bearing section for a machine, and `§11` is the load-bearing one for a human: a
graph is a claim, a render is evidence.

## §3 — ⚠️ The doctrine is prepended on every turn, so its length is a per-turn cost

Unlike the catalog (fetched on demand) and the vocabulary (a tool call), this text is **in the
prompt every time**. Phase 58 measured the whole MCP surface at 27k tokens/turn and cut it to 7.8k
precisely because per-turn cost compounds across a hundred-call build. Two consequences for anyone
editing this file:

- **Do not grow it by adding rules.** Anything that can be a gate should be a gate
  ([DSG-004](DSG-004-THE-GATES-BEHIND-THE-DOCTRINE.md)); anything that can be a fetched example
  should be a recipe ([DSG-003](DSG-003-THE-COMPOSITION-RECIPES.md)). Prose is the most expensive
  and least reliable of the three.
- `DESIGN_PLANNING` and `DESIGN_AUTHORING` are deliberately short. The long `DESIGN_DOCTRINE_MD` is
  handed to an external agent **once**, at `get_project_info`.

## §4 — The rule it broke immediately

`§0` says a page is an assembly of components. The reference build's `Pages/Home` reached 66 nodes
with three hand-duplicated card sets — written by the same author, three commits after this file
shipped. That is not an argument against the doctrine; it is the measured demonstration that
doctrine alone does not survive contact with a build under pressure, and it is why DSG-004 is the
task that matters.

## Acceptance — as met

- ✅ One module, importing nothing, re-exported through `editor-deps` — no second dialect.
- ✅ Three consumers, matching decomposition's three exactly.
- ✅ Every rule traceable to something observed in a rendered DOM, not to model taste.
- ✅ `§8`'s trap list contains only defects that are **invisible in a graph**.
- ✅ Pinned by a spec so the two clients cannot drift apart silently.

## Register

| # | Finding | State |
|---|---|---|
| F11 | The design doctrine's own author broke `§0` in the reference build three commits later | ✅ recorded — the origin of `repeated-sibling-subtree` |
| F12 | **Doctrine is a per-turn cost**, unlike catalog and vocabulary, and nothing in the repo says so at the edit site | 🟠 open — worth a comment in `design.ts` next time it is touched |
</content>
