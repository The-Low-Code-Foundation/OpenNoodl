/**
 * FB-013 C4 — the chat river, in the launcher.
 *
 * ## 🔴 A message is NOT a card, and that is why this is not `CommunityRow`
 *
 * C3 met this on the web and the finding transfers unchanged: `CommunityRow` draws a **title**
 * with a meta line under it, and a chat message *has no title*. Rendering one through that
 * component would mean deriving a headline for every row — and a river of derived headlines is
 * precisely the forum this feature sits beside rather than inside. The body is drawn in full,
 * as the web's river draws it, through the same {@link CommunityPostBody} the Bench's thread
 * pane already uses.
 *
 * ⚠️ **What is shared is therefore the section machinery, not the row.** The four states, the
 * empty line, the retry and the pill markup all come from the same places the Bench and the
 * directory use, so a fifth list does not mean a fifth set of styles to keep in step.
 *
 * ## 🔴 The whole row is NOT the click target, and it cannot be
 *
 * A message body may contain links, and `CommunityPostBody` draws them as real anchors. A
 * `<button>` wrapping them would nest interactive elements — invalid, and ambiguous for both a
 * pointer and a screen reader, which is the state `CommunityRow`'s own header describes fixing
 * in the other direction. So the way into a thread is an explicit control in the row's foot,
 * which is also where the web puts its permalink.
 *
 * @module noodl-core-ui/components/community/CommunityChatView
 */

import React from 'react';

import { FilterPill } from './CommunityFilterPill';
import { CommunityDensity } from './CommunityRow';
import { CommunityPostBody } from './CommunityPostBody';
import { CommunitySectionBody, type CommunitySectionState } from './CommunitySectionBody';
import type { CommunityReplyBox } from './CommunityThreadView';
import type { PostBlock } from './postBlocks';
import { metaLine, relativeTime } from './communityMeta';
import css from './Community.module.scss';

/**
 * One message, as the river draws it.
 *
 * ⚠️ Mirrors `chatview.ChatRiverRow` field for field. Times arrive raw and are formatted here,
 * exactly as `CommunityBenchRow`'s are — the rules live in `communityMeta.ts`, where a spec can
 * grade them without a DOM.
 */
export type CommunityChatRow = {
  id: string;
  channel: string;
  authorHandle: string;
  blocks: PostBlock[];
  createdAt: string;
  replyCount: number;
  edited: boolean;
};

export type CommunityChatFilterPill = {
  key: string;
  label: string;
  count: number;
  active: boolean;
};

export type CommunityChatView = {
  section: CommunitySectionState<CommunityChatRow>;
  filters: CommunityChatFilterPill[];
  summary: string | null;
  /** 🔴 Required and per-channel — "nobody has started anything" and "nothing in #collab" are
      different news, and the second one has to say what the channel is for. */
  emptyLine: string;
};

/** One entry in the composer's channel `<select>`. See `chatwrites.ts`'s `CHANNEL_OPTIONS`. */
export type ChatChannelOption = { key: string; label: string; purpose: string };

/**
 * FB-013 — "start something", above the river.
 *
 * 🔴 **Two arms, `threadwrites.CommunityReplyBox`'s reasoning applied to the starter.** D5 gives
 * the editor the browser's own session scope, so a signed-in reader gets `composer`; a signed-out
 * one gets a labelled hand-off rather than a sign-in line with nothing behind it, because this
 * panel has no sign-in control of its own (UNI-001 put that on the launcher card).
 *
 * ⚠️ `value`, `channel` and every callback are the HOST's state — this component may not call a
 * hook. See {@link CommunityReplyBox} one file along for the same rule and the same reason.
 */
export type CommunityChatComposerBox =
  | { kind: 'handoff'; line: string; actionLabel: string; onAction: () => void }
  | {
      kind: 'composer';
      /** The whole closed vocabulary — a `<select>`, not a free-text tag box. See `chatview.ts`. */
      channels: ChatChannelOption[];
      channel: string;
      onChannelChange: (next: string) => void;
      value: string;
      onChange: (next: string) => void;
      onSubmit: () => void;
      submitLabel: string;
      canSubmit: boolean;
      /** Non-null only when there is something worth SAYING — `CommunityReplyBox`'s rule. */
      blockedReason: string | null;
      busy: boolean;
      error: string | null;
      note: string | null;
    };

export interface CommunityChatViewProps {
  view: CommunityChatView;
  density?: CommunityDensity;
  onSelectChannel: (key: string) => void;
  onOpenThread: (messageId: string) => void;
  onRetry: () => void;
  /** Absent means links are drawn and do nothing — never navigate. */
  onOpenLink?: (href: string) => void;
  /**
   * How to start a conversation — see {@link CommunityChatComposerBox}.
   *
   * ⚠️ Optional, and absent means no host wired it: a story, or a spec grading the read half
   * alone, draws the river with no way to start something — honest, because that host cannot
   * post either.
   */
  composer?: CommunityChatComposerBox | null;
}

/**
 * The foot's reply control.
 *
 * ⚠️ **A thread with no replies is still openable**, and the label says which it is. Hiding the
 * control on `0` would make the only way to reply to a quiet message... replying to a busy one.
 */
function replyLabel(count: number): string {
  if (count === 0) return 'Open — no replies yet';
  return count === 1 ? '1 reply' : `${count} replies`;
}

/**
 * ⚠️ **`onOpenThread` is optional and the foot is drawn only when it is supplied.** Inside a
 * thread the reader is already in, an "Open — no replies yet" control points at the page it is
 * on: a dead button that reads as broken rather than as absent. The river supplies the handler;
 * the thread pane does not, and that is the whole difference between the two placements.
 */
function ChatMessageRow({
  row,
  density,
  onOpenThread,
  onOpenLink
}: {
  row: CommunityChatRow;
  density: CommunityDensity;
  onOpenThread?: (messageId: string) => void;
  onOpenLink?: (href: string) => void;
}) {
  return (
    <article className={`${css['Message']} ${css[`is-density-${density}`]}`}>
      <div className={css['MessageHead']}>
        <span className={css['PostAuthor']}>@{row.authorHandle}</span>
        <span className={`${css['Chip']} ${css['is-tone-accent']}`}>#{row.channel}</span>
        {/* ⚠️ `metaLine` drops the parts that came back null, so an unreadable timestamp
            leaves the row without a meta line rather than with the word "null" in it. */}
        <span className={css['PostWhen']}>{metaLine([relativeTime(row.createdAt), row.edited ? 'edited' : null])}</span>
      </div>

      <CommunityPostBody blocks={row.blocks} density={density} onOpenLink={onOpenLink} />

      {onOpenThread && (
        <div className={css['MessageFoot']}>
          <button
            type="button"
            className={css['GhostButton']}
            data-test={`community-chat-open-${row.id}`}
            onClick={() => onOpenThread(row.id)}
          >
            {replyLabel(row.replyCount)}
          </button>
        </div>
      )}
    </article>
  );
}

/**
 * The starter, above the river — "starting something is the page's first verb", `ChatRiver`'s
 * own note on the web, carried here unchanged.
 */
function ChatStarter({ composer }: { composer: CommunityChatComposerBox }) {
  if (composer.kind === 'handoff') {
    return (
      <div className={css['ThreadReply']}>
        <p className={css['StateLine']}>{composer.line}</p>
        <button type="button" className={css['RetryButton']} onClick={composer.onAction}>
          {composer.actionLabel}
        </button>
      </div>
    );
  }

  return (
    <div className={css['ThreadReply']}>
      <label className={css['ReplyLabel']} htmlFor={STARTER_CHANNEL_FIELD_ID}>
        Channel
      </label>
      {/* 🔴 A `<select>` of the whole closed vocabulary, not a free-text tag box — D19 excluded
          user-created categories and `FB-013-SCOPE.md` §8 leaves free tags shut. The platform
          refuses an unknown channel independently; this control is the message, not the gate. */}
      <select
        id={STARTER_CHANNEL_FIELD_ID}
        className={css['ComposerSelect']}
        value={composer.channel}
        disabled={composer.busy}
        onChange={(event) => composer.onChannelChange(event.target.value)}
      >
        {composer.channels.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      {/* AC4's sentence at the moment it is useful — choosing where something goes is the one
          time a reader needs to know what a channel is for. Same string the quiet-channel empty
          line draws, one owner: `CHANNEL_PURPOSE`. */}
      <p className={css['ReplyBlocked']}>
        {composer.channels.find((option) => option.key === composer.channel)?.purpose}
      </p>

      <label className={css['ReplyLabel']} htmlFor={STARTER_BODY_FIELD_ID}>
        Say something
      </label>
      <textarea
        id={STARTER_BODY_FIELD_ID}
        className={css['ReplyInput']}
        value={composer.value}
        placeholder="What is on your mind?"
        rows={4}
        spellCheck
        disabled={composer.busy}
        onChange={(event) => composer.onChange(event.target.value)}
      />

      <div className={css['ReplyActions']}>
        <button
          type="button"
          className={css['ReplySubmit']}
          onClick={composer.onSubmit}
          disabled={!composer.canSubmit || composer.busy}
        >
          {composer.submitLabel}
        </button>
        {composer.blockedReason && <p className={css['ReplyBlocked']}>{composer.blockedReason}</p>}
      </div>

      {composer.error && (
        <p className={css['ReplyError']} role="alert">
          {composer.error}
        </p>
      )}
      {composer.note && <p className={css['ReplyNote']}>{composer.note}</p>}
    </div>
  );
}

/** See the labels above — constants because this component may not call `useId`. */
const STARTER_CHANNEL_FIELD_ID = 'community-chat-starter-channel';
const STARTER_BODY_FIELD_ID = 'community-chat-starter-body';

export function CommunityChatView({
  view,
  density = CommunityDensity.Page,
  onSelectChannel,
  onOpenThread,
  onRetry,
  onOpenLink,
  composer
}: CommunityChatViewProps) {
  return (
    <div className={`${css['Chat']} ${css[`is-density-${density}`]}`}>
      {composer && <ChatStarter composer={composer} />}

      {view.filters.length > 0 && (
        /* ⚠️ A named group, as the Bench's is: five pills labelled "All channels" and "#lounge"
           say what they select and not what they are selecting from. */
        <div className={css['ChipRow']} role="group" aria-label="Show channels">
          {view.filters.map((filter) => (
            <FilterPill
              key={filter.key}
              filter={filter}
              dataTest={`community-chat-filter-${filter.key}`}
              onSelect={onSelectChannel}
            />
          ))}
        </div>
      )}

      {view.summary && <p className={css['DirectorySummary']}>{view.summary}</p>}

      <CommunitySectionBody state={view.section} emptyLine={view.emptyLine} onRetry={onRetry} density={density}>
        {(rows) =>
          rows.map((row) => (
            <ChatMessageRow
              key={row.id}
              row={row}
              density={density}
              onOpenThread={onOpenThread}
              onOpenLink={onOpenLink}
            />
          ))
        }
      </CommunitySectionBody>
    </div>
  );
}

/**
 * One thread, drawn **in place of** the river.
 *
 * 🔴 **THE HEADING IS DERIVED FROM THE OPENING MESSAGE AND IS NOT A COLUMN.** Scope §3 refuses a
 * title field, because asking an author for a headline is exactly what makes readers scan
 * headlines instead of reading messages — the "forum level complexity" the report rules out. The
 * derivation lives in `chatview.chatThreadLabel`, mirroring the platform's `threadLabel`, so the
 * same thread carries the same name on both surfaces.
 */
export type CommunityChatThreadState =
  | { state: 'closed' }
  | { state: 'loading' }
  | {
      state: 'open';
      label: string;
      root: CommunityChatRow;
      replies: CommunityChatRow[];
      repliesLine: string;
    }
  | { state: 'unreachable'; detail: string };

export interface CommunityChatThreadProps {
  state: CommunityChatThreadState;
  density?: CommunityDensity;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink?: (href: string) => void;
  /**
   * How to reply — see `chatwrites.composeChatReplyBox`. Reuses the bench's own
   * {@link CommunityReplyBox}: one field, one submit, one platform sentence. Optional and, for
   * {@link CommunityChatViewProps.composer}'s reason, absent means no host wired it.
   */
  reply?: CommunityReplyBox | null;
}

export function CommunityChatThread({
  state,
  density = CommunityDensity.Page,
  onBack,
  onRetry,
  onOpenLink,
  reply
}: CommunityChatThreadProps) {
  if (state.state === 'closed') return null;

  return (
    <div className={css['Thread']}>
      <button type="button" className={css['ThreadBack']} data-test="community-chat-back" onClick={onBack}>
        ← Back
      </button>

      {state.state === 'loading' && <p className={css['StateLine']}>Loading…</p>}

      {state.state === 'unreachable' && (
        <div className={css['Unreachable']}>
          <p className={css['StateLine']}>{state.detail}</p>
          <button type="button" className={css['RetryButton']} onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {state.state === 'open' && (
        <>
          <h3 className={css['ThreadTitle']}>{state.label}</h3>

          <ChatMessageRow row={state.root} density={density} onOpenLink={onOpenLink} />

          {/* ⚠️ Counts the replies being DRAWN, never the payload's `replyCount` — see
              `composeChatThread`. A heading over a different number of messages than are on the
              screen sends a reader looking for one that is not coming. */}
          <p className={css['ThreadAnswersHead']}>{state.repliesLine}</p>

          {state.replies.map((reply) => (
            <ChatMessageRow key={reply.id} row={reply} density={density} onOpenLink={onOpenLink} />
          ))}

          {reply?.kind === 'handoff' && (
            <div className={css['ThreadReply']}>
              <p className={css['StateLine']}>{reply.line}</p>
              <button type="button" className={css['RetryButton']} onClick={reply.onAction}>
                {reply.actionLabel}
              </button>
            </div>
          )}

          {reply?.kind === 'composer' && (
            <div className={css['ThreadReply']}>
              <label className={css['ReplyLabel']} htmlFor={REPLY_FIELD_ID}>
                {reply.label}
              </label>
              <textarea
                id={REPLY_FIELD_ID}
                className={css['ReplyInput']}
                value={reply.value}
                placeholder={reply.placeholder}
                rows={4}
                spellCheck
                disabled={reply.busy}
                onChange={(event) => reply.onChange(event.target.value)}
              />

              <div className={css['ReplyActions']}>
                <button
                  type="button"
                  className={css['ReplySubmit']}
                  onClick={reply.onSubmit}
                  disabled={!reply.canSubmit || reply.busy}
                >
                  {reply.submitLabel}
                </button>
                {reply.blockedReason && <p className={css['ReplyBlocked']}>{reply.blockedReason}</p>}
              </div>

              {reply.error && (
                <p className={css['ReplyError']} role="alert">
                  {reply.error}
                </p>
              )}
              {reply.note && <p className={css['ReplyNote']}>{reply.note}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** See the label above — a constant because this component may not call `useId`. */
const REPLY_FIELD_ID = 'community-chat-reply';
