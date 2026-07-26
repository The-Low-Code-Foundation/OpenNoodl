import classNames from 'classnames';
import React, { useState } from 'react';

import { Chip, ChipVariant } from '@noodl-core-ui/components/common/Chip';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { ContextMenu, ContextMenuProps } from '@noodl-core-ui/components/popups/ContextMenu';
import { UserBadgeProps } from '@noodl-core-ui/components/user/UserBadge';
import {
  hasUsableCapture,
  isBlankCapture,
  placeholderBucket,
  projectInitial
} from '@noodl-core-ui/utils/projectThumbnail';

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


const WarningTriangle = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 1.6 15 14H1L8 1.6Zm0 4.1c-.5 0-.8.3-.8.8l.2 3h1.2l.2-3c0-.5-.3-.8-.8-.8Zm0 6.6a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z" />
  </svg>
);

export function LauncherProjectCard({
  title,
  cloudSyncMeta,
  lastOpened,
  imageSrc,
  contextMenuItems,
  runtimeInfo,
  onClick
}: LauncherProjectCardProps) {
  // Start from whether the incoming capture is usable; an <img> load error flips
  // this off at runtime so a dead URL still resolves to the placeholder.
  const [showCapture, setShowCapture] = useState(() => hasUsableCapture(imageSrc));

  const bucket = placeholderBucket(title);
  const isLocal = cloudSyncMeta.type === CloudSyncType.None;
  const isReact17 = runtimeInfo?.version === 'react17';

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <div
      className={css['Card']}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-test="launcher-project-card"
    >
      <div className={classNames(css['Thumb'], !showCapture && css[`hue-${bucket}`])}>
        {showCapture ? (
          <img
            className={css['ThumbImage']}
            src={imageSrc}
            alt=""
            onError={() => setShowCapture(false)}
            onLoad={(e) => {
              if (isBlankCapture(e.currentTarget)) setShowCapture(false);
            }}
          />
        ) : (
          <span className={css['Ghost']} aria-hidden="true">
            {projectInitial(title)}
          </span>
        )}
      </div>

      <div className={css['Meta']}>
        <div className={css['Info']}>
          <span className={css['Name']} title={title}>
            {title}
          </span>
          <span className={css['Sub']}>
            <span className={css['Edited']}>Edited {timeSince(new Date(lastOpened))} ago</span>
            {isLocal && <Chip label="Local only" variant={ChipVariant.Neutral} />}
            {isReact17 && <Chip label="React 17 runtime" variant={ChipVariant.Warning} icon={WarningTriangle} />}
          </span>
        </div>

        {Boolean(contextMenuItems) && (
          <div
            className={css['Kebab']}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <ContextMenu renderDirection={DialogRenderDirection.Below} menuItems={contextMenuItems} />
          </div>
        )}
      </div>
    </div>
  );
}
