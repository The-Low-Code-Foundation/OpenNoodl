# React 19 Migration System - Changelog

## [Unreleased]

### Session 8: Migration Marker Fix

#### 2024-12-15

**Fixed:**
- **Migrated Projects Still Showing as Legacy** (`MigrationSession.ts`):
  - Root cause: `executeFinalizePhase()` was a placeholder with just `await this.simulateDelay(200)` and never updated project.json
  - The runtime detection system checks for `runtimeVersion` or `migratedFrom` fields in project.json
  - Without these markers, migrated projects were still detected as legacy React 17
  - Implemented actual finalization that:
    1. Reads the project.json from the target path
    2. Adds `runtimeVersion: "react19"` field
    3. Adds `migratedFrom` metadata object with:
       - `version: "react17"` - what it was migrated from
       - `date` - ISO timestamp of migration
       - `originalPath` - path to source project
       - `aiAssisted` - whether AI was used
    4. Writes the updated project.json back
  - Migrated projects now correctly identified as React 19 in project list

**Technical Notes:**
- Runtime detection checks these fields in order:
  1. `runtimeVersion` field (highest confidence)
  2. `migratedFrom` field (indicates already migrated)
  3. `editorVersion` comparison to 1.2.0
  4. Legacy pattern scanning
  5. Creation date heuristic (lowest confidence)
- Adding `runtimeVersion: "react19"` provides "high" confidence detection

**Files Modified:**
```
packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts
```

---

### Session 7: Complete Migration Implementation

#### 2024-12-14

**Fixed:**
- **Text Color Invisible (Gray on Gray)** (All migration SCSS files):
  - Root cause: SCSS files used non-existent CSS variables like `--theme-color-fg-1` and `--theme-color-secondary` for text
  - `--theme-color-fg-1` doesn't exist in the theme - it's `--theme-color-fg-highlight`
  - `--theme-color-secondary` is a dark teal color (`#005769`) meant for backgrounds, not text
  - For text, should use `--theme-color-secondary-as-fg` which is a visible teal (`#7ec2cf`)
  - Updated all migration SCSS files with correct variable names:
    - `--theme-color-fg-1` → `--theme-color-fg-highlight` (white text, `#f5f5f5`)
    - `--theme-color-secondary` (when used for text color) → `--theme-color-secondary-as-fg` (readable teal, `#7ec2cf`)
  - Text is now visible with proper contrast against dark backgrounds

- **Migration Does Not Create Project Folder** (`MigrationSession.ts`):
  - Root cause: `executeCopyPhase()` was a placeholder that never actually copied files
  - Implemented actual file copying using `@noodl/platform` filesystem API
  - New `copyDirectoryRecursive()` method recursively copies all project files
  - Skips `node_modules` and `.git` directories for efficiency
  - Checks if target directory exists before copying (prevents overwrites)

- **"Open Migrated Project" Button Does Nothing** (`projectsview.ts`):
  - Root cause: `onComplete` callback didn't receive or use the target path
  - Updated callback signature to receive `targetPath: string` parameter
  - Now opens the migrated project from the correct target path
  - Shows success toast and updates project list

**Technical Notes:**
- Theme color variable naming conventions:
  - `--theme-color-bg-*` for backgrounds (bg-1 through bg-4, darker to lighter)
  - `--theme-color-fg-*` for foreground/text (fg-highlight, fg-default, fg-default-shy, fg-muted)
  - `--theme-color-secondary` is `#005769` (dark teal) - background only!
  - `--theme-color-secondary-as-fg` is `#7ec2cf` (light teal) - use for text
- filesystem API:
  - `filesystem.exists(path)` - check if path exists
  - `filesystem.makeDirectory(path)` - create directory
  - `filesystem.listDirectory(path)` - list contents (returns entries with `fullPath`, `name`, `isDirectory`)
  - `filesystem.readFile(path)` - read file contents
  - `filesystem.writeFile(path, content)` - write file contents

**Files Modified:**
```
packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts
packages/noodl-editor/src/editor/src/views/projectsview.ts
packages/noodl-editor/src/editor/src/views/migration/steps/ConfirmStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/CompleteStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/FailedStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/ReportStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/ScanningStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/components/WizardProgress.module.scss
```

---

### Session 6: Dialog Pattern Fix & Button Functionality

#### 2024-12-14

**Fixed:**
- **"Start Migration" Button Does Nothing** (`MigrationWizard.tsx`):
  - Root cause: useReducer `state.session` was never initialized
  - Component used two sources of truth:
    1. `migrationSessionManager.getSession()` for rendering - worked fine
    2. `state.session` in reducer for actions - always null!
  - All action handlers checked `if (!state.session) return state;` and returned unchanged
  - Added `SET_SESSION` action type to initialize reducer state after session creation
  - Button clicks now properly dispatch actions and update state

- **Switched from Modal to CoreBaseDialog** (`MigrationWizard.tsx`):
  - Modal component was causing layout and interaction issues
  - CoreBaseDialog is the pattern used by working dialogs like ConfirmDialog
  - Changed import and component usage to use CoreBaseDialog directly
  - Props: `isVisible`, `hasBackdrop`, `onClose`

- **Fixed duplicate variable declaration** (`MigrationWizard.tsx`):
  - Had two `const session = migrationSessionManager.getSession()` declarations
  - Renamed one to `currentSession` to avoid redeclaration error

**Technical Notes:**
- When using both an external manager AND useReducer, reducer state must be explicitly synchronized
- CoreBaseDialog is the preferred pattern for dialogs - simpler and more reliable than Modal
- Pattern for initializing reducer with async data:
  ```tsx
  // In useEffect after async operation:
  dispatch({ type: 'SET_SESSION', session: createdSession });
  
  // In reducer:
  case 'SET_SESSION':
    return { ...state, session: action.session };
  ```

**Files Modified:**
```
packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.tsx
```

---

### Session 5: Critical UI Bug Fixes

#### 2024-12-14

**Fixed:**
- **Migration Wizard Buttons Not Clickable** (`BaseDialog.module.scss`):
  - Root cause: The `::after` pseudo-element on `.VisibleDialog` was covering the entire dialog
  - This overlay had no `pointer-events: none`, blocking all click events
  - Added `pointer-events: none` to `::after` pseudo-element
  - All buttons, icons, and interactive elements now work correctly

- **Migration Wizard Not Scrollable** (`MigrationWizard.module.scss`):
  - Root cause: Missing proper flex layout and overflow settings
  - Added `display: flex`, `flex-direction: column`, and `overflow: hidden` to `.MigrationWizard`
  - Added `flex: 1`, `min-height: 0`, and `overflow-y: auto` to `.WizardContent`
  - Modal content now scrolls properly on shorter screen heights

- **Gray-on-Gray Text (Low Contrast)** (All step SCSS modules):
  - Root cause: SCSS files used undefined CSS variables like `--color-grey-800`, `--color-grey-400`, etc.
  - The theme only defines `--theme-color-*` variables, causing undefined values
  - Updated all migration wizard SCSS files to use proper theme variables:
    - `--theme-color-bg-1`, `--theme-color-bg-2`, `--theme-color-bg-3` for backgrounds
    - `--theme-color-fg-1` for primary text
    - `--theme-color-secondary` for secondary text
    - `--theme-color-primary`, `--theme-color-success`, `--theme-color-warning`, `--theme-color-danger` for status colors
  - Text now has proper contrast against modal background

**Technical Notes:**
- BaseDialog uses a `::after` pseudo-element for background color rendering
- Without `pointer-events: none`, this pseudo covers content and blocks interaction
- Theme color variables follow pattern: `--theme-color-{semantic-name}`
- Custom color variables like `--color-grey-*` don't exist - always use theme variables
- Flex containers need `min-height: 0` on children to allow proper shrinking/scrolling

**Files Modified:**
```
packages/noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.module.scss
packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.module.scss
packages/noodl-editor/src/editor/src/views/migration/components/WizardProgress.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/ConfirmStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/ScanningStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/ReportStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/CompleteStep.module.scss
packages/noodl-editor/src/editor/src/views/migration/steps/FailedStep.module.scss
```

---

### Session 4: Bug Fixes & Polish

#### 2024-12-14

**Fixed:**
- **EPIPE Error on Project Open** (`cloud-function-server.js`):
  - Added `safeLog()` wrapper function that catches and ignores EPIPE errors
  - EPIPE occurs when stdout pipe is broken (e.g., terminal closed)
  - All console.log calls in cloud-function-server now use safeLog
  - Prevents editor crash when output pipe becomes unavailable

- **Runtime Detection Defaulting** (`ProjectScanner.ts`):
  - Changed fallback runtime version from `'unknown'` to `'react17'`
  - Projects without explicit markers now correctly identified as legacy
  - Ensures old Noodl projects trigger migration UI even without version flags
  - Updated indicator message: "No React 19 markers found - assuming legacy React 17 project"

- **Migration UI Not Showing** (`projectsview.ts`):
  - Added listener for `'runtimeDetectionComplete'` event
  - Project list now re-renders after async runtime detection completes
  - Legacy badges and migrate buttons appear correctly for React 17 projects

- **SCSS Import Error** (`MigrationWizard.module.scss`):
  - Removed invalid `@use '../../../../styles/utils/colors' as *;` import
  - File was referencing non-existent styles/utils/colors.scss
  - Webpack cache required clearing after fix

**Technical Notes:**
- safeLog pattern: `try { console.log(...args); } catch (e) { /* ignore EPIPE */ }`
- Runtime detection is async - UI must re-render after detection completes
- Webpack caches SCSS files aggressively - cache clearing may be needed after SCSS fixes
- The `runtimeDetectionComplete` event fires after `detectAllProjectRuntimes()` completes

**Files Modified:**
```
packages/noodl-editor/src/main/src/cloud-function-server.js
packages/noodl-editor/src/editor/src/models/migration/ProjectScanner.ts
packages/noodl-editor/src/editor/src/views/projectsview.ts
packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.module.scss
```

---

### Session 3: Projects View Integration

#### 2024-12-14

**Added:**
- Extended `DialogLayerModel.tsx` with generic `showDialog()` method:
  - Accepts render function `(close: () => void) => JSX.Element`
  - Options include `onClose` callback for cleanup
  - Enables mounting custom React components (like MigrationWizard) as dialogs
  - Type: `ShowDialogOptions` interface added

- Extended `LocalProjectsModel.ts` with runtime detection:
  - `RuntimeVersionInfo` import from migration/types
  - `detectRuntimeVersion` import from migration/ProjectScanner
  - `ProjectItemWithRuntime` interface extending ProjectItem with runtimeInfo
  - In-memory cache: `runtimeInfoCache: Map<string, RuntimeVersionInfo>`
  - Detection tracking: `detectingProjects: Set<string>`
  - New methods:
    - `getRuntimeInfo(projectPath)` - Get cached runtime info
    - `isDetectingRuntime(projectPath)` - Check if detection in progress
    - `getProjectsWithRuntime()` - Get all projects with runtime info
    - `detectProjectRuntime(projectPath)` - Detect and cache runtime version
    - `detectAllProjectRuntimes()` - Background detection for all projects
    - `isLegacyProject(projectPath)` - Check if project is React 17
    - `clearRuntimeCache(projectPath)` - Clear cache after migration

- Updated `projectsview.html` template with legacy project indicators:
  - `data-class="isLegacy:projects-item--legacy"` conditional styling
  - Legacy badge with warning SVG icon (positioned top-right)
  - Legacy actions overlay with "Migrate Project" and "Open Read-Only" buttons
  - Click handlers: `data-click="onMigrateProjectClicked"`, `data-click="onOpenReadOnlyClicked"`
  - Detecting spinner with `data-class="isDetecting:projects-item-detecting"`

- Added CSS styles in `projectsview.css`:
  - `.projects-item--legacy` - Orange border for legacy projects
  - `.projects-item-legacy-badge` - Top-right warning badge
  - `.projects-item-legacy-actions` - Hover overlay with migration buttons
  - `.projects-item-migrate-btn` - Primary orange CTA button
  - `.projects-item-readonly-btn` - Secondary ghost button
  - `.projects-item-detecting` - Loading spinner animation
  - `.hidden` utility class

- Updated `projectsview.ts` with migration handler logic:
  - Imports for React, MigrationWizard, ProjectItemWithRuntime
  - Extended `ProjectItemScope` type with `isLegacy` and `isDetecting` flags
  - Updated `renderProjectItems()` to:
    - Check `isLegacyProject()` and `isDetectingRuntime()` for each project
    - Include flags in template scope for conditional rendering
    - Trigger `detectAllProjectRuntimes()` on render
  - New handlers:
    - `onMigrateProjectClicked()` - Opens MigrationWizard via DialogLayerModel.showDialog()
    - `onOpenReadOnlyClicked()` - Opens project normally (banner display deferred)

**Technical Notes:**
- DialogLayerModel uses existing Modal wrapper pattern with custom render function
- Runtime detection uses in-memory cache to avoid persistence to localStorage
- Template binding uses jQuery-based View system with `data-*` attributes
- CSS hover overlay only shows for legacy projects
- Tracker analytics integrated for "Migration Wizard Opened" and "Legacy Project Opened Read-Only"
- ToastLayer.showSuccess() used for migration completion notification

**Files Modified:**
```
packages/noodl-editor/src/editor/src/models/DialogLayerModel.tsx
packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts
packages/noodl-editor/src/editor/src/templates/projectsview.html
packages/noodl-editor/src/editor/src/styles/projectsview.css
packages/noodl-editor/src/editor/src/views/projectsview.ts
```

**Remaining for Future Sessions:**
- EditorBanner component for legacy read-only mode warning (Post-Migration UX)
- wire open project flow for legacy detection (auto-detect on existing project open)

---

### Session 2: Wizard UI (Basic Flow)

#### 2024-12-14

**Added:**
- Created `packages/noodl-editor/src/editor/src/views/migration/` directory with:
  - `MigrationWizard.tsx` - Main wizard container component:
    - Uses Modal component from @noodl-core-ui
    - useReducer for local state management
    - Integrates with migrationSessionManager from Session 1
    - Renders step components based on current session.step
  - `components/WizardProgress.tsx` - Visual step progress indicator:
    - Shows 5 steps with check icons for completed
    - Connectors between steps with completion status
  - `steps/ConfirmStep.tsx` - Step 1: Confirm source/target paths:
    - Source path locked (read-only)
    - Target path editable with filesystem.exists() validation
    - Warning about original project being safe
  - `steps/ScanningStep.tsx` - Step 2 & 4: Progress display:
    - Reused for both scanning and migrating phases
    - Progress bar with percentage
    - Activity log with color-coded entries (info/success/warning/error)
  - `steps/ReportStep.tsx` - Step 3: Scan results report:
    - Stats row with automatic/simpleFixes/needsReview counts
    - Collapsible category sections with component lists
    - AI prompt section (disabled - future session)
  - `steps/CompleteStep.tsx` - Step 5: Final summary:
    - Stats cards (migrated/needsReview/failed)
    - Duration and AI cost display
    - Source/target path display
    - Next steps guidance
  - `steps/FailedStep.tsx` - Error handling step:
    - Error details display
    - Contextual suggestions (network/permission/general)
    - Safety notice about original project

- Created SCSS modules for all components:
  - `MigrationWizard.module.scss`
  - `components/WizardProgress.module.scss`
  - `steps/ConfirmStep.module.scss`
  - `steps/ScanningStep.module.scss`
  - `steps/ReportStep.module.scss`
  - `steps/CompleteStep.module.scss`
  - `steps/FailedStep.module.scss`

**Technical Notes:**
- Text component uses `className` not `UNSAFE_className` for styling
- Text component uses `textType` prop (TextType.Secondary, TextType.Shy) not variants
- TextInput onChange expects standard React ChangeEventHandler<HTMLInputElement>
- PrimaryButtonVariant has: Cta (default), Muted, Ghost, Danger (NO "Secondary")
- Using @noodl/platform filesystem.exists() for path checking
- VStack/HStack from @noodl-core-ui/components/layout/Stack for layout
- SVG icons defined inline in each component for self-containment

**Files Created:**
```
packages/noodl-editor/src/editor/src/views/migration/
├── MigrationWizard.tsx
├── MigrationWizard.module.scss
├── components/
│   ├── WizardProgress.tsx
│   └── WizardProgress.module.scss
└── steps/
    ├── ConfirmStep.tsx
    ├── ConfirmStep.module.scss
    ├── ScanningStep.tsx
    ├── ScanningStep.module.scss
    ├── ReportStep.tsx
    ├── ReportStep.module.scss
    ├── CompleteStep.tsx
    ├── CompleteStep.module.scss
    ├── FailedStep.tsx
    └── FailedStep.module.scss
```

**Remaining for Session 2:**
- DialogLayerModel integration for showing wizard (deferred to Session 3)

---

### Session 1: Foundation + Detection

#### 2024-12-13

**Added:**
- Created CHECKLIST.md for tracking implementation progress
- Created CHANGELOG.md for documenting changes
- Created `packages/noodl-editor/src/editor/src/models/migration/` directory with:
  - `types.ts` - Complete TypeScript interfaces for migration system:
    - Runtime version types (`RuntimeVersion`, `RuntimeVersionInfo`, `ConfidenceLevel`)
    - Migration issue types (`MigrationIssue`, `MigrationIssueType`, `ComponentMigrationInfo`)
    - Session types (`MigrationSession`, `MigrationScan`, `MigrationStep`, `MigrationPhase`)
    - AI types (`AIConfig`, `AIBudget`, `AIPreferences`, `AIMigrationResponse`)
    - Project manifest extensions (`ProjectMigrationMetadata`, `ComponentMigrationNote`)
    - Legacy pattern definitions (`LegacyPattern`, `LegacyPatternScan`)
  - `ProjectScanner.ts` - Version detection and legacy pattern scanning:
    - 5-tier detection system with confidence levels
    - `detectRuntimeVersion()` - Main detection function
    - `scanForLegacyPatterns()` - Scans for React 17 patterns
    - `scanProjectForMigration()` - Full project migration scan
    - 13 legacy React patterns detected (componentWillMount, string refs, etc.)
  - `MigrationSession.ts` - State machine for migration workflow:
    - `MigrationSessionManager` class extending EventDispatcher
    - Step transitions (confirm → scanning → report → configureAi → migrating → complete/failed)
    - Progress tracking and logging
    - Helper functions (`checkProjectNeedsMigration`, `getStepLabel`, etc.)
  - `index.ts` - Clean module exports

**Technical Notes:**
- IFileSystem interface from `@noodl/platform` uses `readFile(path)` with single argument (no encoding)
- IFileSystem doesn't expose file stat/birthtime - creation date heuristic relies on project.json metadata
- Migration phases: copying → automatic → ai-assisted → finalizing
- Default AI budget: $5 max per session, $1 pause increments

**Files Created:**
```
packages/noodl-editor/src/editor/src/models/migration/
├── index.ts
├── types.ts
├── ProjectScanner.ts
└── MigrationSession.ts
```

---

## Overview

This changelog tracks the implementation of the React 19 Migration System feature, which allows users to safely upgrade legacy Noodl projects (React 17) to the new OpenNoodl runtime (React 19), with optional AI-assisted code migration.

### Feature Specs
- [00-OVERVIEW.md](./00-OVERVIEW.md) - Feature summary and architecture
- [01-PROJECT-DETECTION.md](./01-PROJECT-DETECTION.md) - Detecting legacy projects
- [02-MIGRATION-WIZARD.md](./02-MIGRATION-WIZARD.md) - Step-by-step wizard UI
- [03-AI-MIGRATION.md](./03-AI-MIGRATION.md) - AI-assisted code migration
- [04-POST-MIGRATION-UX.md](./04-POST-MIGRATION-UX.md) - Editor experience after migration
- [05-NEW-PROJECT-NOTICE.md](./05-NEW-PROJECT-NOTICE.md) - New project messaging

### Implementation Sessions
1. **Session 1**: Foundation + Detection (types, scanner, models)
2. **Session 2**: Wizard UI (basic flow without AI)
3. **Session 3**: Projects View Integration (legacy badges, buttons)
4. **Session 4**: AI Migration + Polish (Claude integration, UX)
