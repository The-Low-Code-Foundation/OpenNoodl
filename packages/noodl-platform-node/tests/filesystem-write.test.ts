import { describe, expect, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';

import { FileSystemNode } from '../src/filesystem-node';

/**
 * `writeJson` is the only writer behind every `project.json` on disk — there is a
 * single implementation of the FileSystem interface, so there is no second path
 * to keep in step. It was previously covered only indirectly, by the editor
 * suite's save/load specs, which meant the indentation change of 2026-07-28 (a
 * change to how every project in existence is serialised) had nothing pinning it.
 *
 * Written under the OS temp dir rather than `tests/testfs`, because a directory
 * inside the package gets picked up by lerna — the reason the specs in
 * `filesystem.test.ts` are skipped.
 */
describe('File System: writeJson', function () {
  const filesystem = new FileSystemNode();
  const tempDir = filesystem.join(os.tmpdir(), 'noodl-writejson-' + process.pid);

  afterAll(function () {
    filesystem.removeDirRecursive(tempDir);
  });

  async function writeTo(name: string, obj: unknown) {
    await filesystem.makeDirectory(tempDir);
    const path = filesystem.join(tempDir, name);
    await filesystem.writeJson(path, obj);
    return path;
  }

  it('round-trips a project-shaped object through readJson', async function () {
    // arrange — nesting, arrays, and the value types a graph actually holds
    const project = {
      name: 'Round Trip',
      components: [
        {
          name: '/Home',
          graph: {
            roots: [{ id: 'a', type: 'Group', parameters: { visible: true, width: { value: 100, unit: '%' } } }],
            connections: [{ fromId: 'a', fromProperty: 'onClick', toId: 'b', toProperty: 'navigate' }]
          }
        }
      ],
      metadata: { styles: { text: {}, colors: {} }, nullable: null }
    };

    // act
    const path = await writeTo('roundtrip.json', project);
    const readBack = await filesystem.readJson(path);

    // assert
    expect(readBack).toEqual(project);
  });

  it('writes two-space indented JSON, not one minified line', async function () {
    // act
    const path = await writeTo('indent.json', { a: 1, b: { c: 'd' } });
    const text = await filesystem.readFile(path);

    // assert — the literal shape, so the indent width is pinned and not merely
    // asserted to be "some whitespace"
    expect(text).toBe(['{', '  "a": 1,', '  "b": {', '    "c": "d"', '  }', '}'].join('\n'));
  });

  it('overwrites an existing file rather than appending to it', async function () {
    // arrange
    const path = await writeTo('overwrite.json', { version: 1, dropped: true });

    // act
    await filesystem.writeJson(path, { version: 2 });

    // assert
    expect(await filesystem.readJson(path)).toEqual({ version: 2 });
  });

  it('leaves no .tmp- file behind after a successful write', async function () {
    // act — writeJson stages through `<path>.tmp-<timestamp>` then renames
    await writeTo('staged.json', { ok: true });

    // assert
    const leftovers = fs.readdirSync(tempDir).filter((f) => f.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  it('rejects on an unserializable object without creating the file', async function () {
    // arrange — a cycle, which JSON.stringify throws on
    await filesystem.makeDirectory(tempDir);
    const cyclic: Record<string, unknown> = { name: 'cyclic' };
    cyclic.self = cyclic;
    const path = filesystem.join(tempDir, 'cyclic.json');

    // act & assert
    await expect(() => filesystem.writeJson(path, cyclic)).rejects.toThrow();
    expect(filesystem.exists(path)).toBe(false);
  });
});
