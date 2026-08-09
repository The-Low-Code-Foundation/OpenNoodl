/**
 * BLD-004 — the model's reasoning, on its own channel.
 *
 * Reasoning was discarded for a reason that binds the *parser* and never needed
 * to bind the interface: the authoring templates parse the assistant's visible
 * text as XML, so reasoning must not enter it. There was no second channel, so
 * there was nothing to show even where showing it is safe. There is one now
 * (`AiStreamCallbacks.onReasoning`), and this is where it surfaces.
 *
 * ## Collapsed by default, and it stays that way
 *
 * The same rule BLD-002's runs follow, for the same reason: the default has to
 * be the state that is right twenty minutes into a build, not the one that is
 * tolerable for ten seconds. Reasoning is also the longest thing a turn
 * produces and the least often wanted — what a waiting user needs from it is
 * the *clock*, which is on the closed strip.
 *
 * ## Why the clock is derived, not counted
 *
 * `now - activity.at`, recomputed each render, exactly as `useElapsedClock`'s
 * header describes. A counter incremented on a tick would be wrong by however
 * long the sidebar had this panel hidden — and hidden is the normal state of a
 * panel during a long run.
 *
 * ## ⚠️ And why it stops on the deltas, not on the turn
 *
 * **Found by driving.** The first build ran the clock while `streaming` was set,
 * which sounds right and is not: `streaming` is cleared when the *turn* ends,
 * and a hung turn does not end until the deadline fires three minutes later. A
 * provider that thought for one second and then stopped answering showed
 * **"Thinking… 3m 2s"** — this task's own defect, a clock outliving the thing it
 * measures, reappearing inside the fix for it.
 *
 * So the upper bound is `lastAt`, moved by each delta. While deltas are arriving
 * the clock is live; once they stop it freezes at the last one and the label
 * changes tense, because what it now reports is a finished duration.
 *
 * @module noodl-editor/views/panels/AiAuthoringPanel/thread/ReasoningStrip
 */

import React, { useRef, useState } from 'react';

import { ALIVE_MS, formatDuration } from '@noodl-models/AiAssistant/thread';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { useElapsedClock } from './useElapsedClock';
import css from './ReasoningStrip.module.scss';

export interface ReasoningStripProps {
  text: string;
  /** True until the turn ends. Not the clock's authority — see the module header. */
  streaming?: boolean;
  /** When the first reasoning delta landed. Absent from a producer with no clock. */
  at?: number;
  /** When the most recent one did. The clock's upper bound once they stop. */
  lastAt?: number;
}

export function ReasoningStrip({ text, streaming, at, lastAt }: ReasoningStripProps) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = useElapsedClock(Boolean(streaming), ref);

  // Deltas count as recent by the same measure the heartbeat's pulse uses —
  // one constant, so the strip and the dot cannot disagree about whether the
  // model is currently thinking.
  const thinking = streaming && lastAt !== undefined && now - lastAt < ALIVE_MS;

  // Absent `at`, there is no elapsed time to report and the strip says so by
  // saying nothing — the same rule as the collapsed run's duration in
  // `messages.ts`. `formatDuration` rather than a local `m:ss`, because the
  // panel already has one author for durations and two would drift.
  const spanEnd = thinking ? now : lastAt;
  const elapsed =
    at !== undefined && spanEnd !== undefined ? formatDuration(Math.max(0, spanEnd - at)) : undefined;

  return (
    <div className={css['Reasoning']} ref={ref}>
      <button
        type="button"
        className={css['Toggle']}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={`${css['Caret']} ${expanded ? css['is-expanded'] : ''}`}>
          <Icon icon={IconName.CaretRight} size={IconSize.Small} />
        </span>
        {/*
          Present tense only while it is true. Once the deltas stop this is a
          finished duration and says so — "Thinking…" against a frozen number is
          how the same lie gets back in through the wording after the arithmetic
          has been fixed.
        */}
        <Text textType={TextType.Shy}>
          {elapsed === undefined ? 'Thought about this' : thinking ? `Thinking… ${elapsed}` : `Thought for ${elapsed}`}
        </Text>
      </button>
      {expanded && (
        <div className={css['Body']}>
          <Text textType={TextType.Shy}>{text}</Text>
        </div>
      )}
    </div>
  );
}
