# DEPLOY-001: Deployment Automation via GitHub Actions

## Overview

Enable one-click deployments from Nodegex to multiple hosting targets (Vercel, Netlify, Cloudflare Pages, etc.) by leveraging GitHub Actions as the CI/CD orchestration layer. This builds directly on GIT-004's OAuth foundation and GitHubClient.

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** HIGH (completes the development lifecycle)  
**Total Effort:** 44-60 hours across 6 sub-tasks  
**Risk:** Medium (workflow complexity, multi-target support)

**Hard Dependency:** GIT-004A (OAuth & GitHubClient with Actions API)

---

## Strategic Value

### Complete Development Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    Nodegex Development Lifecycle                │
│                                                                 │
│   ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐    │
│   │Build │ ─► │ Git  │ ─► │ PR   │ ─► │Review│ ─► │Deploy│    │
│   │      │    │Commit│    │Create│    │Merge │    │      │    │
│   └──────┘    └──────┘    └──────┘    └──────┘    └──────┘    │
│       │                                               │        │
│       └───────────────────────────────────────────────┘        │
│                    All within Nodegex                          │
└─────────────────────────────────────────────────────────────────┘
```

### Why GitHub Actions?

| Approach | Build Time | Cost | Maintenance |
|----------|------------|------|-------------|
| Custom CI/CD | Months | $$$$$ | High |
| GitHub Actions | Days | Free* | GitHub's problem |

*Free for public repos, included in GitHub plans for private

---

## Feature Set

### Core Features

| Feature | Description | Sub-Task |
|---------|-------------|----------|
| **Deploy Button** | One-click deploy from editor toolbar | DEPLOY-001C |
| **Workflow Generator** | Auto-create GitHub Actions workflows | DEPLOY-001B |
| **Deploy Status** | Real-time build progress in editor | DEPLOY-001C |
| **Multi-Target** | Vercel, Netlify, Cloudflare, AWS, etc. | DEPLOY-001D |
| **PR Previews** | Auto-deploy preview for every PR | DEPLOY-001F |
| **Environments** | Manage prod, staging, dev configs | DEPLOY-001E |

### Integration with GIT-004

| GIT-004 Feature | DEPLOY-001 Enhancement |
|-----------------|------------------------|
| PR Panel | + Preview URL display |
| Dashboard Widgets | + Deployment status |
| Component Linking | + Deploy history per component |
| Issues | + Auto-create on deploy failure |

---

## Architecture

### Build on GitHubClient

```typescript
// GIT-004A creates the foundation
class GitHubClient {
  readonly issues: IssuesAPI;      // GIT-004B-D
  readonly pullRequests: PRsAPI;   // GIT-004C
  readonly actions: ActionsAPI;    // DEPLOY-001 uses this
  readonly repos: ReposAPI;        // For workflow file management
}

// DEPLOY-001 adds deployment-specific services
class DeploymentService {
  constructor(private github: GitHubClient) {}
  
  async triggerDeploy(environment: string): Promise<WorkflowRun> {
    return this.github.actions.triggerWorkflow(
      owner, repo, 'deploy.yml', 'main',
      { environment }
    );
  }
  
  async getDeploymentStatus(): Promise<DeploymentStatus> {
    const runs = await this.github.actions.listWorkflowRuns(owner, repo, {
      workflow_id: 'deploy.yml'
    });
    return this.parseDeploymentStatus(runs);
  }
}
```

### Workflow Generation

```typescript
// Template-based workflow generation
interface WorkflowTemplate {
  target: 'vercel' | 'netlify' | 'cloudflare' | 'aws' | 'github-pages';
  buildCommand: string;
  outputDir: string;
  nodeVersion: string;
  environments: string[];
}

class WorkflowGenerator {
  generate(template: WorkflowTemplate): string {
    return `
name: Deploy to ${template.target}
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'preview'
        type: choice
        options: [${template.environments.join(', ')}]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '${template.nodeVersion}'
      - run: npm ci
      - run: ${template.buildCommand}
      ${this.getTargetSteps(template)}
`;
  }
}
```

---

## Sub-Task Breakdown

### DEPLOY-001A: Actions API Integration (6-8 hours)

**Depends on:** GIT-004A  
**Branch:** `task/deploy-001a-actions-api`

Extend GitHubClient with full Actions API support and create React hooks for deployment state.

**Scope:**
- Add Actions API methods to GitHubClient
- Create `useWorkflows` hook
- Create `useWorkflowRuns` hook with polling
- Create `useDeploymentStatus` hook
- Add "Deployments" tab to GitHub Panel

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/github/
├── ActionsAPI.ts              # Actions API wrapper
└── DeploymentService.ts       # High-level deployment operations

packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── DeploymentsTab/
│       ├── DeploymentsList.tsx
│       ├── DeploymentItem.tsx
│       ├── DeploymentDetail.tsx
│       └── WorkflowRunStatus.tsx
├── hooks/
│   ├── useWorkflows.ts
│   ├── useWorkflowRuns.ts
│   └── useDeploymentStatus.ts
```

**Success Criteria:**
- [ ] Can list workflows for connected repo
- [ ] Can view workflow run history
- [ ] Real-time status polling works
- [ ] Deployments tab shows in GitHub Panel

---

### DEPLOY-001B: Workflow Generator (10-14 hours)

**Depends on:** DEPLOY-001A  
**Branch:** `task/deploy-001b-workflow-generator`

Create system to generate and commit GitHub Actions workflow files.

**Scope:**
- Workflow template engine
- Project analysis for build configuration detection
- Target-specific generators (start with Vercel)
- Commit workflow file to repository
- Setup wizard UI

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/deployment/
├── WorkflowGenerator.ts
├── WorkflowTemplates.ts
├── ProjectAnalyzer.ts          # Detect build config
└── types.ts

packages/noodl-editor/src/editor/src/views/deployment/
├── SetupWizard/
│   ├── SetupWizard.tsx
│   ├── TargetSelector.tsx
│   ├── ConfigurationStep.tsx
│   ├── ReviewStep.tsx
│   └── SetupWizard.module.scss
```

**Success Criteria:**
- [ ] Can detect project build configuration
- [ ] Can generate valid workflow YAML
- [ ] Setup wizard guides user through configuration
- [ ] Workflow committed to repo successfully
- [ ] Generated workflow runs successfully on GitHub

---

### DEPLOY-001C: Deploy Button & Status UI (8-12 hours)

**Depends on:** DEPLOY-001A  
**Branch:** `task/deploy-001c-deploy-button`

Add one-click deploy button to editor and real-time deployment status.

**Scope:**
- Deploy button in editor toolbar
- Environment selector dropdown
- Deployment progress popover
- Success/failure notifications
- Link to live URL on success
- Link to logs on failure

**Files to Create:**
```
packages/noodl-editor/src/editor/src/views/deployment/
├── DeployButton/
│   ├── DeployButton.tsx
│   ├── DeployButton.module.scss
│   ├── EnvironmentDropdown.tsx
│   └── DeployProgressPopover.tsx
├── DeployNotification.tsx
└── hooks/
    └── useDeployAction.ts
```

**Files to Modify:**
```
packages/noodl-editor/src/editor/src/views/EditorTopbar/
  - Add DeployButton component
```

**Success Criteria:**
- [ ] Deploy button visible in toolbar
- [ ] Can select environment (prod/staging/preview)
- [ ] Shows real-time progress during deployment
- [ ] Success notification with live URL
- [ ] Failure notification with link to logs
- [ ] Button disabled during active deployment

---

### DEPLOY-001D: Multi-Target Templates (8-10 hours)

**Depends on:** DEPLOY-001B  
**Branch:** `task/deploy-001d-multi-target`

Create workflow templates for all major hosting targets.

**Scope:**
- Vercel template (with preview deploys)
- Netlify template
- Cloudflare Pages template
- AWS Amplify template
- GitHub Pages template
- Custom/self-hosted template

**Files to Create:**
```
packages/noodl-editor/src/editor/src/services/deployment/
├── templates/
│   ├── vercel.ts
│   ├── netlify.ts
│   ├── cloudflare.ts
│   ├── aws-amplify.ts
│   ├── github-pages.ts
│   └── custom.ts
├── TargetDetector.ts           # Suggest target based on existing config
└── SecretsGuide.ts             # Per-target secrets documentation
```

**Success Criteria:**
- [ ] Each template generates valid, working workflow
- [ ] Templates include preview deploy support where applicable
- [ ] Secrets requirements documented per target
- [ ] Target auto-detection works (vercel.json → Vercel)

---

### DEPLOY-001E: Environment Management (6-8 hours)

**Depends on:** DEPLOY-001C  
**Branch:** `task/deploy-001e-environments`

Manage deployment environments (production, staging, development).

**Scope:**
- Environment configuration UI
- Environment-specific variables
- Deploy protection rules guidance
- Environment status dashboard

**Files to Create:**
```
packages/noodl-editor/src/editor/src/views/deployment/
├── EnvironmentManager/
│   ├── EnvironmentManager.tsx
│   ├── EnvironmentCard.tsx
│   ├── EnvironmentConfig.tsx
│   └── EnvironmentManager.module.scss
├── SecretsSetupGuide.tsx
```

**Success Criteria:**
- [ ] Can configure multiple environments
- [ ] Environment-specific deploy buttons work
- [ ] Clear guidance on secrets setup
- [ ] Environment status visible in dashboard

---

### DEPLOY-001F: PR Preview Integration (6-8 hours)

**Depends on:** DEPLOY-001D, GIT-004C  
**Branch:** `task/deploy-001f-pr-previews`

Integrate preview deployments with the PR panel.

**Scope:**
- Auto-deploy on PR creation/update
- Extract preview URL from workflow
- Display preview URL in PR detail
- Preview cleanup on PR close
- Comment on PR with preview link (optional)

**Files to Modify:**
```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
  components/PullRequestsTab/PRDetail.tsx
  - Add preview URL section
  - Add "Open Preview" button

packages/noodl-editor/src/editor/src/services/deployment/
  templates/*.ts
  - Ensure all templates support preview deploys
```

**Success Criteria:**
- [ ] PRs show preview URL when available
- [ ] Preview URL extracted from workflow run
- [ ] "Open Preview" button works
- [ ] Preview status shows (building/ready/failed)

---

## Implementation Order

```
Week 1:
└── DEPLOY-001A: Actions API Integration (6-8 hrs)

Week 2:
├── DEPLOY-001B: Workflow Generator (10-14 hrs)
└── DEPLOY-001C: Deploy Button (start)

Week 3:
├── DEPLOY-001C: Deploy Button (complete) (8-12 hrs)
└── DEPLOY-001D: Multi-Target Templates (8-10 hrs)

Week 4:
├── DEPLOY-001E: Environment Management (6-8 hrs)
└── DEPLOY-001F: PR Previews (6-8 hrs)

Week 5:
└── Integration testing & polish
```

---

## Testing Checklist

### Workflow Generation
- [ ] Vercel workflow builds and deploys successfully
- [ ] Netlify workflow builds and deploys successfully
- [ ] Preview deploys create unique URLs
- [ ] Environment variables passed correctly

### Deploy Button
- [ ] Triggers correct workflow
- [ ] Shows accurate progress
- [ ] Handles concurrent deploy attempts
- [ ] Error states display correctly

### PR Previews
- [ ] Preview URL appears in PR panel
- [ ] URL is correct and accessible
- [ ] Preview updates on new commits
- [ ] Status shows building/ready/failed

### Dashboard Integration
- [ ] Deployment status shows on project cards
- [ ] Recent deploys in activity feed
- [ ] Click-through to deployment details works

---

## OAuth Permissions

Ensure GIT-004A requests the `workflow` scope:

```typescript
const OAUTH_SCOPES = [
  'repo',       // Code, issues, PRs
  'read:user',  // User profile
  'workflow',   // Trigger and manage workflows ← Required for DEPLOY-001
];
```

---

## Files Summary

### Create (New)
```
packages/noodl-editor/src/editor/src/services/
├── github/
│   ├── ActionsAPI.ts
│   └── DeploymentService.ts
└── deployment/
    ├── WorkflowGenerator.ts
    ├── WorkflowTemplates.ts
    ├── ProjectAnalyzer.ts
    ├── TargetDetector.ts
    ├── templates/
    │   ├── vercel.ts
    │   ├── netlify.ts
    │   ├── cloudflare.ts
    │   ├── aws-amplify.ts
    │   ├── github-pages.ts
    │   └── custom.ts
    └── types.ts

packages/noodl-editor/src/editor/src/views/
├── deployment/
│   ├── SetupWizard/
│   ├── DeployButton/
│   ├── EnvironmentManager/
│   └── SecretsSetupGuide.tsx
└── panels/GitHubPanel/components/
    └── DeploymentsTab/
```

### Modify
```
packages/noodl-editor/src/editor/src/services/github/GitHubClient.ts
  - Add actions API support (may already be in GIT-004A)

packages/noodl-editor/src/editor/src/views/EditorTopbar/
  - Add DeployButton

packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
  - Add DeploymentsTab
  - Enhance PRDetail with preview URL

packages/noodl-editor/src/editor/src/views/Dashboard/
  - Add deployment status to project cards
```

---

## Dependencies

### NPM Packages

```json
{
  "js-yaml": "^4.1.0"  // For workflow YAML generation
}
```

(Most dependencies already covered by GIT-004)

### Blocked By

- **GIT-004A**: OAuth & GitHubClient (hard dependency)
- **GIT-004C**: PR Panel (for PR preview integration)
- **GIT-004F**: Dashboard Widgets (for deployment status display)

### Blocks

- Future: Rollback UI
- Future: Deploy scheduling
- Future: A/B deployments

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Setup completion | 70% | Users who complete wizard |
| Deploy frequency | 5/week | Average deploys per active project |
| Deploy success rate | 95% | Successful / total deploys |
| Time to first deploy | < 10 min | From wizard start to live |
| PR preview adoption | 60% | PRs with previews viewed |

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel GitHub Actions](https://github.com/vercel/actions)
- [Netlify CLI Deploy](https://docs.netlify.com/cli/get-started/)
- [DEPLOY-000: Synergy Overview](./DEPLOY-000-synergy-overview.md)
- [GIT-004: GitHub Integration](./README.md)
