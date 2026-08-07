/**
 * useGitHubRepository Hook
 *
 * Extracts GitHub repository information from the Git remote URL.
 * Returns owner, repo name, connection status, and detailed git state.
 */

import { useState, useEffect, useCallback } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { useVersionControlContext } from '../context';

/**
 * Possible states for a project's git connection
 */
export type ProjectGitState =
  | 'loading' // Still determining state
  | 'no-git' // No .git folder
  | 'git-no-remote' // Has .git but no origin remote
  | 'remote-not-github' // Has remote but not github.com
  | 'github-connected'; // Connected to GitHub

export interface GitHubRepoInfo {
  /** GitHub repository owner/organization */
  owner: string | null;
  /** GitHub repository name */
  repo: string | null;
  /** Whether the remote is GitHub */
  isGitHub: boolean;
  /** Whether we have all info needed (owner + repo) */
  isReady: boolean;
  /** Detailed state of the git connection */
  gitState: ProjectGitState;
  /** Remote URL if available */
  remoteUrl: string | null;
  /** Git provider (github, noodl, unknown, none) */
  provider: string | null;
}

/**
 * Parse GitHub owner and repo from a remote URL
 * Handles formats:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - https://github.com/owner/repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  if (!url || !url.includes('github.com')) {
    return null;
  }

  // Remove .git suffix if present
  const cleanUrl = url.replace(/\.git$/, '');

  // Handle HTTPS format: https://github.com/owner/repo
  const httpsMatch = cleanUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }

  // Handle SSH format: git@github.com:owner/repo
  const sshMatch = cleanUrl.match(/github\.com:([^/]+)\/([^/]+)/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2]
    };
  }

  return null;
}

const initialState: GitHubRepoInfo = {
  owner: null,
  repo: null,
  isGitHub: false,
  isReady: false,
  gitState: 'loading',
  remoteUrl: null,
  provider: null
};

/**
 * Hook to get GitHub repository information from the panel's Git remote.
 *
 * ⚠️ **AIB-008: this reads the version-control panel's `Git`, it does not make
 * one.** It used to open its own repository on every fetch, which was one of the
 * seven `new Git(…)` pairs the audit found across three files where the panel
 * beside it held exactly one in context. The three in `useGitSyncStatus` went
 * with that file; this one is the context's.
 *
 * The consequence worth knowing: this hook is now only callable **inside**
 * `VersionControlProvider`, which only renders once the project is a git
 * repository. The `no-git` branch below is therefore unreachable from the merged
 * panel — the panel's own "Initialize Version Control (git)" empty state stands
 * in front of it — and it is kept because `ProjectGitState` is `ConnectToGitHub
 * View`'s input and that component still distinguishes the case.
 */
export function useGitHubRepository(): GitHubRepoInfo & { refetch: () => void } {
  const { git } = useVersionControlContext();
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo>(initialState);

  const fetchRepoInfo = useCallback(async () => {
    try {
      if (!git || !ProjectModel.instance?._retainedProjectDirectory) {
        setRepoInfo({
          ...initialState,
          gitState: 'no-git'
        });
        return;
      }

      // Check if we have a remote
      const remoteName = await git.getRemoteName();
      if (!remoteName) {
        console.log('[useGitHubRepository] No remote configured');
        setRepoInfo({
          ...initialState,
          gitState: 'git-no-remote'
        });
        return;
      }

      // Get remote URL and provider
      const remoteUrl = git.OriginUrl;
      const provider = git.Provider;

      // Check if it's a GitHub repository
      if (provider !== 'github') {
        setRepoInfo({
          owner: null,
          repo: null,
          isGitHub: false,
          isReady: false,
          gitState: 'remote-not-github',
          remoteUrl,
          provider
        });
        return;
      }

      // Parse the remote URL
      const parsed = parseGitHubUrl(remoteUrl);

      if (parsed) {
        setRepoInfo({
          owner: parsed.owner,
          repo: parsed.repo,
          isGitHub: true,
          isReady: true,
          gitState: 'github-connected',
          remoteUrl,
          provider
        });
      } else {
        setRepoInfo({
          owner: null,
          repo: null,
          isGitHub: true, // It's GitHub but couldn't parse
          isReady: false,
          gitState: 'github-connected',
          remoteUrl,
          provider
        });
      }
    } catch (error) {
      console.error('[useGitHubRepository] Unexpected error:', error);
      setRepoInfo({
        ...initialState,
        gitState: 'no-git'
      });
    }
  }, [git]);

  useEffect(() => {
    fetchRepoInfo();

    // Refetch when project changes
    const handleProjectChange = () => {
      fetchRepoInfo();
    };

    ProjectModel.instance?.on('projectOpened', handleProjectChange);
    ProjectModel.instance?.on('remoteChanged', handleProjectChange);

    return () => {
      ProjectModel.instance?.off(handleProjectChange);
    };
  }, [fetchRepoInfo]);

  return { ...repoInfo, refetch: fetchRepoInfo };
}
