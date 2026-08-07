# GIT-004C: Pull Requests Panel - Read & Display

## Overview

Add a Pull Requests tab to the GitHub Panel, enabling teams to monitor PR status, review states, and CI checks without leaving the Nodegex editor. This integrates with DEPLOY-001 to show preview deployment URLs.

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** HIGH (team collaboration essential)  
**Effort:** 10-14 hours  
**Risk:** Low (read-only, well-documented APIs)

**Depends on:** GIT-004A (OAuth & GitHubClient), GIT-004B (Panel structure)

---

## Goals

1. **PRs Tab** in existing GitHub Panel
2. **PR List** with status indicators
3. **Review Status** display (approvals, changes requested)
4. **CI Checks** status display
5. **Preview URL** integration (for DEPLOY-001)

---

## User Experience

### PRs Tab Layout

```
┌─────────────────────────────────────────┐
│ GitHub                            [⚙️]  │
├─────────────────────────────────────────┤
│ [Issues] [PRs] [Deployments]            │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ● Open (3)  ○ Merged  ○ Closed      │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ #45 Add user dashboard                  │
│ 📝 Draft • @johndoe • 2 hours ago       │
│ ⏳ Checks running...                    │
├─────────────────────────────────────────┤
│ #44 Fix login validation                │
│ 🟢 Ready • @janedoe • 1 day ago         │
│ ✅ Checks passed • 👍 2 approvals       │
├─────────────────────────────────────────┤
│ #43 Update dependencies                 │
│ 🟡 Changes requested • @bot • 2 days    │
│ ✅ Checks passed • 🔄 1 change request  │
└─────────────────────────────────────────┘
```

### PR Detail View

```
┌─────────────────────────────────────────┐
│ ← Back                    [Open in GH]  │
├─────────────────────────────────────────┤
│ #44 Fix login validation                │
│ ─────────────────────────────────────── │
│ 🟢 Open  main ← feature/login-fix       │
│ Author: @janedoe                        │
├─────────────────────────────────────────┤
│ ## Description                          │
│                                         │
│ Fixes the validation bug reported in    │
│ issue #42. Changes include...           │
├─────────────────────────────────────────┤
│ ✅ Checks (3/3 passed)                  │
│ ├─ ✅ Build                             │
│ ├─ ✅ Tests                             │
│ └─ ✅ Lint                              │
├─────────────────────────────────────────┤
│ 👥 Reviews                              │
│ ├─ 👍 @reviewer1 approved               │
│ ├─ 👍 @reviewer2 approved               │
│ └─ ⏳ @reviewer3 pending                │
├─────────────────────────────────────────┤
│ 🌐 Preview Deploy                       │
│ https://pr-44-preview.vercel.app        │
│                        [Open Preview]   │
├─────────────────────────────────────────┤
│ 📝 Commits (3)                          │
│ ├─ abc123 Fix email validation          │
│ ├─ def456 Add unit tests                │
│ └─ ghi789 Update error messages         │
└─────────────────────────────────────────┘
```

---

## Architecture

### Component Structure

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── PullRequestsTab/
│       ├── PullRequestsTab.tsx    # Tab container
│       ├── PRsList.tsx            # List of PRs
│       ├── PRItem.tsx             # Single PR row
│       ├── PRDetail.tsx           # Full PR view
│       ├── PRStatusBadge.tsx      # Draft/Ready/Merged badge
│       ├── PRChecksStatus.tsx     # CI checks display
│       ├── PRReviewStatus.tsx     # Review approvals
│       ├── PRPreviewUrl.tsx       # Deploy preview link
│       └── PRCommitsList.tsx      # Commits in PR
├── hooks/
│   ├── usePullRequests.ts         # PRs list fetching
│   └── usePRDetail.ts             # Single PR fetching
```

---

## Implementation Phases

### Phase 1: PRs Tab Structure (2-3 hours)

**Files to Create:**
- `PullRequestsTab.tsx`
- `PRsList.tsx`
- `PRItem.tsx`
- `hooks/usePullRequests.ts`

**Tasks:**
1. Create PRs tab in GitHub Panel
2. Implement usePullRequests hook
3. Create PRsList component
4. Create PRItem with basic info

**Success Criteria:**
- [ ] PRs tab shows in panel
- [ ] PR list loads
- [ ] Basic PR info displays

---

### Phase 2: PR Status Indicators (3-4 hours)

**Files to Create:**
- `PRStatusBadge.tsx`
- `PRChecksStatus.tsx`
- `PRReviewStatus.tsx`

**Tasks:**
1. Create status badge (Draft, Ready, Changes Requested)
2. Fetch and display CI check status
3. Fetch and display review status
4. Add merge conflict indicator

**Success Criteria:**
- [ ] Draft PRs show draft badge
- [ ] CI status shows pass/fail/running
- [ ] Review count shows
- [ ] Merge conflicts indicated

---

### Phase 3: PR Detail View (3-4 hours)

**Files to Create:**
- `PRDetail.tsx`
- `PRCommitsList.tsx`
- `hooks/usePRDetail.ts`

**Tasks:**
1. Create PR detail view
2. Fetch full PR data
3. Display description (markdown)
4. List commits
5. Show full checks list
6. Show full reviewers list

**Success Criteria:**
- [ ] Detail view shows all info
- [ ] Commits list displays
- [ ] Checks expand to full list
- [ ] Reviewers show status

---

### Phase 4: Preview URL & Polish (2-3 hours)

**Files to Create:**
- `PRPreviewUrl.tsx`

**Tasks:**
1. Extract preview URL from deployment status
2. Display preview URL in PR detail
3. Add "Open Preview" button
4. Add filters (open/merged/closed)
5. Add search
6. Polish UI

**Success Criteria:**
- [ ] Preview URL shows when available
- [ ] Filters work
- [ ] Search works
- [ ] UI polished

---

## Files Summary

### Create (New)

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── PullRequestsTab/
│       ├── PullRequestsTab.tsx
│       ├── PRsList.tsx
│       ├── PRItem.tsx
│       ├── PRDetail.tsx
│       ├── PRStatusBadge.tsx
│       ├── PRChecksStatus.tsx
│       ├── PRReviewStatus.tsx
│       ├── PRPreviewUrl.tsx
│       └── PRCommitsList.tsx
├── hooks/
│   ├── usePullRequests.ts
│   └── usePRDetail.ts
```

---

## API Endpoints Used

```typescript
// List PRs
octokit.pulls.list({ owner, repo, state: 'open' })

// Get single PR
octokit.pulls.get({ owner, repo, pull_number })

// Get PR reviews
octokit.pulls.listReviews({ owner, repo, pull_number })

// Get PR commits
octokit.pulls.listCommits({ owner, repo, pull_number })

// Get check runs for PR
octokit.checks.listForRef({ owner, repo, ref: pr.head.sha })
```

---

## Testing Checklist

- [ ] PRs tab loads
- [ ] All open PRs display
- [ ] Draft PRs marked correctly
- [ ] CI status accurate
- [ ] Review status accurate
- [ ] Merge conflicts shown
- [ ] Detail view works
- [ ] Preview URL displays (when available)
- [ ] Filters work
- [ ] Search works
- [ ] Empty state displays

---

## Progress Tracking

| Phase | Status | Started | Completed | Hours |
|-------|--------|---------|-----------|-------|
| Phase 1: Tab Structure | Not Started | - | - | - |
| Phase 2: Status Indicators | Not Started | - | - | - |
| Phase 3: Detail View | Not Started | - | - | - |
| Phase 4: Preview & Polish | Not Started | - | - | - |

**Estimated Total:** 10-14 hours  
**Actual Total:** - hours
