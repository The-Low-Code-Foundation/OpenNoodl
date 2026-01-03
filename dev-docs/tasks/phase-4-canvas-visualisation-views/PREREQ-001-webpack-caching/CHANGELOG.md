# PREREQ-001: Webpack Caching Fix - CHANGELOG

## 2026-03-01 - COMPLETED ✅

### Summary

Fixed persistent webpack caching issues that prevented code changes from loading during development. Developers no longer need to run `npm run clean:all` after every code change.

### Changes Made

#### 1. Webpack Dev Config (`packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`)

- ✅ Added `cache: false` to disable webpack persistent caching in development
- ✅ Added `Cache-Control: no-store` headers to devServer
- ✅ Added build timestamp canary to console output for verification

#### 2. Babel Config (`packages/noodl-editor/webpackconfigs/shared/webpack.renderer.core.js`)

- ✅ Already had `cacheDirectory: false` - no change needed

#### 3. Viewer Webpack Config (`packages/noodl-viewer-react/webpack-configs/webpack.common.js`)

- ✅ Changed `cacheDirectory: true` → `cacheDirectory: false` for Babel loader

#### 4. NPM Scripts (`package.json`)

- ✅ Updated `clean:cache` - clears webpack/babel caches only
- ✅ Updated `clean:electron` - clears Electron app caches (macOS)
- ✅ Updated `clean:all` - runs both cache cleaning scripts
- ✅ Kept `dev:clean` - clears all caches then starts dev server

### Verification

- ✅ All 4 verification checks passed
- ✅ Existing caches cleared
- ✅ Build timestamp canary added to console output

### Testing Instructions

After this fix, to verify code changes load properly:

1. **Start dev server**: `npm run dev`
2. **Make a code change**: Add a console.log somewhere
3. **Save the file**: Webpack will rebuild automatically
4. **Check console**: Look for the 🔥 BUILD TIMESTAMP to verify fresh code
5. **Verify your change**: Your console.log should appear

### When You Still Need clean:all

- After switching git branches with major changes
- After npm install/update
- If webpack config itself was modified
- If something feels "really weird"

But for normal code edits? **Never again!** 🎉

### Impact

**Before**: Required `npm run clean:all` after most code changes  
**After**: Code changes load immediately with HMR/rebuild

### Trade-offs

| Aspect           | Before (with cache) | After (no cache)         |
| ---------------- | ------------------- | ------------------------ |
| Initial build    | Faster (cached)     | Slightly slower (~5-10s) |
| Rebuild speed    | Same                | Same (HMR unaffected)    |
| Code freshness   | ❌ Unreliable       | ✅ Always fresh          |
| Developer sanity | 😤                  | 😊                       |

### Files Modified

```
packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js
packages/noodl-viewer-react/webpack-configs/webpack.common.js
package.json
```

### Notes

- Babel cache in `webpack.renderer.core.js` was already disabled (good catch by previous developer!)
- HMR (Hot Module Replacement) performance is unchanged - it works at runtime, not via filesystem caching
- Production builds can still use filesystem caching for CI/CD speed benefits
- Build timestamp canary helps quickly verify if code changes loaded

---

**Status**: ✅ COMPLETED  
**Verified**: 2026-03-01  
**Blocks**: All Phase 4 development work  
**Enables**: Reliable development workflow for canvas visualization views
