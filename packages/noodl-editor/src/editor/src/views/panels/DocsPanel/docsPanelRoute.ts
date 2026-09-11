/**
 * BLD-003 — asking the Docs panel to show one particular file.
 *
 * The docs hand-off used to be the whole interaction: the review finished, and
 * the Build panel said *"N documents are waiting in the Docs panel"* — a
 * sentence that moves the user to another panel to make a decision they were
 * already looking at. D8's duplicate-surface half is that hand-off. The
 * decisions now live on their drafts, in the thread; the Docs panel keeps its
 * diff view, and this is how *"Review changes"* opens it on the right file
 * instead of on whatever was selected last.
 *
 * The shape is `settingsPanelRoute`'s, for its reasons: the panel is mounted by
 * `SidebarModel` outside any provider this module could reach, so a module-level
 * value plus a DOM event is what crosses that gap. Requesting *before* the
 * switch means a first mount reads it synchronously and never renders the wrong
 * file first.
 *
 * @module noodl-editor/views/panels/DocsPanel/docsPanelRoute
 */

import { SidebarModel } from '@noodl-models/sidebar';

/**
 * The registered panel id.
 *
 * Declared here rather than in `DocsPanel.tsx` so this module can route without
 * importing the panel — `DocsPanel.tsx` re-exports it as `DocsPanel_ID`, which
 * is the name the rest of the editor already uses.
 */
export const DOCS_PANEL_ID = 'project-docs';

/** Project-relative path, e.g. `docs/ARCHITECTURE.md`. */
let requestedPath: string | null = null;

export const DOCS_PATH_EVENT = 'nodegx:docs-path-requested';

/** Consumed once, by the panel, on mount or on the event. */
export function takeRequestedDocPath(): string | null {
  const path = requestedPath;
  requestedPath = null;
  return path;
}

/**
 * Open the Docs panel showing `path`.
 *
 * When a proposal is pending for that file the panel shows its diff, because
 * the panel already picks the pending proposal whose path matches the selected
 * file. So this needs no proposal id — routing by *file* keeps this module
 * ignorant of `DocProposalStore`, and a stale id (accepted meanwhile) would
 * open on nothing rather than on the file the user asked to see.
 */
export function openDocsPanelAt(path: string): void {
  requestedPath = path;
  window.dispatchEvent(new CustomEvent(DOCS_PATH_EVENT));
  SidebarModel.instance.switch(DOCS_PANEL_ID);
}
