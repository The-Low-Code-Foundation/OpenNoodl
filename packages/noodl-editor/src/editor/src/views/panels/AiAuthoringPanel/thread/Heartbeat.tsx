/**
 * BLD-004 — the one element that distinguishes thinking from stopped.
 *
 * `onActivity` has fired once per provider event since AIB-009 — pings,
 * keepalives, and the reasoning deltas the client used to drop — and its only
 * consumer was the turn deadline. The user, staring at a static wand and
 * deciding whether to kill a twelve-minute run, was never told.
 *
 * ## What this may claim, and what decides it
 *
 * Nothing here. `models/AiAssistant/thread/liveness.ts` owns the rule, for the
 * reason its header gives: a pulsing dot is the same pixels whether the last
 * event landed 200ms ago or four minutes ago, so the decision has to be gradable
 * without a screenshot. This component renders four states and adds no opinion.
 *
 * ## Two clocks, on purpose
 *
 * The **motion** is a finite CSS animation restarted by the `key` below, so it
 * expires on its own `ALIVE_MS` after the last event with nothing having to
 * notice — see the stylesheet's header for why a class-toggled infinite loop is
 * the defect rather than the fix. The **words** need a poll, because "nothing has
 * arrived for 45 seconds" is a fact whose arrival is precisely the absence of an
 * event to render on.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/Heartbeat
 */

import React, { useRef } from 'react';

import { liveness } from '@noodl-models/AiAssistant/thread';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { useElapsedClock } from './useElapsedClock';
import css from './Heartbeat.module.scss';

export interface HeartbeatProps {
  /** Whether a turn is open at all. */
  busy: boolean;
  /** When the last provider event landed, from the session's published state. */
  lastActivityAt?: number;
  /** The session's silence deadline, so the sentence can name it. */
  stallMs?: number;
}

/**
 * The moving half on its own, for callers that already say what is happening.
 *
 * The run header's current-operation row is one: it names the component and the
 * attempt, so a second "Working…" beside it would be the same fact twice. It
 * needs the *motion*, and motion is the half that must not be reimplemented —
 * see the stylesheet on why the `key` is load-bearing.
 */
export function HeartbeatDot({
  state,
  lastActivityAt
}: {
  state: ReturnType<typeof liveness>['state'];
  lastActivityAt?: number;
}) {
  if (state === 'idle') return null;
  return (
    <span
      key={lastActivityAt ?? 'none'}
      className={`${css['Dot']} ${state === 'alive' ? css['DotBeating'] : ''} ${
        state === 'silent' ? css['DotSilent'] : ''
      }`}
    />
  );
}

export function Heartbeat({ busy, lastActivityAt, stallMs }: HeartbeatProps) {
  // Unconditional, so the early return is below it. Ticks only while a turn is
  // open and only while the panel is on screen — the sidebar hides rather than
  // unmounts, and an occluded Electron window clamps timers roughly 1000x.
  const ref = useRef<HTMLDivElement>(null);
  const now = useElapsedClock(busy, ref);

  const { state, note } = liveness({ busy, lastActivityAt, now, stallMs });
  if (state === 'idle') return null;

  return (
    <div className={`${css['Heartbeat']} ${css[`is-${state}`]}`} ref={ref}>
      <HeartbeatDot state={state} lastActivityAt={lastActivityAt} />
      {state === 'silent' ? (
        <Text textType={TextType.Default} className={css['Silent']}>
          {note}
        </Text>
      ) : (
        // Unchanged wording from BLD-001, and deliberately: while events are
        // arriving normally the honest claim is still only that a turn is open.
        // The dot carries the liveness; the sentence must not also assert it.
        <Text textType={TextType.Shy}>Working…</Text>
      )}
    </div>
  );
}
