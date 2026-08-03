/**
 * PRItem Component
 *
 * Displays a single GitHub pull request in a card format
 */

import React from 'react';

import type { GitHubPullRequest } from '../../../../../../services/github/GitHubTypes';
import styles from './PRItem.module.scss';

interface PRItemProps {
  pr: GitHubPullRequest;
  onClick: (pr: GitHubPullRequest) => void;
}

export function PRItem({ pr, onClick }: PRItemProps) {
  const createdDate = new Date(pr.created_at);
  const relativeTime = getRelativeTimeString(createdDate);

  return (
    <div className={styles.PRItem} onClick={() => onClick(pr)}>
      <div className={styles.Header}>
        <div className={styles.TitleRow}>
          <span className={styles.Number}>#{pr.number}</span>
          <span className={styles.Title}>{pr.title}</span>
        </div>
        <div className={styles.StatusBadge} data-status={getStatus(pr)}>
          {getStatusIcon(pr)} {getStatusText(pr)}
        </div>
      </div>

      <div className={styles.Meta}>
        <span className={styles.Author}>
          {pr.user.login} wants to merge into {pr.base.ref} from {pr.head.ref}
        </span>
        <span className={styles.Time}>{relativeTime}</span>
      </div>

      <div className={styles.Stats}>
        {pr.comments > 0 && <span className={styles.Stat}>💬 {pr.comments}</span>}
        {pr.commits > 0 && <span className={styles.Stat}>📝 {pr.commits} commits</span>}
        {pr.changed_files > 0 && <span className={styles.Stat}>📄 {pr.changed_files} files</span>}
      </div>

      {pr.labels && pr.labels.length > 0 && (
        <div className={styles.Labels}>
          {pr.labels.slice(0, 3).map((label) => (
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
          {pr.labels.length > 3 && <span className={styles.MoreLabels}>+{pr.labels.length - 3}</span>}
        </div>
      )}
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
