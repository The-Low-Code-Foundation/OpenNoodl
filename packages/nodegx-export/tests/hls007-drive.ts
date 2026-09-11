#!/usr/bin/env -S npx ts-node --project tsconfig.json
/**
 * HLS-007 — the drive. Re-runnable, and the only thing here that starts a browser.
 *
 *   npx ts-node --project tsconfig.json tests/hls007-drive.ts
 *
 * ⚠️ **This is not a CI gate, and calling it one would be this phase's own C46/C47 mistake.** It
 * is a `.ts` and not a `.test.ts` on purpose: it needs Chrome, the editor's viewer bundle and
 * ~90 seconds, and a jest row that skipped when Chrome was absent would be a gate with a hole
 * exactly the shape of the machine that lacks one. `hls007-render-grading.test.ts` and
 * `hls007-harness.test.ts` are the CI gates; they grade every decision this command makes and
 * cannot see whether the harness feeds them real numbers. That is what this file is for.
 *
 * ## The four arms, and why each one has a control beside it
 *
 * | arm | asserts | its control |
 * |---|---|---|
 * | A — clean project, `--out-dir` | exit 0, one DISTINCT image per page per viewport | B is the same project failing |
 * | B — one page emptied | exit 7, naming that page | A is the same project passing |
 * | C — the built bundle with no `packages/` above it | exit 8, naming where it looked | D is the same bundle in the same place, rendering |
 * | D — C plus `NODEGX_RENDER_CLI` | exit 0 | C is the same bundle without it |
 *
 * 🔴 **Arm A asserts the hashes are DISTINCT, not just that six files exist.** The sweep captures
 * after navigating, and a capture that raced the navigation would write six copies of one page —
 * six files, the right count, every filename correct, and the pictures a lie. Driving this on a
 * real five-page project produced two byte-identical images (`/#admin` and `/#admin-login`) and a
 * fresh-browser control proved that was the app's own auth redirect rather than the sweep; the
 * fixture used here has no redirect, so any duplicate is the bug.
 *
 * 🔴 **Arm C is C72's lesson, run rather than reasoned about.** The two checkout candidates in
 * `renderHarness.ts` resolve by coincidence of directory depth. Copying the built bundle into a
 * directory with no `packages/` above it is the only way to see what a person who installed this
 * package gets, and arm D is what stops arm C passing for the wrong reason.
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { catalogPath } from '../src/catalog';
import { EXIT } from '../src/cli/exitCodes';
import { HARNESS_ENV } from '../src/cli/renderHarness';

const PKG = path.join(__dirname, '..');
const REPO = path.join(PKG, '..', '..');
const CLI = path.join(PKG, 'dist', 'cli.mjs');
const HARNESS = path.join(REPO, 'scripts', 'devtools', 'measure-from-disk.js');
/** Three routed pages, no redirects, already in this package. */
const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const VIEWPORTS = 'desktop,phone';

let failures = 0;
function check(what: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  ✓' : '  ✕'} ${what}${detail && !ok ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function run(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    cwd: options.cwd,
    env: { ...process.env, ...options.env }
  });
  return { status: result.status ?? -1, out: `${result.stdout}${result.stderr}` };
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'hls007-drive-'));
const copy = (name: string): string => {
  const target = path.join(scratch, name);
  fs.cpSync(FIXTURE, target, { recursive: true });
  return target;
};

/** The deliberate break: the routed page keeps its Page node and its URL and shows nothing. */
function emptyThePage(project: string, component: string): void {
  const file = path.join(project, 'components', component, 'nodes.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { nodes: { type: string; children?: string[] }[] };
  const page = doc.nodes.find((node) => node.type === 'Page');
  if (!page) throw new Error(`${component} has no Page node, so emptying it would prove nothing`);
  page.children = [];
  doc.nodes = [page];
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
}

function main(): void {
  if (!fs.existsSync(CLI)) throw new Error(`${CLI} is not built. Run \`npm run build\` in ${PKG} first.`);
  if (!fs.existsSync(HARNESS)) throw new Error(`${HARNESS} is missing, so arms A, B and D cannot run.`);

  // ── A — the clean project ────────────────────────────────────────────────────
  console.log('A — a clean three-page project, images kept');
  const good = copy('good');
  const shots = path.join(scratch, 'shots');
  const a = run(['render', good, '--out-dir', shots, '--viewports', VIEWPORTS]);
  check('exits 0', a.status === EXIT.ok, `exit ${a.status}\n${a.out}`);
  check('says 3 of 3 rendered and 3 registered', /3 of 3 routed pages rendered, 3 registered/.test(a.out), a.out);

  const files = fs.existsSync(shots) ? fs.readdirSync(shots).filter((f) => f.endsWith('.png')).sort() : [];
  check('wrote one image per page per viewport (3 × 2 = 6)', files.length === 6, `${files.length}: ${files.join(', ')}`);
  for (const page of ['pages-home', 'pages-mood', 'pages-notes']) {
    for (const viewport of ['desktop', 'phone']) {
      check(`  ${page}-${viewport}.png exists`, files.includes(`${page}-${viewport}.png`));
    }
  }
  const hashes = files.map((f) => createHash('md5').update(fs.readFileSync(path.join(shots, f))).digest('hex'));
  // 🔴 The one that catches a capture racing its navigation. Six files with the right names and
  // one picture between them is the failure that looks exactly like success.
  check('every image is distinct', new Set(hashes).size === files.length, `${new Set(hashes).size} distinct of ${files.length}`);

  // ── B — the same project with one page emptied ───────────────────────────────
  console.log('\nB — the same project, one routed page deliberately emptied');
  const broken = copy('broken');
  emptyThePage(broken, path.join('Pages', 'Mood'));
  const b = run(['render', broken, '--viewports', 'desktop']);
  check(`exits ${EXIT.render}`, b.status === EXIT.render, `exit ${b.status}\n${b.out}`);
  check('names the page that did not render', b.out.includes('/Pages/Mood'), b.out);
  check('says why', /rendered nothing at all/.test(b.out), b.out);
  // The two good pages are still reported as rendered, in the same run — the point of AC2.
  check('the good pages beside it still pass', /✓ \/Pages\/Home/.test(b.out) && /✓ \/Pages\/Notes/.test(b.out), b.out);

  // ── C and D — the built bundle, outside any checkout ─────────────────────────
  console.log('\nC — the BUILT bundle in a directory with no packages/ above it');
  const installed = path.join(scratch, 'installed', 'dist');
  fs.mkdirSync(installed, { recursive: true });
  fs.copyFileSync(CLI, path.join(installed, 'cli.mjs'));
  // 🔴 The catalog's filename is DERIVED from `catalogPath()`, never typed. HLS-001 AC4's gate
  // (`hls001-catalog-cardinality.test.ts`) allows exactly one file in this package to name the
  // artefact, and it caught this line when it was a literal — which is the same gate that C72's
  // fix was written against. A drive that hardcodes the name keeps passing on the day the accessor
  // changes it, and then copies nothing.
  const catalogFile = path.basename(catalogPath());
  fs.copyFileSync(path.join(PKG, 'dist', catalogFile), path.join(installed, catalogFile));
  const bundled = (env: NodeJS.ProcessEnv) =>
    spawnSync(process.execPath, [path.join(installed, 'cli.mjs'), 'render', good, '--viewports', 'desktop'], {
      encoding: 'utf8',
      cwd: scratch,
      env: { ...process.env, ...env }
    });

  const c = bundled({ [HARNESS_ENV]: undefined as unknown as string });
  const cOut = `${c.stdout}${c.stderr}`;
  check(`exits ${EXIT.harness}`, c.status === EXIT.harness, `exit ${c.status}\n${cOut}`);
  check('says this build cannot render', cOut.includes('cannot render'), cOut);
  check('names the escape hatch', cOut.includes(HARNESS_ENV), cOut);
  check('names where it looked', cOut.includes('Looked in:'), cOut);

  console.log(`\nD — the same bundle in the same directory, with ${HARNESS_ENV} set`);
  const d = bundled({ [HARNESS_ENV]: HARNESS });
  const dOut = `${d.stdout}${d.stderr}`;
  check('exits 0', d.status === EXIT.ok, `exit ${d.status}\n${dOut}`);
  check('renders all three pages', /3 of 3 routed pages rendered/.test(dOut), dOut);

  console.log(`\n${failures === 0 ? 'ALL ARMS PASSED' : `${failures} CHECK(S) FAILED`}`);
  fs.rmSync(scratch, { recursive: true, force: true });
  process.exitCode = failures === 0 ? 0 : 1;
}

main();
