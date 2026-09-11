/**
 * FIX-021 slice B, acceptance criterion 3 — where the profile block lands, as a
 * byte comparison.
 *
 * BLD-011's `cacheSafety.test.ts` grades the mirror image of this: attachments
 * are per-turn content and must ride *behind* `cacheBoundary`, so that carrying
 * one never re-bills the prefix. The profile is the opposite kind of thing — one
 * user's standing preferences, identical on every turn of every session in every
 * project — so it belongs *ahead* of the boundary, in the cached half, and the
 * risk it carries is the other one:
 *
 * 1. A user who has written nothing must pay **zero** bytes for the feature
 *    existing. Not "a small block"; zero, byte-identical to before it shipped.
 * 2. Writing a preference must invalidate only the **tail** of the prefix. That
 *    is why the block is last, and "last" is only checkable against the bytes
 *    ahead of it.
 * 3. BLD-011's rule must not be weakened on the way: an attachment must still
 *    land behind the boundary when a profile is present.
 *
 * None of the three has a symptom on screen. The whole failure mode is an
 * invoice, which is exactly why it is graded here and not driven.
 */

import { initialUserMessage, updateUserMessage } from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';

const REQUEST = { description: 'Add a basket popup.', componentPath: 'Components/Basket' };
const OVERVIEW = '--- overview text ---';
const CATALOG = '--- catalog text ---';
const SOURCE = '{ "current": true }';
const DOCS = { conventions: 'Use tokens.', brief: 'A shop.' };
const PROFILE = '## How I like things built\nPrefer built-in nodes.';
const REFERENCES = '--- ATTACHED: Pages/Home ---\nHOME SOURCE\n--- END ATTACHED ---';
const MARKER = '--- ABOUT THE PERSON YOU ARE BUILDING FOR ---';

describe('FIX-021 slice B — the profile block and the cache prefix', () => {
  describe('criterion 3a — absent means omitted, to the byte', () => {
    it('produces the pre-FIX-021 turn when the user has written nothing', () => {
      const without = initialUserMessage(REQUEST, OVERVIEW, CATALOG, undefined, DOCS);
      for (const empty of [undefined, '']) {
        const with_ = initialUserMessage(
          REQUEST, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined, undefined, undefined,
          empty
        );
        expect(with_.content).toBe(without.content);
        expect(with_.cacheBoundary).toBe(without.cacheBoundary);
        // ⚠️ The equality above is NOT enough on its own, and a mutant proved
        // it: both arms are built by the same code, so a block emitted
        // unconditionally lands in BOTH and they stay equal. The absence has to
        // be asserted outright — and it is only meaningful because the rows
        // below show the same marker firing when there IS a profile.
        expect(with_.content).not.toContain(MARKER);
      }
    });

    it('does the same on an update turn', () => {
      const without = updateUserMessage(REQUEST, SOURCE, OVERVIEW, CATALOG, undefined, DOCS);
      const with_ = updateUserMessage(
        REQUEST, SOURCE, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined, undefined,
        undefined, undefined
      );
      expect(with_.content).toBe(without.content);
      expect(with_.cacheBoundary).toBe(without.cacheBoundary);
      expect(with_.content).not.toContain(MARKER);
    });
  });

  describe('criterion 3b — present, cached, and last', () => {
    it('puts the block in the STABLE half, ahead of the boundary', () => {
      const turn = initialUserMessage(
        REQUEST, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined, undefined, undefined,
        PROFILE
      );
      expect(turn.content).toContain('Prefer built-in nodes.');
      expect(turn.content.indexOf(MARKER)).toBeGreaterThan(-1);
      expect(turn.content.indexOf(MARKER)).toBeLessThan(turn.cacheBoundary);
    });

    it('states the precedence rather than leaving it to position', () => {
      // Being last is a caching argument. Recency would otherwise read as "this
      // outranks the project", and it does not — so the ladder is said out loud.
      const turn = initialUserMessage(
        REQUEST, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined, undefined, undefined,
        PROFILE
      );
      const block = turn.content.slice(turn.content.indexOf(MARKER));
      expect(block).toContain('outrank your own habits and defaults');
      expect(block).toContain("This project's own conventions outrank them");
    });

    it('lands AFTER the project docs, which is what "last" means here', () => {
      const turn = initialUserMessage(
        REQUEST, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined, undefined, undefined,
        PROFILE
      );
      expect(turn.content.indexOf(MARKER)).toBeGreaterThan(turn.content.indexOf('--- PROJECT CONVENTIONS ---'));
      expect(turn.content.indexOf(MARKER)).toBeGreaterThan(turn.content.indexOf('--- PROJECT BRIEF ---'));
    });

    it('leaves every byte AHEAD of the block untouched — only the tail is invalidated', () => {
      // The reason "last" is worth asserting at all: a user who writes their
      // first preference re-bills the tail of their prefix and nothing else.
      const without = initialUserMessage(REQUEST, OVERVIEW, CATALOG, undefined, DOCS);
      const with_ = initialUserMessage(
        REQUEST, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined, undefined, undefined,
        PROFILE
      );
      const at = with_.content.indexOf(MARKER);
      expect(with_.content.slice(0, at)).toBe(without.content.slice(0, at));
      // And the boundary really did move — an assertion that only compared the
      // head would pass just as happily if the block had been dropped entirely.
      expect(with_.cacheBoundary).toBeGreaterThan(without.cacheBoundary);
    });
  });

  describe('criterion 3c — BLD-011 extended, not weakened', () => {
    it('still keeps an attachment behind the boundary when a profile is present', () => {
      const turn = initialUserMessage(
        REQUEST, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined, REFERENCES, undefined,
        PROFILE
      );
      expect(turn.content.indexOf('HOME SOURCE')).toBeGreaterThan(turn.cacheBoundary);
      expect(turn.content.indexOf(MARKER)).toBeLessThan(turn.cacheBoundary);
    });

    it('leaves the stable prefix byte-identical with and without an attachment, profile included', () => {
      const args = [REQUEST, OVERVIEW, CATALOG, undefined, DOCS, undefined, undefined, undefined, undefined] as const;
      const without = initialUserMessage(...args, undefined, undefined, PROFILE);
      const with_ = initialUserMessage(...args, REFERENCES, undefined, PROFILE);
      expect(with_.cacheBoundary).toBe(without.cacheBoundary);
      expect(with_.content.slice(0, with_.cacheBoundary)).toBe(without.content.slice(0, without.cacheBoundary));
    });
  });
});
