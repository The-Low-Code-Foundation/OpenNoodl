# AIX-004: Explain Mode

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-004 |
| **Phase** | Phase 15 — AI Collaboration Experience (Revival Track C) |
| **Priority** | 🟡 Medium (high value per unit effort) |
| **Difficulty** | 🟢 Easy to 🟡 Medium |
| **Estimated Time** | 2 weeks |
| **Prerequisites** | AIX-001; SUB-004 (catalog), SUB-005 improves quality substantially |
| **Branch** | `task/aix-004-explain-mode` |
| **Recommended executor** | 🟠 **Opus 4.8** — small surface, but the value lives entirely in explanation quality: what to include, what to omit, and how to describe data flow to a beginner without condescension. Prompt and context design carry the task. |

## Objective

Let a user select a node or subgraph and get a clear explanation of what it does, where data flows, and what triggers what — the inverse of AIX-002's authoring, built on the same substrate.

## Background

Every other AI feature in this phase helps a user *make* something. This one helps them *understand* something, and it is arguably the better fit for both surviving strategic theses.

For the comprehension thesis, the scenario is inheriting a project — your own from six months ago, a colleague's, or one an AI largely authored — and needing to know how it works. Reading a forty-node graph node by node is slow; asking "what does this page do?" and getting a straight answer is not. That is the same value proposition as asking an AI to explain unfamiliar code, except the artifact being explained is already visual, so the explanation can point at things.

For the pedagogy thesis in Phase 17 it is more directly load-bearing. The educational claim is that learners should build *with* engineering concepts intact rather than by prompting and never understanding the machine. An AI that explains what a learner is looking at — "this Condition node only passes the signal through when the toggle is true, which is why the panel appears" — is a tutor. An AI that builds things for them is the opposite of the pedagogy. Explain mode is how the AI participates in learning without doing the learning.

It is also cheap. Everything it needs exists once AIX-001 and SUB-004/005 have landed: a client, a vocabulary, and semantics. This is a two-week task delivering disproportionate value, which is why it sits above AIX-005 in priority despite being smaller.

## Current State

- AIX-001 provides the AI client.
- SUB-004 provides the node catalog (types, ports, parameters); SUB-005 adds descriptions, examples, and connection semantics — the raw material for good explanations.
- SUB-001 means components are individually readable files, so explaining one does not require loading everything.
- The editor has selection mechanics on canvas already; nothing currently explains anything.

## Desired State

- Select a node → a concise explanation of what it does *in this context* (not a generic doc-string): what feeds it, what it produces, what it affects.
- Select several nodes or a region → an explanation of the subgraph: its purpose, its data flow, its triggers.
- Explain a whole component → a summary of the page's structure and behaviour.
- Explanations reference real node names and ports so the user can follow along on canvas.
- Optionally, follow-up questions ("why does this run twice?").

## Scope

### In Scope
- [ ] Explain a single node in context
- [ ] Explain a selected subgraph
- [ ] Explain a whole component
- [ ] Context assembly from the component file + catalog + enrichment (never the whole project)
- [ ] UI surface: panel or popover, non-modal, dismissible
- [ ] Follow-up questions in the same context
- [ ] Explanations cite node names/ports so they can be followed visually
- [ ] A pedagogy-appropriate register — clear, not condescending, concept-naming where relevant ("this is state", "this is an event")

### Out of Scope
- Modifying anything (this is read-only by design — that separation is the point)
- Explaining runtime behaviour from live execution traces (Phase 19's execution history covers that ground)
- Generating documentation files (a plausible follow-on, not this task)
- Lesson content (Phase 17 LEARN-002 — though it will use this feature)

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `.../models/AiAssistant/explain/ExplainSession.ts` | Context assembly + prompt + response handling |
| `.../models/AiAssistant/explain/prompts/` | Prompt templates per scope (node / subgraph / component) |
| `.../views/panels/ExplainPanel/` | UI surface |

### Design notes

The quality lever is **context, not prompt cleverness**. An explanation is good when the model can see: the selected nodes with their parameters, their immediate connections in both directions, the catalog entries for the types involved (with SUB-005's semantics), and the component's overall shape. It is bad when the model must guess what a port means. Spend the effort on assembling that context precisely, and keep it bounded — same discipline as AIX-002.

Register matters more than usual here because of Phase 17. The same feature serves an expert reverse-engineering a colleague's page and a fifteen-year-old learning what state is. Write for the learner but do not pad for the expert: concrete, specific, naming concepts as they arise. Consider a brevity control rather than two separate modes.

Read-only is a deliberate design property, not a limitation. A user should be able to ask an AI about their project without any risk that asking changes it, and that guarantee is worth stating in the UI.

## Implementation Steps

1. **Context assembly** for the three scopes (node, subgraph, component), bounded and logged.
2. **Prompt templates** per scope; iterate against real components with a variety of shapes.
3. **UI surface** — non-modal, dismissible, positioned so the canvas stays visible (the explanation is meant to be read *while* looking at the graph).
4. **Citation linking**: node names in the explanation highlight the corresponding node on canvas when hovered or clicked.
5. **Follow-up questions** within the same context.
6. **Register tuning** — review explanations with both an expert and a beginner reader; adjust.
7. **Quality pass** across a corpus of real components, including deliberately messy ones.

## Testing Plan

- Explanation accuracy: for a corpus of components with known behaviour, check explanations against ground truth; wrong explanations are worse than none.
- Context bounded — the whole project is never sent.
- Citation linking resolves to the correct nodes.
- Beginner comprehension check: a non-Noodl reader reads an explanation and describes what the page does.
- Read-only guarantee: no code path from this feature writes to the project.

## Success Criteria

- [ ] Node, subgraph, and component explanations all work and are accurate on a real corpus
- [ ] Context bounded and logged; whole project never sent
- [ ] Node references in explanations link to the canvas
- [ ] Follow-up questions work within context
- [ ] A non-Noodl reader can describe a page's behaviour from the explanation alone
- [ ] Read-only guaranteed and stated in the UI
- [ ] Register validated with both an expert and a beginner reader

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Confidently wrong explanations mislead users — worse for learners than silence | Accuracy testing against known-behaviour components; rich catalog context (SUB-005) to reduce guessing; consider surfacing uncertainty rather than asserting |
| Explanations are generic doc-strings rather than contextual | Include actual connections and parameter values in context; test that explanations differ appropriately for the same node type in different contexts |
| Register misses both audiences | Review with both reader types (step 6); brevity control rather than forked modes |
| Context grows unbounded on large components | Bound and log; summarise distant context rather than including everything |

## References

- [Viability report — §2.1, §2.2 (comprehension and pedagogy theses)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track C](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Depends on: AIX-001, SUB-004, SUB-005. Consumer: Phase 17 LEARN-002 (AI as tutor)

## Checklist

- [x] Context assembly for node / subgraph / component scopes
- [x] Prompt templates
- [x] Non-modal UI keeping the canvas visible
- [x] Citation linking to canvas nodes
- [x] Follow-up questions
- [ ] Register tuning with two reader types — **needs a live provider run** (see NOTES §7)
- [ ] Accuracy pass over a component corpus — **needs a live provider run**
- Committed to `cline-dev` per the working-branch convention (no task branch).

## CHANGELOG

### 2026-07-24 — Built and wired (executor: Opus 4.8)

Explain Mode ships as an experimental sidebar panel. A user right-clicks a node (or a
multi-selection) and picks **Explain this node**, or opens the panel and explains the whole
component; a bounded slice of the graph plus SUB-005's catalog semantics goes to the
configured model through AIX-001's client; the answer streams back with node citations that
highlight on hover and navigate on click. Read-only by construction. Full design and the
findings are in [AIX-004-NOTES.md](./AIX-004-NOTES.md).

**New (engine — `models/AiAssistant/explain/`):** `types.ts`, `graph.ts` (live-model and
serialised-project adapters into one `ExplainGraph`), `assemble.ts` (bounded context
assembly), `render.ts`, `prompts.ts`, `citations.ts`, `ExplainSession.ts`, `index.ts`.
**New (editor):** `validation/enrichedCatalog.ts` (the first editor-side loader for
SUB-005's enriched catalog). **New (UI — `views/panels/ExplainPanel/`):** the panel, its
`ExplanationView`, `canvasLink.ts`, `explainTarget.ts`, the `useCanvasSelection` hook,
styles. **Changed:** `router.setup.ts` (register + start target-tracking),
`NodeContextMenu.ts` (the Explain context-menu entry), `tests/ai/index.ts`.

**Tests:** +47 specs across `tests/ai/explain-context.test.ts` and
`tests/ai/explain-session.test.ts`, run over the same real-project corpus SUB-006 uses —
context bounds, the three scopes, catalog semantics, citation parsing/resolution, the
read-only guarantee (structural), and streaming/follow-up through a stubbed client. Suite
**1060 → 1107, 0 failures.** `typecheck:editor` clean; lint 351 under baseline; TSFixme
ratchet unchanged by this task.

**Live editor pass (CDP) — and the defect it caught.** Verified in the running editor: the
panel registers under Editor Settings → Experimental, opens non-modally beside the canvas,
scopes correctly (node vs component), states the read-only guarantee, and correctly
disables the button when no provider is configured. The pass exposed a real defect no unit
test would have: **switching to a sidebar panel deselects the canvas** — `EditorEventBindings`
clears the selection on every `activeChanged` away from the property editor — so a panel
that read `getSelectedNodes()` on mount always saw nothing. (The dormant Data Lineage panel
has this bug today; it listens for a `selectionChanged` event nothing emits.) Fixed with
`explainTarget.ts`, which remembers what the user pointed at *before* the switch, fed by
`SidebarModelEvent.nodeSelected` and by the context-menu action capturing the live
selection at click time. Re-verified: selecting a node then opening the panel now reads
**"1 node in /#__page__/Home"** and offers **"Explain this node"**.

**Not done (both need a human with provider keys, same gap AIX-001 recorded):** register
tuning with an expert and a beginner reader, and the accuracy pass over a corpus of
known-behaviour components. Every automated check is offline. See NOTES §7 for this and the
enriched-catalog consolidation follow-ups.
