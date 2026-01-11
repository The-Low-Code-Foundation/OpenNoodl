import React from 'react';

import { useCanvasTabs } from '../../contexts/CanvasTabsContext';
import { BlocklyWorkspace } from '../BlocklyEditor';
import css from './CanvasTabs.module.scss';

export interface CanvasTabsProps {
  /** Callback when workspace changes */
  onWorkspaceChange?: (nodeId: string, workspace: string) => void;
}

/**
 * Canvas Tabs Component
 *
 * Manages tabs for canvas view and Logic Builder (Blockly) editors.
 * Renders a tab bar and switches content based on active tab.
 */
export function CanvasTabs({ onWorkspaceChange }: CanvasTabsProps) {
  const { tabs, activeTabId, switchTab, closeTab, updateTab } = useCanvasTabs();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  /**
   * Handle workspace changes from Blockly editor
   */
  const handleWorkspaceChange = (_workspaceSvg: unknown, json: string) => {
    if (!activeTab || activeTab.type !== 'logic-builder') {
      return;
    }

    // Update tab's workspace with JSON
    updateTab(activeTab.id, { workspace: json });

    // Notify parent
    if (onWorkspaceChange && activeTab.nodeId) {
      onWorkspaceChange(activeTab.nodeId, json);
    }
  };

  /**
   * Handle tab click
   */
  const handleTabClick = (tabId: string) => {
    switchTab(tabId);
  };

  /**
   * Handle tab close
   */
  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation(); // Don't trigger tab switch
    closeTab(tabId);
  };

  return (
    <div className={css['CanvasTabs']}>
      {/* Tab Bar */}
      <div className={css['TabBar']}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const canClose = tab.type !== 'canvas';

          return (
            <div
              key={tab.id}
              className={`${css['Tab']} ${isActive ? css['isActive'] : ''}`}
              onClick={() => handleTabClick(tab.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
            >
              <span className={css['TabLabel']}>
                {tab.type === 'canvas' ? 'Canvas' : `Logic Builder: ${tab.nodeName || 'Unnamed'}`}
              </span>

              {canClose && (
                <button
                  className={css['TabCloseButton']}
                  onClick={(e) => handleTabClose(e, tab.id)}
                  aria-label="Close tab"
                  title="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className={css['TabContent']}>
        {activeTab?.type === 'canvas' && (
          <div className={css['CanvasContainer']} id="nodegraph-canvas-container">
            {/* Canvas will be rendered here by NodeGraphEditor */}
          </div>
        )}

        {activeTab?.type === 'logic-builder' && (
          <div className={css['BlocklyContainer']}>
            <BlocklyWorkspace initialWorkspace={activeTab.workspace || undefined} onChange={handleWorkspaceChange} />
          </div>
        )}
      </div>
    </div>
  );
}
