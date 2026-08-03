/**
 * AIB-008 — the Repository section: where this project pushes to.
 *
 * The first section of the merged panel, and the one that only exists *because*
 * the panels are one thing. Its content — remote, branch, ahead/behind — was
 * previously split across `GitHubPanel`'s `SyncToolbar` (which computed its own
 * ahead/behind through its own `Git` instance) and `VersionControlPanel`'s
 * status button (which had the same two numbers in context and never showed
 * them side by side).
 *
 * ## What this does NOT do
 *
 * It does not push or pull. `GitStatusButton` renders directly below it, has
 * done both since long before this task, and drives them from the same context
 * this reads. Adding buttons here would have reproduced the duplication the
 * merge exists to remove — the audit found push/pull implemented twice, and the
 * fix is one implementation, not a third caller.
 *
 * @module VersionControlPanel/components/RepositorySection
 */

import React from 'react';
import { platform } from '@noodl/platform';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { HStack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { Text, TextType } from '@noodl-core-ui/components/typography/Text';

import { useVersionControlContext } from '../context';
import type { ProjectGitState } from '../hooks/useGitHubRepository';
import css from './RepositorySection.module.scss';

export interface RepositorySectionProps {
  gitState: ProjectGitState;
  remoteUrl: string | null;
  owner: string | null;
  repo: string | null;
  /** Open the connect-to-GitHub flow. Absent when there is nothing to connect. */
  onConnect?: () => void;
}

/**
 * `owner/repo` for GitHub, the bare URL otherwise, and an honest sentence when
 * there is no remote.
 *
 * ⚠️ Not `git.OriginUrl` parsed here. `useGitHubRepository` already owns that
 * parse and handles both the `https://` and `git@` forms; a second parse in a
 * view is how the panel comes to disagree with itself about which repository it
 * is looking at.
 */
function remoteLabel(owner: string | null, repo: string | null, remoteUrl: string | null): string {
  if (owner && repo) return `${owner}/${repo}`;
  if (remoteUrl) return remoteUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '');
  return 'No remote';
}

/**
 * "ahead 3 · behind 1", or "up to date", or nothing at all.
 *
 * `undefined` rather than 0 while the first fetch is in flight — `0 · 0` reads
 * as "up to date" and is the one answer this must not give before it knows.
 */
function syncLabel(ahead: number | undefined, behind: number | undefined): string | undefined {
  if (ahead === undefined || behind === undefined) return undefined;
  if (ahead === 0 && behind === 0) return 'Up to date';
  const parts: string[] = [];
  if (ahead > 0) parts.push(`${ahead} ahead`);
  if (behind > 0) parts.push(`${behind} behind`);
  return parts.join(' · ');
}

export function RepositorySection({ gitState, remoteUrl, owner, repo, onConnect }: RepositorySectionProps) {
  const { fetch } = useVersionControlContext();
  const { currentBranch, localCommitCount, remoteCommitCount } = fetch;

  const hasRemote = gitState === 'github-connected' || gitState === 'remote-not-github';
  const sync = hasRemote ? syncLabel(localCommitCount, remoteCommitCount) : undefined;
  const isGitHub = gitState === 'github-connected';

  return (
    <Box hasXSpacing hasYSpacing>
      <VStack UNSAFE_style={{ gap: 4 }}>
        <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
          <Icon icon={hasRemote ? IconName.CloudCheck : IconName.CloudData} size={IconSize.Small} />
          <span className={css.Remote}>
            <Text textType={TextType.Default}>{remoteLabel(owner, repo, remoteUrl)}</Text>
          </span>
          {isGitHub && remoteUrl && (
            <IconButton
              icon={IconName.ExternalLink}
              size={IconSize.Small}
              variant={IconButtonVariant.OpaqueOnHover}
              onClick={() => platform.openExternal(`https://github.com/${owner}/${repo}`)}
            />
          )}
        </HStack>

        {/*
          AIB-008 criterion 3 — visible without changing section. This is the
          number the task calls "the main product argument for doing this at
          all", and until now it existed in two places and was rendered in
          neither next to the branch it belongs to.
        */}
        <HStack UNSAFE_style={{ alignItems: 'center', gap: 6 }}>
          <Icon icon={IconName.GitBranch} size={IconSize.Small} />
          <Text textType={TextType.Shy}>{currentBranch?.name ?? '…'}</Text>
          {sync && (
            <span className={css.Sync}>
              <Text textType={TextType.Shy}>{sync}</Text>
            </span>
          )}
        </HStack>

        {/*
          AIB-008 slice 3 — the highest-value flow, and the one that used to
          require knowing there was a second panel. A local project gains a
          GitHub remote from the same panel that shows its history.
        */}
        {!hasRemote && onConnect && (
          <Box hasTopSpacing>
            <PrimaryButton
              label="Connect to GitHub"
              icon={IconName.CloudUpload}
              size={PrimaryButtonSize.Small}
              variant={PrimaryButtonVariant.Muted}
              isGrowing
              onClick={onConnect}
              testId="connect-to-github"
            />
          </Box>
        )}
      </VStack>
    </Box>
  );
}
