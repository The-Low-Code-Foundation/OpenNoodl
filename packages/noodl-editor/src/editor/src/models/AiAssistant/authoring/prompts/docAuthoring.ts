/**
 * AIX-011 criterion 7 — the doc-authoring turn's prompts.
 *
 * A `doc` plan operation carries a target and an intent and nothing else. That
 * was the gap: `PlanRun` skipped doc operations in the fan-out, so no step ever
 * authored a body, and the write path had nothing to write. This turn produces
 * one — the WHOLE file, like every other candidate in this phase — which is
 * then reviewed as a diff in the plan and written inside the plan's single undo
 * group.
 *
 * The prompt's real work is negative. AIX-009 §5 and the AIX-009…012 group are
 * built on one line: **no AI-generated markdown that describes the graph.**
 * Explain Mode narrates the live artifact on demand; a prose copy is a second
 * source of truth that rots on the next node drag, and would quietly undo this
 * phase's premise that the graph *is* the legible spec. So the system prompt
 * spends most of its length saying what not to write, and `docLint.ts` checks
 * mechanically that the model listened.
 *
 * @module AiAssistant/authoring/prompts/docAuthoring
 */

import type { AiToolDefinition } from '../../client/types';

export const SUBMIT_DOC = 'submit_doc';

export const DOC_TOOLS: AiToolDefinition[] = [
  {
    name: SUBMIT_DOC,
    description:
      'Submit the complete new content of the document — the WHOLE file, not a patch and not just the ' +
      'changed section. Everything you leave out is deleted.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description:
            'The entire file as it should stand after this change. Keep every existing section that is still ' +
            'true, verbatim, and edit surgically — this replaces the file.'
        },
        summary: {
          type: 'string',
          description: 'One sentence naming what you changed, for the review header. Not written into the file.'
        }
      },
      required: ['content']
    }
  }
];

export const docSystemPrompt = () => `You maintain the written context of a Noodl project — the markdown under
docs/ that a human owns and that the project's AI assistant reads before it authors anything.

You have been given ONE document and ONE intent, as part of a plan whose components have already been built
and are about to be applied. Your job is to update that document to record what the plan decided.

WHAT THESE DOCS ARE FOR
They hold exactly what the node graph structurally cannot:
- intent — what this app is for, who uses it, what is deliberately out of scope
- decisions and the reasoning behind them, including alternatives that were rejected and why
- external contracts — what a backend, an API or a third-party service guarantees
- the rules for next time — conventions an assistant must follow in this project

WHAT THEY MUST NEVER CONTAIN
Do NOT describe the graph. No node inventories, no "the Checkout page contains a Group with a Text node",
no lists of connections or ports, no per-component walkthroughs. The graph is inspectable and it is the
source of truth about itself; a prose copy is a second source of truth that is wrong the moment someone
drags a node, and this project has a live "explain this component" tool for anyone who wants a narration.
If a sentence would stop being true after a refactor that changed nothing about the app's behaviour,
delete it.

Say WHY, not WHAT. "Checkout is a separate page rather than a modal so the browser back button works" is
worth keeping forever. "Checkout contains a form and a button" is not.

HOW TO EDIT
- Whole-file replacement: ${SUBMIT_DOC} takes the complete document. Anything you omit is deleted.
- Preserve the human's prose. Keep their wording, their headings and their ordering; add to them. You are
  not rewriting the document, you are recording one change in it.
- Add the smallest amount of text that records the decision. A paragraph beats a section; a sentence beats
  a paragraph. Changelog sludge is how a doc stops being read.
- If a section is now WRONG because of this plan, correct it. That is the one case where deleting the
  human's text is right.
- Never invent facts. If the plan does not tell you why something was done, do not guess a reason — write
  what was decided and leave the reasoning to the human, or mark it "TODO:" for them to fill in.

If the document already records this change, or the change is not worth recording, say so in prose and do
NOT call ${SUBMIT_DOC}. Declining is a legitimate, useful outcome.`;

export interface DocTurnInput {
  /** Project-relative doc path, e.g. `docs/ARCHITECTURE.md`. */
  path: string;
  /** The current file, capped and charged; `undefined` when it does not exist. */
  current?: string;
  /** Starter skeleton offered when the file does not exist yet. */
  template?: string;
  /** This operation's intent, verbatim from the plan. */
  intent: string;
  /** The plan's originating request. */
  request: string;
  /** What the plan actually built — `renderPlanOutcome`. */
  outcome: string;
  /** One line per component; the doc may name components, never their interiors. */
  projectOverview: string;
}

/**
 * The opening turn. Reference material first, task last — the same recency
 * ordering (and the same reason) as the authoring and planning prompts.
 */
export function docUserMessage(input: DocTurnInput): string {
  const lines: string[] = [
    '--- PROJECT OVERVIEW ---',
    input.projectOverview,
    '--- END PROJECT OVERVIEW ---',
    ''
  ];

  if (input.current !== undefined) {
    lines.push(
      `--- ${input.path} AS IT STANDS TODAY ---`,
      input.current,
      `--- END ${input.path} ---`,
      ''
    );
  } else {
    lines.push(
      `--- ${input.path} DOES NOT EXIST YET ---`,
      'You are writing it for the first time. The starter template for this document is below; keep the',
      'headings that apply, delete the ones this project has nothing to say about, and fill in only what',
      'the plan actually establishes. An empty heading is better than an invented paragraph.',
      '',
      input.template ?? '(no template — start from a single heading)',
      `--- END TEMPLATE ---`,
      ''
    );
  }

  lines.push(
    '--- THE PLAN THIS RECORDS ---',
    `Request: ${input.request}`,
    '',
    input.outcome,
    '--- END PLAN ---',
    '',
    '--- YOUR OPERATION ---',
    input.intent,
    '',
    `Update ${input.path} accordingly and submit the complete file with ${SUBMIT_DOC}. If there is nothing`,
    'worth recording, say so in prose instead.'
  );

  return lines.join('\n');
}

/** Sent when a submission is unusable. The errors name their own fixes. */
export function docRepairMessage(errors: string[]): string {
  return [
    `That submission cannot be used — ${errors.length} problem(s):`,
    ...errors.map((e) => `- ${e}`),
    '',
    `Fix exactly these and resubmit the complete file with ${SUBMIT_DOC}.`
  ].join('\n');
}

/**
 * The one advisory pass, mirroring AIX-006's style advisory: the submission is
 * usable, but it restates the graph. Offered once — a second nudge on a
 * subjective call costs more than it buys, and the previous submission stands
 * if the revision never arrives.
 */
export function docAdvisoryMessage(findings: string[]): string {
  return [
    'The document is usable, but parts of it describe the GRAPH rather than the reasoning behind it:',
    ...findings.map((f) => `- ${f}`),
    '',
    'Those lines will be wrong the first time someone rearranges the canvas, and the editor can already',
    'narrate any component on demand. Rewrite them as intent, decisions or contracts — or delete them —',
    `and resubmit the complete file with ${SUBMIT_DOC}. If you believe a line genuinely records a decision`,
    'rather than a structure, keep it and resubmit unchanged.'
  ].join('\n');
}
