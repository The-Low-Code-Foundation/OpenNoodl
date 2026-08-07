# PREREQ-001: Fix Webpack 5 Persistent Caching

## Overview

**Priority:** 🔴 CRITICAL - Blocks ALL development  
**Estimate:** 1-2 days  
**Status:** Not started

---

## The Problem

Webpack 5 persistent caching is preventing code changes from loading during development. When you modify a file, the old cached version continues to be served instead of the new code.

This was discovered during the ComponentsPanel React migration (TASK-004B) and is documented in:
`dev-docs/tasks/phase-2/TASK-004B-componentsPanel-react-migration/STATUS-BLOCKED.md`

### Symptoms

1. You modify a TypeScript/JavaScript file
2. You rebuild or let hot reload trigger
3. The browser shows the OLD code, not your changes
4. Console may show stale behavior
5. `console.log` statements you add don't appear

### Impact

Without fixing this, you cannot:
- Test any code changes reliably
- Develop any new features
- Debug existing issues
- Verify that fixes work

---

## Investigation Steps

### 1. Locate Webpack Configuration

```bash
# Find webpack config files
find packages -name "webpack*.js" -o -name "webpack*.ts"

# Common locations:
# packages/noodl-editor/webpack.config.js
# packages/noodl-editor/webpack.renderer.config.js
```

### 2. Check Current Cache Settings

Look for:
```javascript
module.exports = {
  cache: {
    type: 'filesystem',  // This is the culprit
    // ...
  }
}
```

### 3. Verify It's a Caching Issue

```bash
# Clear all caches and rebuild
rm -rf node_modules/.cache
rm -rf packages/noodl-editor/node_modules/.cache
npm run build -- --no-cache
```

If changes appear after clearing cache, caching is confirmed as the issue.

---

## Solution Options

### Option A: Disable Persistent Caching in Dev (Recommended)

```javascript
// webpack.config.js
module.exports = (env) => ({
  // Only use filesystem cache in production
  cache: env.production ? {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  } : false,  // No caching in development
  
  // ... rest of config
});
```

**Pros:** Simple, guaranteed to work  
**Cons:** Slower dev builds (but correctness > speed)

### Option B: Configure Proper Cache Invalidation

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'filesystem',
    version: `${Date.now()}`,  // Force cache bust
    buildDependencies: {
      config: [__filename],
      // Add all config files that should invalidate cache
    },
    // Invalidate on file changes
    managedPaths: [],
    immutablePaths: [],
  },
};
```

**Pros:** Keeps caching benefits when appropriate  
**Cons:** More complex, may still have edge cases

### Option C: Memory Cache Only

```javascript
// webpack.config.js
module.exports = {
  cache: {
    type: 'memory',
    maxGenerations: 1,
  },
};
```

**Pros:** Fast rebuilds within session, no persistence bugs  
**Cons:** Every new terminal session starts cold

---

## Implementation Steps

1. **Identify all webpack config files** in the project
2. **Check if there are separate dev/prod configs**
3. **Implement Option A** (safest starting point)
4. **Test the fix:**
   - Make a visible change to a component
   - Rebuild
   - Verify change appears in browser
5. **Test hot reload:**
   - Start dev server
   - Make change
   - Verify hot reload picks it up
6. **Document the change** in LEARNINGS.md

---

## Verification Checklist

- [ ] Code changes appear after rebuild
- [ ] Hot reload reflects changes immediately
- [ ] Console.log statements added to code appear in browser console
- [ ] No stale code behavior
- [ ] Build times acceptable (document before/after if significant)
- [ ] Works across terminal restarts
- [ ] Works after system restart

---

## Files Likely to Modify

```
packages/noodl-editor/webpack.config.js
packages/noodl-editor/webpack.renderer.config.js
packages/noodl-editor/webpack.main.config.js (if exists)
```

---

## Related Issues

- TASK-004B ComponentsPanel migration blocked by this
- Any future development work blocked by this
- PREREQ-002, PREREQ-003, PREREQ-004 all blocked by this

---

## Success Criteria

1. Can modify any TypeScript/JavaScript file
2. Changes appear immediately after rebuild
3. Hot reload works correctly
4. No need to manually clear caches
5. Works consistently across multiple dev sessions
