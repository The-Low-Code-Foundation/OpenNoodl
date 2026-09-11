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

/**
 * FB-007 AC4 — a capture the host has decided may be drawn.
 *
 * 🔴 **THE HOST DECIDES, AND THIS COMPONENT DOES NOT RE-DERIVE IT.** `src` is a finished
 * absolute URL; there is no base, no key and no path-building here. That is the same split
 * every other field on {@link CommunityAttachmentView} uses, and it matters more for this one:
 * *may this editor fetch a remote image at all* is NAT-008's ruling, narrowly reversed for this
 * one class by `threadview.ts`'s `attachmentImage`, which is where the argument is written down.
 * A renderer that composed the URL itself would be a second place that decision lived.
 */
export type CommunityAttachmentImage = {
  src: string;
  /** The SENDER's dimensions, used only to reserve the box. `null` when they were not sent. */
  width: number | null;
  height: number | null;
  alt: string;
};

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
  /** FB-007 — the picture, when there is one and the host says it may be fetched. */
  image?: CommunityAttachmentImage | null;
  pull?: CommunityAttachmentPull | null;
};

/**
 * NAT-007 AC6 — the one write a post itself offers.
 *
 * 🔴 **Drawn only where the host says so, and the host's rule is in `threadwrites.ts`.** This
 * component does not know who asked the question; it knows that a post either carries this or
 * does not. That is deliberate — *"only the person who asked may accept an answer"* is the
 * platform's rule, enforced in `acceptAnswer`'s transaction, and a renderer that re-derived it
 * from an author line would be a second copy of a rule that already has one owner.
 *
 * ⚠️ `error` is the platform's own words about the LAST attempt on THIS post. A refusal drawn
 * against every answer at once would tell four people's posts about one person's failure.
 */
export type CommunityPostAccept = {
  label: string;
  /** What the verb says while the request is in flight — never the same string as {@link label}. */
  busyLabel: string;
  busy: boolean;
  onAccept: () => void;
  error?: string | null;
};

/**
 * FB-001 — the author's own two verbs on their own post.
 *
 * > *"Right now in the community I can't edit or delete the questions I added to the bench."*
 *
 * 🔴 **ONE FIELD FOR TWO VERBS, because they are one affordance: "this post is mine".** Edit
 * is offered on any post its author wrote; delete is a THREAD verb — D7 ruled *delete own
 * thread*, not own post — so {@link remove} is non-null only on the question, and only while
 * the platform would accept it. `threadwrites.ts` decides both; this renders what it is given.
 *
 * ⚠️ **Like {@link CommunityPostAccept}, this component re-derives NOTHING.** It does not
 * compare handles and does not know who the viewer is. A renderer that worked out ownership
 * from the author line would be a second copy of a rule whose owner is `editPost`'s
 * `[bench-edit-not-author]`, in a layer that cannot see `author_account_id` at all.
 *
 * 🔴 **{@link composer} is the same shape as the reply box's composer arm and for the same
 * reason**: `value` is the HOST's state, because `renderElements.ts` cannot evaluate a
 * component that calls a hook, and every criterion here is a claim about what was drawn.
 */
export type CommunityPostEdit = {
  /** Opens the composer. Fetching the markdown source is the host's job — see `postSource`. */
  editLabel: string;
  onEdit: () => void;
  /** Non-null only on the question, for its author. `null` on every answer. */
  remove: { label: string; busyLabel: string; busy: boolean; onRemove: () => void } | null;
  /**
   * Non-null while this post is open for editing. When it is, the body is REPLACED by it —
   * a post showing its rendered blocks and an edit box at once is two versions of the same
   * words on screen, and the reader has to work out which one they are changing.
   */
  composer: {
    label: string;
    value: string;
    onChange: (next: string) => void;
    onSave: () => void;
    onCancel: () => void;
    saveLabel: string;
    canSave: boolean;
    /** ⚠️ Non-null only when there is something worth saying — `CommunityReplyBox`'s rule. */
    blockedReason: string | null;
    busy: boolean;
  } | null;
  /** The platform's own words about the last attempt on THIS post. */
  error: string | null;
};

/**
 * NAT-007 AC4 — how this screen offers to answer.
 *
 * 🔴 **Two arms, because there are two honest answers and they are not the same shape.** Before
 * D5 was settled the only arm was `handoff`: a *labelled* browser round trip, which is what
 * NAT-012 leaves `openExternal` for. D5 settled on 2026-08-20 — the editor gets the same session
 * scope as the browser — so a signed-in reader gets `composer` and posts from here. A reader who
 * is signed out still gets `handoff`, because the thread is readable signed out and a screen with
 * no way to answer at all would be the browser round trip with an extra step in front of it.
 *
 * ⚠️ **`value` is the host's**, not this component's state. `renderElements.ts` cannot evaluate a
 * component that calls a hook, and every criterion on this screen is a claim about what it drew.
 */
export type CommunityReplyBox =
  | { kind: 'handoff'; line: string; actionLabel: string; onAction: () => void }
  | {
      kind: 'composer';
      /** The label above the box. */
      label: string;
      placeholder: string;
      value: string;
      onChange: (next: string) => void;
      onSubmit: () => void;
      submitLabel: string;
      /** False disables the verb. See {@link blockedReason} for why that is a separate field. */
      canSubmit: boolean;
      /**
       * ⚠️ **Non-null only when there is something worth SAYING**, which is not the same as
       * `!canSubmit`. An empty box explains itself and a sentence under it would be scolding;
       * being 412 characters over a limit the reader cannot see does not explain itself at all.
       */
      blockedReason: string | null;
      busy: boolean;
      /** 🔴 The send failed and {@link value} still holds the text — AC4 in one field. */
      error: string | null;
      /** It worked. */
      note: string | null;
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
  /**
   * NAT-007 AC6 — *"accepting an answer works from the editor if you are the asker"*.
   *
   * ⚠️ Absent on almost every post, and that is the ordinary case rather than a missing feature:
   * a question is never accepted, an answer is accepted only by the person who asked, and once a
   * thread has an accepted answer nothing here offers to move it. See `threadwrites.ts`.
   */
  accept?: CommunityPostAccept | null;
  /**
   * FB-001 — *"I can't edit or delete the questions I added to the bench."*
   *
   * ⚠️ Absent on every post but your own, which is the ordinary case. See
   * {@link CommunityPostEdit}.
   */
  edit?: CommunityPostEdit | null;
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
  | {
      state: 'ready';
      thread: CommunityThreadDetailView;
      cachedSince: string | null;
      /**
       * 🔴 NAT-007 AC4 — *"your answer was posted; this copy predates it"*.
       *
       * ⚠️ **Only ever set alongside `cachedSince`**, and it is the sentence that stops the cached
       * arm from reading as *your answer vanished*. `threadview.ts`'s `postedNote` carries the
       * argument; the short version is that every other word on a cached screen is true, which is
       * what makes the missing answer invisible.
       */
      postedNote?: string | null;
    };

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
   * How to answer — see {@link CommunityReplyBox} for the two arms and why there are two.
   *
   * ⚠️ Still optional, and no longer because D5 is open. A host with no session store wired at all
   * (a story, a spec grading the read half) passes nothing and the screen draws no answering
   * affordance — which is honest, because that host cannot post either.
   */
  reply?: CommunityReplyBox | null;
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

      {/* 🔴 FB-007 — ABOVE the withheld line and the note, because those two describe the
          picture. The consent record reading "3 port values were not shared" sits under the
          thing it is about, which is the same order the web thread uses. */}
      {attachment.image && (
        <img
          className={css['AttachmentImage']}
          src={attachment.image.src}
          width={attachment.image.width ?? undefined}
          height={attachment.image.height ?? undefined}
          alt={attachment.image.alt}
          loading="lazy"
        />
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

      {/* 🔴 FB-001 — the composer REPLACES the body rather than sitting under it. Two copies of
          the same words on one screen leaves the reader working out which one they are
          editing, and the attachments go with it: D7's scope is the BODY, so a composer that
          drew them would imply they are part of what is being changed. */}
      {post.edit?.composer ? (
        <div className={css['PostEditor']}>
          <label className={css['PostEditorLabel']} htmlFor={`edit-${post.id}`}>
            {post.edit.composer.label}
          </label>
          <textarea
            id={`edit-${post.id}`}
            className={css['PostEditorBox']}
            value={post.edit.composer.value}
            rows={10}
            onChange={(event) => post.edit!.composer!.onChange(event.target.value)}
          />
          {post.edit.composer.blockedReason && (
            <p className={css['PostEditorBlocked']}>{post.edit.composer.blockedReason}</p>
          )}
          <div className={css['PostEditRow']}>
            <button
              type="button"
              className={css['AcceptButton']}
              onClick={post.edit.composer.onSave}
              disabled={!post.edit.composer.canSave || post.edit.composer.busy}
            >
              {post.edit.composer.saveLabel}
            </button>
            <button
              type="button"
              className={css['PostEditQuiet']}
              onClick={post.edit.composer.onCancel}
              disabled={post.edit.composer.busy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <CommunityPostBody blocks={post.blocks} density={density} onOpenLink={onOpenLink} />

          {post.attachments.map((attachment) => (
            <Attachment key={attachment.id} attachment={attachment} />
          ))}
        </>
      )}

      {/* 🔴 NAT-007 AC6. The verb is drawn UNDER the answer it is about, never in a toolbar at the
          top of the thread: "accept" is a claim about one post, and a control that floated free of
          the words it refers to is how somebody accepts the answer above the one they read. */}
      {post.accept && (
        <div className={css['PostAccept']}>
          <button
            type="button"
            className={css['AcceptButton']}
            onClick={post.accept.onAccept}
            disabled={post.accept.busy}
          >
            {post.accept.busy ? post.accept.busyLabel : post.accept.label}
          </button>
          {/* ⚠️ The platform's own refusal, beside the verb that earned it. `role="alert"` because
              a person who clicked and saw nothing change has no other way to learn it failed. */}
          {post.accept.error && (
            <p className={css['AcceptError']} role="alert">
              {post.accept.error}
            </p>
          )}
        </div>
      )}

      {/* 🔴 FB-001 — under the post they change, for `accept`'s reason one block up: a verb
          that floated free of the words it refers to is how somebody edits the post above the
          one they read. ⚠️ Hidden while the composer is open — its own Save and Cancel are
          the verbs then, and an "Edit" button beside them would be a third thing to press. */}
      {post.edit && !post.edit.composer && (
        <div className={css['PostEditRow']}>
          <button type="button" className={css['PostEditQuiet']} onClick={post.edit.onEdit}>
            {post.edit.editLabel}
          </button>
          {post.edit.remove && (
            <button
              type="button"
              className={css['PostEditQuiet']}
              onClick={post.edit.remove.onRemove}
              disabled={post.edit.remove.busy}
            >
              {post.edit.remove.busy ? post.edit.remove.busyLabel : post.edit.remove.label}
            </button>
          )}
        </div>
      )}
      {/* ⚠️ Outside the row above, so a refusal is still drawn while the composer is open —
          which is exactly when a save has just failed and the text is still in the box. */}
      {post.edit?.error && (
        <p className={css['AcceptError']} role="alert">
          {post.edit.error}
        </p>
      )}
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

  const { thread, cachedSince, postedNote } = state;

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

      {/* 🔴 Under the cached banner, not under the composer: a reader looking at a list that does
          not contain their answer is looking HERE, at the list. */}
      {postedNote && <p className={css['ThreadPosted']}>{postedNote}</p>}

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
          {/*
            ⚠️ A real `<label htmlFor>` rather than a placeholder standing in for one. A
            placeholder disappears the moment somebody types, so a person who looks away mid-answer
            comes back to an unlabelled box — and a screen reader announces nothing at all.

            🔴 The id is a constant rather than a `useId`. This component is hook-free on purpose
            (see `renderElements.ts`), and the two surfaces that draw it — the rail panel and the
            launcher tab — live in different windows, so one thread view is drawn per document.
          */}
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
            // 🔴 AC4 — disabled while the request is in flight, so a second click cannot post the
            // same answer twice. The TEXT is never cleared here; only a confirmed `ok` clears it,
            // and that happens in the host.
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

          {/* 🔴 AC4's whole point: this sentence appears and the text above it does not move. */}
          {reply.error && (
            <p className={css['ReplyError']} role="alert">
              {reply.error}
            </p>
          )}
          {reply.note && <p className={css['ReplyNote']}>{reply.note}</p>}
        </div>
      )}
    </div>
  );
}

/** See the label above — a constant because this component may not call `useId`. */
const REPLY_FIELD_ID = 'community-thread-reply';
