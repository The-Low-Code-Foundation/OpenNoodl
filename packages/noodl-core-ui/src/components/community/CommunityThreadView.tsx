/**
 * NAT-007 — a thread, as a thing you read in the editor.
 *
 * ## What this replaced
 *
 * Clicking a thread called `platform.openExternal` and the answer to the question you asked from
 * inside the editor arrived somewhere the editor could not show you. That is the sentence the
 * phase is named after.
 *
 * ## 🔴 Every string here is the host's, already formatted
 *
 * This component reads no payload, parses no timestamp and interprets no attachment `kind`. The
 * editor hands it words. Two reasons, and the second is the one that decides it:
 *
 * 1. `noodl-core-ui` cannot import `noodl-editor`, and the attachment payload types are the
 *    platform's — they live over there with the client that receives them.
 * 2. 🔴 **Everything with a decision in it should be a function a test can call.** This repo's
 *    jest has no DOM, so `"2 input ports were not shared"` is gradeable and the pixel it lands on
 *    is not. `communityMeta.ts` made the same trade for row metadata and this file inherits it —
 *    which is why the interesting half of NAT-007 is specced in `models/community/threadview.ts`
 *    and only the *shape* of the drawing is specced here.
 *
 * ## ⚠️ The four states are not the section's four states, and the difference is AC8
 *
 * `CommunitySectionBody` distinguishes *loading / items / empty / unreachable*. A thread has no
 * `empty` — a thread with nothing in it does not exist, the platform returns 404 for one — and it
 * has something a section does not: **a copy we already have, which may be old**. So `ready`
 * carries `cachedSince`, and `unreachable` is the *never-opened* case that says it needs the
 * network. 🔴 Neither may render as *"no replies"*: a thread whose answers we could not fetch and
 * a thread nobody has answered are opposite facts, and the second is the one that makes a person
 * close the editor.
 *
 * @module noodl-core-ui/components/community/CommunityThreadView
 */

import React from 'react';

import { CommunityDensity } from './CommunityRow';
import { CommunityPostBody } from './CommunityPostBody';
import css from './Community.module.scss';
import type { PostBlock } from './postBlocks';

/**
 * NAT-015 — the one verb a rendered attachment may offer.
 *
 * 🔴 **One verb, and never an "edit and repost".** The fragment reached this editor because the
 * publish path redacted it on the way out; a UI that offered to send it back would round-trip
 * user content outward without passing that redaction a second time. *In is not a licence for
 * out* — see NAT-015's traps.
 *
 * ⚠️ `blockedReason` draws the verb **and refuses it**, with the reason. A fragment naming node
 * types this install does not have is the ordinary case, not an error, and the answer is a named
 * list — never a half-applied graph, which looks like it worked.
 */
export type CommunityAttachmentPull = {
  label: string;
  onPull: () => void;
  blockedReason?: string | null;
};

/** One published port, already turned into words by the host. */
export type CommunityAttachmentPort = { name: string; direction: string; value: string };

export type CommunityAttachmentView = {
  id: string;
  /** "Node excerpt", "Screenshot", "Graph fragment" — never a raw wire `kind`. */
  heading: string;
  /** The facets, formatted: the node type, the app version, the OS. */
  facts: string[];
  ports: CommunityAttachmentPort[];
  /**
   * 🔴 The redaction, made visible. UNI-016's scope calls an invisible one *"a hole"* rather than
   * privacy: an answerer who cannot see that something was held back wastes a reply asking for it.
   */
  withheldLine: string | null;
  note: string | null;
  pull?: CommunityAttachmentPull | null;
};

export type CommunityPostView = {
  id: string;
  /** "@handle". */
  author: string;
  /**
   * NAT-008 AC4 — the handle to open a profile with, when there is one.
   *
   * 🔴 **Separate from {@link author} rather than derived by stripping the `@`.** The author line
   * is *words* and the handle is an *identifier*; a renderer that reconstructed one from the other
   * would break the day a post is drawn as "someone" — which is exactly what `postView` does for a
   * payload with no handle, and exactly the case where there is nothing to open.
   */
  authorHandle?: string | null;
  /** "3 days ago", or `null` when the timestamp could not be read — never "NaN days ago". */
  when: string | null;
  accepted: boolean;
  blocks: PostBlock[];
  attachments: CommunityAttachmentView[];
};

export type CommunityThreadDetailView = {
  title: string;
  /** Author · when · how answered. */
  meta: string | null;
  question: CommunityPostView;
  answers: CommunityPostView[];
  /** "3 answers", or what an unanswered thread should say. Required, like `emptyLine`. */
  answersLine: string;
};

export type CommunityThreadState =
  /** 🔴 D15 refused this viewer. Draw NOTHING — not a message, not a frame. */
  | { state: 'hidden' }
  | { state: 'loading' }
  /**
   * The platform answered 404.
   *
   * ⚠️ **Distinct from `hidden`, and the host decides which — see `threadview.ts`.** A 404 is
   * deliberately the same answer for *this thread was removed* and *D15 says this surface does
   * not exist for you*, so a client that rendered this arm on every 404 would narrate a door.
   * The refusal is read off `me` before a thread is ever fetched; by the time this arm is
   * chosen, the viewer is one the community is shown to.
   */
  | { state: 'gone' }
  /** AC8 — never opened, and we cannot reach the platform. NOT an empty thread. */
  | { state: 'unreachable'; detail: string }
  /** `cachedSince` non-null means this is a copy we already had, and how old it is. */
  | { state: 'ready'; thread: CommunityThreadDetailView; cachedSince: string | null };

export interface CommunityThreadViewProps {
  state: CommunityThreadState;
  density?: CommunityDensity;
  onBack: () => void;
  onRetry: () => void;
  /** See {@link CommunityPostBody} — a link is a decided hand-off, never a navigation. */
  onOpenLink?: (href: string) => void;
  /**
   * NAT-008 AC4 — *"author lines everywhere become entry points."*
   *
   * ⚠️ Optional, and when it is absent the author line is drawn as plain text rather than as a
   * dead button. *"A directory nobody can reach from the content is a page nobody opens"* is the
   * criterion; a control that looks clickable and is not would be worse than the text it replaced.
   */
  onOpenPerson?: (handle: string) => void;
  /**
   * How to answer.
   *
   * 🔴 **Optional because D5 is open**, not because answering is optional. Until the ruling says
   * what authorises a write from a desktop client, the honest thing on this screen is a *labelled*
   * hand-off saying where the reply goes — which is what NAT-012 leaves `openExternal` for. A
   * screen with no way to answer at all would be the browser round trip with an extra step.
   */
  reply?: { line: string; actionLabel: string; onAction: () => void } | null;
}

function Attachment({ attachment }: { attachment: CommunityAttachmentView }) {
  return (
    <div className={css['Attachment']}>
      <div className={css['AttachmentHead']}>
        <span className={css['AttachmentHeading']}>{attachment.heading}</span>
        {attachment.facts.length > 0 && <span className={css['AttachmentFacts']}>{attachment.facts.join(' · ')}</span>}
      </div>

      {attachment.ports.length > 0 && (
        <ul className={css['AttachmentPorts']}>
          {attachment.ports.map((port) => (
            <li key={`${port.direction}:${port.name}`} className={css['AttachmentPort']}>
              <span className={css['AttachmentPortName']}>{port.name}</span>
              <span className={css['AttachmentPortValue']}>{port.value}</span>
            </li>
          ))}
        </ul>
      )}

      {attachment.withheldLine && <p className={css['AttachmentWithheld']}>{attachment.withheldLine}</p>}
      {attachment.note && <p className={css['AttachmentNote']}>{attachment.note}</p>}

      {attachment.pull && (
        <div className={css['AttachmentPull']}>
          <button
            type="button"
            className={css['PullButton']}
            onClick={attachment.pull.onPull}
            disabled={Boolean(attachment.pull.blockedReason)}
          >
            {attachment.pull.label}
          </button>
          {/* 🔴 The refusal is drawn beside the disabled verb, never instead of it. A verb that
              simply vanished would leave a reader wondering whether the feature exists; a named
              reason is what tells them which kit to install. */}
          {attachment.pull.blockedReason && (
            <p className={css['PullBlocked']}>{attachment.pull.blockedReason}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Post({
  post,
  isQuestion,
  onOpenLink,
  onOpenPerson,
  density
}: {
  post: CommunityPostView;
  isQuestion: boolean;
  onOpenLink?: (href: string) => void;
  onOpenPerson?: (handle: string) => void;
  density: CommunityDensity;
}) {
  const handle = post.authorHandle;
  return (
    <article className={`${css['Post']} ${post.accepted ? css['is-accepted'] : ''}`}>
      <header className={css['PostHead']}>
        {/* 🔴 NAT-008 AC4 — the author line is the entry point to a profile, and it is a `button`
            for `CommunityRow`'s reason: a `span` with an `onClick` is not focusable, not
            announced and not operable from a keyboard. ⚠️ Both branches draw the SAME text, so a
            thread rendered without a host to open profiles reads identically. */}
        {handle && onOpenPerson ? (
          <button type="button" className={css['PostAuthorLink']} onClick={() => onOpenPerson(handle)}>
            {post.author}
          </button>
        ) : (
          <span className={css['PostAuthor']}>{post.author}</span>
        )}
        {post.when && <span className={css['PostWhen']}>{post.when}</span>}
        {/* ⚠️ A word, not a tick. An icon alone carries the state only for people who already
            know the convention, and `common/Icon` cannot be loaded by this repo's jest at all. */}
        {post.accepted && <span className={css['PostAccepted']}>Accepted answer</span>}
        {isQuestion && <span className={css['PostAsked']}>asked</span>}
      </header>

      <CommunityPostBody blocks={post.blocks} density={density} onOpenLink={onOpenLink} />

      {post.attachments.map((attachment) => (
        <Attachment key={attachment.id} attachment={attachment} />
      ))}
    </article>
  );
}

/**
 * The thread, as a pure function of what the host handed it.
 *
 * 🔴 Hook-free, like `CommunityTab` — see `renderElements.ts`. The `hidden` arm returning `null`
 * is only assertable with a not-hidden control beside it, and a hook here would take both arms
 * down instead.
 */
export function CommunityThreadView({
  state,
  density = CommunityDensity.Page,
  onBack,
  onRetry,
  onOpenLink,
  onOpenPerson,
  reply
}: CommunityThreadViewProps) {
  // 🔴 D15: the platform said this thread does not exist for this viewer, and a 404 for a refused
  // surface is deliberately indistinguishable from a 404 for a missing row. Draw NOTHING — a
  // "you do not have permission" rendered from a 404 is the sentence `docs/API.md` §4 exists to
  // prevent, because it narrates a door to somebody who was never told there was one.
  if (state.state === 'hidden') return null;

  const back = (
    <button type="button" className={css['ThreadBack']} onClick={onBack}>
      ← Back
    </button>
  );

  if (state.state === 'loading') {
    return (
      <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
        {back}
        <div className={css['Loading']}>
          <span className={css['LoadingPulse']} aria-hidden="true" />
          <p className={css['StateLine']}>Loading…</p>
        </div>
      </div>
    );
  }

  if (state.state === 'gone') {
    return (
      <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
        {back}
        {/* ⚠️ Says WHAT, never WHY. "Removed by a moderator" would be a guess, and "you do not
            have permission" is the sentence `docs/API.md` §4 forbids a client to render from a
            404 — the status code carries neither fact. */}
        <p className={css['StateLine']}>This thread is not available. It may have been removed.</p>
      </div>
    );
  }

  if (state.state === 'unreachable') {
    return (
      <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
        {back}
        <div className={css['Unreachable']}>
          {/* 🔴 AC8. This is the never-opened case and it says so in those words. Rendering it as
              a thread with no answers would tell a reader nobody has helped them, which is the
              one thing a person offline must not be told. */}
          <p className={css['StateLine']}>
            This thread has not been opened on this machine yet, so there is no copy to read
            offline. It needs the network ({state.detail}).
          </p>
          <button type="button" className={css['RetryButton']} onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { thread, cachedSince } = state;

  return (
    <div className={`${css['Thread']} ${css[`is-density-${density}`]}`}>
      {back}

      <h2 className={css['ThreadTitle']}>{thread.title}</h2>
      {thread.meta && <p className={css['ThreadMeta']}>{thread.meta}</p>}

      {/* 🔴 AC8's other half — a copy, admitting its age. `cachedSince` is words, so a reader
          learns WHEN rather than that something vague is stale. */}
      {cachedSince && (
        <p className={css['ThreadCached']}>
          Showing a copy saved {cachedSince}. The community could not be reached just now.
        </p>
      )}

      <Post post={thread.question} isQuestion onOpenLink={onOpenLink} onOpenPerson={onOpenPerson} density={density} />

      <h3 className={css['ThreadAnswersHead']}>{thread.answersLine}</h3>

      {thread.answers.map((answer) => (
        <Post
          key={answer.id}
          post={answer}
          isQuestion={false}
          onOpenLink={onOpenLink}
          onOpenPerson={onOpenPerson}
          density={density}
        />
      ))}

      {reply && (
        <div className={css['ThreadReply']}>
          <p className={css['StateLine']}>{reply.line}</p>
          <button type="button" className={css['RetryButton']} onClick={reply.onAction}>
            {reply.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
