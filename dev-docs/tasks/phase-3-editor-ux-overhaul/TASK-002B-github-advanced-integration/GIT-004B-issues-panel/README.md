# GIT-004B: Issues Panel - Read & Display

## Overview

Create a new sidebar panel in the Nodegex editor that displays GitHub issues for the connected repository. This is the first user-facing feature of the GitHub integration, providing teams with visibility into their project's issue tracker without leaving the editor.

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** HIGH (core value proposition)  
**Effort:** 10-14 hours  
**Risk:** Low (read-only, well-documented APIs)

**Depends on:** GIT-004A (OAuth & GitHubClient)

---

## Goals

1. **New GitHub Panel** in editor sidebar with tabbed interface
2. **Issues List** with filtering and search
3. **Issue Detail** view with markdown rendering
4. **Comments Display** for full context
5. **Seamless Integration** with existing sidebar patterns

---

## User Experience

### Panel Location

```
┌─────────────────────────────────────────────────────────────┐
│  Nodegex Editor                                             │
├─────────────┬───────────────────────────────────────────────┤
│  Sidebar    │                                               │
│  ─────────  │                                               │
│  Components │                                               │
│  ─────────  │                                               │
│  Properties │                                               │
│  ─────────  │                                               │
│  Version    │                                               │
│  Control    │                                               │
│  ─────────  │                                               │
│  ┌────────┐ │                                               │
│  │ GitHub │◄── NEW PANEL                                   │
│  │        │ │                                               │
│  └────────┘ │                                               │
└─────────────┴───────────────────────────────────────────────┘
```

### Issues Tab Layout

```
┌─────────────────────────────────────────┐
│ GitHub                            [⚙️]  │
├─────────────────────────────────────────┤
│ [Issues] [PRs] [Deployments]            │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 Search issues...                 │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ● Open (12)  ○ Closed               │ │
│ │ Labels: [bug ▼] Assignee: [Any ▼]   │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ #42 🐛 Login form validation broken     │
│     @johndoe • 2 hours ago              │
├─────────────────────────────────────────┤
│ #41 ✨ Add password strength meter      │
│     @janedoe • 1 day ago                │
├─────────────────────────────────────────┤
│ #38 📝 Update documentation             │
│     @contributor • 3 days ago           │
├─────────────────────────────────────────┤
│           [Load more...]                │
└─────────────────────────────────────────┘
```

### Issue Detail View

```
┌─────────────────────────────────────────┐
│ ← Back                    [Open in GH]  │
├─────────────────────────────────────────┤
│ #42 Login form validation broken        │
│ ─────────────────────────────────────── │
│ 🟢 Open  🐛 bug  🔥 priority-high       │
│ Assigned: @johndoe                      │
├─────────────────────────────────────────┤
│ ## Description                          │
│                                         │
│ When entering an invalid email, the     │
│ form doesn't show the error message...  │
│                                         │
│ ### Steps to reproduce                  │
│ 1. Go to login page                     │
│ 2. Enter "notanemail"                   │
│ 3. Click submit                         │
├─────────────────────────────────────────┤
│ 💬 Comments (3)                         │
├─────────────────────────────────────────┤
│ @janedoe • 1 hour ago                   │
│ I can reproduce this on Chrome...       │
├─────────────────────────────────────────┤
│ @johndoe • 30 min ago                   │
│ Found the issue, working on fix...      │
└─────────────────────────────────────────┘
```

---

## Architecture

### Component Structure

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── GitHubPanel.tsx              # Main panel container
├── GitHubPanel.module.scss      # Panel styles
├── components/
│   ├── TabNavigation.tsx        # Issues/PRs/Deployments tabs
│   ├── IssuesTab/
│   │   ├── IssuesTab.tsx        # Tab container
│   │   ├── IssuesList.tsx       # List of issues
│   │   ├── IssueItem.tsx        # Single issue row
│   │   ├── IssueDetail.tsx      # Full issue view
│   │   ├── IssueFilters.tsx     # Filter controls
│   │   ├── IssueLabels.tsx      # Label badges
│   │   └── IssueComments.tsx    # Comments list
│   └── common/
│       ├── MarkdownRenderer.tsx # GitHub-flavored markdown
│       ├── UserAvatar.tsx       # User avatar display
│       ├── TimeAgo.tsx          # Relative time display
│       └── EmptyState.tsx       # No issues state
├── hooks/
│   ├── useGitHubPanel.ts        # Panel state management
│   ├── useIssues.ts             # Issues data fetching
│   └── useIssueDetail.ts        # Single issue fetching
├── types.ts                     # TypeScript interfaces
└── index.ts                     # Exports
```

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHubPanel    │────►│  useIssues()    │────►│  GitHubClient   │
│  (Component)    │     │  (Hook)         │     │  .issues.list() │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       ▼                       │
        │               ┌─────────────────┐             │
        │               │  Local State    │             │
        │               │  - issues[]     │◄────────────┘
        │               │  - loading      │
        │               │  - error        │
        │               │  - filters      │
        │               └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  IssuesList     │────►│  IssueItem      │
│  (Component)    │     │  (Component)    │
└─────────────────┘     └─────────────────┘
```

---

## Implementation Phases

### Phase 1: Panel Structure (2-3 hours)

Create the basic panel shell and register it with the sidebar.

**Files to Create:**
- `GitHubPanel.tsx`
- `GitHubPanel.module.scss`
- `components/TabNavigation.tsx`
- `types.ts`
- `index.ts`

**Tasks:**
1. Create GitHubPanel component shell
2. Implement tab navigation (Issues active, PRs/Deployments placeholder)
3. Register panel with SidebarModel
4. Add GitHub icon to sidebar
5. Handle "not connected" state

**Success Criteria:**
- [ ] Panel appears in sidebar
- [ ] Tab navigation renders
- [ ] Shows "Connect GitHub" if not authenticated
- [ ] No console errors

---

### Phase 2: Issues List (3-4 hours)

Fetch and display the list of issues.

**Files to Create:**
- `components/IssuesTab/IssuesTab.tsx`
- `components/IssuesTab/IssuesList.tsx`
- `components/IssuesTab/IssueItem.tsx`
- `components/IssuesTab/IssueLabels.tsx`
- `hooks/useIssues.ts`

**Tasks:**
1. Create `useIssues` hook with GitHubClient
2. Implement issues list fetching
3. Create IssueItem component with status, title, labels
4. Add loading state
5. Add error state
6. Implement pagination ("Load more")

**Success Criteria:**
- [ ] Issues load on panel open
- [ ] Each issue shows title, number, status
- [ ] Labels display with colors
- [ ] Loading spinner shows during fetch
- [ ] Error message on failure
- [ ] Pagination loads more issues

---

### Phase 3: Issue Filters (2-3 hours)

Add filtering and search capabilities.

**Files to Create:**
- `components/IssuesTab/IssueFilters.tsx`

**Tasks:**
1. Implement open/closed toggle
2. Implement label filter dropdown
3. Implement assignee filter dropdown
4. Implement search input
5. Persist filter state in session

**Success Criteria:**
- [ ] Open/Closed toggle works
- [ ] Label filter shows repo labels
- [ ] Assignee filter shows repo contributors
- [ ] Search filters by title/body
- [ ] Filters persist during session
- [ ] Clear filters button works

---

### Phase 4: Issue Detail (2-3 hours)

Show full issue details with markdown rendering.

**Files to Create:**
- `components/IssuesTab/IssueDetail.tsx`
- `components/IssuesTab/IssueComments.tsx`
- `components/common/MarkdownRenderer.tsx`
- `components/common/UserAvatar.tsx`
- `components/common/TimeAgo.tsx`
- `hooks/useIssueDetail.ts`

**Tasks:**
1. Create IssueDetail component
2. Implement markdown rendering with react-markdown
3. Support GitHub Flavored Markdown (tables, task lists, etc.)
4. Display issue metadata (assignees, labels, milestone)
5. Fetch and display comments
6. Add "Open in GitHub" link
7. Implement back navigation

**Success Criteria:**
- [ ] Clicking issue opens detail view
- [ ] Markdown renders correctly
- [ ] Code blocks have syntax highlighting
- [ ] Comments display with user avatars
- [ ] "Open in GitHub" opens browser
- [ ] Back button returns to list

---

### Phase 5: Polish (1-2 hours)

Final refinements and edge cases.

**Tasks:**
1. Add empty state for no issues
2. Handle rate limiting gracefully
3. Add refresh button
4. Optimize re-renders
5. Add keyboard navigation (optional)
6. Test with large issue lists (100+)

**Success Criteria:**
- [ ] Empty state looks good
- [ ] Rate limit shows friendly message
- [ ] Refresh updates list
- [ ] Performance acceptable with 100+ issues

---

## Files Summary

### Create (New)

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── GitHubPanel.tsx
├── GitHubPanel.module.scss
├── components/
│   ├── TabNavigation.tsx
│   ├── IssuesTab/
│   │   ├── IssuesTab.tsx
│   │   ├── IssuesList.tsx
│   │   ├── IssueItem.tsx
│   │   ├── IssueDetail.tsx
│   │   ├── IssueFilters.tsx
│   │   ├── IssueLabels.tsx
│   │   └── IssueComments.tsx
│   └── common/
│       ├── MarkdownRenderer.tsx
│       ├── UserAvatar.tsx
│       ├── TimeAgo.tsx
│       └── EmptyState.tsx
├── hooks/
│   ├── useGitHubPanel.ts
│   ├── useIssues.ts
│   └── useIssueDetail.ts
├── types.ts
└── index.ts
```

### Modify

```
packages/noodl-editor/src/editor/src/router.setup.ts
  - Register GitHubPanel with SidebarModel

packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.tsx
  - May need adjustment for new panel type
```

---

## Dependencies

### NPM Packages

```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-highlight": "^7.0.0"
}
```

---

## Testing Checklist

- [ ] Panel appears for GitHub-connected repos
- [ ] Panel hidden for non-GitHub repos
- [ ] Issues list loads correctly
- [ ] Open/Closed filter works
- [ ] Label filter works
- [ ] Assignee filter works
- [ ] Search works
- [ ] Issue detail shows all info
- [ ] Markdown renders correctly
- [ ] Comments load and display
- [ ] "Open in GitHub" works
- [ ] Empty state displays
- [ ] Error states display
- [ ] Loading states display
- [ ] Pagination works
- [ ] Rate limiting handled

---

## References

- [GitHub Issues API](https://docs.github.com/en/rest/issues/issues)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [remark-gfm](https://github.com/remarkjs/remark-gfm)
- Existing: `SearchPanel.tsx` - Sidebar panel pattern
- Existing: `VersionControlPanel/` - Panel with tabs pattern
