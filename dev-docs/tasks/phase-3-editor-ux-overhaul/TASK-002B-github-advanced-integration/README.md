# TASK-002B: GitHub Advanced Integration

## Overview

This task encompasses **two major feature sets**:

### Part 1: GitHub Project Management (GIT-004A-F)

Transform OpenNoodl from a "coding tool with Git" into a **collaborative development hub** where teams can manage their entire project workflow without leaving the editor.

**The killer feature**: Link GitHub issues directly to visual components, enabling unprecedented traceability between project management and implementation.

**Effort:** 70-90 hours across 6 sub-tasks

### Part 2: Live Collaboration & Multi-Community (GIT-005-011)

Transform OpenNoodl into a **collaborative platform** with real-time multi-user editing (Google Docs for visual programming), multi-community support, and persistent notifications.

**Effort:** 431-572 hours across 7 sub-tasks

---

**Phase:** 3 (Dashboard UX & Collaboration)  
**Priority:** HIGH (key differentiator)  
**Total Effort:** 501-662 hours across 13 sub-tasks  
**Risk:** Medium-High (OAuth complexity, WebRTC, server infrastructure)

---

## Integration Strategy

**Important:** We're extending the existing `VersionControlPanel` rather than creating a separate panel. The existing panel is already 100% React with full visual diff support (showing green nodes for additions, red for deletions).

See **[GIT-INTEGRATION-STRATEGY.md](./GIT-INTEGRATION-STRATEGY.md)** for details.

**Key insight:** The visual commit diff system already works perfectly - we just need to add GitHub-specific tabs (Issues, PRs) to the existing panel.

---

## Strategic Value

### Market Differentiation

No major low-code platform offers this level of GitHub integration:

| Platform    | Git Support | Issues/PRs | Component Linking |
| ----------- | ----------- | ---------- | ----------------- |
| Retool      | ❌          | ❌         | ❌                |
| Bubble      | ❌          | ❌         | ❌                |
| Webflow     | Basic       | ❌         | ❌                |
| FlutterFlow | Basic       | ❌         | ❌                |
| **Nodegex** | ✅ Full     | ✅ Full    | ✅ **Unique**     |

### Target Users

- **Development Teams**: Manage sprints without context-switching
- **Professional Associations**: Track member portal features and bugs
- **Agencies**: Client-facing issue tracking within projects
- **Open Source Projects**: Contributor-friendly development environment

---

## Feature Scope

### Editor Integration (Primary)

Full-featured GitHub panel in the editor sidebar for active development work.

```
┌─────────────────────────────────────────────────────────────┐
│  Nodegex Editor                                             │
├─────────────┬───────────────────────────────────────────────┤
│  Sidebar    │  Canvas / Node Editor                         │
│  ─────────  │                                               │
│  Components │  ┌─────────────────────────────────────┐      │
│  ─────────  │  │ Component Context Menu:             │      │
│  Properties │  │ ─────────────────────────           │      │
│  ─────────  │  │ • 📋 Create Issue from Component    │      │
│  Version    │  │ • 🔗 Link to Existing Issue (#42)   │      │
│  Control    │  │ • 👁️ View Linked Issues (3)         │      │
│  ─────────  │  │ • 🐛 Quick Bug Report               │      │
│  ┌────────┐ │  └─────────────────────────────────────┘      │
│  │GitHub  │ │                                               │
│  │Panel   │◄──── NEW: Issues, PRs, Discussions             │
│  │        │ │                                               │
│  └────────┘ │                                               │
└─────────────┴───────────────────────────────────────────────┘
```

### Dashboard Integration (Secondary)

Overview widgets for project health and team awareness.

```
┌─────────────────────────────────────────────────────────────┐
│  Nodegex Dashboard                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Project A       │  │ Project B       │                   │
│  │ ───────────     │  │ ───────────     │                   │
│  │ 🔴 5 Open Issues│  │ 🟢 0 Open Issues│                   │
│  │ 🟡 2 Open PRs   │  │ 🟡 1 Open PR    │                   │
│  │ 💬 3 New Discuss│  │ 💬 0 Discussions│                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🔔 Recent Activity                                  │    │
│  │ ─────────────────────────────────────────────────── │    │
│  │ • Issue #42 assigned to you (Project A) - 2h ago   │    │
│  │ • PR #15 ready for review (Project B) - 5h ago     │    │
│  │ • New comment on Issue #38 (Project A) - 1d ago    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Sub-Task Breakdown

### GIT-004A: GitHub OAuth & Client Foundation (8-12 hours)

**Prerequisite for all other sub-tasks.**

Upgrade from PAT-based authentication to full GitHub App OAuth flow, and create a reusable GitHub API client.

**Scope:**

- GitHub App registration guidance/documentation
- OAuth authorization flow in Electron
- Secure token storage (upgrade from current GitStore pattern)
- `GitHubClient` service with rate limiting and error handling
- Token refresh handling

**Files to Create:**

```
packages/noodl-editor/src/editor/src/services/github/
├── GitHubAuth.ts              # OAuth flow handler
├── GitHubClient.ts            # REST API wrapper (@octokit/rest)
├── GitHubTypes.ts             # TypeScript interfaces
├── GitHubTokenStore.ts        # Secure token persistence
└── index.ts
```

**Files to Modify:**

```
packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/
  components/GitProviderPopout/GitProviderPopout.tsx
  - Add "Connect GitHub Account" button for OAuth
  - Show connection status

packages/noodl-git/src/git.ts
  - Integrate with new GitHubClient for authenticated operations
```

**Success Criteria:**

- [ ] User can authenticate via GitHub OAuth from editor
- [ ] Token stored securely and persists across sessions
- [ ] Token refresh works automatically
- [ ] GitHubClient can make authenticated API calls
- [ ] Rate limiting handled gracefully with user feedback

---

### GIT-004B: Issues Panel - Read & Display (10-14 hours)

View GitHub issues for the connected repository.

**Scope:**

- New sidebar panel: GitHubPanel with tabbed interface
- Issues list with filtering (open/closed, labels, assignees)
- Issue detail view (body, comments, labels, assignees)
- Markdown rendering for issue bodies
- Search/filter within issues
- Pagination for large issue lists

**Files to Create:**

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── GitHubPanel.tsx
├── GitHubPanel.module.scss
├── components/
│   ├── IssuesTab/
│   │   ├── IssuesList.tsx
│   │   ├── IssueItem.tsx
│   │   ├── IssueDetail.tsx
│   │   ├── IssueFilters.tsx
│   │   └── IssueDetail.module.scss
│   └── TabNavigation.tsx
├── hooks/
│   ├── useGitHubPanel.ts
│   └── useIssues.ts
└── types.ts
```

**Files to Modify:**

```
packages/noodl-editor/src/editor/src/router.setup.ts
  - Register GitHubPanel with SidebarModel

packages/noodl-editor/src/editor/src/models/sidebar/sidebarmodel.tsx
  - Add GitHub panel configuration
```

**Dependencies:**

- `react-markdown` for rendering issue bodies
- `@octokit/rest` (from GIT-004A)

**Success Criteria:**

- [ ] GitHub panel appears in sidebar when repo is connected
- [ ] Issues list loads and displays correctly
- [ ] Filters work (open/closed, labels, assignees, search)
- [ ] Issue detail shows full content with markdown rendering
- [ ] Comments display in chronological order
- [ ] Pagination works for repos with many issues
- [ ] Loading states and error handling implemented

---

### GIT-004C: Pull Requests Panel - Read & Display (10-14 hours)

View GitHub pull requests for the connected repository.

**Scope:**

- PRs tab in GitHubPanel
- PR list with status indicators (draft, review requested, approved, changes requested)
- PR detail view (description, commits, checks status)
- Review status display (approvals, requested changes)
- Link to view diff (opens in browser or future in-editor diff)
- Merge conflict indicators

**Files to Create:**

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── PullRequestsTab/
│       ├── PRsList.tsx
│       ├── PRItem.tsx
│       ├── PRDetail.tsx
│       ├── PRStatusBadge.tsx
│       ├── PRChecksStatus.tsx
│       └── PRDetail.module.scss
├── hooks/
│   └── usePullRequests.ts
```

**Success Criteria:**

- [ ] PRs tab displays all open PRs
- [ ] Status badges show draft/review/approved/changes requested
- [ ] PR detail shows description, commits list, checks status
- [ ] Merge conflict warnings display prominently
- [ ] "View on GitHub" link works
- [ ] Review status shows who approved/requested changes

---

### GIT-004D: Create & Update Issues (12-16 hours)

Full CRUD operations for GitHub issues from within Nodegex.

**Scope:**

- Create Issue dialog with title, body (markdown editor), labels, assignees
- Edit existing issues (title, body, status)
- Add comments to issues
- Change issue status (open/closed)
- Quick Bug Report from component context menu (pre-fills component info)
- Issue templates support (load from repo's .github/ISSUE_TEMPLATE/)

**Files to Create:**

```
packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   └── IssuesTab/
│       ├── CreateIssueDialog.tsx
│       ├── CreateIssueDialog.module.scss
│       ├── EditIssueDialog.tsx
│       ├── AddCommentForm.tsx
│       └── MarkdownEditor.tsx       # Simple markdown input with preview
├── hooks/
│   └── useIssueActions.ts
```

**Files to Modify:**

```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/
  - Add context menu items for component-linked issue creation
```

**Success Criteria:**

- [ ] Create Issue dialog opens from panel header
- [ ] Can set title, body, labels, assignees
- [ ] Markdown preview works in body editor
- [ ] Issue templates load if available in repo
- [ ] Can edit existing issues
- [ ] Can add comments
- [ ] Can close/reopen issues
- [ ] Quick Bug Report from component context menu works
- [ ] Newly created issues appear in list immediately

---

### GIT-004E: Component Linking System (14-18 hours)

**THE KILLER FEATURE**: Link GitHub issues to visual components for unprecedented traceability.

**Scope:**

- Component metadata extension for issue links
- "Link Issue" dialog from component context menu
- "Create Issue from Component" with auto-populated context
- Visual indicators on components with linked issues
- Issue detail shows linked components (clickable to navigate)
- Component detail shows linked issues
- Bidirectional navigation

**Architecture:**

```typescript
// Component metadata extension (in project.json)
interface ComponentMetadata {
  name: string;
  // ... existing fields
  github?: {
    linkedIssues: number[]; // Issue numbers
    linkedPRs: number[]; // PR numbers
    lastModifiedBy?: string; // GitHub username
  };
}

// Issue display shows linked components
interface LinkedComponent {
  componentName: string;
  componentPath: string; // For navigation
  linkType: 'mentioned' | 'implements' | 'fixes';
}
```

**Files to Create:**

```
packages/noodl-editor/src/editor/src/services/github/
├── ComponentLinking.ts          # Link management logic
└── ComponentLinkingTypes.ts

packages/noodl-editor/src/editor/src/views/panels/GitHubPanel/
├── components/
│   ├── LinkIssueDialog.tsx
│   ├── LinkedComponentsList.tsx
│   └── ComponentIssueBadge.tsx   # Visual indicator for canvas
```

**Files to Modify:**

```
packages/noodl-editor/src/editor/src/models/projectmodel.ts
  - Add methods for component GitHub metadata

packages/noodl-editor/src/editor/src/views/nodegrapheditor/
  - Add visual indicators for components with linked issues
  - Add context menu items for linking

packages/noodl-editor/src/editor/src/views/panels/PropertyPanel/
  - Show linked issues section in component properties
```

**User Flows:**

1. **Link Existing Issue to Component:**

   - Right-click component → "Link to Issue"
   - Search/select from open issues
   - Choose link type (mentions, implements, fixes)
   - Component shows badge, issue shows component link

2. **Create Issue from Component:**

   - Right-click component → "Create Issue"
   - Dialog pre-fills: component name, path, screenshot option
   - Creates issue and links automatically

3. **Navigate from Issue to Component:**

   - In issue detail, "Linked Components" section
   - Click component name → navigates to component in editor

4. **Quick Bug Report:**
   - Right-click component → "Report Bug"
   - Streamlined dialog with component context
   - Auto-labels as "bug"

**Success Criteria:**

- [ ] Can link issues to components via context menu
- [ ] Can create issue from component with pre-filled context
- [ ] Components show visual indicator when issues linked
- [ ] Issue detail shows linked components
- [ ] Can navigate from issue to component
- [ ] Links persist in project.json
- [ ] Quick Bug Report works with minimal friction
- [ ] Can unlink issues from components

---

### GIT-004F: Dashboard Widgets & Notifications (12-16 hours)

Project health overview and activity feed in the Dashboard.

**Scope:**

- Project card enhancements: issue/PR counts, health indicators
- Activity feed widget: recent issue/PR activity across projects
- Notification badges for items needing attention
- "Assigned to me" quick filter
- Click-through to editor with correct panel open

**Files to Create:**

```
packages/noodl-editor/src/editor/src/views/Dashboard/
├── components/
│   ├── GitHubProjectStats.tsx      # Stats for project cards
│   ├── GitHubActivityFeed.tsx      # Cross-project activity
│   ├── GitHubNotificationBadge.tsx # Attention needed indicator
│   └── GitHubActivityFeed.module.scss
├── hooks/
│   └── useDashboardGitHub.ts       # Aggregate GitHub data
```

**Files to Modify:**

```
packages/noodl-editor/src/editor/src/views/Dashboard/ProjectCard/
  - Add GitHub stats display
  - Add notification badges

packages/noodl-editor/src/editor/src/views/Dashboard/Dashboard.tsx
  - Add activity feed widget section
```

**Dashboard Features:**

1. **Project Card Stats:**

   ```
   ┌─────────────────────────┐
   │ My Project              │
   │ ─────────────           │
   │ Last edited: 2 days ago │
   │ ─────────────           │
   │ 🔴 5 Open Issues        │
   │ 🟡 2 PRs need review    │
   │ 💬 1 New discussion     │
   └─────────────────────────┘
   ```

2. **Activity Feed:**

   - Shows recent activity across all connected projects
   - Filterable by type (issues, PRs, discussions)
   - "Assigned to me" filter
   - Click to open project and navigate to item

3. **Notification Badges:**
   - Red badge on project card when attention needed
   - Attention triggers: assigned issues, review requests, mentions

**Success Criteria:**

- [ ] Project cards show GitHub stats when connected
- [ ] Activity feed displays recent cross-project activity
- [ ] Notification badges appear for items needing attention
- [ ] Clicking activity opens correct project and panel
- [ ] "Assigned to me" filter works
- [ ] Stats update when dashboard refreshes
- [ ] Handles projects without GitHub gracefully

---

## Technical Architecture

### Service Layer

```
packages/noodl-editor/src/editor/src/services/github/
├── GitHubAuth.ts           # OAuth flow, token management
├── GitHubClient.ts         # API wrapper with rate limiting
├── GitHubTypes.ts          # TypeScript interfaces
├── GitHubTokenStore.ts     # Secure persistence
├── ComponentLinking.ts     # Component ↔ Issue linking logic
└── index.ts                # Public exports
```

### State Management

Use React hooks with GitHubClient as the data source:

```typescript
// Example hook pattern
function useIssues(repoOwner: string, repoName: string) {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useGitHubClient();

  useEffect(() => {
    client.issues
      .list({ owner: repoOwner, repo: repoName })
      .then(setIssues)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [repoOwner, repoName]);

  return { issues, loading, error, refetch };
}
```

### GitHub API Permissions Required

```
Repository permissions:
  - Issues: Read and write
  - Pull requests: Read and write
  - Discussions: Read and write
  - Contents: Read (for PR diffs, templates)
  - Metadata: Read

User permissions:
  - Email addresses: Read (for user identification)
```

### Rate Limiting Strategy

GitHub API has limits (5000 requests/hour for authenticated users). Strategy:

1. **Caching**: Cache issue/PR lists for 30 seconds
2. **Conditional requests**: Use ETags for "not modified" responses
3. **Pagination**: Load in batches, don't fetch all at once
4. **User feedback**: Show rate limit status, warn when approaching

---

## Dependencies

### NPM Packages to Add

```json
{
  "@octokit/rest": "^20.0.0", // GitHub API client
  "@octokit/auth-oauth-app": "^7.0.0", // OAuth flow
  "react-markdown": "^9.0.0", // Markdown rendering
  "remark-gfm": "^4.0.0" // GitHub Flavored Markdown
}
```

### Blocked By

- **Phase 0**: Foundation Stabilization (webpack/React issues)
- **GIT-002/003**: Existing GitHub integration tasks (if not complete)

### Blocks

- Future: GitHub Actions integration
- Future: Code review workflow in editor

---

## Implementation Order

```
GIT-004A: OAuth & Client Foundation
    │
    ├──► GIT-004B: Issues Panel (Read)
    │        │
    │        └──► GIT-004D: Issues (Create/Update)
    │                 │
    │                 └──► GIT-004E: Component Linking
    │
    └──► GIT-004C: PRs Panel (Read)
             │
             └──► GIT-004F: Dashboard Widgets
```

**Recommended sequence:**

1. **GIT-004A** (Foundation) - Required first
2. **GIT-004B** (Issues Read) - Core value, quick win
3. **GIT-004D** (Issues Write) - Enables productivity
4. **GIT-004E** (Component Linking) - **Killer feature**
5. **GIT-004C** (PRs Read) - Parallel with above if capacity
6. **GIT-004F** (Dashboard) - Polish layer

---

## Testing Strategy

### Unit Tests

- GitHubClient API wrapper methods
- Component linking logic
- Token storage/refresh

### Integration Tests

- OAuth flow (mock GitHub responses)
- Issue CRUD operations
- Component metadata persistence

### Manual Testing Checklist

- [ ] Fresh OAuth authorization
- [ ] Token refresh after expiry
- [ ] Issue list with 100+ issues (pagination)
- [ ] Create/edit/close issue cycle
- [ ] Link issue to component, navigate back
- [ ] Dashboard with multiple projects
- [ ] Offline behavior / error states
- [ ] Rate limit handling

---

## Risks & Mitigations

| Risk                         | Impact | Probability | Mitigation                                       |
| ---------------------------- | ------ | ----------- | ------------------------------------------------ |
| GitHub API rate limits       | Medium | Medium      | Caching, conditional requests, user feedback     |
| OAuth complexity in Electron | High   | Medium      | Follow GitHub Desktop patterns, thorough testing |
| Token security concerns      | High   | Low         | Use OS keychain via electron-store encryption    |
| Large repos performance      | Medium | Medium      | Pagination, virtual lists, lazy loading          |
| GitHub API changes           | Low    | Low         | Pin @octokit version, integration tests          |

---

## Future Enhancements (Out of Scope)

- **GitHub Actions**: View/trigger workflows from editor
- **PR Review in Editor**: Full diff view, approve/request changes
- **Discussions Full CRUD**: Currently read-only planned
- **GitHub Projects**: Kanban board integration
- **Webhooks**: Real-time updates (requires server component)
- **Multi-repo Support**: Track issues across multiple repos

---

## Success Metrics

1. **Adoption**: 50% of team projects connect GitHub within 3 months
2. **Engagement**: Average 5+ issues created per active project per month
3. **Retention**: Component linking used in 30% of connected projects
4. **Satisfaction**: Positive feedback on reduced context-switching

---

## References

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Octokit.js](https://github.com/octokit/octokit.js)
- [GitHub OAuth Apps](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitHub App Permissions](https://docs.github.com/en/rest/overview/permissions-required-for-github-apps)
- Existing: `packages/noodl-git/` - Current Git integration
- Existing: `VersionControlPanel/` - Current VCS UI patterns

---

# Part 2: Live Collaboration & Multi-Community System (GIT-005-011)

## Overview

This series transforms OpenNoodl into a collaborative platform with multi-community support, live real-time collaboration (Google Docs for visual programming), and persistent notification system.

**Total Estimated Hours:** 431-572 hours

---

## Task Summary

| Task    | Name                        | Estimated Hours | Status         |
| ------- | --------------------------- | --------------- | -------------- |
| GIT-005 | Community Infrastructure    | 60-80           | 🔴 Not Started |
| GIT-006 | Server Infrastructure       | 80-100          | 🔴 Not Started |
| GIT-007 | WebRTC Collaboration Client | 100-130         | 🔴 Not Started |
| GIT-008 | Notification System         | 50-70           | 🔴 Not Started |
| GIT-009 | Community Tab UI/UX         | 80-100          | 🔴 Not Started |
| GIT-010 | Session Discovery & Joining | 50-70           | 🔴 Not Started |
| GIT-011 | Integration & Polish        | 61-82           | 🔴 Not Started |

---

## Key Features

### Multi-Community System

- Join multiple communities simultaneously
- Fork and operate your own communities
- Self-hosted infrastructure option (BYOB philosophy)
- Community template repository for forking

### Live Collaboration

- Real-time multi-user editing via WebRTC
- Cursor and selection sharing
- Audio/video chat built-in
- Automatic WebSocket fallback when P2P fails

### Persistent Notifications

- Cross-session notification system
- Collaboration invites
- Community events and mentions
- Desktop notification support

### Community Features

- Component library discovery
- Tutorial and showcase feeds
- GitHub Discussions integration
- Job board

---

## Task Details

Each task has a detailed README in its subdirectory:

- **[GIT-005: Community Infrastructure](./GIT-005-community-infrastructure/README.md)** - Template repository, community.json schema, CommunityManager service
- **[GIT-006: Server Infrastructure](./GIT-006-server-infrastructure/README.md)** - Signaling, Sync, and Notification servers
- **[GIT-007: WebRTC Collaboration](./GIT-007-webrtc-collaboration/README.md)** - P2P connections, Yjs CRDT sync, media handling
- **[GIT-008: Notification System](./GIT-008-notification-system/README.md)** - NotificationManager, toasts, notification center
- **[GIT-009: Community UI](./GIT-009-community-ui/README.md)** - Community tab with sessions, components, tutorials
- **[GIT-010: Session Discovery](./GIT-010-session-discovery/README.md)** - Deep links, quick join, session history
- **[GIT-011: Integration & Polish](./GIT-011-integration-polish/README.md)** - Testing, documentation, deployment

---

## Implementation Order

```
GIT-005: Community Infrastructure
    │
    └──► GIT-006: Server Infrastructure
              │
              ├──► GIT-007: WebRTC Collaboration Client
              │         │
              │         └──► GIT-010: Session Discovery
              │
              └──► GIT-008: Notification System
                        │
                        └──► GIT-009: Community Tab UI
                                  │
                                  └──► GIT-011: Integration & Polish
```

---

## Dependencies

### NPM Packages

```json
{
  "yjs": "^13.6.0",
  "y-webrtc": "^10.2.0",
  "y-websocket": "^1.5.0",
  "simple-peer": "^9.11.0"
}
```

### External Infrastructure

- Signaling server (WebSocket)
- Sync server (Yjs WebSocket)
- Notification server (WebSocket + persistence)
- TURN server (for WebRTC fallback)

---

## Source Documentation

Full detailed specifications are in:

- `GIT-5-to-GIT-11-Live-Collaboration-Community-System.md`
- `GIT-5-to-GIT-11-Part-2-Community-UI-Integration.md`
