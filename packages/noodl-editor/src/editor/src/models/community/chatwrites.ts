/**
 * FB-013 — the chat composer's two writes, as decisions with words in them.
 *
 * ## 🔴 Why these are a module and not component state
 *
 * `threadwrites.ts` is the reason, unchanged: this repo's jest has no DOM, so what a failed send
 * says, whether a draft over the cap may fire, and which of the two affordances is drawn all have
 * to be functions a spec can call. `CommunityChatView.tsx` places what this returns and decides
 * nothing itself.
 *
 * ## ✅ Session parity, carried over from the bench
 *
 * D5 settled 2026-08-20 that the editor gets the same session scope as the browser, so a signed-in
 * reader gets a real composer here rather than a labelled hand-off — `composeChatComposer` and
 * `composeChatReplyBox` both mirror `threadwrites.composeReplyBox`'s two arms for exactly that
 * reason, including the reply box's own type: a chat reply and a bench answer are the same
 * affordance (one field, one submit, one platform sentence on failure), so this reuses
 * `CommunityReplyBox` rather than inventing a second shape for an identical one.
 *
 * ## ⚠️ THE LIMIT IS THE PLATFORM'S AND IT IS COPIED
 *
 * {@link CHAT_MAX_CHARACTERS} is `chat_message_body_shape` — `check (length(btrim(body)) between 1
 * and 8000)` in `0024_fb013_chat.sql`, the same cap `threadwrites.ANSWER_MAX_CHARACTERS` copies
 * from the bench's constraint. Same drift risk, same mitigation: read off the constraint, and
 * being wrong is visible on both sides (a cap too high draws the platform's own 400; one too low
 * refuses a draft in a sentence naming the number).
 *
 * ## ⚠️ Every refusal below keeps the text
 *
 * No failure arm clears a draft — only `Write.ok` does — for `threadwrites.ts`'s reason: losing
 * somebody's typed message to a network blip is worse than making them retype it on a retry.
 *
 * @module noodl-editor/models/community/chatwrites
 */

import type { ChatChannelOption, CommunityChatComposerBox, CommunityReplyBox } from '@noodl-core-ui/components/community';

import { CHANNEL_PURPOSE, CHAT_CHANNELS, isChatChannel } from './chatview';
import type { ChatPostAccepted, ChatReplyAccepted, Write } from './communityapi';

/**
 * The platform's own cap on a chat message body, read off `chat_message_body_shape`.
 * See the module note: this is a copy of a database constraint.
 */
export const CHAT_MAX_CHARACTERS = 8000;

/** What the platform will count, which is not what `draft.length` counts — `btrim`, not raw length. */
export function chatBodyLength(draft: string): number {
  return draft.trim().length;
}

/** Whether the verb may fire at all. */
export function canSendChat(draft: string): boolean {
  const length = chatBodyLength(draft);
  return length > 0 && length <= CHAT_MAX_CHARACTERS;
}

/**
 * The sentence under a refused verb, or `null` for a refusal that explains itself.
 *
 * ⚠️ `null` for an empty box, on `threadwrites.draftRefusal`'s reasoning: a disabled submit beside
 * an empty field is already legible, and a sentence there would be scolding somebody who has not
 * finished typing. Being over the cap is the opposite case — the limit is invisible without this.
 */
export function chatDraftRefusal(draft: string): string | null {
  const length = chatBodyLength(draft);
  if (length <= CHAT_MAX_CHARACTERS) return null;
  const over = length - CHAT_MAX_CHARACTERS;
  return `That is ${over} character${over === 1 ? '' : 's'} over the community's limit of ${CHAT_MAX_CHARACTERS}.`;
}

/**
 * What a failed post says.
 *
 * ⚠️ `absent` must not narrate — a 404 on `POST /api/v1/community/chat` means D15 refuses this
 * viewer the surface, and `docs/API.md` §4 forbids rendering that as a permission. It reads as an
 * ordinary unavailability, exactly as the read side already does for the same status.
 */
export function chatPostFailureLine(write: Write<ChatPostAccepted>): string | null {
  switch (write.outcome) {
    case 'ok':
      return null;
    case 'unauthenticated':
      return 'Your session has expired, so this was not posted. Sign in to the community again — your message is still here.';
    case 'absent':
      return 'Chat is not available right now, so this was not posted. Your message is still here.';
    case 'refused':
      return `The community did not accept this: ${write.detail} Your message is still here.`;
    case 'unreachable':
      return 'The community could not be reached, so this was not posted. Your message is still here — try again when you are back on the network.';
  }
}

/** What a failed reply says. Same shape as {@link chatPostFailureLine}, for a reply instead of a root. */
export function chatReplyFailureLine(write: Write<ChatReplyAccepted>): string | null {
  switch (write.outcome) {
    case 'ok':
      return null;
    case 'unauthenticated':
      return 'Your session has expired, so this reply was not posted. Sign in to the community again — your reply is still here.';
    case 'absent':
      return 'This conversation is not available any more, so the reply was not posted. Your reply is still here.';
    case 'refused':
      return `The community did not accept this: ${write.detail} Your reply is still here.`;
    case 'unreachable':
      return 'The community could not be reached, so the reply was not posted. Your reply is still here — try again when you are back on the network.';
  }
}

/** What a successful post says, before the re-read lands. */
export const CHAT_POSTED_LINE = 'Posted.';

/** What a successful reply says, before the re-read lands. */
export const CHAT_REPLY_POSTED_LINE = 'Posted. Re-opening the conversation…';

/**
 * 🔴 Read here, not imported raw at the call site — same discipline `chat.ts`'s route note asks
 * of the platform's own client: one declaration of the four channels, each with the sentence a
 * reader gets if they narrow down to it and find it quiet (see `CHANNEL_PURPOSE`).
 */
const CHANNEL_OPTIONS: ChatChannelOption[] = CHAT_CHANNELS.map((key) => ({
  key,
  label: `#${key}`,
  purpose: CHANNEL_PURPOSE[key]
}));

export type ChatComposerInputs = {
  /** Whether THIS EDITOR holds a session — see `threadwrites.ReplyBoxInputs.signedIn`'s note. */
  signedIn: boolean;
  channel: string;
  draft: string;
  sending: boolean;
  /** The last attempt, or `null` if there has not been one since the composer last cleared. */
  last: Write<ChatPostAccepted> | null;
  onChannelChange: (next: string) => void;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** The labelled browser hand-off, for the signed-out arm. */
  onHandoff: () => void;
};

/**
 * The "start something" affordance above the river.
 *
 * ⚠️ **An unknown `channel` falls back to the first of the four rather than drawing nothing.**
 * Mirrors `composeChat`'s own rule for the filter: a value this build does not recognise should
 * cost the composer a default, not itself.
 */
export function composeChatComposer(inputs: ChatComposerInputs): CommunityChatComposerBox {
  if (!inputs.signedIn) {
    return {
      kind: 'handoff',
      line: 'You are not signed in to the community, so a message cannot be posted from the editor.',
      actionLabel: 'Say something on the web',
      onAction: inputs.onHandoff
    };
  }

  const failure = inputs.last ? chatPostFailureLine(inputs.last) : null;
  return {
    kind: 'composer',
    channels: CHANNEL_OPTIONS,
    channel: isChatChannel(inputs.channel) ? inputs.channel : CHAT_CHANNELS[0],
    onChannelChange: inputs.onChannelChange,
    value: inputs.draft,
    onChange: inputs.onChange,
    onSubmit: inputs.onSubmit,
    submitLabel: inputs.sending ? 'Posting…' : 'Say something',
    canSubmit: canSendChat(inputs.draft),
    blockedReason: chatDraftRefusal(inputs.draft),
    busy: inputs.sending,
    error: failure,
    // ⚠️ Never both — `threadwrites.composeReplyBox`'s rule: a screen saying "Posted" and "could
    // not be reached" at once makes the reader decide which half to believe.
    note: !failure && inputs.last?.outcome === 'ok' ? CHAT_POSTED_LINE : null
  };
}

export type ChatReplyInputs = {
  signedIn: boolean;
  draft: string;
  sending: boolean;
  last: Write<ChatReplyAccepted> | null;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onHandoff: () => void;
};

/**
 * The reply affordance under an open thread.
 *
 * 🔴 **Returns `CommunityReplyBox`, the bench's own type, unchanged.** A chat reply and a bench
 * answer are one field and one submit against one platform sentence — inventing a second type for
 * an identical shape is the "two copies, and a fix lands on one of them" arrangement this
 * package's own header exists to prevent.
 */
export function composeChatReplyBox(inputs: ChatReplyInputs): CommunityReplyBox {
  if (!inputs.signedIn) {
    return {
      kind: 'handoff',
      line: 'You are not signed in to the community, so a reply cannot be posted from the editor.',
      actionLabel: 'Reply on the web',
      onAction: inputs.onHandoff
    };
  }

  const failure = inputs.last ? chatReplyFailureLine(inputs.last) : null;
  return {
    kind: 'composer',
    label: 'Your reply',
    placeholder: 'Reply in this conversation. Markdown works here, the same as on the web.',
    value: inputs.draft,
    onChange: inputs.onChange,
    onSubmit: inputs.onSubmit,
    submitLabel: inputs.sending ? 'Posting…' : 'Reply',
    canSubmit: canSendChat(inputs.draft),
    blockedReason: chatDraftRefusal(inputs.draft),
    busy: inputs.sending,
    error: failure,
    note: !failure && inputs.last?.outcome === 'ok' ? CHAT_REPLY_POSTED_LINE : null
  };
}
