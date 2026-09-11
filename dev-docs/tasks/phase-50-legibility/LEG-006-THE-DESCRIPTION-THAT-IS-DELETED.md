# LEG-006 — the description an agent writes, and the save that deletes it

**Status:** 📋 open · **Est. 2 d** · **Track: the write path** · no dependencies · **do this first**

## Why this is first in a phase about legibility

Every other task here *adds* a way to say what something is for. This one stops the platform
**destroying** one that already works, silently, on a save the user did not know was destructive.

A component `description` is not a nice-to-have in this product. It is the one sentence an agent
reads before deciding whether to instantiate a component instead of rebuilding it, and it is the row
a human scans in the picker. It is authorable today through three doors. It survives none of them.

## §1 — The three facts, read in source

**It is in the authoring vocabulary.** `AUTHORED_PAYLOAD_FIELDS` declares it, with a description
telling the model exactly what to write:

```ts
// validation/authoringVocabulary.ts:266
{ name: 'description', kind: 'string', description: 'One or two sentences: what this component is and does' },
```

**It is in the plan tools**, so an external agent can set it:

```ts
// noodl-mcp/src/tools/planTools.ts:679
description: z.string().optional().describe('Summary stored on the component (creates only)'),
```

**And the v2 exporter does not write it.**
[`ProjectExporter.buildComponentV2Files`](../../../packages/noodl-editor/src/editor/src/io/ProjectExporter.ts)
(line 297) builds `componentFile` from exactly six keys — `$schema`, `id`, `name`, `path`, `type`,
`modified` — then conditionally attaches `metadata` and `ports`. `description` is not among them,
and `ProjectImporter` never reads it. So it is not merely un-round-tripped: **it is deleted on the
first editor save after any write that set it.**

⚠️ **Measured, not inferred.** Phase 56's BEN-005 drive (register B23, 2026-08-09) watched one
editor save rewrite `/Components/BenchProbe`'s `component.json` without the 218-character
description MCP had authored, and without `created` and `modifiedBy` alongside it.

## §2 — Why the loss is invisible, which is the part that matters

Nothing reports it. The save succeeds, the validator is clean, the graph is intact, and the only
evidence is a field that is no longer in a file nobody opens. A user who provisions a project
through MCP, opens it in the editor to look at it, and closes it has destroyed every description in
the project by *reading*.

That is the shape phase 58 named as the reason AWP-004 exists: **an instrument that stays green
through a loss teaches the loss is not happening.** Restoring descriptions by hand is cosmetic — the
next save strips them again — which is why this is a code fix and not a fixture repair.

## §3 — The fix

Three edits, and the third is the one that is easy to forget.

1. **`buildComponentV2Files`** — carry `description` onto `componentFile` when the legacy component
   has one, beside the existing `metadata` and `ports` conditionals. Same guard shape: omit the key
   entirely when absent, so a component without one does not gain an empty string and a spurious
   diff (F46).
2. **`ProjectImporter`** — read it back onto the legacy component. Without this half the exporter
   writes a field the next load discards, which looks identical from the outside.
3. **`created` and `modifiedBy`** — the same save drops these two, measured in the same drive. They
   are not this phase's subject and they are three lines in the same object. Carry them or write
   down why not; leaving them is how a register row outlives its fix.

⚠️ **Round-trip is the acceptance, not the write.** The obvious spec — author a description, read
the file, see the description — passes with the importer half missing. The spec that catches it is
*author → save → load → save → read*, which is the sequence BEN-005 actually performed.

## §4 — `list_components` never returns it

Separate half, same task, because the field is worthless if it is stored and never surfaced.

[`read.ts:85-101`](../../../packages/noodl-mcp/src/tools/read.ts) returns `store.listComponents()`
rows verbatim — path, legacyName, type, node and connection counts. An agent choosing between
fourteen components sees fourteen paths and no purpose. The README's framing was right:

> An agent instantiating a component should be able to read what it is for without reading its
> graph.

Add `description` to the registry row and to `ListComponentsResponse`, and name it in the tool's own
description so a model knows the column is there.

⚠️ **This is a token-budget change, and the budget is already the constraint.** AWP-005 cut the MCP
surface from 89 tools and 25,886 tokens/turn to 20 and 7,828, and `get_node_type` on `Group` still
costs 11k. A one-or-two-sentence description on every row of a 40-component project is real spend.
Two rules follow: **truncate at a stated ceiling** (a round number in the printed unit — characters,
not tokens), and **measure the delta on the wire, pretty-printed**, because that is how MCP
responses are actually serialised and measuring the object under-reports.

## §5 — The editor surfaces, in order of cheapness

- **The component picker row** — the highest-value one, and the reason the field exists.
- **The Explain panel** — it already scopes to a component
  ([`ExplainPanel.tsx:59`](../../../packages/noodl-editor/src/editor/src/views/panels/ExplainPanel/ExplainPanel.tsx)
  renders *"Explain this component"*), so it has the target and lacks the sentence.
- **Anywhere that already lists components.** Do not invent a fourth surface for it.

## Acceptance

- **The round trip holds.** A component authored with a description, saved by the editor, reloaded
  and saved again, still has it — proven by a spec running the full four-step sequence, not by
  reading one written file. `created` and `modifiedBy` in the same assertion, or a written reason
  they are excluded.
- A component *without* a description gains no key and produces **no diff** on a save that changes
  nothing else. (F46: a spurious-save class exists in this repo and this is exactly its shape.)
- `list_components` returns the description, truncated at a stated ceiling, and the tool description
  says the column exists.
- ⚠️ **The wire cost is measured**, pretty-printed, before and after, on a project with ≥20
  components. The number goes in the register whether or not it is comfortable.
- The picker shows it, and a human can tell two similarly-named components apart from the list
  without opening either.

## Register

| # | Finding | State |
|---|---|---|
| L1 | `description` is declared in the authoring vocabulary and in `planTools`, and `buildComponentV2Files` writes six keys that do not include it. **Authorable, then deleted, silently** | 📋 the task |
| L2 | The importer half is invisible in the obvious spec. Round-trip twice or the fix looks done and is not | ⚠️ the trap |
| L3 | `created` and `modifiedBy` are dropped by the same save. In scope by adjacency; excluded only in writing | 📋 open |
| L4 | Adding a description to every `list_components` row is a token cost against a budget AWP-005 spent a session shrinking. Ceiling stated, delta measured on the wire | ⚠️ standing |
