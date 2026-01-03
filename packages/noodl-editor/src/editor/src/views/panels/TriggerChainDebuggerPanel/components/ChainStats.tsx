/**
 * ChainStats Component
 *
 * Displays statistics about the trigger chain.
 * Shows event counts, component breakdown, and timing info.
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useCallback, useMemo } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { ProjectModel } from '../../../../models/projectmodel';
import { buildChainFromEvents, calculateStatistics, TriggerEvent } from '../../../../utils/triggerChain';
import css from './ChainStats.module.scss';

export interface ChainStatsProps {
  events: TriggerEvent[];
  isRecording?: boolean;
}

export function ChainStats({ events, isRecording }: ChainStatsProps) {
  // Build chain and calculate stats
  const stats = useMemo(() => {
    if (events.length === 0) return null;
    const chain = buildChainFromEvents(events);
    return calculateStatistics(chain);
  }, [events]);

  const handleComponentClick = useCallback(
    (componentName: string) => {
      // Don't navigate while recording
      if (isRecording) return;

      // Find and navigate to the component
      const component = ProjectModel.instance?.getComponentWithName(componentName);
      if (component && NodeGraphContextTmp.switchToComponent) {
        NodeGraphContextTmp.switchToComponent(component, { pushHistory: true });
      }
    },
    [isRecording]
  );

  if (!stats) {
    return null;
  }

  return (
    <div className={css['ChainStats']}>
      <h4 className={css['StatsTitle']}>
        <Icon icon={IconName.Setting} />
        Chain Statistics
      </h4>

      {/* Total Events */}
      <div className={css['StatGroup']}>
        <div className={css['StatItem']}>
          <span className={css['StatLabel']}>Total Events</span>
          <span className={css['StatValue']}>{stats.totalEvents}</span>
        </div>
      </div>

      {/* Events by Type */}
      <div className={css['StatGroup']}>
        <h5 className={css['GroupTitle']}>Events by Type</h5>
        {Array.from(stats.eventsByType.entries()).map(([type, count]) => (
          <div key={type} className={css['StatItem']}>
            <span className={css['StatLabel']}>{type}</span>
            <span className={css['StatValue']}>{count}</span>
          </div>
        ))}
      </div>

      {/* Events by Component */}
      <div className={css['StatGroup']}>
        <h5 className={css['GroupTitle']}>Events by Component</h5>
        {Array.from(stats.eventsByComponent.entries()).map(([component, count]) => (
          <div key={component} className={css['StatItem']}>
            <span className={css['StatLabel']}>{component}</span>
            <span className={css['StatValue']}>{count}</span>
          </div>
        ))}
      </div>

      {/* Timing */}
      <div className={css['StatGroup']}>
        <h5 className={css['GroupTitle']}>Timing</h5>
        <div className={css['StatItem']}>
          <span className={css['StatLabel']}>Average Gap</span>
          <span className={css['StatValue']}>{stats.averageEventGap.toFixed(2)}ms</span>
        </div>
        <div className={css['StatItem']}>
          <span className={css['StatLabel']}>Longest Gap</span>
          <span className={css['StatValue']}>{stats.longestGap.toFixed(2)}ms</span>
        </div>
      </div>

      {/* Components Involved */}
      <div className={css['StatGroup']}>
        <h5 className={css['GroupTitle']}>Components Involved</h5>
        <div className={css['ComponentList']}>
          {stats.componentsInvolved.map((component) => (
            <div
              key={component}
              className={css['ComponentChip']}
              onClick={() => handleComponentClick(component)}
              style={{ cursor: isRecording ? 'default' : 'pointer' }}
            >
              <Icon icon={IconName.Component} />
              <span>{component}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
