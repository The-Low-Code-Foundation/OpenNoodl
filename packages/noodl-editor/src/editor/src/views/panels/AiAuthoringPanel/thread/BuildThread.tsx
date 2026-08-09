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
 * Message *treatment* (five kinds, five weights) is BLD-002; decisions attached
 * to outcome cards are BLD-003; the pinned run header is BLD-005. This task
 * renders the existing treatments in the new frame, so that those three have a
 * frame to change. Reaching for a colour token here would be wrong twice: the
 * legibility problem is type scale, not contrast (README correction 1), and it
 * is not this task's.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/BuildThread
 */

import React, { useEffect, useRef } from 'react';

import type { AuthoringActivity } from '@noodl-models/AiAssistant/authoring';
import type { Turn, TurnOutcome } from '@noodl-models/AiAssistant/thread';

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
          <Text textType={TextType.Secondary}>{activity.text}</Text>
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
    case 'submit':
      return activity.ok ? (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Secondary}>Submitted — passed validation.</Text>
        </div>
      ) : (
        <VStack UNSAFE_style={{ gap: 2 }}>
          <div className={css['Event']}>
            <Icon icon={IconName.WarningTriangle} variant={FeedbackType.Notice} size={IconSize.Small} />
            <Text textType={TextType.Secondary}>
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
        <Text textType={TextType.Secondary}>
          Staged: {outcome.legacyName} — {outcome.nodeCount} node{outcome.nodeCount === 1 ? '' : 's'},{' '}
          {outcome.connectionCount} connection{outcome.connectionCount === 1 ? '' : 's'}.{' '}
          {outcome.mode === 'update' ? 'Your component is untouched until you accept.' : 'Nothing is in your project yet.'}
        </Text>
      );
    case 'accepted-component':
      return (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Secondary}>
            {outcome.mode === 'update'
              ? `Updated ${outcome.legacyName} — one undo restores the previous version.`
              : `Added ${outcome.legacyName} to your project — undo removes it.`}
          </Text>
        </div>
      );
    case 'plan':
      return (
        <Text textType={TextType.Secondary}>
          A plan of {outcome.plan.operationCount} operation{outcome.plan.operationCount === 1 ? '' : 's'}:{' '}
          {outcome.plan.targets.join(', ')}.
        </Text>
      );
    case 'plan-applied':
      return (
        <div className={css['Event']}>
          <Icon icon={IconName.Check} variant={FeedbackType.Success} size={IconSize.Small} />
          <Text textType={TextType.Secondary}>
            Applied — {outcome.componentCount} component{outcome.componentCount === 1 ? '' : 's'} changed
            {outcome.docs.length > 0 ? `, ${outcome.docs.join(' and ')} written` : ''}
            {outcome.backendName ? `, backend "${outcome.backendName}" running` : ''}.
          </Text>
        </div>
      );
    case 'docs-drafts':
      return (
        <Text textType={TextType.Secondary}>
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
          <Text textType={TextType.Secondary}>{outcome.text}</Text>
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

      <ScrollArea UNSAFE_className={css['Body']}>
        <div className={css['Turns']}>
          {turns.length === 0 && emptyState}
          {turns.map((turn) => {
            const rich = renderOutcome?.(turn);
            return (
              <div key={turn.id} className={css['Turn']}>
                {turn.request !== undefined && (
                  <div className={css['User']}>
                    <Text textType={TextType.Secondary}>{turn.request}</Text>
                  </div>
                )}
                {turn.activities.map((activity, index) => (
                  <ActivityRow key={index} activity={activity} />
                ))}
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
