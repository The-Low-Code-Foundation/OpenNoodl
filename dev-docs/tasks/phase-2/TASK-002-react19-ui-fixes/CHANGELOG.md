# TASK-002: React 19 UI Fixes - Changelog

## 2025-12-08

### Investigation
- Identified root cause: Legacy React 17 APIs still in use after Phase 1 migration
- Found 3 files requiring migration:
  - `nodegrapheditor.debuginspectors.js` - Uses `ReactDOM.render()` and `unmountComponentAtNode()`
  - `commentlayer.ts` - Creates new `createRoot()` on every render
  - `TextStylePicker.jsx` - Uses `ReactDOM.render()` and `unmountComponentAtNode()`
- Confirmed these errors cause all reported UI bugs (node picker, config panel, wire connectors)

### Changes Made

#### nodegrapheditor.debuginspectors.js
- **Before**: Used `ReactDOM.render()` at line 60, `ReactDOM.unmountComponentAtNode()` at line 64
- **After**: Migrated to React 18+ `createRoot()` API with proper root management

#### commentlayer.ts  
- **Before**: Created new roots on every `_renderReact()` call, causing React warnings
- **After**: Check if roots exist before creating, reuse existing roots

#### TextStylePicker.jsx
- **Before**: Used `ReactDOM.render()` and `unmountComponentAtNode()` in useEffect
- **After**: Migrated to `createRoot()` API with proper cleanup

### Testing Notes
- [ ] Verified right-click node picker works
- [ ] Verified plus icon node picker positions correctly
- [ ] Verified node config panel appears
- [ ] Verified wire connectors can be dragged
- [ ] Verified no more React 19 API errors in console

### Code Changes Summary

**nodegrapheditor.debuginspectors.js:**
- Changed import from `require('react-dom')` to `require('react-dom/client')`
- Added `this.root` property to store React root reference
- `render()`: Now creates root only once with `createRoot()`, reuses for subsequent renders
- `dispose()`: Uses `this.root.unmount()` instead of `ReactDOM.unmountComponentAtNode()`

**commentlayer.ts:**
- `_renderReact()`: Now checks if roots exist before calling `createRoot()`
- `renderTo()`: Properly resets roots to `null` after unmounting when switching divs
- `dispose()`: Added null checks before unmounting

**TextStylePicker.jsx:**
- Changed import from `ReactDOM from 'react-dom'` to `{ createRoot } from 'react-dom/client'`
- `useEffect`: Creates local root with `createRoot()`, renders popup, unmounts in cleanup

**nodegrapheditor.ts:**
- Added `toolbarRoots: Root[]` array to store toolbar React roots
- Added `titleRoot: Root | null` for the title bar root
- Toolbar rendering now creates roots only once and reuses them
- `reset()`: Properly unmounts all toolbar roots and title root

**createnewnodepanel.ts:**
- Added explicit `width: 800px; height: 600px` on container div before React renders
- This fixes popup positioning since React 18's `createRoot()` is async
- PopupLayer measures dimensions immediately after appending, but async render hasn't finished
- With explicit dimensions, PopupLayer calculates correct centered position
