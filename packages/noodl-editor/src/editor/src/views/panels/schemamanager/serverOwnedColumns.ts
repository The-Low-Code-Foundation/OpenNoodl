/**
 * DEF-036 AC5 — the columns of the accounts table an author must not be invited to edit.
 *
 * ## Why this exists at all
 *
 * AC5 is the surviving half of Option A's third criterion, and the swap is worth stating
 * plainly. Option A had to stop a *wire* resurrecting `password` as a column. Option B sends a
 * *person* into the schema editor instead — Richard's part 1, *"an Add a field button… straight
 * into the table's schema editor"* — so the same list now has to stop the person being offered
 * them. **It is the same list, guarding a different door.**
 *
 * Without it, the button DEF-036 adds is a route to a screen where `password` sits in the
 * ordinary column table with a rename button on it, one click from being renamed on a live
 * accounts table. The schema panel was built for app tables, where every column is the
 * author's; `_User` is the one table where that is false.
 *
 * ## The list, and where it comes from
 *
 * Verbatim `USER_INPUT_IGNORE_PARSE_BROWSER` from
 * `noodl-runtime/src/nodes/std-library/user/user-ports.ts` — the fields `Set User Properties`
 * refuses to offer as `prop-` inputs on the Parse wire, which is the built-in backend.
 *
 * ⚠️ **Spelled here rather than imported**, the same call `activeBackend.ts`,
 * `unwiredOutcome.ts` and three other editor modules record: the editor does not depend on
 * `noodl-runtime`, and taking that dependency for one frozen array of seven strings is the
 * larger coupling. The cost is real and is the usual one — the two can drift — so
 * `tests-unit/def-036` pins the contents rather than trusting a reader to compare them.
 *
 * 🔴 **Only `_User`, and only the built-in backend.** A Directus or PocketBase accounts table
 * has a different name and a different readonly set (`USER_INPUT_IGNORE_REST`), and this module
 * would be wrong about both. Every caller reaches it through a surface opened on a backend
 * whose endpoint type is `nodegx`; if that ever stops being true, this is the line to change.
 *
 * @module noodl-editor/views/panels/schemamanager/serverOwnedColumns
 */

/** The built-in backend's accounts table. */
export const ACCOUNTS_TABLE = '_User';

/**
 * The seven the runtime will not write, and this panel will not offer.
 *
 * ⚠️ `createdAt` and `updatedAt` are in the list although `TableRow` already draws them as
 * system rows of its own. That drawing is a hard-coded three-row header, not a rule — a backend
 * that returned either of them among `table.columns` would land it in the editable half, and
 * the reason it does not today is that nothing has ever done so. A guard that depends on a
 * backend's habits is not a guard.
 */
export const ACCOUNTS_SERVER_OWNED_COLUMNS: readonly string[] = Object.freeze([
  'authData',
  'createdAt',
  'updatedAt',
  'email',
  'username',
  'emailVerified',
  'password'
]);

/**
 * Whether this column belongs to the server rather than to the author.
 *
 * Keyed on the **table name**, so an app table with a column called `password` — which is an
 * author's own choice and their business — is untouched. That is the case a blanket name list
 * would have got wrong, and it is not hypothetical: a `Members` table with a `username` column
 * is an ordinary thing to build.
 */
export function isServerOwnedColumn(tableName: string, columnName: string): boolean {
  if (tableName !== ACCOUNTS_TABLE) return false;
  return ACCOUNTS_SERVER_OWNED_COLUMNS.includes(columnName);
}

/**
 * Validate column name.
 *
 * 🔴 In this module rather than in `AddColumnForm.tsx`, where it was, because that file imports
 * `Icon` — and `Icon` is one of the imports that makes a spec in this repo's `tests-unit` runner
 * fail *to run* rather than fail. AC5's rule graded from where it used to live would have been a
 * suite reporting `Tests: 0 total`, which reads exactly like a spec nobody wrote.
 *
 * DEF-036 AC5 — `tableName` is now part of the answer. The four global reservations below are
 * true of every table; the accounts table reserves seven more, because the backend owns them
 * and a column called `password` created beside the real one is two columns racing to be the
 * credential. See {@link isServerOwnedColumn}.
 *
 * ⚠️ The message names *which* rule refused, because "Reserved column name" on `email` in a
 * table where `email` is plainly not present reads as a bug in the editor.
 */
export function validateColumnName(name: string, existingNames: string[], tableName?: string): string | null {
  if (!name.trim()) {
    return 'Column name is required';
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return 'Must start with letter, alphanumeric and underscore only';
  }
  if (['objectId', 'createdAt', 'updatedAt', 'ACL'].includes(name)) {
    return 'Reserved column name';
  }
  if (tableName && isServerOwnedColumn(tableName, name)) {
    return `${name} belongs to the accounts table itself and is managed by the backend`;
  }
  if (existingNames.includes(name)) {
    return 'Column already exists';
  }
  return null;
}
