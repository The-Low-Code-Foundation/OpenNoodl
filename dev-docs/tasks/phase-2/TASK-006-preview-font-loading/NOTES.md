# TASK-006 Working Notes

## Research

### Development Server Architecture

**Question**: Where is `localhost:8574` configured and what serves it?

**Findings**:
- ✅ Located: `packages/noodl-editor/src/main/src/web-server.js`
- Port 8574 defined in config files: `src/shared/config/config-dev.js`, `config-dist.js`, `config-test.js`
- Server type: **Node.js HTTP/HTTPS server** (not webpack-dev-server)
- Main process at `packages/noodl-editor/src/main/main.js` starts the server with `startServer()`

**Dev Server Type**:
- [ ] webpack-dev-server
- [ ] Electron static file handler
- [ ] Express server
- [x] Other: **Node.js HTTP Server (custom)**

### Project Path Management

**Question**: How does the editor track which project is currently open?

**Findings**:
- ✅ Project path accessed via `projectGetInfo()` callback in main process
- Located at: `packages/noodl-editor/src/main/main.js`
- Path retrieved from renderer process via IPC: `makeEditorAPIRequest('projectGetInfo', undefined, callback)`
- Updated automatically on each request - no caching needed
- Always returns current project directory

### Current Asset Handling

**What Works**:
- Fonts load correctly in deployed apps
- Font loader logic is sound (`fontloader.js`)
- @font-face CSS generation works

**What Doesn't Work**:
- Preview cannot access project directory files
- `http://localhost:8574/fonts/file.ttf` → 404
- Browser receives HTML error page instead of font binary

### Existing Patterns Found

**Similar Asset Serving**:
- (Search codebase for similar patterns)
- Check how viewer bundles are served
- Check how static assets are currently handled

---

## Architecture Decisions

### Approach Selection

**Option A: Static Middleware**
- Pros: 
- Cons: 
- Feasibility: ⭐⭐⭐ (1-5 stars)

**Option B: Custom Protocol**
- Pros: 
- Cons: 
- Feasibility: ⭐⭐⭐ (1-5 stars)

**Option C: Copy to Temp**
- Pros: 
- Cons: 
- Feasibility: ⭐⭐⭐ (1-5 stars)

**Decision**: Going with Option ___ because:
- Reason 1
- Reason 2
- Reason 3

### Implementation Details

**Path Resolution Strategy**:
```
Request: http://localhost:8574/fonts/Inter-Regular.ttf
↓
Extract: /fonts/Inter-Regular.ttf
↓
Combine: currentProjectPath + /fonts/Inter-Regular.ttf
↓
Serve: /absolute/path/to/project/fonts/Inter-Regular.ttf
```

**Security Measures**:
- Path sanitization method: ...
- Directory traversal prevention: ...
- Allowed file types: fonts, images, (others?)
- Blocked paths: ...

**MIME Type Configuration**:
```javascript
const mimeTypes = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};
```

---

## Implementation Notes

### Code Locations Identified

| File | Purpose | Changes Needed |
|------|---------|----------------|
| (to be filled in) | | |

### Gotchas / Surprises

- (Document unexpected discoveries)

### Useful Commands

```bash
# Find where port 8574 is configured
grep -r "8574" packages/noodl-editor/

# Find project path references
grep -r "projectPath\|ProjectPath" packages/noodl-editor/src/

# Find dev server setup
find packages/noodl-editor -name "*dev*.js" -o -name "*server*.ts"

# Check what's currently served
curl -I http://localhost:8574/fonts/test.ttf
```

---

## Testing Notes

### Test Project Setup

**Project Name**: font-test-project
**Location**: (path to test project)
**Fonts Used**:
- Inter-Regular.ttf (254 KB)
- (others as needed)

### Test Results

#### Test 1: Basic Font Loading
- **Date**: 
- **Setup**: Single TTF font, one Text node
- **Result**: ✅ Pass / ❌ Fail
- **Notes**: 

#### Test 2: Multiple Formats
- **Date**: 
- **Setup**: TTF, OTF, WOFF, WOFF2
- **Result**: ✅ Pass / ❌ Fail
- **Notes**: 

#### Test 3: Project Switching
- **Date**: 
- **Setup**: Project A (Font X), Project B (Font Y)
- **Result**: ✅ Pass / ❌ Fail
- **Notes**: 

#### Test 4: Security (Directory Traversal)
- **Date**: 
- **Attempt**: `http://localhost:8574/fonts/../../secret.txt`
- **Result**: ✅ Blocked / ❌ Exposed
- **Notes**: 

### Console Errors Before Fix

```
GET http://localhost:8574/fonts/Inter-Regular.ttf 404 (Not Found)
OTS parsing error: GDEF: misaligned table
```

### Console After Fix

```
(Document whether errors are resolved)
```

---

## Debug Log

### [Date/Time] - Investigation Start

**Trying**: Locate dev server configuration
**Found**: 
**Next**: 

### [Date/Time] - Dev Server Located

**Trying**: Understand server architecture
**Found**: 
**Next**: 

### [Date/Time] - Implementation Start

**Trying**: Add middleware for project assets
**Code**: (paste relevant code snippets)
**Result**: 
**Next**: 

### [Date/Time] - First Test

**Trying**: Load font in preview
**Result**: 
**Issues**: 
**Next**: 

---

## Questions & Decisions

### Question: Should we serve all file types or limit to specific extensions?

**Options**:
1. Serve everything in project directory
2. Whitelist specific extensions (fonts, images)
3. Blacklist dangerous file types

**Decision**: (Document decision and reasoning)

### Question: How to handle project switching?

**Options**:
1. Update middleware path dynamically
2. Restart dev server with new path
3. Path lookup on each request

**Decision**: (Document decision and reasoning)

### Question: Where should error handling live?

**Options**:
1. In middleware (return proper 404)
2. In Electron main process
3. Both

**Decision**: (Document decision and reasoning)

---

## Performance Considerations

### Measurements

**Before Changes**:
- Project load time: ___ ms
- First font render: ___ ms
- Memory usage: ___ MB

**After Changes**:
- Project load time: ___ ms (Δ ___)
- First font render: ___ ms (Δ ___)
- Memory usage: ___ MB (Δ ___)

### Optimization Ideas

- Caching strategy for frequently accessed fonts?
- Pre-load fonts on project open?
- Lazy load only when needed?

---

## References & Resources

### Relevant Documentation
- [webpack-dev-server middleware](https://webpack.js.org/configuration/dev-server/#devserversetupmiddlewares)
- [Electron protocol API](https://www.electronjs.org/docs/latest/api/protocol)
- [Node.js MIME types](https://nodejs.org/api/http.html#http_http_methods)

### Similar Issues
- (Link to any similar problems found in codebase)

### Code Examples
- (Link to relevant code patterns found elsewhere)

---

## Final Checklist

Before marking task complete:

- [ ] All test scenarios pass
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Cross-platform tested (if possible)
- [ ] Code documented
- [ ] CHANGELOG.md updated
- [ ] LEARNINGS.md updated (if applicable)
