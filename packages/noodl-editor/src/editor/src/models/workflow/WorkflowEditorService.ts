/**
 * The one place that knows which workflow is open on the canvas (WFA-004).
 *
 * A workflow is not a project component, so `ProjectModel` cannot answer "what
 * is this canvas showing?" for one. This singleton can — which is what lets the
 * Workflows panel, the canvas HUD and the navigation history all agree without
 * any of them holding a reference to the others.
 *
 * Only one workflow is open at a time. That is not a limitation working around
 * something: a workflow belongs to one backend, and the canvas shows one graph.
 *
 * @module models/workflow/WorkflowEditorService
 */

import { NodeGraphContextTmp } from '../../contexts/NodeGraphContext/NodeGraphContext';
import Model from '../../../../shared/model';
import { clearDescent } from './workflowDescent';
import { WorkflowDocument } from './WorkflowDocument';

import type { WorkflowRef } from './types';

export enum WorkflowEditorEvent {
  /** The open workflow changed (including to none). */
  documentChanged = 'documentChanged',
  /** The open workflow gained or lost unsaved edits. */
  dirtyChanged = 'dirtyChanged',
  /** It was written back to the backend. */
  saved = 'saved'
}

export class WorkflowEditorService extends Model {
  public static instance = new WorkflowEditorService();

  private _document: WorkflowDocument | null = null;

  get document(): WorkflowDocument | null {
    return this._document;
  }

  /** Is the canvas currently showing this workflow? */
  isOpen(backendId: string, workflowId: string): boolean {
    return this._document?.ref.backendId === backendId && this._document?.definition.id === workflowId;
  }

  /**
   * Open a workflow on the canvas.
   *
   * `switchToComponent` is the canvas's only door, and the adapter is what goes
   * through it. `pushHistory` is deliberately false: `NavigationHistory`
   * resolves its entries through `ProjectModel.getComponentWithName`, which
   * cannot find a workflow — an entry pushed there would be silently discarded
   * on the next back/forward, which is worse than not offering it.
   */
  async open(ref: WorkflowRef): Promise<WorkflowDocument> {
    const document = await WorkflowDocument.open(ref);
    this.adopt(document);
    return document;
  }

  adopt(document: WorkflowDocument) {
    this._document?.dispose();
    // WFA-006: a descent points back at the workflow it came from, and that
    // workflow is about to be replaced. The pointer is cleared here rather than
    // left to expire, because `descentFor` matches on the FUNCTION component —
    // a stale pointer would offer a crumb back to a disposed document.
    clearDescent();
    this._document = document;

    document.on(
      'dirtyChanged',
      ({ dirty }: { dirty: boolean }) => this.notifyListeners(WorkflowEditorEvent.dirtyChanged, { dirty }),
      this
    );
    document.on('saved', (args: unknown) => this.notifyListeners(WorkflowEditorEvent.saved, args), this);

    NodeGraphContextTmp.switchToComponent?.(document.component, { pushHistory: false });
    this.notifyListeners(WorkflowEditorEvent.documentChanged, { document });
  }

  /** Leave the workflow canvas. Does not save — that is always deliberate. */
  close() {
    if (!this._document) return;
    this._document.off(this);
    this._document.dispose();
    this._document = null;
    clearDescent();
    this.notifyListeners(WorkflowEditorEvent.documentChanged, { document: null });
  }
}
