/**
 * UNI-011 / NAT-005 — the community, in the editor's own chrome.
 *
 * ## 🔴 D21 (2026-08-19) is why this file exists at all
 *
 * D16 ruled on 2026-08-16 that the editor surfaces the community only after 30 threads, three
 * consecutive weeks with a call held and a median first reply under 24 hours — and until then the
 * entry point opens the browser. **D21 reverses it.** Richard's ruling, in his words: *"show the
 * community tab immediately with no data, I'll start filling it with tutorials and whatnot
 * myself."*
 *
 * The objective D16 was measured against was *"is the community busy?"*, and against that it was
 * sound. The objective it never weighed is D14's: **one source of truth, the editor.** A browser
 * hand-off is a second surface, so the gate created the problem it was reasoning about.
 *
 * ## ⚠️ What "empty is fine" does NOT mean
 *
 * It does not mean blank. D16's *design obligation* survives the reversal and is now the only
 * thing protecting this surface: the home is composed of things that exist whether or not anybody
 * posted — replays, guides, standing, and the health reading. Four sections, four independent
 * empty lines, each saying what it is *for*. See `mirrorview.ts` for the state machine.
 *
 * ## NAT-005 — the rows and the four states are no longer this file's own
 *
 * They come from `@noodl-core-ui/components/community`, which the **launcher tab** draws from
 * too. Before this, each surface had its own copy of the four-state switch and its own row, and
 * the launcher's copy drew titles while throwing away every piece of metadata the same view model
 * handed it. 🔴 Two copies is the arrangement where a fix lands on one of them.
 *
 * ⚠️ **The rows lost their leading icon, and that was a trade with a reason.** `Icon.tsx` uses
 * webpack's `require.context`, so anything importing it cannot be loaded by this repo's jest at
 * all — a shared row with an icon in it would be a shared row no runner can grade, and grading it
 * is how `nat-005/` asserts D15 draws nothing with a live control beside it. The section headings
 * already say which list a row is in.
 *
 * ⚠️ **`sidebar/Section` still supplies the panel's chrome.** `CommunitySection` — the card the
 * launcher uses — is deliberately *not* used here: two frames saying the same thing.
 *
 * ## 🔴 No stranger-authored body is rendered here, and nothing in this file could render one
 *
 * The list payloads carry titles and counts, never bodies — deliberately, so nothing on this path
 * needs sanitising. Every string below reaches React as a **text child**, which the runtime
 * escapes because it is text. There is no `dangerouslySetInnerHTML` in this file and there must
 * never be one: this renderer is `nodeIntegration: true, contextIsolation: false`, and this phase
 * has already had a `javascript:` URL compiled into a live anchor in it (RULINGS.md, the second
 * amendment). When a body *does* arrive, it goes through `asPostBody()` → `Block[]`, which has no
 * field that could hold markup — that is AC1's second half and it is already met and specced.
 * ⚠️ `CommunityRow` types its text props as `string` rather than `ReactNode` for the same reason.
 *
 * @module noodl-editor/views/panels/CommunityPanel/CommunityPanel
 */

import React from 'react';

import { platform } from '@noodl/platform';

import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';

import {
  CommunityDensity,
  CommunityDirectoryView,
  CommunityProfileView,
  CommunityRow,
  CommunitySectionBody,
  CommunityThreadView,
  absoluteDate,
  kindLabel,
  metaLine,
  relativeTime,
  replyLatency
} from '@noodl-core-ui/components/community';
import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { useCommunityMirror } from '@noodl-hooks/useCommunityMirror';
import { useCommunityPeople } from '@noodl-hooks/useCommunityPeople';
import { useCommunityThread } from '@noodl-hooks/useCommunityThread';
import { useTutorialInstall } from '@noodl-hooks/useTutorialInstall';

import type { HealthReading } from '@noodl-models/community/mirrorview';
import { Tutorials } from './Tutorials';

function openCommunity(path = ''): void {
  platform.openExternal(`${COMMUNITY_URL}${path}`);
}

/**
 * The threshold, as a readout.
 *
 * 🔴 **This used to be a gate and is now a number on a page.** D16's second caveat is the half
 * D21 keeps: *"a threshold nobody can see the approach to is a threshold that gets crossed by
 * rounding."* So every component shows its `required`, and the median shows the `n` it was
 * computed from — a median over three staff-answered threads is a true statement about nothing,
 * and the sample size is the only thing that says so.
 */
function Health({ health }: { health: HealthReading }) {
  const median =
    health.reply.medianHours === null
      ? 'no replies yet'
      : `${health.reply.medianHours.toFixed(1)}h median first reply`;

  return (
    <Box hasXSpacing hasYSpacing>
      <VStack UNSAFE_style={{ gap: 4, alignItems: 'flex-start' }}>
        <Text textType={TextType.Shy}>
          {health.threads.value} of {health.threads.required} threads
        </Text>
        <Text textType={TextType.Shy}>
          {health.weeksWithCall.value} of {health.weeksWithCall.required} consecutive weeks with a call
        </Text>
        <Text textType={TextType.Shy}>
          {median} (n={health.reply.n}
          {health.reply.unreplied > 0 ? `, ${health.reply.unreplied} unreplied` : ''}), target under{' '}
          {health.reply.requiredBelowHours}h
        </Text>
      </VStack>
    </Box>
  );
}

export function CommunityPanel() {
  const { view, isRefreshing, refresh } = useCommunityMirror();
  // NAT-007 — the same hook the launcher tab uses. See `useCommunityThread` for why the open/
  // closed state and the cache are shared rather than duplicated per surface.
  const { pane, openThread } = useCommunityThread();
  // NAT-008 — the same hook the launcher tab uses, for the same reason.
  const { people, profile, openPerson } = useCommunityPeople();
  // TUT-004 — the tutorials you can install. Its own hook for `useCommunityPeople`'s reason: the
  // launcher tab will want the same list, and two copies is where a fix lands on one of them.
  const tutorials = useTutorialInstall();

  // 🔴 D15: the platform said this surface does not exist for this viewer. Draw NOTHING — not a
  // message, not an empty state. `apiviewer.ts` answers an org-minor with a 404 precisely so a
  // pupil is not told a door exists, and a panel saying "unavailable" would narrate the door in
  // the act of closing it. ⚠️ The rail ENTRY is still there — `SidebarModel.register` is
  // synchronous at setup and has no async gate — and that is a recorded gap, not a solved one.
  if (view.surface === 'hidden') return null;

  // 🔴 NAT-007 AC1 — a thread opens IN PLACE, in the rail. ⚠️ After the D15 check, never before:
  // see the same note in `CommunityTab`. `ScrollArea` wraps it because a thread is the longest
  // thing this panel ever draws and the rail is the narrowest place it is drawn.
  // 🔴 NAT-008 AC2 — a profile opens IN PLACE, and BEFORE the thread, because you reach one FROM
  // a thread's author line and the newer pane is the one the reader just asked for. ⚠️ After the
  // D15 check, like everything else here.
  if (profile) {
    return (
      <BasePanel title="Community" isFill>
        <ScrollArea>
          <CommunityProfileView
            state={profile.state}
            density={CommunityDensity.Panel}
            onBack={profile.onBack}
            onRetry={profile.onRetry}
            onOpenLink={profile.onOpenLink}
          />
        </ScrollArea>
      </BasePanel>
    );
  }

  if (pane) {
    return (
      <BasePanel title="Community" isFill>
        <ScrollArea>
          <CommunityThreadView
            state={pane.state}
            density={CommunityDensity.Panel}
            onBack={pane.onBack}
            onRetry={pane.onRetry}
            onOpenLink={pane.onOpenLink}
            // 🔴 NAT-008 AC4 — the author line opens their profile, in the rail too.
            onOpenPerson={openPerson}
            reply={pane.reply}
          />
        </ScrollArea>
      </BasePanel>
    );
  }

  return (
    <BasePanel title="Community" isFill>
      <Section variant={SectionVariant.PanelShy} hasGutter>
        <HStack UNSAFE_style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Text textType={TextType.Secondary}>
            {view.viewer === null
              ? '…'
              : view.viewer === false
                ? 'Reading as a guest'
                : view.viewer.handle
                  ? `@${view.viewer.handle}`
                  : 'Signed in'}
            {view.standing ? `  ·  ${view.standing.points} points` : ''}
          </Text>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={IconName.Refresh}
            size={IconSize.Small}
            isDisabled={isRefreshing}
            onClick={refresh}
          />
        </HStack>
        {/* ⚠️ Sign-in lives in the LAUNCHER (UNI-001 AC2, `useCommunityAccount`). One device flow,
            one place that writes the session key — a second entry point here would be a second
            place a stale token can come from. This is a pointer, not a flow. */}
        {view.viewer === false && (
          <Box hasTopSpacing>
            <Text textType={TextType.Shy}>Sign in from the launcher to post, earn points and track your standing.</Text>
          </Box>
        )}
      </Section>

      <ScrollArea>
        <Box hasYSpacing UNSAFE_style={{ width: '100%' }}>
          <Section title="Discussions" variant={SectionVariant.Panel} hasGutter>
            <CommunitySectionBody
              state={view.threads}
              emptyLine="Questions asked from the editor land here. Right-click any node and choose “Ask about this node”."
              onRetry={refresh}
              density={CommunityDensity.Panel}
            >
              {(threads) =>
                threads.map((thread) => (
                  <CommunityRow
                    key={thread.id}
                    density={CommunityDensity.Panel}
                    title={thread.title}
                    // AC2. Both fields were in the view model from the first commit and neither
                    // surface drew either. 🔴 `no reply yet` is the row worth scanning for, and
                    // the one the health readout above counts as `unreplied`.
                    meta={metaLine([relativeTime(thread.createdAt), replyLatency(thread.firstReplyMinutes)])}
                    // AC1 — in place. `openExternal` is no longer the primary action here.
                    onClick={() => openThread(thread.id)}
                  />
                ))
              }
            </CommunitySectionBody>
          </Section>

          {/* 🔴 NAT-008 AC1 — the directory, in the rail. ⚠️ `people` is `null` when D15 refused
              this viewer; the surface draws nothing rather than an empty section. */}
          {people && (
            <Section title="People" variant={SectionVariant.Panel} hasGutter>
              <CommunityDirectoryView
                view={people.directory}
                density={CommunityDensity.Panel}
                onQueryChange={people.onQueryChange}
                onToggleFilter={people.onToggleFilter}
                onOpenPerson={people.onOpenPerson}
                onRetry={people.onRetry}
              />
            </Section>
          )}

          {/* 🔴 TUT-004 AC1 — ABOVE "Guides and tutorials", which opens the browser. The section
              that keeps you here comes first. */}
          <Tutorials pane={tutorials} />

          <Section title="Guides and tutorials" variant={SectionVariant.Panel} hasGutter>
            <CommunitySectionBody
              state={view.articles}
              emptyLine="Written guides published to the community appear here."
              onRetry={refresh}
              density={CommunityDensity.Panel}
            >
              {(articles) =>
                articles.map((article) => (
                  <CommunityRow
                    key={article.slug}
                    density={CommunityDensity.Panel}
                    title={article.title}
                    meta={kindLabel(article.kind)}
                    detail={article.summary}
                    onClick={() => openCommunity(`/articles/${article.slug}`)}
                  />
                ))
              }
            </CommunitySectionBody>
          </Section>

          <Section title="Call replays" variant={SectionVariant.Panel} hasGutter>
            <CommunitySectionBody
              state={view.replays}
              emptyLine="Recordings of the weekly call are listed here, newest first."
              onRetry={refresh}
              density={CommunityDensity.Panel}
            >
              {(replays) =>
                replays.map((replay) => (
                  <CommunityRow
                    key={replay.slug}
                    density={CommunityDensity.Panel}
                    title={replay.title}
                    meta={metaLine([absoluteDate(replay.heldOn), relativeTime(replay.heldOn)])}
                    detail={replay.description}
                    onClick={() => openCommunity(`/replays/${replay.slug}`)}
                  />
                ))
              }
            </CommunitySectionBody>
          </Section>

          {view.health && (
            <Section title="How the community is doing" variant={SectionVariant.Panel} hasGutter>
              <Health health={view.health} />
            </Section>
          )}

          <Section variant={SectionVariant.PanelShy} hasGutter hasTopDivider>
            <Box hasYSpacing>
              <PrimaryButton
                variant={PrimaryButtonVariant.Ghost}
                size={PrimaryButtonSize.Small}
                label="Open community.nodegx.io"
                icon={IconName.ExternalLink}
                onClick={() => openCommunity()}
              />
            </Box>
          </Section>
        </Box>
      </ScrollArea>
    </BasePanel>
  );
}
