/**
 * UNI-011 / D21 — the community, as a launcher tab.
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
 * ## What this component may and may not do
 *
 * 🔴 **It renders text children only.** The launcher is `pages/ProjectsPage` inside the *same*
 * `BrowserWindow` as the editor — `nodeIntegration: true, contextIsolation: false` — so this file
 * is under exactly the security constraint the rail panel is under, and for the same reason.
 * No `dangerouslySetInnerHTML`, ever. Post *bodies* do not reach this surface at all: the list
 * payloads carry titles and counts, and a body would have to come through `parsePostBody` →
 * `Block[]`, which has no field that can hold markup.
 *
 * @module noodl-core-ui/preview/launcher/Launcher/views/Community
 */

import React from 'react';

import { LauncherPage } from '@noodl-core-ui/preview/launcher/Launcher/components/LauncherPage';
import { useLauncherContext } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

// ── The view model — owned here, computed in the editor ────────────────────────

/**
 * One section's state.
 *
 * ⚠️ `loading` is its own case rather than an empty list. A surface that renders "no discussions
 * yet" for the 300ms before the first response tells every user the community is dead, on every
 * open — the `undefined`-versus-`null` bug `useCommunityAccount` documents, in a new place.
 */
export type CommunitySectionState<T> =
  | { state: 'loading' }
  | { state: 'items'; items: T[] }
  | { state: 'empty' }
  | { state: 'unreachable'; detail: string };

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
 * 🔴 NAT-002. This was `--theme-color-fg-muted`, and this one object is the viewer line, all four
 * empty states, every health readout and the error text — so it was the colour of nearly every
 * word on the tab. On this surface's ground (`bg-0`, painted by `Launcher.module.scss`) it
 * measured **4.18:1 in dark and 3.19:1 in light**, the worst text ratio in the product and short
 * of AA in both themes. `fg-default-shy` is 6.63/5.98 here and is the same step `Text`'s Shy type
 * took in POL-017 for the same reason.
 * ⚠️ Named explicitly rather than left on `fg-muted`, which is now an alias of this token: an
 * alias keeps working, but it keeps the retired name in the code where the next reader copies it.
 */
const shy: React.CSSProperties = { color: 'var(--theme-color-fg-default-shy)', fontSize: 13, lineHeight: 1.5 };
const rowStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  color: 'var(--theme-color-fg-default)'
};

/**
 * One section.
 *
 * ⚠️ `emptyLine` is REQUIRED and says what the section is *for*, never "nothing here". A shared
 * default would let a new section inherit a sentence written about a different one — which is how
 * four honest empties collapse into one shrug, and the composition is the only thing protecting
 * this surface now that D16's threshold does not.
 */
function Section<T>({
  title,
  state,
  emptyLine,
  onRetry,
  renderItem
}: {
  title: string;
  state: CommunitySectionState<T>;
  emptyLine: string;
  onRetry: () => void;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--theme-color-fg-highlight)' }}>
        {title}
      </h3>
      {state.state === 'loading' && <div style={shy}>Loading…</div>}
      {state.state === 'empty' && <div style={shy}>{emptyLine}</div>}
      {state.state === 'unreachable' && (
        <div style={shy}>
          {/* ⚠️ Our fetch error, never platform prose — a stranger cannot reach this string. */}
          Could not reach the community ({state.detail}).{' '}
          <button
            type="button"
            onClick={onRetry}
            /* NAT-002 D10: `primary` is the FILL accent and measures 4.03:1 on this ground in
               light. `fg-accent` is the same accent chosen to be read. */
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--theme-color-fg-accent)', cursor: 'pointer', font: 'inherit' }}
          >
            Try again
          </button>
        </div>
      )}
      {state.state === 'items' && <div>{state.items.map(renderItem)}</div>}
    </section>
  );
}

export function Community() {
  const { communityMirror: community } = useLauncherContext();

  // Nothing wired (Storybook, or an editor build without the host hook).
  if (!community) {
    return (
      <LauncherPage title="Community">
        <div style={shy}>The community is not available in this preview.</div>
      </LauncherPage>
    );
  }

  const { view, isRefreshing, onRefresh } = community;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <span style={shy}>
          {who}
          {view.standing ? `  ·  ${view.standing.points} points` : ''}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{ background: 'none', border: 'none', color: 'var(--theme-color-fg-default-shy)', cursor: 'pointer', font: 'inherit', fontSize: 13 }}
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <Section
        title="Discussions"
        state={view.threads}
        emptyLine="Questions asked from the editor land here. Right-click any node and choose “Ask about this node”."
        onRetry={onRefresh}
        renderItem={(thread) => (
          <div key={thread.id} style={rowStyle} onClick={() => community.onOpenThread?.(thread.externalId)}>
            {thread.title}
          </div>
        )}
      />

      <Section
        title="Guides and tutorials"
        state={view.articles}
        emptyLine="Written guides published to the community appear here."
        onRetry={onRefresh}
        renderItem={(article) => (
          <div key={article.slug} style={rowStyle} onClick={() => community.onOpenArticle?.(article.slug)}>
            {article.title}
          </div>
        )}
      />

      <Section
        title="Call replays"
        state={view.replays}
        emptyLine="Recordings of the weekly call are listed here, newest first."
        onRetry={onRefresh}
        renderItem={(replay) => (
          <div key={replay.slug} style={rowStyle} onClick={() => community.onOpenReplay?.(replay.slug)}>
            {replay.title}
          </div>
        )}
      />

      {view.health && (
        <section style={{ marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--theme-color-fg-highlight)' }}>
            How the community is doing
          </h3>
          <div style={shy}>
            {view.health.threads.value} of {view.health.threads.required} threads
          </div>
          <div style={shy}>
            {view.health.weeksWithCall.value} of {view.health.weeksWithCall.required} consecutive weeks with a call
          </div>
          <div style={shy}>
            {view.health.reply.medianHours === null
              ? 'no replies yet'
              : `${view.health.reply.medianHours.toFixed(1)}h median first reply`}{' '}
            (n={view.health.reply.n}
            {view.health.reply.unreplied > 0 ? `, ${view.health.reply.unreplied} unreplied` : ''}), target under{' '}
            {view.health.reply.requiredBelowHours}h
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => community.onOpenCommunity?.()}
        /* 🔴 NAT-002: the border was `bg-3`, an ELEVATION step used as a control boundary — 1.32:1
           dark and 1.01:1 light against this ground, so the only thing saying "this is a button"
           was invisible. `--theme-color-border-control` already existed for exactly this (POL-016)
           and measures 4.18/3.19 here, clear of 1.4.11's 3:1. */
        style={{ background: 'none', border: '1px solid var(--theme-color-border-control)', borderRadius: 4, padding: '8px 12px', color: 'var(--theme-color-fg-default)', cursor: 'pointer', font: 'inherit', fontSize: 13 }}
      >
        Open community.nodegx.io
      </button>
    </LauncherPage>
  );
}
