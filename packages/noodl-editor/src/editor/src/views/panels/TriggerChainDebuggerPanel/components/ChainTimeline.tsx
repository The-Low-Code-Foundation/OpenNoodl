/**
 * ChainTimeline Component
 *
 * Displays a timeline visualization of trigger chain events.
 * Builds chains from raw events using buildChainFromEvents().
 */

import React, { useMemo } from 'react';

import { buildChainFromEvents, TriggerEvent } from '../../../../utils/triggerChain';
import css from './ChainTimeline.module.scss';
import { EventStep } from './EventStep';

export interface ChainTimelineProps {
  events: TriggerEvent[];
  isRecording?: boolean;
}

export function ChainTimeline({ events, isRecording }: ChainTimelineProps) {
  // Build the trigger chain from raw events
  const chain = useMemo(() => {
    if (events.length === 0) return null;
    return buildChainFromEvents(events);
  }, [events]);

  if (!chain || events.length === 0) {
    return (
      <div className={css['ChainTimeline']}>
        <div className={css['EmptyTimeline']}>
          <p>No events to display</p>
        </div>
      </div>
    );
  }

  const interactionCount = chain.interactions.length;

  return (
    <div className={css['ChainTimeline']}>
      {/* Chain Header */}
      <div className={css['ChainHeader']}>
        <div className={css['ChainInfo']}>
          <h3>{chain.name}</h3>
          <div className={css['ChainMeta']}>
            <span>
              {interactionCount} {interactionCount === 1 ? 'interaction' : 'interactions'}
            </span>
            <span>•</span>
            <span>{chain.eventCount} steps</span>
            <span>•</span>
            <span>{chain.duration.toFixed(2)}ms</span>
          </div>
        </div>
      </div>

      {/* Timeline, grouped by interaction so one user action reads as one block */}
      <div className={css['TimelineList']}>
        {chain.interactions.map((group) => (
          <div key={group.id} className={css['InteractionGroup']}>
            <div className={css['InteractionHeader']}>
              <span className={css['InteractionIndex']}>#{group.index}</span>
              <span className={css['InteractionLabel']}>{group.label}</span>
              <span className={css['InteractionDuration']}>{group.duration.toFixed(1)}ms</span>
            </div>
            {group.events.map((event, i) => (
              <EventStep
                key={event.id}
                event={event}
                timeSinceStart={event.timestamp - group.startTime}
                timeSincePrevious={i === 0 ? 0 : event.timestamp - group.events[i - 1].timestamp}
                isRecording={isRecording}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
