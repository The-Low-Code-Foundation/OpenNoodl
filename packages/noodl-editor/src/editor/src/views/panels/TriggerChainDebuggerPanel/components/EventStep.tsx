/**
 * EventStep Component
 *
 * Displays a single event in the trigger chain timeline.
 * Shows node info, timing, and event type.
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useCallback } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { ProjectModel } from '../../../../models/projectmodel';
import { TriggerEvent } from '../../../../utils/triggerChain';
import css from './EventStep.module.scss';

export interface EventStepProps {
  event: TriggerEvent;
  timeSinceStart: number;
  timeSincePrevious: number;
  isRecording?: boolean;
}

/**
 * Get icon for event type
 */
function getEventTypeIcon(type: string): IconName {
  switch (type) {
    case 'signal':
      return IconName.Play;
    case 'value-change':
      return IconName.Setting;
    case 'component-enter':
      return IconName.Component;
    case 'component-exit':
      return IconName.Component;
    case 'api-call':
      return IconName.CloudData;
    case 'api-response':
      return IconName.CloudData;
    case 'navigation':
      return IconName.Navigate;
    case 'error':
      return IconName.Close;
    default:
      return IconName.Play;
  }
}

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function EventStep({ event, timeSinceStart, timeSincePrevious, isRecording }: EventStepProps) {
  const icon = getEventTypeIcon(event.type);

  const handleClick = useCallback(() => {
    // Don't navigate while recording
    if (isRecording) return;

    // Find the component
    const component = ProjectModel.instance?.getComponentWithName(event.componentName);
    if (!component || !NodeGraphContextTmp.switchToComponent) return;

    // Find the node if we have a nodeId
    let nodeToSelect;
    if (event.nodeId && component.graph) {
      nodeToSelect = component.graph.findNodeWithId(event.nodeId);
    }

    // Navigate to component and select the node (if found)
    NodeGraphContextTmp.switchToComponent(component, {
      node: nodeToSelect,
      pushHistory: true
    });
  }, [event.componentName, event.nodeId, isRecording]);

  return (
    <div className={css['EventStep']}>
      {/* Timeline Connector */}
      <div className={css['TimelineConnector']}>
        <div className={css['TimelineDot']} />
        <div className={css['TimelineLine']} />
      </div>

      {/* Event Card */}
      <div className={css['EventCard']} onClick={handleClick} style={{ cursor: isRecording ? 'default' : 'pointer' }}>
        {/* Header */}
        <div className={css['EventHeader']}>
          <div className={css['EventIcon']}>
            <Icon icon={icon} />
          </div>
          <div className={css['EventMeta']}>
            <div className={css['NodeInfo']}>
              <span className={css['NodeType']}>{event.nodeType}</span>
              {event.nodeLabel && <span className={css['NodeLabel']}>{event.nodeLabel}</span>}
            </div>
            <div className={css['ComponentInfo']}>
              <Icon icon={IconName.Component} />
              <span>{event.componentName}</span>
            </div>
          </div>
          <div className={css['EventType']}>
            <span className={css[`type-${event.type}`]}>{event.type}</span>
          </div>
        </div>

        {/* Timing Info */}
        <div className={css['EventTiming']}>
          <div className={css['TimingItem']}>
            <span className={css['TimingLabel']}>Since Start:</span>
            <span className={css['TimingValue']}>{formatDuration(timeSinceStart)}</span>
          </div>
          {timeSincePrevious > 0 && (
            <div className={css['TimingItem']}>
              <span className={css['TimingLabel']}>Delta:</span>
              <span className={css['TimingValue']}>+{formatDuration(timeSincePrevious)}</span>
            </div>
          )}
        </div>

        {/* Port Info */}
        {event.port && (
          <div className={css['EventPort']}>
            <span className={css['PortLabel']}>Port:</span>
            <span className={css['PortName']}>{event.port}</span>
          </div>
        )}

        {/* Data Preview */}
        {event.data !== undefined && (
          <div className={css['EventData']}>
            <span className={css['DataLabel']}>Data:</span>
            <code className={css['DataValue']}>
              {typeof event.data === 'object' ? JSON.stringify(event.data, null, 2) : String(event.data)}
            </code>
          </div>
        )}

        {/* Error Info */}
        {event.error && (
          <div className={css['EventError']}>
            <Icon icon={IconName.Close} />
            <span>{event.error.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
