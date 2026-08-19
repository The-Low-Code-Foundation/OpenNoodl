/**
 * UNI-011 — the panel's data, pulled on a clock this file owns.
 *
 * 🔴 **AC5: the unread count is produced by an editor-outbound poll. No inbound connection, no
 * socket, no OS notification.** `communityapi.poll()` was written so the *caller* owns the clock,
 * and this is that caller — the first one. Nothing can *check* that the editor holds no inbound
 * connection except that no module opens one, so keep it that way.
 *
 * ⚠️ **Three polls rather than one composite, and that is deliberate.** A composite would have to
 * invent a `Read<T>` to satisfy `poll`'s signature, and a scheduler handed a fabricated result is
 * a scheduler whose contract has been quietly voided. Three intervals a minute apart cost nothing
 * and each one is the read it says it is.
 *
 * ⚠️ **Sixty seconds is a posture, not a tuning.** A forum is not a chat window and a minute-old
 * thread list has never been wrong in a way anyone noticed. A faster poll is a socket with extra
 * steps, which is the thing AC5 rules out.
 *
 * @module noodl-editor/hooks/useCommunityMirror
 */

import { useCallback, useEffect, useState } from 'react';

import {
  CommunityApiClient,
  poll,
  type CommunityHome,
  type ForumState,
  type MeResponse,
  type Read
} from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';

import { composeMirror, type MirrorView } from '@noodl-models/community/mirrorview';

const POLL_EVERY_MS = 60_000;

export type CommunityMirror = {
  view: MirrorView;
  /** True while a refresh is in flight, so the button can say so. */
  isRefreshing: boolean;
  refresh: () => void;
};

export function useCommunityMirror(): CommunityMirror {
  /** `undefined` = the store has not answered · `null` = answered, signed out. */
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [me, setMe] = useState<Read<MeResponse> | undefined>(undefined);
  const [home, setHome] = useState<Read<CommunityHome> | undefined>(undefined);
  const [forum, setForum] = useState<Read<ForumState> | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /** Bumped by `refresh()`, to re-read the store and re-pull. */
  const [generation, setGeneration] = useState(0);

  const refresh = useCallback(() => setGeneration((n) => n + 1), []);

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
    // ⚠️ Wait for the store. Building a client before `readCommunitySession` answers sends the
    // first — and, on a panel nobody refreshes, the only — request signed out, so a signed-in
    // user's standing is missing until the poll comes round a minute later.
    if (session === undefined) return;

    let live = true;
    const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });

    const pullAll = async () => {
      if (live) setIsRefreshing(true);
      const [meRead, homeRead, forumRead] = await Promise.all([client.me(), client.home(), client.threads()]);
      if (!live) return;
      setMe(meRead);
      setHome(homeRead);
      setForum(forumRead);
      setIsRefreshing(false);
    };

    void pullAll();

    const guard =
      <T,>(set: (value: Read<T>) => void) =>
      (value: Read<T>) => {
        if (live) set(value);
      };

    const stops = [
      poll(() => client.me(), guard(setMe), { everyMs: POLL_EVERY_MS }),
      poll(() => client.home(), guard(setHome), { everyMs: POLL_EVERY_MS }),
      poll(() => client.threads(), guard(setForum), { everyMs: POLL_EVERY_MS })
    ];

    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, [session, generation]);

  return {
    view: composeMirror({ me, home, forum, session: session === undefined ? undefined : session }),
    isRefreshing,
    refresh
  };
}
