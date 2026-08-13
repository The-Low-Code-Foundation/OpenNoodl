import React, { useLayoutEffect, useRef } from 'react';

import { useCanvasTabs, type Tab } from '../../contexts/CanvasTabsContext';
import { definitionTabTooltip, editTargetFor, isDefinitionTab, tabTravels } from '../../contexts/tabSubject';
import { resizeBlocklyWorkspaces } from '../BlocklyEditor/blocklyResize';
import css from './CanvasTabs.module.scss';
import { beginOverlayDrag, OverlayResizeHandles, type OverlayDragCallbacks } from './OverlayDragHandles';
import { isTabAway, LABEL_SEPARATOR, tabLabelSegments, tabTooltip } from './tabLocation';
import { resolveTabLocations } from './tabNavigation';
import { buildTabWorkspaces, TabWorkspaceEdit } from './tabWorkspaces';
import { useActiveComponentId } from './useActiveComponentId';

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
   * VFN-009 — a settled edit to a **saved block's** body.
   *
   * A separate callback rather than a widened `onWorkspaceChange`, for the reason §2 gives about
   * the tab's own identity: one entry point meaning two things makes every implementation either
   * learn the difference or silently do the wrong thing. It also carries no `code`, and that is
   * the honest signature — a definition is never generated on its own, and there is no
   * `generatedCode` anywhere on this path to write.
   *
   * A callback rather than a call for the same reason `onWorkspaceChange` is one: this component
   * renders a window and cannot see a shelf. `OverlayViews` supplies it. Omitted, a definition
   * tab's edits are held in the tab and written nowhere — which is what a document with no
   * project behind it wants.
   */
  onDefinitionChange?: (definitionId: string, workspace: string) => void;
  /**
   * LGC-010 — moving and resizing the floating window.
   *
   * The component reports pointer positions and the box it measured at `mousedown`; the editor
   * owns the arithmetic and the writing, because the viewport the window is clamped into is the
   * whole document rather than anything this component can see. Omitted, the window is fixed in
   * place — which is what a document with no editor behind it wants.
   */
  overlayDrag?: OverlayDragCallbacks;
  /**
   * VFN-004 — the tab was clicked, so take the canvas to where its blocks live.
   *
   * A callback rather than a call, for the same reason `onWorkspaceChange` is one: this component
   * renders a window, and the node graph is not something it can see. The editor supplies
   * `navigateToTabComponent`. Omitted, the tab still switches — it just does not travel, which is
   * what a document with no canvas behind it wants.
   */
  onTabActivate?: (tab: Tab) => void;
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
export function CanvasTabs({ onWorkspaceChange, onDefinitionChange, overlayDrag, onTabActivate }: CanvasTabsProps) {
  const { tabs, activeTabId, switchTab, closeTab, closeTabs, updateTab } = useCanvasTabs();
  const windowRef = useRef<HTMLDivElement>(null);

  /**
   * VFN-004 — which component the canvas behind this window is showing.
   *
   * Read, never stored: the away mark is a comparison against the node graph's own active
   * component, not a flag this component maintains.
   */
  const activeComponentId = useActiveComponentId();

  /**
   * VFN-004 — where each open tab says it belongs, resolved against the project as it is now.
   *
   * The resolution lives in `tabNavigation` because it reads the project, and this component's
   * whole contract is that it can see a window and nothing else. What arrives here is a display
   * string per tab and a full path for the tooltip.
   *
   * The words "Logic Builder" are deliberately not in any of it: the window is already
   * `aria-label="Logic Builder"` and its title bar is two pixels away, and a tab that spends its
   * width repeating the window's name has none left for the answer.
   */
  const resolvedTabs = resolveTabLocations(tabs);

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

    /**
     * 🔴 VFN-009 — where the edit goes is decided by the tab's **subject**, not by which field
     * happens to be filled in. `editTargetFor` is a pure function in `contexts/tabSubject.ts` and
     * is graded there, with the widening §2 forbids as its negative control: a router that read
     * `tab.nodeId ?? tab.definitionId` would hand `onWorkspaceChange` a definition id, which finds
     * no node, logs a warning nobody reads, and drops the builder's edit.
     */
    const target = editTargetFor(tab);

    if (target.kind === 'node') {
      // Both the workspace JSON and the generated code. `code` is `undefined` on a refusal.
      onWorkspaceChange?.(target.nodeId, workspace, code);
      return;
    }

    if (target.kind === 'definition') {
      // No `code`, on purpose: a definition is never generated on its own. See the prop.
      onDefinitionChange?.(target.definitionId, workspace);
    }
  };

  /**
   * VFN-004 — clicking a tab switches to it *and* goes to where its blocks live.
   *
   * Both, in that order, and unconditionally. "Already on that component" is not a case this
   * handler decides — `navigateToTabComponent` decides it, because the answer depends on the
   * canvas rather than on anything rendered here, and splitting one decision across two files is
   * how the two halves get out of step.
   *
   * 🔴 The navigation must not be written over the editor's router. `Router.route()` early-returns
   * when the route asked for is the route it is on, so editor→editor it is a silent no-op that
   * looks exactly like a dead click handler — which is to say, exactly like the bug being fixed.
   */
  const handleTabClick = (tabId: string) => {
    switchTab(tabId);

    const tab = tabs.find((t) => t.id === tabId);
    /**
     * 🔴 VFN-009 — only a tab that *lives* somewhere travels. A definition lives on a shelf, not
     * in a component, so sending one through `navigateToTabComponent` would land on
     * `tabActivation`'s `refuse-unknown` branch and put *"This tab does not know which component …
     * came from"* on screen — a refusal about a question nobody asked, delivered as an error toast
     * on an ordinary click.
     */
    if (tab && tabTravels(tab)) onTabActivate?.(tab);
  };

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation(); // Don't trigger tab switch
    closeTab(tabId);
  };

  /**
   * Close every tab, which is what closes the window.
   *
   * `closeTabs` fires `LogicBuilder.AllTabsClosed` when the last one goes, and that is the single
   * route by which the overlay closes — there is deliberately no separate "hide the window"
   * state to get out of step with which tabs are open. Saving is not a step here: an edit is
   * written to the node 300 ms after it settles, so by the time a hand has reached this button
   * the blocks are already on the model.
   *
   * ⚠️ One `closeTabs` call and not a loop of `closeTab`. A loop is batched into one render, so
   * every iteration reads the same `activeTabId` and the "was that the last one?" question is
   * answered against a tab list that is already out of date — with two tabs open, nothing emits
   * `AllTabsClosed` at all. See the note on `closeTabs`.
   */
  const handleCloseAll = () => {
    closeTabs(tabs.map((tab) => tab.id));
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
        {resolvedTabs.map(({ tab, componentLabel, componentPath }) => {
          const isActive = tab.id === activeTabId;
          const savedBlock = isDefinitionTab(tab);

          const segments = tabLabelSegments(tab, { componentName: componentLabel });
          /**
           * VFN-009 — a saved block is never *away*. The away mark means "the canvas is showing a
           * different component from the one these blocks live in", and a definition lives in no
           * component at all. `isTabAway` already answers `false` for a tab with no `componentId`
           * — this says so at the call site too, so the two cannot drift.
           */
          const away = !savedBlock && isTabAway(tab, activeComponentId);

          return (
            <div
              key={tab.id}
              className={`${css['Tab']} ${isActive ? css['isActive'] : ''} ${away ? css['isAway'] : ''}`}
              onClick={() => handleTabClick(tab.id)}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              title={
                savedBlock
                  ? definitionTabTooltip(tab.nodeName ?? '')
                  : tabTooltip(tab, { component: componentPath, away })
              }
              data-test="logic-builder-tab"
              data-subject={savedBlock ? 'definition' : 'node'}
              data-away={away ? 'true' : 'false'}
            >
              {/*
                The away mark. 🔴 A shape, not a colour: a hollow ring that is simply not in the
                DOM when the canvas is showing this tab's component, so it survives a screenshot,
                a greyscale print and either theme. A tinted label would satisfy a rubric and
                nothing else.

                `aria-hidden` because the same fact is already in the tab's `title` in words —
                see `tabTooltip`. Two announcements of one state is noise.
              */}
              {away ? <span className={css['AwayMark']} aria-hidden="true" /> : null}

              {/*
                VFN-009 — the saved-block mark. The same glyph the call block wears on its header
                field, so the tab and the block in the workspace are recognisably the same thing.
                A shape rather than a colour, for the reason the away mark is one; `aria-hidden`
                because the tab's `title` already says it in words.
              */}
              {savedBlock ? (
                <span className={css['SavedBlockMark']} aria-hidden="true">
                  ▣
                </span>
              ) : null}

              <span className={css['TabLabel']}>
                {segments.component ? (
                  <>
                    <span className={css['TabComponent']}>{segments.component}</span>
                    <span className={css['TabSeparator']} aria-hidden="true">
                      {LABEL_SEPARATOR}
                    </span>
                  </>
                ) : null}
                <span className={css['TabNode']}>{segments.node}</span>
              </span>

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
