# Session 2: Post-Migration UX Features - Implementation Plan

## Status: Infrastructure Complete, UI Integration Pending

### Completed ✅

1. **MigrationNotesManager.ts** - Complete helper system

   - `getMigrationNote(componentId)` - Get notes for a component
   - `getAllMigrationNotes(filter, includeDismissed)` - Get filtered notes
   - `getMigrationNoteCounts()` - Get counts by category
   - `dismissMigrationNote(componentId)` - Dismiss a note
   - Status/icon helper functions

2. **MigrationNotesPanel Component** - Complete React panel

   - Beautiful status-based UI with gradient headers
   - Shows issues, AI suggestions, help links
   - Dismiss functionality
   - Full styling in MigrationNotesPanel.module.scss

3. **Design System** - Consistent with Session 1
   - Status colors: warning orange, AI purple, success green
   - Professional typography and spacing
   - Smooth animations and transitions

### Remaining Work 🚧

#### Part 2: Component Badges (2-3 hours)

**Goal:** Add visual migration status badges to components in ComponentsPanel

**Challenge:** ComponentsPanel.ts is a legacy jQuery-based view using underscore.js templates (not React)

**Files to Modify:**

1. `packages/noodl-editor/src/editor/src/views/panels/componentspanel/ComponentsPanel.ts`
2. `packages/noodl-editor/src/editor/src/templates/componentspanel.html`
3. `packages/noodl-editor/src/editor/src/styles/componentspanel.css`

**Implementation Steps:**

**Step 2.1: Add migration data to component scopes**

In `ComponentsPanel.ts`, in the `returnComponentScopeAndSetActive` function:

```typescript
const returnComponentScopeAndSetActive = (c, f) => {
  const iconType = getComponentIconType(c);

  // Add migration note loading
  const migrationNote = getMigrationNote(c.fullName);

  const scope = {
    folder: f,
    comp: c,
    name: c.localName,
    isSelected: this.nodeGraphEditor?.getActiveComponent() === c,
    isPage: iconType === ComponentIconType.Page,
    isCloudFunction: iconType === ComponentIconType.CloudFunction,
    isRoot: ProjectModel.instance.getRootNode() && ProjectModel.instance.getRootNode().owner.owner == c,
    isVisual: iconType === ComponentIconType.Visual,
    isComponentFolder: false,
    canBecomeRoot: c.allowAsExportRoot,
    hasWarnings: WarningsModel.instance.hasComponentWarnings(c),

    // NEW: Migration data
    hasMigrationNote: Boolean(migrationNote && !migrationNote.dismissedAt),
    migrationStatus: migrationNote?.status || null,
    migrationNote: migrationNote
  };

  // ... rest of function
};
```

**Step 2.2: Add badge click handler**

Add this method to ComponentsPanelView class:

```typescript
onComponentBadgeClicked(scope, el, evt) {
  evt.stopPropagation(); // Prevent component selection

  if (!scope.migrationNote) return;

  // Import at top: const { DialogLayerModel } = require('../../DialogLayer');
  // Import at top: const { MigrationNotesPanel } = require('../MigrationNotesPanel');

  const ReactDOM = require('react-dom/client');
  const React = require('react');

  const panel = React.createElement(MigrationNotesPanel, {
    component: scope.comp,
    note: scope.migrationNote,
    onClose: () => {
      DialogLayerModel.instance.hideDialog();
      this.scheduleRender(); // Refresh to show dismissed state
    }
  });

  DialogLayerModel.instance.showDialog({
    content: panel,
    title: 'Migration Notes',
    width: 600
  });
}
```

**Step 2.3: Update HTML template**

In `componentspanel.html`, add badge markup to the `item` template after the warnings icon:

```html
<!-- Migration badge -->
<div
  style="position:absolute; right:75px; top:1px; bottom:2px;"
  data-class="!hasMigrationNote:hidden"
  data-tooltip="View migration notes"
  data-click="onComponentBadgeClicked"
>
  <div
    class="components-panel-migration-badge"
    data-class="migrationStatus:badge-{migrationStatus},isSelected:components-panel-item-selected"
  ></div>
</div>
```

**Step 2.4: Add badge CSS**

In `componentspanel.css`:

```css
/* Migration badges */
.components-panel-migration-badge {
  position: absolute;
  width: 16px;
  height: 16px;
  top: 8px;
  right: 0;
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--speed-turbo) var(--easing-base);
  opacity: 0.8;
}

.components-panel-migration-badge:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* Badge colors by status */
.components-panel-migration-badge.badge-needs-review {
  background-color: #f59e0b; /* warning orange */
  box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
}

.components-panel-migration-badge.badge-ai-migrated {
  background-color: #a855f7; /* AI purple */
  box-shadow: 0 0 6px rgba(168, 85, 247, 0.4);
}

.components-panel-migration-badge.badge-auto {
  background-color: #10b981; /* success green */
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

.components-panel-migration-badge.badge-manually-fixed {
  background-color: #10b981; /* success green */
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

/* Selected state */
.components-panel-item-selected .components-panel-migration-badge {
  opacity: 1;
}
```

#### Part 3: Filter System (2-3 hours)

**Goal:** Add filter buttons to show/hide components by migration status

**Step 3.1: Add filter state**

In `ComponentsPanelView` class constructor:

```typescript
constructor(args: ComponentsPanelOptions) {
  super();
  // ... existing code ...

  // NEW: Migration filter state
  this.migrationFilter = 'all'; // 'all' | 'needs-review' | 'ai-migrated' | 'no-issues'
}
```

**Step 3.2: Add filter methods**

```typescript
setMigrationFilter(filter: MigrationFilter) {
  this.migrationFilter = filter;
  this.scheduleRender();
}

shouldShowComponent(scope): boolean {
  // Always show if no filter
  if (this.migrationFilter === 'all') return true;

  const hasMigrationNote = scope.hasMigrationNote;
  const status = scope.migrationStatus;

  switch (this.migrationFilter) {
    case 'needs-review':
      return hasMigrationNote && status === 'needs-review';
    case 'ai-migrated':
      return hasMigrationNote && status === 'ai-migrated';
    case 'no-issues':
      return !hasMigrationNote;
    default:
      return true;
  }
}
```

**Step 3.3: Apply filter in renderFolder**

In the `renderFolder` method, wrap component rendering:

```typescript
// Then component items
for (var i in folder.components) {
  const c = folder.components[i];
  const scope = returnComponentScopeAndSetActive(c, folder);

  // NEW: Apply filter
  if (!this.shouldShowComponent(scope)) continue;

  this.componentScopes[c.fullName] = scope;
  // ... rest of rendering ...
}
```

**Step 3.4: Add filter UI to HTML template**

Add after the Components header in `componentspanel.html`:

```html
<!-- Migration filters (show only if project has migration notes) -->
<div data-class="!hasMigrationNotes:hidden" class="components-panel-filters">
  <button
    data-class="migrationFilter=all:is-active"
    class="components-panel-filter-btn"
    data-click="onMigrationFilterClicked"
    data-filter="all"
  >
    All
  </button>
  <button
    data-class="migrationFilter=needs-review:is-active"
    class="components-panel-filter-btn badge-needs-review"
    data-click="onMigrationFilterClicked"
    data-filter="needs-review"
  >
    Needs Review (<span data-text="needsReviewCount">0</span>)
  </button>
  <button
    data-class="migrationFilter=ai-migrated:is-active"
    class="components-panel-filter-btn badge-ai-migrated"
    data-click="onMigrationFilterClicked"
    data-filter="ai-migrated"
  >
    AI Migrated (<span data-text="aiMigratedCount">0</span>)
  </button>
  <button
    data-class="migrationFilter=no-issues:is-active"
    class="components-panel-filter-btn"
    data-click="onMigrationFilterClicked"
    data-filter="no-issues"
  >
    No Issues
  </button>
</div>
```

**Step 3.5: Add filter CSS**

```css
/* Migration filters */
.components-panel-filters {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  background-color: var(--theme-color-bg-2);
  border-bottom: 1px solid var(--theme-color-border-default);
}

.components-panel-filter-btn {
  flex: 1;
  padding: 6px 12px;
  font: 11px var(--font-family-regular);
  color: var(--theme-color-fg-default);
  background-color: var(--theme-color-bg-3);
  border: 1px solid var(--theme-color-border-default);
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--speed-turbo) var(--easing-base);
}

.components-panel-filter-btn:hover {
  background-color: var(--theme-color-bg-4);
  color: var(--theme-color-fg-highlight);
}

.components-panel-filter-btn.is-active {
  background-color: var(--theme-color-secondary);
  color: var(--theme-color-on-secondary);
  border-color: var(--theme-color-secondary);
}

/* Badge-colored filters */
.components-panel-filter-btn.badge-needs-review.is-active {
  background-color: #f59e0b;
  border-color: #f59e0b;
}

.components-panel-filter-btn.badge-ai-migrated.is-active {
  background-color: #a855f7;
  border-color: #a855f7;
}
```

### Testing Checklist

Before considering Session 2 complete:

- [ ] Badges appear on migrated components
- [ ] Badge colors match status (orange=needs-review, purple=AI, green=auto)
- [ ] Clicking badge opens MigrationNotesPanel
- [ ] Dismissing note removes badge
- [ ] Filters show/hide correct components
- [ ] Filter counts update correctly
- [ ] Filter state persists during navigation
- [ ] Selected component stays visible when filtering
- [ ] No console errors
- [ ] Performance is acceptable with many components

### Notes

- **Legacy Code Warning:** ComponentsPanel uses jQuery + underscore.js templates, not React
- **Import Pattern:** Uses `require()` statements for dependencies
- **Rendering Pattern:** Uses `bindView()` with templates, not JSX
- **Event Handling:** Uses `data-click` attributes, not React onClick
- **State Management:** Uses plain object scopes, not React state

### Deferred Features

- **Code Diff Viewer:** Postponed - not critical for initial release
  - Could be added later if users request it
  - Would require significant UI work for side-by-side diff
  - Current "AI Suggestions" text is sufficient

---

**Next Steps:** Implement Part 2 (Badges) first, test thoroughly, then implement Part 3 (Filters).
