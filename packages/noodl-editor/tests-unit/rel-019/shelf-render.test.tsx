/**
 * REL-019 §2 — what the numbered, filterable shelf actually DRAWS.
 *
 * The walker sees elements, not paint (see `../support/renderElements.ts`). What it can grade:
 * the number on a card, the "next up" block naming the right lesson, the filter row's counts,
 * and that a filter narrows the grid. What it cannot: that any of it is legible in a column —
 * that was driven on 2026-09-06 and screenshotted.
 *
 * @module noodl-editor/tests-unit/rel-019/shelf-render
 */
import React from 'react';

import {
  LearningSection,
  filterLessons,
  nextUpLesson,
  type LauncherLearningData
} from '@noodl-core-ui/preview/launcher/Launcher/components/LearningSection';

import { render, text, walk } from '../support/renderElements';

function lesson(over: Partial<LauncherLearningData> = {}): LauncherLearningData {
  return {
    id: 'shipped_x',
    title: 'X',
    provenance: 'curated',
    progressPercent: 0,
    state: 'not-started',
    ...over
  };
}

const SHELF: LauncherLearningData[] = [
  lesson({ id: 'shipped_your-creature-on-screen', title: 'Your creature, on screen', slug: 'your-creature-on-screen', chapter: 'spine', position: 1, state: 'completed', progressPercent: 100 }),
  lesson({ id: 'shipped_poke-it', title: 'Poke it', slug: 'poke-it', chapter: 'spine', position: 2, state: 'in-progress', progressPercent: 40 }),
  lesson({ id: 'shipped_snacks', title: 'Snacks', slug: 'snacks', chapter: 'spine', position: 3 }),
  lesson({ id: 'shipped_log-a-thing', title: 'Log a thing', slug: 'log-a-thing', chapter: 'standalone' }),
  lesson({ id: 'mine', title: 'My own thing', provenance: 'local', chapter: 'other' })
];

const byTest = (tree: ReturnType<typeof render>, prefix: string) =>
  walk(tree).filter((n) => String(n.props['data-test'] ?? '').startsWith(prefix));

describe('filterLessons / nextUpLesson — the decisions', () => {
  it('"spine" keeps the chain and "standalone" keeps everything else', () => {
    expect(filterLessons(SHELF, 'spine').map((l) => l.title)).toEqual(['Your creature, on screen', 'Poke it', 'Snacks']);
    expect(filterLessons(SHELF, 'standalone').map((l) => l.title)).toEqual(['Log a thing', 'My own thing']);
  });

  it('narrows by state, and "all" is the identity', () => {
    expect(filterLessons(SHELF, 'in-progress').map((l) => l.title)).toEqual(['Poke it']);
    expect(filterLessons(SHELF, 'completed').map((l) => l.title)).toEqual(['Your creature, on screen']);
    expect(filterLessons(SHELF, 'all')).toBe(SHELF);
  });

  it('next up is the first spine lesson not completed, in chain order, not shelf order', () => {
    expect(nextUpLesson(SHELF)?.title).toBe('Poke it');
    expect(nextUpLesson([...SHELF].reverse())?.title).toBe('Poke it');
  });

  it('next up is null with no spine, and null once the spine is done', () => {
    expect(nextUpLesson(SHELF.filter((l) => l.chapter !== 'spine'))).toBeNull();
    expect(nextUpLesson(SHELF.map((l) => ({ ...l, state: 'completed' as const })))).toBeNull();
  });
});

describe('the shelf, drawn', () => {
  const tree = render(<LearningSection lessons={SHELF} filter="all" onFilterChange={() => undefined} />);

  it('numbers the spine cards and nothing else', () => {
    const numbers = byTest(tree, 'learning-position').map((n) => n.ownText);
    expect(numbers).toEqual(['1', '2', '3']);
    const cards = byTest(tree, 'learning-card-');
    expect(cards.map((c) => c.props['data-position'])).toEqual([1, 2, 3, undefined, undefined]);
  });

  it('names the next spine lesson above the grid, with a way in', () => {
    const block = byTest(tree, 'learning-next-up')[0];
    expect(text(block)).toContain('2. Poke it');
    expect(byTest(tree, 'learning-next-up-open')).toHaveLength(1);
    // …and marks the same card in the grid, once.
    expect(byTest(tree, 'learning-next-up-chip')).toHaveLength(1);
  });

  it('says how far along the spine the learner is', () => {
    expect(text(tree)).toContain('1 of 3 on the spine done');
  });

  it('offers only the filters that would show something, each with its count', () => {
    const pills = byTest(tree, 'learning-filter-');
    expect(pills.map((p) => text(p))).toEqual(['All 5', 'The spine 3', 'Standalone 2', 'In progress 1', 'Completed 1']);
    expect(pills.map((p) => p.props['aria-pressed'])).toEqual([true, false, false, false, false]);
  });

  it('a chosen filter narrows the grid — and the pressed pill moves with it', () => {
    const spine = render(<LearningSection lessons={SHELF} filter="spine" onFilterChange={() => undefined} />);
    expect(byTest(spine, 'learning-card-').map((c) => c.props['data-test'])).toEqual([
      'learning-card-shipped_your-creature-on-screen',
      'learning-card-shipped_poke-it',
      'learning-card-shipped_snacks'
    ]);
    const pressed = byTest(spine, 'learning-filter-').filter((p) => p.props['aria-pressed'] === true);
    expect(pressed.map((p) => p.props['data-test'])).toEqual(['learning-filter-spine']);
  });

  it('clicking a pill reports the filter to the host, which is where the state lives', () => {
    const chosen: string[] = [];
    const t = render(<LearningSection lessons={SHELF} filter="all" onFilterChange={(f) => chosen.push(f)} />);
    const completed = byTest(t, 'learning-filter-completed')[0];
    (completed.props.onClick as () => void)();
    expect(chosen).toEqual(['completed']);
  });

  it('🔴 with no host filter and no chain, draws the shelf it always drew (the reverted arm)', () => {
    const plain = render(<LearningSection lessons={SHELF.map(({ chapter, position, slug, ...rest }) => rest)} />);
    expect(byTest(plain, 'learning-position')).toHaveLength(0);
    expect(byTest(plain, 'learning-next-up')).toHaveLength(0);
    expect(byTest(plain, 'learning-filters')).toHaveLength(0);
    expect(byTest(plain, 'learning-card-')).toHaveLength(5);
  });
});
