/**
 * P79 L3 — a plain-Node sidecar on a packaged install can find and run the
 * render harness that ships inside `app.asar`.
 *
 * The row said `create_lesson` "cannot find the render harness from dist/".
 * Measured on the bound server instead of reasoned about: its `probed` list
 * began `/Applications/NodeGX.app/...` — it was the INSTALLED app's sidecar,
 * registered by Connect as `node <path>` (BST-004 prefers `node` whenever the
 * machine has one), and `app.asar` listed `render-harness/measure-from-disk.js`
 * all along. Plain Node's `fs` cannot see into an asar, so `existsSync` said no
 * to a file that was there, and every `render_report` and every F4 on the
 * install most people have refused with "could not be located".
 *
 * The fixture is a synthetic app bundle with a hand-built asar, because a spec
 * that only passes on a machine with NodeGX in /Applications is not a spec.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { asarLists, findAppElectronBinary, resolveRenderCli } from '../src/render';

/** A minimal asar: 16 bytes of pickle framing, then the JSON directory. */
function writeAsar(file: string, files: Record<string, unknown>): void {
  const header = Buffer.from(JSON.stringify({ files }), 'utf8');
  const framing = Buffer.alloc(16);
  framing.writeUInt32LE(4, 0);
  framing.writeUInt32LE(header.length + 8, 4);
  framing.writeUInt32LE(header.length + 4, 8);
  framing.writeUInt32LE(header.length, 12);
  fs.writeFileSync(file, Buffer.concat([framing, header]));
}

const HARNESS = { 'render-harness': { files: { 'measure-from-disk.js': { size: 1, offset: '0' } } } };

/** `<tmp>/Fake.app/Contents/Resources/noodl-mcp`, the sidecar's `__dirname` on macOS. */
function fakeApp(opts: { harness: boolean; binary: boolean }): { sidecarDir: string; asar: string; binary: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'p79-l3-'));
  const resources = path.join(root, 'Fake.app', 'Contents', 'Resources');
  const sidecarDir = path.join(resources, 'noodl-mcp');
  fs.mkdirSync(sidecarDir, { recursive: true });
  const asar = path.join(resources, 'app.asar');
  writeAsar(asar, opts.harness ? HARNESS : { 'package.json': { size: 1, offset: '0' } });
  const binary = path.join(root, 'Fake.app', 'Contents', 'MacOS', 'Fake');
  if (opts.binary) {
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.writeFileSync(binary, '#!/bin/sh\n');
    fs.chmodSync(binary, 0o755);
  }
  return { sidecarDir, asar, binary };
}

const savedOverride = process.env.NODEGX_RENDER_CLI;
beforeEach(() => {
  delete process.env.NODEGX_RENDER_CLI;
});
afterAll(() => {
  if (savedOverride !== undefined) process.env.NODEGX_RENDER_CLI = savedOverride;
});

describe('asarLists', () => {
  it('reads the archive directory without Electron and answers for a nested file', () => {
    const { asar } = fakeApp({ harness: true, binary: false });
    expect(asarLists(asar, 'render-harness/measure-from-disk.js')).toBe(true);
    // The control: the same archive, a file that is not in it, and a directory asked for as a file.
    expect(asarLists(asar, 'render-harness/nothing.js')).toBe(false);
    expect(asarLists(asar, 'render-harness')).toBe(false);
    // And the plain-Node answer this exists to correct.
    expect(fs.existsSync(path.join(asar, 'render-harness', 'measure-from-disk.js'))).toBe(false);
  });

  it('never throws on a file that is not an asar', () => {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'p79-l3-')), 'not.asar');
    fs.writeFileSync(tmp, 'hello');
    expect(asarLists(tmp, 'anything')).toBe(false);
  });
});

describe('resolveRenderCli on a packaged install, from plain Node', () => {
  it('🔴 finds the harness inside app.asar and runs it with the app binary', () => {
    const { sidecarDir, asar, binary } = fakeApp({ harness: true, binary: true });
    const resolved = resolveRenderCli(sidecarDir);
    expect(resolved.entry).toBe(path.join(asar, 'render-harness', 'measure-from-disk.js'));
    expect(resolved.exec).toBe(binary);
    expect(resolved.viaElectron).toBe(binary);
    expect(resolved.electronMissing).toBeUndefined();
    expect(findAppElectronBinary(sidecarDir)).toBe(binary);
  });

  it('says the binary is missing when the asar holds the harness and nothing can run it', () => {
    const { sidecarDir } = fakeApp({ harness: true, binary: false });
    const resolved = resolveRenderCli(sidecarDir);
    expect(resolved.entry).toBeNull();
    expect(resolved.electronMissing).toBe(true);
    expect(resolved.exec).toBe(process.execPath);
  });

  it('still reports nothing found when the asar does not carry the harness — the incomplete-install case', () => {
    const { sidecarDir, asar } = fakeApp({ harness: false, binary: true });
    const resolved = resolveRenderCli(sidecarDir);
    expect(resolved.entry).toBeNull();
    expect(resolved.electronMissing).toBeUndefined();
    expect(resolved.viaElectron).toBeUndefined();
    // Everywhere it looked, the asar path included — this list is the bug report.
    expect(resolved.probed).toContain(path.join(asar, 'render-harness', 'measure-from-disk.js'));
  });

  it('a checkout resolves beside the source exactly as before, with process.execPath', () => {
    const resolved = resolveRenderCli();
    expect(resolved.entry).toBe(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'measure-from-disk.js'));
    expect(resolved.exec).toBe(process.execPath);
    expect(resolved.viaElectron).toBeUndefined();
  });

  it('NODEGX_RENDER_CLI still wins, and still names itself when it is wrong', () => {
    const { sidecarDir } = fakeApp({ harness: true, binary: true });
    process.env.NODEGX_RENDER_CLI = '/nowhere/measure-from-disk.js';
    const resolved = resolveRenderCli(sidecarDir);
    expect(resolved.entry).toBeNull();
    expect(resolved.overrideMissing).toBe('/nowhere/measure-from-disk.js');
  });
});
