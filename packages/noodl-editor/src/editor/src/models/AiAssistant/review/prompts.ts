/**
 * AIX-010 — the retrofit's prompts.
 *
 * This file is where the task succeeds or fails. The plumbing around it is
 * ordinary; what is not ordinary is that the obvious output — a fluent prose
 * summary of everything on the canvas — is the **failure case**. AIX-009 exists
 * to stop AI-written markdown from becoming a second, rotting source of truth
 * about the graph. A retrofit that emits a node inventory in prose is not a
 * partial success; it is the thing the format was designed to prevent, shipped
 * with a deliverable's confidence.
 *
 * So each of the three documents is given a job AND an anti-goal, and the
 * system prompt spends most of its length on what not to write. `docLint`
 * (AIX-011) then checks mechanically that the model listened — the same
 * advisory pass, on the same findings, keyed on both catalog `typeName`s and
 * editor `displayName`s, which is the vocabulary a model actually writes in.
 *
 * The second thing this file does is make uncertainty expressible. A retrofit's
 * whole value is that a human corrects it in ten minutes instead of composing it
 * in an afternoon — and that only works if the parts needing correction are
 * marked. `> TODO:` is a hard requirement here (acceptance criterion 3), not a
 * style note, and the coverage block tells the model exactly which of its
 * beliefs are unfounded.
 *
 * @module AiAssistant/review/prompts
 */

import { DOC_ARCHITECTURE, DOC_BRIEF, DOC_CONVENTIONS, type KnownDocKind } from '../../ProjectDocs/docsText';
import type { ReviewDocKind } from './types';

/**
 * `docs/…` path for each **seed** document.
 *
 * ⚠️ `Record<KnownDocKind, …>`, not `Record<ReviewDocKind, …>`, and that is
 * load-bearing since BLD-008: a `proposed` document's path is invented by the
 * interview and carried on the draft. Widening this record to the full kind
 * union would make `REVIEW_DOC_PATHS[kind]` compile everywhere and return
 * `undefined` for the one kind that does not belong in it.
 */
export const REVIEW_DOC_PATHS: Record<KnownDocKind, string> = {
  brief: DOC_BRIEF,
  architecture: DOC_ARCHITECTURE,
  conventions: DOC_CONVENTIONS
};

/** The marker an uncertain claim must carry. Counted, and asserted by a spec. */
export const TODO_MARKER = '> TODO:';

interface DocBrief {
  title: string;
  /** What this file is for, in the retrofit's terms. */
  job: string[];
  /** What would make this file worse than not having it. */
  antiGoals: string[];
  /** Concrete things to look for in the material provided. */
  lookFor: string[];
}

const DOC_BRIEFS: Record<ReviewDocKind, DocBrief> = {
  brief: {
    title: 'BRIEF.md — what this app is',
    job: [
      'What the app appears to be for, and who appears to use it.',
      'The main things a user can do, named as user-facing capabilities.',
      'What is deliberately NOT here, when the shape of the project makes that legible.'
    ],
    antiGoals: [
      'An invented product goal stated as fact. You are reading a graph, not a product brief — you do not know',
      'what anyone intended. Every statement of purpose is an inference and must read like one, or carry a TODO.',
      'Do not name a market, a business model, a user persona or a success metric. Nothing in a node graph',
      'tells you any of those, and a confident guess about them is the single fastest way to make this file',
      'something the team deletes.'
    ],
    lookFor: [
      'the set of pages and what each is called — that is the app\'s surface',
      'the collections and their fields — that is what the app is *about*',
      'the project name and description, if it has one'
    ]
  },
  architecture: {
    title: 'ARCHITECTURE.md — how it is put together, and why',
    job: [
      'The page map: what screens exist and how a user moves between them.',
      'The data model: collections, their fields, and what they appear to represent.',
      'Backend contracts and integration points: what external service is relied on, and for what.',
      'Patterns that are clearly deliberate — how data is fetched, how state is shared, how streaming is handled.'
    ],
    antiGoals: [
      'A node-by-node inventory. No "the Chat page contains a Group with a Text node". No lists of connections',
      'or ports. No per-component walkthroughs. The graph is inspectable and this editor can narrate any',
      'component live, on demand — a prose copy is wrong the first time someone drags a node.',
      '',
      'The test: if a sentence would stop being true after a refactor that changed nothing about the app\'s',
      'behaviour, it does not belong here. "Chat streams tokens over SSE and appends them to one buffer" passes.',
      '"Chat has 32 nodes" fails. "The SSE node connects to the TextAccumulator" fails.'
    ],
    lookFor: [
      'which pages exist, which is the start page, and how navigation is wired between them',
      'the real collection and field names from the backend section — use them verbatim, never invent one',
      'the technique a component uses, stated at the level of the technique, not the wiring'
    ]
  },
  conventions: {
    title: 'CONVENTIONS.md — the rules for whoever works here next',
    job: [
      'Patterns this project ACTUALLY follows and that are worth keeping.',
      'Naming: how components, pages and collections are named here.',
      'Structure: how a page is laid out, where shared components live.',
      'Data: how records are fetched and written in this project.',
      'Styling: whether style tokens and variants are used, and which.'
    ],
    antiGoals: [
      'Aspirational rules the project does not follow. This file is read by an AI assistant before it authors',
      'anything, so a rule nobody follows becomes a rule the assistant enforces against the codebase it is',
      'editing. Write only what you can point at more than once in what you were shown.',
      '',
      'Generic best practice is worse than nothing here. "Use meaningful names" and "keep components small"',
      'apply to every project ever written and cost prompt budget on every single turn. If a rule would be',
      'true of a project you have never seen, delete it.'
    ],
    lookFor: [
      'the naming shape components share — a prefix, a folder, a casing',
      'whether pages are built the same way as each other',
      'style token names that recur, if a style vocabulary was provided',
      'a convention you can see TWICE. Once is a coincidence.'
    ]
  },
  /**
   * BLD-008 item 8 — the document the interview invented.
   *
   * Its job is the one the three seeds cannot do: hold outside knowledge that
   * has no home. The anti-goals are sharper here than anywhere else because
   * nobody asked for this file — it exists because the agent proposed it and the
   * user said yes, so a fourth file of restated graph is a cost with no ask
   * behind it.
   */
  proposed: {
    title: 'a document this project asked for',
    job: [
      'The outside knowledge the graph cannot hold: a rule, a rate, a third-party contract, a house style.',
      'What the user told you about it, in their words, organised so it can be read in a minute.',
      'The front matter that decides how it reaches the assistant — it is the first thing in the file.'
    ],
    antiGoals: [
      'Anything the three other documents already cover. This file exists because something did NOT fit them;',
      'if what you are writing is a brief, an architecture note or a convention, it belongs there instead.',
      '',
      'Padding. This file was proposed on the strength of one observation. If that observation and what the user',
      'said about it fill four lines, the document is four lines long and that is a good document.'
    ],
    lookFor: [
      "the user's own answers — this file is mostly theirs, not yours",
      'the facts in the material that made this worth proposing at all'
    ]
  }
};

export const reviewSystemPrompt = (kind: ReviewDocKind): string => {
  const doc = DOC_BRIEFS[kind];
  return `You are reviewing a Noodl project that was built by hand and has no written context, and drafting one
of the three documents under docs/ that a human owns and that this project's AI assistant reads before it
authors anything.

You are drafting: ${doc.title}

THIS DRAFT WILL BE REVIEWED, NOT PUBLISHED
A human is about to read what you write, side by side with their project, and correct it. That is the whole
point: correcting a draft takes ten minutes, composing one takes an afternoon. It only works if the parts
that need correcting are MARKED. An unmarked wrong sentence costs more than a missing one, because it is
believed.

WHAT THIS FILE IS FOR
${doc.job.map((l) => `- ${l}`).join('\n')}

WHAT WOULD MAKE THIS FILE WORSE THAN NOTHING
${doc.antiGoals.join('\n')}

WHAT TO LOOK FOR IN THE MATERIAL
${doc.lookFor.map((l) => `- ${l}`).join('\n')}

NEVER DESCRIBE THE GRAPH
These documents hold exactly what a node graph structurally cannot: intent, decisions and the reasoning
behind them, external contracts, and the rules for next time. They must never contain node inventories,
connection lists, port names or per-component walkthroughs. Say WHY, not WHAT.

MARK EVERY INFERENCE
You are reading structure and guessing at meaning. Almost everything you are about to write about *purpose*
is an inference. Two tools, and you must use both:

1. Hedged prose for a confident inference: "appears to", "is presumably", "reads as".
2. A TODO line for anything a human must confirm or supply. Write it exactly like this, on its own line:

   ${TODO_MARKER} confirm whether the Live page is a demo or a shipped feature — the graph cannot tell.

   Put a TODO wherever you wanted to write a fact and found you only had a guess: the app's actual purpose,
   who the users are, why a decision was made, what an external service is for, whether a pattern is
   deliberate or accidental. A draft with ten honest TODOs is far more useful than a draft with none.

You will be told exactly how much of the project you were shown. You were almost certainly not shown all of
it. Never write about a component you did not read as though you had read it — a TODO is the correct output
for a question your material cannot answer.

BE SHORT
A document nobody finishes reading is a document nobody reads. Prefer a paragraph to a section and a
sentence to a paragraph. Empty headings are fine; invented paragraphs are not.

Submit the complete file with the submit tool. If you genuinely have nothing to say for this document —
which is a real outcome, especially for CONVENTIONS.md in a project with no discernible conventions — say so
in prose and do not call the tool.`;
};

export interface ReviewTurnInput {
  kind: ReviewDocKind;
  path: string;
  /** The reference material — `renderProjectReviewContext`. */
  context: string;
  /** What was and was not read — `renderCoverageForPrompt`. */
  coverage: string;
  /** The existing file, when there is one. A re-run edits rather than replaces. */
  current?: string;
  /** The starter skeleton, when the file does not exist yet. */
  template?: string;
  /** Drafts produced earlier in this same run, so the three do not repeat each other. */
  siblings?: Array<{ path: string; summary: string }>;
  /**
   * BLD-008 — what the owner of the project said, from `answersBlock`.
   *
   * Empty when no interview ran, which is how the pre-BLD-008 behaviour is
   * reached: by the absence of a block rather than by a flag a caller can forget
   * to set. It goes **last**, after the task, and that placement is the same
   * recency argument the rest of this file is built on — these are the sentences
   * the draft is supposed to be made of.
   */
  answers?: string;
}

/**
 * The opening turn. Reference material first, task last — the same recency
 * ordering as the authoring, planning and doc-authoring prompts, for the same
 * reason.
 */
export function reviewUserMessage(input: ReviewTurnInput): string {
  const lines: string[] = [
    input.context,
    '',
    '--- WHAT YOU WERE AND WERE NOT SHOWN ---',
    input.coverage,
    '--- END COVERAGE ---',
    ''
  ];

  if (input.siblings && input.siblings.length > 0) {
    lines.push(
      '--- ALREADY DRAFTED IN THIS REVIEW ---',
      'These other documents are being drafted from the same material in the same pass. Do not repeat what',
      'they cover; refer to them instead.',
      ...input.siblings.map((s) => `- ${s.path}: ${s.summary}`),
      '--- END ALREADY DRAFTED ---',
      ''
    );
  }

  if (input.current !== undefined) {
    lines.push(
      `--- ${input.path} AS IT STANDS TODAY ---`,
      input.current,
      `--- END ${input.path} ---`,
      '',
      'This file already exists. You are proposing an EDIT, not a replacement: keep the human\'s wording, their',
      'headings and their ordering, correct what the project has since made wrong, and add what is missing.',
      'The user will see your version as a diff against the above, so every line you change should be a line',
      'you meant to change.',
      ''
    );
  } else {
    lines.push(
      `--- ${input.path} DOES NOT EXIST YET ---`,
      'You are writing it for the first time. The starter template is below: keep the headings this project has',
      'something to say about, delete the rest, and fill in only what the material supports. An empty heading is',
      'better than an invented paragraph.',
      '',
      input.template ?? '(no template — start from a single heading)',
      '--- END TEMPLATE ---',
      ''
    );
  }

  lines.push(
    '--- YOUR TASK ---',
    `Draft ${input.path} for this project and submit the complete file.`,
    // ⚠️ Two different instructions about TODO lines, and exactly one of them is
    // in the prompt at a time. Without an interview, a TODO is how the model
    // admits it was guessing and it is required. With one, the TODOs are written
    // by `insertSkipTodos` — one per declined question, no more — and a
    // model-authored line would be a second, false claim that somebody declined
    // something. `answersBlock` carries the prohibition, so the two can never
    // both be on screen.
    ...(input.answers
      ? ['Use what you were told below. Do not describe the graph.']
      : [
          'Mark every inference. Use a TODO line wherever a human must confirm or supply something you cannot know.',
          'Do not describe the graph.'
        ])
  );

  if (input.answers) lines.push('', input.answers);

  return lines.join('\n');
}

/**
 * Sent when a draft carries no TODO markers at all.
 *
 * Not a rejection — a draft can legitimately be certain about a small, fully
 * visible project. But a retrofit of a project nobody documented, written from a
 * partial read, that finds *nothing* worth a human's confirmation, has almost
 * always smoothed its guesses into facts. Asking once is cheap; the previous
 * submission stands if the revision never lands.
 */
export function todoAdvisoryMessage(coverageLine: string): string {
  return [
    'That draft contains no TODO lines, and it was written without seeing all of this project:',
    coverageLine,
    '',
    'Re-read your own draft looking for sentences that state a purpose, a reason, a user, or an intention.',
    `Each of those is an inference from structure. Where one is load-bearing, replace it with a "${TODO_MARKER}"`,
    'line asking the human to confirm, or hedge it explicitly. Then resubmit the complete file.',
    '',
    'If, having checked, every sentence really is supported by what you were shown, resubmit it unchanged and',
    'say so — that is a legitimate answer for a small project.'
  ].join('\n');
}

/** How many `> TODO:` lines a document carries. Criterion 3, counted. */
export function countTodoMarkers(content: string): number {
  return content.split('\n').filter((line) => line.trimStart().startsWith(TODO_MARKER)).length;
}
