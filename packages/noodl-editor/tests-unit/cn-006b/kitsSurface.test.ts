/**
 * CN-006b — the read/remove/join surface behind the kits list.
 *
 * ✅ **D1**: kits are a first-class project concept, so a project must be able to
 * say which ones it has without anybody opening a terminal.
 *
 * 🔴 **The central fixture registers all four module shapes at once, and that is
 * the whole point.** There is no `kind: 'node-kit'` marker anywhere — a census of
 * every `manifest.json` in the 29 test projects (2026-08-17) found an iconset, an
 * asset module (the bundled Inter font), an ERG-002 library and a kit, and only
 * the first three carry anything that positively identifies them. So the kit rule
 * is subtractive, and a fixture containing **only** a kit would pass against a
 * `listNodeKits` that returned every module it found. Every one of the three
 * non-kits here is a control.
 *
 * 🔴 **`joinKitNodes` is tested against the case that cannot be derived from
 * disk**: a kit whose runtime has never run registers no nodes, and ✅ **D3** says
 * the node list is the running viewer's to give. Zero nodes therefore means
 * "installed, not yet loaded" and must be distinguishable from "no such kit" —
 * a join that dropped empty kits would read as a correct list right up until an
 * author wondered where the kit they just made went.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { joinKitNodes, listNodeKits, removeNodeKit } from '../../src/shared/utils/projectmodules';

let dir: string;

function writeModule(name: string, manifest: Record<string, unknown>, extraFiles: Record<string, string> = {}) {
  const modDir = path.join(dir, 'noodl_modules', name);
  fs.mkdirSync(modDir, { recursive: true });
  fs.writeFileSync(path.join(modDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  for (const [file, contents] of Object.entries(extraFiles)) {
    fs.writeFileSync(path.join(modDir, file), contents, 'utf8');
  }
  return modDir;
}

/** The four shapes that actually exist on disk, written exactly as the census found them. */
function writeTheFourShapes() {
  // A kit, as `@nodegx/kit-scaffold` writes one.
  writeModule(
    'harbour-metrics',
    { name: 'Harbour Metrics', main: 'index.js', dependencies: [], nodeKitTypes: '1.0.0' },
    { 'index.js': '// a kit\n' }
  );
  // An iconset — `type: 'iconset'`, and note it has no `main`.
  writeModule('lucide-icons', { name: 'Lucide', type: 'iconset', iconClass: 'lucide', icons: [] });
  // An asset module (the bundled Inter font): a `browser` block, no `main`.
  writeModule('inter', { name: 'Inter', browser: { stylesheets: ['styles.css'] } });
  // An ERG-002 library, vendored — which means it HAS a `main`, and is the one
  // shape the subtractive rule could get wrong.
  writeModule(
    'pocketbase',
    { name: 'PocketBase', kind: 'external-library', main: 'pocketbase.umd.js', global: 'PocketBase', dependencies: [] },
    { 'pocketbase.umd.js': 'window.PocketBase = {};\n' }
  );
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn006b-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('listNodeKits', () => {
  test('finds the kit and none of the three modules that are not kits', async () => {
    writeTheFourShapes();

    const kits = await listNodeKits(dir);

    expect(kits.map((k) => k.dirName)).toEqual(['harbour-metrics']);
    expect(kits[0].displayName).toBe('Harbour Metrics');
    expect(kits[0].main).toBe('index.js');
    expect(kits[0].nodeKitTypes).toBe('1.0.0');
  });

  test('a vendored library is excluded by its kind, not by lacking a main', async () => {
    // The discriminating control for the subtractive rule. This module has a
    // `main` on disk — the same field the kit is recognised by — so a rule that
    // only tested "has a main" passes the test above and fails here.
    writeModule('pocketbase', {
      name: 'PocketBase',
      kind: 'external-library',
      main: 'pocketbase.umd.js',
      global: 'PocketBase'
    });

    expect(await listNodeKits(dir)).toEqual([]);
  });

  test('an iconset is excluded even when it declares a main', async () => {
    /*
     * 🔴 **This fixture is deliberately constructed, and saying so is the point.**
     * No iconset in any of the 29 real projects declares a `main` — Lucide and the
     * two QA sets carry `browser`/`sprite` and nothing else — so the `main`
     * requirement alone already excludes every iconset that exists, and the
     * `type: 'iconset'` guard is unreachable against real data. A test written
     * from a real iconset would therefore have passed against a rule that had no
     * iconset guard at all: a control that cannot fail.
     *
     * The guard stays rather than being deleted as dead, because the module it
     * protects is a **recursive delete**. `removeNodeKit` shares this predicate,
     * and an icon set that grew a `main` becoming quietly deletable from a list
     * headed "Node kits" is a worse outcome than one unreachable branch.
     */
    writeModule('hybrid-icons', { name: 'Hybrid', type: 'iconset', main: 'index.js', icons: [] });

    expect(await listNodeKits(dir)).toEqual([]);
    expect((await removeNodeKit(dir, 'hybrid-icons')).ok).toBe(false);
  });

  test('falls back to the folder name when the manifest names nothing', async () => {
    // Not cosmetic: `displayName` is the join key into `nodeIndex.moduleNodes`,
    // and an empty one would join to a group named `''`.
    writeModule('nameless-kit', { main: 'index.js' });

    const kits = await listNodeKits(dir);
    expect(kits[0].displayName).toBe('nameless-kit');
  });

  test('omits version entirely rather than defaulting one', async () => {
    // 🔴 Measured 2026-08-17: not one kit in any of the 29 real projects declares
    // a version, and the scaffold writes none. A row showing "0.0.0" or "—" as if
    // it had been read would be a number nothing on disk ever said.
    writeModule('harbour-metrics', { name: 'Harbour Metrics', main: 'index.js' });

    const [kit] = await listNodeKits(dir);
    expect(kit).not.toHaveProperty('version');
  });

  test('reports a version when a kit does declare one', async () => {
    // The other arm: the field is read, not ignored. Without this the test above
    // passes against a `listNodeKits` that never looks at `version` at all.
    writeModule('harbour-metrics', { name: 'Harbour Metrics', main: 'index.js', version: '2.1.0' });

    const [kit] = await listNodeKits(dir);
    expect(kit.version).toBe('2.1.0');
  });

  test('a project with no noodl_modules folder lists nothing rather than throwing', async () => {
    expect(await listNodeKits(dir)).toEqual([]);
  });

  test('no project directory lists nothing', async () => {
    expect(await listNodeKits(undefined)).toEqual([]);
  });
});

describe('removeNodeKit', () => {
  test('removes a kit folder', async () => {
    const modDir = writeModule('harbour-metrics', { name: 'Harbour Metrics', main: 'index.js' }, { 'index.js': '//\n' });

    const result = await removeNodeKit(dir, 'harbour-metrics');

    expect(result.ok).toBe(true);
    expect(fs.existsSync(modDir)).toBe(false);
  });

  test('refuses an iconset by name and leaves it on disk', async () => {
    const modDir = writeModule('lucide-icons', { name: 'Lucide', type: 'iconset', icons: [] });

    const result = await removeNodeKit(dir, 'lucide-icons');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('lucide-icons');
    expect(fs.existsSync(modDir)).toBe(true);
  });

  test('refuses an ERG-002 library and leaves it on disk', async () => {
    const modDir = writeModule('pocketbase', { name: 'PocketBase', kind: 'external-library', main: 'p.js' });

    const result = await removeNodeKit(dir, 'pocketbase');

    expect(result.ok).toBe(false);
    expect(fs.existsSync(modDir)).toBe(true);
  });

  test('refuses a folder that has no manifest at all', async () => {
    const modDir = path.join(dir, 'noodl_modules', 'junk');
    fs.mkdirSync(modDir, { recursive: true });

    const result = await removeNodeKit(dir, 'junk');

    expect(result.ok).toBe(false);
    expect(fs.existsSync(modDir)).toBe(true);
  });

  test('refuses a name that tries to climb out of noodl_modules', async () => {
    /*
     * This function takes a name from a list and hands it to a recursive delete.
     *
     * 🔴 **This test took two goes to be able to fail, and both misses were the
     * same mistake: something other than the path guard was doing the refusing.**
     * Mutation (M7) caught each one.
     *
     * 1. Pointed at an *empty* sibling directory, the `manifest.json` check
     *    refused it — there was nothing kit-shaped out there to delete.
     * 2. With a kit manifest added but no `noodl_modules/` folder in the fixture,
     *    the traversal `noodl_modules/../sibling` cannot resolve at all: the
     *    kernel walks every component, and the missing middle one makes the read
     *    fail before any guard is consulted.
     *
     * So the fixture needs **both** — a real `noodl_modules/` to climb out of and
     * a real kit at the far end — or the only thing under test is the filesystem.
     */
    fs.mkdirSync(path.join(dir, 'noodl_modules'), { recursive: true });
    const sibling = path.join(dir, 'sibling');
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(
      path.join(sibling, 'manifest.json'),
      JSON.stringify({ name: 'Innocent Bystander', main: 'index.js' }),
      'utf8'
    );

    const result = await removeNodeKit(dir, '../sibling');

    expect(result.ok).toBe(false);
    expect(fs.existsSync(sibling)).toBe(true);
  });

  test('refuses when no project is open', async () => {
    expect((await removeNodeKit(undefined, 'harbour-metrics')).ok).toBe(false);
  });
});

describe('joinKitNodes', () => {
  const kit = (dirName: string, displayName: string) => ({ dirName, displayName, main: 'index.js' });

  test('gives each kit the nodes its running runtime registered', () => {
    const { kits } = joinKitNodes(
      [kit('harbour-metrics', 'Harbour Metrics'), kit('wren-analytics', 'Wren Analytics')],
      [
        { name: 'Harbour Metrics', items: ['harbour.StatTile', 'harbour.Gauge'] },
        { name: 'Wren Analytics', items: ['wren.Chart'] }
      ]
    );

    expect(kits.map((k) => k.nodes)).toEqual([['harbour.StatTile', 'harbour.Gauge'], ['wren.Chart']]);
  });

  test('a kit whose runtime has never run is listed with zero nodes, not dropped', () => {
    // ✅ D3's consequence, and the state an author hits within a second of
    // pressing "New node kit": the files exist, no runtime has executed them.
    const { kits } = joinKitNodes([kit('brand-new', 'Brand New')], []);

    expect(kits).toHaveLength(1);
    expect(kits[0].nodes).toEqual([]);
  });

  test('a group with no kit on disk is reported as an orphan rather than dropped', () => {
    // AC3's state exactly: the folder is gone, the live runtime still has its
    // nodes registered, and the picker still offers them.
    const { kits, orphans } = joinKitNodes(
      [kit('harbour-metrics', 'Harbour Metrics')],
      [
        { name: 'Harbour Metrics', items: ['harbour.StatTile'] },
        { name: 'Deleted Kit', items: ['gone.Widget'] }
      ]
    );

    expect(kits).toHaveLength(1);
    expect(orphans).toEqual([{ name: 'Deleted Kit', nodes: ['gone.Widget'] }]);
  });

  test('a kit that is on disk is never also reported as an orphan', () => {
    const { orphans } = joinKitNodes(
      [kit('harbour-metrics', 'Harbour Metrics')],
      [{ name: 'Harbour Metrics', items: ['harbour.StatTile'] }]
    );

    expect(orphans).toEqual([]);
  });

  test('joins on the manifest name, not the folder name', () => {
    // `nodelibraryexport.ts` groups by `metadata.module`, which the runtime
    // stamps from the manifest's `name` — never the directory.
    const { kits, orphans } = joinKitNodes(
      [kit('harbour-metrics', 'Harbour Metrics')],
      [{ name: 'Harbour Metrics', items: ['harbour.StatTile'] }]
    );

    expect(kits[0].nodes).toEqual(['harbour.StatTile']);
    expect(orphans).toEqual([]);
  });

  test('two groups sharing one name are unioned, not replaced', () => {
    const { kits } = joinKitNodes(
      [kit('harbour-metrics', 'Harbour Metrics')],
      [
        { name: 'Harbour Metrics', items: ['a'] },
        { name: 'Harbour Metrics', items: ['b'] }
      ]
    );

    expect(kits[0].nodes).toEqual(['a', 'b']);
  });

  test('an absent moduleNodes index is not an error', () => {
    // `nodelibraryexport.ts` omits `moduleNodes` entirely when a project has no
    // kits, which is the shape every project without one has.
    expect(joinKitNodes([kit('brand-new', 'Brand New')], undefined).kits[0].nodes).toEqual([]);
  });
});
