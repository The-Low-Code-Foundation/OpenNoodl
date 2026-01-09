/**
 * GitHubAuth
 *
 * Handles GitHub OAuth authentication using Web OAuth Flow.
 * Web OAuth Flow allows users to select which organizations and repositories
 * to grant access to, providing better permission control.
 *
 * @module services/github
 * @since 1.1.0
 */

import { ipcRenderer, shell } from 'electron';

import { GitHubTokenStore } from './GitHubTokenStore';
import type {
  GitHubAuthState,
  GitHubDeviceCode,
  GitHubToken,
  GitHubAuthError,
  GitHubUser,
  GitHubInstallation
} from './GitHubTypes';

/**
 * Scopes required for GitHub integration
 * - repo: Full control of private repositories (for issues, PRs)
 * - read:org: Read organization membership
 * - read:user: Read user profile data
 * - user:email: Read user email addresses
 */
const REQUIRED_SCOPES = ['repo', 'read:org', 'read:user', 'user:email'];

/**
 * GitHubAuth
 *
 * Manages GitHub OAuth authentication using Device Flow.
 * Provides methods to authenticate, check status, and disconnect.
 */
export class GitHubAuth {
  /**
   * Initiate GitHub Web OAuth flow
   *
   * Opens browser to GitHub authorization page where user can select
   * which organizations and repositories to grant access to.
   *
   * @param onProgress - Callback for progress updates
   * @returns Promise that resolves when authentication completes
   *
   * @throws {GitHubAuthError} If OAuth flow fails
   *
   * @example
   * ```typescript
   * await GitHubAuth.startWebOAuthFlow((message) => {
   *   console.log(message);
   * });
   * console.log('Successfully authenticated!');
   * ```
   */
  static async startWebOAuthFlow(onProgress?: (message: string) => void): Promise<void> {
    try {
      onProgress?.('Starting GitHub authentication...');

      // Request OAuth flow from main process
      const result = await ipcRenderer.invoke('github-oauth-start');

      if (!result.success) {
        throw new Error(result.error || 'Failed to start OAuth flow');
      }

      onProgress?.('Opening GitHub in your browser...');

      // Open browser to GitHub authorization page
      shell.openExternal(result.authUrl);

      // Wait for OAuth callback from main process
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Authentication timed out after 5 minutes'));
        }, 300000); // 5 minutes

        const handleSuccess = async (_event: Electron.IpcRendererEvent, data: any) => {
          console.log('🎉 [GitHub Auth] ========================================');
          console.log('🎉 [GitHub Auth] IPC EVENT RECEIVED: github-oauth-complete');
          console.log('🎉 [GitHub Auth] Data:', data);
          console.log('🎉 [GitHub Auth] ========================================');
          cleanup();

          try {
            onProgress?.('Authentication successful, fetching details...');

            // Save token and user info
            const token: GitHubToken = {
              access_token: data.token.access_token,
              token_type: data.token.token_type,
              scope: data.token.scope
            };

            const installations = data.installations as GitHubInstallation[];

            GitHubTokenStore.saveToken(token, data.user.login, data.user.email, installations);

            onProgress?.(`Successfully authenticated as ${data.user.login}`);
            resolve();
          } catch (error) {
            reject(error);
          }
        };

        const handleError = (_event: Electron.IpcRendererEvent, data: any) => {
          cleanup();
          reject(new Error(data.message || 'Authentication failed'));
        };

        const cleanup = () => {
          clearTimeout(timeout);
          ipcRenderer.removeListener('github-oauth-complete', handleSuccess);
          ipcRenderer.removeListener('github-oauth-error', handleError);
        };

        ipcRenderer.once('github-oauth-complete', handleSuccess);
        ipcRenderer.once('github-oauth-error', handleError);
      });
    } catch (error) {
      const authError: GitHubAuthError = new Error(
        `GitHub authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      authError.code = error instanceof Error && 'code' in error ? (error as { code?: string }).code : undefined;

      console.error('[GitHub] Authentication error:', authError);
      throw authError;
    }
  }

  /**
   * @deprecated Use startWebOAuthFlow instead. Device Flow kept for backward compatibility.
   */
  static async startDeviceFlow(onProgress?: (message: string) => void): Promise<GitHubDeviceCode> {
    console.warn('[GitHub] startDeviceFlow is deprecated, using startWebOAuthFlow instead');
    await this.startWebOAuthFlow(onProgress);

    // Return empty device code for backward compatibility
    return {
      device_code: '',
      user_code: '',
      verification_uri: '',
      expires_in: 0,
      interval: 0
    };
  }

  /**
   * Fetch user information from GitHub API
   *
   * @param token - Access token
   * @returns User information
   *
   * @throws {Error} If API request fails
   */
  private static async fetchUserInfo(token: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current authentication state
   *
   * @returns Current auth state
   *
   * @example
   * ```typescript
   * const state = GitHubAuth.getAuthState();
   * if (state.isAuthenticated) {
   *   console.log('Connected as:', state.username);
   * }
   * ```
   */
  static getAuthState(): GitHubAuthState {
    const storedAuth = GitHubTokenStore.getToken();

    if (!storedAuth) {
      return {
        isAuthenticated: false
      };
    }

    // Check if token is expired
    if (GitHubTokenStore.isTokenExpired()) {
      console.warn('[GitHub] Token is expired');
      return {
        isAuthenticated: false
      };
    }

    return {
      isAuthenticated: true,
      username: storedAuth.user.login,
      email: storedAuth.user.email || undefined,
      token: storedAuth.token,
      authenticatedAt: storedAuth.storedAt
    };
  }

  /**
   * Check if user is currently authenticated
   *
   * @returns True if authenticated and token is valid
   */
  static isAuthenticated(): boolean {
    return this.getAuthState().isAuthenticated;
  }

  /**
   * Get the username of authenticated user
   *
   * @returns Username or null if not authenticated
   */
  static getUsername(): string | null {
    return this.getAuthState().username || null;
  }

  /**
   * Get current access token
   *
   * @returns Access token or null if not authenticated
   */
  static getAccessToken(): string | null {
    const state = this.getAuthState();
    return state.token?.access_token || null;
  }

  /**
   * Disconnect from GitHub
   *
   * Clears stored authentication data. User will need to re-authenticate.
   *
   * @example
   * ```typescript
   * GitHubAuth.disconnect();
   * console.log('Disconnected from GitHub');
   * ```
   */
  static disconnect(): void {
    GitHubTokenStore.clearToken();
    console.log('[GitHub] User disconnected');
  }

  /**
   * Validate current token by making a test API call
   *
   * @returns True if token is valid, false otherwise
   */
  static async validateToken(): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('[GitHub] Token validation failed:', error);
      return false;
    }
  }

  /**
   * Refresh user information from GitHub
   *
   * Useful for updating cached user data
   *
   * @returns Updated auth state
   * @throws {Error} If not authenticated or refresh fails
   */
  static async refreshUserInfo(): Promise<GitHubAuthState> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const user = await this.fetchUserInfo(token);

    // Update stored auth with new user info
    const storedAuth = GitHubTokenStore.getToken();
    if (storedAuth) {
      GitHubTokenStore.saveToken(storedAuth.token, user.login, user.email);
    }

    return this.getAuthState();
  }
}
