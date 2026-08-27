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

export interface CommunityChatViewProps {
  view: CommunityChatView;
  density?: CommunityDensity;
  onSelectChannel: (key: string) => void;
  onOpenThread: (messageId: string) => void;
  onRetry: () => void;
  /** Absent means links are drawn and do nothing — never navigate. */
  onOpenLink?: (href: string) => void;
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

export function CommunityChatView({
  view,
  density = CommunityDensity.Page,
  onSelectChannel,
  onOpenThread,
  onRetry,
  onOpenLink
}: CommunityChatViewProps) {
  return (
    <div className={`${css['Chat']} ${css[`is-density-${density}`]}`}>
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
}

export function CommunityChatThread({
  state,
  density = CommunityDensity.Page,
  onBack,
  onRetry,
  onOpenLink
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
        </>
      )}
    </div>
  );
}
