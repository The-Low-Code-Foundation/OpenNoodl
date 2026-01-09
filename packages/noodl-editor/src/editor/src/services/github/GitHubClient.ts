/**
 * GitHubClient
 *
 * Wrapper around Octokit REST API client with authentication and rate limiting.
 * Provides convenient methods for GitHub API operations needed by OpenNoodl.
 *
 * @module services/github
 * @since 1.1.0
 */

import { Octokit } from '@octokit/rest';

import { GitHubAuth } from './GitHubAuth';
import type { GitHubRepository, GitHubRateLimit, GitHubUser } from './GitHubTypes';

/**
 * GitHubClient
 *
 * Main client for GitHub API interactions.
 * Automatically uses authenticated token from GitHubAuth.
 * Handles rate limiting and provides typed API methods.
 */
export class GitHubClient {
  private octokit: Octokit | null = null;
  private lastRateLimit: GitHubRateLimit | null = null;

  /**
   * Initialize Octokit instance with current auth token
   *
   * @returns Octokit instance or null if not authenticated
   */
  private getOctokit(): Octokit | null {
    const token = GitHubAuth.getAccessToken();
    if (!token) {
      console.warn('[GitHub Client] Not authenticated');
      return null;
    }

    // Create new instance if token changed or doesn't exist
    if (!this.octokit) {
      this.octokit = new Octokit({
        auth: token,
        userAgent: 'OpenNoodl/1.1.0'
      });
    }

    return this.octokit;
  }

  /**
   * Check if client is ready (authenticated)
   *
   * @returns True if client has valid auth token
   */
  isReady(): boolean {
    return GitHubAuth.isAuthenticated();
  }

  /**
   * Get current rate limit status
   *
   * @returns Rate limit information
   * @throws {Error} If not authenticated
   */
  async getRateLimit(): Promise<GitHubRateLimit> {
    const octokit = this.getOctokit();
    if (!octokit) {
      throw new Error('Not authenticated with GitHub');
    }

    const response = await octokit.rateLimit.get();
    const core = response.data.resources.core;

    const rateLimit: GitHubRateLimit = {
      limit: core.limit,
      remaining: core.remaining,
      reset: core.reset,
      resource: 'core'
    };

    this.lastRateLimit = rateLimit;
    return rateLimit;
  }

  /**
   * Check if we're approaching rate limit
   *
   * @returns True if remaining requests < 100
   */
  isApproachingRateLimit(): boolean {
    if (!this.lastRateLimit) {
      return false;
    }
    return this.lastRateLimit.remaining < 100;
  }

  /**
   * Get authenticated user's information
   *
   * @returns User information
   * @throws {Error} If not authenticated or API call fails
   */
  async getAuthenticatedUser(): Promise<GitHubUser> {
    const octokit = this.getOctokit();
    if (!octokit) {
      throw new Error('Not authenticated with GitHub');
    }

    const response = await octokit.users.getAuthenticated();
    return response.data as GitHubUser;
  }

  /**
   * Get repository information
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository information
   * @throws {Error} If repository not found or API call fails
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const octokit = this.getOctokit();
    if (!octokit) {
      throw new Error('Not authenticated with GitHub');
    }

    const response = await octokit.repos.get({ owner, repo });
    return response.data as GitHubRepository;
  }

  /**
   * List user's repositories
   *
   * @param options - Listing options
   * @returns Array of repositories
   * @throws {Error} If not authenticated or API call fails
   */
  async listRepositories(options?: {
    visibility?: 'all' | 'public' | 'private';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    per_page?: number;
  }): Promise<GitHubRepository[]> {
    const octokit = this.getOctokit();
    if (!octokit) {
      throw new Error('Not authenticated with GitHub');
    }

    const response = await octokit.repos.listForAuthenticatedUser({
      visibility: options?.visibility || 'all',
      sort: options?.sort || 'updated',
      per_page: options?.per_page || 30
    });

    return response.data as GitHubRepository[];
  }

  /**
   * Check if a repository exists and user has access
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns True if repository exists and accessible
   */
  async repositoryExists(owner: string, repo: string): Promise<boolean> {
    try {
      await this.getRepository(owner, repo);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse repository URL to owner/repo
   *
   * Handles various GitHub URL formats:
   * - https://github.com/owner/repo
   * - git@github.com:owner/repo.git
   * - https://github.com/owner/repo.git
   *
   * @param url - GitHub repository URL
   * @returns Object with owner and repo, or null if invalid
   */
  static parseRepoUrl(url: string): { owner: string; repo: string } | null {
    try {
      // Remove .git suffix if present
      const cleanUrl = url.replace(/\.git$/, '');

      // Handle SSH format: git@github.com:owner/repo
      if (cleanUrl.includes('git@github.com:')) {
        const parts = cleanUrl.split('git@github.com:')[1].split('/');
        if (parts.length >= 2) {
          return {
            owner: parts[0],
            repo: parts[1]
          };
        }
      }

      // Handle HTTPS format: https://github.com/owner/repo
      if (cleanUrl.includes('github.com/')) {
        const parts = cleanUrl.split('github.com/')[1].split('/');
        if (parts.length >= 2) {
          return {
            owner: parts[0],
            repo: parts[1]
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[GitHub Client] Error parsing repo URL:', error);
      return null;
    }
  }

  /**
   * Get repository from local Git remote URL
   *
   * Useful for getting GitHub repo info from current project's git remote.
   *
   * @param remoteUrl - Git remote URL
   * @returns Repository information if GitHub repo, null otherwise
   */
  async getRepositoryFromRemoteUrl(remoteUrl: string): Promise<GitHubRepository | null> {
    const parsed = GitHubClient.parseRepoUrl(remoteUrl);
    if (!parsed) {
      return null;
    }

    try {
      return await this.getRepository(parsed.owner, parsed.repo);
    } catch (error) {
      console.error('[GitHub Client] Error fetching repository:', error);
      return null;
    }
  }

  /**
   * Reset client state
   *
   * Call this when user disconnects or token changes.
   */
  reset(): void {
    this.octokit = null;
    this.lastRateLimit = null;
  }
}

/**
 * Singleton instance of GitHubClient
 * Use this for all GitHub API operations
 */
export const githubClient = new GitHubClient();
