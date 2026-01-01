# Organization Sync Additions for GIT-002 and GIT-003

These additions ensure proper GitHub organization support throughout the Git integration.

---

## Addition for GIT-002 (Dashboard Git Status)

**Insert into:** `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-002-github-integration/GIT-002-dashboard-git-status.md`

**Insert in:** The "Project Card Display" or similar section

---

### Organization Context Display

When showing git status on project cards, include organization context:

```
┌─────────────────────────────────────────┐
│ Client Portal                           │
│ ─────────────────────────────────────── │
│ 📁 my-company/client-portal             │  ← Show org/repo
│ 🌿 main • ✓ Up to date                  │
│ Last push: 2 hours ago                  │
└─────────────────────────────────────────┘
```

**For organization repos, display:**
- Organization name + repo name (`org/repo`)
- Organization icon/avatar if available
- Permission level indicator if relevant (admin, write, read)

### Organization Filter in Dashboard

Add ability to filter projects by GitHub organization:

```
┌─────────────────────────────────────────────────────────────────┐
│ My Projects                                               [⚙️]  │
├─────────────────────────────────────────────────────────────────┤
│ FILTER BY: [All ▾] [🏢 my-company ▾] [🔍 Search...]           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Project 1   │  │ Project 2   │  │ Project 3   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Details

```typescript
// In GitHubService (from GIT-001)
interface OrganizationInfo {
  login: string;           // e.g., "my-company"
  name: string;            // e.g., "My Company Inc"
  avatarUrl: string;
  role: 'admin' | 'member';
}

// Fetch user's organizations
async listOrganizations(): Promise<OrganizationInfo[]> {
  const { data } = await this.octokit.orgs.listForAuthenticatedUser();
  return data.map(org => ({
    login: org.login,
    name: org.name || org.login,
    avatarUrl: org.avatar_url,
    role: 'member'  // Would need additional API call for exact role
  }));
}

// Cache organizations after OAuth
// Store in GitHubAuthStore alongside token
```

### Files to Modify

```
packages/noodl-editor/src/editor/src/views/Dashboard/
├── ProjectList.tsx
│   - Add organization filter dropdown
│   - Show org context on project cards
└── hooks/useGitHubOrganizations.ts (create)
    - Hook to fetch and cache user's organizations
```

---

## Addition for GIT-003 (Repository Cloning)

**Insert into:** `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-002-github-integration/GIT-003-repository-cloning.md`

**Insert in:** The "Repository Selection" or "Clone Dialog" section

---

### Organization-Aware Repository Browser

When browsing repositories to clone, organize by owner:

```
┌─────────────────────────────────────────────────────────────────┐
│ Clone Repository                                          [×]   │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search repositories...                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 👤 YOUR REPOSITORIES                                            │
│ ├── personal-project              ⭐ 12  🔒 Private            │
│ ├── portfolio-site                ⭐ 5   🔓 Public             │
│ └── experiments                   ⭐ 0   🔒 Private            │
│                                                                 │
│ 🏢 MY-COMPANY                                                   │
│ ├── client-portal                 ⭐ 45  🔒 Private            │
│ ├── marketing-site                ⭐ 23  🔒 Private            │
│ ├── internal-tools                ⭐ 8   🔒 Private            │
│ └── [View all 24 repositories...]                               │
│                                                                 │
│ 🏢 ANOTHER-ORG                                                  │
│ ├── open-source-lib               ⭐ 1.2k 🔓 Public            │
│ └── [View all 12 repositories...]                               │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Or enter repository URL:                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ https://github.com/org/repo.git                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                          [Cancel]  [Clone]      │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Details

```typescript
// Fetch repos by owner type
interface ReposByOwner {
  personal: Repository[];
  organizations: {
    org: OrganizationInfo;
    repos: Repository[];
  }[];
}

async getRepositoriesByOwner(): Promise<ReposByOwner> {
  // 1. Fetch user's repos
  const personalRepos = await this.octokit.repos.listForAuthenticatedUser({
    affiliation: 'owner',
    sort: 'updated',
    per_page: 100
  });
  
  // 2. Fetch organizations
  const orgs = await this.listOrganizations();
  
  // 3. Fetch repos for each org (parallel)
  const orgRepos = await Promise.all(
    orgs.map(async org => ({
      org,
      repos: await this.octokit.repos.listForOrg({
        org: org.login,
        sort: 'updated',
        per_page: 50
      })
    }))
  );
  
  return {
    personal: personalRepos.data,
    organizations: orgRepos
  };
}
```

### Permission Handling

```typescript
// Check if user can clone private repos from an org
interface OrgPermissions {
  canClonePrivate: boolean;
  canCreateRepo: boolean;
  role: 'admin' | 'member' | 'billing_manager';
}

async getOrgPermissions(org: string): Promise<OrgPermissions> {
  const { data } = await this.octokit.orgs.getMembershipForAuthenticatedUser({
    org
  });
  
  return {
    canClonePrivate: true,  // If they're a member, they can clone
    canCreateRepo: data.role === 'admin' || 
                   // Check org settings for member repo creation
                   await this.canMembersCreateRepos(org),
    role: data.role
  };
}
```

### Caching Strategy

```typescript
// Cache organization list and repos for performance
// Invalidate cache:
// - On OAuth refresh
// - After 5 minutes
// - On manual refresh button click

interface GitHubCache {
  organizations: {
    data: OrganizationInfo[];
    fetchedAt: number;
  };
  repositories: {
    [owner: string]: {
      data: Repository[];
      fetchedAt: number;
    };
  };
}
```

### Files to Create/Modify

```
packages/noodl-editor/src/editor/src/views/Launcher/CloneRepoDialog/
├── RepositoryBrowser.tsx        # Main browsing component
├── OrganizationSection.tsx      # Collapsible org section
├── RepositoryList.tsx           # Repo list with search
└── hooks/
    ├── useRepositoriesByOwner.ts
    └── useOrganizationPermissions.ts

packages/noodl-editor/src/editor/src/services/
└── GitHubCacheService.ts        # Caching layer for GitHub data
```

---

## Summary of Organization-Related Changes

| Task | Change | Est. Hours |
|------|--------|------------|
| GIT-001 | Ensure OAuth scopes include `read:org` | 0.5 |
| GIT-001 | Add `listOrganizations()` to GitHubService | 1 |
| GIT-002 | Show org context on project cards | 1 |
| GIT-002 | Add org filter to dashboard | 2 |
| GIT-003 | Organization-aware repo browser | 3 |
| GIT-003 | Permission checking for orgs | 1 |
| Shared | GitHub data caching service | 2 |
| **Total Additional** | | **~10.5 hours** |

These are distributed across existing tasks, not a separate task.
