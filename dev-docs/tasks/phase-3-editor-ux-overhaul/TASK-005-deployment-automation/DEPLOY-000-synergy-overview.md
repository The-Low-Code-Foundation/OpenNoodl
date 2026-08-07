# DEPLOY-000: Deployment Automation Overview & Synergy

## Executive Summary

This document outlines how **Deployment Automation** builds on the **GitHub Project Management Integration (GIT-004)** to create a seamless publish-to-production experience. By leveraging GitHub Actions as the orchestration layer, Nodegex can offer one-click deployments to multiple targets (Vercel, Netlify, Cloudflare Pages, AWS, etc.) without building custom CI/CD infrastructure.

**The key insight**: GIT-004's OAuth foundation and GitHubClient become the deployment control plane.

---

## The Synergy Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        GIT-004: GitHub Integration                          │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     GIT-004A: OAuth & Client                        │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│   │  │ OAuth Flow  │  │ GitHubClient│  │ Token Store │                  │   │
│   │  └─────────────┘  └──────┬──────┘  └─────────────┘                  │   │
│   └──────────────────────────┼──────────────────────────────────────────┘   │
│                              │                                              │
│         ┌────────────────────┼────────────────────┐                         │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│   ┌───────────┐        ┌───────────┐        ┌───────────┐                   │
│   │ Issues API│        │  PRs API  │        │Actions API│ ◄── Shared Client │
│   └───────────┘        └───────────┘        └─────┬─────┘                   │
│         │                    │                    │                         │
│         ▼                    ▼                    │                         │
│   ┌─────────────────────────────────────┐        │                         │
│   │  GIT-004B-F: Issues, PRs, Linking   │        │                         │
│   │  Dashboard Widgets                   │        │                         │
│   └─────────────────────────────────────┘        │                         │
│                                                   │                         │
└───────────────────────────────────────────────────┼─────────────────────────┘
                                                    │
                    ┌───────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                      DEPLOY-001: Deployment Automation                      │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │  Workflow   │  │  One-Click  │  │   Deploy    │  │Multi-Target │       │
│   │  Generator  │  │   Deploy    │  │   Status    │  │  Templates  │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │ PR Preview  │  │ Environment │  │  Rollback   │  │   Secrets   │       │
│   │   Deploys   │  │  Management │  │   Support   │  │   Guide     │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why GitHub Actions?

### The Alternative: Build Our Own CI/CD

```
❌ Custom CI/CD Approach:
- Build deployment servers
- Manage compute infrastructure  
- Handle secrets securely
- Build queue management
- Scale for concurrent builds
- Maintain uptime guarantees

Cost: $$$$ + ongoing ops burden
Time: Months of infrastructure work
Risk: Security, reliability, scaling
```

### The GitHub Actions Approach

```
✅ GitHub Actions Approach:
- Use existing GitHub infrastructure
- Leverage Nodegex's OAuth token
- Secrets managed by GitHub
- Unlimited parallel builds (within limits)
- GitHub's reliability guarantees
- Marketplace of pre-built actions

Cost: Free for public repos, included in GitHub plans
Time: Days, not months
Risk: Minimal (GitHub's problem)
```

### What We Actually Build

| We Build | GitHub Provides |
|----------|-----------------|
| Workflow file generator | Execution environment |
| Deploy button UI | Build runners |
| Status monitoring | Secrets management |
| Template library | Artifact storage |
| PR preview integration | Logs and debugging |

---

## Shared Foundation: GitHubClient Extensions

GIT-004A creates the `GitHubClient`. For deployment synergy, we ensure it includes Actions API support from day one:

```typescript
// packages/noodl-editor/src/editor/src/services/github/GitHubClient.ts

export class GitHubClient {
  private octokit: Octokit;
  
  // From GIT-004B-D: Issues & PRs
  readonly issues: IssuesAPI;
  readonly pullRequests: PullRequestsAPI;
  readonly discussions: DiscussionsAPI;
  
  // Added for DEPLOY-001: Actions
  readonly actions: ActionsAPI;
  readonly repos: ReposAPI;  // For workflow file management
  
  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
    this.actions = new ActionsAPI(this.octokit);
    this.repos = new ReposAPI(this.octokit);
    // ... other APIs
  }
}

// Actions API wrapper
class ActionsAPI {
  constructor(private octokit: Octokit) {}
  
  // List available workflows
  async listWorkflows(owner: string, repo: string): Promise<Workflow[]> {
    const { data } = await this.octokit.actions.listRepoWorkflows({ owner, repo });
    return data.workflows;
  }
  
  // Trigger a workflow run
  async triggerWorkflow(
    owner: string, 
    repo: string, 
    workflowId: string | number,
    ref: string,
    inputs?: Record<string, string>
  ): Promise<void> {
    await this.octokit.actions.createWorkflowDispatch({
      owner, repo, workflow_id: workflowId, ref, inputs
    });
  }
  
  // Get workflow run status
  async getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun> {
    const { data } = await this.octokit.actions.getWorkflowRun({ owner, repo, run_id: runId });
    return data;
  }
  
  // List recent workflow runs
  async listWorkflowRuns(
    owner: string, 
    repo: string, 
    options?: { workflow_id?: number; branch?: string; status?: string }
  ): Promise<WorkflowRun[]> {
    const { data } = await this.octokit.actions.listWorkflowRunsForRepo({ 
      owner, repo, ...options 
    });
    return data.workflow_runs;
  }
  
  // Get workflow run logs
  async getWorkflowRunLogs(owner: string, repo: string, runId: number): Promise<string> {
    const { data } = await this.octokit.actions.downloadWorkflowRunLogs({ 
      owner, repo, run_id: runId 
    });
    return data;
  }
}
```

---

## Feature Integration Points

### 1. PR Panel + Deploy Previews (GIT-004C + DEPLOY-001)

The PR panel from GIT-004C naturally extends to show deploy preview URLs:

```
┌─────────────────────────────────────────────────────────┐
│ Pull Request #42                                        │
│ ─────────────────────────────────────────────────────── │
│ Add user dashboard with analytics                       │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Status                                                  │
│ ├─ ✅ Build: Passed                                     │
│ ├─ ✅ Tests: 142/142 passed                             │
│ ├─ ✅ Lint: No issues                                   │
│ └─ 🚀 Deploy Preview: Ready                             │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🌐 Preview URL                                      │ │
│ │ https://my-app-pr-42.vercel.app                     │ │
│ │                                    [Open Preview]   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Reviews: 1 approved, 1 pending                          │
│ ─────────────────────────────────────────────────────── │
│ [View on GitHub]  [View Diff]  [Merge]                  │
└─────────────────────────────────────────────────────────┘
```

### 2. Dashboard Widgets + Deployment Status (GIT-004F + DEPLOY-001)

The dashboard already shows GitHub stats; deployment status is a natural addition:

```
┌───────────────────────────────────────┐
│ 📁 Client Portal                      │
│ ─────────────────────────────────────│
│ Last edited: 2 hours ago              │
│ ─────────────────────────────────────│
│ GitHub                                │
│ ├─ 🔴 3 Open Issues                   │
│ ├─ 🟡 1 PR needs review               │
│ │                                     │
│ Deployments                    ← NEW  │
│ ├─ 🟢 Production: Live (v1.4.2)       │
│ ├─ 🟡 Staging: Building...            │
│ └─ 📅 Last deploy: 2h ago             │
│                                       │
│ [Open Project]  [Deploy ▼]            │
└───────────────────────────────────────┘
```

### 3. Issues + Deployment Failures (GIT-004E + DEPLOY-001)

When a deployment fails, auto-create a linked issue:

```
Deployment Failed → Auto-create Issue:
┌─────────────────────────────────────────────────────────┐
│ 🐛 Issue #87: Deployment failed on main                 │
│ ─────────────────────────────────────────────────────── │
│ **Automated issue from failed deployment**              │
│                                                         │
│ **Workflow:** deploy-production.yml                     │
│ **Trigger:** Push to main (abc123)                      │
│ **Error:**                                              │
│ ```                                                     │
│ Error: Build failed - Module not found: '@/components'  │
│ ```                                                     │
│                                                         │
│ **Linked Components:**                                  │
│ - UserDashboard (last modified in this push)            │
│                                                         │
│ [View Workflow Run] [View Commit]                       │
└─────────────────────────────────────────────────────────┘
```

### 4. Component Linking + Deploy Impact (GIT-004E + DEPLOY-001)

Show which deployments included changes to a component:

```
┌─────────────────────────────────────────────────────────┐
│ Component: UserLoginForm                                │
│ ─────────────────────────────────────────────────────── │
│ Properties | Connections | GitHub | Deployments         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Recent Deployments Affecting This Component:            │
│ ├─ 🟢 v1.4.2 (Production) - Dec 30, 2025               │
│ │   └─ "Fixed validation bug" - PR #41                 │
│ ├─ 🟢 v1.4.1 (Production) - Dec 28, 2025               │
│ │   └─ "Added password strength meter" - PR #38        │
│ └─ 🔴 v1.4.0 (Failed) - Dec 27, 2025                   │
│     └─ "OAuth integration" - PR #35 ← Rollback         │
│                                                         │
│ Linked Issues: #42, #38, #35                            │
└─────────────────────────────────────────────────────────┘
```

---

## DEPLOY-001 Sub-Task Breakdown

Building on GIT-004's foundation:

### DEPLOY-001A: Actions API Integration (6-8 hours)
**Depends on:** GIT-004A

- Extend GitHubClient with Actions API methods
- Create `useWorkflows` and `useWorkflowRuns` hooks
- Implement workflow run status polling
- Add to GitHub panel as "Deployments" tab

### DEPLOY-001B: Workflow Generator (10-14 hours)
**Depends on:** DEPLOY-001A

- Workflow template system
- Target-specific generators (Vercel, Netlify, Cloudflare)
- Project analysis for build configuration
- Commit generated workflow to repo

### DEPLOY-001C: Deploy Button & Status UI (8-12 hours)
**Depends on:** DEPLOY-001A

- One-click deploy button in editor toolbar
- Deployment status panel/popover
- Real-time progress updates
- Success/failure notifications with links

### DEPLOY-001D: Multi-Target Templates (8-10 hours)
**Depends on:** DEPLOY-001B

- Vercel deployment template
- Netlify deployment template
- Cloudflare Pages template
- AWS Amplify template
- GitHub Pages template
- Custom/self-hosted template

### DEPLOY-001E: Environment Management (6-8 hours)
**Depends on:** DEPLOY-001C

- Environment configuration UI (prod, staging, dev)
- Environment variables guidance
- Secrets setup documentation
- Environment-specific deploy triggers

### DEPLOY-001F: PR Previews Integration (6-8 hours)
**Depends on:** DEPLOY-001D, GIT-004C

- Auto-deploy on PR creation
- Preview URL extraction from workflow
- Display in PR detail panel
- Cleanup on PR merge/close

---

## Dependency Graph

```
GIT-003-ADDENDUM: OAuth Upgrade
         │
         ▼
    GIT-004A: OAuth & GitHubClient  ◄───────────────────────┐
         │                                                   │
         ├──────────────────────────────────────┐            │
         │                                      │            │
         ▼                                      ▼            │
    GIT-004B-D                            DEPLOY-001A        │
    Issues & PRs CRUD                     Actions API        │
         │                                      │            │
         ▼                                      ▼            │
    GIT-004E                              DEPLOY-001B        │
    Component Linking                     Workflow Generator │
         │                                      │            │
         ▼                                      ├────────────┘
    GIT-004F                                    │
    Dashboard Widgets ◄─────────────────────────┤
         │                                      │
         │                                      ▼
         │                               DEPLOY-001C-D
         │                               Deploy UI & Templates
         │                                      │
         └──────────────► DEPLOY-001E-F ◄───────┘
                          Environments & PR Previews
```

---

## Shared UI Components

Several components can be shared between GIT-004 and DEPLOY-001:

| Component | GIT-004 Use | DEPLOY-001 Use |
|-----------|-------------|----------------|
| `StatusBadge` | Issue/PR status | Deploy status |
| `ActivityFeed` | Issue activity | Deploy history |
| `ProgressIndicator` | - | Build progress |
| `LogViewer` | - | Build logs |
| `EnvironmentSelector` | - | Deploy target |
| `SecretsMaskedInput` | - | API keys |

---

## OAuth Permissions Update

DEPLOY-001 requires additional GitHub permissions beyond GIT-004:

```typescript
// GIT-004 Permissions
const GIT_004_SCOPES = [
  'repo',           // Issues, PRs, code
  'read:user',      // User profile
];

// DEPLOY-001 Additional Permissions  
const DEPLOY_001_SCOPES = [
  'workflow',       // Trigger and manage workflows
  // 'repo' already includes actions:read
];

// Combined for full integration
const FULL_SCOPES = [
  'repo',
  'read:user', 
  'workflow',
];
```

Update GIT-004A to request `workflow` scope from the start to avoid re-authorization later.

---

## Timeline Synergy

Recommended implementation order:

```
Phase 3 Week 1-2:
├── GIT-003-ADDENDUM: OAuth Upgrade (6-8 hrs)
└── GIT-004A: OAuth & Client (8-12 hrs)
    └── Include Actions API stubs

Phase 3 Week 3-4:
├── GIT-004B: Issues Read (10-14 hrs)
├── GIT-004C: PRs Read (10-14 hrs)
└── DEPLOY-001A: Actions Integration (6-8 hrs)  ◄── Parallel track

Phase 3 Week 5-6:
├── GIT-004D: Issues CRUD (12-16 hrs)
├── GIT-004E: Component Linking (14-18 hrs)
└── DEPLOY-001B: Workflow Generator (10-14 hrs)  ◄── Parallel track

Phase 3 Week 7-8:
├── GIT-004F: Dashboard Widgets (12-16 hrs)
├── DEPLOY-001C: Deploy Button (8-12 hrs)
└── DEPLOY-001D: Multi-Target Templates (8-10 hrs)

Phase 3 Week 9-10:
├── DEPLOY-001E: Environments (6-8 hrs)
├── DEPLOY-001F: PR Previews (6-8 hrs)
└── Integration testing & polish
```

**Total Combined Effort:** 
- GIT-004: 70-90 hours
- DEPLOY-001: 44-60 hours
- **Combined: 114-150 hours** (with significant parallel work possible)

---

## Success Metrics (Combined)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Deployment adoption | 40% of connected projects | Projects with deploy workflow |
| Deploy frequency | 3x current | Deploys per project per week |
| Time to deploy | < 2 minutes | Button click to live |
| PR preview usage | 60% of PRs | PRs with preview comments |
| Issue-deploy linking | 30% of deploys | Deploys referencing issues |
| Failed deploy resolution | < 4 hours | Time from failure to fix |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub Actions rate limits | Medium | Cache workflow status, poll smartly |
| Workflow complexity | High | Start with simple templates, iterate |
| Secrets management UX | Medium | Clear documentation, validation |
| Multi-target maintenance | Medium | Abstract common patterns, test matrix |
| Failed deploys confusion | Medium | Clear error messages, auto-issue creation |

---

## Future Synergies (Out of Scope)

Once GIT-004 + DEPLOY-001 are complete, natural extensions include:

1. **GitHub Releases Integration**: Auto-create releases on production deploy
2. **Changelog Generation**: Generate from merged PRs since last deploy
3. **Rollback UI**: One-click rollback to previous deployment
4. **Deploy Scheduling**: Schedule deploys for off-peak hours
5. **Deploy Approvals**: Require approval for production (GitHub Environments)
6. **Performance Monitoring**: Link to Vercel Analytics, etc.
7. **A/B Deployments**: Deploy to percentage of users

---

## Conclusion

The GitHub Integration (GIT-004) and Deployment Automation (DEPLOY-001) are deeply synergistic:

- **Shared Foundation**: Same OAuth token, same GitHubClient
- **Shared UI Patterns**: Status badges, activity feeds, progress indicators
- **Feature Integration**: PR previews, dashboard widgets, component linking
- **Combined Value**: Issue → Code → Review → Deploy → Monitor cycle

By designing GIT-004A with Actions API support from the start, we enable DEPLOY-001 to build naturally on top without rework. The result is a cohesive development experience that no other low-code platform offers.

---

## References

- [GitHub Actions REST API](https://docs.github.com/en/rest/actions)
- [Vercel GitHub Integration](https://vercel.com/docs/concepts/git/vercel-for-github)
- [Netlify GitHub Integration](https://docs.netlify.com/configure-builds/repo-permissions-linking/)
- [GIT-004 Task Documentation](./README.md)
