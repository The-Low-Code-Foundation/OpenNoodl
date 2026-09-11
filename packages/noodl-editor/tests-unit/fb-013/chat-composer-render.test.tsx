/**
 * FB-013 — the composer and the reply box, as they are actually drawn.
 *
 * Same split `nat-007/thread-write-render.test.tsx` draws for the bench: `chatwrites.test.ts`
 * grades the sentences, this walks the component. Every view model here is built by the real
 * `chatwrites.ts` functions, never by a hand-made literal — see that file's own header for why.
 *
 * @module noodl-editor/tests-unit/fb-013/chat-composer-render
 */
import React from 'react';

import { CommunityChatThread, CommunityChatView, CommunityDensity, type CommunityChatComposerBox } from '@noodl-core-ui/components/community';
import { composeChat, composeChatThread } from '@noodl-models/community/chatview';
import { composeChatComposer, composeChatReplyBox } from '@noodl-models/community/chatwrites';
import type { ChatMessage, Read } from '@noodl-models/community/communityapi';
import type { PostBlock } from '@noodl-models/community/postbody';

import { byClass, render, text, walk } from '../support/renderElements';

const noop = () => undefined;
const para = (body: string): PostBlock[] => [{ kind: 'paragraph', inlines: [{ kind: 'text', text: body }] }];

const message = (id: string, channel: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  channel,
  authorHandle: `author-${id}`,
  blocks: para(`Body of ${id}`),
  replyCount: 0,
  createdAt: '2026-08-27T10:00:00.000Z',
  editedAt: null,
  ...extra
});

const ok = (items: ChatMessage[]): Read<ChatMessage[]> => ({ outcome: 'ok', value: items });

function drawRiverWith(composer: CommunityChatComposerBox | null) {
  return render(
    CommunityChatView({
      view: composeChat(ok([message('m1', 'lounge')]), null),
      density: CommunityDensity.Page,
      onSelectChannel: noop,
      onOpenThread: noop,
      onRetry: noop,
      composer
    }) as React.ReactNode
  );
}

// ── The starter, above the river ────────────────────────────────────────────────────────────

describe('the starter — signed in, above the river', () => {
  const composer = composeChatComposer({
    signedIn: true,
    channel: 'templates',
    draft: 'has anyone tried the new form template',
    sending: false,
    last: null,
    onChannelChange: noop,
    onChange: noop,
    onSubmit: noop,
    onHandoff: noop
  });
  const tree = drawRiverWith(composer);

  it('draws a channel select carrying all four channels', () => {
    const select = byClass(tree, 'ComposerSelect');
    expect(select).toHaveLength(1);
    expect(select[0].type).toBe('select');
    const options = walk(select[0]).filter((n) => n.type === 'option');
    expect(options.map((o) => o.props.value)).toEqual(['lounge', 'templates', 'tutorials', 'collab']);
  });

  it('selects the channel the host chose', () => {
    expect(byClass(tree, 'ComposerSelect')[0].props.value).toBe('templates');
  });

  it('draws a textarea holding the draft', () => {
    const box = byClass(tree, 'ReplyInput')[0];
    expect(box.type).toBe('textarea');
    expect(box.props.value).toBe('has anyone tried the new form template');
  });

  it('has a real label for both fields', () => {
    const labels = byClass(tree, 'ReplyLabel');
    expect(labels).toHaveLength(2);
    expect(labels.every((l) => l.type === 'label' && String(l.props.htmlFor ?? '') !== '')).toBe(true);
  });

  it('draws the verb, labelled to start something rather than to answer', () => {
    expect(byClass(tree, 'ReplySubmit')[0].ownText).toBe('Say something');
  });

  it('🔴 changing the select calls back with the option’s own key, not a guess', () => {
    const picked: string[] = [];
    const wired = drawRiverWith(
      composeChatComposer({
        signedIn: true,
        channel: 'lounge',
        draft: '',
        sending: false,
        last: null,
        onChannelChange: (key) => picked.push(key),
        onChange: noop,
        onSubmit: noop,
        onHandoff: noop
      })
    );
    const select = byClass(wired, 'ComposerSelect')[0];
    (select.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'collab' } });
    expect(picked).toEqual(['collab']);
  });

  it('sits above the filter pills — first channel option is the first control on the tree', () => {
    const order = walk(tree).map((n) => String(n.props.className ?? ''));
    const selectIndex = order.findIndex((c) => c.includes('ComposerSelect'));
    const pillIndex = order.findIndex((c) => c.includes('ChipRow'));
    expect(selectIndex).toBeGreaterThan(-1);
    expect(pillIndex).toBeGreaterThan(-1);
    expect(selectIndex).toBeLessThan(pillIndex);
  });
});

describe('the starter — refusal and busy states', () => {
  it('is disabled with nothing typed, and says nothing about it', () => {
    const tree = drawRiverWith(
      composeChatComposer({
        signedIn: true,
        channel: 'lounge',
        draft: '',
        sending: false,
        last: null,
        onChannelChange: noop,
        onChange: noop,
        onSubmit: noop,
        onHandoff: noop
      })
    );
    expect(byClass(tree, 'ReplySubmit')[0].props.disabled).toBe(true);
    expect(byClass(tree, 'ReplyBlocked')).toHaveLength(1); // the channel purpose sentence only
  });

  it('disables the box and the verb, and renames the verb, while sending', () => {
    const tree = drawRiverWith(
      composeChatComposer({
        signedIn: true,
        channel: 'lounge',
        draft: 'x',
        sending: true,
        last: null,
        onChannelChange: noop,
        onChange: noop,
        onSubmit: noop,
        onHandoff: noop
      })
    );
    expect(byClass(tree, 'ReplySubmit')[0].props.disabled).toBe(true);
    expect(byClass(tree, 'ReplyInput')[0].props.disabled).toBe(true);
    expect(byClass(tree, 'ComposerSelect')[0].props.disabled).toBe(true);
    expect(byClass(tree, 'ReplySubmit')[0].ownText).toBe('Posting…');
  });

  it('a failed post keeps the text on screen and announces the failure', () => {
    const tree = drawRiverWith(
      composeChatComposer({
        signedIn: true,
        channel: 'lounge',
        draft: 'still here',
        sending: false,
        last: { outcome: 'unreachable', status: null, detail: 'offline' },
        onChannelChange: noop,
        onChange: noop,
        onSubmit: noop,
        onHandoff: noop
      })
    );
    expect(byClass(tree, 'ReplyInput')[0].props.value).toBe('still here');
    expect(byClass(tree, 'ReplyError')[0].props.role).toBe('alert');
  });
});

describe('the starter — signed out gets a hand-off, no select and no text box', () => {
  it('draws a sentence and a way out', () => {
    const tree = drawRiverWith(
      composeChatComposer({
        signedIn: false,
        channel: 'lounge',
        draft: '',
        sending: false,
        last: null,
        onChannelChange: noop,
        onChange: noop,
        onSubmit: noop,
        onHandoff: noop
      })
    );
    expect(text(tree)).toContain('Say something on the web');
    expect(byClass(tree, 'ComposerSelect')).toHaveLength(0);
    expect(byClass(tree, 'ReplyInput')).toHaveLength(0);
  });

  it('a host that wires no composer at all draws neither', () => {
    const tree = drawRiverWith(null);
    expect(byClass(tree, 'ComposerSelect')).toHaveLength(0);
    expect(byClass(tree, 'ReplyInput')).toHaveLength(0);
  });
});

// ── The reply, under an open thread ─────────────────────────────────────────────────────────

function drawThreadWith(replyBox: ReturnType<typeof composeChatReplyBox> | null) {
  const view = composeChatThread({
    root: message('root', 'lounge', { blocks: para('Hello everyone.') }),
    replies: [message('r1', 'lounge')]
  });
  return render(
    CommunityChatThread({
      state: { state: 'open', ...view },
      density: CommunityDensity.Page,
      onBack: noop,
      onRetry: noop,
      reply: replyBox
    }) as React.ReactNode
  );
}

describe('the reply — signed in, under the replies', () => {
  const reply = composeChatReplyBox({
    signedIn: true,
    draft: 'agreed',
    sending: false,
    last: null,
    onChange: noop,
    onSubmit: noop,
    onHandoff: noop
  });
  const tree = drawThreadWith(reply);

  it('draws a textarea holding the draft, and NO channel select', () => {
    const box = byClass(tree, 'ReplyInput')[0];
    expect(box.type).toBe('textarea');
    expect(box.props.value).toBe('agreed');
    expect(byClass(tree, 'ComposerSelect')).toHaveLength(0);
  });

  it('draws the verb, labelled to reply', () => {
    expect(byClass(tree, 'ReplySubmit')[0].ownText).toBe('Reply');
  });

  it('sits after the replies that are drawn', () => {
    const order = walk(tree).map((n) => String(n.props.className ?? ''));
    const lastMessage = order.map((c, i) => (c.includes('Message') ? i : -1)).filter((i) => i > -1).pop() ?? -1;
    const replyBoxIndex = order.findIndex((c) => c.includes('ReplyInput'));
    expect(lastMessage).toBeGreaterThan(-1);
    expect(replyBoxIndex).toBeGreaterThan(lastMessage);
  });
});

describe('the reply — signed out gets a hand-off', () => {
  it('draws a sentence and a way out, and no text box', () => {
    const reply = composeChatReplyBox({
      signedIn: false,
      draft: '',
      sending: false,
      last: null,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    const tree = drawThreadWith(reply);
    expect(text(tree)).toContain('Reply on the web');
    expect(byClass(tree, 'ReplyInput')).toHaveLength(0);
  });

  it('a host that wires no reply box draws neither', () => {
    const tree = drawThreadWith(null);
    expect(byClass(tree, 'ReplyInput')).toHaveLength(0);
    expect(text(tree)).not.toContain('Reply on the web');
  });
});

