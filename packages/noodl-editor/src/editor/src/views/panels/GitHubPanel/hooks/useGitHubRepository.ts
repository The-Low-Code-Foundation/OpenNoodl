/**
 * useGitHubRepository Hook
 *
 * Extracts GitHub repository information from the Git remote URL.
 * Returns owner, repo name, and connection status.
 */

import { useState, useEffect } from 'react';
import { Git } from '@noodl/git';

import { ProjectModel } from '@noodl-models/projectmodel';
import { mergeProject } from '@noodl-utils/projectmerger';

interface GitHubRepoInfo {
  owner: string | null;
  repo: string | null;
  isGitHub: boolean;
  isReady: boolean;
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

/**
 * Hook to get GitHub repository information from current project's Git remote
 */
export function useGitHubRepository(): GitHubRepoInfo {
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo>({
    owner: null,
    repo: null,
    isGitHub: false,
    isReady: false
  });

  useEffect(() => {
    async function fetchRepoInfo() {
      try {
        const projectDirectory = ProjectModel.instance?._retainedProjectDirectory;
        if (!projectDirectory) {
          setRepoInfo({
            owner: null,
            repo: null,
            isGitHub: false,
            isReady: false
          });
          return;
        }

        // Create Git instance and open repository
        const git = new Git(mergeProject);
        await git.openRepository(projectDirectory);

        // Check if it's a GitHub repository
        const provider = git.Provider;
        if (provider !== 'github') {
          setRepoInfo({
            owner: null,
            repo: null,
            isGitHub: false,
            isReady: false
          });
          return;
        }

        // Parse the remote URL
        const remoteUrl = git.OriginUrl;
        const parsed = parseGitHubUrl(remoteUrl);

        if (parsed) {
          setRepoInfo({
            owner: parsed.owner,
            repo: parsed.repo,
            isGitHub: true,
            isReady: true
          });
        } else {
          setRepoInfo({
            owner: null,
            repo: null,
            isGitHub: true, // It's GitHub but couldn't parse
            isReady: false
          });
        }
      } catch (error) {
        console.error('Failed to fetch GitHub repository info:', error);
        setRepoInfo({
          owner: null,
          repo: null,
          isGitHub: false,
          isReady: false
        });
      }
    }

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
  }, []);

  return repoInfo;
}
