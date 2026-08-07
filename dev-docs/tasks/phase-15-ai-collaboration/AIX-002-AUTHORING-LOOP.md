# AIX-002: The Authoring Loop

## Metadata

| Field | Value |
|-------|-------|
| **ID** | AIX-002 |
| **Phase** | Phase 15 — AI Collaboration Experience (Revival Track C) |
| **Priority** | 🔴 Critical — **this is the demo the strategy is gated on** |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 4–6 weeks |
| **Prerequisites** | AIX-001; SUB-001, SUB-004, SUB-006 (Phase 13) |
| **Branch** | `task/aix-002-authoring-loop` |
| **Recommended executor** | 🔵 **Fable 5** — the hard part is not the plumbing but the loop design: how the agent is prompted, how validator feedback drives iteration, what "accept/refine/reject" means for a graph, and how much autonomy to grant. This is the product bet made concrete, and its interaction design determines whether the whole repositioning works. |

## Objective

Deliver the core AI-collaboration experience: a user describes a page in natural language, an agent authors it as real component files, the graph appears live on the canvas, and the user accepts, refines, or rejects it.

## Background

This task is where the revival strategy is tested. The viability assessment concluded that "visual development instead of code" is dead — vibe coding took that market — but that a narrower thesis survives: **the legible substrate for human–AI co-building.** The claim is that some people will not hand full authorship to an AI, and that a node graph lets an AI move fast while the human retains comprehension and ownership in a way a wall of generated code does not.

That claim is currently unproven. This task makes it testable. Phase 13 built the substrate — decomposed per-component files, a node catalog giving the agent a real vocabulary, and a semantic validator giving it compiler-like feedback. Everything to this point has been foundation. This is the first task that produces the thing a stranger could look at and either want or not want.

The roadmap's Gate G2 hangs on it: once this ships in a signed build and runs for a quarter alongside the Phase 17 pilots, the question is whether people **return unprompted**. If they do not, the honest response is to wind down. So the goal of this task is not merely to work — it is to be a fair test.

## Current State

- Phase 13 provides: v2 per-component files that the editor reads and writes (SUB-001), `node-catalog.json` enumerating every node type and port (SUB-004), and a semantic validator producing actionable diagnostics (SUB-006).
- AIX-001 provides a provider-agnostic client with streaming and tool calling.
- The existing AiAssistant generates *individual nodes* from prompts — useful precedent for prompt templating and streaming, but a different scale of ambition.
- SUB-008's MCP server exposes similar capability to external agents; this task is the in-editor equivalent and should share substrate, not duplicate it.
- Nothing today authors a whole component.

## Desired State

A user opens a project, describes what they want ("a page listing customers from the Customers collection, with a search field and a detail link"), and:

1. The agent reads only what it needs — the parent/context component, the catalog, relevant existing components — never the whole project.
2. It authors real `components/<Page>/*.json` files.
3. The validator checks the output; failures feed back to the agent, which iterates.
4. The graph appears **live on the canvas** as it is built, so the user watches architecture form rather than waiting on a spinner.
5. The user accepts, asks for refinement, or rejects — and rejection leaves no trace.

## Scope

### In Scope
- [ ] Conversation UI for describing intent and iterating
- [ ] Context assembly: select what the agent sees (catalog subset, relevant components, project conventions) without sending the whole project
- [ ] Agent loop: author → validate → repair → present, with a bounded iteration budget
- [ ] Live canvas rendering of the component as it is authored
- [ ] Accept / refine / reject, with clean rollback on reject
- [ ] Undo integration — an accepted AI change must be undoable like any other edit
- [ ] Safety: the agent writes only within the project, and never outside declared components
- [ ] Telemetry sufficient to answer Gate G2's question (do people come back?), privacy-respecting and opt-in

### Out of Scope
- Visual diff review of changes (AIX-003 — this task ships accept/reject; that task makes the *review* rich)
- Explaining existing graphs (AIX-004)
- Authoring backend/cloud functions (Phase 19)
- Multi-component or whole-app generation — **deliberately**: one page done well is the test; whole-app generation is the vibe-coding race this product is not running

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `.../models/AiAssistant/authoring/AuthoringSession.ts` | The loop: context → author → validate → repair → present |
| `.../models/AiAssistant/authoring/ContextBuilder.ts` | Decide what the agent sees; enforce the no-whole-project rule |
| `.../models/AiAssistant/authoring/prompts/` | Prompt templates for authoring and repair |
| `.../views/panels/AiAuthoringPanel/` | Conversation and accept/refine/reject UI |

### Design notes

**Context assembly is the crux.** The entire premise is that decomposition lets an agent work without ingesting everything. If the implementation quietly stuffs the whole project into the prompt, the demo may still work while proving nothing. Enforce a budget, log what was sent, and treat "how little context does this need" as a first-class success metric rather than an optimisation.

**The validator is the iteration engine.** Do not have the agent guess and hope. Author → validate → feed diagnostics back → repair, with a bounded number of rounds. This is what makes the output reliably loadable rather than plausibly-shaped, and it is the direct payoff of SUB-006.

**Write to a staging area, not the live project**, until the user accepts. Reject must be genuinely trace-free; a user who declines an AI's work should not have to clean up after it.

**Live rendering is not decoration.** Watching the graph assemble is the single most legible thing this product can do that a code-generating AI cannot. Budget real effort for it.

## Implementation Steps

1. **Prototype the loop headlessly first** — no UI, just: prompt → context → author → validate → repair, against real projects. This answers the only question that matters (can it produce valid, sensible components?) before any UI investment.
2. **Iterate on prompts and context strategy** using the headless harness, measuring validity rate, iteration count, and context size.
3. **Staging and accept/reject mechanics**, including undo integration.
4. **Conversation UI** with streaming.
5. **Live canvas rendering** of the in-progress component.
6. **Refinement flow** — follow-up instructions against the just-authored component.
7. **Telemetry** for the Gate G2 question, opt-in and privacy-respecting.
8. **Dogfood on real work**, then run the exit-criterion demo end to end.

## Testing Plan

- Headless harness: a corpus of prompts, measuring validity rate before and after validator-driven repair, plus context size per request.
- Every authored component loads in the editor and behaves as described.
- Reject leaves the project byte-identical.
- Accept is undoable.
- Context budget enforced — an assertion that the whole project was never sent.
- Manual: a user unfamiliar with the project authors a page successfully.

## Success Criteria

- [ ] A described page is authored as valid component files and loads correctly
- [ ] Validator-driven repair measurably improves first-attempt validity
- [ ] The agent never receives the whole project; context size is bounded and logged
- [ ] Graph renders live on canvas during authoring
- [ ] Accept / refine / reject all work; reject leaves no trace; accept is undoable
- [ ] Telemetry answers "do users return?" without collecting project content
- [ ] **Exit demo:** a stranger watches an AI build a page inside a graph they can read, in an installed build

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Output is valid but architecturally poor — legible nonsense | SUB-005's patterns and examples in context; measure quality with human review, not just validator pass rate; iterate on prompts in the headless harness |
| Context assembly quietly sends everything, invalidating the premise | Hard budget, logged context, and an explicit test asserting the whole project is never sent |
| Live rendering is janky and undermines the core impression | Prototype rendering early; if it cannot be smooth, ship staged reveal rather than a stuttering animation |
| The agent writes outside its sandbox and damages a project | Staging area until accept; writes confined to declared component paths; project under Git recommended |
| The demo works only on toy projects | Dogfood on real projects throughout; the exit criterion requires a real one |

## References

- [Viability report — §2.1 (agency & comprehension thesis)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Track C, Gate G2](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Depends on: AIX-001; SUB-001, SUB-004, SUB-006. Related: SUB-008 (same substrate, external agents), AIX-003 (richer review)

## Checklist

- [ ] Branch `task/aix-002-authoring-loop`; confirm Phase 13 prerequisites landed
- [ ] Build the headless loop harness; iterate prompts and context strategy
- [ ] Staging + accept/refine/reject with undo integration
- [ ] Conversation UI with streaming
- [ ] Live canvas rendering during authoring
- [ ] Opt-in telemetry for the Gate G2 question
- [ ] Dogfood on real projects; run and record the exit demo
- [ ] CHANGELOG; open PR
