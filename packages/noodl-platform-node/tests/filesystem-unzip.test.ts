import { describe, expect, afterEach, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as nodePath from 'path';

import JSZip from 'jszip';

import { extractZipToFolder, resolveZipEntryPath, ZipEntryEscapesTargetError } from '../src/filesystem-node';

/**
 * Zip extraction is the one place in this app where a **stranger names a file
 * path**: every archive that reaches it came from a URL — a project imported
 * from a link, a module or prefab from the library, a forge template.
 *
 * 🔴 **What was actually measured, 2026-08-18, because the first version of this
 * guard was written against a threat that does not exist here.**
 *
 * | entry name | JSZip's LOADER | `path.join(root, name)` | escapes? |
 * |---|---|---|---|
 * | `../escaped.js` | normalised to `escaped.js` | — | **no** |
 * | `a/b/../../../x.js` | normalised to `x.js` | — | **no** |
 * | `/etc/passwd` | preserved | `root/etc/passwd` (join eats the leading `/`) | **no** |
 * | `..\win.js` | **preserved** | posix: a file literally called `..\win.js`; **win32: `C:\tmp\win.js`** | 🔴 **yes, on Windows** |
 *
 * So the classic `../` traversal was never reachable through this code path, and
 * saying otherwise would have been a scarier claim than the evidence supports.
 * The residual hole is **backslash entries on Windows**, which this app ships to
 * — and the guard is also what stops a future JSZip release changing its
 * normalisation from silently reopening the rest.
 *
 * ⚠️ **The end-to-end specs inject the hostile name into the loaded archive
 * rather than trying to build one**, because JSZip's own writer normalises it
 * too — a fixture built with `zip.file('../x')` produces a perfectly safe
 * archive and would grade nothing. The extractor's contract is *given a name
 * that escapes, however it arrived, write nothing*, and that is what is tested.
 */
describe('zip extraction: an entry may not escape its target', function () {
  let root: string;
  let outside: string;

  beforeEach(function () {
    // A parent with the target inside it, so "outside the target" is somewhere
    // this test owns and can assert about.
    outside = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'unzip-outside-'));
    root = nodePath.join(outside, 'target');
    fs.mkdirSync(root);
  });

  afterEach(function () {
    fs.rmSync(outside, { recursive: true, force: true });
  });

  async function loadZip(entries: Record<string, string>): Promise<JSZip> {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(entries)) zip.file(name, content);
    return JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer' }));
  }

  /** Put a name into a loaded archive that JSZip's writer would have normalised. */
  function forceEntryName(zip: JSZip, name: string, from: string): JSZip {
    zip.files[name] = { ...zip.files[from], name } as never;
    delete zip.files[from];
    return zip;
  }

  describe('resolveZipEntryPath', function () {
    it('accepts an ordinary entry and one that merely looks alarming', function () {
      expect(resolveZipEntryPath(root, 'project.json')).toBe(nodePath.join(root, 'project.json'));
      expect(resolveZipEntryPath(root, 'a/b/c.js')).toBe(nodePath.join(root, 'a', 'b', 'c.js'));
      // Goes up and comes back: genuinely inside, and a substring check for '..'
      // would wrongly refuse it.
      expect(resolveZipEntryPath(root, 'a/../b.js')).toBe(nodePath.join(root, 'b.js'));
    });

    it('refuses an entry that resolves outside the target', function () {
      expect(resolveZipEntryPath(root, '../escaped.js')).toBeNull();
      expect(resolveZipEntryPath(root, 'a/../../escaped.js')).toBeNull();
      expect(resolveZipEntryPath(root, '../../../../../../etc/passwd')).toBeNull();
    });

    /*
     * 🔴 The `+ sep` in the check. Without it, a sibling directory whose name
     * merely starts with the target's reads as contained — and this is the case
     * a naive `startsWith(base)` gets wrong while passing every `..` test above.
     */
    it('refuses a sibling whose name starts with the target’s', function () {
      const sibling = nodePath.basename(root) + '-evil/x.js';
      expect(resolveZipEntryPath(root, '../' + sibling)).toBeNull();
    });

    /*
     * ⚠️ **The Windows case, asserted as the arithmetic rather than the verdict.**
     * `resolveZipEntryPath` uses the running platform's `path`, so this suite on
     * macOS cannot make it answer as Windows would. What it CAN pin is the fact
     * the guard exists for: `..\win.js` is a separator on win32 and is not one on
     * posix, so the same archive entry lands in two different places.
     */
    it('pins why a backslash entry matters on Windows and not on macOS', function () {
      expect(nodePath.win32.resolve('C:\\tmp\\target', '..\\win.js')).toBe('C:\\tmp\\win.js');
      expect(nodePath.posix.resolve('/tmp/target', '..\\win.js')).toBe('/tmp/target/..\\win.js');
    });
  });

  describe('extractZipToFolder', function () {
    it('writes an ordinary archive', async function () {
      await extractZipToFolder(await loadZip({ 'project.json': '{}', 'a/b.js': 'x' }), root);

      expect(fs.readFileSync(nodePath.join(root, 'project.json'), 'utf8')).toBe('{}');
      expect(fs.readFileSync(nodePath.join(root, 'a', 'b.js'), 'utf8')).toBe('x');
    });

    /*
     * 🔴 The load-bearing spec, and the refusal is graded by what is NOT on disk.
     * A guard that threw *after* writing would pass any assertion about the error
     * alone.
     */
    it('refuses an escaping entry, and writes nothing anywhere', async function () {
      const zip = forceEntryName(
        await loadZip({ 'project.json': '{}', 'placeholder.js': 'owned' }),
        '../escaped.js',
        'placeholder.js'
      );

      await expect(extractZipToFolder(zip, root)).rejects.toBeInstanceOf(ZipEntryEscapesTargetError);

      // Nothing outside the target...
      expect(fs.readdirSync(outside)).toEqual(['target']);
      // ...and nothing inside it either: one bad entry refuses the WHOLE archive,
      // so no caller inherits a half-extracted directory it would treat as a
      // successful download.
      expect(fs.readdirSync(root)).toEqual([]);
    });

    it('says which entry it refused', async function () {
      const zip = forceEntryName(await loadZip({ 'placeholder.js': 'owned' }), '../escaped.js', 'placeholder.js');
      await expect(extractZipToFolder(zip, root)).rejects.toThrow('../escaped.js');
    });

    /*
     * ⚠️ **The negative control for the whole file.** If the guard refused every
     * archive, every refusal assertion above would still pass. This is the one
     * that would fail — and so would 'writes an ordinary archive'.
     */
    it('does not refuse an archive that is merely deep', async function () {
      await extractZipToFolder(await loadZip({ 'a/b/c/d/e/f.js': 'deep' }), root);
      expect(fs.readFileSync(nodePath.join(root, 'a/b/c/d/e/f.js'), 'utf8')).toBe('deep');
    });

    /*
     * ✅ Records the measurement that corrected this task's own premise: an
     * archive whose entry is literally `../escaped.js` is NOT a traversal here,
     * because JSZip strips it on load. If a JSZip upgrade ever changes that, this
     * spec fails and points at the guard above as the thing now doing the work.
     */
    it('confirms JSZip itself normalises the classic traversal away on load', async function () {
      const zip = await loadZip({ 'project.json': '{}', '../escaped.js': 'owned' });
      expect(Object.keys(zip.files)).toContain('escaped.js');
      expect(Object.keys(zip.files)).not.toContain('../escaped.js');
    });
  });
});
