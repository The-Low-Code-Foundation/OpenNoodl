/**
 * SyncToolbar
 *
 * Toolbar with push/pull buttons and sync status display
 */

import React, { useState } from 'react';

import { useGitSyncStatus } from '../../hooks/useGitSyncStatus';
import styles from './SyncToolbar.module.scss';

interface SyncToolbarProps {
  owner: string;
  repo: string;
}

export function SyncToolbar({ owner, repo }: SyncToolbarProps) {
  const { ahead, behind, hasUncommittedChanges, loading, error, isSyncing, push, pull, refresh } = useGitSyncStatus();
  const [lastError, setLastError] = useState<string | null>(null);

  const handlePush = async () => {
    setLastError(null);
    try {
      await push();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Push failed');
    }
  };

  const handlePull = async () => {
    setLastError(null);
    try {
      await pull();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : 'Pull failed');
    }
  };

  const handleRefresh = () => {
    setLastError(null);
    refresh();
  };

  // Show error or status message
  const displayError = lastError || error;

  return (
    <div className={styles.SyncToolbar}>
      <div className={styles.RepoInfo}>
        <span className={styles.RepoName}>
          {owner}/{repo}
        </span>
        {loading && <span className={styles.StatusText}>Loading...</span>}
        {!loading && !displayError && (
          <span className={styles.StatusText}>
            {hasUncommittedChanges && <span className={styles.ChangesIndicator}>Uncommitted changes</span>}
            {!hasUncommittedChanges && ahead === 0 && behind === 0 && (
              <span className={styles.SyncedIndicator}>Up to date</span>
            )}
          </span>
        )}
      </div>

      <div className={styles.Actions}>
        {/* Pull button */}
        <button
          className={`${styles.SyncButton} ${behind > 0 ? styles.HasChanges : ''}`}
          onClick={handlePull}
          disabled={isSyncing || loading}
          title={behind > 0 ? `Pull ${behind} commit${behind > 1 ? 's' : ''} from remote` : 'Pull from remote'}
        >
          <DownloadIcon />
          <span>Pull</span>
          {behind > 0 && <span className={styles.Badge}>{behind}</span>}
        </button>

        {/* Push button */}
        <button
          className={`${styles.SyncButton} ${ahead > 0 || hasUncommittedChanges ? styles.HasChanges : ''}`}
          onClick={handlePush}
          disabled={isSyncing || loading || (ahead === 0 && !hasUncommittedChanges)}
          title={
            hasUncommittedChanges
              ? 'Commit and push changes'
              : ahead > 0
              ? `Push ${ahead} commit${ahead > 1 ? 's' : ''} to remote`
              : 'Nothing to push'
          }
        >
          <UploadIcon />
          <span>Push</span>
          {(ahead > 0 || hasUncommittedChanges) && (
            <span className={styles.Badge}>{hasUncommittedChanges ? '!' : ahead}</span>
          )}
        </button>

        {/* Refresh button */}
        <button
          className={styles.RefreshButton}
          onClick={handleRefresh}
          disabled={isSyncing || loading}
          title="Refresh sync status"
        >
          <RefreshIcon spinning={loading || isSyncing} />
        </button>
      </div>

      {displayError && (
        <div className={styles.ErrorBar}>
          <span>{displayError}</span>
          <button onClick={() => setLastError(null)}>&times;</button>
        </div>
      )}
    </div>
  );
}

// Icon components
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 12L3 7l1.4-1.4L7 8.2V1h2v7.2l2.6-2.6L13 7l-5 5z" />
      <path d="M14 13v1H2v-1h12z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1l5 5-1.4 1.4L9 4.8V12H7V4.8L4.4 7.4 3 6l5-5z" />
      <path d="M14 13v1H2v-1h12z" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={spinning ? styles.Spinning : undefined}
    >
      <path d="M13.5 8c0-3-2.5-5.5-5.5-5.5S2.5 5 2.5 8H1C1 4.1 4.1 1 8 1s7 3.1 7 7h-1.5z" />
      <path d="M2.5 8c0 3 2.5 5.5 5.5 5.5s5.5-2.5 5.5-5.5H15c0 3.9-3.1 7-7 7s-7-3.1-7-7h1.5z" />
    </svg>
  );
}
