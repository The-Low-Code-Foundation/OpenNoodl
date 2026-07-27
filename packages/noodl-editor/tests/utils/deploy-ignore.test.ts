/**
 * DEP-008 — artifact contents & the ignore mechanism.
 *
 * `copyProjectFilesToFolder` used to copy the whole project folder into every
 * deploy artifact past a five-name list and two unanchored `indexOf` substring
 * checks. These specs pin the replacement, one `describe` per acceptance
 * criterion in the task, plus the two bugs that lived in the same seven lines.
 *
 * **The AIX-009 interlock is criterion 7.** Phase 15's project `docs/` folder is
 * deliberately a visible directory so creators edit and commit it normally;
 * "visible plus the old copy behaviour" meant published. The spec named the
 * mechanical check as the hand-off between the two tracks, and it is
 * `describe('criterion 7 …')` below.
 *
 * Fixtures are built at runtime rather than committed under `tests/testfs/`
 * because the paths under test are exactly the ones git will not track inside a
 * fixture tree: `.git/`, `node_modules/`, `.gitignore`, `.env`.
 *
 * describe/it/expect come from Jasmine globals — the editor suite runs under the
 * Electron/Jasmine runner, and importing @jest/globals throws at module load.
 */
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  copyProjectFilesToFolder,
  previewProjectFileExclusions,
  ProjectCopyReport
} from '../../src/editor/src/utils/compilation/build/copy';
import { buildIgnoreMatcher } from '../../src/editor/src/utils/compilation/build/ignore';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

type FixtureFiles = Record<string, string>;

/** A project folder on disk. `prefix` lets a spec put it at an awkward path. */
function makeProject(files: FixtureFiles, prefix = 'dep008-project-'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const relativePath of Object.keys(files)) {
    const full = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, files[relativePath]);
  }
  return root;
}

/** Every file in `dir`, project-root relative, `/` separated. */
function listAll(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listAll(path.join(dir, entry.name), relativePath));
    else out.push(relativePath);
  }
  return out;
}

interface DeployResult {
  output: string;
  files: string[];
  report: ProjectCopyReport;
}

async function deploy(projectRoot: string): Promise<DeployResult> {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'dep008-output-'));
  const report = await copyProjectFilesToFolder(projectRoot, output);
  return { output, files: listAll(output), report };
}

/**
 * A legacy project holding one of everything the old filter got wrong: private
 * notes, a `docs/` folder, dependencies, a credential file, and two folders
 * whose names merely *contain* `.git` / `.noodl`.
 */
function standardProjectFiles(): FixtureFiles {
  return {
    'project.json': '{"name":"demo"}',
    'index.html': '<html></html>',
    'notes.txt': 'a scratch file the user has said nothing about',
    'assets/logo.png': 'PNG',

    'docs/README.md': '# Scoping notes',
    'docs/decisions/rejected-approaches.md': '## Rejected',
    'docs/contracts/backend.md': '## Backend contract',

    'node_modules/left-pad/index.js': 'module.exports = 1;',
    '.git/config': '[core]',
    '.gitignore': 'node_modules',
    '.gitattributes': '* text=auto',
    '.DS_Store': '',
    '.env': 'API_SECRET=hunter2',
    'Dockerfile': 'FROM node',
    '.noodl/build-scripts/a.build.js': '({})',

    // The two over-match regressions: legitimate assets whose paths contain
    // `.git` and `.noodl` as substrings but not as path segments.
    'pre.gitlab-assets/logo.png': 'PNG',
    'assets/my.noodly-notes.txt': 'keep me'
  };
}

// ─── Criterion 1 ──────────────────────────────────────────────────────────────

describe('DEP-008 criterion 1 — defaults exclude docs/ and node_modules/, not notes.txt', () => {
  let result: DeployResult;

  beforeAll(async () => {
    result = await deploy(makeProject(standardProjectFiles()));
  });

  it('excludes docs/', () => {
    expect(result.files.filter((f) => f.startsWith('docs/'))).toEqual([]);
  });

  it('excludes node_modules/', () => {
    expect(result.files.filter((f) => f.startsWith('node_modules/'))).toEqual([]);
  });

  it('deploys notes.txt — it is not a default, the user has to say so', () => {
    expect(result.files).toContain('notes.txt');
  });

  it('excludes the version-control, OS and credential defaults', () => {
    expect(result.files).not.toContain('.gitignore');
    expect(result.files).not.toContain('.gitattributes');
    expect(result.files).not.toContain('.DS_Store');
    expect(result.files).not.toContain('.env');
    expect(result.files).not.toContain('Dockerfile');
    expect(result.files).not.toContain('project.json');
    expect(result.files.filter((f) => f.startsWith('.git/'))).toEqual([]);
    expect(result.files.filter((f) => f.startsWith('.noodl/'))).toEqual([]);
  });

  it('deploys the ordinary project files', () => {
    expect(result.files).toContain('index.html');
    expect(result.files).toContain('assets/logo.png');
  });
});

// ─── Criterion 2 ──────────────────────────────────────────────────────────────

describe('DEP-008 criterion 2 — a .noodlignore entry excludes a file', () => {
  it('excludes notes.txt once it is listed', async () => {
    const files = standardProjectFiles();
    files['.noodlignore'] = '# my rules\nnotes.txt\n';

    const result = await deploy(makeProject(files));

    expect(result.files).not.toContain('notes.txt');
    expect(result.files).toContain('index.html');

    const entry = result.report.excluded.find((f) => f.path === 'notes.txt');
    expect(entry.source).toBe('.noodlignore');
    expect(entry.rule).toBe('notes.txt');
  });

  it('does not deploy the .noodlignore itself', async () => {
    const files = standardProjectFiles();
    files['.noodlignore'] = 'notes.txt\n';

    const result = await deploy(makeProject(files));
    expect(result.files).not.toContain('.noodlignore');
  });

  it('extends the defaults rather than replacing them', async () => {
    const files = standardProjectFiles();
    files['.noodlignore'] = 'notes.txt\n';

    const result = await deploy(makeProject(files));
    // A short user file must not un-ignore docs/.
    expect(result.files.filter((f) => f.startsWith('docs/'))).toEqual([]);
  });
});

// ─── Criterion 3 ──────────────────────────────────────────────────────────────

describe('DEP-008 criterion 3 — a negation is the only way to re-include a default', () => {
  it('re-includes docs/ with "!docs/"', async () => {
    const files = standardProjectFiles();
    files['.noodlignore'] = '!docs/\n';

    const result = await deploy(makeProject(files));
    expect(result.files).toContain('docs/README.md');
    expect(result.files).toContain('docs/decisions/rejected-approaches.md');
  });

  it('does not re-include docs/ by any non-negated line', async () => {
    const files = standardProjectFiles();
    // Naming the path without "!" cannot un-ignore it, whatever the user meant.
    files['.noodlignore'] = 'docs/\ndocs\n/docs/\n';

    const result = await deploy(makeProject(files));
    expect(result.files.filter((f) => f.startsWith('docs/'))).toEqual([]);
  });

  it('follows gitignore: a negation cannot rescue a file under an excluded directory', () => {
    const matcher = buildIgnoreMatcher({
      isV2Project: false,
      ignoreFileContent: '!docs/README.md\n'
    });
    // git's rule — `docs/` is excluded, so nothing beneath it can be re-included
    // without first re-including the directory.
    expect(matcher.match('docs/README.md').ignored).toBe(true);
    expect(buildIgnoreMatcher({ isV2Project: false, ignoreFileContent: '!docs/\n' }).match('docs/README.md').ignored).toBe(
      false
    );
  });
});

// ─── Criterion 4 ──────────────────────────────────────────────────────────────

describe('DEP-008 criterion 4 — the indexOf substring over-match is fixed', () => {
  let result: DeployResult;

  beforeAll(async () => {
    result = await deploy(makeProject(standardProjectFiles()));
  });

  it('deploys pre.gitlab-assets/ — it is not .git', () => {
    expect(result.files).toContain('pre.gitlab-assets/logo.png');
  });

  it('deploys a file whose name merely contains ".noodl"', () => {
    expect(result.files).toContain('assets/my.noodly-notes.txt');
  });

  it('deploys a project that lives at a path containing ".noodl"', async () => {
    // The old checks tested the *absolute* path, so a project stored under a
    // directory called e.g. `.noodl/projects` had every one of its files
    // silently dropped from the deploy.
    const projectRoot = makeProject(
      { 'index.html': '<html></html>', 'assets/logo.png': 'PNG' },
      'dep008-.noodl-.git-'
    );

    const awkward = await deploy(projectRoot);
    expect(awkward.files).toContain('index.html');
    expect(awkward.files).toContain('assets/logo.png');
  });
});

// ─── Criterion 5 ──────────────────────────────────────────────────────────────

describe('DEP-008 criterion 5 — the report names the count and the rule', () => {
  let result: DeployResult;

  beforeAll(async () => {
    result = await deploy(makeProject(standardProjectFiles()));
  });

  it('counts what it copied and what it did not', () => {
    expect(result.report.copiedCount).toBe(result.files.length);
    expect(result.report.excluded.length).toBeGreaterThan(0);
  });

  it('names the rule and its source for every exclusion', () => {
    for (const entry of result.report.excluded) {
      expect(typeof entry.rule).toBe('string');
      expect(entry.rule.length).toBeGreaterThan(0);
      expect(entry.source === 'default' || entry.source === '.noodlignore').toBe(true);
    }
  });

  it('explains why each default exists', () => {
    const docs = result.report.excluded.find((f) => f.path.startsWith('docs'));
    expect(docs.rule).toBe('docs/');
    expect(docs.source).toBe('default');
    expect(docs.reason).toBe('project documentation, not for publication');
  });

  it('groups the counts by rule', () => {
    const byRule = result.report.excludedByRule.find((r) => r.rule === 'docs/');
    expect(byRule.count).toBe(1); // the pruned directory, reported once
  });

  it('says whether the project has a .noodlignore', async () => {
    expect(result.report.hasIgnoreFile).toBe(false);

    const files = standardProjectFiles();
    files['.noodlignore'] = 'notes.txt\n';
    const withFile = await deploy(makeProject(files));
    expect(withFile.report.hasIgnoreFile).toBe(true);
  });

  it('reports an excluded path that an earlier deploy already put in the output', async () => {
    // Nobody deploys into an empty folder twice. A project that deployed its
    // docs/ before this task will still be serving them, and the copy step
    // cannot safely delete from a folder it does not own — so it must say so.
    const projectRoot = makeProject(standardProjectFiles());
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'dep008-output-'));
    fs.mkdirSync(path.join(output, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(output, 'docs/README.md'), '# published by an older deploy');

    const report = await copyProjectFilesToFolder(projectRoot, output);

    expect(report.staleExclusions).toContain('docs');
    // Left in place, deliberately — reported, not deleted.
    expect(fs.existsSync(path.join(output, 'docs/README.md'))).toBe(true);
  });

  it('reports nothing stale for a fresh output folder', async () => {
    const result = await deploy(makeProject(standardProjectFiles()));
    expect(result.report.staleExclusions).toEqual([]);
  });

  it('previews the same exclusions the deploy will make', async () => {
    const projectRoot = makeProject(standardProjectFiles());
    const preview = await previewProjectFileExclusions(projectRoot);
    const actual = await deploy(projectRoot);

    expect(preview.copiedCount).toBe(actual.report.copiedCount);
    expect(preview.excluded.map((f) => f.path).sort()).toEqual(actual.report.excluded.map((f) => f.path).sort());
  });
});

// ─── Criterion 6 ──────────────────────────────────────────────────────────────

describe('DEP-008 criterion 6 — one code path, no per-target filter', () => {
  // The Electron runner's cwd is packages/noodl-editor; a repo-root runner's is
  // the monorepo root. Resolve rather than assume, so this reads the real source
  // under either.
  const buildDir = (() => {
    const suffix = 'src/editor/src/utils/compilation/build';
    const candidates = [path.join(process.cwd(), suffix), path.join(process.cwd(), 'packages/noodl-editor', suffix)];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) throw new Error(`Could not locate the build sources. Tried:\n  ${candidates.join('\n  ')}`);
    return found;
  })();

  function sourcesIn(dir: string): { name: string; content: string }[] {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.ts'))
      .map((e) => ({ name: e.name, content: fs.readFileSync(path.join(dir, e.name), 'utf8') }));
  }

  it('only copy.ts enumerates the project directory', () => {
    const offenders = sourcesIn(buildDir)
      .filter((f) => f.name !== 'copy.ts')
      .filter((f) => /filesystem\.listDirectory(Files)?\s*\(/.test(f.content))
      .map((f) => f.name);

    expect(offenders).toEqual([]);
  });

  it('only ignore.ts declares exclusion patterns', () => {
    const offenders = sourcesIn(buildDir)
      .filter((f) => f.name !== 'ignore.ts' && f.name !== 'copy.ts')
      .filter((f) => /ignoreFiles|\.DS_Store/.test(f.content))
      .map((f) => f.name);

    expect(offenders).toEqual([]);
  });

  it('deployer.ts copies through copyProjectFilesToFolder', () => {
    const deployer = fs.readFileSync(path.join(buildDir, 'deployer.ts'), 'utf8');
    expect(deployer.indexOf('copyProjectFilesToFolder(') !== -1).toBe(true);
  });
});

// ─── Criterion 7 — the AIX-009 interlock ──────────────────────────────────────

describe('DEP-008 criterion 7 — the AIX-009 interlock: a populated docs/ never deploys', () => {
  it('produces an output with no docs/ and no .md originating from it', async () => {
    // AIX-009's docs/ as specced: scoping notes, rejected approaches, backend
    // contracts, AI conventions — plus a nested folder and a non-markdown file,
    // because "no .md from docs/" must not be satisfied by an extension check.
    const projectRoot = makeProject({
      'project.json': '{"name":"demo"}',
      'index.html': '<html></html>',
      'README.md': '# a README the user put at the project root',

      'docs/README.md': '# Project docs',
      'docs/scope.md': '## Scope',
      'docs/conventions/ai.md': '## AI conventions',
      'docs/contracts/backend.md': '## Backend contract',
      'docs/decisions/0001-rejected-approaches.md': '## Rejected',
      'docs/assets/diagram.png': 'PNG',
      'docs/notes.txt': 'plain text notes'
    });

    const result = await deploy(projectRoot);

    // No docs/ directory at all.
    expect(fs.existsSync(path.join(result.output, 'docs'))).toBe(false);
    expect(result.files.filter((f) => f.startsWith('docs/'))).toEqual([]);

    // No file that originated in docs/ — under any name, at any depth.
    const docsBasenames = ['scope.md', 'ai.md', 'backend.md', '0001-rejected-approaches.md', 'diagram.png', 'notes.txt'];
    for (const basename of docsBasenames) {
      expect(result.files.filter((f) => f.endsWith(`/${basename}`) || f === basename)).toEqual([]);
    }

    // The root README.md is the user's own file at the project root and is not
    // "originating from docs/" — it still deploys. `docs/README.md` does not.
    expect(result.files).toContain('README.md');
    expect(result.files).toContain('index.html');

    // And the report says so, by rule.
    const excluded = result.report.excluded.find((f) => f.path.startsWith('docs'));
    expect(excluded.rule).toBe('docs/');
  });
});

// ─── The v2 project source decision (scope item 4) ────────────────────────────

describe('DEP-008 — v2 project source is not deployed', () => {
  it('excludes nodegx.*.json and components/ from a v2 project', async () => {
    const projectRoot = makeProject({
      'nodegx.project.json': '{"name":"demo"}',
      'nodegx.routes.json': '[]',
      'nodegx.styles.json': '{}',
      'components/_registry.json': '{"components":[]}',
      'components/Home/component.json': '{}',
      'components/Home/nodes.json': '[]',
      'components/Home/connections.json': '[]',
      'index.html': '<html></html>',
      'assets/logo.png': 'PNG'
    });

    const result = await deploy(projectRoot);

    expect(result.files).not.toContain('nodegx.project.json');
    expect(result.files).not.toContain('nodegx.routes.json');
    expect(result.files).not.toContain('nodegx.styles.json');
    expect(result.files.filter((f) => f.startsWith('components/'))).toEqual([]);
    expect(result.files).toContain('index.html');
    expect(result.files).toContain('assets/logo.png');
  });

  it('leaves a legacy project\'s components/ folder alone — it is an asset folder there', async () => {
    const projectRoot = makeProject({
      'project.json': '{"name":"demo"}',
      'index.html': '<html></html>',
      // No v2 sentinels, so `components/` means whatever the user meant.
      'components/legacy-widget.js': 'console.log(1)'
    });

    const result = await deploy(projectRoot);
    expect(result.files).toContain('components/legacy-widget.js');
  });

  it('can be re-included by a project that wants its source published', async () => {
    const projectRoot = makeProject({
      'nodegx.project.json': '{"name":"demo"}',
      'components/_registry.json': '{"components":[]}',
      'index.html': '<html></html>',
      '.noodlignore': '# legible by design: ship the graph too\n!nodegx.project.json\n!components/\n'
    });

    const result = await deploy(projectRoot);
    expect(result.files).toContain('nodegx.project.json');
    expect(result.files).toContain('components/_registry.json');
  });
});

// ─── The matcher itself ───────────────────────────────────────────────────────

describe('DEP-008 — gitignore syntax', () => {
  function match(patterns: string, relativePath: string, isDirectory = false): boolean {
    return buildIgnoreMatcher({ isV2Project: false, ignoreFileContent: patterns }).match(relativePath, isDirectory)
      .ignored;
  }

  it('matches a bare name at any depth', () => {
    expect(match('secret.txt', 'secret.txt')).toBe(true);
    expect(match('secret.txt', 'a/b/secret.txt')).toBe(true);
  });

  it('anchors a pattern that contains a slash', () => {
    expect(match('a/secret.txt', 'a/secret.txt')).toBe(true);
    expect(match('a/secret.txt', 'b/a/secret.txt')).toBe(false);
  });

  it('anchors a leading slash to the project root', () => {
    expect(match('/notes.txt', 'notes.txt')).toBe(true);
    expect(match('/notes.txt', 'sub/notes.txt')).toBe(false);
  });

  it('applies a trailing slash to directories only', () => {
    expect(match('build/', 'build', true)).toBe(true);
    expect(match('build/', 'build', false)).toBe(false);
    expect(match('build/', 'build/out.js')).toBe(true);
  });

  it('stops * at a path separator', () => {
    expect(match('*.md', 'a.md')).toBe(true);
    expect(match('*.md', 'sub/a.md')).toBe(true);
    expect(match('/*.md', 'sub/a.md')).toBe(false);
    expect(match('a/*.md', 'a/b/c.md')).toBe(false);
  });

  it('crosses separators with **', () => {
    expect(match('a/**/c.md', 'a/c.md')).toBe(true);
    expect(match('a/**/c.md', 'a/b/c.md')).toBe(true);
    expect(match('a/**/c.md', 'a/b/x/c.md')).toBe(true);
    expect(match('a/**', 'a/b/c.md')).toBe(true);
  });

  it('supports ? and character classes', () => {
    expect(match('file?.txt', 'file1.txt')).toBe(true);
    expect(match('file?.txt', 'file12.txt')).toBe(false);
    expect(match('file[0-9].txt', 'file7.txt')).toBe(true);
    expect(match('file[!0-9].txt', 'file7.txt')).toBe(false);
    expect(match('file[!0-9].txt', 'filea.txt')).toBe(true);
  });

  it('ignores comments and blank lines', () => {
    expect(match('# notes.txt\n\n', 'notes.txt')).toBe(false);
    expect(match('\\#notes.txt', '#notes.txt')).toBe(true);
  });

  it('applies last-match-wins across the whole rule list', () => {
    expect(match('*.log\n!keep.log', 'keep.log')).toBe(false);
    expect(match('!keep.log\n*.log', 'keep.log')).toBe(true);
  });

  it('drops unescaped trailing whitespace', () => {
    expect(match('notes.txt   ', 'notes.txt')).toBe(true);
  });
});

// ─── Conformance ──────────────────────────────────────────────────────────────

/**
 * DEP-008's risk table says "use gitignore syntax as-is; do not invent a
 * dialect". The specs above are this file's reading of gitignore(5); this one
 * is git's. It builds a throwaway repo, writes the same patterns to a
 * `.gitignore`, and asserts `git check-ignore` reaches the same verdict — and
 * names the same rule — for every path in the corpus.
 *
 * Skips (loudly) when git is not on PATH.
 */
describe('DEP-008 — conformance with git check-ignore', () => {
  const PATTERNS = [
    'docs/',
    'build/',
    'node_modules/',
    '*.log',
    '!keep.log',
    '**/tmp/',
    'a/*.md',
    '/root.txt',
    'file[0-9].txt',
    'file[!0-9].txt',
    'pre.gitlab-assets',
    '.git/',
    '.env',
    '.env.*',
    'name?.txt',
    'deep/**/leaf.txt',
    'trailing.txt   ',
    '# a comment',
    'space\\ escaped.txt'
  ];

  const PATHS = [
    'index.html',
    'notes.txt',
    'docs/README.md',
    'docs/a/b/c.md',
    'build/out.js',
    'node_modules/left-pad/index.js',
    'x.log',
    'keep.log',
    'sub/keep.log',
    'a/tmp/z.txt',
    'tmp/z.txt',
    'a/b.md',
    'a/b/c.md',
    'root.txt',
    'sub/root.txt',
    'file7.txt',
    'filea.txt',
    'pre.gitlab-assets/logo.png',
    'pre.gitlab-assetsX/logo.png',
    '.git/config',
    '.gitlab/config',
    '.env',
    '.env.local',
    '.environment',
    'name1.txt',
    'name12.txt',
    'deep/leaf.txt',
    'deep/a/b/leaf.txt',
    'trailing.txt',
    'space escaped.txt',
    'assets/my.noodly-notes.txt'
  ];

  function gitIsAvailable(): boolean {
    try {
      return cp.spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
    } catch (_error) {
      return false;
    }
  }

  /** `{ path: rule }` for every path git considers ignored. */
  function gitVerdicts(patterns: string[], paths: string[]): Record<string, string> {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dep008-git-'));
    cp.execFileSync('git', ['init', '-q', repo]);
    fs.writeFileSync(path.join(repo, '.gitignore'), patterns.join('\n') + '\n');

    const result = cp.spawnSync('git', ['-C', repo, 'check-ignore', '-v', '--no-index', ...paths], {
      encoding: 'utf8'
    });

    const verdicts: Record<string, string> = {};
    for (const line of result.stdout.split('\n')) {
      if (!line.trim()) continue;
      // "<source>:<line>:<pattern>\t<path>"
      const tab = line.lastIndexOf('\t');
      const head = line.substring(0, tab);
      const pathname = line.substring(tab + 1);
      const pattern = head.substring(head.indexOf(':', head.indexOf(':') + 1) + 1);
      verdicts[pathname] = pattern;
    }
    return verdicts;
  }

  it('agrees with git on every path in the corpus', () => {
    if (!gitIsAvailable()) {
      console.warn('[DEP-008] git not on PATH — skipping the check-ignore conformance spec.');
      return;
    }

    const verdicts = gitVerdicts(PATTERNS, PATHS);
    // Non-vacuity: a parse failure that produced an empty verdict map would
    // otherwise make this spec pass by agreeing with nothing.
    expect(Object.keys(verdicts).length).toBeGreaterThan(10);

    // No defaults here: the corpus is compared against a bare `.gitignore`, so
    // the matcher must hold only the same patterns git was given.
    const matcher = buildIgnoreMatcher({ isV2Project: false, ignoreFileContent: PATTERNS.join('\n') + '\n' });

    const disagreements: string[] = [];
    for (const pathname of PATHS) {
      const gitRule = verdicts[pathname];
      const decision = matcher.match(pathname, false);

      const gitIgnored = gitRule !== undefined && !gitRule.startsWith('!');
      if (decision.ignored !== gitIgnored) {
        disagreements.push(`${pathname}: git ${gitIgnored ? 'ignores' : 'keeps'}, we ${decision.ignored ? 'ignore' : 'keep'}`);
        continue;
      }
      if (decision.ignored && decision.rule.pattern !== gitRule) {
        disagreements.push(`${pathname}: git blames \`${gitRule}\`, we blame \`${decision.rule.pattern}\``);
      }
    }

    expect(disagreements).toEqual([]);
  });
});
