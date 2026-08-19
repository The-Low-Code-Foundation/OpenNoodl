/**
 * UNI-011 — the community, in the editor's own chrome.
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
 * ## 🔴 No stranger-authored body is rendered here, and nothing in this file could render one
 *
 * The list payloads carry titles and counts, never bodies — deliberately, so nothing on this path
 * needs sanitising. Every string below reaches React as a **text child**, which the runtime
 * escapes because it is text. There is no `dangerouslySetInnerHTML` in this file and there must
 * never be one: this renderer is `nodeIntegration: true, contextIsolation: false`, and this phase
 * has already had a `javascript:` URL compiled into a live anchor in it (RULINGS.md, the second
 * amendment). When a body *does* arrive, it goes through `asPostBody()` → `Block[]`, which has no
 * field that could hold markup — that is AC1's second half and it is already met and specced.
 *
 * @module noodl-editor/views/panels/CommunityPanel/CommunityPanel
 */

import React from 'react';

import { platform } from '@noodl/platform';

import { COMMUNITY_URL } from '@noodl-models/community/communityorigin';

import { IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { ListItem } from '@noodl-core-ui/components/layout/ListItem';
import { ScrollArea } from '@noodl-core-ui/components/layout/ScrollArea';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Section, SectionVariant } from '@noodl-core-ui/components/sidebar/Section';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { useCommunityMirror } from '@noodl-hooks/useCommunityMirror';

import type { HealthReading, SectionState } from '@noodl-models/community/mirrorview';

function openCommunity(path = ''): void {
  platform.openExternal(`${COMMUNITY_URL}${path}`);
}

/**
 * One section's body.
 *
 * ⚠️ `emptyLine` is a **required** prop and says what the section is for, never "nothing here".
 * A shared default would let a new section inherit a sentence written about a different one,
 * which is how four honest empties become one shrug.
 */
function SectionBody<T>({
  state,
  emptyLine,
  onRetry,
  children
}: {
  state: SectionState<T>;
  emptyLine: string;
  onRetry: () => void;
  children: (items: T[]) => React.ReactNode;
}) {
  if (state.state === 'loading') {
    return (
      <Box hasXSpacing hasYSpacing>
        <Text textType={TextType.Shy}>Loading…</Text>
      </Box>
    );
  }

  if (state.state === 'unreachable') {
    return (
      <Box hasXSpacing hasYSpacing>
        <VStack UNSAFE_style={{ gap: 8, alignItems: 'flex-start' }}>
          {/* ⚠️ The detail is OUR fetch error, never platform prose — a stranger cannot reach it. */}
          <Text textType={TextType.Shy}>Could not reach the community ({state.detail}).</Text>
          <PrimaryButton
            variant={PrimaryButtonVariant.Ghost}
            size={PrimaryButtonSize.Small}
            label="Try again"
            onClick={onRetry}
          />
        </VStack>
      </Box>
    );
  }

  if (state.state === 'empty') {
    return (
      <Box hasXSpacing hasYSpacing>
        <Text textType={TextType.Shy}>{emptyLine}</Text>
      </Box>
    );
  }

  return <>{children(state.items)}</>;
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

  // 🔴 D15: the platform said this surface does not exist for this viewer. Draw NOTHING — not a
  // message, not an empty state. `apiviewer.ts` answers an org-minor with a 404 precisely so a
  // pupil is not told a door exists, and a panel saying "unavailable" would narrate the door in
  // the act of closing it. ⚠️ The rail ENTRY is still there — `SidebarModel.register` is
  // synchronous at setup and has no async gate — and that is a recorded gap, not a solved one.
  if (view.surface === 'hidden') return null;

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
            <SectionBody
              state={view.threads}
              emptyLine="Questions asked from the editor land here. Right-click any node and choose “Ask about this node”."
              onRetry={refresh}
            >
              {(threads) =>
                threads.map((thread) => (
                  <ListItem
                    key={thread.id}
                    icon={IconName.MessageCircleQuestion}
                    text={thread.title}
                    onClick={() => openCommunity(`/bench/${thread.externalId}`)}
                  />
                ))
              }
            </SectionBody>
          </Section>

          <Section title="Guides and tutorials" variant={SectionVariant.Panel} hasGutter>
            <SectionBody
              state={view.articles}
              emptyLine="Written guides published to the community appear here."
              onRetry={refresh}
            >
              {(articles) =>
                articles.map((article) => (
                  <ListItem
                    key={article.slug}
                    icon={IconName.BookOpen}
                    text={article.title}
                    onClick={() => openCommunity(`/articles/${article.slug}`)}
                  />
                ))
              }
            </SectionBody>
          </Section>

          <Section title="Call replays" variant={SectionVariant.Panel} hasGutter>
            <SectionBody
              state={view.replays}
              emptyLine="Recordings of the weekly call are listed here, newest first."
              onRetry={refresh}
            >
              {(replays) =>
                replays.map((replay) => (
                  <ListItem
                    key={replay.slug}
                    icon={IconName.Play}
                    text={replay.title}
                    onClick={() => openCommunity(`/replays/${replay.slug}`)}
                  />
                ))
              }
            </SectionBody>
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
