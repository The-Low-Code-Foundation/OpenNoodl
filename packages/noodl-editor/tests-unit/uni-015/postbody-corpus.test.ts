/**
 * UNI-015 AC3, this repo's half — *"the `Block[]` grammar is identical in both repos,
 * asserted by the shared corpus in each, with a control that mutating one copy fails the
 * other's spec."*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 THE THREE-COPY TRAP, AND WHY THIS FILE IS THE ANSWER TO IT.
 *
 * `parsePostBody` → `Block[]` lives here (UNI-011) and, since UNI-015, also on the platform
 * — which needs the same grammar to render what this editor sends. That is the THIRD
 * instance of one pattern in phase 67, and the previous two both bit:
 *
 *   UNI-006  `LessonEvidence` allow-list — three copies, and **no test in either repo saw
 *            both**. Recorded as a named, open gap; still open.
 *   UNI-011  `renderMarkdown` vs `parsePostBody` — safety rested on a property of the
 *            CONSUMER, the exact thing the design existed to eliminate.
 *
 * ✅ The ruling: the parser is PLATFORM-side canonical, and this copy is checked against it
 * by a golden corpus committed to both repos. A copy is acceptable; an *unwitnessed* copy is
 * not.
 *
 * 🔴 WHAT MAKES IT A WITNESS RATHER THAN A GESTURE — three things, and dropping any one of
 * them turns this into a test that cannot fail:
 *
 *   1. **The corpus file is byte-identical in both checkouts, and BOTH ends pin its sha256.**
 *      One end asserting the hash proves the file did not change locally; it says nothing
 *      about the other copy. Two ends pinning the SAME constant is what makes a divergence
 *      impossible to commit quietly, because the second repo's spec fails.
 *   2. **Every entry AND its expected output is compared, never a count.** UNI-013's
 *      token-drift test is the pattern this follows and its known hole is the lesson: a
 *      check that counts passes happily on two files with the same number of different
 *      things.
 *   3. **A known-firing control**, below — because "two parsers agree" passes identically
 *      when the comparison is vacuous.
 *
 * ⚠️ The corpus is GENERATED from the canonical parser by the platform repo's
 * `scripts/gen-postbody-corpus.mjs`. It therefore cannot catch a bug that is in BOTH
 * parsers — it catches DIVERGENCE, which is what it is for. The safety property (no payload
 * yields a live URL) is asserted separately, in `../uni-011/postbody.test.ts` here and in
 * `tests/uni015-bench.test.ts` there.
 *
 * 🔴 WHEN THE CORPUS LEGITIMATELY CHANGES: regenerate it in the platform repo, copy it here
 * byte-for-byte, and update `CORPUS_SHA256` in BOTH specs in the same commit. That friction
 * is the mechanism, not a side effect of it.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

import { parsePostBody, type Block } from '@noodl-models/community/postbody';

const CORPUS_PATH = join(
  __dirname,
  '..',
  '..',
  'src',
  'editor',
  'src',
  'models',
  'community',
  'postbody-corpus.json'
);

/**
 * 🔴 PINNED HERE AND IN `nodegx-community`'s `tests/uni015-bench.test.ts`. The two constants
 * are the same string on purpose, and they are the whole mechanism.
 */
const CORPUS_SHA256 = 'd59d6095f64d37d4d4b56ca3954a66183e1fa98cd6935e73d21ccb2782a2e69a';

type CorpusEntry = { name: string; why: string; markdown: string; blocks: Block[] };

const raw = readFileSync(CORPUS_PATH, 'utf8');
const corpus = JSON.parse(raw) as { entries: CorpusEntry[] };

describe('UNI-015 AC3 — one grammar, witnessed in both repos', () => {
  it('the corpus file is the one both repos pinned', () => {
    expect(createHash('sha256').update(raw).digest('hex')).toBe(CORPUS_SHA256);
  });

  it('the corpus is not vacuous', () => {
    expect(corpus.entries.length).toBeGreaterThanOrEqual(30);

    // 🔴 A corpus of only hostile payloads witnesses only the refusals, and two parsers can
    // agree perfectly about what to REJECT while disagreeing about everything they accept —
    // which is the whole of what a reader of a thread actually sees.
    const hostile = corpus.entries.filter((e) => e.why.startsWith('hostile'));
    const grammar = corpus.entries.filter((e) => e.why.startsWith('grammar'));
    expect(hostile.length).toBeGreaterThanOrEqual(15);
    expect(grammar.length).toBeGreaterThanOrEqual(15);

    // And every entry but the deliberately-empty one produces blocks. Thirty-five payloads
    // that all parsed to nothing would satisfy the comparison below perfectly.
    const empty = corpus.entries.filter((e) => e.blocks.length === 0).map((e) => e.name);
    expect(empty).toEqual(['the empty body']);
  });

  describe('this repo’s parser reproduces the canonical output, entry by entry', () => {
    corpus.entries.forEach((entry) => {
      it(entry.name, () => {
        expect(parsePostBody(entry.markdown)).toEqual(entry.blocks);
      });
    });
  });

  /**
   * 🔴 THE KNOWN-FIRING CONTROL, and it is the assertion that the criterion names by hand:
   * *"a control that mutating one copy fails the other's spec."*
   *
   * A mutated expectation must be DETECTED. If the comparison above were vacuous — comparing
   * a parse to itself, comparing lengths, or iterating an empty list — this would pass, and
   * the whole file would be decoration.
   */
  it('the comparison DETECTS a divergence in a single construct', () => {
    const entry = corpus.entries.find((e) => e.why === 'hostile:link');
    expect(entry).toBeDefined();

    const mutated = JSON.parse(JSON.stringify(entry.blocks)) as Block[];
    const first = mutated[0];
    if (first.kind === 'paragraph') {
      first.inlines.push({ kind: 'link', text: 'x', href: 'javascript:alert(1)' });
    }
    expect(parsePostBody(entry.markdown)).not.toEqual(mutated);
  });

  /**
   * 🔴 THE SECOND CONTROL, for the hash. An assertion that a file's digest equals a constant
   * is only meaningful if a changed file produces a different digest — which is obvious for
   * sha256 and NOT obvious for the way it is wired up. This checks the wiring: the same
   * function over one changed byte disagrees.
   */
  it('the hash check DETECTS a single changed byte', () => {
    const tampered = `${raw} `;
    expect(createHash('sha256').update(tampered).digest('hex')).not.toBe(CORPUS_SHA256);
  });
});
