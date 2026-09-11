/**
 * BLD-017 — the mockup fidelity pass, in the half a screenshot cannot settle.
 *
 * Most of this task is stylesheets, and stylesheets are graded by driving: a
 * border either draws or it does not, and a screenshot at 400px in both themes
 * is the honest gate for that. Three things in it are *not* like that, and they
 * are what is pinned here.
 *
 * **F1 — the chip's two halves must describe the same run.** The mockup
 * right-aligns the duration, so the strip became two boxes. A view that computed
 * the left half by calling `summariseRun` again would be one fact with two
 * authors, and the failure mode is silent: the counts and the clock would drift
 * only in the cases where they disagree, which are exactly the cases nobody
 * screenshots.
 *
 * **F2 — the card's title and sub are one sentence, split.** The same sentence
 * had two hand-written copies before this task (`OutcomeSummary` and
 * `renderOutcome`, character for character). Splitting it into two roles without
 * one author would have made that four copies of two strings.
 *
 * **F4 — the track's widths.** A progress bar is the purest case of the BLD-005
 * argument: `width: 71.4%` and `width: 85.7%` are the same three pixels on
 * screen, so the only place the arithmetic can be checked is here. The
 * interesting cases are the ones a mid-run screenshot cannot contain — a run
 * that failed twice, a finished run, an empty plan.
 */

import type { PlanOperationState, PlanRunState } from '@noodl-models/AiAssistant/authoring';
import {
  collapseActivities,
  outcomeSentence,
  runTrack,
  stagedComponentCard,
  summariseRun
} from '@noodl-models/AiAssistant/thread';
import type { ThreadItem, TurnActivity, TurnOutcome } from '@noodl-models/AiAssistant/thread';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const tool = (label: string, at?: number): TurnActivity =>
  ({ kind: 'tool', label, ...(at === undefined ? {} : { at }) }) as TurnActivity;

const prose = (at?: number): TurnActivity =>
  ({ kind: 'assistant', text: 'Working on it.', ...(at === undefined ? {} : { at }) }) as TurnActivity;

const runs = (items: ThreadItem[]) => items.filter((i): i is Extract<ThreadItem, { kind: 'run' }> => i.kind === 'run');

function op(id: string, status: PlanOperationState['status']): PlanOperationState {
  return { operation: { id, kind: 'create', target: `Pages/${id}` } as PlanOperationState['operation'], status };
}

function runState(operations: PlanOperationState[], extra: Partial<PlanRunState> = {}): PlanRunState {
  return { busy: true, phase: 'running', operations, costUsd: 0, ...extra };
}

const staged = (over: Partial<Extract<TurnOutcome, { kind: 'staged-component' }>> = {}) =>
  ({
    kind: 'staged-component',
    legacyName: '/Basket popup',
    mode: 'create',
    nodeCount: 8,
    connectionCount: 4,
    ...over
  }) as Extract<TurnOutcome, { kind: 'staged-component' }>;

// ── F1 — the collapsed run chip ──────────────────────────────────────────────

describe('F1 — the run chip splits without gaining a second author', () => {
  it('carries the counts alone, so the left box needs no arithmetic of its own', () => {
    const items = collapseActivities([prose(0), tool('a', 5_000), tool('b', 14_000)]);
    expect(runs(items)[0].counts).toBe('2 steps');
  });

  it('keeps `summary` as the one-sentence form, duration included', () => {
    const items = collapseActivities([prose(0), tool('a', 5_000), tool('b', 14_000)]);
    expect(runs(items)[0].summary).toBe('2 steps — 14s');
  });

  /**
   * The property that matters, stated as one: the visible half is a prefix of
   * the spoken half. If a future change makes the chip print something the
   * accessible name does not contain, a screen reader and a screenshot stop
   * describing the same strip — and nothing else in the suite would notice.
   */
  it('the accessible name always begins with what the chip prints', () => {
    const cases: TurnActivity[][] = [
      [prose(0), tool('a', 1_000), tool('b', 2_000)],
      [prose(0), tool('a', 0), tool('b', 90_000), tool('c', 125_000)],
      // No stamps at all: the run reports no duration, so the two are identical.
      [prose(), tool('a'), tool('b')]
    ];

    for (const activities of cases) {
      const item = runs(collapseActivities(activities))[0];
      expect(item.summary.startsWith(item.counts)).toBe(true);
    }
  });

  it('is exactly the summary when the stamps do not support a duration', () => {
    const item = runs(collapseActivities([prose(), tool('a'), tool('b')]))[0];
    expect(item.durationMs).toBeUndefined();
    expect(item.counts).toBe(item.summary);
  });

  it('agrees with `summariseRun` called without a clock', () => {
    const span = [tool('a', 1_000), tool('b', 2_000)];
    const item = runs(collapseActivities([prose(0), ...span]))[0];
    expect(item.counts).toBe(summariseRun(span));
  });
});

// ── F2 — the outcome card's two lines ────────────────────────────────────────

describe('F2 — the outcome card has one author for both of its lines', () => {
  it('puts what it is and what you can do on the title', () => {
    expect(stagedComponentCard(staged()).title).toBe('/Basket popup — ready to add');
  });

  it('says "update" rather than "add" when the component already exists', () => {
    expect(stagedComponentCard(staged({ mode: 'update' })).title).toBe('/Basket popup — ready to update');
  });

  it('puts the shape and the reassurance on the detail', () => {
    expect(stagedComponentCard(staged()).detail).toBe('8 nodes, 4 connections. Nothing is in your project yet.');
  });

  /**
   * ⚠️ Not cosmetic. For an update, "nothing is in your project yet" is false —
   * the component is in the project and it is the *edit* that is pending. A card
   * that said it would be telling a user that Discard costs them nothing when
   * what it actually costs is the edit.
   */
  it('never claims nothing is in the project when the component already is', () => {
    expect(stagedComponentCard(staged({ mode: 'update' })).detail).toBe(
      '8 nodes, 4 connections. Your component is untouched until you accept.'
    );
  });

  it('agrees with its own verb on every count that can be one', () => {
    const one = stagedComponentCard(staged({ nodeCount: 1, connectionCount: 1 }));
    expect(one.detail).toBe('1 node, 1 connection. Nothing is in your project yet.');

    const none = stagedComponentCard(staged({ nodeCount: 0, connectionCount: 0 }));
    expect(none.detail).toBe('0 nodes, 0 connections. Nothing is in your project yet.');
  });

  it('recomposes into the one-line form the transcript renders', () => {
    expect(outcomeSentence(stagedComponentCard(staged()))).toBe(
      '/Basket popup — ready to add. 8 nodes, 4 connections. Nothing is in your project yet.'
    );
  });

  it('does not leave a trailing separator when there is no detail', () => {
    expect(outcomeSentence({ title: 'Only a title' })).toBe('Only a title');
  });
});

// ── F4 — the run map's track ─────────────────────────────────────────────────

describe('F4 — the progress track', () => {
  it('fills by staged operations and marks the one being built', () => {
    const track = runTrack(runState([op('a', 'staged'), op('b', 'staged'), op('c', 'authoring'), op('d', 'pending')]));
    expect(track.done).toBe(0.5);
    expect(track.now).toBe(0.25);
  });

  /**
   * ⚠️ The row this exists for. A run that built five of seven and failed twice
   * has two operations behind the playhead that are not done; painting them
   * green would make the bar disagree with `runPosition`'s own "5 of 7 built",
   * and the bar is the half that gets believed at a glance.
   */
  it('does not count a failed or skipped operation as done', () => {
    const track = runTrack(
      runState([op('a', 'staged'), op('b', 'failed'), op('c', 'skipped'), op('d', 'pending')], { busy: false })
    );
    expect(track.done).toBe(0.25);
    expect(track.now).toBe(0);
  });

  it('clears the accent segment once nothing is authoring', () => {
    const track = runTrack(runState([op('a', 'staged'), op('b', 'staged')], { busy: false }));
    expect(track.done).toBe(1);
    expect(track.now).toBe(0);
  });

  it('is empty for a plan with no operations rather than NaN', () => {
    const track = runTrack(runState([]));
    expect(track.done).toBe(0);
    expect(track.now).toBe(0);
    expect(Number.isFinite(track.done)).toBe(true);
    expect(Number.isFinite(track.now)).toBe(true);
  });

  /**
   * A `NaN` width is a declaration CSS drops, so the segment silently keeps
   * whatever it had last render — a stale bar that looks like a live one. The
   * case above covers the divide-by-zero; this covers every other shape.
   */
  it('never produces a share outside 0…1, and the two never exceed the bar', () => {
    const shapes: PlanOperationState['status'][][] = [
      ['pending', 'pending'],
      ['authoring'],
      ['staged', 'authoring'],
      ['failed', 'failed', 'failed'],
      // A producer bug: two operations reporting `authoring` at once. The accent
      // segment must not be allowed past the end of the bar.
      ['staged', 'authoring', 'authoring'],
      ['staged', 'staged', 'staged', 'authoring']
    ];

    for (const statuses of shapes) {
      const track = runTrack(runState(statuses.map((status, i) => op(`op${i}`, status))));
      expect(track.done).toBeGreaterThanOrEqual(0);
      expect(track.now).toBeGreaterThanOrEqual(0);
      expect(track.done + track.now).toBeLessThanOrEqual(1);
    }
  });
});
