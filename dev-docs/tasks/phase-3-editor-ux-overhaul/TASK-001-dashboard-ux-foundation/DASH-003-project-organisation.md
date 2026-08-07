# DASH-003: Project Organization - Folders & Tags

## Overview

Add the ability to organize projects using folders and tags. This enables users with many projects to group related work, filter their view, and find projects quickly.

## Context

Currently, projects are displayed in a flat list sorted by recency. Users with many projects (10+) struggle to find specific projects. There's no way to group related projects (e.g., "Client Work", "Personal", "Tutorials").

This task adds a folder/tag system that works entirely client-side, storing metadata separately from the Noodl projects themselves.

## Requirements

### Functional Requirements

1. **Folders**
   - Create, rename, delete folders
   - Drag-and-drop projects into folders
   - Nested folders (1 level deep max)
   - "All Projects" virtual folder (shows everything)
   - "Uncategorized" virtual folder (shows unorganized projects)
   - Folder displayed in sidebar

2. **Tags**
   - Create, rename, delete tags
   - Assign multiple tags per project
   - Color-coded tags
   - Tag filtering (show projects with specific tags)
   - Tags displayed as pills on project rows

3. **Filtering**
   - Filter by folder (sidebar click)
   - Filter by tag (tag click or dropdown)
   - Combine folder + tag filters
   - Search within filtered view
   - Clear all filters button

4. **Persistence**
   - Store folder/tag data in electron-store (not in project files)
   - Data structure keyed by project path (stable identifier)
   - Export/import organization data (stretch goal)

### Non-Functional Requirements

- Organization changes feel instant
- Drag-and-drop is smooth
- Works offline
- Survives app restart

## Data Model

### Storage Structure

```typescript
// Stored in electron-store under 'projectOrganization'
interface ProjectOrganizationData {
  version: 1;
  folders: Folder[];
  tags: Tag[];
  projectMeta: Record<string, ProjectMeta>; // keyed by project path
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null; // null = root level
  order: number;
  createdAt: string;
}

interface Tag {
  id: string;
  name: string;
  color: string; // hex color
  createdAt: string;
}

interface ProjectMeta {
  folderId: string | null;
  tagIds: string[];
  customName?: string; // optional override
  notes?: string;      // stretch goal
}
```

### Color Palette for Tags

```typescript
const TAG_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
];
```

## Technical Approach

### 1. Storage Service

```typescript
// packages/noodl-editor/src/editor/src/services/ProjectOrganizationService.ts

class ProjectOrganizationService {
  private static instance: ProjectOrganizationService;
  
  // Folder operations
  createFolder(name: string, parentId?: string): Folder;
  renameFolder(id: string, name: string): void;
  deleteFolder(id: string): void;
  reorderFolder(id: string, newOrder: number): void;
  
  // Tag operations
  createTag(name: string, color: string): Tag;
  renameTag(id: string, name: string): void;
  deleteTag(id: string): void;
  changeTagColor(id: string, color: string): void;
  
  // Project organization
  moveProjectToFolder(projectPath: string, folderId: string | null): void;
  addTagToProject(projectPath: string, tagId: string): void;
  removeTagFromProject(projectPath: string, tagId: string): void;
  
  // Queries
  getFolders(): Folder[];
  getTags(): Tag[];
  getProjectMeta(projectPath: string): ProjectMeta | null;
  getProjectsInFolder(folderId: string | null): string[];
  getProjectsWithTag(tagId: string): string[];
}
```

### 2. Sidebar Folder Tree

```
packages/noodl-core-ui/src/preview/launcher/Launcher/components/
├── FolderTree/
│   ├── FolderTree.tsx        # Tree container
│   ├── FolderTreeItem.tsx    # Individual folder row
│   ├── FolderTree.module.scss
│   └── index.ts
```

### 3. Tag Components

```
├── TagPill/
│   ├── TagPill.tsx           # Small colored tag display
│   └── TagPill.module.scss
├── TagSelector/
│   ├── TagSelector.tsx       # Dropdown to add/remove tags
│   └── TagSelector.module.scss
├── TagFilter/
│   ├── TagFilter.tsx         # Filter bar with active tags
│   └── TagFilter.module.scss
```

### 4. Drag and Drop

Use `@dnd-kit/core` for drag-and-drop:

```typescript
// DragDropContext for launcher
import { DndContext, DragOverlay } from '@dnd-kit/core';

// Draggable project row
import { useDraggable } from '@dnd-kit/core';

// Droppable folder
import { useDroppable } from '@dnd-kit/core';
```

## Files to Create

1. `packages/noodl-editor/src/editor/src/services/ProjectOrganizationService.ts`
2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/FolderTree/FolderTree.tsx`
3. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/FolderTree/FolderTreeItem.tsx`
4. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/FolderTree/FolderTree.module.scss`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/TagPill/TagPill.tsx`
6. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/TagSelector/TagSelector.tsx`
7. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/TagFilter/TagFilter.tsx`
8. `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectOrganization.ts`
9. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateFolderModal/CreateFolderModal.tsx`
10. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/CreateTagModal/CreateTagModal.tsx`

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Add DndContext wrapper
   - Add organization state to context

2. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/LauncherSidebar/LauncherSidebar.tsx`
   - Add FolderTree component
   - Add "Create Folder" button

3. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Projects.tsx`
   - Add TagFilter bar
   - Filter projects based on folder/tag selection
   - Make project rows draggable

4. `packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectList/ProjectListRow.tsx`
   - Add tag pills
   - Add tag selector on hover/context menu
   - Make row draggable

## UI Mockups

### Sidebar with Folders

```
┌─────────────────────────┐
│ 📁 All Projects    (24) │
│ 📁 Uncategorized   (5)  │
├─────────────────────────┤
│ + Create Folder         │
├─────────────────────────┤
│ 📂 Client Work     (8)  │
│   └─ 📁 Acme Corp  (3)  │
│   └─ 📁 BigCo      (5)  │
│ 📂 Personal        (6)  │
│ 📂 Tutorials       (5)  │
└─────────────────────────┘
```

### Project Row with Tags

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 📁 E-commerce Dashboard   2h ago   ✅  [🔴 Urgent] [🔵 Client]  ~/dev/... │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tag Filter Bar

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Filters: [🔴 Urgent ×] [🔵 Client ×]  [+ Add Filter]  [Clear All]       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Storage Foundation
1. Create ProjectOrganizationService
2. Define data model and storage
3. Create useProjectOrganization hook
4. Add to launcher context

### Phase 2: Folders
1. Create FolderTree component
2. Add to sidebar
3. Create folder modal
4. Implement folder filtering
5. Add context menu (rename, delete)

### Phase 3: Tags
1. Create TagPill component
2. Create TagSelector dropdown
3. Create TagFilter bar
4. Add tags to project rows
5. Implement tag filtering

### Phase 4: Drag and Drop
1. Add dnd-kit dependency
2. Wrap launcher in DndContext
3. Make project rows draggable
4. Make folders droppable
5. Handle drop events

### Phase 5: Polish
1. Add keyboard shortcuts
2. Improve animations
3. Handle edge cases (deleted projects, etc.)
4. Test thoroughly

## Testing Checklist

- [ ] Can create a folder
- [ ] Can rename a folder
- [ ] Can delete a folder (projects go to Uncategorized)
- [ ] Can create nested folder
- [ ] Clicking folder filters project list
- [ ] Can create a tag
- [ ] Can assign tag to project
- [ ] Can remove tag from project
- [ ] Clicking tag filters project list
- [ ] Can combine folder + tag filters
- [ ] Search works within filtered view
- [ ] Clear filters button works
- [ ] Drag project to folder works
- [ ] Data persists after app restart
- [ ] Removing project from disk shows appropriate state

## Dependencies

- DASH-001 (Tabbed Navigation System)
- DASH-002 (Project List Redesign) - for project rows

### External Dependencies

Add to `package.json`:
```json
{
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^7.0.0"
}
```

## Blocked By

- DASH-002

## Blocks

- None (this is end of the DASH chain)

## Estimated Effort

- Storage service: 2-3 hours
- Folder tree UI: 3-4 hours
- Tag components: 3-4 hours
- Drag and drop: 3-4 hours
- Filtering logic: 2-3 hours
- Polish & testing: 3-4 hours
- **Total: 16-22 hours**

## Success Criteria

1. Users can create folders and organize projects
2. Users can create tags and assign them to projects
3. Filtering by folder and tag works correctly
4. Drag-and-drop feels natural
5. Organization data persists across sessions
6. System handles edge cases gracefully (deleted projects, etc.)

## Future Enhancements

- Export/import organization data
- Folder color customization
- Project notes/descriptions
- Bulk operations (move/tag multiple projects)
- Smart folders (auto-organize by criteria)

## Design Notes

The folder tree should feel familiar like:
- macOS Finder sidebar
- VS Code Explorer
- Notion page tree

Keep interactions lightweight - organization should help, not hinder, the workflow of quickly opening projects.
