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
  type MyListingResponse,
  type PersonProfile,
  type Read
} from '@noodl-models/community/communityapi';
import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';
import { readCommunitySession, type CommunitySession } from '@noodl-models/community/communitysession';
import { composeDirectory, composeListing, composeProfileView } from '@noodl-models/community/peopleview';

import type {
  CommunityDirectoryViewModel,
  CommunityListingState,
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
  /** REL-015 §1. 🔴 `null` when there is nobody to list — see {@link composeListing}. */
  listing: CommunityListingPane | null;
};

export type CommunityListingPane = {
  state: CommunityListingState;
  bio: string;
  busy: boolean;
  onBioChange: (bio: string) => void;
  onRequest: () => void;
  onWithdraw: () => void;
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
  const [listingRead, setListingRead] = useState<Read<MyListingResponse> | undefined>(undefined);
  /**
   * REL-015 §1 — what this person has typed into the bio box THIS SESSION.
   *
   * 🔴 **`null` MEANS "NOT TOUCHED YET" AND IS NOT THE SAME AS `''`.** The box shows
   * `typedBio ?? the account's existing bio` (see `listedBio` below), so `null` is what lets the
   * account's own text show through — and `''` is somebody who selected that text and deleted it,
   * which must stay deleted. Collapsing the two would make the box refill itself under a cursor
   * on the next refresh.
   */
  const [typedBio, setTypedBio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    // ⚠️ REL-015 — cleared too, and the omission would have been invisible: the listing card's
    // own "Try again" button is this same callback, so leaving the stale `error` read in place
    // would give it a button that re-fetched the directory and left the card's message exactly
    // where it was. `undefined` is `loading`, which is what a retry is.
    setListingRead(undefined);
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

    /**
     * 🔴 **THE LISTING READ IS UNCONDITIONAL, AND THE FIRST VERSION OF THIS LINE WAS NOT.** It
     * read `session?.token ? client.myListing() : Promise.resolve(undefined)` — an optimisation
     * (a signed-out caller's answer is a 401 nobody needs) that `uni-001/session-readers.test.ts`
     * caught and was right to: UNI-001 AC4 counts `session?.token` and expects it **once per
     * client and nowhere else**, because *"a third use is a third place a decision could hide."*
     *
     * ⚠️ The branch was defensible and the rule is better. Every read on this surface goes out
     * the same way for everybody and every decision about what to DRAW is made in
     * `composeListing`, off `me` — the route that answers 200 signed out and says who the viewer
     * is. A gated read is one 401 saved and one more place a future edit can quietly decide that
     * somebody does not get a surface.
     */
    void Promise.all([client.me(), readDirectory(client), client.myListing()]).then(
      ([meRead, listRead, mine]) => {
        if (!live) return;
        setMe(meRead);
        setDirectoryRead(listRead);
        setListingRead(mine);
        // 🔴 NOTHING SEEDS THE BIO BOX HERE, AND THAT IS THE POINT. The displayed value is derived
        // below as `typedBio ?? whatever the account already has`, so a refresh landing a beat
        // after somebody started typing cannot overwrite them — there is no write to race with.
        // A seeding effect is the version of this that has that bug.
      }
    );

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

  const listing = useMemo(() => composeListing({ me, read: listingRead }), [me, listingRead]);

  /**
   * REL-015 §1 — the bio the box shows.
   *
   * 🔴 **DERIVED, NEVER STORED-THEN-SYNCED.** `typedBio` is what this person has typed in this
   * session and `null` until they touch the box; underneath it is whatever bio the account
   * already has. So a refresh cannot overwrite an edit in progress, and there is no effect to get
   * the ordering wrong in. ⚠️ `?? ''` and not `?? null`: the textarea is CONTROLLED, and React
   * switches a controlled input to an uncontrolled one on `undefined` with a console warning and
   * a field that then ignores its own value.
   */
  const listedBio =
    typedBio ?? (listingRead?.outcome === 'ok' ? (listingRead.value.item?.bio ?? '') : '');

  /**
   * 🔴 **RE-READS AFTER THE WRITE RATHER THAN BELIEVING THE RECEIPT.** `POST /api/v1/me/profile`
   * answers with the ACT that was requested and says in its own comment why: reading the row back
   * *"would invite a client to treat this response as the authority on a state a moderator owns."*
   * So the write's answer moves nothing on screen; the following read does.
   *
   * ⚠️ **A FAILED WRITE LEAVES `listingRead` ALONE**, which is what keeps the card honest: the
   * card goes on saying whatever was true before, rather than flipping to `pending` on the
   * strength of a request that 500'd. The `busy` flag comes off either way, so the button is never
   * stuck.
   */
  const runListingWrite = useCallback(
    (write: (client: CommunityApiClient) => Promise<unknown>) => {
      if (session === undefined) return;
      setBusy(true);
      const client = new CommunityApiClient({ baseUrl: COMMUNITY_URL, token: session?.token ?? null });
      void write(client)
        .then(() => client.myListing())
        .then((fresh) => {
          setListingRead(fresh);
          // ⚠️ Cleared so the box goes back to showing what the ACCOUNT now holds. Leaving it
          // would make a withdrawn-then-reopened card show a draft the server already has.
          setTypedBio(null);
          // The DIRECTORY changed too — withdrawing from `approved` takes a row out of it — so the
          // generation bump re-reads the list. ⚠️ That effect also re-reads the listing, so this
          // path makes TWO listing requests where one would do. Kept deliberately: the explicit
          // one is what `busy` covers, so the buttons stay disabled until the card is actually
          // showing the new state rather than until the POST returned. The second read cannot
          // disagree with the first — both are fresh — so it costs a request and no correctness.
          setGeneration((n) => n + 1);
        })
        .finally(() => setBusy(false));
    },
    [session]
  );

  const onRequestListing = useCallback(
    () => runListingWrite((client) => client.requestListing(listedBio)),
    [runListingWrite, listedBio]
  );
  const onWithdrawListing = useCallback(
    () => runListingWrite((client) => client.withdrawListing()),
    [runListingWrite]
  );

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
            onRetry,
            listing:
              listing.surface === 'hidden'
                ? null
                : {
                    state: listing.state,
                    bio: listedBio,
                    busy,
                    onBioChange: setTypedBio,
                    onRequest: onRequestListing,
                    onWithdraw: onWithdrawListing,
                    onRetry
                  }
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
