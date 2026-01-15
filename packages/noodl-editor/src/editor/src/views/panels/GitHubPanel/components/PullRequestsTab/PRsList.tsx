/**
 * PRsList Component
 *
 * Displays a list of GitHub pull requests with loading states and pagination
 */

import React, { useState } from 'react';

import type { GitHubPullRequest } from '../../../../../services/github/GitHubTypes';
import { PRDetail } from './PRDetail';
import { PRItem } from './PRItem';
import styles from './PRsList.module.scss';

interface PRsListProps {
  pullRequests: GitHubPullRequest[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
  onRefresh: () => Promise<void>;
}

export function PRsList({ pullRequests, loading, error, hasMore, loadMore, loadingMore, onRefresh }: PRsListProps) {
  const [selectedPR, setSelectedPR] = useState<GitHubPullRequest | null>(null);

  if (loading) {
    return (
      <div className={styles.LoadingState}>
        <div className={styles.Spinner} />
        <p>Loading pull requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.ErrorState}>
        <div className={styles.ErrorIcon}>⚠️</div>
        <h3>Failed to load pull requests</h3>
        <p>{error.message}</p>
        <button className={styles.RetryButton} onClick={onRefresh}>
          Try Again
        </button>
      </div>
    );
  }

  if (pullRequests.length === 0) {
    return (
      <div className={styles.EmptyState}>
        <div className={styles.EmptyIcon}>🔀</div>
        <h3>No pull requests found</h3>
        <p>This repository doesn&apos;t have any pull requests yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.PRsList}>
        {pullRequests.map((pr) => (
          <PRItem key={pr.id} pr={pr} onClick={setSelectedPR} />
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

        {!hasMore && pullRequests.length > 0 && <div className={styles.EndMessage}>No more pull requests to load</div>}
      </div>

      {selectedPR && <PRDetail pr={selectedPR} onClose={() => setSelectedPR(null)} />}
    </>
  );
}
