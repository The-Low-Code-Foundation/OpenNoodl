# GIT-009: Community Tab UI/UX

## Overview

**Priority:** High  
**Estimated Hours:** 80-100  
**Dependencies:** GIT-005, GIT-007, GIT-008  
**Status:** 🔴 Not Started

Create the Community tab UI that serves as the central hub for all community features: browsing communities, discovering sessions, exploring components, viewing tutorials, and accessing discussions.

---

## Strategic Context

The Community tab is the social layer of OpenNoodl. It surfaces:

- **Live collaboration sessions** - Join others in real-time
- **Shared components** - Discover and install components
- **Learning resources** - Tutorials organized by skill level
- **Discussions** - Community Q&A via GitHub Discussions
- **Job board** - Opportunities in the ecosystem

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Community Switcher: [OpenNoodl Official ▾]    [+ Add]      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🏠 Home │ 👥 Sessions │ 📦 Components │ 🎓 Learn │ 💬 Discuss │ 💼 Jobs │ │
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    [Tab Content]                        ││
│  │                                                         ││
│  │                                                         ││
│  │                                                         ││
│  │                                                         ││
│  │                                                         ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Tab Views

### 1. Home View

Featured content dashboard with quick actions:

- **Live Now** - Active public sessions
- **Featured This Week** - Curated components
- **New Tutorials** - Recently published
- **Hot Discussions** - Trending threads
- **Quick Actions** - Start session, share component, ask question

### 2. Sessions View

Browse and join collaboration sessions:

- **Filters**: Live now, scheduled, all
- **Session cards** with:
  - Host avatar and name
  - Session title and description
  - Participant count / max
  - Audio/video indicators
  - Duration
- **Create Session** button
- **Join via Link** button

### 3. Components View

Browse shared component library:

- **Search bar** with filters
- **Category filter** dropdown
- **Sort by**: Popular, recent, name
- **Component cards** with:
  - Preview image or icon
  - Name and description
  - Author
  - Stars and downloads
  - Tags
  - "Add to Library" button

### 4. Learn View

Tutorial browser organized by skill level:

- **Learning paths** - Curated sequences
- **Level filter**: Beginner, intermediate, advanced
- **Format filter**: Video, article, interactive
- **Tutorial cards** with:
  - Thumbnail
  - Title and description
  - Author
  - Duration
  - Level badge

### 5. Discuss View

GitHub Discussions integration:

- **Category tabs**: All, Q&A, Show and Tell, Ideas, General
- **Sort**: Recent, top, unanswered
- **Discussion items** with:
  - Title and preview
  - Author
  - Category
  - Comment and reaction counts
  - Time ago
- **Start Discussion** button (opens GitHub)

### 6. Jobs View

Community job board:

- **Filters**: Type (full-time, contract, freelance), remote, experience
- **Job cards** with:
  - Company logo
  - Job title and company
  - Description
  - Tags (type, location, experience)
  - Salary (if provided)
  - Posted date
  - "Apply" button

---

## Implementation Tasks

### Phase 1: Panel Structure (15-20 hours)

- [ ] Create `CommunityPanel/CommunityPanel.tsx`
- [ ] Create tab navigation component
- [ ] Create community switcher component
- [ ] Integrate with CommunityManager
- [ ] Add to editor sidebar
- [ ] Create panel layout and styles

### Phase 2: Home View (15-20 hours)

- [ ] Create `HomeView.tsx`
- [ ] Implement welcome banner with community branding
- [ ] Implement "Live Now" section
- [ ] Implement "Featured" section
- [ ] Implement "New Tutorials" section
- [ ] Implement "Hot Discussions" section
- [ ] Create quick action buttons
- [ ] Fetch featured content from community repo

### Phase 3: Sessions View (15-20 hours)

- [ ] Create `SessionsView.tsx`
- [ ] Implement session list with cards
- [ ] Implement session filters
- [ ] Create "Create Session" dialog
- [ ] Create "Join via Link" dialog
- [ ] Integrate with CollaborationManager
- [ ] Implement real-time session count updates

### Phase 4: Components View (15-20 hours)

- [ ] Create `ComponentsView.tsx`
- [ ] Implement search with debounce
- [ ] Implement category filter
- [ ] Implement sort options
- [ ] Create component cards
- [ ] Implement "Add to Library" action
- [ ] Create component preview modal
- [ ] Fetch from community components registry

### Phase 5: Learn View (10-15 hours)

- [ ] Create `LearnView.tsx`
- [ ] Implement learning paths section
- [ ] Implement level filter
- [ ] Implement format filter
- [ ] Create tutorial cards
- [ ] Fetch from community tutorials directory

### Phase 6: Discuss View (8-12 hours)

- [ ] Create `DiscussView.tsx`
- [ ] Implement category tabs
- [ ] Implement sort options
- [ ] Create discussion item component
- [ ] Integrate GitHub Discussions API via Octokit
- [ ] Implement "Start Discussion" action

### Phase 7: Jobs View (8-12 hours)

- [ ] Create `JobsView.tsx`
- [ ] Implement job filters
- [ ] Create job cards
- [ ] Implement "Apply" action
- [ ] Fetch from community jobs listings

### Phase 8: Polish (10-15 hours)

- [ ] Add loading states and skeletons
- [ ] Add error handling and retry
- [ ] Implement infinite scroll
- [ ] Add keyboard navigation
- [ ] Add animations and transitions
- [ ] Responsive layout adjustments

---

## Verification Steps

- [ ] Community tab loads without errors
- [ ] Can switch between communities
- [ ] Home view shows featured content
- [ ] Can browse and join sessions
- [ ] Can search and install components
- [ ] Tutorials load and display correctly
- [ ] Discussions integrate with GitHub
- [ ] Job board displays listings
- [ ] All filters work correctly
- [ ] UI is responsive and performant
- [ ] Offline/error states handled gracefully

---

## Files to Create

```
packages/noodl-editor/src/editor/src/views/panels/CommunityPanel/
├── CommunityPanel.tsx
├── CommunityPanel.module.scss
├── components/
│   ├── CommunityHeader.tsx
│   ├── CommunitySwitcher.tsx
│   ├── TabNavigation.tsx
│   ├── EmptyState.tsx
│   ├── SessionCard.tsx
│   ├── ComponentCard.tsx
│   ├── TutorialCard.tsx
│   ├── DiscussionItem.tsx
│   ├── JobCard.tsx
│   └── LoadingSkeletons.tsx
├── views/
│   ├── HomeView.tsx
│   ├── SessionsView.tsx
│   ├── ComponentsView.tsx
│   ├── LearnView.tsx
│   ├── DiscussView.tsx
│   └── JobsView.tsx
├── dialogs/
│   ├── CreateSessionDialog.tsx
│   ├── JoinSessionDialog.tsx
│   ├── ComponentPreviewModal.tsx
│   └── ShareComponentDialog.tsx
└── hooks/
    ├── useCommunityContent.ts
    ├── useSessions.ts
    ├── useComponents.ts
    ├── useTutorials.ts
    ├── useDiscussions.ts
    └── useJobs.ts
```

---

## Data Fetching

All content is fetched from the community's GitHub repository:

| Content     | Source                               |
| ----------- | ------------------------------------ |
| Featured    | `featured.json`                      |
| Sessions    | `collaboration/public-sessions.json` |
| Components  | `components/registry.json`           |
| Tutorials   | `tutorials/{level}/index.json`       |
| Discussions | GitHub Discussions API               |
| Jobs        | `jobs/listings.json`                 |

---

## Styling Notes

- Use CSS variables from theme for colors
- Follow Panel UI Style Guide
- Dark theme first
- Consistent card styling across views
- Smooth animations for transitions
- Loading skeletons match card dimensions

---

## Related Tasks

- **GIT-005**: Community Infrastructure (provides data sources)
- **GIT-007**: WebRTC Collaboration (sessions integration)
- **GIT-008**: Notification System (community notifications)
- **GIT-010**: Session Discovery (extends sessions view)
