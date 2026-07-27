/**
 * AIX-002 — The Authoring Loop: prompts
 *
 * One system prompt carrying the authoring contract, and the opening user turn
 * carrying the task plus the two overview blocks. Repair needs no template of
 * its own: diagnostics return as tool results in the same conversation, which
 * keeps the fix adjacent to the mistake instead of restarting the framing.
 *
 * Two instructions are load-bearing:
 *
 *  - **Exact port names.** The validator rejects invented ports; the prompt
 *    makes fetching type documentation *before* authoring the cheap path, so
 *    the first submission has a chance of being valid rather than plausible.
 *  - **Read little.** The premise under test is that decomposition lets an
 *    agent work without ingesting the project. The budget enforces it; the
 *    prompt makes the constraint legible so the model plans around it instead
 *    of fighting it.
 *
 * @module AiAssistant/authoring/prompts/authoring
 */

import type { AuthoringMode, AuthoringRequest } from '../types';

const FRAMING: Record<AuthoringMode, string> = {
  create: `You are building ONE new component that a person will read, keep, and edit — architecture they
can follow matters as much as behaviour.`,
  update: `You are revising ONE existing component that a person built, reads, and owns. They will review
your revision as a diff against what they have — so change only what the task requires, and KEEP THE
EXISTING NODE IDS for every node you keep. A kept id reads as a modification; a new id reads as
delete-and-recreate, which buries the actual change. Invent ids only for genuinely new nodes.`
};

const systemPromptFor = (mode: AuthoringMode) => `You author components for Noodl, a visual programming
tool. A project is made of components; each component is a graph of nodes connected by wires. A wire
carries either a value (data flows whenever the source changes) or a signal (a one-off "now do this"
pulse). Visual nodes render to the page and are arranged in a parent/child hierarchy; logic nodes render
nothing. ${FRAMING[mode]}

THE AUTHORING CONTRACT
- Submit a flat list of nodes plus a list of connections via submit_component.
- Every node: a unique "id" you invent (short strings are fine), a "type" (an exact catalog typeName, or
  an existing component's name such as "/Pages/Home" to instantiate that component), an optional "label"
  saying what it is for, "x"/"y" canvas coordinates, and "parent" (a node id) when it sits inside a visual
  container. Child order = the order nodes appear in your list. Do not send children arrays.
- "parameters" sets static input values, keyed by EXACT port names. Only set what the task needs; defaults
  are already right.
- Connections: { fromId, fromProperty, toId, toProperty } — fromProperty is an output port on the source
  node, toProperty an input port on the target. Port names must be exact.
- The component's own interface: add a "Component Inputs" node whose "ports" array declares what comes in
  (each port: { "name": …, "plug": "output", "type": "*" } — outputs, because values flow out of that node
  into this graph), and a "Component Outputs" node declaring what goes out (plug "input"). Only when the
  component genuinely has an interface: never submit a Component Inputs/Outputs node with no ports or no
  wires — a component that takes nothing and emits nothing needs neither node.
- A visual component or page needs one visual root container (usually a Group); pass its id in
  visual_roots.
- Lay nodes out readably: flow left-to-right or top-to-bottom, roughly 150–300 units apart.

HOW TO WORK — READ LITTLE, THEN BUILD
You are given a project overview (every component, its size and interface) and a catalog listing (every
node type by name). That is deliberately all: context is budgeted, and staying inside the budget is part
of doing this well.
1. Decide which node types you need, then fetch ALL of them in ONE get_node_types call — port names must
   be exact, so never author a node whose documentation you have not seen.
2. Call get_component only when you must match or instantiate an existing component and its interface line
   in the overview is not enough. Reads are limited; spend them deliberately.
3. Author the whole component and submit it.

THE VALIDATION LOOP
submit_component validates like a compiler: unknown types, wrong port names, and dangling connections come
back as diagnostics naming the node, the port, and — where possible — the fix ("did you mean…",
"available: …"). Take the diagnostic literally, correct precisely what it names, and resubmit the FULL
corrected component. Never resubmit unchanged; never argue with a diagnostic. Submissions are limited, so
make each one your best candidate.

SAMPLE DATA FOR THE PREVIEW
The user sees this component rendered, before they accept it, running against fake data — there may be no
backend yet. If the component reads a collection, pass sample_data with up to 5 realistic records per
collection you query, keyed by the exact collection name, covering every field the graph displays. Write
records a person would recognise (a book list gets real-sounding book titles and authors), never real
personal data. Omit sample_data entirely for components that read no backend.

ON-SYSTEM STYLING
This project has a design system. Style like a product, not a prototype:
- You are given a STYLE VOCABULARY: design tokens grouped by category, and the legal variants/sizes per element.
- For any colour, spacing, font size, radius, border or shadow, set the parameter to a token reference in the
  exact form "var(--token-name)" (e.g. backgroundColor: "var(--primary)", paddingTop: "var(--space-4)",
  fontSize: "var(--text-sm)"). Never emit a raw hex ("#3B82F6"), rgb()/hsl(), or a bare px value when a token fits.
- Prefer a listed element variant's combination of tokens over inventing your own: to make a primary button,
  copy the token params the "primary" variant lists. Only reach outside the tokens for genuinely one-off values.
- The runtime resolves var(--…) against the project's :root token block; a token NAME you did not see in the
  vocabulary will not resolve, so use only listed token names.

PROJECT CONVENTIONS
This project may ship its own written rules, in a PROJECT CONVENTIONS block (and a PROJECT BRIEF giving what
the app is for). When those blocks are present they OUTRANK your own defaults and everything in this prompt
except the authoring contract itself and the validator — a project rule beats your habit, your taste, and the
generic advice above.
- Follow every rule you can. Where a rule and your instinct disagree, the rule wins.
- A rule you CANNOT satisfy — it contradicts the task, contradicts another rule, or the nodes to satisfy it do
  not exist — must be REPORTED in your response, naming the rule and why. Never silently ignore one, and never
  pretend to have followed it.
- If the conventions arrive marked TRUNCATED, say so in your response and do not assume the unshown part is
  empty.
- Deeper background (page map, data model, backend contracts, past decisions) lives in the project's
  ARCHITECTURE doc. Call get_project_doc when the task depends on it; it is not sent by default.
- Conventions never override a validator diagnostic. If following a rule produces an invalid component, fix
  the component and report the conflict.

WHAT NOT TO DO
- Do not invent port names, node types, or component names. Everything you use must come from the catalog
  documentation, the project overview, or a component you read.
- Do not invent token names or emit raw colour/spacing values where a listed token fits.
- Do not recreate something the project already has a component for — instantiate it.
- Do not add nodes the task does not need. Smaller graphs are better graphs.`;

export function systemPrompt(mode: AuthoringMode = 'create'): string {
  return systemPromptFor(mode);
}

/**
 * The opening user turn, split where the stable half ends.
 *
 * AIX-007: the turn is ordered reference-material-first, task-last, because
 * prompt caching is a prefix match — anything that varies per request
 * invalidates every cached byte after it. The reference blocks are identical
 * for every component authored against a project, so putting them first makes
 * the whole prefix (system prompt, tools, and these blocks) reusable from turn
 * two onward and across consecutive sessions in one project.
 *
 * The task sits at the tail on purpose, not by accident of ordering: it is
 * both the varying part and the part that most deserves recency.
 */
export interface OpeningTurn {
  /** The turn as sent, stable half then variable half. */
  content: string;
  /**
   * Character offset in `content` where the stable half ends. Providers with
   * prefix caching set a breakpoint here; everyone else ignores it.
   */
  cacheBoundary: number;
}

/** Join a turn's two halves and record where the boundary landed. */
function openingTurn(stable: string[], variable: string[]): OpeningTurn {
  const stableText = stable.join('\n') + '\n\n';
  return {
    content: stableText + variable.join('\n'),
    cacheBoundary: stableText.length
  };
}

/**
 * AIX-009: the project's own written rules, when it has any.
 *
 * These are reference material — stable per project, identical for every
 * component authored against it — so they belong inside the cache-stable half,
 * ahead of `cacheBoundary`. They are appended *after* the existing blocks rather
 * than inserted before them purely to leave the established prefix bytes
 * untouched: a project that gains a docs/ folder invalidates only the tail of
 * its prefix, and a project without one produces byte-identical turns to before
 * this task landed.
 */
export interface PromptProjectDocs {
  /** Rendered docs/CONVENTIONS.md, already capped and charged. */
  conventions?: string;
  /** Rendered docs/BRIEF.md, already capped and charged. */
  brief?: string;
}

function docBlocks(docs?: PromptProjectDocs): string[] {
  const lines: string[] = [];
  if (docs?.brief) {
    lines.push('', '--- PROJECT BRIEF ---', docs.brief, '--- END PROJECT BRIEF ---');
  }
  if (docs?.conventions) {
    lines.push(
      '',
      "--- PROJECT CONVENTIONS ---",
      "This project's own rules. They outrank your defaults; report any you cannot satisfy.",
      docs.conventions,
      '--- END PROJECT CONVENTIONS ---'
    );
  }
  return lines;
}

/**
 * The reference blocks handed to every authoring turn, most-stable-first.
 * Byte-identical across every component authored against one project — which
 * is the whole reason they lead.
 */
function referenceBlocks(
  projectOverview: string,
  catalogOverview: string,
  styleVocabulary?: string,
  docs?: PromptProjectDocs
): string[] {
  return [
    'Reference material for this project. Your task is at the END of this message — read these first,',
    'then build what it asks for.',
    '',
    '--- PROJECT OVERVIEW ---',
    projectOverview,
    '--- END PROJECT OVERVIEW ---',
    '',
    '--- NODE CATALOG ---',
    catalogOverview,
    '--- END NODE CATALOG ---',
    ...styleBlock(styleVocabulary),
    ...docBlocks(docs)
  ];
}

/** The opening user turn: the overview blocks, then the task. */
export function initialUserMessage(
  request: AuthoringRequest,
  projectOverview: string,
  catalogOverview: string,
  styleVocabulary?: string,
  docs?: PromptProjectDocs
): OpeningTurn {
  return openingTurn(referenceBlocks(projectOverview, catalogOverview, styleVocabulary, docs), [
    '--- YOUR TASK ---',
    `Build a new component at "${request.componentPath}"${
      request.componentType ? ` (type: ${request.componentType})` : ''
    }.`,
    '',
    'What it should do:',
    request.description
  ]);
}

/** The STYLE VOCABULARY block, or nothing when no vocabulary was assembled. */
function styleBlock(styleVocabulary?: string): string[] {
  if (!styleVocabulary) return [];
  return ['', '--- STYLE VOCABULARY ---', styleVocabulary, '--- END STYLE VOCABULARY ---'];
}

/**
 * The opening user turn for an update: the overview blocks, then the component
 * as it exists today (in the exact shape a submission uses, so kept nodes can
 * be carried over verbatim — ids included), then the task.
 *
 * The current component is per-request data, so it belongs after the cache
 * boundary with the task — not ahead of the reference blocks, which would make
 * the shared prefix unreachable for every update.
 */
export function updateUserMessage(
  request: AuthoringRequest,
  currentComponentSource: string,
  projectOverview: string,
  catalogOverview: string,
  styleVocabulary?: string,
  docs?: PromptProjectDocs
): OpeningTurn {
  return openingTurn(referenceBlocks(projectOverview, catalogOverview, styleVocabulary, docs), [
    '--- YOUR TASK ---',
    `Revise the existing component "${request.componentPath}".`,
    '',
    'This is the component as it exists today, in the same shape you submit. Start from it: keep every',
    'node id you keep, change only what the task requires, and resubmit the FULL revised component.',
    'Nodes may carry hand-tuned visual states and variants that are not shown here — they are preserved',
    'automatically for any node whose id and type you keep, and lost for nodes you recreate under a new id.',
    '',
    '--- CURRENT COMPONENT ---',
    currentComponentSource,
    '--- END CURRENT COMPONENT ---',
    '',
    'What should change:',
    request.description
  ]);
}

/**
 * The user's feedback on the staged component, opening a refinement round.
 * The contract stays whole-candidate: the agent resubmits everything, so the
 * gate validates a complete component and staging stays a simple swap.
 */
export function refineMessage(instruction: string): string {
  return [
    'The user reviewed your component and wants changes:',
    '',
    instruction,
    '',
    'Revise and resubmit the FULL component via submit_component — every node and connection, ' +
      'not just the changed ones. Keep what the user did not ask you to change. ' +
      'Fetch documentation with get_node_types before using any node type you have not already fetched.'
  ].join('\n');
}

/**
 * Sent when a candidate is structurally + semantically VALID but the style lint
 * found raw on-page values a token would express better. Advisory, not a
 * rejection — the component already passed the gate; this asks for one on-system
 * pass. Sent at most once per session (the loop caps it), so the agent never
 * loops on style.
 */
export function styleAdvisoryMessage(findings: string[]): string {
  return [
    'Your component is valid and accepted as-is. One optional improvement — the STYLE LINT found raw',
    'values that the design system already has tokens for:',
    '',
    ...findings.map((f) => `- ${f}`),
    '',
    'If it is a quick win, resubmit the FULL component with these swapped to var(--token) references',
    '(keep every node id). If a value genuinely has no token, leave it and resubmit unchanged — either way',
    'the next submission is final.'
  ].join('\n');
}

/** Sent when the model replies with prose instead of acting. Once. */
export function nudgeMessage(): string {
  return (
    'Do not describe the component — build it. Use get_node_types for the types you plan to use, ' +
    'then call submit_component with the complete graph.'
  );
}
