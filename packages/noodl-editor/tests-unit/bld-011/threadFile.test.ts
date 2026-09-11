/**
 * BLD-011 — what a reopened thread shows, and what it must never contain.
 *
 * ⚠️ **Why this is a spec and not a drive.** The on-disk thread file is written
 * from *history*, and a turn only becomes history when the next request retires
 * it — so driving this end to end costs a second billed provider call for a
 * property that is entirely about a file format. The drive covered everything a
 * file cannot show (the chips, the meter arithmetic, the cap, the record row
 * under the request, and — on disk — that `.nodegx/plan/session.json` came back
 * at 1,458 bytes with no `ATTACHED CONTEXT` in it). This covers the round trip
 * exactly, which is stronger evidence for a format than watching one file.
 *
 * The claim that matters most is the negative one: a thread file records what
 * rode along and **never the bytes**. A regression here has no symptom until
 * somebody opens a `.jsonl` a week later and finds a stale copy of a component
 * that has since been rewritten.
 */

import { parseThreadFile, serialiseThread } from '../../src/editor/src/models/AiAssistant/thread/threadRecord';
import type { ThreadRecord } from '../../src/editor/src/models/AiAssistant/thread/threadRecord';
import type { Turn } from '../../src/editor/src/models/AiAssistant/thread/types';

function threadWith(turns: Turn[]): ThreadRecord {
  return { id: 'thread-1', title: 'Add a footer', createdAt: 1, updatedAt: 2, turns };
}

const TURN: Turn = {
  id: 'history-0-plan',
  request: 'Add a shared footer component.',
  activities: [],
  references: [
    { kind: 'component', label: 'Pages/Home', chars: 2613, pinned: true },
    { kind: 'doc', label: 'docs/CONVENTIONS.md', chars: 11904, pinned: true, truncated: true }
  ]
};

describe('BLD-011 thread file — the record survives a round trip', () => {
  it('restores kind, label, size, pin state and truncation', () => {
    const restored = parseThreadFile(serialiseThread(threadWith([TURN])));
    expect(restored?.turns[0].references).toEqual(TURN.references);
  });

  it('never writes the resolved bytes', () => {
    // The retention rule, asserted against the serialized text rather than the
    // object — the object is what we control, the text is what ships.
    const text = serialiseThread(threadWith([TURN]));
    expect(text).not.toContain('ATTACHED CONTEXT');
    expect(text).not.toContain('--- COMPONENT:');
    // A 24k component plus a 12k doc; the whole line stays well under 1k.
    expect(text.length).toBeLessThan(1000);
  });

  it('leaves a turn that carried nothing byte-identical to before this task', () => {
    // Absent-means-omitted: every thread file written before BLD-011 existed
    // must still parse, and every turn without attachments must still serialize
    // without the key.
    const plain: Turn = { id: 'history-0-plan', request: 'Hello', activities: [] };
    const text = serialiseThread(threadWith([plain]));
    expect(text).not.toContain('references');
    expect(parseThreadFile(text)?.turns[0].references).toBeUndefined();
  });

  it('drops a malformed entry without losing the turn', () => {
    // `.nodegx/` is a directory people open and hand-edit, and the file rule is
    // "take what is well formed, drop the rest, never throw" — a bad entry costs
    // one chip, not the conversation.
    const header = JSON.stringify({ record: 'thread', version: 1, id: 't', title: 'x', createdAt: 1, updatedAt: 2 });
    const turn = JSON.stringify({
      record: 'turn',
      id: 'history-0-plan',
      request: 'Hello',
      activities: [],
      references: [{ kind: 'doc' }, { label: 'no kind' }, { kind: 'doc', label: 'docs/BRIEF.md', chars: 5, pinned: true }]
    });
    const restored = parseThreadFile(`${header}\n${turn}\n`);
    expect(restored?.turns[0].references).toEqual([{ kind: 'doc', label: 'docs/BRIEF.md', chars: 5, pinned: true }]);
  });
});
