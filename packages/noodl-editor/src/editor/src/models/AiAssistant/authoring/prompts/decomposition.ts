/**
 * AAQ-008 — the decomposition doctrine, as one text both clients speak.
 *
 * ## Why this file exists
 *
 * Phase 40's finding #11 was *"'Enquiry form' group could have easily been a
 * component"*, and the diagnosis was that the model did exactly what it was
 * told. Two instructions pushed against decomposition and **none pushed for
 * it**:
 *
 *   - `planning.ts`: *"Keep plans as small as the request allows. Two or three
 *     precise operations beat six vague ones."*
 *   - `authoring.ts`: *"Do not add nodes the task does not need. Smaller graphs
 *     are better graphs."*
 *
 * Read together by a model deciding whether to factor a hero section out of a
 * page, both say **no**. Neither was wrong about what it meant — one is about
 * scope creep, the other about dead nodes — but "smaller" was doing two jobs
 * and the wrong one won. Both call sites now import from here and the ambiguity
 * is resolved in the text rather than left to inference.
 *
 * ## Why it is a shared module rather than two prompt strings
 *
 * AAQ-005's rule: one authoring substrate, two clients. The in-editor loop and
 * `noodl-mcp` (which is what external Claude Code speaks) must not grow two
 * dialects of the same doctrine — that is the BCN-003 mistake, three twins of
 * one semantics. This module imports **nothing**, which is what lets
 * `noodl-mcp/src/editor-deps.ts` re-export it under the same containment rule as
 * `docsText`.
 *
 * ## The threshold is numeric on purpose
 *
 * "Prefer components" without a trigger produces either no change or a project
 * where every Text node is a component. Both failures were considered more
 * likely than the middle, so every rule below carries a countable condition and
 * §"When NOT to" carries its inverse. A model applying these cold should reach
 * the same answer twice.
 *
 * @module AiAssistant/authoring/prompts/decomposition
 */

/**
 * The doctrine, in the second person, for a model that is PLANNING a change and
 * can therefore create sibling components.
 *
 * Consumed by `planning.ts`. This is the load-bearing half: decomposition is a
 * multi-component decision, and only the planner can act on it.
 */
export const DECOMPOSITION_PLANNING = `COMPONENTS ARE THE UNIT OF GOOD WORK
A page assembled from named section components is easier to read, edit, review and extend than the
same page as one long column of nodes. Factoring is the default, not an optimisation you reach for
when a graph gets uncomfortable — by then the wires are already crossed.

Decomposition is NOT scope creep. A page planned as five section components is ONE page done
properly; it is not five extra operations. Padding is touching components the request never
mentioned — never creating the components the request implies.

Plan a CREATE operation for each of these:
- A named section. Anything you would name out loud in a design review — hero, nav, card, enquiry
  form, footer, filter bar, summary panel — is a component the page instantiates. If it has a name,
  it has a component.
- Anything that repeats. Two or more structurally identical siblings become ONE component driven by
  a Repeater over a data source. Never plan a hand-duplicated subtree.
- A logic cluster. Three or more logic nodes cooperating on one job (a create-record flow, a
  validation chain, a search-and-filter pipeline) is a logic component with a declared interface —
  not a cloud of nodes parked beside the visuals.

Then the page operation's intent says what it INSTANTIATES, and each section's intent states its
Component Inputs/Outputs, because the agent authoring a section sees only your intent and never its
siblings' graphs. An interface stated vaguely is an interface that will not line up.

Sequencing: creates come before the updates that instantiate them.

Placement, stated in the intent so two agents do not choose differently:
- Used by one page → a folder beside that page.
- Plausibly reused, or already used twice → a shared folder.

WHEN NOT TO FACTOR
Judgement, not enthusiasm. Do not plan a component for: a single node; a wrapper with no name you
would say out loud; a two-node group used once. A component that takes nothing, emits nothing and
appears once has added a file and a hop and bought nothing. If a page genuinely has one section, it
has one section.`;

/**
 * The doctrine for a model AUTHORING one component, which cannot create
 * siblings and must therefore act on what it can and report what it cannot.
 *
 * Consumed by `authoring.ts`. Deliberately shorter and differently scoped than
 * the planning half: three of the five planning rules are unavailable to a
 * single-component agent, and telling it to follow them anyway would produce
 * either a refusal or a quietly ignored instruction.
 */
export const DECOMPOSITION_AUTHORING = `COMPOSITION
You author one component, so you cannot create its siblings — but three of these are yours alone,
and the fourth is a thing you must say rather than do.

- REPETITION IS DATA. Two or more structurally identical siblings is a mistake, always. Build ONE
  subtree and drive it with a Repeater over an Array (sample data when there is no backend, a query
  when there is). Three hand-copied cards is the single most common defect in authored output.
- INSTANTIATE WHAT EXISTS. The project overview lists every component and its interface. If one fits,
  place it by name — never rebuild its contents inline.
- KEEP THE ROOT THIN. A page or section root should read as a short composition: a container and the
  handful of things it holds. If your graph has grown past roughly 25 nodes, you are building
  something that wanted to be several components.
- SAY SO WHEN IT DOES. You cannot create the sections yourself. When a component genuinely needs
  factoring you do not have the operations for, author the best single component you can AND name the
  split in your response — which sections, and what each one's interface would be. A page that
  silently becomes 60 nodes is the failure; a page of 60 nodes plus "this wants to be a hero, a card
  and a footer, here are their inputs" is a handover.

Smaller means FACTORED, not FLAT. Sixty nodes in one graph is not smaller than the same page as five
components — it is the same work, harder to read, and harder for the next person to change.`;

/**
 * The same doctrine as project-facing markdown, for `docs/CONVENTIONS.md` and
 * for any surface that hands an external agent written rules rather than a
 * system prompt.
 *
 * Kept in one file with the two prompt strings deliberately: a convention
 * template that drifts from the prompt enforcing it is worse than no template,
 * because the project's own written rule OUTRANKS the prompt
 * (`authoring.ts`, PROJECT CONVENTIONS) — so a stale copy here silently wins.
 */
export const DECOMPOSITION_DOCTRINE_MD = `## Components are the unit of good work

Factoring is the default. A page assembled from named section components is easier to read, review
and change than the same page as one long column of nodes.

- **A named section is a component.** Hero, nav, card, form, footer, filter bar. If you would name it
  out loud, it gets its own component and the page instantiates it.
- **Repetition is data.** Two or more structurally identical siblings become one component driven by
  a Repeater over a data source. Never duplicate a subtree by hand.
- **Logic clusters are components.** Three or more logic nodes cooperating on one job get their own
  component with a declared interface, rather than sitting beside the visual nodes.
- **Interfaces are deliberate.** Component Inputs/Outputs carry what varies per instance. Shared app
  state goes through Variables and Objects, not through prop drilling.
- **Placement.** Used once, next to its page. Used twice or plausibly reusable, in a shared folder.
- **Say why on the node.** A node's \`label\` says what it is for; its \`comment\` says why it is the way
  it is. Write one where the next reader would otherwise change something and break it — a decision that
  had an alternative, a rule from outside the app that the graph cannot state, or a trap. Omit it when
  the type and label already say it: a comment restating either is noise, and most nodes need none.

**When not to.** A single node, an unnamed wrapper, or a two-node group used once is not a
component — it is a file and a hop that bought nothing. A page with one section has one section.

**Rule of thumb.** A component graph past ~25 nodes is telling you it wanted to be several.`;
