# DASH-001B-3: Remove List View

## Overview

Remove all list view code and make grid view the standard. Simplify the UI by eliminating the view mode toggle and related complexity.

## Problem

Both list and grid views were implemented per DASH-002 spec, but grid view is the only one needed. List view adds:

- Unnecessary code to maintain
- UI complexity (toggle button)
- Performance overhead (two rendering modes)
- Testing surface area

## Solution

Delete list view completely and make grid the only rendering mode.

## Implementation Steps

### 1. Delete ViewModeToggle component

**Directory to delete:** `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ViewModeToggle/`

This directory contains:

- `ViewModeToggle.tsx`
- `ViewModeToggle.module.scss`
- `ViewModeToggle.stories.tsx` (if exists)
- `index.ts`

### 2. Delete ProjectList component

**Directory to delete:** `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/`

This directory contains:

- `ProjectList.tsx`
- `ProjectListRow.tsx`
- `ProjectListHeader.tsx`
- `ProjectList.module.scss`
- `ProjectList.stories.tsx` (if exists)
- `index.ts`

### 3. Delete useProjectList hook

**File to delete:** `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectList.ts`

This hook provides sorting logic specifically for list view.

### 4. Remove from LauncherContext

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`

Remove `ViewMode` and related properties:

```typescript
// DELETE THIS EXPORT:
export { ViewMode };

export interface LauncherContextValue {
  activePageId: LauncherPageId;
  setActivePageId: (pageId: LauncherPageId) => void;

  // DELETE THESE TWO LINES:
  // viewMode: ViewMode;
  // setViewMode: (mode: ViewMode) => void;

  useMockData: boolean;
  setUseMockData: (value: boolean) => void;
  // ... rest
}
```

### 5. Update Launcher component

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`

Remove viewMode state and prop:

```typescript
export interface LauncherProps {
  projects?: LauncherProjectData[];
  initialPage?: LauncherPageId;
  useMockData?: boolean;
  // DELETE THIS:
  // initialViewMode?: ViewMode;
  onCreateProject?: () => void;
  // ... rest
}

export function Launcher({
  projects = [],
  initialPage = 'projects',
  useMockData: useMockDataProp = false,
  // DELETE THIS:
  // initialViewMode = ViewMode.Grid,
  onCreateProject
}: // ... rest
LauncherProps) {
  const [activePageId, setActivePageId] = useState<LauncherPageId>(initialPage);

  // DELETE THESE LINES:
  // const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);

  const [useMockData, setUseMockData] = useState(useMockDataProp);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const contextValue: LauncherContextValue = {
    activePageId,
    setActivePageId,

    // DELETE THESE LINES:
    // viewMode,
    // setViewMode,

    useMockData,
    setUseMockData
    // ... rest
  };

  // ... rest of component
}
```

### 6. Update Projects view

**File:** `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`

Remove all list view logic:

```typescript
// DELETE THESE IMPORTS:
// import { ProjectList } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectList';
// import { ViewModeToggle } from '@noodl-core-ui/preview/launcher/Launcher/components/ViewModeToggle';
// import { useProjectList } from '@noodl-core-ui/preview/launcher/Launcher/hooks/useProjectList';
// import { ViewMode } from '@noodl-core-ui/preview/launcher/Launcher/LauncherContext';

export function Projects({}: ProjectsViewProps) {
  const {
    // DELETE THIS:
    // viewMode,
    // setViewMode,
    projects: allProjects
    // ... rest
  } = useLauncherContext();

  // ... (keep existing filtering and search logic)

  // DELETE THIS ENTIRE BLOCK:
  // const { sortedProjects, sortField, sortDirection, setSorting } = useProjectList({
  //   projects,
  //   initialSortField: 'lastModified',
  //   initialSortDirection: 'desc'
  // });

  // In the JSX, DELETE the ViewModeToggle:
  <HStack hasSpacing={4} UNSAFE_style={{ justifyContent: 'space-between', alignItems: 'center' }}>
    <LauncherSearchBar
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filterValue={filterValue}
      setFilterValue={setFilterValue}
      filterDropdownItems={visibleTypesDropdownItems}
    />
    {/* DELETE THIS: */}
    {/* <ViewModeToggle mode={viewMode} onChange={setViewMode} /> */}
  </HStack>;

  {
    /* DELETE THE ENTIRE CONDITIONAL RENDERING: */
  }
  {
    /* Replace this: */
  }
  {
    /* {viewMode === ViewMode.List ? (
    <ProjectList ... />
  ) : (
    <grid view>
  )} */
  }

  {
    /* With just the grid view: */
  }
  <Box hasTopSpacing={4}>
    {/* Project list legend */}
    <Box hasBottomSpacing={4}>
      <HStack hasSpacing>
        <div style={{ width: 100 }} />
        <div style={{ width: '100%' }}>
          <Columns layoutString={'1 1 1'}>
            <Label variant={TextType.Shy} size={LabelSize.Small}>
              Name
            </Label>
            <Label variant={TextType.Shy} size={LabelSize.Small}>
              Version control
            </Label>
            <Label variant={TextType.Shy} size={LabelSize.Small}>
              Contributors
            </Label>
          </Columns>
        </div>
      </HStack>
    </Box>

    {/* Grid of project cards */}
    <Columns layoutString="1" hasXGap hasYGap>
      {projects.map((project) => (
        <LauncherProjectCard
          key={project.id}
          {...project}
          onClick={() => onLaunchProject?.(project.id)}
          contextMenuItems={
            [
              // ... existing menu items
            ]
          }
        />
      ))}
    </Columns>
  </Box>;
}
```

### 7. Update Storybook stories

**Files to check:**

- `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.stories.tsx`

Remove any `initialViewMode` or `ViewMode` usage:

```typescript
// DELETE imports of ViewMode, ViewModeToggle

export const Default: Story = {
  args: {
    projects: MOCK_PROJECTS
    // DELETE THIS:
    // initialViewMode: ViewMode.Grid,
  }
};
```

## Files to Delete

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ViewModeToggle/` (entire directory)
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/` (entire directory)
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectList.ts`

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.stories.tsx` (if exists)

## Testing Checklist

- [ ] ViewModeToggle button is gone
- [ ] Only grid view renders
- [ ] Search still works
- [ ] Filter dropdown still works
- [ ] Project cards render correctly
- [ ] Context menu on cards works
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Storybook builds successfully

## Benefits

1. **Simpler codebase** - ~500+ lines of code removed
2. **Easier maintenance** - Only one rendering mode to maintain
3. **Better performance** - No conditional rendering overhead
4. **Cleaner UI** - No toggle button cluttering the toolbar
5. **Focused UX** - One consistent way to view projects

## Potential Issues

### If grid view has issues

If problems are discovered with grid view after list view removal, they can be fixed directly in the grid implementation without worrying about list view parity.

### If users request list view later

The code can be recovered from git history if truly needed, but grid view should be sufficient for most users.

## Follow-up

After this subtask, proceed to **DASH-001B-4** (Create Project Modal) to improve project creation UX.

---

**Estimated Time:** 1-2 hours
**Status:** Not Started
