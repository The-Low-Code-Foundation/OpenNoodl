/**
 * HLS-002 — `nodegx export`, the front door that is not a click.
 *
 * ## The sequence, and why it is the editor's
 *
 * The editor's menu item (`noodl-editor/.../codeExport/exportSequence.ts`) performs:
 * flush the pending save → parse → emit → show the pre-flight → choose a folder → refuse a bad
 * one → write files and copies → say what happened. This performs the same sequence with the
 * decisions supplied by argument instead of by a person, and it calls the *same* `parseProject`,
 * `emitApp`, `summarizePreflight`, `checkTarget` and `writeExport`. HLS-002's acceptance criterion
 * is that the two produce identical trees, which is only meaningful because the two are graded by
 * specs that drive each door's own module rather than the shared library twice.
 *
 * ## 🔴 The decision a CLI has to make that the editor does not
 *
 * The editor asks. When the chosen folder already holds something, it shows a confirm modal; the
 * author reads it and decides. **There is nobody to ask here.** The standing warning on this phase
 * is to decide refusals as though nobody is watching, because in CI nobody is — so a non-empty
 * folder is *refused* rather than silently overwritten, and the refusal names `--force`. The
 * failure that refusal prevents is not an error message: it is a pipeline that overwrites a
 * previous export into a folder holding an unrelated app, produces a folder that is half of each,
 * and exits 0.
 *
 * ## 🔴 The thing this command cannot know, and therefore says
 *
 * The exporter reads the project from **disk**. The editor flushes its debounced autosave first,
 * because it is the thing holding the unsaved edits. A CLI has no autosave to flush and no way to
 * detect an editor that does — there is no lock file, and opening a project writes no marker that
 * says "held". So it states what it read and when that was last written, on stderr, every time,
 * in both modes. Saying it every run is the point: a warning that fires only on a condition this
 * process cannot observe is a warning that never fires.
 */
import * as fs from 'fs';
import * as path from 'path';

import { loadCatalog } from '../catalog';
import { errorMessage } from '../errorMessage';
import { emitApp } from '../emit/emitApp';
import { renderPreflight, summarizePreflight } from '../emit/preflight';
import { REPORT_PATH } from '../emit/report';
import { EXPORTER_VERSION, parseProject } from '../parse/parseProject';
import { checkTarget, writeExport } from '../write/writeExport';
import { parseArgs, USAGE } from './args';
import { EXIT, ExitCode } from './exitCodes';

/** Where the command's words go. Injected so a spec can read them without a subprocess. */
export interface CliIO {
  out(text: string): void;
  err(text: string): void;
}

export const PROJECT_FILE = 'nodegx.project.json';
const LEGACY_PROJECT_FILE = 'project.json';

/**
 * The newest modification time among the files the export actually reads, or `null` if the walk
 * found nothing. Deliberately the *read set* — the project file and the component tree — rather
 * than the whole folder: a `node_modules` restore or a git checkout of a README would otherwise
 * report a save that never happened.
 */
export function lastWritten(projectDir: string): Date | null {
  let newest = 0;
  const consider = (file: string) => {
    try {
      const stat = fs.statSync(file);
      if (stat.isDirectory()) {
        for (const entry of fs.readdirSync(file)) consider(path.join(file, entry));
      } else if (stat.mtimeMs > newest) {
        newest = stat.mtimeMs;
      }
    } catch {
      // A file that vanished between readdir and stat is not this command's problem to report.
    }
  };
  consider(path.join(projectDir, PROJECT_FILE));
  const components = path.join(projectDir, 'components');
  if (fs.existsSync(components)) consider(components);
  return newest === 0 ? null : new Date(newest);
}

/** `2026-09-09 11:23:41`, local, because the reader is looking at their own clock. */
function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Whether this folder is a project this exporter can read, phrased as the sentence the person
 * needs rather than as the exception `parseProject` would throw (`ENOENT: no such file or
 * directory, open '…/nodegx.project.json'`, which names a file they have never heard of).
 */
export function readableProject(projectDir: string): { ok: true } | { ok: false; reason: string } {
  if (!fs.existsSync(projectDir)) {
    return { ok: false, reason: `There is no folder at ${projectDir}.` };
  }
  if (!fs.statSync(projectDir).isDirectory()) {
    return { ok: false, reason: `${projectDir} is a file, not a project folder.` };
  }
  if (fs.existsSync(path.join(projectDir, PROJECT_FILE))) return { ok: true };
  if (fs.existsSync(path.join(projectDir, LEGACY_PROJECT_FILE))) {
    return {
      ok: false,
      reason:
        `${projectDir} holds a legacy ${LEGACY_PROJECT_FILE}. Code export reads the v2 format ` +
        `(${PROJECT_FILE}). Open the project in the editor once and accept the migration it offers, ` +
        'then export it.'
    };
  }
  return {
    ok: false,
    reason: `${projectDir} is not a NodeGX project — it holds no ${PROJECT_FILE}.`
  };
}

/**
 * Runs one invocation and returns its exit code. Never throws for a cause the person can fix:
 * every refusal is a sentence and a code.
 */
export function runCli(argv: readonly string[], io: CliIO): ExitCode {
  const parsed = parseArgs(argv);

  if (parsed.kind === 'help') {
    io.out(USAGE + '\n');
    return EXIT.ok;
  }
  if (parsed.kind === 'version') {
    io.out(EXPORTER_VERSION + '\n');
    return EXIT.ok;
  }
  if (parsed.kind === 'usage') {
    io.err(parsed.problem + '\n\n' + USAGE + '\n');
    return EXIT.usage;
  }

  if (parsed.kind === 'serve') {
    // 🔴 `serve` listens rather than returning, so it is dispatched in `main.ts` before this
    // function is reached and lives in `cli/serve.ts`. This branch is what keeps the union total.
    // It is unreachable from the binary, and it says what happened rather than falling through to
    // the export path with a folder it would then treat as a project.
    io.err('`nodegx serve` is started by the binary directly, not through runCli.\n');
    return EXIT.serve;
  }

  const projectDir = path.resolve(parsed.projectDir);
  const readable = readableProject(projectDir);
  if (!readable.ok) {
    io.err(readable.reason + '\n');
    return EXIT.project;
  }

  const written = lastWritten(projectDir);
  io.err(
    `Reading ${projectDir} as it is on disk` +
      (written ? ` — last saved ${stamp(written)}` : '') +
      '.\nIf the editor has this project open with unsaved changes, save it first: this reads files, not the editor.\n'
  );

  // The target is judged before the project is parsed and emitted. The editor asks the other way
  // round because the author has already seen the pre-flight and is choosing where to put it;
  // here, refusing a folder after ten seconds of work the caller cannot use is just slower.
  let outDir: string | null = null;
  if (parsed.outDir !== null) {
    outDir = path.resolve(parsed.outDir);
    const verdict = checkTarget(projectDir, outDir, fs);
    if (verdict.ok === false) {
      io.err(verdict.reason + '\n');
      return EXIT.target;
    }
    if (verdict.existing > 0 && !parsed.force) {
      io.err(
        `${outDir} already holds ${verdict.existing} item${verdict.existing === 1 ? '' : 's'}. ` +
          'The editor asks before overwriting; there is nobody to ask here, so this is a refusal. ' +
          'Pass --force to write into it anyway (files with the same names are overwritten; nothing ' +
          'else is touched), or choose an empty folder.\n'
      );
      return EXIT.target;
    }
  }

  let app;
  let summary;
  try {
    const catalog = loadCatalog();
    app = emitApp(parseProject(projectDir, catalog), catalog);
    summary = summarizePreflight(app);
  } catch (error) {
    io.err(
      'The export could not be prepared, and nothing has been written.\n' +
        errorMessage(error) +
        '\n'
    );
    return EXIT.project;
  }

  if (parsed.dryRun) {
    // 🔴 Every return above this point happened before the first write, which is the point of the
    // mode. The summary goes to stdout because it is the answer to the question that was asked;
    // everything else this command says is on stderr, so `nodegx export --dry-run app > out.md`
    // is a clean report.
    io.out(renderPreflight(summary) + '\n');
    return summary.refusals > 0 ? EXIT.refusals : EXIT.ok;
  }

  let result;
  try {
    result = writeExport(projectDir, outDir as string, app, fs);
  } catch (error) {
    io.err(
      `${errorMessage(error)}\n` +
        `${outDir} now holds part of an app and will not build. Export again into an empty folder.\n`
    );
    return EXIT.write;
  }

  for (const note of app.notes) io.err(`note: ${note}\n`);
  const assets = result.copies > 0 ? ` and ${result.copies} copied asset${result.copies === 1 ? '' : 's'}` : '';
  const leftOut =
    summary.refusals > 0
      ? ` ${summary.refusals} thing${summary.refusals === 1 ? ' is' : 's are'} left out — read ${REPORT_PATH} first.`
      : ` Everything translated — ${REPORT_PATH} says how to build and run it.`;
  io.out(`${result.files} files${assets} written to ${outDir}.${leftOut}\n`);
  return EXIT.ok;
}
