/**
 * Trigger Chain Debugger Panel
 *
 * Records and visualizes event trigger chains in the runtime preview.
 * Shows a timeline of events, their relationships, and component boundaries.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';
import { PrimaryButton, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';

import { triggerChainRecorder } from '../../../utils/triggerChain';
import { ChainStats } from './components/ChainStats';
import { ChainTimeline } from './components/ChainTimeline';
import css from './TriggerChainDebuggerPanel.module.scss';

export function TriggerChainDebuggerPanel() {
  const [isRecording, setIsRecording] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [liveEvents, setLiveEvents] = useState(triggerChainRecorder.getEvents());

  const handleStartRecording = useCallback(() => {
    triggerChainRecorder.startRecording();
    setIsRecording(true);
    setEventCount(0);
    setLiveEvents([]);
  }, []);

  const handleStopRecording = useCallback(() => {
    triggerChainRecorder.stopRecording();
    setIsRecording(false);
    const state = triggerChainRecorder.getState();
    setEventCount(state.events.length);
  }, []);

  const handleClear = useCallback(() => {
    triggerChainRecorder.reset();
    setEventCount(0);
  }, []);

  const hasEvents = eventCount > 0;

  // Poll for events while recording (live updates)
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      const events = triggerChainRecorder.getEvents();
      setEventCount(events.length);
      setLiveEvents(events);
    }, 100); // Poll every 100ms

    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <div className={css['TriggerChainDebuggerPanel']}>
      {/* Header */}
      <div className={css['Header']}>
        <div className={css['Title']}>
          <Icon icon={IconName.CloudData} />
          <h2>Trigger Chain Debugger</h2>
        </div>
        {isRecording && (
          <div className={css['RecordingIndicator']}>
            <span className={css['RecordingDot']} />
            <span>Recording...</span>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className={css['Controls']}>
        {!isRecording ? (
          <PrimaryButton
            label="Start Recording"
            onClick={handleStartRecording}
            variant={PrimaryButtonVariant.Cta}
            icon={IconName.Play}
          />
        ) : (
          <PrimaryButton
            label="Stop Recording"
            onClick={handleStopRecording}
            variant={PrimaryButtonVariant.Danger}
            icon={IconName.Close}
          />
        )}

        {hasEvents && !isRecording && (
          <PrimaryButton
            label="Clear"
            onClick={handleClear}
            variant={PrimaryButtonVariant.Muted}
            icon={IconName.Trash}
          />
        )}

        {hasEvents && (
          <div className={css['EventCount']}>
            <span>{eventCount} events captured</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={css['Content']}>
        {!hasEvents && !isRecording && (
          <div className={css['EmptyState']}>
            <Icon icon={IconName.CloudData} />
            <h3>No Events Recorded</h3>
            <p>Click &quot;Start Recording&quot; then interact with your preview to capture event chains</p>
          </div>
        )}

        {isRecording && !hasEvents && (
          <div className={css['RecordingState']}>
            <Icon icon={IconName.CloudData} />
            <h3>Recording Active</h3>
            <p>Interact with your preview to capture events...</p>
          </div>
        )}

        {hasEvents && (
          <div className={css['TimelineContainer']}>
            <ChainStats events={liveEvents} isRecording={isRecording} />
            <ChainTimeline events={liveEvents} isRecording={isRecording} />
          </div>
        )}
      </div>
    </div>
  );
}
