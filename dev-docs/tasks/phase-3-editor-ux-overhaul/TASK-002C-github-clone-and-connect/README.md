# TASK-002C: GitHub Clone & Connect UX

## Overview

Add two critical GitHub UX flows that are currently missing:

1. **Clone Noodl Projects from GitHub** - Browse and clone existing Noodl projects from user's orgs/repos
2. **Connect Project to GitHub** - Initialize git and create/connect remote for unconnected projects

## Prerequisites

- [x] GitHub OAuth working (TASK-002B)
- [x] Token persistence working
- [x] GitHubOAuthService unified across launcher/editor

## Subtask A: Clone from GitHub (Launcher)

### User Story

> As a user, I want to browse my GitHub orgs/repos in the Launcher and clone existing Noodl projects with one click.

### Requirements

1. **UI: GitHub Repositories Tab/Section in Launcher**

   - Show when authenticated with GitHub
   - List user's organizations (from OAuth app installations)
   - List user's personal repositories
   - Search/filter by name
   - Visual indicator for Noodl projects (detected via `project.json`)

2. **Noodl Project Detection**

   - Query GitHub API for `project.json` in repo root
   - Only show repos that contain `project.json` (optional: user toggle to show all)
   - Show warning badge for repos without `project.json`

3. **Clone Flow**
   - User clicks "Clone" on a repo
   - Select local destination folder
   - Clone with progress indicator
   - Automatically add to projects list
   - Option to open immediately after clone

### API Requirements

```typescript
// GitHubClient additions needed:
listUserRepositories(): Promise<GitHubRepository[]>
listOrganizationRepositories(org: string): Promise<GitHubRepository[]>
getFileContent(owner: string, repo: string, path: string): Promise<string | null>
```

### Files to Create/Modify

- `packages/noodl-core-ui/src/preview/launcher/Launcher/views/GitHubRepos/` (new)
  - `GitHubReposView.tsx`
  - `GitHubReposList.tsx`
  - `GitHubRepoCard.tsx`
  - `hooks/useGitHubRepos.ts`
- `packages/noodl-editor/src/editor/src/services/github/GitHubClient.ts` (extend)
- `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx` (add clone handler)

---

## Subtask B: Connect Project to GitHub (In-Editor)

### User Story

> As a user, when my project isn't connected to GitHub, I want to either create a new repo or connect to an existing one.

### Requirements

1. **Detection State**

   - Project has no `.git` folder → "Initialize Git"
   - Project has `.git` but no remote → "Add Remote"
   - Project has remote but not GitHub → "Not a GitHub repo" (read-only info)
   - Project connected to GitHub → Show Issues/PRs as normal

2. **UI: "Not Connected" State in GitHubPanel**

   - Replace 404 errors with friendly message
   - Show two primary actions:
     - **"Create New Repository"** → Creates on GitHub, adds as remote, pushes
     - **"Connect Existing Repository"** → Browse user's repos, set as remote

3. **Create New Repo Flow**

   - Modal: Enter repo name, description, visibility (public/private)
   - Select organization (from OAuth installations) or personal
   - Create via GitHub API
   - Initialize git if needed
   - Add remote origin
   - Initial commit & push

4. **Connect Existing Repo Flow**
   - Browse user's orgs/repos (reuse from Subtask A)
   - Select repo
   - Add as remote origin
   - Offer to fetch/pull if repo has commits

### API Requirements

```typescript
// GitHubClient additions needed:
createRepository(options: {
  name: string;
  description?: string;
  private?: boolean;
  org?: string; // If creating in org
}): Promise<GitHubRepository>
```

### Files to Create/Modify

- `packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/GitHubPanel.tsx` (modify)
- `packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/components/ConnectToGitHub/` (new)
  - `ConnectToGitHubView.tsx`
  - `CreateRepoModal.tsx`
  - `SelectRepoModal.tsx`
- `packages/noodl-editor/src/editor/src/services/github/GitHubClient.ts` (extend)

---

## Design Considerations

### Noodl Project Detection

Option 1: **Check for `project.json` via API**

```typescript
async isNoodlProject(owner: string, repo: string): Promise<boolean> {
  const content = await this.getFileContent(owner, repo, 'project.json');
  return content !== null;
}
```

Option 2: **Topics/Labels** (future)

- Allow users to add `noodl-project` topic to repos
- Search by topic

### Error Handling

- Rate limit warnings (GitHub API limits)
- Private repo access errors (missing OAuth scope)
- Clone failures (disk space, permissions)
- Push failures (authentication, branch protection)

### Performance

- Cache repo lists with short TTL (30 seconds)
- Lazy load Noodl detection (don't check all repos immediately)
- Pagination for orgs with many repos

---

## Acceptance Criteria

### Subtask A: Clone

- [ ] Authenticated user can see "GitHub Repos" section in launcher
- [ ] Can browse personal repos and org repos
- [ ] Noodl projects are visually distinguished
- [ ] Can clone repo to selected location
- [ ] Cloned project appears in projects list
- [ ] Progress indicator during clone

### Subtask B: Connect

- [ ] Non-git project shows "Initialize & Connect" option
- [ ] Git project without remote shows "Connect" option
- [ ] Can create new repo (personal or org)
- [ ] Can connect to existing repo
- [ ] After connecting, Issues/PRs tabs work

---

## Related Tasks

- TASK-002B: GitHub OAuth Integration (prerequisite - DONE)
- TASK-002D: GitHub Sync Status (future - show sync status in project cards)

---

## Estimated Effort

| Subtask              | Effort    | Priority |
| -------------------- | --------- | -------- |
| A: Clone from GitHub | 4-6 hours | High     |
| B: Connect to GitHub | 3-4 hours | High     |

---

_Created: January 2026_
_Status: DRAFT_
