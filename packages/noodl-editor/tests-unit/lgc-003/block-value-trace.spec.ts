/**
 * LGC-003 §2, §3 and §5 — the decisions, without a workspace.
 *
 *  - **§2's dynamic half.** A block with no entry in the run's map did not execute → hollow.
 *    The whole feature is one set difference, and the thing that makes it honest rather than
 *    noisy is the *third* answer: a block that emitted no code is neutral, not hollow.
 *  - **§3.** ~50 runs, drag back, badges repaint.
 *  - **§5.2.** A loop shows the last value plus a count, and scrubs.
 *  - **§5.3.** One repaint per animation frame, not one per value.
 */

import {
  BlockRunHistory,
  FramePaintScheduler,
  RUN_HISTORY_LIMIT,
  badgeText,
  markFor
} from '../../src/editor/src/views/BlocklyEditor/BlockValueTrace';
import type { BlockRunFrame } from '../../src/editor/src/views/BlocklyEditor/BlockValueTrace';

function frame(
  runId: number,
  values: Record<string, { n: number; v: string[] }> = {},
  statements: Record<string, number> = {}
): BlockRunFrame {
  return { nodeId: 'node-1', runId, t: runId * 16, values, statements };
}

describe('LGC-003 §2 — the didn\'t-execute tell', () => {
  const probed = new Set(['ran', 'did-not-run', 'statement']);

  it('a block in the program with no entry in the run did not execute', () => {
    const run = frame(1, { ran: { n: 1, v: ['3'] } });

    expect(markFor('ran', run, probed).state).toBe('executed');
    expect(markFor('did-not-run', run, probed).state).toBe('hollow');
  });

  it('a block that emitted no code is neutral, never hollow', () => {
    // A `Define input`, a disabled block, an orphan. "It did not run this time" is not a true
    // sentence about a block that is not part of the program, and §2's static half — core
    // Blockly's `disableOrphans` — already says what needs saying about the orphan.
    const run = frame(1, { ran: { n: 1, v: ['3'] } });
    expect(markFor('a-declaration', run, probed).state).toBe('neutral');
  });

  it('nothing is hollow before the first run', () => {
    // Hollow must mean "this run did not reach it", not "we have no data". Opening a block
    // editor and seeing the whole program greyed out would teach exactly the wrong thing.
    expect(markFor('ran', undefined, probed).state).toBe('neutral');
    expect(markFor('did-not-run', undefined, probed).state).toBe('neutral');
  });

  it('a statement that ran is executed, and carries a count only when there is one worth having', () => {
    const once = frame(1, {}, { statement: 1 });
    expect(markFor('statement', once, probed)).toEqual({ state: 'executed', badge: undefined, iterations: 1 });

    const many = frame(2, {}, { statement: 9 });
    expect(markFor('statement', many, probed)).toEqual({ state: 'executed', badge: '×9', iterations: 9 });
  });
});

describe('LGC-003 §5.2 — loops need a count, not a flicker', () => {
  it('shows the last value plus the count', () => {
    expect(badgeText({ n: 12, v: ['1', '2', '3'] })).toBe('3  ×12');
  });

  it('shows a single value with no count', () => {
    expect(badgeText({ n: 1, v: ['42'] })).toBe('42');
  });

  it('scrubs to one iteration and says which one, out of the real total', () => {
    // The count has to stay on screen beside the scrubbed value or it becomes a lie: "1" with
    // no "1/12" reads as the answer rather than as the first of twelve.
    expect(badgeText({ n: 12, v: ['1', '2', '3'] }, 0)).toBe('1  1/12');
    expect(badgeText({ n: 12, v: ['1', '2', '3'] }, 2)).toBe('3  3/12');
  });

  it('falls back to the last value when scrubbed past what was kept', () => {
    expect(badgeText({ n: 500, v: ['1', '2'] }, 99)).toBe('2  ×500');
  });

  it('a block that ran but produced nothing keepable still says how often', () => {
    expect(badgeText({ n: 7, v: [] })).toBe('×7');
    expect(badgeText({ n: 0, v: [] })).toBe('');
  });
});

describe('LGC-003 §3 — the scrubber', () => {
  it('keeps the last ~50 runs and drops the oldest', () => {
    const history = new BlockRunHistory();
    for (let i = 1; i <= RUN_HISTORY_LIMIT + 20; i++) history.push(frame(i));

    expect(history.length).toBe(RUN_HISTORY_LIMIT);
    expect(history.at(0)!.runId).toBe(21);
    expect(history.current()!.runId).toBe(RUN_HISTORY_LIMIT + 20);
  });

  it('follows the newest run while live', () => {
    const history = new BlockRunHistory();
    history.push(frame(1));
    history.push(frame(2));

    expect(history.isLive).toBe(true);
    expect(history.current()!.runId).toBe(2);
  });

  it('🔴 does not yank a scrubbed-back user forward when a new run arrives', () => {
    // "It worked three clicks ago" is the question §3 exists to answer, and on a frame clock
    // the program runs again immediately — so a store that jumped to the newest frame would
    // make the answer unreadable at the moment it was asked.
    const history = new BlockRunHistory();
    history.push(frame(1));
    history.push(frame(2));
    history.push(frame(3));

    history.select(0);
    expect(history.isLive).toBe(false);
    expect(history.current()!.runId).toBe(1);

    history.push(frame(4));
    history.push(frame(5));

    expect(history.current()!.runId).toBe(1);
    expect(history.isLive).toBe(false);
  });

  it('keeps a pinned selection pointing at the same run as older runs fall off the front', () => {
    const history = new BlockRunHistory(3);
    history.push(frame(1));
    history.push(frame(2));
    history.push(frame(3));
    history.select(1); // run 2

    history.push(frame(4)); // run 1 falls off
    expect(history.current()!.runId).toBe(2);

    history.push(frame(5)); // run 2 falls off; the selection clamps rather than going negative
    expect(history.current()!.runId).toBe(3);
  });

  it('comes back to live, and selecting the newest run counts as live', () => {
    const history = new BlockRunHistory();
    history.push(frame(1));
    history.push(frame(2));
    history.select(0);
    expect(history.isLive).toBe(false);

    history.goLive();
    expect(history.isLive).toBe(true);
    expect(history.current()!.runId).toBe(2);

    history.select(0);
    history.select(1);
    expect(history.isLive).toBe(true);
  });

  it('clamps a drag rather than throwing', () => {
    const history = new BlockRunHistory();
    history.push(frame(1));
    history.push(frame(2));

    history.select(-40);
    expect(history.current()!.runId).toBe(1);
    history.select(4000);
    expect(history.current()!.runId).toBe(2);

    const empty = new BlockRunHistory();
    empty.select(3);
    expect(empty.current()).toBeUndefined();
  });

  it('badges repaint to the scrubbed run, which is the whole point of keeping them', () => {
    const probed = new Set(['a']);
    const history = new BlockRunHistory();
    history.push(frame(1, { a: { n: 1, v: ['"before"'] } }));
    history.push(frame(2, {}));

    expect(markFor('a', history.current(), probed).state).toBe('hollow');

    history.select(0);
    expect(markFor('a', history.current(), probed)).toEqual({
      state: 'executed',
      badge: '"before"',
      iterations: 1
    });
  });

  it('clearing drops everything and goes back to live', () => {
    const history = new BlockRunHistory();
    history.push(frame(1));
    history.select(0);
    history.clear();

    expect(history.length).toBe(0);
    expect(history.current()).toBeUndefined();
    expect(history.isLive).toBe(true);
  });
});

describe('LGC-003 §5.3 — repaint on an animation frame, not per value', () => {
  it('coalesces a burst of runs into one paint', () => {
    const frames: (() => void)[] = [];
    let paints = 0;
    const scheduler = new FramePaintScheduler(
      () => paints++,
      (cb) => frames.push(cb)
    );

    for (let i = 0; i < 100; i++) scheduler.request();
    expect(frames).toHaveLength(1);
    expect(paints).toBe(0);

    frames[0]();
    expect(paints).toBe(1);
  });

  it('paints again on the next frame after one has run', () => {
    const frames: (() => void)[] = [];
    let paints = 0;
    const scheduler = new FramePaintScheduler(
      () => paints++,
      (cb) => frames.push(cb)
    );

    scheduler.request();
    frames[0]();
    scheduler.request();
    expect(frames).toHaveLength(2);
    frames[1]();
    expect(paints).toBe(2);
  });

  it('a frame that fires after disposal paints nothing', () => {
    // The workspace is gone by then and its blocks with it; painting into a disposed
    // workspace's SVG is the class of bug `unregisterResize` exists to stop one file over.
    const frames: (() => void)[] = [];
    let paints = 0;
    const scheduler = new FramePaintScheduler(
      () => paints++,
      (cb) => frames.push(cb)
    );

    scheduler.request();
    scheduler.dispose();
    frames[0]();

    expect(paints).toBe(0);
    scheduler.request();
    expect(frames).toHaveLength(1);
  });
});
