# Multi-Project Support Scoping Document

## Executive Summary

This document scopes the feature request to enable OpenNoodl to have multiple projects open simultaneously. Two approaches are analyzed: multi-project within a single Electron app, and multiple Electron app instances.

**Recommendation:** Start with **Option B (Multiple Electron Instances)** as Phase 1 due to significantly lower complexity and risk. Consider Option A as a future enhancement if user demand warrants the investment.

---

## Current Architecture Analysis

### Key Findings

The codebase has several architectural patterns that make multi-project support challenging:

#### 1. Singleton Pattern Throughout

```typescript
// ProjectModel is a strict singleton
public static get instance() {
  return ProjectModel._instance;
}
public static set instance(project: ProjectModel | undefined) {
  // Only one project at a time...
}
```

This pattern is referenced extensively across the codebase:
- `ProjectModel.instance` - Core project data
- `NodeLibrary.instance` - Node definitions (registers/unregisters per project)
- `CloudService.instance` - Cloud backend per project
- `ViewerConnection.instance` - Single preview connection
- `SidebarModel.instance`, `UndoQueue.instance`, etc.

#### 2. Router Enforces Single Project

The router explicitly disposes the old project when switching:

```typescript
route(args: AppRouteOptions) {
  if (ProjectModel.instance && ProjectModel.instance !== args.project) {
    ProjectModel.instance.dispose();
    // ...
    ProjectModel.instance = undefined;
  }
}
```

#### 3. IPC Assumes Single Project

Main process IPC events like `project-opened` and `project-closed` assume one active project:

```javascript
ipcMain.on('project-opened', (e, newProjectName) => {
  projectName = newProjectName;  // Single name tracked
  // ...
});
```

#### 4. Viewer Window is Tightly Coupled

The viewer window is a child of the main window with direct IPC communication assuming a single project context.

---

## Option A: Multi-Project Within Single Electron App

### Description

Transform the architecture to support multiple projects open as tabs or panels within a single application window.

### Required Changes

#### Phase A1: Core Architecture Refactoring

| Component | Current State | Required Change | Complexity |
|-----------|--------------|-----------------|------------|
| `ProjectModel` | Singleton | Registry with active project tracking | 🔴 High |
| `NodeLibrary` | Singleton with project registration | Per-project library instances | 🔴 High |
| `EventDispatcher` | Global events | Project-scoped events | 🟡 Medium |
| `UndoQueue` | Singleton | Per-project undo stacks | 🟡 Medium |
| `Router` | Single route | Multi-route or tab system | 🔴 High |
| `ViewerConnection` | Single connection | Connection pool by project | 🟡 Medium |

#### Phase A2: UI/UX Development

- Tab bar or project switcher component
- Visual indicators for active project
- Window management (detach projects to separate windows)
- Cross-project drag & drop considerations

#### Phase A3: Resource Management

- Memory management for multiple loaded projects
- Preview server port allocation per project
- Cloud service connection pooling
- File watcher consolidation

### Effort Estimate

| Phase | Estimated Time | Risk Level |
|-------|---------------|------------|
| A1: Core Architecture | 8-12 weeks | 🔴 High |
| A2: UI/UX | 3-4 weeks | 🟡 Medium |
| A3: Resource Management | 2-3 weeks | 🟡 Medium |
| Testing & Stabilization | 3-4 weeks | 🔴 High |
| **Total** | **16-23 weeks** | **High** |

### Risks

1. **Regression Risk**: Touching ProjectModel singleton affects nearly every feature
2. **Memory Pressure**: Multiple full projects in RAM
3. **State Isolation**: Ensuring complete isolation between projects
4. **Performance**: Managing multiple preview servers
5. **Complexity Explosion**: Every new feature must consider multi-project context

### Benefits

- Single dock icon / application instance
- Potential for cross-project features (copy/paste between projects)
- Professional multi-document interface
- Shared resources (single node library load)

---

## Option B: Multiple Electron App Instances

### Description

Allow multiple independent Electron app instances, each with its own project. Minimal code changes required.

### Required Changes

#### Phase B1: Enable Multi-Instance

```javascript
// Current: Single instance lock (likely present)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

// Change to: Allow multiple instances
// Simply remove or conditionally bypass the single-instance lock
```

#### Phase B2: Instance Isolation

| Component | Change Required | Complexity |
|-----------|----------------|------------|
| Single-instance lock | Remove or make conditional | 🟢 Low |
| Preview server ports | Dynamic port allocation | 🟢 Low |
| UDP broadcast | Include instance ID | 🟢 Low |
| Window bounds storage | Per-project storage key | 🟢 Low |
| Design tool import server | Instance-aware | 🟡 Medium |

#### Phase B3: UX Polish (Optional)

- Menu item: "Open Project in New Window"
- Keyboard shortcut support
- Recent projects list per instance awareness

### Implementation Details

**Port Allocation:**
```javascript
// Instead of fixed port:
// const port = Config.PreviewServer.port;

// Use dynamic allocation:
const server = net.createServer();
server.listen(0);  // OS assigns available port
const port = server.address().port;
```

**Window Bounds:**
```javascript
// Key by project directory or ID
const boundsKey = `windowBounds_${projectId}`;
jsonstorage.get(boundsKey, (bounds) => { /* ... */ });
```

### Effort Estimate

| Phase | Estimated Time | Risk Level |
|-------|---------------|------------|
| B1: Multi-Instance | 1-2 days | 🟢 Low |
| B2: Instance Isolation | 3-5 days | 🟢 Low |
| B3: UX Polish | 3-5 days | 🟢 Low |
| Testing | 2-3 days | 🟢 Low |
| **Total** | **2-3 weeks** | **Low** |

### Risks

1. **Multiple dock icons**: May confuse some users
2. **Memory duplication**: Each instance loads full editor
3. **No cross-project features**: Can't drag nodes between projects
4. **OS Integration**: May complicate app bundling/signing

### Benefits

- Minimal code changes
- Complete isolation (no state bleed)
- Each project has dedicated resources
- Can close one project without affecting others
- Already supported pattern in many apps (VS Code, terminal apps)

---

## Comparison Matrix

| Criteria | Option A (Single App) | Option B (Multi-Instance) |
|----------|----------------------|---------------------------|
| Development Time | 16-23 weeks | 2-3 weeks |
| Risk Level | 🔴 High | 🟢 Low |
| Code Changes | Extensive refactoring | Minimal, isolated changes |
| Memory Usage | Shared (more efficient) | Duplicated (less efficient) |
| UX Polish | Professional tabbed interface | Multiple windows/dock icons |
| Cross-Project Features | Possible | Not possible |
| Isolation | Requires careful engineering | Automatic |
| Maintenance Burden | Higher (ongoing complexity) | Lower |

---

## Recommendation

### Phase 1: Multiple Electron Instances (Option B)
**Timeline: 2-3 weeks**

Start here because:
- Low risk, high value
- Validates user need before major investment
- Can ship quickly and gather feedback
- Doesn't block future Option A work

### Phase 2 (Future): Evaluate Single-App Approach
**Timeline: After 6+ months of Phase 1 feedback**

Consider Option A if:
- Users strongly request tabbed interface
- Cross-project features become a priority
- Memory usage becomes a significant concern
- User feedback indicates multiple windows is problematic

---

## Implementation Plan for Option B

### Week 1: Core Multi-Instance Support

**Day 1-2: Single Instance Lock**
- [ ] Locate and understand current single-instance handling
- [ ] Add configuration flag `allowMultipleInstances`
- [ ] Test launching multiple instances manually

**Day 3-4: Port Allocation**
- [ ] Modify preview server to use dynamic ports
- [ ] Update ViewerConnection to handle dynamic ports
- [ ] Test multiple instances with different projects

**Day 5: Basic Testing**
- [ ] Test simultaneous editing of different projects
- [ ] Verify no state leakage between instances
- [ ] Check cloud service isolation

### Week 2: Polish & Edge Cases

**Day 1-2: Storage Isolation**
- [ ] Key window bounds by project ID/path
- [ ] Handle recent projects list updates
- [ ] UDP broadcast instance differentiation

**Day 3-4: UX Improvements**
- [ ] Add "Open in New Window" to project context menu
- [ ] Keyboard shortcut for opening new instance
- [ ] Window title includes project name prominently

**Day 5: Documentation & Testing**
- [ ] Update user documentation
- [ ] Edge case testing (same project in two instances)
- [ ] Memory and performance profiling

### Week 3: Buffer & Release

- [ ] Bug fixes from testing
- [ ] Final QA pass
- [ ] Release notes preparation
- [ ] User feedback collection setup

---

## Files to Modify (Option B)

### Critical Path
1. `packages/noodl-editor/src/main/main.js` - Single instance lock, port config
2. `packages/noodl-editor/src/main/src/preview-server.js` (or equivalent) - Dynamic ports

### Supporting Changes
3. `packages/noodl-editor/src/main/src/StorageApi.js` - Keyed storage
4. `packages/noodl-editor/src/editor/src/pages/ProjectsPage/` - "Open in New Window" option
5. UDP multicast function in main.js - Instance awareness

---

## Open Questions

1. **Same project in multiple instances?** 
   - Recommend: Block with friendly message, or warn about conflicts
   
2. **Instance limit?**
   - Recommend: No hard limit initially, monitor memory usage

3. **macOS app icon behavior?**
   - Each instance shows in dock; standard behavior for multi-window apps

4. **File locking?**
   - Noodl already handles project.json locking - verify behavior with multiple instances

---

## Appendix: Code Snippets

### Current Single-Instance Pattern (Likely)
```javascript
// main.js - probable current implementation
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Focus existing window when second instance attempted
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}
```

### Proposed Multi-Instance Support
```javascript
// main.js - proposed modification
const allowMultipleInstances = true; // Could be a setting

if (!allowMultipleInstances) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// Rest of initialization continues for each instance...
```

### Dynamic Port Allocation
```javascript
const net = require('net');

function findAvailablePort(startPort = 8574) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port in use, try next
      resolve(findAvailablePort(startPort + 1));
    });
  });
}
```
