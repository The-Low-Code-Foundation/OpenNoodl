/**
 * BAK-007: USTAR tar writer/reader round-trip, including long names and dirs.
 */

import { createTar, extractTar, TarEntry } from '../src/backup/tar';

describe('backup/tar', () => {
  it('round-trips files, binary data, and directories', () => {
    const long = 'config/' + 'x'.repeat(120) + '/deep/file.bin';
    const entries: TarEntry[] = [
      { name: 'manifest.json', data: Buffer.from('{"a":1}') },
      { name: 'db/local.db', data: Buffer.from([0, 1, 2, 255, 254, 0, 42]) },
      { name: 'files/dir', data: Buffer.alloc(0), type: '5' },
      { name: 'files/empty', data: Buffer.alloc(0) },
      { name: long, data: Buffer.from('deep') }
    ];
    const tar = createTar(entries);
    expect(tar.length % 512).toBe(0);
    const out = extractTar(tar);
    const byName = new Map(out.map((e) => [e.name, e]));
    expect(byName.get('manifest.json')!.data.toString()).toBe('{"a":1}');
    expect([...byName.get('db/local.db')!.data]).toEqual([0, 1, 2, 255, 254, 0, 42]);
    expect(byName.get('files/empty')!.data.length).toBe(0);
    expect(byName.get(long)!.data.toString()).toBe('deep');
  });

  it('throws loudly on a path too long even for name+prefix', () => {
    const impossible = 'a'.repeat(300); // no '/' to split on
    expect(() => createTar([{ name: impossible, data: Buffer.from('x') }])).toThrow(/too long/);
  });
});
