/**
 * FB-013 C4/composer — the launcher's chat river, the thread you opened from it, and the two
 * writes: starting a conversation and replying in one.
 *
 * ## 🔴 The river is fetched WITHOUT a channel, always
 *
 * `client.chat()` takes an optional `channel` and this hook never sends it. That is not an
 * oversight and it is not laziness — it is `facets.ts`' rule, which FB-013 leans on harder than
 * any other list on the platform: **a pill's count and a pill's rows must come from one pass
 * over one list**. Asking the platform per channel would make the number above a pill and the
 * rows behind it two different answers to one question, and the channel facet *is* the design
 * here, so that drift would be the feature failing rather than a cosmetic bug.
 *
 * So the fetch is the whole river and {@link composeChat} narrows it in memory. The client's
 * parameter stays for a caller that wants one channel and no counts; this is not that caller.
 *
 * ## ✅ D5 session parity, carried over from the bench
 *
 * FB-013's read half shipped signed-out-readable, and the two writes below get the composer
 * `useCommunityThread.ts` earns for the bench: a signed-in editor posts and replies directly —
 * see `chatwrites.composeChatComposer`/`composeChatReplyBox` — and a signed-out one gets a
 * labelled hand-off to the web, never a dead sign-in line.
 *
 * ## ⚠️ Separate from `useCommunityMirror`, deliberately
 *
 * The mirror pulls three surfaces on one clock for the Bench tab and the rail. Chat is a fourth
 * surface that only one tab draws, and folding it in would make every rail panel poll a river
 * nobody on that surface can see. Same reason the mirror does not fetch the directory.
 *
 * @module noodl-editor/hooks/useCommunityChat
 */

import { useCallback, useEffect, useState } from 'react';

import type { CommunityChatComposerBox, CommunityChatThreadState, CommunityReplyBox } from '@noodl-core-ui/components/community';

import {
  CommunityApiClient,
  poll,
  type ChatMessage,
  type ChatPostAccepted,
  type ChatReplyAccepted,
  type ChatThread,
  type Read,
  type Write
} from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import {
  ALL_CHANNELS,
  CHAT_CHANNELS,
  composeChat,
  composeChatThread,
  type CommunityChatThreadView,
  type CommunityChatView
} from '@noodl-models/community/chatview';
import { composeChatComposer, composeChatReplyBox } from '@noodl-models/community/chatwrites';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import {
  COMMUNITY_THREAD_EVENT,
  clearPendingCommunityThread,
  takePendingCommunityThread
} from '../utils/community/communityThreadRequest';

/** ⚠️ The mirror's cadence. A river that refreshed faster would be a different promise about
    liveness than the rest of the page makes, and FB-013 §6 rules out realtime for v1. */
const POLL_EVERY_MS = 60_000;

export type CommunityChatPane =
  | { state: 'closed' }
  | { state: 'loading'; messageId: string }
  | { state: 'open'; messageId: string; view: CommunityChatThreadView }
  | { state: 'unreachable'; messageId: string; detail: string };

export type CommunityChat = {
  view: CommunityChatView;
  /**
   * 🔴 **The VIEW's shape, with the id dropped.** The id exists so a response for a thread the
   * reader has already swapped away from can be discarded (see {@link CommunityChatPane}); the
   * component has no use for it, and passing it would invite a second renderer to start making
   * decisions with it.
   */
  thread: CommunityChatThreadState;
  isRefreshing: boolean;
  refresh: () => void;
  selectChannel: (key: string) => void;
  openThread: (messageId: string) => void;
  closeThread: () => void;
  /** How to start a conversation. See {@link CommunityChatComposerBox}. */
  composer: CommunityChatComposerBox;
  /** How to reply, for whichever thread is open. `null` when none is. */
  reply: CommunityReplyBox | null;
};

/**
 * 🔴 THE ONLY PLACE THE TOKEN IS TOUCHED, `useCommunityThread.ts`'s reason: `uni-001/session-
 * readers.test.ts` counts it. Built per call rather than held in state — a session may have been
 * refreshed since this tab opened, and a token captured at open time is the one that expires.
 */
function clientFor(session: CommunitySession | null | undefined): CommunityApiClient {
  return new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });
}

export function useCommunityChat(): CommunityChat {
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [river, setRiver] = useState<Read<ChatMessage[]> | undefined>(undefined);
  const [channel, setChannel] = useState<string>(ALL_CHANNELS);
  const [pane, setPane] = useState<CommunityChatPane>({ state: 'closed' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generation, setGeneration] = useState(0);

  // ── Starting a conversation ─────────────────────────────────────────────────────────────
  const [postChannel, setPostChannel] = useState<string>(CHAT_CHANNELS[0]);
  const [postDraft, setPostDraft] = useState('');
  const [postSending, setPostSending] = useState(false);
  const [postLastWrite, setPostLastWrite] = useState<Write<ChatPostAccepted> | null>(null);

  // ── Replying — per open thread, cleared with it ─────────────────────────────────────────
  const [replyDraft, setReplyDraft] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyLastWrite, setReplyLastWrite] = useState<Write<ChatReplyAccepted> | null>(null);

  const refresh = useCallback(() => setGeneration((n) => n + 1), []);

  /**
   * ⚠️ **Any key is accepted and `composeChat` decides what it means.** A pill carrying a channel
   * this build does not know about narrows to nothing here but falls back to the whole river
   * there, which is the same forgiving direction the route takes with an unknown `?channel=`.
   */
  const selectChannel = useCallback((key: string) => setChannel(key), []);

  const closeThread = useCallback(() => {
    setPane({ state: 'closed' });
    // 🔴 Cleared with the thread, `useCommunityThread.openThread`'s reason: a reply drafted for
    // one conversation must not survive into the box under a different one.
    setReplyDraft('');
    setReplySending(false);
    setReplyLastWrite(null);
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
    // ⚠️ Wait for the store, for `useCommunityMirror`'s reason: a client built before the session
    // resolves sends its first request signed out.
    if (session === undefined) return;

    let live = true;
    const client = clientFor(session);

    const pull = async () => {
      if (live) setIsRefreshing(true);
      const read = await client.chat();
      if (!live) return;
      setRiver(read);
      setIsRefreshing(false);
    };

    void pull();

    const stop = poll(
      () => client.chat(),
      (value) => {
        if (live) setRiver(value);
      },
      { everyMs: POLL_EVERY_MS }
    );

    return () => {
      live = false;
      stop();
    };
  }, [session, generation]);

  /**
   * Open one thread, or re-pull the one already open.
   *
   * 🔴 **The pane goes to `loading` BEFORE the await ONLY when `silent` is false.** A reply that
   * just posted re-pulls the thread it posted into — `useCommunityThread.onAccept`'s reasoning
   * applies unchanged: a flash of "Loading…" over a conversation somebody is mid-reply on is a
   * worse answer than the new message appearing a moment later. Opening a *different* thread has
   * no prior screen to preserve, so that path still blanks first.
   */
  const loadThread = useCallback(
    (messageId: string, options: { silent?: boolean } = {}) => {
      if (session === undefined) return;
      if (!options.silent) setPane({ state: 'loading', messageId });

      const client = clientFor(session);
      void client.chatThread(messageId).then((read: Read<ChatThread>) => {
        setPane((current) => {
          // ⚠️ A response for a thread the reader has since left, or swapped away from, is
          // dropped rather than drawn. `current.messageId` is the check that makes that possible.
          if (current.state === 'closed') return current;
          if (current.messageId !== messageId) return current;

          if (read.outcome === 'ok') {
            return { state: 'open', messageId, view: composeChatThread(read.value) };
          }
          return {
            state: 'unreachable',
            messageId,
            detail:
              read.outcome === 'unreachable'
                ? read.detail
                : // ⚠️ `absent` here is the platform saying a REPLY's id is not a thread, which is
                  // its rule rather than an error — so the sentence names the likely cause.
                  'that conversation could not be opened — it may have been removed'
          };
        });
      });
    },
    [session]
  );

  const openThread = useCallback(
    (messageId: string) => {
      // 🔴 Every write-side state is per thread and is cleared with it — `useCommunityThread`'s
      // rule: a draft that survived into the next thread is one click from being posted there.
      setReplyDraft('');
      setReplySending(false);
      setReplyLastWrite(null);
      loadThread(messageId);
    },
    [loadThread]
  );

  /**
   * NAT-012 AC4 — a thread somebody asked for from elsewhere in the editor.
   *
   * See `useCommunityThread.ts`'s identical listener for why both halves are needed.
   */
  useEffect(() => {
    const group = {};
    EventDispatcher.instance.on(
      COMMUNITY_THREAD_EVENT,
      (id: string) => {
        clearPendingCommunityThread();
        openThread(id);
      },
      group
    );

    const pending = takePendingCommunityThread();
    if (pending) openThread(pending);

    return () => EventDispatcher.instance.off(group);
  }, [openThread]);

  /**
   * Start a conversation.
   *
   * 🔴 **Nothing is drawn as posted until the platform says so** — `useCommunityThread.onSubmit`'s
   * rule: the box goes busy immediately, and the row it produced arrives through the river's own
   * re-pull rather than being pushed in locally.
   */
  const onSubmitPost = useCallback(() => {
    if (postSending) return;

    setPostSending(true);
    setPostLastWrite(null);

    const client = clientFor(session);
    void client.postChat({ channel: postChannel, body: postDraft.trim() }).then((write) => {
      setPostSending(false);
      setPostLastWrite(write);
      if (write.outcome !== 'ok') return;
      setPostDraft('');
      refresh();
    });
  }, [session, postChannel, postDraft, postSending, refresh]);

  /** Reply in the open thread. */
  const onSubmitReply = useCallback(() => {
    if (pane.state !== 'open' || replySending) return;
    const messageId = pane.messageId;

    setReplySending(true);
    setReplyLastWrite(null);

    const client = clientFor(session);
    void client.replyChat(messageId, replyDraft.trim()).then((write) => {
      setReplySending(false);
      setReplyLastWrite(write);
      if (write.outcome !== 'ok') return;
      setReplyDraft('');
      // The reply itself, drawn in place — not blanked, `loadThread`'s `silent` arm.
      loadThread(messageId, { silent: true });
      // 🔴 FIX-025's lesson, one surface later: the river's `replyCount` on this root is now
      // stale too, and it is a DIFFERENT hook's state — bump its generation as well.
      refresh();
    });
  }, [pane, session, replyDraft, replySending, loadThread, refresh]);

  const thread: CommunityChatThreadState =
    pane.state === 'closed'
      ? { state: 'closed' }
      : pane.state === 'loading'
        ? { state: 'loading' }
        : pane.state === 'unreachable'
          ? { state: 'unreachable', detail: pane.detail }
          : { state: 'open', ...pane.view };

  return {
    view: composeChat(river, channel),
    thread,
    isRefreshing,
    refresh,
    selectChannel,
    openThread,
    closeThread,
    composer: composeChatComposer({
      signedIn: Boolean(session),
      channel: postChannel,
      draft: postDraft,
      sending: postSending,
      last: postLastWrite,
      onChannelChange: setPostChannel,
      onChange: setPostDraft,
      onSubmit: onSubmitPost,
      onHandoff: () => platformOpenExternal(`${COMMUNITY_URL}/chat`)
    }),
    reply:
      pane.state === 'open'
        ? composeChatReplyBox({
            signedIn: Boolean(session),
            draft: replyDraft,
            sending: replySending,
            last: replyLastWrite,
            onChange: setReplyDraft,
            onSubmit: onSubmitReply,
            onHandoff: () => platformOpenExternal(`${COMMUNITY_URL}/chat/${encodeURIComponent(pane.messageId)}`)
          })
        : null
  };
}

/**
 * ⚠️ Imported lazily so this module stays loadable by a runner with no Electron.
 * `@noodl/platform` resolves to the Electron implementation at import time in the renderer, and a
 * spec that only wants {@link useCommunityChat}'s state machine should not need one.
 */
function platformOpenExternal(url: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { platform } = require('@noodl/platform') as typeof import('@noodl/platform');
  platform.openExternal(url);
}
