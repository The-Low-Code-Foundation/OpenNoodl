/**
 * EXP-017 AC1 / AC2 — what `nodegx deploy` says about the engine it picked up, and what it exits.
 *
 * The engine's own half — reading a bundle, refusing a development one before a byte is written —
 * is graded in `packages/noodl-preview/tests/`, against four real builds and a real deploy. This
 * is the front door's half: the exit code a pipeline branches on, the line a person reads, and the
 * record the refusal has to take back. All pure, which is the point — the sentence that appears on
 * a run somebody has been waiting seventy seconds for is graded here in a millisecond.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ALLOW_DEV_ENGINE_FLAG, parseArgs, USAGE } from '../src/cli/args';
import { engineLines, gradeDeploy, type EngineBuild, type EngineReport } from '../src/cli/deploy';
import { MANIFEST_NAME, readManifest, writeManifest } from '../src/cli/deployManifest';
import { EXIT } from '../src/cli/exitCodes';

/** A production reading, shaped like the one the engine sends. */
const production: EngineBuild = {
  path: '/repo/packages/noodl-editor/src/external/deploy/noodl.deploy.js',
  bytes: 1_565_992,
  lines: 2,
  sourceMapBytes: 0,
  licenseSibling: true,
  kind: 'production',
  reasons: ['it carries no inline source map', 'it is minified — 2 line(s) for 1.49 MB']
};

/** The measured development build — 14.26 MB, 66.1% of it a welded map. */
const development: EngineBuild = {
  ...production,
  bytes: 14_953_525,
  lines: 110_716,
  sourceMapBytes: 9_877_712,
  licenseSibling: false,
  kind: 'development',
  reasons: ['it ends with a 9.42 MB inline source map', 'it is not minified — 110,716 lines']
};

/** A report shaped like a good run, so each row changes exactly one thing. */
const good = (over: Partial<EngineReport> = {}): EngineReport => ({
  ok: true,
  projectName: 'Landing pages',
  nodeTypes: 160,
  copied: 3,
  excluded: [],
  files: ['index.html', 'index-abc.js'],
  engine: production,
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

describe('EXP-017 AC1 — every run names the build it picked up', () => {
  it('a good run says which engine it copied, in the summary a person reads', () => {
    const grade = gradeDeploy(good(), '/tmp/site');

    expect(grade.code).toBe(EXIT.ok);
    const printed = grade.lines.join('\n');
    expect(printed).toContain('engine: production build of the NodeGX viewer, 1.49 MB');
    expect(printed).toContain(production.path);
  });

  it('and it is not hidden behind a flag, a --dry-run, or a failure', () => {
    // 🔴 The defect EXP-017 was opened on is not that the deploy chose wrongly. It is that a run
    // which had just copied 14 MB of development bundle reported `39 entries` and exit 0 — so the
    // reading has to be in the output of the run that succeeded, which is this one.
    const quiet = gradeDeploy(good({ excluded: [], warnings: [] }), '/tmp/site');
    expect(quiet.lines.some((line) => line.includes('engine:'))).toBe(true);
  });

  it('a development engine that WAS shipped is reported as such, loudly', () => {
    const grade = gradeDeploy(good({ engine: development }), '/tmp/site');

    expect(grade.code).toBe(EXIT.ok);
    const printed = grade.lines.join('\n');
    expect(printed).toContain('! engine: DEVELOPMENT build');
    expect(printed).toContain('9.42 MB is an inline source map of the NodeGX viewer source');
    expect(printed).toContain(ALLOW_DEV_ENGINE_FLAG);
    expect(printed).toContain('read the viewer source');
  });

  it('an engine that said nothing is reported as nothing, not as production', () => {
    // An older engine bundle under a newer front door. Silence is the honest rendering of an
    // absent field; the one wrong answer is to fill it in with the reassuring value.
    expect(engineLines(undefined)).toEqual([]);
    const grade = gradeDeploy(good({ engine: undefined }), '/tmp/site');
    expect(grade.lines.some((line) => line.includes('engine:'))).toBe(false);
    expect(grade.code).toBe(EXIT.ok);
  });
});

describe('EXP-017 AC2 — a development engine gets its own exit code', () => {
  it('exit 11, and not 8, 9 or 5', () => {
    const grade = gradeDeploy(
      { ok: false, stage: 'engine', message: 'This deploy would publish a DEVELOPMENT build…', engine: development },
      '/tmp/site'
    );

    expect(grade.code).toBe(EXIT.engine);
    expect(grade.code).not.toBe(EXIT.harness);
    expect(grade.code).not.toBe(EXIT.deploy);
    expect(grade.code).not.toBe(EXIT.write);
  });

  it('says nothing was written — the opposite of what a part-way write says', () => {
    // 🔴 These two sentences are about the same folder and they contradict each other, which is
    // why they must not both be reachable from one code path. A caller told "this may hold part of
    // a site" cleans the folder out; a refusal taken before the first write has nothing to clean.
    const refused = gradeDeploy({ ok: false, stage: 'engine', message: 'nope', engine: development }, '/tmp/site');
    const partial = gradeDeploy({ ok: false, stage: 'write', message: 'disk full' }, '/tmp/site');

    expect(refused.lines.join('\n')).toContain('Nothing was written to /tmp/site.');
    expect(refused.lines.join('\n')).not.toContain('may now hold part of a site');
    expect(partial.lines.join('\n')).toContain('may now hold part of a site');
  });

  it('the refusal reaches the person verbatim, map size and all', () => {
    const message =
      'This deploy would publish a DEVELOPMENT build of the NodeGX viewer, so nothing was written.\n' +
      'It ends with a 9.42 MB inline source map — 66% of the file.';
    const grade = gradeDeploy({ ok: false, stage: 'engine', message, engine: development }, '/tmp/site');

    expect(grade.lines[0]).toBe(message);
  });
});

describe('EXP-017 — the flag', () => {
  it('parses, and does not quietly grant --force as well', () => {
    // ⚠️ It would have. The parser matched deploy flags against a SET whose every member set
    // `force`, so a second entry in that set would have made this flag mean "overwrite a folder
    // holding somebody's website" too.
    const parsed = parseArgs(['deploy', 'app', 'site', ALLOW_DEV_ENGINE_FLAG]);

    expect(parsed).toMatchObject({ kind: 'deploy', allowDevelopmentEngine: true, force: false });
    expect(parseArgs(['deploy', 'app', 'site', '--force'])).toMatchObject({
      force: true,
      allowDevelopmentEngine: false
    });
  });

  it('is off unless it is typed', () => {
    expect(parseArgs(['deploy', 'app', 'site'])).toMatchObject({ allowDevelopmentEngine: false });
  });

  it('the help documents the flag, the code and what the flag permits', () => {
    expect(USAGE).toContain(ALLOW_DEV_ENGINE_FLAG);
    expect(USAGE).toContain('11  deploy: the NodeGX viewer build here is a DEVELOPMENT build');
    // The reason, not just the name. Somebody reading `--allow-development-engine` and nothing
    // else has no way to know that what it allows is publishing the viewer's own source.
    expect(USAGE).toContain('inline source map');
  });
});

describe('EXP-017 — the record a refusal takes back', () => {
  /**
   * 🔴 `runDeploy` writes an `in-progress` manifest BEFORE the engine runs, because for every other
   * failure that record is the only durable evidence that a folder holds half a site. This refusal
   * is the one that happens above the first write, so leaving the record would make the next run
   * announce a recovery from a deploy that never began — evidence of a write, and there was none.
   *
   * The rows below drive the two branches of that restore directly, because provoking them through
   * `runDeploy` needs a real engine and a 15 MB fixture to answer with.
   */
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp017-manifest-'));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('a fresh folder is left with no record at all', () => {
    writeManifest(dir, { version: 1, state: 'in-progress', projectName: 'app', startedAt: 'now' }, fs);
    expect(readManifest(dir, fs).kind).toBe('manifest');

    // What `runDeploy` does on `stage === 'engine'` with no previous deploy.
    fs.rmSync(path.join(dir, MANIFEST_NAME), { force: true });

    expect(readManifest(dir, fs)).toEqual({ kind: 'none' });
  });

  it("a folder that already held a finished deploy keeps that deploy's record", () => {
    const previous = {
      version: 1 as const,
      state: 'complete' as const,
      projectName: 'live site',
      startedAt: 'yesterday',
      finishedAt: 'yesterday',
      buildId: 'index-old.js',
      entries: ['index.html', 'index-old.js']
    };
    writeManifest(dir, previous, fs);
    writeManifest(dir, { version: 1, state: 'in-progress', projectName: 'live site', startedAt: 'now' }, fs);

    // What `runDeploy` does on `stage === 'engine'` when there was one.
    writeManifest(dir, previous, fs);

    const reading = readManifest(dir, fs);
    expect(reading.kind).toBe('manifest');
    expect(reading.kind === 'manifest' && reading.manifest).toEqual(previous);
  });
});
