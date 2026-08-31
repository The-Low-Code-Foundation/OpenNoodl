/**
 * DEF-036 AC5 — the schema editor the new button opens does not invite anyone to edit `_User`.
 *
 * ## Why this row exists at all
 *
 * AC5 is Option A's third criterion, re-pointed. Option A had to stop a *wire* minting
 * `password` as a column on the accounts table; Option B ships a button that sends a *person*
 * into the schema editor instead, so the same seven names now have to be refused at a different
 * door. The list did not change — the door did.
 *
 * 🔴 **What this cannot see.** Whether `TableRow` renders the rename button. That file imports
 * `Icon`, `PrimaryButton` and a SCSS module, and a spec importing it in this runner fails *to
 * run* rather than fails — `Tests: 0 total`, which reads like a spec nobody wrote. The rule is
 * graded here; that it is *applied* is graded by the drive, and the task file says so rather
 * than implying this covers it.
 */

import {
  ACCOUNTS_SERVER_OWNED_COLUMNS,
  ACCOUNTS_TABLE,
  isServerOwnedColumn,
  validateColumnName
} from '../../src/editor/src/views/panels/schemamanager/serverOwnedColumns';

describe('DEF-036 AC5 — the accounts table’s own columns', () => {
  it('holds exactly the seven the runtime refuses to write', () => {
    // Pinned, not compared: the editor does not depend on `noodl-runtime`, so this list is a
    // deliberate copy of `USER_INPUT_IGNORE_PARSE_BROWSER` and the copy is what drifts. A
    // reader who changes one side now has to change this line too, which is the whole point.
    expect([...ACCOUNTS_SERVER_OWNED_COLUMNS].sort()).toEqual(
      ['authData', 'createdAt', 'email', 'emailVerified', 'password', 'updatedAt', 'username'].sort()
    );
  });

  it('names every one of them as the backend’s on `_User`', () => {
    for (const column of ACCOUNTS_SERVER_OWNED_COLUMNS) {
      expect(isServerOwnedColumn(ACCOUNTS_TABLE, column)).toBe(true);
    }
  });

  it('leaves an app table’s identically-named column alone', () => {
    // Not hypothetical: a `Members` table with `username` and `password` columns is an ordinary
    // thing to build, and those are the author's. A blanket name list would have taken them.
    for (const column of ACCOUNTS_SERVER_OWNED_COLUMNS) {
      expect(isServerOwnedColumn('Members', column)).toBe(false);
    }
  });

  it('leaves an author’s own column on `_User` alone', () => {
    // The control that matters in the other direction: `firstName` is exactly what somebody
    // came here to add, and a guard that caught it would have closed the door it opened.
    expect(isServerOwnedColumn(ACCOUNTS_TABLE, 'firstName')).toBe(false);
  });
});

describe('DEF-036 AC5 — creating a column', () => {
  it('accepts the field somebody actually came to add', () => {
    // The positive control. Every refusal below only means something beside it.
    expect(validateColumnName('firstName', [], ACCOUNTS_TABLE)).toBeNull();
  });

  it('refuses each of the seven on the accounts table', () => {
    for (const column of ACCOUNTS_SERVER_OWNED_COLUMNS) {
      expect(validateColumnName(column, [], ACCOUNTS_TABLE)).not.toBeNull();
    }
  });

  it('names the column and the reason for the five that are the accounts table’s alone', () => {
    // "Reserved column name" against a table where that name is not visibly present reads as a
    // bug in the editor. ⚠️ `createdAt` and `updatedAt` keep the older global message, because
    // the older global rule refuses them first and is not wrong to — they are reserved
    // everywhere, and this list holds them for the reason `serverOwnedColumns.ts` states.
    for (const column of ACCOUNTS_SERVER_OWNED_COLUMNS) {
      const error = validateColumnName(column, [], ACCOUNTS_TABLE);

      if (['createdAt', 'updatedAt'].includes(column)) {
        expect(error).toBe('Reserved column name');
      } else {
        expect(error).toContain(column);
        expect(error).toContain('managed by the backend');
      }
    }
  });

  it('still accepts them on an app table', () => {
    for (const column of ACCOUNTS_SERVER_OWNED_COLUMNS) {
      const error = validateColumnName(column, [], 'Members');

      // `createdAt` and `updatedAt` are reserved on every table by the older global rule, so
      // only the five that are the accounts table's alone come back clean here.
      if (['createdAt', 'updatedAt'].includes(column)) {
        expect(error).toBe('Reserved column name');
      } else {
        expect(error).toBeNull();
      }
    }
  });

  it('keeps every rule it had before the table name was a parameter', () => {
    expect(validateColumnName('', [])).toBe('Column name is required');
    expect(validateColumnName('9lives', [])).toMatch(/Must start with letter/);
    expect(validateColumnName('objectId', [])).toBe('Reserved column name');
    expect(validateColumnName('ACL', [])).toBe('Reserved column name');
    expect(validateColumnName('name', ['name'])).toBe('Column already exists');
  });

  it('is unchanged for a caller that names no table', () => {
    // Every other caller of this validator passes a table today, but the parameter is optional
    // and an omission must not silently turn the accounts guard on for everything.
    for (const column of ACCOUNTS_SERVER_OWNED_COLUMNS) {
      const error = validateColumnName(column, []);

      expect(error).toBe(['createdAt', 'updatedAt'].includes(column) ? 'Reserved column name' : null);
    }
  });
});
