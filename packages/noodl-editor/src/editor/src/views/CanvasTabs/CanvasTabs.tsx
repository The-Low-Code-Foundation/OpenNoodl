import React from 'react';

import { useCanvasTabs } from '../../contexts/CanvasTabsContext';
import css from './CanvasTabs.module.scss';
import { buildTabWorkspaces, TabWorkspaceEdit } from './tabWorkspaces';

export interface CanvasTabsProps {
  /**
   * Callback when workspace changes.
   *
   * `code` is `undefined` when generation declined — see `BlocklyWorkspaceProps.onChange`.
   * It is threaded through rather than defaulted, because the difference between "no honest
   * code for this edit" and "the empty program" is the whole point of the type.
   */
  onWorkspaceChange?: (nodeId: string, workspace: string, code: string | undefined) => void;
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

  /**
   * Save one settled edit — to the tab that produced it.
   *
   * 🔴 F4. This used to read `activeTab`: the tab from the render that produced the callback,
   * not the tab that owns the workspace that fired. `buildTabWorkspaces` now binds the tab at
   * the call site and hands it back here, so the answer no longer depends on what happened to
   * be active when the 300 ms debounce elapsed. See `tabWorkspaces.tsx` for the full mechanism
   * and for why the `key` was never the defence it looked like.
   */
  const handleWorkspaceEdit = ({ tab, workspace, code }: TabWorkspaceEdit) => {
    updateTab(tab.id, { workspace });

    // Notify parent (pass both workspace JSON and generated code)
    if (onWorkspaceChange && tab.nodeId) {
      onWorkspaceChange(tab.nodeId, workspace, code);
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
      <div className={css['TabContent']}>{buildTabWorkspaces({ tabs, activeTabId, onEdit: handleWorkspaceEdit })}</div>
    </div>
  );
}
