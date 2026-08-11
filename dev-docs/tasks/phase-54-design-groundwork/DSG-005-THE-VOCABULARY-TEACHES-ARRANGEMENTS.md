# DSG-005 — The style vocabulary teaches arrangements, not only atoms

**Status:** 📋 **open** · **Track B3** · **the only deliverable in this phase that was never
started** · cheapest remaining work

## What happens today

[`StyleVocabulary.ts`](../../../packages/noodl-editor/src/editor/src/models/StyleTokensModel/StyleVocabulary.ts)
(305 lines) hands an agent exactly three things — `StyleVocabulary` at `:79`:

```ts
categories: VocabTokenCategory[];   // token NAMES by category — never values
elements:   VocabElement[];         // per node type: variants, sizes, and the params each stamps
presets:    VocabPreset[];          // schemes a new project can adopt
```

Every one of those is an **atom**. `--space-6` and `Button/primary/lg` are the paint; nothing in this
object is an arrangement of them. Grep confirms it: no occurrence of `composition`, `recipe` or
`example` anywhere in the file.

This is the third of the README's track B, and the only one nobody touched. The doctrine shipped
(DSG-002), the recipes shipped (DSG-003), and the seam that both clients *fetch on demand* was left
describing paint.

## §1 — Why this seam and not more doctrine

It is the only design surface with **no per-turn cost**. The doctrine is prepended to every turn;
the catalog is expensive enough that phase 58 spent a whole task cutting it. `get_style_vocabulary`
is a **tool call the agent makes when it is deciding what things look like** — which is precisely the
moment an arrangement is useful and precisely the moment the corpus is not being read.

It is also already pure and already reaches both clients: no `ProjectModel`, no Electron, reading
overrides through the same `MetaDataSource` seam as `ProjectTokenCss`, so it works in the renderer,
in the headless harness, and inside the esbuild-bundled MCP server. **Nothing structural has to be
built.** That is the argument for doing it next.

## §2 — What to add

A fourth field, and the naming should say what it is:

```ts
/** Named parameter sets to reuse verbatim, and the arrangements they belong to. */
compositions: VocabComposition[];
```

Two kinds of content, and they are not the same thing:

1. **The named parameter sets doctrine `§6` already demands.** *"Before authoring, fix a handful of
   named parameter sets and reuse them verbatim: a `card`, a `shell`, a `sectionHead`, one
   `primaryButton`, one `outlineButton`, and a type ramp."* Today that instruction is given and
   **nothing supplies the sets** — the agent is told to fix them and left to invent them, which is
   how a page ends up with cards that disagree about their own radius. Each is a
   `Record<string, string>` of token-referenced parameters, in the same shape `variantStyles`
   already uses, so it costs no new format.

2. **A pointer to the arrangement, not a copy of it.** For each composition, the `ui-*` recipe id
   that shows it assembled (`ui-page-shell-bands`, `ui-card-grid-repeater`, …). ⚠️ **Do not inline
   the graphs.** The recipes are already fetchable by id and already gated by
   `npm run catalog:examples`; a second copy here would drift, and drift in the corpus an agent
   imitates is the F23 failure again.

## §3 — ⚠️ The constraints this file already enforces, which apply to the new field

Read them before adding anything, because two of them have already caused defects in this file:

- **Emit `var(--token)`, never a bare name and never a resolved hex.** Every value in a composition
  must be token-referenced or it defeats the point of the project having tokens at all.
- ⚠️ **A parameter with no matching port is dropped at apply with only a warning, which never
  blocks.** This file already had to rewrite element-config CSS into real parameters because
  `boxShadow` and the `padding` shorthand were being taught as settable when the runtime declares
  neither (`:100`+). **Every parameter in a new composition must be checked against the enriched
  catalog**, or the vocabulary teaches writes that silently vanish — which is the phase's founding
  defect, arriving through the fix for it.
- ⚠️ **`variant` and `size` are connection-only ports.** Setting them as parameters is discarded
  *and* rejected. A composition must carry the concrete token-referenced parameters, exactly as
  `variantStyles` does.
- **The prompt rendering has a budget.** `renderStyleVocabulary` (`:238`) elides at
  `DEFAULT_MAX_TOKENS_PER_CATEGORY = 40` and spells out variants only for requested element types,
  on purpose. Compositions must be **listed by name with their params**, and must not turn the
  compact block into a document. If it cannot be terse, it belongs in the recipe corpus.

## §4 — Both clients, one export

`get_style_vocabulary` is registered at
[`styleTools.ts:85`](../../../packages/noodl-mcp/src/tools/styleTools.ts) and takes
`detail: "full" | "prompt"`, calling `buildStyleVocabulary` and `renderStyleVocabulary` respectively.
Adding the field to the interface reaches **both** paths and both clients with no second wiring —
provided the new content goes into the same two functions, and not into a tool description.

## Acceptance

- `get_style_vocabulary` (`detail: "full"`) returns named compositions with token-referenced
  parameters, and each names the `ui-*` recipe that shows it assembled.
- `detail: "prompt"` renders them terse, and the whole block does not grow beyond its current
  budget — measure the rendered length before and after, **on the wire**, and put both numbers in the
  commit.
- ⚠️ Every parameter in every composition **exists as a port on the node type it targets**, checked
  against the enriched catalog, not against the element configs. A spec pins this, in the shape of
  `styleVocabularyPorts.test.ts`, which already exists for exactly this failure.
- No `variant`/`size` parameter is emitted anywhere in the new content.
- No recipe graph is inlined; ids only.
- A drive proves the consequence: an agent asked for a card, given only the vocabulary, emits the
  composition's parameters rather than inventing a radius.

## Register

| # | Finding | State |
|---|---|---|
| F20 | **The vocabulary describes atoms only** — no composition, recipe or example anywhere in 305 lines | ✅ verified 2026-08-10 |
| F21 | Doctrine `§6` tells the agent to fix named parameter sets and **nothing supplies them** | 🔴 open — this task's §2.1 |
| F22 | This file has already taught unsettable parameters once (`boxShadow`, `padding` shorthand) — a write with no port is dropped with a warning that never blocks | ✅ fixed then; ⚠️ the same trap applies to every composition added |
</content>
