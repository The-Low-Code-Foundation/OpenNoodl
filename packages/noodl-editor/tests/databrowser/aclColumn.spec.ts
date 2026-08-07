/**
 * SPR-001/F84 — the ACL column the Data Browser did not have.
 *
 * **The cause was measured, not assumed.** `GET /api/:table` — the route
 * `backend:queryRecords` proxies to — returns `ACL` on every row, already
 * deserialised into an object; that is pinned in
 * `packages/nodegx-backend/tests/f84-acl-visibility.test.ts`. The grid was the
 * fault: `DataBrowser`'s `allColumns` is a union of three hard-coded system
 * columns and whatever `/admin/schema/:table` lists, and `ACL` was in neither —
 * `SchemaManager` stamps it onto the physical table (`SchemaManager.ts:112`)
 * and treats it as a system column (`:229`, `:300`), so it never enters
 * `_Schema`.
 *
 * This suite covers the grid half: that `formatCellValue` routes the ACL column
 * to the ACL renderer instead of its null-to-blank path, and that the cell stays
 * editable. The parse/validate half is in `tests-unit/spr-001/aclJson.test.ts`
 * (plain Node, no renderer).
 */
import { ACL_COLUMN_TYPE, formatAclCell } from '../../src/editor/src/views/panels/databrowser/acl';
import { formatCellValue, isCellEditing, recordKey } from '../../src/editor/src/views/panels/databrowser/DataGrid';

/** Two rows as `backend:queryRecords` really returns them, ACL included. */
const ROWS = [
  {
    objectId: 'aaa111',
    title: 'private',
    ACL: { aaa111: { read: true, write: true } },
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  { objectId: 'bbb222', title: 'public', ACL: null, createdAt: '2026-08-02T00:00:00.000Z' }
];

describe('SPR-001/F84 Data Browser ACL column', () => {
  it('renders a row ACL as JSON rather than [object Object]', () => {
    expect(formatCellValue(ROWS[0].ACL, ACL_COLUMN_TYPE)).toBe('{"aaa111":{"read":true,"write":true}}');
    expect(formatCellValue(ROWS[0].ACL, ACL_COLUMN_TYPE)).toBe(formatAclCell(ROWS[0].ACL));
  });

  it('does not blank a row that has no ACL', () => {
    // The regression this guards: every other column renders null as '', and a
    // blank ACL cell is indistinguishable from `{}` — which is its opposite.
    expect(formatCellValue(ROWS[1].ACL, ACL_COLUMN_TYPE)).toBe('— public (no ACL)');
    expect(formatCellValue(null, 'String')).toBe('');
  });

  it('is an ordinary editable cell — one row at a time, like every other column', () => {
    const editing = { recordId: 'aaa111', field: 'ACL' };
    const open = ROWS.filter((r) => isCellEditing(editing, recordKey(r), 'ACL'));
    expect(open.length).toBe(1);
    expect(open[0].objectId).toBe('aaa111');
  });
});
