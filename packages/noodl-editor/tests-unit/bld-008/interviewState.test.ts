/**
 * BLD-008 acceptance criterion 2 — *"answering every question produces drafts
 * with zero TODOs; skipping three produces exactly three, each naming the
 * skipped question"*.
 *
 * ⚠️ Both halves are graded here rather than in a live drive, and that is the
 * design being asserted, not a convenience. A prompt cannot promise a count: the
 * drafting turn is forbidden from writing `> TODO:` at all, and the lines are
 * inserted by `insertSkipTodos`. So "exactly three" is arithmetic over a
 * function, and it can be wrong in only one place.
 *
 * The other thing pinned here is the shape of a skip. A declined question and an
 * empty answer are the same thing to a user and must be the same thing to the
 * model, or a heading ends up backed by nothing with no TODO saying so.
 */

import { TODO_MARKER } from '../../src/editor/src/models/AiAssistant/review/prompts';
import {
  answerOf,
  currentQuestion,
  insertSkipTodos,
  interviewActivities,
  interviewFrom,
  interviewProgress,
  isInterviewComplete,
  nothingSkipped,
  recordAnswer,
  recordSkip,
  renderAnswersForPrompt,
  renderSkipsForPrompt,
  reopen,
  skipTodoLines,
  type InterviewQuestion,
  type InterviewState
} from '../../src/editor/src/models/AiAssistant/review/interviewState';

function question(id: string, docKind: InterviewQuestion['docKind'], heading: string): InterviewQuestion {
  return { id, docKind, heading, question: `What about ${heading}?`, why: 'Because.', guess: `A guess for ${heading}.` };
}

const QUESTIONS: InterviewQuestion[] = [
  question('brief:what-this-app-is', 'brief', 'What this app is'),
  question('brief:who-uses-it', 'brief', 'Who uses it'),
  question('brief:deliberately-out-of-scope', 'brief', 'Deliberately out of scope'),
  question('architecture:data-model', 'architecture', 'Data model'),
  question('architecture:backend-contracts', 'architecture', 'Backend contracts'),
  question('conventions:what-not-to-do', 'conventions', 'What not to do')
];

function fresh(): InterviewState {
  return interviewFrom(QUESTIONS.map((q) => ({ ...q })));
}

function answerAll(state: InterviewState): InterviewState {
  return state.questions.reduce((acc, q) => recordAnswer(acc, q.id, `The truth about ${q.heading}.`), state);
}

describe('the order questions are put in', () => {
  it('offers the first unanswered one, in document order', () => {
    expect(currentQuestion(fresh())?.id).toBe('brief:what-this-app-is');
  });

  it('⚠️ goes back to a re-opened question rather than carrying on past it', () => {
    // "The one after the last answered" would skip it — and the user re-opened
    // it precisely because they wanted to change that answer.
    let state = answerAll(fresh());
    expect(currentQuestion(state)).toBe(undefined);
    state = reopen(state, 'brief:who-uses-it');
    expect(currentQuestion(state)?.id).toBe('brief:who-uses-it');
  });

  it('is complete only when nothing is pending', () => {
    expect(isInterviewComplete(fresh())).toBe(false);
    expect(isInterviewComplete(answerAll(fresh()))).toBe(true);
  });

  it('is not complete while a proposed document is undecided', () => {
    const withProposal: InterviewState = {
      ...answerAll(fresh()),
      proposedDoc: { path: 'docs/uk-vat.md', title: 'UK VAT', purpose: 'Rates.', inject: 'pull', why: 'Mentioned thrice.' }
    };
    expect(isInterviewComplete(withProposal)).toBe(false);
    expect(isInterviewComplete({ ...withProposal, proposalAccepted: false })).toBe(true);
  });

  it('⚠️ treats an empty answer as a skip, not as an answer', () => {
    // Otherwise a heading gets a blank "fact" and no TODO — the one combination
    // that is worse than either honest outcome.
    const state = recordAnswer(fresh(), 'brief:who-uses-it', '   ');
    expect(answerOf(state, 'brief:who-uses-it').status).toBe('skipped');
  });

  it('counts what is settled', () => {
    let state = recordAnswer(fresh(), 'brief:what-this-app-is', 'A shop.');
    state = recordSkip(state, 'brief:who-uses-it');
    expect(interviewProgress(state)).toEqual({ answered: 1, skipped: 1, total: 6 });
  });
});

describe('criterion 2, first half — answering everything leaves nothing to confirm', () => {
  it('reports nothing skipped, which is what switches the TODO advisory off', () => {
    expect(nothingSkipped(answerAll(fresh()))).toBe(true);
    expect(nothingSkipped(recordSkip(fresh(), 'brief:who-uses-it'))).toBe(false);
  });

  it('inserts no TODO line into a draft when nothing was declined', () => {
    const state = answerAll(fresh());
    const draft = '# Brief\n\n## What this app is\n\nA shop.\n';
    expect(insertSkipTodos(draft, state, 'brief')).toBe(draft);
    expect(skipTodoLines(state, 'brief')).toEqual([]);
  });

  it('hands the answers to the drafting turn as facts, under their headings', () => {
    const block = renderAnswersForPrompt(answerAll(fresh()), 'brief');
    expect(block).toContain('## Who uses it');
    expect(block).toContain('The truth about Who uses it.');
    // Only this document's answers.
    expect(block).not.toContain('Data model');
  });
});

describe('criterion 2, second half — skipping three produces exactly three', () => {
  function skipThree(): InterviewState {
    let state = answerAll(fresh());
    state = recordSkip(state, 'brief:who-uses-it');
    state = recordSkip(state, 'architecture:backend-contracts');
    state = recordSkip(state, 'conventions:what-not-to-do');
    return state;
  }

  it('produces one TODO per skipped question across the three documents — three in total', () => {
    const state = skipThree();
    const all = [
      ...skipTodoLines(state, 'brief'),
      ...skipTodoLines(state, 'architecture'),
      ...skipTodoLines(state, 'conventions')
    ];
    expect(all.length).toBe(3);
    for (const line of all) expect(line.startsWith(TODO_MARKER)).toBe(true);
  });

  it('names the skipped question in the line', () => {
    const [line] = skipTodoLines(skipThree(), 'brief');
    expect(line).toContain('What about Who uses it?');
    expect(line).toContain('you skipped this');
  });

  it('puts the line under the heading it belongs to', () => {
    const draft = ['# Brief', '', '## What this app is', '', 'A shop.', '', '## Who uses it', '', 'Shoppers.', ''].join(
      '\n'
    );
    const out = insertSkipTodos(draft, skipThree(), 'brief').split('\n');
    const heading = out.indexOf('## Who uses it');
    expect(heading).toBeGreaterThan(-1);
    // Directly under the heading, before the prose — a decline is the most
    // important thing about the section it is in.
    expect(out.slice(heading, heading + 3).some((line) => line.startsWith(TODO_MARKER))).toBe(true);
  });

  it('⚠️ never drops a decline, even when the model deleted the heading', () => {
    // The prompt asks for an empty heading to be kept; a prompt is advice. A
    // question the human explicitly declined must survive a model that ignored
    // it, or the decline is silently swallowed and the draft reads as complete.
    const draft = '# Brief\n\n## What this app is\n\nA shop.\n';
    const out = insertSkipTodos(draft, skipThree(), 'brief');
    expect(out).toContain('## Who uses it');
    expect(out.split('\n').filter((line) => line.startsWith(TODO_MARKER)).length).toBe(1);
  });

  it('is idempotent — a second pass does not double the lines', () => {
    const state = skipThree();
    const once = insertSkipTodos('# Brief\n\n## Who uses it\n\nShoppers.\n', state, 'brief');
    expect(insertSkipTodos(once, state, 'brief')).toBe(once);
  });

  it('tells the drafting turn which headings were declined, so it leaves them empty', () => {
    const skips = renderSkipsForPrompt(skipThree(), 'architecture');
    expect(skips).toContain('Backend contracts');
    expect(skips.split('\n').length).toBe(1);
  });
});

describe('the thread record — the transcript, and only the transcript', () => {
  /** The text of the nth activity, insisting it really is a question. */
  function questionText(state: InterviewState, index: number): string {
    const activity = interviewActivities(state)[index];
    if (!activity) throw new Error(`no activity at ${index} — the transcript has ${interviewActivities(state).length}`);
    if (activity.kind !== 'question') throw new Error(`activity ${index} is a ${activity.kind}, not a question`);
    return activity.text;
  }

  it('⚠️ writes nothing at all for a question still open', () => {
    // The open question is the *card* — one bordered card holding the question,
    // its evidence, the guess and the three answers, per the approved mockup.
    // An activity for it as well would put the same sentence on screen twice,
    // which is the defect this phase is measured on.
    expect(interviewActivities(fresh())).toEqual([]);
  });

  it('writes a settled question as a `question` activity, never a `tool` line', () => {
    // ⚠️ A `tool` activity is collapsible and a `question` is not. Written as
    // tool lines, the whole interview — the one exchange in this panel where the
    // *user* supplied the content — would disappear behind a "8 steps ▸"
    // disclosure.
    const activities = interviewActivities(answerAll(fresh()));
    expect(activities.length).toBe(6);
    expect(activities.every((activity) => activity.kind === 'question')).toBe(true);
  });

  it('carries what was said back to the question', () => {
    const state = recordAnswer(fresh(), 'brief:what-this-app-is', 'A shop for dog toys.');
    expect(questionText(state, 0)).toContain('What about What this app is?');
    expect(questionText(state, 0)).toContain('You said: A shop for dog toys.');
  });

  it('says what a skip costs, in the file it will cost it in', () => {
    const state = recordSkip(fresh(), 'architecture:data-model');
    // The only settled one, so it is the only entry. The transcript keeps
    // template order and omits what is still open, rather than reordering.
    expect(questionText(state, 0)).toContain('docs/ARCHITECTURE.md');
  });
});
