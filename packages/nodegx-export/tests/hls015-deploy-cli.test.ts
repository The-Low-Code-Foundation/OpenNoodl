/**
 * HLS-015 — `nodegx deploy`'s parse, its grading and its engine resolution.
 *
 * Everything here is a pure function of its arguments, deliberately. The command's interesting
 * failures — a blank site reported as a success, an artefact of the wrong KIND written into the
 * right folder, a refusal that cannot say where it looked — are all decisions, and a decision that
 * needs a 15 MB write and a browser to provoke is a decision nothing grades often enough.
 *
 * The parts that cannot be pure are graded by `tests/hls015-drive.mjs`, which deploys a real
 * project and puts the folder in a real Chrome. Both are needed and neither replaces the other:
 * **a grading function cannot see a blank page and a browser cannot see an exit code table.**
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parseArgs, USAGE } from '../src/cli/args';
import { gradeDeploy, type EngineReport } from '../src/cli/deploy';
import { describeMissingEngine, resolveEngine, ENGINE_ENV } from '../src/cli/deployEngine';
import { EXIT } from '../src/cli/exitCodes';

describe('HLS-015 — parsing `nodegx deploy`', () => {
  it('takes a project and an output folder', () => {
    expect(parseArgs(['deploy', 'app', 'site'])).toEqual({
      kind: 'deploy',
      projectDir: 'app',
      outDir: 'site',
      force: false,
      baseUrl: null
    });
  });

  it('reads the flags either side of the folders', () => {
    // The reason `parseArgs` exists at all: `emit-app.ts` destructured positionally, so a flag
    // written before the folders was read AS a folder.
    expect(parseArgs(['deploy', '--force', 'app', 'site'])).toMatchObject({ force: true, projectDir: 'app' });
    expect(parseArgs(['deploy', 'app', 'site', '--force'])).toMatchObject({ force: true, outDir: 'site' });
  });

  it('takes a base URL', () => {
    expect(parseArgs(['deploy', 'app', 'site', '--base-url', '/app/'])).toMatchObject({ baseUrl: '/app/' });
  });

  it('treats a missing value as missing rather than swallowing the next flag', () => {
    // `--base-url --force` would otherwise set the base URL to "--force" and report force as off.
    expect(parseArgs(['deploy', 'app', 'site', '--base-url', '--force'])).toEqual({
      kind: 'usage',
      problem: '`--base-url` needs a value.'
    });
  });

  it('refuses one folder, because a deploy with nowhere to go is nothing', () => {
    expect(parseArgs(['deploy', 'app'])).toMatchObject({ kind: 'usage' });
    expect((parseArgs(['deploy', 'app']) as { problem: string }).problem).toContain('No output folder');
  });

  it('refuses no folders, three folders and an unknown option', () => {
    expect(parseArgs(['deploy'])).toMatchObject({ kind: 'usage' });
    expect(parseArgs(['deploy', 'a', 'b', 'c'])).toMatchObject({ kind: 'usage' });
    expect(parseArgs(['deploy', 'app', 'site', '--dry-run'])).toEqual({
      kind: 'usage',
      problem: 'Unknown option: --dry-run.'
    });
  });

  it('the help says what deploy is and how it differs from export', () => {
    // 🔴 The one thing a person most needs and cannot infer from either command's name. #36 files
    // them as one row; they produce different artefacts and only one of them needs a build step.
    expect(USAGE).toContain('nodegx deploy <project> <output>');
    expect(USAGE).toContain('export or deploy?');
    expect(USAGE).toContain('9  deploy: the site that was written would render nothing');
  });
});

/** A report shaped like a good run, so each row below changes exactly one thing. */
const good = (over: Partial<EngineReport> = {}): EngineReport => ({
  ok: true,
  projectName: 'Landing pages',
  nodeTypes: 160,
  copied: 0,
  excluded: [],
  files: ['index.html', 'index-abc.js'],
  roots: {
    components: 21,
    withRoots: 21,
    withoutRoots: [],
    rootComponent: '/App',
    rootComponentRenders: true,
    indexJs: 'index-abc.js'
  },
  blank: null,
  warnings: [],
  ...over
});

describe('HLS-015 AC2 — a deploy that would ship a blank site is a failure', () => {
  it('exits 9 and says so before it says anything that reads like success', () => {
    const grade = gradeDeploy(good({ blank: 'Not one of the 21 deployed components carries a root node.' }), '/out');
    expect(grade.code).toBe(EXIT.deploy);
    // 🔴 The FIRST line. "12 files written" above "this site is blank" is a sentence that gets
    // skimmed past, and a person who skims it uploads the folder.
    expect(grade.lines[0]).toContain('blank site');
    expect(grade.lines.join('\n')).toContain('Do not upload it');
  });

  it('a good run exits 0 and names the folder to serve', () => {
    const grade = gradeDeploy(good(), '/out');
    expect(grade.code).toBe(EXIT.ok);
    expect(grade.lines[0]).toContain('21 of 21 components render');
    expect(grade.lines.join('\n')).toContain('nodegx serve /out');
  });

  it('a component with no root of its own is a NOTE, not a failure', () => {
    // 🔴 The rule the engine's `gradeRoots` owns, asserted from this side too: a logic-only helper
    // component legitimately renders nothing, and a gate on "no rootless component" refuses the
    // correct answer. `count-the-request, not the node that would make it`.
    const grade = gradeDeploy(
      good({ roots: { ...good().roots!, withRoots: 20, withoutRoots: ['/Helpers/Timer'] } }),
      '/out'
    );
    expect(grade.code).toBe(EXIT.ok);
    expect(grade.lines.join('\n')).toContain('/Helpers/Timer');
  });
});

describe('HLS-015 — the engine stage decides the exit code', () => {
  // Each row is a different thing for a pipeline to do next. That is the whole argument for the
  // table in exitCodes.ts, so it is asserted as a table.
  const rows: [EngineReport['stage'], number][] = [
    ['usage', EXIT.usage],
    ['project', EXIT.project],
    ['target', EXIT.target],
    ['runtime', EXIT.harness],
    ['write', EXIT.write]
  ];
  it.each(rows)('stage %s exits %i', (stage, code) => {
    expect(gradeDeploy({ ok: false, stage, message: 'nope' }, '/out').code).toBe(code);
  });

  it('only the part-way failure warns that the folder is half a site', () => {
    expect(gradeDeploy({ ok: false, stage: 'write', message: 'disk full' }, '/out').lines.join('\n')).toContain(
      'may now hold part of a site'
    );
    expect(gradeDeploy({ ok: false, stage: 'project', message: 'no root' }, '/out').lines.join('\n')).not.toContain(
      'part of a site'
    );
  });

  it('an engine that says nothing at all still produces a code and a sentence', () => {
    const grade = gradeDeploy({}, '/out');
    expect(grade.code).toBe(EXIT.write);
    expect(grade.lines[0]).toContain('said nothing');
  });

  it('the DEP-008 exclusion report reaches the person', () => {
    // "my logo is missing" and ".env was excluded" are different problems and the copy step is the
    // only thing that knows which happened.
    const grade = gradeDeploy(
      good({ excluded: [{ path: '.env', rule: '.env', reason: 'environment / credential file' }] }),
      '/out'
    );
    expect(grade.lines.join('\n')).toContain('.env — .env (environment / credential file)');
  });
});

describe('HLS-015 AC3 / C72 — resolving the deploy engine', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls015-engine-'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('finds the bundle two levels up from dist/', () => {
    const dist = path.join(tmp, 'packages', 'nodegx-export', 'dist');
    const engine = path.join(tmp, 'packages', 'noodl-preview', 'dist', 'nodegx-deploy.cjs');
    fs.mkdirSync(dist, { recursive: true });
    fs.mkdirSync(path.dirname(engine), { recursive: true });
    fs.writeFileSync(engine, '');
    expect(resolveEngine(dist, {}).entry).toBe(engine);
  });

  it('finds it three levels up from src/cli/, which is where the specs run', () => {
    const src = path.join(tmp, 'packages', 'nodegx-export', 'src', 'cli');
    const engine = path.join(tmp, 'packages', 'noodl-preview', 'dist', 'nodegx-deploy.cjs');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(path.dirname(engine), { recursive: true });
    fs.writeFileSync(engine, '');
    expect(resolveEngine(src, {}).entry).toBe(engine);
  });

  it('an installed package finds nothing, and that is the shipped behaviour', () => {
    // 🔴 C72's shape. In `node_modules/@nodegx/export/dist`, two levels up is `node_modules`,
    // which holds no `noodl-preview`. The published package cannot deploy and must say so rather
    // than resolve something by coincidence of directory depth.
    const installed = path.join(tmp, 'node_modules', '@nodegx', 'export', 'dist');
    fs.mkdirSync(installed, { recursive: true });
    const resolved = resolveEngine(installed, {});
    expect(resolved.entry).toBeNull();
    expect(resolved.unbuiltPackage).toBeUndefined();
    expect(describeMissingEngine(resolved)).toContain('cannot deploy');
    expect(describeMissingEngine(resolved)).toContain('nodegx export` needs none of it');
    // A refusal that cannot say where it looked sends the reader to guess at a layout.
    for (const probed of resolved.probed) expect(describeMissingEngine(resolved)).toContain(probed);
  });

  it('a checkout with an unbuilt engine gets the OTHER sentence', () => {
    // 🔴 Two different fixes. Telling somebody standing in a checkout to set an environment
    // variable sends them to solve the wrong problem.
    const dist = path.join(tmp, 'packages', 'nodegx-export', 'dist');
    const preview = path.join(tmp, 'packages', 'noodl-preview');
    fs.mkdirSync(dist, { recursive: true });
    fs.mkdirSync(preview, { recursive: true });
    fs.writeFileSync(path.join(preview, 'package.json'), '{}');
    const resolved = resolveEngine(dist, {});
    expect(resolved.entry).toBeNull();
    expect(resolved.unbuiltPackage).toBe(preview);
    expect(describeMissingEngine(resolved)).toContain('npm run build --workspace @noodl/preview');
  });

  it('an override that points at nothing is an error, never a fall-through', () => {
    // Setting it is a deliberate act, so a typo must say so. Falling back silently would run a
    // different engine from the one the caller redirected to.
    const dist = path.join(tmp, 'packages', 'nodegx-export', 'dist');
    const engine = path.join(tmp, 'packages', 'noodl-preview', 'dist', 'nodegx-deploy.cjs');
    fs.mkdirSync(dist, { recursive: true });
    fs.mkdirSync(path.dirname(engine), { recursive: true });
    fs.writeFileSync(engine, '');
    const resolved = resolveEngine(dist, { [ENGINE_ENV]: path.join(tmp, 'nope.cjs') });
    expect(resolved.entry).toBeNull();
    expect(resolved.overrideMissing).toBe(path.join(tmp, 'nope.cjs'));
    expect(describeMissingEngine(resolved)).toContain('and there is nothing there');
  });

  it('an override that points at something wins', () => {
    const target = path.join(tmp, 'elsewhere.cjs');
    fs.writeFileSync(target, '');
    expect(resolveEngine(tmp, { [ENGINE_ENV]: target }).entry).toBe(target);
  });
});
