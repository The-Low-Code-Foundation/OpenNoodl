/**
 * HLS-015 — `nodegx deploy`, the other front door that is not a click.
 *
 * ## What this command is, and what it is not
 *
 * `nodegx export` produces **React source** you install and build. `nodegx deploy` produces a
 * **folder you upload**: `index.html`, a hashed export, the component bundles, and the NodeGX
 * interpreter that runs the graph directly. They are two artefacts, not two spellings of one — the
 * community issue that asked for both (#36) puts them in one table row, and HLS-010's spike is
 * what established that they are different orders of work.
 *
 * Before this, the only way to get that folder was the editor's *Deploy to folder* dialog. The
 * lifecycle this phase is about — an agent that builds, ships and updates an app while nobody
 * opens the editor — had no way to ship one at all.
 *
 * ## 🔴 The grading is a pure function, and the deploy is not
 *
 * {@link gradeDeploy} takes what the engine said and returns an exit code and the lines to print.
 * It touches no filesystem, no clock and no subprocess, so every branch below is graded by a spec
 * that runs in milliseconds — including the ones that would take a bespoke fixture and a real
 * 15 MB write to provoke. {@link runDeploy} is the part around it that cannot be.
 *
 * ## 🔴 The failure this command exists to refuse
 *
 * Register row **C67**: a deploy made with an unpopulated node library resolves, writes every
 * file, reports the same copy count as a good run, and serves a blank page. **Nothing upstream of
 * the browser can see it** — 21 components, 375 nodes and 93 of 93 connections survive; the field
 * that empties is `roots`. The engine reads the folder it wrote and says so; this file turns that
 * into a non-zero exit, because in a pipeline the number is the only thing anybody reads.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

import { errorMessage } from '../errorMessage';
import { checkTarget } from '../write/writeExport';
import { describeMissingEngine, resolveEngine } from './deployEngine';
import { EXIT, type ExitCode } from './exitCodes';
import { readableProject, type CliIO } from './run';

/** The `deploy` shape of {@link import('./args').ParsedArgs}. */
export interface DeployArgs {
  projectDir: string;
  outDir: string;
  /** Write into a folder that already holds something. */
  force: boolean;
  /** The path the site will be served from, spliced into `index.html`. `/` unless given. */
  baseUrl: string | null;
}

/** One excluded project file, as the copy step reported it. */
interface Excluded {
  path: string;
  rule: string;
  reason?: string;
}

/**
 * What the engine says on stdout. Mirrors `noodl-preview/src/deploy-cli.ts`'s `EngineResult`.
 *
 * ⚠️ Declared here rather than imported, and that is not laziness. Importing it would put the
 * engine's module — and everything under it, which is the editor's entire model graph — into this
 * package's type program, which is precisely the 201-type-error measurement that put the engine in
 * another process in the first place. The two declarations are kept honest by
 * `hls015-deploy-grading.test.ts`, which drives the real engine and asserts the fields it reads.
 */
export interface EngineReport {
  ok?: boolean;
  stage?: 'usage' | 'runtime' | 'project' | 'target' | 'write';
  message?: string;
  projectName?: string;
  nodeTypes?: number;
  copied?: number;
  excluded?: Excluded[];
  files?: string[];
  roots?: {
    components: number;
    withRoots: number;
    withoutRoots: string[];
    rootComponent: string | null;
    rootComponentRenders: boolean;
    indexJs: string;
  };
  blank?: string | null;
  warnings?: string[];
}

export interface Grade {
  code: ExitCode;
  /** Everything printed, in order. Returned rather than written so a spec reads it as data. */
  lines: string[];
}

/**
 * Which exit code does a stage the engine stopped in deserve?
 *
 * 🔴 Each one is a different thing for a pipeline to do next, which is the whole argument for the
 * table in `exitCodes.ts`: retry a `write`, fix the arguments on a `target`, and stop retrying
 * altogether on a `harness`, which is a statement about the installation that no input will change.
 */
function stageCode(stage: EngineReport['stage']): ExitCode {
  switch (stage) {
    case 'usage':
      return EXIT.usage;
    case 'runtime':
      return EXIT.harness;
    case 'project':
      return EXIT.project;
    case 'target':
      return EXIT.target;
    default:
      return EXIT.write;
  }
}

/**
 * Turn the engine's report into an exit code and the words that go with it.
 *
 * @param report  what the engine said, already parsed.
 * @param outDir  the folder it was told to write, for the sentences that name it.
 */
export function gradeDeploy(report: EngineReport, outDir: string): Grade {
  if (report.ok !== true) {
    const code = stageCode(report.stage);
    const lines = [report.message ?? 'The deploy engine failed and said nothing.'];
    if (code === EXIT.write) {
      // The loud one. `nodegx export` says the same thing for the same reason: a folder holding
      // part of an app builds nothing, and silence about that is how it gets uploaded.
      lines.push(`${outDir} may now hold part of a site. Deploy again into an empty folder.`);
    }
    return { code, lines };
  }

  const roots = report.roots;
  const lines: string[] = [];

  // 🔴 The refusal comes FIRST, before the summary that would otherwise read as success. A
  // pipeline reads the exit code; a person reads the top of the output, and "12 files written"
  // above "this site is blank" is a sentence that gets skimmed past.
  if (report.blank) {
    lines.push('This deploy would ship a blank site, so it is being reported as a failure.');
    lines.push('');
    lines.push(report.blank);
    lines.push('');
    lines.push(
      `${outDir} holds the files anyway — they are what was measured, and deleting a folder ` +
        'this command did not create is not a decision it gets to make. Do not upload it.'
    );
    return { code: EXIT.deploy, lines };
  }

  lines.push(
    `${report.projectName ?? 'project'} deployed to ${outDir} — ` +
      `${(report.files ?? []).length} entries, ${report.copied ?? 0} project ` +
      `file${report.copied === 1 ? '' : 's'} copied, ` +
      `${roots ? roots.withRoots : 0} of ${roots ? roots.components : 0} components render.`
  );

  for (const warning of report.warnings ?? []) lines.push(`  ! ${warning}`);

  // ⚠️ DEP-008's report. The exclusion rules are opinionated on purpose (`components/`, `docs/`,
  // `.env`), and a person who expected their whole folder to ship is the one who most needs to
  // read this — so the count is always stated and the paths are stated when there are few enough
  // to be read rather than scrolled past.
  const excluded = report.excluded ?? [];
  if (excluded.length > 0) {
    lines.push(`  ${excluded.length} project file(s) deliberately not published:`);
    for (const file of excluded.slice(0, 10)) {
      lines.push(`      ${file.path} — ${file.rule}${file.reason ? ` (${file.reason})` : ''}`);
    }
    if (excluded.length > 10) lines.push(`      … and ${excluded.length - 10} more`);
  }

  // A component with no root is normal — a logic-only helper — so this is a note and never a
  // failure. `gradeRoots` in the engine owns the two readings that ARE equivalent to a blank page.
  if (roots && roots.withoutRoots.length > 0) {
    lines.push(
      `  note: ${roots.withoutRoots.length} component(s) render nothing of their own ` +
        `(${roots.withoutRoots.slice(0, 5).join(', ')}${roots.withoutRoots.length > 5 ? ', …' : ''}).`
    );
  }

  lines.push(`Serve it with: nodegx serve ${outDir}`);
  return { code: EXIT.ok, lines };
}

/** Run the engine and resolve its parsed JSON, or reject with a sentence. */
function spawnEngine(entry: string, args: readonly string[]): Promise<EngineReport> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => (stdout += String(chunk)));
    child.on('error', (error) => reject(new Error(`The deploy engine would not start: ${error.message}`)));
    child.on('close', () => {
      // ⚠️ The LAST line, not the whole of stdout. The engine redirects `console.log` to stderr
      // for the duration precisely so this is one object — and reading the last line means a
      // module that writes to the real stdout before the redirect is installed costs a confusing
      // report rather than a run.
      const last = stdout.trim().split('\n').pop() ?? '';
      try {
        resolve(JSON.parse(last) as EngineReport);
      } catch {
        reject(
          new Error(
            'The deploy engine produced no report. Its own output is above.' +
              (last ? `\nLast line was: ${last.slice(0, 200)}` : '')
          )
        );
      }
    });
  });
}

/** The command. */
export async function runDeploy(args: DeployArgs, io: CliIO): Promise<ExitCode> {
  const engine = resolveEngine();
  if (!engine.entry) {
    io.err(describeMissingEngine(engine));
    return EXIT.harness;
  }

  const projectDir = path.resolve(args.projectDir);
  const readable = readableProject(projectDir);
  // `=== false`, not `!readable.ok`. In `run.ts` that spelling is load-bearing — HLS-008 put that
  // file in the editor's webpack graph, which compiles without `strictNullChecks`, where `!x` does
  // not narrow a discriminated union. This file is reached only from `main.ts` and so is in one
  // compiler, not two; the spelling is the same because a reader who finds the two calls disagreeing
  // will go looking for the difference that explains it, and there is none.
  if (readable.ok === false) {
    io.err(readable.reason + '\n');
    return EXIT.project;
  }

  const outDir = path.resolve(args.outDir);
  // The same target rule `nodegx export` applies, from the same function — a folder inside the
  // project, a path that is a file, a folder that already holds something. A deploy writes ~15 MB
  // over an unknown number of existing files, so "there is nobody to ask here" is if anything a
  // stronger argument on this command than on the one it was written for.
  const verdict = checkTarget(projectDir, outDir, fs);
  if (verdict.ok === false) {
    io.err(verdict.reason + '\n');
    return EXIT.target;
  }
  if (verdict.existing > 0 && !args.force) {
    io.err(
      `${outDir} already holds ${verdict.existing} item${verdict.existing === 1 ? '' : 's'}. ` +
        'The editor asks before overwriting; there is nobody to ask here, so this is a refusal. ' +
        'Pass --force to write into it anyway (files with the same names are overwritten; nothing ' +
        'else is touched), or choose an empty folder.\n'
    );
    return EXIT.target;
  }

  // The same sentence `nodegx export` says every run, for the same reason: this reads files, the
  // editor holds the unsaved edits, and there is no lock file to detect one with. A warning that
  // fires only on a condition this process cannot observe is a warning that never fires.
  io.err(
    `Reading ${projectDir} as it is on disk.\n` +
      'If the editor has this project open with unsaved changes, save it first: this reads files, not the editor.\n'
  );

  const engineArgs = [projectDir, outDir];
  if (args.baseUrl !== null) engineArgs.push('--base-url', args.baseUrl);

  let report: EngineReport;
  try {
    report = await spawnEngine(engine.entry, engineArgs);
  } catch (error) {
    io.err(`${errorMessage(error)}\n`);
    return EXIT.write;
  }

  const grade = gradeDeploy(report, outDir);
  for (const line of grade.lines) (grade.code === EXIT.ok ? io.out : io.err)(`${line}\n`);
  return grade.code;
}
