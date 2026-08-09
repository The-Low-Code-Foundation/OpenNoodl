/**
 * BLD-001 — the Build panel is one thread.
 *
 * Header, scrolling turn list, composer — in every state. **Nothing at this
 * level is conditional**, which is the whole point: the panel used to switch
 * whole subtrees on a segmented control, so each of the three had its own start
 * button, its own stop button and its own idea of what "empty" looks like. Here
 * there is one of each, and a state is a difference in what the turn list
 * contains, never a difference in what the panel is.
 *
 * ## `width` exists so BLD-009 has nothing to reimplement
 *
 * The expanded document renders this same component with `width="expanded"`.
 * One implementation, two hosts, per the phase's standing constraint — a second
 * implementation is a thing that drifts, and the acceptance pass (BLD-010)
 * measures both widths against the same mocked states.
 *
 * ## What is deliberately not here
 *
 * The pinned run header is BLD-005. Decisions attached to outcome cards are
 * BLD-003, and live in the host through `renderOutcome`.
 *
 * ## BLD-002 — the five treatments, and where they are
 *
 * Message treatment landed here: five kinds, five sizes. The *sizes* are in the
 * stylesheet (see its header for why they are local rather than on `Text`), and
 * the decision about **what may be collapsed** is in
 * `models/AiAssistant/thread/messages.ts` — pure, because a run that silently
 * swallowed a failed submission would look exactly like one with nothing to
 * hide. `ActivityRun` below renders that answer and does not second-guess it.
 *
 * Only one colour moved: the user's own message. Everything else keeps its
 * token, because measured on the real surfaces nothing here failed AA — the
 * legibility problem was type scale, not contrast (README correction 1, now
 * confirmed live rather than inferred).
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/BuildThread
 */

import React, { useEffect, useRef, useState } from 'react';

import type { AuthoringActivity } from '@noodl-models/AiAssistant/authoring';
import { collapseActivities } from '@noodl-models/AiAssistant/thread';
import type { Turn, TurnActivity, TurnOutcome } from '@noodl-models/AiAssistant/thread';

import { FeedbackType } from '@noodl-constants/FeedbackType';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import css from './BuildThread.module.scss';

export type ThreadWidth = 'panel' | 'expanded';

/**
 * One entry in a turn's feed.
 *
 * Lifted from `AiAuthoringPanel` unchanged — `ProjectAuthoringView` renders it
 * too, and a second copy would be the drift the phase's "one implementation"
 * constraint exists to prevent.
 */
export function ActivityRow({ activity }: { activity: AuthoringActivity }) {
  switch (activity.kind) {
    case 'user':
      return (
        <div className={css['User']}>
          <Text textType={TextType.Default}>{activity.text}</Text>
        </div>
      );
    case 'assistant':
      return (
        <div className={css['Assistant']}>
          <Text textType={TextType.Default}>
            {activity.text}
            {activity.streaming ? '…' : ''}
          </Text>
        </div>
      );
    case 'tool':
      return (
        <div className={css['Event']}>
          <Icon icon={IconName.File} size={IconSize.Small} />
          <Text textType={TextType.Shy}>{activity.label}</Text>
        </div>
      );
    case 'question':
      // BLD-008 produces these; the treatment is decided here so that task adds
      // an author rather than a fifth opinion about how a question should look.
      return (
        <div className={css['Question']}>
          <Text textType={TextType.Default}>{activity.text}</Text>
        </div>
      );
    case 'submit':
      return activity.ok ? (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Default}>Submitted — passed validation.</Text>
        </div>
      ) : (
        <VStack UNSAFE_style={{ gap: 2 }}>
          <div className={css['Event']}>
            <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
            <Text textType={TextType.Default}>
              Submitted — rejected with {activity.errorLines.length} problem
              {activity.errorLines.length === 1 ? '' : 's'}. Repairing…
            </Text>
          </div>
          {activity.errorLines.slice(0, 3).map((line, index) => (
            <Text key={index} textType={TextType.Shy}>
              {line}
            </Text>
          ))}
          {activity.errorLines.length > 3 && (
            <Text textType={TextType.Shy}>… {activity.errorLines.length - 3} more</Text>
          )}
        </VStack>
      );
  }
}

/**
 * A span of context reads and passing validations, as one line.
 *
 * This is where D4's twenty-minute build stops being unreadable: a seven-
 * operation run pushes hundreds of "Read node documentation" lines through the
 * feed at the same size as the sentences that matter. What may and may not be
 * inside one is decided by `collapseActivities` — a failed submission never is
 * — and this component only renders the answer.
 *
 * Collapsed by default and expandable, never the reverse: the default has to be
 * the state that is right after twenty minutes, not the one that is tolerable
 * after ten seconds.
 */
function ActivityRun({ activities, summary }: { activities: readonly TurnActivity[]; summary: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <VStack UNSAFE_style={{ gap: 4 }}>
      <button
        type="button"
        className={css['Run']}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={`${css['RunCaret']} ${expanded ? css['is-expanded'] : ''}`}>
          <Icon icon={IconName.CaretRight} size={IconSize.Small} />
        </span>
        <Text textType={TextType.Shy}>{summary}</Text>
      </button>
      {expanded && (
        <div className={css['RunItems']}>
          {activities.map((activity, index) => (
            <ActivityRow key={index} activity={activity} />
          ))}
        </div>
      )}
    </VStack>
  );
}

/**
 * The fallback rendering of an outcome — what a turn says once it is history.
 *
 * The live turn's outcome is rendered by the host through `renderOutcome`,
 * because the decisions on it need the session objects. This is what the same
 * outcome looks like after the session is gone, and it is the half D5 deleted:
 * scrolling up past an accept used to find nothing, because accepting called
 * `setState(null)`.
 */
function OutcomeSummary({ outcome }: { outcome: TurnOutcome }) {
  switch (outcome.kind) {
    case 'staged-component':
      return (
        <Text textType={TextType.Default}>
          Staged: {outcome.legacyName} — {outcome.nodeCount} node{outcome.nodeCount === 1 ? '' : 's'},{' '}
          {outcome.connectionCount} connection{outcome.connectionCount === 1 ? '' : 's'}.{' '}
          {outcome.mode === 'update' ? 'Your component is untouched until you accept.' : 'Nothing is in your project yet.'}
        </Text>
      );
    case 'accepted-component':
      return (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Default}>
            {outcome.mode === 'update'
              ? `Updated ${outcome.legacyName} — one undo restores the previous version.`
              : `Added ${outcome.legacyName} to your project — undo removes it.`}
          </Text>
        </div>
      );
    case 'plan':
      return (
        <Text textType={TextType.Default}>
          A plan of {outcome.plan.operationCount} operation{outcome.plan.operationCount === 1 ? '' : 's'}:{' '}
          {outcome.plan.targets.join(', ')}.
        </Text>
      );
    case 'plan-applied':
      return (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Default}>
            Applied — {outcome.componentCount} component{outcome.componentCount === 1 ? '' : 's'} changed
            {outcome.docs.length > 0 ? `, ${outcome.docs.join(' and ')} written` : ''}
            {outcome.backendName ? `, backend "${outcome.backendName}" running` : ''}.
          </Text>
        </div>
      );
    case 'docs-drafts':
      return (
        <Text textType={TextType.Default}>
          Drafted {outcome.authored} document{outcome.authored === 1 ? '' : 's'}
          {outcome.declined > 0 ? `, left ${outcome.declined} alone` : ''}
          {outcome.errors > 0 ? `, ${outcome.errors} failed` : ''}.
        </Text>
      );
    case 'note':
      return (
        <div className={css['Event']}>
          <Icon
            icon={outcome.tone === 'danger' ? IconName.WarningCircleFilled : IconName.WarningTriangle}
            variant={outcome.tone === 'danger' ? FeedbackType.Danger : FeedbackType.Notice}
            size={IconSize.Small}
          />
          <Text textType={TextType.Default}>{outcome.text}</Text>
        </div>
      );
  }
}

export interface BuildThreadProps {
  /** One implementation, two hosts. `panel` is the 400px sidebar. */
  width?: ThreadWidth;
  turns: readonly Turn[];

  /**
   * The rich card for a turn's outcome, when the host has one.
   *
   * Returning `undefined` falls back to {@link OutcomeSummary} — which is what
   * every turn but the live one gets, because the decisions on an outcome need
   * a session that no longer exists once the turn is history.
   */
  renderOutcome?: (turn: Turn) => React.ReactNode | undefined;

  /** Shown above the turn list, in the header. The experimental flag lives here. */
  header?: React.ReactNode;
  /**
   * BLD-005 — pinned between the header and the scroll area, for as long as a
   * run is live.
   *
   * A separate slot rather than more `header`, because the two have opposite
   * lifetimes: `header` is chrome that is always there (and BLD-006's thread
   * switcher will want it), while this exists only while something is running.
   * Folding them together would mean the caller re-deciding, on every render,
   * which half of one node is currently allowed to exist.
   */
  runHeader?: React.ReactNode;
  /** Shown in place of the turn list when there are no turns. */
  emptyState?: React.ReactNode;

  // ── Composer ───────────────────────────────────────────────────────────────
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  /** False disables Send and Enter alike — one rule, not two that can disagree. */
  canSend: boolean;
  placeholder?: string;
  sendLabel?: string;
  /** A run is in flight. The composer stays; Send becomes Stop. */
  busy?: boolean;
  onStop?: () => void;
}

export function BuildThread({
  width = 'panel',
  turns,
  renderOutcome,
  header,
  runHeader,
  emptyState,
  value,
  onChange,
  onSend,
  canSend,
  placeholder,
  sendLabel = 'Send',
  busy,
  onStop
}: BuildThreadProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);

  // Follow the stream, but only while the user is already near the bottom —
  // same rule as the Explain panel, same reason: scrolling up to read something
  // must not be undone by the next token.
  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : undefined;
  const tailLength = lastTurn ? lastTurn.activities.length : 0;
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !busy) return;

    let scroller: HTMLElement | null = anchor.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
      scroller = scroller.parentElement;
    }
    if (!scroller) return;

    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (distanceFromBottom < 80) anchor.scrollIntoView({ block: 'end' });
  }, [tailLength, turns.length, busy]);

  return (
    <div className={`${css['Thread']} ${css[width === 'expanded' ? 'is-expanded' : 'is-panel']}`}>
      {header && <div className={css['Header']}>{header}</div>}
      {/*
        BLD-005. Outside the `ScrollArea` on purpose — that placement IS the fix,
        and putting it one element lower would restore the defect exactly.

        Rendered bare, with no wrapper of its own: the node passed here is a
        component that renders `null` when no run is live, so a wrapper would be
        truthy whenever the *element* existed rather than whenever it drew
        anything, and would leave an empty box above every idle thread.
      */}
      {runHeader}

      <ScrollArea UNSAFE_className={css['Body']}>
        <div className={css['Turns']}>
          {turns.length === 0 && emptyState}
          {turns.map((turn) => {
            const rich = renderOutcome?.(turn);
            return (
              <div key={turn.id} className={css['Turn']}>
                {turn.request !== undefined && (
                  <div className={css['User']}>
                    <Text textType={TextType.Default}>{turn.request}</Text>
                  </div>
                )}
                {/*
                 * Once per turn, not once per paragraph. The alignment already
                 * says who is speaking — the request is a bubble on the right —
                 * so a repeated label would cost a line per message to restate
                 * what the layout has said, at the width where lines are
                 * scarcest.
                 */}
                {turn.activities.length > 0 && <div className={css['Speaker']}>Assistant</div>}
                {collapseActivities(turn.activities).map((item) =>
                  item.kind === 'run' ? (
                    <ActivityRun key={`run-${item.startIndex}`} activities={item.activities} summary={item.summary} />
                  ) : (
                    <ActivityRow key={item.index} activity={item.activity} />
                  )
                )}
                {turn.busy && (
                  <div className={css['Event']}>
                    {/* BLD-004 makes this a heartbeat driven by `onActivity`.
                        Until it is, it says only what is certainly true: a turn
                        is open. Rule 5 — never claim progress you cannot
                        evidence. */}
                    <Text textType={TextType.Shy}>Working…</Text>
                  </div>
                )}
                {rich !== undefined ? rich : turn.outcome && <OutcomeSummary outcome={turn.outcome} />}
              </div>
            );
          })}
          <div ref={anchorRef} />
        </div>
      </ScrollArea>

      <div className={css['Composer']}>
        <VStack UNSAFE_style={{ gap: 8 }}>
          <TextArea
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            /*
             * ⚠️ `TextArea.onEnter` is **Shift+Enter**
             * ([TextArea.tsx:96](../../../../../../../noodl-core-ui/src/components/inputs/TextArea/TextArea.tsx)
             * — `ev.shiftKey && ev.key === 'Enter'`). `TextInput.onEnter` is
             * **plain Enter**. They are different keystrokes behind one prop
             * name, and the refine field below is a `TextInput`, so the two
             * composers on this panel do not answer to the same key.
             *
             * Shift+Enter is nonetheless right *here*: this composer is
             * multi-line by design — a request spanning four components is a
             * paragraph — and plain Enter must insert a newline. The old
             * description field was a `TextArea` with no `onEnter` at all, so
             * nothing regresses either way.
             *
             * Guarded by exactly the condition that disables the button, so the
             * two cannot disagree. A dropped or mismatched binding here is
             * invisible to `tsc` (`onEnter` is optional) and to every spec in
             * this task — they grade the pure model, which has no keyboard.
             * BLD-010 drives it.
             */
            onEnter={() => {
              if (busy || !canSend) return;
              onSend();
            }}
          />
          <HStack UNSAFE_style={{ gap: 8 }}>
            {busy ? (
              <PrimaryButton label="Stop" variant={PrimaryButtonVariant.Ghost} isGrowing onClick={onStop} />
            ) : (
              <PrimaryButton
                label={sendLabel}
                icon={IconName.MagicWand}
                isDisabled={!canSend}
                isGrowing
                onClick={onSend}
              />
            )}
          </HStack>
        </VStack>
      </div>
    </div>
  );
}
