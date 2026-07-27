/**
 * GitHubPanel - GitHub Issues and Pull Requests integration
 *
 * Displays GitHub issues and PRs for the connected repository
 * with filtering, search, and detail views.
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useState, useEffect } from 'react';

import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { GitHubClient, GitHubOAuthService } from '../../../services/github';
import { ConnectToGitHubView } from './components/ConnectToGitHub';
import { IssuesList } from './components/IssuesTab/IssuesList';
import { PRsList } from './components/PullRequestsTab/PRsList';
import { SyncToolbar } from './components/SyncToolbar';
import styles from './GitHubPanel.module.scss';
import { useGitHubRepository } from './hooks/useGitHubRepository';
import { useIssues } from './hooks/useIssues';
import { usePullRequests } from './hooks/usePullRequests';

type TabType = 'issues' | 'pullRequests';

/**
 * PNL-005: the shared chrome. `GitHubPanelContent` below has six early returns
 * (initialising, loading, not connected, no remote, not GitHub, not ready) —
 * wrapping the panel here rather than at each of them is what keeps "no panel is
 * missing a header" true in every one of those states, which was not the case
 * when the panel had no title bar at all.
 */
export function GitHubPanel() {
  return (
    <BasePanel title="GitHub" isFill UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}>
      <GitHubPanelContent />
    </BasePanel>
  );
}

function GitHubPanelContent() {
  const [activeTab, setActiveTab] = useState<TabType>('issues');
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const client = GitHubClient.instance;
  const { owner, repo, isGitHub, isReady, gitState, remoteUrl, provider, refetch } = useGitHubRepository();

  // Initialize GitHubOAuthService on mount
  useEffect(() => {
    console.log('🔧 [GitHubPanel] useEffect running - initializing OAuth service');
    const initAuth = async () => {
      try {
        console.log('🔧 [GitHubPanel] Calling GitHubOAuthService.instance.initialize()...');
        await GitHubOAuthService.instance.initialize();
        const ready = client.isReady();
        console.log('🔧 [GitHubPanel] After initialize - client.isReady():', ready);
        setIsConnected(ready);
      } catch (error) {
        console.error('[GitHubPanel] Failed to initialize OAuth service:', error);
      } finally {
        setIsInitialized(true);
        console.log('🔧 [GitHubPanel] Initialization complete');
      }
    };
    initAuth();
  }, [client]);

  // Listen for auth state changes
  console.log('🎧 [GitHubPanel] Setting up useEventListener for auth-state-changed');
  useEventListener(GitHubOAuthService.instance, 'auth-state-changed', (event: { authenticated: boolean }) => {
    console.log('🔔 [GitHubPanel] AUTH STATE CHANGED EVENT RECEIVED:', event.authenticated);
    setIsConnected(event.authenticated);
  });

  const handleConnectGitHub = async () => {
    try {
      await GitHubOAuthService.instance.initiateOAuth();
    } catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error);
    }
  };

  const handleConnected = () => {
    // Refetch git state after connecting
    refetch();
  };

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className={styles.GitHubPanel}>
        <div className={styles.EmptyState}>
          <div className={styles.EmptyStateIcon}>⏳</div>
          <h3>Initializing</h3>
          <p>Checking GitHub connection...</p>
        </div>
      </div>
    );
  }

  // Loading state while determining git state
  if (gitState === 'loading') {
    return (
      <div className={styles.GitHubPanel}>
        <div className={styles.EmptyState}>
          <div className={styles.EmptyStateIcon}>⏳</div>
          <h3>Loading</h3>
          <p>Checking repository status...</p>
        </div>
      </div>
    );
  }

  // Not connected to GitHub account
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

  // Project not connected to GitHub - show connect options
  if (gitState === 'no-git' || gitState === 'git-no-remote' || gitState === 'remote-not-github') {
    return (
      <div className={styles.GitHubPanel}>
        <ConnectToGitHubView
          gitState={gitState}
          remoteUrl={remoteUrl}
          provider={provider}
          onConnected={handleConnected}
        />
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
      <SyncToolbar owner={owner} repo={repo} />

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
