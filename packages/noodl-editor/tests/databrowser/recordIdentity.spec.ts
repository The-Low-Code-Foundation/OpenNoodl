/**
 * POL-014 — the Data Browser read a key nothing sends.
 *
 * Records come off `/api/:collection` carrying `objectId`; the grid read
 * `record.id`. Every row therefore had the identity `undefined`, and the
 * damage was not that the id column was blank — it was that `undefined`
 * compares equal to `undefined`. One click on one cell opened an editor in
 * *every* row, and a delete addressed `…/undefined`, which the backend
 * accepted and did nothing about.
 *
 * The grid is React and this suite has no React test infra (see
 * `tests/sidepanel/hideTransitions.spec.ts`, which says so), so the two
 * decisions that carry the defect are pure exported functions and are proved
 * here. Both cases need exactly two records — with one row, `undefined ===
 * undefined` looks like correct behaviour.
 */
import { isCellEditing, recordKey } from '../../src/editor/src/views/panels/databrowser/DataGrid';

/** Two rows as `backend:queryRecords` actually returns them. */
const ROWS = [
  { objectId: 'aaa111', author: 'Ada', createdAt: '2026-08-01T00:00:00.000Z' },
  { objectId: 'bbb222', author: 'Grace', createdAt: '2026-08-02T00:00:00.000Z' }
];

/** The same two rows as the grid used to see them: keyed on a field nothing sends. */
const ROWS_WITHOUT_IDENTITY = ROWS.map(({ objectId, ...rest }) => rest) as Record<string, unknown>[];

describe('POL-014 Data Browser record identity', () => {
  it('reads the key the backend actually sends', () => {
    expect(recordKey(ROWS[0])).toBe('aaa111');
    expect(recordKey(ROWS[1])).toBe('bbb222');
  });

  it('reports no identity for a row that has none, rather than a shared one', () => {
    const keys = ROWS_WITHOUT_IDENTITY.map(recordKey);
    expect(keys).toEqual([undefined, undefined]);
    // The point of the previous assertion: these are not interchangeable.
    expect(recordKey({ objectId: '' })).toBeUndefined();
    expect(recordKey({ objectId: 42 })).toBeUndefined();
  });

  it('opens exactly one editor when one cell is clicked', () => {
    const editing = { recordId: 'aaa111', field: 'author' };
    const open = ROWS.filter((r) => isCellEditing(editing, recordKey(r), 'author'));
    expect(open.length).toBe(1);
    expect(open[0].author).toBe('Ada');
  });

  it('does not treat a different column of the same row as edited', () => {
    const editing = { recordId: 'aaa111', field: 'author' };
    expect(isCellEditing(editing, 'aaa111', 'createdAt')).toBe(false);
  });

  it('opens NO editor when the rows have no identity — not one in every row', () => {
    // This is the regression. Before the fix this filter returned both rows,
    // because `editingCell.recordId` and `recordKey(row)` were both undefined.
    const editing = { recordId: undefined as unknown as string, field: 'author' };
    const open = ROWS_WITHOUT_IDENTITY.filter((r) => isCellEditing(editing, recordKey(r), 'author'));
    expect(open.length).toBe(0);
  });

  it('opens no editor when nothing is being edited', () => {
    expect(ROWS.filter((r) => isCellEditing(null, recordKey(r), 'author')).length).toBe(0);
  });
});
