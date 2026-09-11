/**
 * HLS-008 — `export_react`: an agent finishes building an app and ships it in the same
 * conversation.
 *
 * ## Why this calls the CLI rather than the library it is made of
 *
 * `@nodegx/export` exports every piece of the sequence — `parseProject`, `emitApp`,
 * `summarizePreflight`, `renderPreflight`, `checkTarget`, `writeExport` — and assembling them here
 * would have worked on the day it was written. AC2 asks for something stronger than that: the
 * pre-flight this tool returns must be **byte-identical** to the one `nodegx export --dry-run`
 * prints, and stay that way. A second assembly of the same six calls is a second description of
 * one behaviour, and the two drift the first time either door grows a step.
 *
 * So this builds `argv` and calls {@link runCli} with a {@link CliIO} that captures instead of
 * printing. **There is one sequence and it is spelled once**; the identity is structural, and the
 * spec that asserts it is a regression test on the wiring rather than the thing keeping it true.
 * The same argument HLS-002 made for the editor's door and the binary sharing `writeExport`, one
 * layer up.
 *
 * ## What this door decides that the other two do not
 *
 * 🔴 **The CLI's refusals name flags, and an agent cannot type a flag.** `nodegx export` refuses a
 * non-empty output folder with *"Pass --force to write into it anyway"* — correct for a terminal
 * and useless here, where the caller's only vocabulary is this tool's arguments. The refusal text
 * is still returned **verbatim**, because it is the product's own account of what happened and two
 * wordings of it is two things to keep true; {@link noteFor} adds the sentence that translates it
 * into this door's argument names. One account, one addressing line — the shape `open_in_editor`
 * uses for the same reason.
 *
 * ⚠️ **`exit` is in the payload on purpose.** The CLI's exit table exists because a pipeline can
 * only branch on a number, and an agent orchestrating a build is the same reader: "the folder was
 * refused" (3) and "the project could not be read" (2) want different next moves, and prose that
 * has to be matched is not a branch.
 *
 * ## The disk, and who wrote it last
 *
 * The exporter reads the project from **disk**, and says so on every run — a warning `run.ts`
 * deliberately fires unconditionally, because the condition it warns about (an editor holding
 * unsaved edits) is one no exporting process can observe. That warning is *more* apt here, not
 * less: this server writes its own changes synchronously, so an app authored over MCP is on disk
 * by the time the authoring tool returns — but the person may well have the same project open in
 * an editor, which is exactly the collision `open_in_editor` exists because of.
 *
 * @module tools/exportReact
 */

import * as path from 'path';

import { CliIO, EXIT, ExitCode, runCli } from '@nodegx/export';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { ToolError } from '../errors';
import type { ProjectBinding } from '../project/ProjectBinding';
import { guarded, jsonResult } from './util';

export interface ExportReactResponse {
  /**
   * The command did what was asked. **Always true on a returned payload** — a refusal is a
   * `ToolError`, not a field.
   *
   * 🔴 It is not the same question as "did everything translate", and conflating the two is the
   * defect this phase keeps finding. `nodegx export` exits 0 on a real export that left things out,
   * deliberately, so a project with a known deferral can still ship; only `--dry-run` turns
   * refusals into a non-zero code, because that is the mode a pipeline gates on. See
   * {@link everythingTranslates}.
   */
  ok: true;
  /**
   * The exit code `nodegx export` would have returned for the same request. Branch on this;
   * {@link EXIT} in `@nodegx/export` is the table, and it is the same table the CLI publishes.
   */
  exit: number;
  /** The name of that code — `ok`, `refusals` — so a reader is not mapping integers by hand. */
  outcome: string;
  /**
   * `dry_run` only: whether the export would leave nothing out.
   *
   * ⚠️ Absent on a real export **on purpose**. The exit code does not carry it there, and the only
   * other source is the prose in {@link written} — a boolean derived by matching a sentence is a
   * boolean that goes wrong silently the day the sentence is reworded. The report in the output
   * folder is the answer, and {@link note} says so.
   */
  everythingTranslates?: boolean;
  /** The project that was read, resolved — which may not be the one the caller named. */
  projectDir: string;
  outDir?: string;
  /**
   * `dry_run` only: the pre-flight, **verbatim**. Byte-for-byte what
   * `nodegx export --dry-run <project>` prints on stdout, newline included.
   */
  preflight?: string;
  /** A real export only: the one-line account of what was written. */
  written?: string;
  /**
   * Everything the command said on the way — the disk warning it fires every run, and any
   * `note:` lines the export produced. Verbatim, for the same reason {@link preflight} is.
   */
  said: string;
  note: string;
}

/**
 * The name of an exit code, so a payload reader is not left mapping integers by hand.
 * Derived from {@link EXIT} rather than re-typed, so a seventh code cannot appear here as
 * `undefined`.
 */
const EXIT_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(EXIT).map(([name, code]) => [code, name])
);

/**
 * How a refusal reaches the caller: as a typed failure with the CLI's own words.
 *
 * 🔴 **The message is the CLI's stderr and nothing else.** Re-wording a refusal here would give
 * the product two accounts of the same decision, which is the failure AC2 names for the pre-flight
 * and which is no less a failure for a target refusal. The translation goes in a separate
 * sentence, appended, so the two are distinguishable by a reader and by a diff.
 */
function refusal(code: ExitCode, said: string, translation: string): ToolError {
  const kind = code === EXIT.project ? 'not-found' : code === EXIT.write ? 'io-error' : 'invalid-argument';
  return new ToolError(kind, said.trim() + (translation ? '\n\n' + translation : ''), {
    exit: code,
    outcome: EXIT_NAMES[code]
  });
}

/** The sentence this door adds, in each outcome the CLI's own words do not address. */
export function noteFor(code: ExitCode, dryRun: boolean): string {
  switch (code) {
    case EXIT.ok:
      return dryRun
        ? 'Nothing was written. Everything in this project translates, so an export with an `out_dir` will ' +
            'produce a complete app.'
        : 'The app is written. It is a Vite + React project: `npm install && npm run build` in that folder ' +
            'builds it, and EXPORT-REPORT.md in it says what the export did and did not translate.';
    case EXIT.refusals:
      return (
        'Nothing was written — this was a dry run. The summary above lists what will not translate; an ' +
        'export with an `out_dir` still succeeds and records the same list in EXPORT-REPORT.md, so this ' +
        'is a thing to read rather than a thing to fix before shipping.'
      );
    case EXIT.target:
      // 🔴 The CLI's own refusal says `--force`, which is not reachable from here. Named rather
      // than left to be guessed, because the alternative is an agent that reads a correct sentence
      // and has no move.
      return 'From this tool the argument is `force: true`, not `--force`.';
    case EXIT.project:
      return 'Nothing was read and nothing was written. Fix the path or the project format and call again.';
    case EXIT.write:
      return 'The output folder now holds part of an app and will not build. Export again into an empty folder.';
    default:
      return 'The exporter answered with an outcome this tool did not expect.';
  }
}

/**
 * Run one export.
 *
 * ⚠️ **`argv` is built, not concatenated from user text.** Every value is a separate element, so a
 * project directory containing a space or a leading dash is a path and not two arguments — the
 * failure a string command line would have.
 */
export function performExport(options: {
  projectDir: string;
  outDir?: string;
  dryRun: boolean;
  force: boolean;
}): ExportReactResponse {
  const argv: string[] = ['export'];
  if (options.dryRun) argv.push('--dry-run');
  if (options.force) argv.push('--force');
  argv.push(options.projectDir);
  if (!options.dryRun && options.outDir !== undefined) argv.push(options.outDir);

  let out = '';
  let err = '';
  const io: CliIO = {
    out: (text) => {
      out += text;
    },
    err: (text) => {
      err += text;
    }
  };

  const code = runCli(argv, io);

  if (code !== EXIT.ok && code !== EXIT.refusals) {
    throw refusal(code, err || out, noteFor(code, options.dryRun));
  }

  return {
    ok: true,
    exit: code,
    outcome: EXIT_NAMES[code],
    ...(options.dryRun ? { everythingTranslates: code === EXIT.ok } : {}),
    projectDir: path.resolve(options.projectDir),
    ...(options.outDir !== undefined && !options.dryRun ? { outDir: path.resolve(options.outDir) } : {}),
    ...(options.dryRun ? { preflight: out } : { written: out.trim() }),
    said: err,
    note: noteFor(code, options.dryRun)
  };
}

const exportReactSchema = {
  out_dir: z
    .string()
    .optional()
    .describe(
      'Absolute path to an empty folder to write the React app into. Required unless dry_run is true. ' +
        'Must be outside the project directory.'
    ),
  project_dir: z
    .string()
    .optional()
    .describe('The project to export. Defaults to the project this server is bound to.'),
  dry_run: z
    .boolean()
    .optional()
    .describe(
      'Write nothing and return the pre-flight — the export\'s own account of what it would produce and ' +
        'what it would leave out. Takes no out_dir.'
    ),
  force: z
    .boolean()
    .optional()
    .describe(
      'Write into an out_dir that already holds something. Same-named files are overwritten; nothing else ' +
        'is touched. Without this an occupied folder is refused, because there is nobody to ask.'
    )
};

export function registerExportReactTools(server: McpServer, binding: ProjectBinding): void {
  server.registerTool(
    'export_react',
    {
      title: 'Export this project as a React app',
      description:
        'Export a NodeGX project to a standalone Vite + React app on disk — the same export the editor\'s ' +
        'File > Export React menu item performs, and the same one `nodegx export` performs, with no editor ' +
        'and no click. Use it when the user wants to ship, host or hand over what you built. Not everything ' +
        'in a NodeGX graph has a React translation: the export records what it left out in EXPORT-REPORT.md ' +
        'in the output folder, and dry_run returns that account without writing anything. The project is ' +
        'read from disk, so save any editor that has it open first.',
      inputSchema: exportReactSchema
    },
    guarded(async (args: { out_dir?: string; project_dir?: string; dry_run?: boolean; force?: boolean }) => {
      const dryRun = args.dry_run === true;
      // Resolved here rather than left to `runCli`, because the refusal a caller needs for a
      // missing project is "you did not name one and this server is not bound", which is a
      // different sentence from anything a command line can say about it.
      const projectDir = args.project_dir ?? binding.require().projectDir;

      if (!dryRun && args.out_dir === undefined) {
        throw new ToolError(
          'invalid-argument',
          'export_react needs an out_dir to write the app into. Pass dry_run: true to see what the export ' +
            'would produce without writing anything.'
        );
      }
      if (dryRun && args.out_dir !== undefined) {
        // The CLI refuses the same pair for the same reason: somebody who named an output folder
        // believes they asked for an export, and will not read a summary as a refusal to do one.
        throw new ToolError(
          'invalid-argument',
          'dry_run writes nothing, so it takes no out_dir. Call again with dry_run omitted to write the app ' +
            'into that folder.'
        );
      }

      return jsonResult(
        performExport({ projectDir, outDir: args.out_dir, dryRun, force: args.force === true })
      );
    })
  );
}
