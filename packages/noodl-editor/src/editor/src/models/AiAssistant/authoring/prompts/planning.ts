/**
 * AIX-011 — Project-scope authoring: the planning prompts
 *
 * The plan step's whole job is scoping: turn "wire Checkout into the app"
 * into an explicit, editable list of operations — including the updates to
 * the components that must point AT the new work, which is exactly what a
 * single-component session cannot express and what this task exists to fix.
 * No graph content is produced here; a wrong interpretation is caught for
 * the price of one cheap turn, not five authored components.
 *
 * @module AiAssistant/authoring/prompts/planning
 */

import { DECOMPOSITION_PLANNING } from './decomposition';
import { DESIGN_PLANNING } from './design';
import { PLAN_REPEAT_SOURCES, PLAN_STRUCTURE_DESCRIPTIONS as D } from '../plan';
import type { AiToolDefinition } from '../../client/types';

export const SUBMIT_PLAN = 'submit_plan';

/**
 * LAS-006 — the structured operation fields as JSON Schema, from the shared
 * descriptions. The MCP client renders the same words into zod; this is the
 * editor's dialect of one model.
 */
const portArray = (description: string) => ({
  type: 'array',
  description,
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', description: D.portName },
      type: { type: 'string', description: D.portType },
      description: { type: 'string', description: D.portDescription }
    },
    required: ['name']
  }
});

const PLAN_STRUCTURE_SCHEMA = {
  inputs: portArray(D.inputs),
  outputs: portArray(D.outputs),
  repeats: {
    type: 'object',
    description: D.repeats,
    properties: {
      source: { type: 'string', enum: [...PLAN_REPEAT_SOURCES], description: D.repeatSource },
      rowFields: { type: 'array', items: { type: 'string' }, description: D.repeatRowFields }
    },
    required: ['source', 'rowFields']
  },
  instantiates: { type: 'array', items: { type: 'string' }, description: D.instantiates }
};

export const PLANNING_TOOLS: AiToolDefinition[] = [
  {
    name: SUBMIT_PLAN,
    description:
      'Submit the plan: an ordered list of operations, each naming ONE component (or doc) and stating its ' +
      'intent in one or two sentences. No nodes, no connections — intent and interface only. For any component ' +
      'another one will place, also fill `inputs` (and `repeats` where it draws a row per item): those names ' +
      'are the contract the authoring turns build against.',
    parameters: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              kind: {
                type: 'string',
                enum: ['create', 'update', 'doc'],
                description: 'create a new component, update an existing one, or update a project doc'
              },
              target: {
                type: 'string',
                description:
                  'Component path exactly as in the project overview for updates ("Pages/Cart"); a new path for ' +
                  'creates; a doc path ("docs/ARCHITECTURE.md") for doc operations'
              },
              intent: {
                type: 'string',
                description:
                  'One or two sentences: what this operation should accomplish. Name shared things (routes, ' +
                  'events, component interfaces) explicitly — sibling operations build against this sentence.'
              },
              // LAS-006 — the fields an intent sentence could not carry. The
              // planning doctrine has always asked for interfaces *in the
              // intent*; a cold replay produced a correct decomposition whose
              // intents mentioned none, and every card rendered dead. Same
              // fields, same names, same optionality as the MCP `create_plan`
              // schema — one plan model, two clients.
              ...PLAN_STRUCTURE_SCHEMA
            },
            required: ['kind', 'target', 'intent']
          }
        }
      },
      required: ['operations']
    }
  }
];

export const planningSystemPrompt = () => `You plan changes to a Noodl project — a visual programming tool
where a project is a set of components (pages, visual components, logic components) that instantiate and
navigate to each other.

You do NOT build anything. You produce a PLAN: an ordered list of operations, each naming one component
and stating its intent. Another agent authors each operation later, seeing only the project overview and
the sibling intents — so every cross-component agreement (a route name, an event name, a component
interface) must be stated in the intents, not left implicit.

HOW TO SCOPE
- Include every component the request genuinely touches — and no more. The canonical miss: asked to
  "wire page X into the app", plan the updates to the components that must LINK TO or ROUTE TO X, not
  only X itself. Integration is edits to the neighbours.
- Use "update" for components in the project overview, "create" only for components that do not exist.
- One operation per component. Never plan two operations on the same component — fold the intents.
- Deleting components cannot be planned; if the request needs it, say so in prose instead of planning it.
- A "doc" operation updates a project document (e.g. docs/ARCHITECTURE.md) to record what changed.
  Include one only when the project's docs are listed in the overview material and the change is worth
  recording — never as filler.
- Keep plans as TIGHT as the request allows: no operation on a component the request never implies.
  "Tight" is about relevance, not count — see COMPONENTS ARE THE UNIT OF GOOD WORK below, which is
  the other half of this rule and outranks any instinct to keep the number of operations down.

DECLARE THE INTERFACE, DO NOT DESCRIBE IT
Every operation that creates a component something else will place must fill "inputs" with the port
names the instances will set — not mention them in the intent sentence, fill the field. The sentence is
read by a human; the field is read by the turn that authors the component and by the gate that checks it.
- A component with no inputs renders the same thing every time it is placed. If four cards differ, the
  card has four inputs, and this is where they are named.
- Where a component draws one row per item, fill "repeats": its rowFields are exactly the inputs the
  row component must expose. Name them once here and both operations agree by construction.
- "instantiates" lists what an operation places, so the plan states its own dependencies.
- Pages take no inputs. A page is navigated to, never instantiated.

${DECOMPOSITION_PLANNING}

${DESIGN_PLANNING}

PAGES ARE REGISTERED, OR THEY DO NOT EXIST
A page component is only reachable when a Page Router node lists it — the router's "pages" parameter
carries { startPage, routes: [component names] }, and a page that is not in "routes" cannot be opened,
linked to, or navigated to, however good it is. This is the canonical case of "integration is edits to
the neighbours":
- A plan that creates or renames pages must ALSO include an update to the component holding the Page
  Router (usually App), whose intent names the pages to register and which one is the home page.
- State the exact component names in that intent ("register /Pages/Puppies and /Pages/Admin; Puppies is
  the home page") — the agent authoring App sees only your intent, never the other operations' graphs.
- Do not plan an App update when the request touches no pages. An update to a component the request never
  mentioned reads as scope creep in review.

Call ${SUBMIT_PLAN} with the operations. If the request is impossible or already satisfied, say so in
prose and do not submit a plan.`;

/**
 * The opening user turn: overview first, task last (same recency logic as
 * authoring).
 *
 * `docsOverview` is the block the system prompt's doc-operation rule refers to
 * ("only when the project's docs are listed in the overview material"). Absent
 * when the project has no docs, which keeps the rule's condition honest in both
 * directions.
 */
export function planningUserMessage(
  request: string,
  projectOverview: string,
  docsOverview?: string,
  references?: string
): string {
  return [
    '--- PROJECT OVERVIEW ---',
    projectOverview,
    '--- END PROJECT OVERVIEW ---',
    ...(docsOverview ? ['', '--- PROJECT DOCUMENTS ---', docsOverview, '--- END PROJECT DOCUMENTS ---'] : []),
    // BLD-011 — the user's attachments, before the request so the request keeps
    // the last word. This message carries no `cacheBoundary` (nothing in a
    // planning turn is stable enough to cache), so placement here is about
    // recency rather than Rule 6 — but the authoring turn's is about both, and
    // the two orderings match so that one format is learned once.
    ...(references ? ['', references] : []),
    '',
    '--- THE REQUEST ---',
    request,
    '',
    `Produce the plan and submit it with ${SUBMIT_PLAN}.`
  ].join('\n');
}

/** Sent when a submitted plan fails validation; the errors name their own fixes. */
export function planRepairMessage(errors: string[]): string {
  return [
    `The plan is not executable — ${errors.length} problem(s):`,
    ...errors.map((e) => `- ${e}`),
    '',
    `Fix exactly these and resubmit the full plan with ${SUBMIT_PLAN}.`
  ].join('\n');
}

/**
 * LAS-006 — sent ONCE for an executable plan that left its interfaces unstated.
 *
 * Deliberately not a repair message: the plan is valid and will be accepted
 * whatever comes back, including the identical plan. What this buys is the one
 * cheap turn in which "which inputs does the card need" is still a plan-level
 * question rather than a rejected component three turns later. The session
 * sends it at most once, so a model that stands by its plan costs one turn and
 * never loops.
 */
export function planAdvisoryMessage(advisories: readonly { message: string }[]): string {
  return [
    `The plan is executable and will be accepted. Before it runs — ${advisories.length} thing(s) worth fixing now,`,
    'because they are cheap here and expensive later:',
    ...advisories.map((a) => `- ${a.message}`),
    '',
    `Resubmit the full plan with ${SUBMIT_PLAN} if you want to amend it. If it is right as it stands, say so in`,
    'prose and it will be used unchanged.'
  ].join('\n');
}
