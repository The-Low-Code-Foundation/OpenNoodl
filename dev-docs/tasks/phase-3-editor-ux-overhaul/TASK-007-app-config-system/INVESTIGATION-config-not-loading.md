# Investigation: Noodl.Config Not Loading Variables

**Date**: January 8, 2026  
**Status**: 🔴 BLOCKED  
**Priority**: High - Core feature broken

## Summary

Custom config variables defined in App Setup → Variables section are NOT appearing in `Noodl.Config` at runtime, despite being correctly stored in project metadata.

---

## What's Working ✅

1. **Editor UI** - Variables section in App Setup panel:

   - Add new variables with name, type, value, description
   - Delete individual variables (red X button)
   - Clear all variables (Clear All button)
   - JSON editor for array/object types

2. **Data Storage** - Variables ARE saved to project metadata:

   ```javascript
   Noodl.getMetaData('appConfig');
   // Returns: {identity: {...}, seo: {...}, variables: Array(4), pwa: {...}}
   // variables array contains the correct data
   ```

3. **Identity/SEO/PWA** - These DO appear in `Noodl.Config`:
   ```javascript
   Noodl.Config.appName; // "My Noodl App" ✅
   Noodl.Config.pwaEnabled; // false ✅
   ```

---

## What's NOT Working ❌

1. **Custom variables** don't appear in `Noodl.Config`:

   ```javascript
   Noodl.Config.myVariable; // undefined ❌
   // Console shows: "Noodl.Config.myVariable is not defined"
   ```

2. **Variables persist incorrectly**:
   - Old variables keep reappearing after restart
   - New variables don't persist across sessions
   - Clear all doesn't fully work

---

## Root Cause Analysis

### Primary Issue: Timing Problem

`createNoodlAPI()` is called BEFORE project metadata is loaded.

**Evidence from debug logs:**

```
[DEBUG] noodl-js-api: appConfig from metadata: undefined
[DEBUG] createConfigAPI called with: undefined
```

But LATER, when you manually call:

```javascript
Noodl.getMetaData('appConfig'); // Returns full data including variables
```

The metadata IS there - it just wasn't available when `Noodl.Config` was created.

### Secondary Issue: Webpack Cache

Even after fixing the code, old versions continue running:

- Source code shows no debug logs
- Console still shows debug logs
- Suggests webpack is serving cached bundles

### Tertiary Issue: Editor Save Problem

Variables don't persist correctly:

- Old variables keep coming back
- New variables don't save
- Likely issue in `ProjectModel.setMetaData()` or undo/redo integration

---

## Attempted Fixes

### Fix 1: Lazy Evaluation via getMetaData Function

**Approach**: Pass `Noodl.getMetaData` function to `createConfigAPI()` instead of the config value, so it reads metadata on every property access.

**Files Changed**:

- `packages/noodl-viewer-react/src/api/config.ts`
- `packages/noodl-viewer-react/src/noodl-js-api.js`

**Code**:

```typescript
// config.ts - Now reads lazily
export function createConfigAPI(getMetaData: (key: string) => unknown) {
  const getConfig = () => {
    const appConfig = getMetaData('appConfig');
    return buildFlatConfig(appConfig);
  };

  return new Proxy(
    {},
    {
      get(_target, prop) {
        const config = getConfig();
        return config[prop];
      }
    }
  );
}

// noodl-js-api.js
global.Noodl.Config = createConfigAPI(global.Noodl.getMetaData);
```

**Result**: FIX NOT TAKING EFFECT - likely webpack cache or bundling issue

### Fix 2: Cleaned Up Debug Logs

Removed all debug console.log statements from source files.

**Result**: Debug logs STILL appearing in console, confirming old code is running.

---

## Research Needed

### 1. Viewer Webpack Build Pipeline

**Question**: How does the viewer bundle get built and served to the preview iframe?

**Files to investigate**:

- `packages/noodl-viewer-react/webpack-configs/`
- How does editor serve the viewer to preview?
- Is there a separate viewer build process?

**Hypothesis**: The viewer might be built separately and not hot-reloaded.

### 2. Metadata Loading Timing

**Question**: When exactly is `noodlRuntime.getMetaData()` populated?

**Files to investigate**:

- `packages/noodl-runtime/src/` - Where is metadata set?
- How does project data flow from editor to runtime?
- Is there an event when metadata is ready?

### 3. Editor-to-Viewer Communication

**Question**: How does the editor send appConfig to the viewer?

**Files to investigate**:

- `ViewerConnection` class
- How metadata gets to the preview iframe
- Is there a specific message type for metadata?

### 4. Variable Persistence

**Question**: Why do old variables keep coming back?

**Files to investigate**:

- `ProjectModel.setMetaData()` implementation
- Undo queue integration for appConfig
- Where is project.json being read from?

---

## Potential Solutions

### Solution A: Initialize Config Later

Wait for metadata before creating `Noodl.Config`:

```javascript
// In viewer initialization
noodlRuntime.on('metadataReady', () => {
  global.Noodl.Config = createConfigAPI(appConfig);
});
```

**Risk**: May break code that accesses Config early.

### Solution B: Truly Lazy Proxy (Current Attempt)

The fix is already implemented but not taking effect. Need to:

1. Force full rebuild of viewer bundle
2. Clear ALL caches
3. Verify new code is actually running

### Solution C: Rebuild Viewer Separately

```bash
# Build viewer fresh
cd packages/noodl-viewer-react
npm run build
```

Then restart editor.

### Solution D: Different Architecture

Instead of passing config at initialization, have `Noodl.Config` always read from a global that gets updated:

```javascript
// Set globally when metadata loads
window.__NOODL_APP_CONFIG__ = appConfig;

// Config reads from it
get(target, prop) {
  return window.__NOODL_APP_CONFIG__?.[prop];
}
```

---

## Environment Notes

### Webpack Cache Locations

```bash
# Known cache directories to clear
rm -rf node_modules/.cache
rm -rf packages/noodl-viewer-react/.cache
rm -rf packages/noodl-editor/dist
rm -rf packages/noodl-viewer-react/dist
```

### Process Cleanup

```bash
# Kill lingering processes
pkill -f webpack
pkill -f Electron
pkill -f node
```

### Full Clean Command

```bash
npm run clean:all
# Then restart fresh
npm run dev
```

---

## Files Modified (Current State)

All source files are correct but not taking effect:

| File                                              | Status | Contains Fix       |
| ------------------------------------------------- | ------ | ------------------ |
| `packages/noodl-viewer-react/src/api/config.ts`   | ✅     | Lazy getMetaData   |
| `packages/noodl-viewer-react/src/noodl-js-api.js` | ✅     | Passes getMetaData |
| `packages/noodl-runtime/src/config/types.ts`      | ✅     | Type definitions   |

---

## Next Steps

1. **Investigate viewer build** - Find how viewer bundle is created and served
2. **Force viewer rebuild** - May need manual build of noodl-viewer-react
3. **Add build canary** - Unique console.log to verify new code is running
4. **Trace metadata flow** - Find exactly when/where metadata becomes available
5. **Fix persistence** - Investigate why variables don't save correctly

---

## Related Files

- `packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/VariablesSection.tsx`
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts`
- `packages/noodl-runtime/src/config/config-manager.ts`
- `packages/noodl-viewer-react/src/api/config.ts`
- `packages/noodl-viewer-react/src/noodl-js-api.js`

---

## Contact

This investigation was conducted as part of Phase 3 Task 7 (App Config System).
