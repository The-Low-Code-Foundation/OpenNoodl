/**
 * LIB-006 — reading an import report back off disk.
 *
 * The editor half of the `currentReport` seam. Installed once at boot
 * (`router.setup.ts`), after which the authoring loop and anything else that
 * wants the open project's report gets it synchronously without knowing that a
 * filesystem was involved.
 *
 * @module noodl-editor/utils/import-engine/legacy/loadReport
 */

import { ProjectModel } from '@noodl-models/projectmodel';

import FileSystem from '../../filesystem';
import { setImportReportProvider } from './currentReport';
import { IMPORT_REPORT_FORMAT_VERSION, IMPORT_REPORT_JSON_PATH, ImportReport } from './types';

/**
 * Read and validate a project directory's import report.
 *
 * Returns `undefined` for every failure — absent file, unreadable file, bad
 * JSON, wrong format version — and never throws. A report is an aid; it must not
 * be able to break the project that carries it.
 *
 * Validation is deliberately shallow: format version, and the two fields
 * everything downstream indexes on. Deep-validating a file a user may have
 * hand-edited would reject more than it saved.
 */
export function readImportReport(projectDirectory: string): ImportReport | undefined {
  const path = `${projectDirectory}/${IMPORT_REPORT_JSON_PATH}`;
  try {
    if (!FileSystem.instance.fileExistsSync(path)) {
      return undefined;
    }
    const parsed = JSON.parse(FileSystem.instance.readFileSync(path, 'utf8')) as Partial<ImportReport>;
    if (parsed?.reportFormatVersion !== IMPORT_REPORT_FORMAT_VERSION) {
      return undefined;
    }
    if (!Array.isArray(parsed.findings) || !parsed.verdict) {
      return undefined;
    }
    return parsed as ImportReport;
  } catch (error) {
    console.warn('[lib-006] could not read the import report', error);
    return undefined;
  }
}

/**
 * Install the provider the authoring loop reads through.
 *
 * Reads on every call rather than caching: a repair that resolves a placeholder
 * should stop being described as unresolved, and the file is small enough that
 * re-reading it costs less than reasoning about when to invalidate a cache.
 */
export function installImportReport(): void {
  setImportReportProvider(() => {
    const dir = ProjectModel.instance?._retainedProjectDirectory;
    return dir ? readImportReport(dir) : undefined;
  });
}
