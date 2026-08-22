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
 * It does not mean blank. D16's *design obligation* survives the reversal: a surface is composed
 * of things that exist whether or not anybody posted, each with its own empty line saying what it
 * is *for*. See `mirrorview.ts` for the state machine.
 *
 * ## 🔴 NAT-012 / D6, 2026-08-22 — this panel is a DOOR, and it used to be a second home
 *
 * It drew seven things: viewer + refresh, Discussions, People, installable Tutorials, Guides and
 * tutorials, Call replays, the health readout, and a browser button. That was the launcher's page
 * again, in a narrower column — and D6 ruled the two surfaces are not peers: **the launcher tab is
 * the community's home** (FB-006 gave it the web's tabs) and **this is the door from inside a
 * project**, showing what is relevant to what you are doing.
 *
 * What stays, and the test each one passes — *is this about the project on the canvas?*
 *
 * - **Discussions** — the questions you asked from this editor, and their answers. The one verb
 *   D6 leaves in the rail (`AskAboutNodeDialog`) lands here.
 * - **The thread pane and the profile pane** — you reach a thread from your own question and a
 *   profile from that thread's author line. Both are *continuations* of something project-shaped.
 * - **TUT-004's installable tutorials** — 🔴 not community *content*: installing one **writes a
 *   lesson into your project**, which is as project-relevant as anything else in the rail.
 *
 * What left, and where it went:
 *
 * | Gone from here | Why | Where it lives |
 * |---|---|---|
 * | **People** (the directory) | Browsing strangers is not about your project | Launcher's People tab |
 * | **Guides and tutorials** | Reading is a home activity; the rows opened a browser | Launcher's Tutorials tab |
 * | **Call replays** | Same | Launcher's Replays tab |
 * | **The health readout** | A *community* number, not a project one | Launcher chrome (FB-006) |
 *
 * 🔴 **This revises two live task files, and both are named here rather than only in a commit**:
 * NAT-008 AC1's *rail* half (the directory in the panel) is withdrawn — AC2's profile pane, which
 * is the half that opens from a thread, is untouched and still drawn below. NAT-005's *panel* loses
 * the guides and replays sections it specified; its vocabulary and its row components are
 * unchanged, and the launcher still draws every one of them.
 *
 * ⚠️ **`useCommunityMirror` still fetches all of it.** The hook is shared with the launcher tab
 * and narrowing the *fetch* per surface would give the two surfaces different caches — the exact
 * two-copies arrangement NAT-005 collapsed. `view.articles`, `view.replays` and `view.health` are
 * therefore live and unread here, on purpose.
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
  CommunityProfileView,
  CommunityRow,
  CommunitySectionBody,
  CommunityThreadView,
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

import { leaveForLauncher } from '@noodl-utils/launcher/leaveForLauncher';

import { Tutorials } from './Tutorials';

/**
 * ⚠️ **No `path` parameter any more, and dropping it was the point.** It took one because the
 * article and replay rows passed `/articles/<slug>` and `/replays/<slug>` — the "row that silently
 * jumps to Chrome" AC2 names. Those rows went to the launcher with their sections, leaving exactly
 * one caller: the explicitly labelled browser control. A parameter kept for nobody is an invitation
 * to add the next silent jump, so it goes with them.
 */
function openCommunity(): void {
  platform.openExternal(COMMUNITY_URL);
}

export function CommunityPanel() {
  const { view, isRefreshing, refresh } = useCommunityMirror();
  // NAT-007 — the same hook the launcher tab uses. See `useCommunityThread` for why the open/
  // closed state and the cache are shared rather than duplicated per surface.
  const { pane, openThread } = useCommunityThread();
  // 🔴 NAT-008 — the same hook the launcher tab uses, but D6 narrowed which half this surface
  // draws. The **directory** (`people`) moved to the launcher, where FB-006 gives it a tab; the
  // **profile pane** stays, because you reach it from a thread's author line and that thread is
  // still here. So this destructure deliberately drops `people` and keeps the other two.
  const { profile, openPerson } = useCommunityPeople();
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

          {/* 🔴 TUT-004 — the tutorials you can install into THIS project. ⚠️ Its AC1 positioned
              this section "above Guides and tutorials"; D6 removed that section, so the ordering
              claim has lost its subject while the section itself is untouched. It stays because
              installing a lesson writes into your project, which is as project-relevant as
              anything else in the rail — see the module note on what "community" means here. */}
          <Tutorials pane={tutorials} />

          {/* 🔴 NAT-012 AC3 + AC5 — the two ways out, both saying where they go.

              The **first** is the door D6 describes: the launcher is the community's home, and
              this panel is the door to it from inside a project. ⚠️ It closes your project, and
              the label says so rather than discovering it — that is the whole of Richard's
              2026-08-22 ruling. See `launcherHandoff.ts` for why the alternative (a router that
              keeps the project across the route) was declined.

              The **second** is AC2's one permitted `openExternal`: an explicitly labelled "opens
              in your browser" control. It is kept rather than folded into the first because the
              website is not the launcher, and making somebody close a project to reach a page
              they asked for by name would be a worse hand-off than the one being removed. */}
          <Section variant={SectionVariant.PanelShy} hasGutter hasTopDivider>
            <Box hasYSpacing>
              <VStack UNSAFE_style={{ gap: 8, alignItems: 'stretch' }}>
                <PrimaryButton
                  variant={PrimaryButtonVariant.Ghost}
                  size={PrimaryButtonSize.Small}
                  label="Community home — closes your project"
                  icon={IconName.Home}
                  onClick={() => leaveForLauncher('community')}
                />
                <Text textType={TextType.Shy}>
                  People, guides, replays and the full discussion list live in the launcher. Reopening this project
                  brings you back to the component you were on.
                </Text>
                <PrimaryButton
                  variant={PrimaryButtonVariant.Ghost}
                  size={PrimaryButtonSize.Small}
                  label="Open community.nodegx.io in your browser"
                  icon={IconName.ExternalLink}
                  onClick={() => openCommunity()}
                />
              </VStack>
            </Box>
          </Section>
        </Box>
      </ScrollArea>
    </BasePanel>
  );
}
