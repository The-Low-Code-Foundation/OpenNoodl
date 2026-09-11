/**
 * HLS-014 — the second deploy into a folder, graded without deploying anything.
 *
 * A real redeploy of `templates/landing-pages` takes about seventy seconds and needs a built
 * engine, a viewer runtime and ~15 MB of writes. Every decision it makes is in this file instead:
 * what kind of deploy this is, what the previous one left that this one should remove, whether
 * anything changed at all, and what a served site's own answer means. `tests/hls014-drive.mjs`
 * performs the whole thing for real — including an interruption — and the two are supposed to
 * agree; these rows are what makes each branch cheap enough to have a gate at all.
 *
 * ⚠️ The `fs` here is a real one against a real temp directory, not a fake. Two of the four
 * acceptance criteria are about what a folder holds after a process died in the middle, and a
 * stub filesystem is a description of what the author believed the disk would do.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { parseArgs } from '../src/cli/args';
import { gradeDeploy, type EngineReport, type UpdateContext } from '../src/cli/deploy';
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
} from '../src/cli/deployManifest';
import { EXIT } from '../src/cli/exitCodes';
import { entryFromHtml, gradeLive, type LiveReading } from '../src/cli/live';

const complete = (over: Partial<DeployManifest> = {}): DeployManifest => ({
  version: 1,
  state: 'complete',
  projectName: 'Landing pages',
  startedAt: '2026-09-10T10:00:00.000Z',
  finishedAt: '2026-09-10T10:01:10.000Z',
  buildId: 'index-b529d7656259c342.js',
  entries: ['index-b529d7656259c342.js', 'index.html', 'noodl_bundles/b2-6ac1955a1e568848.json'],
  ...over
});

describe('HLS-014 — what kind of deploy is this', () => {
  it('an empty folder is a first deploy and says nothing about it', () => {
    const what = disposition(0, { kind: 'none' });
    expect(what.kind).toBe('fresh');
    expect(announce(what, '/out', false)).toEqual({ stop: false, lines: [] });
  });

  it('🔴 a folder this command finished deploying into is an UPDATE, and needs no --force', () => {
    // The whole task in one row. HLS-015 refused every non-empty folder without `--force`, which
    // is right for somebody's web root and wrong for the folder this command wrote ten minutes
    // ago — and "an agent ships a change to an app that is already live" is only ever the second.
    const what = disposition(9, { kind: 'manifest', manifest: complete() });
    expect(what.kind).toBe('update');
    const said = announce(what, '/out', false);
    expect(said.stop).toBe(false);
    expect(said.lines.join('\n')).toContain('Updating the deploy already in /out');
    expect(said.lines.join('\n')).toContain('anything else in the folder is left alone');
  });

  it('🔴 an unfinished deploy is a RECOVERY, proceeds, and says which state the folder is in', () => {
    // AC2. The folder holds part of a site; deploying again is the fix, so this must not be a
    // refusal — a pipeline that stopped here would need a human to unstick it, and this phase is
    // about the case with nobody watching.
    const what = disposition(4, { kind: 'manifest', manifest: complete({ state: 'in-progress', buildId: undefined }) });
    expect(what.kind).toBe('recover');
    const said = announce(what, '/out', false);
    expect(said.stop).toBe(false);
    expect(said.lines.join('\n')).toContain('did not finish');
    expect(said.lines.join('\n')).toContain('holds part of a site');
  });

  it('a folder holding something else is refused without --force', () => {
    const what = disposition(12, { kind: 'none' });
    expect(what.kind).toBe('foreign');
    const said = announce(what, '/out', false);
    expect(said.stop).toBe(true);
    expect(said.lines.join('\n')).toContain('nobody to ask here');
  });

  it('and written into with --force, which says that nothing will be swept', () => {
    // 🔴 The asymmetry is deliberate: `--force` buys permission to overwrite, never permission to
    // delete. There is no record of what this command may remove from a folder it did not write.
    const said = announce(disposition(12, { kind: 'none' }), '/out', true);
    expect(said.stop).toBe(false);
    expect(said.lines.join('\n')).toContain('nothing is swept');
  });

  it('a record it cannot read is foreign, not an update', () => {
    const what = disposition(3, { kind: 'unreadable', reason: `${MANIFEST_NAME} is not JSON (bad).` });
    expect(what.kind).toBe('foreign');
    expect(announce(what, '/out', false).stop).toBe(true);
  });
});

describe('HLS-014 — what the previous deploy left that this one removes', () => {
  it('the previous deploy’s files that this one did not write', () => {
    expect(
      sweepPlan(
        ['index-old.js', 'index.html', 'noodl_bundles/b2-old.json'],
        ['index-new.js', 'index.html', 'noodl_bundles/b2-new.json']
      )
    ).toEqual(['index-old.js', 'noodl_bundles/b2-old.json']);
  });

  it('🔴 and NOTHING the previous deploy did not record writing', () => {
    // A `CNAME`, a `robots.txt`, a `.well-known/`. A deploy command that quietly empties a web
    // root is a far worse failure than the stale file it was tidying up, so the sweep is driven by
    // the record and never by "everything in the folder that is not in this build".
    expect(sweepPlan(['index-old.js'], ['index-new.js', 'CNAME', 'robots.txt'])).toEqual(['index-old.js']);
  });

  it('the record itself is never swept', () => {
    expect(sweepPlan([MANIFEST_NAME, 'index-old.js'], ['index-new.js'])).toEqual(['index-old.js']);
  });

  it('a first deploy sweeps nothing', () => {
    expect(sweepPlan(undefined, ['index-new.js'])).toEqual([]);
  });
});

describe('HLS-014 — did this deploy change anything', () => {
  it('the same export and the same files is IDENTICAL', () => {
    const previous = complete();
    expect(compareDeploys(previous, { buildId: previous.buildId!, entries: previous.entries! })).toBe('identical');
  });

  it('a different export is CHANGED', () => {
    const previous = complete();
    expect(compareDeploys(previous, { buildId: 'index-other.js', entries: previous.entries! })).toBe('changed');
  });

  it('🔴 the same export with a project asset added or gone is CHANGED', () => {
    // `buildId` alone is not enough. The export can be byte-identical while a copied asset has
    // moved, and "identical" is read by a person as *nothing about this site moved*.
    const previous = complete();
    expect(compareDeploys(previous, { buildId: previous.buildId!, entries: [...previous.entries!, 'logo.svg'] })).toBe(
      'changed'
    );
  });

  it('an unfinished previous deploy is not something to compare against', () => {
    expect(compareDeploys(complete({ state: 'in-progress' }), { buildId: 'x', entries: [] })).toBe('first');
  });
});

describe('HLS-014 — the record on a real disk', () => {
  let tmp: string;
  beforeEach(() => (tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls014-manifest-'))));
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('round-trips', () => {
    writeManifest(tmp, complete(), fs);
    const read = readManifest(tmp, fs);
    expect(read.kind).toBe('manifest');
    expect(read.kind === 'manifest' && read.manifest.buildId).toBe('index-b529d7656259c342.js');
  });

  it('a folder with no record says so rather than throwing', () => {
    expect(readManifest(tmp, fs)).toEqual({ kind: 'none' });
  });

  it('a record that is not JSON is unreadable, not empty', () => {
    fs.writeFileSync(path.join(tmp, MANIFEST_NAME), 'half a fi');
    expect(readManifest(tmp, fs).kind).toBe('unreadable');
  });

  it('a record from a version that means something else is unreadable', () => {
    fs.writeFileSync(path.join(tmp, MANIFEST_NAME), JSON.stringify({ version: 7, state: 'complete' }));
    expect(readManifest(tmp, fs).kind).toBe('unreadable');
  });

  it('lists every file under the folder and never the record', () => {
    fs.mkdirSync(path.join(tmp, 'noodl_bundles'));
    fs.writeFileSync(path.join(tmp, 'index.html'), 'x');
    fs.writeFileSync(path.join(tmp, 'noodl_bundles', 'b1.json'), '[]');
    writeManifest(tmp, complete(), fs);
    expect(listEntries(tmp, fs)).toEqual(['index.html', 'noodl_bundles/b1.json']);
  });

  it('sweeps the files it was given and the directory they empty', () => {
    fs.mkdirSync(path.join(tmp, 'noodl_bundles'));
    fs.writeFileSync(path.join(tmp, 'noodl_bundles', 'b1-old.json'), '[]');
    fs.writeFileSync(path.join(tmp, 'index-old.js'), 'x');
    expect(sweep(tmp, ['index-old.js', 'noodl_bundles/b1-old.json'], fs)).toEqual([
      'index-old.js',
      'noodl_bundles/b1-old.json'
    ]);
    expect(fs.existsSync(path.join(tmp, 'noodl_bundles'))).toBe(false);
  });

  it('🔴 a file already gone is not a failure, and does not stop the rest of the sweep', () => {
    // Somebody deleted it by hand between two deploys. A sweep that threw here would leave the
    // folder in exactly the state the sweep exists to prevent.
    fs.writeFileSync(path.join(tmp, 'b.js'), 'x');
    expect(sweep(tmp, ['a.js', 'b.js'], fs)).toEqual(['b.js']);
  });

  it('and a directory that still holds something is left alone', () => {
    fs.mkdirSync(path.join(tmp, 'noodl_bundles'));
    fs.writeFileSync(path.join(tmp, 'noodl_bundles', 'b1-old.json'), '[]');
    fs.writeFileSync(path.join(tmp, 'noodl_bundles', 'b1-new.json'), '[]');
    sweep(tmp, ['noodl_bundles/b1-old.json'], fs);
    expect(fs.readdirSync(path.join(tmp, 'noodl_bundles'))).toEqual(['b1-new.json']);
  });
});

/** A report shaped like a good run, so each row below changes exactly one field. */
const report = (over: Partial<EngineReport> = {}): EngineReport => ({
  ok: true,
  projectName: 'Landing pages',
  copied: 0,
  excluded: [],
  files: ['index-new.js', 'index.html'],
  roots: {
    components: 21,
    withRoots: 21,
    withoutRoots: [],
    rootComponent: '/App',
    rootComponentRenders: true,
    indexJs: 'index-new.js',
    staleBundles: []
  },
  blank: null,
  warnings: [],
  ...over
});

const update = (over: Partial<UpdateContext> = {}): UpdateContext => ({
  comparison: 'changed',
  swept: [],
  recovered: false,
  strayBundles: [],
  entries: ['index-new.js', 'index.html'],
  ...over
});

describe('HLS-014 — what the deploy says it did', () => {
  it('a first deploy reads exactly as it did before this task', () => {
    const grade = gradeDeploy(report(), '/out');
    expect(grade.code).toBe(EXIT.ok);
    expect(grade.lines[0]).toContain('deployed to /out — 2 entries');
  });

  it('an update says "updated", not "deployed"', () => {
    expect(gradeDeploy(report(), '/out', update()).lines[0]).toContain('updated in /out');
  });

  it('🔴 AC4 — a second identical deploy is reported as identical, not as a fresh success', () => {
    // The exit code and the files are the same either way, and the facts are not. An agent that
    // redeploys after an edit and is told "deployed, 9 entries" has learned nothing about whether
    // its edit reached the artefact, which is the only thing it wanted to know.
    const grade = gradeDeploy(report(), '/out', update({ comparison: 'identical' }));
    expect(grade.code).toBe(EXIT.ok);
    expect(grade.lines[0]).toContain('is unchanged');
    expect(grade.lines[0]).toContain('Nothing was added and nothing was removed');
    expect(grade.lines[0]).not.toContain('deployed to');
  });

  it('names the files the previous deploy left that this one removed', () => {
    const lines = gradeDeploy(report(), '/out', update({ swept: ['index-old.js', 'noodl_bundles/b2-old.json'] })).lines;
    expect(lines.join('\n')).toContain('2 file(s) from the previous deploy removed');
    expect(lines.join('\n')).toContain('noodl_bundles/b2-old.json');
  });

  it('says out loud that it recovered an unfinished deploy', () => {
    expect(gradeDeploy(report(), '/out', update({ recovered: true })).lines.join('\n')).toContain(
      'unfinished deploy that was in this folder has been replaced'
    );
  });

  it('warns about bundles it was not allowed to sweep', () => {
    // The `--force` case: they are served at their own URLs and nothing has a record saying they
    // may be deleted, so the only honest thing left is to name them.
    const lines = gradeDeploy(report(), '/out', update({ strayBundles: ['b2-old.json'] })).lines;
    expect(lines.join('\n')).toContain('are not part of this app and were left in place');
    expect(lines.join('\n')).toContain('b2-old.json');
  });

  it('🔴 an update that would ship a blank site is still refused, and the refusal comes first', () => {
    // The interaction that matters: everything above is reporting, and none of it may soften the
    // one branch that exists to stop an upload.
    const grade = gradeDeploy(report({ blank: 'Not one of the 21 …' }), '/out', update({ comparison: 'identical' }));
    expect(grade.code).toBe(EXIT.deploy);
    expect(grade.lines[0]).toContain('blank site');
  });
});

describe('HLS-014 AC3 — what a served site says about itself', () => {
  const live = (over: Partial<LiveReading> = {}): LiveReading => ({
    askedUrl: 'http://host/',
    finalUrl: 'http://host/',
    status: 200,
    entry: 'index-b529d7656259c342.js',
    entryStatus: 200,
    ...over
  });

  it('reads the hashed export out of a served page', () => {
    expect(entryFromHtml('<html><script src="/index-abc123.js"></script></html>')).toBe('index-abc123.js');
  });

  it('and out of one served from a subfolder', () => {
    expect(entryFromHtml('<script src="/app/v2/index-abc123.js"></script>')).toBe('index-abc123.js');
  });

  it('a page naming none is not a site this command deployed', () => {
    expect(entryFromHtml('<html><h1>Coming soon</h1></html>')).toBeNull();
    expect(gradeLive(live({ entry: null })).code).toBe(EXIT.stale);
  });

  it('nothing answering is a different verdict from something answering wrongly', () => {
    // A 404 from the host is a deploy that has not landed; a 200 serving last week's app is a
    // deploy that landed somewhere nobody is looking. A pipeline does different things about them.
    expect(gradeLive(live({ status: 404 })).code).toBe(EXIT.serve);
  });

  it('🔴 a page that names an export the server does not hold', () => {
    // The case a cache produces, and the reason the export is fetched rather than trusted. Every
    // check that stops at the HTML says this site is fine; anybody loading it gets a blank screen.
    const grade = gradeLive(live({ entryStatus: 404 }));
    expect(grade.code).toBe(EXIT.stale);
    expect(grade.lines.join('\n')).toContain('anyone loading this URL gets a blank screen');
  });

  it('🔴 a redirect is reported under the URL it ended at (C74)', () => {
    const grade = gradeLive(live({ askedUrl: 'http://host/app', finalUrl: 'http://host/app/' }));
    expect(grade.lines[0]).toContain('redirected to http://host/app/');
    expect(grade.code).toBe(EXIT.ok);
  });

  it('with no folder to compare against, it still answers what is live', () => {
    const grade = gradeLive(live());
    expect(grade.code).toBe(EXIT.ok);
    expect(grade.lines.join('\n')).toContain('is serving index-b529d7656259c342.js');
  });

  it('the live site IS the build in the folder', () => {
    expect(gradeLive(live(), { manifest: complete(), folder: '/out' }).code).toBe(EXIT.ok);
  });

  it('🔴 and when it is not, that is its own exit code', () => {
    const grade = gradeLive(live({ entry: 'index-somethingelse.js' }), { manifest: complete(), folder: '/out' });
    expect(grade.code).toBe(EXIT.stale);
    expect(grade.lines.join('\n')).toContain('The live site is a different build');
  });

  it('a folder with no record is a wrong argument, not a stale site', () => {
    expect(gradeLive(live(), { manifest: null, folder: '/out' }).code).toBe(EXIT.target);
  });

  it('a folder holding an unfinished deploy is not a build to compare against', () => {
    const grade = gradeLive(live(), {
      manifest: complete({ state: 'in-progress', buildId: undefined }),
      folder: '/out'
    });
    expect(grade.code).toBe(EXIT.target);
    expect(grade.lines.join('\n')).toContain('never finished');
  });
});

describe('HLS-014 — nodegx live, at the front door', () => {
  it('parses a URL and a folder', () => {
    expect(parseArgs(['live', 'https://example.com/', '--against', 'site'])).toEqual({
      kind: 'live',
      url: 'https://example.com/',
      against: 'site'
    });
  });

  it('the folder is optional', () => {
    expect(parseArgs(['live', 'http://127.0.0.1:8575/'])).toEqual({
      kind: 'live',
      url: 'http://127.0.0.1:8575/',
      against: null
    });
  });

  it('🔴 a folder where the URL goes is a usage error that says why', () => {
    // The mistake somebody makes once, having typed four other commands that take a folder there.
    const parsed = parseArgs(['live', './site']);
    expect(parsed.kind).toBe('usage');
    expect(parsed.kind === 'usage' && parsed.problem).toContain('needs http:// or https://');
  });

  it('--against with nothing after it is a usage error, not a swallowed flag', () => {
    expect(parseArgs(['live', 'http://host/', '--against']).kind).toBe('usage');
  });
});
