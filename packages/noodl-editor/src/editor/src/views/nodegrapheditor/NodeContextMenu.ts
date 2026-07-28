import React from 'react';

import { canExtractToComponent } from '@noodl-utils/ExtractToComponent';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';
import { PopupToolbar, PopupToolbarProps } from '@noodl-core-ui/components/popups/PopupToolbar';

import { SidebarModel } from '@noodl-models/sidebar';

import { CreateNewNodePanel } from '../createnewnodepanel';
import { ExplainPanel_ID } from '../panels/ExplainPanel';
import { rememberTarget } from '../panels/ExplainPanel/explainTarget';
import PopupLayer from '../popuplayer';
import { showContextMenuInPopup } from '../ShowContextMenuInPopup';
import { OverlayHandle } from './canvas/OverlayHost';
import { AABB } from './canvas/types';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';

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

    // Data Lineage - RETIRED FROM REACH (DEBT-012, 2026-07-25).
    // Decision is NOT to revive this panel: its tracing algorithm enumerates
    // ports instead of following wires and five fix attempts failed. The sidebar
    // registration is also commented out (router.setup.ts). Do not re-enable;
    // a deterministic rebuild belongs on the catalog/v2 substrate — see
    // dev-docs/future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md.
    // items.push({
    //   label: 'Show Data Lineage',
    //   icon: IconName.Link,
    //   onClick: () => {
    //     const selectedNode = editor.selector.nodes[0];
    //     if (selectedNode) {
    //       EventDispatcher.instance.emit('DataLineage.ShowForNode', {
    //         nodeId: selectedNode.model.id,
    //         componentName: editor.activeComponent?.fullName
    //       });
    //       SidebarModel.instance.switch('data-lineage');
    //     }
    //   },
    //   isDisabled: selectedNodes.length !== 1,
    //   tooltip: selectedNodes.length !== 1 ? 'Select a single node to trace its data lineage' : undefined,
    //   tooltipShowAfterMs: 300
    // });
    // items.push('divider');

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
}
