/**
 * CED-001 (A5/A9). The label under each history entry used to come from a hand-rolled
 * LCS whose similarity metric was a character bag — `"abc"` vs `"cba"` scored 1.0. It
 * now comes from the same `@codemirror/merge` chunks that draw the diff a person opens.
 */

import { summariseDiff } from '@noodl-core-ui/components/code-editor/utils/diffSummary';

describe('summariseDiff', () => {
  it('reports no change for identical text', () => {
    const summary = summariseDiff('const a = 1;', 'const a = 1;');
    expect(summary).toEqual({ added: 0, removed: 0, description: 'No changes' });
  });

  it('counts an added line', () => {
    const summary = summariseDiff('a\nb', 'a\nb\nc');
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(0);
    expect(summary.description).toBe('+1 line');
  });

  it('counts a removed line', () => {
    const summary = summariseDiff('a\nb\nc', 'a\nc');
    expect(summary.added).toBe(0);
    expect(summary.removed).toBe(1);
    expect(summary.description).toBe('−1 line');
  });

  it('counts a changed line on both sides', () => {
    const summary = summariseDiff('a\nb\nc', 'a\nB\nc');
    expect(summary.added).toBe(1);
    expect(summary.removed).toBe(1);
    expect(summary.description).toBe('+1 line, −1 line');
  });

  it('pluralises', () => {
    expect(summariseDiff('a', 'a\nb\nc\nd').description).toBe('+3 lines');
    expect(summariseDiff('a\nb\nc\nd', 'a').description).toBe('−3 lines');
  });

  it('does not charge for the line an append hangs off', () => {
    // The chunk is line-aligned, so it covers line 1 on both sides. Counting the
    // chunk span would report `+4 −1` for what a person sees as three added lines.
    expect(summariseDiff('a', 'a\nb\nc\nd')).toMatchObject({ added: 3, removed: 0 });
  });

  it('counts repeated lines as a multiset, not a set', () => {
    expect(summariseDiff('x\nsame\nsame', 'y\nsame')).toMatchObject({ added: 1, removed: 2 });
  });

  it('handles a document going from empty to full and back', () => {
    expect(summariseDiff('', 'a\nb').added).toBe(2);
    expect(summariseDiff('a\nb', '').removed).toBe(2);
  });

  it('does not call a reordering identical', () => {
    // The character-bag metric it replaced scored this a perfect match.
    const summary = summariseDiff('abc', 'cba');
    expect(summary.added + summary.removed).toBeGreaterThan(0);
  });
});
