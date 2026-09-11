/**
 * TUT-002 / AC5 — F1 ("unreachable") must cover the new verbs.
 *
 * A collection condition naming a collection that neither the starter nor the `solution/` ever
 * creates is exactly the F1 defect: a condition that can never hold. 🔴 If the new verbs were left
 * out of the unreachable check, **the harness would gain a hole shaped precisely like the thing it
 * exists to catch** — which this codebase has now done twice, both times with a comment standing in
 * for a check.
 *
 * 🔴 The other half matters as much and is easier to get wrong: the check must **not** fire when
 * nobody told it what collections exist. `asked − answered = absent`; `everything − answered` is a
 * lie, and a verifier that guesses rejects correct lessons.
 */
import { LessonManifest } from '../../src/editor/src/models/lessonformat';
import { verifyLessonManifest } from '../../src/editor/src/models/lessonverify';

function manifest(condition: unknown): LessonManifest {
  return {
    title: 'Data',
    steps: [{ title: 'Make the collection', body: 'Create it.', completeWhen: [condition as never] }]
  };
}

function codes(report: { findings: { code: string }[] }): string[] {
  return report.findings.map((f) => f.code);
}

const KNOWN = ['Puppies', 'Owners'];

describe('AC5 — a collection condition naming a collection nothing creates is rejected', () => {
  it('rejects it, and the sentence names what to change', () => {
    const report = verifyLessonManifest(manifest({ collection: 'Kittens', collectionExists: true }), {
      knownCollections: KNOWN
    });

    expect(report.ok).toBe(false);
    expect(codes(report)).toContain('unreachable-collection');

    const finding = report.findings.find((f) => f.code === 'unreachable-collection');
    expect(finding?.value).toBe('Kittens');
    expect(finding?.severity).toBe('error');
    // Names both the problem and the way out — the collections that DO exist.
    expect(finding?.message).toContain('Kittens');
    expect(finding?.message).toContain('Puppies');
    expect(finding?.message).toContain('Owners');
  });

  it('🔴 the control: the SAME check passes a correct manifest', () => {
    // Without this arm, a check that rejected everything would pass the assertion above.
    const report = verifyLessonManifest(manifest({ collection: 'Puppies', collectionExists: true }), {
      knownCollections: KNOWN
    });

    expect(codes(report)).not.toContain('unreachable-collection');
    expect(report.ok).toBe(true);
  });

  it('covers all three verbs, not just the first', () => {
    for (const cond of [
      { collection: 'Kittens', collectionExists: true },
      { collection: 'Kittens', hasColumns: ['name'] },
      { collection: 'Kittens', rowCountAtLeast: 1 }
    ]) {
      const report = verifyLessonManifest(manifest(cond), { knownCollections: KNOWN });
      expect(codes(report)).toContain('unreachable-collection');
    }
  });

  it('matches case-insensitively, so "puppies" is not reported unreachable', () => {
    const report = verifyLessonManifest(manifest({ collection: 'puppies', hasColumns: ['name'] }), {
      knownCollections: KNOWN
    });
    expect(codes(report)).not.toContain('unreachable-collection');
  });

  it('🔴 `collectionExists: false` is EXEMPT — naming an absent collection is its whole purpose', () => {
    // "You have not made it yet" is a legitimate step, and a gate that rejected it would be
    // rejecting the correct answer.
    const report = verifyLessonManifest(manifest({ collection: 'Kittens', collectionExists: false }), {
      knownCollections: KNOWN
    });
    expect(codes(report)).not.toContain('unreachable-collection');
  });
});

describe('🔴 absence is only claimed against a population the caller supplied', () => {
  it('does NOT fire when knownCollections is omitted', () => {
    // Two of this verifier's three callers hand it a manifest with no bundle around it. Firing
    // here would reject every correct data lesson verified on its own.
    const report = verifyLessonManifest(manifest({ collection: 'Kittens', collectionExists: true }));

    expect(codes(report)).not.toContain('unreachable-collection');
    expect(report.ok).toBe(true);
  });

  it('DOES fire for an explicitly empty list — supplied-and-empty is evidence, unsupplied is not', () => {
    const report = verifyLessonManifest(manifest({ collection: 'Kittens', collectionExists: true }), {
      knownCollections: []
    });

    expect(codes(report)).toContain('unreachable-collection');
    expect(report.findings.find((f) => f.code === 'unreachable-collection')?.message).toContain('(none)');
  });
});

describe('the malformed shapes are caught before reachability is asked', () => {
  it('a blank collection name is a compile failure, not an unreachable one', () => {
    const report = verifyLessonManifest(manifest({ collection: '  ', collectionExists: true }), {
      knownCollections: KNOWN
    });

    expect(report.ok).toBe(false);
    expect(codes(report)).toContain('malformed-lesson');
  });

  it('leaves the existing findings alone — a bad node type still reports as one', () => {
    const report = verifyLessonManifest(
      { title: 'x', steps: [{ completeWhen: [{ node: 'Thing', hasType: 'NotARealNodeType' }] }] },
      { knownCollections: KNOWN }
    );

    expect(codes(report)).toContain('unknown-node-type');
    expect(codes(report)).not.toContain('unreachable-collection');
  });
});
