# GIT-004F: Dashboard Widgets & Notifications

## Overview

Extend the Nodegex Dashboard with GitHub integration widgets that provide project health overview, activity feeds, and notification badges. This gives teams at-a-glance visibility into their projects' GitHub status without opening each project individually.

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** MEDIUM (polish layer, not blocking)  
**Effort:** 12-16 hours  
**Risk:** Low (display-only, leverages existing APIs)

**Depends on:** GIT-004B (Issues Panel), GIT-004C (PRs Panel)

---

## Goals

1. **Project Card Stats**: Show GitHub issue/PR counts on project cards
2. **Notification Badges**: Highlight projects needing attention
3. **Activity Feed**: Cross-project activity stream
4. **Click-Through Navigation**: Open project to specific GitHub item

---

## User Experience

### Enhanced Project Cards

```
┌─────────────────────────────────────────────────────────────────┐
│  My Projects                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ Client Portal      [🔴] │  │ Marketing Site          │      │
│  │ ───────────────────     │  │ ───────────────────     │      │
│  │ Last edited: 2h ago     │  │ Last edited: 1 week     │      │
│  │ ───────────────────     │  │ ───────────────────     │      │
│  │ 🔴 5 Open Issues        │  │ 🟢 0 Open Issues        │      │
│  │ 🟡 2 PRs need review    │  │ 📝 1 Open PR            │      │
│  │ 💬 3 New discussions    │  │                         │      │
│  │ ───────────────────     │  │ ───────────────────     │      │
│  │ [Open]      [GitHub ▼]  │  │ [Open]                  │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────┐      │
│  │ Internal Tools          │  │ + New Project           │      │
│  │ ───────────────────     │  │                         │      │
│  │ Not connected to GitHub │  │                         │      │
│  │                         │  │                         │      │
│  │ [Open] [Connect GitHub] │  │                         │      │
│  └─────────────────────────┘  └─────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Notification Badge Meanings

| Badge | Meaning |
|-------|---------|
| 🔴 | Has items assigned to you or mentioned you |
| 🟡 | Has items needing review |
| (none) | No attention needed |

### Activity Feed Widget

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔔 Recent Activity                                    [Filter ▼]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📋 Issue #42 assigned to you                                    │
│    Client Portal • 2 hours ago                                  │
│    "Login form validation broken"                               │
│                                                    [View Issue] │
│ ─────────────────────────────────────────────────────────────── │
│ 🔀 PR #15 ready for review                                      │
│    Marketing Site • 5 hours ago                                 │
│    "Update hero section copy"                                   │
│                                                      [View PR]  │
│ ─────────────────────────────────────────────────────────────── │
│ 💬 New comment on Issue #38                                     │
│    Client Portal • 1 day ago                                    │
│    @janedoe: "I've pushed a fix for this..."                    │
│                                                   [View Thread] │
│ ─────────────────────────────────────────────────────────────── │
│ ✅ Issue #35 closed                                             │
│    Internal Tools • 2 days ago                                  │
│    "Database connection timeout"                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Load More]                        │
└─────────────────────────────────────────────────────────────────┘
```

### Filter Options

```
┌─────────────────────┐
│ Filter Activity     │
├─────────────────────┤
│ ☑️ Issues           │
│ ☑️ Pull Requests    │
│ ☑️ Comments         │
│ ☐ Deployments       │
├─────────────────────┤
│ ● All activity      │
│ ○ Assigned to me    │
│ ○ Mentions          │
└─────────────────────┘
```

---

## Architecture

### Component Structure

```
packages/noodl-editor/src/editor/src/views/Dashboard/
├── components/
│   ├── GitHubProjectStats.tsx      # Stats for project cards
│   ├── GitHubProjectStats.module.scss
│   ├── GitHubNotificationBadge.tsx # Attention indicator
│   ├── GitHubActivityFeed.tsx      # Cross-project activity
│   ├── GitHubActivityFeed.module.scss
│   ├── ActivityItem.tsx            # Single activity entry
│   └── ActivityFilters.tsx         # Filter controls
├── hooks/
│   ├── useDashboardGitHub.ts       # Aggregate GitHub data
│   ├── useProjectGitHubStats.ts    # Single project stats
│   └── useGitHubActivity.ts        # Activity feed data
```

### Data Aggregation

```typescript
// useDashboardGitHub.ts
interface DashboardGitHubData {
  projects: ProjectGitHubStats[];
  activity: ActivityItem[];
  notifications: NotificationCount;
}

interface ProjectGitHubStats {
  projectId: string;
  projectName: string;
  connected: boolean;
  owner?: string;
  repo?: string;
  issues: {
    open: number;
    closed: number;
    assignedToMe: number;
  };
  pullRequests: {
    open: number;
    needsReview: number;
    merged: number;
  };
  needsAttention: boolean;
  attentionReason?: string;
}

interface ActivityItem {
  id: string;
  type: 'issue' | 'pr' | 'comment' | 'deployment';
  action: 'created' | 'closed' | 'assigned' | 'commented' | 'merged';
  projectId: string;
  projectName: string;
  title: string;
  number?: number;
  author: string;
  timestamp: Date;
  preview?: string;
}
```

---

## Implementation Phases

### Phase 1: Project Card Stats (3-4 hours)

**Files to Create:**
- `components/GitHubProjectStats.tsx`
- `components/GitHubProjectStats.module.scss`
- `hooks/useProjectGitHubStats.ts`

**Tasks:**
1. Create stats component for project cards
2. Fetch issue/PR counts for each connected project
3. Display open issues count
4. Display open PRs count
5. Handle projects without GitHub
6. Add loading state

**Success Criteria:**
- [ ] Stats appear on connected projects
- [ ] Counts are accurate
- [ ] Non-connected projects handled

---

### Phase 2: Notification Badges (2-3 hours)

**Files to Create:**
- `components/GitHubNotificationBadge.tsx`

**Tasks:**
1. Define "needs attention" criteria
2. Create badge component
3. Add badge to project card
4. Show tooltip with reason

**Attention Criteria:**
- Issues assigned to current user
- PRs requesting your review
- Mentions in comments
- Failed deployments (future)

**Success Criteria:**
- [ ] Badge appears when attention needed
- [ ] Badge color indicates urgency
- [ ] Tooltip shows reason

---

### Phase 3: Activity Feed (4-5 hours)

**Files to Create:**
- `components/GitHubActivityFeed.tsx`
- `components/GitHubActivityFeed.module.scss`
- `components/ActivityItem.tsx`
- `hooks/useGitHubActivity.ts`

**Tasks:**
1. Aggregate activity across projects
2. Create activity feed component
3. Create activity item component
4. Sort by timestamp
5. Implement pagination
6. Add refresh capability

**Success Criteria:**
- [ ] Activity loads for all projects
- [ ] Items sorted by time
- [ ] Pagination works
- [ ] Refresh updates feed

---

### Phase 4: Filters & Navigation (2-3 hours)

**Files to Create:**
- `components/ActivityFilters.tsx`

**Tasks:**
1. Create filter dropdown
2. Filter by type (issues, PRs, comments)
3. Filter "Assigned to me"
4. Implement click-through navigation
5. Open project and navigate to item

**Success Criteria:**
- [ ] Filters work correctly
- [ ] Click opens project
- [ ] Navigates to specific item

---

### Phase 5: Polish (1-2 hours)

**Tasks:**
1. Add empty states
2. Handle errors gracefully
3. Optimize API calls (batching, caching)
4. Test with many projects
5. Responsive design

**Success Criteria:**
- [ ] Good UX for all states
- [ ] Performance acceptable
- [ ] Responsive layout

---

## Files Summary

### Create (New)

```
packages/noodl-editor/src/editor/src/views/Dashboard/
├── components/
│   ├── GitHubProjectStats.tsx
│   ├── GitHubProjectStats.module.scss
│   ├── GitHubNotificationBadge.tsx
│   ├── GitHubActivityFeed.tsx
│   ├── GitHubActivityFeed.module.scss
│   ├── ActivityItem.tsx
│   └── ActivityFilters.tsx
├── hooks/
│   ├── useDashboardGitHub.ts
│   ├── useProjectGitHubStats.ts
│   └── useGitHubActivity.ts
```

### Modify

```
packages/noodl-editor/src/editor/src/views/Dashboard/
  ProjectCard/ProjectCard.tsx
  - Add GitHubProjectStats component
  - Add notification badge

  Dashboard.tsx
  - Add activity feed section
  - Layout adjustments
```

---

## API Calls

### Per Project (Batched)
```typescript
// Issues count
octokit.issues.listForRepo({ owner, repo, state: 'open', per_page: 1 })
// Use response headers for total count

// PRs count  
octokit.pulls.list({ owner, repo, state: 'open', per_page: 1 })

// Assigned to me
octokit.issues.listForRepo({ owner, repo, assignee: username })
```

### Activity Feed
```typescript
// Recent events (alternative to polling each repo)
octokit.activity.listEventsForAuthenticatedUser({ per_page: 50 })
// Filter to relevant repos
```

---

## Rate Limiting Strategy

With multiple projects, API calls can add up:

1. **Batch Requests**: Fetch stats for all projects in parallel
2. **Cache Aggressively**: Cache counts for 60 seconds
3. **Lazy Load**: Only fetch when dashboard visible
4. **Background Refresh**: Update periodically, not on every view

```typescript
// Example caching strategy
const CACHE_TTL = 60 * 1000; // 60 seconds

async function getProjectStats(projectId: string): Promise<Stats> {
  const cached = cache.get(projectId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const stats = await fetchStats(projectId);
  cache.set(projectId, { data: stats, timestamp: Date.now() });
  return stats;
}
```

---

## Testing Checklist

### Project Stats
- [ ] Stats show for connected projects
- [ ] Counts are accurate
- [ ] Non-connected shows message
- [ ] Loading state works

### Notifications
- [ ] Badge appears when needed
- [ ] Badge hidden when not needed
- [ ] Tooltip shows reason

### Activity Feed
- [ ] Activity loads
- [ ] All types show correctly
- [ ] Sorted by time
- [ ] Pagination works
- [ ] Filters work

### Navigation
- [ ] Click opens project
- [ ] Opens to correct item
- [ ] GitHub panel activates

### Edge Cases
- [ ] No connected projects
- [ ] All projects connected
- [ ] Empty activity
- [ ] API errors
- [ ] Rate limiting

---

## Progress Tracking

| Phase | Status | Started | Completed | Hours |
|-------|--------|---------|-----------|-------|
| Phase 1: Project Stats | Not Started | - | - | - |
| Phase 2: Notifications | Not Started | - | - | - |
| Phase 3: Activity Feed | Not Started | - | - | - |
| Phase 4: Filters & Nav | Not Started | - | - | - |
| Phase 5: Polish | Not Started | - | - | - |

**Estimated Total:** 12-16 hours  
**Actual Total:** - hours

---

## Future Enhancements

- Real-time updates via webhooks
- Deployment status integration (DEPLOY-001)
- Team activity view
- Customizable dashboard layout
- Activity notifications (desktop notifications)
