/**
 * BLD-006 — the file format, and what it refuses to believe.
 *
 * `.nodegx/threads/<id>.jsonl` is a directory people can open, `cat`, and
 * hand-edit — the task calls it a debugging surface as much as a feature. So
 * the interesting assertions here are not the round trip; they are the ones
 * about a file that is *wrong*, because those are the ones a crash and a text
 * editor actually produce.
 */

import {
  byRecency,
  emptyThread,
  isWorthWriting,
  parseThreadFile,
  serialiseThread,
  THREAD_FILE_VERSION,
  threadLabel,
  threadTitle,
  threadWhen,
  TITLE_MAX,
  UNTITLED,
  type ThreadRecord
} from '../../src/editor/src/models/AiAssistant/thread/threadRecord';
import type { Turn } from '../../src/editor/src/models/AiAssistant/thread/types';

function thread(turns: Turn[]): ThreadRecord {
  return { id: 'abc-1', title: threadTitle(turns), createdAt: 1_000, updatedAt: 2_000, turns };
}

const TURN: Turn = {
  id: 'history-0-component-0',
  request: 'Add a basket popup',
  intent: 'component',
  activities: [
    { kind: 'assistant', text: 'Building the popup.' },
    { kind: 'tool', label: 'Read node documentation' }
  ],
  outcome: { kind: 'accepted-component', legacyName: '/Basket', mode: 'create' }
};

describe('the title', () => {
  it('is the first request', () => {
    expect(threadTitle([TURN])).toBe('Add a basket popup');
  });

  it('skips turns the agent opened itself rather than calling the thread untitled', () => {
    // A restored plan, or the launcher's handover: the first turn has no
    // request, and the user very much did name the conversation afterwards.
    const opened: Turn = { id: 'plan-run', activities: [] };
    expect(threadTitle([opened, TURN])).toBe('Add a basket popup');
  });

  it('cuts a long request on a word boundary, with an ellipsis', () => {
    const long = 'Wire the checkout flow into the app, including the basket, the address form and payment';
    const title = threadTitle([{ id: 't', request: long, activities: [] }]);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX + 1);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/ …$/);
    // The cut is on a space in the original, not mid-word.
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });

  it('still produces a title when the first word is longer than the limit', () => {
    const wordy = 'x'.repeat(TITLE_MAX * 2);
    expect(threadTitle([{ id: 't', request: wordy, activities: [] }])).toBe(`${'x'.repeat(TITLE_MAX)}…`);
  });

  it('collapses whitespace, so a pasted multi-line request is one line', () => {
    expect(threadTitle([{ id: 't', request: '  Add a\n\n  basket  popup ', activities: [] }])).toBe(
      'Add a basket popup'
    );
  });

  it('names an empty thread rather than showing a blank', () => {
    expect(threadLabel(emptyThread('x', 0))).toBe(UNTITLED);
  });
});

describe('when it was last touched', () => {
  const now = 1_000_000_000;
  const ago = (ms: number) => threadWhen(now - ms, now);

  it('reads in the units a person would use', () => {
    expect(ago(5_000)).toBe('just now');
    expect(ago(5 * 60_000)).toBe('5 min ago');
    expect(ago(3 * 3_600_000)).toBe('3 hours ago');
    expect(ago(1 * 3_600_000)).toBe('1 hour ago');
    expect(ago(25 * 3_600_000)).toBe('yesterday');
    expect(ago(3 * 86_400_000)).toBe('3 days ago');
  });

  it('never reports the future, so a clock skew reads as "just now" and not as a negative', () => {
    expect(threadWhen(now + 60_000, now)).toBe('just now');
  });
});

describe('the file', () => {
  it('round trips', () => {
    const original = thread([TURN]);
    const parsed = parseThreadFile(serialiseThread(original));
    expect(parsed).toEqual(original);
  });

  it('is one line per turn, with a header first', () => {
    const text = serialiseThread(thread([TURN, { ...TURN, id: 'history-1' }]));
    const lines = text.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).record).toBe('thread');
    expect(JSON.parse(lines[1]).record).toBe('turn');
    // A trailing newline, so appending by hand produces a valid file rather
    // than two records welded onto one line.
    expect(text.endsWith('\n')).toBe(true);
  });

  it('loses one turn to a half-written last line, not the file', () => {
    // The normal consequence of the crash this feature exists to survive.
    const text = serialiseThread(thread([TURN, { ...TURN, id: 'history-1' }]));
    const truncated = `${text.slice(0, text.lastIndexOf('\n', text.length - 2))}\n{"record":"turn","id":"his`;
    const parsed = parseThreadFile(truncated);
    expect(parsed?.turns.map((turn) => turn.id)).toEqual(['history-0-component-0']);
  });

  it('refuses a version it cannot read rather than guessing', () => {
    const text = serialiseThread(thread([TURN])).replace(
      `"version":${THREAD_FILE_VERSION}`,
      `"version":${THREAD_FILE_VERSION + 1}`
    );
    expect(parseThreadFile(text)).toBeNull();
  });

  it('refuses a file with no header', () => {
    expect(parseThreadFile('{"record":"turn","id":"t","activities":[]}\n')).toBeNull();
    expect(parseThreadFile('')).toBeNull();
    expect(parseThreadFile('not json at all')).toBeNull();
  });

  it('never restores `busy`', () => {
    // A frozen turn that still claims to be running is how a thread grows a
    // spinner that never stops — and a file is by definition frozen.
    const parsed = parseThreadFile(
      `{"record":"thread","version":${THREAD_FILE_VERSION},"id":"a","title":"","createdAt":1,"updatedAt":1}\n` +
        '{"record":"turn","id":"t","activities":[],"busy":true}\n'
    );
    expect(parsed?.turns[0]).not.toHaveProperty('busy');
  });

  it('drops a turn with no id rather than minting one', () => {
    // Ids are what `renderOutcome` matches to decide where a live control may
    // mount. Inventing one here could mint a `component-…` that a retired turn
    // must never carry.
    const parsed = parseThreadFile(
      `{"record":"thread","version":${THREAD_FILE_VERSION},"id":"a","title":"","createdAt":1,"updatedAt":1}\n` +
        '{"record":"turn","activities":[]}\n' +
        '{"record":"turn","id":"kept","activities":[]}\n'
    );
    expect(parsed?.turns.map((turn) => turn.id)).toEqual(['kept']);
  });

  it('re-derives the title from the turns rather than trusting the header', () => {
    const text = serialiseThread(thread([TURN])).replace('"title":"Add a basket popup"', '"title":"Something else"');
    expect(parseThreadFile(text)?.title).toBe('Add a basket popup');
  });

  it('keeps an activity it does not recognise, so a newer editor degrades to a gap', () => {
    const parsed = parseThreadFile(
      `{"record":"thread","version":${THREAD_FILE_VERSION},"id":"a","title":"","createdAt":1,"updatedAt":1}\n` +
        '{"record":"turn","id":"t","activities":[{"kind":"from-the-future","text":"x"},null]}\n'
    );
    expect(parsed?.turns[0].activities).toHaveLength(1);
  });
});

describe('the list', () => {
  it('is newest first', () => {
    const older = { ...emptyThread('a', 0), updatedAt: 10, turns: [TURN] };
    const newer = { ...emptyThread('b', 0), updatedAt: 20, turns: [TURN] };
    expect(byRecency([older, newer]).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('does not write a thread nobody has used', () => {
    expect(isWorthWriting(emptyThread('a', 0))).toBe(false);
    expect(isWorthWriting(thread([TURN]))).toBe(true);
  });
});
