/**
 * IssueItem Component
 *
 * Displays a single GitHub issue in a card format
 */

import React from 'react';

import type { GitHubIssue } from '../../../../../services/github/GitHubTypes';
import styles from './IssueItem.module.scss';

interface IssueItemProps {
  issue: GitHubIssue;
  onClick: (issue: GitHubIssue) => void;
}

export function IssueItem({ issue, onClick }: IssueItemProps) {
  const createdDate = new Date(issue.created_at);
  const relativeTime = getRelativeTimeString(createdDate);

  return (
    <div className={styles.IssueItem} onClick={() => onClick(issue)}>
      <div className={styles.Header}>
        <div className={styles.TitleRow}>
          <span className={styles.Number}>#{issue.number}</span>
          <span className={styles.Title}>{issue.title}</span>
        </div>
        <div className={styles.StatusBadge} data-state={issue.state}>
          {issue.state === 'open' ? '🟢' : '🔴'} {issue.state}
        </div>
      </div>

      <div className={styles.Meta}>
        <span className={styles.Author}>
          Opened by {issue.user.login} {relativeTime}
        </span>
        {issue.comments > 0 && <span className={styles.Comments}>💬 {issue.comments}</span>}
      </div>

      {issue.labels && issue.labels.length > 0 && (
        <div className={styles.Labels}>
          {issue.labels.slice(0, 3).map((label) => (
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
          {issue.labels.length > 3 && <span className={styles.MoreLabels}>+{issue.labels.length - 3}</span>}
        </div>
      )}
    </div>
  );
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
