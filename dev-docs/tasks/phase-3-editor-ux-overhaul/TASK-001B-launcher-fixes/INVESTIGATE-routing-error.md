# Investigation Guide: Dashboard Routing Error

**Issue Reference:** ISSUE-routing-error.md  
**Error:** `ERR_FILE_NOT_FOUND` for `file:///dashboard/projects`  
**Discovered:** 2026-01-07

---

## Quick Summary

The Electron app fails to load the dashboard route with `ERR_FILE_NOT_FOUND`. This investigation guide provides a systematic approach to diagnose and fix the issue.

---

## Step 1: Verify the Error

### Reproduce the Issue

```bash
# Clean everything first
npm run clean:all

# Start dev server
npm run dev

# Observe error in terminal:
# Editor: (node:XXXXX) electron: Failed to load URL: file:///dashboard/projects with error: ERR_FILE_NOT_FOUND
```

### Check Console

1. Open DevTools in Electron app (View → Toggle Developer Tools)
2. Look for errors in Console tab
3. Look for failed network requests in Network tab
4. Note exact error messages and stack traces

---

## Step 2: Understand the Architecture

### Electron Main Process vs Renderer Process

**Main Process** (`packages/noodl-editor/src/main/`):

- Handles window creation
- Registers protocol handlers
- Manages file:// URL loading
- Sets up IPC communication

**Renderer Process** (`packages/noodl-editor/src/editor/`):

- Runs React app
- Handles routing (React Router or similar)
- Communicates with main via IPC

### Current Architecture (Post-TASK-001B)

TASK-001B made these changes:

1. **Electron Store Migration** - Projects stored in Electron's storage
2. **Service Integration** - New `ProjectOrganizationService`
3. **Remove List View** - Simplified launcher UI
4. **Create Project Modal** - New modal-based creation

---

## Step 3: Check Route Configuration

### A. React Router Configuration

**File to check:** `packages/noodl-editor/src/editor/src/router.tsx` (or similar)

```typescript
// Look for route definitions
<Route path="/dashboard/projects" component={ProjectsPage} />

// Check if route was renamed or removed
<Route path="/launcher" component={Launcher} />
<Route path="/projects" component={ProjectsPage} />
```

**What to verify:**

- Does the `/dashboard/projects` route exist?
- Was it renamed to something else?
- Is there a redirect from old to new route?

### B. Electron Protocol Handler

**File to check:** `packages/noodl-editor/src/main/` (main process files)

```typescript
// Look for protocol registration
protocol.registerFileProtocol('file', (request, callback) => {
  const url = request.url.substr(7); // Remove 'file://'
  callback({ path: path.normalize(`${__dirname}/${url}`) });
});
```

**What to verify:**

- Is file:// protocol properly registered?
- Does the path resolution work correctly?
- Are paths correctly normalized?

### C. Window Loading

**File to check:** Main window creation code

```typescript
// Check how the window loads the initial URL
mainWindow.loadURL('file:///' + path.join(__dirname, 'index.html'));

// Or for dev mode
mainWindow.loadURL('http://localhost:3000/dashboard/projects');
```

**What to verify:**

- Is it using file:// or http:// in dev mode?
- Is webpack dev server running on the expected port?
- Is the initial route correct?

---

## Step 4: Compare Before/After TASK-001B

### Files Changed in TASK-001B

Review these files for routing-related changes:

```bash
# Check git history for TASK-001B changes
git log --oneline --grep="TASK-001B" --all

# Or check recent commits
git log --oneline -20

# Compare specific files
git diff <commit-before-001B> <commit-after-001B> packages/noodl-editor/src/editor/src/router.tsx
git diff <commit-before-001B> <commit-after-001B> packages/noodl-editor/src/main/
```

### Key Questions

1. **Was the dashboard route path changed?**

   - From: `/dashboard/projects`
   - To: `/launcher`, `/projects`, or something else?

2. **Was the launcher moved?**

   - Previously: Separate route
   - Now: Modal or embedded component?

3. **Was the initial route changed?**
   - Check where the app navigates on startup

---

## Step 5: Check Webpack Dev Server Configuration

### Development Server Setup

**File to check:** `packages/noodl-editor/webpackconfigs/editor.dev.config.js`

```javascript
devServer: {
  contentBase: path.join(__dirname, '../build'),
  port: 3000,
  historyApiFallback: {
    // Important for SPA routing
    rewrites: [
      { from: /^\/dashboard\/.*/, to: '/index.html' },
    ]
  }
}
```

**What to verify:**

- Is historyApiFallback configured?
- Are the route patterns correct?
- Is the dev server actually running?

### Check if Dev Server is Running

```bash
# While npm run dev is running, check in terminal
# Look for: "webpack-dev-server is listening on port 3000"

# Or check manually
curl http://localhost:3000/dashboard/projects
# Should return HTML, not 404
```

---

## Step 6: Check Electron Build Configuration

### Electron Main Entry Point

**File to check:** `packages/noodl-editor/package.json`

```json
{
  "main": "src/main/index.js",
  "scripts": {
    "dev": "..."
  }
}
```

**What to verify:**

- Is the main entry point correct?
- Does the dev script properly start both webpack-dev-server AND Electron?

### Development Mode Detection

**File to check:** Main process initialization

```typescript
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  mainWindow.loadURL('http://localhost:3000/dashboard/projects');
} else {
  mainWindow.loadURL('file://' + path.join(__dirname, 'index.html'));
}
```

**What to verify:**

- Is dev mode correctly detected?
- Is it trying to load from webpack dev server or file://?
- If using file://, does the file exist?

---

## Step 7: Check Project Storage Changes

### LocalStorage to Electron Store Migration

TASK-001B migrated from localStorage to Electron's storage. Check if this affects routing:

**File to check:** `packages/noodl-editor/src/editor/src/services/ProjectOrganizationService.ts`

```typescript
// Check if service initialization affects routing
export class ProjectOrganizationService {
  constructor() {
    // Does this redirect to a different route?
    // Does this check for existing projects and navigate accordingly?
  }
}
```

**What to verify:**

- Does the service redirect on initialization?
- Is there navigation logic based on stored projects?
- Could empty storage cause a routing error?

---

## Step 8: Test Potential Fixes

### Fix 1: Update Route References

If the route was renamed:

```typescript
// In main process or router
// OLD:
mainWindow.loadURL('http://localhost:3000/dashboard/projects');

// NEW:
mainWindow.loadURL('http://localhost:3000/launcher'); // or '/projects'
```

### Fix 2: Add Route Redirect

If maintaining backward compatibility:

```typescript
// In router.tsx
<Redirect from="/dashboard/projects" to="/launcher" />
```

### Fix 3: Fix Webpack Dev Server

If historyApiFallback is misconfigured:

```javascript
// In webpack config
historyApiFallback: {
  index: '/index.html',
  disableDotRule: true,
  rewrites: [
    { from: /./, to: '/index.html' } // Catch all
  ]
}
```

### Fix 4: Fix Protocol Handler

If file:// protocol is broken:

```typescript
// In main process
protocol.interceptFileProtocol('file', (request, callback) => {
  const url = request.url.substr(7);
  callback({ path: path.normalize(`${__dirname}/${url}`) });
});
```

---

## Step 9: Verify the Fix

After applying a fix:

```bash
# Clean and restart
npm run clean:all
npm run dev

# Verify:
# 1. No errors in terminal
# 2. Dashboard/launcher loads correctly
# 3. DevTools console has no errors
# 4. Can create/open projects
```

### Test Cases

1. ✅ App launches without errors
2. ✅ Dashboard/projects list appears
3. ✅ Can create new project
4. ✅ Can open existing project
5. ✅ Navigation between routes works
6. ✅ Reload (Cmd+R / Ctrl+R) doesn't break routing

---

## Step 10: Document the Solution

Once fixed, update:

1. **ISSUE-routing-error.md** - Add resolution section
2. **CHANGELOG** - Document what was changed
3. **LEARNINGS.md** - Add entry if it's a gotcha others might hit

### Example Resolution Entry

```markdown
## Resolution (2026-01-XX)

**Root Cause**: The route was renamed from `/dashboard/projects` to `/launcher` in TASK-001B but the Electron main process was still trying to load the old route.

**Fix Applied**: Updated main process to load `/launcher` instead of `/dashboard/projects`.

**Files Modified**:

- `packages/noodl-editor/src/main/index.js` (line 42)

**Verification**: App now loads correctly in dev mode.
```

---

## Common Scenarios & Solutions

### Scenario 1: Route was Renamed

**Symptoms:**

- Error: `ERR_FILE_NOT_FOUND`
- Old route reference in main process

**Solution:**

- Find where the route is loaded in main process
- Update to new route name
- Add redirect for backward compatibility

### Scenario 2: Dev Server Not Running

**Symptoms:**

- Error: `ERR_CONNECTION_REFUSED` or `ERR_FILE_NOT_FOUND`
- Port 3000 not responding

**Solution:**

- Check if `npm run dev` starts webpack-dev-server
- Check package.json scripts
- Verify port isn't already in use

### Scenario 3: Webpack Config Issue

**Symptoms:**

- 404 on route navigation
- Dev server runs but routes return 404

**Solution:**

- Add/fix historyApiFallback in webpack config
- Ensure all SPA routes fall back to index.html

### Scenario 4: Electron Protocol Handler Broken

**Symptoms:**

- Production build also fails
- File:// URLs don't resolve

**Solution:**

- Review protocol handler registration
- Check path normalization logic
- Verify \_\_dirname points to correct location

---

## Additional Resources

- Electron Protocol Documentation: https://www.electronjs.org/docs/latest/api/protocol
- Webpack DevServer: https://webpack.js.org/configuration/dev-server/
- React Router: https://reactrouter.com/

---

## Quick Debugging Checklist

- [ ] Reproduced the error
- [ ] Checked console for additional errors
- [ ] Verified route exists in router configuration
- [ ] Checked if route was renamed in TASK-001B
- [ ] Verified webpack dev server is running
- [ ] Checked main process window.loadURL call
- [ ] Reviewed historyApiFallback configuration
- [ ] Tested with clean build
- [ ] Verified fix works after reload
- [ ] Documented the solution

---

**Remember**: The goal is to understand WHY the route fails, not just make it work. Document your findings for future reference.
