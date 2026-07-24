import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { KeyCode } from '@noodl-utils/keyboard/KeyCode';
import { KeyboardCommand } from '@noodl-utils/keyboardhandler';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ComponentModel } from '../../models/componentmodel';
import { ProjectModel } from '../../models/projectmodel';
import { SnapSpacing } from './canvas/types';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * The editor-wide event subscriptions and keyboard commands previously set up
 * inline in the NodeGraphEditor constructor (PLAT-001 wave 2 extraction —
 * bodies moved verbatim).
 *
 * Every subscription uses the *editor* as the listener context so the
 * pre-existing teardown (`EventDispatcher.instance.off(this)` and
 * `SidebarModel.instance.off(this)` in dispose) detaches them unchanged.
 * The returned keyboard commands are registered and later deregistered by
 * the editor.
 */
export function registerEditorEventBindings(editor: NodeGraphEditor): KeyboardCommand[] {
  EventDispatcher.instance.on(
    ['DebugInspectorConnectionPulseChanged'],
    () => {
      editor.repaint();
    },
    editor
  );

  EventDispatcher.instance.on(
    'ProjectModel.instanceHasChanged',
    (args) => {
      args.oldInstance && args.oldInstance.off(editor);
      if (ProjectModel.instance === undefined) return;

      editor.bindProjectModel();
      editor.navigationHistory.discardInvalidEntries();
    },
    editor
  );

  // Listen for component switch requests from ComponentsPanel
  EventDispatcher.instance.on(
    'ComponentPanel.SwitchToComponent',
    (args: { component: ComponentModel; pushHistory?: boolean }) => {
      if (args.component) {
        editor.switchToComponent(args.component, {
          pushHistory: args.pushHistory
        });
      }
    },
    editor
  );

  // Listen for Logic Builder tab opened - hide canvas
  EventDispatcher.instance.on(
    'LogicBuilder.TabOpened',
    () => {
      console.log('[NodeGraphEditor] Logic Builder tab opened - hiding canvas');
      editor.setCanvasVisibility(false);
    },
    editor
  );

  // Listen for all Logic Builder tabs closed - show canvas
  EventDispatcher.instance.on(
    'LogicBuilder.AllTabsClosed',
    () => {
      console.log('[NodeGraphEditor] All Logic Builder tabs closed - showing canvas');
      // Track close time to prevent accidental node deletions during focus transition
      editor.lastBlocklyTabCloseTime = Date.now();
      editor.setCanvasVisibility(true);
    },
    editor
  );

  // Listen for Logic Builder tab open requests (for opening tabs from property panel)
  EventDispatcher.instance.on(
    'LogicBuilder.OpenTab',
    (args: { nodeId: string; nodeName: string; workspace: string }) => {
      console.log('[NodeGraphEditor] Opening Logic Builder tab for node:', args.nodeId);
      // The CanvasTabs context will handle the actual tab opening
    },
    editor
  );

  SidebarModel.instance.on(
    SidebarModelEvent.activeChanged,
    (activeId) => {
      const isNodePanel = activeId === 'PropertyEditor' || activeId === 'PortEditor';
      if (isNodePanel === false) {
        //deselect nodes when switching away from property editor or port editor
        editor.deselect({ disableHidePanels: true });
        editor.repaint();
      }
    },
    editor
  );

  return [
    {
      handler: () => editor.setSpaceKeyDown(true),
      keybinding: KeyCode.Space,
      type: 'down'
    },
    {
      handler: () => editor.setSpaceKeyDown(false),
      keybinding: KeyCode.Space,
      type: 'up'
    },
    {
      handler: () => {
        for (const node of editor.selector.nodes) {
          editor.nudgeNode(node, node.x + SnapSpacing, node.y);
        }
      },
      keybinding: KeyCode.RightArrow,
      type: 'down'
    },
    {
      handler: () => {
        for (const node of editor.selector.nodes) {
          editor.nudgeNode(node, node.x - SnapSpacing, node.y);
        }
      },
      keybinding: KeyCode.LeftArrow,
      type: 'down'
    },
    {
      handler: () => {
        for (const node of editor.selector.nodes) {
          editor.nudgeNode(node, node.x, node.y - SnapSpacing);
        }
      },
      keybinding: KeyCode.UpArrow,
      type: 'down'
    },
    {
      handler: () => {
        for (const node of editor.selector.nodes) {
          editor.nudgeNode(node, node.x, node.y + SnapSpacing);
        }
      },
      keybinding: KeyCode.DownArrow,
      type: 'down'
    }
  ];
}
