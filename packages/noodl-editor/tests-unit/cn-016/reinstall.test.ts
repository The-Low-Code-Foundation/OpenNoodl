/**
 * ✅ CN-016 AC2 — *"Installing does not disturb an existing kit, and installing
 * twice is safe"* — and item 4's floor, *"do not silently replace"*.
 *
 * 🔴 **Two inherited premises were false and are corrected here, in specs
 * rather than in prose, so a later session cannot re-inherit them.**
 *
 * 1. *"`recordKitProvenance` already stores `version`-bearing install records."*
 *    It does not. `KitProvenance`'s three arms carry `createdAt`,
 *    `fromProject`/`importedAt`, and `url`/`installedAt`/`verification`/
 *    `consentedAt`. **No arm carries a version.**
 * 2. *"A project has kit v1 and the library offers v2"* is not a comparison this
 *    product can make today. The library ENTRY declares a version
 *    (`library.json`), and nothing carries it into the installed project. The
 *    kit's own `manifest.json` may declare one, but **the scaffold writes none**
 *    — the reference kit this task ships declares no version at all — and
 *    `MANIFEST_SCHEMA` has no `version` property.
 *
 * So the update story cannot be version-aware yet, and the floor item 4 actually
 * sets — *do not silently replace* — is met by something that needs no version:
 * a module already in the target **collides by name**, and a collision opens the
 * import flow instead of the one-click path. That is what the first block below
 * grades, because it is the difference between "the user was asked" and "the
 * user's kit was overwritten while a spinner span".
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { installTestFileSystem } from '../cn-006/testFileSystem';

installTestFileSystem();

import { plan } from '../../src/editor/src/utils/import-engine/plan';
import { copyPlannedModules } from '../../src/editor/src/utils/import-engine/moduleGate';
import type {
  ImportOrigin,
  ImportSelection,
  SourceInventory
} from '../../src/editor/src/utils/import-engine/types';

const LOCAL: ImportOrigin = { kind: 'local-project' };

/** The smallest inventory that plans one module and nothing else. */
function inventoryWithModule(name: string, sourceDir = '/src'): SourceInventory {
  return {
    sourceDir,
    components: [],
    resources: [],
    modules: [{ name }] as SourceInventory['modules'],
    styles: { colors: [], text: [] } as SourceInventory['styles'],
    variants: [],
    edges: []
  };
}

/** A target that has the named modules and nothing else. */
function targetWithModules(names: string[]) {
  return {
    getComponent: () => undefined,
    hasResource: () => false,
    hasModule: (n: string) => names.includes(n),
    hasVariant: () => false,
    hasColorStyle: () => false,
    hasTextStyle: () => false
  };
}

const EMPTY_PROJECT = { components: [] } as never;

describe('CN-016 item 4 — a reinstall is not silent', () => {
  const selection: ImportSelection = { modules: [{ name: 'example-node-kit' }] };

  it('plans a FIRST install as an add, with no collision', () => {
    // The control. Without this row, "the second install collides" proves
    // nothing — a planner that reported a collision unconditionally would look
    // identical on the assertion that matters.
    const first = plan(inventoryWithModule('example-node-kit'), EMPTY_PROJECT, selection, targetWithModules([]), {
      origin: LOCAL
    });
    expect(first.modules[0].collides).toBe(false);
    expect(first.modules[0].policy).toEqual({ action: 'add' });
    expect(first.hasCollisions).toBe(false);
  });

  it('plans a SECOND install of the same kit as a collision', () => {
    const second = plan(
      inventoryWithModule('example-node-kit'),
      EMPTY_PROJECT,
      selection,
      targetWithModules(['example-node-kit']),
      { origin: LOCAL }
    );
    expect(second.modules[0].collides).toBe(true);
  });

  it('🔴 sets hasCollisions, which is what routes the install AWAY from the one-click path', () => {
    /*
     * This is the load-bearing assertion of item 4's floor. `_install` applies
     * the plan without any dialog when `hasCollisions` is false — LIB-005's
     * one-click case. A kit that ships NO components (the reference kit ships
     * zero) would take that path on a reinstall if module collisions did not
     * count towards `hasCollisions`, and the user's installed kit would be
     * replaced with no dialog at all. It does count, and this pins it.
     */
    const second = plan(
      inventoryWithModule('example-node-kit'),
      EMPTY_PROJECT,
      selection,
      targetWithModules(['example-node-kit']),
      { origin: LOCAL }
    );
    expect(second.hasCollisions).toBe(true);
  });

  it('does not report a collision for a DIFFERENT kit already in the project', () => {
    // AC2's first half at the planning level: installing B when A is present is
    // an add, not a collision. The kit already there is not in the story.
    const second = plan(
      inventoryWithModule('kit-b'),
      EMPTY_PROJECT,
      { modules: [{ name: 'kit-b' }] },
      targetWithModules(['kit-a']),
      { origin: LOCAL }
    );
    expect(second.modules[0].collides).toBe(false);
    expect(second.hasCollisions).toBe(false);
  });
});

describe('CN-016 AC2 — installing does not disturb an existing kit, and twice is safe', () => {
  let dir: string;
  let sourceDir: string;
  let targetDir: string;

  function writeKit(root: string, name: string, files: Record<string, string>) {
    const kitDir = path.join(root, 'noodl_modules', name);
    fs.mkdirSync(kitDir, { recursive: true });
    for (const [file, contents] of Object.entries(files)) fs.writeFileSync(path.join(kitDir, file), contents);
  }

  /** The real recursive copy `apply()` injects, so the loop is graded on disk. */
  function copyInto(target: string, source: string) {
    return (name: string) => {
      fs.cpSync(path.join(source, 'noodl_modules', name), path.join(target, 'noodl_modules', name), {
        recursive: true
      });
    };
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn016-reinstall-'));
    sourceDir = path.join(dir, 'source');
    targetDir = path.join(dir, 'target');
    fs.mkdirSync(path.join(sourceDir, 'noodl_modules'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'noodl_modules'), { recursive: true });
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('leaves an unrelated kit byte-identical', async () => {
    writeKit(targetDir, 'kit-a', {
      'manifest.json': JSON.stringify({ name: 'Kit A', main: 'index.js' }),
      'index.js': '// the user\'s existing kit'
    });
    writeKit(sourceDir, 'kit-b', {
      'manifest.json': JSON.stringify({ name: 'Kit B', main: 'index.js' }),
      'index.js': '// the incoming kit'
    });

    const before = fs.readFileSync(path.join(targetDir, 'noodl_modules', 'kit-a', 'index.js'), 'utf8');

    const outcome = await copyPlannedModules({
      sourceDir,
      moduleNames: ['kit-b'],
      origin: LOCAL,
      at: '2026-08-18T00:00:00.000Z',
      copy: copyInto(targetDir, sourceDir)
    });

    expect(outcome.copied).toEqual(['kit-b']);
    expect(outcome.warnings).toEqual([]);
    expect(fs.readFileSync(path.join(targetDir, 'noodl_modules', 'kit-a', 'index.js'), 'utf8')).toBe(before);
    // And the existing kit is still THERE, not merely unchanged in content.
    expect(fs.existsSync(path.join(targetDir, 'noodl_modules', 'kit-a', 'manifest.json'))).toBe(true);
  });

  it('installing the same kit twice leaves one kit, not two, and it is the incoming one', async () => {
    writeKit(sourceDir, 'kit-a', {
      'manifest.json': JSON.stringify({ name: 'Kit A', main: 'index.js' }),
      'index.js': '// v2'
    });
    writeKit(targetDir, 'kit-a', {
      'manifest.json': JSON.stringify({ name: 'Kit A', main: 'index.js' }),
      'index.js': '// v1'
    });

    for (let i = 0; i < 2; i++) {
      const outcome = await copyPlannedModules({
        sourceDir,
        moduleNames: ['kit-a'],
        origin: LOCAL,
        at: '2026-08-18T00:00:00.000Z',
        copy: copyInto(targetDir, sourceDir)
      });
      expect(outcome.copied).toEqual(['kit-a']);
      expect(outcome.warnings).toEqual([]);
    }

    const modules = fs.readdirSync(path.join(targetDir, 'noodl_modules'));
    expect(modules).toEqual(['kit-a']);
    expect(fs.readFileSync(path.join(targetDir, 'noodl_modules', 'kit-a', 'index.js'), 'utf8')).toBe('// v2');
  });

  it('a stale file from the previous install SURVIVES the copy — a merge, not a replace', async () => {
    /*
     * 🔴 Measured, not assumed, and it is the honest limit of "installing twice
     * is safe". The copy is recursive and additive: it overwrites what the
     * incoming kit names and does NOT remove what it no longer ships. A file
     * dropped between v1 and v2 stays on disk, and for a kit whose `main`
     * requires it, the stale copy is what keeps loading.
     *
     * Safe in AC2's sense — nothing is corrupted, nothing else is touched, and
     * the result is a working kit — but it is a merge rather than a replacement,
     * and a spec that asserted only "the new file is there" would have missed
     * it. Recorded here rather than fixed, because deleting files out of a
     * user's project directory is a different decision from copying into it.
     */
    writeKit(targetDir, 'kit-a', {
      'manifest.json': JSON.stringify({ name: 'Kit A', main: 'index.js' }),
      'index.js': '// v1',
      'removed-in-v2.js': '// v1 shipped this'
    });
    writeKit(sourceDir, 'kit-a', {
      'manifest.json': JSON.stringify({ name: 'Kit A', main: 'index.js' }),
      'index.js': '// v2'
    });

    await copyPlannedModules({
      sourceDir,
      moduleNames: ['kit-a'],
      origin: LOCAL,
      at: '2026-08-18T00:00:00.000Z',
      copy: copyInto(targetDir, sourceDir)
    });

    expect(fs.existsSync(path.join(targetDir, 'noodl_modules', 'kit-a', 'removed-in-v2.js'))).toBe(true);
  });

  it('records one provenance entry per install pass, naming the module', async () => {
    writeKit(sourceDir, 'kit-a', {
      'manifest.json': JSON.stringify({ name: 'Kit A', main: 'index.js' }),
      'index.js': '// v1'
    });

    const outcome = await copyPlannedModules({
      sourceDir,
      moduleNames: ['kit-a'],
      origin: LOCAL,
      at: '2026-08-18T00:00:00.000Z',
      copy: copyInto(targetDir, sourceDir)
    });

    expect(outcome.provenance).toHaveLength(1);
    expect(outcome.provenance[0].module).toBe('kit-a');
    // 🔴 The corrected premise, pinned: there is no version on the record.
    // `recordKitProvenance` is last-write-wins per module, so a reinstall
    // replaces this record rather than appending a second — which is what makes
    // repeated installs safe, and also why no install history exists to compare.
    expect(Object.keys(outcome.provenance[0])).not.toContain('version');
  });
});
