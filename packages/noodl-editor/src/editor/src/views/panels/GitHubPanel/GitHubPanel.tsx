/**
 * GitHubPanel - GitHub Issues and Pull Requests integration
 *
 * Displays GitHub issues and PRs for the connected repository
 * with filtering, search, and detail views.
 */

import React, { useState } from 'react';

import { GitHubClient, GitHubOAuthService } from '../../../services/github';
import { IssuesList } from './components/IssuesTab/IssuesList';
import { PRsList } from './components/PullRequestsTab/PRsList';
import styles from './GitHubPanel.module.scss';
import { useGitHubRepository } from './hooks/useGitHubRepository';
import { useIssues } from './hooks/useIssues';
import { usePullRequests } from './hooks/usePullRequests';

type TabType = 'issues' | 'pullRequests';

export function GitHubPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('issues');
  const client = GitHubClient.instance;
  const { owner, repo, isGitHub, isReady } = useGitHubRepository();

  // Check if GitHub is connected
  const isConnected = client.isReady();

  const handleConnectGitHub = async () => {
    try {
      await GitHubOAuthService.instance.initiateOAuth();
    } catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className={styles.GitHubPanel}>
        <div className={styles.EmptyState}>
          <div className={styles.EmptyStateIcon}>🔗</div>
          <h3>Connect GitHub</h3>
          <p>Connect your GitHub account to view and manage issues and pull requests.</p>
          <button className={styles.ConnectButton} onClick={handleConnectGitHub}>
            Connect GitHub Account
          </button>
        </div>
      </div>
    );
  }

  if (!isGitHub) {
    return (
      <div className={styles.GitHubPanel}>
        <div className={styles.EmptyState}>
          <div className={styles.EmptyStateIcon}>📦</div>
          <h3>Not a GitHub Repository</h3>
          <p>This project is not connected to a GitHub repository.</p>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={styles.GitHubPanel}>
        <div className={styles.EmptyState}>
          <div className={styles.EmptyStateIcon}>⚙️</div>
          <h3>Loading Repository</h3>
          <p>Loading repository information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.GitHubPanel}>
      <div className={styles.Header}>
        <div className={styles.Tabs}>
          <button
            className={`${styles.Tab} ${activeTab === 'issues' ? styles.TabActive : ''}`}
            onClick={() => setActiveTab('issues')}
          >
            Issues
          </button>
          <button
            className={`${styles.Tab} ${activeTab === 'pullRequests' ? styles.TabActive : ''}`}
            onClick={() => setActiveTab('pullRequests')}
          >
            Pull Requests
          </button>
        </div>
      </div>

      <div className={styles.Content}>
        {activeTab === 'issues' && <IssuesTab owner={owner} repo={repo} />}
        {activeTab === 'pullRequests' && <PullRequestsTab owner={owner} repo={repo} />}
      </div>
    </div>
  );
}

/**
 * Issues tab content
 */
function IssuesTab({ owner, repo }: { owner: string; repo: string }) {
  const { issues, loading, error, hasMore, loadMore, loadingMore, refetch } = useIssues({
    owner,
    repo,
    filters: { state: 'open' }
  });

  return (
    <div className={styles.IssuesTab}>
      <IssuesList
        issues={issues}
        loading={loading}
        error={error}
        hasMore={hasMore}
        loadMore={loadMore}
        loadingMore={loadingMore}
        onRefresh={refetch}
      />
    </div>
  );
}

/**
 * Pull Requests tab content
 */
function PullRequestsTab({ owner, repo }: { owner: string; repo: string }) {
  const { pullRequests, loading, error, hasMore, loadMore, loadingMore, refetch } = usePullRequests({
    owner,
    repo,
    filters: { state: 'open' }
  });

  return (
    <div className={styles.PullRequestsTab}>
      <PRsList
        pullRequests={pullRequests}
        loading={loading}
        error={error}
        hasMore={hasMore}
        loadMore={loadMore}
        loadingMore={loadingMore}
        onRefresh={refetch}
      />
    </div>
  );
}
