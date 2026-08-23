/**
 * FB-001 — editing and deleting your own, in the editor.
 *
 * > *"Right now in the community I can't edit or delete the questions I added to the bench."*
 *
 * Richard ruled the editor gets the SAME verbs as the web rather than sending people to a
 * browser: the editor is already a full writing client — it asks, answers and accepts — so the
 * complaint reproduces inside it exactly.
 *
 * 🔴 **This file follows `nat-007/threadwrites.test.ts`'s rule and its reason: assert on what
 * the production functions RETURN, never on a fixture shaped like what they return.** NAT-008
 * paid for the alternative with fourteen render specs that stayed green while the function
 * building their view model was broken.
 *
 * ⚠️ **The bound of this file.** It grades the DECISIONS — who gets a verb, what a refusal
 * says, what survives a failure. It does not prove the panel placed them, and it does not prove
 * the platform accepts the requests; the first is `threadview`'s element tree, and the second is
 * `nodegx-community`'s `tests/fb001-edit-and-delete.test.ts`, which drives the real routes
 * against a real database.
 *
 * @module noodl-editor/tests-unit/fb-001/editverbs
 */
import { readFileSync } from 'fs';
import { join } from 'path';

import type { MeResponse, Read, ThreadDetail, ThreadPost, Write } from '@noodl-models/community/communityapi';
import {
  deleteFailureLine,
  editFailureLine,
  editFor,
  isPostAuthor,
  type EditOffer
} from '@noodl-models/community/threadwrites';

const NOW = Date.parse('2026-08-23T12:00:00.000Z');
const DAY = 24 * 3_600_000;
const noop = () => undefined;

function post(over: Partial<ThreadPost> = {}): ThreadPost {
  return {
    id: 'p1',
    authorHandle: 'rosborne',
    blocks: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'hello' }] }],
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    accepted: false,
    attachments: [],
    ...over
  };
}

function thread(over: Partial<ThreadDetail> = {}): ThreadDetail {
  return {
    id: 't1',
    section: 'help',
    title: 'Why does my For Each render one row?',
    authorHandle: 'rosborne',
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
    replyCount: 0,
    accepted: false,
    acceptedPostId: null,
    firstReplyMinutes: null,
    question: post(),
    answers: [],
    ...over
  };
}

const me = (handle: string | null): Read<MeResponse> => ({
  outcome: 'ok',
  value: {
    viewer: handle ? { handle, kind: 'individual' } : null,
    community: { surface: 'present', capabilities: {} }
  } as MeResponse
});

const offer = (over: Partial<EditOffer> = {}): EditOffer => ({
  editingPostId: null,
  draft: '',
  pendingPostId: null,
  failure: null,
  onEdit: noop,
  onDraftChange: noop,
  onSave: noop,
  onCancel: noop,
  onDelete: noop,
  ...over
});

/** The ordinary call: the asker looking at their own unanswered question. */
function forQuestion(over: { thread?: ThreadDetail; offer?: EditOffer | null; viewer?: string } = {}) {
  const t = over.thread ?? thread();
  return editFor({
    thread: t,
    post: t.question,
    isQuestion: true,
    viewerIsAsker: true,
    viewerIsAuthor: isPostAuthor(me(over.viewer ?? 'rosborne'), t.question),
    offer: over.offer === undefined ? offer() : over.offer
  });
}

describe('FB-001 — who gets the verbs', () => {
  it('the asker gets Edit and Delete on their own unanswered question', () => {
    const edit = forQuestion();
    expect(edit).not.toBeNull();
    expect(edit!.editLabel).toBe('Edit');
    expect(edit!.remove).not.toBeNull();
    expect(edit!.remove!.label).toBe('Delete');
  });

  /**
   * 🔴 THE CONTROL THAT MAKES EVERY ROW ABOVE MEAN SOMETHING. A function returning a verb for
   * everybody would pass the row above; this is the one that says it discriminates.
   */
  it('a stranger reading the same question gets NOTHING drawn', () => {
    const t = thread();
    const edit = editFor({
      thread: t,
      post: t.question,
      isQuestion: true,
      viewerIsAsker: false,
      viewerIsAuthor: isPostAuthor(me('ada'), t.question),
      offer: offer()
    });
    // ⚠️ Null, not a disabled verb: an answerer is not being refused anything, and a greyed
    // "Edit" under a stranger's post reads as a permission they lost.
    expect(edit).toBeNull();
  });

  it('a host that wired nothing draws nothing, so a read-only screen is unchanged', () => {
    expect(forQuestion({ offer: null })).toBeNull();
  });

  /**
   * 🔴 THE ANSWERER CASE, which is the whole reason `viewerIsAuthor` exists beside
   * `viewerIsAsker`. One flag would have offered an answerer Edit on the QUESTION, or nothing
   * on their own words.
   */
  it('an answerer edits their own answer, and cannot delete somebody else’s thread', () => {
    const answer = post({ id: 'p2', authorHandle: 'ada' });
    const t = thread({ answers: [answer], replyCount: 1 });

    const onAnswer = editFor({
      thread: t,
      post: answer,
      isQuestion: false,
      viewerIsAsker: false,
      viewerIsAuthor: isPostAuthor(me('ada'), answer),
      offer: offer()
    });
    // An answerer must be able to edit their own answer.
    expect(onAnswer).not.toBeNull();
    // Delete is a THREAD verb — D7 ruled *delete own thread*, and the thread is not theirs.
    expect(onAnswer!.remove).toBeNull();

    // And the same person gets nothing at all on the question.
    const onQuestion = editFor({
      thread: t,
      post: t.question,
      isQuestion: true,
      viewerIsAsker: false,
      viewerIsAuthor: isPostAuthor(me('ada'), t.question),
      offer: offer()
    });
    expect(onQuestion).toBeNull();
  });

  it('handles are compared case-insensitively, like isAsker', () => {
    expect(isPostAuthor(me('RObsborne'), post({ authorHandle: 'robsborne' }))).toBe(true);
    expect(isPostAuthor(me('ada'), post({ authorHandle: 'rosborne' }))).toBe(false);
    // ⚠️ A payload with no handle draws no verb rather than matching a viewer with none.
    expect(isPostAuthor(me(null), post({ authorHandle: null }))).toBe(false);
    expect(isPostAuthor(undefined, post())).toBe(false);
  });
});

describe('FB-001 — when Delete is withdrawn', () => {
  it('an answer from somebody else withdraws it, and Edit stays', () => {
    const t = thread({ answers: [post({ id: 'p2', authorHandle: 'ada' })], replyCount: 1 });
    const edit = forQuestion({ thread: t });

    // The asker can still edit their question.
    expect(edit).not.toBeNull();
    // 🔴 D7 declined hide-after-answers, so this refusal is PERMANENT — which is why the verb
    // is withdrawn rather than drawn-and-refused. A refusal that might change deserves a
    // button; one that never will is a button that can only ever disappoint.
    expect(edit!.remove).toBeNull();
  });

  it('an accepted answer withdraws it', () => {
    const t = thread({
      answers: [post({ id: 'p2', authorHandle: 'ada', accepted: true })],
      replyCount: 1,
      accepted: true,
      acceptedPostId: 'p2'
    });
    expect(forQuestion({ thread: t })!.remove).toBeNull();
  });
});

describe('FB-001 — the composer', () => {
  it('is absent until the host opens it, and then REPLACES the body', () => {
    expect(forQuestion()!.composer).toBeNull();

    const open = forQuestion({ offer: offer({ editingPostId: 'p1', draft: 'reworded' }) });
    expect(open!.composer).not.toBeNull();
    expect(open!.composer!.value).toBe('reworded');
    expect(open!.composer!.canSave).toBe(true);
  });

  /**
   * 🔴 THE SAME CAP THE ANSWER BOX USES, so the client's idea of `bench_post_body_shape`
   * cannot fork between the two boxes that send a body. `threadwrites.ts`'s module note
   * already flags that constant as a copy of a migration constraint; a second, drifting copy
   * for the edit box is exactly the failure it warns about.
   */
  it('refuses an over-long draft with the same sentence the answer box uses', () => {
    const open = forQuestion({ offer: offer({ editingPostId: 'p1', draft: 'x'.repeat(8_010) }) });
    expect(open!.composer!.canSave).toBe(false);
    expect(open!.composer!.blockedReason).toContain('10 characters over');
  });

  it('an empty draft cannot be saved, and says nothing about it', () => {
    const open = forQuestion({ offer: offer({ editingPostId: 'p1', draft: '   ' }) });
    expect(open!.composer!.canSave).toBe(false);
    // ⚠️ `null`, not a scolding sentence — an empty box explains itself. `composeReplyBox`
    // takes the same position and this is the row that keeps the two agreeing.
    expect(open!.composer!.blockedReason).toBeNull();
  });

  it('only the post being saved goes busy', () => {
    const answer = post({ id: 'p2', authorHandle: 'rosborne' });
    const t = thread({ answers: [answer], replyCount: 1 });
    const busyOffer = offer({ editingPostId: 'p1', draft: 'x', pendingPostId: 'p1' });

    expect(forQuestion({ thread: t, offer: busyOffer })!.composer!.busy).toBe(true);
    const other = editFor({
      thread: t,
      post: answer,
      isQuestion: false,
      viewerIsAsker: true,
      viewerIsAuthor: true,
      offer: busyOffer
    });
    // The other post has no composer open...
    expect(other!.composer).toBeNull();
    // ...and no refusal of its own.
    expect(other!.error).toBeNull();
  });

  /**
   * ⚠️ A refusal is drawn against the post it was about and no other — `AcceptOffer`'s rule.
   * One refusal drawn against every post would tell three people's posts about one failure.
   */
  it('a refusal lands on its own post only', () => {
    const answer = post({ id: 'p2', authorHandle: 'rosborne' });
    const t = thread({ answers: [answer], replyCount: 1 });
    const failed = offer({ failure: { postId: 'p2', line: 'The community did not accept this.' } });

    expect(forQuestion({ thread: t, offer: failed })!.error).toBeNull();
    const onAnswer = editFor({
      thread: t,
      post: answer,
      isQuestion: false,
      viewerIsAsker: true,
      viewerIsAuthor: true,
      offer: failed
    });
    expect(onAnswer!.error).toBe('The community did not accept this.');
  });
});

describe('FB-001 — what a failure says', () => {
  const outcomes: Write<unknown>[] = [
    { outcome: 'unauthenticated' },
    { outcome: 'absent' },
    { outcome: 'refused', detail: 'the title or body is the wrong length' },
    { outcome: 'unreachable', status: 500, detail: 'boom' }
  ];

  it('ok says nothing, on both verbs', () => {
    expect(editFailureLine({ outcome: 'ok', value: undefined })).toBeNull();
    expect(deleteFailureLine({ outcome: 'ok', value: undefined })).toBeNull();
  });

  /**
   * 🔴 AC4's RULE, WHICH BITES HARDER ON AN EDIT THAN ON AN ANSWER. A failed answer loses text
   * the person can retype from memory; a failed edit loses a rewrite of something they can no
   * longer see, because the composer replaced the body. So EVERY failure arm must say the text
   * survived — and this quantifies over the arms rather than checking one.
   */
  it('every edit failure says the text is still there', () => {
    for (const write of outcomes) {
      const line = editFailureLine(write);
      // Every outcome must produce a sentence.
      expect(line).toBeTruthy();
      expect(line!.toLowerCase()).toContain('still here');
    }
  });

  it('and the four sentences are four different sentences', () => {
    const lines = outcomes.map((w) => editFailureLine(w));
    // Two outcomes sharing one sentence is two fixes with one hint.
    expect(new Set(lines).size).toBe(outcomes.length);
  });

  /**
   * 🔴 D15 — `absent` MUST NOT NARRATE. `docs/API.md` §4 forbids rendering a 404 as a
   * permission: it means *this is not there for you*, and a client that said "you may not"
   * would be the door being narrated in the act of closing it.
   */
  it('absent says the thing is gone, never that the viewer lacks permission', () => {
    for (const line of [editFailureLine({ outcome: 'absent' }), deleteFailureLine({ outcome: 'absent' })]) {
      expect(line!.toLowerCase()).toContain('not available');
      expect(line!.toLowerCase()).not.toMatch(/permission|not allowed|may not|your account/);
    }
  });

  /**
   * 🔴 AC2's PROMISE — *"the refusal for an answered thread names why"*. The platform's own
   * sentence must reach the person, because `bench-http.ts` chose those words precisely so a
   * caller learns what happened without learning that D15 exists.
   */
  it('a delete refusal carries the platform’s own words through', () => {
    const line = deleteFailureLine({
      outcome: 'refused',
      detail: 'somebody has answered this thread, so it is part of their record too and cannot be deleted'
    });
    expect(line).toContain('part of their record too');
  });

  it('nothing is "still here" on a delete — there is no typed text at stake', () => {
    for (const write of outcomes) {
      expect(deleteFailureLine(write)!.toLowerCase()).not.toContain('still here');
    }
  });
});

/**
 * FB-001 AC2, the gesture — the editor asks before it withdraws.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 WHAT THIS BLOCK IS, AND HONESTLY WHAT IT IS NOT.
 *
 * The web has always called `window.confirm` before deleting; the editor fired the DELETE
 * straight off the click, so one surface was a gesture safer than the other. D15's verb parity
 * could not catch that and neither can `editFor` — both grade which verbs are *offered*, and
 * this is about what happens between the click and the request.
 *
 * ⚠️ These rows read SOURCE, which this phase has repeatedly shown passes on dead code. They
 * are a regression guard, not evidence the confirmation works: the evidence is the drive
 * (2026-08-23, both surfaces — the dialog appears with no request sent, Cancel leaves the
 * thread in the database, Confirm sends exactly one DELETE and the pane returns to the list).
 * What they DO catch is somebody re-inlining the request onto the click, which is the specific
 * way this regresses.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
describe('AC2 — the editor asks before it withdraws', () => {
  const source = readFileSync(
    join(__dirname, '../../src/editor/src/hooks/useCommunityThread.ts'),
    'utf8'
  );

  // Non-vacuity: if the file moves or is renamed, these rows must not quietly read `false`.
  it('the hook is where it is expected to be', () => {
    expect(source.length).toBeGreaterThan(1000);
    expect(source).toContain('deleteThread');
  });

  it('the click opens a confirmation rather than sending the request', () => {
    const onDelete = source.slice(source.indexOf('const onDelete = useCallback'));
    const body = onDelete.slice(0, onDelete.indexOf('}, ['));
    expect(body).toContain('showConfirm');
    // 🔴 The whole rule: no request may be reachable from the click itself.
    expect(body).not.toContain('deleteThread');
  });

  it('the request lives behind the confirmation, and is the only copy', () => {
    expect(source.match(/client\.deleteThread\(/g)).toHaveLength(1);
    const deleteNow = source.slice(source.indexOf('const deleteNow = useCallback'));
    expect(deleteNow.slice(0, deleteNow.indexOf('}, ['))).toContain('client.deleteThread(');
  });

  /**
   * ⚠️ `editPending` must be set by the request path, NOT by the click. Setting it when the
   * dialog opens leaves the pane spinning forever on a cancel — and cancelling is the common
   * case for a confirmation, so that bug would be the one users met most.
   */
  it('the pane is not put in a pending state merely by asking', () => {
    const onDelete = source.slice(source.indexOf('const onDelete = useCallback'));
    expect(onDelete.slice(0, onDelete.indexOf('}, ['))).not.toContain('setEditPending');
  });
});
