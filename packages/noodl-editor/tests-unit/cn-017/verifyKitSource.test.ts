/**
 * CN-017 — what `verifyKitSource` establishes, and what it must not be read as
 * establishing.
 *
 * 🔴 **AC1 is graded here on REAL `createNodeKit` output, not on a hand-written
 * approximation of one.** The one way this task breaks D6's first part is by
 * shipping a check that a locally-scaffolded kit cannot pass — and a fixture
 * written to satisfy the check would pass by construction while the actual
 * scaffold failed. So the scaffold runs, and its own `index.js` is the input.
 *
 * ⚠️ **This file deliberately does NOT assert that a verified kit is safe**, and
 * no assertion may be added that reads that way. What is graded is that the
 * check reports *what a script defines* and names each distinguishable failure.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { installTestFileSystem } from '../cn-006/testFileSystem';

installTestFileSystem();

import { createNodeKit, scanExecutableModules, verifyKitSource } from '../../src/shared/utils/projectmodules';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn017-verify-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('CN-017 AC1 — a locally scaffolded kit passes verification unchanged', () => {
  /*
   * The load-bearing spec of the file. If the scaffold's own output cannot pass,
   * every consent surface built on this check would refuse the kits this phase
   * exists to make easy to write.
   */
  it("verifies the scaffold's real index.js and names the node it defines", async () => {
    const created = await createNodeKit(dir, 'Weather Kit');
    expect(created.ok).toBe(true);

    const source = fs.readFileSync(path.join(dir, created.indexPath!), 'utf8');
    const result = verifyKitSource(source);

    expect(result.outcome).toBe('defines-nodes');
    expect(result.ok).toBe(true);
    expect(result.nodes).toContain(created.nodeType);
    // The message names what it found — a bare "true" is what the ERG-002 model
    // exists to avoid.
    expect(result.message).toContain(created.nodeType!);
  });

  /*
   * 🔴 The specific way this could have failed. ✅ D19 made `React` a bare global
   * the runtime installs, and the scaffold's template opens with
   * `var h = React.createElement`. Without the sandbox stub the scaffold's own
   * output throws `ReferenceError: React is not defined` — a "failure" that says
   * nothing about the kit. Graded directly so a future sandbox change that drops
   * the stub is caught by a spec that says why it matters.
   */
  it('does not fail a kit for reading the React global the runtime provides', () => {
    const result = verifyKitSource(
      "var h = React.createElement; Noodl.defineModule({ reactNodes: [{ name: 'demo', getReactComponent: function () { return h; } }] });"
    );
    expect(result.outcome).toBe('defines-nodes');
    expect(result.nodes).toEqual(['demo']);
  });
});

describe('CN-017 — each failure is distinguished, not collapsed into false', () => {
  it('names an ES-module build', () => {
    const result = verifyKitSource("export const kit = {};\nexport default kit;");
    expect(result.outcome).toBe('es-module');
    expect(result.ok).toBe(false);
    expect(result.nodes).toEqual([]);
  });

  it('names a CommonJS build', () => {
    const result = verifyKitSource("module.exports = { nodes: [] };");
    expect(result.outcome).toBe('commonjs');
    expect(result.ok).toBe(false);
  });

  it('names a script that throws, and says it would register nothing', () => {
    const result = verifyKitSource("throw new Error('boom');");
    expect(result.outcome).toBe('threw');
    expect(result.message).toContain('boom');
    expect(result.message).toContain('no nodes');
  });

  it('separates "ran but is not a kit" from "is a kit that defines nothing"', () => {
    // A plain library: runs cleanly, never calls defineModule.
    expect(verifyKitSource('var x = 1;').outcome).toBe('no-define-module');
    // A kit shape with an empty payload — a different fault with a different fix.
    expect(verifyKitSource('Noodl.defineModule({ nodes: [] });').outcome).toBe('defines-no-nodes');
  });

  /*
   * ⚠️ A definition with no `name` cannot be registered. Counted, it would report
   * a node the picker will never show — the shape of defect CN-006b's "0 nodes vs
   * not loaded" distinction exists to prevent.
   */
  it('does not count an unnamed definition as a node', () => {
    const result = verifyKitSource("Noodl.defineModule({ nodes: [{ displayNodeName: 'No name' }] });");
    expect(result.outcome).toBe('defines-no-nodes');
    expect(result.nodes).toEqual([]);
  });

  /*
   * 🔴 Kit code touches other members of the `Noodl` global at module scope. The
   * recursive-noop `Proxy` is what `kitExtract/entry.js` uses for the same
   * reason; without it this reads as a throwing kit.
   */
  it('survives a kit that touches other members of the Noodl global', () => {
    const result = verifyKitSource(
      "if (!Noodl.deployed) { Noodl.Object.on('change', function () {}); } Noodl.defineModule({ nodes: [{ name: 'n' }] });"
    );
    expect(result.outcome).toBe('defines-nodes');
  });
});

describe('CN-017 — scanning a directory for the modules that execute code', () => {
  function writeModule(name: string, manifest: Record<string, unknown>, main?: string) {
    const modDir = path.join(dir, 'noodl_modules', name);
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'manifest.json'), JSON.stringify(manifest), 'utf8');
    if (main) fs.writeFileSync(path.join(modDir, String(manifest.main)), main, 'utf8');
  }

  it('finds kits and libraries, and leaves an icon set alone', async () => {
    writeModule('a-kit', { name: 'A Kit', main: 'index.js' }, "Noodl.defineModule({ nodes: [{ name: 'k' }] });");
    writeModule('a-library', { name: 'A Library', kind: 'external-library', main: 'lib.js' }, 'window.Lib = {};');
    writeModule('icons', { name: 'Icons', type: 'iconset', icons: ['a'] });

    const found = await scanExecutableModules(dir);
    const names = found.map((f) => f.dirName).sort();

    // 🔴 An ERG-002 library injects a <script> exactly as a kit does. Gating one
    // and waving the other through would be a hole shaped like its own definition.
    expect(names).toEqual(['a-kit', 'a-library']);
  });

  it("reports a URL-sourced module as not-checked rather than as passing", async () => {
    writeModule('remote', { name: 'Remote', dependencies: ['https://cdn.example.com/x.js'] });

    const [found] = await scanExecutableModules(dir);
    expect(found.verification.outcome).toBe('not-checked');
    // ⚠️ Not a pass: `ok` is false, and the message says why rather than leaving
    // the surface to render an absence.
    expect(found.verification.ok).toBe(false);
    expect(found.verification.message).toContain('Not checked');
  });

  it('reports a manifest whose main is missing, instead of skipping the module', async () => {
    writeModule('broken', { name: 'Broken', main: 'nowhere.js' });

    const [found] = await scanExecutableModules(dir);
    expect(found.verification.ok).toBe(false);
    expect(found.verification.message).toContain('nowhere.js');
  });
});
