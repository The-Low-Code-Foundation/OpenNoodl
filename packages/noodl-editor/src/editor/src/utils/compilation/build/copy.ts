/**
 * The verbatim project-file copy every deploy target in phase 26 goes through.
 *
 * DEP-008 replaced the filter here. It used to be:
 *
 * ```ts
 * const ignoreFiles = ['.DS_Store', '.gitignore', '.gitattributes', 'project.json', 'Dockerfile'];
 * files = files.filter((f) => {
 *   if (ignoreFiles.indexOf(f.name) !== -1) return false;
 *   if (f.fullPath.indexOf('.git') !== -1) return false;
 *   if (f.fullPath.indexOf('.noodl') !== -1) return false;
 *   return true;
 * });
 * ```
 *
 * — which published every other file in the project folder (notes, credentials,
 * client PDFs) from the app's public origin, and silently dropped anything
 * whose path merely *contained* `.git` or `.noodl` (`pre.gitlab-assets/`).
 *
 * Now: a `.noodlignore` in the project root, gitignore syntax, layered on top of
 * a named default set (`./ignore.ts`), matched by path segment, with a report of
 * what was excluded and why (`ProjectCopyReport`).
 *
 * **This is the one code path.** No deploy target may grow its own filter —
 * `one-copy-path.test.ts` asserts it.
 */

import { filesystem, FileInfo } from '@noodl/platform';

import { ProjectFormatDetector } from '../../../io/ProjectFormatDetector';
import { clearFolders } from './cleanup';
import { buildIgnoreMatcher, getDefaultReason, IgnoreMatcher, IgnoreRule, IgnoreRuleSource } from './ignore';
import { ALWAYS_KEPT, planStarterImageryPrune, STARTER_IMAGERY_DIR } from './starterImagery';

/** The name of the ignore file, in the project root. */
export const IGNORE_FILE_NAME = '.noodlignore';

export interface ExcludedFile {
  /** Project-root relative, `/` separated. */
  path: string;
  /** The pattern that excluded it, as written. */
  rule: string;
  /** Where that pattern came from. */
  source: IgnoreRuleSource | 'unreferenced-imagery';
  /**
   * Why the default exists, when the rule is a default. Undefined for user
   * rules — the user knows why they wrote it.
   */
  reason?: string;
}

/**
 * What the copy step did. Surfaced to the user so "my asset is missing" and
 * "my asset was ignored" are distinguishable without reading source
 * (DEP-008 acceptance criterion 5).
 */
export interface ProjectCopyReport {
  /** Files written into the output folder. */
  copiedCount: number;
  /** Every excluded path, with the rule that excluded it. */
  excluded: ExcludedFile[];
  /** Excluded counts keyed by the rule that did it, for a short summary. */
  excludedByRule: { rule: string; source: ExcludedFile['source']; reason?: string; count: number }[];
  /**
   * VIB-012 — why the stock-imagery prune declined to drop anything, when it declined.
   *
   * 🔴 Present is the interesting case, not absent: it means the project refers to the library in a
   * way the planner could not resolve, so the deploy carries all of it deliberately rather than by
   * omission. A silent "no savings" and a refusal look identical without this.
   */
  imageryPruneRefused?: string;
  /** Whether the project has a `.noodlignore`. */
  hasIgnoreFile: boolean;
  /**
   * Excluded paths that already exist in the *output* folder — almost always
   * copies left by a deploy made before the path became excluded.
   *
   * The copy step deliberately does not delete them: it cannot tell a stale
   * artifact of its own from something the user put in that folder, and
   * deleting the wrong one is unrecoverable. It says so loudly instead, because
   * a `docs/` that is still being served is the defect this task is about.
   *
   * Empty for a fresh output folder.
   */
  staleExclusions: string[];
}

function toReportEntry(path: string, rule: IgnoreRule): ExcludedFile {
  return {
    path,
    rule: rule.pattern,
    source: rule.source,
    reason: rule.source === 'default' ? getDefaultReason(rule.pattern) : undefined
  };
}

function summarise(excluded: ExcludedFile[]): ProjectCopyReport['excludedByRule'] {
  const byRule = new Map<string, ProjectCopyReport['excludedByRule'][number]>();
  for (const entry of excluded) {
    const key = `${entry.source}:${entry.rule}`;
    const existing = byRule.get(key);
    if (existing) existing.count++;
    else byRule.set(key, { rule: entry.rule, source: entry.source, reason: entry.reason, count: 1 });
  }
  return [...byRule.values()].sort((a, b) => b.count - a.count);
}

/** Strips trailing separators so relative-path maths is not off by one. */
function normalizeRoot(projectPath: string): string {
  return projectPath.replace(/[\\/]+$/, '');
}

interface CopyCandidate extends FileInfo {
  /** Project-root relative, `/` separated. */
  relativePath: string;
}

interface WalkResult {
  files: CopyCandidate[];
  excluded: ExcludedFile[];
}

/**
 * Walks the project folder, applying the matcher as it goes.
 *
 * Recursion (rather than `filesystem.listDirectoryFiles`, which walks
 * everything and returns a flat list) is what lets an excluded directory be
 * *pruned* instead of enumerated — a project with `node_modules/` used to be
 * walked in full before the filter threw the results away.
 */
async function walk(root: string, matcher: IgnoreMatcher): Promise<WalkResult> {
  const files: CopyCandidate[] = [];
  const excluded: ExcludedFile[] = [];

  async function visit(absoluteDir: string, relativeDir: string): Promise<void> {
    const entries = await filesystem.listDirectory(absoluteDir);

    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      // `/` rather than `filesystem.join`, matching what `listDirectory` itself
      // returns: the relative-path maths downstream (and `clearFolders`) splits
      // on `/`, and Node accepts forward slashes on every platform.
      const absolutePath = `${absoluteDir}/${entry.name}`;

      if (entry.isDirectory) {
        const decision = matcher.match(relativePath, true);
        if (decision.ignored && decision.rule && matcher.canPrune(relativePath)) {
          excluded.push(toReportEntry(`${relativePath}/`, decision.rule));
          continue;
        }
        await visit(absolutePath, relativePath);
        continue;
      }

      const decision = matcher.match(relativePath, false);
      if (decision.ignored && decision.rule) {
        excluded.push(toReportEntry(relativePath, decision.rule));
        continue;
      }

      files.push({ fullPath: absolutePath, name: entry.name, isDirectory: false, relativePath });
    }
  }

  await visit(root, '');
  return { files, excluded };
}

interface ProjectScan extends WalkResult {
  root: string;
  hasIgnoreFile: boolean;
  /** VIB-012 — set when the stock-imagery prune declined. */
  imageryPruneRefused?: string;
}

/**
 * File extensions read as project source when deciding which stock photographs are referenced.
 *
 * ⚠️ Text only, and it does not matter if this misses an exotic one: an unread file simply cannot
 * *add* a reference, and the planner refuses to prune the moment it meets a `starter-imagery/`
 * occurrence it cannot resolve. The failure direction is "ships too much", which is the safe one.
 */
const SOURCE_TEXT_EXTENSIONS = ['.json', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.md', '.txt'];

/**
 * VIB-012 — drop bundled photographs the project never mentions.
 *
 * 🔴 **The scan population is NOT the copy population, and that is the whole subtlety.** The files
 * that name a picture are the project's own source — `components/**`, `nodegx.project.json` — and
 * those are *excluded* from the deploy by the v2 source rules. So this reads the project directory,
 * not the walk result.
 *
 * 🔴 And it must skip {@link STARTER_IMAGERY_DIR} itself, for a reason worth measuring rather than
 * assuming: `LICENCES.json` turns out not to matter (bare basenames, no `starter-imagery/` anywhere),
 * but `manifest.json`'s own documentation line — *"Reference any file as
 * `noodl_modules/starter-imagery/<name>`"* — contains a placeholder that is not a filename, which
 * makes the planner REFUSE and disables pruning permanently for every project. **A module's README
 * prose can switch off a tool that reads the project as text.**
 */
async function readProjectSourceText(root: string): Promise<string> {
  const chunks: string[] = [];

  async function visit(absoluteDir: string, relativeDir: string, depth: number): Promise<void> {
    if (depth > 12) return;
    let entries: FileInfo[];
    try {
      entries = await filesystem.listDirectory(absoluteDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory) {
        if (relativePath === STARTER_IMAGERY_DIR) continue;
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await visit(`${absoluteDir}/${entry.name}`, relativePath, depth + 1);
        continue;
      }
      const dot = entry.name.lastIndexOf('.');
      if (dot === -1 || !SOURCE_TEXT_EXTENSIONS.includes(entry.name.substring(dot).toLowerCase())) continue;
      try {
        chunks.push(await filesystem.readFile(`${absoluteDir}/${entry.name}`));
      } catch {
        // Unreadable is not "unreferenced" — but it also cannot add a reference, and an occurrence
        // this planner never sees cannot be resolved, so the refusal path stays correct.
      }
    }
  }

  await visit(root, '', 0);
  return chunks.join('\n');
}

/** Moves unreferenced stock photographs out of the copy set and into the report. */
async function pruneStarterImagery(scan: ProjectScan): Promise<ProjectScan> {
  const prefix = `${STARTER_IMAGERY_DIR}/`;
  const present = scan.files.filter((f) => f.relativePath.startsWith(prefix));
  if (present.length === 0) return scan;

  const plan = planStarterImageryPrune(
    present.map((f) => f.relativePath.substring(prefix.length)),
    await readProjectSourceText(scan.root)
  );

  if (plan.refusedReason) {
    return { ...scan, imageryPruneRefused: plan.refusedReason };
  }

  const drop = new Set(plan.drop.map((name) => `${prefix}${name}`));
  if (drop.size === 0) return scan;

  return {
    ...scan,
    files: scan.files.filter((f) => !drop.has(f.relativePath)),
    excluded: [
      ...scan.excluded,
      ...[...drop].sort().map((path) => ({
        path,
        rule: `${prefix}*`,
        source: 'unreferenced-imagery' as const,
        reason: `bundled stock photograph this project never references (${ALWAYS_KEPT.join(' and ')} always ship)`
      }))
    ]
  };
}

/**
 * Resolves the ignore rules for a project and walks it. The single place the
 * rule set is assembled — the copy and the preview must never disagree about
 * what will ship.
 */
async function scanProject(projectPath: string): Promise<ProjectScan> {
  if (!projectPath) {
    throw new Error('Couldnt open project folder.');
  }

  const root = normalizeRoot(projectPath);

  // The v2 source rules only apply to a project that actually is v2 —
  // `components/` is a plausible asset folder name in a legacy project.
  const format = await new ProjectFormatDetector(filesystem).detect(root);

  const ignoreFilePath = filesystem.join(root, IGNORE_FILE_NAME);
  const hasIgnoreFile = filesystem.exists(ignoreFilePath);
  const ignoreFileContent = hasIgnoreFile ? await filesystem.readFile(ignoreFilePath) : null;

  const matcher = buildIgnoreMatcher({
    isV2Project: format.format === 'v2',
    ignoreFileContent
  });

  const { files, excluded } = await walk(root, matcher);
  return pruneStarterImagery({ root, hasIgnoreFile, files, excluded });
}

function toReport(scan: ProjectScan, staleExclusions: string[] = []): ProjectCopyReport {
  return {
    copiedCount: scan.files.length,
    excluded: scan.excluded,
    excludedByRule: summarise(scan.excluded),
    hasIgnoreFile: scan.hasIgnoreFile,
    staleExclusions,
    ...(scan.imageryPruneRefused ? { imageryPruneRefused: scan.imageryPruneRefused } : {})
  };
}

/**
 * Excluded paths that are already present in the output folder. See
 * `ProjectCopyReport.staleExclusions` for why they are reported, not removed.
 */
function findStaleExclusions(excluded: ExcludedFile[], direntry: string): string[] {
  return excluded
    .map((entry) => entry.path.replace(/\/$/, ''))
    .filter((relativePath) => filesystem.exists(filesystem.join(direntry, relativePath)));
}

/**
 * Copies the project folder into the deploy output, minus everything the ignore
 * rules exclude.
 *
 * @param projectPath The project directory.
 * @param direntry The deploy output directory.
 * @returns What was copied and what was not.
 */
export async function copyProjectFilesToFolder(projectPath: string, direntry: string): Promise<ProjectCopyReport> {
  const scan = await scanProject(projectPath);
  const { root, files } = scan;

  await filesystem.makeDirectory(direntry);

  // First clear all folders, will be recreated later
  await clearFolders({
    projectPath: root,
    outputPath: direntry,
    files
  });

  let totalSuccess = true;

  async function copyOne(f: CopyCandidate) {
    const slash = f.relativePath.lastIndexOf('/');
    const folderPath = slash === -1 ? '' : f.relativePath.substring(0, slash);

    const targetDir = folderPath ? filesystem.join(direntry, folderPath) : direntry;
    await filesystem.makeDirectory(targetDir);

    try {
      await filesystem.copyFile(f.fullPath, filesystem.join(direntry, f.relativePath));
    } catch (error) {
      console.error(error);
      totalSuccess = false;
    }
  }

  await Promise.all(files.map(copyOne));

  if (!totalSuccess) {
    throw new Error('Failed to copy project files.');
  }

  return toReport(scan, findStaleExclusions(scan.excluded, direntry));
}

/**
 * The exclusions a deploy *would* make, without copying anything — so the
 * deploy UI can tell the user before they click, not only after.
 */
export async function previewProjectFileExclusions(projectPath: string): Promise<ProjectCopyReport> {
  return toReport(await scanProject(projectPath));
}

/** A one-line summary for a toast or a log. */
export function formatCopyReportSummary(report: ProjectCopyReport): string {
  if (report.excluded.length === 0) return 'No project files were excluded.';

  const rules = report.excludedByRule
    .slice(0, 3)
    .map((r) => `${r.rule} (${r.count})`)
    .join(', ');
  const more = report.excludedByRule.length > 3 ? `, +${report.excludedByRule.length - 3} more rules` : '';

  return `${report.excluded.length} project file${report.excluded.length === 1 ? '' : 's'} excluded — ${rules}${more}`;
}
