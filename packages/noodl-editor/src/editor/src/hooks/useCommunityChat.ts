/**
 * FB-013 C4 — the launcher's chat river, and the thread you opened from it.
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
 * ## ⚠️ Separate from `useCommunityMirror`, deliberately
 *
 * The mirror pulls three surfaces on one clock for the Bench tab and the rail. Chat is a fourth
 * surface that only one tab draws, and folding it in would make every rail panel poll a river
 * nobody on that surface can see. Same reason the mirror does not fetch the directory.
 *
 * @module noodl-editor/hooks/useCommunityChat
 */

import { useCallback, useEffect, useState } from 'react';

import type { CommunityChatThreadState } from '@noodl-core-ui/components/community';

import { CommunityApiClient, poll, type ChatMessage, type ChatThread, type Read } from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import {
  ALL_CHANNELS,
  composeChat,
  composeChatThread,
  type CommunityChatThreadView,
  type CommunityChatView
} from '@noodl-models/community/chatview';

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
};

export function useCommunityChat(): CommunityChat {
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [river, setRiver] = useState<Read<ChatMessage[]> | undefined>(undefined);
  const [channel, setChannel] = useState<string>(ALL_CHANNELS);
  const [pane, setPane] = useState<CommunityChatPane>({ state: 'closed' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generation, setGeneration] = useState(0);

  const refresh = useCallback(() => setGeneration((n) => n + 1), []);

  /**
   * ⚠️ **Any key is accepted and `composeChat` decides what it means.** A pill carrying a channel
   * this build does not know about narrows to nothing here but falls back to the whole river
   * there, which is the same forgiving direction the route takes with an unknown `?channel=`.
   */
  const selectChannel = useCallback((key: string) => setChannel(key), []);

  const closeThread = useCallback(() => setPane({ state: 'closed' }), []);

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
    const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });

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
   * Open one thread.
   *
   * 🔴 **The pane goes to `loading` BEFORE the await, and it carries the id it is loading.**
   * Without the id, a second click while the first is in flight cannot be told from the first,
   * and the slower response wins — which is how a reader ends up in a thread they did not pick.
   */
  const openThread = useCallback(
    (messageId: string) => {
      if (session === undefined) return;
      setPane({ state: 'loading', messageId });

      const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });
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
    closeThread
  };
}
