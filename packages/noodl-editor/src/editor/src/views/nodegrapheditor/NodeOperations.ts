import { EditorSettings } from '@noodl-utils/editorsettings';

import { NodeGraphNode, NodeGraphNodeJSON } from '../../models/nodegraphmodel';
import { guid } from '../../utils/utils';
import { IVector2, SnapSpacing } from './canvas/types';

import type { ComponentModel } from '../../models/componentmodel';
import type { NodeGraphEditorNode } from './NodeGraphEditorNode';
import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * Node/connection model mutations issued by the canvas (PLAT-001 wave 2
 * extraction — bodies moved verbatim from nodegrapheditor.ts): create,
 * attach/detach, drag-commit with undo, snap/nudge animation and connection
 * removal. Kept in one module so undo semantics stay in one place — the
 * InteractionController decides *when* these fire, this module (via the
 * editor's delegating methods) decides *what they mean* for the model.
 */
export class NodeOperations {
  constructor(private editor: NodeGraphEditor) {}

  createNewNode(type: ComponentModel, pos: IVector2, options: Partial<NodeGraphNodeJSON> = {}) {
    const editor = this.editor;

    const node = NodeGraphNode.fromJSON({
      type: type.name,
      x: pos.x,
      y: pos.y,
      id: guid(),
      ...options
    });

    if (editor.highlighted) {
      editor.highlighted.model.addChild(node, { undo: true, label: 'create' });
    } else {
      editor.model.addRoot(node, { undo: true, label: 'create' });
    }

    editor.clearSelection();
    editor.relayout();
    editor.repaint();
  }

  detachNode(node) {
    this.editor.model.detachNode(node, { undo: this.editor.dragNodesUndoGroup });
  }

  attachNode(parent, node, index) {
    this.editor.model.attachNode(parent, node, index, {
      undo: this.editor.dragNodesUndoGroup
    });
  }

  nudgeNode(node: NodeGraphEditorNode, x: number, y: number) {
    const editor = this.editor;

    const enabled = EditorSettings.instance.get('nodeGraphEditor.snapToGrid');
    if (!enabled) return;

    //nodes with parent's don't use their x and y coords, so just bail out
    if (node.parent || (node.x === x && node.y === y)) return;

    const startX = node.x;
    const startY = node.y;

    const startTime = performance.now();
    const anim = () => {
      const linearT = Math.min(1, (performance.now() - startTime) / 200);
      const easeOutT = 1 - Math.pow(1 - linearT, 4);

      node.x = startX * (1 - easeOutT) + x * easeOutT;
      node.y = startY * (1 - easeOutT) + y * easeOutT;

      editor.relayout();
      editor.repaint();

      if (easeOutT < 1) requestAnimationFrame(anim);
    };

    requestAnimationFrame(anim);
  }

  snapNodeToGrid(node: NodeGraphEditorNode) {
    const enabled = EditorSettings.instance.get('nodeGraphEditor.snapToGrid');
    if (!enabled) return;

    this.nudgeNode(
      node,
      Math.round(node.x / SnapSpacing) * SnapSpacing,
      Math.round(node.y / SnapSpacing) * SnapSpacing
    );
  }

  commitMoveNode(node) {
    const editor = this.editor;

    const from = { x: node.model.x, y: node.model.y };
    const to = { x: node.x, y: node.y };

    const move = (to) => {
      node.model.set(to);

      node.x = to.x;
      node.y = to.y;

      this.snapNodeToGrid(node);

      editor.relayout();
      editor.repaint();
    };

    // Make sure we can undo move nodes
    if (from.x !== to.x || from.y !== to.y) {
      move(to);
      editor.dragNodesUndoGroup.push({
        do: function () {
          move(to);
        },
        undo: function () {
          move(from);
        }
      });
    }
  }

  removeConnection(con) {
    this.editor.model.removeConnection(con, { undo: true, label: 'disconnect' });
  }
}
