import React, { useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonSize, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { HStack } from '@noodl-core-ui/components/layout/Stack';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { Label, LabelSize } from '@noodl-core-ui/components/typography/Label';
import { TextType } from '@noodl-core-ui/components/typography/Text';

import { GitStatusBadge, GitStatusType } from '../GitStatusBadge';
import { CloudSyncType, LauncherProjectData } from '../LauncherProjectCard';
import css from './ProjectListRow.module.scss';

export interface ProjectListRowProps extends LauncherProjectData {
  onClick?: () => void;
  onOpenFolder?: () => void;
  onSettings?: () => void;
  onDelete?: () => void;
}

// Helper to format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}

// Helper to truncate path
function truncatePath(path: string, maxLength: number = 30): string {
  if (path.length <= maxLength) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path;

  return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

// Convert project data to git status
function getGitStatus(project: LauncherProjectData): GitStatusType {
  if (project.cloudSyncMeta.type === CloudSyncType.None) {
    return GitStatusType.NotInitialized;
  }

  if (!project.cloudSyncMeta.source) {
    return GitStatusType.LocalOnly;
  }

  if (project.uncommittedChangesAmount) {
    return GitStatusType.Uncommitted;
  }

  if (project.pushAmount && project.pullAmount) {
    return GitStatusType.Diverged;
  }

  if (project.pushAmount) {
    return GitStatusType.Ahead;
  }

  if (project.pullAmount) {
    return GitStatusType.Behind;
  }

  return GitStatusType.Synced;
}

/**
 * ProjectListRow
 *
 * Compact row displaying project information in a table format.
 * Shows quick actions on hover.
 */
export function ProjectListRow({
  title,
  lastOpened,
  localPath,
  onClick,
  onOpenFolder,
  onSettings,
  onDelete,
  ...projectData
}: ProjectListRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  const gitStatus = getGitStatus({ title, lastOpened, localPath, ...projectData });
  const gitDetails = {
    ahead: projectData.pushAmount,
    behind: projectData.pullAmount,
    uncommitted: projectData.uncommittedChangesAmount
  };

  const truncatedPath = truncatePath(localPath);

  return (
    <div
      className={css.Root}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Name Column - 40% */}
      <div className={css.Column} style={{ width: '40%' }}>
        <Icon icon={IconName.FolderClosed} size={IconSize.Small} variant={TextType.Default} />
        <Label size={LabelSize.Default}>{title}</Label>
      </div>

      {/* Last Modified Column - 20% */}
      <div className={css.Column} style={{ width: '20%' }}>
        <Label size={LabelSize.Small} variant={TextType.Shy}>
          {formatRelativeTime(lastOpened)}
        </Label>
      </div>

      {/* Git Status Column - 20% */}
      <div className={css.Column} style={{ width: '20%' }}>
        <GitStatusBadge status={gitStatus} details={gitDetails} />
      </div>

      {/* Path Column - 20% */}
      <div className={css.Column} style={{ width: '20%' }}>
        {isHovered ? (
          <HStack hasSpacing={1} UNSAFE_className={css.Actions}>
            <Tooltip content="Open folder" showAfterMs={200}>
              <IconButton
                icon={IconName.FolderOpen}
                size={IconSize.Small}
                buttonSize={IconButtonSize.Default}
                variant={IconButtonVariant.Transparent}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolder?.();
                }}
              />
            </Tooltip>
            <Tooltip content="Settings" showAfterMs={200}>
              <IconButton
                icon={IconName.Setting}
                size={IconSize.Small}
                buttonSize={IconButtonSize.Default}
                variant={IconButtonVariant.Transparent}
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings?.();
                }}
              />
            </Tooltip>
            <Tooltip content="Delete" showAfterMs={200}>
              <IconButton
                icon={IconName.Trash}
                size={IconSize.Small}
                buttonSize={IconButtonSize.Default}
                variant={IconButtonVariant.Transparent}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              />
            </Tooltip>
          </HStack>
        ) : (
          <Tooltip content={localPath} showAfterMs={400}>
            <Label size={LabelSize.Small} variant={TextType.Shy}>
              {truncatedPath}
            </Label>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
