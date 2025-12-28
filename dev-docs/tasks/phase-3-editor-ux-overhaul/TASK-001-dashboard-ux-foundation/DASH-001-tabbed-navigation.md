# DASH-001: Tabbed Navigation System

## Overview

Replace the current single-view dashboard with a proper tabbed interface. This is the foundation task that enables all other dashboard improvements.

## Context

The current Noodl editor dashboard (`projectsview.ts`) uses a basic pane-switching mechanism with jQuery. A new launcher is being developed in `packages/noodl-core-ui/src/preview/launcher/` using React, which already has a sidebar-based navigation but needs proper tab support for the main content area.

This task focuses on the **new React-based launcher** only. The old jQuery launcher will be deprecated.

## Current State

### Existing New Launcher Structure
```
packages/noodl-core-ui/src/preview/launcher/
├── Launcher/
│   ├── Launcher.tsx           # Main component with PAGES array
│   ├── components/
│   │   ├── LauncherSidebar/   # Left navigation
│   │   ├── LauncherPage/      # Page wrapper
│   │   ├── LauncherProjectCard/
│   │   └── LauncherSearchBar/
│   └── views/
│       ├── Projects.tsx       # Current projects view
│       └── LearningCenter.tsx # Empty learning view
└── template/
    └── LauncherApp/          # App shell template
```

### Current Page Definition
```typescript
// In Launcher.tsx
export enum LauncherPageId {
  LocalProjects,
  LearningCenter
}

export const PAGES: LauncherPageMetaData[] = [
  { id: LauncherPageId.LocalProjects, displayName: 'Recent Projects', icon: IconName.CircleDot },
  { id: LauncherPageId.LearningCenter, displayName: 'Learn', icon: IconName.Rocket }
];
```

## Requirements

### Functional Requirements

1. **Tab Bar Component**
   - Horizontal tab bar at the top of the main content area
   - Visual indicator for active tab
   - Smooth transition when switching tabs
   - Keyboard navigation support (arrow keys, Enter)

2. **Tab Configuration**
   - Projects tab (default, opens first)
   - Learn tab (tutorials, guides)
   - Templates tab (project starters)
   - Extensible for future tabs (Marketplace, Settings)

3. **State Persistence**
   - Remember last active tab across sessions
   - Store in localStorage or electron-store

4. **URL/Deep Linking (Optional)**
   - Support for `noodl://dashboard/projects` style deep links
   - Query params for tab state

### Non-Functional Requirements

- Tab switching should feel instant (<100ms)
- No layout shift when switching tabs
- Accessible (WCAG 2.1 AA compliant)
- Consistent with existing noodl-core-ui design system

## Technical Approach

### 1. Create Tab Bar Component

Create a new component in `noodl-core-ui` that can be reused:

```
packages/noodl-core-ui/src/components/layout/TabBar/
├── TabBar.tsx
├── TabBar.module.scss
├── TabBar.stories.tsx
└── index.ts
```

### 2. Update Launcher Structure

```typescript
// New page structure
export enum LauncherPageId {
  Projects = 'projects',
  Learn = 'learn', 
  Templates = 'templates'
}

export interface LauncherTab {
  id: LauncherPageId;
  label: string;
  icon?: IconName;
  component: React.ComponentType;
}

export const LAUNCHER_TABS: LauncherTab[] = [
  { id: LauncherPageId.Projects, label: 'Projects', icon: IconName.Folder, component: Projects },
  { id: LauncherPageId.Learn, label: 'Learn', icon: IconName.Book, component: LearningCenter },
  { id: LauncherPageId.Templates, label: 'Templates', icon: IconName.Components, component: Templates }
];
```

### 3. State Management

Use React context for tab state:

```typescript
// LauncherContext.tsx
interface LauncherContextValue {
  activeTab: LauncherPageId;
  setActiveTab: (tab: LauncherPageId) => void;
}
```

### 4. Persistence Hook

```typescript
// usePersistentTab.ts
function usePersistentTab(key: string, defaultTab: LauncherPageId) {
  // Load from localStorage on mount
  // Save to localStorage on change
}
```

## Files to Create

1. `packages/noodl-core-ui/src/components/layout/TabBar/TabBar.tsx`
2. `packages/noodl-core-ui/src/components/layout/TabBar/TabBar.module.scss`
3. `packages/noodl-core-ui/src/components/layout/TabBar/TabBar.stories.tsx`
4. `packages/noodl-core-ui/src/components/layout/TabBar/index.ts`
5. `packages/noodl-core-ui/src/preview/launcher/Launcher/LauncherContext.tsx`
6. `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/usePersistentTab.ts`
7. `packages/noodl-core-ui/src/preview/launcher/Launcher/views/Templates.tsx`

## Files to Modify

1. `packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`
   - Import and use TabBar
   - Implement tab switching logic
   - Wrap with LauncherContext

2. `packages/noodl-core-ui/src/components/layout/index.ts`
   - Export TabBar component

## Implementation Steps

### Phase 1: TabBar Component
1. Create TabBar component with basic functionality
2. Add styling consistent with noodl-core-ui
3. Write Storybook stories for testing
4. Add keyboard navigation

### Phase 2: Launcher Integration
1. Create LauncherContext
2. Create usePersistentTab hook
3. Integrate TabBar into Launcher.tsx
4. Create empty Templates view

### Phase 3: Polish
1. Add tab transition animations
2. Test accessibility
3. Add deep link support (if time permits)

## Testing Checklist

- [ ] Tabs render correctly
- [ ] Clicking tab switches content
- [ ] Active tab is visually indicated
- [ ] Keyboard navigation works (Tab, Arrow keys, Enter)
- [ ] Tab state persists after closing/reopening
- [ ] No layout shift on tab switch
- [ ] Works at different viewport sizes
- [ ] Screen reader announces tab changes

## Design Reference

The tab bar should follow the existing Tabs component style in noodl-core-ui but be optimized for the launcher context (larger, more prominent).

See: `packages/noodl-core-ui/src/components/layout/Tabs/`

## Dependencies

- None (this is a foundation task)

## Blocked By

- None

## Blocks

- DASH-002 (Project List Redesign)
- DASH-003 (Project Organization)
- DASH-004 (Tutorial Section Redesign)

## Estimated Effort

- Component creation: 2-3 hours
- Launcher integration: 2-3 hours
- Polish and testing: 1-2 hours
- **Total: 5-8 hours**

## Success Criteria

1. User can switch between Projects, Learn, and Templates tabs
2. Tab state persists across sessions
3. Component is reusable for other contexts
4. Passes accessibility audit
5. Matches existing design system aesthetics
