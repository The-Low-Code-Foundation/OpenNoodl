/**
 * CMP-008 AC1 — one definition of "a `var(--token)` reference".
 *
 * The export side (`noodl-mcp`'s `libraryExport`, CMP-007) and the install side
 * (`import-engine/tokenGap`) both have to answer this question and they have to
 * answer it identically. CMP-007 wrote down why — *"if the two ever disagreed,
 * the install would report a SUBSET and read exactly like a clean part; an
 * under-report is invisible, unlike a crash"* — and then kept a second copy of
 * the regex anyway. This grades the single definition that replaced it.
 *
 * The cross-package half is graded in `noodl-mcp/tests/cmp008SharedMatcher.test.ts`,
 * which can reach both `entryTokens` and this module. The control arm for the
 * pair is to break the pattern here and watch BOTH suites go red.
 */

import {
  collectTokenReferences,
  collectTokenReferencesIn
} from '../../src/editor/src/models/StyleTokensModel/TokenReferences';

describe('CMP-008 AC1 — collectTokenReferences', () => {
  it('names the token with its leading dashes, the way a project defines it', () => {
    expect(collectTokenReferences('var(--primary)')).toEqual(['--primary']);
  });

  it('finds every reference in one value, not just the first', () => {
    // A shorthand is the common case: `padding: var(--space-4) var(--space-2)`.
    expect(collectTokenReferences('var(--space-4) var(--space-2)')).toEqual(['--space-2', '--space-4']);
  });

  it('finds a reference embedded in a compound value', () => {
    expect(collectTokenReferences('1px solid var(--border-strong)')).toEqual(['--border-strong']);
  });

  it('tolerates the whitespace CSS allows', () => {
    expect(collectTokenReferences('var(  --ring )')).toEqual(['--ring']);
  });

  it('de-duplicates and sorts, so two callers comparing lists never disagree on order', () => {
    expect(collectTokenReferences('var(--b) var(--a) var(--b)')).toEqual(['--a', '--b']);
  });

  it('does not treat a bare custom-property name as a reference', () => {
    // `--primary: #fff` is a DEFINITION. Only `var(...)` is a read, and the
    // whole point of this module is the gap between what a part reads and what
    // a project defines.
    expect(collectTokenReferences('--primary: #ffffff; color: red')).toEqual([]);
  });

  it('reads nothing out of text that merely mentions var', () => {
    expect(collectTokenReferences('variant is --primary')).toEqual([]);
  });

  it('accepts digits, dashes and underscores in a name', () => {
    expect(collectTokenReferences('var(--gray_50-x1)')).toEqual(['--gray_50-x1']);
  });

  describe('collectTokenReferencesIn', () => {
    it('serialises an object and finds references anywhere inside it', () => {
      const node = { parameters: { backgroundColor: 'var(--surface)', borderColor: 'var(--border)' } };
      expect(collectTokenReferencesIn(node)).toEqual(['--border', '--surface']);
    });

    it('scans a string as-is rather than JSON-quoting it', () => {
      expect(collectTokenReferencesIn('var(--muted)')).toEqual(['--muted']);
    });

    it('reads no references from an absent value instead of throwing', () => {
      // A project with no metadata is an ordinary project, not an error.
      expect(collectTokenReferencesIn(undefined)).toEqual([]);
      expect(collectTokenReferencesIn(null)).toEqual([]);
    });
  });

  it('does not carry lastIndex between calls', () => {
    // 🔴 The pattern is a global regex. If it were `exec`'d against a shared
    // object the second call would start mid-string and silently under-report —
    // the exact failure mode this module exists to make impossible.
    const text = 'var(--a) var(--b)';
    expect(collectTokenReferences(text)).toEqual(['--a', '--b']);
    expect(collectTokenReferences(text)).toEqual(['--a', '--b']);
    expect(collectTokenReferences(text)).toEqual(['--a', '--b']);
  });
});
