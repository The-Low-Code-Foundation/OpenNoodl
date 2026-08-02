/**
 * LIB-006: the import shell — assess the source, write the report.
 *
 * Step 4 of the task, whose instruction was "reuse LIB-004's staging; do not
 * fork the engine". So this is what `apply.ts` calls around the existing
 * `applyModelChanges`:
 *
 *   1. {@link assessImport}                     read the source, build the report
 *   2. `applyLegacyTransforms` (./transforms)   mark placeholders, take the REST rewrite
 *   3. {@link writeImportReport}                both renderings into the target project
 *
 * Steps 1 and 3 live here because they are the impure ones — the catalog, the
 * React pattern set, the filesystem. Step 2 is next door in `transforms.ts` so
 * it stays testable without any of them.
 *
 * **Ordering is load-bearing.** Steps 1 and 2 run while the source project is
 * still whole. `applyModelChanges` re-keys every node id it grafts, so a marker
 * written afterwards would have nothing to address.
 *
 * @module noodl-editor/utils/import-engine/legacy/importAssessment
 */

import type { ProjectModel } from '@noodl-models/projectmodel';

import FileSystem from '../../filesystem';
import type { ImportPlan, ProjectData } from '../types';
import { assess } from './assess';
import { defaultCatalogQuery } from './catalogQuery';
import { reactRemovalPatterns } from './codePatterns';
import { buildReport, renderReportMarkdown } from './report';
import { IMPORT_REPORT_JSON_PATH, IMPORT_REPORT_MARKDOWN_PATH, ImportReport } from './types';

/** The subset of a live project this shell reads. */
interface SourceProjectLike {
  name?: string;
  version?: string;
  _retainedProjectDirectory?: string;
  toJSON(): unknown;
}

/** Component names in the plan that are actually going to be imported. */
function importedComponentNames(plan: ImportPlan): string[] {
  return plan.components.filter((c) => c.policy.action !== 'skip').map((c) => c.name);
}

/** True when at least one module travels with this import — see `assess()`. */
function modulesTravel(plan: ImportPlan): boolean {
  return plan.modules.some((m) => m.policy.action !== 'skip');
}

/**
 * Assess a planned import against the source project.
 *
 * Scoped to the components the plan will actually import: a report that flags
 * constructs in components the user did not select is a report they learn to
 * ignore.
 */
export function assessImport(
  plan: ImportPlan,
  sourceProject: ProjectModel,
  targetProjectName?: string,
  now?: Date
): ImportReport {
  const source = sourceProject as unknown as SourceProjectLike;
  const projectData = source.toJSON() as ProjectData;

  const { findings, constructsAssessed, nodeCount } = assess({
    sourceDir: plan.sourceDir,
    project: projectData,
    catalog: defaultCatalogQuery(),
    componentNames: importedComponentNames(plan),
    modulesTravelWithImport: modulesTravel(plan),
    codePatterns: reactRemovalPatterns()
  });

  return buildReport({
    sourceDir: plan.sourceDir,
    sourceProjectName: source.name,
    sourceProjectVersion: source.version === undefined ? undefined : String(source.version),
    targetProjectName,
    findings,
    constructsAssessed,
    nodeCount,
    now
  });
}

export interface WriteReportResult {
  written: string[];
  warnings: string[];
}

/**
 * Write both renderings into the target project directory.
 *
 * Stable paths, overwritten on each import. The task asks for "a committed file,
 * so it survives, and so a diff shows repairs landing against it" — a stable
 * path is precisely what makes that diff meaningful, and the project's own git
 * history is the record of previous imports. A timestamped filename per import
 * would give you an accumulating pile of files and no diff at all.
 */
export async function writeImportReport(
  report: ImportReport,
  targetProject: ProjectModel
): Promise<WriteReportResult> {
  const dir = (targetProject as unknown as SourceProjectLike)._retainedProjectDirectory;
  const written: string[] = [];
  const warnings: string[] = [];

  if (!dir) {
    return { written, warnings: ['The project has no directory on disk, so the import report was not written.'] };
  }

  const files: [string, string][] = [
    [IMPORT_REPORT_JSON_PATH, JSON.stringify(report, null, 2) + '\n'],
    [IMPORT_REPORT_MARKDOWN_PATH, renderReportMarkdown(report)]
  ];

  for (const [name, content] of files) {
    try {
      await FileSystem.instance.writeFile(`${dir}/${name}`, content);
      written.push(name);
    } catch (err) {
      warnings.push(`Failed to write ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { written, warnings };
}
