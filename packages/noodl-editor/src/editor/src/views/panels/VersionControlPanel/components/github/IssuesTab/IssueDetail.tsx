/**
 * IssueDetail Component
 *
 * Slide-out panel displaying full issue details with markdown rendering
 */

import React from 'react';

import type { GitHubIssue } from '../../../../../../services/github/GitHubTypes';
import { PanelOverlay } from '../../PanelOverlay';
import styles from './IssueDetail.module.scss';

interface IssueDetailProps {
  issue: GitHubIssue;
  onClose: () => void;
}

export function IssueDetail({ issue, onClose }: IssueDetailProps) {
  return (
    // FH-010: the drawer is `position: fixed` and was rendered in-tree, so it
    // was confined to — and clipped by — the panel that opened it. `PanelOverlay`
    // portals it to the dialog layer and owns dismissal; the `stopPropagation`
    // guards that used to pair with the overlay's `onClick={onClose}` are gone
    // with it, so selecting text in the body and releasing outside the drawer no
    // longer closes it.
    <PanelOverlay backdropClassName={styles.IssueDetailOverlay} onDismiss={onClose}>
      <div className={styles.IssueDetail}>
        <div className={styles.Header}>
          <div className={styles.TitleSection}>
            <h2 className={styles.Title}>
              #{issue.number} {issue.title}
            </h2>
            <div className={styles.StatusBadge} data-state={issue.state}>
              {issue.state === 'open' ? '🟢' : '🔴'} {issue.state}
            </div>
          </div>

          <button className={styles.CloseButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.Meta}>
          <span>
            <strong>{issue.user.login}</strong> opened this issue {getRelativeTimeString(new Date(issue.created_at))}
          </span>
          {issue.comments > 0 && <span>• {issue.comments} comments</span>}
        </div>

        {issue.labels && issue.labels.length > 0 && (
          <div className={styles.Labels}>
            {issue.labels.map((label) => (
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

        <div className={styles.Body}>
          {issue.body ? (
            <div className={styles.MarkdownContent}>{issue.body}</div>
          ) : (
            <p className={styles.NoDescription}>No description provided.</p>
          )}
        </div>

        <div className={styles.Footer}>
          <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className={styles.ViewOnGitHub}>
            View on GitHub →
          </a>
        </div>
      </div>
    </PanelOverlay>
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
