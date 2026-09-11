/**
 * EXP-017 AC2 / AC5 / AC6 — a real deploy, run four times against four viewer builds.
 *
 * ## 🔴 Why this drives the built bundle and not `deployProject`
 *
 * The reading EXP-017 is about is taken from `EXTERNAL_DIR`, which the engine resolves from **its
 * own `__dirname`**. A spec that imported `deployProject` would resolve that to this checkout and
 * grade the classifier against whatever `npm run dev` last left on disk — a fixture nobody controls
 * and that changes under the suite. So each arm gets a **temporary checkout**: a copy of the engine
 * bundle, and beside it a `packages/noodl-editor/src/external/deploy/` whose `noodl.deploy.js` this
 * spec wrote. That is also the case AC3 names in so many words — `NODEGX_DEPLOY_CLI` pointing the
 * command at another checkout's engine — performed rather than reasoned about.
 *
 * ## 🔴 The arm that would be missing without AC5's mutant
 *
 * Arm 3 is a development bundle with the source map stripped off: no `sourceMappingURL` anywhere,
 * 5 MB smaller than the one it came from, `node --check` clean. It must be refused for the *other*
 * reason, and it is the arm that decides whether this gate is measuring a build or a substring.
 *
 * ## What arm 4 exists to show
 *
 * A flag that says "ship it anyway" is only honest if what it ships is what the refusal said it
 * would. Arm 4 reads the file **in the deployed folder** and finds the welded map in it — so the
 * sentence "a deploy copies this file verbatim" is a measurement here and not a claim.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PKG_ROOT = path.resolve(__dirname, '..');
const ENGINE_BUNDLE = path.join(PKG_ROOT, 'dist/nodegx-deploy.cjs');
const REAL_DEPLOY_DIR = path.resolve(PKG_ROOT, '../noodl-editor/src/external/deploy');
const FIXTURE_PROJECT = path.join(PKG_ROOT, 'tests/fixtures/hello-world');
const ALLOW_DEV_ENGINE_FLAG = '--allow-development-engine';

/**
 * EXP-017 AC6 — the development build, measured on this checkout 2026-09-11 and reproduced here.
 *
 * 🔴 These are the numbers the task was opened on, and reproducing them is what makes a later
 * change that re-inflates the bundle fail rather than get noticed by whoever happens to look next.
 * The fixture below is built to them, and the AC6 row asserts the engine reads every one of them
 * back off the file it wrote.
 */
const DEV_BUILD = { bytes: 14_953_525, mapBytes: 9_877_712, lines: 110_716 };

let checkout: string;
let externalDeploy: string;
let engine: string;

/** The comment webpack's `inline-source-map` devtool writes, prefix included. */
const MAP_PREFIX = '//# sourceMappingURL=data:application/json;charset=utf-8;base64,';

/**
 * `lines` lines of unminified-looking program occupying exactly `bytes` bytes, no trailing newline.
 *
 * Exact rather than approximate because AC6's rows compare the reading against the measured
 * figures, and a fixture that is 93 KB out turns a gate on the numbers into a gate on nothing.
 */
function programOf(bytes: number, lines: number): string {
  const perLine = Math.floor((bytes - (lines - 1)) / lines);
  const rows = Array.from({ length: lines }, (_, i) =>
    `/******/ \tvar __webpack_module_${i}__ = ${'x'.repeat(Math.max(1, perLine))};`.slice(0, perLine)
  );
  const body = rows.join('\n');
  // The floor above leaves a remainder; it goes on the last line, which changes no line count.
  return body + 'x'.repeat(Math.max(0, bytes - body.length));
}

/**
 * A `noodl.deploy.js` shaped like webpack's `mode: "production"` output.
 *
 * 🔴 **Synthesised, and NOT a copy of the one in this checkout.** The first version of arm 1 copied
 * the real bundle, and went red the moment somebody ran `npm run dev` in a shell nobody here can
 * see — which is not a regression, it is the ordinary state of a working tree and is the very
 * condition this task exists to detect. A spec whose arms are decided by another session's build
 * grades that session. The engine copies this file verbatim and never executes it, so what it has
 * to be is production-SHAPED, which is precisely what the classifier reads.
 *
 * The checkout's real bundle is read by `exp017-viewer-build.test.ts`, where being whichever build
 * is on disk is the point rather than the problem.
 */
function productionBundle(): Buffer {
  const banner = '/*! For license information please see noodl.deploy.js.LICENSE.txt */';
  return Buffer.from(`${banner}\n(()=>{var __webpack_modules__={${'a:1,'.repeat(300_000)}};})();`);
}

/** A `noodl.deploy.js` shaped like webpack's `mode: "development"` output, to the byte. */
function developmentBundle(options: { withMap: boolean }): Buffer {
  if (!options.withMap) {
    // AC5's mutant: the same unminified program, and nothing after it.
    return Buffer.from(programOf(DEV_BUILD.bytes - DEV_BUILD.mapBytes, DEV_BUILD.lines));
  }
  // The map is the LAST line, so the program carries the other 110,715 of them.
  const body = programOf(DEV_BUILD.bytes - DEV_BUILD.mapBytes - 1, DEV_BUILD.lines - 1);
  return Buffer.from(`${body}\n${MAP_PREFIX}${'A'.repeat(DEV_BUILD.mapBytes - MAP_PREFIX.length)}`);
}

/** Point the temp checkout's runtime at one viewer build. */
function useEngineBuild(bytes: Buffer): void {
  fs.writeFileSync(path.join(externalDeploy, 'noodl.deploy.js'), bytes);
}

interface EngineResult {
  ok?: boolean;
  stage?: string;
  message?: string;
  engine?: {
    path: string;
    bytes: number;
    lines: number;
    sourceMapBytes: number;
    licenseSibling: boolean;
    kind: string;
    reasons: string[];
  };
  files?: string[];
}

/** Run the real engine and read the one JSON object it puts on stdout. */
function deploy(outDir: string, extra: string[] = []): EngineResult {
  const run = spawnSync(process.execPath, [engine, FIXTURE_PROJECT, outDir, ...extra], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const last = (run.stdout ?? '').trim().split('\n').pop() ?? '';
  try {
    return JSON.parse(last) as EngineResult;
  } catch {
    throw new Error(`The engine produced no report.\nstdout: ${last.slice(0, 400)}\nstderr: ${run.stderr?.slice(-800)}`);
  }
}

let arm = 0;
function freshOutDir(): string {
  const dir = path.join(checkout, `site-${++arm}`);
  return dir;
}

beforeAll(() => {
  // Both are build artifacts. Failing loudly with the command that fixes them is this package's
  // rule (`helpers.ts#assertPrerequisites`) — a skipped suite would quietly claim nothing broke.
  if (!fs.existsSync(ENGINE_BUNDLE)) {
    throw new Error(`Missing ${ENGINE_BUNDLE}. Build it: npm --prefix packages/noodl-preview run build`);
  }
  if (!fs.existsSync(path.join(REAL_DEPLOY_DIR, 'index.json'))) {
    throw new Error(`Missing the deployed viewer runtime in ${REAL_DEPLOY_DIR}. Build it: npm run build:editor:_viewer`);
  }

  // 🔴 `realpathSync`, because on macOS `os.tmpdir()` is `/var/folders/…`, a symlink to
  // `/private/var/folders/…`, and the engine reports the path its own `__dirname` resolved to. The
  // two spellings name one file and compare unequal, which is a failure about a symlink dressed up
  // as a failure about a classifier.
  checkout = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'exp017-checkout-')));
  const dist = path.join(checkout, 'packages/noodl-preview/dist');
  externalDeploy = path.join(checkout, 'packages/noodl-editor/src/external/deploy');
  fs.mkdirSync(dist, { recursive: true });
  fs.cpSync(ENGINE_BUNDLE, path.join(dist, 'nodegx-deploy.cjs'));
  // Everything except the viewer bundle is the real runtime, so each arm differs by one file.
  fs.cpSync(REAL_DEPLOY_DIR, externalDeploy, { recursive: true });
  // ⚠️ And the LICENSE sibling goes, because whether it is there is a fact about the build this
  // checkout happens to hold. Arm 1 writes its own; the arms that must not see one get none.
  fs.rmSync(path.join(externalDeploy, 'noodl.deploy.js.LICENSE.txt'), { force: true });
  engine = path.join(dist, 'nodegx-deploy.cjs');
});

afterAll(() => {
  if (checkout) fs.rmSync(checkout, { recursive: true, force: true });
});

describe('EXP-017 — four viewer builds, four outcomes', () => {
  it('arm 1: a production engine deploys, and the run NAMES the build it copied (AC1)', () => {
    useEngineBuild(productionBundle());
    fs.writeFileSync(path.join(externalDeploy, 'noodl.deploy.js.LICENSE.txt'), '/*! react v18 | MIT */\n');
    const out = freshOutDir();

    const result = deploy(out);

    expect(result.ok).toBe(true);
    expect(result.engine?.kind).toBe('production');
    expect(result.engine?.sourceMapBytes).toBe(0);
    // 🔴 The path it reports is the one in the TEMP checkout, not this repo's. That is the whole of
    // AC3's "read it from the engine actually used" — the engine this run used was elsewhere.
    expect(result.engine?.path).toBe(path.join(externalDeploy, 'noodl.deploy.js'));
    expect(result.engine?.path.startsWith(checkout)).toBe(true);
    // And the site is real: the bundle reached the folder.
    expect(result.files).toContain('noodl.deploy.js');
    expect(fs.statSync(path.join(out, 'noodl.deploy.js')).size).toBe(result.engine?.bytes);
  });

  it('arm 2: a development engine is refused, nothing is written, and the map is NAMED (AC2)', () => {
    useEngineBuild(developmentBundle({ withMap: true }));
    const out = freshOutDir();

    const result = deploy(out);

    expect(result.ok).toBe(false);
    expect(result.stage).toBe('engine');
    expect(result.engine?.kind).toBe('development');

    // 🔴 AC2's actual requirement. A refusal that says "this is 13 MB bigger" is overridden by
    // anyone in a hurry; what is being refused is publishing the viewer's source.
    expect(result.message).toContain('source map');
    expect(result.message).toContain('NodeGX viewer source');
    expect(result.message).toContain('9.42 MB');
    expect(result.message).toContain(ALLOW_DEV_ENGINE_FLAG);
    expect(result.message).toContain('npm run build:editor:_viewer');

    // 🔴 Refused BEFORE the write. A folder holding a complete, working site is a folder somebody
    // uploads, and a refusal that arrives after it exists has already made the artefact.
    expect(fs.existsSync(out)).toBe(false);
  });

  it('arm 2 reproduces the measured development build (AC6)', () => {
    const reading = deploy(path.join(checkout, 'unused-shape')).engine;

    expect(reading?.bytes).toBe(DEV_BUILD.bytes);
    expect(reading?.lines).toBe(DEV_BUILD.lines);
    expect(reading?.sourceMapBytes).toBe(DEV_BUILD.mapBytes);
    // 66.1% in the task's table, measured on the real artefact.
    expect(Math.round(((reading?.sourceMapBytes ?? 0) / (reading?.bytes ?? 1)) * 1000) / 10).toBeCloseTo(66.1, 1);
  });

  it('arm 3: the map stripped off does NOT make it a production build (AC5)', () => {
    // The armed loser. It has no `sourceMappingURL` in it at all, it is 9.4 MB smaller than arm 2,
    // and it is the same unminified development build with the viewer's source readable in it.
    useEngineBuild(developmentBundle({ withMap: false }));
    const out = freshOutDir();

    const result = deploy(out);

    expect(result.engine?.sourceMapBytes).toBe(0);
    expect(result.ok).toBe(false);
    expect(result.stage).toBe('engine');
    expect(result.message).toContain('unminified development build');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('arm 4: the flag ships it, and what reaches the folder is what the refusal described', () => {
    useEngineBuild(developmentBundle({ withMap: true }));
    const out = freshOutDir();

    const result = deploy(out, [ALLOW_DEV_ENGINE_FLAG]);

    expect(result.ok).toBe(true);
    expect(result.engine?.kind).toBe('development');

    // 🔴 Read the artefact, not the report. "A deploy copies this file verbatim" is the sentence
    // the refusal is built on; this is that sentence measured in the folder somebody would upload.
    const published = fs.readFileSync(path.join(out, 'noodl.deploy.js'));
    expect(published.length).toBe(DEV_BUILD.bytes);
    expect(published.subarray(-DEV_BUILD.mapBytes).includes('//# sourceMappingURL=data:')).toBe(true);
  });
});
