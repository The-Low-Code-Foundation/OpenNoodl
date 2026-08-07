/**
 * The Data Browser's `ACL` column — reading it, writing it, and refusing to
 * write nonsense (SPR-001 / F84).
 *
 * ## Why this column did not exist
 *
 * **Measured before it was fixed, and the backend was not the fault.**
 * `GET /api/:table` returns `ACL` on every row, already deserialised into an
 * object — see `packages/nodegx-backend/tests/f84-acl-visibility.test.ts`. The
 * grid dropped it: `DataBrowser`'s `allColumns` is three hard-coded system
 * columns (`objectId`, `createdAt`, `updatedAt`) plus whatever
 * `/admin/schema/:table` lists, and `ACL` is deliberately *not* in the schema.
 * `SchemaManager` stamps it onto the physical table next to those three
 * (`SchemaManager.ts:112`) and names it a system column (`:229`, `:300`), so it
 * never appears in the `_Schema` JSON. It was therefore in neither half of the
 * union, and a record created with a specific ACL rendered as a row with no ACL
 * anywhere on screen.
 *
 * ## Why it is a pure module
 *
 * Same reason as `schemaFailure.ts` next door: the parse/format/validate
 * decisions are functions of data, so they are proved in
 * `tests-unit/spr-001/aclJson.test.ts` without React, Electron or a backend.
 *
 * ## The one asymmetry worth knowing
 *
 * **No ACL and an empty ACL are opposites.** A `NULL` ACL column means *public*
 * (`canAccessRecord` returns true for an absent ACL); `{}` means *nobody*,
 * because the match is `entry[access] === true` and there is no entry to match.
 * So the empty editor field must save `null`, never `{}` — which is exactly why
 * the ACL cell cannot reuse the generic `Object` editor, whose empty case is
 * `{}`.
 *
 * @module panels/databrowser/acl
 */

/**
 * The column type string. Not one of the Noodl schema types on purpose — the
 * backend has no `ACL` column type, this is the grid's own marker for "render
 * and edit this cell as an access-control list".
 */
export const ACL_COLUMN_TYPE = 'ACL';

/** The field name, which is the backend's and is not configurable. */
export const ACL_FIELD = 'ACL';

/** One principal's entry. Absent flag = not granted. */
export interface AclEntry {
  read?: boolean;
  write?: boolean;
}

/** A record's ACL: principal key → entry. `null` is a legal, meaningful value. */
export type AclValue = Record<string, AclEntry>;

/**
 * What {@link parseAclInput} answers: a value to save, or a reason not to.
 *
 * Deliberately one shape with a nullable `error` rather than a discriminated
 * `{ok: true} | {ok: false}` union — the editor's TS config does not narrow the
 * union (`tsconfig.tests-main.json` proved it: `result.error` after
 * `if (!result.ok)` is a compile error), and a result type that needs a cast at
 * every call site is the wrong result type.
 *
 * `error === null` means accepted, and `value === null` then means *clear the
 * ACL*, which is a real instruction and not an absence.
 */
export interface AclParseResult {
  value: AclValue | null;
  error: string | null;
}

/**
 * Validate an ACL object exactly as the backend does.
 *
 * A deliberate twin of `validateAclShape` in
 * `packages/nodegx-backend/src/security/model.ts:733`, message for message, so
 * the panel can refuse a bad edit *before* the round trip and say the same
 * thing the server would have said. The server still validates — the editor is
 * not the security boundary and this copy is a courtesy, not a gate. Since
 * F84 the BYOB write route validates too (`byob-admin.ts` `assertAclShape`),
 * which is what stops a mis-shaped ACL reaching the row at all.
 *
 * @returns an error message, or `null` when the value is a legal ACL.
 */
export function validateAclShape(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'ACL must be an object';
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!key) return 'ACL keys must be non-empty strings';
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return `ACL entry for "${key}" must be an object`;
    }
    for (const [flag, flagValue] of Object.entries(entry as Record<string, unknown>)) {
      if (flag !== 'read' && flag !== 'write') return `ACL entry for "${key}" has unknown flag "${flag}"`;
      if (typeof flagValue !== 'boolean') return `ACL flag ${key}.${flag} must be a boolean`;
    }
  }
  return null;
}

/**
 * Turn what someone typed into the value to save.
 *
 * Three outcomes and no fourth: an empty field clears the ACL (`null`), a legal
 * ACL object is returned as-is, and anything else comes back as a message. It
 * never returns a partially-understood value, because the failure mode this
 * exists to prevent is a silent write of garbage that makes a row invisible.
 */
export function parseAclInput(text: string): AclParseResult {
  const trimmed = (text || '').trim();
  // Empty clears the ACL. `{}` does NOT — see the module note.
  if (trimmed === '' || trimmed === 'null') return { value: null, error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { value: null, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }

  const shapeError = validateAclShape(parsed);
  if (shapeError) return { value: null, error: shapeError };

  return { value: parsed as AclValue, error: null };
}

/**
 * The cell's one-line rendering.
 *
 * An absent ACL is written in words rather than left blank: blank would be
 * indistinguishable from `{}`, and those two are opposites. Everything else is
 * the JSON, which is what Richard asked for — *"json editor for now, we'll do
 * visual stuff later"*.
 */
export function formatAclCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '— public (no ACL)';
  if (typeof value === 'string') return value; // an unparsable column value, shown as stored
  return JSON.stringify(value);
}

/** The editor's initial text. Empty for an absent ACL, so saving it back is a no-op. */
export function formatAclForEditing(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

/**
 * The hover text: who this row is actually reachable by, in words.
 *
 * This is the question F84 is about — *"why can't this user see this record?"* —
 * so the answer is spelled out rather than left as JSON to decode. `*` is
 * everyone, a `role:` key is a role, anything else is a user objectId.
 */
export function describeAcl(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'No ACL: every caller allowed by the collection permissions can read and write this row.';
  }
  if (typeof value !== 'object') return `Unreadable ACL value: ${String(value)}`;

  const entries = Object.entries(value as AclValue);
  if (entries.length === 0) {
    return 'Empty ACL: no principal is granted anything, so only an admin can read or write this row.';
  }

  const lines = entries.map(([key, entry]) => {
    const grants: string[] = [];
    if (entry && entry.read === true) grants.push('read');
    if (entry && entry.write === true) grants.push('write');
    const who = key === '*' ? 'everyone (*)' : key.startsWith('role:') ? `role “${key.slice(5)}”` : `user ${key}`;
    return `${who}: ${grants.length ? grants.join(' + ') : 'nothing'}`;
  });
  return lines.join('\n');
}
