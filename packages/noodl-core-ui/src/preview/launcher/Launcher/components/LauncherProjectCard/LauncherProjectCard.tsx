import React, { useState } from 'react';

import { FeedbackType } from '@noodl-constants/FeedbackType';

import { Card, CardBackground } from '@noodl-core-ui/components/common/Card';
import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';
import { IconButton } from '@noodl-core-ui/components/inputs/IconButton';
import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextButton, TextButtonSize } from '@noodl-core-ui/components/inputs/TextButton';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { Columns } from '@noodl-core-ui/components/layout/Columns';
import { HStack, Stack, VStack } from '@noodl-core-ui/components/layout/Stack';
import { ContextMenu, ContextMenuProps } from '@noodl-core-ui/components/popups/ContextMenu';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { Label, LabelSize, LabelSpacingSize } from '@noodl-core-ui/components/typography/Label';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';
import { UserBadgeProps, UserBadgeSize } from '@noodl-core-ui/components/user/UserBadge';
import { UserBadgeList } from '@noodl-core-ui/components/user/UserBadgeList';

import { useProjectOrganization } from '../../hooks/useProjectOrganization';
import { TagPill, TagPillSize } from '../TagPill';
import css from './LauncherProjectCard.module.scss';

// Runtime version detection types
export interface RuntimeVersionInfo {
  version: 'react17' | 'react19' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
}

// FIXME: Use the timeSince function from the editor package when this is moved there
function timeSince(date: Date | number) {
  const date_unix = typeof date === 'number' ? date : date.getTime();
  var seconds = Math.floor((new Date().getTime() - date_unix) / 1000);

  var interval = Math.floor(seconds / 31536000);

  if (interval > 1) {
    return interval + ' years';
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return interval + ' months';
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return interval + ' days';
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return interval + ' hours';
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return interval + ' minutes';
  }
  return Math.floor(seconds) + ' seconds';
}

export enum CloudSyncType {
  None = 'Local',
  Git = 'Git'
}

export interface LauncherProjectData {
  id: string;
  title: string;
  cloudSyncMeta: {
    type: CloudSyncType;
    source?: string;
  };
  localPath: string;
  lastOpened: string;
  pullAmount?: number;
  pushAmount?: number;
  uncommittedChangesAmount?: number;
  imageSrc: string;
  contributors?: UserBadgeProps[];
  runtimeInfo?: RuntimeVersionInfo;
}

export interface LauncherProjectCardProps extends LauncherProjectData {
  contextMenuItems: ContextMenuProps[];
  onClick?: () => void;
  runtimeInfo?: RuntimeVersionInfo;
  onMigrateProject?: () => void;
  onOpenReadOnly?: () => void;
}

export function LauncherProjectCard({
  id,
  title,
  cloudSyncMeta,
  localPath,
  lastOpened,
  pullAmount,
  pushAmount,
  uncommittedChangesAmount,
  imageSrc,
  contextMenuItems,
  contributors,
  onClick,
  runtimeInfo,
  onMigrateProject,
  onOpenReadOnly
}: LauncherProjectCardProps) {
  const { tags, getProjectMeta } = useProjectOrganization();
  const [showRuntimeDetails, setShowRuntimeDetails] = useState(false);

  // Get project tags
  const projectMeta = getProjectMeta(localPath);
  const projectTags = projectMeta ? tags.filter((tag) => projectMeta.tagIds.includes(tag.id)) : [];

  // Projects without a react19 marker run on the default (React 18.3) runtime.
  // That is the unchanged, fully supported baseline — the card opens normally
  // and only offers an optional upgrade path.
  const isDefaultRuntime = runtimeInfo?.version === 'react17';

  return (
    <Card background={CardBackground.Bg2} hoverBackground={CardBackground.Bg3} onClick={onClick}>
      <Stack direction="row">
        <div className={css.Image} style={{ backgroundImage: `url(${imageSrc})` }} />

        <div className={css.Details}>
          <Columns layoutString="1 1 1" hasXGap={4}>
            <div>
              <HStack hasSpacing={2} UNSAFE_style={{ alignItems: 'center' }}>
                <Title hasBottomSpacing size={TitleSize.Medium}>
                  {title}
                </Title>
              </HStack>

              {/* Tags */}
              {projectTags.length > 0 && (
                <HStack hasSpacing={2} UNSAFE_style={{ marginBottom: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                  {projectTags.map((tag) => (
                    <TagPill key={tag.id} tag={tag} size={TagPillSize.Small} />
                  ))}
                </HStack>
              )}

              <Label variant={TextType.Shy}>Last opened {timeSince(new Date(lastOpened))} ago</Label>
            </div>

            <div>
              {cloudSyncMeta.type === CloudSyncType.None && (
                <div>
                  <Label hasBottomSpacing>None</Label>
                  <HStack UNSAFE_style={{ alignItems: 'center' }} hasSpacing={1}>
                    <Icon icon={IconName.WarningCircle} variant={TextType.Shy} size={IconSize.Tiny} />
                    <Label variant={TextType.Shy}>Project is only local</Label>
                  </HStack>
                </div>
              )}

              {cloudSyncMeta.type === CloudSyncType.Git && (
                <div className={css.TypeDisplay}>
                  <TextButton
                    label="Open Git repo"
                    size={TextButtonSize.Small}
                    icon={IconName.ExternalLink}
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('FIXME: Link to repo?');
                    }}
                  />
                </div>
              )}

              <HStack hasSpacing={4} UNSAFE_style={{ paddingLeft: 4 }}>
                {Boolean(pullAmount) && (
                  <Tooltip
                    content={`${pullAmount} unpulled commits`}
                    showAfterMs={200}
                    UNSAFE_className={css.VersionControlTooltip}
                  >
                    <HStack UNSAFE_style={{ alignItems: 'center' }}>
                      <Icon icon={IconName.CloudDownload} variant={FeedbackType.Notice} size={IconSize.Tiny} />
                      <Label hasLeftSpacing={LabelSpacingSize.Small} variant={FeedbackType.Notice}>
                        {String(pullAmount)}
                      </Label>
                    </HStack>
                  </Tooltip>
                )}

                {Boolean(pushAmount) && (
                  <Tooltip
                    content={`${pushAmount} unpushed local commits`}
                    showAfterMs={200}
                    UNSAFE_className={css.VersionControlTooltip}
                  >
                    <HStack UNSAFE_style={{ alignItems: 'center' }}>
                      <Icon icon={IconName.CloudUpload} variant={FeedbackType.Danger} size={IconSize.Tiny} />
                      <Label hasLeftSpacing={LabelSpacingSize.Small} variant={FeedbackType.Danger}>
                        {String(pushAmount)}
                      </Label>
                    </HStack>
                  </Tooltip>
                )}

                {Boolean(uncommittedChangesAmount) && (
                  <Tooltip
                    content={`${uncommittedChangesAmount} uncommitted changes`}
                    showAfterMs={200}
                    UNSAFE_className={css.VersionControlTooltip}
                  >
                    <HStack UNSAFE_style={{ alignItems: 'center' }}>
                      <Icon
                        icon={IconName.WarningCircle}
                        variant={FeedbackType.Danger}
                        size={IconSize.Tiny}
                        UNSAFE_className={css.VersionControlTooltip}
                      />
                      <Label hasLeftSpacing={LabelSpacingSize.Small} variant={FeedbackType.Danger}>
                        {String(uncommittedChangesAmount)}
                      </Label>
                    </HStack>
                  </Tooltip>
                )}
              </HStack>
            </div>

            <HStack UNSAFE_style={{ justifyContent: 'space-between', alignItems: 'center' }} hasSpacing={4}>
              <HStack UNSAFE_style={{ alignItems: 'center' }} hasSpacing={2}>
                {/* FIXME: get default user data from user object */}
                <UserBadgeList
                  badges={contributors || [{ name: 'Tore Knudsen', email: 'tore@noodl.net', id: 'Tore' }]}
                  size={UserBadgeSize.Medium}
                  maxVisible={4}
                />

                {!Boolean(contributors) && <Label variant={TextType.Shy}>(Only you)</Label>}
              </HStack>

              {Boolean(contextMenuItems) && (
                <div>
                  <ContextMenu renderDirection={DialogRenderDirection.Below} menuItems={contextMenuItems} />
                </div>
              )}
            </HStack>
          </Columns>

          {/* Runtime info strip — informational, never a warning */}
          {isDefaultRuntime && (
            <div className={css.RuntimeBanner}>
              <HStack hasSpacing={2} UNSAFE_style={{ alignItems: 'center', flex: 1 }}>
                <Text size={TextSize.Small}>Default runtime (React 18.3)</Text>
              </HStack>

              <TextButton
                label={showRuntimeDetails ? 'Less' : 'Options'}
                size={TextButtonSize.Small}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRuntimeDetails(!showRuntimeDetails);
                }}
              />
            </div>
          )}

          {/* Expanded runtime details */}
          {isDefaultRuntime && showRuntimeDetails && (
            <div className={css.LegacyDetails}>
              <Label variant={TextType.Shy} size={LabelSize.Default}>
                This project runs on the default React 18.3 runtime and works as-is. To upgrade to React 19, open the
                project and switch runtime in Project Settings — or use the assisted migration, which upgrades a copy
                and leaves this project untouched.
              </Label>

              <HStack hasSpacing={2} UNSAFE_style={{ marginTop: 'var(--spacing-3)' }}>
                <PrimaryButton
                  label="Assisted Migration"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMigrateProject?.();
                  }}
                />

                <PrimaryButton
                  label="Open Read-Only"
                  size={PrimaryButtonSize.Small}
                  variant={PrimaryButtonVariant.Muted}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenReadOnly?.();
                  }}
                />
              </HStack>
            </div>
          )}
        </div>
      </Stack>
    </Card>
  );
}
