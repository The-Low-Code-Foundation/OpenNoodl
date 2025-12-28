# TASK-006: Fix Custom Font Loading in Editor Preview

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-006 |
| **Phase** | Phase 2 |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 4-6 hours |
| **Prerequisites** | None |
| **Branch** | `fix/preview-font-loading` |

## Objective

Enable custom fonts (TTF, OTF, WOFF, etc.) to load correctly in the editor preview window by configuring the development server to serve project directory assets.

## Background

OpenNoodl allows users to add custom fonts to their projects via the Assets panel. These fonts are stored in the project directory (e.g., `fonts/Inter-Regular.ttf`) and loaded at runtime using `@font-face` declarations and the WebFontLoader library.

This works correctly in deployed applications, but **fails completely in the editor preview** due to an architectural limitation: the preview loads from `http://localhost:8574` (the development server), but this server doesn't serve files from project directories. When the font loader attempts to load fonts, it gets 404 errors, causing fonts to fall back to system defaults.

This was discovered during React 18/19 testing and affects **all projects** (not just migrated ones). Users see console errors and fonts don't render as designed in the preview.

## Current State

### How Font Loading Works

1. **Asset Registration**: Users add font files via Assets panel → stored in `project/fonts/`
2. **Font Node Configuration**: Text nodes reference fonts by name
3. **Runtime Loading**: `packages/noodl-viewer-react/src/fontloader.js` generates `@font-face` CSS rules
4. **URL Construction**: Font URLs are built as `Noodl.Env["BaseUrl"] + fontPath`
   - In preview: `http://localhost:8574/fonts/Inter-Regular.ttf`
   - In deployed: `https://myapp.com/fonts/Inter-Regular.ttf`

### The Problem

**Preview Setup**:
- Preview webview loads from: `http://localhost:8574`
- Development server serves: Editor bundles and viewer runtime files
- Development server **does NOT serve**: Project directory contents

**Result**:
```
GET http://localhost:8574/fonts/Inter-Regular.ttf → 404 Not Found
Browser receives HTML error page instead of font file
Console error: "OTS parsing error: GDEF: misaligned table" (HTML parsed as font)
Font falls back to system default
```

### Console Errors Observed

```
Failed to load resource: the server responded with a status of 404 (Not Found)
http://localhost:8574/fonts/Inter-Regular.ttf

OTS parsing error: GDEF: misaligned table
```

### Files Involved

| File | Role |
|------|------|
| `packages/noodl-viewer-react/src/fontloader.js` | Font loading logic (✅ working correctly) |
| `packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts` | Sets up preview webview |
| `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js` | Dev server configuration |
| Development server (webpack-dev-server or equivalent) | Needs to serve project assets |

## Desired State

Custom fonts load correctly in the editor preview with no 404 errors:

1. Development server serves project directory assets
2. Font requests succeed: `GET http://localhost:8574/fonts/Inter-Regular.ttf → 200 OK`
3. Fonts render correctly in preview
4. No console errors related to font loading

## Scope

### In Scope
- [ ] Configure development server to serve project directory files
- [ ] Test font loading with TTF, OTF, WOFF, WOFF2 formats
- [ ] Verify images and other project assets also work
- [ ] Handle project switching (different project directories)
- [ ] Document the asset serving mechanism

### Out of Scope
- Font loading in deployed applications (already works)
- Font management UI improvements
- Font optimization or conversion
- Fallback font improvements

## Technical Approach

### Investigation Required

1. **Identify the Development Server**
   - Locate where `localhost:8574` server is configured
   - Determine if it's webpack-dev-server, Electron's static server, or custom
   - Check `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`

2. **Understand Project Path Management**
   - How does the editor know which project is currently open?
   - Where is the project path stored/accessible?
   - How does this update when switching projects?

3. **Research Asset Serving Strategies**

### Possible Approaches

#### Option A: Static Middleware (Preferred)
Add webpack-dev-server middleware or Electron protocol handler to serve project directories:

```javascript
// Pseudocode
devServer: {
  setupMiddlewares: (middlewares, devServer) => {
    middlewares.unshift({
      name: 'project-assets',
      path: '/',
      middleware: (req, res, next) => {
        if (req.url.startsWith('/fonts/') || req.url.startsWith('/images/')) {
          const projectPath = getCurrentProjectPath();
          const filePath = path.join(projectPath, req.url);
          if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
          }
        }
        next();
      }
    });
    return middlewares;
  }
}
```

**Pros**: Clean, secure, standard web dev pattern
**Cons**: Requires project path awareness in dev server

#### Option B: Custom Electron Protocol
Register a custom protocol (e.g., `noodl-project://`) to serve project files:

```javascript
protocol.registerFileProtocol('noodl-project', (request, callback) => {
  const url = request.url.replace('noodl-project://', '');
  const projectPath = getCurrentProjectPath();
  const filePath = path.join(projectPath, url);
  callback({ path: filePath });
});
```

**Pros**: Electron-native, works outside dev server
**Cons**: Requires changes to fontloader URL construction

#### Option C: Copy Assets to Served Directory
Copy project assets to a temporary directory that the dev server serves:

**Pros**: Simple, no server changes needed
**Cons**: File sync complexity, disk I/O overhead, changes required on project switch

### Recommended Approach

**Start with Option A** (Static Middleware) because:
- Most maintainable long-term
- Standard webpack pattern
- Works for all asset types (fonts, images, etc.)
- No changes to viewer runtime code

If Option A proves difficult due to project path management, fallback to Option B.

## Implementation Steps

### Step 1: Locate and Understand Dev Server Setup
- Find where `localhost:8574` is configured
- Review `packages/noodl-editor/src/main/` for Electron main process
- Check webpack dev configs in `packages/noodl-editor/webpackconfigs/`
- Identify how viewer is bundled and served

### Step 2: Add Project Path Management
- Find how current project path is tracked (likely in `ProjectModel`)
- Ensure main process has access to current project path
- Set up IPC communication if needed (renderer → main process)

### Step 3: Implement Asset Serving
- Add middleware/protocol handler for project assets
- Configure MIME types for fonts (.ttf, .otf, .woff, .woff2)
- Add security checks (prevent directory traversal)
- Handle project switching (update served path)

### Step 4: Test Asset Loading
- Create test project with custom fonts
- Verify fonts load in preview
- Test project switching
- Test with different font formats
- Test images and other assets

### Step 5: Error Handling
- Handle missing files gracefully (404, not HTML error page)
- Log helpful errors for debugging
- Ensure no security vulnerabilities

## Testing Plan

### Manual Testing Scenarios

#### Scenario 1: Custom Font in New Project
1. Create new React 19 project
2. Add custom font via Assets panel (e.g., Inter-Regular.ttf)
3. Create Text node, assign custom font
4. Open preview
5. ✅ Font should render correctly
6. ✅ No console errors

#### Scenario 2: Project with Multiple Fonts
1. Open test project with multiple font files
2. Text nodes using different fonts
3. Open preview
4. ✅ All fonts render correctly
5. ✅ No 404 errors in console

#### Scenario 3: Project Switching
1. Open Project A with Font X
2. Verify Font X loads in preview
3. Close project, open Project B with Font Y
4. ✅ Font Y loads (not Font X)
5. ✅ No stale asset serving

#### Scenario 4: Missing Font File
1. Project references font that doesn't exist
2. Open preview
3. ✅ Graceful fallback to system font
4. ✅ Clear error message (not HTML 404 page)

#### Scenario 5: Different Font Formats
Test with:
- [x] .ttf (TrueType)
- [ ] .otf (OpenType)
- [ ] .woff (Web Open Font Format)
- [ ] .woff2 (Web Open Font Format 2)

#### Scenario 6: Other Assets
Verify images also load correctly:
- [ ] PNG images in preview
- [ ] SVG images in preview

### Regression Testing
- [ ] Fonts still work in deployed projects (don't break existing behavior)
- [ ] Editor performance not degraded
- [ ] Project loading time not significantly impacted

## Success Criteria

- [ ] Custom fonts load without 404 errors in editor preview
- [ ] Console shows no "OTS parsing error" messages
- [ ] Fonts render correctly in preview (match design)
- [ ] Works for all common font formats (TTF, OTF, WOFF, WOFF2)
- [ ] Project switching updates served assets correctly
- [ ] No security vulnerabilities (directory traversal, etc.)
- [ ] Documentation updated with asset serving architecture
- [ ] Changes documented in CHANGELOG.md

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Security**: Directory traversal attacks | Implement path sanitization, restrict to project dir only |
| **Performance**: Asset serving slows editor | Use efficient file serving, consider caching |
| **Complexity**: Project path management is difficult | Start with simpler Option B (custom protocol) if needed |
| **Breaks deployed apps**: Changes affect production | Only modify dev server, not viewer runtime |
| **Cross-platform**: Path handling differs on Windows/Mac/Linux | Use `path.join()`, test on multiple platforms |

## Rollback Plan

All changes should be isolated to development server configuration. If issues arise:

1. Revert webpack config changes
2. Revert any protocol handler registration
3. Editor continues to work, fonts just won't show in preview (existing behavior)
4. Deployed apps unaffected

## References

### Code Locations
- Font loader: `packages/noodl-viewer-react/src/fontloader.js`
- Preview setup: `packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts`
- Webpack config: `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`
- Main process: `packages/noodl-editor/src/main/`

### Related Issues
- Discovered during TASK-003 (React 19 Runtime Migration)
- Related to TASK-004 runtime bug fixes
- Affects preview functionality across all projects

### Technical Resources
- [webpack-dev-server middleware docs](https://webpack.js.org/configuration/dev-server/#devserversetupmiddlewares)
- [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol)
- [WebFontLoader library](https://github.com/typekit/webfontloader)
- [@font-face CSS spec](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face)
