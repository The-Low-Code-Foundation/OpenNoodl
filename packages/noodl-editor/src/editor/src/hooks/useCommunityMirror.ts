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

import {
  BENCH_DEFAULT_STATE,
  composeMirror,
  type BenchState,
  type MirrorView
} from '@noodl-models/community/mirrorview';
import { onCommunityChanged } from '../models/community/communitychanged';

const POLL_EVERY_MS = 60_000;

export type CommunityMirror = {
  view: MirrorView;
  /** True while a refresh is in flight, so the button can say so. */
  isRefreshing: boolean;
  refresh: () => void;
  /**
   * FB-002 — choose a Bench pill.
   *
   * ⚠️ Takes a `string` because that is what `CommunityFilterPill.key` is by the time a click
   * comes back from core-ui, and it is validated here rather than cast: an unknown key leaves the
   * selection alone. A cast would make a typo in a `data-test` selector look like a working
   * filter that happens to show nothing.
   */
  selectBenchFilter: (key: string) => void;
};

function isBenchState(key: string): key is BenchState {
  return key === 'waiting' || key === 'solved';
}

export function useCommunityMirror(): CommunityMirror {
  /** `undefined` = the store has not answered · `null` = answered, signed out. */
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [me, setMe] = useState<Read<MeResponse> | undefined>(undefined);
  const [home, setHome] = useState<Read<CommunityHome> | undefined>(undefined);
  const [forum, setForum] = useState<Read<ForumState> | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  /**
   * FB-002 — which Bench pill is on, for this mount.
   *
   * 🔴 **Not persisted, and not shared between the rail panel and the launcher tab.** AC4 asks
   * the two surfaces to show *the same default for the same account*, which they do because they
   * both start here. Sharing the live cursor would mean lifting this hook above both, and a
   * remembered filter is a different promise from a defaulted one — see the task file.
   */
  const [benchState, setBenchState] = useState<BenchState>(BENCH_DEFAULT_STATE);
  /** Bumped by `refresh()`, to re-read the store and re-pull. */
  const [generation, setGeneration] = useState(0);

  const refresh = useCallback(() => setGeneration((n) => n + 1), []);
  const selectBenchFilter = useCallback((key: string) => {
    if (isBenchState(key)) setBenchState(key);
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

  /**
   * 🔴 FIX-025 — re-pull when something in this editor writes to the community.
   *
   * Richard: *"Replying to a question works, but when I go back to the list of questions the
   * one I answered still says 'no reply yet'."* The reply is posted by `useCommunityThread`,
   * which bumps **its own** generation and re-reads **its own** thread. This hook drew the row
   * and had no way to know. Subscribing is the whole fix, and it is one line of behaviour:
   * a write anywhere means this mirror is out of date, so re-read it.
   *
   * ⚠️ `refresh` is stable (`useCallback` with no deps), so this subscribes once and the
   * cleanup really removes the listener rather than re-subscribing every render.
   */
  useEffect(() => onCommunityChanged(() => refresh()), [refresh]);

  return {
    view: composeMirror({ me, home, forum, session: session === undefined ? undefined : session, benchState }),
    isRefreshing,
    refresh,
    selectBenchFilter
  };
}
