/**
 * FB-013 — the composer's two writes, graded where their decisions live.
 *
 * Same split `nat-007/threadwrites.test.ts` draws for the bench: every criterion here is a claim
 * about a SENTENCE or about what happens to somebody's typed text, both decided in
 * `chatwrites.ts` rather than in the component. `chat-composer-render.test.tsx` answers the other
 * question — did the screen actually place them.
 *
 * @module noodl-editor/tests-unit/fb-013/chatwrites
 */
import type { ChatPostAccepted, ChatReplyAccepted, Write } from '@noodl-models/community/communityapi';
import {
  CHAT_MAX_CHARACTERS,
  CHAT_POSTED_LINE,
  CHAT_REPLY_POSTED_LINE,
  canSendChat,
  chatBodyLength,
  chatDraftRefusal,
  chatPostFailureLine,
  chatReplyFailureLine,
  composeChatComposer,
  composeChatReplyBox
} from '@noodl-models/community/chatwrites';

const noop = () => undefined;

// ── The cap, copied from `chat_message_body_shape` ─────────────────────────────────────────

describe('the cap is the platform’s, and it counts what the platform counts', () => {
  it('counts the TRIMMED length, because the constraint checks `btrim(body)`', () => {
    expect(chatBodyLength('  hello  ')).toBe(5);
  });

  it('refuses a draft of nothing but whitespace, rather than letting the platform 400 it', () => {
    expect(canSendChat('   \n\t ')).toBe(false);
  });

  it('allows a draft exactly at the cap, because the constraint is `between 1 and 8000`', () => {
    expect(canSendChat('x'.repeat(CHAT_MAX_CHARACTERS))).toBe(true);
  });

  it('refuses one character past it', () => {
    expect(canSendChat('x'.repeat(CHAT_MAX_CHARACTERS + 1))).toBe(false);
  });

  it('says nothing about an empty box — the disabled verb beside it is the explanation', () => {
    expect(chatDraftRefusal('')).toBeNull();
    expect(chatDraftRefusal('   ')).toBeNull();
  });

  it('says how far over, because neither the limit nor the count is on screen', () => {
    expect(chatDraftRefusal('x'.repeat(CHAT_MAX_CHARACTERS + 412))).toBe(
      `That is 412 characters over the community's limit of ${CHAT_MAX_CHARACTERS}.`
    );
  });

  it('says “1 character”, not “1 characters”', () => {
    expect(chatDraftRefusal('x'.repeat(CHAT_MAX_CHARACTERS + 1))).toContain('1 character over');
  });
});

// ── What a failure says ─────────────────────────────────────────────────────────────────────

describe('a post that fails to send says so AND keeps the text', () => {
  const failures: Write<ChatPostAccepted>[] = [
    { outcome: 'unauthenticated' },
    { outcome: 'absent' },
    { outcome: 'refused', detail: 'the channel or body is the wrong shape.' },
    { outcome: 'unreachable', status: null, detail: 'TypeError: fetch failed' }
  ];

  it('has a distinct sentence for each of the four, because each has a different fix', () => {
    const lines = failures.map((write) => chatPostFailureLine(write));
    expect(lines.every((line) => typeof line === 'string' && line.length > 0)).toBe(true);
    expect(new Set(lines).size).toBe(failures.length);
  });

  it('tells the person their text is still there — in EVERY arm', () => {
    for (const write of failures) {
      expect(chatPostFailureLine(write)).toContain('still here');
    }
  });

  it('says ok for ok', () => {
    expect(chatPostFailureLine({ outcome: 'ok', value: { id: 'm1', channel: 'lounge' } })).toBeNull();
  });

  it('🔴 `absent` does not narrate D15 — it reads as an ordinary unavailability', () => {
    const line = chatPostFailureLine({ outcome: 'absent' }) ?? '';
    expect(line.toLowerCase()).not.toContain('permission');
    expect(line.toLowerCase()).not.toContain('refused');
  });
});

describe('a reply that fails to send says so AND keeps the text', () => {
  const failures: Write<ChatReplyAccepted>[] = [
    { outcome: 'unauthenticated' },
    { outcome: 'absent' },
    { outcome: 'refused', detail: 'that message could not be found.' },
    { outcome: 'unreachable', status: null, detail: 'TypeError: fetch failed' }
  ];

  it('has a distinct sentence for each of the four', () => {
    const lines = failures.map((write) => chatReplyFailureLine(write));
    expect(lines.every((line) => typeof line === 'string' && line.length > 0)).toBe(true);
    expect(new Set(lines).size).toBe(failures.length);
  });

  it('tells the person their reply is still there — in EVERY arm', () => {
    for (const write of failures) {
      expect(chatReplyFailureLine(write)).toContain('still here');
    }
  });

  it('says ok for ok', () => {
    expect(chatReplyFailureLine({ outcome: 'ok', value: { id: 'm2', notified: true } })).toBeNull();
  });
});

// ── The starter ─────────────────────────────────────────────────────────────────────────────

describe('composeChatComposer — signed out gets a hand-off, never a dead sign-in line', () => {
  it('draws no channel picker and no text box', () => {
    const box = composeChatComposer({
      signedIn: false,
      channel: 'lounge',
      draft: '',
      sending: false,
      last: null,
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('handoff');
  });
});

describe('composeChatComposer — signed in gets the whole vocabulary', () => {
  it('offers all four channels, each with its own purpose sentence', () => {
    const box = composeChatComposer({
      signedIn: true,
      channel: 'lounge',
      draft: '',
      sending: false,
      last: null,
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.channels.map((c) => c.key)).toEqual(['lounge', 'templates', 'tutorials', 'collab']);
    expect(new Set(box.channels.map((c) => c.purpose)).size).toBe(4);
  });

  it('🔴 an unknown channel falls back to the FIRST of the four, not to nothing', () => {
    const box = composeChatComposer({
      signedIn: true,
      channel: 'retired-channel',
      draft: '',
      sending: false,
      last: null,
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.channel).toBe('lounge');
  });

  it('is disabled with nothing typed', () => {
    const box = composeChatComposer({
      signedIn: true,
      channel: 'lounge',
      draft: '',
      sending: false,
      last: null,
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.canSubmit).toBe(false);
  });

  it('carries the last failure and keeps the draft', () => {
    const box = composeChatComposer({
      signedIn: true,
      channel: 'lounge',
      draft: 'still typing',
      sending: false,
      last: { outcome: 'refused', detail: 'the body is too short.' },
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.value).toBe('still typing');
    expect(box.error).toContain('the body is too short.');
  });

  it('🔴 never shows the posted note beside a failure — one or the other, never both', () => {
    const box = composeChatComposer({
      signedIn: true,
      channel: 'lounge',
      draft: 'x',
      sending: false,
      last: { outcome: 'unreachable', status: null, detail: 'offline' },
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.error).not.toBeNull();
    expect(box.note).toBeNull();
  });

  it('shows the posted note only once the write is ok', () => {
    const box = composeChatComposer({
      signedIn: true,
      channel: 'lounge',
      draft: '',
      sending: false,
      last: { outcome: 'ok', value: { id: 'm1', channel: 'lounge' } },
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.note).toBe(CHAT_POSTED_LINE);
  });

  it('disables the box and the verb, and renames the verb, while sending', () => {
    const box = composeChatComposer({
      signedIn: true,
      channel: 'lounge',
      draft: 'x',
      sending: true,
      last: null,
      onChannelChange: noop,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.busy).toBe(true);
    expect(box.submitLabel).toBe('Posting…');
  });
});

// ── The reply ────────────────────────────────────────────────────────────────────────────────

describe('composeChatReplyBox — reuses the bench’s own type, unchanged', () => {
  it('signed out gets a hand-off', () => {
    const box = composeChatReplyBox({
      signedIn: false,
      draft: '',
      sending: false,
      last: null,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('handoff');
  });

  it('signed in gets a composer with no channel field at all', () => {
    const box = composeChatReplyBox({
      signedIn: true,
      draft: 'sounds good',
      sending: false,
      last: null,
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.value).toBe('sounds good');
    expect('channel' in box).toBe(false);
  });

  it('shows the reply-specific posted note, distinct from the starter’s', () => {
    const box = composeChatReplyBox({
      signedIn: true,
      draft: '',
      sending: false,
      last: { outcome: 'ok', value: { id: 'm2', notified: true } },
      onChange: noop,
      onSubmit: noop,
      onHandoff: noop
    });
    expect(box.kind).toBe('composer');
    if (box.kind !== 'composer') throw new Error('unreachable');
    expect(box.note).toBe(CHAT_REPLY_POSTED_LINE);
    expect(CHAT_REPLY_POSTED_LINE).not.toBe(CHAT_POSTED_LINE);
  });
});
