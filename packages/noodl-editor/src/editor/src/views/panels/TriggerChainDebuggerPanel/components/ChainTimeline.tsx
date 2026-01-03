/**
 * ChainTimeline Component
 *
 * Displays a timeline visualization of trigger chain events.
 * Builds chains from raw events using buildChainFromEvents().
 */

import React, { useMemo } from 'react';

import { buildChainFromEvents, calculateTiming, TriggerEvent } from '../../../../utils/triggerChain';
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

  // Calculate timing for each event
  const timing = useMemo(() => {
    if (!chain) return [];
    return calculateTiming(chain);
  }, [chain]);

  if (!chain || events.length === 0) {
    return (
      <div className={css['ChainTimeline']}>
        <div className={css['EmptyTimeline']}>
          <p>No events to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className={css['ChainTimeline']}>
      {/* Chain Header */}
      <div className={css['ChainHeader']}>
        <div className={css['ChainInfo']}>
          <h3>{chain.name}</h3>
          <div className={css['ChainMeta']}>
            <span>{chain.eventCount} events</span>
            <span>•</span>
            <span>{chain.duration.toFixed(2)}ms</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className={css['TimelineList']}>
        {chain.events.map((event) => {
          const eventTiming = timing.find((t) => t.eventId === event.id);
          return (
            <EventStep
              key={event.id}
              event={event}
              timeSinceStart={eventTiming?.sinceStart || 0}
              timeSincePrevious={eventTiming?.sincePrevious || 0}
              isRecording={isRecording}
            />
          );
        })}
      </div>
    </div>
  );
}
