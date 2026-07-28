import { WireLabel } from './canvas/CanvasTheme';

import type { NodeGraphEditorConnection } from './NodeGraphEditorConnection';
import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * The editing overlay for an author-written wire label (CAN-002).
 *
 * A bare textarea, on the same pattern as the comment-box editor
 * (`CommentForeground`) and for the same reason: it lives in the editor's DOM
 * layer, which already carries the canvas's pan and zoom transform, so a
 * position in *graph* coordinates lands on the wire at any zoom without any
 * arithmetic here.
 *
 * One editing session is one undo entry — commit happens on blur or
 * ⌘/Ctrl+Enter, never per keystroke, and Escape puts the old text back.
 */
export class WireLabelEditor {
  private element: HTMLTextAreaElement | undefined;
  private connection: NodeGraphEditorConnection | undefined;
  private previous: string | undefined;
  private cancelled = false;

  constructor(private editor: NodeGraphEditor) {}

  get isOpen() {
    return !!this.element;
  }

  open(connection: NodeGraphEditorConnection) {
    if (this.editor.readOnly) return;

    this.close();

    const at = connection.pointOnCurve(connection.labelT());
    if (!at) return;

    this.connection = connection;
    this.previous = connection.model.label;
    this.cancelled = false;

    const textarea = document.createElement('textarea');
    textarea.className = 'nodegraph-wire-label-editor';
    textarea.value = connection.model.label || '';
    textarea.maxLength = WireLabel.maxLength;
    textarea.rows = 1;
    textarea.spellcheck = false;
    textarea.style.position = 'absolute';
    textarea.style.width = WireLabel.maxWidth + 'px';
    textarea.style.left = at.x - WireLabel.maxWidth / 2 + 'px';
    textarea.style.top = at.y - WireLabel.lineHeight + 'px';

    textarea.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') {
        this.cancelled = true;
        this.close();
        evt.stopPropagation();
      } else if (evt.key === 'Enter' && (evt.metaKey || evt.ctrlKey)) {
        this.close();
        evt.stopPropagation();
      }
    });
    // The canvas is listening for every mouse event on this layer; a click in
    // the field is not a click on the graph.
    textarea.addEventListener('mousedown', (evt) => evt.stopPropagation());
    textarea.addEventListener('blur', () => this.close());

    this.editor.domElementContainer.appendChild(textarea);
    this.element = textarea;

    textarea.focus();
    textarea.select();
  }

  /** Commit (or discard, after Escape) and tear down. Safe to call twice. */
  close() {
    const textarea = this.element;
    const connection = this.connection;
    if (!textarea || !connection) return;

    this.element = undefined;
    this.connection = undefined;

    const text = this.cancelled ? this.previous : textarea.value.trim();
    textarea.remove();

    // An empty label is indistinguishable from never having had one: the key
    // goes away rather than being stored as ''.
    const next = text ? text : undefined;
    if (next !== this.previous) {
      this.editor.model.updateConnection(
        connection.model,
        { label: next },
        { undo: true, label: next ? 'edit connection label' : 'remove connection label' }
      );
    }

    this.editor.repaint();
  }
}
