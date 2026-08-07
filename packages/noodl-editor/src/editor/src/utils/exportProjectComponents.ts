import { ProjectModel } from '@noodl-models/projectmodel';

import { ViewerConnection } from '../ViewerConnection';
import { ImportFlowCancelled, openExportFlow } from '../views/ImportFlow';
import { ToastLayer } from '../views/ToastLayer/ToastLayer';
import FileSystem from './filesystem';
import { apply as applyPlan } from './import-engine';
import type { ImportPlan, ImportResult } from './import-engine';
import { guid } from './utils';

const archiver = require('archiver');
const fs = require('fs');

function _zipFolderContent(options) {
  const output = fs.createWriteStream(options.output);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  function _readDirRec(dir, _res) {
    const res = _res || [];

    const files = fs.readdirSync(dir);
    files.forEach((f) => {
      const stats = fs.statSync(dir + '/' + f);
      if (stats && stats.isDirectory()) {
        _readDirRec(dir + '/' + f, res);
      } else {
        res.push(dir + '/' + f);
      }
    });

    return res;
  }

  return new Promise(function (resolve, reject) {
    const folderPath = options.folder;

    // good practice to catch warnings (ie stat failures and other non-blocking errors)
    archive.on('warning', function (err) {
      console.log(err);
    });
    // good practice to catch this error explicitly
    archive.on('error', function (err) {
      reject(err);
    });
    output.on('close', function () {
      resolve(undefined);
    });
    // pipe archive data to the file
    archive.pipe(output);

    // @ts-expect-error untyped local helper
    const files: string[] = _readDirRec(folderPath);

    // Guard the empty-directory case: `files.pop()` would be undefined and the
    // original `f.substring(...)` crashed. An empty staging dir (e.g. exporting
    // a selection that produced no files) should yield an empty archive, not a
    // TypeError.
    if (files.length === 0) {
      archive.finalize();
      return;
    }

    archive.on('entry', function () {
      if (files.length > 0) {
        const next = files.pop();
        archive.file(next, { name: next.substring(folderPath.length + 1) });
      } else {
        archive.finalize();
      }
    });

    const first = files.pop();
    archive.file(first, { name: first.substring(folderPath.length + 1) });
  });
}

/** Stage the planned selection into a throwaway project and zip it up. */
async function stageAndZip(plan: ImportPlan): Promise<ImportResult> {
  const activityId = 'exporting-components';
  ToastLayer.showActivity('Exporting...', activityId);

  const exportName = 'export-' + guid();
  const exportDir = FileSystem.instance.getTempPath() + exportName;
  FileSystem.instance.makeDirectorySync(exportDir);

  const project = ProjectModel.fromJSON({
    name: 'Export',
    components: [],
    settings: {},
    version: '3',
    metadata: {},
    variants: []
  });
  project._retainedProjectDirectory = exportDir;

  const fail = (message: string): ImportResult => {
    ToastLayer.hideActivity(activityId);
    return {
      result: 'failure',
      message,
      componentsImported: [],
      variantsImported: [],
      stylesImported: { colors: [], text: [] },
      filesCopied: [],
      modulesCopied: [],
      warnings: []
    };
  };

  // The staging project is not the live one, so the viewer must not react to it
  // — same suspension the import paths use.
  ViewerConnection.instance.setWatchModelChangesEnabled(false);
  let result: ImportResult;
  try {
    result = await applyPlan(plan, project);
  } finally {
    ViewerConnection.instance.setWatchModelChangesEnabled(true);
  }

  if (result.result !== 'success') {
    ToastLayer.hideActivity(activityId);
    return result;
  }

  const written = await new Promise<{ result: string; message?: string }>((resolve) =>
    project.toDirectory(project._retainedProjectDirectory, resolve)
  );
  if (written.result !== 'success') return fail(written.message ?? 'Could not write the export');

  const destination = await new Promise<string | undefined>((resolve) =>
    FileSystem.instance.chooseDirectory(resolve)
  );
  if (!destination) return fail('No destination chosen — nothing was written.');

  try {
    await _zipFolderContent({ folder: exportDir, output: destination + '/' + exportName + '.zip' });
  } catch {
    return fail('Failed to create archive');
  }

  ToastLayer.hideActivity(activityId);
  return { ...result, filesCopied: [...result.filesCopied, `${exportName}.zip`] };
}

/**
 * Cmd+Shift+E. LIB-005 reframes the selection surface on the shared import flow
 * — dependency closure matters identically when packing something up, and it is
 * the same question ("what am I actually taking?"). The zip output and the
 * shortcut are unchanged.
 */
export function exportProjectComponents() {
  openExportFlow({
    title: 'Export components',
    subtitle: ProjectModel.instance?.name,
    sourceDir: ProjectModel.instance._retainedProjectDirectory,
    onExport: stageAndZip
  }).then(
    (result) => {
      if (result.result === 'success') ToastLayer.showSuccess('Export successful');
      else ToastLayer.showError(result.message ?? 'Export failed');
    },
    (err: unknown) => {
      if (err instanceof ImportFlowCancelled) return;
      ToastLayer.showError(err instanceof Error ? err.message : 'Export failed');
    }
  );
}
