# Phase 15: AI Collaboration Experience (Revival Track C)

**Phase:** 15
**Status:** 🔴 Not Started
**Effort:** ~17-23 weeks total (tasks overlap; AIX-005 is deliberately deferred)
**Priority:** CRITICAL — this is the product bet

---

## Overview

This phase turns OpenNoodl's AI assistant from a stale node-generation copilot into a **visible collaborator inside the graph** — an AI that authors pages and components directly into a node graph that both the human and the AI can read, review, and own.

The strategic premise (from `dev-docs/reviews/NOODL-VIABILITY-REPORT.md` §2): "visual development instead of code" lost to vibe coding on speed, and cannot win it back. What survives is legibility. AI-generated codebases are fast to produce and hard to explain, audit, or safely change. A node graph is a live, structural, inspectable artifact — and OpenNoodl's runtime node model is genuinely framework-neutral (zero React imports in `packages/noodl-runtime/src`), so "the graph is the legible spec" is architecturally true, not marketing. The surviving product is therefore **the AI builds *with* you, in a medium you can both read** — not "build by hand instead of prompting."

The raw material exists. `packages/noodl-editor/src/editor/src/models/AiAssistant/` is a working node-generation copilot with streaming, chat history, a ReAct-style agent loop, and node templates — but it streams against OpenAI endpoints with model IDs that range from stale to fully retired (`text-davinci-003`). Phase 15 modernizes that plumbing, then builds the three experiences that make the thesis tangible: the authoring loop, graph-native review, and explain mode.

---

## Task Breakdown

| Task | Name | Description | Effort |
|---------|------|-------------|--------|
| AIX-001 | [Modern AI Client](./AIX-001-MODERN-AI-CLIENT.md) | Provider-agnostic client: current Claude/GPT models, configurable endpoints, local models via Ollama; migrate ReAct + templates; fix stale IDs/prices and the function-query-database import bug | 2-3 wks | 🟠 Opus 4.8 |
| AIX-002 | [The Authoring Loop](./AIX-002-AUTHORING-LOOP.md) | "Describe a page → agent writes `components/<Page>/*.json` → editor hot-loads → accept/refine/reject", streaming live onto the canvas. **The demo.** | 4-6 wks | 🔵 Fable 5 |
| AIX-003 | [Graph-Native Review](./AIX-003-GRAPH-NATIVE-REVIEW.md) | Visual diff of AI-proposed changes on canvas — added/removed/rewired nodes highlighted before acceptance | 3-4 wks | 🟠 Opus 4.8 |
| AIX-004 | [Explain Mode](./AIX-004-EXPLAIN-MODE.md) | Select node/subgraph → AI narrates what it does, where data flows, what triggers what | 2 wks | 🟠 Opus 4.8 |
| AIX-005 | [Agentic UI Nodes](./AIX-005-AGENTIC-UI-NODES.md) | Implement phase-3.5's AGENT-001..007 (SSE/WebSocket/state-store nodes) so Noodl apps can *be* agent frontends | 6-8 wks | 🟠 Opus 4.8 |
| AIX-006 | [Style Vocabulary](./AIX-006-STYLE-VOCABULARY.md) | Expose the shipped phase-9 token/variant system to the authoring loop + MCP; StyleAnalyzer as post-generation style linter. Added 2026-07-24 from the salvage audit — the cheapest visible quality jump for the G2 demo | ~1 wk | 🟠 Opus 4.8 |
| AIX-007 | [Token Cost Reduction](./AIX-007-TOKEN-COST-REDUCTION.md) | Prompt caching + cache-first prefix ordering, per-call-site reasoning effort, cache-aware cost accounting, model default re-decided on evidence. Added 2026-07-26 from a cost review of the AIX-002 slice-5 measurements — four unexploited levers, ≥30% target | ~1 wk | 🟠 Opus 4.8 |
| AIX-008 | [Sandbox Preview](./AIX-008-SANDBOX-PREVIEW.md) | Render the staged candidate, running on sandboxed data, beside its graph | ~1 wk | 🟠 Opus 4.8 |
| AIX-009 | [Project Context Documents](./AIX-009-PROJECT-CONTEXT-DOCS.md) | A git-tracked `docs/` the human owns and the AI reads before authoring — brief, architecture, and the conventions file that outranks the agent's defaults. **Blocked on the deployment overhaul:** project files currently ship to the public origin | ~1-2 wks | 🔵 Fable 5 |
| AIX-010 | [Project Review & Docs Retrofit](./AIX-010-PROJECT-REVIEW-AND-DOCS-RETROFIT.md) | Read an existing hand-built project and draft its docs for review; surfaced as a dismissible recommendation, never auto-run | ~1-2 wks | 🟠 Opus 4.8 |
| AIX-011 | [Project-Scope Authoring](./AIX-011-PROJECT-SCOPE-AUTHORING.md) | Raise authoring from one component to a reviewed multi-component plan, staged all-or-nothing under one undo step. Makes "wire this page up to the others" possible | ~3-4 wks | 🔵 Fable 5 |
| AIX-012 | [AI Project Creation](./AIX-012-AI-PROJECT-CREATION.md) | "Start with AI" at the launcher: a scoping conversation that produces project + docs + a plan, stopping deliberately short of building | ~2 wks | 🔵 Fable 5 |

### The AIX-009…012 group (added 2026-07-27)

These four are **one feature in four shippable pieces**, filed together after a
scoping discussion. The through-line: the assistant is not short of capability,
it is short of *this project's* context — and the moment that context is
cheapest to capture is the moment nobody is capturing it.

AIX-009 defines where that context lives and feeds it to the authoring prompt,
reusing the exact seam AIX-006 used to get 2.4× more on-system styling. AIX-010
back-fills it for projects that already exist. AIX-011 removes the
one-component ceiling so the assistant can act at the scale the docs describe.
AIX-012 puts the whole thing at the front door, where a scoping conversation is
happening anyway.

Deliberate non-goal across all four: **no AI-generated markdown that describes
the graph.** Explain Mode already narrates the live artifact on demand, and a
prose copy is a second source of truth that rots on the next node drag — which
would quietly undo this phase's premise that the graph *is* the legible spec.
The docs hold only what the graph structurally cannot: intent, decisions,
rejected alternatives, external contracts, and the rules for next time.

---

## Sequencing & Dependencies

```
AIX-001 (modern client) ── first; everything else calls through it
    │
    ├──► AIX-002 (authoring loop)   ⟵ depends on phase-13 SUB-004 (node catalog)
    │        │                         and SUB-006 (semantic validator)
    │        ├──► AIX-003 (review)  ⟵ depends on phase-13 SUB-007 (graph diff)
    │        └──► AIX-005 (agentic UI nodes) — only after AIX-002 proves out
    └──► AIX-004 (explain mode)     ⟵ same catalog as AIX-002; can run in parallel

AIX-007 (token cost) ── after AIX-002 ships; needs its measured baseline to optimise against

AIX-009 (project docs) ⟵ BLOCKED on the deployment overhaul (private files deploy today)
    ├──► AIX-010 (docs retrofit)        ⟵ also needs AIX-004's graph reading
    └──► AIX-011 (project-scope authoring) ⟵ also needs AIX-003's review document
             └──► AIX-012 (AI project creation)
```

- **AIX-001 goes first.** It is pure plumbing with no cross-phase dependencies, and every other task consumes it.
- **AIX-002 and AIX-004 depend on phase-13 (`format-ai-substrate`, documented in parallel):** SUB-004 delivers `node-catalog.json` (the enumerable node/port/parameter vocabulary), SUB-006 the semantic validator. Without those, an LLM can emit schema-valid JSON that wires nonexistent ports.
- **AIX-003 depends on phase-13 SUB-007** (v2-aware graph diff).
- **AIX-005 is last, by design.** Phase 3.5 (AGENT-001..007) is 0/7 spec stubs today; it is genuinely differentiating but pointless before the authoring loop exists.
- **AIX-007 could not have been written earlier.** It optimises against AIX-002's slice-5 live measurements; before those existed there was no baseline to beat and no way to tell a real saving from a plausible one. It edits the adapter layer, so explain mode and review inherit the wins without their own work.
- **AIX-009 is blocked outside this phase.** `copyProjectFilesToFolder` copies the whole project folder into the deploy output past a five-name hardcoded filter, so a `docs/` folder of private scoping notes would be served from the app's public origin. The fix belongs to the deployment overhaul — the hand-off is written paste-ready in [DEPLOY-HANDOFF-PROJECT-DOCS.md](./DEPLOY-HANDOFF-PROJECT-DOCS.md), and AIX-009's acceptance criterion 8 is the interlock.
- **AIX-011 is the hard one, and the reason is transactional, not conversational.** Reject is currently safe for a *structural* reason — a staged candidate is a detached `ComponentModel` and rejecting means `ProjectModel` was never called. Applying N components naively breaks that property. Preserving it (stage everything, apply inside one `UndoActionGroup`) is the task's actual engineering content.
- **The multi-component substrate already exists — in MCP, not the editor.** `create_component`, `update_component`, `delete_component` and `search_project` are live in `packages/noodl-mcp`, and Claude Code driving a project does genuine project-scope work today. AIX-011 is not new primitives; it is bringing that reach into the surface that has the canvas, the diff review and the undo stack.

## Exit Criterion

From `dev-docs/reviews/NOODL-REVIVAL-ROADMAP.md` (Track C): **"a stranger watches an AI build a page inside a graph they can read, in an app they can install — plus visual diff review of the AI's work."**

## Gate G2

This phase feeds the roadmap's demand gate (roadmap §6, ~Month 9): the AIX-002 demo must ship in a signed build for a full quarter, alongside the two phase-17 pilots (LEARN-006). The question G2 asks is whether legibility-motivated builders and learners **return unprompted** — retention, not signups. If they don't, the roadmap's own answer is to wind down to maintenance + export. Build every task here with that test in mind: distance-to-demo is the prioritization function.

## References

- `dev-docs/reviews/NOODL-VIABILITY-REPORT.md` — §2 (strategic case), §4.2 (format gaps), Appendix H (AiAssistant findings)
- `dev-docs/reviews/NOODL-REVIVAL-ROADMAP.md` — Track C (C-01..C-05), §6 gates
- `packages/noodl-editor/src/editor/src/models/AiAssistant/` — existing copilot code
- `dev-docs/tasks/phase-3.5-realtime-agentic-ui/` — AGENT-001..007 specs (implemented by AIX-005)
- `dev-docs/tasks/phase-13-format-ai-substrate/` — SUB-004/006/007 prerequisites (documented in parallel)

---

_Created: 2026-07-22_

## Executor guidance

Each task file carries a **Recommended executor** row (criteria shared across revival phases 12–20):

| Tier | Use when | In this phase |
|------|----------|---------------|
| 🟢 **Sonnet 5** | Known fix, specified, mechanically verifiable | None — every task here involves interaction or prompt design |
| 🟠 **Opus 4.8** | Substantial engineering against a clear target | AIX-001 (client abstraction), AIX-003 (review UI over an existing diff engine), AIX-004 (explanation quality), AIX-005 (streaming nodes and lifecycle) |
| 🔵 **Fable 5** | The task defines the product bet itself | AIX-002 — the authoring loop's interaction design decides whether the repositioning works; the code is the easy half |

Individual pieces inside these tasks drop a tier once the design is fixed: migrating one prompt template (AIX-001) or implementing one streaming node (AIX-005) is Sonnet work under an established pattern.
