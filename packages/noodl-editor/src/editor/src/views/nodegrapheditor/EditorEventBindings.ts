import _ from 'underscore';

import { AiAssistantEvent, AiAssistantModel } from '@noodl-models/AiAssistant/AiAssistantModel';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { KeyCode } from '@noodl-utils/keyboard/KeyCode';
import { KeyboardCommand } from '@noodl-utils/keyboardhandler';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ComponentModel } from '../../models/componentmodel';
import { NodeLibrary } from '../../models/nodelibrary';
import { ProjectModel } from '../../models/projectmodel';
import { WarningsModel } from '../../models/warningsmodel';
import { ExplainPanel_ID } from '../panels/ExplainPanel';
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
/**
 * The model/library subscriptions previously set up inline in
 * NodeGraphEditor.render() (PLAT-001 wave 3 — bodies moved verbatim). Same
 * listener-context rule as above: every subscription binds with the editor as
 * context so dispose's `off(this)` calls detach them.
 */
export function registerRenderEventBindings(editor: NodeGraphEditor): void {
  //bind ai assistant
  AiAssistantModel.instance.on(
    AiAssistantEvent.ProcessingUpdated,
    () => {
      AiAssistantModel.instance.getProcessingNodeIds().length
        ? editor.startNodeAnimations()
        : editor.stopNodeAnimations();
    },
    editor
  );

  // Rerender if warnings model changed
  WarningsModel.instance.on(
    'warningsChanged',
    () => {
      editor.repaint();
    },
    editor
  );

  // When the node library is changed we may need to rerender
  NodeLibrary.instance.on(
    ['moduleRegistered', 'moduleUnregistered', 'typeAdded', 'typeRemoved', 'libraryUpdated'],
    () => {
      // We must re-resolve ports as they could have changed
      _.each(editor.connections, function (c) {
        c.resolvePorts();
      });

      // Relayout and paint
      editor.relayout();
      editor.repaint();
    },
    editor
  );

  // May change warning status
  EventDispatcher.instance.on(
    ['Model.portAdded', 'Model.portRemoved'],
    () => {
      editor.relayout();
      editor.repaint();
    },
    editor
  );

  // The module for the graph we are editing has been unregistered
  NodeLibrary.instance.on(
    'moduleUnregistered',
    (args) => {
      if (editor.model && args.model === editor.model.owner.owner) {
        editor.switchToComponent();
      }
    },
    editor
  );

  // The component we are editing has been removed
  NodeLibrary.instance.on(
    'typeRemoved',
    (args) => {
      if (editor.model && args.model === editor.model.owner) {
        editor.switchToComponent();
      }
    },
    editor
  );
}

/**
 * Which sidebar panels are allowed to keep the canvas selection alive.
 *
 * Opening any other panel clears it, so that a stale highlight never outlives
 * the panel that explained it. That rule costs a panel *about* the selection
 * everything: FH-008 measured Explain being handed an empty canvas every time,
 * because the deselect below runs on `activeChanged` — before the panel it is
 * switching to has read anything.
 *
 * A function rather than an exported array on purpose: `ExplainPanel_ID` comes
 * from a module that imports the canvas context back, and a top-level array
 * would capture it at module-init time.
 */
export function panelHoldsCanvasSelection(panelId: string): boolean {
  return panelId === 'PropertyEditor' || panelId === 'PortEditor' || panelId === ExplainPanel_ID;
}

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
      if (panelHoldsCanvasSelection(activeId) === false) {
        //deselect nodes when switching to a panel that has no use for a selection
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
