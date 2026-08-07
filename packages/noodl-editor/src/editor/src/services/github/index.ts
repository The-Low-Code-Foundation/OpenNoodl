/**
 * GitHub Service - Public API
 *
 * Provides GitHub integration services including OAuth authentication
 * and REST API client with rate limiting and caching.
 *
 * @module noodl-editor/services/github
 *
 * @example
 * ```typescript
 * import { GitHubClient, GitHubOAuthService } from '@noodl-editor/services/github';
 *
 * // Initialize OAuth
 * await GitHubOAuthService.instance.initialize();
 *
 * // Use API client
 * const client = GitHubClient.instance;
 * const { data: issues } = await client.listIssues('owner', 'repo');
 * ```
 */

// Re-export main services
export { GitHubOAuthService } from '../GitHubOAuthService';
export { GitHubAuth } from './GitHubAuth';
export { GitHubClient } from './GitHubClient';

// Re-export all types
export type {
  GitHubIssue,
  GitHubPullRequest,
  GitHubUser,
  GitHubOrganization,
  GitHubRepository,
  GitHubLabel,
  GitHubMilestone,
  GitHubComment,
  GitHubCommit,
  GitHubCheckRun,
  GitHubReview,
  GitHubRateLimit,
  GitHubApiResponse,
  GitHubIssueFilters,
  CreateIssueOptions,
  UpdateIssueOptions,
  GitHubApiError,
  GitHubToken,
  GitHubInstallation,
  StoredGitHubAuth,
  GitHubAuthState,
  GitHubDeviceCode,
  GitHubAuthError
} from './GitHubTypes';
