# CN-006 — Scaffold a kit

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M |
| **Surface** | `mcp`, `editor` |
| **Rulings** | ✅ **D1** (editor create command) · ✅ **D2** (JS + JSDoc types) · ✅ **D8** (tokens by default) |
| **Depends on** | CN-005 (the types the scaffold annotates against) |

## The job

Two entry points onto one generator:

- **`create_node_kit`** in `noodl-mcp` — so Claude Code can make a kit, which ✅ D1 and the phase's
  §6 both treat as a first-class use rather than an afterthought.
- **"New node kit"** in the editor — writes the scaffold and **opens `index.js`** in the code
  editor, per D1.

Output: `noodl_modules/<kit>/manifest.json`, `index.js`, `README.md`.

## What the generated kit must look like

This is the most consequential paragraph in the task. **The scaffold is what everyone copies**, so it
is the phase's main lever on whether kits are any good — more than any doc.

✅ **It must model P2** — *ports are the product; JavaScript is the escape hatch*:

- Every visual decision is a **port**: colour, radius, size, spacing, font size, and any threshold.
- ✅ **D8** — colour and spacing ports default to `var(--token)` values, not hex. AIB-001's
  passthrough in `react-component-node.ts` already handles a `var(--token)` string on a units-typed
  port (it must reach the style un-suffixed, or you get `var(--space-4)px`). The scaffold makes that
  the path of least resistance rather than a thing to discover. **Nothing validates it** — an author
  may hardcode, and brand colours and data-viz palettes are legitimate.
- **No buried constants.** If the example node needs a rule, the generated README shows it wired to
  a stock `Function`/`Expression` node rather than written in the component.
- ✅ **D2** — the definition carries the JSDoc `@type` annotation so autocomplete works immediately,
  with no build.
- The example uses `window.React` and a hook, so the single-React guarantee is exercised from line
  one rather than assumed.

⚠️ **A scaffold that emits a node with three hardcoded hex colours teaches the opposite of this
phase's second principle, forever.** Review the generated output against P2 as an acceptance
criterion, not as taste.

## Acceptance criteria

1. Scaffold a kit, reload the preview, and the example node is **in the picker and placeable** with
   no further edits.
2. The generated `index.js` produces autocomplete in VS Code with no `tsconfig` and no
   `node_modules`.
3. Every colour/spacing input in the generated node defaults to a `var(--token)`, and the rendered
   result **actually picks up the token** — verify the computed style, not the parameter value.
   ⚠️ `an-icon-host-that-sets-fill-sets-nothing` is the local precedent for a style that is set and
   does nothing.
4. The generated kit passes CN-004's validation clean. A scaffold that emits a kit our own validator
   complains about is not shippable.
5. Kit names collide safely: scaffolding twice with the same name refuses rather than overwriting.
6. **Build the caller**: scaffold a kit *through the MCP tool*, from a real session, and place the
   node. Generating files is not the feature; the feature is that the node arrives.

## Traps

- ⚠️ **The MCP tool surface budget — numbers corrected 2026-08-15.** The bar is **8,280**, the last
  measurement **8,223**, so there are **57 tokens** free, not zero: LEG-001's original 58 were spent
  by P67 / UNI-010's `lesson` group and the bar was renegotiated to restore the slack. One new tool
  must fit inside those 57. State what it costs, and if it does not fit, say what it displaces —
  **CN-009 is competing for the same 57**, and the test note forbids a third renegotiation.
- ⚠️ **`scripts/` is not in `build.files`.** If any part of the generator lives under `scripts/`, it
  is dead for real users and no gate will catch it.
- ⚠️ The editor command writes into the project directory. **Opening a project already writes three
  files**; adding a fourth write path needs the same care about dirtying and undo.

## Out of scope

- The kits list and provenance UI — that is **CN-006b**.
- The published reference kit — ✅ **D5** makes that a separate, deliberately minimal artefact under
  CN-016. This task generates a *starting point*, which is a different job with a different reader.
