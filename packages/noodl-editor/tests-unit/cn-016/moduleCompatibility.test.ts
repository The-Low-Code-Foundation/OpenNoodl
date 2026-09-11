/**
 * ✅ CN-016 AC3 — compat gating refuses an incompatible entry with a message
 * naming why.
 *
 * The rule lives in an import-free leaf precisely so it can be graded here;
 * `modulelibrarymodel.ts` itself reaches `@electron/remote` and the editor's
 * `Model` base and cannot be imported outside a renderer. What a plain-Node
 * runner CAN grade is the whole of the decision and the whole of the sentence,
 * which is all AC3 is about.
 */
import {
  describeIncompatibilityFor,
  isVersionAtLeast
} from '../../src/editor/src/models/moduleCompatibility';

describe('isVersionAtLeast', () => {
  it('treats a missing requirement as no requirement', () => {
    expect(isVersionAtLeast('0.1.7', undefined)).toBe(true);
    expect(isVersionAtLeast('0.1.7', '')).toBe(true);
  });

  it('compares component-wise, not lexically', () => {
    // The reason a triple parse exists at all: '0.1.10' < '0.1.9' as strings.
    expect(isVersionAtLeast('0.1.10', '0.1.9')).toBe(true);
    expect(isVersionAtLeast('0.1.9', '0.1.10')).toBe(false);
    expect(isVersionAtLeast('1.0.0', '0.99.99')).toBe(true);
  });

  it('accepts an exact match', () => {
    expect(isVersionAtLeast('0.1.7', '0.1.7')).toBe(true);
  });
});

describe('describeIncompatibilityFor', () => {
  it('returns null for the whole shipped library, which declares 0.1.0', () => {
    // Every one of the 59 entries under library/ declares minEditorVersion
    // 0.1.0 as of 2026-08-18, so this is the case that must NOT refuse.
    expect(describeIncompatibilityFor('0.1.7', { label: 'Example Node Kit', minEditorVersion: '0.1.0' })).toBeNull();
  });

  it('returns null when an entry declares no floor at all', () => {
    expect(describeIncompatibilityFor('0.1.7', { label: 'Old index entry' })).toBeNull();
  });

  it('refuses an entry whose floor is above this editor', () => {
    const why = describeIncompatibilityFor('0.1.7', { label: 'From The Future', minEditorVersion: '0.2.0' });
    expect(why).not.toBeNull();
  });

  describe('the message names why — this is the acceptance criterion', () => {
    const why = describeIncompatibilityFor('0.1.7', { label: 'From The Future', minEditorVersion: '0.2.0' });

    it('names the entry', () => {
      expect(why?.full).toContain('From The Future');
    });

    it('names the field, so the user knows where the requirement came from', () => {
      expect(why?.full).toContain('minEditorVersion');
    });

    it('names what is required AND what is running', () => {
      // 🔴 The defect in the previous wording: it said "requires editor version
      // 0.1.0 or newer" and never said what you had. Naming only the
      // requirement leaves the user unable to tell whether the problem is
      // theirs or the author's, which is the whole point of naming why.
      expect(why?.full).toContain('0.2.0');
      expect(why?.full).toContain('0.1.7');
      expect(why?.short).toContain('0.2.0');
      expect(why?.short).toContain('0.1.7');
    });

    it('says what the user can do about it', () => {
      expect(why?.full).toMatch(/Update NodeGX/);
    });

    it('falls back to a neutral subject rather than printing "undefined"', () => {
      const anon = describeIncompatibilityFor('0.1.7', { minEditorVersion: '0.2.0' });
      expect(anon?.full).toContain('This library entry');
      expect(anon?.full).not.toContain('undefined');
    });
  });

  it('does NOT gate on runtimeVersion, which is descriptive and has no comparand', () => {
    // 🔴 CN-016 item 3 reads the schema's two version fields as symmetrical.
    // They are not: `minEditorVersion` is a floor with a real comparand
    // (platform.getVersion()), while `runtimeVersion` is documented as the
    // runtime an entry was "authored/verified against" — provenance, not a
    // requirement — and the editor has no runtime version to compare it with
    // (measured 2026-08-18: no constant, no generated file, no dependency
    // edge). Pinning the non-gate here so a later session changing it has to
    // change a spec that says why, rather than discovering the reasoning is
    // only in a comment. See CN-017 §9b.
    const absurd = describeIncompatibilityFor('0.1.7', {
      label: 'Built Against Tomorrow',
      minEditorVersion: '0.1.0',
      runtimeVersion: '99.0.0'
    });
    expect(absurd).toBeNull();
  });
});
