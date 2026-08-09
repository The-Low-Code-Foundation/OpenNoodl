/**
 * BLD-008 — the questions, derived from the documents they will fill.
 *
 * The defect this closes is that the retrofit never asked anything: it read what
 * it could afford, guessed the rest, marked the guesses `> TODO:` and **showed
 * the TODO count as a feature**. The templates had already diagnosed it in their
 * own header — *"every heading asks a question the graph cannot answer for
 * itself"* — so the system knew the information was only obtainable from the
 * human, and obtained it by guessing and asking the human to proofread.
 *
 * ## Why the headings are parsed rather than listed
 *
 * A hand-written list of questions beside a hand-written set of templates is two
 * copies of one decision, and the copy nobody edits is the one that goes stale:
 * add a heading to `ARCHITECTURE.md`'s template and the interview would go on
 * asking about the four that were there in 2026. So the **set** comes from
 * `DOC_TEMPLATES` — parse its `##` headings — and this module only decides, per
 * heading, whether the graph can answer it.
 *
 * That split is what acceptance criterion 4 pins: change `templates.ts` and the
 * question set changes, because there is nowhere else for it to come from.
 *
 * ## An unclassified heading is asked, not skipped
 *
 * {@link QUESTION_RULES} is a lookup, and a lookup can miss. It misses on
 * exactly one event — somebody adds a heading to a template — and the two ways
 * to fail differ sharply: *asking* about a heading nobody classified costs one
 * question, while *skipping* it silently restores the defect this task exists to
 * remove, for that heading, invisibly. So the default is to ask, phrased from
 * the heading itself.
 *
 * ⚠️ That default is deliberately not the whole safety net — a default cannot
 * fail loudly. `tests-unit/bld-008/interviewQuestions.test.ts` asserts that every
 * heading currently in `DOC_TEMPLATES` has a rule, so a new one is a red spec
 * *and* a sensible question, rather than either alone.
 *
 * @module AiAssistant/review/interviewQuestions
 */

import { DOC_TEMPLATES } from '../../ProjectDocs/templates';
import type { KnownDocKind } from '../../ProjectDocs/docsText';
import { REVIEW_DOC_ORDER } from './types';

/**
 * What the interview asks about one template heading.
 *
 * `question` and `ground` are *inputs to the model*, not the text the user
 * reads: the model rewrites the question in this project's vocabulary and
 * grounds the "why I'm asking" in what it actually saw. What is fixed here is
 * the subject and the evidence it must be tied to — see
 * {@link InterviewQuestion} for what comes back.
 */
export interface QuestionRule {
  /**
   * False when the graph answers this heading on its own.
   *
   * The bar is *the graph can answer it*, not *the model could guess it*. A page
   * map is derivable — the routers, the pages and the navigations are all in the
   * graph, and `pageMap.ts` already extracts them. Whether the people using
   * those pages are shoppers or staff is not derivable from anything, at any
   * budget, which is why it is a question and not a better prompt.
   */
  ask: boolean;
  /** Why the graph is enough, for the headings that are not asked. */
  derivedFrom?: string;
  /** The subject, in the user's terms. The model rewrites it for this project. */
  question?: string;
  /** What the model must tie its "why I'm asking" to. */
  ground?: string;
}

/**
 * One rule per heading, keyed `<docKind>/<heading>`.
 *
 * Flat rather than nested so a missing entry is one lookup returning
 * `undefined`, and so the spec that walks `DOC_TEMPLATES` can compare two sets
 * of strings rather than two shapes.
 */
export const QUESTION_RULES: Record<string, QuestionRule> = {
  // ── BRIEF.md ────────────────────────────────────────────────────────────────
  //
  // Nothing in this file is derivable. A node graph records what was built, and
  // every heading here asks about intent — which is why the retrofit's BRIEF was
  // always its most confident and least trustworthy output.
  'brief/What this app is': {
    ask: true,
    question: 'What is this app for, in a sentence or two?',
    ground: 'the pages it found and the collections behind them'
  },
  'brief/Who uses it': {
    ask: true,
    question: 'Who actually opens this, and what do they already know?',
    ground: 'any sign-in, role or user collection it found — or the absence of one'
  },
  'brief/Deliberately out of scope': {
    ask: true,
    question: 'What is this app deliberately NOT going to do?',
    ground:
      'a decision not to build something leaves no trace in a graph at all, so say so rather than pointing at evidence'
  },

  // ── ARCHITECTURE.md ─────────────────────────────────────────────────────────
  'architecture/Page map': {
    ask: false,
    derivedFrom: 'the routers, pages and navigations the assembler already extracts'
  },
  'architecture/Data model': {
    // The collections and fields ARE derivable and are not asked about. The
    // template's own line is "why this shape and not the obvious alternative",
    // and that is the part no schema contains.
    ask: true,
    question: 'Why is the data shaped this way, rather than the obvious alternative?',
    ground: 'the collections and fields it read, by name'
  },
  'architecture/Backend contracts': {
    ask: true,
    question: 'What do the outside services this app depends on guarantee — and what happens when they are down?',
    ground: 'the backend and any external service it found'
  },
  'architecture/Decisions': {
    ask: true,
    question: 'Which choices here were deliberate, and what did you reject?',
    ground: 'a pattern it noticed more than once'
  },

  // ── CONVENTIONS.md ──────────────────────────────────────────────────────────
  //
  // Almost all derivable, and that is the point of the file: a convention is
  // something you can see TWICE in the project (the drafting prompt's own rule).
  // A rule the project does not follow is worse than no rule, because this file
  // reaches the assistant verbatim on every turn.
  'conventions/How this file is used': {
    ask: false,
    derivedFrom: 'the template — it is the same paragraph in every project'
  },
  'conventions/Structure': { ask: false, derivedFrom: 'the component paths it read' },
  'conventions/Naming': { ask: false, derivedFrom: 'the component and collection names it read' },
  'conventions/Styling': { ask: false, derivedFrom: 'the style vocabulary the assembler collects' },
  'conventions/Data': { ask: false, derivedFrom: 'how the components it read fetch and write records' },
  'conventions/What not to do': {
    ask: true,
    question: 'What should nobody — and no assistant — do in this project?',
    ground: 'a rule it can see the project following, or something it noticed the project never does'
  }
};

/** The markdown `##` headings of one template, in order. */
export function templateHeadings(template: string): string[] {
  const headings: string[] = [];
  for (const line of template.split('\n')) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) headings.push(match[1]);
  }
  return headings;
}

/** Every `<docKind>/<heading>` key `DOC_TEMPLATES` currently produces. */
export function templateHeadingKeys(): string[] {
  const keys: string[] = [];
  for (const kind of REVIEW_DOC_ORDER) {
    for (const heading of templateHeadings(DOC_TEMPLATES[kind])) keys.push(`${kind}/${heading}`);
  }
  return keys;
}

/** One question the interview will ask, before the model has phrased it. */
export interface InterviewQuestionSpec {
  /**
   * Stable across runs and across restarts, because an answer is stored against
   * it and an interview is resumable. Derived from the document and the heading,
   * never from position: inserting a heading must not re-point yesterday's
   * answers at their neighbours.
   */
  id: string;
  docKind: KnownDocKind;
  heading: string;
  question: string;
  ground: string;
}

function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The questions this project's templates ask, in document order.
 *
 * Pure and argument-free: the answer depends only on `DOC_TEMPLATES` and the
 * table above, which is what makes criterion 4 a one-line spec.
 */
export function interviewQuestions(): InterviewQuestionSpec[] {
  const specs: InterviewQuestionSpec[] = [];
  for (const docKind of REVIEW_DOC_ORDER) {
    for (const heading of templateHeadings(DOC_TEMPLATES[docKind])) {
      const rule = QUESTION_RULES[`${docKind}/${heading}`];
      if (rule && !rule.ask) continue;
      specs.push({
        id: `${docKind}:${slug(heading)}`,
        docKind,
        heading,
        // An unclassified heading is asked, from its own words. See the header.
        question: rule?.question ?? `What should "${heading}" say for this project?`,
        ground: rule?.ground ?? 'whatever it read that bears on this heading'
      });
    }
  }
  return specs;
}
