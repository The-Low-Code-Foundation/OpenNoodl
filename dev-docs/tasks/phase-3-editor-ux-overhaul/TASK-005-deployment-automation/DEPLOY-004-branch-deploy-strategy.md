# DEPLOY-004: Git Branch Deploy Strategy

## Overview

Enable deployment through dedicated Git branches rather than direct platform API integration. Users can deploy their frontend to an orphan branch (e.g., `main_front`) which hosting platforms like Vercel, Netlify, or GitHub Pages can watch for automatic deployments.

**The key insight**: One repository contains both the Noodl project source AND the deployable frontend, but on separate branches with no shared history.

**Phase:** 3 (Deployment Automation)  
**Priority:** HIGH (simplifies deployment for regular users)  
**Effort:** 10-14 hours  
**Risk:** Low (standard Git operations, no new platform integrations)

**Depends on:** GIT-001 (GitHub OAuth), GIT-003 (Repository operations)

---

## Strategic Value

### Why Branch-Based Deployment?

| Approach | Pros | Cons |
|----------|------|------|
| **Platform APIs** (DEPLOY-001) | Full control, rich features | OAuth per platform, API complexity |
| **GitHub Actions** (DEPLOY-001-README) | Flexible pipelines | Workflow YAML complexity |
| **Branch Deploy** (this task) | Simple, works everywhere | Less automation |

**Target user**: "Regular Jo/Jane" who wants to:
- Keep everything in one GitHub repo
- Not set up OAuth with Vercel/Netlify
- Just click "Deploy" and have it work

### Repository Structure

```
my-noodl-project/                 (single GitHub repository)
│
├── main branch (Noodl source)
│   ├── project.json
│   ├── components/
│   ├── variants/
│   └── .noodl/
│
├── dev branch (Noodl source - development)
│   └── [same structure as main]
│
├── main_front branch (ORPHAN - production deploy)
│   ├── index.html
│   ├── noodl.js
│   └── noodl_bundles/
│
└── dev_front branch (ORPHAN - staging deploy)
    └── [same structure as main_front]
```

---

## User Experience

### Deploy Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Deploy                                                    [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ DEPLOYMENT METHOD                                               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Deploy to Platform (Vercel, Netlify...)                   │ │
│ │ ● Deploy to Git Branch                            [?]       │ │
│ │ ○ Deploy to Local Folder                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ TARGET BRANCH                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ main_front                                              [▾] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ☑ Create branch if it doesn't exist                            │
│                                                                 │
│ ENVIRONMENT                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Production                                              [▾] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ℹ️ Deploy to a Git branch that Vercel/Netlify can watch.    │ │
│ │    Set up your hosting platform to deploy from this branch. │ │
│ │                                                             │ │
│ │ 📖 Setup Guide: Vercel | Netlify | GitHub Pages             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ADVANCED                                              [expand ▾]│
│                                                                 │
│                                              [🚀 Deploy Now]    │
└─────────────────────────────────────────────────────────────────┘
```

### Advanced Options (Expanded)

```
│ ADVANCED                                              [collapse]│
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Custom Remote URL (optional)                                │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ https://github.com/myorg/my-frontend-deploy.git         │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │ ℹ️ Leave empty to use same repo as project                  │ │
│ │                                                             │ │
│ │ Commit Message                                              │ │
│ │ ┌─────────────────────────────────────────────────────────┐ │ │
│ │ │ Deploy: v1.2.3 - Added login feature                    │ │ │
│ │ └─────────────────────────────────────────────────────────┘ │ │
│ │ ☐ Auto-generate from git log                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
```

### First-Time Setup Instructions

After first deploy, show setup guide:

```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Deployed to main_front branch!                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ NEXT STEP: Connect your hosting platform                        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ VERCEL                                                      │ │
│ │ 1. Go to vercel.com → Import Git Repository                 │ │
│ │ 2. Select: myorg/my-noodl-project                           │ │
│ │ 3. Set "Production Branch" to: main_front                   │ │
│ │ 4. Deploy!                                                  │ │
│ │                                                             │ │
│ │ Your site will auto-update every time you deploy here.      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Show Netlify Instructions] [Show GitHub Pages Instructions]    │
│                                                                 │
│                                            [Done] [Don't show]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Orphan Branch Strategy

Orphan branches have no commit history shared with other branches:

```bash
# Creating orphan branch (what the editor does behind the scenes)
git checkout --orphan main_front
git rm -rf .                    # Clear working directory
# ... copy deploy files ...
git add .
git commit -m "Deploy: Initial deployment"
git push origin main_front
```

**Why orphan?**
- Clean separation between source and build
- No confusing merge history
- Smaller branch (no source file history)
- Simpler mental model for users

### Deploy Service Extension

```typescript
// packages/noodl-editor/src/editor/src/services/deploy/BranchDeployProvider.ts

interface BranchDeployConfig {
  targetBranch: string;           // e.g., "main_front"
  customRemoteUrl?: string;       // Optional different repo
  commitMessage?: string;         // Custom or auto-generated
  createIfNotExists: boolean;     // Auto-create orphan branch
}

interface BranchDeployResult {
  success: boolean;
  branch: string;
  commitSha: string;
  remoteUrl: string;
  isNewBranch: boolean;
  error?: string;
}

class BranchDeployProvider {
  /**
   * Deploy built files to a Git branch
   */
  async deploy(
    projectPath: string,
    buildOutputPath: string,
    config: BranchDeployConfig
  ): Promise<BranchDeployResult> {
    // 1. Build the project (reuse existing deployToFolder)
    // 2. Check if target branch exists
    // 3. If not and createIfNotExists, create orphan branch
    // 4. Checkout target branch (in temp directory to avoid messing with project)
    // 5. Clear branch contents
    // 6. Copy build output
    // 7. Commit with message
    // 8. Push to remote
    // 9. Return result
  }
  
  /**
   * Check if orphan branch exists on remote
   */
  async branchExists(remoteName: string, branchName: string): Promise<boolean>;
  
  /**
   * Create new orphan branch
   */
  async createOrphanBranch(branchName: string): Promise<void>;
  
  /**
   * Get suggested branch name based on source branch
   */
  getSuggestedDeployBranch(sourceBranch: string): string {
    // main -> main_front
    // dev -> dev_front
    // feature/login -> feature/login_front (or just use dev_front?)
    return `${sourceBranch}_front`;
  }
}
```

### Environment Branch Mapping

```typescript
// Default environment → branch mapping
const DEFAULT_BRANCH_MAPPING: Record<string, string> = {
  'production': 'main_front',
  'staging': 'dev_front',
  'preview': 'preview_front'  // For PR previews
};

// User can customize in project settings
interface DeployBranchSettings {
  environments: Array<{
    name: string;
    sourceBranch: string;      // Which source branch this env is for
    deployBranch: string;      // Where to deploy
    customRemote?: string;     // Optional different repo
  }>;
}

// Example user config:
{
  "environments": [
    { "name": "Production", "sourceBranch": "main", "deployBranch": "main_front" },
    { "name": "Staging", "sourceBranch": "dev", "deployBranch": "dev_front" },
    { "name": "QA", "sourceBranch": "dev", "deployBranch": "qa_front", 
      "customRemote": "https://github.com/myorg/qa-deployments.git" }
  ]
}
```

### Integration with Existing Deploy Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Existing Deploy System                        │
│                                                                 │
│  DeployPopup                                                    │
│      │                                                          │
│      ├── DeployToFolderTab (existing)                          │
│      │       └── Uses: deployer.ts → deployToFolder()          │
│      │                                                          │
│      ├── DeployToPlatformTab (DEPLOY-001)                      │
│      │       └── Uses: NetlifyProvider, VercelProvider, etc.   │
│      │                                                          │
│      └── DeployToBranchTab (NEW - this task)                   │
│              └── Uses: BranchDeployProvider                     │
│                    └── Internally calls deployToFolder()        │
│                    └── Then pushes to Git branch                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Branch Deploy (4-5 hours)

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/deploy/
├── BranchDeployProvider.ts      # Core deployment logic
└── BranchDeployConfig.ts        # Types and defaults
```

**Tasks:**
1. Create BranchDeployProvider class
2. Implement orphan branch detection
3. Implement orphan branch creation
4. Implement deploy-to-branch flow
5. Handle both same-repo and custom-remote scenarios
6. Add proper error handling

**Success Criteria:**
- [ ] Can deploy to existing orphan branch
- [ ] Can create new orphan branch if needed
- [ ] Works with same repo as project
- [ ] Works with custom remote URL
- [ ] Proper error messages for auth failures

### Phase 2: UI Integration (3-4 hours)

**Files to Create:**
```
packages/noodl-editor/src/editor/src/views/DeployPopup/tabs/
├── DeployToBranchTab/
│   ├── DeployToBranchTab.tsx
│   ├── DeployToBranchTab.module.scss
│   ├── BranchSelector.tsx
│   └── SetupGuideDialog.tsx
```

**Files to Modify:**
```
packages/noodl-editor/src/editor/src/views/DeployPopup/DeployPopup.tsx
  - Add new tab for branch deployment
```

**Tasks:**
1. Create DeployToBranchTab component
2. Implement branch selector dropdown
3. Implement environment selector
4. Create setup guide dialog (Vercel, Netlify, GitHub Pages)
5. Add advanced options panel
6. Integrate with DeployPopup tabs

**Success Criteria:**
- [ ] New tab appears in deploy popup
- [ ] Branch selector shows existing deploy branches
- [ ] Can create new branch from UI
- [ ] Setup guide shows after first deploy
- [ ] Advanced options work (custom remote, commit message)

### Phase 3: Environment Configuration (2-3 hours)

**Files to Modify:**
```
packages/noodl-editor/src/editor/src/views/panels/ProjectSettingsPanel/
  - Add DeployBranchesSection.tsx

packages/noodl-editor/src/editor/src/models/projectmodel.ts
  - Add deploy branch settings storage
```

**Tasks:**
1. Add deploy branch settings to project model
2. Create UI for managing environment → branch mapping
3. Implement custom remote URL per environment
4. Save/load settings from project.json

**Success Criteria:**
- [ ] Can configure multiple environments
- [ ] Can set custom deploy branch per environment
- [ ] Can set custom remote per environment
- [ ] Settings persist in project

### Phase 4: Polish & Documentation (1-2 hours)

**Tasks:**
1. Add loading states and progress indication
2. Improve error messages with actionable guidance
3. Add tooltips and help text
4. Create user documentation
5. Add platform-specific setup guides

**Success Criteria:**
- [ ] Clear feedback during deploy
- [ ] Helpful error messages
- [ ] Documentation complete

---

## Files Summary

### Create (New)

```
packages/noodl-editor/src/editor/src/services/deploy/
├── BranchDeployProvider.ts
└── BranchDeployConfig.ts

packages/noodl-editor/src/editor/src/views/DeployPopup/tabs/DeployToBranchTab/
├── DeployToBranchTab.tsx
├── DeployToBranchTab.module.scss
├── BranchSelector.tsx
├── EnvironmentSelector.tsx
└── SetupGuideDialog.tsx

packages/noodl-editor/src/editor/src/views/panels/ProjectSettingsPanel/sections/
└── DeployBranchesSection.tsx
```

### Modify

```
packages/noodl-editor/src/editor/src/views/DeployPopup/DeployPopup.tsx
  - Add DeployToBranchTab

packages/noodl-editor/src/editor/src/models/projectmodel.ts
  - Add deployBranches settings

packages/noodl-git/src/git.ts
  - Add createOrphanBranch method
  - Add pushToBranch method (if not exists)
```

---

## Testing Checklist

- [ ] Deploy to new orphan branch (creates it)
- [ ] Deploy to existing orphan branch (updates it)
- [ ] Deploy with custom remote URL
- [ ] Deploy with custom commit message
- [ ] Environment selector works
- [ ] Branch selector shows correct branches
- [ ] Setup guide displays correctly
- [ ] Works when project has uncommitted changes
- [ ] Works when project has no remote yet
- [ ] Error handling for auth failures
- [ ] Error handling for network issues
- [ ] Progress indication accurate

---

## User Documentation Outline

### "Deploying with Git Branches"

1. **What is Branch Deploy?**
   - Your project source and deployed app live in the same repo
   - Source on `main`, deployed app on `main_front`
   - Hosting platforms watch the deploy branch

2. **First-Time Setup**
   - Click Deploy → "Deploy to Git Branch"
   - Choose branch name (default: `main_front`)
   - Click Deploy
   - Follow setup guide for your hosting platform

3. **Connecting Vercel**
   - Step-by-step with screenshots

4. **Connecting Netlify**
   - Step-by-step with screenshots

5. **Connecting GitHub Pages**
   - Step-by-step with screenshots

6. **Multiple Environments**
   - Setting up staging with `dev_front`
   - Custom branch names

7. **Using a Separate Repository**
   - When you might want this
   - How to configure custom remote

---

## Dependencies

- **GIT-001**: GitHub OAuth (for push access)
- **GIT-003**: Repository operations (branch management)
- **Existing**: `deployer.ts` (for building files)

## Blocked By

- GIT-001 (OAuth required for push)

## Enables

- DEPLOY-002 (Preview Deployments) - can use `pr-{number}_front` branches
- Simpler onboarding for new users

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Adoption | 40% of deploys use branch method within 3 months |
| Setup completion | 80% complete hosting platform connection |
| Error rate | < 5% deploy failures |
| User satisfaction | Positive feedback on simplicity |

---

## Future Enhancements (Out of Scope)

- Auto-deploy on source branch push (would require webhook or polling)
- Branch protection rules management
- Automatic cleanup of old preview branches
- Integration with GitHub Environments for secrets
