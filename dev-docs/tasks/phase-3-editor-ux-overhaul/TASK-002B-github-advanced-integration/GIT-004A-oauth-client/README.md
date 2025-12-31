# GIT-004A: GitHub OAuth & Client Foundation

## Overview

Upgrade Nodegex's GitHub authentication from Personal Access Tokens (PAT) to full OAuth flow, and create a reusable `GitHubClient` service that powers all GitHub API interactions for both the project management features (GIT-004B-F) and deployment automation (DEPLOY-001).

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** CRITICAL (blocks all other GIT-004 and DEPLOY-001 tasks)  
**Effort:** 8-12 hours  
**Risk:** Medium (OAuth flow complexity in Electron)

---

## Background

### Current State

Nodegex currently uses Personal Access Tokens for GitHub authentication:

```
User Flow (Current):
1. User manually creates PAT on GitHub website
2. User copies PAT into Nodegex credentials dialog
3. PAT stored encrypted per-project
4. PAT used for git push/pull operations only
```

**Problems:**
- Poor UX (manual token creation)
- Tokens often have excessive permissions
- No automatic refresh
- Per-project configuration
- Can't easily request specific API scopes

### Target State

Full OAuth flow with automatic token management:

```
User Flow (Target):
1. User clicks "Connect GitHub" in Nodegex
2. Browser opens GitHub authorization page
3. User approves requested permissions
4. Nodegex receives and stores token automatically
5. Token refreshes automatically when needed
6. Works across all projects (account-level)
```

---

## Goals

1. **Implement OAuth flow** for GitHub authentication in Electron
2. **Create GitHubClient** service wrapping @octokit/rest
3. **Secure token storage** with automatic refresh
4. **Include Actions API** support for DEPLOY-001 synergy
5. **Backward compatibility** with existing PAT users

---

## Architecture

### OAuth Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nodegex   │     │   Browser   │     │   GitHub    │
│   Editor    │     │             │     │             │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │ 1. Generate auth URL                  │
       │──────────────────►│                   │
       │                   │ 2. Open GitHub    │
       │                   │──────────────────►│
       │                   │                   │
       │                   │ 3. User approves  │
       │                   │◄──────────────────│
       │                   │                   │
       │ 4. Callback with code                 │
       │◄──────────────────│                   │
       │                   │                   │
       │ 5. Exchange code for token            │
       │──────────────────────────────────────►│
       │                   │                   │
       │ 6. Receive access token               │
       │◄──────────────────────────────────────│
       │                   │                   │
       │ 7. Store token securely               │
       ▼                   ▼                   ▼
```

### GitHubClient Structure

```typescript
// packages/noodl-editor/src/editor/src/services/github/GitHubClient.ts

export class GitHubClient {
  private octokit: Octokit;
  
  // Issue management (GIT-004B, GIT-004D)
  readonly issues: IssuesAPI;
  
  // Pull request management (GIT-004C)
  readonly pullRequests: PullRequestsAPI;
  
  // Discussions (GIT-004B)
  readonly discussions: DiscussionsAPI;
  
  // GitHub Actions (DEPLOY-001)
  readonly actions: ActionsAPI;
  
  // Repository operations
  readonly repos: ReposAPI;
  
  // User info
  readonly users: UsersAPI;
  
  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    // Initialize all APIs...
  }
  
  // Rate limit info
  async getRateLimit(): Promise<RateLimitInfo>;
  
  // Connection test
  async testConnection(): Promise<boolean>;
}
```

---

## Implementation Phases

### Phase 1: OAuth Flow (3-4 hours)

Implement the OAuth authorization flow for Electron.

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/github/
├── GitHubAuth.ts
└── types/auth.ts
```

**Tasks:**
1. Create `GitHubAuth` class with OAuth methods
2. Implement authorization URL generation with PKCE
3. Register deep link handler in Electron main process
4. Handle OAuth callback and code extraction
5. Implement token exchange (via PKCE, no client secret needed)
6. Handle OAuth errors gracefully

**Key Code:**
```typescript
// GitHubAuth.ts
export class GitHubAuth {
  private static CLIENT_ID = 'your-oauth-app-client-id';
  private static REDIRECT_URI = 'nodegex://oauth/callback';
  private static SCOPES = ['repo', 'read:user', 'workflow'];
  
  static async startAuthFlow(): Promise<string> {
    // Generate PKCE code verifier and challenge
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = crypto.randomUUID();
    
    // Store for later verification
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_verifier', codeVerifier);
    
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', this.CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', this.REDIRECT_URI);
    authUrl.searchParams.set('scope', this.SCOPES.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    // Open in system browser
    await shell.openExternal(authUrl.toString());
    
    // Return promise that resolves when callback received
    return this.waitForCallback();
  }
  
  static async exchangeCodeForToken(code: string): Promise<GitHubToken> {
    const verifier = sessionStorage.getItem('oauth_verifier');
    
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.CLIENT_ID,
        code,
        code_verifier: verifier,
        redirect_uri: this.REDIRECT_URI,
      }),
    });
    
    return response.json();
  }
}
```

**Success Criteria:**
- [ ] Auth URL opens GitHub in browser
- [ ] Callback received via deep link
- [ ] Code exchanged for token successfully
- [ ] State parameter validated
- [ ] Errors handled with user feedback

---

### Phase 2: Token Storage (2-3 hours)

Implement secure, persistent token storage.

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/github/
├── GitHubTokenStore.ts
└── types/token.ts
```

**Tasks:**
1. Create `GitHubTokenStore` class
2. Use electron-store with encryption
3. Store access token, refresh token, expiry
4. Implement token retrieval with expiry check
5. Implement token refresh flow
6. Implement logout/clear functionality

**Key Code:**
```typescript
// GitHubTokenStore.ts
import Store from 'electron-store';

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string;
  username: string;
  avatarUrl?: string;
}

export class GitHubTokenStore {
  private static store = new Store<{ github_token: StoredToken }>({
    encryptionKey: process.env.TOKEN_ENCRYPTION_KEY || 'nodegex-github-token',
    name: 'github-auth',
  });
  
  static async save(token: StoredToken): Promise<void> {
    this.store.set('github_token', token);
  }
  
  static async get(): Promise<StoredToken | null> {
    const token = this.store.get('github_token');
    if (!token) return null;
    
    // Check if expired
    if (token.expiresAt && Date.now() > token.expiresAt) {
      if (token.refreshToken) {
        return this.refresh(token.refreshToken);
      }
      return null;
    }
    
    return token;
  }
  
  static async clear(): Promise<void> {
    this.store.delete('github_token');
  }
  
  static async refresh(refreshToken: string): Promise<StoredToken | null> {
    // Implement refresh flow
  }
  
  static isAuthenticated(): boolean {
    return !!this.store.get('github_token');
  }
}
```

**Success Criteria:**
- [ ] Token stored securely (encrypted)
- [ ] Token persists across app restarts
- [ ] Token retrieval checks expiry
- [ ] Refresh flow works (if applicable)
- [ ] Clear/logout removes token

---

### Phase 3: GitHubClient Service (2-3 hours)

Create the main API client that wraps @octokit/rest.

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/github/
├── GitHubClient.ts
├── apis/
│   ├── IssuesAPI.ts
│   ├── PullRequestsAPI.ts
│   ├── DiscussionsAPI.ts
│   ├── ActionsAPI.ts
│   ├── ReposAPI.ts
│   └── UsersAPI.ts
├── types/
│   ├── issues.ts
│   ├── pullRequests.ts
│   ├── actions.ts
│   └── common.ts
└── index.ts
```

**Tasks:**
1. Create `GitHubClient` main class
2. Implement API wrappers for each domain
3. Add rate limiting awareness
4. Add request caching layer
5. Implement error handling with typed errors
6. Create React context provider

**Key Code:**
```typescript
// GitHubClient.ts
import { Octokit } from '@octokit/rest';

export class GitHubClient {
  private octokit: Octokit;
  private cache: Map<string, CacheEntry> = new Map();
  
  readonly issues: IssuesAPI;
  readonly pullRequests: PullRequestsAPI;
  readonly discussions: DiscussionsAPI;
  readonly actions: ActionsAPI;
  readonly repos: ReposAPI;
  readonly users: UsersAPI;
  
  constructor(token: string) {
    this.octokit = new Octokit({ 
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          console.warn(`Rate limit hit, retrying after ${retryAfter}s`);
          return true; // Retry
        },
        onSecondaryRateLimit: (retryAfter, options) => {
          console.warn(`Secondary rate limit hit`);
          return false; // Don't retry
        },
      },
    });
    
    this.issues = new IssuesAPI(this.octokit, this.cache);
    this.pullRequests = new PullRequestsAPI(this.octokit, this.cache);
    this.discussions = new DiscussionsAPI(this.octokit, this.cache);
    this.actions = new ActionsAPI(this.octokit, this.cache);
    this.repos = new ReposAPI(this.octokit, this.cache);
    this.users = new UsersAPI(this.octokit, this.cache);
  }
  
  async getRateLimit(): Promise<RateLimitInfo> {
    const { data } = await this.octokit.rateLimit.get();
    return {
      remaining: data.rate.remaining,
      limit: data.rate.limit,
      resetAt: new Date(data.rate.reset * 1000),
    };
  }
  
  async testConnection(): Promise<{ success: boolean; user?: string }> {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return { success: true, user: data.login };
    } catch {
      return { success: false };
    }
  }
}

// React context
export const GitHubClientContext = createContext<GitHubClient | null>(null);

export function useGitHubClient(): GitHubClient {
  const client = useContext(GitHubClientContext);
  if (!client) throw new Error('GitHubClient not available');
  return client;
}
```

**Success Criteria:**
- [ ] GitHubClient instantiates with token
- [ ] All API domains accessible
- [ ] Rate limiting handled gracefully
- [ ] Caching reduces duplicate requests
- [ ] React hook provides access to client

---

### Phase 4: UI Integration (1-2 hours)

Add OAuth UI to the existing Version Control settings.

**Files to Modify:**
```
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
  components/GitProviderPopout/GitProviderPopout.tsx
  components/GitProviderPopout/sections/CredentialsSection.tsx
```

**Files to Create:**
```
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
  components/GitProviderPopout/sections/
    GitHubOAuthSection.tsx
    GitHubAccountDisplay.tsx
```

**Tasks:**
1. Add "Connect with GitHub" button
2. Show connected account info (username, avatar)
3. Add "Disconnect" option
4. Keep PAT option as "Advanced" fallback
5. Handle connection states (connecting, connected, error)

**Success Criteria:**
- [ ] "Connect with GitHub" button visible
- [ ] OAuth flow triggers on click
- [ ] Connected state shows username/avatar
- [ ] Disconnect works
- [ ] PAT fallback still available

---

### Phase 5: Deep Link Handler (1 hour)

Set up Electron to handle OAuth callbacks.

**Files to Modify:**
```
packages/noodl-editor/src/main/main.ts (or equivalent)
```

**Tasks:**
1. Register `nodegex://` protocol handler
2. Handle `nodegex://oauth/callback` URLs
3. Extract code and state from URL
4. Send to renderer process via IPC
5. Handle app already running scenario

**Key Code:**
```typescript
// In main process
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('nodegex', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('nodegex');
}

// Handle the protocol
app.on('open-url', (event, url) => {
  event.preventDefault();
  
  if (url.startsWith('nodegex://oauth/callback')) {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');
    
    // Send to renderer
    if (mainWindow) {
      mainWindow.webContents.send('github-oauth-callback', { code, state, error });
    }
  }
});

// Windows: handle protocol in second-instance
app.on('second-instance', (event, commandLine) => {
  const url = commandLine.find(arg => arg.startsWith('nodegex://'));
  if (url) {
    // Handle same as open-url
  }
});
```

**Success Criteria:**
- [ ] Deep link registered on app start
- [ ] Callback URL handled correctly
- [ ] Works on macOS, Windows, Linux
- [ ] Handles app already running

---

## Files Summary

### Create (New)

```
packages/noodl-editor/src/editor/src/services/github/
├── GitHubAuth.ts              # OAuth flow
├── GitHubTokenStore.ts        # Secure token storage
├── GitHubClient.ts            # Main API client
├── apis/
│   ├── IssuesAPI.ts           # Issues operations
│   ├── PullRequestsAPI.ts     # PR operations
│   ├── DiscussionsAPI.ts      # Discussions operations
│   ├── ActionsAPI.ts          # GitHub Actions (for DEPLOY-001)
│   ├── ReposAPI.ts            # Repository operations
│   └── UsersAPI.ts            # User operations
├── types/
│   ├── auth.ts
│   ├── token.ts
│   ├── issues.ts
│   ├── pullRequests.ts
│   ├── actions.ts
│   └── common.ts
├── cache.ts                   # Request caching
├── errors.ts                  # Typed errors
└── index.ts                   # Public exports
```

### Modify

```
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
  components/GitProviderPopout/GitProviderPopout.tsx
  - Add GitHub OAuth section
  - Show connected account

packages/noodl-editor/src/main/main.ts
  - Register deep link protocol
  - Handle OAuth callbacks
```

---

## Dependencies

### NPM Packages to Add

```json
{
  "@octokit/rest": "^20.0.0",
  "@octokit/auth-oauth-device": "^6.0.0",
  "@octokit/plugin-throttling": "^8.0.0"
}
```

### OAuth App Setup

Before implementation, create a GitHub OAuth App:

1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Create new OAuth App:
   - **Application name**: Nodegex
   - **Homepage URL**: https://nodegex.dev (or appropriate)
   - **Authorization callback URL**: `nodegex://oauth/callback`
3. Note the Client ID (public, can be in code)
4. Client Secret not needed if using PKCE

---

## Testing Checklist

### OAuth Flow
- [ ] Auth URL opens correctly in browser
- [ ] GitHub shows correct permissions request
- [ ] Approval redirects back to Nodegex
- [ ] Token exchange completes successfully
- [ ] Cancellation handled gracefully
- [ ] Network errors handled

### Token Storage
- [ ] Token persists after app restart
- [ ] Token encrypted on disk
- [ ] Expired token triggers refresh
- [ ] Clear removes all token data

### GitHubClient
- [ ] Can fetch authenticated user
- [ ] Can list issues for a repo
- [ ] Rate limit info accessible
- [ ] Caching reduces API calls
- [ ] Errors typed and catchable

### UI
- [ ] Connect button visible for GitHub repos
- [ ] Loading state during OAuth
- [ ] Connected state shows user info
- [ ] Disconnect clears connection
- [ ] PAT fallback works

### Cross-Platform
- [ ] Deep links work on macOS
- [ ] Deep links work on Windows
- [ ] Deep links work on Linux

---

## Security Considerations

1. **No Client Secret**: Use PKCE flow to avoid storing secrets
2. **Encrypted Storage**: Token encrypted with electron-store
3. **Minimal Scopes**: Only request needed permissions
4. **State Parameter**: Prevent CSRF attacks
5. **Token Refresh**: Minimize exposure of long-lived tokens

---

## Rollback Plan

If OAuth implementation has issues:

1. PAT-based auth remains functional
2. Can disable OAuth UI with feature flag
3. GitHubClient works with PAT as well as OAuth token

---

## Success Criteria

- [ ] User can authenticate via OAuth in < 30 seconds
- [ ] Token persists across sessions
- [ ] Token refresh works automatically
- [ ] GitHubClient can make all required API calls
- [ ] Rate limiting handled without user confusion
- [ ] Works on all platforms (macOS, Windows, Linux)
- [ ] PAT fallback available for advanced users

---

## References

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [PKCE for OAuth](https://oauth.net/2/pkce/)
- [Octokit.js Documentation](https://octokit.github.io/rest.js)
- [Electron Deep Links](https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app)
- [electron-store](https://github.com/sindresorhus/electron-store)
