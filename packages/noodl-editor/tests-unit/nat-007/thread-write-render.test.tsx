/**
 * NAT-007 AC4/AC6 — what a thread with a write on it actually DRAWS.
 *
 * ## Why this is separate from `threadwrites.test.ts`
 *
 * That file grades the sentences. This one answers the questions a sentence cannot: *is there a
 * text box*, *is the verb disabled*, *did the typed text survive the failure on screen rather than
 * only in the view model*, *did the accept verb land under the answer it is about*. Two of the
 * assertions here are about drawing **nothing**, which source analysis cannot see at all —
 * `renderElements.ts` calls the component and walks what came back.
 *
 * ⚠️ What it still cannot see: focus, effects, layout, paint. The composer's placement in a 320px
 * rail is a drive, not a spec.
 *
 * @module noodl-editor/tests-unit/nat-007/thread-write-render
 */
import React from 'react';

import {
  CommunityThreadView,
  type CommunityPostView,
  type CommunityReplyBox,
  type CommunityThreadDetailView,
  type CommunityThreadState
} from '@noodl-core-ui/components/community';

import { byClass, render, text, walk } from '../support/renderElements';

const noop = () => undefined;

function post(over: Partial<CommunityPostView> = {}): CommunityPostView {
  return {
    id: 'p1',
    author: '@rosborne',
    when: '3 days ago',
    accepted: false,
    blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'The repeater draws one row.' }] }],
    attachments: [],
    ...over
  };
}

function detail(over: Partial<CommunityThreadDetailView> = {}): CommunityThreadDetailView {
  return {
    title: 'Why does my For Each render one row?',
    meta: '@rosborne · 3 days ago · answered in 41 min',
    question: post(),
    answers: [post({ id: 'p2', author: '@ada', when: '2 days ago' })],
    answersLine: '1 answer',
    ...over
  };
}

const composer = (over: Partial<Extract<CommunityReplyBox, { kind: 'composer' }>> = {}): CommunityReplyBox => ({
  kind: 'composer',
  label: 'Your answer',
  placeholder: 'Answer this question.',
  value: '',
  onChange: noop,
  onSubmit: noop,
  submitLabel: 'Post answer',
  canSubmit: false,
  blockedReason: null,
  busy: false,
  error: null,
  note: null,
  ...over
});

function draw(state: CommunityThreadState, reply?: CommunityReplyBox | null) {
  return render(<CommunityThreadView state={state} onBack={noop} onRetry={noop} reply={reply} />);
}

const readyWith = (over: Partial<CommunityThreadDetailView> = {}, extra: Partial<Extract<CommunityThreadState, { state: 'ready' }>> = {}) =>
  ({ state: 'ready', thread: detail(over), cachedSince: null, ...extra } as CommunityThreadState);

// ── AC4 ───────────────────────────────────────────────────────────────────────────────────

describe('AC4 — there is a box on the screen, and it belongs to the person typing in it', () => {
  const tree = draw(readyWith(), composer({ value: 'the repeater needs an array' }));

  it('draws a textarea, not a link to a browser', () => {
    expect(byClass(tree, 'ReplyInput').map((n) => n.type)).toEqual(['textarea']);
  });

  it('shows what has been typed', () => {
    expect(byClass(tree, 'ReplyInput')[0].props.value).toBe('the repeater needs an array');
  });

  it('has a real label pointing at the field, not a placeholder standing in for one', () => {
    const label = byClass(tree, 'ReplyLabel')[0];
    const field = byClass(tree, 'ReplyInput')[0];
    expect(label.type).toBe('label');
    expect(label.props.htmlFor).toBe(field.props.id);
    expect(String(field.props.id ?? '')).not.toBe('');
  });

  it('draws the verb', () => {
    expect(byClass(tree, 'ReplySubmit')[0].ownText).toBe('Post answer');
  });
});

describe('AC4 — the verb refuses when the host says it must', () => {
  it('is disabled with nothing typed, and says nothing about it', () => {
    const tree = draw(readyWith(), composer({ canSubmit: false, blockedReason: null }));
    expect(byClass(tree, 'ReplySubmit')[0].props.disabled).toBe(true);
    expect(byClass(tree, 'ReplyBlocked')).toHaveLength(0);
  });

  it('is disabled WITH a reason when there is one to give', () => {
    const tree = draw(readyWith(), composer({ canSubmit: false, blockedReason: 'That is 3 characters over.' }));
    expect(byClass(tree, 'ReplySubmit')[0].props.disabled).toBe(true);
    expect(byClass(tree, 'ReplyBlocked')[0].ownText).toBe('That is 3 characters over.');
  });

  it('is live when the host says the draft is sendable', () => {
    const tree = draw(readyWith(), composer({ canSubmit: true, value: 'x' }));
    expect(byClass(tree, 'ReplySubmit')[0].props.disabled).toBe(false);
  });

  it('🔴 disables BOTH the verb and the box while sending, so one click cannot post twice', () => {
    const tree = draw(readyWith(), composer({ canSubmit: true, busy: true, submitLabel: 'Posting…' }));
    expect(byClass(tree, 'ReplySubmit')[0].props.disabled).toBe(true);
    expect(byClass(tree, 'ReplyInput')[0].props.disabled).toBe(true);
  });
});

describe('AC4 — a failed send says so and the text is still on the screen', () => {
  const tree = draw(
    readyWith(),
    composer({
      value: 'the repeater needs an array',
      canSubmit: true,
      error: 'The community could not be reached, so this was not posted. Your answer is still here.'
    })
  );

  it('draws the failure', () => {
    expect(byClass(tree, 'ReplyError')[0].ownText).toContain('could not be reached');
  });

  it('🔴 and the words are STILL IN THE BOX — the criterion, on the screen rather than in a type', () => {
    expect(byClass(tree, 'ReplyInput')[0].props.value).toBe('the repeater needs an array');
  });

  it('announces the failure, because a person who clicked and saw nothing has no other signal', () => {
    expect(byClass(tree, 'ReplyError')[0].props.role).toBe('alert');
  });

  it('draws no confirmation beside it', () => {
    expect(byClass(tree, 'ReplyNote')).toHaveLength(0);
  });
});

describe('AC4 — the hand-off arm survives, for a reader with no session', () => {
  const handoff: CommunityReplyBox = {
    kind: 'handoff',
    line: 'You are not signed in to the community, so an answer cannot be posted from the editor.',
    actionLabel: 'Answer on the web',
    onAction: noop
  };

  it('draws a sentence and a way out, and NO text box', () => {
    const tree = draw(readyWith(), handoff);
    expect(text(tree)).toContain('Answer on the web');
    expect(byClass(tree, 'ReplyInput')).toHaveLength(0);
  });

  it('🔴 and a host that passes nothing draws neither — an absence, with the composer as its control', () => {
    // Both arms out of one call with one field different: `null` here is also what a component
    // that never ran would produce, so the composer case above is what makes this mean anything.
    const nothing = draw(readyWith(), null);
    expect(byClass(nothing, 'ReplyInput')).toHaveLength(0);
    expect(byClass(nothing, 'ThreadReply')).toHaveLength(0);
    expect(byClass(draw(readyWith(), composer()), 'ThreadReply')).toHaveLength(1);
  });
});

describe('AC4 — the copy that predates the answer', () => {
  it('draws the note UNDER the age banner, and both are present', () => {
    const tree = draw(
      readyWith({}, {
        cachedSince: '4 minutes ago',
        postedNote: 'Your answer was posted. This copy was taken before it, so it is not in the list yet.'
      } as never)
    );
    expect(byClass(tree, 'ThreadCached')).toHaveLength(1);
    expect(byClass(tree, 'ThreadPosted')[0].ownText).toContain('taken before it');
  });

  it('draws nothing when there is nothing to say — the control for the row above', () => {
    const tree = draw(readyWith({}, { cachedSince: '4 minutes ago' } as never));
    expect(byClass(tree, 'ThreadCached')).toHaveLength(1);
    expect(byClass(tree, 'ThreadPosted')).toHaveLength(0);
  });
});

// ── AC6 ───────────────────────────────────────────────────────────────────────────────────

describe('AC6 — the accept verb is drawn under the answer it is about', () => {
  const accept = { label: 'Accept this answer', busyLabel: 'Accepting…', busy: false, onAccept: noop };

  it('draws one verb, under the one answer that carries it', () => {
    const tree = draw(
      readyWith({
        answers: [post({ id: 'p2', author: '@ada', accept }), post({ id: 'p3', author: '@grace' })]
      })
    );
    const buttons = byClass(tree, 'AcceptButton');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].ownText).toBe('Accept this answer');
  });

  it('🔴 draws NOTHING where the host gave no verb — the control is the row above', () => {
    const tree = draw(readyWith({ answers: [post({ id: 'p2', author: '@ada' })] }));
    expect(byClass(tree, 'AcceptButton')).toHaveLength(0);
  });

  it('puts the verb inside the post it belongs to, not in a toolbar at the top', () => {
    const tree = draw(readyWith({ answers: [post({ id: 'p2', author: '@ada', accept })] }));
    const posts = byClass(tree, 'Post');
    const answer = posts[posts.length - 1];
    expect(walk(answer).some((n) => String(n.props.className ?? '').includes('AcceptButton'))).toBe(true);
  });

  it('goes busy with its own label rather than vanishing', () => {
    const tree = draw(readyWith({ answers: [post({ id: 'p2', accept: { ...accept, busy: true } })] }));
    const button = byClass(tree, 'AcceptButton')[0];
    expect(button.ownText).toBe('Accepting…');
    expect(button.props.disabled).toBe(true);
  });

  it('draws the platform’s refusal beside the verb, and announces it', () => {
    const tree = draw(
      readyWith({
        answers: [post({ id: 'p2', accept: { ...accept, error: 'only the person who asked may accept an answer' } })]
      })
    );
    expect(byClass(tree, 'AcceptError')[0].ownText).toContain('only the person who asked');
    expect(byClass(tree, 'AcceptError')[0].props.role).toBe('alert');
  });

  it('is a real button, so a keyboard can reach it', () => {
    const tree = draw(readyWith({ answers: [post({ id: 'p2', accept })] }));
    expect(byClass(tree, 'AcceptButton')[0].type).toBe('button');
  });
});

describe('AC4/AC6 — neither write appears on a screen that is not showing a thread', () => {
  it('🔴 D15: a refused viewer gets no composer and no verb, because nothing is drawn at all', () => {
    expect(draw({ state: 'hidden' }, composer())).toBeNull();
    // The control: the same call with one field different draws a whole screen.
    expect(draw(readyWith(), composer())).not.toBeNull();
  });

  it('an unreachable thread offers no box to type an answer into', () => {
    const tree = draw({ state: 'unreachable', detail: 'offline' }, composer({ canSubmit: true, value: 'x' }));
    expect(byClass(tree, 'ReplyInput')).toHaveLength(0);
  });

  it('a thread the platform 404d offers none either', () => {
    expect(byClass(draw({ state: 'gone' }, composer()), 'ReplyInput')).toHaveLength(0);
  });
});
