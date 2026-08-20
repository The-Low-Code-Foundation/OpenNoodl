/**
 * NAT-007 — what a thread looks like, as data.
 *
 * ## Why this is a module and not a component
 *
 * The same reason `mirrorview.ts` is: **there is no DOM in this repo's jest run**, so every
 * decision with a word in it — which sentence an unanswered thread gets, how a withheld port is
 * described, whether the surface exists at all — lives where a spec can reach it.
 * `CommunityThreadView.tsx` places what this returns and interprets nothing.
 *
 * ⚠️ NAT-005 found that a React *element tree* is gradeable here too, so the component is not
 * beyond reach any more. That does not move these decisions: a walk over elements can tell you
 * a string appeared, and a call to {@link withheldLine} can tell you it is the right string for
 * three ports rather than for one.
 *
 * ## 🔴 D15 is read off `me`, BEFORE a thread is fetched
 *
 * `composeMirror` checks `absent` first and on `me` alone, and this file does the same for the
 * same reason — but there is a second, sharper reason here. The platform answers **404** both for
 * *this thread was removed* and for *D15 says this surface does not exist for you*, deliberately
 * and identically, so that a pupil cannot tell them apart. A client that decided *"hidden"* from
 * a thread's 404 would therefore be right sometimes and would show a blank screen to everybody
 * else who clicked a dead link; a client that decided *"not available"* from it would narrate the
 * door. Neither is a reading of the 404 — the refusal is a fact about the **viewer**, and that is
 * where it is read.
 *
 * @module noodl-editor/models/community/threadview
 */

import {
  metaLine,
  relativeTime,
  replyLatency,
  type CommunityAttachmentPort,
  type CommunityAttachmentPull,
  type CommunityAttachmentView,
  type CommunityPostView,
  type CommunityThreadDetailView,
  type CommunityThreadState,
  type PostBlock as CoreUiPostBlock
} from '@noodl-core-ui/components/community';

import type { MeResponse, Read, ThreadAttachment, ThreadDetail, ThreadPost } from './communityapi';
import type { PostBlock } from './postbody';
import { acceptFor, isAsker, type AcceptOffer } from './threadwrites';

export type { CommunityThreadState, CommunityThreadDetailView };

/**
 * 🔴 THE DRIFT GUARD, AND IT IS THE COMPILER RATHER THAN A READER.
 *
 * `noodl-core-ui` cannot import `noodl-editor`, so the post-body model is declared twice — once
 * in `postbody.ts` (what the parser and the wire reader produce) and once in core-ui's
 * `postBlocks.ts` (what the renderer draws). Two declarations of one model is the arrangement
 * this phase keeps paying for: a fix lands on one of them.
 *
 * ⚠️ A grep cannot catch it and neither can a runtime spec — both sides compile happily while
 * disagreeing. These two aliases are a **question about the types**, asked in both directions, so
 * `typecheck:editor` fails the day either side grows a variant the other does not have.
 * ✅ Exported rather than local so `noUnusedLocals` cannot decide they are dead.
 */
export type AssertAssignable<T extends U, U> = T;
export type EditorBlocksFitTheRenderer = AssertAssignable<PostBlock, CoreUiPostBlock>;
export type RendererBlocksFitTheEditor = AssertAssignable<CoreUiPostBlock, PostBlock>;

// ── The words ─────────────────────────────────────────────────────────────────

/**
 * What an attachment is called on screen.
 *
 * 🔴 **The wire `kind` is never shown**, even as a fallback. `attachment_kind` is an open enum on
 * the platform and a client that printed an unrecognised one would render `lesson_step` at a
 * reader — a database column's spelling, in a sentence somebody is trying to read. The unknown
 * case says the true thing it knows: there is an attachment here.
 */
export function attachmentHeading(kind: string): string {
  if (kind === 'node_excerpt') return 'Node excerpt';
  if (kind === 'capture') return 'Screenshot';
  if (kind === 'graph_fragment') return 'Graph fragment';
  if (kind === 'lesson_step') return 'Lesson step';
  return 'Attachment';
}

/**
 * The facets, as a strip.
 *
 * ⚠️ Read from `facets`, never from `payload`. The facets are **derived by the platform's
 * database** — `nodeartifact.ts` says so from the other end — so a sender cannot disagree with
 * them, and the same three strings are what the Bench filters on. A renderer that read the
 * payload instead would show one thing beside a filter chip that said another.
 */
export function attachmentFacts(attachment: ThreadAttachment): string[] {
  return [attachment.facets.nodeType, attachment.facets.appVersion, attachment.facets.os].filter(
    (fact): fact is string => typeof fact === 'string' && fact.trim() !== ''
  );
}

/**
 * The port values the sender chose to publish.
 *
 * ⚠️ A port with a `null` value is a port that was shared and had nothing in it, which is a
 * different fact from a port that was withheld — the second is counted by {@link withheldLine}
 * and never appears here. Saying "(empty)" is what keeps them apart on screen.
 */
export function attachmentPorts(attachment: ThreadAttachment): CommunityAttachmentPort[] {
  const raw = attachment.payload.ports;
  if (!Array.isArray(raw)) return [];
  const out: CommunityAttachmentPort[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const port = entry as Record<string, unknown>;
    const name = typeof port.name === 'string' ? port.name : null;
    if (!name) continue;
    out.push({
      name,
      direction: port.direction === 'output' ? 'output' : 'input',
      value: typeof port.value === 'string' ? port.value : '(empty)'
    });
  }
  return out;
}

/**
 * The redaction, in words.
 *
 * 🔴 **The count comes from `facets.portsWithheld`, which is a GENERATED column** over the
 * payload's `withheldPorts` array — so a sender cannot understate it, and this editor is not
 * trusted to recount it. UNI-016's scope calls an invisible redaction *"a hole"* rather than
 * privacy: an answerer who cannot see that something was held back spends a reply asking for it.
 */
export function withheldLine(attachment: ThreadAttachment): string | null {
  const withheld = attachment.facets.portsWithheld;
  if (!Number.isFinite(withheld) || withheld <= 0) return null;
  return withheld === 1
    ? '1 port value was not shared.'
    : `${withheld} port values were not shared.`;
}

/**
 * The heading over the answers.
 *
 * 🔴 **An unanswered thread does not say "0 answers".** It is the row the health readout counts
 * as `unreplied` and the one a person opened the editor hoping to change; a count of zero reads
 * as a system state, and this reads as an invitation. ⚠️ It is also the sentence AC8 forbids the
 * two offline states from borrowing — a thread we could not fetch must never render as this.
 */
export function answersLine(count: number): string {
  if (count <= 0) return 'No answers yet — you could be the first.';
  return count === 1 ? '1 answer' : `${count} answers`;
}

/** `@rosborne · 3 days ago · answered in 41 min`. */
export function threadMeta(thread: ThreadDetail, now?: number): string | null {
  return metaLine([
    thread.authorHandle ? `@${thread.authorHandle}` : null,
    relativeTime(thread.createdAt, now ?? Date.now()),
    replyLatency(thread.firstReplyMinutes)
  ]);
}

// ── The view ──────────────────────────────────────────────────────────────────

/**
 * How the host offers to pull an attachment into a project — NAT-015.
 *
 * ⚠️ A function rather than a flag, because the answer is per attachment: a `graph_fragment`
 * naming node types this install does not have is offered and refused, and a `capture` is not
 * offered at all. Returning `null` draws no verb.
 */
export type PullOffer = (attachment: ThreadAttachment) => CommunityAttachmentPull | null;

export type ThreadViewInputs = {
  /** 🔴 D15's source. See the header on why it is not the thread's own 404. */
  me: Read<MeResponse> | undefined;
  /** `undefined` = not asked yet. */
  read: Read<ThreadDetail> | undefined;
  /**
   * A copy already held, and when it was taken.
   *
   * 🔴 **In memory, for this editor session only — see `useCommunityThread.ts`.** Writing a
   * community thread to disk is **D8's decision**, not this task's: D8 asks what may be cached on
   * a laptop and it is open. A cache that quietly became a file would be that ruling, made by
   * whoever wrote the convenient thing.
   */
  cached?: { thread: ThreadDetail; at: number } | null;
  now?: number;
  pullFor?: PullOffer;
  /**
   * NAT-007 AC6 — what the host can do about accepting, or nothing at all.
   *
   * ⚠️ Absent for every host that has not wired the write, and `acceptFor` draws no verb in that
   * case. A spec grading the read half passes nothing and gets exactly the screen it graded before.
   */
  accept?: AcceptOffer | null;
  /**
   * 🔴 What this editor session posted to this thread, if anything.
   *
   * **This exists for the arm nobody would think of.** A successful post is followed by a re-read.
   * If that re-read FAILS, what is left on screen is branch 4 below — the copy we already had,
   * taken *before* the post, under a banner saying it is a copy and how old it is. Every word of
   * that is true, and the whole screen is a lie: the answer the person just wrote is not in the
   * list and nothing says why. AC4 forbids losing somebody's typed answer; a screen implying it
   * never arrived is the same failure one step later.
   *
   * ⚠️ **`postId` is carried, not just the time**, so the question *"is their answer in what we
   * are drawing"* is ANSWERED rather than assumed. A read that lands after a write ought to
   * contain it — one Postgres, committed before the response — but *ought to* is the shape of
   * every finding in this phase. See {@link postedNote}.
   */
  posted?: { at: number; postId: string } | null;
};

function attachmentView(attachment: ThreadAttachment, pullFor?: PullOffer): CommunityAttachmentView {
  return {
    id: attachment.id,
    heading: attachmentHeading(attachment.kind),
    facts: attachmentFacts(attachment),
    ports: attachmentPorts(attachment),
    withheldLine: withheldLine(attachment),
    note: attachment.note,
    pull: pullFor ? pullFor(attachment) : null
  };
}

/** What `threadDetailView` needs beyond the payload — all of it optional, all of it a host's. */
export type ThreadViewOptions = {
  pullFor?: PullOffer;
  accept?: AcceptOffer | null;
  /** 🔴 Decided ONCE per thread, in `threadDetailView`, never per post. See {@link isAsker}. */
  viewerIsAsker?: boolean;
};

function postView(
  post: ThreadPost,
  now: number,
  isQuestion: boolean,
  thread: ThreadDetail,
  options: ThreadViewOptions
): CommunityPostView {
  const { pullFor } = options;
  return {
    id: post.id,
    // ⚠️ An empty handle draws as "someone" rather than as a bare "@". The platform joins on
    // `accounts`, so a missing handle means a payload this client did not understand — and a
    // lone "@" beside a post reads as a defect in the post rather than in the fetch.
    author: post.authorHandle ? `@${post.authorHandle}` : 'someone',
    // NAT-008 AC4 — the identifier beside the words. ⚠️ `null` for the 'someone' case above, and
    // that is the point: there is no profile to open for a payload with no handle in it.
    authorHandle: post.authorHandle ? post.authorHandle : null,
    when: relativeTime(post.createdAt, now),
    accepted: post.accepted,
    blocks: post.blocks,
    attachments: post.attachments.map((attachment) => attachmentView(attachment, pullFor)),
    // NAT-007 AC6 — and `acceptFor` says no for almost every post. See its four refusals.
    accept: acceptFor({
      thread,
      post,
      isQuestion,
      viewerIsAsker: options.viewerIsAsker === true,
      offer: options.accept
    })
  };
}

export function threadDetailView(
  thread: ThreadDetail,
  now: number,
  options: ThreadViewOptions = {}
): CommunityThreadDetailView {
  return {
    title: thread.title,
    meta: threadMeta(thread, now),
    question: postView(thread.question, now, true, thread, options),
    answers: thread.answers.map((answer) => postView(answer, now, false, thread, options)),
    // ⚠️ Counted from what we are about to DRAW, not from the payload's `replyCount`. The two
    // disagree the moment moderation hides a post: the count is over rows, the array is over
    // visible ones, and a heading that says "3 answers" above two of them is a reader looking
    // for a third that is not coming.
    answersLine: answersLine(thread.answers.length)
  };
}

/**
 * The whole screen, as data.
 *
 * The order of the branches is the argument:
 *
 * 1. **`me` says absent → `hidden`.** D15, read off the viewer. See the header.
 * 2. **A live read → `ready`.** No cache banner: these are the words as they are right now.
 * 3. **404 → `gone`.** Only reachable once (1) has said the surface exists for this viewer.
 * 4. **A failed read with a copy → `ready`, saying how old it is.** AC8's first half.
 * 5. **Not asked yet → `loading`.** ⚠️ Ahead of the cache deliberately: `cachedSince` means
 *    *the live read failed*, and showing it while a request is still in flight would put a
 *    sentence on screen that is not true yet.
 * 6. **A failed read with no copy → `unreachable`.** AC8's second half, and the arm that must
 *    never be mistaken for an unanswered thread.
 */
export function composeThreadView(inputs: ThreadViewInputs): CommunityThreadState {
  const { me, read, cached, pullFor } = inputs;
  const now = inputs.now ?? Date.now();

  if (me?.outcome === 'ok' && me.value.community.surface === 'absent') {
    return { state: 'hidden' };
  }

  // 🔴 Read once, from `me` and the thread, and handed to every post. Deciding it per post would
  // ask the same question as many times as there are answers — and the day one of those calls got
  // a different argument, one answer in a list would carry a verb the others did not.
  const options = (thread: ThreadDetail): ThreadViewOptions => ({
    pullFor,
    accept: inputs.accept,
    viewerIsAsker: isAsker(me, thread)
  });

  if (read?.outcome === 'ok') {
    return {
      state: 'ready',
      thread: threadDetailView(read.value, now, options(read.value)),
      cachedSince: null,
      // ⚠️ Asked on the LIVE copy too, and that is not belt-and-braces. A re-read that succeeds
      // and comes back without the answer in it is the case that would otherwise pass silently:
      // fresh copy, no banner, no answer, nothing to read.
      postedNote: postedNote(inputs.posted ?? null, { thread: read.value, at: now })
    };
  }

  if (read?.outcome === 'absent') {
    return { state: 'gone' };
  }

  if (read !== undefined && cached) {
    return {
      state: 'ready',
      thread: threadDetailView(cached.thread, now, options(cached.thread)),
      // ⚠️ `relativeTime` takes a string, and this is the one timestamp on this screen the
      // editor produced itself rather than received — so it is spelled as an ISO string here
      // rather than given a second formatter that takes a number.
      cachedSince: relativeTime(new Date(cached.at).toISOString(), now) ?? 'a moment ago',
      postedNote: postedNote(inputs.posted ?? null, cached)
    };
  }

  if (read === undefined) return { state: 'loading' };
  // ⚠️ **Unreachable on this route today and branched anyway.** `Read<T>` gained
  // `unauthenticated` on 2026-08-20 for UNI-007's path read, which is the first read on this
  // API that answers 401; a thread read answers 200 for a null viewer and refuses with the 404
  // that branch 3 draws as `hidden`. 🔴 A cast here would have been the cheap fix and would
  // have silently made "you are signed out" render as "the community is down" the day the
  // Bench is ever scoped to members.
  if (read.outcome === 'unauthenticated') return { state: 'unreachable', detail: 'Sign in to read this thread.' };

  return { state: 'unreachable', detail: read.detail };
}

/**
 * 🔴 The sentence that stops a true screen from being a lie.
 *
 * A person posts an answer; the network drops before the re-read lands; branch 4 draws the copy we
 * already had. That copy was taken *before* the post, so their answer is not in the list — and
 * every other word on screen ("Showing a copy saved 4 minutes ago") is accurate, which is exactly
 * what makes the omission invisible. AC4 forbids losing somebody's typed answer; a screen implying
 * it never arrived is the same failure one step later.
 *
 * ⚠️ **`null` when the copy is NEWER than the post**, which is the ordinary case after a
 * successful re-read followed by a later failure: that copy contains the answer and a sentence
 * saying otherwise would be the lie in the other direction.
 */
export function postedNote(
  posted: { at: number; postId: string } | null | undefined,
  copy: { thread: ThreadDetail; at: number }
): string | null {
  if (!posted) return null;
  // 🔴 The FIRST question is whether the answer is in what we are about to draw, because that is
  // the question the reader has. Everything below only chooses which sentence explains why not.
  if (copy.thread.answers.some((answer) => answer.id === posted.postId)) return null;
  if (copy.at < posted.at) {
    return 'Your answer was posted. This copy was taken before it, so it is not in the list yet.';
  }
  // ⚠️ A read that landed AFTER the write and still does not list it. Says what it knows and
  // guesses at nothing: the post succeeded — the platform returned its id — and the thread we can
  // see does not have it.
  return 'Your answer was posted, but the community has not listed it yet.';
}
