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
  type MeResponse,
  type Read,
  type ThreadDetail
} from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import { composeThreadView, type PullOffer } from '@noodl-models/community/threadview';

import type { CommunityThreadState } from '@noodl-core-ui/components/community';

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

export type CommunityThreadPane = {
  state: CommunityThreadState;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink: (href: string) => void;
  reply: { line: string; actionLabel: string; onAction: () => void } | null;
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

  const openThread = useCallback((id: string) => {
    // ⚠️ Cleared rather than left, so re-opening a thread never shows the previous one's posts
    // for a frame. `undefined` is `loading`, which is what this is.
    setRead(undefined);
    setThreadId(id);
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
    const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });

    void Promise.all([client.me(), client.thread(threadId)]).then(([meRead, threadRead]) => {
      if (!live) return;
      setMe(meRead);
      setRead(threadRead);
      if (threadRead.outcome === 'ok') {
        THREAD_CACHE.set(threadId, { thread: threadRead.value, at: Date.now() });
      }
    });

    return () => {
      live = false;
    };
  }, [threadId, session, generation]);

  if (threadId === null) return { pane: null, openThread };

  const state = composeThreadView({
    me,
    read,
    cached: THREAD_CACHE.get(threadId) ?? null,
    pullFor: options.pullFor
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
      // 🔴 **D5 is open, so there is no write here** — see NAT-007 AC4. What there is instead is
      // an honest statement of where an answer goes today. ⚠️ A screen with no way to answer at
      // all would be the browser round trip this task exists to remove, with an extra step in
      // front of it; a composer that silently failed would be worse than both.
      reply: {
        line: 'Answering from the editor is not switched on yet — your reply goes to the same thread on the web.',
        actionLabel: 'Answer on the web',
        onAction: () => platformOpenExternal(`${COMMUNITY_URL}/bench/${encodeURIComponent(threadId)}`)
      }
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
