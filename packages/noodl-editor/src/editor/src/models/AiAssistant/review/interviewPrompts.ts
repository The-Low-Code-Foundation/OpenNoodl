/**
 * BLD-008 — asking, and then drafting from the answers.
 *
 * Two prompts live here and they pull in opposite directions, which is why they
 * are in one file where that is visible:
 *
 *  - {@link interviewSystemPrompt} spends its length making the model **admit
 *    what it does not know**. Its output is questions, and a question the model
 *    could have answered from the graph is a wasted minute of a human's day.
 *  - {@link answersBlock} then hands those answers to the drafting turn as
 *    **facts from the owner of the project**, outranking anything the model
 *    inferred — and forbids `> TODO:` entirely, because on this path the TODOs
 *    are written by `interviewState.insertSkipTodos` and the count is exact.
 *
 * ## The guess is the interface
 *
 * Every question carries the model's own best answer, pre-filled and editable.
 * That is not a nicety: the retrofit's whole economics are that correcting is
 * cheaper than composing, and an interview that hands a person six empty boxes
 * has moved the composing earlier rather than removed it. A wrong guess is still
 * a cheap answer — the user deletes a clause. An empty box is an afternoon.
 *
 * So the model is told to guess **as well as it can** and to guess even when
 * unsure, and the UI says whose sentence it is. The failure mode this creates —
 * a confident wrong guess accepted without reading — is real, and is why the
 * *why* line exists beside it: it says what the guess was built from, so a user
 * can see in one glance whether the agent had grounds.
 *
 * @module AiAssistant/review/interviewPrompts
 */

import type { KnownDocKind } from '../../ProjectDocs/docsText';
import type { AiToolDefinition } from '../client/types';
import type { InterviewQuestionSpec } from './interviewQuestions';
import type { InterviewState } from './interviewState';
import { renderAnswersForPrompt, renderSkipsForPrompt } from './interviewState';
import { REVIEW_DOC_PATHS } from './prompts';

export const SUBMIT_INTERVIEW = 'submit_questions';

/** The one tool the interview turn has. Questions in, nothing written. */
export const INTERVIEW_TOOLS: AiToolDefinition[] = [
  {
    name: SUBMIT_INTERVIEW,
    description:
      'Submit the questions to put to the person who owns this project, one per question id you were given, ' +
      'each with your own best guess at the answer. Optionally propose one extra document worth having.',
    parameters: {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          description: 'One entry per question id you were given, in the order you were given them.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The question id, copied exactly.' },
              question: {
                type: 'string',
                description:
                  "The question, rewritten in this project's own vocabulary. One sentence, addressed to the user as 'you'."
              },
              why: {
                type: 'string',
                description:
                  'One sentence saying what you saw that made you ask, and what you cannot tell from it. ' +
                  'Point at something real in the material — a page, a collection, a component name.'
              },
              guess: {
                type: 'string',
                description:
                  'Your own best answer, written as the finished sentence you would put in the document. ' +
                  'The user edits this rather than composing from blank, so guess even when unsure.'
              }
            },
            required: ['id', 'question', 'why', 'guess']
          }
        },
        proposedDoc: {
          type: 'object',
          description:
            'Optional. One extra document this project would benefit from, beyond the three. Propose one ONLY ' +
            'when the material shows a body of outside knowledge the graph cannot hold — a tax rule, a ' +
            "third-party API's quirks, a brand voice. Omit it otherwise; a speculative fourth file is a cost.",
          properties: {
            title: { type: 'string', description: 'Human title, e.g. "UK VAT rules".' },
            filename: {
              type: 'string',
              description: 'Lower-case file name with no folder and no extension, e.g. "uk-vat".'
            },
            purpose: { type: 'string', description: 'One sentence: what this document is for.' },
            inject: {
              type: 'string',
              enum: ['always', 'pull'],
              description:
                "'always' sends it with every build in this project and costs tokens on every turn; 'pull' " +
                'fetches it when the task looks related. Prefer pull unless it is short and always relevant.'
            },
            why: { type: 'string', description: 'What you noticed that made you propose it.' }
          },
          required: ['title', 'filename', 'purpose', 'inject', 'why']
        }
      },
      required: ['questions']
    }
  }
];

export function interviewSystemPrompt(): string {
  return `You are about to draft the context documents for a Noodl project that was built by hand and has no
written context. Before you draft anything, you are going to ask its owner the questions the graph cannot
answer for itself.

WHY THIS TURN EXISTS
The previous version of this pass read what it could afford, guessed the rest, marked the guesses TODO, and
handed a person three confident-looking documents to proofread. A question asked before drafting costs one
exchange and removes the guess. You are that exchange.

WHAT YOU ARE PRODUCING
One question per id you are given below, and nothing else. Each carries three things:

1. THE QUESTION, rewritten in this project's own vocabulary. Not "who are the users" but "the graph shows a
   sign-in page and a Staff collection — are the people using this shoppers, or the people who run the shop?".
   Address the user as "you". One sentence. No preamble.

2. WHY YOU ARE ASKING, tied to something you actually saw. Name the page, the collection, the component. If
   the honest answer is that nothing in a graph could ever record this, say that instead — do not invent
   evidence to look grounded.

3. YOUR OWN BEST GUESS, written as the finished sentence you would have put in the document.

THE GUESS IS THE POINT
The user edits your guess; they do not compose from blank. That is the whole saving. So guess properly, and
guess even where you are unsure — a wrong guess costs one deleted clause, an empty box costs an afternoon.
Write it as prose for the document, not as a hedge about your own uncertainty: "Shoppers browsing a catalogue
and placing orders; there is no staff-facing surface" is useful, "it is unclear who uses this" is not.

DO NOT ASK WHAT YOU CAN SEE
You were given the page map, the data model and a selection of components. Anything derivable from those is
not a question — it is something you already know, and asking about it wastes the exchange this turn exists
to buy. Ask about intent, reasons, outside contracts and what was rejected.

You will be told exactly how much of the project you were shown. Where your guess rests on a part you did not
read, say so in the "why" — that is what tells the user which of your guesses to read carefully.

Call ${SUBMIT_INTERVIEW} once, with every id you were given.`;
}

export interface InterviewTurnInput {
  /** Reference material — `renderProjectReviewContext`. */
  context: string;
  /** What was and was not read — `renderCoverageForPrompt`. */
  coverage: string;
  specs: readonly InterviewQuestionSpec[];
  /** The docs that already exist, so a re-run asks about what changed. */
  existing?: Partial<Record<KnownDocKind, string>>;
}

export function interviewUserMessage(input: InterviewTurnInput): string {
  const lines: string[] = [
    input.context,
    '',
    '--- WHAT YOU WERE AND WERE NOT SHOWN ---',
    input.coverage,
    '--- END COVERAGE ---',
    ''
  ];

  const existing = Object.entries(input.existing ?? {}).filter(([, body]) => typeof body === 'string' && body.trim());
  if (existing.length > 0) {
    lines.push(
      '--- DOCUMENTS THIS PROJECT ALREADY HAS ---',
      'Read these before you ask. A question already answered here is a question you must not ask; ask instead',
      'about what has changed, or what these leave open.',
      ''
    );
    for (const [kind, body] of existing) {
      lines.push(`### ${REVIEW_DOC_PATHS[kind as KnownDocKind]}`, String(body), '');
    }
    lines.push('--- END EXISTING DOCUMENTS ---', '');
  }

  lines.push('--- THE QUESTIONS TO PUT ---');
  for (const spec of input.specs) {
    lines.push(
      `id: ${spec.id}`,
      `document: ${REVIEW_DOC_PATHS[spec.docKind]}, under the heading "${spec.heading}"`,
      `subject: ${spec.question}`,
      `ground your "why" in: ${spec.ground}`,
      ''
    );
  }
  lines.push('--- END QUESTIONS ---', '');

  lines.push(
    '--- YOUR TASK ---',
    `Call ${SUBMIT_INTERVIEW} once, with one entry per id above, in that order.`,
    'Rewrite each subject as a question about THIS project. Ground each "why" in what you actually read.',
    'Fill each guess with the sentence you would have written into the document yourself.'
  );

  return lines.join('\n');
}

/**
 * What the drafting turn is told about the interview.
 *
 * Returns the empty string when there was no interview, so the existing
 * behaviour — draft, guess, mark the guesses — is reached by the *absence* of a
 * block rather than by a flag the caller can forget to set.
 */
export function answersBlock(state: InterviewState | undefined, docKind: KnownDocKind): string {
  if (!state || state.questions.length === 0) return '';

  const answers = renderAnswersForPrompt(state, docKind);
  const skips = renderSkipsForPrompt(state, docKind);
  const lines: string[] = ['--- WHAT THE OWNER OF THIS PROJECT TOLD YOU ---'];

  if (answers) {
    lines.push(
      'These are answers from the person who owns this project, given before you drafted anything. They are',
      'FACTS, and they outrank anything you inferred from the graph. Use them. Do not hedge them, do not',
      'restate them as "appears to", and do not mark them uncertain — the uncertainty is what the interview',
      'removed.',
      '',
      answers,
      ''
    );
  } else {
    lines.push('They answered nothing that belongs in this document.', '');
  }

  if (skips) {
    lines.push(
      'They DECLINED to answer these, and that decision is recorded for them — you must not answer on their',
      'behalf and you must not write a TODO for it yourself:',
      skips,
      '',
      'Keep each of those headings in the document with nothing under it. Something else will fill it.',
      ''
    );
  }

  lines.push(
    `NEVER write a line beginning "${'>'} TODO:" in this draft. On this path those lines are written for you,`,
    'one per declined question, so one you add by hand becomes a second, false claim that a human declined',
    'something they were never asked. Where you are uncertain about something nobody was asked, hedge in',
    'prose instead — "appears to", "reads as".',
    '--- END WHAT THE OWNER TOLD YOU ---'
  );

  return lines.join('\n');
}
