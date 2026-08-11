# LEG-001 — one comment in 2,045 nodes, and the field is not in the vocabulary

**Status:** 📋 open · **Est. 3 d** · **Track: the write path** · the flagship

## The natural experiment this task is the second arm of

Two fields describe a node's intent. One is in the authoring vocabulary. One is not.

| | in `AUTHORED_NODE_FIELDS`? | written by agents |
|---|---|---|
| `label` — *"What this node is for, in this graph"* | **yes**, [line 143](../../../packages/noodl-editor/src/editor/src/validation/authoringVocabulary.ts) | **1,003 of 1,123 nodes (89.3%)** |
| `metadata.comment` — why it is the way it is | **no** | **1 of 2,045** |

Measured 2026-08-10 across the eleven phase-55/58 model runs and all 35 projects in
`NodeGX test projects/`. Zero comments in the 34 hand-built `library/` prefabs. Zero in all 65
`project.json` files in this repo. The one comment in existence is in a project called `test`.

An optional field with a single clear sentence of description got 100% compliance from every
frontier model. **This task is that sentence, written for the other field.**

## §1 — Why it cannot be written today, even by an agent that wants to

`authoringVocabulary.ts` documents the gap against itself, in `SURFACE_DIVERGENCES`:

> ⚠️ The consequence is asymmetric and worth knowing: `stateParameters`, `stateTransitions` and
> **`metadata`** reach disk through MCP (the storage schema allows additional properties) and
> **cannot be expressed in the editor at all**, where `CARRIED_NODE_FIELDS` carries them over from
> the base instead. Both solve "an AI revision must not eat hand-tuned work"; only one of them lets
> an agent author it in the first place. Same gap as `variant` above — AAQ-011 F14.

So there are two different failures wearing one number:

- **In the editor** (`submit_component`) the field is unreachable. Not discouraged — absent. A model
  cannot write what the schema does not name.
- **Through MCP** it reaches disk only because the node schema is `.passthrough()`. It is undeclared
  and undescribed, so writing one requires knowing the storage format rather than reading the tool.
  Nobody has ever done it.

**This is not "the agent does not bother".** It is a field nobody was told about, and the `label`
column is the control that proves telling works.

## §2 — The substrate is complete. Only the door is missing

Nothing here needs building. CAN-004 shipped the whole reading side:

| Piece | Where | State |
|---|---|---|
| model + undo | [`NodeGraphNode.ts:653-690`](../../../packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts) — `getComment`, `hasComment`, `setComment`, `commentChanged` | built |
| persistence | `toJSON` line 1590 carries `metadata`; `fromJSON` line 180 restores it through `stripCodeHistoryMetadata` | built |
| canvas affordance | [`NodeGraphEditorNodePainter.ts:302`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter.ts) — a gutter stripe in the titlebar | built |
| reading | [`NodeGraphEditorNode.ts:240-249`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts) — hover tooltip, ranked below node health | built |
| writing, by hand | [`NodeContextMenu.ts:186-195`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeContextMenu.ts) — *Add comment* / *Edit comment*, single-select, multiline popup | built |

⚠️ **So the README's row saying "Built. Nothing produces one" is half wrong**: a human path exists
and is well made. What does not exist is an *authoring* path — and, per LEG-005, a path a human
finds without already knowing about a right-click menu.

## §3 — The change

**One row in the table, two renderers, no new concepts.**

```ts
// AUTHORED_NODE_FIELDS, beside `label`
{
  name: 'comment',
  kind: 'string',
  description: 'Why this node is the way it is — a constraint, a rule, a decision. Omit when the type and label already say it.'
},
```

Three decisions that are the whole design, and each is settled by evidence already in the repo:

1. **Optional, not required.** The 89.3% arm was optional. A required field is an untested
   intervention that also breaks a shipped external API — `requiredIn: ['mcp']` makes previously
   valid calls fail hard, per the module header. Do not.
2. **`comment`, flat in the authored vocabulary; `metadata.comment` in storage.** The agent should
   not have to know about the metadata bag, which also holds `metadata.merge` and the CED-001 code
   history. The renderers map the flat field onto the bag on the way in and out. ⚠️ It must survive
   `stripCodeHistoryMetadata`, and adding a key beside `merge` must not disturb it.
3. **The description carries the *judgement*, because the validator cannot.** "Omit when the type and
   label already say it" is the rule the README wanted LEG-002 to enforce, and a rule about whether
   a sentence is redundant is not checkable. Put it where it works — in the field description a model
   reads before writing — and do not ask a diagnostic to have taste.

**The description text is the deliverable.** `label`'s nine words got 100%. Spend the time on this
sentence, not on the plumbing around it.

## §4 — Where a comment earns its place

Worth writing into the description or the doctrine, because it decides whether the field produces
signal or noise:

- **A decision with an alternative** — *"deliberately not a Repeater; the three cards differ in more
  than data"*.
- **An external rule the graph cannot state** — the décret citation from the README's exit criteria,
  a regulatory threshold, a client's contractual limit.
- **A trap the next reader will otherwise re-introduce** — *"`sizeMode` must stay `explicit` or
  `objectFit` is ignored"*, which is a real defect in this codebase and exactly the sentence that
  would have prevented it.

And where it does not: restating the type, restating the label, or narrating what the wire already
shows.

## §5 — The doctrine half

`AUTHORING_TRAPS` and the doctrine markdown already reach every MCP session
([`read.ts:10`](../../../packages/noodl-mcp/src/tools/read.ts)). One or two sentences there on when
a comment is worth writing, matched to §4. Cheap, and it is the difference between a declared field
and a used one.

⚠️ Doctrine is **not** a substitute for the vocabulary row, and the phase's ordering rule says so:
**structure > gate > documentation.** The field goes in the table first; the doctrine sentence
follows it and never replaces it.

## Acceptance

- `comment` is in `AUTHORED_NODE_FIELDS`, rendered by both `submit_component` (JSON Schema) and
  `create_component`/`update_component` (zod), and `noodl-mcp/tests/vocabularyParity.test.ts`
  passes with it — the spec that fails when the two doors describe a shared field differently.
- A comment authored through **either** door reaches `metadata.comment` on disk, survives a save →
  load → save round trip, and renders its gutter stripe and hover tooltip with no further work.
  (The reading side is CAN-004's; the check is that nothing had to change there.)
- ⚠️ `metadata.merge` and the code-history strip are **unaffected** — asserted, not assumed. A node
  with source-code ports keeps its `merge.soureCodePorts` after a comment is written to it.
- **The measurement is re-run and recorded.** Re-author one phase-55 fixture with the field declared
  and count comments per node. The comparable baseline is **1 in 2,045**; anything above zero is new
  information and the number goes in the register whichever way it falls.
- ⚠️ **Judge the comments, do not count them.** A run that produces 100% coverage of *"This is a
  Group"* has failed this task while passing a coverage check. Read twenty and say so in the
  register — the `Button 3` failure mode the README named, arriving in prose instead.

## Register

| # | Finding | State |
|---|---|---|
| L5 | `label` (in the vocabulary) → 89.3%; `metadata.comment` (not in it) → 1 in 2,045. The strongest single argument in the phase, and it is a natural experiment already run | ✅ measured 2026-08-10 |
| L6 | `metadata` cannot be expressed in the editor's authoring schema at all. The vocabulary file documents this against itself as AAQ-011 F14 | 📋 the task |
| L7 | The README's "Built. Nothing produces one" is half wrong — CAN-004 shipped stripe, tooltip and context menu. What is missing is the *authoring* door and (LEG-005) a discoverable human one | ⚠️ corrected |
| L8 | Cheap models are the exception: haiku 1/94 in one replay, qwen 3/19. Whatever this task ships, expect the same split — and see LEG-002 §2 before reaching for a gate | ⚠️ standing |
| L9 | The deliverable is a sentence. Nine words got 100% for `label`; the plumbing is an afternoon | 📋 open |
| **L10** | 🔴 **The re-measurement came back ZERO.** One cold storefront replay, DeepSeek-V4-Pro, $3.62, 39 turns, a competent artefact (12 components, 25 connections): **0 of 182 nodes carry a comment**, 0 of 24 write/stage calls carried the field, and the word "comment" appears in **none** of the 39 assistant turns. Same run, same schema, `label` → **103 (56.6%)**. Declaring the field is necessary but **not sufficient**; §3's natural-experiment inference does not transfer. Full write-up and the reproduction in [`measurements/LEG-001-COMMENT-REMEASUREMENT.md`](measurements/LEG-001-COMMENT-REMEASUREMENT.md) | ✅ measured 2026-08-12 |
| **L11** | 🔴 **`noodl-mcp` serves `dist/noodl-mcp.cjs`, not `src/`** — and `dist` is gitignored. The merged `comment` row was **absent from the served schema** until the bundle was rebuilt. Run against the stale build, the paid measurement would have returned zero for a plumbing reason and been recorded as refuting the task. **Rebuild and probe `tools/list` before any run that depends on a vocabulary change** | ⚠️ standing trap |
| **L12** | **The doctrine half of this task (§5) never shipped.** No mention of comments in `AUTHORING_TRAPS` or anywhere in `dev-docs/best-practices/`. The structural half is in and measures zero; the documentation half is untested and cheap, and it is the next thing to try before spending on another model | 📋 open |
