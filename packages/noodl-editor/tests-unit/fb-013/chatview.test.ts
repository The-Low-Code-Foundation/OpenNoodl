/**
 * FB-013 C4 — the chat river's view model.
 *
 * ## What this file is for, and what it deliberately cannot see
 *
 * It grades {@link composeChat}: which rows, which pill counts, which sentence. 🔴 **A correct
 * view model that nothing draws is the same screen as no fix at all** — FIX-025 §7 proved that
 * again three days ago with a mutant that severed only the wiring — so `chat-river-render.test.tsx`
 * walks the component beside this, and neither file is sufficient alone.
 *
 * @module noodl-editor/tests-unit/fb-013/chatview
 */
import {
  ALL_CHANNELS,
  CHANNEL_PURPOSE,
  CHAT_CHANNELS,
  chatThreadLabel,
  composeChat,
  composeChatThread
} from '@noodl-models/community/chatview';
import type { ChatMessage, Read } from '@noodl-models/community/communityapi';
import type { PostBlock } from '@noodl-models/community/postbody';

const para = (text: string): PostBlock[] => [{ kind: 'paragraph', inlines: [{ kind: 'text', text }] }];

const message = (id: string, channel: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  channel,
  authorHandle: 'ava',
  blocks: para(`A message in ${channel}`),
  replyCount: 0,
  createdAt: '2026-08-27T10:00:00.000Z',
  editedAt: null,
  ...extra
});

const ok = (items: ChatMessage[]): Read<ChatMessage[]> => ({ outcome: 'ok', value: items });

/**
 * ⚠️ Deliberately lopsided: three channels occupied at different sizes and **`collab` empty**, so
 * every count below is a different number and the quiet-channel rule has a subject.
 */
const RIVER = [
  message('m1', 'lounge'),
  message('m2', 'templates'),
  message('m3', 'lounge'),
  message('m4', 'tutorials'),
  message('m5', 'lounge')
];

const itemsOf = (view: ReturnType<typeof composeChat>) =>
  view.section.state === 'items' ? view.section.items : [];

describe('FB-013 C4 — the river is merged by default', () => {
  it('🔴 shows every channel at once when nothing is chosen — a channel is a filter, not a door', () => {
    const view = composeChat(ok(RIVER), null);
    expect(itemsOf(view).map((r) => r.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
    expect(view.filters.find((f) => f.key === ALL_CHANNELS)?.active).toBe(true);
  });

  it('draws all four channels as pills even when one is empty, so the quiet one is a visible 0', () => {
    const view = composeChat(ok(RIVER), null);
    const keys = view.filters.map((f) => f.key);
    expect(keys).toEqual([ALL_CHANNELS, ...CHAT_CHANNELS]);
    expect(view.filters.find((f) => f.key === 'collab')?.count).toBe(0);
  });

  /**
   * 🔴 **THE LOAD-BEARING ASSERTION IN THIS FILE.** A pill's number is not *related to* what
   * clicking it gives you, it **is** what clicking it gives you. This checks the identity by
   * actually selecting each channel rather than by re-deriving the count a second way — a
   * re-derivation would agree with a wrong implementation that made the same mistake twice.
   */
  it('🔴 every pill count equals the rows you get by selecting that pill', () => {
    const all = composeChat(ok(RIVER), null);
    for (const pill of all.filters) {
      const selected = composeChat(ok(RIVER), pill.key === ALL_CHANNELS ? null : pill.key);
      expect(`${pill.key}=${pill.count}`).toBe(`${pill.key}=${itemsOf(selected).length}`);
    }
  });

  it('narrows to one channel when a pill is chosen, and marks only that pill active', () => {
    const view = composeChat(ok(RIVER), 'lounge');
    expect(itemsOf(view).map((r) => r.id)).toEqual(['m1', 'm3', 'm5']);
    expect(view.filters.filter((f) => f.active).map((f) => f.key)).toEqual(['lounge']);
  });

  it('summarises the whole river with a bare count and a narrowed one with both numbers', () => {
    expect(composeChat(ok(RIVER), null).summary).toBe('5 conversations');
    expect(composeChat(ok(RIVER), 'lounge').summary).toBe('3 of 5 conversations');
  });

  it('says "1 conversation", not "1 conversations"', () => {
    expect(composeChat(ok([message('m1', 'lounge')]), null).summary).toBe('1 conversation');
  });

  /**
   * ⚠️ The route ignores an unknown `?channel=` rather than refusing it, so a channel retired by
   * a later migration costs a reader the filter and not the page. This is that decision, on the
   * client — and it is the difference between a stale pill and a blank screen.
   */
  it('falls back to the whole river when the chosen channel is not one we know', () => {
    const view = composeChat(ok(RIVER), 'showcase');
    expect(itemsOf(view)).toHaveLength(5);
    expect(view.filters.find((f) => f.key === ALL_CHANNELS)?.active).toBe(true);
  });
});

describe('FB-013 C4 — what the river says when it has nothing to show', () => {
  it('🔴 names the channel AND what it is for when a reader filtered down to a quiet one', () => {
    const view = composeChat(ok(RIVER), 'collab');
    expect(view.section.state).toBe('empty');
    expect(view.emptyLine).toBe(`Nothing in #collab yet. ${CHANNEL_PURPOSE.collab}`);
  });

  /**
   * 🔴 **THE NEGATIVE CONTROL.** Without it, an implementation that always produced the
   * channel-specific sentence passes every other assertion in this describe block. The two
   * emptinesses are opposite news — "nobody has started anything" and "nothing in #collab" — and
   * only a pair can tell them apart.
   */
  it('🔴 says something different when the whole river is empty, not the per-channel sentence', () => {
    const view = composeChat(ok([]), null);
    expect(view.section.state).toBe('empty');
    expect(view.emptyLine).toContain('Nobody has started anything yet');
    expect(view.emptyLine).not.toContain('#');
  });

  it('draws no pills at all over an empty river — five controls that cannot do anything', () => {
    expect(composeChat(ok([]), null).filters).toEqual([]);
    expect(composeChat(ok([]), null).summary).toBeNull();
  });

  it('is loading before the first read answers, which is not the same as empty', () => {
    expect(composeChat(undefined, null).section.state).toBe('loading');
  });

  it('passes an unreachable read through with its detail rather than drawing an empty room', () => {
    const view = composeChat({ outcome: 'unreachable', status: 500, detail: 'the roof fell in' }, null);
    expect(view.section).toEqual({ state: 'unreachable', detail: 'the roof fell in' });
  });
});

/**
 * 🔴 **THESE ROWS MIRROR `nodegx-community/src/lib/chat.ts`'s `threadLabel` AND MUST KEEP
 * AGREEING WITH IT.** The platform's own note says why: the label is a permalink's heading, so
 * two surfaces computing it differently is one address whose title depends on which client you
 * followed it from. If one of these fails after a platform change, the fix is to re-read that
 * function — not to relax the row.
 */
describe('FB-013 C4 — a thread is named by its opening message', () => {
  it('takes the opening sentence when there is a short one, terminator included', () => {
    expect(chatThreadLabel(para('Is anyone using the starter template? I need a dashboard.'))).toBe(
      'Is anyone using the starter template?'
    );
  });

  it('takes the whole text when it is short and has no sentence end', () => {
    expect(chatThreadLabel(para('Looking for a pairing partner'))).toBe('Looking for a pairing partner');
  });

  /**
   * 🔴 **THIS ROW ASSERTS THE PROPERTY, NOT AN EXAMPLE — and the first version did not.** It
   * originally checked `not.toMatch(/alph…$/)`, picking one way the naive cut could look; the
   * mutant that removes the word-boundary logic entirely happened to land on `…al…` instead and
   * **survived a green spec**. A spec that names a mechanism it never reaches is the failure this
   * phase keeps meeting, so the check is now: whatever survives the cut must be a **prefix of the
   * original that stopped at a space**, which no mid-word cut can satisfy.
   */
  it('🔴 cuts on a WORD boundary past the limit — a label ending mid-word reads as a failed load', () => {
    const long = `${'alpha '.repeat(20)}omega`;
    const label = chatThreadLabel(para(long));
    expect(label.endsWith('…')).toBe(true);

    const kept = label.slice(0, -1);
    expect(long.startsWith(kept)).toBe(true);
    expect(long[kept.length]).toBe(' ');
  });

  it('falls back to "A message" for a body that parses to no text at all', () => {
    expect(chatThreadLabel([])).toBe('A message');
  });

  /**
   * ⚠️ The one documented difference from the platform's `plainTextOf`: `unsupported` is this
   * editor's marker for a block *it* could not render, and it contributes no text. A body made
   * only of those is honestly nameless rather than named after a marker.
   */
  it('does not name a thread after a block kind it could not draw', () => {
    expect(chatThreadLabel([{ kind: 'unsupported', label: 'table' }])).toBe('A message');
  });
});

describe('FB-013 C4 — a thread counts the replies it is about to draw', () => {
  /**
   * 🔴 **FIX-025 §7's RULE, ONE SURFACE LATER.** The payload's count is over rows and the array
   * is over *visible* ones, so a heading taken from `replyCount` sits above a different number of
   * messages the moment moderation hides one — sending a reader looking for a third that is not
   * coming. The fixture disagrees on purpose: `replyCount: 5`, two replies present.
   */
  it('🔴 uses the drawn replies, never the payload count', () => {
    const view = composeChatThread({
      root: message('root', 'lounge', { replyCount: 5 }),
      replies: [message('r1', 'lounge'), message('r2', 'lounge')]
    });
    expect(view.repliesLine).toBe('2 replies');
  });

  it('says "1 reply" rather than "1 replies"', () => {
    const view = composeChatThread({
      root: message('root', 'lounge', { replyCount: 1 }),
      replies: [message('r1', 'lounge')]
    });
    expect(view.repliesLine).toBe('1 reply');
  });

  it('invites the first reply rather than reporting a zero', () => {
    const view = composeChatThread({ root: message('root', 'lounge'), replies: [] });
    expect(view.repliesLine).toBe('No replies yet — you could be the first.');
  });

  it('names the thread from the root and carries the replies in order', () => {
    const view = composeChatThread({
      root: message('root', 'lounge', { blocks: para('Hello everyone.') }),
      replies: [message('r1', 'lounge'), message('r2', 'lounge')]
    });
    expect(view.label).toBe('Hello everyone.');
    expect(view.replies.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('marks a message as edited only when the platform said it was', () => {
    const view = composeChatThread({
      root: message('root', 'lounge', { editedAt: '2026-08-27T11:00:00.000Z' }),
      replies: [message('r1', 'lounge')]
    });
    expect(view.root.edited).toBe(true);
    expect(view.replies[0].edited).toBe(false);
  });
});
