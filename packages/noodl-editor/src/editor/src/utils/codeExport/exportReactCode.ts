/**
 * EXP-012 — the editor's "Export as React code" command, and only its wiring.
 *
 * `@nodegx/export` had no consumer anywhere in the product until this file (P18 §21.1): the only
 * way to run the export was `ts-node scripts/emit-app.ts` by hand. Since HLS-002 there is a
 * second front door, `nodegx export`, and the two are required to produce identical trees — so
 * the *sequence* this command performs moved into `exportSequence.ts`, where a runner with no
 * Electron around it can drive it, and this file is what is left: the editor's singletons, and
 * the one thing only Electron can do.
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

import { REPORT_PATH } from '@nodegx/export';
import type { Catalog } from '@nodegx/export';
import { flushPendingProjectSave, ProjectModel } from '@noodl-models/projectmodel';

import catalogJson from '../../../../../../noodl-types/src/node-catalog.json';
import { PopupLayer } from '../../views/popuplayer';
import { ToastLayer } from '../../views/ToastLayer/ToastLayer';
import FileSystem from '../filesystem';
import { runExportSequence } from './exportSequence';

/**
 * The same catalog `nodegx export` reads. Custom nodes from `noodl_modules` are found by the
 * exporter on disk (EXP-010), not through the editor's kit overlay, so the raw catalog is the
 * right one to hand it.
 */
const catalog = catalogJson as unknown as Catalog;

function revealReport(outDir: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const shell = require('@electron/remote').shell;
  shell.showItemInFolder(path.join(outDir, REPORT_PATH));
}

/** The command. Safe to call from any UI surface; every failure is a toast, never a throw. */
export async function exportProjectAsReactCode(): Promise<void> {
  const project = ProjectModel.instance;

  await runExportSequence({
    projectDir: project?._retainedProjectDirectory,
    projectFormat: project?._projectFormat,
    catalog,
    fs,
    flushPendingProjectSave,
    showPreflight: (summary, onConfirm, onCancel) =>
      PopupLayer.instance.showCodeExportModal({ summary, onConfirm, onCancel }),
    chooseDirectory: (onChosen) => FileSystem.instance.chooseDirectory(onChosen, { allowCreateDirectory: true }),
    confirmOverwrite: (outDir, existing, onConfirm) =>
      PopupLayer.instance.showConfirmModal({
        title: 'That folder is not empty',
        message: `${outDir} already holds ${existing} item${
          existing === 1 ? '' : 's'
        }. Files with the same names as the export's will be overwritten; nothing else is touched.`,
        confirmLabel: 'Overwrite and export',
        onConfirm
      }),
    showError: (message, title) => ToastLayer.showError(message, { title }),
    showSuccess: (message, title, outDir) =>
      ToastLayer.showSuccess(message, {
        title,
        duration: 20000,
        actions: [{ label: 'Show in folder', onClick: () => revealReport(outDir) }]
      })
  });
}
