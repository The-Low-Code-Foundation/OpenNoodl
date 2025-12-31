# GIT-003-ADDENDUM: Upgrade GitHub Authentication to OAuth

## Overview

Before implementing GIT-004 (GitHub Project Management Integration), the existing GitHub integration needs to be upgraded from Personal Access Token (PAT) based authentication to full OAuth flow. This provides better security, improved UX (no manual token creation), and enables the richer API access needed for Issues/PRs.

**Effort:** 6-8 hours (can be absorbed into GIT-004A or done as standalone)  
**Priority:** HIGH (prerequisite for GIT-004)

---

## Current State

### How Authentication Works Now

```
User Flow:
1. User creates PAT manually on GitHub
2. User copies PAT to Nodegex credentials dialog
3. PAT stored encrypted per-project in GitStore
4. PAT used for git operations (push/pull)

Files Involved:
- packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
    components/GitProviderPopout/sections/CredentialsSection.tsx
- GitStore (electron-store based)
```

### Problems with Current Approach

1. **Poor UX**: Users must manually create and manage PATs
2. **Security**: PATs often have excessive permissions
3. **Limited Scope**: PATs can't easily request specific API permissions
4. **No Refresh**: When PAT expires, user must create new one manually
5. **Per-Project**: Each project requires separate PAT entry

---

## Target State

### OAuth Flow

```
User Flow:
1. User clicks "Connect GitHub" in Nodegex
2. Browser opens GitHub authorization page
3. User approves permissions
4. Nodegex receives OAuth token automatically
5. Token stored securely, refreshes automatically

Benefits:
- One-click authentication
- Granular permission requests
- Automatic token refresh
- Better security (short-lived tokens)
- Account-level (works across projects)
```

---

## Implementation Options

### Option A: OAuth App (Simpler)

**Pros:**
- Simpler to implement
- Well-documented
- Works for user-level access

**Cons:**
- Less granular permissions
- No installation context

**Setup Required:**
1. Register OAuth App in Anthropic's GitHub org (or user's)
2. Get Client ID and Client Secret
3. Configure callback URL

### Option B: GitHub App (More Powerful)

**Pros:**
- Granular permissions per resource type
- Installation-based (per-repo control)
- Higher rate limits per installation
- Webhook support built-in

**Cons:**
- More complex setup
- Requires app installation flow

**Recommendation:** Start with **OAuth App** for Phase 1, upgrade to GitHub App later if needed for enterprise features.

---

## Implementation Steps

### 1. OAuth App Registration

Create OAuth App in GitHub Developer Settings:
- **Application name**: Nodegex
- **Homepage URL**: https://nodegex.dev (or appropriate)
- **Authorization callback URL**: `nodegex://oauth/callback` (deep link)

Store credentials:
- Client ID: Can be in source (public)
- Client Secret: Must be secure (environment or bundled securely)

### 2. OAuth Flow Handler

```typescript
// packages/noodl-editor/src/editor/src/services/github/GitHubAuth.ts

export class GitHubAuth {
  private static CLIENT_ID = 'your-client-id';
  
  static async startAuthFlow(): Promise<string> {
    const state = crypto.randomUUID();
    sessionStorage.setItem('github_oauth_state', state);
    
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', this.CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', 'nodegex://oauth/callback');
    authUrl.searchParams.set('scope', 'repo read:user');
    authUrl.searchParams.set('state', state);
    
    // Open in system browser
    shell.openExternal(authUrl.toString());
    
    // Return promise that resolves when callback received
    return this.waitForCallback();
  }
  
  static async exchangeCodeForToken(code: string): Promise<GitHubToken> {
    // This needs to go through a backend or use PKCE
    // Direct exchange exposes client secret
  }
}
```

### 3. Deep Link Handler (Electron)

```typescript
// In main process
app.setAsDefaultProtocolClient('nodegex');

app.on('open-url', (event, url) => {
  if (url.startsWith('nodegex://oauth/callback')) {
    const urlParams = new URL(url).searchParams;
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    // Send to renderer for token exchange
    mainWindow.webContents.send('github-oauth-callback', { code, state });
  }
});
```

### 4. Token Storage Upgrade

```typescript
// packages/noodl-editor/src/editor/src/services/github/GitHubTokenStore.ts

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string;
  username: string;
}

export class GitHubTokenStore {
  private static STORE_KEY = 'github_oauth_token';
  
  static async save(token: StoredToken): Promise<void> {
    // Use electron-store with encryption
    const store = new Store({ encryptionKey: getEncryptionKey() });
    store.set(this.STORE_KEY, token);
  }
  
  static async get(): Promise<StoredToken | null> {
    const store = new Store({ encryptionKey: getEncryptionKey() });
    return store.get(this.STORE_KEY) || null;
  }
  
  static async clear(): Promise<void> {
    const store = new Store({ encryptionKey: getEncryptionKey() });
    store.delete(this.STORE_KEY);
  }
}
```

### 5. UI Updates

Update `GitProviderPopout` to show:
- "Connect with GitHub" button (triggers OAuth)
- Connected account display (username, avatar)
- "Disconnect" option
- Legacy PAT option as fallback

---

## Security Considerations

### Client Secret Handling

**Problem**: OAuth apps need a client secret for token exchange, but Electron apps can't securely store secrets.

**Solutions:**

1. **PKCE Flow** (Proof Key for Code Exchange)
   - No client secret needed
   - Supported by GitHub
   - Recommended for public clients

2. **Backend Proxy**
   - Route token exchange through Anthropic/Nodegex backend
   - Backend holds client secret securely
   - Adds infrastructure dependency

3. **GitHub App with Device Flow**
   - Alternative auth flow
   - No redirect needed
   - Good for CLI-style apps

**Recommendation:** Use **PKCE** for simplest secure implementation.

### Token Storage

- Use `electron-store` with encryption
- Encrypt with machine-specific key
- Consider OS keychain integration for extra security

---

## Migration Path

### For Existing Users

1. Detect existing PAT in GitStore
2. Show migration prompt: "Connect with GitHub for better experience"
3. Keep PAT as fallback for offline/enterprise scenarios
4. Eventually deprecate PAT-only flow

### Backwards Compatibility

- PAT flow remains available as "Advanced" option
- Existing projects with PAT continue to work
- New projects default to OAuth

---

## Files to Create/Modify

### Create

```
packages/noodl-editor/src/editor/src/services/github/
├── GitHubAuth.ts          # OAuth flow
├── GitHubTokenStore.ts    # Token persistence
└── index.ts
```

### Modify

```
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
  components/GitProviderPopout/GitProviderPopout.tsx
  - Add "Connect with GitHub" button
  - Show connected account
  - Add disconnect option

packages/noodl-editor/src/main/main.ts (or equivalent)
  - Register deep link handler
  - Handle OAuth callback

packages/noodl-git/src/git.ts
  - Use OAuth token when available
  - Fall back to PAT if configured
```

---

## Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Token stored and retrieved correctly
- [ ] Token refresh works (if applicable)
- [ ] Deep link callback works on all platforms
- [ ] Disconnect clears token
- [ ] Git operations work with OAuth token
- [ ] Fallback to PAT works
- [ ] Migration prompt shows for existing PAT users

---

## Decision: Standalone or Part of GIT-004A?

**Option 1: Standalone Task (GIT-003-ADDENDUM)**
- Complete OAuth upgrade first
- Cleaner separation of concerns
- Can be tested independently
- Blocks GIT-004 until complete

**Option 2: Absorb into GIT-004A**
- Single larger task
- OAuth + GitHubClient together
- More context when building
- Larger scope per task

**Recommendation:** Given you mentioned wanting to "update the GitHub integration before starting that task," treat this as **GIT-003-ADDENDUM** (standalone), then proceed to GIT-004A which builds the GitHubClient on top of the OAuth foundation.
