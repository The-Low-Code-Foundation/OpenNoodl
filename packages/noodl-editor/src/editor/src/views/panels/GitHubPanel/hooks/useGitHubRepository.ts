/**
 * useGitHubRepository Hook
 *
 * Extracts GitHub repository information from the Git remote URL.
 * Returns owner, repo name, connection status, and detailed git state.
 */

import { useState, useEffect, useCallback } from 'react';
import { Git } from '@noodl/git';

import { ProjectModel } from '@noodl-models/projectmodel';
import { mergeProject } from '@noodl-utils/projectmerger';

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
 * Hook to get GitHub repository information from current project's Git remote
 */
export function useGitHubRepository(): GitHubRepoInfo & { refetch: () => void } {
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo>(initialState);

  const fetchRepoInfo = useCallback(async () => {
    try {
      const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;
      if (!projectDirectory) {
        setRepoInfo({
          ...initialState,
          gitState: 'no-git'
        });
        return;
      }

      // Create Git instance and try to open repository
      const git = new Git(mergeProject);

      try {
        await git.openRepository(projectDirectory);
      } catch (gitError) {
        // Not a git repository - this is expected for non-git projects
        const errorMessage = gitError instanceof Error ? gitError.message : String(gitError);
        if (errorMessage.includes('Not a git repository')) {
          console.log('[useGitHubRepository] Project is not a git repository');
        } else {
          console.warn('[useGitHubRepository] Git error:', errorMessage);
        }
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
  }, []);

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
