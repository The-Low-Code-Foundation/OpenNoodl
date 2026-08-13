import React, { useLayoutEffect, useRef } from 'react';

import { useCanvasTabs } from '../../contexts/CanvasTabsContext';
import { resizeBlocklyWorkspaces } from '../BlocklyEditor/blocklyResize';
import css from './CanvasTabs.module.scss';
import { beginOverlayDrag, OverlayResizeHandles, type OverlayDragCallbacks } from './OverlayDragHandles';
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
   * LGC-010 — moving and resizing the floating window.
   *
   * The component reports pointer positions and the box it measured at `mousedown`; the editor
   * owns the arithmetic and the writing, because the viewport the window is clamped into is the
   * whole document rather than anything this component can see. Omitted, the window is fixed in
   * place — which is what a document with no editor behind it wants.
   */
  overlayDrag?: OverlayDragCallbacks;
}

/**
 * The Logic Builder's floating window: its title bar, its tabs, its mounted Blockly workspaces
 * and the eight handles that resize it.
 *
 * ## LGC-010 — why this floats rather than docking
 *
 * LGC-008 made this the right-hand pane of a splitter. On a 13" laptop with the app preview
 * open — the default layout — that pane is a sliver: the two interface rails are 152 px each
 * before a single block is drawn, and the drive measured the workspace at **0 px** when the pane
 * was dragged to 288. A surface with that minimum cannot be a column beside another column.
 *
 * So it floats over the whole document, like the code editor popout does for a Function port,
 * with one deliberate difference: **an outside click does not dismiss it.** `PopupLayer` closes
 * a popout when you click away, which would make "poke the running app, then come back to the
 * blocks" impossible — and that round trip is the thing the whole feature exists to remove. It
 * closes when its last tab is closed and at no other time.
 *
 * The layer around it (`#canvas-tabs-root`) is `pointer-events: none`, so every click outside
 * the window reaches whatever is underneath: the node canvas, the running app, the panels.
 */
export function CanvasTabs({ onWorkspaceChange, overlayDrag }: CanvasTabsProps) {
  const { tabs, activeTabId, switchTab, closeTab, updateTab } = useCanvasTabs();
  const windowRef = useRef<HTMLDivElement>(null);

  /**
   * A revealed workspace has to be re-measured, and this is the one place that knows it happened.
   *
   * Hidden workspaces decline to resize — `Blockly.svgResize` reads
   * `parentElement.offsetWidth/offsetHeight`, which are 0 under `display: none`, and it would
   * cache the 0 and set the SVG to `0px` — so a workspace that sat behind an inactive tab
   * through a move or a resize is stale the moment it is shown.
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

  const handleTabClick = (tabId: string) => {
    switchTab(tabId);
  };

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation(); // Don't trigger tab switch
    closeTab(tabId);
  };

  /**
   * Close every tab, which is what closes the window.
   *
   * `closeTab` fires `LogicBuilder.AllTabsClosed` when the last one goes, and that is the single
   * route by which the overlay closes — there is deliberately no separate "hide the window"
   * state to get out of step with which tabs are open. Saving is not a step here: an edit is
   * written to the node 300 ms after it settles, so by the time a hand has reached this button
   * the blocks are already on the model.
   */
  const handleCloseAll = () => {
    for (const tab of [...tabs]) closeTab(tab.id);
  };

  // Don't render anything if no tabs are open
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      className={css['CanvasTabs']}
      /**
       * L30 — keystroke ownership. Blockly runs its own shortcut registry (Delete, ⌘C/⌘X/⌘V,
       * ⌘Z) on its own listeners, and a focused Blockly workspace is an `<svg>`, which
       * `getKeyboardFocusKind` read as `'none'` — so every node graph shortcut ran too, and one
       * Delete meant two deletions. This attribute is what tells the global handler to stand
       * down while focus is inside this window. See `utils/keyboardhandler.ts`.
       */
      data-keyboard-scope="logic-overlay"
      role="dialog"
      aria-label="Logic Builder"
    >
      {overlayDrag ? <OverlayResizeHandles windowRef={windowRef} callbacks={overlayDrag} /> : null}

      {/*
        Tab Bar — and the window's title bar. Dragging its background moves the window; dragging
        a tab does not, which is why the handler sits here rather than on each tab.
      */}
      <div
        className={css['TabBar']}
        onMouseDown={(event) => {
          if (!overlayDrag) return;
          // Only a drag of the bar's own background. A mousedown that started on a tab, a close
          // button or the window's own buttons belongs to that control.
          if (event.target !== event.currentTarget) return;
          beginOverlayDrag(event, 'move', windowRef.current, overlayDrag);
        }}
      >
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

        {/* The window's own controls, right-aligned. `TabBarSpacer` is also drag surface. */}
        <div
          className={css['TabBarSpacer']}
          onMouseDown={(event) => {
            if (!overlayDrag) return;
            if (event.target !== event.currentTarget) return;
            beginOverlayDrag(event, 'move', windowRef.current, overlayDrag);
          }}
        />

        <button className={css['WindowCloseButton']} onClick={handleCloseAll} title="Close the block editor">
          Done
        </button>
      </div>

      {/* Tab Content */}
      <div className={css['TabContent']}>{buildTabWorkspaces({ tabs, activeTabId, onEdit: handleWorkspaceEdit })}</div>
    </div>
  );
}
