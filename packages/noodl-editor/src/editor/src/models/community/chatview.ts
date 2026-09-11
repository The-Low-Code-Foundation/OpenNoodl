/**
 * FB-013 C4 — the chat river, as the launcher's tab draws it.
 *
 * ## 🔴 The merged river is the design, and it lives in the shape of this module
 *
 * `FB-013-SCOPE.md` §2: **a channel is a FILTER, not a door.** The default view is every
 * channel at once, so no screen in this feature can be *landed on* empty — which is the answer
 * to UNI-011's *"chat renders low volume as an empty room every time anyone looks"*, and the
 * measurement behind it (the bench holds 2 threads, 1 author, 1 reply) has not moved.
 *
 * So {@link composeChat} takes the chosen channel as `null`-able and defaults to **all**, and
 * there is deliberately no `composeChannel` beside it. The platform's route made the same
 * choice at its own boundary (`channel` is an optional narrowing, and there is no
 * `/chat/[channel]`), and `CHAT_SPEC` made it in the web's facet (`all: 'All channels'`, **no
 * `fallback`**). Three layers, one decision — this is the launcher's copy of it.
 *
 * ## 🔴 Why the four channels are drawn even when they are empty
 *
 * `byFrequency` — the facet helper the web uses for open-ended dimensions — would delete a pill
 * nobody has posted under. That hides the quiet exactly where the design wants it visible: a
 * channel with nothing in it should be a **`0` beside a pill you can see and decide about**,
 * not an absence you cannot ask about. So the vocabulary here is the whole closed set, always.
 *
 * ## ⚠️ This file holds THREE copies of things that live in another repository
 *
 * `nodegx-community` is a different checkout, so none of this can be derived from disk the way
 * a route sweep would be — the same constraint `communityTabs.ts` records for the web's nav
 * order, and the same mitigation: the copies are together, on one screen, each naming its
 * source so a reader can check it in one grep rather than four.
 *
 *   * {@link CHAT_CHANNELS} — `0024_fb013_chat.sql`'s `chat_channel` enum, and `chat.ts`.
 *   * {@link CHANNEL_PURPOSE} — `chat.ts`, drawn when a reader filters down to a quiet channel.
 *   * {@link chatThreadLabel} — `chat.ts`'s `threadLabel`. 🔴 **This one MUST agree**, and the
 *     platform's own comment says why: it is a permalink's `<h1>`, so a label two surfaces
 *     compute differently is one address whose title depends on which client you followed it
 *     from. It is mirrored line for line below, with the one documented difference.
 *
 * @module noodl-editor/models/community/chatview
 */

import type { PostBlock } from './postbody';
import type { ChatMessage, ChatThread, Read } from './communityapi';

/**
 * 🔴 A **closed** vocabulary — an enum in `0024`, not a table — so adding one is a migration and
 * therefore a product decision rather than a user action.
 *
 * 🔴 **CHOSEN FOR NON-OVERLAP WITH THE BENCH'S SECTIONS** (`help`, `showcase`, `meetups`). A
 * chat `#showcase` beside a bench `showcase` is two places for one thing and a reader has to
 * guess which. Each of the four is a content type the report names as having no bench home.
 */
export const CHAT_CHANNELS = ['lounge', 'templates', 'tutorials', 'collab'] as const;

export type ChatChannelKey = (typeof CHAT_CHANNELS)[number];

export function isChatChannel(value: string): value is ChatChannelKey {
  return (CHAT_CHANNELS as readonly string[]).includes(value);
}

/**
 * What each channel is for — drawn when a reader has narrowed to one and found it quiet.
 *
 * ⚠️ **This is the sentence that keeps a deliberate filter from reading as a broken feature.**
 * §2 makes the empty room unreachable by *accident*; this is what somebody who filtered on
 * purpose is owed instead of a blank panel.
 */
export const CHANNEL_PURPOSE: Record<ChatChannelKey, string> = {
  lounge: 'Anything and nothing — the channel for talking without committing to a question.',
  templates: 'Show a template, ask what to build with one, say what you changed.',
  tutorials: 'Share a tutorial you wrote or found, and talk about the ones we ship.',
  collab: 'Looking for someone to build with, or offering to help on something.'
};

/** The key the "everything" pill carries. ⚠️ Not a channel — no message is ever in it. */
export const ALL_CHANNELS = 'all';

/**
 * One message, as a river row.
 *
 * 🔴 **NO `title` FIELD.** C3 recorded this on the web and it is the same decision here: a chat
 * message has no headline, and deriving one for a *list row* would turn the river into a column
 * of invented titles — which is the forum this feature sits beside rather than inside. The body
 * is drawn in full, exactly as the web's river draws it.
 *
 * ⚠️ Times are raw and formatted by the view, matching `CommunityBenchRow`: the formatting rules
 * live in `communityMeta.ts` where a spec can reach them without a DOM.
 */
export type ChatRiverRow = {
  id: string;
  channel: string;
  authorHandle: string;
  blocks: PostBlock[];
  createdAt: string;
  replyCount: number;
  edited: boolean;
};

export type ChatFilterPill = {
  key: string;
  label: string;
  count: number;
  active: boolean;
};

export type SectionState<T> =
  | { state: 'loading' }
  | { state: 'items'; items: T[] }
  | { state: 'empty' }
  | { state: 'unreachable'; detail: string };

export type CommunityChatView = {
  section: SectionState<ChatRiverRow>;
  filters: ChatFilterPill[];
  /** `4 conversations`, or `1 of 4 conversations` when a channel is narrowing. */
  summary: string | null;
  /** 🔴 Required, and it names the channel when one is chosen. See {@link CHANNEL_PURPOSE}. */
  emptyLine: string;
};

function rowFrom(message: ChatMessage): ChatRiverRow {
  return {
    id: message.id,
    channel: message.channel,
    authorHandle: message.authorHandle,
    blocks: message.blocks,
    createdAt: message.createdAt,
    replyCount: message.replyCount,
    edited: message.editedAt !== null
  };
}

function sectionFrom<T>(read: Read<unknown> | undefined, items: T[] | null): SectionState<T> {
  if (read === undefined) return { state: 'loading' };
  if (read.outcome === 'unreachable') return { state: 'unreachable', detail: read.detail };
  // ⚠️ `absent` becomes `empty` rather than an error, for `mirrorview.sectionFrom`'s reason: a
  // section that narrates a closed door is the leak D15 exists to prevent.
  if (read.outcome !== 'ok' || !items) return { state: 'empty' };
  return items.length === 0 ? { state: 'empty' } : { state: 'items', items };
}

function conversations(n: number): string {
  return n === 1 ? '1 conversation' : `${n} conversations`;
}

/**
 * The river, narrowed by at most one channel.
 *
 * 🔴 **THE COUNTS AND THE ROWS COME FROM ONE PASS OVER ONE LIST.** `facets.ts` makes this true
 * by construction on the web and it is restated here for the same reason: a pill's number is
 * not *related to* what clicking it gives you, it **is** what clicking it gives you. Asking the
 * platform once per pill would be two producers of one number, which is where they drift.
 *
 * ⚠️ **An unknown `chosen` falls back to the whole river rather than drawing nothing.** The
 * route ignores an unrecognised `channel` for the same reason: a channel retired by a later
 * migration should cost a reader the filter, not the page.
 */
export function composeChat(
  read: Read<ChatMessage[]> | undefined,
  chosen: string | null
): CommunityChatView {
  const held: ChatRiverRow[] = read?.outcome === 'ok' ? read.value.map(rowFrom) : [];
  const active = chosen !== null && isChatChannel(chosen) ? chosen : ALL_CHANNELS;
  const shown = active === ALL_CHANNELS ? held : held.filter((row) => row.channel === active);

  const filters: ChatFilterPill[] =
    // ⚠️ No pills over nothing — five controls above an empty panel is chrome that cannot do
    // anything, drawn as though it could. Same rule as `composeBench`'s.
    held.length === 0 && read?.outcome === 'ok'
      ? []
      : [
          { key: ALL_CHANNELS, label: 'All channels', count: held.length, active: active === ALL_CHANNELS },
          ...CHAT_CHANNELS.map((channel) => ({
            key: channel,
            label: `#${channel}`,
            count: held.filter((row) => row.channel === channel).length,
            active: active === channel
          }))
        ];

  return {
    section: sectionFrom<ChatRiverRow>(read, shown),
    summary:
      held.length === 0
        ? null
        : active === ALL_CHANNELS
          ? conversations(held.length)
          : `${shown.length} of ${conversations(held.length)}`,
    filters,
    emptyLine:
      active === ALL_CHANNELS
        ? 'Nobody has started anything yet. Anyone with an account can, and a message here is not a commitment to anything — that is what it is for.'
        : `Nothing in #${active} yet. ${CHANNEL_PURPOSE[active]}`
  };
}

/**
 * How long a derived label runs before it is cut. Stated, because a silent cap reads as a total.
 *
 * ⚠️ Must equal `chat.ts`'s `LABEL_LIMIT`. See {@link chatThreadLabel}.
 */
const LABEL_LIMIT = 80;

/**
 * The plain text of a body, for {@link chatThreadLabel} only.
 *
 * 🔴 **ONE DOCUMENTED DIFFERENCE FROM THE PLATFORM'S `plainTextOf`: the `unsupported` block.**
 * That kind does not exist on the wire — it is this editor's marker for a block *it* could not
 * render (`readPostBlocks`), so the platform's function has no case for it. It contributes no
 * text here, which is the honest reading: we do not know what it said. A body whose blocks are
 * all unsupported therefore falls through to `'A message'`, exactly as an unreadable one does.
 */
function plainTextOfBlocks(blocks: PostBlock[]): string {
  const inlineText = (inlines: { text: string }[]) => inlines.map((i) => i.text).join('');
  return blocks
    .map((block) => {
      switch (block.kind) {
        case 'paragraph':
        case 'heading':
          return inlineText(block.inlines);
        case 'list':
          return block.items.map(inlineText).join('\n');
        case 'codeblock':
          return block.text;
        default:
          return '';
      }
    })
    .join('\n\n')
    .trim();
}

/**
 * A thread's name, derived from its opening message.
 *
 * 🔴 **MIRRORS `nodegx-community/src/lib/chat.ts`'s `threadLabel` AND MUST KEEP AGREEING.** The
 * platform's own note is the reason: this is a permalink's heading, and *"a label two surfaces
 * compute differently is one permalink whose title depends on which client you followed it
 * from"*. There is no stored column to read instead — scope §3 refuses one, because a title
 * field is exactly what makes readers scan headlines rather than read messages.
 *
 * ⚠️ The one difference is in {@link plainTextOfBlocks}, and it is about a block kind the wire
 * cannot contain.
 */
export function chatThreadLabel(blocks: PostBlock[]): string {
  const text = plainTextOfBlocks(blocks).replace(/\s+/g, ' ').trim();
  // ⚠️ A body cannot be empty — `chat_message_body_shape` refuses it — but a body of pure
  // punctuation parses to no text, and a heading with no name is a page that failed to load.
  if (text === '') return 'A message';

  const stop = text.search(/[.!?](\s|$)/);
  if (stop !== -1 && stop <= LABEL_LIMIT) return text.slice(0, stop + 1);
  if (text.length <= LABEL_LIMIT) return text;

  // 🔴 Cut on a WORD boundary. A label ending mid-word reads as a page that failed to load
  // rather than as a summary somebody chose to shorten.
  const cut = text.slice(0, LABEL_LIMIT);
  const space = cut.lastIndexOf(' ');
  return `${space > LABEL_LIMIT / 2 ? cut.slice(0, space) : cut}…`;
}

export type CommunityChatThreadView = {
  label: string;
  root: ChatRiverRow;
  replies: ChatRiverRow[];
  /** `2 replies`, `1 reply`, or the sentence for a thread nobody has answered. */
  repliesLine: string;
};

/**
 * One thread, ready to draw.
 *
 * 🔴 **`repliesLine` COUNTS THE REPLIES WE ARE ABOUT TO DRAW, NOT `root.replyCount`.** This is
 * FIX-025 §7's rule arriving one surface later, and the reason is the same: the payload's count
 * is over rows and the array is over *visible* ones, so the moment moderation hides a message a
 * heading saying "3 replies" sits above two of them, sending a reader looking for a third that
 * is not coming.
 */
export function composeChatThread(thread: ChatThread): CommunityChatThreadView {
  const replies = thread.replies.map(rowFrom);
  return {
    label: chatThreadLabel(thread.root.blocks),
    root: rowFrom(thread.root),
    replies,
    repliesLine:
      replies.length === 0
        ? 'No replies yet — you could be the first.'
        : replies.length === 1
          ? '1 reply'
          : `${replies.length} replies`
  };
}
