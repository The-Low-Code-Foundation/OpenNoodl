# GIT-004: Implementation Checklist

> **⚠️ IMPORTANT: Integration Strategy Update (Jan 18, 2026)**
>
> GIT-004A-C were implemented with a separate `GitHubPanel`. However, we discovered that the existing `VersionControlPanel` is already 100% React with full visual diff support.
>
> **Going forward (GIT-004D-F):** We will integrate GitHub features into the existing VersionControlPanel as new tabs, rather than maintaining a separate panel.
>
> See **[GIT-INTEGRATION-STRATEGY.md](./GIT-INTEGRATION-STRATEGY.md)** for the full plan.
>
> **What this means for the checklist:**
>
> - GIT-004A-C: ✅ Complete (GitHubPanel code exists and works)
> - GIT-004D-F: Will move components from GitHubPanel → VersionControlPanel tabs

---

## Pre-Implementation

- [x] Review existing `packages/noodl-git/` code
- [x] Review `VersionControlPanel/` patterns
- [ ] Set up GitHub App in GitHub Developer Settings (for testing)
- [ ] Document GitHub App creation steps for users

---

## GIT-004A: GitHub OAuth & Client Foundation

**Branch:** `task/git-004a-github-oauth`  
**Estimated:** 8-12 hours

### Phase 1: GitHub App Setup Documentation (1-2 hours)

- [ ] Create guide for registering GitHub App
- [ ] Document required permissions
- [ ] Document OAuth callback URL configuration
- [ ] Add to user-facing documentation

### Phase 2: OAuth Flow Implementation (3-4 hours)

- [ ] Create `GitHubAuth.ts` with OAuth flow
- [ ] Implement authorization URL generation
- [ ] Handle OAuth callback in Electron
- [ ] Exchange code for access token
- [ ] Handle token refresh

### Phase 3: Token Storage (2-3 hours)

- [ ] Create `GitHubTokenStore.ts`
- [ ] Implement secure storage (electron-store with encryption)
- [ ] Store access token and refresh token
- [ ] Implement token retrieval
- [ ] Implement token clearing (logout)

### Phase 4: GitHub Client (2-3 hours)

- [ ] Create `GitHubClient.ts` wrapper around @octokit/rest
- [ ] Implement rate limiting awareness
- [ ] Add request caching layer
- [ ] Create typed API methods
- [ ] Add error handling with user-friendly messages

### Phase 5: Integration (1-2 hours)

- [ ] Add "Connect GitHub" button to GitProviderPopout
- [ ] Show connection status
- [ ] Add "Disconnect" option
- [ ] Test end-to-end flow

### Verification

- [ ] Can complete OAuth flow from editor
- [ ] Token persists across app restarts
- [ ] Can make authenticated API call
- [ ] Rate limit info accessible
- [ ] Can disconnect and reconnect

---

## GIT-004B: Issues Panel - Read & Display

**Branch:** `task/git-004b-issues-panel`  
**Estimated:** 10-14 hours  
**Depends on:** GIT-004A

### Phase 1: Panel Structure (2-3 hours)

- [ ] Create `GitHubPanel/` directory structure
- [ ] Create `GitHubPanel.tsx` shell component
- [ ] Create `GitHubPanel.module.scss`
- [ ] Register panel with SidebarModel
- [ ] Implement tab navigation (Issues, PRs, Discussions)

### Phase 2: Issues List (3-4 hours)

- [ ] Create `useIssues.ts` hook
- [ ] Create `IssuesList.tsx` component
- [ ] Create `IssueItem.tsx` component
- [ ] Implement issue status indicators
- [ ] Add loading states
- [ ] Implement pagination

### Phase 3: Issue Filters (2-3 hours)

- [ ] Create `IssueFilters.tsx` component
- [ ] Implement open/closed toggle
- [ ] Implement label filter
- [ ] Implement assignee filter
- [ ] Implement search
- [ ] Persist filter state

### Phase 4: Issue Detail (2-3 hours)

- [ ] Create `IssueDetail.tsx` component
- [ ] Install and configure react-markdown
- [ ] Render issue body with GFM support
- [ ] Display labels, assignees, milestone
- [ ] Display comments list
- [ ] Add "Open in GitHub" link

### Phase 5: Polish (1-2 hours)

- [ ] Error state handling
- [ ] Empty state messaging
- [ ] Refresh functionality
- [ ] Keyboard navigation (optional)

### Verification

- [ ] Panel appears in sidebar for connected repos
- [ ] Issues load and display correctly
- [ ] All filters work
- [ ] Issue detail renders markdown correctly
- [ ] Comments display properly
- [ ] Pagination works with 100+ issues

---

## GIT-004C: Pull Requests Panel - Read & Display

**Branch:** `task/git-004c-prs-panel`  
**Estimated:** 10-14 hours  
**Depends on:** GIT-004A

### Phase 1: PRs Tab (2-3 hours)

- [ ] Create `PullRequestsTab/` directory
- [ ] Create `usePullRequests.ts` hook
- [ ] Create `PRsList.tsx` component
- [ ] Create `PRItem.tsx` component

### Phase 2: PR Status Display (3-4 hours)

- [ ] Create `PRStatusBadge.tsx` component
- [ ] Implement draft indicator
- [ ] Implement review status (pending, approved, changes requested)
- [ ] Implement merge conflict indicator
- [ ] Implement checks status indicator

### Phase 3: PR Detail (3-4 hours)

- [ ] Create `PRDetail.tsx` component
- [ ] Display PR description (markdown)
- [ ] Display commits list
- [ ] Create `PRChecksStatus.tsx` for CI status
- [ ] Display reviewers and their status
- [ ] Add "Open in GitHub" link

### Phase 4: Polish (2-3 hours)

- [ ] Filter by status (open, closed, merged)
- [ ] Filter by author
- [ ] Search functionality
- [ ] Error and loading states

### Verification

- [ ] PRs tab shows all open PRs
- [ ] Status badges accurate
- [ ] Detail view shows all info
- [ ] Checks status displays correctly
- [ ] Reviewer status accurate

---

## GIT-004D: Create & Update Issues

**Branch:** `task/git-004d-issues-crud`  
**Estimated:** 12-16 hours  
**Depends on:** GIT-004B

### Phase 1: Create Issue Dialog (4-5 hours)

- [ ] Create `CreateIssueDialog.tsx`
- [ ] Create `CreateIssueDialog.module.scss`
- [ ] Implement title input
- [ ] Create `MarkdownEditor.tsx` with preview
- [ ] Implement label selector
- [ ] Implement assignee selector
- [ ] Add create button with loading state

### Phase 2: Issue Templates (2-3 hours)

- [ ] Fetch templates from `.github/ISSUE_TEMPLATE/`
- [ ] Display template selector
- [ ] Pre-fill body from template
- [ ] Handle repos without templates

### Phase 3: Edit Issue (2-3 hours)

- [ ] Create `EditIssueDialog.tsx`
- [ ] Implement inline title editing
- [ ] Implement body editing
- [ ] Implement status toggle (open/close)
- [ ] Implement label management
- [ ] Implement assignee management

### Phase 4: Comments (2-3 hours)

- [ ] Create `AddCommentForm.tsx`
- [ ] Implement comment submission
- [ ] Update comments list after submission
- [ ] Handle comment errors

### Phase 5: Quick Actions (2-3 hours)

- [ ] Add "New Issue" button to panel header
- [ ] Integrate with context menu system
- [ ] Add component context menu item (prep for GIT-004E)

### Verification

- [ ] Can create issue with all fields
- [ ] Templates load and pre-fill
- [ ] Can edit existing issues
- [ ] Can add comments
- [ ] Can close/reopen issues
- [ ] New issues appear immediately in list

---

## GIT-004E: Component Linking System

**Branch:** `task/git-004e-component-linking`  
**Estimated:** 14-18 hours  
**Depends on:** GIT-004D

### Phase 1: Metadata System (3-4 hours)

- [ ] Design component GitHub metadata schema
- [ ] Update ProjectModel with GitHub metadata methods
- [ ] Implement metadata persistence in project.json
- [ ] Create `ComponentLinking.ts` service
- [ ] Add migration for existing projects (empty metadata)

### Phase 2: Link Issue Dialog (3-4 hours)

- [ ] Create `LinkIssueDialog.tsx`
- [ ] Implement issue search/select
- [ ] Implement link type selector (mentions, implements, fixes)
- [ ] Save link to component metadata
- [ ] Update issue detail to show link

### Phase 3: Create Issue from Component (3-4 hours)

- [ ] Add "Create Issue" to component context menu
- [ ] Pre-fill dialog with component name and path
- [ ] Add option to include component screenshot
- [ ] Auto-link created issue to component
- [ ] Auto-add component info to issue body

### Phase 4: Visual Indicators (2-3 hours)

- [ ] Create `ComponentIssueBadge.tsx`
- [ ] Add badge rendering to node graph editor
- [ ] Show count of linked issues
- [ ] Color-code by issue status
- [ ] Add click handler to show linked issues

### Phase 5: Navigation & Display (2-3 hours)

- [ ] Add "Linked Components" section to IssueDetail
- [ ] Implement click-to-navigate from issue to component
- [ ] Add "Linked Issues" section to PropertyPanel
- [ ] Implement click-to-navigate from component to issue

### Phase 6: Quick Bug Report (1-2 hours)

- [ ] Add "Report Bug" to component context menu
- [ ] Streamlined dialog (title only, auto-description)
- [ ] Auto-label as "bug"
- [ ] Auto-link to component

### Verification

- [ ] Can link existing issue to component
- [ ] Can create issue from component
- [ ] Component shows badge when issues linked
- [ ] Can navigate issue → component
- [ ] Can navigate component → issue
- [ ] Links persist across sessions
- [ ] Quick Bug Report works end-to-end
- [ ] Can unlink issues

---

## GIT-004F: Dashboard Widgets & Notifications

**Branch:** `task/git-004f-dashboard-widgets`  
**Estimated:** 12-16 hours  
**Depends on:** GIT-004B, GIT-004C

### Phase 1: Project Card Stats (3-4 hours)

- [ ] Create `GitHubProjectStats.tsx`
- [ ] Fetch issue/PR counts for project
- [ ] Display open issues count
- [ ] Display open PRs count
- [ ] Display discussion count (if enabled)
- [ ] Handle projects without GitHub

### Phase 2: Notification Badges (2-3 hours)

- [ ] Create `GitHubNotificationBadge.tsx`
- [ ] Define "needs attention" criteria
- [ ] Show badge on project cards
- [ ] Show badge count

### Phase 3: Activity Feed (4-5 hours)

- [ ] Create `GitHubActivityFeed.tsx`
- [ ] Create `useDashboardGitHub.ts` hook
- [ ] Aggregate activity across projects
- [ ] Display recent issues, PRs, comments
- [ ] Implement "Assigned to me" filter
- [ ] Implement type filter

### Phase 4: Navigation (2-3 hours)

- [ ] Implement click-to-open-project
- [ ] Auto-open GitHub panel on navigation
- [ ] Navigate to specific item
- [ ] Handle project not found

### Phase 5: Polish (1-2 hours)

- [ ] Refresh on dashboard open
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states

### Verification

- [ ] Project cards show GitHub stats
- [ ] Notification badges appear correctly
- [ ] Activity feed aggregates across projects
- [ ] Filters work
- [ ] Click-through navigation works
- [ ] Projects without GitHub handled gracefully

---

## Final Integration & Polish

**Branch:** `task/git-004-integration`  
**Estimated:** 4-6 hours

### Integration Testing

- [ ] Test all features with real GitHub repo
- [ ] Test with large repo (1000+ issues)
- [ ] Test error scenarios (network, auth, rate limit)
- [ ] Test offline behavior
- [ ] Cross-platform testing (Windows, Mac, Linux)

### Documentation

- [ ] Update user documentation
- [ ] Add GitHub App setup guide
- [ ] Document component linking feature
- [ ] Add troubleshooting section

### Performance

- [ ] Profile API call frequency
- [ ] Verify caching effectiveness
- [ ] Check memory usage with large issue lists
- [ ] Optimize re-renders

### Cleanup

- [ ] Remove console.log statements
- [ ] Ensure consistent error handling
- [ ] Review TypeScript types (no `any`)
- [ ] Code review all new files

---

## Progress Summary - Part 1: GitHub Project Management

| Sub-Task                    | Status      | Started | Completed | Hours |
| --------------------------- | ----------- | ------- | --------- | ----- |
| GIT-004A: OAuth & Client    | ✅ Complete | -       | -         | -     |
| GIT-004B: Issues Read       | ✅ Complete | -       | -         | -     |
| GIT-004C: PRs Read          | ✅ Complete | -       | -         | -     |
| GIT-004D: Issues CRUD       | Not Started | -       | -         | -     |
| GIT-004E: Component Linking | Not Started | -       | -         | -     |
| GIT-004F: Dashboard         | Not Started | -       | -         | -     |
| Integration & Polish        | Not Started | -       | -         | -     |

**Part 1 Estimated:** 70-90 hours  
**Part 1 Actual:** - hours

---

## Part 2: Live Collaboration & Multi-Community (GIT-005-011)

### GIT-005: Community Infrastructure (60-80 hours)

- [ ] Create `opennoodl-community` template repository
- [ ] Implement `community.json` schema and validation
- [ ] Create GitHub Actions workflows for validation
- [ ] Implement `CommunityManager` service
- [ ] Create community settings UI panel
- [ ] Add "Add Community" flow
- [ ] Add "Create Community" flow (fork template)
- [ ] Implement background sync
- [ ] Add server health monitoring
- [ ] Create community switcher UI

### GIT-006: Server Infrastructure (80-100 hours)

**Signaling Server:**

- [ ] Create repository
- [ ] Implement WebSocket room management
- [ ] Implement signal relay
- [ ] Add health check/metrics
- [ ] Create Dockerfile
- [ ] Deploy to production

**Sync Server:**

- [ ] Create repository
- [ ] Implement Yjs WebSocket provider
- [ ] Add optional LevelDB persistence
- [ ] Create Dockerfile
- [ ] Deploy to production

**Notification Server:**

- [ ] Create repository
- [ ] Implement WebSocket authentication
- [ ] Implement notification storage
- [ ] Implement TTL cleanup
- [ ] Create Dockerfile
- [ ] Deploy to production

### GIT-007: WebRTC Collaboration Client (100-130 hours)

- [ ] Create `CollaborationManager` service
- [ ] Implement session creation (host)
- [ ] Implement session joining (guest)
- [ ] Implement signaling server communication
- [ ] Implement WebRTC peer connections
- [ ] Set up Yjs document structure
- [ ] Implement WebRTC provider (y-webrtc)
- [ ] Implement WebSocket fallback (y-websocket)
- [ ] Sync project to Yjs
- [ ] Implement cursor broadcasting
- [ ] Implement selection broadcasting
- [ ] Implement local audio/video capture
- [ ] Display remote media streams
- [ ] Create collaboration toolbar UI
- [ ] Create participant list panel

### GIT-008: Notification System (50-70 hours)

- [ ] Create `NotificationManager` service
- [ ] Implement WebSocket connection
- [ ] Implement notification fetching/parsing
- [ ] Create `NotificationToast` component
- [ ] Create toast queue system
- [ ] Create `NotificationCenter` panel
- [ ] Add notification badge
- [ ] Implement Electron desktop notifications
- [ ] Add notification settings

### GIT-009: Community Tab UI (80-100 hours)

- [ ] Create `CommunityPanel` component
- [ ] Create tab navigation
- [ ] Implement Home view
- [ ] Implement Sessions view
- [ ] Implement Components view
- [ ] Implement Learn view
- [ ] Implement Discuss view (GitHub Discussions)
- [ ] Implement Jobs view
- [ ] Add loading states and skeletons
- [ ] Add error handling

### GIT-010: Session Discovery (50-70 hours)

- [ ] Create `DeepLinkHandler` service
- [ ] Register `opennoodl://` protocol in Electron
- [ ] Create `SessionPreview` dialog
- [ ] Create `QuickJoinWidget` component
- [ ] Create `SessionHistoryManager` service
- [ ] Implement favorites
- [ ] Add "Copy Link" to active sessions
- [ ] Test cross-platform deep links

### GIT-011: Integration & Polish (61-82 hours)

- [ ] Create comprehensive test plan
- [ ] End-to-end testing of all flows
- [ ] Performance profiling and optimization
- [ ] Write user documentation
- [ ] Write community setup guide
- [ ] Create demo video
- [ ] Deploy servers to production
- [ ] Set up monitoring
- [ ] Complete launch checklist

---

## Progress Summary - Part 2: Live Collaboration

| Sub-Task | Name                     | Status      | Hours |
| -------- | ------------------------ | ----------- | ----- |
| GIT-005  | Community Infrastructure | Not Started | -     |
| GIT-006  | Server Infrastructure    | Not Started | -     |
| GIT-007  | WebRTC Collaboration     | Not Started | -     |
| GIT-008  | Notification System      | Not Started | -     |
| GIT-009  | Community Tab UI         | Not Started | -     |
| GIT-010  | Session Discovery        | Not Started | -     |
| GIT-011  | Integration & Polish     | Not Started | -     |

**Part 2 Estimated:** 431-572 hours  
**Part 2 Actual:** - hours

---

## Overall Progress

**Total Estimated:** 501-662 hours  
**Total Actual:** - hours
