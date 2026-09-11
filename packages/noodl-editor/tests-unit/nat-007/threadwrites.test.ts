/**
 * NAT-007 AC4/AC6 — the two writes, graded where their decisions live.
 *
 * ## What this file is for, and what `thread-write-render.test.tsx` is for
 *
 * Every criterion in AC4 is a claim about a **sentence** or about **what happens to somebody's
 * typed text**, and both are decided here rather than in the component: which of four failures
 * happened, whether a draft may be sent at all, whether a verb is drawn under one post and not
 * another. The element-tree spec beside this one answers the other question — *did the screen
 * actually place them* — and neither substitutes for the other. NAT-008 paid for that split with
 * a hole: fourteen render specs stayed green while the function that built their view model was
 * broken, because every one of them built the view by hand.
 *
 * 🔴 So the rule this file follows: **assert on what the production functions return**, never on
 * a fixture shaped like what they return.
 *
 * @module noodl-editor/tests-unit/nat-007/threadwrites
 */
import type { AnswerAccepted, MeResponse, Read, ThreadDetail, ThreadPost, Write } from '@noodl-models/community/communityapi';
import {
  ANSWER_MAX_CHARACTERS,
  ANSWER_POSTED_LINE,
  acceptFailureLine,
  acceptFor,
  answerFailureLine,
  answerLength,
  canSendAnswer,
  composeReplyBox,
  draftRefusal,
  isAsker,
  type AcceptOffer
} from '@noodl-models/community/threadwrites';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');
const DAY = 24 * 3_600_000;
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

const me = (handle: string | null, surface: 'present' | 'absent' = 'present'): Read<MeResponse> => ({
  outcome: 'ok',
  value: {
    viewer: handle ? { handle, kind: 'individual' } : null,
    community: surface === 'present' ? { surface: 'present', capabilities: {} } : { surface: 'absent', reason: 'policy' }
  } as MeResponse
});

const offer = (over: Partial<AcceptOffer> = {}): AcceptOffer => ({
  pendingPostId: null,
  failure: null,
  onAccept: noop,
  ...over
});

// ── AC4: what may be sent ─────────────────────────────────────────────────────────────────

describe('AC4 — the cap is the platform’s, and it counts what the platform counts', () => {
  it('counts the TRIMMED length, because `bench_post_body_shape` checks `btrim(body)`', () => {
    expect(answerLength('  hello  ')).toBe(5);
  });

  it('refuses a draft of nothing but whitespace, rather than letting the platform 400 it', () => {
    // 🔴 The red-verification case: counting `draft.length` here passes every other test in this
    // file and sends "   " to a database constraint that measures 0.
    expect(canSendAnswer('   \n\t ')).toBe(false);
  });

  it('allows a draft exactly at the cap, because the constraint is `between 1 and 8000`', () => {
    expect(canSendAnswer('x'.repeat(ANSWER_MAX_CHARACTERS))).toBe(true);
  });

  it('refuses one character past it', () => {
    expect(canSendAnswer('x'.repeat(ANSWER_MAX_CHARACTERS + 1))).toBe(false);
  });

  it('says nothing about an empty box — the disabled verb beside it is the explanation', () => {
    expect(draftRefusal('')).toBeNull();
    expect(draftRefusal('   ')).toBeNull();
  });

  it('says how far over, because neither the limit nor the count is on screen', () => {
    expect(draftRefusal('x'.repeat(ANSWER_MAX_CHARACTERS + 412))).toBe(
      `That is 412 characters over the community's limit of ${ANSWER_MAX_CHARACTERS}.`
    );
  });

  it('says “1 character”, not “1 characters”', () => {
    expect(draftRefusal('x'.repeat(ANSWER_MAX_CHARACTERS + 1))).toContain('1 character over');
  });
});

// ── AC4: what a failure says ──────────────────────────────────────────────────────────────

describe('AC4 — a reply that fails to send says so AND keeps the text', () => {
  const failures: Write<AnswerAccepted>[] = [
    { outcome: 'unauthenticated' },
    { outcome: 'absent' },
    { outcome: 'refused', detail: 'the title or body is the wrong length.' },
    { outcome: 'unreachable', status: null, detail: 'TypeError: fetch failed' }
  ];

  it('has a distinct sentence for each of the four, because each has a different fix', () => {
    const lines = failures.map((write) => answerFailureLine(write));
    expect(lines.every((line) => typeof line === 'string' && line.length > 0)).toBe(true);
    expect(new Set(lines).size).toBe(failures.length);
  });

  it('tells the person their text is still there — in EVERY arm', () => {
    // 🔴 The criterion in one assertion. A reader looking at a red line does not necessarily look
    // at the box under it, so the sentence has to carry the reassurance rather than the layout.
    for (const write of failures) {
      expect(answerFailureLine(write)).toContain('still here');
    }
  });

  it('quotes the platform’s own words on a refusal rather than substituting its own', () => {
    expect(answerFailureLine({ outcome: 'refused', detail: 'this account may not post.' })).toContain(
      'this account may not post.'
    );
  });

  it('does NOT narrate a door on a 404 — `absent` says the thread is gone, not that you lack permission', () => {
    const line = answerFailureLine({ outcome: 'absent' }) ?? '';
    expect(line).toContain('not available');
    // `docs/API.md` §4: a client may never render a permission from a 404.
    expect(line.toLowerCase()).not.toContain('permission');
    expect(line.toLowerCase()).not.toContain('allowed');
  });

  it('says nothing at all for a success', () => {
    expect(answerFailureLine({ outcome: 'ok', value: { postId: 'p9', pointsAwarded: 2 } })).toBeNull();
  });
});

// ── AC4: the box itself ───────────────────────────────────────────────────────────────────

describe('AC4 — the composer, and the hand-off it did not replace', () => {
  const inputs = (over: Partial<Parameters<typeof composeReplyBox>[0]> = {}) =>
    composeReplyBox({
      signedIn: true,
      draft: '',
      sending: false,
      last: null,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop,
      ...over
    });

  it('is a labelled hand-off when there is no session — not a composer that would 401', () => {
    const box = inputs({ signedIn: false });
    expect(box.kind).toBe('handoff');
  });

  it('is a composer when there is one — D5 settled', () => {
    expect(inputs().kind).toBe('composer');
  });

  it('hands the draft straight back, so a failed send cannot lose it', () => {
    const box = inputs({ draft: 'the repeater needs an array', last: { outcome: 'unreachable', status: null, detail: 'x' } });
    if (box.kind !== 'composer') throw new Error('expected a composer');
    // 🔴 AC4's whole shape: an error AND the text, in the same object.
    expect(box.value).toBe('the repeater needs an array');
    expect(box.error).toContain('could not be reached');
  });

  it('refuses to submit an empty draft, and says nothing about it', () => {
    const box = inputs({ draft: '' });
    if (box.kind !== 'composer') throw new Error('expected a composer');
    expect(box.canSubmit).toBe(false);
    expect(box.blockedReason).toBeNull();
  });

  it('refuses an over-long draft AND says why — the case an empty box does not cover', () => {
    const box = inputs({ draft: 'x'.repeat(ANSWER_MAX_CHARACTERS + 3) });
    if (box.kind !== 'composer') throw new Error('expected a composer');
    expect(box.canSubmit).toBe(false);
    expect(box.blockedReason).toContain('3 characters over');
  });

  it('changes the verb while sending, so a person can see the click landed', () => {
    const idle = inputs();
    const busy = inputs({ sending: true });
    if (idle.kind !== 'composer' || busy.kind !== 'composer') throw new Error('expected composers');
    expect(busy.busy).toBe(true);
    expect(busy.submitLabel).not.toBe(idle.submitLabel);
  });

  it('confirms a send, and never says “posted” and “failed” at once', () => {
    const ok = inputs({ last: { outcome: 'ok', value: { postId: 'p9', pointsAwarded: 2 } } });
    const bad = inputs({ last: { outcome: 'unauthenticated' } });
    if (ok.kind !== 'composer' || bad.kind !== 'composer') throw new Error('expected composers');
    expect(ok.note).toBe(ANSWER_POSTED_LINE);
    expect(ok.error).toBeNull();
    expect(bad.note).toBeNull();
    expect(bad.error).not.toBeNull();
  });
});

// ── AC6: who may accept ───────────────────────────────────────────────────────────────────

describe('AC6 — “if you are the asker”, and the four ways that is answered no', () => {
  it('recognises the asker', () => {
    expect(isAsker(me('rosborne'), thread())).toBe(true);
  });

  it('does not mistake an answerer for the asker', () => {
    expect(isAsker(me('ada'), thread())).toBe(false);
  });

  it('ignores case, because the two handles arrive through different joins', () => {
    expect(isAsker(me('RosBorne'), thread())).toBe(true);
  });

  it('says no for a signed-out viewer rather than throwing on a null handle', () => {
    expect(isAsker(me(null), thread())).toBe(false);
    expect(isAsker(undefined, thread())).toBe(false);
  });

  it('says no when the thread payload carried no author handle — there is nobody to match', () => {
    expect(isAsker(me('rosborne'), thread({ authorHandle: '' }))).toBe(false);
  });
});

describe('AC6 — where the verb is drawn, and the four places it is not', () => {
  const askerOn = (t: ThreadDetail, p: ThreadPost, isQuestion = false, o: AcceptOffer | null = offer()) =>
    acceptFor({ thread: t, post: p, isQuestion, viewerIsAsker: true, offer: o });

  it('draws it on an answer, for the asker, on a thread with nothing accepted', () => {
    const verb = askerOn(thread(), post({ id: 'p2' }));
    expect(verb?.label).toBe('Accept this answer');
  });

  it('draws NOTHING on the question — the platform refuses that with `[bench-accept-question]`', () => {
    expect(askerOn(thread(), post(), true)).toBeNull();
  });

  it('draws NOTHING for somebody who did not ask — not a disabled verb with a reason', () => {
    // ⚠️ A greyed "Accept this answer" under a stranger's post reads as a permission they lost.
    // An answerer is not being refused anything; they have no business accepting.
    expect(acceptFor({ thread: thread(), post: post({ id: 'p2' }), isQuestion: false, viewerIsAsker: false, offer: offer() })).toBeNull();
  });

  it('draws NOTHING when the host wired no write at all', () => {
    expect(askerOn(thread(), post({ id: 'p2' }), false, null)).toBeNull();
  });

  it('draws NOTHING once an answer is accepted — moving an accept is unruled, so it is not offered', () => {
    // 🔴 The platform PERMITS it: `acceptAnswer` re-`update`s `accepted_post_id`. What it does not
    // do is revoke the first award or tell the first author they were unaccepted. A client is a
    // bad place to decide that silently.
    const settled = thread({ accepted: true, acceptedPostId: 'p2' });
    expect(askerOn(settled, post({ id: 'p3' }))).toBeNull();
    expect(askerOn(settled, post({ id: 'p2', accepted: true }))).toBeNull();
  });

  it('reads “already accepted” off the THREAD, not off the post it is drawing', () => {
    // A thread whose `acceptedPostId` names another post: `post.accepted` is false here and the
    // verb must still be gone.
    const settled = thread({ accepted: false, acceptedPostId: 'p2' });
    expect(askerOn(settled, post({ id: 'p3', accepted: false }))).toBeNull();
  });

  it('marks only the post being accepted as busy', () => {
    const pending = offer({ pendingPostId: 'p2' });
    expect(askerOn(thread(), post({ id: 'p2' }), false, pending)?.busy).toBe(true);
    expect(askerOn(thread(), post({ id: 'p3' }), false, pending)?.busy).toBe(false);
  });

  it('shows a refusal against the post it was about, and no other', () => {
    const failed = offer({ failure: { postId: 'p2', line: 'only the person who asked may accept an answer' } });
    expect(askerOn(thread(), post({ id: 'p2' }), false, failed)?.error).toContain('only the person who asked');
    expect(askerOn(thread(), post({ id: 'p3' }), false, failed)?.error).toBeNull();
  });

  it('has a busy label that differs from the idle one', () => {
    const verb = askerOn(thread(), post({ id: 'p2' }));
    expect(verb?.busyLabel).not.toBe(verb?.label);
  });

  it('calls the host with the post’s own id', () => {
    const calls: string[] = [];
    const verb = askerOn(thread(), post({ id: 'p7' }), false, offer({ onAccept: (id) => calls.push(id) }));
    verb?.onAccept();
    expect(calls).toEqual(['p7']);
  });
});

describe('AC6 — what a failed accept says', () => {
  it('carries the platform’s words on a refusal — that is where “only the asker” comes from', () => {
    expect(acceptFailureLine({ outcome: 'refused', detail: 'only the person who asked may accept an answer' })).toContain(
      'only the person who asked may accept an answer'
    );
  });

  it('does not promise anything about typed text, because there is none', () => {
    expect(acceptFailureLine({ outcome: 'unreachable', status: null, detail: 'x' })).not.toContain('still here');
  });

  it('says nothing for a success', () => {
    expect(acceptFailureLine({ outcome: 'ok', value: { pointsAwarded: 5 } })).toBeNull();
  });

  it('does not narrate a door on a 404 either', () => {
    const line = acceptFailureLine({ outcome: 'absent' })?.toLowerCase() ?? '';
    expect(line).not.toContain('permission');
    expect(line).not.toContain('allowed');
  });
});
