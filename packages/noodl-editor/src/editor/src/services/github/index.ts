/**
 * GitHub Services
 *
 * Public exports for GitHub OAuth authentication and API integration.
 * This module provides everything needed to connect to GitHub,
 * authenticate users, and interact with the GitHub API.
 *
 * @module services/github
 * @since 1.1.0
 *
 * @example
 * ```typescript
 * import { GitHubAuth, githubClient } from '@noodl-services/github';
 *
 * // Check if authenticated
 * if (GitHubAuth.isAuthenticated()) {
 *   // Fetch user repos
 *   const repos = await githubClient.listRepositories();
 * }
 * ```
 */

// Authentication
export { GitHubAuth } from './GitHubAuth';
export { GitHubTokenStore } from './GitHubTokenStore';

// API Client
export { GitHubClient, githubClient } from './GitHubClient';

// Types
export type {
  GitHubDeviceCode,
  GitHubToken,
  GitHubAuthState,
  GitHubUser,
  GitHubRepository,
  GitHubRateLimit,
  GitHubError,
  GitHubAuthError,
  StoredGitHubAuth
} from './GitHubTypes';
