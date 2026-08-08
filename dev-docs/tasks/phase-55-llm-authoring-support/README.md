# Phase 55 — Any LLM can build in NodeGX (Track E: the support system)

**Created:** 2026-08-08
**Status:** 🚧 Audit DONE ([AUDIT-SESSION-1.md](AUDIT-SESSION-1.md), two cold replays measured);
tasks specced as **[TASKS.md](TASKS.md)** (LAS-001…011). The audit partially overturned the
premise below: cold models with the doctrine + `create_plan` decompose correctly — the dominant
failures are the missing interface gate (LAS-001) and the unreachable render loop (LAS-005), not
ordering. Exit = the LAS-011 acceptance matrix.
**Origin:** Richard, after reviewing the phase-54 storefront. It was the first AI-authored NodeGX page
anyone thought was pretty, and it was still architected wrongly — one 66-node page with its sections
inlined and its repeated rows hand-duplicated.

## The admission this phase starts from

> *"We have to stop assuming any AI will just be able to understand our wonderful node library and
> descriptions and just magically apply standard design and development good practices and magically
> build a site worthy of a Claude artifact in a system it's never seen before and is, by all intents
> and purposes, using for the first time each time it starts a new project."*

**AI is bad at NodeGX, and it has good reasons to be.** That sentence is the premise of the phase and
should not be argued with; it should be explained, precisely, and then engineered around.

The reasons we can already name, none of which are the model's fault:

1. **No memory between projects.** Every build is a first encounter with the tool. A human developer
   gets better at Noodl over months; the model starts from zero every session and always will.
2. **The corpus teaches wiring, not architecture.** Of 57 validated catalog examples, 51 are about
   how to connect two nodes. Six (added in phase 54) are about composition. None of them, until
   phase 54, showed an app decomposed into components before nodes existed.
3. **Its priors are for code, and they map badly.** In React, the file boundary nags you into
   factoring. On a canvas nothing does — a 400-node graph looks like the page you wanted until you
   try to change it. Every instinct that makes a model a decent React developer produces a flat graph
   here.
4. **The natural generation order is wrong.** A model asked for a home page starts at the top and
   works down, deciding each section's nodes as it reaches it. That order cannot produce components,
   because components are a decision taken *before* drawing.
5. **The tool surface rewards drawing.** `create_component` takes a bag of nodes. Nothing in the tool
   shape asks "what is the component tree?" first.
6. **The seams used to eat the output**, which is now mostly fixed (phase 40, and the five 0.1.4
   runtime fixes) — but it means every prior belief about "the model is bad at styling" was measuring
   the wrong thing, and the same trap is live for architecture.

## The honest bit about our evidence

The one pretty result we have was produced by **Claude Opus with an enormous amount of scaffolding**:
a persistent MCP session, a render-and-measure loop, repeated human review, and an operator who
already knew the answers. Richard's own words: *"which is kind of cheating if you think about it."*

**Many people will use NodeGX with open-weight models.** A support system that only works with the
strongest frontier model is not a support system, it is a demo. Every proposal in this phase must be
evaluated against a mid-tier open-weight model, not against Opus.

## The goal

> Turn any competent LLM into a NodeGX developer who builds the way an experienced one does —
> component tree first, repeaters over duplication, states and signals, responsive by construction —
> **without** relying on the model already knowing how, and without relying on a human who does.

## What phase 54 already built — do not redo it

| Thing | Where | What it does |
|---|---|---|
| Design doctrine | `authoring/prompts/design.ts` | Composition, type, colour, imagery, responsive, mechanics. Shipped to the planner, the authoring prompt, and `get_project_info.designDoctrine` |
| Decomposition doctrine | `authoring/prompts/decomposition.ts` | Components are the unit of good work. Predates phase 54 |
| Composition recipes | `docs/node-catalog/examples/ui-*.json` | Six validated fragments, cross-referenced from the nine node types that draw pages |
| The decomposition gate | `validation/rules/repeatedSiblingSubtree.ts` | Three identical siblings is a warning. Calibrated: 17 hits / 95 projects |
| Best-practice reference | `dev-docs/best-practices/` | Five documents, including **Richard's own storefront architecture** — the single most valuable artefact for this phase |
| The reference build | `NodeGX test projects/ecommerce-example` | Pretty, and architecturally wrong. Both halves are data |
| The measuring harness | `scripts/devtools/render-from-disk.js` | Renders a project from disk against the working-tree runtime |

**The gap this phase addresses is that all of the above is passive.** It is text a model may read and
a warning it may receive after it has already done the work. None of it changes the *order* in which
the model works, which is the actual defect.

## The audit — do this before proposing anything

This phase opens with an audit, not a build. The deliverable of the first session is a written,
evidence-backed answer to these:

### A. Where exactly does it go wrong?

Replay the storefront brief cold against at least three models — Opus, a mid-tier hosted model, and a
mid-tier **open-weight** model — with today's stack, and classify every failure. Distinguish
ruthlessly between:

- **Knowledge failures** (did not know `Static Data` exists) — fixed by documentation or tool output.
- **Ordering failures** (knew about components, still drew top-to-bottom) — fixed only by changing
  the workflow.
- **Capability failures** (could not hold the plan) — fixed by decomposition into smaller turns.
- **Seam failures** (did the right thing, the runtime discarded it) — fixed in the runtime. Assume
  these still exist; phase 40 found five and phase 54 found three more in the harness alone.

### B. What does the tool surface make easy, and what does it make hard?

Right now the first authoring call a model makes is "here is a bag of nodes". Audit whether the tool
*shape* can carry the method — e.g. a first-class "declare the component tree" step that must happen
before any nodes are accepted, so the architecture is a required artefact rather than an
encouragement.

### C. How much can be moved from prompt to structure?

Prompt text is the weakest possible enforcement and the most expensive per token. For each rule in
the doctrine, ask: could this be a **tool that only accepts the right shape**, a **generated
scaffold**, a **template the model fills in**, or a **check that rejects the wrong thing**? Prefer,
in that order: structure > gate > example > prose.

### D. What does a weak model need that a strong one does not?

Likely candidates to test rather than assume: smaller turns; a fixed sequence rather than an open
loop; fill-in-the-blank scaffolds instead of free authoring; fewer node types offered at once
(progressive disclosure of a 175-type catalog); worked examples retrieved automatically rather than
on request.

### E. What does the feedback loop cost?

The one thing that reliably worked in phase 54 was **render → measure → fix**. Audit whether that can
be made routine and cheap enough to run inside every build, for every model, without a human driving
it.

## Candidate directions, none of them decided

Deliberately listed as options for the audit to accept or kill, not as a plan:

1. **A scaffolding step before authoring** — the model submits a component tree (names,
   responsibilities, inputs, what repeats) and gets it validated before any node exists. Makes the
   right order the only order.
2. **Starter architectures** — a small set of app skeletons (storefront, dashboard, CRUD admin,
   landing page) that arrive already decomposed, so the model fills in rather than invents.
3. **A component-tree critic** — an agent whose only job is "why is this not a component, and where
   is the Repeater?", run before apply.
4. **Progressive disclosure of the catalog** — offering the ~20 types a page actually needs instead
   of 175.
5. **Retrieval instead of recall** — auto-attaching the relevant `ui-*` recipe to the operation being
   authored.
6. **More gates** — the phase-54 rule is one. Obvious siblings: a page component over N nodes, a
   multi-column Group that can never collapse, an interactive node with no hover state, an image with
   no explicit size.
7. **A smaller, better-shaped authoring vocabulary**, if the audit shows the current one invites flat
   graphs.

## How we will know it worked

The benchmark is Richard's, and it is the same one phase 40 set: **replay the briefs cold and judge
the output side by side against a Claude artifact of the same brief.** Phase 55 adds one requirement:

> The acceptance run must include a mid-tier open-weight model, and its output must be
> *architecturally* correct — components, repeaters, states, responsive — even where its visual taste
> is weaker than Opus's.

Architecture is the thing a support system can actually guarantee. Taste is the thing it can only
nudge. If a weak model produces a well-architected app with mediocre spacing, this phase has
succeeded; if a strong model produces a beautiful 66-node page, it has not.

## Settled — do not relitigate

- **NodeGX stays primitive-only.** No opinionated composite node library (Container/Section/Card/Hero).
  Invest in primitive defaults, machine-checkable gates, and a render→critique loop. (Richard,
  2026-08-08.)
- **One authoring substrate, two clients.** Anything added must reach both the in-editor loop and
  `noodl-mcp` from one source, the way `decomposition.ts` and `design.ts` do. A second dialect is the
  BCN-003 mistake.
- **Doctrine text is Richard's**, and `dev-docs/best-practices/05-WORKED-EXAMPLE-STOREFRONT.md` is his
  architecture. Encode it; do not rewrite it from model taste.

## Register

Session-1 audit findings live in [AUDIT-SESSION-1.md](AUDIT-SESSION-1.md) with full evidence; the
open ones are mirrored here so a grep finds them.

| # | Finding | State |
|---|---|---|
| F1 | `DESIGN_AUTHORING` per-turn preamble still teaches the deprecated wrapped-row pattern, never names `Columns` (`design.ts:246`) | ✅ **CLOSED** 2026-08-08 by **LAS-008**, tripwire-pinned |
| F2 | Instance parameters vs component interface: **no check anywhere** — a component instantiated with parameters it has no `Component Inputs` for renders dead placeholders with 0 errors | 🔴 OPEN → **LAS-001** |
| F3 | `layoutString` value format unvalidated — `"1fr 1fr 1fr 1fr"` silently renders one column | ✅ **CLOSED** 2026-08-08 by **LAS-003/1** — authored-blocking error, 0 corpus hits |
| F4 | "Strands TS harness" was decided, never built (AAQ-006 still open); the phase-40 memory implied otherwise | ✅ documented, memory corrected |
| F5 | No render/measure tool on the MCP surface — doctrine §11 unfollowable externally; `measure-project.js` (7.5 s, headless) built, in `measurements/` | 🔴 OPEN → **LAS-005** |
| F6 | Phase-54 F6 re-confirmed: `stage_plan_operation` returns warning counts with no text | ✅ **CLOSED** 2026-08-08 by **LAS-002** |
| F7 | Unsized absolute Group fills its parent (`%` dimension defaults) — badge pills render as parent-sized blobs; no check | ✅ **CLOSED** 2026-08-08 by **LAS-003/2** — warning, narrowed to *decorated* boxes (151 hits → 29) |
