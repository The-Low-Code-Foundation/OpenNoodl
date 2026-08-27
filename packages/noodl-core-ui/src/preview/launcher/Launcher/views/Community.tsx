/**
 * UNI-011 / D21 / NAT-005 — the community, as a launcher tab.
 *
 * ## Why the TYPES live here and not with the code that computes them
 *
 * 🔴 **`noodl-core-ui` cannot import `noodl-editor`** — it renders in Storybook, where the editor
 * does not exist. `useCommunityAccount.ts` states the rule and `CommunityAccountCard` is the
 * precedent: the editor adapts, core-ui renders, and the **type** is owned by the renderer so the
 * two cannot disagree about it.
 *
 * ⚠️ **So the editor's rail panel also imports its view model from a *launcher* path**, which
 * reads oddly and is deliberate. Richard's ruling on 2026-08-19 was *keep both surfaces*, and two
 * surfaces over one model is only worth anything if it is literally one model. The alternative —
 * a copy in the editor and a copy here — is the arrangement where a fix lands on one of them,
 * which is the failure this phase has now paid for repeatedly. The path is a wart; two view models
 * would be a defect.
 *
 * ## NAT-005 — what changed on 2026-08-19, and what did not
 *
 * This file used to be **two inline style objects and a 13px column**: `shy` and `rowStyle`, the
 * only structure `marginBottom: 28`. Nothing about it was a bug a designer would name and nothing
 * about it invited anybody in — it read as a status readout because that is what it was.
 *
 * The rendering now comes from `@noodl-core-ui/components/community`, which the editor's rail
 * panel draws from too. 🔴 **That shared vocabulary is the deliverable, not this page.** People,
 * jobs, coaching and University are four more surfaces about to want the same list, row, empty
 * and error — built once here, or invented four more times.
 *
 * ⚠️ **Three things were deliberately kept exactly as they were**: the four section states stay
 * four (UNI-011 paid for `loading` being its own case); `emptyLine` stays required and
 * per-section (D21's surviving obligation from D16); and the health numbers stay a readout with
 * their `required` and their `n` beside them (D21 reversed D16 — nothing may branch on them, and
 * nothing may draw them as a progress bar towards a threshold that no longer gates anything).
 *
 * ## What this component may and may not do
 *
 * 🔴 **It renders text children only.** The launcher is `pages/ProjectsPage` inside the *same*
 * `BrowserWindow` as the editor — `nodeIntegration: true, contextIsolation: false` — so this file
 * is under exactly the security constraint the rail panel is under, and for the same reason.
 * No `dangerouslySetInnerHTML`, ever. Post *bodies* do not reach this surface at all: the list
 * payloads carry titles and counts, and a body would have to come through `parsePostBody` →
 * `Block[]`, which has no field that can hold markup. ⚠️ `CommunityRow` types its `title`, `meta`
 * and `detail` as `string` rather than `ReactNode` for the same reason — a `ReactNode` prop is a
 * hole an element carrying markup fits through.
 *
 * @module noodl-core-ui/preview/launcher/Launcher/views/Community
 */

import classNames from 'classnames';
import React, { useState } from 'react';

import {
  CommunityBenchView,
  CommunityChatThread,
  CommunityChatView,
  CommunityDirectoryView,
  CommunityProfileView,
  CommunityRow,
  CommunitySection,
  CommunityThreadView,
  absoluteDate,
  kindLabel,
  metaLine,
  relativeTime
} from '@noodl-core-ui/components/community';
import type {
  CommunityBenchViewModel,
  CommunityChatThreadState,
  CommunityChatViewModel,
  CommunityDirectoryViewModel,
  CommunityProfileState,
  CommunityReplyBox,
  CommunitySectionState,
  CommunityThreadState
} from '@noodl-core-ui/components/community';
import css from '@noodl-core-ui/components/community/Community.module.scss';
import { TabStrip, TabsVariant } from '@noodl-core-ui/components/layout/Tabs';
import tabsCss from '@noodl-core-ui/components/layout/Tabs/Tabs.module.scss';
import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';
import { communityTabs, type CommunityTabId } from '@noodl-core-ui/preview/launcher/Launcher/views/communityTabs';

// ── The view model — owned here, computed in the editor ────────────────────────

/**
 * One section's state.
 *
 * ⚠️ Re-exported rather than declared: NAT-005 moved it next to the component that switches on
 * it, and the editor's `mirrorview.ts` has imported it from this path since UNI-011. Moving the
 * declaration and keeping the name is the change nobody has to notice; renaming the import site
 * would be a change every consumer has to.
 */
export type { CommunitySectionState };

/*
  ⚠️ **`CommunityThreadRow` was declared here** until FB-002 and is now `CommunityBenchRow`, in
  `components/community/CommunityBenchView.tsx` — next to the component that draws it, because the
  Bench grew a filter and the row grew the `accepted` field that filter reads. Both consumers
  import it from the vocabulary barrel; a re-export here would be the third spelling of one type,
  which is the copy this file's header warns about.

  ⚠️ **`externalId` was on that type and the platform has never sent it** — retired 2026-08-19 with
  the declaration in `communityapi.ts`, which says what it cost. Both surfaces built a browser URL
  out of it and opened `/bench/undefined`.
*/

export type CommunityArticleRow = { slug: string; title: string; summary: string | null; kind: string };

export type CommunityReplayRow = {
  slug: string;
  title: string;
  heldOn: string;
  videoUrl: string | null;
  description: string | null;
};

/**
 * The threshold, as a **readout**.
 *
 * 🔴 It was a gate until D21 reversed D16 on 2026-08-19, and this type is the evidence it no
 * longer is: nothing here is a boolean anything branches on. D16's second caveat is the half D21
 * keeps — *"a threshold nobody can see the approach to is a threshold that gets crossed by
 * rounding"* — so every component carries its `required`, and the median carries the `n` it was
 * computed from. A median over three staff-answered threads is a true statement about nothing.
 */
export type CommunityHealthReading = {
  threads: { value: number; required: number };
  weeksWithCall: { value: number; required: number };
  reply: { medianHours: number | null; requiredBelowHours: number; n: number; unreplied: number };
};

export type CommunityMirrorView =
  /** 🔴 D15 refused this viewer. Draw NOTHING — not a message, not an empty state. */
  | { surface: 'hidden' }
  | {
      surface: 'shown';
      /** `null` while the store is silent · `false` signed out · a handle when signed in. */
      viewer: { handle: string | null } | null | false;
      standing: { points: number; badges: number } | null;
      replays: CommunitySectionState<CommunityReplayRow>;
      articles: CommunitySectionState<CommunityArticleRow>;
      /**
       * FB-002 — the Bench, with its own filter, counts and bound line rather than a bare
       * section state. See `mirrorview.composeBench`: the rows and both pill counts come out of
       * one call, so a count cannot disagree with what clicking it gives you.
       */
      bench: CommunityBenchViewModel;
      health: CommunityHealthReading | null;
    };

/**
 * NAT-007's half of the host state — everything {@link CommunityThreadView} needs, passed
 * through. ⚠️ Declared rather than spread so a new prop on the thread view is a change the tab's
 * author sees, not one that arrives silently through an object rest.
 */
export interface LauncherCommunityThreadPane {
  state: CommunityThreadState;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink?: (href: string) => void;
  /**
   * NAT-008 AC4 — open the profile behind a post's author line.
   *
   * ⚠️ **Supplied by the HOST, not by the thread hook.** `useCommunityThread` knows which thread
   * is open and `useCommunityPeople` knows which profile is; neither knows about the other, and
   * the surface that mounts both is where they meet. That is the same arrangement that lets the
   * lists survive a thread opening in place.
   */
  onOpenPerson?: (handle: string) => void;
  /** NAT-007 AC4 — see {@link CommunityReplyBox} for the two arms and why there are two. */
  reply?: CommunityReplyBox | null;
}

/**
 * NAT-008's half of the host state. ⚠️ Declared rather than spread, for the reason
 * {@link LauncherCommunityThreadPane} gives: a new prop should be a change the tab's author sees.
 */
export interface LauncherCommunityPeoplePane {
  directory: CommunityDirectoryViewModel;
  onQueryChange: (query: string) => void;
  onToggleFilter: (key: string) => void;
  onOpenPerson: (handle: string) => void;
  onRetry: () => void;
}

/**
 * FB-013 C4's half of the host state.
 *
 * ⚠️ Declared rather than spread, for {@link LauncherCommunityThreadPane}'s reason: a new prop
 * should be a change the tab's author sees.
 *
 * 🔴 **`thread` is a STATE and not a boolean.** A chat thread opens in place of the river, the
 * same arrangement NAT-007 chose for the Bench, and its four states are the same four the rest
 * of this page uses — so a thread that could not be opened says so where the river was, rather
 * than closing back to a list and losing the fact that anything happened.
 */
export interface LauncherCommunityChatPane {
  view: CommunityChatViewModel;
  thread: CommunityChatThreadState;
  onSelectChannel: (key: string) => void;
  onOpenThread: (messageId: string) => void;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink?: (href: string) => void;
}

export interface LauncherCommunityProfilePane {
  state: CommunityProfileState;
  onBack: () => void;
  onRetry: () => void;
  onOpenLink?: (href: string) => void;
}

/** What the editor supplies to this tab. */
export interface LauncherCommunityHostState {
  view: CommunityMirrorView;
  isRefreshing: boolean;
  onRefresh: () => void;
  /**
   * NAT-007 — a thread, open **in place of the lists**.
   *
   * 🔴 A tab, not a dialog and not a second page. The launcher has one content area and the
   * thread takes it; going back returns the lists exactly as they were, because they were never
   * unmounted from the *editor's* state — `useCommunityThread` holds which thread is open and
   * `useCommunityMirror` holds the lists, and neither knows about the other.
   *
   * ⚠️ Optional so Storybook and any editor build without the host hook still render the tab.
   */
  thread?: LauncherCommunityThreadPane | null;
  /** NAT-007 — the thread's own id. Opens it IN PLACE; see {@link thread}. */
  onOpenThread?: (threadId: string) => void;
  /**
   * FB-002 — which Bench pill the reader chose. The key is a `BenchState`
   * (`'waiting' | 'solved'`), kept a `string` here because this package cannot import the
   * editor's model and `CommunityFilterPill.key` is what it arrives as.
   *
   * ⚠️ Optional for the reason {@link onOpenThread} is, and with the same consequence: a host
   * that does not wire it draws pills that do nothing. `useCommunityMirror` wires it, and both
   * surfaces take their pane from there.
   */
  onSelectBenchFilter?: (key: string) => void;
  /**
   * NAT-008 — the directory.
   *
   * 🔴 **`null` means D15 refused this viewer, and it is NOT the same as `undefined`.**
   * `undefined` is a host that has not wired the surface (Storybook, an older editor build) and
   * draws nothing for that reason; `null` is a host whose hook answered *"this viewer does not
   * get people"* and draws nothing for that one. Collapsing them would make a refusal
   * indistinguishable from an un-built feature, which is fine on screen and wrong in a spec —
   * *"a component that never ran also draws nothing."*
   */
  people?: LauncherCommunityPeoplePane | null;
  /**
   * FB-013 C4 — the chat river and whichever thread is open in it.
   *
   * ⚠️ **Absent draws NO TAB**, exactly as `people` absent does — Storybook and any editor build
   * without `useCommunityChat` simply do not offer it. Unlike `people` there is no D15 refusal
   * to distinguish: chat reads work signed out, so `null` and `undefined` mean the same thing
   * here and the type says so by not offering `null`.
   */
  chat?: LauncherCommunityChatPane;
  /** NAT-008 — a profile, open in place of everything else. `null` when none is open. */
  profile?: LauncherCommunityProfilePane | null;
  onOpenArticle?: (slug: string) => void;
  onOpenReplay?: (slug: string) => void;
  onOpenCommunity?: () => void;
  /**
   * FB-006 / D6 — the tab the reader picked, or `null`/absent while they have picked none.
   *
   * ⚠️ **Held by the host, not by the strip.** `Tabs` would hold it in `useState` and that is the
   * one thing this component may not contain: it is graded by walking its element tree, and the
   * walker calls function components directly, so a hook anywhere in the returned tree throws.
   * See {@link TabStrip}, which exists for this.
   */
  activeTab?: CommunityTabId | null;
  onSelectTab?: (id: CommunityTabId) => void;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * The tab, as a pure function of the host state.
 *
 * 🔴 **Split out from {@link Community} so it can be graded.** This checkout's jest runs have no
 * DOM, but a React *element tree* is plain objects — a component that takes props and calls no
 * hooks can be invoked directly and walked. That is how `nat-005/launcher-community-render` asserts
 * D15 draws nothing *with a not-hidden control beside it*, which an assertion about a null return
 * cannot do on its own: a component that never ran also draws nothing.
 */
/**
 * The tab, as a pure function of the host state.
 *
 * 🔴 **Split out from {@link Community} so it can be graded.** This checkout's jest runs have no
 * DOM, but a React *element tree* is plain objects — a component that takes props and calls no
 * hooks can be invoked directly and walked. That is how `nat-005/launcher-community-render` asserts
 * D15 draws nothing *with a not-hidden control beside it*, which an assertion about a null return
 * cannot do on its own: a component that never ran also draws nothing.
 *
 * ## FB-006 / D6 — one list became a place with rooms
 *
 * Richard, 2026-08-22 (item 5): *"put the different content into tabs like the web page has, not
 * everything on one page in a big list that will one day be unmanageable"*. The three stacked
 * sections are now one tab each, in {@link communityTabs}' catalogue order — which is the web's
 * nav order, because D6's whole point is that the launcher and `community.nodegx.io` are one
 * product with one map.
 *
 * 🔴 **This revises NAT-005's page, not its vocabulary.** NAT-005 deliberately did not ask the
 * structure question and everything it built — the card, the row, the four states, the per-section
 * empty line — is reused here unchanged. What changes is that only one section is on screen at a
 * time, so `nat-005/launcher-community-render` now names the tab it is looking at. That is an
 * acceptance criterion being revised on the word of the person it was written for, and it is named
 * here so a later session does not read a one-section page as a regression.
 *
 * ⚠️ **The chrome is deliberately outside the tabs**: who you are, refresh, the health readout and
 * the browser door frame *the place*, not one room in it. The lead sentence is the opposite — it
 * moved INTO each tab, because AC1 asks that the first screen of each one says what it is for, and
 * a single page-level sentence would say it for Bench and lie for People.
 */
export function CommunityTab({
  view,
  isRefreshing,
  onRefresh,
  thread,
  people,
  profile,
  chat,
  activeTab,
  onSelectTab,
  onOpenThread,
  onSelectBenchFilter,
  onOpenArticle,
  onOpenReplay,
  onOpenCommunity
}: LauncherCommunityHostState) {
  // 🔴 D15: the platform said this surface does not exist for this viewer — an org-minor whose
  // school has the community switched off. Draw NOTHING. `apiviewer.ts` answers them with a 404
  // precisely so *a pupil is not told a door exists*, and "the community is unavailable" would
  // narrate the door in the act of closing it. ⚠️ The TAB is still in the nav; that is the same
  // recorded gap the rail entry has, and it is owned by phase 67b.
  if (view.surface === 'hidden') return null;

  // 🔴 NAT-008 AC2 — a profile opens IN PLACE, and BEFORE the thread, because you reach a profile
  // FROM a thread's author line: a reader who clicks `@rosborne` inside a post has both panes
  // open at once and expects the newer one. Going back closes the profile and the thread is
  // exactly as it was, because neither hook knows about the other.
  //
  // ⚠️ **After the D15 check, like everything else on this surface.** A refused viewer who
  // somehow holds a handle must reach nothing.
  if (profile) {
    return (
      <LauncherPage title="Community">
        <CommunityProfileView
          state={profile.state}
          onBack={profile.onBack}
          onRetry={profile.onRetry}
          onOpenLink={profile.onOpenLink}
        />
      </LauncherPage>
    );
  }

  // 🔴 NAT-007 AC1 — a thread opens IN PLACE. ⚠️ **After the D15 check and never before it**: a
  // refused viewer who somehow holds a thread id must reach nothing, and a `thread` prop checked
  // first would draw the pane for them on the strength of the host having set it.
  if (thread) {
    return (
      <LauncherPage title="Community">
        <CommunityThreadView
          state={thread.state}
          onBack={thread.onBack}
          onRetry={thread.onRetry}
          onOpenLink={thread.onOpenLink}
          onOpenPerson={thread.onOpenPerson}
          reply={thread.reply}
        />
      </LauncherPage>
    );
  }

  /**
   * 🔴 FB-013 C4 — a chat thread opens IN PLACE too, and for NAT-007's reason rather than by
   * imitation: the launcher has one content area, and a dialog over a river would put the thing
   * you were reading behind the thing you opened.
   *
   * ⚠️ **After the Bench's pane, not before it.** Both can be open at once in the host's state —
   * two hooks, neither aware of the other — and a reader who clicked a Bench row last should get
   * the Bench thread. Ordering is the whole of that decision, so it is stated rather than left
   * to the order the props happen to appear in.
   */
  if (chat && chat.thread.state !== 'closed') {
    return (
      <LauncherPage title="Community">
        <CommunityChatThread
          state={chat.thread}
          onBack={chat.onBack}
          onRetry={chat.onRetry}
          onOpenLink={chat.onOpenLink}
        />
      </LauncherPage>
    );
  }

  const who =
    view.viewer === null
      ? '…'
      : view.viewer === false
        ? 'Reading as a guest — sign in below to post'
        : view.viewer.handle
          ? `@${view.viewer.handle}`
          : 'Signed in';

  /**
   * 🔴 The three list kinds are wired **unconditionally** because the shown view declares all
   * three as required fields — an empty Bench is a Bench with nothing in it, and D21's surviving
   * obligation is that it says so in its own words rather than disappearing. `people` is the one
   * that can be absent, and both of its absences (D15 refused · nobody wired it) draw no tab; see
   * {@link communityTabs}.
   */
  const plan = communityTabs({
    wired: { bench: true, chat: Boolean(chat), tutorials: true, replays: true, people: Boolean(people) },
    chosen: activeTab ?? null
  });

  // A strip with one tab is a label impersonating a control — the section keeps its own heading
  // instead. Same rule as the Learning tab's, and the same reason.
  const alone = plan.tabs.length < 2;

  return (
    <LauncherPage title="Community">
      <div className={css['Head']}>
        <span className={css['HeadLine']}>
          {who}
          {view.standing ? `  ·  ${view.standing.points} points` : ''}
        </span>
        <button type="button" className={css['GhostButton']} onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {!alone && (
        /*
          ⚠️ The variant class is on this wrapper and `Tabs`' `.Root` is not, on purpose: `.Root`
          is `height: 100%; overflow: hidden`, which is the layout a full-height tabbed surface
          wants and the opposite of what this page wants — here the page scrolls and the strip is
          just the first thing in it. FB-006 loosened the variant selectors in `Tabs.module.scss`
          so a strip can be styled without inheriting that box.
        */
        <div className={classNames(tabsCss[TabsVariant.Segmented], css['Tabs'])}>
          <TabStrip
            variant={TabsVariant.Segmented}
            activeTabId={plan.active?.id ?? ''}
            tabs={plan.tabs.map((tab) => ({ id: tab.id, label: tab.label, testId: `community-tab-${tab.id}` }))}
            onSelect={(tab) => onSelectTab?.(tab.id as CommunityTabId)}
          />
        </div>
      )}

      {/* AC1 — the first screen of each tab says what THIS tab is for. */}
      {plan.active && <p className={css['Lead']}>{plan.active.lead}</p>}

      {plan.active?.id === 'bench' && (
        /*
          🔴 FB-002 — the card is drawn here rather than through `CommunitySection`, for the
          reason the People tab below gives in full: the filter pills belong INSIDE the card and
          above the rows, and `CommunitySection` renders the body itself. The count it would have
          drawn is `view.bench.summary`, which says "3 of 12 questions" — a more honest number on
          a filtered list than a bare item count.

          ⚠️ The empty line, the row meta and the four states are all unchanged; they moved into
          `CommunityBenchView` so that the rail panel draws exactly the same list.
        */
        <section className={css['Section']}>
          <div className={css['SectionCard']}>
            {alone && (
              <div className={css['SectionHead']}>
                <h3 className={css['SectionTitle']}>Bench</h3>
              </div>
            )}
            <CommunityBenchView
              view={view.bench}
              onSelectFilter={(key) => onSelectBenchFilter?.(key)}
              onOpenThread={(threadId) => onOpenThread?.(threadId)}
              onRetry={onRefresh}
            />
          </div>
        </section>
      )}

      {plan.active?.id === 'chat' && chat && (
        /*
          🔴 The card is drawn here rather than through `CommunitySection`, for the Bench's
          reason: the channel pills belong INSIDE the card and above the rows, and
          `CommunitySection` renders the body itself. The count it would draw is a bare item
          count; `view.summary` says "1 of 4 conversations", which is the honest number on a
          list something is narrowing.
        */
        <section className={css['Section']}>
          <div className={css['SectionCard']}>
            {alone && (
              <div className={css['SectionHead']}>
                <h3 className={css['SectionTitle']}>Chat</h3>
              </div>
            )}
            <CommunityChatView
              view={chat.view}
              onSelectChannel={chat.onSelectChannel}
              onOpenThread={chat.onOpenThread}
              onRetry={chat.onRetry}
              onOpenLink={chat.onOpenLink}
            />
          </div>
        </section>
      )}

      {plan.active?.id === 'tutorials' && (
        <CommunitySection
          title="Tutorials"
          showTitle={alone}
          state={view.articles}
          emptyLine="Written guides published to the community appear here."
          onRetry={onRefresh}
        >
          {(articles) =>
            articles.map((article) => (
              <CommunityRow
                key={article.slug}
                title={article.title}
                meta={kindLabel(article.kind)}
                detail={article.summary}
                onClick={() => onOpenArticle?.(article.slug)}
              />
            ))
          }
        </CommunitySection>
      )}

      {plan.active?.id === 'replays' && (
        <CommunitySection
          title="Replays"
          showTitle={alone}
          state={view.replays}
          emptyLine="Recordings of the weekly call are listed here, newest first."
          onRetry={onRefresh}
        >
          {(replays) =>
            replays.map((replay) => (
              <CommunityRow
                key={replay.slug}
                title={replay.title}
                // ⚠️ Both spellings of the date: a replay is a thing that happened on a day, and
                // "9 days ago" is what tells you whether you have already seen it.
                meta={metaLine([absoluteDate(replay.heldOn), relativeTime(replay.heldOn)])}
                detail={replay.description}
                onClick={() => onOpenReplay?.(replay.slug)}
              />
            ))
          }
        </CommunitySection>
      )}

      {/*
        🔴 NAT-008 AC1 — the directory. ⚠️ `people === null` is D15's refusal and `undefined` is a
        host that has not wired it; neither draws a tab, and the difference is the host's, which is
        why the pane type documents it rather than this line deciding it. The `people &&` here is
        the type narrowing, not a second decision — `plan` already made it.

        ⚠️ It keeps the card the other sections use so that the search box, the pills and the four
        states arrive inside the same frame the rest of the tab uses — a directory that looked like
        a different page would be the second design language NAT-005 exists to prevent.
      */}
      {plan.active?.id === 'people' && people && (
        <section className={css['Section']}>
          <div className={css['SectionCard']}>
            {alone && (
              <div className={css['SectionHead']}>
                <h3 className={css['SectionTitle']}>People</h3>
              </div>
            )}
            {/* ⚠️ The card is drawn here rather than through `CommunitySection` because the search
                box and the filter pills belong INSIDE the card and above the rows, and
                `CommunitySection` renders the body itself. The count that component would have
                drawn is `directory.summary`, which says "2 of 11 people" — a more honest number on
                a filtered list than a bare item count. */}
            <CommunityDirectoryView
              view={people.directory}
              onQueryChange={people.onQueryChange}
              onToggleFilter={people.onToggleFilter}
              onOpenPerson={people.onOpenPerson}
              onRetry={people.onRetry}
            />
          </div>
        </section>
      )}

      {/* ⚠️ Page chrome, not a tab's content: the health of the place is not the health of the
          room you happen to be standing in, and D21 keeps it visible rather than behind a click. */}
      {view.health && (
        <section className={css['Section']}>
          <div className={css['SectionCard']}>
            <div className={css['SectionHead']}>
              <h3 className={css['SectionTitle']}>How the community is doing</h3>
            </div>
            <ul className={css['HealthList']}>
              <li className={css['HealthLine']}>
                {view.health.threads.value} of {view.health.threads.required} threads
              </li>
              <li className={css['HealthLine']}>
                {view.health.weeksWithCall.value} of {view.health.weeksWithCall.required} consecutive weeks with a
                call
              </li>
              <li className={css['HealthLine']}>
                {view.health.reply.medianHours === null
                  ? 'no replies yet'
                  : `${view.health.reply.medianHours.toFixed(1)}h median first reply`}{' '}
                (n={view.health.reply.n}
                {view.health.reply.unreplied > 0 ? `, ${view.health.reply.unreplied} unreplied` : ''}), target under{' '}
                {view.health.reply.requiredBelowHours}h
              </li>
            </ul>
          </div>
        </section>
      )}

      <button type="button" className={css['OutlineButton']} onClick={() => onOpenCommunity?.()}>
        Open community.nodegx.io
      </button>
    </LauncherPage>
  );
}

export function Community() {
  const { communityMirror: community } = useLauncherContext();

  /**
   * FB-006 — `null` until the reader picks a tab, and then it sticks.
   *
   * ⚠️ Held HERE rather than in the strip, and rather than in the editor's host state. The strip
   * cannot hold it (see {@link CommunityTab}); the editor should not, because which room you are
   * standing in is not something the mirror fetches. ⚠️ It resets when the launcher unmounts the
   * tab, which is the same lifetime the Learning tab's choice has.
   */
  const [chosen, setChosen] = useState<CommunityTabId | null>(null);

  // Nothing wired (Storybook, or an editor build without the host hook).
  if (!community) {
    return (
      <LauncherPage title="Community">
        <p className={css['Lead']}>The community is not available in this preview.</p>
      </LauncherPage>
    );
  }

  return <CommunityTab {...community} activeTab={chosen} onSelectTab={setChosen} />;
}
