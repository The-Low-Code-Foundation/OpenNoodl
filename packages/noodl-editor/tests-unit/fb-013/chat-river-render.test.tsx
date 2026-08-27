/**
 * FB-013 C4 — the chat river, as it is actually drawn.
 *
 * ## 🔴 Why this exists beside `chatview.test.ts`
 *
 * That file grades the composer. This walks the component, because **a correct view model that
 * nothing hands to a renderer is the same screen as no fix at all** — FIX-025 §7 demonstrated it
 * three days ago with a mutant that severed only the last hop and left 29 unit specs green.
 *
 * ⚠️ **Every view model here is built by the REAL composer**, never by a literal. A hand-made
 * `CommunityChatViewModel` type-checks while agreeing with nothing, and would keep passing after
 * `composeChat` stopped producing it.
 *
 * 🔴 **What this cannot see**: no DOM, no effects, no paint — see `support/renderElements`. It
 * asserts what reached the tree and what each control was wired to; that the pills are clickable
 * in a running editor is established by the drive, not here.
 *
 * @module noodl-editor/tests-unit/fb-013/chat-river-render
 */
import React from 'react';

import { CommunityChatThread, CommunityChatView, CommunityDensity } from '@noodl-core-ui/components/community';
import { composeChat, composeChatThread } from '@noodl-models/community/chatview';
import type { ChatMessage, Read } from '@noodl-models/community/communityapi';
import type { PostBlock } from '@noodl-models/community/postbody';

import { byClass, render, text, walk } from '../support/renderElements';

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

const RIVER = [
  message('m1', 'lounge', { replyCount: 2 }),
  message('m2', 'templates'),
  message('m3', 'lounge')
];

const noop = () => undefined;

function drawRiver(
  chosen: string | null,
  handlers: { onSelectChannel?: (key: string) => void; onOpenThread?: (id: string) => void } = {},
  river: ChatMessage[] = RIVER
) {
  return render(
    CommunityChatView({
      view: composeChat(ok(river), chosen),
      density: CommunityDensity.Page,
      onSelectChannel: handlers.onSelectChannel ?? noop,
      onOpenThread: handlers.onOpenThread ?? noop,
      onRetry: noop
    }) as React.ReactNode
  );
}

const testIds = (tree: ReturnType<typeof render>) =>
  walk(tree)
    .map((n) => String(n.props['data-test'] ?? ''))
    .filter(Boolean);

describe('FB-013 C4 — the river reaches the screen', () => {
  const tree = drawRiver(null);

  it('draws a row per message, with its author and its channel', () => {
    expect(byClass(tree, 'Message')).toHaveLength(3);
    const shown = text(tree);
    expect(shown).toContain('@author-m1');
    expect(shown).toContain('#lounge');
    expect(shown).toContain('#templates');
  });

  /**
   * 🔴 **THE BODY IS DRAWN IN FULL, WHICH IS THE "a message is not a card" DECISION ARRIVING AT
   * THE TREE.** A row that drew only a derived headline would satisfy every other assertion in
   * this file, so this is the one that distinguishes the river from the forum.
   */
  it('🔴 draws each message BODY, not a derived headline', () => {
    const shown = text(tree);
    expect(shown).toContain('Body of m1');
    expect(shown).toContain('Body of m2');
    expect(shown).toContain('Body of m3');
  });

  it('draws all five pills with their counts', () => {
    expect(testIds(tree)).toEqual(
      expect.arrayContaining([
        'community-chat-filter-all',
        'community-chat-filter-lounge',
        'community-chat-filter-templates',
        'community-chat-filter-tutorials',
        'community-chat-filter-collab'
      ])
    );
    expect(text(tree)).toContain('All channels 3');
  });

  it('marks the chosen pill pressed and the others not', () => {
    const narrowed = drawRiver('lounge');
    const pressed = walk(narrowed)
      .filter((n) => n.props['aria-pressed'] === true)
      .map((n) => String(n.props['data-test']));
    expect(pressed).toEqual(['community-chat-filter-lounge']);
  });

  it('🔴 hands the pill its own key, so clicking one selects the channel it names', () => {
    const picked: string[] = [];
    const narrowed = drawRiver(null, { onSelectChannel: (key) => picked.push(key) });
    const pill = walk(narrowed).find((n) => n.props['data-test'] === 'community-chat-filter-templates');
    (pill?.props.onClick as () => void)();
    expect(picked).toEqual(['templates']);
  });

  /**
   * 🔴 **THE WIRING MUTANT'S TARGET.** `onOpenThread` must receive *this row's* id. Passing the
   * first row's id for every row — or dropping the argument — leaves the river looking identical
   * and sends every reader to one conversation.
   */
  it('🔴 opens the thread whose row was clicked, by id', () => {
    const opened: string[] = [];
    const wired = drawRiver(null, { onOpenThread: (id) => opened.push(id) });
    const control = walk(wired).find((n) => n.props['data-test'] === 'community-chat-open-m3');
    (control?.props.onClick as () => void)();
    expect(opened).toEqual(['m3']);
  });

  it('says how many replies a message has, and still offers a way in when it has none', () => {
    const shown = text(tree);
    expect(shown).toContain('2 replies');
    expect(shown).toContain('Open — no replies yet');
  });

  it('draws the per-channel empty sentence when a reader narrows to a quiet channel', () => {
    const quiet = drawRiver('collab');
    expect(text(quiet)).toContain('Nothing in #collab yet');
  });
});

describe('FB-013 C4 — the thread pane', () => {
  const view = composeChatThread({
    root: message('root', 'lounge', { blocks: para('Hello everyone. Second sentence here.'), replyCount: 9 }),
    replies: [message('r1', 'lounge'), message('r2', 'lounge')]
  });

  const tree = render(
    CommunityChatThread({
      state: { state: 'open', ...view },
      density: CommunityDensity.Page,
      onBack: noop,
      onRetry: noop
    }) as React.ReactNode
  );

  it('heads the thread with the label derived from its opening message', () => {
    expect(text(tree)).toContain('Hello everyone.');
    expect(text(tree)).not.toContain('Second sentence here.  ·');
  });

  it('🔴 reports the replies it drew, not the payload count', () => {
    expect(text(tree)).toContain('2 replies');
    expect(text(tree)).not.toContain('9 replies');
    expect(byClass(tree, 'Message')).toHaveLength(3);
  });

  /**
   * 🔴 **NO "OPEN" CONTROL INSIDE THE THREAD.** A row's foot control points at the page it is
   * already on — a dead button, which reads as broken rather than as absent. This is the
   * assertion that keeps the optional handler optional; without it, restoring the control
   * everywhere would go unnoticed.
   */
  it('🔴 draws no open-thread control on a message inside the thread', () => {
    expect(testIds(tree).filter((id) => id.startsWith('community-chat-open-'))).toEqual([]);
  });

  it('offers a way back', () => {
    expect(testIds(tree)).toContain('community-chat-back');
  });

  it('says what went wrong rather than closing when a thread could not be opened', () => {
    const failed = render(
      CommunityChatThread({
        state: { state: 'unreachable', detail: 'that conversation could not be opened' },
        onBack: noop,
        onRetry: noop
      }) as React.ReactNode
    );
    expect(text(failed)).toContain('that conversation could not be opened');
    expect(testIds(failed)).toContain('community-chat-back');
  });

  /**
   * ⚠️ **The `closed` arm renders nothing, and `null` here is also what a component that never
   * ran produces** — so this row is only meaningful beside the ones above, which prove the same
   * component does draw when it is asked to.
   */
  it('draws nothing at all when no thread is open', () => {
    expect(render(CommunityChatThread({ state: { state: 'closed' }, onBack: noop, onRetry: noop }) as React.ReactNode)).toBeNull();
  });
});
