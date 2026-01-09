/**
 * GitHubTypes
 *
 * TypeScript type definitions for GitHub OAuth and API integration.
 * These types define the structure of tokens, authentication state, and API responses.
 *
 * @module services/github
 * @since 1.1.0
 */

/**
 * OAuth device code response from GitHub
 * Returned when initiating device flow authorization
 */
export interface GitHubDeviceCode {
  /** The device verification code */
  device_code: string;
  /** The user verification code (8-character code) */
  user_code: string;
  /** URL where user enters the code */
  verification_uri: string;
  /** Expiration time in seconds (default: 900) */
  expires_in: number;
  /** Polling interval in seconds (default: 5) */
  interval: number;
}

/**
 * GitHub OAuth access token
 * Stored securely and used for API authentication
 */
export interface GitHubToken {
  /** The OAuth access token */
  access_token: string;
  /** Token type (always 'bearer' for GitHub) */
  token_type: string;
  /** Granted scopes (comma-separated) */
  scope: string;
  /** Token expiration timestamp (ISO 8601) - undefined if no expiration */
  expires_at?: string;
}

/**
 * Current GitHub authentication state
 * Used by React components to display connection status
 */
export interface GitHubAuthState {
  /** Whether user is authenticated with GitHub */
  isAuthenticated: boolean;
  /** GitHub username if authenticated */
  username?: string;
  /** User's primary email if authenticated */
  email?: string;
  /** Current token (for internal use only) */
  token?: GitHubToken;
  /** Timestamp of last successful authentication */
  authenticatedAt?: string;
}

/**
 * GitHub user information
 * Retrieved from /user API endpoint
 */
export interface GitHubUser {
  /** GitHub username */
  login: string;
  /** GitHub user ID */
  id: number;
  /** User's display name */
  name: string | null;
  /** User's primary email */
  email: string | null;
  /** Avatar URL */
  avatar_url: string;
  /** Profile URL */
  html_url: string;
  /** User type (User or Organization) */
  type: string;
}

/**
 * GitHub repository information
 * Basic repo details for issue/PR association
 */
export interface GitHubRepository {
  /** Repository ID */
  id: number;
  /** Repository name (without owner) */
  name: string;
  /** Full repository name (owner/repo) */
  full_name: string;
  /** Repository owner */
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  /** Whether repo is private */
  private: boolean;
  /** Repository URL */
  html_url: string;
  /** Default branch */
  default_branch: string;
}

/**
 * GitHub App installation information
 * Represents organizations/accounts where the app was installed
 */
export interface GitHubInstallation {
  /** Installation ID */
  id: number;
  /** Account where app is installed */
  account: {
    login: string;
    type: 'User' | 'Organization';
    avatar_url: string;
  };
  /** Repository selection type */
  repository_selection: 'all' | 'selected';
  /** List of repositories (if selected) */
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
  }>;
}

/**
 * Rate limit information from GitHub API
 * Used to prevent hitting API limits
 */
export interface GitHubRateLimit {
  /** Maximum requests allowed per hour */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Timestamp when rate limit resets (Unix epoch) */
  reset: number;
  /** Resource type (core, search, graphql) */
  resource: string;
}

/**
 * Error response from GitHub API
 */
export interface GitHubError {
  /** HTTP status code */
  status: number;
  /** Error message */
  message: string;
  /** Detailed documentation URL if available */
  documentation_url?: string;
}

/**
 * OAuth authorization error
 * Thrown during device flow authorization
 */
export interface GitHubAuthError extends Error {
  /** Error code from GitHub */
  code?: string;
  /** HTTP status if applicable */
  status?: number;
}

/**
 * Stored token data (persisted format)
 * Encrypted and stored in Electron's secure storage
 */
export interface StoredGitHubAuth {
  /** OAuth token */
  token: GitHubToken;
  /** Associated user info */
  user: {
    login: string;
    email: string | null;
  };
  /** Installation information (organizations/repos with access) */
  installations?: GitHubInstallation[];
  /** Timestamp when stored */
  storedAt: string;
}
