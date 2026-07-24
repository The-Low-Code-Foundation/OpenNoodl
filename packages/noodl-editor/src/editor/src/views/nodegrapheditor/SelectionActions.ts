import { SidebarModel } from '@noodl-models/sidebar';

import { ComponentModel } from '../../models/componentmodel';
import { NodeLibrary } from '../../models/nodelibrary';
import PopupLayer from '../popuplayer';
import * as HitTester from './canvas/HitTester';

import type { NodeGraphEditorNode } from './NodeGraphEditorNode';
import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * Selection *policy* for the node graph editor (PLAT-001 wave 2 extraction —
 * bodies moved verbatim from nodegrapheditor.ts): what click-select,
 * add-to-selection, deselect, clear and rect-multiselect mean, including the
 * sidebar/panel side effects and double-click navigation. Raw selection
 * *state* lives in `canvas/NodeSelector`.
 */
export class SelectionActions {
  constructor(private editor: NodeGraphEditor) {}

  deselect(args?: { disableHidePanels: boolean }) {
    const editor = this.editor;

    editor.commentLayer?.clearMultiselection();
    editor.selector.unselect();

    if (!args?.disableHidePanels) {
      SidebarModel.instance?.hidePanels();
    }

    // Broadcast a deselect event
    editor.notifyListeners('deselect');
  }

  clearSelection(args?: { disableHidePanels: boolean }) {
    const editor = this.editor;

    this.deselect(args);

    // Clear dragging connection
    if (editor.draggingConnection) {
      editor.closeConnectionPanels();
      editor.draggingConnection.fromNode.borderHighlighted = false;
      editor.draggingConnection.toNode.borderHighlighted = false;
      editor.draggingConnection = undefined;
    }

    // Clear any connections that are being deleted
    editor.setHighlightedConnection(undefined);
    editor.deleteModeConnection = undefined;

    // Close open popup
    PopupLayer.instance.hideAllModalsAndPopups();
    PopupLayer.instance.hideTooltip();
  }

  addNodeToSelection(node: NodeGraphEditorNode) {
    const editor = this.editor;

    if (editor.readOnly) {
      return;
    }

    const currentMultiselect = [...editor.selector.nodes];

    this.deselect();

    const index = currentMultiselect.indexOf(node);
    if (index === -1) {
      currentMultiselect.push(node);
    } else {
      currentMultiselect.splice(index, 1);
    }

    editor.selector.select(currentMultiselect);

    editor.repaint();
  }

  selectNode(node: NodeGraphEditorNode) {
    const editor = this.editor;

    if (editor.readOnly) {
      editor.notifyListeners('readOnlyNodeClicked', node.model);
      return;
    }

    // Always select the node in the selector if not already selected
    if (!node.selected) {
      this.clearSelection();
      editor.commentLayer?.clearSelection();
      node.selected = true;
      editor.selector.select([node]);
      editor.repaint();
    }

    // Always switch to the node in the sidebar (fixes property panel stuck issue)
    SidebarModel.instance.switchToNode(node.model);

    // Handle double-click navigation
    if (editor.leftButtonIsDoubleClicked) {
      if (node.model.type instanceof ComponentModel) {
        editor.switchToComponent(node.model.type, { pushHistory: true });
      } else {
        const componentPorts = node.model
          .getPorts()
          .filter((p) => p.plug === 'input' && NodeLibrary.nameForPortType(p.type) === 'component');

        //check if there's a type with the component name, if so switch to it
        const component = componentPorts.map((port) => node.model.parameters[port.name]).filter((c) => c !== undefined);
        const type = component.length && NodeLibrary.instance.getNodeTypeWithName(component[0]);

        if (type) {
          // @ts-expect-error TODO: this is wrong!
          editor.switchToComponent(type, { pushHistory: true });
        } else {
          //there was no type that matched, so forward the double click event to the sidebar
          SidebarModel.instance.invokeActive('doubleClick', node);
        }
      }
    }
  }

  multiselectNodes(x, y, x2, y2, mode) {
    const editor = this.editor;

    const selectRect = { x: Math.min(x, x2), y: Math.min(y, y2), width: Math.abs(x2 - x), height: Math.abs(y2 - y) };

    //select all comments
    editor.commentLayer.performMultiSelect(selectRect, mode);

    // Select all nodes with a vertex inside of the multiselect area
    const selected = HitTester.nodesInRect(editor.roots, selectRect);
    editor.selector.select(HitTester.resolveMultiselect(mode, editor.lastMultiselected, selected));
  }

  isHighlighted(node) {
    return this.editor.highlighted === node || this.editor.selector.isActive(node);
  }
}
