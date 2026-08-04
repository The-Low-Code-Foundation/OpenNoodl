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
**Status:** open

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
