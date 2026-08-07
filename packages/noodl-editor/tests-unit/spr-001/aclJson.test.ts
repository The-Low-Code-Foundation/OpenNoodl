/**
 * SPR-001/F84 — the Data Browser's ACL column: what it shows, and what it
 * refuses to save.
 *
 * The cause was measured before any of this was written: the backend returns
 * `ACL` on `GET /api/:table` already parsed into an object (pinned by
 * `packages/nodegx-backend/tests/f84-acl-visibility.test.ts`), and the grid
 * dropped it because `ACL` is in neither half of `allColumns` — not a hard-coded
 * system column, and deliberately absent from `_Schema`.
 *
 * Pure module, so it lives here rather than in the jasmine suite, exactly as
 * `schemaFailure.test.ts` next door does — no React, no Electron.
 */

import {
  describeAcl,
  formatAclCell,
  formatAclForEditing,
  parseAclInput,
  validateAclShape
} from '../../src/editor/src/views/panels/databrowser/acl';

/** A row's ACL exactly as `GET /api/:table` delivers it — already an object. */
const REAL_ACL = { 'kQ3n8': { read: true, write: true }, '*': { read: true } };

/**
 * The message a refused edit produces — and an assertion that it WAS refused.
 * Written as a helper so that "there is an error" is checked at every call
 * site: asserting only on the message text would pass vacuously (`String(null)`
 * matches nothing, but a changed regex could) if the parser ever started
 * accepting the input a case exists to reject.
 */
function refusal(input: string): string {
  const result = parseAclInput(input);
  expect(typeof result.error).toBe('string');
  // A refusal must also produce no value to save — the failure mode this whole
  // module exists to prevent is a half-understood edit reaching the row.
  expect(result.value).toBeNull();
  return String(result.error);
}

describe('the ACL cell rendering', () => {
  it('renders a real ACL as JSON', () => {
    expect(formatAclCell(REAL_ACL)).toBe('{"kQ3n8":{"read":true,"write":true},"*":{"read":true}}');
  });

  it('says "public" for an absent ACL instead of leaving the cell blank', () => {
    // The whole point: blank would be indistinguishable from `{}`, and those
    // two are opposites — absent means everyone, `{}` means nobody.
    expect(formatAclCell(null)).toBe('— public (no ACL)');
    expect(formatAclCell(undefined)).toBe('— public (no ACL)');
    expect(formatAclCell({})).toBe('{}');
  });

  // The grid-level half of this — that `formatCellValue` routes the `ACL`
  // column here rather than through its null-to-blank path — is asserted in
  // `tests/databrowser/aclColumn.spec.ts`, because reaching `DataGrid.tsx`
  // needs the renderer bundle (React + a `.scss` module) that this runner
  // deliberately does not have.

  it('pretty-prints for the editor, and offers an empty field for no ACL', () => {
    expect(formatAclForEditing(null)).toBe('');
    expect(formatAclForEditing(REAL_ACL)).toBe(JSON.stringify(REAL_ACL, null, 2));
  });
});

describe('describeAcl — the answer to "why can\'t this user see this record?"', () => {
  it('names the three kinds of principal key', () => {
    const text = describeAcl({ '*': { read: true }, 'role:member': { read: true, write: true }, abc123: { write: true } });
    expect(text).toContain('everyone (*)');
    expect(text).toContain('role “member”');
    expect(text).toContain('user abc123');
  });

  it('distinguishes no ACL from an empty one', () => {
    expect(describeAcl(null)).toContain('every caller');
    expect(describeAcl({})).toContain('no principal');
  });

  it('reports a principal that is granted nothing', () => {
    expect(describeAcl({ abc123: { read: false } })).toBe('user abc123: nothing');
  });
});

describe('parseAclInput — a malformed edit must never be written', () => {
  it('accepts a well-formed ACL', () => {
    expect(parseAclInput(JSON.stringify(REAL_ACL))).toEqual({ value: REAL_ACL, error: null });
  });

  it('clears the ACL on an empty field — null, never {}', () => {
    // `{}` here would silently hide the row from everyone, which is the
    // opposite of what "I cleared the field" means.
    expect(parseAclInput('')).toEqual({ value: null, error: null });
    expect(parseAclInput('   ')).toEqual({ value: null, error: null });
    expect(parseAclInput('null')).toEqual({ value: null, error: null });
  });

  it('refuses malformed JSON, with the parser’s own reason', () => {
    const result = refusal('{"a": ');
    expect(result).toMatch(/^Invalid JSON: /);
  });

  it('refuses well-formed JSON that is not an ACL', () => {
    const cases: [string, RegExp][] = [
      ['[]', /must be an object/],
      ['"everyone"', /must be an object/],
      ['{"alice": 5}', /entry for "alice" must be an object/],
      ['{"alice": {"admin": true}}', /unknown flag "admin"/],
      ['{"alice": {"read": "yes"}}', /must be a boolean/]
    ];
    for (const [input, expected] of cases) {
      expect(refusal(input)).toMatch(expected);
    }
  });
});

describe('validateAclShape stays the twin of the backend rule', () => {
  // Same inputs, same verdicts as
  // `nodegx-backend/src/security/model.ts:validateAclShape`. If these drift the
  // panel starts refusing what the server accepts, or worse, the reverse.
  it('treats null and undefined as legal (that is how an ACL is cleared)', () => {
    expect(validateAclShape(null)).toBeNull();
    expect(validateAclShape(undefined)).toBeNull();
  });

  it('accepts an empty object — meaningful, not malformed', () => {
    expect(validateAclShape({})).toBeNull();
  });

  it('rejects an empty key', () => {
    expect(validateAclShape({ '': { read: true } })).toBe('ACL keys must be non-empty strings');
  });
});
