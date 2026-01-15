# TASK-001D Phase 2 Complete: Banner Wired to Editor

**Date**: 2026-01-13  
**Status**: ✅ Complete

## What Was Done

### 1. EditorBanner Component Created

**Location**: `packages/noodl-editor/src/editor/src/views/EditorBanner/`

**Files**:

- `EditorBanner.tsx` - React component with warning icon, message, and action buttons
- `EditorBanner.module.scss` - Styling using design tokens (no hardcoded colors!)
- `index.ts` - Barrel export

**Features**:

- Fixed positioning below topbar
- Dismissible with state management
- Uses PrimaryButton and TextButton from core-ui
- Warning icon inline SVG
- Responsive design (wraps on small screens)

### 2. Integration with NodeGraphEditor

**Modified Files**:

- `packages/noodl-editor/src/editor/src/templates/nodegrapheditor.html`

  - Added `#editor-banner-root` div with z-index 1001 (above other elements)

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
  - Added `editorBannerRoot` React root property
  - Created `renderEditorBanner()` method
  - Added handler methods: `handleMigrateNow()`, `handleLearnMore()`, `handleDismissBanner()`
  - Called `renderEditorBanner()` in `render()` method
  - Updated `setReadOnly()` to re-render banner when read-only status changes

### 3. Button Component Usage

Fixed imports to use proper button components:

- `PrimaryButton` with `variant={PrimaryButtonVariant.Cta}` for "Migrate Now"
- `TextButton` for "Learn More"
- These were already part of the UI library

## How It Works

1. When `NodeGraphEditor` is created, it checks `this.readOnly` flag
2. If read-only, `renderEditorBanner()` shows the banner
3. Banner displays warning message and two action buttons
4. User can:
   - Click "Migrate Now" → placeholder toast (Phase 4 will wire up real migration)
   - Click "Learn More" → placeholder toast (Phase 4 will add documentation link)
   - Click X to dismiss → banner hides via internal state

## Technical Details

**React Integration**:

```typescript
renderEditorBanner() {
  if (!this.editorBannerRoot) {
    this.editorBannerRoot = createRoot(bannerElement);
  }

  if (this.readOnly) {
    this.editorBannerRoot.render(
      React.createElement(EditorBanner, {
        onMigrateNow: this.handleMigrateNow.bind(this),
        onLearnMore: this.handleLearnMore.bind(this),
        onDismiss: this.handleDismissBanner.bind(this)
      })
    );
  } else {
    this.editorBannerRoot.render(null);
  }
}
```

**Styling** (design tokens only):

```scss
.EditorBanner {
  background: var(--theme-color-warning-bg);
  border-bottom: 2px solid var(--theme-color-warning);
  color: var(--theme-color-fg-default);
}
```

## Next Steps

### Phase 3: Enforce Read-Only Restrictions

The existing `readOnly` checks should already prevent editing, but we need to verify:

- Nodes cannot be added/deleted
- Connections cannot be created/removed
- Properties cannot be edited
- Copy/paste/cut are disabled
- Undo/redo are disabled

### Phase 4: Wire "Migrate Now" Button

- Open MigrationWizard when clicked
- Pass current project context
- Handle migration completion

## Testing Needed

Before marking complete, need to test with a legacy React 17 project:

1. Open a React 17 project (should be detected as legacy)
2. Verify banner appears
3. Verify buttons show toast messages
4. Verify dismiss works
5. Verify read-only restrictions are enforced

## Notes

- Banner uses proper design tokens for theming
- Z-index (1001) ensures it's above canvas but not intrusive
- Responsive layout handles small screens
- Component is reusable if needed elsewhere
