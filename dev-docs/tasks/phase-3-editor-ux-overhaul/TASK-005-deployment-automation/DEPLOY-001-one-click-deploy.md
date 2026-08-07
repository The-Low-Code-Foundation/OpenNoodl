# DEPLOY-001: One-Click Deploy Integrations

## Overview

Add one-click deployment to popular hosting platforms (Netlify, Vercel, GitHub Pages). Users can deploy their frontend directly from the editor without manual file handling or CLI tools.

## Context

Currently, deployment requires:
1. Deploy to local folder
2. Manually upload to hosting platform
3. Configure hosting settings separately
4. Repeat for every deployment

This friction discourages frequent deployments and makes it harder for non-technical users to share their work.

### Existing Infrastructure

From `deployer.ts`:
```typescript
export async function deployToFolder({
  project,
  direntry,
  environment,
  baseUrl,
  envVariables,
  runtimeType = 'deploy'
}: DeployToFolderOptions)
```

From `compilation.ts`:
```typescript
class Compilation {
  deployToFolder(direntry, options): Promise<void>;
  // Build scripts for pre/post deploy
}
```

From `DeployToFolderTab.tsx`:
- Current UI for folder selection
- Environment selection dropdown

## Requirements

### Functional Requirements

1. **Platform Integrations**
   - Netlify (OAuth + API)
   - Vercel (OAuth + API)
   - GitHub Pages (via GitHub API)
   - Cloudflare Pages (OAuth + API)

2. **Deploy Flow**
   - One-click deploy from editor
   - Platform selection dropdown
   - Site/project selection or creation
   - Environment variables configuration
   - Deploy progress indication

3. **Site Management**
   - List user's sites on each platform
   - Create new site from editor
   - Link project to existing site
   - View deployment history

4. **Configuration**
   - Environment variables per platform
   - Custom domain display
   - Build settings (if needed)
   - Deploy hooks

5. **Status & History**
   - Deploy status in editor
   - Link to live site
   - Deployment history
   - Rollback option (if supported)

### Non-Functional Requirements

- Deploy completes in < 2 minutes
- Works with existing deploy-to-folder logic
- Secure token storage
- Clear error messages

## Technical Approach

### 1. Deploy Service Architecture

```typescript
// packages/noodl-editor/src/editor/src/services/DeployService.ts

interface DeployTarget {
  id: string;
  name: string;
  platform: DeployPlatform;
  siteId: string;
  siteName: string;
  url: string;
  customDomain?: string;
  lastDeployedAt?: string;
  envVariables?: Record<string, string>;
}

enum DeployPlatform {
  NETLIFY = 'netlify',
  VERCEL = 'vercel',
  GITHUB_PAGES = 'github_pages',
  CLOUDFLARE = 'cloudflare',
  LOCAL_FOLDER = 'local_folder'
}

interface DeployResult {
  success: boolean;
  deployId: string;
  url: string;
  buildTime: number;
  error?: string;
}

class DeployService {
  private static instance: DeployService;
  private providers: Map<DeployPlatform, DeployProvider> = new Map();
  
  // Provider management
  registerProvider(provider: DeployProvider): void;
  getProvider(platform: DeployPlatform): DeployProvider;
  
  // Authentication
  async authenticate(platform: DeployPlatform): Promise<void>;
  async disconnect(platform: DeployPlatform): Promise<void>;
  isAuthenticated(platform: DeployPlatform): boolean;
  
  // Site management
  async listSites(platform: DeployPlatform): Promise<Site[]>;
  async createSite(platform: DeployPlatform, name: string): Promise<Site>;
  async linkSite(project: ProjectModel, target: DeployTarget): Promise<void>;
  
  // Deployment
  async deploy(project: ProjectModel, target: DeployTarget): Promise<DeployResult>;
  async getDeployStatus(deployId: string): Promise<DeployStatus>;
  async getDeployHistory(target: DeployTarget): Promise<Deployment[]>;
}
```

### 2. Deploy Provider Interface

```typescript
// packages/noodl-editor/src/editor/src/services/deploy/DeployProvider.ts

interface DeployProvider {
  readonly platform: DeployPlatform;
  readonly name: string;
  readonly icon: string;
  
  // Authentication
  authenticate(): Promise<AuthResult>;
  disconnect(): Promise<void>;
  isAuthenticated(): boolean;
  getUser(): Promise<User | null>;
  
  // Sites
  listSites(): Promise<Site[]>;
  createSite(name: string, options?: CreateSiteOptions): Promise<Site>;
  deleteSite(siteId: string): Promise<void>;
  
  // Deployment
  deploy(siteId: string, files: DeployFiles): Promise<DeployResult>;
  getDeployStatus(deployId: string): Promise<DeployStatus>;
  getDeployHistory(siteId: string): Promise<Deployment[]>;
  cancelDeploy(deployId: string): Promise<void>;
  
  // Configuration
  getEnvVariables(siteId: string): Promise<Record<string, string>>;
  setEnvVariables(siteId: string, vars: Record<string, string>): Promise<void>;
}
```

### 3. Netlify Provider

```typescript
// packages/noodl-editor/src/editor/src/services/deploy/providers/NetlifyProvider.ts

class NetlifyProvider implements DeployProvider {
  platform = DeployPlatform.NETLIFY;
  name = 'Netlify';
  icon = 'netlify-icon.svg';
  
  private clientId = 'YOUR_NETLIFY_CLIENT_ID';
  private redirectUri = 'noodl://netlify-callback';
  private token: string | null = null;
  
  async authenticate(): Promise<AuthResult> {
    // OAuth flow
    const authUrl = `https://app.netlify.com/authorize?` +
      `client_id=${this.clientId}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}`;
    
    // Open in browser, handle callback via deep link
    const token = await this.handleOAuthCallback(authUrl);
    this.token = token;
    
    await this.storeToken(token);
    return { success: true };
  }
  
  async listSites(): Promise<Site[]> {
    const response = await fetch('https://api.netlify.com/api/v1/sites', {
      headers: { Authorization: `Bearer ${this.token}` }
    });
    
    const sites = await response.json();
    return sites.map(s => ({
      id: s.id,
      name: s.name,
      url: s.ssl_url || s.url,
      customDomain: s.custom_domain,
      updatedAt: s.updated_at
    }));
  }
  
  async createSite(name: string): Promise<Site> {
    const response = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    
    const site = await response.json();
    return {
      id: site.id,
      name: site.name,
      url: site.ssl_url || site.url
    };
  }
  
  async deploy(siteId: string, files: DeployFiles): Promise<DeployResult> {
    // Create deploy
    const deploy = await this.createDeploy(siteId);
    
    // Upload files using Netlify's digest-based upload
    const fileHashes = await this.calculateHashes(files);
    const required = await this.getRequiredFiles(deploy.id, fileHashes);
    
    for (const file of required) {
      await this.uploadFile(deploy.id, file);
    }
    
    // Finalize deploy
    return await this.finalizeDeploy(deploy.id);
  }
}
```

### 4. Vercel Provider

```typescript
// packages/noodl-editor/src/editor/src/services/deploy/providers/VercelProvider.ts

class VercelProvider implements DeployProvider {
  platform = DeployPlatform.VERCEL;
  name = 'Vercel';
  icon = 'vercel-icon.svg';
  
  private clientId = 'YOUR_VERCEL_CLIENT_ID';
  private token: string | null = null;
  
  async authenticate(): Promise<AuthResult> {
    // Vercel uses OAuth 2.0
    const state = this.generateState();
    const authUrl = `https://vercel.com/integrations/noodl/new?` +
      `state=${state}`;
    
    const token = await this.handleOAuthCallback(authUrl);
    this.token = token;
    return { success: true };
  }
  
  async deploy(projectId: string, files: DeployFiles): Promise<DeployResult> {
    // Vercel deployment API
    const deployment = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectId,
        files: await this.prepareFiles(files),
        projectSettings: {
          framework: null  // Static site
        }
      })
    });
    
    const result = await deployment.json();
    return {
      success: true,
      deployId: result.id,
      url: `https://${result.url}`,
      buildTime: 0
    };
  }
}
```

### 5. GitHub Pages Provider

```typescript
// packages/noodl-editor/src/editor/src/services/deploy/providers/GitHubPagesProvider.ts

class GitHubPagesProvider implements DeployProvider {
  platform = DeployPlatform.GITHUB_PAGES;
  name = 'GitHub Pages';
  icon = 'github-icon.svg';
  
  async authenticate(): Promise<AuthResult> {
    // Reuse GitHub OAuth from GIT-001
    const githubService = GitHubOAuthService.instance;
    if (!githubService.isAuthenticated()) {
      await githubService.authenticate();
    }
    return { success: true };
  }
  
  async listSites(): Promise<Site[]> {
    // List repos with GitHub Pages enabled
    const repos = await this.githubApi.listRepos();
    const pagesRepos = repos.filter(r => r.has_pages);
    
    return pagesRepos.map(r => ({
      id: r.full_name,
      name: r.name,
      url: `https://${r.owner.login}.github.io/${r.name}`,
      repo: r.full_name
    }));
  }
  
  async deploy(repoFullName: string, files: DeployFiles): Promise<DeployResult> {
    const [owner, repo] = repoFullName.split('/');
    
    // Create/update gh-pages branch
    const branch = 'gh-pages';
    
    // Get current tree (if exists)
    let baseTree: string | null = null;
    try {
      const ref = await this.githubApi.getRef(owner, repo, `heads/${branch}`);
      const commit = await this.githubApi.getCommit(owner, repo, ref.object.sha);
      baseTree = commit.tree.sha;
    } catch {
      // Branch doesn't exist yet
    }
    
    // Create blobs for all files
    const tree = await this.createTree(owner, repo, files, baseTree);
    
    // Create commit
    const commit = await this.githubApi.createCommit(owner, repo, {
      message: 'Deploy from Noodl',
      tree: tree.sha,
      parents: baseTree ? [baseTree] : []
    });
    
    // Update branch reference
    await this.githubApi.updateRef(owner, repo, `heads/${branch}`, commit.sha);
    
    return {
      success: true,
      deployId: commit.sha,
      url: `https://${owner}.github.io/${repo}`,
      buildTime: 0
    };
  }
}
```

### 6. UI Components

#### Deploy Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Deploy                                                        [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ DEPLOY TARGET                                                       │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🌐 Netlify                                                  [▾] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ SITE                                                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ my-noodl-app                                                [▾] │ │
│ │ https://my-noodl-app.netlify.app                                │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│ [+ Create New Site]                                                │
│                                                                     │
│ ENVIRONMENT                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Production                                                  [▾] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Last deployed: 2 hours ago                                      │ │
│ │ Deploy time: 45 seconds                                         │ │
│ │ [View Site ↗] [View Deploy History]                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│                                                  [🚀 Deploy Now]   │
└─────────────────────────────────────────────────────────────────────┘
```

#### Deploy Progress

```
┌─────────────────────────────────────────────────────────────────────┐
│ Deploying to Netlify...                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  35%                      │
│                                                                     │
│ ✓ Building project                                                 │
│ ✓ Exporting files (127 files)                                      │
│ ◐ Uploading to Netlify...                                          │
│ ○ Finalizing deploy                                                │
│                                                                     │
│                                                        [Cancel]    │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/DeployService.ts`
2. `packages/noodl-editor/src/editor/src/services/deploy/DeployProvider.ts`
3. `packages/noodl-editor/src/editor/src/services/deploy/providers/NetlifyProvider.ts`
4. `packages/noodl-editor/src/editor/src/services/deploy/providers/VercelProvider.ts`
5. `packages/noodl-editor/src/editor/src/services/deploy/providers/GitHubPagesProvider.ts`
6. `packages/noodl-editor/src/editor/src/services/deploy/providers/CloudflareProvider.ts`
7. `packages/noodl-core-ui/src/components/deploy/DeployPanel/DeployPanel.tsx`
8. `packages/noodl-core-ui/src/components/deploy/DeployProgress/DeployProgress.tsx`
9. `packages/noodl-core-ui/src/components/deploy/SiteSelector/SiteSelector.tsx`
10. `packages/noodl-core-ui/src/components/deploy/PlatformSelector/PlatformSelector.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/views/DeployPopup/DeployPopup.tsx`
   - Add platform tabs
   - Integrate new deploy flow

2. `packages/noodl-editor/src/editor/src/utils/compilation/compilation.ts`
   - Add deploy to platform method
   - Hook into build scripts

3. `packages/noodl-editor/src/main/src/main.js`
   - Add deep link handlers for OAuth callbacks

4. `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
   - Store deploy target configuration

## Implementation Steps

### Phase 1: Service Architecture
1. Create DeployService
2. Define DeployProvider interface
3. Implement provider registration
4. Set up token storage

### Phase 2: Netlify Integration
1. Implement NetlifyProvider
2. Add OAuth flow
3. Implement site listing
4. Implement deployment

### Phase 3: Vercel Integration
1. Implement VercelProvider
2. Add OAuth flow
3. Implement deployment

### Phase 4: GitHub Pages Integration
1. Implement GitHubPagesProvider
2. Reuse GitHub OAuth
3. Implement gh-pages deployment

### Phase 5: UI Components
1. Create DeployPanel
2. Create platform/site selectors
3. Create progress indicator
4. Integrate with existing popup

### Phase 6: Testing & Polish
1. Test each provider
2. Error handling
3. Progress accuracy
4. Deploy history

## Testing Checklist

- [ ] Netlify OAuth works
- [ ] Netlify site listing works
- [ ] Netlify deployment succeeds
- [ ] Vercel OAuth works
- [ ] Vercel deployment succeeds
- [ ] GitHub Pages deployment works
- [ ] Progress indicator accurate
- [ ] Error messages helpful
- [ ] Deploy history shows
- [ ] Site links work
- [ ] Token storage secure
- [ ] Disconnect works

## Dependencies

- GIT-001 (GitHub OAuth) - for GitHub Pages

## Blocked By

- None (can start immediately)

## Blocks

- DEPLOY-002 (Preview Deployments)
- DEPLOY-003 (Deploy Settings)

## Estimated Effort

- Service architecture: 4-5 hours
- Netlify provider: 5-6 hours
- Vercel provider: 4-5 hours
- GitHub Pages provider: 4-5 hours
- Cloudflare provider: 4-5 hours
- UI components: 5-6 hours
- Testing & polish: 4-5 hours
- **Total: 30-37 hours**

## Success Criteria

1. One-click deploy to Netlify works
2. One-click deploy to Vercel works
3. One-click deploy to GitHub Pages works
4. Site creation from editor works
5. Deploy progress visible
6. Deploy history accessible

## Platform-Specific Notes

### Netlify
- Uses digest-based uploads (efficient)
- Supports deploy previews (branch deploys)
- Has good API documentation
- Free tier: 100GB bandwidth/month

### Vercel
- File-based deployment API
- Automatic HTTPS
- Edge functions support
- Free tier: 100GB bandwidth/month

### GitHub Pages
- No OAuth app needed (reuse GitHub)
- Limited to public repos on free tier
- Jekyll processing (can disable with .nojekyll)
- Free for public repos

### Cloudflare Pages
- Similar to Netlify/Vercel
- Global CDN
- Free tier generous

## Future Enhancements

- AWS S3 + CloudFront
- Firebase Hosting
- Surge.sh
- Custom server deployment (SFTP/SSH)
- Docker container deployment
