import React from 'react';

import { canExtractToComponent } from '@noodl-utils/ExtractToComponent';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { MenuDialogItem, MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { PopupToolbar, PopupToolbarProps } from '@noodl-core-ui/components/popups/PopupToolbar';

import { SidebarModel } from '@noodl-models/sidebar';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { CreateNewNodePanel } from '../createnewnodepanel';
import { ExplainPanel_ID } from '../panels/ExplainPanel';
import { rememberTarget } from '../panels/ExplainPanel/explainTarget';
import PopupLayer from '../popuplayer';
import { showContextMenuInPopup } from '../ShowContextMenuInPopup';
import { OverlayHandle } from './canvas/OverlayHost';
import { AABB } from './canvas/types';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';

import type { NodeGraphEditorConnection } from './NodeGraphEditorConnection';
import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * The floating node toolbar shown over a multi-selection and the right-click
 * context menu (PLAT-001 wave 2 extraction — bodies moved verbatim from
 * nodegrapheditor.ts).
 *
 * The toolbar React root is ephemeral and goes through the editor's
 * OverlayHost; `releaseToolbarHandle` exists so the editor's dispose (which
 * unmounts every host root in one sweep) can drop the stale handle without
 * touching the DOM again.
 */
export class NodeContextMenu {
  private toolbarOverlay: OverlayHandle | null = null;

  constructor(private editor: NodeGraphEditor) {}

  updateNodeToolbar() {
    this.hideNodeToolbar(); //hide existing toolbar, if any

    const selection = this.editor.selector.nodes;

    if (selection.length > 0 && !selection[0].selected) {
      const aabb = this.editor.calculateNodesAABB(selection);
      this.showNodeToolbar(selection, aabb);
    }
  }

  showNodeToolbar(selectedNodes: readonly NodeGraphEditorNode[], aabb: AABB) {
    const editor = this.editor;
    const menuItems: PopupToolbarProps['menuItems'] = [];

    const canExtract = canExtractToComponent(editor.model, selectedNodes);
    if (canExtract.allow) {
      menuItems.push({
        tooltip: 'Extract to component',
        icon: IconName.Component,
        onClick: () => {
          this.hideNodeToolbar();
          editor.extractSelectionToComponent();
        }
      });
    }

    if (
      selectedNodes.length === 1 &&
      CreateNewNodePanel.shouldShow({
        component: editor.model.owner,
        parentModel: selectedNodes[0].model
      })
    ) {
      menuItems.push({
        tooltip: 'Add new child',
        onClick: () => {
          this.hideNodeToolbar();

          editor.createNewNodePanel = new CreateNewNodePanel({
            model: editor.model,
            parentModel: editor.highlighted ? editor.highlighted.model : undefined,
            pos: { x: 0, y: 0 },
            runtimeType: editor.runtimeType
          });
          editor.createNewNodePanel.render();

          setTimeout(() => {
            PopupLayer.instance.showPopup({
              content: editor.createNewNodePanel,
              position: 'screen-center',
              isBackgroundDimmed: true,
              onClose: () => editor.createNewNodePanel.dispose()
            });
          }, 1);
        },
        icon: IconName.Plus
      });
    }

    const div = document.createElement('div');
    div.className = 'nodegraph-node-toolbar';
    editor.domElementContainer.appendChild(div);

    const pos = {
      x: (aabb.minX + aabb.maxX) / 2,
      y: aabb.minY
    };

    div.style.width = 'max-content';
    div.style.transform = 'translate(-50%, calc(-100% - 10px))';
    div.style.position = 'absolute';
    div.style.left = pos.x + 'px';
    div.style.top = pos.y + 'px';
    this.toolbarOverlay = editor.overlays.mount(
      div,
      React.createElement(PopupToolbar, {
        menuItems,
        contextMenuItems: this.getContextMenuActions()
      } as PopupToolbarProps)
    );
  }

  hideNodeToolbar() {
    this.toolbarOverlay?.unmount();
    this.toolbarOverlay = null;
    const toolbars = this.editor.domElementContainer.querySelectorAll('.nodegraph-node-toolbar');
    for (const toolbar of toolbars) {
      this.editor.domElementContainer.removeChild(toolbar);
    }
  }

  /** Drop the toolbar handle after OverlayHost.unmountAll — called from editor dispose. */
  releaseToolbarHandle() {
    this.toolbarOverlay = null;
  }

  getContextMenuActions() {
    const editor = this.editor;
    const items = [];

    const selectedNodes = editor.selector.nodes;

    const canExtract = canExtractToComponent(editor.model, selectedNodes);
    items.push({
      label: 'Extract to component',
      icon: IconName.Component,
      onClick: () => editor.extractSelectionToComponent(),
      isDisabled: !canExtract.allow,
      tooltip: canExtract.reason,
      tooltipShowAfterMs: 300
    });

    items.push('divider');

    // Explain. The ids have to be captured *here*, in the click handler: opening
    // the panel switches the sidebar, and switching away from the property
    // editor deselects every node (EditorEventBindings, on `activeChanged`), so
    // by the time the panel mounts there is nothing left to read.
    if (SidebarModel.instance.getItems().some((item) => item.id === ExplainPanel_ID)) {
      items.push({
        label: selectedNodes.length === 1 ? 'Explain this node' : `Explain these ${selectedNodes.length} nodes`,
        icon: IconName.MagicWand,
        onClick: () => {
          const componentName = editor.activeComponent?.fullName;
          if (!componentName) return;
          rememberTarget(
            componentName,
            selectedNodes.map((node) => node.model.id)
          );
          SidebarModel.instance.switch(ExplainPanel_ID);
        },
        isDisabled: selectedNodes.length === 0,
        tooltip: 'Ask what this does. Read-only — it never changes your project.',
        tooltipShowAfterMs: 300
      });

      items.push('divider');
    }

    // Comment (CAN-004). Single-select only: the popup is titled for one node
    // and writes one node's model. Reading a comment is not here — hovering the
    // node shows it, which is cheaper than any menu — and neither is removing
    // one, because submitting the popup empty already clears it and already
    // says so in its undo label.
    if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      items.push({
        label: node.model.hasComment() ? 'Edit comment' : 'Add comment',
        icon: IconName.NotePencil,
        onClick: () => node.showCommentEditPopup()
      });

      items.push('divider');
    }

    // OBS-002 — the provenance walk, which is what replaces the Data Lineage
    // panel retired from reach here in DEBT-012.
    //
    // ⚠️ The old entry asked for a *node* and let the panel work out what to
    // trace, which is how it ended up enumerating every port. This asks for a
    // **port**, one menu item per connected input, so the thing being walked is
    // named by the user rather than guessed. A node with no incoming wires
    // contributes no items at all — there is nothing upstream to walk.
    if (selectedNodes.length === 1) {
      const walkItems = this.getProvenanceMenuActions(selectedNodes[0]);
      if (walkItems.length) items.push(...walkItems, 'divider');
    }

    if (
      selectedNodes.length === 1 &&
      CreateNewNodePanel.shouldShow({
        component: editor.model.owner,
        parentModel: selectedNodes[0].model
      })
    ) {
      items.push({
        label: 'Add new child',
        onClick: () => {
          const selectedNode = editor.selector.nodes[0];
          editor.createNewNodePanel = new CreateNewNodePanel({
            model: editor.model,
            parentModel: selectedNode?.model,
            pos: { x: 0, y: 0 },
            runtimeType: editor.runtimeType
          });
          editor.createNewNodePanel.render();

          PopupLayer.instance.showPopup({
            content: editor.createNewNodePanel,
            position: 'screen-center',
            isBackgroundDimmed: true,
            onClose: () => editor.createNewNodePanel.dispose()
          });
        },
        icon: IconName.Plus
      });
    }

    items.push({
      label: 'Delete',
      onClick: () => editor.delete(),
      icon: IconName.Trash
    });

    // A graph may contribute its own actions (WFA-004: "Set as entry step").
    // The knowledge of what those mean stays in the graph model — this menu
    // only asks whether there are any, the way it already asks the component
    // whether a node can be created.
    const fromGraph = (editor.model as TSFixme)?.getContextMenuActions;
    if (typeof fromGraph === 'function') {
      const extra = fromGraph.call(
        editor.model,
        selectedNodes.map((n) => n.model.id)
      );
      if (Array.isArray(extra) && extra.length) {
        items.push('divider', ...extra);
      }
    }

    return items;
  }

  openRightClickMenu() {
    showContextMenuInPopup({
      items: this.getContextMenuActions(),
      width: MenuDialogWidth.Default,
      renderDirection: DialogRenderDirection.Horizontal
    });
  }

  /**
   * OBS-002 — "Why is this empty?", one item per connected input port.
   *
   * The spec's primary surface, and the reason it is primary: **the user can always point at
   * the symptom.** They can always say "this repeater is empty"; they cannot always say which
   * of six buttons was the relevant cause. So the entry point is the port they are complaining
   * about, not an interaction they have to remember.
   *
   * Capped at eight because this is a context menu, not the walk. A node with more inbound
   * wires than that is reachable through any one of them — the walk crosses the node anyway.
   */
  getProvenanceMenuActions(node: NodeGraphEditorNode): MenuDialogItem[] {
    const ports: string[] = [];
    for (const connection of node.model.getConnectionsOnThisNode()) {
      if (connection.toId !== node.model.id) continue;
      if (ports.indexOf(connection.toProperty) === -1) ports.push(connection.toProperty);
    }
    if (!ports.length) return [];

    return ports.slice(0, 8).map((port) => ({
      label: `Why is "${port}" empty?`,
      icon: IconName.Search,
      onClick: () => {
        EventDispatcher.instance.emit('provenance:walk', { node: node.model.id, port });
        SidebarModel.instance.switch('provenance');
      }
    }));
  }

  /**
   * Right-click on a wire (CAN-003 / F54). Wires had no menu at all — deleting
   * one meant discovering an undocumented two-click gesture.
   */
  getConnectionContextMenuActions(connection: NodeGraphEditorConnection): (MenuDialogItem | 'divider')[] {
    const editor = this.editor;

    return [
      {
        // The most direct entry the canvas has: a wire already names both a node and a port,
        // so nothing has to be inferred.
        label: 'Where does this come from?',
        icon: IconName.Search,
        onClick: () => {
          EventDispatcher.instance.emit('provenance:walk', {
            node: connection.model.toId,
            port: connection.model.toProperty
          });
          SidebarModel.instance.switch('provenance');
        }
      },
      'divider',
      {
        label: connection.model.label ? 'Edit label' : 'Add label',
        icon: IconName.NotePencil,
        onClick: () => editor.wireLabelEditor.open(connection)
      },
      'divider',
      {
        label: 'Delete connection',
        icon: IconName.Trash,
        onClick: () => {
          if (editor.selectedConnection === connection) editor.selectedConnection = undefined;
          editor.setHighlightedConnection(undefined);
          editor.removeConnection(connection.model);
        }
      }
    ];
  }

  openConnectionRightClickMenu(connection: NodeGraphEditorConnection) {
    this.editor.selectConnection(connection);

    showContextMenuInPopup({
      items: this.getConnectionContextMenuActions(connection),
      width: MenuDialogWidth.Default,
      renderDirection: DialogRenderDirection.Horizontal
    });
  }
}
