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

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { errorMessage } from '../errorMessage';
import { checkTarget } from '../write/writeExport';
import { describeMissingEngine, resolveEngine } from './deployEngine';
import {
  MANIFEST_NAME,
  announce,
  compareDeploys,
  disposition,
  listEntries,
  readManifest,
  sweep,
  sweepPlan,
  writeManifest,
  type DeployManifest
} from './deployManifest';
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
  /** HLS-014 — every out-dir-relative path the deploy wrote, from the deployer, not a listing. */
  written?: string[];
  roots?: {
    components: number;
    withRoots: number;
    withoutRoots: string[];
    rootComponent: string | null;
    rootComponentRenders: boolean;
    indexJs: string;
    /** HLS-014 — bundle files in the folder that the served export does not name. */
    staleBundles?: string[];
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
 * HLS-014 — everything the second deploy into a folder knows that the first one cannot.
 *
 * Handed to {@link gradeDeploy} rather than computed inside it, because deciding it means reading
 * a folder and this function is pure on purpose: every sentence below is graded by a spec that
 * runs in a millisecond, including the ones a real redeploy takes seventy seconds to reach.
 */
export interface UpdateContext {
  /** `first` when nothing was here, `identical` when this deploy changed nothing at all. */
  comparison: 'first' | 'identical' | 'changed';
  /** The previous deploy's files that this one removed. */
  swept: string[];
  /** The previous deploy into this folder never finished, and this one is the recovery. */
  recovered: boolean;
  /** Stale bundles still in the folder after the sweep — `--force` into a folder we did not write. */
  strayBundles: string[];
  /**
   * Every file in the folder after the sweep.
   *
   * ⚠️ The engine's own `files` is a top-level listing taken **before** the sweep, so on an update
   * it names files that are no longer there. Both are kept: `files` is what the engine saw, this
   * is what the folder holds, and the summary counts this one.
   */
  entries: string[];
}

/**
 * Turn the engine's report into an exit code and the words that go with it.
 *
 * @param report  what the engine said, already parsed.
 * @param outDir  the folder it was told to write, for the sentences that name it.
 * @param update  HLS-014: what this deploy was, relative to whatever was in the folder already.
 */
export function gradeDeploy(report: EngineReport, outDir: string, update?: UpdateContext): Grade {
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

  // 🔴 HLS-014 AC4. A second deploy that changed nothing is reported as *nothing changed*, not as
  // a fresh success. The two are the same exit code and the same files, and they are not the same
  // fact: an agent that redeploys after an edit and is told "deployed, 9 entries" has learned
  // nothing about whether its edit reached the artefact, which is the one thing it wanted to know.
  // The manifest is bookkeeping, not part of the site, so it is not one of the entries a person
  // is being told about. `update.entries` is post-sweep; `report.files` is what the engine saw.
  const entryCount = update
    ? update.entries.length
    : (report.files ?? []).filter((file) => file !== MANIFEST_NAME).length;

  if (update?.comparison === 'identical') {
    lines.push(
      `${report.projectName ?? 'project'} in ${outDir} is unchanged — the deploy already there is ` +
        `byte-for-byte this one (${roots?.indexJs ?? 'the same export'}, ` +
        `${entryCount} entries). Nothing was added and nothing was removed.`
    );
  } else {
    lines.push(
      `${report.projectName ?? 'project'} ${update?.comparison === 'changed' ? 'updated in' : 'deployed to'} ` +
        `${outDir} — ${entryCount} entries, ${report.copied ?? 0} project ` +
        `file${report.copied === 1 ? '' : 's'} copied, ` +
        `${roots ? roots.withRoots : 0} of ${roots ? roots.components : 0} components render.`
    );
  }

  if (update?.recovered) {
    lines.push('  The unfinished deploy that was in this folder has been replaced.');
  }

  if (update && update.swept.length > 0) {
    // Named rather than counted while there are few of them, for the reason DEP-008's exclusion
    // list is: "3 files removed" and "your logo was removed" need to be distinguishable by
    // somebody reading a log after the fact.
    lines.push(`  ${update.swept.length} file(s) from the previous deploy removed:`);
    for (const entry of update.swept.slice(0, 10)) lines.push(`      ${entry}`);
    if (update.swept.length > 10) lines.push(`      … and ${update.swept.length - 10} more`);
  }

  if (update && update.strayBundles.length > 0) {
    // The `--force` case, where there is no record of what may be deleted and so nothing is.
    lines.push(
      `  ! ${update.strayBundles.length} component bundle(s) in noodl_bundles/ are not part of ` +
        'this app and were left in place: ' +
        `${update.strayBundles.slice(0, 5).join(', ')}${update.strayBundles.length > 5 ? ', …' : ''}. ` +
        'They are served at their own URLs. Delete them by hand, or deploy into an empty folder.'
    );
  }

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
  // project, or a path that is a file. What it says about a folder that already holds something is
  // HLS-014's, below: `existing > 0` is one fact and *whose* files those are is another.
  const verdict = checkTarget(projectDir, outDir, fs);
  if (verdict.ok === false) {
    io.err(verdict.reason + '\n');
    return EXIT.target;
  }

  // 🔴 HLS-014. HLS-015 refused every non-empty folder without `--force`, which is right for
  // somebody's web root and wrong for the folder this command deployed into ten minutes ago —
  // and "an agent ships a change to an app that is already live" is the second case, every time.
  // The record left by the previous deploy is what separates them.
  const record = readManifest(outDir, fs);
  const what = disposition(verdict.existing, record);
  const said = announce(what, outDir, args.force);
  for (const line of said.lines) io.err(`${line}\n`);
  if (said.stop) return EXIT.target;
  const previous: DeployManifest | undefined =
    what.kind === 'update' || what.kind === 'recover' ? what.previous : undefined;

  // The same sentence `nodegx export` says every run, for the same reason: this reads files, the
  // editor holds the unsaved edits, and there is no lock file to detect one with. A warning that
  // fires only on a condition this process cannot observe is a warning that never fires.
  io.err(
    `Reading ${projectDir} as it is on disk.\n` +
      'If the editor has this project open with unsaved changes, save it first: this reads files, not the editor.\n'
  );

  // 🔴 HLS-014 AC2, and it has to be written BEFORE anything else touches the folder. A deploy
  // that is killed part-way leaves a folder holding some of a site, and every other signal that
  // state produces — a file count, a timestamp, an exit code nobody was there to catch — is
  // equally consistent with a folder that finished. This record is the only durable evidence, and
  // it is only evidence if it predates the write it is evidence about.
  fs.mkdirSync(outDir, { recursive: true });
  const startedAt = new Date().toISOString();
  writeManifest(outDir, { version: 1, state: 'in-progress', projectName: path.basename(projectDir), startedAt }, fs);

  const engineArgs = [projectDir, outDir];
  if (args.baseUrl !== null) engineArgs.push('--base-url', args.baseUrl);

  let report: EngineReport;
  try {
    report = await spawnEngine(engine.entry, engineArgs);
  } catch (error) {
    io.err(`${errorMessage(error)}\n`);
    return EXIT.write;
  }

  // 🔴 The sweep happens only after the engine has said the write succeeded, and the manifest is
  // only completed after that. A failed deploy leaves the `in-progress` record in place on
  // purpose: that folder holds part of a site and the next run needs to know it.
  let update: UpdateContext | undefined;
  if (report.ok === true && !report.blank) {
    // 🔴 What the ENGINE says it wrote, not what the folder holds. The first version of this line
    // read the folder, and the sweep then removed nothing at all: a stale `index-<old>.js` is
    // still in the folder at this moment, so "previous entries missing from the folder" is empty
    // by construction. The two lists differ by exactly the files the sweep exists to find.
    const written = report.written ?? listEntries(outDir, fs);
    const swept = sweep(outDir, sweepPlan(previous?.entries, written), fs);
    const entries = listEntries(outDir, fs);
    const buildId = report.roots?.indexJs ?? '';
    update = {
      comparison: compareDeploys(previous, { buildId, entries }),
      swept,
      recovered: what.kind === 'recover',
      // What the engine saw before the sweep, minus what the sweep took. With `--force` into a
      // folder this command has no record of, the plan is empty and every one of these survives —
      // which is the case the note exists for.
      strayBundles: (report.roots?.staleBundles ?? []).filter((bundle) => !swept.includes(`noodl_bundles/${bundle}`)),
      entries
    };
    writeManifest(
      outDir,
      {
        version: 1,
        state: 'complete',
        projectName: report.projectName ?? path.basename(projectDir),
        startedAt,
        finishedAt: new Date().toISOString(),
        buildId,
        entries
      },
      fs
    );
  }

  const grade = gradeDeploy(report, outDir, update);
  for (const line of grade.lines) (grade.code === EXIT.ok ? io.out : io.err)(`${line}\n`);
  return grade.code;
}
