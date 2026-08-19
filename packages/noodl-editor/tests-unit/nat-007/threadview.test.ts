/**
 * NAT-007 — the words a thread says, and which of the six states it is in.
 *
 * ## Why the interesting half of this task is specced here rather than over the element tree
 *
 * NAT-005 established that this runner CAN walk a React tree, and `thread-render.test.ts` does.
 * That answers *"did the string appear"*. It cannot answer *"is it the right string for three
 * withheld ports rather than for one"*, and it cannot enumerate the branches of
 * {@link composeThreadView} without building six prop objects to reach six lines of logic.
 *
 * 🔴 **The branch order in `composeThreadView` is the argument of this task**, and it is graded
 * here one branch at a time: D15 before the fetch, a live read before a cached one, `loading`
 * before the cache, and the never-opened case kept apart from the unanswered one.
 *
 * @module noodl-editor/tests-unit/nat-007/threadview
 */
import type { MeResponse, Read, ThreadAttachment, ThreadDetail } from '@noodl-models/community/communityapi';
import {
  answersLine,
  attachmentFacts,
  attachmentHeading,
  attachmentPorts,
  composeThreadView,
  threadDetailView,
  withheldLine
} from '@noodl-models/community/threadview';

const NOW = Date.parse('2026-08-19T12:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function post(over: Partial<ThreadDetail['question']> = {}): ThreadDetail['question'] {
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
    answers: [post({ id: 'p2', authorHandle: 'ada', createdAt: new Date(NOW - 2 * DAY).toISOString() })],
    ...over
  };
}

const PRESENT: Read<MeResponse> = {
  outcome: 'ok',
  value: { viewer: { handle: 'rosborne', kind: 'individual' }, community: { surface: 'present', capabilities: {} } }
};
const REFUSED: Read<MeResponse> = {
  outcome: 'ok',
  value: { viewer: { handle: 'pupil', kind: 'org_minor' }, community: { surface: 'absent', reason: 'policy' } }
};

const attachment = (over: Partial<ThreadAttachment> = {}): ThreadAttachment => ({
  id: 'a1',
  kind: 'node_excerpt',
  payload: {},
  note: null,
  facets: { nodeType: 'For Each', appVersion: '0.1.7', os: 'darwin arm64 (24.5.0)', warningCode: null, portsWithheld: 0 },
  ...over
});

describe('the heading over the answers', () => {
  it('does not say "0 answers"', () => {
    // 🔴 The row a person opened the editor hoping to change. A count of zero reads as a system
    // state; this reads as an invitation, and the health readout counts the same thread as
    // `unreplied`.
    expect(answersLine(0)).toBe('No answers yet — you could be the first.');
    expect(answersLine(0)).not.toMatch(/\b0\b/);
  });

  it('counts, and gets the singular right', () => {
    expect(answersLine(1)).toBe('1 answer');
    expect(answersLine(4)).toBe('4 answers');
  });

  it('counts what will be DRAWN, not what the payload claims', () => {
    // ⚠️ The two disagree the moment moderation hides a post: `replyCount` is over rows and
    // `answers` is over visible ones. A heading saying "3 answers" above two of them sends a
    // reader looking for a third that is not coming.
    const view = threadDetailView(thread({ replyCount: 3, answers: [post({ id: 'p2' })] }), NOW);
    expect(view.answersLine).toBe('1 answer');
  });
});

describe('an attachment, in words', () => {
  it('never prints the wire kind, not even for one it does not know', () => {
    expect(attachmentHeading('node_excerpt')).toBe('Node excerpt');
    expect(attachmentHeading('capture')).toBe('Screenshot');
    expect(attachmentHeading('graph_fragment')).toBe('Graph fragment');
    expect(attachmentHeading('lesson_step')).toBe('Lesson step');
    // A database column's spelling, in a sentence somebody is trying to read.
    expect(attachmentHeading('some_future_kind')).toBe('Attachment');
    expect(attachmentHeading('')).toBe('Attachment');
  });

  it('reads the facets, which the platform derives, and not the payload', () => {
    const a = attachment({ payload: { nodeType: 'Something Else' } });
    expect(attachmentFacts(a)).toEqual(['For Each', '0.1.7', 'darwin arm64 (24.5.0)']);
    expect(attachmentFacts(a)).not.toContain('Something Else');
  });

  it('drops facets the platform had nothing for', () => {
    expect(attachmentFacts(attachment({ facets: { ...attachment().facets, os: null, appVersion: '  ' } }))).toEqual([
      'For Each'
    ]);
  });

  it('tells a shared-and-empty port apart from a withheld one', () => {
    const ports = attachmentPorts(
      attachment({
        payload: {
          ports: [
            { name: 'Items', direction: 'input', value: '[]' },
            { name: 'Count', direction: 'output', value: null },
            { name: 'no direction given', value: 'x' },
            { direction: 'input', value: 'nameless' }
          ]
        }
      })
    );
    expect(ports).toEqual([
      { name: 'Items', direction: 'input', value: '[]' },
      { name: 'Count', direction: 'output', value: '(empty)' },
      { name: 'no direction given', direction: 'input', value: 'x' }
    ]);
  });

  it('describes the redaction from the count the DATABASE generated', () => {
    // 🔴 `ports_withheld` is a generated column over the payload's array, so a sender cannot
    // understate it and this editor is not trusted to recount it.
    expect(withheldLine(attachment({ facets: { ...attachment().facets, portsWithheld: 0 } }))).toBeNull();
    expect(withheldLine(attachment({ facets: { ...attachment().facets, portsWithheld: 1 } }))).toBe(
      '1 port value was not shared.'
    );
    expect(withheldLine(attachment({ facets: { ...attachment().facets, portsWithheld: 3 } }))).toBe(
      '3 port values were not shared.'
    );
  });

  it('control: an invisible redaction is the failure this line exists to prevent', () => {
    // The whole point of the line. If it ever returned null for a withheld port, an answerer
    // would spend a reply asking for what was deliberately held back.
    const withheld = attachment({ facets: { ...attachment().facets, portsWithheld: 2 } });
    expect(withheldLine(withheld)).not.toBeNull();
  });
});

describe('a post, as a view', () => {
  it('carries the author, the time and the accepted state of every post in order', () => {
    const view = threadDetailView(
      thread({
        answers: [
          post({ id: 'p2', authorHandle: 'ada', createdAt: new Date(NOW - 2 * DAY).toISOString(), accepted: true }),
          post({ id: 'p3', authorHandle: 'grace', createdAt: new Date(NOW - HOUR).toISOString() })
        ]
      }),
      NOW
    );
    expect(view.question.author).toBe('@rosborne');
    expect(view.question.when).toBe('3 days ago');
    expect(view.answers.map((a) => [a.id, a.author, a.when, a.accepted])).toEqual([
      ['p2', '@ada', '2 days ago', true],
      ['p3', '@grace', '1 hour ago', false]
    ]);
  });

  it('draws "someone" rather than a bare @ for a payload with no handle', () => {
    expect(threadDetailView(thread({ question: post({ authorHandle: '' }) }), NOW).question.author).toBe('someone');
  });

  it('draws no time rather than a wrong one', () => {
    // NAT-006's finding, from the other end: the failure is not a throw, it is `NaN` reaching a
    // reader as words.
    const view = threadDetailView(thread({ question: post({ createdAt: 'not a date' }) }), NOW);
    expect(view.question.when).toBeNull();
  });

  it('reads Postgres’s own timestamp spelling as the SAME INSTANT as the ISO one', () => {
    // 🔴 NAT-006's finding reaching this surface: a `Date` column arrives as
    // `2026-08-19 18:58:53.754123+00` on some pooled connections. The claim worth grading is not
    // that the string parses — it is that the two spellings of one instant produce one answer,
    // because a client that read the space-separated form as LOCAL time would be silently three
    // hours out on a European laptop and exactly right in CI.
    const raw = '2026-08-16 12:00:00.000000+00';
    const iso = '2026-08-16T12:00:00.000Z';
    const fromRaw = threadDetailView(thread({ question: post({ createdAt: raw }) }), NOW).question.when;
    const fromIso = threadDetailView(thread({ question: post({ createdAt: iso }) }), NOW).question.when;

    expect(fromRaw).toBe(fromIso);
    expect(fromRaw).toBe('3 days ago');
  });
});

describe('which state the screen is in', () => {
  it('D15 refuses, and it is decided on `me` before any thread is fetched', () => {
    // 🔴 The refusal is a fact about the VIEWER. The platform answers 404 both for "removed" and
    // for "not for you", identically and on purpose, so a client deciding `hidden` from a
    // thread's own 404 would be right sometimes and blank-screen everybody else.
    expect(composeThreadView({ me: REFUSED, read: { outcome: 'ok', value: thread() }, now: NOW })).toEqual({
      state: 'hidden'
    });
  });

  it('control: the same call with a permitted viewer draws the thread', () => {
    // Without this, `hidden` passes just as well for a compose that always returned it.
    const state = composeThreadView({ me: PRESENT, read: { outcome: 'ok', value: thread() }, now: NOW });
    expect(state.state).toBe('ready');
  });

  it('a live read carries no cache banner', () => {
    const state = composeThreadView({
      me: PRESENT,
      read: { outcome: 'ok', value: thread() },
      cached: { thread: thread(), at: NOW - DAY },
      now: NOW
    });
    expect(state).toMatchObject({ state: 'ready', cachedSince: null });
  });

  it('a 404 for a viewer the community IS shown to is "gone", not "hidden"', () => {
    expect(composeThreadView({ me: PRESENT, read: { outcome: 'absent' }, now: NOW })).toEqual({ state: 'gone' });
  });

  it('AC8: a failed read with a copy shows the copy and says how old it is', () => {
    const state = composeThreadView({
      me: PRESENT,
      read: { outcome: 'unreachable', status: null, detail: 'offline' },
      cached: { thread: thread(), at: NOW - 2 * HOUR },
      now: NOW
    });
    expect(state).toMatchObject({ state: 'ready', cachedSince: '2 hours ago' });
    expect((state as { thread: { answersLine: string } }).thread.answersLine).toBe('1 answer');
  });

  it('AC8: a failed read with NO copy says it needs the network', () => {
    const state = composeThreadView({
      me: PRESENT,
      read: { outcome: 'unreachable', status: null, detail: 'offline' },
      cached: null,
      now: NOW
    });
    // 🔴 Its own state, so no renderer can accidentally draw it as a thread with no answers —
    // which is the one thing a person offline must not be told.
    expect(state).toEqual({ state: 'unreachable', detail: 'offline' });
    expect(JSON.stringify(state)).not.toContain('No answers yet');
  });

  it('loading beats the cache, because `cachedSince` claims the read FAILED', () => {
    // ⚠️ Showing the stale banner while a request is in flight puts a sentence on screen that is
    // not true yet.
    expect(
      composeThreadView({ me: PRESENT, read: undefined, cached: { thread: thread(), at: NOW - DAY }, now: NOW })
    ).toEqual({ state: 'loading' });
  });

  it('an unreachable `me` does not hide the thread', () => {
    // Same posture as `composeMirror`: hiding on a network failure would make a flaky connection
    // look like a school policy, which is the one confusion D15 cannot afford.
    const state = composeThreadView({
      me: { outcome: 'unreachable', status: null, detail: 'offline' },
      read: { outcome: 'ok', value: thread() },
      now: NOW
    });
    expect(state.state).toBe('ready');
  });

  it('the pull offer is asked per attachment, and null draws no verb', () => {
    const state = composeThreadView({
      me: PRESENT,
      read: {
        outcome: 'ok',
        value: thread({
          question: post({
            attachments: [attachment({ id: 'a1', kind: 'graph_fragment' }), attachment({ id: 'a2', kind: 'capture' })]
          })
        })
      },
      now: NOW,
      pullFor: (a) => (a.kind === 'graph_fragment' ? { label: 'Add to my project', onPull: () => undefined } : null)
    });
    const attachments = (state as { thread: { question: { attachments: { id: string; pull: unknown }[] } } }).thread
      .question.attachments;
    expect(attachments.map((a) => [a.id, a.pull === null ? 'no verb' : 'verb'])).toEqual([
      ['a1', 'verb'],
      ['a2', 'no verb']
    ]);
  });
});
