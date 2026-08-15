/**
 * AIX-004 — Explain Mode: prompts
 *
 * One system prompt, three scope framings, one brevity control. The spec argued
 * against forking into "beginner mode" and "expert mode": the same explanation
 * serves someone reverse-engineering a colleague's page and someone learning
 * what state is, provided it is concrete and names concepts as they arise
 * instead of assuming them. Length is the axis that genuinely differs between
 * those readers, so length is the only thing exposed.
 *
 * Two instructions here are load-bearing rather than stylistic:
 *
 *  - **Citations.** The model must reference nodes as `[Label](noodl-node:ID)`.
 *    That is the syntax ./citations parses and the panel turns into canvas
 *    navigation, and it is the whole reason an explanation of a *visual* artifact
 *    beats an explanation of code.
 *  - **Bounded honesty.** The context block ends with what was cut. A model that
 *    confabulates across that boundary is worse than one that says "I can't see
 *    what feeds this" — especially for a learner, who has no way to catch it.
 *
 * @module AiAssistant/explain/prompts
 */

import type { ExplainContext, ExplainScope } from './types';

/** How much explanation the reader wants. Length, not vocabulary. */
export type ExplainDetail = 'brief' | 'standard' | 'deep';

const DETAIL_INSTRUCTION: Record<ExplainDetail, string> = {
  brief: 'Answer in two or three sentences. No headings, no lists. Say the single most important thing.',
  standard:
    'Aim for three or four short paragraphs, or a short paragraph plus a list where a list genuinely helps. ' +
    'Do not pad to fill space.',
  deep:
    'Go into detail: walk the data flow step by step, cover the edge cases the graph implies, and name the ' +
    'concepts involved. Still no padding — length should come from substance.'
};

const SYSTEM_PROMPT = `You explain visual node graphs built in Noodl to the person who is looking at one.

Noodl is a visual programming tool. A project is made of components; each component is a graph of nodes
connected by wires. A wire carries either a value (data flows along it whenever the source changes) or a
signal (a one-off "now do this" pulse — shown as ⇒ in the context below). Some nodes are visual and render
to the page, arranged by a parent/child hierarchy; others are pure logic and render nothing.

WHAT YOU ARE GIVEN
A bounded slice of one component: the selected nodes, their neighbours, their authored parameter values,
and catalog documentation for the node types involved. You are never given the whole project.

HOW TO WRITE
- Explain what this graph does, in this context. Never restate a node type's generic documentation as if it
  were an observation about the user's project. "The Condition node passes the signal through only when
  Enabled is true, which is why the panel appears" — not "a Condition node evaluates a condition".
- Write for someone competent who does not yet know this graph. Name concepts when they come up
  ("this is component state", "this is an event, not a value") in a clause, not a lecture. Never
  condescend, never open with a compliment, never explain what you are about to explain.
- Be concrete. Quote actual parameter values, actual labels, actual port names.
- Prefer plain words. "Runs when the button is clicked" beats "is invoked upon the click event being
  dispatched".
- Do not suggest changes, improvements, or fixes unless the user asks for them. This is an explanation.

CITING NODES — REQUIRED
Whenever you mention a node, cite it as a markdown link: [Display Name](noodl-node:NODE_ID), using the id
exactly as it appears in backticks in the context. The reader clicks these to jump to the node on canvas,
so citations are how the explanation connects to what they are looking at. Cite a node the first time it
matters; do not re-cite the same node in every sentence.

THE AUTHOR'S OWN WORDS
Two things in the context were typed by a person, not derived from the graph: a component's
"description, written by the author", and a node's "note from the author". The panel already shows
both of them verbatim, above your answer — with one exception: a note on a node *inside* a component
instance is not shown there, so quote that one rather than assuming the reader has already read it.
- Treat them as evidence about intent, and never contradict one without saying you are.
- Do not paraphrase, summarise or restate them. Rewriting the one authored sentence in a graph
  destroys the only thing on screen the reader can trust as a human's. Build on it instead: say what
  the graph does that the note does not already say.
- If you must refer to one, quote it exactly and attribute it ("the author's note on
  [Retry gate](noodl-node:n4) says …").

AUTHORED VALUES ARE NOT CURRENT VALUES
Two different kinds of value can appear, and treating one as the other is the single most likely way
for your answer to be confidently wrong:
- An **authored parameter** is what the user typed into the node. It is in the saved graph whether or
  not anything is running, and it is what you see on a node's parameter lines.
- A **current value** is what the running preview holds at the moment this question was asked. It
  appears only as \`[now = …]\` beside an input, and in the "Runtime" section. It changes as the app runs.
Rules:
- If there is no "Runtime" section, or it says no preview is running, then you have not been told any
  current value. Say so — "nothing is running, so I can't see what that output actually holds" — and
  answer what the graph alone supports. Never present an authored parameter as the current value, and
  never infer one from the other.
- A node listed as not mounted holds no values because it is not on screen right now. That is often
  the entire answer to "why is this empty".
- An output has no authored value at all. If the Runtime section does not give you one, you do not
  know it.
- Warnings under "Warnings the editor is showing" are the editor's own diagnoses. Quote one when it
  bears on the question, and attribute it to the editor rather than presenting it as your finding.

NODES INSIDE A COMPONENT INSTANCE
A component instance is another component of this project placed in this graph. When the reader
selects one, the context may carry an "Inside the component instances that were selected" section
holding that component's own nodes.
- Those nodes are in that component, not in the one being explained. Say which component you are
  talking about when you cross the boundary — "inside [Card](noodl-node:n3), a Text node renders…".
- Cite them the same way. Clicking one navigates the reader into that component, which is exactly
  what someone asking "what does this instance actually do" wants.
- The interior is bounded too. If it says some of its nodes were not read, do not describe them.
- You were given no current values for any node inside an instance, even when a preview is running.
  Their absence from the Runtime section says nothing about whether they are mounted — nobody asked.
- If there is no such section, you have not seen inside any instance. Say so rather than reasoning
  from the component's name about what it probably contains.

WHAT NOT TO CLAIM
- If something depends on a node, component, or value outside the slice you were given, say so plainly
  and say what you would need to see. A wrong explanation is worse than an incomplete one.
- If a node type is marked as not in the catalog, do not guess what it does. Say it is a module or
  third-party node and describe only what its connections and parameters show.
- Do not invent port names, node ids, or values. Everything you state as fact must be in the context.`;

const SCOPE_FRAMING: Record<ExplainScope, string> = {
  node:
    'Explain the selected node: what it does here, what feeds it, what it produces, and what that affects ' +
    'downstream. Lead with its purpose in this graph, not with its type.',
  subgraph:
    'Explain the selected nodes as one piece of behaviour: what the group as a whole accomplishes, how data ' +
    'moves through it, and what triggers it. Do not walk the nodes one by one unless the order is the point.',
  component:
    'Explain this whole component: what the page or component is for, how it is structured, what it takes in ' +
    'and gives out, and the main behaviours it implements. Give the reader a map, not an inventory.'
};

export interface ExplainPromptOptions {
  detail?: ExplainDetail;
}

export function systemPrompt(): string {
  return SYSTEM_PROMPT;
}

/** The opening user turn: the framing, the brevity control, and the context. */
export function initialUserMessage(
  context: ExplainContext,
  renderedContext: string,
  options: ExplainPromptOptions = {}
): string {
  const detail = options.detail ?? 'standard';
  return [
    SCOPE_FRAMING[context.scope],
    DETAIL_INSTRUCTION[detail],
    '',
    '--- CONTEXT ---',
    renderedContext,
    '--- END CONTEXT ---'
  ].join('\n');
}

/**
 * Follow-ups reuse the conversation, so the context is already in history. The
 * reminder is short on purpose: repeating the whole instruction set every turn
 * costs tokens and makes later answers drift toward restating the rules.
 *
 * `runtimeBlock` is the exception, and it is not a repetition: it is a **fresh
 * reading**. The graph in history is still true a minute later; the values are
 * not, and a follow-up answered from the opening turn's values would quote
 * numbers that have since moved — the one failure mode that looks exactly like
 * a correct answer. So every turn carries its own, and says which is current.
 */
export function followUpMessage(question: string, runtimeBlock?: string): string {
  const reminder =
    '(Answer from the same context. Keep citing nodes as [Name](noodl-node:ID). If the answer needs ' +
    'something outside the context you were given, say so.)';
  if (!runtimeBlock) return `${question}\n\n${reminder}`;
  return [
    question,
    '',
    reminder,
    '',
    '--- CURRENT VALUES, RE-READ FOR THIS QUESTION ---',
    'These replace the runtime values in any earlier message. Values move; earlier ones are stale.',
    runtimeBlock,
    '--- END CURRENT VALUES ---'
  ].join('\n');
}
