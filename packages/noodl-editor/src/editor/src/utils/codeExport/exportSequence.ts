/**
 * The editor's code export, as a sequence rather than as a screen.
 *
 * ## Why this is a module of its own (HLS-002)
 *
 * HLS-002's acceptance criterion is that `nodegx export` and the editor's menu item produce
 * **identical trees**, and its stated trap is that the criterion is easy to fake: if the spec
 * calls the shared library twice the diff is trivially empty and proves nothing about the
 * product. What has to be driven is the editor's own path — the flush, the format refusal, the
 * pre-flight, the folder check, the confirm, the write, the sentence at the end — in that order.
 *
 * Before this, that path was `exportReactCode.ts`, and it was unreachable from any runner: it
 * names `ProjectModel`, the popup layer, the toast layer, Electron's directory dialog and
 * `@electron/remote`. So the sequence lives here, taking every one of those as a function, and
 * `exportReactCode.ts` is the wiring that supplies the real ones. This is the same boundary a
 * dozen other modules in this editor are on (see `tsconfig.tests-main.json`), and here it is
 * load-bearing rather than convenient: **this phase's whole subject is that everything which
 * ships an app is behind a click.** A sequence only a mouse can start is one only a mouse can
 * grade.
 *
 * ## What is deliberately still in `exportReactCode.ts`
 *
 * Reaching for `ProjectModel.instance`, building the real dependency record, and revealing the
 * report in the OS file manager. Those are wiring, they are asserted at source level in
 * `tests-unit/hls002-two-doors/`, and none of them can be run without Electron.
 */

import {
  checkTarget,
  emitApp,
  errorMessage,
  parseProject,
  summarizePreflight,
  writeExport,
  REPORT_PATH
} from '@nodegx/export';
import type { Catalog, EmittedApp, FsLike, PreflightSummary } from '@nodegx/export';

/** Everything the sequence needs from the editor, supplied rather than imported. */
export interface ExportDeps {
  /** The open project's directory, or `null`/`undefined` when nothing is open from disk. */
  projectDir: string | null | undefined;
  /** `ProjectModel._projectFormat`. Only `'v2'` is exportable. */
  projectFormat: string | undefined;
  /** The catalog `@nodegx/export` reads. The same one the CLI loads. */
  catalog: Catalog;
  /** Node's `fs`, injected for the same reason `writeExport` takes it. */
  fs: FsLike;
  /** 🔴 The debounced autosave. The exporter reads from **disk**, so this has to finish first. */
  flushPendingProjectSave(): Promise<void>;
  /** Show the pre-flight and call back with the author's decision. */
  showPreflight(summary: PreflightSummary, onConfirm: () => void, onCancel: () => void): void;
  /** Ask for a folder. Called back with `undefined` when the author cancels. */
  chooseDirectory(onChosen: (outDir?: string) => void): void;
  /** Ask before overwriting into a folder that already holds something. */
  confirmOverwrite(outDir: string, existing: number, onConfirm: () => void): void;
  showError(message: string, title: string): void;
  showSuccess(message: string, title: string, outDir: string): void;
}

/**
 * What happened, for a caller that wants to know — the specs, mostly. The editor itself shows a
 * toast and moves on, which is why every one of these is also a sentence on screen.
 */
export type ExportOutcome =
  | { kind: 'no-project' }
  | { kind: 'not-v2' }
  | { kind: 'prepare-failed'; message: string }
  | { kind: 'cancelled-preflight' }
  | { kind: 'cancelled-folder' }
  | { kind: 'target-refused'; reason: string }
  | { kind: 'write-failed'; message: string }
  | { kind: 'written'; outDir: string; files: number; copies: number; refusals: number };

function writeAndReport(
  deps: ExportDeps,
  projectDir: string,
  outDir: string,
  app: EmittedApp,
  summary: PreflightSummary,
  settle: (outcome: ExportOutcome) => void
) {
  let written: { files: number; copies: number };
  try {
    written = writeExport(projectDir, outDir, app, deps.fs);
  } catch (error) {
    const message = errorMessage(error);
    deps.showError(
      `${message}\nThe folder holds part of an app and will not build; export again into an empty folder.`,
      'Export failed part-way'
    );
    settle({ kind: 'write-failed', message });
    return;
  }

  const assets = written.copies > 0 ? ` and ${written.copies} copied asset${written.copies === 1 ? '' : 's'}` : '';
  const leftOut =
    summary.refusals > 0
      ? ` ${summary.refusals} thing${summary.refusals === 1 ? ' is' : 's are'} left out — read ${REPORT_PATH} first.`
      : ` Everything translated — ${REPORT_PATH} says how to build and run it.`;
  deps.showSuccess(
    `${written.files} files${assets} written to ${outDir}.${leftOut}`,
    `Exported ${summary.projectName}`,
    outDir
  );
  settle({ kind: 'written', outDir, files: written.files, copies: written.copies, refusals: summary.refusals });
}

function chooseFolderAndWrite(
  deps: ExportDeps,
  projectDir: string,
  app: EmittedApp,
  summary: PreflightSummary,
  settle: (outcome: ExportOutcome) => void
) {
  deps.chooseDirectory((outDir?: string) => {
    if (!outDir) {
      settle({ kind: 'cancelled-folder' });
      return;
    }

    const verdict = checkTarget(projectDir, outDir, deps.fs);
    // `=== false`, not `!`: the editor's tsconfig is not strict, and truthiness does not narrow there.
    if (verdict.ok === false) {
      deps.showError(verdict.reason, 'Choose a different folder');
      settle({ kind: 'target-refused', reason: verdict.reason });
      return;
    }

    if (verdict.existing === 0) {
      writeAndReport(deps, projectDir, outDir, app, summary, settle);
      return;
    }

    // 🔴 The editor asks. `nodegx export` refuses instead and names `--force`, because there is
    // nobody at the other end of a pipeline to answer this modal. The two doors differ here on
    // purpose, and only here — everything downstream of the answer is the same code.
    deps.confirmOverwrite(outDir, verdict.existing, () =>
      writeAndReport(deps, projectDir, outDir, app, summary, settle)
    );
  });
}

/**
 * The command. Resolves when the export has finished, been refused, or been cancelled — every
 * failure is a sentence on screen, never a throw.
 */
export async function runExportSequence(deps: ExportDeps): Promise<ExportOutcome> {
  const projectDir = deps.projectDir;
  if (!projectDir) {
    deps.showError('Open a project saved on disk first.', 'Nothing to export');
    return { kind: 'no-project' };
  }

  if (deps.projectFormat !== 'v2') {
    deps.showError(
      'Code export reads the v2 project format (nodegx.project.json). Migrate this project first — the option is offered when it opens.',
      'This project is in the legacy format'
    );
    return { kind: 'not-v2' };
  }

  // The exporter reads the files on disk, and the autosave is debounced by a second.
  await deps.flushPendingProjectSave();

  let app: EmittedApp;
  let summary: PreflightSummary;
  try {
    const ir = parseProject(projectDir, deps.catalog);
    app = emitApp(ir, deps.catalog);
    summary = summarizePreflight(app);
  } catch (error) {
    const message = errorMessage(error);
    console.error('Code export failed before writing anything:', error);
    deps.showError(message, 'The export could not be prepared');
    return { kind: 'prepare-failed', message };
  }

  return new Promise<ExportOutcome>((resolve) => {
    deps.showPreflight(
      summary,
      () => chooseFolderAndWrite(deps, projectDir, app, summary, resolve),
      () => resolve({ kind: 'cancelled-preflight' })
    );
  });
}
