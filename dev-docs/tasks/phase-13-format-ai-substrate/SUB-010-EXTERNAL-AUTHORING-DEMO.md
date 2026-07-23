# SUB-010: External Authoring Demo — "Claude builds a page, you watch it live"

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-010 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Type** | 🔬 **Spike / proof-of-thesis** — optional, de-risking; not one of the phase's eight substrate pillars |
| **Priority** | 🟠 High **as a decision input** — this is the cheapest fair test of the "Noodl as an extension of your existing agent" bet before committing to full SUB-008 (3–4 wks) and AIX-002 (4–6 wks) |
| **Difficulty** | 🟡 Medium (the plumbing) / 🔴 Hard (making it a *fair* test) |
| **Estimated Time** | 4–7 days |
| **Prerequisites** | SUB-004 + SUB-005 (catalog), SUB-006 (validator), SUB-009 (live preview). A **minimal** MCP write surface — a subset of SUB-008, or a throwaway harness (see Design notes). |
| **Branch** | `task/sub-010-external-authoring-demo` |
| **Recommended executor** | 🔵 **Fable 5** — the code is composition of existing parts; the value is in *what the demo has to show to be honest* (how little context, real project not a toy, the hand-off actually working). That framing decides whether the result is evidence or a marketing gif. Implementation delegable to Opus once the script is fixed. |

## Objective

Demonstrate, end to end, the workflow the strategy is actually betting on: **a developer using an agent they already have (Claude Desktop or Claude Code) adds a real page to a Noodl project through an MCP connector, watches it appear live in a browser preview, and then opens the same project in the Noodl editor and continues by hand — a lossless hand-off.**

Produce a recorded demo and an honest written assessment of whether the experience is compelling. This is a spike to inform a *go / no-go*, not a shipped feature.

## Background

The conversation this task came from asked the real question: is "build the first version of an app in Noodl via Claude + MCP, see it visually, and hand back and forth between the agent and the visual editor" a genuine reason for the product to exist, or wishful thinking? The honest answer from the code is that the substrate for it is unusually complete — catalog (grammar), enriched examples (idiom), validator (compiler-style feedback), pure io engines (read/write), and the SUB-005 acceptance test already showed an LLM authoring a valid, idiomatic Noodl subtree from the catalog alone. What has **not** been shown is the *experience*: an external agent doing it against a real project, the result visible as it happens, and — the actual differentiator — the artifact remaining a node graph a human can pick up in the visual editor without a lossy round-trip through generated code.

That last property is the whole thesis. Every code-generating AI builder ("describe an app, get React") produces an artifact you cannot cleanly hand to a visual designer. Noodl's claim is that the graph *is* the artifact in both modes. This spike is the cheapest way to find out whether that claim feels real or hollow — before spending the ~2 months that full SUB-008 + AIX-002 represent.

It overlaps deliberately with **Gate G1** (external agent authors a valid page via MCP + catalog) but adds the two dimensions G1 omits: the **live visual** payoff (SUB-009) and the **hand-off to the editor**. Where G1 asks "is it correct?", this asks "is it *worth wanting*?"

## Current State

- **Author side:** the catalog (`packages/noodl-types/src/node-catalog-enriched.json`), the validator (`scripts/validate-project.ts --json`, library at `.../validation`), and the pure io engines (`src/editor/src/io/ProjectExporter|Importer`, `services/ProjectStructure/ComponentSaver`) all exist and are Electron-free. SUB-008 (the real MCP server) is **not yet built**; SUB-009 (live preview) is this spike's other prerequisite.
- **View side:** SUB-009 gives a standalone file-watching preview.
- **Hand-off side:** the editor already reads v2 from disk on project open — so "the agent wrote it, now open it in the editor" needs **no new code**; it needs to be *shown working* and checked for fidelity.
- **Evidence so far:** SUB-005's comparative acceptance test (`docs/node-catalog/ACCEPTANCE.md`) proved catalog-grounded authoring works in principle, run by hand. This spike turns that into a live, external, tool-driven loop.

## Desired State

A repeatable, recorded session:

1. A **real** small project (not a toy — reuse a corpus project or a plausible starter) is open in the preview from SUB-009.
2. In Claude Desktop/Code, connected to the MCP surface, the user asks for a concrete page (e.g. *"add a Customers page: a list from the Customers collection, a search field, and a link to a detail page"*).
3. The agent reads **only** the catalog subset, the parent/context component, and the validator's feedback — never the whole project — and authors the page as real `components/<Page>/*.json` files, iterating against validator diagnostics until clean.
4. The preview **updates live** as the files land; the user watches the page appear.
5. The user opens the **same project directory in the Noodl editor**, sees the agent's page as a normal editable node graph, and makes a manual change — proving the hand-off is lossless and bidirectional.
6. A short written assessment records: did it work, how little context it needed, where it was clumsy, and whether the experience feels like a reason to use Noodl.

## Scope

### In Scope
- [ ] A **minimal MCP write surface** sufficient for the demo: at least `list/read component`, `get catalog (filtered)`, `author/replace a component`, `validate` — validation on every write, returning diagnostics (see Design notes on build-vs-borrow)
- [ ] An agent-host setup recipe (Claude Desktop connector config and/or Claude Code MCP config) that a reader can reproduce
- [ ] The scripted demo run against a real project, with SUB-009 preview live
- [ ] The editor hand-off step, with a fidelity check (the page the agent wrote round-trips through the editor unchanged but for the intended manual edit)
- [ ] **Context-budget logging** — record exactly what the agent was sent, to prove the no-whole-project claim rather than assert it
- [ ] A recorded video + a written `ASSESSMENT.md` with the honest verdict
- [ ] A short list of the sharpest friction points, fed back to SUB-008's tool-surface design

### Out of Scope
- The **full** SUB-008 server (concurrency safety, complete tool surface, distribution, packaging) — this spike builds only what the demo needs and explicitly may throw it away
- The in-editor authoring loop (AIX-002 — same thesis, different surface)
- Incremental hot-update in the preview (SUB-009 Option B)
- Multi-page / whole-app generation — **one real page done well is the test**; whole-app generation is the vibe-coding race this product is not running
- Any cloud/hosted component; keep it local-first

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-mcp/` *(minimal)* **or** `scripts/mcp-demo/` *(throwaway)* | The smallest MCP write surface that runs the demo |
| `dev-docs/tasks/phase-13-format-ai-substrate/demo/ASSESSMENT.md` | Honest verdict, context-budget numbers, friction list |
| `dev-docs/tasks/phase-13-format-ai-substrate/demo/SETUP.md` | Reproducible agent-host + preview setup recipe |

### Design notes

**Build-vs-borrow the MCP surface.** Two honest options, decide up front:
- **(a) Start SUB-008 minimally.** Build `packages/noodl-mcp/` but implement only the four tools the demo needs, on the io engines, exactly as SUB-008 specifies. This makes the spike a down-payment on the real thing and its friction feedback directly shapes SUB-008's surface. Preferred *if* SUB-008 is imminent.
- **(b) Throwaway harness** in `scripts/mcp-demo/` wrapping the same engines, explicitly disposable. Preferred if you want the *experience* answer before committing any SUB-008 design. Either way the tools wrap `ProjectExporter`/`ComponentSaver` for writes and the SUB-006 library for the mandatory post-write validation — no format logic is reimplemented.

**The context budget is the crux of an honest test.** The entire premise is that decomposition lets an agent work without ingesting everything. If the MCP tools quietly let the agent pull the whole project, the demo may *work* while proving *nothing*. Log every byte sent to the agent, enforce a component-level read granularity, and put the context numbers in `ASSESSMENT.md`. "How little did it need to see?" is a headline result, not a footnote.

**Use a real project, dogfood the whole loop.** A toy project that only contains what the agent adds is not evidence. Start from a corpus project (or a believable starter with existing pages, data, and conventions) so the agent has to *fit into* something — which is the actual job.

**The hand-off is the differentiator — show it, don't tell it.** The single most convincing beat is opening the agent's output in the visual editor and editing a node. Budget the demo's framing around that moment. If the round-trip is *not* clean (the editor rewrites or drops something the agent wrote), that is a finding worth as much as a success — capture it against SUB-002/SUB-001 fidelity.

**This is a fair test, not a sales reel.** Following AIX-002's framing: the goal is not to *look* good but to *be* a real trial. Script the ask, but let the agent genuinely iterate; record failures and clumsy turns, not just the clean take.

## Implementation Steps

1. **Stand up the minimal MCP surface** (option a or b) — four tools, validation on write, over the existing engines. Test it with a hand-written sequence of calls (as SUB-008 step 1 prescribes) before involving a live agent.
2. **Wire an agent host** — connect Claude Desktop and/or Claude Code to it; capture the setup in `SETUP.md`.
3. **Run SUB-009's preview** on the target project.
4. **Dry-run the authoring** with the agent against a real project; measure validity rate, iteration count, and context size; tune the tool descriptions and catalog-filtering until the loop is reliable.
5. **Record the full take:** ask → author (preview updating live) → open in editor → manual edit.
6. **Verify the hand-off fidelity** — the agent's page loads and behaves; a manual edit saves cleanly; nothing silently dropped.
7. **Write `ASSESSMENT.md`:** verdict, context numbers, friction points, and an explicit recommendation on whether SUB-008 + AIX-002 are worth committing to. Feed the tool-surface friction back into SUB-008.

## Testing Plan

- The four MCP tools work against a fixture project via hand-written call sequences (before any agent).
- A live agent authors the target page; it passes SUB-006 clean; the preview reflects it.
- Context assertion: a log proves the whole project was never sent; component-level reads only.
- Editor hand-off: open the project, confirm the agent's component renders and is editable; make and save a manual change; re-validate clean.
- Reproducibility: a second person, following `SETUP.md`, gets an equivalent result.

## Success Criteria

- [ ] An external agent (Claude Desktop or Code), via MCP, authors a working page into a **real** project, iterating against validator feedback
- [ ] The page appears **live** in the SUB-009 preview as it is written
- [ ] The same project opens in the Noodl editor with the agent's page as an editable graph; a manual edit saves cleanly (**lossless hand-off shown**)
- [ ] Context sent to the agent is bounded and logged; the whole project was never ingested
- [ ] A recorded demo **and** an honest `ASSESSMENT.md` exist, with a clear go/no-go recommendation on SUB-008 + AIX-002
- [ ] Friction points captured and routed into SUB-008's tool-surface design

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The demo works but proves nothing (toy project, or whole project quietly sent) | Real project mandatory; hard context budget; logged and reported context numbers |
| The hand-off is not actually lossless | Treat a fidelity failure as a first-class finding against SUB-001/SUB-002; the point of the spike is to learn this cheaply |
| Effort creeps toward building all of SUB-008 | Four tools only; option (b) throwaway is legitimate; distribution/concurrency are explicitly out of scope |
| A clean take hides real clumsiness | Record the dry-runs and iteration count, not just the final take; `ASSESSMENT.md` reports failures |
| The experience is underwhelming | That is a **valid, valuable** outcome — the spike exists to surface it before the 2-month spend, not to guarantee a yes |

## References

- [SUB-008 — MCP Server](./SUB-008-MCP-SERVER.md) (this spike is its de-risking prototype; friction feeds its design)
- [SUB-009 — Live-Preview Harness](./SUB-009-LIVE-PREVIEW-HARNESS.md) (the live-visual half)
- [Phase 13 README — Gate G1](./README.md) (this demo is G1 plus live-visual plus editor hand-off)
- [AIX-002 — The Authoring Loop](../phase-15-ai-collaboration/AIX-002-AUTHORING-LOOP.md) (the in-editor sibling; shares substrate and framing)
- `docs/node-catalog/ACCEPTANCE.md` — SUB-005's by-hand precedent this automates
- `dev-docs/reviews/NOODL-VIABILITY-REPORT.md` §2 — the thesis under test

## Checklist

- [ ] Minimal MCP surface (four tools, validation on write) — decide build-vs-throwaway
- [ ] Agent-host setup recipe (`SETUP.md`)
- [ ] Dry-run + tune against a real project; measure validity, iterations, context size
- [ ] Recorded take: ask → live author → editor hand-off → manual edit
- [ ] Hand-off fidelity verified
- [ ] `ASSESSMENT.md` with go/no-go and friction list
- [ ] Friction routed into SUB-008; CHANGELOG
