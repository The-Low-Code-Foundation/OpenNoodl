/**
 * BLD-008 — the interview, in the thread.
 *
 * Two claims are graded here and neither is visible on screen when it is wrong:
 *
 *  - the questions are `question` activities, **not** `tool` lines. A `tool`
 *    line is collapsible; a question is not. Written as tool lines, six
 *    questions and their answers would sit behind a "8 steps ▸" disclosure —
 *    the transcript of the only exchange in this panel where the *user*
 *    supplied the content, hidden by the mechanism built to hide "Read node
 *    documentation".
 *  - the docs turn during an interview carries **no outcome and no `busy`**. It
 *    is the one moment in this panel when nothing is running and the turn is not
 *    finished either: it is waiting on a person. The `done` branch would report
 *    "Drafted 0 documents" over a thread of unanswered questions, and `busy`
 *    would put a heartbeat on a turn that is not working.
 *
 *    ⚠️ That property is correct and it has a consequence the assertion below
 *    cannot show: `BuildThread`'s follow-the-tail effect is guarded on `busy`,
 *    so the one turn state that **blocks** is the one it will not scroll to.
 *    Driven at 400px, the questions arrived with the thread at `scrollTop: 26`
 *    of `547` and the card below the fold. The fix is `InterviewCard`'s own
 *    `scrollIntoView({ block: 'start' })` — if this expectation is ever
 *    relaxed to set `busy`, that fix is what to re-check, not this file.
 */

import { collapseActivities, isCollapsible } from '../../src/editor/src/models/AiAssistant/thread/messages';
import { docsTurns } from '../../src/editor/src/models/AiAssistant/thread/turns';
import type { ProjectReviewState } from '../../src/editor/src/models/AiAssistant/review/ProjectReviewRun';
import {
  interviewFrom,
  recordAnswer,
  type InterviewQuestion
} from '../../src/editor/src/models/AiAssistant/review/interviewState';

const QUESTIONS: InterviewQuestion[] = [
  {
    id: 'brief:who-uses-it',
    docKind: 'brief',
    heading: 'Who uses it',
    question: 'Are these shoppers or staff?',
    why: 'There is a sign-in page and a Staff collection.',
    guess: 'Shoppers browsing a catalogue.'
  },
  {
    id: 'architecture:decisions',
    docKind: 'architecture',
    heading: 'Decisions',
    question: 'Why is checkout its own page?',
    why: 'Checkout is a page rather than a modal, twice over.',
    guess: 'So the back button works.'
  }
];

function reviewState(patch: Partial<ProjectReviewState> = {}): ProjectReviewState {
  return { phase: 'interviewing', busy: false, drafts: [], costUsd: 0, ...patch };
}

describe('a docs turn while the interview is open', () => {
  const state = reviewState({ interview: interviewFrom(QUESTIONS) });

  it('⚠️ puts nothing in the feed for a question still open', () => {
    // The open question is the card — one card holding the question, its
    // evidence, the guess and the answers. An activity for it as well would be
    // the same sentence on screen twice.
    const [turn] = docsTurns(state, { request: "Write this project's documents" });
    expect(turn.activities).toEqual([]);
  });

  it('⚠️ never collapses a settled question into a run', () => {
    const settled = reviewState({
      interview: [QUESTIONS[0].id, QUESTIONS[1].id].reduce(
        (acc, id) => recordAnswer(acc, id, 'Because.'),
        interviewFrom(QUESTIONS)
      )
    });
    const [turn] = docsTurns(settled);
    expect(turn.activities.map((activity) => activity.kind)).toEqual(['question', 'question']);
    for (const activity of turn.activities) expect(isCollapsible(activity)).toBe(false);
    // Two adjacent collapsibles is exactly what MIN_RUN_LENGTH would absorb, so
    // this is the case that would have failed had they been `tool` lines.
    expect(collapseActivities(turn.activities).every((item) => item.kind === 'activity')).toBe(true);
  });

  it('⚠️ claims neither progress nor completion', () => {
    const [turn] = docsTurns(state);
    expect(turn.busy).toBe(undefined);
    expect(turn.outcome).toBe(undefined);
  });

  it('keeps the user’s request on the turn', () => {
    // The docs producer is the only one that cannot recover the request from its
    // own state — see `LiveSources.request`.
    const [turn] = docsTurns(state, { request: 'Write the docs' });
    expect(turn.request).toBe('Write the docs');
  });
});

describe('a docs turn once the answers are in', () => {
  it('shows what was said, above the drafts', () => {
    // Both settled, because drafting cannot start until they are — `canDraft()`
    // is false while anything is pending, so a `done` run with an open question
    // is not a state the panel can reach.
    const interview = recordAnswer(
      recordAnswer(interviewFrom(QUESTIONS), 'brief:who-uses-it', 'Shoppers only — staff use Shopify.'),
      'architecture:decisions',
      'The back button had to work.'
    );
    const [turn] = docsTurns(
      reviewState({
        phase: 'done',
        interview,
        drafts: [
          {
            kind: 'brief',
            path: 'docs/BRIEF.md',
            status: 'authored',
            baseline: null,
            todoCount: 0,
            lintFindings: [],
            costUsd: 0,
            turns: 1
          }
        ]
      })
    );

    const kinds = turn.activities.map((activity) => activity.kind);
    expect(kinds).toEqual(['question', 'question', 'tool']);
    const answered = turn.activities[0];
    expect(answered.kind === 'question' && answered.text).toContain('Shoppers only — staff use Shopify.');
    expect(turn.outcome).toEqual({ kind: 'docs-drafts', authored: 1, declined: 0, errors: 0 });
  });
});
