# TASK-012: Foundation Health Check Script

## Status: ✅ COMPLETED

## Summary

Created an automated health check script that validates Phase 0 foundation fixes are in place and working correctly. This prevents regressions and makes it easy to verify the development environment is properly configured.

## Changes Made

### 1. Created Health Check Script ✅

**File:** `scripts/health-check.js`

A comprehensive Node.js script that validates:

1. **Webpack Cache Configuration** - Confirms babel cache is disabled
2. **Clean Script** - Verifies `clean:all` exists in package.json
3. **Build Canary** - Checks timestamp canary is in editor entry point
4. **useEventListener Hook** - Confirms hook exists and is properly exported
5. **Anti-Pattern Detection** - Scans for direct `.on()` usage in React code (warnings only)
6. **Documentation** - Verifies Phase 0 documentation exists

### 2. Added npm Script ✅

**File:** `package.json`

```json
"health:check": "node scripts/health-check.js"
```

## Usage

### Run Health Check

```bash
npm run health:check
```

### Expected Output (All Pass)

```
============================================================
  1. Webpack Cache Configuration
============================================================

✅ Babel cache disabled in webpack config

============================================================
  2. Clean Script
============================================================

✅ clean:all script exists in package.json

...

============================================================
  Health Check Summary
============================================================

✅ Passed:   10
⚠️  Warnings: 0
❌ Failed:   0

✅ HEALTH CHECK PASSED
Phase 0 Foundation is healthy!
```

### Exit Codes

- **0** - All checks passed (with or without warnings)
- **1** - One or more checks failed

### Check Results

- **✅ Pass** - Check succeeded, everything configured correctly
- **⚠️ Warning** - Check passed but there's room for improvement
- **❌ Failed** - Critical issue, must be fixed

## When to Run

Run the health check:

1. **After setting up a new development environment**
2. **Before starting React migration work**
3. **After pulling major changes from git**
4. **When experiencing mysterious build/cache issues**
5. **As part of CI/CD pipeline** (optional)

## What It Checks

### Critical Checks (Fail on Error)

1. **Webpack config** - Babel cache must be disabled in dev
2. **package.json** - clean:all script must exist
3. **Build canary** - Timestamp logging must be present
4. **useEventListener hook** - Hook must exist and be exported properly

### Warning Checks

5. **Anti-patterns** - Warns about direct `.on()` usage in React (doesn't fail)
6. **Documentation** - Warns if Phase 0 docs are missing

## Troubleshooting

### If Health Check Fails

1. **Read the error message** - It tells you exactly what's missing
2. **Review the Phase 0 tasks:**
   - TASK-009 for cache/build issues
   - TASK-010 for hook issues
   - TASK-011 for documentation
3. **Run `npm run clean:all`** if cache-related
4. **Re-run health check** after fixes

### Common Failures

**"Babel cache ENABLED in webpack"**

- Fix: Edit `packages/noodl-editor/webpackconfigs/shared/webpack.renderer.core.js`
- Change `cacheDirectory: true` to `cacheDirectory: false`

**"clean:all script missing"**

- Fix: Add to package.json scripts section
- See TASK-009 documentation

**"Build canary missing"**

- Fix: Add to `packages/noodl-editor/src/editor/index.ts`
- Add: `console.log('🔥 BUILD TIMESTAMP:', new Date().toISOString());`

**"useEventListener hook not found"**

- Fix: Ensure `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts` exists
- See TASK-010 documentation

## Integration with CI/CD

To add to CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Foundation Health Check
  run: npm run health:check
```

This ensures Phase 0 fixes don't regress in production.

## Future Enhancements

Potential additions:

- Check for stale Electron cache
- Verify React version compatibility
- Check for common webpack misconfigurations
- Validate EventDispatcher subscriptions in test mode
- Generate detailed report file

## Success Criteria

- [x] Script created in `scripts/health-check.js`
- [x] Added to package.json as `health:check`
- [x] Validates all Phase 0 fixes
- [x] Clear pass/warn/fail output
- [x] Proper exit codes
- [x] Documentation complete
- [x] Tested and working

## Time Spent

**Actual:** ~1 hour (script development and testing)

## Files Created

- `scripts/health-check.js` - Main health check script
- `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-012-foundation-health-check/README.md` - This file

## Files Modified

- `package.json` - Added `health:check` script

## Next Steps

- Run `npm run health:check` regularly during development
- Add to onboarding docs for new developers
- Consider adding to pre-commit hook (optional)
- Use before starting any React migration work
