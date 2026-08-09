/**
 * BLD-008 — answering, in the thread.
 *
 * ## The card is the open question; the thread is the record
 *
 * This draws the **whole** open question — the mockup's `.qcard`: an eyebrow,
 * the question, why it is being asked, the agent's guess in an inset well, and
 * the three answers in a footer band. `docsTurns` writes only the **settled**
 * exchanges into the feed, so the text is on screen exactly once, which is
 * BLD-003's rule that a decision appears in one place and this phase's whole
 * measure.
 *
 * ⚠️ The first cut of this task split them the other way — the question as a
 * `question` activity, the controls in a bare box beneath. It kept the
 * no-duplication property and lost the mockup, which draws one card because a
 * question, its evidence and its answers are one decision. Two stacked boxes
 * read as two things to deal with.
 *
 * ## Why "That's right" is a button and not a checkbox
 *
 * The economics of the retrofit are that correcting is cheaper than composing.
 * The guess is therefore the default answer and accepting it is one click — no
 * field to focus, nothing to read twice. "Let me rewrite it" is what opens the
 * editor, pre-filled with the guess, because a user who disagrees with one
 * clause should start from the sentence rather than from an empty box.
 *
 * ⚠️ And "Skip" is a first-class answer with a stated consequence, not an
 * escape hatch. It is what makes a TODO mean something: after this task a TODO
 * says *the human declined to say*, and one appears for every skip, written by
 * `insertSkipTodos` rather than by the model. The button says so, because a
 * decline whose cost is invisible is a decline people make by accident.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/InterviewCard
 */

import React, { useEffect, useRef, useState } from 'react';

import {
  currentQuestion,
  interviewProgress,
  isInterviewComplete,
  type InterviewState
} from '@noodl-models/AiAssistant/review';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './InterviewCard.module.scss';

export interface InterviewCardProps {
  interview: InterviewState;
  /** Why the questions are in their plain phrasing, when they are. */
  note?: string;
  onAnswer: (id: string, text: string) => void;
  onSkip: (id: string) => void;
  onReopen: (id: string) => void;
  onDecideProposal: (accepted: boolean) => void;
  /** Start drafting. Absent while anything is still open. */
  onDraft?: () => void;
  /** True while the drafting run is going — the interview becomes a record. */
  isDrafting?: boolean;
}

export function InterviewCard({
  interview,
  note,
  onAnswer,
  onSkip,
  onReopen,
  onDecideProposal,
  onDraft,
  isDrafting
}: InterviewCardProps) {
  const question = currentQuestion(interview);
  const progress = interviewProgress(interview);
  const complete = isInterviewComplete(interview);

  /**
   * The editor, open only when the user asked for it.
   *
   * Keyed on the question id so moving to the next question closes it — without
   * that, question 4's answer would open pre-filled with question 3's text still
   * in the box, which is the sort of thing that gets accepted by someone
   * clicking through.
   */
  const [editing, setEditing] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  useEffect(() => {
    setEditing(null);
    setDraftAnswer('');
  }, [question?.id]);

  /**
   * Put the open question on screen.
   *
   * ⚠️ Measured, not assumed. Driving the interview at the shipped 400px panel:
   * the questions arrive and the thread sits at `scrollTop: 26` of a possible
   * `547`, showing the eyebrow and the first line — `why`, the guess and all
   * three answer buttons below the fold, with nothing saying a decision is
   * waiting 500px down. The one card in this panel that *blocks* was the one
   * thing you had to go looking for.
   *
   * The cause is two correct decisions meeting. `BuildThread` follows the tail
   * only while a turn is `busy` — right, because scrolling up to read must not
   * be undone by the next token — and `docsTurns` deliberately marks the
   * interviewing phase **neither busy nor finished**, because it is waiting on
   * a person. So the sole blocking state is the sole state the follow rule
   * declines to follow. The phase's recurring shape again: a rule that was
   * right about its old subject.
   *
   * It is fixed *here* rather than in `BuildThread` because only this component
   * knows which element is the question. `block: 'start'` and not the thread's
   * `'end'`: the card is **501px tall in a 419px viewport** at 400px (877px at
   * 248px — it does not fit at any width this panel ships at), so anchoring the
   * bottom would scroll the question itself off the top and leave three buttons
   * with nothing above them. The top is the half you must read.
   *
   * Keyed on the question id, so it fires once per question rather than on
   * every re-render, and re-running on remount is deliberate: coming back to
   * the panel should land on the thing that is waiting for you.
   */
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!question || isDrafting) return;
    cardRef.current?.scrollIntoView({ block: 'start' });
  }, [question?.id, isDrafting]);

  if (interview.questions.length === 0) return null;

  return (
    <VStack UNSAFE_style={{ gap: 10 }}>
      {note && (
        <HStack UNSAFE_style={{ height: 'auto', alignItems: 'flex-start', gap: 6 }}>
          <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
          <Text textType={TextType.Shy}>{note}</Text>
        </HStack>
      )}

      {/* Answered and declined questions are already in the thread above, with
          what was said to them. This counts, so the length of the sit-down is
          visible from the first question rather than discovered at the fourth. */}
      {!complete && (
        <Text textType={TextType.Shy}>
          Question {progress.answered + progress.skipped + 1} of {progress.total} — I'll draft from your answers.
        </Text>
      )}

      {question && !isDrafting && (
        <div className={css['QCard']} ref={cardRef}>
          <div className={css['QTop']}>
            <span className={css['Tag']}>Question</span>
            <div className={css['Text']}>
              <Text textType={TextType.Default}>{question.question}</Text>
            </div>
            {question.why && (
              <div className={css['Why']}>
                <Text textType={TextType.Default}>{question.why}</Text>
              </div>
            )}
            {question.guess ? (
              <div className={css['Guess']}>
                <span className={css['GuessLabel']}>My guess</span>
                <Text textType={TextType.Default}>{question.guess}</Text>
              </div>
            ) : (
              <div className={css['Why']}>
                <Text textType={TextType.Default}>
                  I have no guess for this one — it has to come from you.
                </Text>
              </div>
            )}
          </div>

          {editing === question.id || !question.guess ? (
            <div className={css['Editor']}>
              <TextArea
                value={draftAnswer}
                placeholder="Your answer…"
                onChange={(event) => setDraftAnswer(event.target.value)}
              />
              <HStack UNSAFE_style={{ height: 'auto', gap: 7, flexWrap: 'wrap' }}>
                <PrimaryButton
                  label="Use this"
                  size={PrimaryButtonSize.Small}
                  icon={IconName.Check}
                  isDisabled={!draftAnswer.trim()}
                  isFitContent
                  onClick={() => onAnswer(question.id, draftAnswer)}
                />
                <PrimaryButton
                  label="Skip — this becomes a TODO"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Ghost}
                  isFitContent
                  onClick={() => onSkip(question.id)}
                />
              </HStack>
            </div>
          ) : (
            <div className={css['Actions']}>
              <PrimaryButton
                label="That's right"
                size={PrimaryButtonSize.Small}
                icon={IconName.Check}
                isFitContent
                onClick={() => onAnswer(question.id, question.guess)}
              />
              <PrimaryButton
                label="Let me rewrite it"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Ghost}
                isFitContent
                onClick={() => {
                  // Pre-filled with the guess: correcting a clause beats
                  // retyping a sentence, which is the whole trade this task makes.
                  setDraftAnswer(question.guess);
                  setEditing(question.id);
                }}
              />
              <PrimaryButton
                label="Skip — this becomes a TODO"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Ghost}
                isFitContent
                onClick={() => onSkip(question.id)}
              />
            </div>
          )}
        </div>
      )}

      {/* The fourth document — BLD-007 is what makes this worth offering, and
          the injection mode is stated because `always` is a real per-turn cost
          on every build in this project, not a preference. */}
      {!question && interview.proposedDoc && interview.proposalAccepted === undefined && !isDrafting && (
        <div className={css['Proposal']}>
          <Text textType={TextType.Default}>
            One more thing — shall I write {interview.proposedDoc.path} as well?
          </Text>
          <Text textType={TextType.Shy}>{interview.proposedDoc.why}</Text>
          <Text textType={TextType.Shy}>
            {interview.proposedDoc.inject === 'always'
              ? 'It would be sent with every build in this project, so it costs a little on every turn.'
              : "I'd fetch it when a build looks related, so it costs nothing the rest of the time."}
          </Text>
          <HStack UNSAFE_style={{ height: 'auto', gap: 8, flexWrap: 'wrap' }}>
            <PrimaryButton
              label="Yes, draft it"
              size={PrimaryButtonSize.Small}
              icon={IconName.Check}
              isFitContent
              onClick={() => onDecideProposal(true)}
            />
            <PrimaryButton
              label="No thanks"
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Ghost}
              isFitContent
              onClick={() => onDecideProposal(false)}
            />
          </HStack>
        </div>
      )}

      {complete && !isDrafting && (
        <VStack UNSAFE_style={{ gap: 8 }}>
          <Text textType={TextType.Default}>
            {progress.skipped === 0
              ? `All ${progress.total} answered — the drafts will have nothing left for you to confirm.`
              : `${progress.answered} answered, ${progress.skipped} skipped — each skip becomes one TODO naming the question.`}
          </Text>
          {/* Nothing runs on its own here: the same rule the review banner has
              had since AIX-010. The interview finishing is not a request to
              spend a minute of provider time. */}
          <PrimaryButton
            label="Draft the documents"
            icon={IconName.MagicWand}
            isDisabled={!onDraft}
            isGrowing
            onClick={() => onDraft?.()}
          />
          {/* Answers are still editable up to this point — the thread above
              shows what was said, and this is how a user gets back to one. */}
          <HStack UNSAFE_style={{ height: 'auto', gap: 8, flexWrap: 'wrap' }}>
            {interview.questions.map((entry) => (
              <PrimaryButton
                key={entry.id}
                label={`Change: ${entry.heading}`}
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Ghost}
                isFitContent
                onClick={() => onReopen(entry.id)}
              />
            ))}
          </HStack>
        </VStack>
      )}

      {isDrafting && (
        <div className={css['Settled']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Shy}>
            Writing from {progress.answered} answer{progress.answered === 1 ? '' : 's'}
            {progress.skipped > 0
              ? ` and ${progress.skipped} skipped question${progress.skipped === 1 ? '' : 's'}`
              : ''}
            .
          </Text>
        </div>
      )}
    </VStack>
  );
}

/** Whether this state has anything for the card to draw. */
export function hasInterview(interview: InterviewState | undefined): interview is InterviewState {
  return Boolean(interview && interview.questions.length > 0);
}
