/**
 * TopologyMapPanel Component
 *
 * Main panel component for the Project Topology Map.
 * Shows the "big picture" of component relationships in the project.
 */

import React, { useState, useCallback } from 'react';

import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';

import { TopologyMapView } from './components/TopologyMapView';
import { useFolderGraph } from './hooks/useFolderGraph';
import { useFolderLayout } from './hooks/useFolderLayout';
import css from './TopologyMapPanel.module.scss';
import { FolderNode, TopologyViewState } from './utils/topologyTypes';

export function TopologyMapPanel() {
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [viewState, setViewState] = useState<TopologyViewState>({
    mode: 'overview',
    expandedFolderId: null,
    selectedComponentId: null
  });

  // Build the folder graph
  const folderGraph = useFolderGraph();

  // Apply tiered layout
  const positionedGraph = useFolderLayout(folderGraph);

  // Handle folder click - select for details (Phase 4)
  const handleFolderClick = useCallback((folder: FolderNode) => {
    console.log('[TopologyMapPanel] Selected folder:', folder.name);
    setSelectedFolder(folder);
  }, []);

  // Handle folder double-click - drill down (Phase 3)
  const handleFolderDoubleClick = useCallback((folder: FolderNode) => {
    console.log('[TopologyMapPanel] Drilling into folder:', folder.name);
    setViewState({
      mode: 'expanded',
      expandedFolderId: folder.id,
      selectedComponentId: null
    });
  }, []);

  // Handle back to overview
  const handleBackToOverview = useCallback(() => {
    console.log('[TopologyMapPanel] Returning to overview');
    setViewState({
      mode: 'overview',
      expandedFolderId: null,
      selectedComponentId: null
    });
    setSelectedFolder(null);
  }, []);

  // Get expanded folder details
  const expandedFolder =
    viewState.mode === 'expanded' ? positionedGraph.folders.find((f) => f.id === viewState.expandedFolderId) : null;

  return (
    <div className={css['TopologyMapPanel']}>
      {/* Header */}
      <div className={css['TopologyMapPanel__header']}>
        <div className={css['TopologyMapPanel__title']}>
          {viewState.mode === 'expanded' && (
            <button
              className={css['TopologyMapPanel__backButton']}
              onClick={handleBackToOverview}
              title="Back to overview"
            >
              <Icon icon={IconName.ArrowLeft} />
            </button>
          )}
          <Icon icon={IconName.Navigate} />
          <h2 className={css['TopologyMapPanel__titleText']}>
            {viewState.mode === 'overview' ? 'Project Topology' : expandedFolder?.name || 'Folder Contents'}
          </h2>
        </div>

        {/* Stats display */}
        <div className={css['TopologyMapPanel__stats']}>
          {viewState.mode === 'overview' ? (
            <>
              <span>
                {positionedGraph.totalFolders} folders • {positionedGraph.totalComponents} components
              </span>
              {positionedGraph.orphanComponents.length > 0 && (
                <span className={css['TopologyMapPanel__orphanCount']}>
                  {positionedGraph.orphanComponents.length} orphans
                </span>
              )}
            </>
          ) : (
            <span>{expandedFolder?.componentCount || 0} components in this folder</span>
          )}
        </div>
      </div>

      {/* Main visualization */}
      <TopologyMapView
        graph={positionedGraph}
        viewState={viewState}
        selectedFolderId={selectedFolder?.id || null}
        onFolderClick={handleFolderClick}
        onFolderDoubleClick={handleFolderDoubleClick}
        isLegendOpen={isLegendOpen}
        onLegendToggle={() => setIsLegendOpen(!isLegendOpen)}
      />
    </div>
  );
}
