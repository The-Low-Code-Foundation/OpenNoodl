import { filesystem } from '@noodl/platform';

import { ProjectModel } from '@noodl-models/projectmodel';

import * as Exporter from '../../exporter';
import { isCloudFunctionComponent } from '../../exporter/cloudFunctions';
import { DeployEnvironment } from '../build-context';
import { copyProjectFilesToFolder, formatCopyReportSummary, ProjectCopyReport } from './copy';
import { loadDeployIndex, copyDeployFilesToFolder, getExternalFolderPath } from './deploy-index';
import { HtmlProcessor, HtmlProcessorParameters } from './processors/html-processor';

export type DeployToFolderOptions = {
  project: ProjectModel;

  /**
   * The folder that we will publish the files to.
   */
  direntry: string;

  /**
   * The environment we want to publish with.
   */
  environment: DeployEnvironment | undefined;

  baseUrl: string;

  runtimeType?: string;
  envVariables?: Record<string, string>;
};

/**
 * Deployer is handling all the project deploy to a folder logic.
 *
 * This is also used when deploying to the Cloud
 * where it just copies over the built files.
 */
export type DeployToFolderResult = {
  /**
   * What the verbatim project-file copy included and excluded (DEP-008).
   * Surfaced to the user so an ignored asset is distinguishable from a lost one.
   */
  copyReport: ProjectCopyReport;
};

export async function deployToFolder({
  project,
  direntry,
  environment,
  baseUrl,
  envVariables,
  runtimeType = 'deploy'
}: DeployToFolderOptions): Promise<DeployToFolderResult> {
  // Check if this is a project folder
  try {
    const projectContent = await filesystem.readJson(direntry + '/project.json');
    if (projectContent) {
      return Promise.reject({ result: 'failure', message: 'Cannot deploy to a project folder.' });
    }

    // There is no project.json, this is not a project folder, good continue with the deploy
  } catch (error) {
    // noop; file doesn't exist
  }

  // Start by copying all files from the project folder to the deploy directory.
  // Everything not excluded by the ignore rules ships — see ./copy.ts.
  const copyReport = await copyProjectFilesToFolder(project._retainedProjectDirectory, direntry);
  logCopyReport(copyReport, direntry);

  // Export project
  const exportJson = Exporter.exportToJSON(project, {
    useBundles: true,
    useBundleHashes: true,
    environment,
    // Remove all the cloud function components. WFA-001: the shared predicate,
    // negated — `exportCloudFunctionsToJSON` keeps exactly what this drops, and
    // a spec asserts the two partition the component set.
    ignoreComponentFilter: (component) => !isCloudFunctionComponent(component)
  });

  if (!exportJson) {
    return Promise.reject({ result: 'failure', message: 'Failed to export project.' });
  }

  // Remove all keys from config that require master key
  const configSchema = exportJson.metadata['dbConfigSchema'];
  for (const key in configSchema) {
    if (configSchema[key].masterKeyOnly) delete configSchema[key];
  }

  // Read deploy description
  const index = await loadDeployIndex(`${runtimeType}/index.json`);

  // Copy all deploy files
  await copyDeployFilesToFolder({
    project,
    direntry,
    files: index,
    exportJson,
    baseUrl,
    envVariables,
    runtimeType
  });

  //then the export component bundles
  const dir = direntry + '/noodl_bundles/';
  for (const bundleId in exportJson.componentIndex) {
    if (bundleId !== 'root') {
      const json = JSON.stringify(Exporter.exportComponentBundle(project, bundleId, exportJson.componentIndex));
      if (!filesystem.exists(dir)) {
        await filesystem.makeDirectory(dir);
      }

      await filesystem.writeFile(dir + bundleId + '.json', json);
    }
  }

  return { copyReport };
}

/**
 * DEP-008 criterion 5: the deploy report states the excluded count and the rule
 * that excluded each path. The toast carries the count; the per-path list goes
 * here, where it survives the toast and can be copied out of the console.
 */
function logCopyReport(report: ProjectCopyReport, direntry: string): void {
  console.log(`[deploy] ${direntry}: ${report.copiedCount} project file(s) copied. ${formatCopyReportSummary(report)}`);

  if (report.excluded.length === 0) return;

  if (!report.hasIgnoreFile) {
    console.log('[deploy] No .noodlignore in the project — default rules only. See docs/runtime/DEPLOY-IGNORE.md.');
  }

  if (report.staleExclusions.length > 0) {
    console.warn(
      `[deploy] ${report.staleExclusions.length} excluded path(s) ALREADY EXIST in ${direntry} — left in place, ` +
        'almost certainly copied there by an earlier deploy. Delete them by hand if they must not be public:'
    );
    for (const stale of report.staleExclusions) {
      console.warn(`[deploy]       ${filesystem.join(direntry, stale)}`);
    }
  }

  for (const rule of report.excludedByRule) {
    const why = rule.reason ? ` — ${rule.reason}` : '';
    console.log(`[deploy]   ${rule.count}× excluded by ${rule.source} rule \`${rule.rule}\`${why}`);
    for (const file of report.excluded.filter((f) => f.rule === rule.rule && f.source === rule.source)) {
      console.log(`[deploy]       ${file.path}`);
    }
  }
}

export async function createIndexPage(project: ProjectModel, parameters: HtmlProcessorParameters) {
  // Read deploy description
  const index = await loadDeployIndex('deploy/index.json');

  // Find the "index.html" file
  const indexFile = index.find((entry) => entry.url === 'index.html');
  if (!indexFile) {
    throw new Error('Could not find index.html in deploy index.');
  }

  // Read the index.html file
  const indexFilePath = filesystem.join(getExternalFolderPath(), 'deploy', indexFile.url);
  const indexContent = await filesystem.readFile(indexFilePath);

  const htmlProcessor = new HtmlProcessor(project);
  const content = await htmlProcessor.process(indexContent, parameters);

  return content;
}
