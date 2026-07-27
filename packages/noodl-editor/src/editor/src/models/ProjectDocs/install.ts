/**
 * AIX-009 — boot wiring for project docs.
 *
 * Installed from `router.setup.ts` alongside `startExplainTargetTracking()`,
 * and for the same reason: the authoring loop needs the docs at session
 * construction, which happens long before anyone opens the Docs panel, and a
 * panel-mounted subscription would mean the first build of a session never sees
 * the project's conventions.
 *
 * Holds one `ProjectDocsModel` for the open project and one synchronous
 * snapshot of the three injectable bodies. The snapshot is refreshed on project
 * open, on every doc write, and on the model's external-edit poll — so editing
 * CONVENTIONS.md in VS Code changes what the next build is told, without
 * reopening the project.
 *
 * @module ProjectDocs/install
 */

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { ProjectModel } from '../projectmodel';
import { setProjectDocsProvider } from './currentDocs';
import type { ProjectDocsContent } from './docsText';
import { DocProposalStore } from './DocProposals';
import { DOCS_CHANGED, ProjectDocsModel } from './ProjectDocsModel';

let current: ProjectDocsModel | undefined;
let snapshot: ProjectDocsContent = {};
let installed = false;

/** The docs model for the open project, or undefined when none is open. */
export function currentProjectDocsModel(): ProjectDocsModel | undefined {
  return current;
}

/** Re-read the three injectable docs into the synchronous snapshot. */
async function refreshSnapshot(): Promise<void> {
  snapshot = current ? await current.content() : {};
}

async function bindProject(): Promise<void> {
  current?.dispose();
  current = ProjectDocsModel.forProject(ProjectModel.instance);
  snapshot = {};
  // Proposals belong to the project they were made against.
  DocProposalStore.instance.clear();
  if (!current) return;
  current.on(DOCS_CHANGED, () => void refreshSnapshot(), 'project-docs-install');
  current.startWatching();
  await refreshSnapshot();
}

/**
 * Install the docs provider and keep it bound to the open project. Idempotent.
 */
export function installProjectDocs(): void {
  if (installed) return;
  installed = true;

  setProjectDocsProvider(() => snapshot);

  EventDispatcher.instance.on(
    ['ProjectModel.instanceHasChanged', 'ProjectModel.importComplete'],
    () => void bindProject(),
    'project-docs-install'
  );

  // A project may already be open when this runs (HMR, or a boot order change).
  if (ProjectModel.instance) void bindProject();
}
