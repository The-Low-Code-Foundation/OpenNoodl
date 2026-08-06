# AAQ-008 — Components by default

**Findings:** #11 (the Enquiry form should have been a component) and Richard's first lesson,
recorded verbatim because it is the doctrine this task encodes:

> *"Creating a component should usually be the default strategy. Even a hero section, a form, any
> group that contains multiple elements can in theory be a component. Making things into components
> gives you clean, easy to read node canvases. Stacking everything in a long column of visual nodes
> means scrolling to read, lots of connectors, harder to maintain and debug, harder to expand and
> scale with new pages. Even the logic components can be made into components — for example the
> system that creates a new puppy listing may have several logic nodes working together; rather than
> a cluster of nodes next to the visual nodes, it can be a component of logic nodes."*

**Depends on:** AAQ-005/006 (multi-component sessions make the doctrine affordable)
**Status:** ✅ **doctrine shipped 2026-08-06** — the prompt half is done and verified; the
*checks* (a validator rule, a corpus test that the agent actually factors cold) are still open. See
"What shipped" below.

## The mechanism, verified

`prompts/planning.ts:79`: *"Keep plans as small as the request allows. Two or three precise
operations beat six vague ones."* No instruction anywhere mentions factoring repeated UI into a
component, using a Repeater over a data source, or extracting logic clusters. Three identical puppy
cards became three hand-duplicated Group subtrees because the model was told smaller plans are
better plans.

## The doctrine (to encode, then verify the agent follows cold)

1. **A named section is a component.** Hero, card grid, enquiry form, footer — anything you would
   name in a design review gets its own component, instantiated by the page. A page component is a
   thin composition of sections.
2. **Repetition is data.** Two or more structurally-identical siblings become one component driven
   by a Repeater over a data source (static Array/sample data if no backend, query if there is one).
   Never hand-duplicate a subtree.
3. **Logic clusters are components.** A multi-node logic system (create-listing flow, validation
   chain) is a logic component with a clean interface, not a cloud beside the visuals.
4. **Interfaces are deliberate.** Component Inputs/Outputs carry what varies per instance (the card's
   record, the section's heading); shared app state goes through Variables/Objects, not through
   ten-deep prop drilling. When each — this is judgement; write the rule with Richard's examples,
   not from taste.
5. **Reusable vs private.** A section used once lives under its page's folder; anything plausibly
   reused (form controls, cards, the enquiry form) lives in a shared folder. Naming conventions
   stated in the prompt.
6. **Canvas legibility is a deliverable.** Left-to-right flow, ~150–300 unit spacing (already in the
   contract), and a size heuristic: a component whose canvas would exceed roughly a screen of nodes
   is a smell that something inside it wants extraction.

## What changes

- `prompts/planning.ts`: the "small plans" line is replaced by decomposition doctrine — a plan is
  judged by the *architecture* it produces, not the operation count. (With AAQ-006, the plan is the
  agent's proposed component tree, so this text may move — the doctrine travels to wherever planning
  prose lives.)
- `prompts/authoring.ts`: rules 1–6 in the system prompt's architecture section; the Repeater
  pattern spelled out with the sample-data seam it already has.
- Catalog enrichment (SUB-005) for Repeater/Component Inputs/Outputs gets usage guidance aligned
  with the doctrine, so `get_node_types` reinforces rather than contradicts it.
- A structural lint (advisory, style-lint channel — not blocking): N structurally-identical siblings
  → "consider a Repeater"; oversized single component → "consider extraction". Advisory because
  architecture judgement calls must not hard-fail a build.

## Acceptance criteria

1. Cold puppy replay: the listing page instantiates a PuppyCard component via a Repeater over data;
   the enquiry form is a component with an interface; the admin's create-listing logic is a logic
   component. Zero hand-duplicated subtrees.
2. The dashboard benchmark brief yields a component tree Richard signs off as "how I would have
   factored it" — his judgement is the oracle, recorded in this file.
3. A trivially small request ("add a text to the home page") still produces a trivially small
   change — the doctrine must not turn every request into a refactor. Scripted check.
4. External parity: Claude Code via `noodl-mcp`, same brief, comparable factoring — proving the
   doctrine lives in the substrate's guidance surface, not only in the embedded prompt.

## Traps

- Do not write this doctrine from model taste — every rule above traces to Richard's words or gets
  confirmed with him before landing. The handover's instruction stands.
- Component Inputs/Outputs port types come from a TABLE and never leave the editor (ERG-005) — the
  prompt's interface guidance must match what the editor can actually round-trip.
- `addConnection` accepts wires to ports that don't exist (ERG-001) — interface-heavy graphs raise
  the odds of hitting this; the substrate's validation must stay in front of it.


---

## What shipped, 2026-08-06

**Nothing had been done when this was picked up.** Both offending lines were still present verbatim,
and the doctrine existed only in this document.

### The mechanism, confirmed rather than assumed

Two instructions pushed **against** decomposition and **none** pushed for it:

- `prompts/planning.ts` — *"Keep plans as small as the request allows. Two or three precise
  operations beat six vague ones."*
- `prompts/authoring.ts` — *"Do not add nodes the task does not need. Smaller graphs are better
  graphs."*

Neither was wrong about what it meant — one is about scope creep, the other about dead nodes — but
**"smaller" was doing two jobs and the wrong one won**. A model deciding whether to factor a hero
section out of a page read both as "no", twice, and was never told otherwise anywhere in the stack.
Finding #11 was the model doing what it was told.

### The change

A new pure module, [`prompts/decomposition.ts`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/prompts/decomposition.ts),
exporting three renderings of one doctrine:

| Export | Consumer | Why it differs |
|---|---|---|
| `DECOMPOSITION_PLANNING` | `planning.ts` | The load-bearing half — decomposition is a multi-component decision and only the planner can act on it |
| `DECOMPOSITION_AUTHORING` | `authoring.ts` | A single-component agent **cannot create siblings**; three of the five planning rules are unavailable to it, so it gets the three that are its own plus an instruction to *report* the split it cannot make |
| `DECOMPOSITION_DOCTRINE_MD` | `noodl-mcp` `get_project_info` | An external agent gets no system prompt; the orientation call is the only surface that reaches it before it authors |

Both offending lines were rewritten rather than deleted, so the intent each was protecting survives:
"small" now means **relevant** (planning) and **factored, not flat** (authoring).

### Two decisions worth recording

1. **One module, three renderings — not three prompt strings.** AAQ-005's rule applied to a text
   rather than a schema. `noodl-mcp` re-exports it through `editor-deps` under the same containment
   rule as `docsText` (the module imports nothing), so the doctrine the external agent reads and the
   one the in-editor planner is prompted with are **literally the same bytes**. Two dialects of
   "prefer components" would be the BCN-003 mistake in prose.

2. **Deliberately NOT added to the `CONVENTIONS.md` template.** It was the obvious place and it is
   the wrong one. Project conventions **outrank the prompt** (`authoring.ts`, PROJECT CONVENTIONS),
   so a copy there would silently win the day it drifted — and it is a platform default, not a
   per-project rule a user should have to keep. The template stays for project-specific overrides.

### Every rule carries a countable trigger

"Prefer components" with no threshold produces either no change or a project where every Text node is
a component. Both failure modes were judged more likely than the middle, so: a *named* section; *two
or more* identical siblings; *three or more* cooperating logic nodes; a graph past *~25 nodes*. And
an explicit **WHEN NOT TO FACTOR** with the inverse, because the over-application failure is the one
that would discredit the doctrine fastest.

### Verified

- `npm run typecheck:editor` — clean.
- `tsc --noEmit` on `noodl-mcp` — clean.
- `npm run build` in `noodl-mcp` — the doctrine is compiled into `dist/noodl-mcp.cjs`.
- The planning prompt rendered through esbuild and read end to end: interpolation lands in the right
  place, and the rewritten scope bullet points forward to the new block rather than contradicting it.

### ⚠️ What is still open — this is the prompt half only

The prompt is an instruction, not a gate, and this repo's most repeated lesson is that instructions
are not mechanisms. Still owed:

1. **A validator rule.** Nothing rejects or warns on a hand-duplicated subtree, a 60-node page, or a
   logic cloud. Until one exists, compliance is voluntary and unmeasured.
2. **A corpus test that the agent factors cold** — the AAQ-009/010 pattern: author a page with three
   identical cards from a fixed prompt and assert one component plus a Repeater, not three subtrees.
   Without it, the next prompt edit can silently undo this one.
3. **A drive.** No end-to-end session has been run since the change. The claim here is *"the
   instruction is now present, correct and shared"* — **not** *"the agent decomposes"*. Do not
   record the second until someone has watched it.
