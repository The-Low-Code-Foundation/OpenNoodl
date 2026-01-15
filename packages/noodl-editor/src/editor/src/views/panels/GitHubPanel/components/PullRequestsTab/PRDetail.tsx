/**
 * PRDetail Component
 *
 * Slide-out panel displaying full pull request details
 */

import React from 'react';

import type { GitHubPullRequest } from '../../../../../services/github/GitHubTypes';
import styles from './PRDetail.module.scss';

interface PRDetailProps {
  pr: GitHubPullRequest;
  onClose: () => void;
}

export function PRDetail({ pr, onClose }: PRDetailProps) {
  const isDraft = pr.draft;
  const isMerged = pr.merged_at !== null;
  const isClosed = pr.state === 'closed' && !isMerged;

  return (
    <div className={styles.PRDetailOverlay} onClick={onClose}>
      <div className={styles.PRDetail} onClick={(e) => e.stopPropagation()}>
        <div className={styles.Header}>
          <div className={styles.TitleSection}>
            <h2 className={styles.Title}>
              #{pr.number} {pr.title}
            </h2>
            <div className={styles.StatusBadge} data-status={getStatus(pr)}>
              {getStatusIcon(pr)} {getStatusText(pr)}
            </div>
          </div>

          <button className={styles.CloseButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.Meta}>
          <span>
            <strong>{pr.user.login}</strong> wants to merge {pr.commits} commit{pr.commits !== 1 ? 's' : ''} into{' '}
            <code className={styles.Branch}>{pr.base.ref}</code> from{' '}
            <code className={styles.Branch}>{pr.head.ref}</code>
          </span>
          <span>• Opened {getRelativeTimeString(new Date(pr.created_at))}</span>
        </div>

        {pr.labels && pr.labels.length > 0 && (
          <div className={styles.Labels}>
            {pr.labels.map((label) => (
              <span
                key={label.id}
                className={styles.Label}
                style={{
                  backgroundColor: `#${label.color}`,
                  color: getContrastColor(label.color)
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        <div className={styles.Stats}>
          <div className={styles.StatItem}>
            <span className={styles.StatLabel}>Commits</span>
            <span className={styles.StatValue}>{pr.commits}</span>
          </div>
          <div className={styles.StatItem}>
            <span className={styles.StatLabel}>Files Changed</span>
            <span className={styles.StatValue}>{pr.changed_files}</span>
          </div>
          <div className={styles.StatItem}>
            <span className={styles.StatLabel}>Comments</span>
            <span className={styles.StatValue}>{pr.comments}</span>
          </div>
        </div>

        <div className={styles.Body}>
          {pr.body ? (
            <div className={styles.MarkdownContent}>{pr.body}</div>
          ) : (
            <p className={styles.NoDescription}>No description provided.</p>
          )}
        </div>

        {isMerged && pr.merged_at && (
          <div className={styles.MergeInfo}>
            <span className={styles.MergeIcon}>🟣</span>
            <span>Merged {getRelativeTimeString(new Date(pr.merged_at))}</span>
          </div>
        )}

        {isDraft && (
          <div className={styles.DraftInfo}>
            <span className={styles.DraftIcon}>📝</span>
            <span>This pull request is still a work in progress</span>
          </div>
        )}

        {isClosed && (
          <div className={styles.ClosedInfo}>
            <span className={styles.ClosedIcon}>🔴</span>
            <span>This pull request was closed without merging</span>
          </div>
        )}

        <div className={styles.Footer}>
          <a
            href={pr.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ViewOnGitHub}
            onClick={(e) => e.stopPropagation()}
          >
            View on GitHub →
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Get PR status
 */
function getStatus(pr: GitHubPullRequest): string {
  if (pr.draft) return 'draft';
  if (pr.merged_at) return 'merged';
  if (pr.state === 'closed') return 'closed';
  return 'open';
}

/**
 * Get status icon
 */
function getStatusIcon(pr: GitHubPullRequest): string {
  if (pr.draft) return '📝';
  if (pr.merged_at) return '🟣';
  if (pr.state === 'closed') return '🔴';
  return '🟢';
}

/**
 * Get status text
 */
function getStatusText(pr: GitHubPullRequest): string {
  if (pr.draft) return 'Draft';
  if (pr.merged_at) return 'Merged';
  if (pr.state === 'closed') return 'Closed';
  return 'Open';
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 */
function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  } else if (diffDay < 30) {
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Get contrasting text color (black or white) for a background color
 */
function getContrastColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}
