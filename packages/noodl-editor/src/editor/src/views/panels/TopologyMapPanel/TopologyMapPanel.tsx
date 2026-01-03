/**
 * TopologyMapPanel Component
 *
 * Main panel component for the Project Topology Map.
 * Shows the "big picture" of component relationships in the project.
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useState, useCallback, useEffect } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { TopologyMapView } from './components/TopologyMapView';
import { useTopologyGraph } from './hooks/useTopologyGraph';
import { useTopologyLayout } from './hooks/useTopologyLayout';
import css from './TopologyMapPanel.module.scss';
import { TopologyNode } from './utils/topologyTypes';

export function TopologyMapPanel() {
  const [hoveredNode, setHoveredNode] = useState<TopologyNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Build the graph data
  const graph = useTopologyGraph();

  // Apply layout algorithm
  const positionedGraph = useTopologyLayout(graph);

  // Handle node click - navigate to that component
  const handleNodeClick = useCallback((node: TopologyNode) => {
    console.log('[TopologyMapPanel] Navigating to component:', node.fullName);

    if (NodeGraphContextTmp.switchToComponent) {
      NodeGraphContextTmp.switchToComponent(node.component, {
        pushHistory: true,
        breadcrumbs: true
      });
    }
  }, []);

  // Handle node hover for tooltip
  const handleNodeHover = useCallback((node: TopologyNode | null, event?: React.MouseEvent) => {
    setHoveredNode(node);
    if (node && event) {
      setTooltipPos({ x: event.clientX, y: event.clientY });
    } else {
      setTooltipPos(null);
    }
  }, []);

  // Auto-fit on first load
  useEffect(() => {
    // Trigger fit to view after initial render
    const timer = setTimeout(() => {
      // The TopologyMapView has a fitToView method, but we can't call it directly
      // Instead, it will auto-fit on mount via the controls
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={css['TopologyMapPanel']}>
      {/* Header with breadcrumbs */}
      <div className={css['TopologyMapPanel__header']}>
        <div className={css['TopologyMapPanel__title']}>
          <Icon icon={IconName.Navigate} />
          <h2 className={css['TopologyMapPanel__titleText']}>Project Topology</h2>
        </div>

        {graph.currentPath.length > 0 && (
          <div className={css['TopologyMapPanel__breadcrumbs']}>
            <span className={css['TopologyMapPanel__breadcrumbLabel']}>Current path:</span>
            {graph.currentPath.map((componentName, i) => (
              <React.Fragment key={componentName}>
                {i > 0 && <span className={css['TopologyMapPanel__breadcrumbSeparator']}>→</span>}
                <span
                  className={css['TopologyMapPanel__breadcrumb']}
                  style={{
                    fontWeight: i === graph.currentPath.length - 1 ? 600 : 400
                  }}
                >
                  {componentName.split('/').pop() || componentName}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Main visualization with legend inside */}
      <TopologyMapView
        graph={positionedGraph}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        isLegendOpen={isLegendOpen}
        onLegendToggle={() => setIsLegendOpen(!isLegendOpen)}
      />

      {/* Tooltip */}
      {hoveredNode && tooltipPos && (
        <div
          className={css['TopologyMapPanel__tooltip']}
          style={{
            left: tooltipPos.x + 10,
            top: tooltipPos.y + 10
          }}
        >
          <div className={css['TopologyMapPanel__tooltipTitle']}>{hoveredNode.name}</div>
          <div className={css['TopologyMapPanel__tooltipContent']}>
            <div>Type: {hoveredNode.type === 'page' ? '📄 Page' : '🧩 Component'}</div>
            <div>
              Used {hoveredNode.usageCount} time{hoveredNode.usageCount !== 1 ? 's' : ''}
            </div>
            {hoveredNode.depth < 999 && <div>Depth: {hoveredNode.depth}</div>}
            {hoveredNode.usedBy.length > 0 && (
              <div className={css['TopologyMapPanel__tooltipSection']}>
                <strong>Used by:</strong>{' '}
                {hoveredNode.usedBy
                  .slice(0, 3)
                  .map((name) => name.split('/').pop())
                  .join(', ')}
                {hoveredNode.usedBy.length > 3 && ` +${hoveredNode.usedBy.length - 3} more`}
              </div>
            )}
            {hoveredNode.uses.length > 0 && (
              <div className={css['TopologyMapPanel__tooltipSection']}>
                <strong>Uses:</strong>{' '}
                {hoveredNode.uses
                  .slice(0, 3)
                  .map((name) => name.split('/').pop())
                  .join(', ')}
                {hoveredNode.uses.length > 3 && ` +${hoveredNode.uses.length - 3} more`}
              </div>
            )}
          </div>
          <div className={css['TopologyMapPanel__tooltipHint']}>Click to navigate →</div>
        </div>
      )}
    </div>
  );
}
