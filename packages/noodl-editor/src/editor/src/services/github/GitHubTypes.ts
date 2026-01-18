/**
 * TypeScript interfaces for GitHub API data structures
 *
 * @module noodl-editor/services/github
 */

/**
 * GitHub Issue data structure
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  milestone: GitHubMilestone | null;
}

/**
 * GitHub Pull Request data structure
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  draft: boolean;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  mergeable: boolean | null;
  mergeable_state: string;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

/**
 * GitHub User data structure
 */
export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

/**
 * GitHub Organization data structure
 */
export interface GitHubOrganization {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
  html_url: string;
}

/**
 * GitHub Repository data structure
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser | GitHubOrganization;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  permissions?: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
}

/**
 * GitHub Label data structure
 */
export interface GitHubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string | null;
}

/**
 * GitHub Milestone data structure
 */
export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  due_on: string | null;
  closed_at: string | null;
}

/**
 * GitHub Comment data structure
 */
export interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
}

/**
 * GitHub Commit data structure
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: GitHubUser | null;
  committer: GitHubUser | null;
  html_url: string;
}

/**
 * GitHub Check Run data structure (for PR status checks)
 */
export interface GitHubCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  html_url: string;
  details_url: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * GitHub Review data structure
 */
export interface GitHubReview {
  id: number;
  user: GitHubUser;
  body: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  html_url: string;
  submitted_at: string;
}

/**
 * Rate limit information
 */
export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  used: number;
}

/**
 * API response with rate limit info
 */
export interface GitHubApiResponse<T> {
  data: T;
  rateLimit: GitHubRateLimit;
}

/**
 * Issue/PR filter options
 */
export interface GitHubIssueFilters {
  state?: 'open' | 'closed' | 'all';
  labels?: string[];
  assignee?: string;
  creator?: string;
  mentioned?: string;
  milestone?: string | number;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  since?: string;
  per_page?: number;
  page?: number;
}

/**
 * Create issue options
 */
export interface CreateIssueOptions {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  milestone?: number;
}

/**
 * Update issue options
 */
export interface UpdateIssueOptions {
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  assignees?: string[];
  milestone?: number | null;
}

/**
 * Create repository options
 */
export interface CreateRepositoryOptions {
  /** Repository name */
  name: string;
  /** Repository description */
  description?: string;
  /** Whether the repo is private (default: true) */
  private?: boolean;
  /** Organization name (if creating in an org, otherwise creates in user account) */
  org?: string;
  /** Initialize with README */
  auto_init?: boolean;
  /** .gitignore template */
  gitignore_template?: string;
  /** License template */
  license_template?: string;
}

/**
 * Error response from GitHub API
 */
export interface GitHubApiError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
  }>;
}

/**
 * OAuth Token structure
 */
export interface GitHubToken {
  access_token: string;
  token_type: string;
  scope: string;
  expires_at?: string;
}

/**
 * GitHub Installation (App installation on org/repo)
 */
export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: string;
  };
  repository_selection: string;
  permissions: Record<string, string>;
}

/**
 * Stored GitHub authentication data
 */
export interface StoredGitHubAuth {
  token: GitHubToken;
  user: {
    login: string;
    email: string | null;
  };
  installations?: GitHubInstallation[];
  storedAt: string;
}

/**
 * GitHub Auth state (returned by GitHubAuth.getAuthState())
 */
export interface GitHubAuthState {
  isAuthenticated: boolean;
  username?: string;
  email?: string;
  token?: GitHubToken;
  authenticatedAt?: string;
}

/**
 * GitHub Device Code (for OAuth Device Flow)
 */
export interface GitHubDeviceCode {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * GitHub Auth Error
 */
export interface GitHubAuthError extends Error {
  code?: string;
}
