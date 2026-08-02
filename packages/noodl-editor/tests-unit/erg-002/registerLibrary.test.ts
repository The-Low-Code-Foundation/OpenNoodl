/**
 * ERG-002 — the write/read/delete surface the "Libraries" settings section
 * calls: `registerLibrary`, `listRegisteredLibraries`, `removeLibrary`, and the
 * §3 SSR predicate `libraryNeedsSsrWarning`.
 *
 * Every project directory here is a fresh `os.tmpdir()` folder, never the real
 * repo — this suite creates and deletes noodl_modules folders on disk.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  libraryNeedsSsrWarning,
  listRegisteredLibraries,
  registerLibrary,
  removeLibrary
} from '../../src/shared/utils/projectmodules';

const UMD_SOURCE = `(function (global) { global.PocketBase = function () { return 'client'; }; })(this);`;
const ESM_SOURCE = `export default class PocketBase {};`;

describe('registerLibrary / listRegisteredLibraries / removeLibrary', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'erg-002-'));
  });

  afterEach(async () => {
    await fs.promises.rm(projectDir, { recursive: true, force: true });
  });

  it('refuses to register when verification fails, and writes nothing to disk', async () => {
    const result = await registerLibrary(projectDir, {
      name: 'PocketBase',
      source: { kind: 'file', code: ESM_SOURCE, fileName: 'pocketbase.esm.js' },
      globalName: 'PocketBase'
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/ES-module/i);
    await expect(fs.promises.access(path.join(projectDir, 'noodl_modules'))).rejects.toThrow();
  });

  it('registers a library as a remote dependency (not vendored) by default', async () => {
    const result = await registerLibrary(projectDir, {
      name: 'PocketBase',
      source: { kind: 'file', code: UMD_SOURCE, fileName: 'pocketbase.umd.js' },
      globalName: 'PocketBase'
    });

    expect(result.ok).toBe(true);
    expect(result.moduleName).toBe('pocketbase');

    const manifestPath = path.join(projectDir, 'noodl_modules', 'pocketbase', 'manifest.json');
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    expect(manifest.kind).toBe('external-library');
    expect(manifest.global).toBe('PocketBase');
    // A dropped file always needs to be written somewhere for the injector to
    // find it, "vendor" only changes whether a *URL* source stays remote.
    expect(manifest.main).toBe('pocketbase.umd.js');
  });

  it('vendors a URL source into the module folder when asked, and drops the remote dependency', async () => {
    // No network in this test — exercise the `source.kind === 'file'` path but
    // with `vendor: true`, which is the code path a real URL fetch feeds into
    // after `fetchUrlSource` resolves. This keeps the suite hermetic while
    // still pinning "vendor: true never leaves a URL in the manifest".
    const result = await registerLibrary(projectDir, {
      name: 'PocketBase',
      source: { kind: 'file', code: UMD_SOURCE, fileName: 'pocketbase.umd.js' },
      globalName: 'PocketBase',
      vendor: true
    });

    expect(result.ok).toBe(true);
    const dir = path.join(projectDir, 'noodl_modules', 'pocketbase');
    const manifest = JSON.parse(await fs.promises.readFile(path.join(dir, 'manifest.json'), 'utf8'));
    expect(manifest.main).toBe('pocketbase.umd.js');
    expect(manifest.dependencies).toEqual([]);

    const vendored = await fs.promises.readFile(path.join(dir, 'pocketbase.umd.js'), 'utf8');
    expect(vendored).toBe(UMD_SOURCE);
  });

  it('writes the stylesheet URL into browser.stylesheets', async () => {
    await registerLibrary(projectDir, {
      name: 'tinymce',
      source: { kind: 'file', code: `window.tinymce = {};`, fileName: 'tinymce.js' },
      globalName: 'tinymce',
      stylesheetUrl: 'https://cdn.example.com/tinymce/skin.css'
    });

    const manifestPath = path.join(projectDir, 'noodl_modules', 'tinymce', 'manifest.json');
    const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    expect(manifest.browser.stylesheets).toEqual(['https://cdn.example.com/tinymce/skin.css']);
  });

  it('lists only libraries it registered, never an unrelated hand-authored module', async () => {
    await registerLibrary(projectDir, {
      name: 'PocketBase',
      source: { kind: 'file', code: UMD_SOURCE, fileName: 'pb.js' },
      globalName: 'PocketBase'
    });

    // A hand-authored module with no `kind` — e.g. an icon set — living
    // alongside it.
    const iconSetDir = path.join(projectDir, 'noodl_modules', 'material-icons');
    await fs.promises.mkdir(iconSetDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(iconSetDir, 'manifest.json'),
      JSON.stringify({ type: 'iconset', icons: ['home'] }),
      'utf8'
    );

    const libraries = await listRegisteredLibraries(projectDir);
    expect(libraries).toHaveLength(1);
    expect(libraries[0].moduleName).toBe('pocketbase');
    expect(libraries[0].global).toBe('PocketBase');
    expect(libraries[0].vendored).toBe(true); // 'file' source without vendor:true still writes main
  });

  it('refuses to register over a same-slug module it did not create', async () => {
    const iconSetDir = path.join(projectDir, 'noodl_modules', 'pocketbase');
    await fs.promises.mkdir(iconSetDir, { recursive: true });
    await fs.promises.writeFile(path.join(iconSetDir, 'manifest.json'), JSON.stringify({ type: 'iconset' }), 'utf8');

    const result = await registerLibrary(projectDir, {
      name: 'PocketBase',
      source: { kind: 'file', code: UMD_SOURCE, fileName: 'pb.js' },
      globalName: 'PocketBase'
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/didn't create/);
  });

  it('removeLibrary deletes a registered library and refuses to delete anything else', async () => {
    await registerLibrary(projectDir, {
      name: 'PocketBase',
      source: { kind: 'file', code: UMD_SOURCE, fileName: 'pb.js' },
      globalName: 'PocketBase'
    });

    const iconSetDir = path.join(projectDir, 'noodl_modules', 'material-icons');
    await fs.promises.mkdir(iconSetDir, { recursive: true });
    await fs.promises.writeFile(path.join(iconSetDir, 'manifest.json'), JSON.stringify({ type: 'iconset' }), 'utf8');

    const refusal = await removeLibrary(projectDir, 'material-icons');
    expect(refusal.ok).toBe(false);
    await expect(fs.promises.access(iconSetDir)).resolves.toBeUndefined();

    const removal = await removeLibrary(projectDir, 'pocketbase');
    expect(removal.ok).toBe(true);
    await expect(fs.promises.access(path.join(projectDir, 'noodl_modules', 'pocketbase'))).rejects.toThrow();
  });
});

describe('libraryNeedsSsrWarning', () => {
  it('warns for a browser-only library on an SSR project', () => {
    expect(libraryNeedsSsrWarning({ runtimes: ['browser'] }, 'ssr')).toBe(true);
  });

  it('warns for a browser-only library on an SSG project', () => {
    expect(libraryNeedsSsrWarning({ runtimes: ['browser'] }, 'ssg')).toBe(true);
  });

  it('does not warn for a CSR (client-only) project', () => {
    expect(libraryNeedsSsrWarning({ runtimes: ['browser'] }, 'csr')).toBe(false);
  });

  it('does not warn when the rendering mode is unset (unset defaults to csr, mirrors DeployToFolderTab)', () => {
    expect(libraryNeedsSsrWarning({ runtimes: ['browser'] }, undefined)).toBe(false);
  });

  it('does not warn for a library that does not declare itself browser-only', () => {
    expect(libraryNeedsSsrWarning({ runtimes: ['worker'] }, 'ssr')).toBe(false);
  });
});
