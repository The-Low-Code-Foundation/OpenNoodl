import { ProjectModel } from '../../models/projectmodel';
import DebugInspector from '../../utils/debuginspector';

import type { NodeGraphEditorConnection } from './NodeGraphEditorConnection';
import type { NodeGraphEditorNode } from './NodeGraphEditorNode';
import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * Debug-inspector hover/show behaviour and the inspector view registry
 * (PLAT-001 wave 2 extraction — bodies moved verbatim from
 * nodegrapheditor.ts). The inspector *views* stay on `editor.inspectors`;
 * creation from the InspectorsModel lives in ModelBindings.bindDebugInspector.
 */
export class InspectorActions {
  private showInspectorTimeout: NodeJS.Timeout;

  constructor(private editor: NodeGraphEditor) {}

  setHighlightedNode(node: NodeGraphEditorNode, atPosition?) {
    const editor = this.editor;

    // Node inspector
    if (editor.model && !editor.readOnly) {
      // Don't show node inspection in read only mode
      clearTimeout(this.showInspectorTimeout);
      if (node) {
        // We have a new node selected, show inspector
        if (!this.getInspectorForNode(node)) {
          this.showInspectorTimeout = setTimeout(() => {
            this.hideInspectors();

            //and add new inspector
            DebugInspector.InspectorsModel.instanceForProject(ProjectModel.instance).addInspectorForNode({
              node: node.model,
              position: atPosition
            });
          }, 200);
        }
      }
    }

    editor.highlighted = node;
  }

  setHighlightedConnection(c: NodeGraphEditorConnection, atPosition?) {
    const editor = this.editor;

    // Don't show connection inspection in read only mode
    if (editor.readOnly) {
      return false;
    }

    // Connection inspector
    clearTimeout(this.showInspectorTimeout);
    if (c) {
      // FH-016: not while the pointer is on the label chip. The inspector is a
      // DOM element attached to a point on the curve and transformed
      // `translate(-50%, calc(-100% - 4px))` — its bottom edge lands 4px above
      // that point, which is the middle of the chip, so it covers the chip's
      // top half and swallows the press that was reaching for it. A grab handle
      // the user is already on outranks a value they can read anywhere else on
      // the wire.
      const overLabel = atPosition !== undefined && c.isPointInLabel(atPosition);

      if (overLabel) {
        // One may already be up from hovering the stroke on the way here.
        const showing = this.getInspectorForConnection(c);
        if (showing && !showing.isPinned()) showing.remove();
      }
      // We have a new connection selected, show inspector
      else if (c.isHealthy() && !this.getInspectorForConnection(c)) {
        this.showInspectorTimeout = setTimeout(() => {
          this.hideInspectors();

          DebugInspector.InspectorsModel.instanceForProject(ProjectModel.instance).addInspectorForConnection({
            connection: c.model,
            position: c.findClosestPointOnCurve(atPosition)
          });
        }, 200);
      }
    }

    // SIG-006 item 4: the hover direction mark. `highlightedConnection` changes
    // here and nowhere else, so this is where the mark's clock starts — and it
    // restarts on every *new* wire, so the bead always leaves the source rather
    // than being caught mid-flight. Re-entering the same wire (a move event
    // within the stroke) must not restart it, or the mark stutters under a
    // moving cursor.
    if (editor.highlightedConnection !== c) {
      editor.hoverMarkStartedAt = c ? performance.now() : undefined;
      if (c) editor.startNodeAnimations('hover-direction');
      else editor.stopNodeAnimations('hover-direction');
    }

    editor.highlightedConnection = c;
  }

  //hide all other inspectors that aren't pinned
  hideInspectors() {
    const inspectorsToRemove = this.editor.inspectors.filter((inspector) => !inspector.isPinned());
    for (const inspector of inspectorsToRemove) {
      inspector.remove();
    }
  }

  getInspectorForConnection(c) {
    return this.editor.inspectors.find((p) => p.connection === c);
  }

  getInspectorForNode(node) {
    return this.editor.inspectors.find((p) => p.node === node);
  }

  removeInspector(inspector) {
    const idx = this.editor.inspectors.indexOf(inspector);
    if (idx !== -1) {
      inspector.dispose();
      this.editor.inspectors.splice(idx, 1);
    }
  }

  findInspectorWithModel(model) {
    return this.editor.inspectors.find((inspector) => inspector.model === model);
  }
}
