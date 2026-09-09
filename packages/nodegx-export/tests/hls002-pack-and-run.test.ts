/**
 * HLS-002 / register row C44 — the published artefact, installed outside the repo and executed.
 *
 * ## Why this row exists at all
 *
 * **Nothing else in this repository runs what gets published.** The editor resolves
 * `@nodegx/export` by explicit alias to `src/` in three places, every suite in this package runs
 * under CJS inside jest, and `dist/` is a publishing artefact no in-repo build depends on. So the
 * whole apparatus — 86 suites, 3,140 assertions, three clean `tsc`s, a green editor `test:ci` —
 * grades the *sources* of a package and says nothing whatsoever about the tarball.
 *
 * HLS-001 measured that rather than suspecting it: installing the tarball and calling it found
 * three defects, two of them stacked so the second was invisible until the first was fixed
 * (a `require` shim that threw on import, then `__dirname` undefined in ESM scope). A `bin` has
 * exactly that exposure and one more — **nothing in this repo has ever executed a module from
 * this package as a subprocess**, so the shebang, the mode bit and the ESM entry are all
 * ungraded by construction.
 *
 * 🔴 That prediction paid immediately. Building the bin for the first time produced a bundle with
 * **two** shebangs — esbuild hoists the source's above the banner, and the banner carried one
 * too — and a `#!` on line 2 is a syntax error. The build reported success. Every suite stayed
 * green. `node dist/cli.mjs --version` is what said otherwise.
 *
 * ## What each row is for
 *
 * `beforeAll` builds, packs and installs once, into `os.tmpdir()`. The rows then read the
 * *installed tree* and run the *installed binary*. The install being outside the repository is
 * asserted rather than assumed: an install that resolved back into the workspace would grade the
 * sources again while looking like this.
 *
 * ⚠️ This is the slow row of the suite (~10s: a build, a pack, an install and two runs). It is
 * worth that, and it is deliberately not gated behind an opt-in environment variable — a gate
 * that runs only when somebody remembers to set a flag is a gate that ran once.
 */
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { catalogPath } from '../src/catalog';
import { EXIT } from '../src/cli/exitCodes';

const PKG = path.join(__dirname, '..');
const REPO = path.join(PKG, '..', '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'kits');

let install: string;
/** The binary as npm linked it, which is the path a consumer's `npx nodegx` resolves to. */
let bin: string;
let project: string;

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], { cwd: PKG, stdio: 'pipe' });

  install = fs.mkdtempSync(path.join(os.tmpdir(), 'hls002-install-'));
  const packed = execFileSync('npm', ['pack', '--pack-destination', install], {
    cwd: PKG,
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .pop() as string;

  fs.writeFileSync(
    path.join(install, 'package.json'),
    JSON.stringify({ name: 'hls002-consumer', private: true, version: '1.0.0' }) + '\n'
  );
  execFileSync('npm', ['install', path.join(install, packed), '--no-audit', '--no-fund'], {
    cwd: install,
    stdio: 'pipe'
  });

  bin = path.join(install, 'node_modules', '.bin', 'nodegx');
  // A copy, because the export refuses a target inside the project and a real consumer's project
  // is not sitting in this repository.
  project = path.join(install, 'project');
  fs.cpSync(FIXTURE, project, { recursive: true });
}, 300000);

afterAll(() => {
  if (install) fs.rmSync(install, { recursive: true, force: true });
});

const run = (...args: string[]) => {
  const result = spawnSync(bin, args, { cwd: install, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
};

describe('the tarball is a package that can be installed and run', () => {
  it('installed itself somewhere that is not this repository', () => {
    // 🔴 The control for every row below. An install inside the workspace would resolve
    // `@nodegx/project-contract` and `@noodl/types` out of the monorepo's `node_modules` and pass
    // while proving nothing about a consumer's machine.
    expect(install.startsWith(REPO + path.sep)).toBe(false);
    expect(fs.existsSync(path.join(install, 'node_modules', '@nodegx', 'export', 'package.json'))).toBe(true);
  });

  it('links a `nodegx` binary that the shell can execute', () => {
    expect(fs.existsSync(bin)).toBe(true);
    const target = fs.realpathSync(bin);
    // eslint-disable-next-line no-bitwise
    expect(fs.statSync(target).mode & 0o111).not.toBe(0);
  });

  it('🔴 begins with exactly one shebang, on the first line', () => {
    // The defect this task actually shipped for ten minutes. Asserted on the installed file
    // rather than on `dist/`, because the tarball is what a consumer gets.
    const text = fs.readFileSync(fs.realpathSync(bin), 'utf8');
    expect(text.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(text.split('\n').filter((line) => line.startsWith('#!'))).toHaveLength(1);
  });

  it('carries the node catalog, which is why it works with no repo around it', () => {
    // ⚠️ The filename comes from `catalogPath()` rather than being written out here. HLS-001 AC4
    // is that the package has exactly *one* file naming the catalog artefact — a count, not an
    // allow-list, so that the twenty-ninth caller goes red whether or not anybody remembers the
    // rule. A hard-coded name in this spec would have been the twenty-ninth, and would have
    // reddened `hls001-catalog-cardinality` — which it did, on the first full run.
    const catalog = path.join(
      install,
      'node_modules',
      '@nodegx',
      'export',
      'dist',
      path.basename(catalogPath())
    );
    expect(fs.existsSync(catalog)).toBe(true);
    expect(Object.keys(JSON.parse(fs.readFileSync(catalog, 'utf8'))).length).toBeGreaterThan(0);
  });

  it('answers --version without throwing on import', () => {
    // HLS-001's first defect was an exception at import time, before a line of export code ran.
    // The cheapest possible run is therefore its own row.
    const result = run('--version');
    expect(result.status).toBe(EXIT.ok);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  }, 60000);

  it('exports a real project, with its copied assets, from outside the repo', () => {
    const out = path.join(install, 'out');
    const result = run('export', project, out);

    expect(result.status).toBe(EXIT.ok);
    expect(result.stdout).toMatch(/^\d+ files and \d+ copied assets written to /);
    expect(fs.existsSync(path.join(out, 'EXPORT-REPORT.md'))).toBe(true);
    expect(fs.existsSync(path.join(out, 'src', 'App.tsx'))).toBe(true);

    // ⚠️ `copies` is the channel that has been dropped twice, and a font is not a string: this
    // fixture's assets include binaries that a UTF-8 round trip would corrupt silently.
    const assets = fs.readdirSync(path.join(out, 'public'), { recursive: true }) as string[];
    expect(assets.length).toBeGreaterThan(0);
  }, 120000);

  it('--dry-run from the install writes nothing, mtime included', () => {
    const parent = path.join(install, 'workspace');
    fs.mkdirSync(parent);
    const before = fs.statSync(parent).mtimeMs;

    const result = run('export', '--dry-run', project);
    expect(result.stdout).toContain('**Nothing has been written yet.**');
    expect(fs.statSync(parent).mtimeMs).toBe(before);
    expect(fs.readdirSync(parent)).toEqual([]);
  }, 120000);
});
