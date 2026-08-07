/**
 * Data Lineage Panel
 *
 * Shows the complete upstream (source) and downstream (destination) paths for data flow
 * through the node graph, including cross-component traversal.
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import React, { useEffect, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { HighlightManager } from '../../../services/HighlightManager';
import type { LineageResult } from '../../../utils/graphAnalysis';
import { LineagePath } from './components/LineagePath';
import { PathSummary } from './components/PathSummary';
import css from './DataLineagePanel.module.scss';
import { useDataLineage } from './hooks/useDataLineage';

export interface DataLineagePanelProps {
  /** Optional: Pre-selected node to trace */
  selectedNodeId?: string;

  /** Optional: Specific port to trace */
  selectedPort?: string;
}

/**
 * DataLineagePanel component
 *
 * Displays data lineage information for a selected node, showing where
 * data comes from (upstream) and where it goes to (downstream).
 *
 * @example
 * ```tsx
 * <DataLineagePanel selectedNodeId="node-123" />
 * ```
 */
export function DataLineagePanel({ selectedNodeId, selectedPort }: DataLineagePanelProps) {
  const [activeHighlightHandle, setActiveHighlightHandle] = useState<{ dismiss: () => void } | null>(null);
  const [lineageData, setLineageData] = useState<LineageResult | null>(null);
  const [isUpstreamExpanded, setIsUpstreamExpanded] = useState(true);
  const [isDownstreamExpanded, setIsDownstreamExpanded] = useState(true);

  // Get lineage data using custom hook
  const lineage = useDataLineage(selectedNodeId, selectedPort);

  // Update lineage data when it changes
  useEffect(() => {
    setLineageData(lineage);
  }, [lineage]);

  // Cleanup highlights on unmount
  useEffect(() => {
    return () => {
      if (activeHighlightHandle) {
        activeHighlightHandle.dismiss();
      }
    };
  }, [activeHighlightHandle]);

  /**
   * Highlight the full lineage path on the canvas
   */
  const handleHighlightPath = () => {
    if (!lineageData) return;

    // Dismiss any existing highlight
    if (activeHighlightHandle) {
      activeHighlightHandle.dismiss();
    }

    // Collect all nodes in the lineage
    const nodeIds = new Set<string>();
    const connections: Array<{
      fromNodeId: string;
      fromPort: string;
      toNodeId: string;
      toPort: string;
    }> = [];

    // Add upstream nodes
    lineageData.upstream.steps.forEach((step) => {
      nodeIds.add(step.node.id);
      if (step.connection) {
        connections.push(step.connection);
      }
    });

    // Add downstream nodes
    lineageData.downstream.forEach((path) => {
      path.steps.forEach((step) => {
        nodeIds.add(step.node.id);
        if (step.connection) {
          connections.push(step.connection);
        }
      });
    });

    // Add the selected node itself
    nodeIds.add(lineageData.selectedNode.id);

    // Create highlight
    const handle = HighlightManager.instance.highlightPath(
      {
        nodes: Array.from(nodeIds),
        connections,
        crossesComponents: lineageData.upstream.crossings.length > 0
      },
      {
        channel: 'lineage',
        style: 'glow',
        persistent: true,
        label: `Lineage: ${lineageData.selectedNode.label}`
      }
    );

    setActiveHighlightHandle(handle);
  };

  /**
   * Dismiss the lineage highlight
   */
  const handleDismiss = () => {
    if (activeHighlightHandle) {
      activeHighlightHandle.dismiss();
      setActiveHighlightHandle(null);
    }
    setLineageData(null);
  };

  /**
   * Navigate to a specific node on the canvas
   */
  const handleNavigateToNode = (componentName: string, _nodeId: string) => {
    // Switch to the component if needed
    const component = ProjectModel.instance.getComponentWithName(componentName);
    if (component && NodeGraphContextTmp.switchToComponent) {
      NodeGraphContextTmp.switchToComponent(component, { pushHistory: true });
    }

    // The canvas will auto-center on the node due to selection
    // TODO: Add explicit pan-to-node and selection once that API is available
  };

  // Empty state
  if (!lineageData) {
    return (
      <div className={css['DataLineagePanel']}>
        <div className={css['EmptyState']}>
          <div className={css['EmptyState-icon']}>🔗</div>
          <div className={css['EmptyState-title']}>No Node Selected</div>
          <div className={css['EmptyState-description']}>Select a node on the canvas to trace its data lineage</div>
        </div>
      </div>
    );
  }

  const hasUpstream = lineageData.upstream.steps.length > 0;
  const hasDownstream = lineageData.downstream.length > 0 && lineageData.downstream.some((p) => p.steps.length > 0);

  return (
    <div className={css['DataLineagePanel']}>
      {/* Header */}
      <div className={css['Header']}>
        <div className={css['Header-title']}>
          <span className={css['Header-icon']}>🔗</span>
          <span className={css['Header-label']}>Data Lineage</span>
        </div>
        <div className={css['Header-actions']}>
          {activeHighlightHandle ? (
            <button className={css['Button']} onClick={handleDismiss} title="Clear highlighting">
              Clear
            </button>
          ) : (
            <button className={css['Button']} onClick={handleHighlightPath} title="Highlight path on canvas">
              Highlight
            </button>
          )}
        </div>
      </div>

      {/* Selected Node Info */}
      <div className={css['SelectedNode']}>
        <div className={css['SelectedNode-label']}>
          <strong>{lineageData.selectedNode.label}</strong>
        </div>
        <div className={css['SelectedNode-meta']}>
          {lineageData.selectedNode.type}
          {lineageData.selectedNode.port && ` → ${lineageData.selectedNode.port}`}
        </div>
        <div className={css['SelectedNode-component']}>{lineageData.selectedNode.componentName}</div>
      </div>

      {/* Path Summary */}
      {(hasUpstream || hasDownstream) && (
        <PathSummary
          upstream={lineageData.upstream}
          downstream={lineageData.downstream}
          selectedNodeLabel={lineageData.selectedNode.label}
        />
      )}

      {/* Upstream Section */}
      <div className={css['Section']}>
        <div className={css['Section-header']} onClick={() => setIsUpstreamExpanded(!isUpstreamExpanded)}>
          <span className={css['Section-toggle']}>{isUpstreamExpanded ? '▼' : '▶'}</span>
          <span className={css['Section-title']}>
            <span className={css['Section-icon']}>▲</span> UPSTREAM
          </span>
          <span className={css['Section-subtitle']}>Where does this value come from?</span>
        </div>

        {isUpstreamExpanded && (
          <div className={css['Section-content']}>
            {hasUpstream ? (
              <LineagePath path={lineageData.upstream} direction="upstream" onNavigateToNode={handleNavigateToNode} />
            ) : (
              <div className={css['EmptyPath']}>
                <div className={css['EmptyPath-icon']}>⊗</div>
                <div className={css['EmptyPath-text']}>No upstream connections</div>
                <div className={css['EmptyPath-hint']}>This is a source node</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Downstream Section */}
      <div className={css['Section']}>
        <div className={css['Section-header']} onClick={() => setIsDownstreamExpanded(!isDownstreamExpanded)}>
          <span className={css['Section-toggle']}>{isDownstreamExpanded ? '▼' : '▶'}</span>
          <span className={css['Section-title']}>
            <span className={css['Section-icon']}>▼</span> DOWNSTREAM
          </span>
          <span className={css['Section-subtitle']}>Where does this value go?</span>
        </div>

        {isDownstreamExpanded && (
          <div className={css['Section-content']}>
            {hasDownstream ? (
              <>
                {lineageData.downstream.map((path, index) => (
                  <div key={index} className={css['DownstreamPath']}>
                    {lineageData.downstream.length > 1 && <div className={css['PathBranch']}>Branch {index + 1}</div>}
                    <LineagePath path={path} direction="downstream" onNavigateToNode={handleNavigateToNode} />
                  </div>
                ))}
              </>
            ) : (
              <div className={css['EmptyPath']}>
                <div className={css['EmptyPath-icon']}>⊗</div>
                <div className={css['EmptyPath-text']}>No downstream connections</div>
                <div className={css['EmptyPath-hint']}>This is a sink node</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
