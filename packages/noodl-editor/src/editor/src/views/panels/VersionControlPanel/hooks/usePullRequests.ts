/**
 * usePullRequests Hook
 *
 * Fetches and manages GitHub pull requests for a repository.
 * Handles pagination, filtering, and real-time updates.
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import { useState, useEffect, useCallback, useRef } from 'react';

import { GitHubClient } from '../../../../services/github';
import type { GitHubPullRequest, GitHubIssueFilters } from '../../../../services/github/GitHubTypes';

interface UsePullRequestsOptions {
  owner: string | null;
  repo: string | null;
  filters?: Omit<GitHubIssueFilters, 'milestone'>;
  enabled?: boolean;
}

interface UsePullRequestsResult {
  pullRequests: GitHubPullRequest[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
}

const DEFAULT_PER_PAGE = 30;

/**
 * Hook to fetch and manage GitHub pull requests
 */
export function usePullRequests({
  owner,
  repo,
  filters = {},
  enabled = true
}: UsePullRequestsOptions): UsePullRequestsResult {
  const [pullRequests, setPullRequests] = useState<GitHubPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const client = GitHubClient.instance;

  // Use ref to store filters to avoid infinite loops
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchPullRequests = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (!owner || !repo || !enabled) {
        setLoading(false);
        return;
      }

      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError(null);
        }

        const response = await client.listPullRequests(owner, repo, {
          ...filtersRef.current,
          per_page: DEFAULT_PER_PAGE,
          page: pageNum
        });

        const newPRs = response.data;

        if (append) {
          setPullRequests((prev) => [...prev, ...newPRs]);
        } else {
          setPullRequests(newPRs);
        }

        // Check if there are more PRs to load
        setHasMore(newPRs.length === DEFAULT_PER_PAGE);
        setPage(pageNum);
      } catch (err) {
        console.error('Failed to fetch pull requests:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch pull requests'));
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [owner, repo, enabled, client]
  );

  const refetch = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    await fetchPullRequests(1, false);
  }, [fetchPullRequests]);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await fetchPullRequests(page + 1, true);
    }
  }, [fetchPullRequests, page, hasMore, loadingMore]);

  // Serialize filters to avoid infinite loops
  const filtersKey = JSON.stringify(filters);

  // Initial fetch - use serialized filters key
  useEffect(() => {
    if (owner && repo && enabled) {
      refetch();
    }
  }, [owner, repo, filtersKey, enabled, refetch]);

  // Listen for cache invalidation events
  useEventListener(client, 'rate-limit-updated', () => {
    // Could show a notification about rate limits
  });

  return {
    pullRequests,
    loading,
    error,
    refetch,
    hasMore,
    loadMore,
    loadingMore
  };
}
