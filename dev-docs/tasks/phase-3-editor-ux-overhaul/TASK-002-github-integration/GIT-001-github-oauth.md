# GIT-001: GitHub OAuth Integration

## Overview

Add GitHub OAuth as an authentication method alongside the existing Personal Access Token (PAT) approach. This provides a smoother onboarding experience and enables access to GitHub's API for advanced features like repository browsing and organization access.

## Context

Currently, Noodl uses Personal Access Tokens for GitHub authentication:
- Stored per-project in `GitStore` (encrypted locally)
- Prompted via `GitProviderPopout` component
- Used by `trampoline-askpass-handler` for git operations

OAuth provides advantages:
- No need to manually create and copy PATs
- Automatic token refresh
- Access to GitHub API (not just git operations)
- Org/repo scope selection

## Current State

### Existing Authentication Flow
```
User → GitProviderPopout → Enter PAT → GitStore.set() → Git operations use PAT
```

### Key Files
- `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/components/GitProviderPopout/`
- `packages/noodl-store/src/GitStore.ts` (assumed location)
- `packages/noodl-git/src/core/trampoline/trampoline-askpass-handler.ts`

## Requirements

### Functional Requirements

1. **OAuth Flow**
   - "Connect with GitHub" button in settings/dashboard
   - Opens GitHub OAuth in system browser
   - Handles callback via custom protocol (`noodl://github-callback`)
   - Exchanges code for access token
   - Stores token securely

2. **Scope Selection**
   - Request appropriate scopes: `repo`, `read:org`, `read:user`
   - Display what permissions are being requested
   - Option to request additional scopes later

3. **Account Management**
   - Show connected GitHub account (avatar, username)
   - "Disconnect" option
   - Support multiple accounts (stretch goal)

4. **Organization Access**
   - List user's organizations
   - Allow selecting which orgs to access
   - Remember org selection

5. **Token Management**
   - Secure storage using electron's safeStorage or keytar
   - Automatic token refresh (GitHub OAuth tokens don't expire but can be revoked)
   - Handle token revocation gracefully

6. **Fallback to PAT**
   - Keep existing PAT flow as alternative
   - "Use Personal Access Token instead" option
   - Clear migration path from PAT to OAuth

### Non-Functional Requirements

- OAuth flow completes in <30 seconds
- Token stored securely (encrypted at rest)
- Works behind corporate proxies
- Graceful offline handling

## Technical Approach

### 1. GitHub OAuth App Setup

Register OAuth App in GitHub:
- Application name: "OpenNoodl"
- Homepage URL: `https://opennoodl.net`
- Callback URL: `noodl://github-callback`

Store Client ID in app (Client Secret not needed for public clients using PKCE).

### 2. OAuth Flow Implementation

```typescript
// packages/noodl-editor/src/editor/src/services/GitHubOAuthService.ts

class GitHubOAuthService {
  private static instance: GitHubOAuthService;
  
  // OAuth flow
  async initiateOAuth(): Promise<void>;
  async handleCallback(code: string, state: string): Promise<GitHubToken>;
  
  // Token management
  async getToken(): Promise<string | null>;
  async refreshToken(): Promise<string>;
  async revokeToken(): Promise<void>;
  
  // Account info
  async getCurrentUser(): Promise<GitHubUser>;
  async getOrganizations(): Promise<GitHubOrg[]>;
  
  // State
  isAuthenticated(): boolean;
  onAuthStateChanged(callback: (authenticated: boolean) => void): void;
}
```

### 3. PKCE Flow (Recommended for Desktop Apps)

```typescript
// Generate PKCE challenge
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

// OAuth URL
function getAuthorizationUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: 'noodl://github-callback',
    scope: 'repo read:org read:user',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}
```

### 4. Deep Link Handler

```typescript
// packages/noodl-editor/src/main/main.js

// Register protocol handler
app.setAsDefaultProtocolClient('noodl');

// Handle deep links
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('noodl://github-callback')) {
    const params = new URL(url).searchParams;
    const code = params.get('code');
    const state = params.get('state');
    handleGitHubCallback(code, state);
  }
});
```

### 5. Secure Token Storage

```typescript
// Use electron's safeStorage API
import { safeStorage } from 'electron';

async function storeToken(token: string): Promise<void> {
  const encrypted = safeStorage.encryptString(token);
  await store.set('github.token', encrypted.toString('base64'));
}

async function getToken(): Promise<string | null> {
  const encrypted = await store.get('github.token');
  if (!encrypted) return null;
  return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
}
```

### 6. Integration with Existing Git Auth

```typescript
// packages/noodl-utils/LocalProjectsModel.ts

setCurrentGlobalGitAuth(projectId: string) {
  const func = async (endpoint: string) => {
    if (endpoint.includes('github.com')) {
      // Try OAuth token first
      const oauthToken = await GitHubOAuthService.instance.getToken();
      if (oauthToken) {
        return {
          username: 'oauth2',
          password: oauthToken
        };
      }
      
      // Fall back to PAT
      const config = await GitStore.get('github', projectId);
      return {
        username: 'noodl',
        password: config?.password
      };
    }
    // ... rest of existing logic
  };
  
  setRequestGitAccount(func);
}
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/GitHubOAuthService.ts`
2. `packages/noodl-editor/src/editor/src/services/GitHubApiClient.ts`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/GitHubAccountCard/GitHubAccountCard.tsx`
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/GitHubConnectButton/GitHubConnectButton.tsx`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/OrgSelector/OrgSelector.tsx`
6. `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/components/GitProviderPopout/sections/OAuthSection.tsx`

## Files to Modify

1. `packages/noodl-editor/src/main/main.js`
   - Add deep link protocol handler for `noodl://`

2. `packages/noodl-utils/LocalProjectsModel.ts`
   - Update `setCurrentGlobalGitAuth` to prefer OAuth token

3. `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/components/GitProviderPopout/GitProviderPopout.tsx`
   - Add OAuth option alongside PAT

4. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherSidebar/LauncherSidebar.tsx`
   - Add GitHub account display/connect button

## Implementation Steps

### Phase 1: OAuth Service Foundation
1. Create GitHubOAuthService class
2. Implement PKCE flow
3. Set up deep link handler in main process
4. Implement secure token storage

### Phase 2: UI Components
1. Create GitHubConnectButton
2. Create GitHubAccountCard
3. Add OAuth section to GitProviderPopout
4. Add account display to launcher sidebar

### Phase 3: API Integration
1. Create GitHubApiClient for REST API calls
2. Implement user info fetching
3. Implement organization listing
4. Create OrgSelector component

### Phase 4: Git Integration
1. Update LocalProjectsModel auth function
2. Test with git operations
3. Handle token expiry/revocation
4. Add fallback to PAT

### Phase 5: Polish
1. Error handling and messages
2. Offline handling
3. Loading states
4. Settings persistence

## Security Considerations

1. **PKCE**: Use PKCE flow instead of client secret (more secure for desktop apps)
2. **Token Storage**: Use electron's safeStorage API (OS-level encryption)
3. **State Parameter**: Verify state to prevent CSRF attacks
4. **Scope Limitation**: Request minimum required scopes
5. **Token Exposure**: Never log tokens, clear from memory when not needed

## Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Token stored securely
- [ ] Token retrieved correctly for git operations
- [ ] Clone works with OAuth token
- [ ] Push works with OAuth token
- [ ] Pull works with OAuth token
- [ ] Disconnect clears token
- [ ] Fallback to PAT works
- [ ] Organizations listed correctly
- [ ] Deep link works on macOS
- [ ] Deep link works on Windows
- [ ] Handles network errors gracefully
- [ ] Handles token revocation gracefully

## Dependencies

- DASH-001 (for launcher context to display account)

### External Dependencies

May need to add:
```json
{
  "keytar": "^7.9.0"  // Alternative to safeStorage for older Electron
}
```

## Blocked By

- DASH-001 (Tabbed Navigation) - for launcher UI placement

## Blocks

- GIT-003 (Repository Cloning) - needs auth for private repos
- COMP-004 (Organization Components) - needs org access

## Estimated Effort

- OAuth service: 4-6 hours
- Deep link handler: 2-3 hours
- UI components: 3-4 hours
- Git integration: 2-3 hours
- Testing & polish: 3-4 hours
- **Total: 14-20 hours**

## Success Criteria

1. Users can authenticate with GitHub via OAuth
2. OAuth tokens are stored securely
3. Git operations work with OAuth tokens
4. Users can see their connected account
5. Users can disconnect and reconnect
6. PAT remains available as fallback
7. Flow works on both macOS and Windows

## Future Enhancements

- Multiple GitHub account support
- GitLab OAuth
- Bitbucket OAuth
- GitHub Enterprise support
- Fine-grained personal access tokens
