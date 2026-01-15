/**
 * useIssues Hook
 *
 * Fetches and manages GitHub issues for a repository.
 * Handles pagination, filtering, and real-time updates.
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import { useState, useEffect, useCallback } from 'react';

import { GitHubClient } from '../../../../services/github';
import type { GitHubIssue, GitHubIssueFilters } from '../../../../services/github/GitHubTypes';

interface UseIssuesOptions {
  owner: string | null;
  repo: string | null;
  filters?: GitHubIssueFilters;
  enabled?: boolean;
}

interface UseIssuesResult {
  issues: GitHubIssue[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  loadingMore: boolean;
}

const DEFAULT_PER_PAGE = 30;

/**
 * Hook to fetch and manage GitHub issues
 */
export function useIssues({ owner, repo, filters = {}, enabled = true }: UseIssuesOptions): UseIssuesResult {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const client = GitHubClient.instance;

  const fetchIssues = useCallback(
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

        const response = await client.listIssues(owner, repo, {
          ...filters,
          per_page: DEFAULT_PER_PAGE,
          page: pageNum
        });

        const newIssues = response.data;

        if (append) {
          setIssues((prev) => [...prev, ...newIssues]);
        } else {
          setIssues(newIssues);
        }

        // Check if there are more issues to load
        setHasMore(newIssues.length === DEFAULT_PER_PAGE);
        setPage(pageNum);
      } catch (err) {
        console.error('Failed to fetch issues:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch issues'));
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [owner, repo, enabled, filters, client]
  );

  const refetch = useCallback(async () => {
    setPage(1);
    setHasMore(true);
    await fetchIssues(1, false);
  }, [fetchIssues]);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await fetchIssues(page + 1, true);
    }
  }, [fetchIssues, page, hasMore, loadingMore]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [owner, repo, filters, enabled]);

  // Listen for cache invalidation events
  useEventListener(client, 'rate-limit-updated', () => {
    // Could show a notification about rate limits
  });

  return {
    issues,
    loading,
    error,
    refetch,
    hasMore,
    loadMore,
    loadingMore
  };
}
