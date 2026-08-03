/**
 * IssuesList Component
 *
 * Displays a list of GitHub issues with loading states and pagination
 */

import React, { useState } from 'react';

import type { GitHubIssue } from '../../../../../../services/github/GitHubTypes';
import { IssueDetail } from './IssueDetail';
import { IssueItem } from './IssueItem';
import styles from './IssuesList.module.scss';

interface IssuesListProps {
  issues: GitHubIssue[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
  onRefresh: () => Promise<void>;
}

export function IssuesList({ issues, loading, error, hasMore, loadMore, loadingMore, onRefresh }: IssuesListProps) {
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);

  if (loading) {
    return (
      <div className={styles.LoadingState}>
        <div className={styles.Spinner} />
        <p>Loading issues...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.ErrorState}>
        <div className={styles.ErrorIcon}>⚠️</div>
        <h3>Failed to load issues</h3>
        <p>{error.message}</p>
        <button className={styles.RetryButton} onClick={onRefresh}>
          Try Again
        </button>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className={styles.EmptyState}>
        <div className={styles.EmptyIcon}>📝</div>
        <h3>No issues found</h3>
        <p>This repository doesn't have any issues yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.IssuesList}>
        {issues.map((issue) => (
          <IssueItem key={issue.id} issue={issue} onClick={setSelectedIssue} />
        ))}

        {hasMore && (
          <button className={styles.LoadMoreButton} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <div className={styles.SmallSpinner} />
                Loading more...
              </>
            ) : (
              'Load More'
            )}
          </button>
        )}

        {!hasMore && issues.length > 0 && <div className={styles.EndMessage}>No more issues to load</div>}
      </div>

      {selectedIssue && <IssueDetail issue={selectedIssue} onClose={() => setSelectedIssue(null)} />}
    </>
  );
}
