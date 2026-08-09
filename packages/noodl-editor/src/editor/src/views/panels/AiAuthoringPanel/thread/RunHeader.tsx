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
import { authoringDetail, runHeadline } from '@noodl-models/AiAssistant/thread';

import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

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

  return (
    <div className={css['RunHeader']} ref={ref}>
      <Text textType={TextType.Proud}>{runHeadline(state, now)}</Text>
      {current && (
        <div className={css['Current']}>
          <Text textType={TextType.Default} className={css['CurrentTarget']}>
            {current.operation.target}
          </Text>
          {detail && <Text textType={TextType.Shy}>{detail}</Text>}
        </div>
      )}
    </div>
  );
}
