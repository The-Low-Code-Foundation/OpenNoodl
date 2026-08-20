/**
 * NAT-007 AC4/AC6 — what the whole screen becomes once a write is in play.
 *
 * `threadwrites.test.ts` grades the two writes in isolation. This grades the **join**: the accept
 * verb reaching a post through `composeThreadView`, and the arm that carries this task's least
 * obvious criterion — a thread drawn from a copy taken *before* the answer somebody just posted.
 *
 * 🔴 **Every assertion here goes through `composeThreadView` or `threadDetailView`**, not through
 * a hand-built view. That is NAT-008's finding applied: fourteen render specs stayed green while
 * `postView` was broken, because they all constructed the view themselves.
 *
 * @module noodl-editor/tests-unit/nat-007/threadview-writes
 */
import type { MeResponse, Read, ThreadDetail, ThreadPost } from '@noodl-models/community/communityapi';
import { composeThreadView, postedNote, threadDetailView } from '@noodl-models/community/threadview';
import type { AcceptOffer } from '@noodl-models/community/threadwrites';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const noop = () => undefined;

function post(over: Partial<ThreadPost> = {}): ThreadPost {
  return {
    id: 'p1',
    authorHandle: 'rosborne',
    blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'hello' }] }],
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    accepted: false,
    attachments: [],
    ...over
  };
}

function thread(over: Partial<ThreadDetail> = {}): ThreadDetail {
  return {
    id: 't1',
    section: 'help',
    title: 'Why does my For Each render one row?',
    authorHandle: 'rosborne',
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    replyCount: 1,
    accepted: false,
    acceptedPostId: null,
    firstReplyMinutes: 41,
    question: post(),
    answers: [post({ id: 'p2', authorHandle: 'ada' })],
    ...over
  };
}

const me = (handle: string | null): Read<MeResponse> => ({
  outcome: 'ok',
  value: {
    viewer: handle ? { handle, kind: 'individual' } : null,
    community: { surface: 'present', capabilities: {} }
  } as MeResponse
});

const offer: AcceptOffer = { pendingPostId: null, failure: null, onAccept: noop };

function ready(over: {
  thread?: ThreadDetail;
  me?: Read<MeResponse>;
  accept?: AcceptOffer | null;
  posted?: { at: number; postId: string } | null;
} = {}) {
  const value = over.thread ?? thread();
  const state = composeThreadView({
    me: over.me ?? me('rosborne'),
    read: { outcome: 'ok', value },
    now: NOW,
    accept: over.accept === undefined ? offer : over.accept,
    posted: over.posted ?? null
  });
  if (state.state !== 'ready') throw new Error(`expected ready, got ${state.state}`);
  return state;
}

describe('AC6 — the verb reaches a post through the real view builder', () => {
  it('puts it on every answer and never on the question', () => {
    const view = ready({
      thread: thread({ answers: [post({ id: 'p2', authorHandle: 'ada' }), post({ id: 'p3', authorHandle: 'grace' })] })
    }).thread;
    expect(view.question.accept).toBeNull();
    expect(view.answers.map((a) => a.accept?.label)).toEqual(['Accept this answer', 'Accept this answer']);
  });

  it('draws none of them for a viewer who is not the asker', () => {
    const view = ready({ me: me('ada') }).thread;
    expect(view.answers.every((a) => a.accept === null)).toBe(true);
  });

  it('asks “am I the asker” ONCE per thread, so every answer gets the same answer', () => {
    // ⚠️ A regression here would be a list where one answer carries the verb and the rest do not.
    const view = ready({
      thread: thread({ answers: [post({ id: 'p2' }), post({ id: 'p3' }), post({ id: 'p4' })] })
    }).thread;
    const drawn = view.answers.map((a) => a.accept !== null);
    expect(new Set(drawn).size).toBe(1);
    expect(drawn[0]).toBe(true);
  });

  it('draws nothing at all when the host wired no accept — the read-only surface is unchanged', () => {
    const view = ready({ accept: null }).thread;
    expect(view.question.accept).toBeNull();
    expect(view.answers.every((a) => a.accept === null)).toBe(true);
  });

  it('is reachable from `threadDetailView` directly, which is what the render specs call', () => {
    const view = threadDetailView(thread(), NOW, { accept: offer, viewerIsAsker: true });
    expect(view.answers[0].accept).not.toBeNull();
  });
});

describe('AC4 — the copy that predates the answer, which is the arm nobody would think of', () => {
  const posted = { at: NOW - 2 * MINUTE, postId: 'p9' };

  it('says nothing when this session has not posted', () => {
    expect(postedNote(null, { thread: thread(), at: NOW })).toBeNull();
  });

  it('says nothing once the answer is actually in the copy being drawn', () => {
    const withIt = thread({ answers: [post({ id: 'p2' }), post({ id: 'p9', authorHandle: 'rosborne' })] });
    expect(postedNote(posted, { thread: withIt, at: NOW })).toBeNull();
  });

  it('🔴 explains the gap when the copy was taken BEFORE the post', () => {
    const line = postedNote(posted, { thread: thread(), at: posted.at - MINUTE });
    expect(line).toContain('was posted');
    expect(line).toContain('taken before it');
  });

  it('🔴 says something DIFFERENT when a copy taken after it still does not list it', () => {
    // The case a timestamp comparison alone would call fine: the read landed after the write and
    // came back without the answer in it. Fresh copy, no banner, no answer, nothing to read.
    const line = postedNote(posted, { thread: thread(), at: posted.at + MINUTE });
    expect(line).toContain('has not listed it yet');
  });

  it('reaches the live arm too, not only the cached one', () => {
    const state = ready({ posted });
    expect(state.cachedSince).toBeNull();
    expect(state.postedNote).toContain('has not listed it yet');
  });

  it('rides on the cached arm beside the age banner, not instead of it', () => {
    const state = composeThreadView({
      me: me('rosborne'),
      read: { outcome: 'unreachable', status: null, detail: 'offline' },
      cached: { thread: thread(), at: NOW - 10 * MINUTE },
      posted: { at: NOW - 2 * MINUTE, postId: 'p9' },
      now: NOW
    });
    if (state.state !== 'ready') throw new Error(`expected ready, got ${state.state}`);
    // 🔴 BOTH. The banner alone is a true sentence that leaves the screen a lie; this note alone
    // would leave a reader thinking they are looking at a live thread.
    expect(state.cachedSince).not.toBeNull();
    expect(state.postedNote).toContain('taken before it');
  });

  it('never contradicts the age banner: a cached copy that HAS the answer says nothing', () => {
    const withIt = thread({ answers: [post({ id: 'p9', authorHandle: 'rosborne' })] });
    const state = composeThreadView({
      me: me('rosborne'),
      read: { outcome: 'unreachable', status: null, detail: 'offline' },
      cached: { thread: withIt, at: NOW - MINUTE },
      posted: { at: NOW - 2 * MINUTE, postId: 'p9' },
      now: NOW
    });
    if (state.state !== 'ready') throw new Error('expected ready');
    expect(state.cachedSince).not.toBeNull();
    expect(state.postedNote).toBeNull();
  });

  it('🔴 D15 still wins over all of it — a refused viewer who posted somehow is still drawn nothing', () => {
    const state = composeThreadView({
      me: {
        outcome: 'ok',
        value: { viewer: { handle: 'pupil', kind: 'org_minor' }, community: { surface: 'absent', reason: 'policy' } } as MeResponse
      },
      read: { outcome: 'ok', value: thread() },
      posted: { at: NOW, postId: 'p9' },
      accept: offer,
      now: NOW
    });
    expect(state.state).toBe('hidden');
  });
});
