/**
 * REL-019 §2 — the shelf is in spine order, numbered, and a hand-installed copy counts.
 *
 * 🔴 THE REVERTED ARM IS `EMPTY_CHAIN`, and it is asserted, not assumed: with no chain the
 * shelf must draw exactly what the register gave it (newest first), so a launcher whose
 * artefact lost `spine.json` degrades to the old shelf and not to a broken one.
 *
 * @module noodl-editor/tests-unit/rel-019/shelf-order
 */
import type { LearningEntryView } from '../../src/editor/src/models/learningfolder';
import { EMPTY_CHAIN, type LessonChain } from '../../src/editor/src/models/lessonchain';
import { chainSlugOf, toLearningCard, toLearningCards } from '../../src/editor/src/views/projectsview.learningstate';

const CHAIN: LessonChain = {
  spine: ['your-creature-on-screen', 'poke-it', 'snacks'],
  standalone: ['log-a-thing']
};

function entry(over: Partial<LearningEntryView> = {}): LearningEntryView {
  return {
    id: 'x',
    title: 'X',
    provenance: 'curated',
    projectDirectory: '/data/Learning/x',
    source: { kind: 'local', path: '/bundles/x' },
    installedAt: '2026-08-15T00:00:00.000Z',
    missing: false,
    ...over
  };
}

/** The register's order: newest install first — which is why `snacks` (seeded last) led the shelf. */
const REGISTER: LearningEntryView[] = [
  entry({ id: 'shipped_snacks', title: 'Snacks', installedAt: '2026-09-01T00:00:08Z' }),
  entry({ id: 'shipped_poke-it', title: 'Poke it', installedAt: '2026-09-01T00:00:03Z' }),
  entry({ id: 'my-own-thing', title: 'My own thing', provenance: 'local', installedAt: '2026-09-01T00:00:02Z' }),
  entry({ id: 'shipped_log-a-thing', title: 'Log a thing', installedAt: '2026-09-01T00:00:02Z' }),
  entry({ id: 'shipped_your-creature-on-screen', title: 'Your creature, on screen', installedAt: '2026-09-01T00:00:01Z' })
];

describe('chainSlugOf — two witnesses', () => {
  it('reads the slug off a shipped id', () => {
    expect(chainSlugOf({ id: 'shipped_poke-it', title: 'Poke it' }, CHAIN)).toBe('poke-it');
  });

  it('reads the slug off the TITLE for a copy the learner installed by hand', () => {
    // The seed stands down on a title collision (AC3), so this copy is the only one on the shelf —
    // and it is spine lesson 1. Richard's own shelf has exactly this.
    expect(chainSlugOf({ id: 'your-creature-on-screen', title: 'Your creature, on screen' }, CHAIN)).toBe(
      'your-creature-on-screen'
    );
  });

  it('is undefined for a lesson the chain does not name, whatever its id looks like', () => {
    expect(chainSlugOf({ id: 'shipped_not-in-chain', title: 'Not in chain' }, CHAIN)).toBeUndefined();
    expect(chainSlugOf({ id: 'my-own-thing', title: 'My own thing' }, CHAIN)).toBeUndefined();
  });
});

describe('toLearningCards — the order', () => {
  it('puts the spine first, in chain order, numbered from 1', () => {
    const cards = toLearningCards(REGISTER, CHAIN);
    expect(cards.slice(0, 3).map((c) => [c.title, c.chapter, c.position])).toEqual([
      ['Your creature, on screen', 'spine', 1],
      ['Poke it', 'spine', 2],
      ['Snacks', 'spine', 3]
    ]);
  });

  it('then the standalone lesson, then the rest in the register’s own order', () => {
    const cards = toLearningCards(REGISTER, CHAIN);
    expect(cards.slice(3).map((c) => [c.title, c.chapter])).toEqual([
      ['Log a thing', 'standalone'],
      ['My own thing', 'other']
    ]);
    expect(cards.find((c) => c.title === 'Log a thing')?.position).toBeUndefined();
  });

  it('carries the slug the path tab joins on, and only where there is one', () => {
    const cards = toLearningCards(REGISTER, CHAIN);
    expect(cards.map((c) => c.slug)).toEqual([
      'your-creature-on-screen',
      'poke-it',
      'snacks',
      'log-a-thing',
      undefined
    ]);
  });

  it('🔴 with no chain, draws the register’s order untouched (the reverted arm)', () => {
    const cards = toLearningCards(REGISTER, EMPTY_CHAIN);
    expect(cards.map((c) => c.title)).toEqual(REGISTER.map((e) => e.title));
    expect(cards.every((c) => c.chapter === 'other' && c.position === undefined && c.slug === undefined)).toBe(true);
  });

  it('defaults to that same arm when the chain argument is omitted', () => {
    expect(toLearningCards(REGISTER).map((c) => c.title)).toEqual(REGISTER.map((e) => e.title));
    expect(toLearningCard(REGISTER[0]).chapter).toBe('other');
  });

  it('is stable: two copies of one lesson keep their relative order', () => {
    const twice = [
      entry({ id: 'poke-it', title: 'Poke it', provenance: 'local', installedAt: '2026-09-02T00:00:00Z' }),
      entry({ id: 'shipped_poke-it', title: 'Poke it', installedAt: '2026-09-01T00:00:00Z' })
    ];
    expect(toLearningCards(twice, CHAIN).map((c) => c.id)).toEqual(['poke-it', 'shipped_poke-it']);
  });
});
