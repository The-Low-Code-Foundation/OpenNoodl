# DEPLOY-002: Preview Deployments

## Overview

Enable automatic preview deployments for each git branch or commit. When users push changes, a preview URL is automatically generated so stakeholders can review before merging to production.

## Context

Currently, sharing work-in-progress requires:
1. Manual deploy to a staging site
2. Share URL with stakeholders
3. Remember which deploy corresponds to which version
4. Manually clean up old deploys

Preview deployments provide:
- Automatic URL per branch/PR
- Easy sharing with stakeholders
- Visual history of changes
- Automatic cleanup

This is especially valuable for:
- Design reviews
- QA testing
- Client approvals
- Team collaboration

### Integration with GIT Series

From GIT-002:
- Git status tracking per project
- Branch awareness
- Commit detection

This task leverages that infrastructure to trigger preview deploys.

## Requirements

### Functional Requirements

1. **Automatic Previews**
   - Deploy preview on branch push
   - Unique URL per branch
   - Update preview on new commits
   - Delete preview on branch delete

2. **Manual Previews**
   - "Deploy Preview" button in editor
   - Generate shareable URL
   - Named previews (optional)
   - Expiration settings

3. **Preview Management**
   - List all active previews
   - View preview URL
   - Delete individual previews
   - Set auto-cleanup rules

4. **Sharing**
   - Copy preview URL
   - QR code for mobile
   - Optional password protection
   - Expiration timer

5. **Integration with PRs**
   - Comment preview URL on PR
   - Update comment on new commits
   - Status check integration

### Non-Functional Requirements

- Preview available within 2 minutes
- Support 10+ concurrent previews
- Auto-cleanup after configurable period
- Works with all deploy providers

## Technical Approach

### 1. Preview Service

```typescript
// packages/noodl-editor/src/editor/src/services/PreviewDeployService.ts

interface PreviewDeployment {
  id: string;
  projectId: string;
  branch: string;
  commitSha: string;
  url: string;
  platform: DeployPlatform;
  siteId: string;
  status: PreviewStatus;
  createdAt: string;
  expiresAt?: string;
  password?: string;
  name?: string;
}

enum PreviewStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  READY = 'ready',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

interface PreviewConfig {
  enabled: boolean;
  autoDeployBranches: boolean;
  excludeBranches: string[];  // e.g., ['main', 'master']
  expirationDays: number;
  maxPreviews: number;
  passwordProtect: boolean;
  commentOnPR: boolean;
}

class PreviewDeployService {
  private static instance: PreviewDeployService;
  
  // Preview management
  async createPreview(options: CreatePreviewOptions): Promise<PreviewDeployment>;
  async updatePreview(previewId: string): Promise<PreviewDeployment>;
  async deletePreview(previewId: string): Promise<void>;
  async listPreviews(projectId: string): Promise<PreviewDeployment[]>;
  
  // Auto-deployment
  async onBranchPush(projectId: string, branch: string, commitSha: string): Promise<void>;
  async onBranchDelete(projectId: string, branch: string): Promise<void>;
  
  // PR integration
  async commentOnPR(preview: PreviewDeployment): Promise<void>;
  async updatePRComment(preview: PreviewDeployment): Promise<void>;
  
  // Cleanup
  async cleanupExpiredPreviews(): Promise<void>;
  async enforceMaxPreviews(projectId: string): Promise<void>;
  
  // Configuration
  getConfig(projectId: string): PreviewConfig;
  setConfig(projectId: string, config: Partial<PreviewConfig>): void;
}
```

### 2. Branch-Based Preview Naming

```typescript
// Generate preview URLs based on branch
function generatePreviewUrl(platform: DeployPlatform, branch: string, projectName: string): string {
  const sanitizedBranch = sanitizeBranchName(branch);
  
  switch (platform) {
    case DeployPlatform.NETLIFY:
      // Netlify: branch--sitename.netlify.app
      return `https://${sanitizedBranch}--${projectName}.netlify.app`;
      
    case DeployPlatform.VERCEL:
      // Vercel: project-branch-hash.vercel.app
      return `https://${projectName}-${sanitizedBranch}.vercel.app`;
      
    case DeployPlatform.GITHUB_PAGES:
      // GitHub Pages: use subdirectory or separate branch
      return `https://${owner}.github.io/${repo}/preview/${sanitizedBranch}`;
      
    default:
      return '';
  }
}

function sanitizeBranchName(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}
```

### 3. Git Integration Hook

```typescript
// packages/noodl-editor/src/editor/src/services/PreviewDeployService.ts

// Hook into git operations
class PreviewDeployService {
  constructor() {
    // Listen for git events
    EventDispatcher.instance.on('git.push.success', this.handlePush.bind(this));
    EventDispatcher.instance.on('git.branch.delete', this.handleBranchDelete.bind(this));
  }
  
  private async handlePush(event: GitPushEvent): Promise<void> {
    const config = this.getConfig(event.projectId);
    
    if (!config.enabled || !config.autoDeployBranches) {
      return;
    }
    
    // Check if branch is excluded
    if (config.excludeBranches.includes(event.branch)) {
      return;
    }
    
    // Check if we already have a preview for this branch
    const existing = await this.findPreviewByBranch(event.projectId, event.branch);
    
    if (existing) {
      // Update existing preview
      await this.updatePreview(existing.id);
    } else {
      // Create new preview
      await this.createPreview({
        projectId: event.projectId,
        branch: event.branch,
        commitSha: event.commitSha
      });
    }
    
    // Comment on PR if enabled
    if (config.commentOnPR) {
      const pr = await this.findPRForBranch(event.projectId, event.branch);
      if (pr) {
        await this.commentOnPR(existing || await this.getLatestPreview(event.projectId, event.branch));
      }
    }
  }
  
  private async handleBranchDelete(event: GitBranchDeleteEvent): Promise<void> {
    const preview = await this.findPreviewByBranch(event.projectId, event.branch);
    if (preview) {
      await this.deletePreview(preview.id);
    }
  }
}
```

### 4. PR Comment Integration

```typescript
// packages/noodl-editor/src/editor/src/services/PreviewDeployService.ts

async commentOnPR(preview: PreviewDeployment): Promise<void> {
  const github = GitHubApiClient.instance;
  const project = ProjectModel.instance;
  const remote = project.getRemoteUrl();
  
  if (!remote || !remote.includes('github.com')) {
    return;  // Only GitHub PRs supported
  }
  
  const { owner, repo } = parseGitHubUrl(remote);
  const pr = await github.findPRByBranch(owner, repo, preview.branch);
  
  if (!pr) {
    return;
  }
  
  const commentBody = this.generatePRComment(preview);
  
  // Check for existing Noodl comment
  const existingComment = await github.findComment(owner, repo, pr.number, '<!-- noodl-preview -->');
  
  if (existingComment) {
    await github.updateComment(owner, repo, existingComment.id, commentBody);
  } else {
    await github.createComment(owner, repo, pr.number, commentBody);
  }
}

private generatePRComment(preview: PreviewDeployment): string {
  return `<!-- noodl-preview -->
## 🚀 Noodl Preview Deployment

| Status | URL |
|--------|-----|
| ${this.getStatusEmoji(preview.status)} ${preview.status} | [${preview.url}](${preview.url}) |

**Branch:** \`${preview.branch}\`  
**Commit:** \`${preview.commitSha.substring(0, 7)}\`  
**Updated:** ${new Date(preview.createdAt).toLocaleString()}

---
<sub>Deployed automatically by Noodl</sub>`;
}
```

### 5. UI Components

#### Preview Manager Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│ Preview Deployments                                           [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ACTIVE PREVIEWS (3)                                                │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🌿 feature/new-dashboard                           [Copy URL]  │ │
│ │    https://feature-new-dashboard--myapp.netlify.app            │ │
│ │    Updated 10 minutes ago • Commit abc1234                     │ │
│ │    [Open ↗] [QR Code] [Delete]                                 │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 🌿 feature/login-redesign                          [Copy URL]  │ │
│ │    https://feature-login-redesign--myapp.netlify.app           │ │
│ │    Updated 2 hours ago • Commit def5678                        │ │
│ │    [Open ↗] [QR Code] [Delete]                                 │ │
│ ├─────────────────────────────────────────────────────────────────┤ │
│ │ 🌿 bugfix/form-validation                          [Copy URL]  │ │
│ │    https://bugfix-form-validation--myapp.netlify.app           │ │
│ │    Updated yesterday • Commit ghi9012                          │ │
│ │    [Open ↗] [QR Code] [Delete]                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ SETTINGS                                                            │
│ ☑ Auto-deploy branches                                             │
│ ☑ Comment preview URL on PRs                                       │
│ Exclude branches: main, master                                     │
│ Auto-delete after: [7 days ▾]                                      │
│                                                                     │
│                                        [+ Create Manual Preview]   │
└─────────────────────────────────────────────────────────────────────┘
```

#### QR Code Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Share Preview                                                 [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                    ┌─────────────────┐                             │
│                    │ ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄│                             │
│                    │ █     █ █     █│                             │
│                    │ █ ███ █ █ ███ █│   Scan to open              │
│                    │ █     █ █     █│   on mobile                 │
│                    │ ▀▀▀▀▀▀▀ ▀▀▀▀▀▀▀│                             │
│                    └─────────────────┘                             │
│                                                                     │
│ feature/new-dashboard                                              │
│ https://feature-new-dashboard--myapp.netlify.app                   │
│                                                                     │
│                              [Copy URL]  [Download QR]  [Close]    │
└─────────────────────────────────────────────────────────────────────┘
```

#### Create Manual Preview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Create Preview                                                [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Preview Name (optional):                                           │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ client-review-dec-15                                           │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ Expires in:                                                         │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 7 days                                                      [▾] │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ☐ Password protect                                                 │
│   Password: [••••••••                                            ] │
│                                                                     │
│ Deploy from:                                                        │
│ ○ Current state (uncommitted changes included)                     │
│ ● Current branch (feature/new-dashboard)                           │
│ ○ Specific commit: [abc1234 ▾]                                     │
│                                                                     │
│                                      [Cancel]  [Create Preview]    │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/PreviewDeployService.ts`
2. `packages/noodl-core-ui/src/components/deploy/PreviewManager/PreviewManager.tsx`
3. `packages/noodl-core-ui/src/components/deploy/PreviewCard/PreviewCard.tsx`
4. `packages/noodl-core-ui/src/components/deploy/CreatePreviewModal/CreatePreviewModal.tsx`
5. `packages/noodl-core-ui/src/components/deploy/QRCodeModal/QRCodeModal.tsx`
6. `packages/noodl-core-ui/src/components/deploy/PreviewSettings/PreviewSettings.tsx`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/services/DeployService.ts`
   - Add preview deployment methods
   - Integrate with deploy providers

2. `packages/noodl-editor/src/editor/src/views/DeployPopup/DeployPopup.tsx`
   - Add "Previews" tab
   - Integrate PreviewManager

3. `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
   - Store preview configuration
   - Track active previews

4. `packages/noodl-editor/src/editor/src/services/GitHubApiClient.ts`
   - Add PR comment methods
   - Add PR lookup by branch

## Implementation Steps

### Phase 1: Preview Service
1. Create PreviewDeployService
2. Implement preview creation
3. Implement preview deletion
4. Add configuration storage

### Phase 2: Git Integration
1. Hook into push events
2. Hook into branch delete events
3. Implement auto-deployment
4. Test with branches

### Phase 3: PR Integration
1. Implement PR comment creation
2. Implement comment updating
3. Add status emoji handling
4. Test with GitHub PRs

### Phase 4: UI - Preview Manager
1. Create PreviewManager component
2. Create PreviewCard component
3. Add copy/share functionality
4. Implement delete action

### Phase 5: UI - Create Preview
1. Create CreatePreviewModal
2. Add expiration options
3. Add password protection
4. Add source selection

### Phase 6: UI - QR & Sharing
1. Create QRCodeModal
2. Add QR code generation
3. Add download option
4. Polish sharing UX

## Testing Checklist

- [ ] Auto-preview on push works
- [ ] Preview URL is correct
- [ ] PR comment created
- [ ] PR comment updated on new commit
- [ ] Manual preview creation works
- [ ] Preview deletion works
- [ ] Auto-cleanup works
- [ ] QR code generates correctly
- [ ] Password protection works
- [ ] Expiration works
- [ ] Multiple previews supported

## Dependencies

- DEPLOY-001 (One-Click Deploy) - for deploy providers
- GIT-001 (GitHub OAuth) - for PR comments
- GIT-002 (Git Status) - for branch awareness

## Blocked By

- DEPLOY-001

## Blocks

- None

## Estimated Effort

- Preview service: 5-6 hours
- Git integration: 4-5 hours
- PR integration: 3-4 hours
- UI preview manager: 4-5 hours
- UI create preview: 3-4 hours
- UI QR/sharing: 2-3 hours
- Testing & polish: 3-4 hours
- **Total: 24-31 hours**

## Success Criteria

1. Auto-preview deploys on branch push
2. Preview URL unique per branch
3. PR comments posted automatically
4. Manual previews can be created
5. QR codes work for mobile testing
6. Expired previews auto-cleaned

## Platform-Specific Implementation

### Netlify
- Branch deploys built-in
- URL pattern: `branch--site.netlify.app`
- Easy configuration

### Vercel
- Preview deployments automatic
- URL pattern: `project-branch-hash.vercel.app`
- Good GitHub integration

### GitHub Pages
- Need separate approach (subdirectory or deploy to different branch)
- Less native support for branch previews

## Future Enhancements

- Visual regression testing
- Screenshot comparison
- Performance metrics per preview
- A/B testing setup
- Preview environments (staging, QA)
- Slack/Teams notifications
