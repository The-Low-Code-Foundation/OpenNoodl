# GIT-004C Addition: Create Pull Request

**Insert this section into:** `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-002B-github-advanced-integration/GIT-004C-prs-panel/README.md`

**Insert after:** The existing "Pull Requests Panel - Read & Display" scope

---

## Additional Scope: Create Pull Request from Editor

### Overview

Team members who don't have write access to the main branch (or are following PR-based workflows) need to create pull requests directly from the editor. This completes the contributor workflow without requiring users to open GitHub.

**Added Effort:** 6-8 hours (on top of existing GIT-004C estimate)

### User Flow

```
Contributor Workflow:
1. User works on feature branch (e.g., feature/login-fix)
2. User commits and pushes changes (existing VersionControlPanel)
3. User wants to merge to main
4. If user has write access: can merge directly (existing)
5. If user doesn't have write access OR wants review:
   → Create Pull Request from editor (NEW)
6. Reviewer approves in GitHub (or in editor with GIT-004C)
7. User (or reviewer) merges PR
```

### UI Design

#### "Create PR" Button in Version Control Panel

```
┌─────────────────────────────────────────┐
│ Version Control                   [⚙️]  │
├─────────────────────────────────────────┤
│ 🌿 feature/login-fix                    │
│    ↳ 3 commits ahead of main            │
├─────────────────────────────────────────┤
│                                         │
│ [Push] [Pull] [Create Pull Request 📋]  │  ← NEW BUTTON
│                                         │
└─────────────────────────────────────────┘
```

#### Create PR Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│ Create Pull Request                                       [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ BASE BRANCH                         HEAD BRANCH                 │
│ ┌─────────────────┐                ┌─────────────────┐          │
│ │ main        [▾] │  ← merging ←   │ feature/login   │          │
│ └─────────────────┘                └─────────────────┘          │
│                                                                 │
│ ℹ️ 3 commits • 5 files changed • +127 -45 lines                │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ TITLE                                                           │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Fix login validation bug                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ DESCRIPTION                                          [Preview]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ## Summary                                                  │ │
│ │ Fixes the validation bug reported in #42.                   │ │
│ │                                                             │ │
│ │ ## Changes                                                  │ │
│ │ - Added email format validation                             │ │
│ │ - Fixed password strength check                             │ │
│ │                                                             │ │
│ │ ## Testing                                                  │ │
│ │ - [x] Unit tests pass                                       │ │
│ │ - [x] Manual testing completed                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ OPTIONS                                                         │
│ ├── Reviewers: [@johndoe, @janedoe                        [+]] │
│ ├── Labels: [bug] [fix]                                   [+]  │
│ ├── Assignees: [@me]                                      [+]  │
│ └── ☐ Draft pull request                                       │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ LINKED ISSUES                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔗 #42 - Login validation broken (auto-detected)           │ │
│ │ [+ Link another issue]                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                          [Cancel]  [Create Pull Request]        │
└─────────────────────────────────────────────────────────────────┘
```

### Smart Features

#### 1. Auto-Detect Linked Issues

```typescript
// Scan commit messages for issue references
function detectLinkedIssues(commits: Commit[]): number[] {
  const issuePattern = /#(\d+)/g;
  const issues = new Set<number>();
  
  for (const commit of commits) {
    const matches = commit.message.matchAll(issuePattern);
    for (const match of matches) {
      issues.add(parseInt(match[1]));
    }
  }
  
  return Array.from(issues);
}

// Also check branch name: feature/fix-42-login -> links to #42
function detectIssueFromBranch(branchName: string): number | null {
  const patterns = [
    /(?:fix|issue|bug)[/-](\d+)/i,
    /(\d+)[/-](?:fix|feature|bug)/i
  ];
  // ...
}
```

#### 2. PR Template Support

```typescript
// Load PR template if exists in repo
async function loadPRTemplate(owner: string, repo: string): Promise<string | null> {
  const templatePaths = [
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/pull_request_template.md',
    'PULL_REQUEST_TEMPLATE.md',
    'docs/PULL_REQUEST_TEMPLATE.md'
  ];
  
  for (const path of templatePaths) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path });
      return Buffer.from(data.content, 'base64').toString();
    } catch {
      continue;
    }
  }
  return null;
}
```

#### 3. Auto-Generate Title from Commits

```typescript
// If single commit: use commit message
// If multiple commits: summarize or use branch name
function suggestPRTitle(branch: string, commits: Commit[]): string {
  if (commits.length === 1) {
    return commits[0].summary;
  }
  
  // Convert branch name to title
  // feature/add-login-page -> "Add login page"
  return branchToTitle(branch);
}
```

### Technical Implementation

#### GitHub API Call

```typescript
// Create pull request
POST /repos/{owner}/{repo}/pulls
{
  "title": "Fix login validation bug",
  "body": "## Summary\n...",
  "head": "feature/login-fix",    // Source branch
  "base": "main",                  // Target branch
  "draft": false
}

// Response includes PR number, URL, etc.

// Then add reviewers
POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers
{
  "reviewers": ["johndoe", "janedoe"]
}

// Then add labels
POST /repos/{owner}/{repo}/issues/{pull_number}/labels
{
  "labels": ["bug", "fix"]
}
```

#### Preflight Checks

```typescript
interface PRPreflight {
  canCreate: boolean;
  branchPushed: boolean;
  hasUncommittedChanges: boolean;
  commitsAhead: number;
  conflictsWithBase: boolean;
  reasons: string[];
}

async function checkPRPreflight(
  head: string, 
  base: string
): Promise<PRPreflight> {
  // Check if branch is pushed
  // Check for uncommitted changes
  // Check commits ahead
  // Check for merge conflicts with base
}
```

### Files to Create

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── PRsTab/
│       ├── CreatePRDialog.tsx
│       ├── CreatePRDialog.module.scss
│       ├── BranchSelector.tsx
│       ├── ReviewerSelector.tsx
│       ├── LabelSelector.tsx
│       └── LinkedIssuesSection.tsx
├── hooks/
│   ├── useCreatePR.ts
│   ├── usePRPreflight.ts
│   └── usePRTemplate.ts
```

### Files to Modify

```
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
├── VersionControlPanel.tsx
│   - Add "Create Pull Request" button
│   - Show when branch has commits ahead of base

packages/noodl-editor/src/editor/src/services/GitHubService.ts
  - Add createPullRequest() method
  - Add addReviewers() method
  - Add getPRTemplate() method
```

### Implementation Phases

#### Phase 1: Basic PR Creation (3-4 hours)

- Create dialog component
- Implement base/head branch selection
- Title and description inputs
- Basic create PR API call
- Success/error handling

**Success Criteria:**
- [ ] Can create PR with title and description
- [ ] Branch selector works
- [ ] PR appears on GitHub

#### Phase 2: Smart Features (2-3 hours)

- Auto-detect linked issues from commits
- Load PR template if exists
- Auto-suggest title from branch/commits
- Preview comparison stats

**Success Criteria:**
- [ ] Issues auto-linked
- [ ] Templates load
- [ ] Title auto-suggested

#### Phase 3: Options & Polish (1-2 hours)

- Reviewer selection
- Label selection
- Draft PR option
- Assignee selection
- Integration with VersionControlPanel button

**Success Criteria:**
- [ ] Can add reviewers
- [ ] Can add labels
- [ ] Draft option works
- [ ] Smooth integration with existing UI

---

## Integration with DEPLOY-002 (Preview Deployments)

When a PR is created, if preview deployments are configured:

```
┌─────────────────────────────────────────────────────────────────┐
│ ✅ Pull Request Created!                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PR #47: Fix login validation bug                                │
│ https://github.com/myorg/myrepo/pull/47                        │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 🚀 Preview deployment starting...                               │
│    Will be available at: pr-47.myapp.vercel.app                 │
│                                                                 │
│                              [View on GitHub]  [Close]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Updated GIT-004C Summary

| Sub-Feature | Est. Hours | Priority |
|-------------|------------|----------|
| PR List Display (existing) | 6-8 | High |
| PR Detail View (existing) | 3-4 | High |
| **Create Pull Request** | 6-8 | High |
| **Total** | **15-20** | - |

---

## Success Criteria (Create PR)

- [ ] "Create PR" button appears when branch has unpushed commits
- [ ] Dialog opens with correct branch pre-selected
- [ ] PR template loads if exists in repo
- [ ] Linked issues auto-detected from commits
- [ ] Title auto-suggested from branch/commits
- [ ] Can select reviewers from team
- [ ] Can add labels
- [ ] Can create as draft
- [ ] PR created successfully on GitHub
- [ ] Proper error handling (conflicts, permissions, etc.)
- [ ] Success message with link to PR
