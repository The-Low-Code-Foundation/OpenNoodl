/**
 * BLD-004 closes C8 — the collapsed run may finally say how long it took.
 *
 * BLD-002 shipped the strip with counts and **no duration**, and filed the
 * reason: `AuthoringActivity` carried no timestamp, so any number would have
 * been invented at render time from when React happened to mount. The stamps
 * exist now. What is graded here is not that a subtraction works, but the three
 * ways the subtraction must **refuse** — because a duration is the kind of claim
 * that reads as measured whether or not it is, and a wrong one is perfectly
 * legible.
 *
 * The choice of boundary is the interesting half. An activity is stamped when
 * it is *recorded*, and a tool activity is recorded when its call comes back —
 * so `at` is an end time, and measuring first-to-last would silently drop the
 * first entry's own work. The run measures from the activity before it.
 */

import { collapseActivities, runDuration, summariseRun } from '@noodl-models/AiAssistant/thread';
import type { ThreadItem, TurnActivity } from '@noodl-models/AiAssistant/thread';

const tool = (label: string, at?: number): TurnActivity => ({ kind: 'tool', label, ...(at ? { at } : {}) });
const prose = (text: string, at?: number): TurnActivity => ({ kind: 'assistant', text, ...(at ? { at } : {}) });

const T = 1_700_000_000_000;
const runs = (items: ThreadItem[]) => items.filter((i): i is Extract<ThreadItem, { kind: 'run' }> => i.kind === 'run');

describe('runDuration', () => {
  it('measures from the entry before the run, not from the run’s own first entry', () => {
    // The turn opened at T (the prose), the last read came back at T+14s. The
    // run took 14s. Measuring T+2s → T+14s would report 12s and silently omit
    // the first read — the whole reason the boundary is the preceding entry.
    const span = [tool('a', T + 2_000), tool('b', T + 14_000)];
    expect(runDuration(span, prose('thinking', T))).toBe(14_000);
  });

  it('refuses when the run opens the turn', () => {
    // Nothing before it means no start boundary. An under-count dressed as a
    // measurement is worse than the absence the strip already knows how to show.
    expect(runDuration([tool('a', T + 1_000), tool('b', T + 2_000)], undefined)).toBeUndefined();
  });

  it('refuses when either boundary is unstamped', () => {
    // The `at` field is optional so producers without a clock can omit it —
    // `turns.ts` synthesises plan-run and docs activities out of state that has
    // no per-entry timestamp. Forgetting to stamp must cost the summary a
    // *fact*, never make it say something untrue.
    expect(runDuration([tool('a', T + 1_000), tool('b')], prose('p', T))).toBeUndefined();
    expect(runDuration([tool('a', T + 1_000), tool('b', T + 2_000)], prose('p'))).toBeUndefined();
  });

  it('refuses a negative span rather than reporting one', () => {
    // Two stamps that run backwards came from different clocks, so neither
    // describes this run. `-3s` would render as "0s" through `formatDuration`
    // and read as an instantaneous run, which is a lie with a plausible face.
    expect(runDuration([tool('a', T)], prose('p', T + 3_000))).toBeUndefined();
  });
});

describe('summariseRun with a duration', () => {
  it('appends it to the counts, and reads as a different kind of fact', () => {
    // Em-dash, not another `·`: the counts are of the list, the duration is of
    // the clock.
    expect(summariseRun([tool('a'), tool('b'), tool('c')], 14_000)).toBe('3 steps — 14s');
  });

  it('is byte-identical to BLD-002 when there is no duration', () => {
    // The absence path is the common one — every plan-run and docs turn takes
    // it — so it is the one that must not have regressed.
    expect(summariseRun([tool('a'), tool('b'), tool('c')])).toBe('3 steps');
    expect(summariseRun([tool('a'), tool('b'), tool('c')], undefined)).toBe('3 steps');
  });
});

describe('collapseActivities supplies the boundary', () => {
  it('gives a run the stamp of whatever precedes it in the ORIGINAL list', () => {
    const activities = [prose('one', T), tool('a', T + 5_000), tool('b', T + 9_000), prose('two', T + 10_000)];
    const [run] = runs(collapseActivities(activities));

    expect(run.durationMs).toBe(9_000);
    expect(run.summary).toBe('2 steps — 9s');
  });

  it('does not take the boundary from the collapsed view', () => {
    // ⚠️ Two runs separated by one failure: the second run's boundary is the
    // failure at index 2, not the *run* that precedes it in `items`. Reading
    // from the collapsed list would take the first run's node — a different
    // entry, several seconds earlier — and over-report the second run.
    const activities = [
      tool('a', T + 1_000),
      tool('b', T + 2_000),
      { kind: 'submit', ok: false, errorLines: ['nope'], at: T + 3_000 } as TurnActivity,
      tool('c', T + 8_000),
      tool('d', T + 9_000)
    ];
    const [, second] = runs(collapseActivities(activities));

    expect(second.durationMs).toBe(6_000);
  });

  it('omits the field entirely rather than carrying an undefined one', () => {
    const [run] = runs(collapseActivities([tool('a'), tool('b')]));
    expect('durationMs' in run).toBe(false);
    expect(run.summary).toBe('2 steps');
  });
});
