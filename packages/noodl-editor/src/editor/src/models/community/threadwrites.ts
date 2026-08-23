/**
 * NAT-007 AC4 and AC6 — the two writes a thread has, as decisions with words in them.
 *
 * ## 🔴 Why these are a module and not component state
 *
 * `threadview.ts` gives the reason for the read half and it is unchanged here: this repo's jest
 * has no DOM, and everything on this screen with a sentence in it — what a failed send says, what
 * a draft 412 characters over the cap says, whether an *accept* verb is drawn at all — has to be
 * a function a spec can call. `CommunityThreadView.tsx` places what this returns.
 *
 * ## ⚠️ THE LIMIT IS THE PLATFORM'S AND IT IS COPIED, WHICH MAKES IT A DRIFT RISK
 *
 * {@link ANSWER_MAX_CHARACTERS} is `bench_post_body_shape` — `check (length(btrim(body)) between
 * 1 and 8000)` in `0008_uni015_bench.sql`. There is no endpoint that publishes it, so this is a
 * second copy of a rule that lives in a migration, and NAT-008's rate bands are the standing
 * warning about copying a platform vocabulary by guessing at it. Two things make this one
 * survivable where that one was not: the number was **read off the constraint** rather than
 * inferred, and being wrong is *visible* — a client cap that is too high gets a 400 whose words
 * are drawn, and one that is too low refuses a draft in a sentence naming the number. A wrong
 * rate-band key drew nothing at all.
 *
 * 🔴 **`btrim`, not `length`.** The constraint counts the TRIMMED body, so a box holding nothing
 * but spaces is a body of length 0 and the platform refuses it. Counting the raw string here
 * would send it, and a person would learn from a 400 that a blank answer is blank.
 *
 * ## ⚠️ Every refusal below keeps the text, and that is the criterion rather than a nicety
 *
 * AC4: *"a reply that fails to send says so and keeps the text. Losing somebody's typed answer to
 * a network blip is worse than the browser hand-off this task replaces."* So no failure arm
 * clears a draft, only {@link Write}`.ok` does, and every failure sentence says the text is still
 * there — because a person looking at a red line does not necessarily look at the box under it.
 *
 * @module noodl-editor/models/community/threadwrites
 */

import type {
  CommunityPostAccept,
  CommunityPostEdit,
  CommunityReplyBox
} from '@noodl-core-ui/components/community';

import type { AnswerAccepted, MeResponse, Read, ThreadDetail, ThreadPost, Write } from './communityapi';

/**
 * The platform's own cap on a post body, read off `bench_post_body_shape`.
 *
 * See the module note: this is a copy of a database constraint, and the note says what makes that
 * survivable here.
 */
export const ANSWER_MAX_CHARACTERS = 8000;

/** What the platform will count, which is not what `draft.length` counts. See the module note. */
export function answerLength(draft: string): number {
  return draft.trim().length;
}

/** Whether the verb may fire at all. */
export function canSendAnswer(draft: string): boolean {
  const length = answerLength(draft);
  return length > 0 && length <= ANSWER_MAX_CHARACTERS;
}

/**
 * The sentence under a refused verb, or `null` for a refusal that explains itself.
 *
 * 🔴 **`null` for an empty box is the decision here, and it is not the same as "no reason".** A
 * disabled *Post answer* beside an empty field is already legible — the reason is the empty field.
 * A sentence saying *"type something first"* is scolding somebody for not having finished yet.
 * Being over a cap is the opposite case: the limit is invisible, the count is invisible, and
 * without this sentence the button is simply broken.
 */
export function draftRefusal(draft: string): string | null {
  const length = answerLength(draft);
  if (length <= ANSWER_MAX_CHARACTERS) return null;
  const over = length - ANSWER_MAX_CHARACTERS;
  return `That is ${over} character${over === 1 ? '' : 's'} over the community's limit of ${ANSWER_MAX_CHARACTERS}.`;
}

/**
 * What a failed send says.
 *
 * 🔴 **Four outcomes and four different sentences, because they have four different fixes** —
 * which is the same argument `Write` makes for having five arms rather than folding them into an
 * error. ⚠️ `absent` is the one that must not narrate: a 404 on a post route means *this thread is
 * not there for you*, and `docs/API.md` §4 forbids rendering that as a permission. It says the
 * thread is gone, which is what the read half already says for the same status.
 */
export function answerFailureLine(write: Write<AnswerAccepted>): string | null {
  switch (write.outcome) {
    case 'ok':
      return null;
    case 'unauthenticated':
      return 'Your session has expired, so this was not posted. Sign in to the community again — your answer is still here.';
    case 'absent':
      return 'This thread is not available any more, so this was not posted. Your answer is still here.';
    case 'refused':
      return `The community did not accept this: ${write.detail} Your answer is still here.`;
    case 'unreachable':
      return 'The community could not be reached, so this was not posted. Your answer is still here — try again when you are back on the network.';
  }
}

/** What a successful send says, before the re-read lands. */
export const ANSWER_POSTED_LINE = 'Posted. Re-reading the thread…';

export type ReplyBoxInputs = {
  /**
   * 🔴 Whether this editor holds a session, NOT whether the platform will accept the write.
   *
   * ⚠️ The two are different and the difference is deliberate: a banned account holds a perfectly
   * good session and is refused by `[board-banned]`, and an org-minor is refused by a 404 that
   * this client is forbidden to explain. Predicting either here would mean re-implementing D15 in
   * the editor, which is the thing `docs/API.md` §4 exists to stop. A composer is drawn; the
   * platform's answer is drawn beside it if it says no.
   */
  signedIn: boolean;
  draft: string;
  sending: boolean;
  /** The last attempt, or `null` if there has not been one since this thread was opened. */
  last: Write<AnswerAccepted> | null;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** The labelled browser hand-off, for the signed-out arm. */
  onHandoff: () => void;
};

/**
 * The answering affordance, whichever of the two it is.
 *
 * ⚠️ Signed out gets the hand-off rather than a *"sign in first"* line with no way to do it: the
 * rail panel has no sign-in control of its own — UNI-001 put it on the launcher card — so a
 * sentence naming a button that is in another window is a dead end. The web is a live route and
 * the person is signed into it or can sign into it there.
 */
export function composeReplyBox(inputs: ReplyBoxInputs): CommunityReplyBox {
  if (!inputs.signedIn) {
    return {
      kind: 'handoff',
      line: 'You are not signed in to the community, so an answer cannot be posted from the editor.',
      actionLabel: 'Answer on the web',
      onAction: inputs.onHandoff
    };
  }

  const failure = inputs.last ? answerFailureLine(inputs.last) : null;
  return {
    kind: 'composer',
    label: 'Your answer',
    placeholder: 'Answer this question. Markdown works here, the same as on the web.',
    value: inputs.draft,
    onChange: inputs.onChange,
    onSubmit: inputs.onSubmit,
    submitLabel: inputs.sending ? 'Posting…' : 'Post answer',
    canSubmit: canSendAnswer(inputs.draft),
    blockedReason: draftRefusal(inputs.draft),
    busy: inputs.sending,
    error: failure,
    // ⚠️ Never both. A screen that said "Posted" and "could not be reached" at once is a screen
    // whose reader has to decide which half to believe.
    note: !failure && inputs.last?.outcome === 'ok' ? ANSWER_POSTED_LINE : null
  };
}

// ── AC6: accepting an answer ──────────────────────────────────────────────────────────────

/**
 * What the host knows about accepting, on this thread, right now.
 *
 * ⚠️ `failure` is per POST rather than per thread: two answers, one refusal, and a message drawn
 * against both would tell the wrong post's author that their answer was rejected.
 */
export type AcceptOffer = {
  /** The post currently being accepted, if any — its verb goes busy and nothing else does. */
  pendingPostId: string | null;
  /** The platform's own words about the last attempt, and which post it was about. */
  failure: { postId: string; line: string } | null;
  onAccept: (postId: string) => void;
};

/**
 * 🔴 Is this viewer the person who asked?
 *
 * ⚠️ **Compared on HANDLES, because that is all `/v1/me` gives a client** — the platform compares
 * `author_account_id`, which no read endpoint publishes (NAT-006 found that leaking it was the
 * AC4 failure, and removed it). Handles are unique and stable, so the two agree; but this answer
 * decides only whether a verb is DRAWN. `acceptAnswer` re-decides it inside its transaction
 * against the account id, and its `[bench-accept-not-asker]` refusal is the truth. A client that
 * got this wrong shows a verb that fails with the platform's own sentence, not a client that
 * accepts something it should not.
 *
 * ⚠️ Case-insensitive: handles arrive from `/v1/me` and from a thread payload through different
 * joins, and a comparison that a difference in case could break is one nobody would ever see fail.
 */
export function isAsker(me: Read<MeResponse> | undefined, thread: ThreadDetail): boolean {
  if (me?.outcome !== 'ok') return false;
  const viewer = me.value.viewer?.handle;
  if (!viewer || !thread.authorHandle) return false;
  return viewer.toLowerCase() === thread.authorHandle.toLowerCase();
}

/**
 * The accept verb for one post, or `null` — which is the answer for almost every post.
 *
 * The order of the refusals is the argument:
 *
 * 1. **No host wiring → nothing.** A story or a read-only spec passes no offer.
 * 2. **The question is never accepted.** `[bench-accept-question]` refuses it on the platform, and
 *    a client that drew the verb there would be offering a button whose only outcome is an error.
 * 3. **Not the asker → nothing.** ⚠️ Nothing *drawn*, not a disabled verb with a reason: an
 *    answerer is not being refused anything, they simply have no business accepting. A greyed
 *    "Accept this answer" under a stranger's post reads as a permission they lost.
 * 4. 🔴 **A thread that already has an accepted answer offers NOTHING, on any post.** The platform
 *    permits moving an accept — `acceptAnswer` just re-`update`s `accepted_post_id` — and its
 *    consequences are unruled: it awards the new author through `recordEvent` and notifies them,
 *    and it neither revokes the first award nor tells the first author they were unaccepted. So
 *    the client does not expose it. **Nobody has ruled that a thread's accept can move**, and a
 *    client is a bad place to decide it silently.
 */
export function acceptFor(input: {
  thread: ThreadDetail;
  post: ThreadPost;
  isQuestion: boolean;
  viewerIsAsker: boolean;
  offer?: AcceptOffer | null;
}): CommunityPostAccept | null {
  const { thread, post, isQuestion, viewerIsAsker, offer } = input;
  if (!offer) return null;
  if (isQuestion) return null;
  if (!viewerIsAsker) return null;
  // ⚠️ Read off the THREAD, not off `post.accepted`: "some answer is accepted" is what closes the
  // verb, and `post.accepted` only ever describes the one post it is on.
  if (thread.acceptedPostId !== null || thread.accepted) return null;

  return {
    label: 'Accept this answer',
    busyLabel: 'Accepting…',
    busy: offer.pendingPostId === post.id,
    onAccept: () => offer.onAccept(post.id),
    error: offer.failure?.postId === post.id ? offer.failure.line : null
  };
}

/**
 * What a failed accept says.
 *
 * ⚠️ Shorter than {@link answerFailureLine}'s sentences and deliberately so — there is no typed
 * text at stake, so there is nothing to reassure anybody about. The one arm that carries real
 * information is `refused`: `[bench-accept-not-asker]` and the three `[bench-accept-*]` shape
 * refusals all reach a caller through `bench-http.ts`'s table, in words the platform chose.
 */
export function acceptFailureLine(write: Write<unknown>): string | null {
  switch (write.outcome) {
    case 'ok':
      return null;
    case 'unauthenticated':
      return 'Your session has expired, so this answer was not accepted. Sign in to the community again.';
    case 'absent':
      return 'This thread is not available any more, so this answer was not accepted.';
    case 'refused':
      return `The community did not accept that: ${write.detail}`;
    case 'unreachable':
      return 'The community could not be reached, so this answer was not accepted.';
  }
}

// ── FB-001: editing your own post, and withdrawing your own thread ─────────────────────────

/**
 * What the host knows about editing, on this thread, right now.
 *
 * ⚠️ `failure` is per POST rather than per thread, for {@link AcceptOffer}'s reason: one
 * refusal drawn against every post would tell three people's posts about one person's failure.
 */
export type EditOffer = {
  /** The post whose composer is open, or null. Only ever one at a time. */
  editingPostId: string | null;
  /** The draft, which is the HOST's state — `renderElements.ts` cannot evaluate a hook. */
  draft: string;
  /** The post whose save or delete is in flight. */
  pendingPostId: string | null;
  failure: { postId: string; line: string } | null;
  onEdit: (postId: string) => void;
  onDraftChange: (next: string) => void;
  onSave: (postId: string) => void;
  onCancel: () => void;
  onDelete: () => void;
};

/**
 * FB-001 — the edit/delete affordance for one post, or `null`.
 *
 * The order of the refusals is the argument, exactly as {@link acceptFor}'s is:
 *
 * 1. **No host wiring → nothing.** A story or a read-only spec passes no offer.
 * 2. 🔴 **Not the author → nothing DRAWN.** Not a disabled verb with a reason: somebody
 *    reading another person's post is not being refused anything, and a greyed "Edit" under a
 *    stranger's words reads as a permission they lost. ⚠️ Decided on HANDLES, which is all
 *    `/v1/me` gives a client — `isAsker`'s note applies verbatim, including that this decides
 *    only whether a verb is DRAWN. `editPost`'s `[bench-edit-not-author]` is the truth.
 * 3. **Delete is offered on the QUESTION only.** D7 ruled *delete own thread*; an answerer
 *    withdrawing their answer out of somebody else's thread is a verb nobody has ruled on, and
 *    a client is a bad place to invent one.
 * 4. 🔴 **And not once somebody else has answered.** The platform refuses it with a 409 whose
 *    sentence is worth reading, so this is NOT a case of hiding a refusal the person should
 *    see — the verb is withdrawn because D7 declined hide-after-answers, making the refusal
 *    permanent rather than a state that might change. ⚠️ Read off `answers.length` and the
 *    accepted flag, which is what this client can see; the platform re-decides it against
 *    "posts by another account", and the two can disagree in exactly one direction — a thread
 *    where the ONLY answers are the asker's own. That draws no verb here and would have been
 *    permitted; the cost is a delete the author has to do on the web, which is the safe
 *    direction for a disagreement to fall.
 */
export function editFor(input: {
  thread: ThreadDetail;
  post: ThreadPost;
  isQuestion: boolean;
  viewerIsAsker: boolean;
  /** Whether the viewer wrote THIS post — for an answer, that is not `viewerIsAsker`. */
  viewerIsAuthor: boolean;
  offer?: EditOffer | null;
}): CommunityPostEdit | null {
  const { thread, post, isQuestion, viewerIsAsker, viewerIsAuthor, offer } = input;
  if (!offer) return null;
  if (!viewerIsAuthor) return null;

  const editing = offer.editingPostId === post.id;
  const busy = offer.pendingPostId === post.id;

  const deletable =
    isQuestion &&
    viewerIsAsker &&
    thread.answers.length === 0 &&
    thread.acceptedPostId === null &&
    !thread.accepted;

  return {
    editLabel: 'Edit',
    onEdit: () => offer.onEdit(post.id),
    remove: deletable
      ? {
          label: 'Delete',
          busyLabel: 'Deleting…',
          busy,
          onRemove: offer.onDelete
        }
      : null,
    composer: editing
      ? {
          label: 'Your post',
          value: offer.draft,
          onChange: offer.onDraftChange,
          onSave: () => offer.onSave(post.id),
          onCancel: offer.onCancel,
          saveLabel: busy ? 'Saving…' : 'Save changes',
          // 🔴 The SAME two functions the answer composer uses, so the client's idea of
          // `bench_post_body_shape` cannot fork between the two boxes that send a body.
          canSave: canSendAnswer(offer.draft),
          blockedReason: draftRefusal(offer.draft),
          busy
        }
      : null,
    error: offer.failure?.postId === post.id ? offer.failure.line : null
  };
}

/**
 * Whether this viewer wrote this post.
 *
 * ⚠️ `isAsker`'s note applies unchanged — handles, case-insensitively, because
 * `author_account_id` is published by nothing (NAT-006 removed it) and this decides only what
 * is drawn.
 */
export function isPostAuthor(me: Read<MeResponse> | undefined, post: ThreadPost): boolean {
  if (me?.outcome !== 'ok') return false;
  const viewer = me.value.viewer?.handle;
  if (!viewer || !post.authorHandle) return false;
  return viewer.toLowerCase() === post.authorHandle.toLowerCase();
}

/**
 * What a failed edit says.
 *
 * 🔴 **EVERY ARM SAYS THE TEXT IS STILL THERE**, which is AC4's rule applied to the verb that
 * needs it more: an answer that fails to send loses something the person can retype from
 * memory, and an edit that fails loses a rewrite of something they can no longer see, because
 * the composer replaced it. ⚠️ `absent` does not narrate — a 404 here is *this post is not
 * there for you*, and `docs/API.md` §4 forbids rendering that as a permission.
 */
export function editFailureLine(write: Write<unknown>): string | null {
  switch (write.outcome) {
    case 'ok':
      return null;
    case 'unauthenticated':
      return 'Your session has expired, so this edit was not saved. Sign in to the community again — your text is still here.';
    case 'absent':
      return 'This post is not available any more, so the edit was not saved. Your text is still here.';
    case 'refused':
      return `The community did not accept this: ${write.detail} Your text is still here.`;
    case 'unreachable':
      return 'The community could not be reached, so this edit was not saved. Your text is still here — try again when you are back on the network.';
  }
}

/**
 * What a failed delete says.
 *
 * ⚠️ Nothing is "still here" to reassure anybody about — there is no typed text at stake, so
 * these are shorter, exactly as {@link acceptFailureLine} is. 🔴 The `refused` arm is the one
 * that carries real information and it is the whole of AC2's promise that *the refusal for an
 * answered thread names why*: `[bench-delete-answered]` reaches a caller as *"somebody has
 * answered this thread, so it is part of their record too and cannot be deleted"*, in the
 * platform's own words.
 */
export function deleteFailureLine(write: Write<unknown>): string | null {
  switch (write.outcome) {
    case 'ok':
      return null;
    case 'unauthenticated':
      return 'Your session has expired, so this thread was not deleted. Sign in to the community again.';
    case 'absent':
      return 'This thread is not available any more.';
    case 'refused':
      return `The community did not accept that: ${write.detail}`;
    case 'unreachable':
      return 'The community could not be reached, so this thread was not deleted.';
  }
}

/** What a successful edit says, before the re-read lands. */
export const EDIT_SAVED_LINE = 'Saved. Re-reading the thread…';
