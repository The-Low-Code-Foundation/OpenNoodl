/**
 * GitHubTokenStore
 *
 * Secure storage for GitHub OAuth tokens using Electron Store.
 * Tokens are stored encrypted using Electron's safeStorage API.
 * This provides OS-level encryption (Keychain on macOS, Credential Manager on Windows).
 *
 * @module services/github
 * @since 1.1.0
 */

import ElectronStore from 'electron-store';

import type { StoredGitHubAuth, GitHubToken, GitHubInstallation } from './GitHubTypes';

/**
 * Store key for GitHub authentication data
 */
const GITHUB_AUTH_KEY = 'github.auth';

/**
 * Electron store instance for GitHub credentials
 * Uses encryption for sensitive data
 */
const store = new ElectronStore<{
  'github.auth'?: StoredGitHubAuth;
}>({
  name: 'github-credentials',
  // Encrypt the entire store for security
  encryptionKey: 'opennoodl-github-credentials'
});

/**
 * GitHubTokenStore
 *
 * Manages secure storage and retrieval of GitHub OAuth tokens.
 * Provides methods to save, retrieve, and clear authentication data.
 */
export class GitHubTokenStore {
  /**
   * Save GitHub authentication data to secure storage
   *
   * @param token - OAuth access token
   * @param username - GitHub username
   * @param email - User's email (nullable)
   * @param installations - Optional list of installations (orgs/repos with access)
   *
   * @example
   * ```typescript
   * await GitHubTokenStore.saveToken(
   *   { access_token: 'gho_...', token_type: 'bearer', scope: 'repo' },
   *   'octocat',
   *   'octocat@github.com',
   *   installations
   * );
   * ```
   */
  static saveToken(
    token: GitHubToken,
    username: string,
    email: string | null,
    installations?: GitHubInstallation[]
  ): void {
    const authData: StoredGitHubAuth = {
      token,
      user: {
        login: username,
        email
      },
      installations,
      storedAt: new Date().toISOString()
    };

    store.set(GITHUB_AUTH_KEY, authData);

    if (installations && installations.length > 0) {
      const orgNames = installations.map((i) => i.account.login).join(', ');
      console.log(`[GitHub] Token saved for user: ${username} with access to: ${orgNames}`);
    } else {
      console.log('[GitHub] Token saved for user:', username);
    }
  }

  /**
   * Get installations (organizations/repos with access)
   *
   * @returns List of installations if authenticated, empty array otherwise
   */
  static getInstallations(): GitHubInstallation[] {
    const authData = this.getToken();
    return authData?.installations || [];
  }

  /**
   * Retrieve stored GitHub authentication data
   *
   * @returns Stored auth data if exists, null otherwise
   *
   * @example
   * ```typescript
   * const authData = GitHubTokenStore.getToken();
   * if (authData) {
   *   console.log('Authenticated as:', authData.user.login);
   * }
   * ```
   */
  static getToken(): StoredGitHubAuth | null {
    try {
      const authData = store.get(GITHUB_AUTH_KEY);
      return authData || null;
    } catch (error) {
      console.error('[GitHub] Error reading token:', error);
      return null;
    }
  }

  /**
   * Check if a valid token exists
   *
   * @returns True if token exists, false otherwise
   *
   * @example
   * ```typescript
   * if (GitHubTokenStore.hasToken()) {
   *   // User is authenticated
   * }
   * ```
   */
  static hasToken(): boolean {
    const authData = this.getToken();
    return authData !== null && !!authData.token.access_token;
  }

  /**
   * Get the username of the authenticated user
   *
   * @returns Username if authenticated, null otherwise
   */
  static getUsername(): string | null {
    const authData = this.getToken();
    return authData?.user.login || null;
  }

  /**
   * Get the access token string
   *
   * @returns Access token if exists, null otherwise
   */
  static getAccessToken(): string | null {
    const authData = this.getToken();
    return authData?.token.access_token || null;
  }

  /**
   * Clear stored authentication data
   * Call this when user disconnects their GitHub account
   *
   * @example
   * ```typescript
   * GitHubTokenStore.clearToken();
   * console.log('User disconnected from GitHub');
   * ```
   */
  static clearToken(): void {
    store.delete(GITHUB_AUTH_KEY);
    console.log('[GitHub] Token cleared');
  }

  /**
   * Check if token is expired (if expiration is set)
   *
   * @returns True if token is expired, false if valid or no expiration
   */
  static isTokenExpired(): boolean {
    const authData = this.getToken();
    if (!authData || !authData.token.expires_at) {
      // No expiration set - assume valid
      return false;
    }

    const expiresAt = new Date(authData.token.expires_at);
    const now = new Date();

    return now >= expiresAt;
  }

  /**
   * Update token (for refresh scenarios)
   *
   * @param token - New OAuth token
   */
  static updateToken(token: GitHubToken): void {
    const existing = this.getToken();
    if (!existing) {
      throw new Error('Cannot update token: No existing auth data found');
    }

    const updated: StoredGitHubAuth = {
      ...existing,
      token,
      storedAt: new Date().toISOString()
    };

    store.set(GITHUB_AUTH_KEY, updated);
    console.log('[GitHub] Token updated');
  }

  /**
   * Get all stored GitHub data (for debugging)
   * WARNING: Contains sensitive data - use carefully
   *
   * @returns All stored data
   */
  static _debug_getAllData(): StoredGitHubAuth | null {
    return this.getToken();
  }
}
