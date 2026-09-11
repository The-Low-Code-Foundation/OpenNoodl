/**
 * BLD-008 — the interview: what was asked, what was answered, and what a skip costs.
 *
 * Pure, for the reason every model in this phase is pure and one that is
 * specific to this task: the interview is the only place in the docs pass where
 * a *human's* words are held, and the rule that decides whether they are lost —
 * "an answered question is never asked twice, a skipped one is never silently
 * dropped" — is exactly the kind of rule that is invisible on screen when it is
 * wrong. A skipped question that quietly stops producing its TODO looks like a
 * clean draft.
 *
 * ## The TODO is written here, not by the model
 *
 * Acceptance criterion 2 is *"skipping three produces exactly three, each naming
 * the skipped question"*. A prompt cannot promise a count. So the drafting
 * prompt forbids `> TODO:` outright and {@link insertSkipTodos} inserts one line
 * per skipped question, under the heading it belongs to. The count is then a
 * property of the code — the same discipline that makes "rejecting every draft
 * leaves the project byte-identical" a property of the code rather than of the
 * prompt.
 *
 * ⚠️ **This inverts what a TODO means, and that is the point of the task.**
 * Before, a TODO meant *the machine could not work it out*; the panel counted
 * them and displayed the count as a feature. Now it means *the human declined to
 * say*, which is a real signal about a real decision — and there is exactly one
 * per decline.
 *
 * ⚠️ It also means the existing TODO advisory must be off on this path.
 * `todoAdvisoryMessage` is sent when a draft carries **no** TODO lines and asks
 * the model to add some; on an interview that was fully answered, that is a
 * mechanism actively working against criterion 2's first half. See
 * `ProjectReviewRun`, which switches it off whenever answers were supplied.
 *
 * @module AiAssistant/review/interviewState
 */

import type { KnownDocKind } from '../../ProjectDocs/docsText';
import type { TurnActivity } from '../thread/types';
import type { InterviewQuestionSpec } from './interviewQuestions';
import { REVIEW_DOC_PATHS, TODO_MARKER } from './prompts';

/**
 * A question as the user sees it — the spec, with the model's own phrasing,
 * grounding and first guess.
 *
 * `guess` is what makes the interview cheap: answering by correcting a sentence
 * is far less work than answering into an empty box, and a wrong guess is
 * *easier* to correct than a blank is to fill. It is the same trade the drafts
 * themselves make, moved to before the drafting rather than after.
 */
export interface InterviewQuestion {
  id: string;
  docKind: KnownDocKind;
  heading: string;
  /** The question, in this project's vocabulary. */
  question: string;
  /** Why it is being asked, tied to what the agent saw. */
  why: string;
  /** The agent's own best answer, pre-filled and editable. */
  guess: string;
}

/**
 * A document the interview proposes that is not one of the three.
 *
 * BLD-007 is what makes this worth anything: before front matter, a doc the user
 * invented could be created, listed, and then **never read** — so proposing one
 * would have been an offer to write a file nothing would ever inject.
 */
export interface ProposedDoc {
  /** Project-relative, e.g. `docs/uk-vat.md`. */
  path: string;
  title: string;
  /** One sentence: what this document is for. Seeds the template. */
  purpose: string;
  /** Stated to the user, because `always` is a real per-turn cost. */
  inject: 'always' | 'pull';
  /** What the agent noticed that made it propose this. */
  why: string;
}

export type InterviewAnswerStatus = 'pending' | 'answered' | 'skipped';

export interface InterviewAnswer {
  status: InterviewAnswerStatus;
  /** The human's words. Present only when `answered`. */
  text?: string;
}

export interface InterviewState {
  questions: InterviewQuestion[];
  /** By question id, so an interview survives a template gaining a heading. */
  answers: Record<string, InterviewAnswer>;
  proposedDoc?: ProposedDoc;
  /** Undefined until the user answers the proposal. */
  proposalAccepted?: boolean;
}

export function emptyInterview(): InterviewState {
  return { questions: [], answers: {} };
}

export function answerOf(state: InterviewState, id: string): InterviewAnswer {
  return state.answers[id] ?? { status: 'pending' };
}

/**
 * The question on screen, or nothing.
 *
 * The first still-pending one in document order — never "the one after the last
 * answered", which would skip past a question the user went back to.
 */
export function currentQuestion(state: InterviewState): InterviewQuestion | undefined {
  return state.questions.find((question) => answerOf(state, question.id).status === 'pending');
}

/** True when every question has an answer or a decline, and the proposal is decided. */
export function isInterviewComplete(state: InterviewState): boolean {
  if (state.questions.length === 0) return false;
  if (currentQuestion(state)) return false;
  if (state.proposedDoc && state.proposalAccepted === undefined) return false;
  return true;
}

/** How many are settled, for a progress line that counts rather than guesses. */
export function interviewProgress(state: InterviewState): { answered: number; skipped: number; total: number } {
  let answered = 0;
  let skipped = 0;
  for (const question of state.questions) {
    const status = answerOf(state, question.id).status;
    if (status === 'answered') answered++;
    else if (status === 'skipped') skipped++;
  }
  return { answered, skipped, total: state.questions.length };
}

export function recordAnswer(state: InterviewState, id: string, text: string): InterviewState {
  const trimmed = text.trim();
  // An empty "answer" is a skip wearing an answer's clothes: it would produce a
  // document heading backed by nothing and no TODO saying so.
  if (!trimmed) return recordSkip(state, id);
  return { ...state, answers: { ...state.answers, [id]: { status: 'answered', text: trimmed } } };
}

export function recordSkip(state: InterviewState, id: string): InterviewState {
  return { ...state, answers: { ...state.answers, [id]: { status: 'skipped' } } };
}

/** Re-open a settled question. The user changed their mind; nothing is lost. */
export function reopen(state: InterviewState, id: string): InterviewState {
  const answers = { ...state.answers };
  delete answers[id];
  return { ...state, answers };
}

export function decideProposal(state: InterviewState, accepted: boolean): InterviewState {
  return { ...state, proposalAccepted: accepted };
}

/** Build the state from the specs and what the model returned for each. */
export function interviewFrom(questions: InterviewQuestion[], proposedDoc?: ProposedDoc): InterviewState {
  return { questions, answers: {}, ...(proposedDoc ? { proposedDoc } : {}) };
}

/**
 * BLD-008 — whether an interview read back from disk still describes the
 * documents we are about to draft.
 *
 * ⚠️ Compared against the **specs**, which are pure and free, rather than
 * against a fresh interview turn, which is billed: a resume that pays for the
 * questions again to discover it already had the answers is not a resume.
 *
 * ⚠️ And compared at all because a saved interview is a set of ids, the ids come
 * from `templates.ts`, and a template that gained or lost a heading between the
 * two sittings would otherwise resume an interview that no longer describes the
 * documents — silently, because every stored answer would still land on an id
 * that exists. Same ids, same order: resume. Anything else: ask again, and
 * nothing on disk is destroyed by the mismatch.
 *
 * ⚠️ Lives here, in the pure module, rather than beside `startProjectReview`.
 * That module reaches `ProjectModel` and the filesystem, so a rule declared
 * there cannot be graded in the plain-Node runner — which is where every other
 * rule about interview state is graded, and where this one's failure mode
 * (an answer under a question nobody read) is invisible on screen.
 */
export function resumableInterview(
  saved: InterviewState,
  specs: readonly { id: string }[]
): InterviewState | undefined {
  if (saved.questions.length !== specs.length) return undefined;
  for (let i = 0; i < specs.length; i++) {
    if (saved.questions[i].id !== specs[i].id) return undefined;
  }
  return saved;
}

// ── What the drafting turn is told ────────────────────────────────────────────

export function answeredFor(state: InterviewState, docKind: KnownDocKind): InterviewQuestion[] {
  return state.questions.filter(
    (question) => question.docKind === docKind && answerOf(state, question.id).status === 'answered'
  );
}

export function skippedFor(state: InterviewState, docKind: KnownDocKind): InterviewQuestion[] {
  return state.questions.filter(
    (question) => question.docKind === docKind && answerOf(state, question.id).status === 'skipped'
  );
}

/** True when nothing was declined anywhere — the "zero TODOs" case. */
export function nothingSkipped(state: InterviewState): boolean {
  return state.questions.every((question) => answerOf(state, question.id).status !== 'skipped');
}

/**
 * The human's answers for one document, as a prompt block.
 *
 * Headed by the heading each answer belongs to, because that is the only thing
 * telling the model *where* the sentence goes — and returns the empty string
 * when there is nothing, so the caller has no branch to get wrong.
 */
export function renderAnswersForPrompt(state: InterviewState, docKind: KnownDocKind): string {
  const answered = answeredFor(state, docKind);
  if (answered.length === 0) return '';
  const lines: string[] = [];
  for (const question of answered) {
    lines.push(`## ${question.heading}`, `Q: ${question.question}`, `A: ${answerOf(state, question.id).text}`, '');
  }
  return lines.join('\n').trimEnd();
}

/** The declines for one document, so the prompt can leave those headings empty. */
export function renderSkipsForPrompt(state: InterviewState, docKind: KnownDocKind): string {
  const skipped = skippedFor(state, docKind);
  if (skipped.length === 0) return '';
  return skipped.map((question) => `- ${question.heading}: ${question.question}`).join('\n');
}

// ── The TODO lines, written here ──────────────────────────────────────────────

/** One `> TODO:` line per skipped question, naming the question. */
export function skipTodoLines(state: InterviewState, docKind: KnownDocKind): string[] {
  return skippedFor(state, docKind).map(
    (question) => `${TODO_MARKER} ${question.question} — you skipped this when I asked.`
  );
}

/**
 * Put each skipped question's TODO under the heading it belongs to.
 *
 * Under the heading when the draft kept it, at the end when it did not — and
 * **never dropped**, which is the whole reason this is code. The drafting prompt
 * tells the model to keep a heading it has nothing to say about rather than
 * delete it, but a prompt is advice; a question the human explicitly declined
 * must survive a model that ignored it.
 *
 * Idempotent on its own output: a line already present is not added again, so a
 * re-draft of the same answers cannot accumulate duplicates.
 */
export function insertSkipTodos(content: string, state: InterviewState, docKind: KnownDocKind): string {
  const skipped = skippedFor(state, docKind);
  if (skipped.length === 0) return content;

  const lines = content.split('\n');
  const orphans: string[] = [];

  for (const question of skipped) {
    const todo = `${TODO_MARKER} ${question.question} — you skipped this when I asked.`;
    if (lines.some((line) => line.trim() === todo)) continue;

    const at = lines.findIndex((line) => /^##\s+/.test(line) && line.replace(/^##\s+/, '').trim() === question.heading);
    if (at === -1) {
      orphans.push(`## ${question.heading}`, '', todo, '');
      continue;
    }
    // Directly under the heading, before whatever prose the draft put there:
    // the decline is the most important thing about that section.
    lines.splice(at + 1, 0, '', todo);
  }

  const body = lines.join('\n');
  if (orphans.length === 0) return body;
  return `${body.replace(/\s*$/, '')}\n\n${orphans.join('\n').trimEnd()}\n`;
}

// ── The thread's record ───────────────────────────────────────────────────────

/**
 * The interview as thread activities — **the transcript, and only the transcript**.
 *
 * `question` has been a kind on `AuthoringActivity` since BLD-002 with nothing
 * producing one, and its collapse rule was decided there: never absorbed into a
 * run, because `isCollapsible` returns false for it. That rule stands and is
 * why these are `question` activities rather than `tool` lines — the one
 * exchange in this panel where the *user* supplied the content must not
 * disappear behind a "8 steps ▸" disclosure.
 *
 * ⚠️ **The open question is not here**, and that is a correction to how BLD-002
 * imagined this. Its reservation note calls `question` "the loudest thing in the
 * thread because it is the only activity that *blocks*" — true of a question,
 * but written when a question was assumed to be one line of text. The approved
 * mockup draws the live one as a **card**: an eyebrow, the question, why it is
 * being asked, the agent's guess in an inset box, and the three answers. A card
 * is not an activity, and rendering the text in both places is the duplicated
 * message this phase is measured on.
 *
 * So the split is: **the pending question is the card** (`InterviewCard`), and
 * this produces the settled ones — the record a person scrolls back through
 * weeks later to find out why a document says what it says. The `.Question`
 * treatment follows the same split; see `BuildThread.module.scss`.
 */
export function interviewActivities(state: InterviewState): TurnActivity[] {
  const activities: TurnActivity[] = [];
  for (const question of state.questions) {
    const answer = answerOf(state, question.id);
    if (answer.status === 'pending') continue;
    activities.push({
      kind: 'question',
      text:
        answer.status === 'answered'
          ? `${question.question}\nYou said: ${answer.text}`
          : `${question.question}\nSkipped — this becomes a TODO in ${REVIEW_DOC_PATHS[question.docKind]}.`
    });
  }
  return activities;
}
