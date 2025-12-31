import React from 'react';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { Label, LabelSpacingSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';

import css from './GitStatusBadge.module.scss';

/**
 * Git status types that a project can have
 */
export enum GitStatusType {
  /** No git repository initialized */
  NotInitialized = 'not-initialized',
  /** Git repo exists but no remote configured */
  LocalOnly = 'local-only',
  /** Synced with remote, no changes */
  Synced = 'synced',
  /** Have local commits to push */
  Ahead = 'ahead',
  /** Have remote commits to pull */
  Behind = 'behind',
  /** Both ahead and behind (diverged) */
  Diverged = 'diverged',
  /** Uncommitted local changes */
  Uncommitted = 'uncommitted'
}

export interface GitStatusDetails {
  /** Number of commits ahead of remote */
  ahead?: number;
  /** Number of commits behind remote */
  behind?: number;
  /** Number of uncommitted file changes */
  uncommitted?: number;
}

export interface GitStatusBadgeProps {
  /** The git status type */
  status: GitStatusType;
  /** Additional details for status display */
  details?: GitStatusDetails;
  /** Whether to show compact view (icon only) */
  compact?: boolean;
  /** Custom className for styling */
  className?: string;
}

/**
 * Get the appropriate icon, color, and tooltip for a git status
 */
function getGitStatusDisplay(status: GitStatusType, details?: GitStatusDetails) {
  switch (status) {
    case GitStatusType.NotInitialized:
      return {
        icon: IconName.CircleOpen,
        variant: TextType.Shy,
        tooltip: 'No version control',
        label: 'None'
      };

    case GitStatusType.LocalOnly:
      return {
        icon: IconName.CloudData,
        variant: FeedbackType.Notice,
        tooltip: 'Local git repository only, not connected to remote',
        label: 'Local'
      };

    case GitStatusType.Synced:
      return {
        icon: IconName.CloudCheck,
        variant: FeedbackType.Success,
        tooltip: 'Up to date with remote',
        label: 'Synced'
      };

    case GitStatusType.Ahead:
      return {
        icon: IconName.CloudUpload,
        variant: FeedbackType.Danger,
        tooltip: details?.ahead
          ? `${details.ahead} commit${details.ahead === 1 ? '' : 's'} to push`
          : 'Commits ready to push',
        label: details?.ahead ? `↑${details.ahead}` : 'Push'
      };

    case GitStatusType.Behind:
      return {
        icon: IconName.CloudDownload,
        variant: FeedbackType.Notice,
        tooltip: details?.behind
          ? `${details.behind} commit${details.behind === 1 ? '' : 's'} to pull`
          : 'Commits available to pull',
        label: details?.behind ? `↓${details.behind}` : 'Pull'
      };

    case GitStatusType.Diverged:
      return {
        icon: IconName.WarningCircle,
        variant: FeedbackType.Danger,
        tooltip:
          details?.ahead && details?.behind
            ? `${details.ahead} ahead, ${details.behind} behind`
            : 'Branch has diverged from remote',
        label: 'Diverged'
      };

    case GitStatusType.Uncommitted:
      return {
        icon: IconName.CircleDot,
        variant: FeedbackType.Notice,
        tooltip: details?.uncommitted
          ? `${details.uncommitted} uncommitted change${details.uncommitted === 1 ? '' : 's'}`
          : 'Uncommitted changes',
        label: details?.uncommitted ? `●${details.uncommitted}` : 'Changes'
      };

    default:
      return {
        icon: IconName.CircleOpen,
        variant: TextType.Shy,
        tooltip: 'Unknown status',
        label: '?'
      };
  }
}

/**
 * GitStatusBadge
 *
 * Displays a visual indicator for git repository status with tooltip.
 * Can show detailed information about commits ahead/behind or uncommitted changes.
 */
export function GitStatusBadge({ status, details, compact = false, className }: GitStatusBadgeProps) {
  const display = getGitStatusDisplay(status, details);

  return (
    <Tooltip content={display.tooltip} showAfterMs={200} UNSAFE_className={css.Tooltip}>
      <HStack UNSAFE_style={{ alignItems: 'center' }} hasSpacing={compact ? 0 : 1} UNSAFE_className={className}>
        <Icon icon={display.icon} variant={display.variant} size={IconSize.Tiny} />
        {!compact && (
          <Label hasLeftSpacing={LabelSpacingSize.Small} variant={display.variant}>
            {display.label}
          </Label>
        )}
      </HStack>
    </Tooltip>
  );
}
