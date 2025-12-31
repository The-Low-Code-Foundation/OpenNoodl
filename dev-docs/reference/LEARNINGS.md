# Project Learnings

This document captures important discoveries and gotchas encountered during OpenNoodl development.

---

## 🔥 CRITICAL: Electron Blocks window.prompt() and window.confirm() (Dec 2025)

### The Silent Dialog: Native Dialogs Don't Work in Electron

**Context**: Phase 3 TASK-001 Launcher - FolderTree component used `prompt()` and `confirm()` for folder creation/deletion. These worked in browser but silently failed in Electron, causing "Maximum update depth exceeded" React errors and no UI response.

**The Problem**: Electron blocks `window.prompt()` and `window.confirm()` for security reasons. Calling these functions throws an error: `"prompt() is and will not be supported"`.

**Root Cause**: Electron's sandboxed renderer process doesn't allow synchronous native dialogs as they can hang the IPC bridge and create security vulnerabilities.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Throws error in Electron
const handleCreateFolder = () => {
  const name = prompt('Enter folder name:'); // ☠️ Error: prompt() is not supported
  if (name && name.trim()) {
    createFolder(name.trim());
  }
};

const handleDeleteFolder = (folder: Folder) => {
  if (confirm(`Delete "${folder.name}"?`)) {
    // ☠️ Error: confirm() is not supported
    deleteFolder(folder.id);
  }
};
```

**The Solution** - Use React state + inline input for text entry:

```typescript
// ✅ RIGHT - React state-based text input
const [isCreatingFolder, setIsCreatingFolder] = useState(false);
const [newFolderName, setNewFolderName] = useState('');

const handleCreateFolder = () => {
  setIsCreatingFolder(true);
  setNewFolderName('');
};

const handleCreateFolderSubmit = () => {
  if (newFolderName.trim()) {
    createFolder(newFolderName.trim());
  }
  setIsCreatingFolder(false);
};

// JSX
{
  isCreatingFolder ? (
    <input
      type="text"
      value={newFolderName}
      onChange={(e) => setNewFolderName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCreateFolderSubmit();
        if (e.key === 'Escape') setIsCreatingFolder(false);
      }}
      onBlur={handleCreateFolderSubmit}
      autoFocus
    />
  ) : (
    <button onClick={handleCreateFolder}>New Folder</button>
  );
}
```

**The Solution** - Use React state + custom dialog for confirmation:

```typescript
// ✅ RIGHT - React state-based confirmation dialog
const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

const handleDeleteFolder = (folder: Folder) => {
  setDeletingFolder(folder);
};

const handleDeleteFolderConfirm = () => {
  if (deletingFolder) {
    deleteFolder(deletingFolder.id);
    setDeletingFolder(null);
  }
};

// JSX - Overlay modal
{
  deletingFolder && (
    <div className={css['DeleteConfirmation']}>
      <div className={css['Backdrop']} onClick={() => setDeletingFolder(null)} />
      <div className={css['Dialog']}>
        <h3>Delete Folder</h3>
        <p>Delete "{deletingFolder.name}"?</p>
        <button onClick={() => setDeletingFolder(null)}>Cancel</button>
        <button onClick={handleDeleteFolderConfirm}>Delete</button>
      </div>
    </div>
  );
}
```

**Why This Matters**:

- Native dialogs work fine in browser testing (Storybook)
- Same code fails silently or with cryptic errors in Electron
- Can waste hours debugging what looks like unrelated React errors
- Common pattern developers expect to work doesn't

**Secondary Issue**: The `prompt()` error triggered an infinite loop in `useProjectOrganization` hook because the service wasn't memoized, causing "Maximum update depth exceeded" errors that obscured the root cause.

**Critical Rules**:

1. **Never use `window.prompt()` in Electron** - use inline text input with React state
2. **Never use `window.confirm()` in Electron** - use custom modal dialogs
3. **Never use `window.alert()` in Electron** - use toast notifications or modals
4. **Always test Electron-specific code in the actual Electron app**, not just browser

**Alternative Electron-Native Approach** (for main process):

```javascript
// From main process - can use Electron's dialog
const { dialog } = require('electron');

// Text input dialog (async)
const result = await dialog.showMessageBox(mainWindow, {
  type: 'question',
  buttons: ['Cancel', 'OK'],
  defaultId: 1,
  title: 'Create Folder',
  message: 'Enter folder name:',
  // Note: No built-in text input, would need custom window
});

// Confirmation dialog (async)
const result = await dialog.showMessageBox(mainWindow, {
  type: 'question',
  buttons: ['Cancel', 'Delete'],
  defaultId: 0,
  cancelId: 0,
  title: 'Delete Folder',
  message: `Delete "${folderName}"?`
});
```

**Detection**: If you see errors mentioning `prompt() is not supported` or similar, you're using blocked native dialogs.

**Location**:

- Fixed in: `packages/noodl-core-ui/src/preview/launcher/Launcher/components/FolderTree/FolderTree.tsx`
- Fixed in: `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectOrganization.ts` (infinite loop fix)
- Task: Phase 3 TASK-001 Dashboard UX Foundation

**Related Issues**:

- **Infinite loop in useProjectOrganization**: Service object was recreated on every render, causing useEffect to run infinitely. Fixed by wrapping service creation in `useMemo(() => createLocalStorageService(), [])`.

**Keywords**: Electron, window.prompt, window.confirm, window.alert, native dialogs, security, renderer process, React state, modal, confirmation dialog, infinite loop, Maximum update depth

---

[Previous learnings content continues...]

## 🎨 Design Token Consolidation Side Effects (Dec 31, 2025)

### The White-on-White Epidemic: When --theme-color-secondary Changed

**Context**: Phase 3 UX Overhaul - Design token consolidation (TASK-000A) changed `--theme-color-secondary` from teal (#00CEC9) to white (#ffffff). This broke selected/active states across the entire editor UI.

**The Problem**: Dozens of components used `--theme-color-secondary` and `--theme-color-secondary-highlight` as background colors for selected items. When these tokens changed to white, selected items became invisible white-on-white.

**Affected Components**:

- MenuDialog dropdowns (viewport, URL routes, zoom level)
- Component breadcrumb trail (current page indicator)
- Search panel results (active result)
- Components panel (selected components)
- Lesson layer (selected lessons)
- All legacy CSS files using hardcoded teal colors

**Root Cause**: Token meaning changed during consolidation:

- **Before**: `--theme-color-secondary` = teal accent color (good for backgrounds)
- **After**: `--theme-color-secondary` = white/neutral (terrible for backgrounds)

**The Solution Pattern**:

```scss
// ❌ BROKEN (post-consolidation)
.is-selected {
  background-color: var(--theme-color-secondary); // Now white!
  color: var(--theme-color-on-secondary); // Also problematic
}

// ✅ FIXED - Subtle highlight
.is-current {
  background-color: var(--theme-color-bg-4); // Dark gray
  color: var(--theme-color-fg-highlight); // White text
}

// ✅ FIXED - Bold accent (for dropdowns/menus)
.is-selected {
  background-color: var(--theme-color-primary); // Noodl red
  color: var(--theme-color-on-primary); // White text
}
```

**Decision Matrix**: Use different backgrounds based on emphasis level:

- **Subtle**: `--theme-color-bg-4` (dark gray) - breadcrumbs, sidebar
- **Medium**: `--theme-color-bg-5` (lighter gray) - hover states
- **Bold**: `--theme-color-primary` (red) - dropdown selected items

**Files Fixed** (Dec 31, 2025):

- `MenuDialog.module.scss` - Dropdown selected items
- `NodeGraphComponentTrail.module.scss` - Breadcrumb current page
- `search-panel.module.scss` - Active search result
- `componentspanel.css` - Selected components
- `LessonLayerView.css` - Selected lessons
- `EditorTopbar.module.scss` - Static display colors
- `ToggleSwitch.module.scss` - Track visibility
- `popuplayer.css` - Modal triangle color

**Prevention**: New section added to `UI-STYLING-GUIDE.md` (Part 9: Selected/Active State Patterns) documenting the correct approach.

**Critical Rule**: **Never use `--theme-color-secondary` or `--theme-color-fg-highlight` as backgrounds. Always use `--theme-color-bg-*` for backgrounds and `--theme-color-primary` for accent highlights.**

**Time Lost**: 2+ hours debugging across multiple UI components

**Location**:

- Fixed files: See list above
- Documentation: `dev-docs/reference/UI-STYLING-GUIDE.md` (Part 9)
- Token definitions: `packages/noodl-core-ui/src/styles/custom-properties/colors.css`

**Keywords**: design tokens, --theme-color-secondary, white-on-white, selected state, active state, MenuDialog, consolidation, contrast, accessibility

---

## 🎨 CSS Variable Naming Mismatch: --theme-spacing-_ vs --spacing-_ (Dec 31, 2025)

### The Invisible UI: When Padding Doesn't Exist

**Context**: Phase 3 TASK-001 Launcher - Folder tree components had proper padding styles defined but rendered with zero spacing. All padding/margin values appeared to be 0px despite correct-looking SCSS code.

**The Problem**: SCSS files referenced `var(--theme-spacing-2)` but the CSS custom properties file defined `--spacing-2` (without the `theme-` prefix). This mismatch caused all spacing values to resolve to undefined/0px.

**Root Cause**: Inconsistent variable naming between:

- **SCSS files**: Used `var(--theme-spacing-1)`, `var(--theme-spacing-2)`, etc.
- **CSS definitions**: Defined `--spacing-1: 4px`, `--spacing-2: 8px`, etc. (no `theme-` prefix)

**The Broken Pattern**:

```scss
// ❌ WRONG - Variable doesn't exist
.FolderTree {
  padding: var(--theme-spacing-2); // Resolves to nothing!
  gap: var(--theme-spacing-1); // Also undefined
}

.Button {
  padding: var(--theme-spacing-2) var(--theme-spacing-3); // Both 0px
}
```

**The Correct Pattern**:

```scss
// ✅ RIGHT - Matches defined variables
.FolderTree {
  padding: var(--spacing-2); // = 8px ✓
  gap: var(--spacing-1); // = 4px ✓
}

.Button {
  padding: var(--spacing-2) var(--spacing-3); // = 8px 12px ✓
}
```

**How to Detect**:

1. **Visual inspection**: Everything looks squished with no breathing room
2. **DevTools**: Computed padding/margin values show 0px or nothing
3. **Code search**: `grep -r "var(--theme-spacing" packages/` finds non-existent variables
4. **Compare working components**: Other components use `var(--spacing-*)` without `theme-` prefix

**What Makes This Confusing**:

- **Color variables DO use `theme-` prefix**: `var(--theme-color-bg-2)` exists and works
- **Font variables DO use `theme-` prefix**: `var(--theme-font-size-default)` exists and works
- **Spacing variables DON'T use `theme-` prefix**: Only `var(--spacing-2)` works, not `var(--theme-spacing-2)`
- **Radius variables DON'T use prefix**: Just `var(--radius-default)`, not `var(--theme-radius-default)`

**Correct Variable Patterns**:
| Category | Pattern | Example |
|----------|---------|---------|
| Colors | `--theme-color-*` | `var(--theme-color-bg-2)` |
| Fonts | `--theme-font-*` | `var(--theme-font-size-default)` |
| Spacing | `--spacing-*` | `var(--spacing-2)` |
| Radius | `--radius-*` | `var(--radius-default)` |
| Shadows | `--shadow-*` | `var(--shadow-lg)` |

**Files Fixed** (Dec 31, 2025):

- `FolderTree/FolderTree.module.scss` - All spacing variables corrected
- `FolderTreeItem/FolderTreeItem.module.scss` - All spacing variables corrected

**Verification Command**:

```bash
# Find incorrect usage of --theme-spacing-*
grep -r "var(--theme-spacing" packages/noodl-core-ui/src --include="*.scss"

# Should return zero results after fix
```

**Prevention**: Always reference `dev-docs/reference/UI-STYLING-GUIDE.md` which documents the correct variable patterns. Use existing working components as templates.

**Critical Rule**: **Spacing variables are `--spacing-*` NOT `--theme-spacing-*`. When in doubt, check `packages/noodl-core-ui/src/styles/custom-properties/spacing.css` for the actual defined variables.**

**Time Lost**: 30 minutes investigating "missing styles" before discovering the variable mismatch

**Location**:

- Fixed files: `FolderTree.module.scss`, `FolderTreeItem.module.scss`
- Variable definitions: `packages/noodl-core-ui/src/styles/custom-properties/spacing.css`
- Documentation: `dev-docs/reference/UI-STYLING-GUIDE.md`

**Keywords**: CSS variables, custom properties, --spacing, --theme-spacing, zero padding, invisible UI, variable mismatch, design tokens, spacing scale

---

[Rest of the previous learnings content continues...]
