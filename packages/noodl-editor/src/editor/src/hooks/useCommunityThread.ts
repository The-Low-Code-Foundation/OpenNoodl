/**
 * NAT-007 — one thread's data, and the open/closed state both surfaces share.
 *
 * ## 🔴 One hook, because there are two surfaces and one behaviour
 *
 * The rail panel is inside a project and the launcher tab is not, but *"which thread is open,
 * what did we get, and how old is it"* is the same question in both. UNI-011 already paid for the
 * alternative: two copies of one view model, and a fix that lands on one of them. So the panel and
 * the tab both call this, and neither owns any of it.
 *
 * ## ⚠️ The cache is IN MEMORY, for this editor session, and that is a decision rather than a
 * shortcut
 *
 * AC8 wants an already-opened thread to be readable offline, saying how old the copy is. The
 * obvious implementation writes it to `userData` beside the session token, and that would be
 * **D8** — *"caching a member directory to every laptop is a privacy decision"* — decided by
 * whoever wrote the convenient thing. D8 is open. A post body is a stranger's words about a
 * person's project, and a copy on disk outlives both the thread and the moderation that hid it.
 *
 * 🔴 So the honest scope of AC8 today: **within one editor session**, a thread you have opened
 * stays readable when the network drops, and says how old it is. Across restarts it does not, and
 * the reason is a ruling rather than an omission. Nothing about the shape has to change when D8
 * lands — {@link ThreadViewInputs.cached} is already a `{thread, at}` and the store behind it is
 * one module.
 *
 * @module noodl-editor/hooks/useCommunityThread
 */

import { useCallback, useEffect, useState } from 'react';

import {
  CommunityApiClient,
  type AnswerAccepted,
  type MeResponse,
  type Read,
  type ThreadDetail,
  type Write
} from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import { composeThreadView, type PullOffer } from '@noodl-models/community/threadview';
import { acceptFailureLine, canSendAnswer, composeReplyBox } from '@noodl-models/community/threadwrites';

import type { CommunityReplyBox, CommunityThreadState } from '@noodl-core-ui/components/community';

/**
 * Threads read this session, newest read wins.
 *
 * ⚠️ Module scope rather than a ref, so opening a thread, going back and opening it again does
 * not re-fetch from nothing — and so the rail panel and the launcher tab share one copy rather
 * than each holding their own. 🔴 Never written to disk: see the module note, and D8.
 */
const THREAD_CACHE = new Map<string, { thread: ThreadDetail; at: number }>();

/** Exported for the suite — a cache that no test can clear is a test that depends on its order. */
export function clearThreadCache(): void {
  THREAD_CACHE.clear();
}

/**
 * 🔴 THE ONLY PLACE THE TOKEN IS TOUCHED, and it is one function because a spec counts it.
 *
 * `uni-001/session-readers.test.ts` asserts *"the token is used once, to build a client, and
 * nowhere else"* — *"counted rather than eyeballed: a second use is a second place a decision
 * could hide."* AC4 and AC6 added two more requests, and three identical
 * `new CommunityApiClient({ token: session?.token ?? null })` expressions would have satisfied
 * every reading of that sentence except the one it was written for. ⚠️ The count went red and
 * this is the fix; making the assertion say *"three"* would have retired the claim instead.
 *
 * ⚠️ Built per call rather than held in state: a session may have been refreshed since this pane
 * opened, and a token captured at open time is the one that expires mid-thread.
 */
function clientFor(session: CommunitySession | null | undefined): CommunityApiClient {
  return new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });
}

export type CommunityThreadPane = {
  state: CommunityThreadState;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink: (href: string) => void;
  reply: CommunityReplyBox | null;
};

export type CommunityThreadHost = {
  /** `null` when no thread is open — the surface draws its lists. */
  pane: CommunityThreadPane | null;
  openThread: (threadId: string) => void;
};

export function useCommunityThread(options: { pullFor?: PullOffer } = {}): CommunityThreadHost {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [me, setMe] = useState<Read<MeResponse> | undefined>(undefined);
  const [read, setRead] = useState<Read<ThreadDetail> | undefined>(undefined);
  const [generation, setGeneration] = useState(0);

  // ── AC4, the composer's state ───────────────────────────────────────────────────────────
  // 🔴 The draft lives HERE and not in the textarea, because `CommunityThreadView` is hook-free
  // (see `renderElements.ts`) — and because a draft that lived in the DOM would be lost the
  // moment the thread re-rendered with a fresh read, which is exactly what a successful post
  // triggers.
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [lastWrite, setLastWrite] = useState<Write<AnswerAccepted> | null>(null);
  const [posted, setPosted] = useState<{ at: number; postId: string } | null>(null);

  // ── AC6, accepting ──────────────────────────────────────────────────────────────────────
  const [acceptPending, setAcceptPending] = useState<string | null>(null);
  const [acceptFailure, setAcceptFailure] = useState<{ postId: string; line: string } | null>(null);

  const openThread = useCallback((id: string) => {
    // ⚠️ Cleared rather than left, so re-opening a thread never shows the previous one's posts
    // for a frame. `undefined` is `loading`, which is what this is.
    setRead(undefined);
    setThreadId(id);
    // 🔴 EVERY write-side state is per thread and is cleared with it. A draft that survived into
    // the next thread would be somebody's answer to one question, sitting in the box under
    // another — and one click from being posted there.
    setDraft('');
    setSending(false);
    setLastWrite(null);
    setPosted(null);
    setAcceptPending(null);
    setAcceptFailure(null);
  }, []);

  const onBack = useCallback(() => setThreadId(null), []);
  const onRetry = useCallback(() => {
    setRead(undefined);
    setGeneration((n) => n + 1);
  }, []);

  useEffect(() => {
    let live = true;
    void readCommunitySession().then((found) => {
      if (live) setSession(found);
    });
    return () => {
      live = false;
    };
  }, [generation]);

  useEffect(() => {
    // Same rule as `useCommunityMirror`: wait for the store, or the one request a reader makes
    // goes out signed out.
    if (threadId === null || session === undefined) return;

    let live = true;
    const client = clientFor(session);

    void Promise.all([client.me(), client.thread(threadId)]).then(([meRead, threadRead]) => {
      if (!live) return;
      setMe(meRead);
      setRead(threadRead);
      if (threadRead.outcome === 'ok') {
        THREAD_CACHE.set(threadId, { thread: threadRead.value, at: Date.now() });
      }
      // 🔴 A COMPLETED re-read retires the composer's "Posted. Re-reading the thread…" line —
      // whether that read succeeded or not, because the sentence describes a request that is now
      // over either way. ⚠️ A FAILED write is never cleared here: its text is still in the box
      // and the reason it did not send has to stay under it until the next attempt. `posted` also
      // survives, and `postedNote` is what turns it into the right sentence for the copy on screen.
      setLastWrite((previous) => (previous?.outcome === 'ok' ? null : previous));
    });

    return () => {
      live = false;
    };
  }, [threadId, session, generation]);

  /**
   * AC4 — post the answer.
   *
   * 🔴 **Nothing is drawn as having happened until the platform says it did.** A version of this
   * that pushed the draft into `thread.answers` locally would show an answer that reads exactly
   * like a posted one, on a thread the community never received — and it would keep reading that
   * way after the failure line appeared beside it. What IS optimistic here is the state: the box
   * goes busy immediately, and the outcome is drawn the moment it is known.
   *
   * ⚠️ The client is built here rather than held in state because the session may have been
   * refreshed since this pane opened, and a token captured at open time is the one that expires.
   */
  const onSubmit = useCallback(() => {
    if (threadId === null || sending) return;
    // ⚠️ Re-checked here, not only in the disabled button. A keyboard, a stale render and an
    // enter-to-send that a later session adds all reach this function without passing that button.
    if (!canSendAnswer(draft)) return;

    setSending(true);
    // 🔴 The previous failure is cleared on the ATTEMPT, not on success. Leaving it up while a
    // fresh request is in flight puts a stale reason under a box that is currently busy.
    setLastWrite(null);

    const client = clientFor(session);
    void client.answer(threadId, { body: draft.trim() }).then((write) => {
      setSending(false);
      setLastWrite(write);
      if (write.outcome !== 'ok') return;
      // ✅ Only now. The text is cleared because the platform holds it, and `posted` records what
      // it holds so the screen can say so even if the re-read never lands.
      setDraft('');
      setPosted({ at: Date.now(), postId: write.value.postId });
      setGeneration((n) => n + 1);
    });
  }, [threadId, draft, sending, session]);

  /**
   * AC6 — accept an answer.
   *
   * ⚠️ No optimistic marking either, and for a sharper reason than the composer's: the accepted
   * marker is the one piece of state on this screen that the ASKER cannot correct. Drawing it
   * before the platform confirms would mean a person believing they had thanked somebody who was
   * never told.
   */
  const onAccept = useCallback(
    (postId: string) => {
      if (threadId === null || acceptPending !== null) return;
      setAcceptPending(postId);
      setAcceptFailure(null);

      const client = clientFor(session);
      void client.acceptAnswer(threadId, postId).then((write) => {
        setAcceptPending(null);
        const line = acceptFailureLine(write);
        if (line) {
          setAcceptFailure({ postId, line });
          return;
        }
        // The accepted marker comes from the thread, so the only honest way to draw it is to
        // re-read the thread. ⚠️ `read` is deliberately NOT blanked: a flash of "Loading…" over a
        // thread somebody is reading is a worse answer than a marker that appears a moment later.
        setGeneration((n) => n + 1);
      });
    },
    [threadId, acceptPending, session]
  );

  if (threadId === null) return { pane: null, openThread };

  const state = composeThreadView({
    me,
    read,
    cached: THREAD_CACHE.get(threadId) ?? null,
    pullFor: options.pullFor,
    posted,
    accept: { pendingPostId: acceptPending, failure: acceptFailure, onAccept }
  });

  return {
    openThread,
    pane: {
      state,
      onBack,
      onRetry,
      // 🔴 The one place a link in a stranger's post reaches the outside world, and it is a
      // decided hand-off with a call site to audit — which is the whole of NAT-012's model.
      // `CommunityPostBody` never navigates on its own.
      onOpenLink: (href: string) => platformOpenExternal(href),
      // ✅ **D5 settled 2026-08-20 — the editor gets the same session scope as the browser**, so
      // this is a composer rather than the labelled hand-off it was. ⚠️ The hand-off did not go
      // away: `composeReplyBox` still returns it for a reader with no session, because the thread
      // is readable signed out and the rail has no sign-in control of its own.
      reply: composeReplyBox({
        signedIn: Boolean(session),
        draft,
        sending,
        last: lastWrite,
        onChange: setDraft,
        onSubmit,
        onHandoff: () => platformOpenExternal(`${COMMUNITY_URL}/bench/${encodeURIComponent(threadId)}`)
      })
    }
  };
}

/**
 * ⚠️ Imported lazily so this module stays loadable by a runner with no Electron.
 * `@noodl/platform` resolves to the Electron implementation at import time in the renderer, and a
 * spec that only wants {@link useCommunityThread}'s state machine should not need one.
 */
function platformOpenExternal(url: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { platform } = require('@noodl/platform') as typeof import('@noodl/platform');
  platform.openExternal(url);
}
