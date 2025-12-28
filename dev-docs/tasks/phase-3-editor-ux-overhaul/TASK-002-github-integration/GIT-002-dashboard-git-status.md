# GIT-002: Git Status Dashboard Visibility

## Overview

Surface git status information directly in the project list on the dashboard, allowing users to see at a glance which projects need attention (uncommitted changes, unpushed commits, available updates) without opening each project.

## Context

Currently, git status is only visible inside the VersionControlPanel after opening a project. Users with many projects have no way to know which ones have uncommitted changes or need syncing.

The new launcher already has mock data for git sync status in `LauncherProjectCard`, but it's not connected to real data.

### Existing Infrastructure

From `LauncherProjectCard.tsx`:
```typescript
export enum CloudSyncType {
  None = 'none',
  Git = 'git'
}

export interface LauncherProjectData {
  cloudSyncMeta: {
    type: CloudSyncType;
    source?: string;  // Remote URL
  };
  pullAmount?: number;
  pushAmount?: number;
  uncommittedChangesAmount?: number;
}
```

From `VersionControlPanel/context/fetch.context.ts`:
```typescript
// Already calculates:
localCommitCount    // Commits ahead of remote
remoteCommitCount   // Commits behind remote
workingDirectoryStatus  // Uncommitted files
```

## Requirements

### Functional Requirements

1. **Status Indicators in Project List**
   - Not Initialized: Gray indicator, no version control
   - Local Only: Yellow indicator, git but no remote
   - Synced: Green checkmark, up to date
   - Has Uncommitted Changes: Yellow dot, local modifications
   - Ahead: Blue up arrow, local commits to push
   - Behind: Orange down arrow, remote commits to pull
   - Diverged: Red warning, both ahead and behind

2. **Status Details**
   - Tooltip showing details on hover
   - "3 commits to push, 2 to pull"
   - "5 uncommitted files"
   - Last sync time

3. **Quick Actions**
   - Quick sync button (fetch + show status)
   - Link to open Version Control panel

4. **Background Refresh**
   - Check status on dashboard load
   - Periodic refresh (every 5 minutes)
   - Manual refresh button
   - Status cached to avoid repeated git operations

5. **Performance**
   - Parallel status checks for multiple projects
   - Debounced/throttled to avoid overwhelming git
   - Cached results with TTL

### Non-Functional Requirements

- Status check per project: <500ms
- Dashboard load not blocked by status checks
- Works offline (shows cached/stale data)

## Data Model

### Git Status Types

```typescript
enum ProjectGitStatus {
  Unknown = 'unknown',           // Haven't checked yet
  NotInitialized = 'not-init',   // Not a git repo
  LocalOnly = 'local-only',      // Git but no remote
  Synced = 'synced',             // Up to date with remote
  Uncommitted = 'uncommitted',   // Has local changes
  Ahead = 'ahead',               // Has commits to push
  Behind = 'behind',             // Has commits to pull
  Diverged = 'diverged',         // Both ahead and behind
  Error = 'error'                // Failed to check
}

interface ProjectGitStatusDetails {
  status: ProjectGitStatus;
  aheadCount?: number;
  behindCount?: number;
  uncommittedCount?: number;
  lastFetchTime?: number;
  remoteUrl?: string;
  currentBranch?: string;
  error?: string;
}
```

### Cache Structure

```typescript
interface GitStatusCache {
  [projectPath: string]: {
    status: ProjectGitStatusDetails;
    checkedAt: number;
    isStale: boolean;
  };
}
```

## Technical Approach

### 1. Git Status Service

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectGitStatusService.ts

class ProjectGitStatusService {
  private static instance: ProjectGitStatusService;
  private cache: GitStatusCache = {};
  private checkQueue: Set<string> = new Set();
  private isChecking = false;
  
  // Check single project
  async checkStatus(projectPath: string): Promise<ProjectGitStatusDetails>;
  
  // Check multiple projects (batched)
  async checkStatusBatch(projectPaths: string[]): Promise<Map<string, ProjectGitStatusDetails>>;
  
  // Get cached status
  getCachedStatus(projectPath: string): ProjectGitStatusDetails | null;
  
  // Clear cache
  invalidateCache(projectPath?: string): void;
  
  // Subscribe to status changes
  onStatusChanged(callback: (path: string, status: ProjectGitStatusDetails) => void): () => void;
}
```

### 2. Status Check Implementation

```typescript
async checkStatus(projectPath: string): Promise<ProjectGitStatusDetails> {
  const git = new Git(mergeProject);
  
  try {
    // Check if it's a git repo
    const gitPath = await getTopLevelWorkingDirectory(projectPath);
    if (!gitPath) {
      return { status: ProjectGitStatus.NotInitialized };
    }
    
    await git.openRepository(projectPath);
    
    // Check for remote
    const remoteName = await git.getRemoteName();
    if (!remoteName) {
      return { status: ProjectGitStatus.LocalOnly };
    }
    
    // Get working directory status
    const workingStatus = await git.status();
    const uncommittedCount = workingStatus.length;
    
    // Get commit counts (requires fetch for accuracy)
    const commits = await git.getCommitsCurrentBranch();
    const aheadCount = commits.filter(c => c.isLocalAhead).length;
    const behindCount = commits.filter(c => c.isRemoteAhead).length;
    
    // Determine status
    let status: ProjectGitStatus;
    if (uncommittedCount > 0) {
      status = ProjectGitStatus.Uncommitted;
    } else if (aheadCount > 0 && behindCount > 0) {
      status = ProjectGitStatus.Diverged;
    } else if (aheadCount > 0) {
      status = ProjectGitStatus.Ahead;
    } else if (behindCount > 0) {
      status = ProjectGitStatus.Behind;
    } else {
      status = ProjectGitStatus.Synced;
    }
    
    return {
      status,
      aheadCount,
      behindCount,
      uncommittedCount,
      lastFetchTime: Date.now(),
      remoteUrl: git.OriginUrl,
      currentBranch: await git.getCurrentBranchName()
    };
  } catch (error) {
    return {
      status: ProjectGitStatus.Error,
      error: error.message
    };
  }
}
```

### 3. Dashboard Integration Hook

```typescript
// packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectGitStatus.ts

function useProjectGitStatus(projectPaths: string[]) {
  const [statuses, setStatuses] = useState<Map<string, ProjectGitStatusDetails>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Initial check
    ProjectGitStatusService.instance
      .checkStatusBatch(projectPaths)
      .then(setStatuses)
      .finally(() => setIsLoading(false));
    
    // Subscribe to updates
    const unsubscribe = ProjectGitStatusService.instance.onStatusChanged((path, status) => {
      setStatuses(prev => new Map(prev).set(path, status));
    });
    
    return unsubscribe;
  }, [projectPaths]);
  
  const refresh = useCallback(() => {
    ProjectGitStatusService.instance.invalidateCache();
    // Re-trigger check
  }, []);
  
  return { statuses, isLoading, refresh };
}
```

### 4. Visual Status Badge

Already started in DASH-002 as `GitStatusBadge`, but needs real data connection:

```typescript
// Enhanced GitStatusBadge props
interface GitStatusBadgeProps {
  status: ProjectGitStatus;
  details: ProjectGitStatusDetails;
  showTooltip?: boolean;
  size?: 'small' | 'medium';
}
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/ProjectGitStatusService.ts`
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectGitStatus.ts`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/GitStatusBadge/GitStatusBadge.tsx` (if not created in DASH-002)
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/GitStatusBadge/GitStatusBadge.module.scss`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/GitStatusTooltip/GitStatusTooltip.tsx`

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`
   - Use `useProjectGitStatus` hook
   - Pass status to project cards/rows

2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/ProjectListRow.tsx`
   - Display GitStatusBadge with real data

3. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherProjectCard/LauncherProjectCard.tsx`
   - Update to use real status data (for grid view)

4. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Replace mock project data with real data connection

## Visual Specifications

### Status Badge Icons & Colors

| Status | Icon | Color | Background |
|--------|------|-------|------------|
| Unknown | ◌ (spinner) | Gray | Transparent |
| Not Initialized | ⊘ | Gray (#6B7280) | Transparent |
| Local Only | 💾 | Yellow (#EAB308) | Yellow/10 |
| Synced | ✓ | Green (#22C55E) | Green/10 |
| Uncommitted | ● | Yellow (#EAB308) | Yellow/10 |
| Ahead | ↑ | Blue (#3B82F6) | Blue/10 |
| Behind | ↓ | Orange (#F97316) | Orange/10 |
| Diverged | ⚠ | Red (#EF4444) | Red/10 |
| Error | ✕ | Red (#EF4444) | Red/10 |

### Tooltip Content

```
┌─────────────────────────────────┐
│ main branch                     │
│ ↑ 3 commits to push             │
│ ↓ 2 commits to pull             │
│ ● 5 uncommitted files           │
│                                 │
│ Last synced: 10 minutes ago     │
│ Remote: github.com/user/repo    │
└─────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Service Foundation
1. Create ProjectGitStatusService
2. Implement single project status check
3. Add caching logic
4. Create batch checking with parallelization

### Phase 2: Hook & Data Flow
1. Create useProjectGitStatus hook
2. Connect to Projects view
3. Replace mock data with real data
4. Add loading states

### Phase 3: Visual Components
1. Create/update GitStatusBadge
2. Create GitStatusTooltip
3. Integrate into ProjectListRow
4. Integrate into LauncherProjectCard

### Phase 4: Refresh & Background
1. Add manual refresh button
2. Implement periodic background refresh
3. Add refresh on window focus
4. Handle offline state

### Phase 5: Polish
1. Performance optimization
2. Error handling
3. Stale data indicators
4. Animation on status change

## Performance Considerations

1. **Parallel Checking**: Check up to 5 projects simultaneously
2. **Debouncing**: Don't re-check same project within 10 seconds
3. **Cache TTL**: Status valid for 5 minutes, stale after
4. **Lazy Loading**: Only check visible projects first
5. **Background Priority**: Use requestIdleCallback for non-visible

```typescript
// Throttled batch check
async checkStatusBatch(projectPaths: string[]): Promise<Map<string, ProjectGitStatusDetails>> {
  const CONCURRENCY = 5;
  const results = new Map();
  
  for (let i = 0; i < projectPaths.length; i += CONCURRENCY) {
    const batch = projectPaths.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(path => this.checkStatus(path))
    );
    batch.forEach((path, idx) => results.set(path, batchResults[idx]));
  }
  
  return results;
}
```

## Testing Checklist

- [ ] Detects non-git project correctly
- [ ] Detects git project without remote
- [ ] Shows synced status when up to date
- [ ] Shows uncommitted when local changes exist
- [ ] Shows ahead when local commits exist
- [ ] Shows behind when remote commits exist
- [ ] Shows diverged when both ahead and behind
- [ ] Tooltip shows correct details
- [ ] Refresh updates status
- [ ] Status persists across dashboard navigation
- [ ] Handles deleted projects gracefully
- [ ] Handles network errors gracefully
- [ ] Performance acceptable with 20+ projects

## Dependencies

- DASH-002 (Project List Redesign) - for UI integration

## Blocked By

- DASH-002

## Blocks

- GIT-004 (Auto-initialization) - needs status detection
- GIT-005 (Enhanced Push/Pull) - shares status infrastructure

## Estimated Effort

- Status service: 3-4 hours
- Hook & data flow: 2-3 hours
- Visual components: 2-3 hours
- Background refresh: 2-3 hours
- Polish & testing: 2-3 hours
- **Total: 11-16 hours**

## Success Criteria

1. Git status visible at a glance in project list
2. Status updates without manual refresh
3. Tooltip provides actionable details
4. Performance acceptable with many projects
5. Works offline with cached data
6. Handles edge cases gracefully

## Future Enhancements

- Quick commit from dashboard
- Quick push/pull buttons per project
- Bulk sync all projects
- Branch indicator
- Last commit message preview
- Contributor avatars (from git log)
