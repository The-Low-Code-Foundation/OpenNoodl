/**
 * EXP-012 — the editor's "Export as React code" command.
 *
 * `@nodegx/export` had no consumer anywhere in the product until this file (P18 §21.1): the only
 * way to run the export was `ts-node scripts/emit-app.ts` by hand. This is the command, and it is
 * deliberately the same sequence that script performs, with the author's decisions in between:
 *
 *   1. flush the pending autosave, because the exporter reads the project from **disk**;
 *   2. parse and emit in memory — pure, nothing written, about a tenth of a second;
 *   3. show the exact pre-flight and let the author decide whether to proceed;
 *   4. pick a folder, refuse one inside the project, confirm if it is not empty;
 *   5. write every generated file and every copied asset, then point at `EXPORT-REPORT.md`.
 *
 * ⚠️ Only the v2 project format is exportable — `parseProject` reads `nodegx.project.json` — so
 * a legacy project is told to migrate rather than shown a confusing failure.
 */

import * as fs from 'fs';
import * as path from 'path';

import { emitApp, parseProject, summarizePreflight, REPORT_PATH } from '@nodegx/export';
import type { Catalog, EmittedApp, PreflightSummary } from '@nodegx/export';
import { flushPendingProjectSave, ProjectModel } from '@noodl-models/projectmodel';

import catalogJson from '../../../../../../noodl-types/src/node-catalog.json';
import { PopupLayer } from '../../views/popuplayer';
import { ToastLayer } from '../../views/ToastLayer/ToastLayer';
import FileSystem from '../filesystem';
import { checkTarget, writeExport } from './writeExport';

/**
 * The same catalog `scripts/emit-app.ts` reads. Custom nodes from `noodl_modules` are found by
 * the exporter on disk (EXP-010), not through the editor's kit overlay, so the raw catalog is
 * the right one to hand it.
 */
const catalog = catalogJson as unknown as Catalog;

function revealReport(outDir: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const shell = require('@electron/remote').shell;
  shell.showItemInFolder(path.join(outDir, REPORT_PATH));
}

function writeAndReport(projectDir: string, outDir: string, app: EmittedApp, summary: PreflightSummary) {
  let written: { files: number; copies: number };
  try {
    written = writeExport(projectDir, outDir, app, fs);
  } catch (error) {
    ToastLayer.showError(
      `${error instanceof Error ? error.message : String(error)}\nThe folder holds part of an app and will not build; export again into an empty folder.`,
      { title: 'Export failed part-way' }
    );
    return;
  }

  const assets = written.copies > 0 ? ` and ${written.copies} copied asset${written.copies === 1 ? '' : 's'}` : '';
  const leftOut =
    summary.refusals > 0
      ? ` ${summary.refusals} thing${summary.refusals === 1 ? ' is' : 's are'} left out — read ${REPORT_PATH} first.`
      : ` Everything translated — ${REPORT_PATH} says how to build and run it.`;
  ToastLayer.showSuccess(`${written.files} files${assets} written to ${outDir}.${leftOut}`, {
    title: `Exported ${summary.projectName}`,
    duration: 20000,
    actions: [{ label: 'Show in folder', onClick: () => revealReport(outDir) }]
  });
}

function chooseFolderAndWrite(projectDir: string, app: EmittedApp, summary: PreflightSummary) {
  FileSystem.instance.chooseDirectory(
    (outDir?: string) => {
      if (!outDir) return;

      const verdict = checkTarget(projectDir, outDir, fs);
      // `=== false`, not `!`: the editor's tsconfig is not strict, and truthiness does not narrow there.
      if (verdict.ok === false) {
        ToastLayer.showError(verdict.reason, { title: 'Choose a different folder' });
        return;
      }

      if (verdict.existing === 0) {
        writeAndReport(projectDir, outDir, app, summary);
        return;
      }

      PopupLayer.instance.showConfirmModal({
        title: 'That folder is not empty',
        message: `${outDir} already holds ${verdict.existing} item${
          verdict.existing === 1 ? '' : 's'
        }. Files with the same names as the export's will be overwritten; nothing else is touched.`,
        confirmLabel: 'Overwrite and export',
        onConfirm: () => writeAndReport(projectDir, outDir, app, summary)
      });
    },
    { allowCreateDirectory: true }
  );
}

/** The command. Safe to call from any UI surface; every failure is a toast, never a throw. */
export async function exportProjectAsReactCode(): Promise<void> {
  const project = ProjectModel.instance;
  const projectDir = project?._retainedProjectDirectory;

  if (!project || !projectDir) {
    ToastLayer.showError('Open a project saved on disk first.', { title: 'Nothing to export' });
    return;
  }

  if (project._projectFormat !== 'v2') {
    ToastLayer.showError(
      'Code export reads the v2 project format (nodegx.project.json). Migrate this project first — the option is offered when it opens.',
      { title: 'This project is in the legacy format' }
    );
    return;
  }

  // The exporter reads the files on disk, and the autosave is debounced by a second.
  await flushPendingProjectSave();

  let app: EmittedApp;
  let summary: PreflightSummary;
  try {
    const ir = parseProject(projectDir, catalog);
    app = emitApp(ir, catalog);
    summary = summarizePreflight(app);
  } catch (error) {
    console.error('Code export failed before writing anything:', error);
    ToastLayer.showError(error instanceof Error ? error.message : String(error), {
      title: 'The export could not be prepared'
    });
    return;
  }

  PopupLayer.instance.showCodeExportModal({
    summary,
    onConfirm: () => chooseFolderAndWrite(projectDir, app, summary),
    onCancel: () => undefined
  });
}
