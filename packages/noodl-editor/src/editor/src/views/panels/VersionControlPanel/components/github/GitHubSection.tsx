/**
 * AIB-008 — Issues and Pull Requests, inside the version-control panel.
 *
 * ## Why this exists at all
 *
 * AIB-008's "Current state" describes `GitHubPanel` as *"remote, auth, repo
 * creation, push"*, and its proposed shape is four sections
 * (Repository / Changes / History / Branches) with no room for anything else.
 * The audit found that description is wrong about the panel's main content:
 * Issues and Pull Requests were roughly 1,000 of its 1,900 lines, and dropping
 * them to fit the proposed shape would have failed criterion 2 — *"every action
 * available in either panel before is available after"* — while looking like a
 * successful consolidation.
 *
 * ## Why a collapsed section and not a fourth tab
 *
 * The task's design position is "sections, not tabs", on the grounds that tabs
 * hide the local/remote state that matters most. That argument is about
 * Repository vs Changes vs History; it does not reach here, because issues and
 * PRs are not local-vs-remote state — they are a long scrolling list of other
 * people's work. What they must not do is occupy the panel a user opened to
 * commit, so the section is present, findable, and closed until asked for.
 *
 * ## Three preconditions, each with its own sentence
 *
 * The old panel had six early returns, five of which rendered a full-panel
 * empty state with an emoji. Inside a section that would be five different
 * ways for the panel to look mostly empty, so the states collapse to: no
 * section at all when the remote is not GitHub (nothing here could apply), and
 * one line with one action when the remote is GitHub but the account is not
 * connected.
 *
 * @module VersionControlPanel/components/github/GitHubSection
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useEffect, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { ActionButton, ActionButtonVariant } from '@noodl-core-ui/components/inputs/ActionButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Collapsible } from '@noodl-core-ui/components/layout/Collapsible';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { GitHubClient, GitHubOAuthService } from '../../../../../services/github';
import { useIssues } from '../../hooks/useIssues';
import { usePullRequests } from '../../hooks/usePullRequests';
import css from './GitHubSection.module.scss';
import { IssuesList } from './IssuesTab/IssuesList';
import { PRsList } from './PullRequestsTab/PRsList';

export interface GitHubSectionProps {
  owner: string | null;
  repo: string | null;
}

type TabType = 'issues' | 'pullRequests';

export function GitHubSection({ owner, repo }: GitHubSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(() => GitHubClient.instance.isReady());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // The OAuth service is initialised here rather than at panel mount because
    // this section is the only thing in the merged panel that needs a GitHub
    // *account* — everything else needs only a git remote. A user who never
    // opens this never pays for the check.
    GitHubOAuthService.instance
      .initialize()
      .then(() => setIsConnected(GitHubClient.instance.isReady()))
      .catch((error) => console.error('[VersionControl] Could not initialise GitHub auth:', error))
      .finally(() => setIsInitialized(true));
  }, []);

  useEventListener(GitHubOAuthService.instance, 'auth-state-changed', (event: { authenticated: boolean }) => {
    setIsConnected(event.authenticated);
  });

  // `ActionButton` + `Collapsible`, the same pair `BranchStatusButton` uses.
  // `Collapsible` is a pure animated container with no header of its own, so a
  // section that invented one would look like a different kind of section.
  return (
    <>
      <ActionButton
        icon={IconName.GitPullRequest}
        variant={isOpen ? ActionButtonVariant.Proud : ActionButtonVariant.Default}
        prefixText="GitHub"
        label="Issues & pull requests"
        onClick={() => setIsOpen((open) => !open)}
      />
      <Collapsible isCollapsed={!isOpen} transitionMs={200}>
        {!isInitialized ? (
          <Box hasXSpacing hasYSpacing>
            <Text textType={TextType.Shy}>Checking your GitHub connection…</Text>
          </Box>
        ) : !isConnected ? (
          <Box hasXSpacing hasYSpacing>
            <VStack UNSAFE_style={{ gap: 8 }}>
              <Text textType={TextType.Shy}>
                This repository is on GitHub. Connect your account to see its issues and pull requests here.
              </Text>
              <PrimaryButton
                label="Connect GitHub account"
                size={PrimaryButtonSize.Small}
                variant={PrimaryButtonVariant.Muted}
                isGrowing
                onClick={() =>
                  GitHubOAuthService.instance
                    .initiateOAuth()
                    .catch((error) => console.error('[VersionControl] GitHub OAuth failed:', error))
                }
                testId="connect-github-account"
              />
            </VStack>
          </Box>
        ) : !owner || !repo ? (
          // Reachable: a remote on github.com whose URL did not parse into
          // owner/repo. Said plainly rather than shown as an empty list, which is
          // what "loading forever" would look like.
          <Box hasXSpacing hasYSpacing>
            <Text textType={TextType.Shy}>
              This remote is on GitHub, but its URL could not be read as an owner and repository.
            </Text>
          </Box>
        ) : (
          <GitHubLists owner={owner} repo={repo} />
        )}
      </Collapsible>
    </>
  );
}

/**
 * Split out so the two data hooks are not called until the section has an owner,
 * a repo and a connected account — a `useIssues` call with a null owner is a
 * request that can only 404, and `GitHubPanel` avoided it only because its early
 * returns happened to sit above the hook.
 */
function GitHubLists({ owner, repo }: { owner: string; repo: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('issues');
  return (
    <div className={css.Lists}>
      <div className={css.Tabs}>
        <button
          className={`${css.Tab} ${activeTab === 'issues' ? css.TabActive : ''}`}
          onClick={() => setActiveTab('issues')}
          type="button"
        >
          Issues
        </button>
        <button
          className={`${css.Tab} ${activeTab === 'pullRequests' ? css.TabActive : ''}`}
          onClick={() => setActiveTab('pullRequests')}
          type="button"
        >
          Pull requests
        </button>
      </div>
      <div className={css.Content}>
        {activeTab === 'issues' ? <Issues owner={owner} repo={repo} /> : <PullRequests owner={owner} repo={repo} />}
      </div>
    </div>
  );
}

function Issues({ owner, repo }: { owner: string; repo: string }) {
  const { issues, loading, error, hasMore, loadMore, loadingMore, refetch } = useIssues({
    owner,
    repo,
    filters: { state: 'open' }
  });
  return (
    <IssuesList
      issues={issues}
      loading={loading}
      error={error}
      hasMore={hasMore}
      loadMore={loadMore}
      loadingMore={loadingMore}
      onRefresh={refetch}
    />
  );
}

function PullRequests({ owner, repo }: { owner: string; repo: string }) {
  const { pullRequests, loading, error, hasMore, loadMore, loadingMore, refetch } = usePullRequests({
    owner,
    repo,
    filters: { state: 'open' }
  });
  return (
    <PRsList
      pullRequests={pullRequests}
      loading={loading}
      error={error}
      hasMore={hasMore}
      loadMore={loadMore}
      loadingMore={loadingMore}
      onRefresh={refetch}
    />
  );
}
