import { clipboard } from 'electron';
import _ from 'underscore';

import { BasicNodeType } from '@noodl-models/nodelibrary/BasicNodeType';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';
import { extractToComponent, labelForPath } from '@noodl-utils/ExtractToComponent';

import { ComponentModel } from '../../models/componentmodel';
import { peekRunningLesson, protectedByLesson, protectionMessage } from '../../models/lessonprotection';
import { NodeGraphNodeSet } from '../../models/nodegraphmodel';
import { ProjectModel } from '../../models/projectmodel';
import type { NodeGraphEditor } from '../nodegrapheditor';
import PopupLayer from '../popuplayer';
import { ToastLayer } from '../ToastLayer/ToastLayer';
import { ExtractToComponentPopup } from './ExtractToComponentPopup';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';

/**
 * Clipboard and node-set actions for the node graph editor (PLAT-001 wave 2
 * extraction — bodies moved verbatim from nodegrapheditor.ts).
 *
 * Owns copy/cut/paste/delete, node-set insertion (also used by the AI
 * assistant and nodeset import) and extract-to-component. All model mutations
 * go through the same undo groups as before; the editor exposes delegating
 * methods with the original names as the public API.
 */
export class EditorClipboard {
  /** In-memory fallback used when the OS clipboard has no parseable node set. */
  private clipboard: NodeGraphNodeSet;

  constructor(private editor: NodeGraphEditor) {}

  getSelectedNodes(): NodeGraphEditorNode[] {
    return [...this.editor.selector.nodes];
  }

  copySelected() {
    const editor = this.editor;
    const nodes = editor.selector.nodes;

    // Make sure all nodes can be copied
    const _invalid = nodes.filter((n) => !n.model.canBeCopied());
    if (_invalid.length !== 0) {
      ToastLayer.showError('One or more of these nodes cannot be copied.');
      return;
    }

    // Update coordinates so they are pasted correctly
    const nodeModels = nodes.map((n) => {
      n.x = n.global.x;
      n.y = n.global.y;
      n.updateModel();
      return n.model;
    });

    const nodeset = editor.model.getNodeSetWithNodes(nodeModels);
    nodeset.comments = editor.commentLayer.getSelectedComments();

    if (nodes.length > 0 || nodeset.comments.length > 0) {
      this.clipboard = nodeset.clone();
      this.clipboard.strip();
      clipboard.writeText(JSON.stringify(this.clipboard.toJSON()));
    } else {
      this.clipboard = undefined;
    }

    ToastLayer.showInteraction('Copied');

    return nodeset;
  }

  delete() {
    const editor = this.editor;

    if (editor.readOnly) {
      return false;
    }

    // Guard against accidental deletions during Blockly tab close transition
    // This prevents nodes from being deleted if a Blockly tab was just closed
    const timeSinceBlocklyClose = Date.now() - editor.lastBlocklyTabCloseTime;
    if (timeSinceBlocklyClose < 200) {
      console.warn('[NodeGraphEditor] Ignoring delete during Blockly tab close transition');
      return false;
    }

    // A selected wire is what Delete means (CAN-003). Wire and node selection
    // are exclusive, so this never competes with a node deletion.
    if (editor.selectedConnection) {
      const connection = editor.selectedConnection;
      editor.selectedConnection = undefined;
      editor.setHighlightedConnection(undefined);
      editor.removeConnection(connection.model);
      return;
    }

    const nodes = [...editor.selector.nodes];

    // Make sure all nodes can be deleted
    const _invalid = nodes.filter((n) => !n.model.canBeDeleted());
    if (_invalid.length !== 0) {
      ToastLayer.showError('One or more of these nodes cannot be deleted.');
      return;
    }

    /**
     * 🔴 FIX-025 — in a lesson, deleting a node a step is grading asks first.
     *
     * Richard: *"it's easy to accidentally delete bits of the tutorial app that are needed to
     * complete the session, and you might not remember what you deleted."* The problem is not
     * that the delete is irreversible — undo exists — it is that nothing connects the delete to
     * the step that stops completing several minutes later.
     *
     * ⚠️ **A confirm, never a refusal.** The lesson's own first step says *"Edit it freely — that
     * IS the lesson."* See `lessonprotection.ts`.
     *
     * ⚠️ `peekRunningLesson()` is `null` in every ordinary project, so this whole branch is
     * inert outside a lesson without `EditorClipboard` knowing anything about lessons.
     */
    const lessonSteps = peekRunningLesson();
    if (lessonSteps) {
      // ⚠️ `forEachNode` STOPS on a truthy return, so this callback must return nothing —
      // `push` returns the new length, which would abort the walk after the first node and
      // silently make every type-only condition look like the last of its type.
      const everyNodeInComponent: ReturnType<typeof nodeProtectionView>[] = [];
      editor.model?.forEachNode((n: never) => {
        everyNodeInComponent.push(nodeProtectionView(n));
      });
      const findings = protectedByLesson(nodes.map((n) => nodeProtectionView(n.model)), lessonSteps, everyNodeInComponent);
      const message = protectionMessage(findings);
      if (message) {
        PopupLayer.instance.showConfirmModal({
          title: 'This is part of the lesson',
          message,
          confirmLabel: 'Delete anyway',
          cancelLabel: 'Keep it',
          onConfirm: () => this.performDelete(nodes),
          onCancel: () => undefined
        });
        return;
      }
    }

    this.performDelete(nodes);
  }

  /** The delete itself, once anything that wanted to ask about it has. */
  private performDelete(nodes: NodeGraphEditorNode[]) {
    const editor = this.editor;
    const undo = new UndoActionGroup({ label: 'delete nodes' });

    if (editor.commentLayer && editor.commentLayer.hasSelection()) {
      editor.commentLayer.deleteSelection({ undo: undo });
    }

    const models = _.pluck(nodes, 'model');
    editor.model.removeNodeSet(editor.model.getNodeSetWithNodes(models), {
      undo: undo
    });

    UndoQueue.instance.push(undo);
  }

  copy() {
    this.copySelected();
  }

  cut() {
    if (this.editor.readOnly) {
      return false;
    }

    const nodeset = this.copySelected();
    if (nodeset === undefined) return;

    const undoCut = new UndoActionGroup({ label: 'cut' });
    this.editor.model.removeNodeSet(nodeset, { undo: undoCut });
    UndoQueue.instance.push(undoCut);

    ToastLayer.showInteraction('Cut');
  }

  getNodeSetFromClipboard() {
    try {
      const text = clipboard.readText();
      if (!text) return;

      var json = JSON.parse(text);
    } catch (e) {
      // Failed to parse clipboard text as json
      return;
    }

    return NodeGraphNodeSet.fromJSON(json);
  }

  insertNodeSet({
    nodeset,
    x,
    y,
    toastMessage
  }: {
    nodeset: NodeGraphNodeSet;
    x: number;
    y: number;
    toastMessage: string;
  }): NodeGraphNodeSet | null {
    const editor = this.editor;

    if (editor.readOnly) {
      return null;
    }

    const ns = nodeset.clone();

    // Check create status for all node types
    const component = editor.model.owner;
    const errors: string[] = [];

    function checkCreateStatus(nodes: NodeGraphNodeSet['nodes']) {
      for (const node of nodes) {
        if (node.type instanceof ComponentModel) {
          const status = component.getCreateStatus({
            type: node.type
          });

          if (!status.creatable) {
            errors.push(status.message);
          }
        } else if (node.type instanceof BasicNodeType) {
          if (node.type.runtimeTypes && !node.type.runtimeTypes.includes(editor.runtimeType)) {
            errors.push('One or more of these nodes cannot be created here.');
          }
        }

        checkCreateStatus(node.children);
      }
    }

    checkCreateStatus(ns.nodes);

    if (errors.length > 0) {
      // There were create errors
      const msg = {};
      for (let j = 0; j < errors.length; j++) {
        msg[errors[j]] = true;
      }
      let _msg = '';
      for (const i in msg) {
        _msg += i;
      }
      ToastLayer.showError(_msg);
      return;
    }

    ns.setOriginPosition({ x, y });

    const undoNodeSet = new UndoActionGroup({ label: 'paste' });
    editor.model.insertNodeSet(ns, { undo: undoNodeSet });
    undoNodeSet.push({
      undo: () => {
        editor.clearSelection();
        editor.commentLayer.clearSelection();
      }
    });
    UndoQueue.instance.push(undoNodeSet);

    // Select all nodes
    const multiselected = [];
    for (const i in ns.nodes) {
      const model = ns.nodes[i];
      model.forEach((m) => {
        multiselected.push(editor.findNodeWithId(m.id));
      });
    }

    editor.selector.select(multiselected);

    //and comments
    if (ns.comments) {
      editor.commentLayer.setSelectedCommentIds(ns.comments.map((c) => c.id));
    }

    editor.layout();
    editor.updateNodeToolbar();
    editor.repaint();

    ToastLayer.showInteraction(toastMessage);

    return ns;
  }

  paste() {
    const ns = this.getNodeSetFromClipboard() || this.clipboard;
    if (!ns) return;

    this.insertNodeSet({
      nodeset: ns,
      x: this.editor.interaction.latestMousePos.x,
      y: this.editor.interaction.latestMousePos.y,
      toastMessage: 'Paste'
    });
  }

  nodesetFromSelection() {
    const editor = this.editor;
    const nodes = editor.selector.nodes;

    // Make sure all nodes can be copied
    const _invalid = nodes.filter((n) => !n.model.canBeCopied());
    if (_invalid.length !== 0) {
      PopupLayer.instance.showToast('One of more of these nodes cannot be copied');
      return;
    }

    // Update coordinates so they are pasted correctly
    const nodeModels = nodes.map((n) => {
      n.x = n.global.x;
      n.y = n.global.y;
      n.updateModel();
      return n.model;
    });

    const nodeset = editor.model.getNodeSetWithNodes(nodeModels);
    nodeset.comments = editor.commentLayer.getSelectedComments();

    return nodeset;
  }

  /**
   * Ask for a name and a destination, then extract.
   *
   * This used to be one click that created `<current component>/Extracted
   * component` — nested under whatever component the nodes were born in, under
   * a name nobody chose — so a project accumulated `Extracted component 4`s in
   * places their authors could not find again. Everything below the dialog is
   * unchanged; the dialog only decides the *name*, which is also the location.
   */
  extractSelectionToComponent() {
    const editor = this.editor;
    const sourceComponent = editor.model.owner;
    if (!ProjectModel.instance || !sourceComponent) return;

    const nodeset = this.nodesetFromSelection();
    if (!nodeset) return; // a node in the selection refused to be copied

    // Snapshotted before the dialog opens: `selector.nodes` is the live
    // selection, and the extraction must act on what the user had selected when
    // they asked for it.
    const selection = [...editor.selector.nodes];

    const aabb = editor.calculateNodesAABB(selection);

    const pos = {
      x: (aabb.minX + aabb.maxX) / 2 - NodeGraphEditorNode.size.width / 2,
      y: aabb.minY
    };

    const popup = new ExtractToComponentPopup({
      projectModel: ProjectModel.instance,
      sourceComponent,
      onConfirm: (componentName: string) => {
        extractToComponent(ProjectModel.instance, editor.model, nodeset, selection, pos, componentName);

        editor.clearSelection();
        editor.relayout();
        editor.repaint();

        ToastLayer.showSuccess(`Extracted to ${labelForPath(componentName)}`);
      }
    });
    popup.render();

    PopupLayer.instance.showPopup({
      content: popup,
      position: 'screen-center',
      isBackgroundDimmed: true,
      // The shell pins itself to the content's measured height otherwise, and a
      // wrapped validation message would paint outside its own background.
      hasDynamicHeight: true
    });
  }
}

/** A node model as `lessonprotection` needs to see it. Kept here so that module stays editor-free. */
function nodeProtectionView(model: { id: string; label?: string; type?: { name?: string } }) {
  return { id: model.id, label: model.label, typeName: model.type?.name };
}
