import React from 'react';

import { useCanvasTabs } from '../../contexts/CanvasTabsContext';
import { BlocklyWorkspace } from '../BlocklyEditor';
import css from './CanvasTabs.module.scss';

export interface CanvasTabsProps {
  /** Callback when workspace changes */
  onWorkspaceChange?: (nodeId: string, workspace: string, code: string) => void;
}

/**
 * Canvas Tabs Component
 *
 * Manages tabs for Logic Builder (Blockly) editors.
 * The canvas itself is NOT managed here - it's always visible in the background
 * unless a Logic Builder tab is open.
 */
export function CanvasTabs({ onWorkspaceChange }: CanvasTabsProps) {
  const { tabs, activeTabId, switchTab, closeTab, updateTab } = useCanvasTabs();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  /**
   * Handle workspace changes from Blockly editor
   */
  const handleWorkspaceChange = (_workspaceSvg: unknown, json: string, code: string) => {
    if (!activeTab) {
      return;
    }

    // Update tab's workspace with JSON
    updateTab(activeTab.id, { workspace: json });

    // Notify parent (pass both workspace JSON and generated code)
    if (onWorkspaceChange && activeTab.nodeId) {
      onWorkspaceChange(activeTab.nodeId, json, code);
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

  // Don't render anything if no tabs are open
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={css['CanvasTabs']}>
      {/* Tab Bar */}
      <div className={css['TabBar']}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              className={`${css['Tab']} ${isActive ? css['isActive'] : ''}`}
              onClick={() => handleTabClick(tab.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
            >
              <span className={css['TabLabel']}>Logic Builder: {tab.nodeName || 'Unnamed'}</span>

              <button
                className={css['TabCloseButton']}
                onClick={(e) => handleTabClose(e, tab.id)}
                aria-label="Close tab"
                title="Close tab"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className={css['TabContent']}>
        {activeTab && (
          <div className={css['BlocklyContainer']}>
            <BlocklyWorkspace initialWorkspace={activeTab.workspace || undefined} onChange={handleWorkspaceChange} />
          </div>
        )}
      </div>
    </div>
  );
}
