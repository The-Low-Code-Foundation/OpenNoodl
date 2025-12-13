# GIT-005: Enhanced Push/Pull UI

## Overview

Improve the push/pull experience with better visibility, branch management, conflict previews, and dashboard-level sync controls. Make syncing with remotes more intuitive and less error-prone.

## Context

The current Version Control panel has push/pull functionality via `GitStatusButton`, but:
- Only visible when the panel is open
- Branch switching is buried in menus
- No preview of what will be pulled
- Conflict resolution is complex

This task brings sync operations to the forefront and adds safeguards.

### Existing Infrastructure

From `GitStatusButton.tsx`:
```typescript
// Status kinds: 'default', 'fetch', 'error-fetch', 'pull', 'push', 'push-repository', 'set-authorization'

case 'push': {
  label = localCommitCount === 1 ? `Push 1 local commit` : `Push ${localCommitCount} local commits`;
}

case 'pull': {
  label = remoteCommitCount === 1 ? `Pull 1 remote commit` : `Pull ${remoteCommitCount} remote commits`;
}
```

From `fetch.context.ts`:
```typescript
localCommitCount    // Commits ahead of remote
remoteCommitCount   // Commits behind remote
currentBranch       // Current branch info
branches            // All branches
```

## Requirements

### Functional Requirements

1. **Dashboard Sync Button**
   - Visible sync button in project row (from GIT-002)
   - One-click fetch & show status
   - Quick push/pull from dashboard

2. **Branch Selector**
   - Dropdown showing current branch
   - Quick switch between branches
   - Create new branch option
   - Branch search for projects with many branches
   - Remote branch indicators

3. **Pull Preview**
   - Show what commits will be pulled
   - List affected files
   - Warning for potential conflicts
   - "Preview" mode before actual pull

4. **Conflict Prevention**
   - Check for conflicts before pull
   - Suggest stashing changes first
   - Clear conflict resolution workflow
   - "Abort" option during conflicts

5. **Push Confirmation**
   - Show commits being pushed
   - Branch protection warning (if pushing to main)
   - Force push warning (if needed)

6. **Sync Status Header**
   - Always-visible status in editor header
   - Current branch display
   - Quick sync actions
   - Connection indicator

### Non-Functional Requirements

- Sync operations don't block UI
- Progress visible for long operations
- Works offline (queues operations)
- Clear error messages

## Technical Approach

### 1. Sync Status Header Component

```typescript
// packages/noodl-core-ui/src/components/git/SyncStatusHeader/SyncStatusHeader.tsx

interface SyncStatusHeaderProps {
  currentBranch: string;
  aheadCount: number;
  behindCount: number;
  hasUncommitted: boolean;
  isOnline: boolean;
  lastFetchTime: number;
  onPush: () => void;
  onPull: () => void;
  onFetch: () => void;
  onBranchChange: (branch: string) => void;
}
```

### 2. Branch Selector Component

```typescript
// packages/noodl-core-ui/src/components/git/BranchSelector/BranchSelector.tsx

interface BranchSelectorProps {
  currentBranch: Branch;
  branches: Branch[];
  onSelect: (branch: Branch) => void;
  onCreate: (name: string) => void;
}

interface Branch {
  name: string;
  nameWithoutRemote: string;
  isLocal: boolean;
  isRemote: boolean;
  isCurrent: boolean;
  lastCommit?: {
    sha: string;
    message: string;
    date: string;
  };
}
```

### 3. Pull Preview Modal

```typescript
// packages/noodl-core-ui/src/components/git/PullPreviewModal/PullPreviewModal.tsx

interface PullPreviewModalProps {
  commits: Commit[];
  affectedFiles: FileChange[];
  hasConflicts: boolean;
  conflictFiles?: string[];
  onPull: () => Promise<void>;
  onCancel: () => void;
}

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  hasConflict: boolean;
}
```

### 4. Conflict Resolution Flow

```typescript
// packages/noodl-editor/src/editor/src/services/ConflictResolutionService.ts

class ConflictResolutionService {
  // Check for potential conflicts before pull
  async previewConflicts(): Promise<ConflictPreview>;
  
  // Handle stashing
  async stashAndPull(): Promise<void>;
  
  // Resolution strategies
  async resolveWithOurs(file: string): Promise<void>;
  async resolveWithTheirs(file: string): Promise<void>;
  async openMergeTool(file: string): Promise<void>;
  
  // Abort
  async abortMerge(): Promise<void>;
}
```

## UI Mockups

### Sync Status Header (Editor)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [main ▾]  ↑3 ↓2  ●5 uncommitted   🟢 Connected   [Fetch] [Pull] [Push]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Branch Selector Dropdown

```
┌─────────────────────────────────────┐
│ 🔍 Search branches...               │
├─────────────────────────────────────┤
│ LOCAL                               │
│   ✓ main                            │
│     feature/new-login               │
│     bugfix/header-styling           │
├─────────────────────────────────────┤
│ REMOTE                              │
│     origin/develop                  │
│     origin/release-1.0              │
├─────────────────────────────────────┤
│ + Create new branch...              │
└─────────────────────────────────────┘
```

### Pull Preview Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ Pull Preview                                                   [×]  │
├─────────────────────────────────────────────────────────────────────┤
│ Pulling 3 commits from origin/main                                  │
│                                                                     │
│ COMMITS                                                             │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ a1b2c3d  Fix login validation          John Doe    2 hours ago │ │
│ │ d4e5f6g  Add password reset flow       Jane Smith  5 hours ago │ │
│ │ h7i8j9k  Update dependencies           John Doe    1 day ago   │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ FILES CHANGED (12)                                                  │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ M  components/LoginPage.ndjson                                  │ │
│ │ M  components/Header.ndjson                                     │ │
│ │ A  components/PasswordReset.ndjson                              │ │
│ │ D  components/OldLogin.ndjson                                   │ │
│ │ ⚠️ M  project.json  (potential conflict)                        │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ⚠️ You have uncommitted changes. They will be stashed before pull. │
│                                                                     │
│                                              [Cancel]  [Pull Now]  │
└─────────────────────────────────────────────────────────────────────┘
```

### Conflict Warning

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ Potential Conflicts Detected                                [×]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ The following files have been modified both locally and remotely:   │
│                                                                     │
│   • project.json                                                    │
│   • components/LoginPage.ndjson                                     │
│                                                                     │
│ Noodl will attempt to merge these changes automatically, but you    │
│ may need to resolve conflicts manually.                             │
│                                                                     │
│ Recommended: Commit your local changes first for a cleaner merge.   │
│                                                                     │
│      [Cancel]  [Commit First]  [Pull Anyway]                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Create

1. `packages/noodl-core-ui/src/components/git/SyncStatusHeader/SyncStatusHeader.tsx`
2. `packages/noodl-core-ui/src/components/git/SyncStatusHeader/SyncStatusHeader.module.scss`
3. `packages/noodl-core-ui/src/components/git/BranchSelector/BranchSelector.tsx`
4. `packages/noodl-core-ui/src/components/git/BranchSelector/BranchSelector.module.scss`
5. `packages/noodl-core-ui/src/components/git/PullPreviewModal/PullPreviewModal.tsx`
6. `packages/noodl-core-ui/src/components/git/PushConfirmModal/PushConfirmModal.tsx`
7. `packages/noodl-core-ui/src/components/git/ConflictWarningModal/ConflictWarningModal.tsx`
8. `packages/noodl-editor/src/editor/src/services/ConflictResolutionService.ts`

## Files to Modify

1. `packages/noodl-editor/src/editor/src/pages/EditorPage/EditorPage.tsx`
   - Add SyncStatusHeader to editor layout

2. `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/VersionControlPanel.tsx`
   - Integrate new BranchSelector
   - Add pull preview before pulling

3. `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/components/GitStatusButton.tsx`
   - Update to use new pull/push flows

4. `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/context/fetch.context.ts`
   - Add preview fetch logic
   - Add conflict detection

5. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/ProjectListRow.tsx`
   - Add quick sync button (if not in GIT-002)

## Implementation Steps

### Phase 1: Branch Selector
1. Create BranchSelector component
2. Implement search/filter
3. Add create branch flow
4. Integrate into Version Control panel

### Phase 2: Sync Status Header
1. Create SyncStatusHeader component
2. Add to editor layout
3. Wire up actions
4. Add connection indicator

### Phase 3: Pull Preview
1. Create PullPreviewModal
2. Implement commit/file listing
3. Add conflict detection
4. Wire up pull action

### Phase 4: Conflict Handling
1. Create ConflictWarningModal
2. Create ConflictResolutionService
3. Implement stash-before-pull
4. Add abort functionality

### Phase 5: Push Enhancements
1. Create PushConfirmModal
2. Add branch protection warning
3. Show commit list
4. Handle force push

### Phase 6: Dashboard Integration
1. Add sync button to project rows
2. Quick push/pull from dashboard
3. Update status after sync

## Testing Checklist

- [ ] Branch selector shows all branches
- [ ] Branch search filters correctly
- [ ] Switching branches works
- [ ] Creating new branch works
- [ ] Sync status header shows correct counts
- [ ] Fetch updates status
- [ ] Pull preview shows correct commits
- [ ] Pull preview shows affected files
- [ ] Conflict warning appears when appropriate
- [ ] Stash-before-pull works
- [ ] Pull completes successfully
- [ ] Push confirmation shows commits
- [ ] Push completes successfully
- [ ] Dashboard sync button works
- [ ] Offline state handled gracefully

## Dependencies

- GIT-002 (Git Status Dashboard) - for dashboard integration
- GIT-001 (GitHub OAuth) - for authenticated operations

## Blocked By

- GIT-002

## Blocks

- None

## Estimated Effort

- Branch selector: 3-4 hours
- Sync status header: 2-3 hours
- Pull preview: 4-5 hours
- Conflict handling: 4-5 hours
- Push enhancements: 2-3 hours
- Dashboard integration: 2-3 hours
- **Total: 17-23 hours**

## Success Criteria

1. Branch switching is easy and visible
2. Users can preview what will be pulled
3. Conflict potential is detected before pull
4. Stashing is automatic when needed
5. Push shows what's being pushed
6. Quick sync available from dashboard
7. Status always visible in editor

## Future Enhancements

- Pull request creation
- Branch comparison
- Revert/cherry-pick commits
- Squash commits before push
- Auto-sync on save (optional)
- Branch naming conventions/templates
