# TASK-002: React 19 UI Fixes - Checklist

## Pre-Flight Checks
- [x] Confirm on correct branch
- [x] Review current error messages in devtools
- [x] Understand existing code patterns in each file

## File Migrations

### 1. nodegrapheditor.debuginspectors.js (Critical)
- [x] Replace `require('react-dom')` with `require('react-dom/client')`
- [x] Add `root` property to store React root reference
- [x] Update `render()` method:
  - Create root only once (if not exists)
  - Use `this.root.render()` instead of `ReactDOM.render()`
- [x] Update `dispose()` method:
  - Use `this.root.unmount()` instead of `ReactDOM.unmountComponentAtNode()`
- [ ] Test: Right-click on canvas should show node picker
- [ ] Test: Debug inspector popups should work

### 2. commentlayer.ts (High Priority)
- [x] Update `_renderReact()` to check if roots already exist before creating
- [x] Only call `createRoot()` if `this.backgroundRoot` is null/undefined
- [x] Only call `createRoot()` if `this.foregroundRoot` is null/undefined
- [ ] Test: No warnings about "container already passed to createRoot"
- [ ] Test: Comment layer renders correctly

### 3. TextStylePicker.jsx (Medium Priority)
- [x] Replace `import ReactDOM from 'react-dom'` with `import { createRoot } from 'react-dom/client'`
- [x] Update popup rendering logic to use `createRoot()`
- [x] Store root reference for cleanup
- [x] Update cleanup to use `root.unmount()` instead of `unmountComponentAtNode()`
- [ ] Test: Text style popup opens and closes correctly

### 4. nodegrapheditor.ts (Additional - Found During Work)
- [x] Add `toolbarRoots: Root[]` array for toolbar React roots
- [x] Add `titleRoot: Root | null` for title bar root
- [x] Update toolbar rendering to reuse roots
- [x] Update `reset()` to properly unmount all roots
- [ ] Test: Toolbar buttons render correctly

### 5. createnewnodepanel.ts (Additional - Popup Positioning Fix)
- [x] Add explicit dimensions (800x600) to container div
- [x] Compensates for React 18's async createRoot() rendering
- [ ] Test: Node picker popup appears centered

## Post-Migration Verification

### Console Errors
- [ ] No `ReactDOM.render is not a function` errors
- [ ] No `ReactDOM.unmountComponentAtNode is not a function` errors
- [ ] No `createRoot() on a container already passed` warnings

### UI Functionality
- [ ] Right-click on canvas → Node picker appears (not grab hand)
- [ ] Click plus icon → Node picker appears in correct position
- [ ] Click visual node → Config panel appears on left
- [ ] Click logic node → Config panel appears on left
- [ ] Drag wire connectors → Connection can be made between nodes
- [ ] Debug inspectors → Show values on connections
- [ ] Text style picker → Opens and edits correctly
- [ ] Comment layer → Comments can be added and edited

## Final Steps
- [x] Update CHANGELOG.md with changes made
- [x] Update LEARNINGS.md if new patterns discovered
- [ ] Commit changes with descriptive message
