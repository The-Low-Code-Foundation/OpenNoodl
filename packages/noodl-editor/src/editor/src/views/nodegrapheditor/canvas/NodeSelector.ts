import type { NodeGraphEditorNode } from '../NodeGraphEditorNode';

/**
 * Selection state for the node graph canvas (PLAT-001 extraction — moved
 * verbatim from nodegrapheditor.ts, where it was the private `Selector` class).
 *
 * Pure state holder: it tracks which node views are selected and clears their
 * `selected` highlight flag on unselect. Selection *policy* (what a click or
 * multiselect means) stays with the editor and InteractionController.
 */
export class NodeSelector {
  private _selected: NodeGraphEditorNode[] = [];

  public get active() {
    return this._selected.length > 0;
  }

  public get nodes(): readonly NodeGraphEditorNode[] {
    return this._selected;
  }

  public isActive(node: NodeGraphEditorNode) {
    return this._selected.indexOf(node) !== -1;
  }

  public select(nodes: NodeGraphEditorNode[]) {
    this._selected = nodes;
  }

  public unselect() {
    //remove selection highlight, if any
    if (this._selected.length === 1) {
      this._selected[0].selected = false;
    }

    this._selected = [];
  }

  public unselectNode(node: NodeGraphEditorNode) {
    const index = this._selected.indexOf(node);
    if (index === -1) {
      return;
    }

    //remove selection highlight, if any
    if (node.selected) {
      node.selected = false;
    }

    this._selected.splice(index, 1);
  }
}
