# DASH-002: Project List Redesign

## Overview

Transform the project list from a thumbnail grid into a more functional table/list view optimized for users with many projects. Add sorting, better information density, and optional view modes.

## Context

The current dashboard shows projects as large cards with auto-generated thumbnails. This works for users with a few projects but becomes unwieldy with many projects. The thumbnails add visual noise without providing much value.

The new launcher in `noodl-core-ui/src/preview/launcher/` already has the beginnings of a table layout with columns for Name, Version Control, and Contributors.

## Current State

### Existing LauncherProjectCard
```typescript
// From LauncherProjectCard.tsx
export interface LauncherProjectData {
  id: string;
  title: string;
  cloudSyncMeta: {
    type: CloudSyncType;
    source?: string;
  };
  localPath: string;
  lastOpened: string;
  pullAmount?: number;
  pushAmount?: number;
  uncommittedChangesAmount?: number;
  imageSrc: string;
  contributors?: UserBadgeProps[];
}
```

### Current Layout (Projects.tsx)
- Table header with Name, Version control, Contributors columns
- Cards with thumbnail images
- Basic search functionality via LauncherSearchBar

## Requirements

### Functional Requirements

1. **List View (Primary)**
   - Compact row-based layout
   - Columns: Name, Last Modified, Git Status, Local Path (truncated)
   - Row hover state with quick actions
   - Sortable columns (click header to sort)
   - Resizable columns (stretch goal)

2. **Grid View (Secondary)**
   - Card-based layout for visual preference
   - Smaller cards than current (2-3x more per row)
   - Optional thumbnails (can be disabled)
   - View toggle in toolbar

3. **Sorting**
   - Sort by Name (A-Z, Z-A)
   - Sort by Last Modified (newest, oldest)
   - Sort by Git Status (synced first, needs attention first)
   - Persist sort preference

4. **Information Display**
   - Project name (primary)
   - Last modified timestamp (relative: "2 hours ago")
   - Git status indicator (icon + tooltip)
   - Local path (truncated with tooltip for full path)
   - Quick action buttons on hover (Open, Folder, Settings, Delete)

5. **Empty State**
   - Friendly message when no projects exist
   - Call-to-action to create new project or import

### Non-Functional Requirements

- Handle 100+ projects smoothly (virtual scrolling if needed)
- Row click opens project
- Right-click context menu
- Responsive to window resize

## Technical Approach

### 1. Data Layer

Create a hook for project data with sorting:

```typescript
// useProjectList.ts
interface UseProjectListOptions {
  sortField: 'name' | 'lastModified' | 'gitStatus';
  sortDirection: 'asc' | 'desc';
  filter?: string;
}

interface UseProjectListReturn {
  projects: LauncherProjectData[];
  isLoading: boolean;
  sortField: string;
  sortDirection: string;
  setSorting: (field: string, direction: string) => void;
}
```

### 2. List View Component

```
packages/noodl-core-ui/src/preview/launcher/Launcher/components/
├── ProjectList/
│   ├── ProjectList.tsx          # Main list component
│   ├── ProjectListRow.tsx       # Individual row
│   ├── ProjectListHeader.tsx    # Sortable header
│   ├── ProjectList.module.scss
│   └── index.ts
```

### 3. View Mode Toggle

```typescript
// ViewModeToggle.tsx
export enum ViewMode {
  List = 'list',
  Grid = 'grid'
}

interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}
```

### 4. Git Status Display

```typescript
// GitStatusBadge.tsx
export enum GitStatusType {
  NotInitialized = 'not-initialized',
  LocalOnly = 'local-only',
  Synced = 'synced',
  Ahead = 'ahead',      // Have local commits to push
  Behind = 'behind',    // Have remote commits to pull
  Diverged = 'diverged', // Both ahead and behind
  Uncommitted = 'uncommitted'
}

interface GitStatusBadgeProps {
  status: GitStatusType;
  details?: {
    ahead?: number;
    behind?: number;
    uncommitted?: number;
  };
}
```

## Files to Create

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/ProjectList.tsx`
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/ProjectListRow.tsx`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/ProjectListHeader.tsx`
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/ProjectList.module.scss`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/index.ts`
6. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ViewModeToggle/ViewModeToggle.tsx`
7. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/GitStatusBadge/GitStatusBadge.tsx`
8. `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectList.ts`
9. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/EmptyProjectsState/EmptyProjectsState.tsx`

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`
   - Replace current layout with ProjectList component
   - Add view mode toggle
   - Wire up sorting

2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherProjectCard/LauncherProjectCard.tsx`
   - Refactor for grid view (smaller)
   - Make thumbnail optional

3. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Update mock data if needed
   - Add view mode to context

## Implementation Steps

### Phase 1: Core List View
1. Create ProjectListHeader with sortable columns
2. Create ProjectListRow with project info
3. Create ProjectList combining header and rows
4. Add basic sorting logic

### Phase 2: Git Status Display
1. Create GitStatusBadge component
2. Define status types and icons
3. Add tooltips with details

### Phase 3: View Modes
1. Create ViewModeToggle component
2. Refactor LauncherProjectCard for grid mode
3. Add view mode to Projects view
4. Persist preference

### Phase 4: Polish
1. Add empty state
2. Add hover actions
3. Implement virtual scrolling (if needed)
4. Test with large project counts

## Component Specifications

### ProjectListHeader

| Column | Width | Sortable | Content |
|--------|-------|----------|---------|
| Name | 40% | Yes | Project name |
| Last Modified | 20% | Yes | Relative timestamp |
| Git Status | 15% | Yes | Status badge |
| Path | 25% | No | Truncated local path |

### ProjectListRow

```
┌──────────────────────────────────────────────────────────────────────┐
│ 📁 My Project Name          2 hours ago    ⚡ Ahead (3)   ~/dev/...  │
│                                             [hover: Open 📂 ⚙️ 🗑️]   │
└──────────────────────────────────────────────────────────────────────┘
```

### GitStatusBadge Icons

| Status | Icon | Color | Tooltip |
|--------|------|-------|---------|
| not-initialized | ⚪ | Gray | "No version control" |
| local-only | 💾 | Yellow | "Local git only, not synced" |
| synced | ✅ | Green | "Up to date with remote" |
| ahead | ⬆️ | Blue | "3 commits to push" |
| behind | ⬇️ | Orange | "5 commits to pull" |
| diverged | ⚠️ | Red | "3 ahead, 5 behind" |
| uncommitted | ● | Yellow | "Uncommitted changes" |

## Testing Checklist

- [ ] List renders with mock data
- [ ] Clicking row opens project (or shows FIXME alert)
- [ ] Sorting by each column works
- [ ] Sort direction toggles on repeated click
- [ ] Sort preference persists
- [ ] View mode toggle switches layouts
- [ ] View mode preference persists
- [ ] Git status badges display correctly
- [ ] Tooltips show on hover
- [ ] Right-click shows context menu
- [ ] Empty state shows when no projects
- [ ] Search filters projects correctly
- [ ] Performance acceptable with 100+ mock projects

## Dependencies

- DASH-001 (Tabbed Navigation System) - for launcher context

## Blocked By

- DASH-001

## Blocks

- DASH-003 (needs list infrastructure for folder/tag filtering)

## Estimated Effort

- ProjectList components: 3-4 hours
- GitStatusBadge: 1-2 hours
- View mode toggle: 1-2 hours
- Sorting & persistence: 2-3 hours
- Polish & testing: 2-3 hours
- **Total: 9-14 hours**

## Success Criteria

1. Projects display in a compact, sortable list
2. Git status is immediately visible
3. Users can switch to grid view if preferred
4. Sorting and view preferences persist
5. Empty state guides new users
6. Context menu provides quick actions

## Design Notes

The list view should feel similar to:
- VS Code's file explorer
- macOS Finder list view
- GitHub repository list

Keep information density high but avoid clutter. Use icons where possible to save space, with tooltips for details.
