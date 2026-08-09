/**
 * BLD-005 — where the run is, always on screen.
 *
 * ## The premise this task nearly shipped with was wrong
 *
 * Richard's report — *"it's hard to know if it's stuck, thinking, which
 * component it's currently building"* — reads as "there is no progress
 * reporting". **There is.** AIB-002 built the position, the elapsed clock, the
 * cumulative cost, a row per operation with its own clock, and cost formatting
 * that refuses to print `$0.00` for unknown pricing.
 *
 * It felt like nothing because **it rendered inside the scroll area**. Thirty
 * seconds into a seven-operation run the one element answering *"where am I"*
 * had scrolled off, and what remained was a column of identical wand glyphs. So
 * this component is placement and one honest number, not a new instrumentation
 * layer — and it mounts in the header row `BuildThread` has kept free since
 * BLD-001.
 *
 * ## What it may say
 *
 * Nothing here decides that. Position, the estimate rule and the phrasing all
 * come from `models/AiAssistant/thread/runProgress.ts`, because an estimate
 * extrapolated from one sample is the same pixels as one from five — see that
 * module's header.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/RunHeader
 */

import React, { useRef } from 'react';

import type { PlanRunState } from '@noodl-models/AiAssistant/authoring';
import { authoringDetail, liveness, runHeadline } from '@noodl-models/AiAssistant/thread';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { Heartbeat, HeartbeatDot } from './Heartbeat';
import { useElapsedClock } from './useElapsedClock';
import css from './RunHeader.module.scss';

export interface RunHeaderProps {
  /** The live run, or null when nothing is running. */
  state: PlanRunState | null;
}

export function RunHeader({ state }: RunHeaderProps) {
  // The clock has to be called unconditionally — so the early return is below
  // it, not above. It ticks only while the run is busy and only while the panel
  // is on screen; `ref` is what tells it the sidebar has hidden us.
  const ref = useRef<HTMLDivElement>(null);
  const now = useElapsedClock(Boolean(state?.busy), ref);

  if (!state) return null;

  const current = state.operations.find((operation) => operation.status === 'authoring');
  // Promoted from the operation's own row, where it also still renders. One
  // sentence, one author — see `authoringDetail`.
  const detail = current ? authoringDetail(current.session) : undefined;

  /*
   * BLD-004 closes R2. The current row moves only while the *stream* is moving —
   * `liveness` reads the session's `lastActivityAt`, never `state.busy`, which
   * stays true for the whole three-minute stall window and would therefore
   * animate hardest at exactly the moment the provider had hung. That is the
   * failure BLD-005's correction 2 exists to fix, and it is why this component
   * shipped with accent and weight and deliberately no motion until now.
   */
  const session = current?.session;
  const beat = liveness({
    busy: Boolean(session?.busy),
    lastActivityAt: session?.lastActivityAt,
    now,
    stallMs: session?.stallMs
  });

  return (
    <div className={css['RunHeader']} ref={ref}>
      <Text textType={TextType.Proud}>{runHeadline(state, now)}</Text>
      {current && (
        <div className={`${css['Current']} ${css[`is-${beat.state}`]}`}>
          <HeartbeatDot state={beat.state} lastActivityAt={session?.lastActivityAt} />
          <Text textType={TextType.Default} className={css['CurrentTarget']}>
            {current.operation.target}
          </Text>
          {detail && <Text textType={TextType.Shy}>{detail}</Text>}
        </div>
      )}
      {/*
        The words half. It renders only in the state that has any — a run whose
        stream has gone quiet says so here, above the fold, rather than in the
        turn list that has long since scrolled past.
      */}
      {beat.state === 'silent' && (
        <Heartbeat busy lastActivityAt={session?.lastActivityAt} stallMs={session?.stallMs} />
      )}
    </div>
  );
}
