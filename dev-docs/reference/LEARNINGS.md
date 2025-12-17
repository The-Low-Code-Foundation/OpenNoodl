# OpenNoodl Development Learnings

This document records discoveries, gotchas, and non-obvious patterns found while working on OpenNoodl. Search this file before tackling complex problems.

---

## Project Migration & Versioning

### [2025-07-12] - Legacy Projects Are Already at Version 4

**Context**: Investigating what migration work is needed for legacy Noodl v1.1.0 projects.

**Discovery**: Legacy projects from Noodl v1.1.0 are already at project format version "4", which is the current version expected by the editor. This significantly reduces migration scope.

**Location**: 
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts` - Contains `Upgraders` object for format 0→1→2→3→4
- `packages/noodl-editor/src/editor/src/models/ProjectPatches/` - Node-level patches (e.g., `RouterNavigate`)

**Key Points**:
- Project format version is stored in `project.json` as `"version": "4"`
- The existing `ProjectPatches/` system handles node-level migrations automatically on load
- No major version migration infrastructure is needed for v1.1.0→v2.0.0
- The `Upgraders` object has handlers for versions 0-4, upgrading sequentially

**Keywords**: project migration, version upgrade, legacy project, project.json, upgraders

---

### [2025-07-12] - @noodl/platform FileInfo Interface

**Context**: Writing utility functions that use `filesystem.listDirectory()`.

**Discovery**: The `listDirectory()` function returns `FileInfo[]`, not strings. Each FileInfo has:
- `name: string` - Just the filename
- `fullPath: string` - Complete path
- `isDirectory: boolean`

**Location**: `packages/noodl-platform/src/filesystem/IFilesystem.ts`

**Keywords**: filesystem, listDirectory, FileInfo, platform API

---

## Webpack DevServer & Electron

### [2025-08-12] - Webpack devServer `onListening` vs `compiler.hooks.done` Timing

**Context**: Debugging why `npm run dev` showed a black Electron window, took ages to load, and caused high CPU usage.

**Discovery**: The webpack dev configuration used `devServer.onListening()` to start Electron. This hook fires when the HTTP server port opens, NOT when webpack finishes compiling. This is a race condition:

1. `npm run dev` starts webpack-dev-server
2. Server starts listening on port 8080 → `onListening` fires
3. Electron launches and loads `http://localhost:8080/src/editor/index.bundle.js`
4. But webpack is still compiling! Bundle doesn't exist yet
5. Black screen + high CPU until compilation finishes

**Fix**: Use `devServer.compiler.hooks.done.tap()` inside `onListening` to wait for the first successful compilation before spawning Electron:

```javascript
onListening(devServer) {
  devServer.compiler.hooks.done.tap('StartElectron', (stats) => {
    if (!electronStarted && !stats.hasErrors()) {
      electronStarted = true;
      child_process.spawn('npm', ['run', 'start:_dev'], ...);
    }
  });
}
```

**Why It Became Noticeable**: This was a latent bug that existed from initial commit. It became visible after the Storybook 8 migration added ~91 files to process, increasing compilation time enough to consistently "lose" the race.

**Location**: `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`

**Keywords**: webpack, devServer, onListening, electron, black screen, compilation, hooks.done, race condition, slow startup

---

### [2025-08-12] - Webpack devtool Settings Impact on Compilation Speed

**Context**: Investigating slow development startup.

**Discovery**: The `devtool: 'eval-source-map'` setting provides the most accurate sourcemaps but is very slow for large codebases. Using `'eval-cheap-module-source-map'` is significantly faster while still providing usable debugging:

| devtool | Rebuild Speed | Quality |
|---------|---------------|---------|
| `eval` | +++++ | Poor |
| `eval-cheap-source-map` | ++++ | OK |
| `eval-cheap-module-source-map` | +++ | Good |
| `eval-source-map` | + | Best |

For development where fast iteration matters more than perfect column accuracy in stack traces, `eval-cheap-module-source-map` is a good balance.

**Location**: `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`

**Keywords**: webpack, devtool, sourcemap, performance, compilation speed, development

---

### [2025-08-12] - TypeScript Path Resolution Requires baseUrl in Child tsconfig

**Context**: Build was failing with "Cannot find module '@noodl-hooks/...' or '@noodl-core-ui/...'" errors despite webpack aliases being correctly configured.

**Discovery**: When a child tsconfig.json extends a parent and overrides the `paths` property, the paths become relative to the child's directory. However, if `baseUrl` is not explicitly set in the child, path resolution fails.

The noodl-editor's tsconfig.json had:
```json
{
  "extends": "../../tsconfig.json",
  "paths": {
    "@noodl-core-ui/*": ["../noodl-core-ui/src/*"],
    // ... other paths relative to packages/noodl-editor/
  }
}
```

Without `baseUrl: "."` in the child, TypeScript couldn't resolve the relative paths correctly.

**Fix**: Always set `baseUrl` explicitly when overriding `paths` in a child tsconfig:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { ... }
  }
}
```

**Location**: `packages/noodl-editor/tsconfig.json`

**Keywords**: typescript, tsconfig, paths, baseUrl, module resolution, extends, cannot find module

---

### [2025-08-12] - @ai-sdk Packages Require Zod v4 for zod/v4 Import

**Context**: After fixing webpack timing, Electron showed black screen. DevTools console showed: "Cannot find module 'zod/v4/index.cjs'"

**Discovery**: The `@ai-sdk/provider-utils`, `@ai-sdk/gateway`, and `ai` packages import from `zod/v4`. Zod version 3.25.x only has `v4-mini` folder (a transitional export), not the full `v4` folder. Only Zod 4.x has the proper `v4` subpath export.

The error chain was:
1. `ai` package loads on startup
2. It tries to `require('zod/v4')`
3. Zod 3.25.76 doesn't have `/v4` export → crash
4. Black screen because editor fails to initialize

**Fix**: Upgrade to Zod 4.x by adding it as a direct dependency in root `package.json`:
```json
"dependencies": {
  "zod": "^4.1.0"
}
```

Using `overrides` for this case can conflict with other version specifications. A direct dependency with a semver range works cleanly in npm workspaces.

**Location**: Root `package.json`, affects all packages using AI SDK

**Keywords**: zod, zod/v4, @ai-sdk, ai, black screen, cannot find module, module resolution

---

## React 18/19 Migration Patterns

### [2025-12-08] - React 18+ Removed ReactDOM.render() and unmountComponentAtNode()

**Context**: After React 19 migration, node graph editor was completely broken - right-click showed grab hand instead of node picker, couldn't click nodes or drag wires.

**Discovery**: React 18 removed the legacy `ReactDOM.render()` and `ReactDOM.unmountComponentAtNode()` APIs. Code using these APIs throws errors like:
- `ReactDOM.render is not a function`
- `ReactDOM.unmountComponentAtNode is not a function`

The migration pattern is:

```javascript
// Before (React 17):
import ReactDOM from 'react-dom';
ReactDOM.render(<Component />, container);
ReactDOM.unmountComponentAtNode(container);

// After (React 18+):
import { createRoot } from 'react-dom/client';
const root = createRoot(container);
root.render(<Component />);
root.unmount();
```

**Important**: If rendering multiple times to the same container, you must:
1. Create the root only ONCE
2. Store the root reference
3. Call `root.render()` for subsequent updates
4. Call `root.unmount()` when disposing

Creating `createRoot()` on every render causes: "You are calling ReactDOMClient.createRoot() on a container that has already been passed to createRoot() before."

**Location**: 
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.debuginspectors.js`
- `packages/noodl-editor/src/editor/src/views/commentlayer.ts`
- `packages/noodl-editor/src/editor/src/views/TextStylePicker/TextStylePicker.jsx`

**Keywords**: ReactDOM.render, createRoot, unmountComponentAtNode, React 18, React 19, migration, root.unmount

---

### [2025-12-08] - React 18+ createRoot() Renders Asynchronously

**Context**: After migrating to React 18+ createRoot, the NodePicker popup appeared offset to the bottom-right corner instead of centered.

**Discovery**: Unlike the old synchronous `ReactDOM.render()`, React 18's `createRoot().render()` is asynchronous. If code measures DOM dimensions immediately after calling `render()`, the React component hasn't painted yet.

In PopupLayer.showPopup():
```javascript
this.$('.popup-layer-popup-content').append(content);
var contentWidth = content.outerWidth(true);   // Returns 0!
var contentHeight = content.outerHeight(true); // Returns 0!
```

When dimensions are zero, the centering calculation `x = this.width / 2 - 0 / 2` places the popup at the far right.

**Fix Options**:
1. **Set explicit dimensions** on the container div before React renders (recommended for fixed-size components)
2. Use `requestAnimationFrame` or `setTimeout` before measuring
3. Use a ResizeObserver to detect when content renders

For NodePicker (which has fixed 800x600 dimensions in CSS), the simplest fix was setting dimensions on the container div before React renders:
```javascript
render() {
  const div = document.createElement('div');
  div.style.width = '800px';
  div.style.height = '600px';
  this.renderReact(div);  // createRoot is async
  return this.el;
}
```

**Location**: `packages/noodl-editor/src/editor/src/views/createnewnodepanel.ts`

**Keywords**: createRoot, async render, dimensions, outerWidth, outerHeight, popup positioning, React 18, React 19

---

## Electron & Node.js Patterns

### [2025-12-14] - EPIPE Errors When Writing to stdout

**Context**: Editor was crashing with `Error: write EPIPE` when trying to open projects.

**Discovery**: EPIPE errors occur when a process tries to write to stdout/stderr but the receiving pipe has been closed (e.g., the terminal or parent process that spawned the subprocess is gone). In Electron apps, this happens when:
- The terminal that started `npm run dev` is closed before the app
- The parent process that spawned a child dies unexpectedly
- stdout is redirected to a file that gets closed

Cloud-function-server.js was calling `console.log()` during project operations. When the stdout pipe was broken, the error bubbled up and crashed the editor.

**Fix**: Wrap console.log calls in a try-catch:
```javascript
function safeLog(...args) {
  try {
    console.log(...args);
  } catch (e) {
    // Ignore EPIPE errors - stdout pipe may be broken
  }
}
```

**Location**: `packages/noodl-editor/src/main/src/cloud-function-server.js`

**Keywords**: EPIPE, console.log, stdout, broken pipe, electron, subprocess, crash

---

## Webpack & Build Patterns

### [2025-12-14] - Webpack SCSS Cache Can Persist Old Files

**Context**: MigrationWizard.module.scss was fixed on disk but webpack kept showing errors for a removed import line.

**Discovery**: Webpack's sass-loader caches compiled SCSS files aggressively. Even after fixing a file on disk, if an old error is cached, webpack may continue to report the stale error. This is especially confusing because:
- `cat` and `grep` show the correct file contents
- But webpack reports errors for lines that no longer exist
- The webpack process may be from a previous session that cached the old content

**Fix Steps**:
1. Kill ALL webpack processes: `pkill -9 -f webpack`
2. Clear webpack cache: `rm -rf node_modules/.cache/` in the affected package
3. Touch the file to force rebuild: `touch path/to/file.scss`
4. Restart dev server fresh

**Location**: Any SCSS file processed by sass-loader

**Keywords**: webpack, sass-loader, cache, SCSS, stale error, module build failed

---

## Event-Driven UI Patterns

### [2025-12-14] - Async Detection Requires Re-render Listener

**Context**: Migration UI badges weren't showing on legacy projects even though runtime detection was working.

**Discovery**: In OpenNoodl's jQuery-based View system, the template is rendered once when `render()` is called. If data is populated asynchronously (e.g., runtime detection), the UI won't update unless you explicitly listen for a completion event and re-render.

The pattern:
1. `renderProjectItems()` is called - projects show without runtime info
2. `detectAllProjectRuntimes()` runs async in background
3. Detection completes, `runtimeDetectionComplete` event fires
4. BUT... no one was listening → UI stays stale

**Fix**: Subscribe to the async completion event in the View:
```javascript
this.projectsModel.on('runtimeDetectionComplete', () => this.renderProjectItemsPane(), this);
```

This pattern applies to any async data in the jQuery View system:
- Runtime detection
- Cloud service status
- Git remote checks
- etc.

**Location**: `packages/noodl-editor/src/editor/src/views/projectsview.ts`

**Keywords**: async, re-render, event listener, runtimeDetectionComplete, jQuery View, stale UI

---

## CSS & Styling Patterns

### [2025-12-14] - BaseDialog `::after` Pseudo-Element Blocks Clicks

**Context**: Migration wizard popup buttons weren't clickable at all - no response to any interaction.

**Discovery**: The BaseDialog component uses a `::after` pseudo-element on `.VisibleDialog` to render the background color. This pseudo covers the entire dialog area:

```scss
.VisibleDialog {
  &::after {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--background);
    // Without pointer-events: none, this blocks all clicks!
  }
}
```

The `.ChildContainer` has `z-index: 1` which should put it above the `::after`, but due to stacking context behavior with `filter: drop-shadow()` on the parent, clicks were being intercepted by the pseudo-element.

**Fix**: Add `pointer-events: none` to the `::after` pseudo-element:
```scss
&::after {
  // ...existing styles...
  pointer-events: none; // Allow clicks to pass through
}
```

**Location**: `packages/noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.module.scss`

**Keywords**: BaseDialog, ::after, pointer-events, click not working, buttons broken, Modal, dialog

---

### [2025-12-14] - Theme Color Variables Are `--theme-color-*` Not `--color-*`

**Context**: Migration wizard UI appeared gray-on-gray with unreadable text.

**Discovery**: OpenNoodl's theme system uses CSS variables prefixed with `--theme-color-*`, NOT `--color-*`. Using undefined variables like `--color-grey-800` results in invalid/empty values causing display issues.

**Correct Variables:**
| Wrong | Correct |
|-------|---------|
| `--color-grey-800` | `--theme-color-bg-3` |
| `--color-grey-700` | `--theme-color-bg-2` |
| `--color-grey-400`, `--color-grey-300` | `--theme-color-secondary-as-fg` (for text!) |
| `--color-grey-200`, `--color-grey-100` | `--theme-color-fg-highlight` |
| `--color-primary` | `--theme-color-primary` |
| `--color-success-500` | `--theme-color-success` |
| `--color-warning` | `--theme-color-warning` |
| `--color-danger` | `--theme-color-danger` |

**Location**: Any SCSS module files in `@noodl-core-ui` or `noodl-editor`

**Keywords**: CSS variables, theme-color, --color, --theme-color, gray text, contrast, undefined variable, SCSS

---

### [2025-12-14] - `--theme-color-secondary` Is NOT For Text - Use `--theme-color-secondary-as-fg`

**Context**: Migration wizard text was impossible to read even after using `--theme-color-*` prefix.

**Discovery**: Two commonly misused theme variables cause text to be unreadable:

1. **`--theme-color-fg-1` doesn't exist!** The correct variable is:
   - `--theme-color-fg-highlight` = `#f5f5f5` (white/light text)
   - `--theme-color-fg-default` = `#b8b8b8` (normal text)
   - `--theme-color-fg-default-shy` = `#9a9999` (subtle text)
   - `--theme-color-fg-muted` = `#7e7d7d` (muted text)

2. **`--theme-color-secondary` is a BACKGROUND color!** 
   - `--theme-color-secondary` = `#005769` (dark teal - use for backgrounds only!)
   - `--theme-color-secondary-as-fg` = `#7ec2cf` (light teal - use for text!)

When text appears invisible/gray, check for these common mistakes:
```scss
// WRONG - produces invisible text
color: var(--theme-color-fg-1);           // Variable doesn't exist!
color: var(--theme-color-secondary);       // Dark teal background color!

// CORRECT - visible text
color: var(--theme-color-fg-highlight);    // White text
color: var(--theme-color-secondary-as-fg); // Light teal text
```

**Color Reference from `colors.css`:**
```css
--theme-color-bg-1: #151414;  /* Darkest background */
--theme-color-bg-2: #292828;
--theme-color-bg-3: #3c3c3c;
--theme-color-bg-4: #504f4f;  /* Lightest background */

--theme-color-fg-highlight: #f5f5f5;       /* Bright white text */
--theme-color-fg-default-contrast: #d4d4d4; /* High contrast text */
--theme-color-fg-default: #b8b8b8;          /* Normal text */
--theme-color-fg-default-shy: #9a9999;      /* Subtle text */
--theme-color-fg-muted: #7e7d7d;            /* Muted text */

--theme-color-secondary: #005769;           /* BACKGROUND only! */
--theme-color-secondary-as-fg: #7ec2cf;     /* For text */
```

**Location**: `packages/noodl-core-ui/src/styles/custom-properties/colors.css`

**Keywords**: --theme-color-fg-1, --theme-color-secondary, invisible text, gray on gray, secondary-as-fg, text color, theme variables

---

### [2025-12-14] - Flex Container Scrolling Requires `min-height: 0`

**Context**: Migration wizard content wasn't scrollable on shorter screens.

**Discovery**: When using flexbox with `overflow: auto` on a child, the child needs `min-height: 0` (or `min-width: 0` for horizontal) to allow it to shrink below its content size. Without this, the default `min-height: auto` prevents shrinking and breaks scrolling.

**Pattern:**
```scss
.Parent {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  overflow: hidden;
}

.ScrollableChild {
  flex: 1;
  min-height: 0;  // Critical! Allows shrinking
  overflow-y: auto;
}
```

The `min-height: 0` overrides the default `min-height: auto` which would prevent the element from being smaller than its content.

**Location**: Any scrollable flex container, e.g., `MigrationWizard.module.scss`

**Keywords**: flex, overflow, scroll, min-height, flex-shrink, not scrolling, content cut off

---

### [2025-12-14] - useReducer State Must Be Initialized Before Actions Work

**Context**: Migration wizard "Start Migration" button did nothing - no errors, no state change, no visual feedback.

**Discovery**: When using `useReducer` to manage component state, all action handlers typically guard against null state:
```typescript
case 'START_SCAN':
  if (!state.session) return state;  // Does nothing if session is null!
  return { ...state, session: { ...state.session, step: 'scanning' } };
```

The bug pattern:
1. Component initializes with `session: null` in reducer state
2. External manager (`migrationSessionManager`) creates and stores the session
3. UI renders using `manager.getSession()` - works fine
4. Button click dispatches action to reducer
5. Reducer checks `if (!state.session)` → returns unchanged state
6. Nothing happens - no errors, no visual change

The fix is to dispatch a `SET_SESSION` action to initialize the reducer state:
```typescript
// In useEffect after creating session:
const session = await manager.createSession(...);
dispatch({ type: 'SET_SESSION', session });  // Initialize reducer!

// In reducer:
case 'SET_SESSION':
  return { ...state, session: action.session };
```

**Key Insight**: If using both an external manager AND useReducer, the reducer state must be explicitly synchronized with the manager's state for actions to work.

**Location**: `packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.tsx`

**Keywords**: useReducer, dispatch, null state, button does nothing, state not updating, SET_SESSION, state synchronization

---

### [2025-12-14] - CoreBaseDialog vs Modal Component Patterns

**Context**: Migration wizard popup wasn't working - clicks blocked, layout broken.

**Discovery**: OpenNoodl has two dialog patterns:

1. **CoreBaseDialog** (Working, Recommended):
   - Direct component from `@noodl-core-ui/components/layout/BaseDialog`
   - Used by ConfirmDialog and other working dialogs
   - Props: `isVisible`, `hasBackdrop`, `onClose`
   - Content is passed as children

2. **Modal** (Problematic):
   - Wrapper component with additional complexity
   - Was causing issues with click handling and layout

When creating new dialogs, use the CoreBaseDialog pattern:
```tsx
import { CoreBaseDialog } from '@noodl-core-ui/components/layout/BaseDialog';

<CoreBaseDialog isVisible hasBackdrop onClose={onCancel}>
  <div className={css['YourContainer']}>
    {/* Your content */}
  </div>
</CoreBaseDialog>
```

**Location**: 
- Working example: `packages/noodl-editor/src/editor/src/views/ConfirmDialog/`
- `packages/noodl-core-ui/src/components/layout/BaseDialog/`

**Keywords**: CoreBaseDialog, Modal, dialog, popup, BaseDialog, modal not working, clicks blocked

---

## Project Migration System

### [2024-12-15] - Runtime Cache Must Persist Between App Sessions

**Context**: After migrating a project from React 17 to React 19, the project showed as React 19 (not legacy) immediately after migration. However, after closing and reopening the Electron app, the same project was flagged as legacy again.

**Discovery**: The `LocalProjectsModel` had a runtime version cache (`runtimeInfoCache`) that was stored in memory only. The cache would:
1. Correctly detect the migrated project as React 19
2. Show "React 19" badge in the UI
3. But on app restart, the cache was empty
4. Runtime detection would run again from scratch
5. During the detection delay, the project appeared as "legacy" 

The `runtimeInfoCache` was a `Map<string, RuntimeVersionInfo>` with no persistence. Every app restart lost the cache, forcing re-detection and causing a race condition where the UI rendered before detection completed.

**Fix**: Added electron-store persistence for the runtime cache:
```typescript
private runtimeCacheStore = new Store({
  name: 'project_runtime_cache'
});

private loadRuntimeCache(): void {
  const cached = this.runtimeCacheStore.get('cache') as Record<string, RuntimeVersionInfo>;
  if (cached) {
    this.runtimeInfoCache = new Map(Object.entries(cached));
  }
}

private saveRuntimeCache(): void {
  const cacheObject = Object.fromEntries(this.runtimeInfoCache.entries());
  this.runtimeCacheStore.set('cache', cacheObject);
}
```

Now the cache survives app restarts, so migrated projects stay marked as React 19 permanently.

**Location**: `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts`

**Keywords**: runtime cache, persistence, electron-store, legacy flag, app restart, runtime detection, migration

---

### [2024-12-15] - Binary Files Corrupted When Using readFile/writeFile for Copying

**Context**: After migrating a project using the migration system, font files weren't loading in the migrated project. Text appeared with default system fonts instead of custom project fonts. All other files (JSON, JS, CSS) worked correctly.

**Discovery**: The `MigrationSession.copyDirectoryRecursive()` method was copying ALL files using:
```typescript
const content = await filesystem.readFile(sourceItemPath);
await filesystem.writeFile(targetItemPath, content);
```

The `filesystem.readFile()` method reads files as UTF-8 text strings. When font files (.ttf, .woff, .woff2, .otf) are read as text:
1. Binary data gets corrupted by UTF-8 encoding
2. Invalid bytes are replaced with � (replacement character)
3. The resulting file is not a valid font
4. Browser's FontLoader fails silently to load the font
5. Text falls back to system fonts

Images (.png, .jpg) would have the same issue. Any binary file copied this way becomes corrupted.

**Fix**: Use `filesystem.copyFile()` which handles binary files correctly:
```typescript
// Before (corrupts binary files):
const content = await filesystem.readFile(sourceItemPath);
await filesystem.writeFile(targetItemPath, content);

// After (preserves binary files):
await filesystem.copyFile(sourceItemPath, targetItemPath);
```

The `copyFile` method in the platform API is specifically designed for copying files while preserving their binary content intact.

**How Fonts Work in Noodl**: Font files are stored in the project directory (e.g., `fonts/MyFont.ttf`). The project.json references them by filename. The FontLoader in the viewer runtime loads them at runtime with `@font-face` CSS. If the font file is corrupted, the load fails silently and system fonts are used.

**Location**: 
- Bug: `packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts` (copyDirectoryRecursive method)
- Font loading: `packages/noodl-viewer-react/src/fontloader.js`

**Keywords**: binary files, font corruption, readFile, writeFile, copyFile, UTF-8, migration, fonts not working, images corrupted, binary data

---

## Preview & Web Server

### [2024-12-15] - Custom Fonts 404 Due to Missing MIME Types

**Context**: Custom fonts (TTF, OTF, WOFF, WOFF2) weren't loading in editor preview. Console showed 404 errors and "OTS parsing error: GDEF: misaligned table" messages. Users thought the dev server wasn't serving project files.

**Discovery**: The web server WAS already serving project directory files correctly (lines 166-172 in web-server.js already handle project path lookups). The real issue was the `getContentType()` function only had MIME types for `.ttf` fonts, not for modern formats:
- `.otf` → Missing
- `.woff` → Missing  
- `.woff2` → Missing

When browsers requested these files, they received them with the default `text/html` content-type. Browsers then tried to parse binary font data as HTML, which fails with confusing OTS parsing errors.

Also found a bug: the `.wav` case was missing a `break;` statement, causing it to fall through to `.mp4`.

**Fix**: Add missing MIME types to the switch statement:
```javascript
case '.otf':
  contentType = 'font/otf';
  break;
case '.woff':
  contentType = 'font/woff';
  break;
case '.woff2':
  contentType = 'font/woff2';
  break;
```

**Key Insight**: The task documentation assumed we needed to add project file serving infrastructure (middleware, protocol handlers, etc.). The architecture was already correct - we just needed proper MIME type mapping. This turned a 4-6 hour task into a 5-minute fix.

**Location**: `packages/noodl-editor/src/main/src/web-server.js` (getContentType function)

**Keywords**: fonts, MIME types, 404, OTS parsing error, web server, preview, TTF, OTF, WOFF, WOFF2, content-type

---

### [2024-12-15] - Legacy Project Fonts Need Fallback Path Resolution

**Context**: After fixing MIME types, new projects loaded fonts correctly but legacy/migrated projects still showed 404 errors for fonts. Investigation revealed font URLs were being requested without folder prefixes.

**Discovery**: OpenNoodl stores font paths in project.json relative to the project root. The FontPicker component (fontpicker.js) generates these paths from `fileEntry.fullPath.substring(ProjectModel.instance._retainedProjectDirectory.length + 1)`:

- If font is at `/project/fonts/Inter.ttf` → stored as `fonts/Inter.ttf`
- If font is at `/project/Inter.ttf` → stored as `Inter.ttf`

Legacy projects may have fonts stored in different locations or with different path conventions. When the viewer requests a font URL like `/Inter.ttf`, the server looks for `{projectDir}/Inter.ttf`, but the font might actually be at `{projectDir}/fonts/Inter.ttf`.

**The Font Loading Chain**:
1. Node parameter stores fontFamily: `"Inter-Regular.ttf"`
2. `node-shared-port-definitions.js` calls `FontLoader.instance.loadFont(family)`
3. `fontloader.js` uses `getAbsoluteUrl(fontURL)` which prepends `Noodl.baseUrl` (usually `/`)
4. Browser requests `GET /Inter-Regular.ttf`
5. Server tries `projectDirectory + /Inter-Regular.ttf`
6. If not found → 404

**Fix**: Added font fallback mechanism in web-server.js that searches common locations when a font isn't found:
```javascript
if (fontExtensions.includes(ext)) {
  const filename = path.split('/').pop();
  const fallbackPaths = [
    info.projectDirectory + '/fonts' + path,           // /fonts/filename.ttf
    info.projectDirectory + '/fonts/' + filename,      // /fonts/filename.ttf
    info.projectDirectory + '/' + filename,            // /filename.ttf (root)
    info.projectDirectory + '/assets/fonts/' + filename // /assets/fonts/filename.ttf
  ];
  
  for (const fallbackPath of fallbackPaths) {
    if (fs.existsSync(fallbackPath)) {
      console.log(`Font fallback: ${path} -> ${fallbackPath}`);
      serveFile(fallbackPath, request, response);
      return;
    }
  }
}
```

**Key Files**:
- `packages/noodl-viewer-react/src/fontloader.js` - Runtime font loading
- `packages/noodl-viewer-react/src/node-shared-port-definitions.js` - Where loadFont is called
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/fontpicker.js` - How font paths are stored
- `packages/noodl-editor/src/main/src/web-server.js` - Server-side font resolution

**Location**: `packages/noodl-editor/src/main/src/web-server.js`

**Keywords**: fonts, legacy projects, fallback paths, font not found, 404, projectDirectory, font resolution, migration

---

## Template for Future Entries

```markdown
### [YYYY-MM-DD] - Brief Title

**Context**: What were you trying to do?

**Discovery**: What did you learn?

**Location**: What files/areas does this apply to?

**Keywords**: [searchable terms]
```
