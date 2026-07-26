import classNames from 'classnames';
import React, { useState } from 'react';

import { Chip, ChipVariant } from '@noodl-core-ui/components/common/Chip';
import { DialogRenderDirection } from '@noodl-core-ui/components/layout/BaseDialog';
import { ContextMenu, ContextMenuProps } from '@noodl-core-ui/components/popups/ContextMenu';
import { UserBadgeProps } from '@noodl-core-ui/components/user/UserBadge';

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

// Deterministic placeholder art. Five gradient buckets keyed to the node-category
// hues (see LauncherProjectCard.module.scss). A name-hash picks the bucket so the
// same project always gets the same colour.
const PLACEHOLDER_BUCKETS = 5;

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash);
}

function projectInitial(title: string): string {
  const match = (title || '').match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : '?';
}

/**
 * A capture is "usable" only if it is a real raster image or a remote URL. The
 * old empty-`<svg></svg>` sentinel and missing/blank values fall through to the
 * deterministic placeholder — a broken or blank thumbnail can never render.
 */
function hasUsableCapture(imageSrc?: string): boolean {
  if (!imageSrc) return false;
  const src = imageSrc.trim();
  if (!src) return false;
  if (src.startsWith('data:image/svg+xml')) return false; // legacy empty sentinel
  if (src.startsWith('data:image/')) return src.length > 64; // real raster capture
  return /^https?:\/\//.test(src);
}

/**
 * A data-URI can be a *valid* PNG that is nonetheless blank — the capture
 * pipeline persists solid-white thumbURIs for some projects, and those sail
 * past hasUsableCapture() because they are long, well-formed rasters. Decoding
 * the loaded <img> onto a tiny canvas is the only source-agnostic way to catch
 * them. Two signals, because measured captures cluster cleanly: a blank white
 * frame is ~98-100% near-white pixels (a couple of stray dark pixels from a
 * lone node or a 1px border blow up min/max spread but not the near-white
 * *fraction*, which is why an outlier-sensitive spread test alone let them
 * through); a solid non-white fill has near-zero spread. Real captures here sit
 * at 0% near-white with spread ~150. Cross-origin images taint the canvas and
 * throw on getImageData — we swallow that and keep the capture rather than
 * punish an uninspectable but possibly-real remote thumbnail.
 */
function isBlankCapture(img: HTMLImageElement): boolean {
  try {
    const S = 16;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, S, S);
    const { data } = ctx.getImageData(0, 0, S, S);
    let min = 255;
    let max = 0;
    let nearWhite = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Luma-ish: cheap average of RGB, alpha ignored (captures are opaque).
      const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (v < min) min = v;
      if (v > max) max = v;
      if (v > 244) nearWhite++;
      n++;
    }
    // Blank if it is overwhelmingly white (outlier-tolerant), or effectively a
    // single solid colour of any hue.
    return nearWhite / n >= 0.96 || max - min < 6;
  } catch {
    return false; // tainted / cross-origin — assume real, keep it.
  }
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

  const bucket = nameHash(title || '') % PLACEHOLDER_BUCKETS;
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
