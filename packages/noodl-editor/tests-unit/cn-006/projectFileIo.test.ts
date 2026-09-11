/**
 * CN-006 — the file primitives behind the editor's first file-backed editor.
 *
 * These three functions were private to `ProjectDocsModel` and are now shared
 * with `ProjectCodeFileModel`. They had no direct tests in either home: the docs
 * model is graded through the Electron suite, at a level where a truncating
 * write and a rejected traversal both look like "the panel did something".
 *
 * 🔴 **The traversal case is the one that matters.** A kit name arrives from a
 * text field, and the path it produces addresses a file the runtime will
 * *execute*. `resolveKitName` in `@nodegx/kit-scaffold` carries the same warning
 * for the same reason — a check applied to the normalised result can be talked
 * out of a traversal by a slug step.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { installTestFileSystem } from './testFileSystem';

installTestFileSystem();

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { assertInsideProject, toProjectRelative, writeTextAtomic } from '../../src/editor/src/models/ProjectFiles/projectFileIo';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cn006-fileio-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('assertInsideProject', () => {
  test('normalises an ordinary project-relative path', () => {
    expect(assertInsideProject('noodl_modules/weather-kit/index.js')).toBe('noodl_modules/weather-kit/index.js');
    expect(assertInsideProject('./noodl_modules/weather-kit/index.js')).toBe('noodl_modules/weather-kit/index.js');
    expect(assertInsideProject('noodl_modules\\weather-kit\\index.js')).toBe('noodl_modules/weather-kit/index.js');
  });

  test('🔴 refuses every shape of escape', () => {
    expect(() => assertInsideProject('../secrets.txt')).toThrow(/outside the project/);
    expect(() => assertInsideProject('noodl_modules/../../secrets.txt')).toThrow(/outside the project/);
    // The one a normalise-then-check would let through: the `..` is interior, so
    // the joined string looks harmless until the OS resolves it.
    expect(() => assertInsideProject('noodl_modules/kit/../../../etc/passwd')).toThrow(/outside the project/);
    expect(() => assertInsideProject('/etc/passwd')).toThrow(/absolute path/);
    expect(() => assertInsideProject('C:/Windows/system32')).toThrow(/absolute path/);
    expect(() => assertInsideProject('   ')).toThrow(/required/);
  });

  test('the control: a path merely *containing* two dots is not an escape', () => {
    // Without this, a guard written as `includes('..')` would look correct and
    // would reject a legitimate file. The rule is about segments, not substrings.
    expect(assertInsideProject('noodl_modules/my..kit/index.js')).toBe('noodl_modules/my..kit/index.js');
    expect(assertInsideProject('noodl_modules/kit/index.test.js')).toBe('noodl_modules/kit/index.test.js');
  });
});

describe('toProjectRelative', () => {
  test('strips the project root and normalises separators', () => {
    expect(toProjectRelative('/a/b', '/a/b/c/d.js')).toBe('c/d.js');
    expect(toProjectRelative('/a/b/', '/a/b/c/d.js')).toBe('c/d.js');
  });

  test('returns undefined for a path outside the project', () => {
    expect(toProjectRelative('/a/b', '/a/other/d.js')).toBeUndefined();
    // The prefix trap: '/a/bc' starts with '/a/b' as a *string* but is a
    // different directory. The trailing slash in the comparison is what saves it.
    expect(toProjectRelative('/a/b', '/a/bc/d.js')).toBeUndefined();
  });
});

describe('writeTextAtomic', () => {
  test('writes the content', async () => {
    const target = path.join(dir, 'index.js');
    await writeTextAtomic(target, 'hello');
    expect(fs.readFileSync(target, 'utf8')).toBe('hello');
  });

  test('leaves no temp file behind', async () => {
    const target = path.join(dir, 'index.js');
    await writeTextAtomic(target, 'hello');
    expect(fs.readdirSync(dir)).toEqual(['index.js']);
  });

  test('🔴 a failed write leaves the previous content intact, not a truncated file', async () => {
    const target = path.join(dir, 'index.js');
    await writeTextAtomic(target, 'the original, which the runtime executes');

    // Rename into a directory that does not exist — the failure mode a plain
    // `writeFile` would have already destroyed the file to reach.
    const doomed = path.join(dir, 'missing-dir', 'index.js');
    await expect(writeTextAtomic(doomed, 'replacement')).rejects.toThrow();

    expect(fs.readFileSync(target, 'utf8')).toBe('the original, which the runtime executes');
    // …and the temp file was cleaned up rather than left as debris beside it.
    expect(fs.readdirSync(dir)).toEqual(['index.js']);
  });
});
