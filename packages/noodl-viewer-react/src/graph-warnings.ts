import type { ComponentModelLike, EditorConnectionLike, GraphModelLike } from '@noodl/types';

/**
 * Watches every component in the project and warns about the ones with more than
 * one visual root.
 *
 * Only roots after the first are flagged: a component renders exactly one visual
 * tree, so any additional root is detached and will never appear. The warning is
 * re-evaluated whenever a root is added or removed, and cleared on the surviving
 * root so the message moves rather than accumulating.
 */
export default class GraphWarnings {
  graphModel: GraphModelLike;
  editorConnection: EditorConnectionLike;

  constructor(graphModel: GraphModelLike, editorConnection: EditorConnectionLike) {
    this.graphModel = graphModel;
    this.editorConnection = editorConnection;

    this.graphModel.getAllComponents().forEach((c) => this._bindComponentModel(c));
    this.graphModel.on('componentAdded', (c: ComponentModelLike) => this._bindComponentModel(c), this);
    this.graphModel.on('componentRemoved', (c: ComponentModelLike) => c.removeListenersWithRef(this), this);
  }

  _bindComponentModel(c: ComponentModelLike): void {
    c.on('rootAdded', () => this._evaluateWarnings(c), this);
    c.on(
      'rootRemoved',
      (root: string) => {
        this.editorConnection.clearWarning(c.name, root, 'multiple-visual-roots-warning');
        this._evaluateWarnings(c);
      },
      this
    );
    this._evaluateWarnings(c);
  }

  _evaluateWarnings(c: ComponentModelLike): void {
    const roots = c.getRoots();

    // NOTE: `lenth` is a typo for `length`, so this guard has never fired —
    // `undefined === 0` is false. With no roots the code below then calls
    // `clearWarning(c.name, undefined, …)`. Harmless in practice (the loop body
    // is skipped and clearing a warning that was never sent is a no-op), so it is
    // recorded here rather than silently corrected: fixing the spelling changes
    // which calls reach the editor connection.
    if ((roots as { lenth?: number }).lenth === 0) return;

    this.editorConnection.clearWarning(c.name, roots[0], 'multiple-visual-roots-warning');
    for (let i = 1; i < roots.length; i++) {
      this.editorConnection.sendWarning(c.name, roots[i], 'multiple-visual-roots-warning', {
        message: "This node is detached from the main node tree<br>and won't be rendered",
        level: 'info'
      });
    }
  }

  dispose(): void {
    this.graphModel.getAllComponents().forEach((c) => {
      c.removeListenersWithRef(this);
    });

    this.graphModel.removeListenersWithRef(this);
  }
}
