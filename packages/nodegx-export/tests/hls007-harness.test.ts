/**
 * HLS-007 — the refusal a caller with no render harness gets, and the arguments that reach it.
 *
 * ## 🔴 The refusal is the shipped behaviour, not an edge case
 *
 * `@nodegx/export` publishes `dist` and `README.md`. Rendering needs a browser, the editor's 14MB
 * viewer bundle and two node catalogs, none of which is in that tarball — so `npm i -g
 * @nodegx/export && nodegx render app` refuses, for **every** person who installs it that way.
 * That makes this the most-executed branch in the command and the one it would be easiest to ship
 * broken, because in a checkout it never runs.
 *
 * C72 is the reason it is graded here rather than assumed: `export_react` would have shipped dead
 * in the packaged app because a path resolved in the checkout **by coincidence of directory
 * depth**, with every in-repo gate green. The rows below drive the resolver at both depths this
 * package has, from a directory tree built for the row rather than from wherever jest happens to
 * sit — and the end-to-end version, the built `dist/cli.mjs` copied somewhere with no `packages/`
 * above it, is in HLS-007-WHAT-WAS-BUILT §4 with its presence control beside it.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parseArgs } from '../src/cli/args';
import { HARNESS_ENV, describeMissingHarness, resolveHarness } from '../src/cli/renderHarness';

const HARNESS = ['scripts', 'devtools', 'measure-from-disk.js'];

/** A throwaway tree with a `scripts/devtools/measure-from-disk.js` at `root`, or without one. */
function tree(withHarness: boolean): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hls007-'));
  if (withHarness) {
    fs.mkdirSync(path.join(root, 'scripts', 'devtools'), { recursive: true });
    fs.writeFileSync(path.join(root, ...HARNESS), '// not run by this suite\n');
  }
  return root;
}

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
});
const scratch = (withHarness: boolean): string => {
  const root = tree(withHarness);
  dirs.push(root);
  return root;
};

describe('resolveHarness — the two depths this package is loaded at', () => {
  it('finds the harness from dist/, which is what the published bin is', () => {
    const root = scratch(true);
    const fromDir = path.join(root, 'packages', 'nodegx-export', 'dist');
    expect(resolveHarness(fromDir, {}).entry).toBe(path.join(root, ...HARNESS));
  });

  it('finds the harness from src/cli/, which is what ts-node and jest are', () => {
    const root = scratch(true);
    const fromDir = path.join(root, 'packages', 'nodegx-export', 'src', 'cli');
    expect(resolveHarness(fromDir, {}).entry).toBe(path.join(root, ...HARNESS));
  });

  it('finds nothing when the tree above it holds no scripts/ — the published install', () => {
    // 🔴 C72's shape, asserted as an ABSENCE with the two rows above as its presence control. On
    // its own, "resolveHarness returned null" passes on a resolver that always returns null.
    const root = scratch(false);
    const resolved = resolveHarness(path.join(root, 'node_modules', '@nodegx', 'export', 'dist'), {});
    expect(resolved.entry).toBeNull();
    expect(resolved.probed).toHaveLength(2);
  });

  it('probes both candidates before giving up, and reports both', () => {
    // The refusal prints `probed`, and a reader who cannot see where it looked has to guess at a
    // layout. ⚠️ On SUCCESS `probed` stops at the hit, which is why this row asserts the failure.
    const root = scratch(false);
    const resolved = resolveHarness(path.join(root, 'a', 'b', 'c'), {});
    expect(resolved.probed.every((p) => p.endsWith(path.join(...HARNESS)))).toBe(true);
    expect(new Set(resolved.probed).size).toBe(2);
  });
});

describe(`resolveHarness — ${HARNESS_ENV}`, () => {
  it('uses the override when it points at something', () => {
    const root = scratch(true);
    const entry = path.join(root, ...HARNESS);
    // From a directory where auto-discovery would find NOTHING, so a pass cannot be the fallback.
    const resolved = resolveHarness(path.join(scratch(false), 'x', 'y', 'z'), { [HARNESS_ENV]: entry });
    expect(resolved.entry).toBe(entry);
  });

  it('REFUSES when the override points at nothing, rather than falling back', () => {
    // 🔴 The asymmetry is deliberate and `noodl-mcp`'s resolver records why: setting the variable
    // is an act, so a typo in it must say so. Falling through is worse than useless in a checkout,
    // where the fallback exists and would start a real Chrome against the harness the caller had
    // explicitly redirected away from — a spec meaning to assert "no harness at all" instead
    // waited eight seconds for one.
    const root = scratch(true);
    const fromDir = path.join(root, 'packages', 'nodegx-export', 'dist');
    const resolved = resolveHarness(fromDir, { [HARNESS_ENV]: path.join(root, 'nope.js') });
    expect(resolved.entry).toBeNull();
    expect(resolved.overrideMissing).toBe(path.join(root, 'nope.js'));
    // The control: the same directory with no override DOES find one.
    expect(resolveHarness(fromDir, {}).entry).toBe(path.join(root, ...HARNESS));
  });
});

describe('describeMissingHarness — what the person is told', () => {
  it('names every path it looked in', () => {
    const resolved = resolveHarness(path.join(scratch(false), 'p', 'q', 'r'), {});
    const said = describeMissingHarness(resolved);
    for (const probed of resolved.probed) expect(said).toContain(probed);
  });

  it('says the escape hatch by name, and that the other commands still work', () => {
    const said = describeMissingHarness(resolveHarness(path.join(scratch(false), 'p', 'q', 'r'), {}));
    expect(said).toContain(HARNESS_ENV);
    expect(said).toContain('Every other nodegx command works without it.');
  });

  it('says the override is wrong when the override is wrong, and not the general story', () => {
    // Two different problems: "this install has no harness" sends the reader to install one;
    // "your variable is a typo" sends them to fix a string they already typed.
    const said = describeMissingHarness(resolveHarness(path.join(scratch(false), 'p'), { [HARNESS_ENV]: '/nope' }));
    expect(said).toContain('/nope');
    expect(said).not.toContain('Every other nodegx command works without it.');
  });
});

describe('parseArgs — nodegx render', () => {
  it('takes a project and nothing else', () => {
    expect(parseArgs(['render', './app'])).toEqual({
      kind: 'render',
      projectDir: './app',
      outDir: null,
      viewports: null,
      scale: null
    });
  });

  it('reads the options in any order, like every other command here', () => {
    const parsed = parseArgs(['render', '--viewports', 'desktop,phone', './app', '--out-dir', './shots']);
    expect(parsed).toMatchObject({ kind: 'render', projectDir: './app', outDir: './shots', viewports: 'desktop,phone' });
  });

  it('treats a missing option value as a usage error, not as the next flag', () => {
    // `--out-dir --viewports desktop` would otherwise write images into a folder called
    // `--viewports`, which is `parseServe`'s token lesson in a less dangerous key.
    expect(parseArgs(['render', './app', '--out-dir', '--viewports'])).toEqual({
      kind: 'usage',
      problem: '`--out-dir` needs a value.'
    });
  });

  it('refuses a scale that is not a number', () => {
    expect(parseArgs(['render', './app', '--scale', 'big'])).toMatchObject({ kind: 'usage' });
    expect(parseArgs(['render', './app', '--scale', '0'])).toMatchObject({ kind: 'usage' });
    expect(parseArgs(['render', './app', '--scale', '0.5'])).toMatchObject({ kind: 'render', scale: 0.5 });
  });

  it('refuses two folders, because the second one is not an output directory', () => {
    // `nodegx export` takes two positionals and this does not. Someone will type the export shape.
    expect(parseArgs(['render', './app', './shots'])).toEqual({
      kind: 'usage',
      problem: 'Too many folders: ./app, ./shots.'
    });
  });

  it('refuses an unknown option rather than ignoring it', () => {
    expect(parseArgs(['render', './app', '--parallel'])).toEqual({ kind: 'usage', problem: 'Unknown option: --parallel.' });
  });

  it('is listed in the usage text with its own exit codes', () => {
    const help = parseArgs([]);
    expect(help).toEqual({ kind: 'help' });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { USAGE } = require('../src/cli/args');
    expect(USAGE).toContain('nodegx render <project>');
    expect(USAGE).toContain('7  render: a routed page did not render');
    expect(USAGE).toContain('8  render: this installation has no render harness');
    // 🔴 The two things this command cannot see, said where the person reads them. A trap written
    // only in a task file is a trap nobody hits documentation for.
    expect(USAGE).toContain('photographs URLS, not components');
    expect(USAGE).toContain('proves pixels, not reachability');
  });
});
