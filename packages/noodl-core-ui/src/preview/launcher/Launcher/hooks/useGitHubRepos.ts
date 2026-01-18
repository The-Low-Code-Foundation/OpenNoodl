/**
 * useGitHubRepos Hook
 *
 * Fetches and manages GitHub repositories for the authenticated user,
 * including personal repos and organization repos.
 * Detects Noodl projects by checking for project.json or nodegx.project.json.
 *
 * @module noodl-core-ui/preview/launcher/Launcher/hooks
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ==================== LOCAL TYPE DEFINITIONS ====================
// These mirror the GitHub types but are defined locally to avoid circular dependencies

/**
 * GitHub User/Owner
 */
export interface GitHubOwner {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}

/**
 * GitHub Repository (minimal fields needed for clone UI)
 */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubOwner;
  private: boolean;
  html_url: string;
  description: string | null;
  clone_url?: string;
  ssh_url?: string;
  updated_at: string;
  pushed_at: string;
  default_branch: string;
  stargazers_count: number;
  language: string | null;
}

/**
 * GitHub Organization
 */
export interface GitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
}

// ==================== HOOK TYPES ====================

/**
 * Extended repo info with Noodl detection status
 */
export interface NoodlGitHubRepo extends GitHubRepo {
  /** Whether this repo is a Noodl project */
  isNoodlProject: boolean | null; // null = not yet checked
  /** Whether Noodl detection is in progress */
  isCheckingNoodl: boolean;
  /** Source: 'personal' or org name */
  source: string;
}

/**
 * Organization with its repos
 */
export interface GitHubOrgWithRepos extends GitHubOrg {
  repos: NoodlGitHubRepo[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook return type
 */
export interface UseGitHubReposReturn {
  /** All Noodl project repos (filtered) */
  noodlProjects: NoodlGitHubRepo[];
  /** All repos (unfiltered) */
  allRepos: NoodlGitHubRepo[];
  /** User's organizations */
  organizations: GitHubOrgWithRepos[];
  /** Personal repos */
  personalRepos: NoodlGitHubRepo[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh all data */
  refresh: () => Promise<void>;
  /** Check if a specific repo is a Noodl project */
  checkIfNoodlProject: (owner: string, repo: string) => Promise<boolean>;
}

/**
 * GitHub API client interface (injected to avoid circular dependencies)
 */
export interface GitHubClientInterface {
  listRepositories: (options?: { per_page?: number; sort?: string }) => Promise<{ data: GitHubRepo[] }>;
  listOrganizations: () => Promise<{ data: GitHubOrg[] }>;
  listOrganizationRepositories: (org: string, options?: { per_page?: number }) => Promise<{ data: GitHubRepo[] }>;
  isNoodlProject: (owner: string, repo: string) => Promise<boolean>;
}

/**
 * Hook to fetch GitHub repositories and detect Noodl projects
 *
 * @param client - GitHub client instance
 * @param isAuthenticated - Whether user is authenticated with GitHub
 */
export function useGitHubRepos(client: GitHubClientInterface | null, isAuthenticated: boolean): UseGitHubReposReturn {
  const [personalRepos, setPersonalRepos] = useState<NoodlGitHubRepo[]>([]);
  const [organizations, setOrganizations] = useState<GitHubOrgWithRepos[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track ongoing Noodl checks to avoid duplicates
  const noodlCheckQueue = useRef<Map<string, Promise<boolean>>>(new Map());

  /**
   * Check if a repo is a Noodl project (with deduplication)
   */
  const checkIfNoodlProject = useCallback(
    async (owner: string, repo: string): Promise<boolean> => {
      if (!client) return false;

      const key = `${owner}/${repo}`;

      // Return existing promise if already checking
      if (noodlCheckQueue.current.has(key)) {
        return noodlCheckQueue.current.get(key)!;
      }

      // Start new check
      const checkPromise = client.isNoodlProject(owner, repo);
      noodlCheckQueue.current.set(key, checkPromise);

      try {
        const result = await checkPromise;
        return result;
      } finally {
        noodlCheckQueue.current.delete(key);
      }
    },
    [client]
  );

  /**
   * Map GitHubRepo to NoodlGitHubRepo
   */
  const mapRepo = useCallback((repo: GitHubRepo, source: string): NoodlGitHubRepo => {
    return {
      ...repo,
      isNoodlProject: null,
      isCheckingNoodl: false,
      source
    };
  }, []);

  /**
   * Check Noodl status for a batch of repos (rate-limit friendly)
   */
  const checkNoodlStatusForRepos = useCallback(
    async (repos: NoodlGitHubRepo[], updateFn: (repoId: number, isNoodl: boolean) => void) => {
      console.log('🔍 [checkNoodlStatusForRepos] Starting check for', repos.length, 'repos');

      // Check repos sequentially to avoid rate limits
      for (const repo of repos) {
        if (repo.isNoodlProject !== null) continue; // Already checked

        try {
          const isNoodl = await checkIfNoodlProject(repo.owner.login, repo.name);

          console.log('🔍 [checkNoodlStatusForRepos]', repo.full_name, '- isNoodl:', isNoodl);

          updateFn(repo.id, isNoodl);

          // Small delay between checks to be rate-limit friendly
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (err) {
          // On error, mark as not a Noodl project
          console.error('❌ [checkNoodlStatusForRepos] Error checking', repo.full_name, err);
          updateFn(repo.id, false);
        }
      }

      console.log('✅ [checkNoodlStatusForRepos] Finished checking repos');
    },
    [checkIfNoodlProject]
  );

  /**
   * Fetch all repos (personal + org)
   */
  const fetchRepos = useCallback(async () => {
    console.log('🔍 [useGitHubRepos] fetchRepos called', {
      hasClient: !!client,
      isAuthenticated
    });

    if (!client || !isAuthenticated) {
      console.log('🔍 [useGitHubRepos] Skipping fetch - not authenticated or no client');
      setPersonalRepos([]);
      setOrganizations([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 [useGitHubRepos] Fetching personal repos and orgs...');

      // Fetch personal repos and orgs in parallel
      const [reposResponse, orgsResponse] = await Promise.all([
        client.listRepositories({ per_page: 100, sort: 'updated' }),
        client.listOrganizations()
      ]);

      console.log('🔍 [useGitHubRepos] API responses:', {
        personalRepoCount: reposResponse?.data?.length || 0,
        orgCount: orgsResponse?.data?.length || 0
      });

      // Map personal repos
      const mappedPersonalRepos = reposResponse.data.map((r) => mapRepo(r, 'personal'));
      setPersonalRepos(mappedPersonalRepos);

      // Initialize orgs (repos will be loaded on-demand or in parallel)
      const mappedOrgs: GitHubOrgWithRepos[] = orgsResponse.data.map((org) => ({
        ...org,
        repos: [],
        isLoading: true,
        error: null
      }));
      setOrganizations(mappedOrgs);

      // Fetch org repos in parallel
      const orgRepoPromises = orgsResponse.data.map(async (org) => {
        try {
          const orgRepos = await client.listOrganizationRepositories(org.login, { per_page: 100 });
          return {
            orgLogin: org.login,
            repos: orgRepos.data.map((r) => mapRepo(r, org.login)),
            error: null
          };
        } catch (err) {
          return {
            orgLogin: org.login,
            repos: [],
            error: err instanceof Error ? err.message : 'Failed to load repos'
          };
        }
      });

      const orgResults = await Promise.all(orgRepoPromises);

      // Update orgs with their repos
      setOrganizations((prev) =>
        prev.map((org) => {
          const result = orgResults.find((r) => r.orgLogin === org.login);
          if (result) {
            return {
              ...org,
              repos: result.repos,
              isLoading: false,
              error: result.error
            };
          }
          return { ...org, isLoading: false };
        })
      );

      // Start checking Noodl status for personal repos
      const updatePersonalRepo = (repoId: number, isNoodl: boolean) => {
        setPersonalRepos((prev) =>
          prev.map((r) => (r.id === repoId ? { ...r, isNoodlProject: isNoodl, isCheckingNoodl: false } : r))
        );
      };

      // Check personal repos
      checkNoodlStatusForRepos(mappedPersonalRepos, updatePersonalRepo);

      // Check org repos
      for (const result of orgResults) {
        const updateOrgRepo = (repoId: number, isNoodl: boolean) => {
          setOrganizations((prev) =>
            prev.map((org) => {
              if (org.login === result.orgLogin) {
                return {
                  ...org,
                  repos: org.repos.map((r) =>
                    r.id === repoId ? { ...r, isNoodlProject: isNoodl, isCheckingNoodl: false } : r
                  )
                };
              }
              return org;
            })
          );
        };
        checkNoodlStatusForRepos(result.repos, updateOrgRepo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setIsLoading(false);
    }
  }, [client, isAuthenticated, mapRepo, checkNoodlStatusForRepos]);

  // Fetch on mount and when auth changes
  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  // Compute derived values
  const allRepos: NoodlGitHubRepo[] = [...personalRepos, ...organizations.flatMap((org) => org.repos)];

  const noodlProjects = allRepos.filter((repo) => repo.isNoodlProject === true);

  return {
    noodlProjects,
    allRepos,
    organizations,
    personalRepos,
    isLoading,
    error,
    refresh: fetchRepos,
    checkIfNoodlProject
  };
}
