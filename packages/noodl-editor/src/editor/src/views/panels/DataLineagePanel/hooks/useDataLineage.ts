/**
 * Hook for calculating data lineage for a selected node.
 *
 * NOTE (DEBT-012, 2026-07-25): the Data Lineage panel is RETIRED FROM REACH —
 * its sidebar registration is commented out in `router.setup.ts` because the
 * tracing algorithm is wrong by its author's account (it enumerates ports
 * instead of following wires). This code is kept one release cycle behind the
 * dead registration, then deleted in the next cleanup batch. Do NOT revive it
 * here; a deterministic rebuild belongs on the catalog/v2 substrate — see
 * `dev-docs/future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md`. The debug
 * console spew that used to live in this hook was removed as part of DEBT-012.
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { useEventListener } from '@noodl-hooks/useEventListener';
import { useEffect, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { EventDispatcher } from '../../../../../../shared/utils/EventDispatcher';
import { buildLineage, type LineageResult } from '../../../../utils/graphAnalysis';

/**
 * Custom hook to calculate and return lineage data for a selected node
 *
 * @param selectedNodeId - ID of the node to trace (optional - if not provided, uses canvas selection)
 * @param selectedPort - Specific port to trace (optional)
 * @returns Lineage result or null if no node selected
 */
export function useDataLineage(selectedNodeId?: string, selectedPort?: string): LineageResult | null {
  const [lineage, setLineage] = useState<LineageResult | null>(null);
  const [currentSelectedNodeId, setCurrentSelectedNodeId] = useState<string | undefined>(selectedNodeId);

  // Check current selection on mount (catches selection that happened before panel opened)
  useEffect(() => {
    // Only if we're not using a fixed selectedNodeId prop
    if (!selectedNodeId) {
      const selection = NodeGraphContextTmp.nodeGraph?.getSelectedNodes?.();
      if (selection && selection.length === 1) {
        setCurrentSelectedNodeId(selection[0].id);
      }
    }
  }, []); // Empty deps = run once on mount

  // Listen to context menu "Show Data Lineage" requests
  useEventListener(
    EventDispatcher.instance,
    'DataLineage.ShowForNode',
    (data: { nodeId: string; componentName?: string }) => {
      setCurrentSelectedNodeId(data.nodeId);
    },
    []
  );

  // Listen to selection changes on the canvas
  useEventListener(
    NodeGraphContextTmp.nodeGraph,
    'selectionChanged',
    (selection: { nodeIds: string[] }) => {
      // Only update if we're not using a fixed selectedNodeId prop
      if (!selectedNodeId) {
        if (selection.nodeIds.length === 1) {
          setCurrentSelectedNodeId(selection.nodeIds[0]);
        } else {
          setCurrentSelectedNodeId(undefined);
        }
      }
    },
    [selectedNodeId]
  );

  // Recalculate lineage when selection or component changes
  useEffect(() => {
    const component = NodeGraphContextTmp.nodeGraph?.activeComponent;

    if (!component) {
      setLineage(null);
      return;
    }

    // Use either the prop or the current selection
    const nodeId = selectedNodeId || currentSelectedNodeId;

    if (!nodeId) {
      setLineage(null);
      return;
    }

    // Calculate lineage
    try {
      const result = buildLineage(ProjectModel.instance, component, nodeId, selectedPort);
      setLineage(result);
    } catch (error) {
      console.error('[DataLineage] Error building lineage:', error);
      setLineage(null);
    }
  }, [selectedNodeId, currentSelectedNodeId, selectedPort]);

  return lineage;
}
