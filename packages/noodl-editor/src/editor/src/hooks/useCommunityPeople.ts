/**
 * NAT-008 — the directory, one profile, and which of the two is open.
 *
 * ## 🔴 One hook, two surfaces — `useCommunityThread`'s argument, unchanged
 *
 * *"Which person is open, what did we get, and how old is it"* is the same question in the
 * launcher tab and in the editor's rail panel. UNI-011 already paid for the alternative: two
 * copies of one view model and a fix that lands on one of them.
 *
 * ## ⚠️ The cache is IN MEMORY, for this editor session, and here it is not merely convenient
 *
 * `useCommunityThread` explains why a thread is not written to disk. **A member directory is the
 * case D8 is actually named after** — *"caching a member directory to every laptop is a privacy
 * decision"* — and this task's own trap says the same thing from the other end: caching turns
 * *"the platform holds a directory"* into *"every user's laptop holds a directory"*. D8 is open,
 * so nothing here touches `userData`, and when D8 lands nothing has to move: the input is already
 * a `{profile, at}`.
 *
 * ## ⚠️ The query and the filters live HERE rather than in the view model
 *
 * `composeDirectory` is a pure function of `{me, read, query, activeFilters}` so a spec can call
 * it. What the person has typed is React state, and it belongs to the surface that owns the input.
 *
 * @module noodl-editor/hooks/useCommunityPeople
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  CommunityApiClient,
  readDirectory,
  type Directory,
  type MeResponse,
  type PersonProfile,
  type Read
} from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import { composeDirectory, composeProfileView } from '@noodl-models/community/peopleview';

import type {
  CommunityDirectoryViewModel,
  CommunityProfileDetailView,
  CommunityProfileState
} from '@noodl-core-ui/components/community';

/**
 * Profiles read this session, newest read wins.
 *
 * ⚠️ Module scope rather than a ref, so the rail panel and the launcher tab share one copy and
 * going back and forth does not re-fetch from nothing. 🔴 **Never written to disk** — see the
 * module note and D8.
 */
const PROFILE_CACHE = new Map<string, { profile: PersonProfile; at: number }>();

/** Exported for the suite — a cache no test can clear is a test that depends on its order. */
export function clearProfileCache(): void {
  PROFILE_CACHE.clear();
}

export type CommunityPeoplePane = {
  directory: CommunityDirectoryViewModel;
  onQueryChange: (query: string) => void;
  onToggleFilter: (key: string) => void;
  onOpenPerson: (handle: string) => void;
  onRetry: () => void;
};

export type CommunityProfilePane = {
  state: CommunityProfileState;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink: (href: string) => void;
};

export type CommunityPeopleHost = {
  /** 🔴 `null` when D15 refused this viewer — the surface draws nothing at all, not an empty. */
  people: CommunityPeoplePane | null;
  /** `null` when no profile is open. */
  profile: CommunityProfilePane | null;
  openPerson: (handle: string) => void;
};

export function useCommunityPeople(): CommunityPeopleHost {
  const [handle, setHandle] = useState<string | null>(null);
  const [session, setSession] = useState<CommunitySession | null | undefined>(undefined);
  const [me, setMe] = useState<Read<MeResponse> | undefined>(undefined);
  const [directoryRead, setDirectoryRead] = useState<Read<Directory> | undefined>(undefined);
  const [profileRead, setProfileRead] = useState<Read<PersonProfile> | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [generation, setGeneration] = useState(0);

  const openPerson = useCallback((next: string) => {
    // ⚠️ Cleared rather than left, so opening a second profile never shows the first one's badges
    // for a frame. `undefined` is `loading`, which is what this is.
    setProfileRead(undefined);
    setHandle(next);
  }, []);

  const onBack = useCallback(() => setHandle(null), []);
  const onRetry = useCallback(() => {
    setDirectoryRead(undefined);
    setProfileRead(undefined);
    setGeneration((n) => n + 1);
  }, []);

  const onToggleFilter = useCallback((key: string) => {
    setActiveFilters((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]
    );
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
    // Same rule as `useCommunityThread`: wait for the store, or the one request a reader makes
    // goes out signed out.
    if (session === undefined) return;

    let live = true;
    const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });

    void Promise.all([client.me(), readDirectory(client)]).then(([meRead, listRead]) => {
      if (!live) return;
      setMe(meRead);
      setDirectoryRead(listRead);
    });

    return () => {
      live = false;
    };
  }, [session, generation]);

  useEffect(() => {
    if (handle === null || session === undefined) return;

    let live = true;
    const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });

    void client.person(handle).then((read) => {
      if (!live) return;
      setProfileRead(read);
      if (read.outcome === 'ok') PROFILE_CACHE.set(handle, { profile: read.value, at: Date.now() });
    });

    return () => {
      live = false;
    };
  }, [handle, session, generation]);

  const directory = useMemo(
    () => composeDirectory({ me, read: directoryRead, query, activeFilters }),
    [me, directoryRead, query, activeFilters]
  );

  const profile: CommunityProfilePane | null =
    handle === null
      ? null
      : {
          state: composeProfileView({
            me,
            read: profileRead,
            cached: PROFILE_CACHE.get(handle) ?? null,
            contactFor: contactFor
          }),
          onBack,
          onRetry,
          // 🔴 The one place a link somebody put on their profile reaches the outside world, and
          // it is a decided hand-off with a call site to audit — NAT-012's whole model.
          onOpenLink: (href: string) => platformOpenExternal(href)
        };

  return {
    openPerson,
    profile,
    people:
      directory.surface === 'hidden'
        ? null
        : {
            directory: directory.view,
            onQueryChange: setQuery,
            onToggleFilter,
            onOpenPerson: openPerson,
            onRetry
          }
  };
}

/**
 * AC6 — *"contact affordances do exactly what they say."*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **AND THE HONEST ANSWER TODAY IS THAT THERE IS NO CONTACT ROUTE, so this draws nothing.**
 *
 * `PersonProfile` carries a handle, a bio, two flags, badges and the links somebody chose to
 * publish. It carries **no email address**, and the platform is deliberate about that: UNI-004's
 * double-blind relay exists precisely so that responding to an RFP does not hand anybody's
 * address to anybody else, and D10 — *does the relay survive v1* — is still open.
 *
 * ⚠️ So the two tempting affordances are both wrong right now. A *"Message"* button that opened
 * `community.nodegx.io` in Chrome is the thing AC6 names in as many words. A `mailto:` is an
 * address this client does not have. The third option — *"ask them on the Bench"* — is a real
 * route and it is **NAT-009/NAT-010's**, through the RFP and coaching flows, which are writes.
 *
 * ✅ D5 was settled on 2026-08-20, so those writes are unblocked and this function is where the
 * verb lands when one of them ships. Returning `null` until then means the profile has no button
 * rather than a button that lies, which is the criterion.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
function contactFor(_profile: PersonProfile): CommunityProfileDetailView['contact'] {
  return null;
}

/**
 * ⚠️ Imported lazily so this module stays loadable by a runner with no Electron — the same reason
 * `useCommunityThread` does it.
 */
function platformOpenExternal(url: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { platform } = require('@noodl/platform') as typeof import('@noodl/platform');
  platform.openExternal(url);
}
