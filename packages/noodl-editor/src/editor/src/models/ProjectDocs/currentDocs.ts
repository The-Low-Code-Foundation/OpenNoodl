/**
 * AIX-009 — the synchronous seam between "the open project's docs" and the
 * authoring loop.
 *
 * `AuthoringSession` is constructed synchronously and must run in the headless
 * measurement bundle, where there is no `ProjectModel`, no Electron and no
 * `filesystem`. Reading `docs/` is asynchronous and very much editor-side. So
 * the loop asks *this* module — a settable provider holding a snapshot — and
 * the editor installs a provider at boot (`installProjectDocs`), exactly as the
 * explain-target tracking is installed at boot rather than at panel mount.
 *
 * Nothing here imports the filesystem, so importing it from
 * `AuthoringSession`/`ContextBuilder` keeps the headless bundle clean. With no
 * provider installed the loop simply sees a project with no docs, which is the
 * correct answer for the harness and for the pre-AIX-009 behaviour.
 *
 * @module ProjectDocs/currentDocs
 */

import type { ProjectDocsContent } from './docsText';

export type ProjectDocsProvider = () => ProjectDocsContent;

let provider: ProjectDocsProvider | null = null;

/** Install (or, with `null`, remove) the provider. Last call wins. */
export function setProjectDocsProvider(next: ProjectDocsProvider | null): void {
  provider = next;
}

/**
 * The open project's doc bodies, or `{}` when nothing is installed or the
 * project has no docs. Never throws — a broken docs read must not be able to
 * stop someone authoring a component.
 */
export function currentProjectDocs(): ProjectDocsContent {
  if (!provider) return {};
  try {
    return provider() ?? {};
  } catch (error) {
    console.warn('[project-docs] provider failed; authoring without project docs', error);
    return {};
  }
}
