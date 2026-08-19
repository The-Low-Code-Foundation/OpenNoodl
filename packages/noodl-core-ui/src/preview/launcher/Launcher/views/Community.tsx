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

import React from 'react';

import {
  CommunityRow,
  CommunitySection,
  absoluteDate,
  kindLabel,
  metaLine,
  relativeTime,
  replyLatency
} from '@noodl-core-ui/components/community';
import type { CommunitySectionState } from '@noodl-core-ui/components/community';
import css from '@noodl-core-ui/components/community/Community.module.scss';
import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

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

export type CommunityThreadRow = {
  id: string;
  externalId: string;
  title: string;
  createdAt: string;
  firstReplyMinutes: number | null;
};

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
      threads: CommunitySectionState<CommunityThreadRow>;
      health: CommunityHealthReading | null;
    };

/** What the editor supplies to this tab. */
export interface LauncherCommunityHostState {
  view: CommunityMirrorView;
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenThread?: (externalId: string) => void;
  onOpenArticle?: (slug: string) => void;
  onOpenReplay?: (slug: string) => void;
  onOpenCommunity?: () => void;
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
export function CommunityTab({
  view,
  isRefreshing,
  onRefresh,
  onOpenThread,
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

  const who =
    view.viewer === null
      ? '…'
      : view.viewer === false
        ? 'Reading as a guest — sign in below to post'
        : view.viewer.handle
          ? `@${view.viewer.handle}`
          : 'Signed in';

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

      {/* ⚠️ The first screen says what this place is FOR. The tab shipped without one and read as
          a status page — three headings over three lists, with nothing anywhere saying why a
          person would look. This is one sentence and it is the cheapest thing on the page. */}
      <p className={css['Lead']}>
        Questions you ask from the editor, the guides people write and the calls we record — all of it here, beside
        your projects. You never have to open a browser to read it.
      </p>

      <CommunitySection
        title="Discussions"
        state={view.threads}
        emptyLine="Questions asked from the editor land here. Right-click any node and choose “Ask about this node”."
        onRetry={onRefresh}
      >
        {(threads) =>
          threads.map((thread) => (
            <CommunityRow
              key={thread.id}
              title={thread.title}
              // AC2. Both of these were in the view model from the first commit and neither was
              // drawn. 🔴 `firstReplyMinutes === null` is "no reply yet" — the row worth scanning
              // for, and the one the health readout counts as `unreplied`.
              meta={metaLine([relativeTime(thread.createdAt), replyLatency(thread.firstReplyMinutes)])}
              onClick={() => onOpenThread?.(thread.externalId)}
            />
          ))
        }
      </CommunitySection>

      <CommunitySection
        title="Guides and tutorials"
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

      <CommunitySection
        title="Call replays"
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

  // Nothing wired (Storybook, or an editor build without the host hook).
  if (!community) {
    return (
      <LauncherPage title="Community">
        <p className={css['Lead']}>The community is not available in this preview.</p>
      </LauncherPage>
    );
  }

  return <CommunityTab {...community} />;
}
