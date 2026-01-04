/**
 * Hook for calculating data lineage for a selected node
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

  console.log(
    '🔗 [DataLineage] Hook render - currentSelectedNodeId:',
    currentSelectedNodeId,
    'selectedNodeId prop:',
    selectedNodeId
  );

  // Check current selection on mount (catches selection that happened before panel opened)
  useEffect(() => {
    console.log('🔗 [DataLineage] Mount check useEffect running');
    // Only if we're not using a fixed selectedNodeId prop
    if (!selectedNodeId) {
      console.log('🔗 [DataLineage] No prop provided, checking graph selection...');
      console.log('🔗 [DataLineage] NodeGraphContextTmp.nodeGraph:', NodeGraphContextTmp.nodeGraph);
      const selection = NodeGraphContextTmp.nodeGraph?.getSelectedNodes?.();
      console.log('🔗 [DataLineage] getSelectedNodes() returned:', selection);
      if (selection && selection.length === 1) {
        console.log('🔗 [DataLineage] ✅ Setting currentSelectedNodeId to:', selection[0].id);
        setCurrentSelectedNodeId(selection[0].id);
      } else {
        console.log('🔗 [DataLineage] ❌ No valid single selection on mount');
      }
    } else {
      console.log('🔗 [DataLineage] Using prop selectedNodeId:', selectedNodeId);
    }
  }, []); // Empty deps = run once on mount

  // Listen to context menu "Show Data Lineage" requests
  useEventListener(
    EventDispatcher.instance,
    'DataLineage.ShowForNode',
    (data: { nodeId: string; componentName?: string }) => {
      console.log('📍 [DataLineage] Context menu event - Show lineage for node:', data.nodeId);
      setCurrentSelectedNodeId(data.nodeId);
    },
    []
  );

  // Listen to selection changes on the canvas
  useEventListener(
    NodeGraphContextTmp.nodeGraph,
    'selectionChanged',
    (selection: { nodeIds: string[] }) => {
      console.log('🔗 [DataLineage] selectionChanged event fired:', selection);
      // Only update if we're not using a fixed selectedNodeId prop
      if (!selectedNodeId) {
        if (selection.nodeIds.length === 1) {
          console.log('🔗 [DataLineage] ✅ Event: Setting selection to:', selection.nodeIds[0]);
          setCurrentSelectedNodeId(selection.nodeIds[0]);
        } else {
          console.log('🔗 [DataLineage] ❌ Event: Clearing selection (count:', selection.nodeIds.length, ')');
          setCurrentSelectedNodeId(undefined);
        }
      } else {
        console.log('🔗 [DataLineage] Event: Ignoring (using prop)');
      }
    },
    [selectedNodeId]
  );

  // Recalculate lineage when selection or component changes
  useEffect(() => {
    console.log('🔗 [DataLineage] Lineage calc useEffect running');
    const component = NodeGraphContextTmp.nodeGraph?.activeComponent;
    console.log('🔗 [DataLineage] Active component:', component?.name);

    if (!component) {
      console.log('🔗 [DataLineage] ❌ No active component');
      setLineage(null);
      return;
    }

    // Use either the prop or the current selection
    const nodeId = selectedNodeId || currentSelectedNodeId;
    console.log('🔗 [DataLineage] Node ID to trace:', nodeId);

    if (!nodeId) {
      console.log('🔗 [DataLineage] ❌ No node ID to trace');
      setLineage(null);
      return;
    }

    // Calculate lineage
    try {
      console.log('🔗 [DataLineage] 🚀 Calling buildLineage...');
      const result = buildLineage(ProjectModel.instance, component, nodeId, selectedPort);
      console.log('🔗 [DataLineage] ✅ Lineage built successfully:', result);
      setLineage(result);
    } catch (error) {
      console.error('🔗 [DataLineage] ❌ Error building lineage:', error);
      setLineage(null);
    }
  }, [selectedNodeId, currentSelectedNodeId, selectedPort]);

  return lineage;
}
