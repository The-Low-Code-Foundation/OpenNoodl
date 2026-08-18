/**
 * CN-017 AC3 + AC5 — the provenance record, and the one sanctioned way to put it
 * on a screen.
 *
 * 🔴 **The defect this file grades against is a record whose fields can
 * contradict each other.** `{source: 'local', verified: false}` reads as
 * suspicious and `{source: 'local', verified: true}` reads as a lie, and both are
 * wrong about the same kit. The union is what makes the contradiction
 * unconstructable — and `describeKitOrigin` is what stops two surfaces phrasing
 * the same record two ways.
 *
 * ⚠️ **AC5 is graded as an absence with a known-firing signal beside it**: the
 * copy assertions check that the word "safe" appears nowhere, *and* that the
 * strings being searched are non-empty and contain what they should. An absence
 * check over an empty string passes for the wrong reason.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { installTestFileSystem } from '../cn-006/testFileSystem';

installTestFileSystem();

import {
  createNodeKit,
  describeKitOrigin,
  KIT_PROVENANCE_FILE,
  listNodeKits,
  pruneKitProvenance,
  readKitProvenance,
  recordKitProvenance,
  type KitProvenance
} from '../../src/shared/utils/projectmodules';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn017-prov-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const INSTALLED: KitProvenance = {
  module: 'charts',
  origin: 'installed',
  url: 'https://cdn.example.com/charts.zip',
  installedAt: '2026-08-18T10:00:00.000Z',
  verification: { ok: true, outcome: 'defines-nodes', message: 'Defines 1 node: Chart.', nodes: ['Chart'] },
  consentedAt: '2026-08-18T09:59:00.000Z'
};

describe('CN-017 AC1 — scaffolding records an origin and asks nothing', () => {
  /*
   * ✅ D6's first part. The record is a *write*, never a check: nothing here may
   * block, prompt or verify, and `createNodeKit` returning ok is the assertion
   * that it did not.
   */
  it('records a scaffolded kit as local, with no verification field on the record', async () => {
    const created = await createNodeKit(dir, 'Weather Kit');
    expect(created.ok).toBe(true);

    const [record] = await readKitProvenance(dir);
    expect(record.module).toBe(created.moduleName);
    expect(record.origin).toBe('local');
    // 🔴 The arm has no verification field to misread — this is the union doing
    // the work the trap warns a flat record cannot do.
    expect('verification' in record).toBe(false);
  });

  /*
   * ⚠️ **The record lives outside the kit's own manifest, and that is the point.**
   * A `manifest.json` arrives inside the archive, authored by the party being
   * vouched for, so a kit could ship `origin: 'local'` and be believed.
   */
  it('does not write provenance into the kit manifest', async () => {
    const created = await createNodeKit(dir, 'Weather Kit');
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'noodl_modules', created.moduleName!, 'manifest.json'), 'utf8')
    );
    expect(manifest.origin).toBeUndefined();
    expect(manifest.provenance).toBeUndefined();
  });

  /*
   * 🔴 Measured, and load-bearing for the file's placement: the one scanner keeps
   * only `isDirectory() || isSymbolicLink()` entries, so a plain file under
   * `noodl_modules/` cannot become a phantom module in any list.
   */
  it('is a plain file the module scanner cannot mistake for a module', async () => {
    await createNodeKit(dir, 'Weather Kit');
    expect(fs.existsSync(path.join(dir, KIT_PROVENANCE_FILE))).toBe(true);

    const kits = await listNodeKits(dir);
    expect(kits.map((k) => k.dirName)).toEqual(['weather-kit']);
  });
});

describe('CN-017 AC3 — the record survives, merges and joins onto the kits list', () => {
  it('replaces one module’s record without dropping the others', async () => {
    await recordKitProvenance(dir, [{ module: 'a', origin: 'local', createdAt: '2026-08-01T00:00:00.000Z' }]);
    await recordKitProvenance(dir, [INSTALLED]);
    await recordKitProvenance(dir, [{ module: 'charts', origin: 'local', createdAt: '2026-08-19T00:00:00.000Z' }]);

    const records = await readKitProvenance(dir);
    expect(records.map((r) => r.module).sort()).toEqual(['a', 'charts']);
    // Last write wins per module: reinstalling from elsewhere must not leave the
    // old origin standing beside the new one.
    expect(records.find((r) => r.module === 'charts')!.origin).toBe('local');
  });

  it('joins onto listNodeKits by folder name', async () => {
    const created = await createNodeKit(dir, 'Weather Kit');
    await recordKitProvenance(dir, [{ ...INSTALLED, module: created.moduleName! }]);

    const [kit] = await listNodeKits(dir);
    expect(kit.provenance!.origin).toBe('installed');
  });

  it('reads a missing or malformed file as no records rather than throwing', async () => {
    expect(await readKitProvenance(dir)).toEqual([]);

    fs.mkdirSync(path.join(dir, 'noodl_modules'), { recursive: true });
    fs.writeFileSync(path.join(dir, KIT_PROVENANCE_FILE), '{ not json', 'utf8');
    expect(await readKitProvenance(dir)).toEqual([]);
  });

  /*
   * ⚠️ A kit removed and re-scaffolded under the same folder name must not
   * inherit the origin of the kit it replaced.
   */
  it('prunes records whose module is no longer on disk', () => {
    const kept = pruneKitProvenance([INSTALLED, { module: 'gone', origin: 'local', createdAt: 'x' }], ['charts']);
    expect(kept.map((r) => r.module)).toEqual(['charts']);
  });
});

describe('CN-017 AC5 — the copy says what the check established, and never that it is safe', () => {
  const cases: Array<[string, KitProvenance | undefined]> = [
    ['no record', undefined],
    ['local', { module: 'k', origin: 'local', createdAt: '2026-08-18T00:00:00.000Z' }],
    ['imported', { module: 'k', origin: 'imported', fromProject: 'a project on this computer', importedAt: '2026-08-18T00:00:00.000Z' }],
    ['installed', INSTALLED]
  ];

  it.each(cases)('the %s wording never claims safety', (_name, provenance) => {
    const described = describeKitOrigin(provenance);
    const text = `${described.label} ${described.title}`.toLowerCase();

    // 🔴 The known-firing half: assert the strings are real before asserting what
    // is absent from them. An absence check over an empty string passes for the
    // wrong reason.
    expect(described.label.length).toBeGreaterThan(0);
    expect(described.title.length).toBeGreaterThan(20);

    expect(text).not.toContain('safe');
    expect(text).not.toContain('trusted');
    expect(text).not.toContain('secure');
  });

  /*
   * 🔴 The four states must be four different sentences. Collapsing "we have no
   * record" into "you wrote it" is exactly how a downloaded kit ends up reading
   * as a local one.
   */
  it('gives each of the four states its own wording', () => {
    const labels = cases.map(([, p]) => describeKitOrigin(p).label);
    expect(new Set(labels).size).toBe(4);
    expect(describeKitOrigin(undefined).label).toContain('not recorded');
    expect(describeKitOrigin(INSTALLED).label).toContain('cdn.example.com');
  });

  it('carries the verification message into the installed wording, unreworded', () => {
    expect(describeKitOrigin(INSTALLED).title).toContain('Defines 1 node: Chart.');
  });

  it('says a URL-sourced module was not read, rather than implying it passed', () => {
    const notChecked: KitProvenance = {
      ...INSTALLED,
      verification: { ok: false, outcome: 'not-checked', message: 'Not checked: …', nodes: [] }
    };
    expect(describeKitOrigin(notChecked).title).toContain('was not read');
  });
});

describe('CN-017 — a record that does not match its own arm is not a record', () => {
  /*
   * 🔴 This file lives in the project's git history, so it goes through merges
   * and hand-edits. An `installed` record that lost its `verification` would
   * crash `describeKitOrigin` at render time, in a panel, on somebody else's
   * machine — and accepting a partial one would put back the contradiction the
   * union exists to prevent.
   */
  it('drops an installed record with no verification result, and keeps the valid ones', async () => {
    fs.mkdirSync(path.join(dir, 'noodl_modules'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, KIT_PROVENANCE_FILE),
      JSON.stringify([
        { module: 'half', origin: 'installed', url: 'https://x/y.zip', installedAt: 'a', consentedAt: 'b' },
        { module: 'ok', origin: 'local', createdAt: '2026-08-18T00:00:00.000Z' },
        { module: 'nonsense', origin: 'invented' }
      ]),
      'utf8'
    );

    const records = await readKitProvenance(dir);
    expect(records.map((r) => r.module)).toEqual(['ok']);
  });

  it('renders every surviving record without throwing', async () => {
    await recordKitProvenance(dir, [INSTALLED]);
    const [record] = await readKitProvenance(dir);
    expect(() => describeKitOrigin(record)).not.toThrow();
  });
});
