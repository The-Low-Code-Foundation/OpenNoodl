# VIEW-001-REVISION Checklist

## Pre-Flight

- [ ] Read VIEW-001-REVISION.md completely
- [ ] Review mockup artifacts (`topology-drilldown.jsx`, `architecture-views.jsx`)
- [ ] Understand the difference between Topology (relationships) and X-Ray (internals)
- [ ] Load test project with 123 components / 68 orphans

---

## Phase 1: Data Restructuring

### Build Folder Graph

- [ ] Create `FolderNode` type with id, name, path, type, componentCount, components
- [ ] Create `FolderConnection` type with from, to, count, componentPairs
- [ ] Create `FolderGraph` type with folders, connections, orphanComponents
- [ ] Implement `buildFolderGraph(project: ProjectModel): FolderGraph`
- [ ] Extract folder from component path (e.g., `/#Directus/Query` → `#Directus`)
- [ ] Aggregate connections: count component-to-component links between folders
- [ ] Identify orphans (components with zero incoming connections)

### Detect Folder Types

- [ ] Pages: components with routes or in root `/App` path
- [ ] Integrations: folders starting with `#Directus`, `#Swapcard`, etc.
- [ ] UI: folders named `#UI`, `#Components`, etc.
- [ ] Utility: `#Global`, `#Utils`, `#Shared`
- [ ] Feature: everything else that's used
- [ ] Orphan: components not used anywhere

### Verification

- [ ] Log folder graph to console, verify counts match project
- [ ] Connection counts are accurate (sum of component pairs)
- [ ] No components lost in aggregation

---

## Phase 2: Level 1 - Folder Overview

### Layout

- [ ] Implement tiered layout (NOT dagre auto-layout)
- [ ] Tier 0: Pages (top)
- [ ] Tier 1: Features
- [ ] Tier 2: Shared (Integrations, UI)
- [ ] Tier 3: Utilities (bottom)
- [ ] Tier -1: Orphans (separate, bottom-left)
- [ ] Calculate x positions to spread nodes horizontally within tier
- [ ] Add padding between tiers

### Folder Node Rendering

- [ ] Apply color scheme based on folder type:
  - Pages: blue (#1E3A8A / #3B82F6)
  - Feature: purple (#581C87 / #A855F7)
  - Integration: green (#064E3B / #10B981)
  - UI: cyan (#164E63 / #06B6D4)
  - Utility: gray (#374151 / #6B7280)
  - Orphan: yellow/dashed (#422006 / #CA8A04)
- [ ] Display folder icon + name
- [ ] Display component count
- [ ] Selected state: thicker border, subtle glow

### Connection Rendering

- [ ] Draw lines between connected folders
- [ ] Line thickness based on connection count (1-4px range)
- [ ] Line opacity based on connection count (0.3-0.7 range)
- [ ] Use gray color (#4B5563)

### Interactions

- [ ] Click folder → select (show detail panel)
- [ ] Double-click folder → drill down (Phase 3)
- [ ] Click empty space → deselect
- [ ] Pan with drag
- [ ] Zoom with scroll wheel
- [ ] Fit button works correctly

### Orphan Indicator

- [ ] Render orphan "folder" with dashed border
- [ ] Show count of orphan components
- [ ] Position separately from main graph

### Verification

- [ ] Screenshot looks similar to mockup
- [ ] 123 components reduced to ~6 folder nodes
- [ ] Colors match type
- [ ] Layout is tiered (not random)

---

## Phase 3: Level 2 - Expanded Folder

### State Management

- [ ] Track current view: `'overview' | 'expanded'`
- [ ] Track expanded folder ID
- [ ] Track selected component ID

### Expanded View Layout

- [ ] Draw folder boundary box (dashed border, folder color)
- [ ] Display folder name in header of boundary
- [ ] Render components inside boundary
- [ ] Use simple grid or flow layout for components
- [ ] Apply lighter shade of folder color to component nodes

### External Connections

- [ ] Render other folders as mini-nodes at edges
- [ ] Position: left side = folders that USE this folder
- [ ] Position: right side = folders this folder USES
- [ ] Draw connections from mini-nodes to relevant components
- [ ] Color connections by source folder color
- [ ] Thickness based on count

### Internal Connections

- [ ] Draw connections between components within folder
- [ ] Use folder color for internal connections
- [ ] Lighter opacity than external connections

### Component Nodes

- [ ] Display component name (can truncate with ellipsis, but show full on hover)
- [ ] Display usage count (×28)
- [ ] Selected state: brighter border

### Interactions

- [ ] Click component → select (show detail panel)
- [ ] Double-click component → open X-Ray view
- [ ] Click outside folder boundary → go back to overview
- [ ] "Back" button in header → go back to overview

### Breadcrumb

- [ ] Show path: `App > #Directus > ComponentName`
- [ ] Each segment is clickable
- [ ] Click "App" → back to overview
- [ ] Click folder → stay in folder view, deselect component

### Verification

- [ ] Can navigate into any folder
- [ ] Components display correctly
- [ ] External connections visible from correct folders
- [ ] Can navigate back to overview

---

## Phase 4: Detail Panels

### Folder Detail Panel

- [ ] Header with folder icon, name, color
- [ ] Component count
- [ ] "Incoming" section:
  - Which folders use this folder
  - Connection count for each
- [ ] "Outgoing" section:
  - Which folders this folder uses
  - Connection count for each
- [ ] "Expand" button → drills down

### Component Detail Panel

- [ ] Header with component name
- [ ] "Used by" count and list (folders/components that use this)
- [ ] "Uses" list (components this depends on)
- [ ] "Open in X-Ray" button
- [ ] "Go to Canvas" button

### Panel Behavior

- [ ] Panel appears on right side when item selected
- [ ] Close button dismisses panel
- [ ] Clicking elsewhere dismisses panel
- [ ] Panel updates when selection changes

### Verification

- [ ] Panel shows correct data
- [ ] Buttons work correctly
- [ ] X-Ray opens correct component

---

## Phase 5: Polish

### Edge Cases

- [ ] Handle flat projects (no folders) - treat each component as its own "folder"
- [ ] Handle single-folder projects
- [ ] Handle empty projects
- [ ] Handle folders with 50+ components - consider pagination or "show more"

### Zoom & Pan

- [ ] Zoom actually changes scale (not just a label)
- [ ] Pan works with mouse drag
- [ ] "Fit" button frames all content with padding
- [ ] Zoom level persists during drill-down/back

### Animations

- [ ] Smooth transition when expanding folder
- [ ] Smooth transition when collapsing back
- [ ] Node hover effects

### Keyboard

- [ ] Escape → go back / deselect
- [ ] Enter → expand selected / open X-Ray
- [ ] Arrow keys → navigate between nodes (stretch goal)

### Final Verification

- [ ] Load 123-component project
- [ ] Verify overview shows ~6 folders
- [ ] Verify can drill into each folder
- [ ] Verify can open X-Ray from any component
- [ ] Verify no console errors
- [ ] Verify smooth performance (no jank on pan/zoom)

---

## Cleanup

- [ ] Remove unused code from original implementation
- [ ] Remove dagre if no longer needed (check other usages first)
- [ ] Update any documentation referencing old implementation
- [ ] Add brief JSDoc comments to new functions

---

## Definition of Done

- [ ] Folder overview renders correctly with test project
- [ ] Drill-down works for all folders
- [ ] X-Ray handoff works
- [ ] Colors match specification
- [ ] Layout is semantic (tiered), not random
- [ ] Performance acceptable on 100+ component projects
- [ ] No TypeScript errors
- [ ] No console errors
