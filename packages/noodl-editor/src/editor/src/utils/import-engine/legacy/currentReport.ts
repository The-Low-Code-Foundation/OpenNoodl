/**
 * LIB-006 — the synchronous seam between "the open project's import report" and
 * the authoring loop.
 *
 * Same shape, and the same reasons, as AIX-009's `ProjectDocs/currentDocs`:
 * `AuthoringSession` is constructed synchronously and must run in the headless
 * measurement bundle, where there is no `ProjectModel`, no Electron and no
 * filesystem. Reading `import-report.json` is both. So the loop asks *this*
 * module — a settable provider holding a snapshot — and the editor installs a
 * provider at boot.
 *
 * Nothing here imports the filesystem, so importing it from `AuthoringSession`
 * or `ContextBuilder` keeps the headless bundle clean. With no provider
 * installed the loop simply sees a project that was never imported, which is the
 * correct answer for the harness and the pre-LIB-006 behaviour.
 *
 * @module noodl-editor/utils/import-engine/legacy/currentReport
 */

import type { ImportReport } from './types';

export type ImportReportProvider = () => ImportReport | undefined;

let provider: ImportReportProvider | null = null;

/** Install (or, with `null`, remove) the provider. Last call wins. */
export function setImportReportProvider(next: ImportReportProvider | null): void {
  provider = next;
}

/**
 * The open project's import report, or `undefined` when nothing is installed,
 * the project was never imported, or the file is unreadable.
 *
 * Never throws. A malformed report must not be able to stop someone authoring a
 * component — the whole point of the report is to help, and a helper that can
 * break the thing it helps with is worse than no helper.
 */
export function currentImportReport(): ImportReport | undefined {
  if (!provider) {
    return undefined;
  }
  try {
    return provider() ?? undefined;
  } catch (error) {
    console.warn('[lib-006] import-report provider failed; authoring without it', error);
    return undefined;
  }
}
