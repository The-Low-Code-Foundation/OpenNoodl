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
  GitHubOrganization,
  GitHubComment,
  GitHubCommit,
  GitHubLabel,
  GitHubRateLimit,
  GitHubApiResponse,
  GitHubIssueFilters,
  CreateIssueOptions,
  UpdateIssueOptions,
  CreateRepositoryOptions,
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
   * Returns undefined if not in cache, the cached value (which could be null) if present
   */
  private getFromCache<T>(key: string, ttl: number = DEFAULT_CACHE_TTL): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return undefined; // Not in cache
    }

    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      this.cache.delete(key);
      return undefined; // Cache expired
    }

    return entry.data; // Return cached value (could be null)
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
    console.log('🔍 [GitHubClient] listRepositories called with:', options);

    const cacheKey = this.getCacheKey('listRepositories', options || {});
    const cached = this.getFromCache<GitHubRepository[]>(cacheKey, 60000);

    if (cached) {
      console.log('🔍 [GitHubClient] Returning cached repos:', cached.length);
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      console.log('🔍 [GitHubClient] Calling octokit.repos.listForAuthenticatedUser...');
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.repos.listForAuthenticatedUser(options);

      console.log('🔍 [GitHubClient] Got repos from API:', response.data?.length || 0);

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubRepository[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      console.error('❌ [GitHubClient] listRepositories error:', error);
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

  // ==================== ORGANIZATION METHODS ====================

  /**
   * List organizations for the authenticated user
   */
  async listOrganizations(): Promise<GitHubApiResponse<GitHubOrganization[]>> {
    console.log('🔍 [GitHubClient] listOrganizations called');

    const cacheKey = this.getCacheKey('listOrganizations', {});
    const cached = this.getFromCache<GitHubOrganization[]>(cacheKey, 60000); // 1 minute cache

    if (cached) {
      console.log('🔍 [GitHubClient] Returning cached orgs:', cached.length);
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      console.log('🔍 [GitHubClient] Calling octokit.orgs.listForAuthenticatedUser...');
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.orgs.listForAuthenticatedUser({
        per_page: 100
      });

      console.log('🔍 [GitHubClient] Got orgs from API:', response.data?.length || 0);

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);
      this.setCache(cacheKey, response.data);

      return {
        data: response.data as unknown as GitHubOrganization[],
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      console.error('❌ [GitHubClient] listOrganizations error:', error);
      this.handleApiError(error);
    }
  }

  /**
   * List repositories for an organization
   */
  async listOrganizationRepositories(
    org: string,
    options?: {
      type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
      sort?: 'created' | 'updated' | 'pushed' | 'full_name';
      direction?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    }
  ): Promise<GitHubApiResponse<GitHubRepository[]>> {
    const cacheKey = this.getCacheKey('listOrganizationRepositories', { org, ...options });
    const cached = this.getFromCache<GitHubRepository[]>(cacheKey, 60000); // 1 minute cache

    if (cached) {
      return { data: cached, rateLimit: this.rateLimit! };
    }

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.repos.listForOrg({
        org,
        ...options
      });

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

  /**
   * Create a new repository
   *
   * @param options - Repository creation options
   * @returns The created repository
   */
  async createRepository(options: CreateRepositoryOptions): Promise<GitHubApiResponse<GitHubRepository>> {
    console.log('🔧 [GitHubClient] createRepository called with:', options);

    try {
      const octokit = await this.ensureAuthenticated();

      let response;
      if (options.org) {
        // Create repository in organization
        console.log('🔧 [GitHubClient] Creating repo in org:', options.org);
        response = await octokit.repos.createInOrg({
          org: options.org,
          name: options.name,
          description: options.description,
          private: options.private ?? true,
          auto_init: options.auto_init ?? false,
          gitignore_template: options.gitignore_template,
          license_template: options.license_template
        });
      } else {
        // Create repository in user account
        console.log('🔧 [GitHubClient] Creating repo in user account');
        response = await octokit.repos.createForAuthenticatedUser({
          name: options.name,
          description: options.description,
          private: options.private ?? true,
          auto_init: options.auto_init ?? false,
          gitignore_template: options.gitignore_template,
          license_template: options.license_template
        });
      }

      console.log('✅ [GitHubClient] Repository created:', response.data.full_name);

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);

      // Invalidate repo list caches
      this.clearCacheForPattern('listRepositories');
      this.clearCacheForPattern('listOrganizationRepositories');

      return {
        data: response.data as unknown as GitHubRepository,
        rateLimit: this.rateLimit!
      };
    } catch (error) {
      console.error('❌ [GitHubClient] createRepository error:', error);
      this.handleApiError(error);
    }
  }

  // ==================== FILE CONTENT METHODS ====================

  /**
   * Get file content from a repository
   * @returns File content as string, or null if file doesn't exist
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    const cacheKey = this.getCacheKey('getFileContent', { owner, repo, path });
    const cached = this.getFromCache<string | null>(cacheKey, 60000); // 1 minute cache

    if (cached !== undefined) {
      console.debug('📦 [getFileContent] Cache hit for', `${owner}/${repo}/${path}`);
      return cached;
    }

    console.debug('🔍 [getFileContent] Fetching', `${owner}/${repo}/${path}`);

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path
      });

      const responseType = !Array.isArray(response.data) && 'type' in response.data ? response.data.type : 'unknown';
      console.debug('✅ [getFileContent] Got response for', `${owner}/${repo}/${path}`, responseType);

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);

      // Handle file content (not directory)
      if (!Array.isArray(response.data) && 'content' in response.data && response.data.type === 'file') {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        this.setCache(cacheKey, content);
        console.debug('✅ [getFileContent] Found file', `${owner}/${repo}/${path}`, content.substring(0, 50) + '...');
        return content;
      }

      // It's a directory or something else
      console.debug('⚠️ [getFileContent] Not a file:', `${owner}/${repo}/${path}`, responseType);
      this.setCache(cacheKey, null);
      return null;
    } catch (error) {
      const errorStatus =
        error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 'unknown';

      // 404 means file doesn't exist - cache that result.
      //
      // AIB-009 F6: a miss is the expected answer for a caller asking whether a
      // file is there, so it is logged at debug like every other step of the
      // lookup. It used to be one `❌ … Error … status: 404` per call in the
      // launch log, which is how a real error stops being visible.
      if (errorStatus === 404) {
        console.debug('· [getFileContent] Not present:', `${owner}/${repo}/${path}`);
        this.setCache(cacheKey, null);
        return null;
      }

      console.log('❌ [getFileContent] Error for', `${owner}/${repo}/${path}`, 'status:', errorStatus);

      // Log the full error for non-404 errors
      console.error('❌ [getFileContent] Full error:', error);

      // For other errors, don't cache and rethrow
      throw error;
    }
  }

  /**
   * Check if a repository is a NodeGX project — is there a `project.json` at its
   * root?
   *
   * AIB-009 F6: this used to fetch `project.json` directly, so for every repo in
   * the user's account that is *not* a NodeGX project — the overwhelming
   * majority — the answer arrived as an HTTP 404. Chromium logs a failed request
   * to the console itself, at error level, before any of our code sees it, so
   * demoting our own lines could only ever fix half of it: the launcher's log
   * still carried a `Failed to load resource: … 404 (project.json)` per repo, and
   * a launch that probes 100 repos buried everything else under 100 errors.
   *
   * Listing the root directory answers the same question with a **200 whether or
   * not the file is there**, which is the only way to stop generating the line.
   * Same one request per repo, same cache, same rate-limit cost.
   *
   * (An empty repository still 404s — there is no tree to list. That is one line
   * for a rare case rather than one line for the common one.)
   */
  async isNoodlProject(owner: string, repo: string): Promise<boolean> {
    console.debug('🔍 [GitHubClient] isNoodlProject checking:', `${owner}/${repo}`);

    const cacheKey = this.getCacheKey('rootEntries', { owner, repo });
    const cached = this.getFromCache<string[]>(cacheKey, 60000);
    if (cached !== undefined) return cached.includes('project.json');

    try {
      const octokit = await this.ensureAuthenticated();
      const response = await octokit.repos.getContent({ owner, repo, path: '' });

      this.updateRateLimitFromHeaders(response.headers as Record<string, string>);

      // A root path always lists as a directory. Anything else is a repository
      // shaped in a way this probe cannot read, and the answer is "no", not an
      // error — it is not a NodeGX project either way.
      const names = Array.isArray(response.data)
        ? response.data.filter((entry) => entry.type === 'file').map((entry) => entry.name)
        : [];
      this.setCache(cacheKey, names);
      return names.includes('project.json');
    } catch (error) {
      const status =
        error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : 'unknown';
      // An empty repo (404) or one this token cannot read (403) is not a NodeGX
      // project and is not an error worth a line in the launch log.
      if (status === 404 || status === 403) {
        this.setCache(cacheKey, []);
        return false;
      }
      console.error('❌ [GitHubClient] Error checking isNoodlProject for', `${owner}/${repo}`, error);
      return false;
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
