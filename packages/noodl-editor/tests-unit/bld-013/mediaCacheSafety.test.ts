/**
 * BLD-013/014 — Rule 6 for **media**, and it is a different failure from
 * BLD-011's.
 *
 * BLD-011 proved that a reference's *prose* lands after the cache boundary. It
 * could do that as a string comparison, because the whole turn was a string
 * with a character offset in it. Media cannot be a string: an image has to stay
 * a block all the way to the adapter or `degradeImages` has nothing to degrade.
 * So a turn carrying media expresses the same boundary a different way — as a
 * `cache: true` marker on a block — and **that conversion is where the money
 * is**.
 *
 * The natural way to write `openingTurnWithMedia` is media-first: a document
 * before the prose that discusses it is what every provider's own guidance
 * says, and it is what `referenceMediaBlocks` does for the planning turn, which
 * has no boundary to protect. Doing it on the *authoring* turn puts a 900KB
 * screenshot ahead of the breakpoint, which does not cost the screenshot — it
 * costs the entire AIX-007 stable prefix, uncached, on every operation of every
 * plan, forever, with nothing on screen to say so.
 *
 * These assert the **index** of the marked block as well as its bytes. A prefix
 * that is the same length by luck is not the same prefix, and BLD-011's R13
 * is why the inversion below is run before any of this is trusted.
 */

import type { AiContentBlock, AiTextBlock } from '../../src/editor/src/models/AiAssistant/client/content';
import { cacheBlockIndex, isBlockContent } from '../../src/editor/src/models/AiAssistant/client/content';
import { openingTurnWithMedia } from '../../src/editor/src/models/AiAssistant/thread/references';

const STABLE = '--- PROJECT OVERVIEW ---\nthe overview\n--- NODE CATALOG ---\nthe catalog\n\n';
const VARIABLE = '--- YOUR TASK ---\nBuild a basket popup.';
const CONTENT = STABLE + VARIABLE;
const BOUNDARY = STABLE.length;

const IMAGE: AiContentBlock = {
  type: 'image',
  data: 'AAAA',
  mediaType: 'image/png',
  text: 'A screenshot of the running app.'
};
const PDF: AiContentBlock = {
  type: 'document',
  data: 'BBBB',
  mediaType: 'application/pdf',
  title: 'brief.pdf',
  text: 'A PDF the user attached, "brief.pdf", 12 KB.'
};

function textOf(block: AiContentBlock): string {
  return (block as AiTextBlock).text;
}

describe('BLD-013 — media and the cache boundary', () => {
  it('puts the marked stable block FIRST and every media block after it', () => {
    const blocks = openingTurnWithMedia(CONTENT, BOUNDARY, [PDF, IMAGE]);

    // The load-bearing assertion. Index 0, not "somewhere in there".
    expect(cacheBlockIndex(blocks)).toBe(0);
    expect(blocks[0].type).toBe('text');
    expect(blocks[0].cache).toBe(true);
    expect(blocks[1]).toBe(PDF);
    expect(blocks[2]).toBe(IMAGE);
  });

  it('leaves the cache-stable bytes identical to the string form', () => {
    const blocks = openingTurnWithMedia(CONTENT, BOUNDARY, [IMAGE]);
    // Byte-for-byte, not "starts with" — a prefix that gained a newline is a
    // prefix that misses on every subsequent request.
    expect(textOf(blocks[0])).toBe(CONTENT.slice(0, BOUNDARY));
    expect(textOf(blocks[0])).toBe(STABLE);
  });

  it('loses nothing: the concatenated text equals the original turn', () => {
    const blocks = openingTurnWithMedia(CONTENT, BOUNDARY, [IMAGE, PDF]);
    const text = blocks
      .filter((block): block is AiTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
    // The media went somewhere; the words did not change. A conversion that
    // dropped the task would still pass every assertion above.
    expect(text).toBe(CONTENT);
  });

  it('carries no media block ahead of the breakpoint, at any media count', () => {
    // Swept rather than spot-checked. BLD-007's B8 shipped a fix that was
    // perfect at one value and wrong at every other, and the sweep costs the
    // same as the single check.
    for (const count of [1, 2, 3, 8]) {
      const media = Array.from({ length: count }, () => IMAGE);
      const blocks = openingTurnWithMedia(CONTENT, BOUNDARY, media);
      const marked = cacheBlockIndex(blocks);
      const firstMedia = blocks.findIndex((block) => block.type !== 'text');
      expect(marked).toBe(0);
      expect(firstMedia).toBeGreaterThan(marked);
    }
  });

  it('⚠️ INVERTED: media placed first would move the marker off index 0', () => {
    // R13 of BLD-008 — a guard is not trusted until it has been seen to fail.
    // This is the shape the "obvious" implementation would produce.
    const wrong: AiContentBlock[] = [
      IMAGE,
      { type: 'text', text: CONTENT.slice(0, BOUNDARY), cache: true },
      { type: 'text', text: CONTENT.slice(BOUNDARY) }
    ];
    expect(cacheBlockIndex(wrong)).toBe(1);
    // ...which is exactly what the first test forbids, and the reason it
    // asserts an index rather than "a block is marked".
    expect(cacheBlockIndex(wrong)).not.toBe(cacheBlockIndex(openingTurnWithMedia(CONTENT, BOUNDARY, [IMAGE])));
  });

  it('falls back to media-first only when there is no prefix worth protecting', () => {
    // The planning turn: no boundary, nothing cached either way, so recency
    // wins and a document precedes the prose about it.
    const blocks = openingTurnWithMedia(CONTENT, undefined, [PDF]);
    expect(blocks[0]).toBe(PDF);
    expect(cacheBlockIndex(blocks)).toBe(-1);
    expect(isBlockContent(blocks)).toBe(true);
  });

  it('treats a degenerate boundary as no boundary rather than splitting at it', () => {
    // A breakpoint on an empty prefix costs a cache write and earns no reads —
    // the same rule `splitAtCacheBoundary` already keeps for string content.
    for (const boundary of [0, CONTENT.length, CONTENT.length + 10]) {
      const blocks = openingTurnWithMedia(CONTENT, boundary, [IMAGE]);
      expect(cacheBlockIndex(blocks)).toBe(-1);
      expect(blocks[0]).toBe(IMAGE);
    }
  });
});
