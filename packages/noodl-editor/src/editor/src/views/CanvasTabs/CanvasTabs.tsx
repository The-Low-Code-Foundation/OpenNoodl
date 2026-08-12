import React, { useLayoutEffect } from 'react';

import { useCanvasTabs } from '../../contexts/CanvasTabsContext';
import { resizeBlocklyWorkspaces } from '../BlocklyEditor/blocklyResize';
import css from './CanvasTabs.module.scss';
import { PaneSplitter } from './PaneSplitter';
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
  /**
   * LGC-008 — the splitter between the canvas pane and this one, reported as the pointer's
   * client X on every `mousemove` of a drag.
   *
   * A client coordinate rather than a fraction because the conversion needs the shell's bounds,
   * and the shell is the editor's, not this component's. `OverlayViews` closes the loop.
   * Omitted, the splitter is not drawn — which is what a document with no pane wants.
   */
  onSplitDrag?: (pointerClientX: number) => void;
}

/**
 * Canvas Tabs Component
 *
 * The tab bar and the mounted Blockly workspaces of the **logic pane** — the right-hand half of
 * the node graph shell once a Visual Function is open. The canvas is not managed here and, since
 * LGC-008, is not hidden either: both surfaces are on screen at once and this pane is bounded by
 * the splitter it draws down its own left edge.
 */
export function CanvasTabs({ onWorkspaceChange, onSplitDrag }: CanvasTabsProps) {
  const { tabs, activeTabId, switchTab, closeTab, updateTab } = useCanvasTabs();

  /**
   * A revealed workspace has to be re-measured, and this is the one place that knows it happened.
   *
   * Hidden workspaces decline to resize — `Blockly.svgResize` reads
   * `parentElement.offsetWidth/offsetHeight`, which are 0 under `display: none`, and it would
   * cache the 0 and set the SVG to `0px` — so a workspace that sat behind an inactive tab
   * through a splitter drag is stale the moment it is shown.
   *
   * ⚠️ `useLayoutEffect`, not `useEffect` and not a `ResizeObserver`. It runs synchronously
   * after the DOM mutation that changed `display`, which is exactly when the new size can be
   * read. An occluded Electron renderer fires zero `ResizeObserver` callbacks and clamps timers
   * ~1000×, so anything deferred works while the window is focused and fails where this is used.
   */
  useLayoutEffect(() => {
    resizeBlocklyWorkspaces();
  }, [activeTabId, tabs.length]);

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
      {onSplitDrag ? <PaneSplitter onDrag={onSplitDrag} /> : null}

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
