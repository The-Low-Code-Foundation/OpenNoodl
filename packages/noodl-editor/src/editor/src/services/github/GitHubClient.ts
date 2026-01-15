/**
 * GitHubClient
 *
 * High-level GitHub REST API client with rate limiting, caching, and error handling.
 * Built on top of GitHubOAuthService for authentication.
 *
 * @module noodl-editor/services/github
 */

import { Octokit } from '@octokit/rest';

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { GitHubOAuthService } from '../GitHubOAuthService';
import type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
  GitHubComment,
  GitHubCommit,
  GitHubLabel,
  GitHubRateLimit,
  GitHubApiResponse,
  GitHubIssueFilters,
  CreateIssueOptions,
  UpdateIssueOptions,
  GitHubApiError
} from './GitHubTypes';

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag?: string;
}

/**
 * Rate limit warning threshold (percentage)
 */
const RATE_LIMIT_WARNING_THRESHOLD = 0.1; // Warn at 10% remaining

/**
 * Default cache TTL in milliseconds
 */
const DEFAULT_CACHE_TTL = 30000; // 30 seconds

/**
 * Maximum cache size (number of entries)
 */
const MAX_CACHE_SIZE = 100;

/**
 * GitHub API client with rate limiting, caching, and error handling
 */
export class GitHubClient extends EventDispatcher {
  private static _instance: GitHubClient;
  private octokit: Octokit | null = null;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private rateLimit: GitHubRateLimit | null = null;
  private authService: GitHubOAuthService;

  private constructor() {
    super();
    this.authService = GitHubOAuthService.instance;

    // Listen for auth changes
    this.authService.on('auth-state-changed', this.handleAuthChange.bind(this), this);
    this.authService.on('disconnected', this.handleDisconnect.bind(this), this);

    // Initialize if already authenticated
    if (this.authService.isAuthenticated()) {
      this.initializeOctokit();
    }
  }

  static get instance(): GitHubClient {
    if (!GitHubClient._instance) {
      GitHubClient._instance = new GitHubClient();
    }
    return GitHubClient._instance;
  }

  /**
   * Handle authentication state changes
   */
  private handleAuthChange(event: { authenticated: boolean }): void {
    if (event.authenticated) {
      this.initializeOctokit();
    } else {
      this.octokit = null;
      this.clearCache();
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.octokit = null;
    this.clearCache();
    this.rateLimit = null;
  }

  /**
   * Initialize Octokit with current auth token
   */
  private async initializeOctokit(): Promise<void> {
    const token = await this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    this.octokit = new Octokit({
      auth: token,
      userAgent: 'OpenNoodl/1.1.0'
    });

    // Fetch initial rate limit info
    await this.updateRateLimit();
  }

  /**
   * Ensure client is authenticated and initialized
   */
  private async ensureAuthenticated(): Promise<Octokit> {
    if (!this.octokit) {
      await this.initializeOctokit();
    }

    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    return this.octokit;
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitFromHeaders(headers: Record<string, string>): void {
    if (headers['x-ratelimit-limit']) {
      this.rateLimit = {
        limit: parseInt(headers['x-ratelimit-limit'], 10),
        remaining: parseInt(headers['x-ratelimit-remaining'], 10),
        reset: parseInt(headers['x-ratelimit-reset'], 10),
        used: parseInt(headers['x-ratelimit-used'] || '0', 10)
      };

      // Emit warning if approaching limit
      if (this.rateLimit.remaining / this.rateLimit.limit < RATE_LIMIT_WARNING_THRESHOLD) {
        this.notifyListeners('rate-limit-warning', { rateLimit: this.rateLimit });
      }

      // Emit event with current rate limit
      this.notifyListeners('rate-limit-updated', { rateLimit: this.rateLimit });
    }
  }

  /**
   * Fetch current rate limit status
   */
  async updateRateLimit(): Promise<GitHubRateLimit> {
    const octokit = await this.ensureAuthenticated();
    const response = await octokit.rateLimit.get();

    this.rateLimit = {
      limit: response.data.rate.limit,
      remaining: response.data.rate.remaining,
      reset: response.data.rate.reset,
      used: response.data.rate.used
    };

    return this.rateLimit;
  }

  /**
   * Get current rate limit info (cached)
   */
  getRateLimit(): GitHubRateLimit | null {
    return this.rateLimit;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(method: string, params: unknown): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string, ttl: number = DEFAULT_CACHE_TTL): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache
   */
  private setCache<T>(key: string, data: T, etag?: string): void {
    // Implement simple LRU by removing oldest entries when cache is full
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Handle API errors with user-friendly messages
   */
  private handleApiError(error: unknown): never {
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; response?: { data?: GitHubApiError } };

      switch (apiError.status) {
        case 401:
          throw new Error('Authentication failed. Please reconnect your GitHub account.');
        case 403:
          if (apiError.response?.data?.message?.includes('rate limit')) {
            const resetTime = this.rateLimit ? new Date(this.rateLimit.reset * 1000) : new Date();
            throw new Error(`Rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}`);
          }
          throw new Error('Access forbidden. Check repository permissions.');
        case 404:
          throw new Error('Repository or resource not found.');
        case 422: {
          const message = apiError.response?.data?.message || 'Validation failed';
          throw new Error(`Invalid request: ${message}`);
        }
        default:
          throw new Error(`GitHub API error: ${apiError.response?.data?.message || 'Unknown error'}`);
      }
    }

    throw error;
  }

  // ==================== REPOSITORY METHODS ====================

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubApiResponse<GitHubRepository>> {
    const cacheKey = this.getCacheKey('getRepository', { owner, repo });
    const cached = this.getFromCache<GitHubRepository>(cacheKey, 60000); // 1 minute cache

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.repos.get({ owner, repo });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubRepository,
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * List user repositories
   */
  async listRepositories(options?: {
    type?: 'all' | 'owner' | 'public' | 'private' | 'member';
    sort?: 'created' | 'updated' | 'pushed' | 'full_name';
    direction?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
  }): Promise<GitHubApiResponse<GitHubRepository[]>> {
    const cacheKey = this.getCacheKey('listRepositories', options || {});
    const cached = this.getFromCache<GitHubRepository[]>(cacheKey, 60000);

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.repos.listForAuthenticatedUser(options);

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubRepository[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  // ==================== ISSUE METHODS ====================

  /**
   * List issues for a repository
   */
  async listIssues(
    owner: string,
    repo: string,
    filters?: GitHubIssueFilters
  ): Promise<GitHubApiResponse<GitHubIssue[]>> {
    const cacheKey = this.getCacheKey('listIssues', { owner, repo, ...filters });
    const cached = this.getFromCache<GitHubIssue[]>(cacheKey);

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      // Convert milestone number to string if present
      const apiFilters = filters
        ? {
            ...filters,
            milestone: filters.milestone ? String(filters.milestone) : undefined,
            labels: filters.labels?.join(',')
          }
        : {};

      const response = await octokit.issues.listForRepo({
        owner,
        repo,
        ...apiFilters
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubIssue[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Get a single issue
   */
  async getIssue(owner: string, repo: string, issue_number: number): Promise<GitHubApiResponse<GitHubIssue>> {
    const cacheKey = this.getCacheKey('getIssue', { owner, repo, issue_number });
    const cached = this.getFromCache<GitHubIssue>(cacheKey);

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.issues.get({
        owner,
        repo,
        issue_number
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubIssue,
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(owner: string, repo: string, options: CreateIssueOptions): Promise<GitHubApiResponse<GitHubIssue>> {
    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.issues.create({
        owner,
        repo,
        ...options
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);

      // Invalidate list cache
      this.clearCacheForPattern('listIssues');

      return {
        data: response.data as unknown as GitHubIssue,
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    owner: string,
    repo: string,
    issue_number: number,
    options: UpdateIssueOptions
  ): Promise<GitHubApiResponse<GitHubIssue>> {
    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.issues.update({
        owner,
        repo,
        issue_number,
        ...options
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);

      // Invalidate caches
      this.clearCacheForPattern('listIssues');
      this.clearCacheForPattern('getIssue');

      return {
        data: response.data as unknown as GitHubIssue,
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * List comments on an issue
   */
  async listIssueComments(
    owner: string,
    repo: string,
    issue_number: number
  ): Promise<GitHubApiResponse<GitHubComment[]>> {
    const cacheKey = this.getCacheKey('listIssueComments', { owner, repo, issue_number });
    const cached = this.getFromCache<GitHubComment[]>(cacheKey);

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.issues.listComments({
        owner,
        repo,
        issue_number
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubComment[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Create a comment on an issue
   */
  async createIssueComment(
    owner: string,
    repo: string,
    issue_number: number,
    body: string
  ): Promise<GitHubApiResponse<GitHubComment>> {
    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.issues.createComment({
        owner,
        repo,
        issue_number,
        body
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);

      // Invalidate comment cache
      this.clearCacheForPattern('listIssueComments');

      return {
        data: response.data as unknown as GitHubComment,
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  // ==================== PULL REQUEST METHODS ====================

  /**
   * List pull requests for a repository
   */
  async listPullRequests(
    owner: string,
    repo: string,
    filters?: Omit<GitHubIssueFilters, 'milestone'>
  ): Promise<GitHubApiResponse<GitHubPullRequest[]>> {
    const cacheKey = this.getCacheKey('listPullRequests', { owner, repo, ...filters });
    const cached = this.getFromCache<GitHubPullRequest[]>(cacheKey);

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      // Map our filters to PR-specific parameters
      const prSort = filters?.sort === 'comments' ? 'created' : filters?.sort;
      const apiFilters = filters
        ? {
            state: filters.state,
            sort: prSort,
            direction: filters.direction,
            per_page: filters.per_page,
            page: filters.page
          }
        : {};

      const response = await octokit.pulls.list({
        owner,
        repo,
        ...apiFilters
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubPullRequest[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Get a single pull request
   */
  async getPullRequest(
    owner: string,
    repo: string,
    pull_number: number
  ): Promise<GitHubApiResponse<GitHubPullRequest>> {
    const cacheKey = this.getCacheKey('getPullRequest', { owner, repo, pull_number });
    const cached = this.getFromCache<GitHubPullRequest>(cacheKey);

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.pulls.get({
        owner,
        repo,
        pull_number
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubPullRequest,
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * List commits in a pull request
   */
  async listPullRequestCommits(
    owner: string,
    repo: string,
    pull_number: number
  ): Promise<GitHubApiResponse<GitHubCommit[]>> {
    const cacheKey = this.getCacheKey('listPullRequestCommits', { owner, repo, pull_number });
    const cached = this.getFromCache<GitHubCommit[]>(cacheKey);

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.pulls.listCommits({
        owner,
        repo,
        pull_number
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubCommit[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  // ==================== LABEL METHODS ====================

  /**
   * List labels for a repository
   */
  async listLabels(owner: string, repo: string): Promise<GitHubApiResponse<GitHubLabel[]>> {
    const cacheKey = this.getCacheKey('listLabels', { owner, repo });
    const cached = this.getFromCache<GitHubLabel[]>(cacheKey, 300000); // 5 minute cache

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.issues.listLabelsForRepo({
        owner,
        repo
      });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubLabel[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      this.handleApiError(error);
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Clear cache entries matching a pattern
   */
  private clearCacheForPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if client is ready to make API calls
   */
  isReady(): boolean {
    return this.octokit !== null;
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  getTimeUntilRateLimitReset(): number {
    if (!this.rateLimit) {
      return 0;
    }

    const resetTime = this.rateLimit.reset * 1000;
    const now = Date.now();
    return Math.max(0, resetTime - now);
  }
}
