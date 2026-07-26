/**
 * BAK-007: retention selection (pure) + filename stamp parsing.
 */

import { parseStampFromName, selectForDeletion } from '../src/backup/BackupManager';
import { ARCHIVE_EXT } from '../src/backup/archive';

function at(date: string): { file: string; date: Date } {
  const d = new Date(date);
  return { file: `backup-${d.toISOString().replace(/[:.]/g, '-')}-abc${ARCHIVE_EXT}`, date: d };
}

describe('backup retention', () => {
  it('parses the timestamp back out of an archive filename', () => {
    const name = `backup-2026-07-26T14-30-00-000Z-abc${ARCHIVE_EXT}`;
    expect(parseStampFromName(name)!.toISOString()).toBe('2026-07-26T14:30:00.000Z');
    expect(parseStampFromName('not-a-backup.txt')).toBeNull();
  });

  it('keepLast keeps the newest N and deletes the rest', () => {
    const archives = [
      at('2026-07-20T00:00:00Z'),
      at('2026-07-21T00:00:00Z'),
      at('2026-07-22T00:00:00Z'),
      at('2026-07-23T00:00:00Z')
    ];
    const del = selectForDeletion(archives, { keepLast: 2, keepDaily: 0, keepWeekly: 0 });
    expect(del.length).toBe(2);
    expect(del).toContain(archives[0].file);
    expect(del).toContain(archives[1].file);
  });

  it('keepAll (all knobs 0) deletes nothing', () => {
    const archives = [at('2026-07-20T00:00:00Z'), at('2026-07-21T00:00:00Z')];
    expect(selectForDeletion(archives, { keepLast: 0, keepDaily: 0, keepWeekly: 0 })).toEqual([]);
  });

  it('keepDaily protects the newest backup of each recent day beyond keepLast', () => {
    const now = new Date('2026-07-26T12:00:00Z');
    const archives = [
      at('2026-07-26T01:00:00Z'),
      at('2026-07-26T09:00:00Z'), // newest of the 26th
      at('2026-07-25T09:00:00Z'), // newest of the 25th
      at('2026-07-25T01:00:00Z'),
      at('2026-07-24T09:00:00Z') // newest of the 24th
    ];
    const del = selectForDeletion(archives, { keepLast: 1, keepDaily: 3, keepWeekly: 0 }, now);
    // keepLast=1 keeps 07-26T09; keepDaily keeps newest of 25th and 24th too.
    expect(del).toContain(archives[0].file); // 07-26T01 (not newest of its day)
    expect(del).toContain(archives[3].file); // 07-25T01 (not newest of its day)
    expect(del).not.toContain(archives[1].file);
    expect(del).not.toContain(archives[2].file);
    expect(del).not.toContain(archives[4].file);
  });
});
