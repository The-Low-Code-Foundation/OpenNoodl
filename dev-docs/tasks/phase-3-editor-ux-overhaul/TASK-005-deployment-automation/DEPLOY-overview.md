# DEPLOY Series: Deployment Automation

## Overview

The DEPLOY series transforms Noodl's deployment from manual folder exports into a modern, automated deployment pipeline. Users can deploy to popular hosting platforms with one click, get automatic preview URLs for each branch, and manage environment variables and domains directly from the editor.

## Target Environment

- **Editor**: React 19 version only
- **Platforms**: Netlify, Vercel, GitHub Pages, Cloudflare Pages
- **Backwards Compatibility**: Existing deploy-to-folder continues to work

## Task Dependency Graph

```
DEPLOY-001 (One-Click Deploy)
    │
    ├─────────────────────┐
    ↓                     ↓
DEPLOY-002 (Previews)  DEPLOY-003 (Settings)
```

## Task Summary

| Task ID | Name | Est. Hours | Priority |
|---------|------|------------|----------|
| DEPLOY-001 | One-Click Deploy Integrations | 30-37 | Critical |
| DEPLOY-002 | Preview Deployments | 24-31 | High |
| DEPLOY-003 | Deploy Settings & Environment Variables | 28-36 | High |

**Total Estimated: 82-104 hours**

## Implementation Order

### Phase 1: Core Deployment (Weeks 1-2)
1. **DEPLOY-001** - One-click deploy to platforms
   - Establishes provider architecture
   - OAuth flows for each platform
   - Core deployment functionality

### Phase 2: Preview & Settings (Weeks 3-4)
2. **DEPLOY-002** - Preview deployments
   - Branch-based previews
   - PR integration
   - Sharing features

3. **DEPLOY-003** - Deploy settings
   - Environment variables
   - Custom domains
   - Deploy rules

## Existing Infrastructure

### Deployer

```typescript
// packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts
export async function deployToFolder({
  project,
  direntry,
  environment,
  baseUrl,
  envVariables,
  runtimeType = 'deploy'
}: DeployToFolderOptions)
```

### Compilation

```typescript
// packages/noodl-editor/src/editor/src/utils/compilation/compilation.ts
class Compilation {
  deployToFolder(direntry, options): Promise<void>;
  // Build scripts system for pre/post deploy
}
```

### Deploy UI

```typescript
// Current deploy popup with folder selection
DeployToFolderTab.tsx
DeployPopup.tsx
```

### Cloud Services

```typescript
// packages/noodl-editor/src/editor/src/models/CloudServices.ts
interface Environment {
  id: string;
  name: string;
  url: string;
  appId: string;
  masterKey?: string;
}
```

## New Architecture

### Service Layer

```
packages/noodl-editor/src/editor/src/services/
├── DeployService.ts              # Central deployment service
├── PreviewDeployService.ts       # Preview management
├── EnvironmentConfigService.ts   # Env vars & profiles
├── DomainService.ts              # Custom domain management
├── DeployRulesService.ts         # Automation rules
└── deploy/
    ├── DeployProvider.ts         # Provider interface
    └── providers/
        ├── NetlifyProvider.ts
        ├── VercelProvider.ts
        ├── GitHubPagesProvider.ts
        └── CloudflareProvider.ts
```

### Provider Interface

```typescript
interface DeployProvider {
  readonly platform: DeployPlatform;
  readonly name: string;
  
  // Authentication
  authenticate(): Promise<AuthResult>;
  isAuthenticated(): boolean;
  
  // Sites
  listSites(): Promise<Site[]>;
  createSite(name: string): Promise<Site>;
  
  // Deployment
  deploy(siteId: string, files: DeployFiles): Promise<DeployResult>;
  getDeployStatus(deployId: string): Promise<DeployStatus>;
  
  // Configuration
  getEnvVariables(siteId: string): Promise<Record<string, string>>;
  setEnvVariables(siteId: string, vars: Record<string, string>): Promise<void>;
}
```

## Platform Comparison

| Feature | Netlify | Vercel | GitHub Pages | Cloudflare |
|---------|---------|--------|--------------|------------|
| OAuth | ✓ | ✓ | Via GitHub | ✓ |
| Preview Deploys | ✓ | ✓ | Manual | ✓ |
| Custom Domains | ✓ | ✓ | ✓ | ✓ |
| Env Variables | ✓ | ✓ | Secrets only | ✓ |
| Deploy Hooks | ✓ | ✓ | Actions | ✓ |
| Free Tier | 100GB/mo | 100GB/mo | Unlimited* | 100K/day |

*GitHub Pages: Free for public repos, requires Pro for private

## Key User Flows

### 1. First-Time Deploy

```
User clicks "Deploy"
    ↓
Select platform (Netlify, Vercel, etc.)
    ↓
Authenticate with platform (OAuth)
    ↓
Create new site or select existing
    ↓
Configure environment variables
    ↓
Deploy → Get live URL
```

### 2. Subsequent Deploys

```
User clicks "Deploy"
    ↓
Site already linked
    ↓
One-click deploy
    ↓
Progress indicator
    ↓
Success → Link to site
```

### 3. Preview Workflow

```
User pushes feature branch
    ↓
Auto-deploy preview
    ↓
Comment on PR with preview URL
    ↓
Stakeholder reviews
    ↓
Merge → Production deploy
    ↓
Preview auto-cleaned
```

## UI Components to Create

| Component | Package | Purpose |
|-----------|---------|---------|
| DeployPanel | noodl-core-ui | Main deploy interface |
| PlatformSelector | noodl-core-ui | Platform choice |
| SiteSelector | noodl-core-ui | Site choice |
| DeployProgress | noodl-core-ui | Progress indicator |
| PreviewManager | noodl-core-ui | Preview list |
| EnvironmentVariables | noodl-core-ui | Var management |
| CustomDomains | noodl-core-ui | Domain setup |
| DeployRules | noodl-core-ui | Automation rules |

## Data Models

### Deploy Target

```typescript
interface DeployTarget {
  id: string;
  name: string;
  platform: DeployPlatform;
  siteId: string;
  siteName: string;
  url: string;
  customDomain?: string;
  lastDeployedAt?: string;
}
```

### Preview Deployment

```typescript
interface PreviewDeployment {
  id: string;
  projectId: string;
  branch: string;
  commitSha: string;
  url: string;
  status: PreviewStatus;
  createdAt: string;
  expiresAt?: string;
}
```

### Environment Profile

```typescript
interface EnvironmentProfile {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
  isDefault: boolean;
}

interface EnvironmentVariable {
  key: string;
  value: string;
  sensitive: boolean;
}
```

## Security Considerations

### Token Storage
- OAuth tokens stored in electron safeStorage
- Never logged or displayed
- Cleared on disconnect

### Sensitive Variables
- Encrypted at rest
- Masked in UI (•••••)
- Never exported to .env without warning

### Platform Security
- Minimum OAuth scopes
- Token refresh handling
- Secure redirect handling

## Testing Strategy

### Unit Tests
- Provider method isolation
- Token handling
- File preparation

### Integration Tests
- OAuth flow mocking
- Deploy API mocking
- Full deploy cycle

### Manual Testing
- Real deployments to each platform
- Custom domain setup
- Preview workflow

## Cline Usage Notes

### Before Starting Each Task

1. Review existing deployment infrastructure:
   - `deployer.ts`
   - `compilation.ts`
   - `DeployPopup/`

2. Understand build output:
   - How project.json is exported
   - How bundles are created
   - How index.html is generated

### Key Integration Points

1. **Compilation**: Use existing `deployToFolder` for file preparation
2. **Cloud Services**: Existing environment model can inform design
3. **Git Integration**: Leverage GIT series for branch awareness

### Platform API Notes

- **Netlify**: Uses digest-based upload (SHA1 hashes)
- **Vercel**: File-based deployment API
- **GitHub Pages**: Git-based via GitHub API
- **Cloudflare**: Similar to Netlify/Vercel

## Success Criteria (Series Complete)

1. ✅ One-click deploy to 4 platforms
2. ✅ OAuth authentication flow works
3. ✅ Site creation from editor works
4. ✅ Preview deploys auto-generated
5. ✅ PR comments posted automatically
6. ✅ Environment variables managed
7. ✅ Custom domains configurable
8. ✅ Deploy rules automate workflow

## Future Work (Post-DEPLOY)

The DEPLOY series enables:
- **CI/CD Integration**: Connect to GitHub Actions, GitLab CI
- **Performance Monitoring**: Lighthouse scores per deploy
- **A/B Testing**: Deploy variants to subsets
- **Rollback**: One-click rollback to previous deploy
- **Multi-Region**: Deploy to multiple regions

## Files in This Series

- `DEPLOY-001-one-click-deploy.md`
- `DEPLOY-002-preview-deployments.md`
- `DEPLOY-003-deploy-settings.md`
- `DEPLOY-OVERVIEW.md` (this file)

## External Dependencies

### Platform OAuth

| Platform | OAuth Type | Client ID Required |
|----------|------------|-------------------|
| Netlify | OAuth 2.0 | Yes |
| Vercel | OAuth 2.0 | Yes |
| GitHub | OAuth 2.0 | From GIT-001 |
| Cloudflare | OAuth 2.0 | Yes |

### API Endpoints

- Netlify: `api.netlify.com/api/v1`
- Vercel: `api.vercel.com/v13`
- GitHub: `api.github.com`
- Cloudflare: `api.cloudflare.com/client/v4`

## Complete Roadmap Summary

With the DEPLOY series complete, the full OpenNoodl modernization roadmap includes:

| Series | Tasks | Hours | Focus |
|--------|-------|-------|-------|
| DASH | 4 tasks | 43-63 | Dashboard UX |
| GIT | 5 tasks | 68-96 | Git integration |
| COMP | 6 tasks | 117-155 | Shared components |
| AI | 4 tasks | 121-154 | AI assistance |
| DEPLOY | 3 tasks | 82-104 | Deployment |

**Grand Total: 22 tasks, 431-572 hours**
