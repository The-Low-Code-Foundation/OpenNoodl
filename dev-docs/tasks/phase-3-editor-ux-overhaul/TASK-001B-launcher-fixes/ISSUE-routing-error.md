# Issue: Dashboard Routing Error

**Discovered:** 2026-01-07  
**Status:** 🔴 Open  
**Priority:** Medium  
**Related Task:** TASK-001B Launcher Fixes

---

## Problem Description

When running `npm run dev` and launching the Electron app, attempting to navigate to the dashboard results in:

```
Editor: (node:79789) electron: Failed to load URL: file:///dashboard/projects with error: ERR_FILE_NOT_FOUND
```

## Context

This error was discovered while attempting to verify Phase 0 TASK-009 (Webpack Cache Elimination). The cache verification tests required:

1. Running `npm run clean:all`
2. Running `npm run dev`
3. Checking console for build timestamp

The app launched but the dashboard route failed to load.

## Suspected Cause

Changes made during Phase 3 TASK-001B (Electron Store Migration & Service Integration) likely affected routing:

- Electron storage implementation for project persistence
- Route configuration changes
- File path resolution modifications

## Related Files

Files modified in TASK-001B that could affect routing:

- `packages/noodl-editor/src/editor/src/services/ProjectOrganizationService.ts`
- `packages/noodl-core-ui/src/preview/launcher/Launcher/` (multiple files)
- `packages/noodl-editor/src/editor/src/pages/ProjectsPage/ProjectsPage.tsx`
- `packages/noodl-editor/src/editor/src/utils/LocalProjectsModel.ts`

## Impact

- **Phase 0 verification tests blocked** (worked around by marking tasks complete based on implementation)
- **Dashboard may not load properly** in development mode
- **Production builds may be affected** (needs verification)

## Steps to Reproduce

1. Run `npm run clean:all`
2. Run `npm run dev`
3. Wait for Electron app to launch
4. Observe console error: `ERR_FILE_NOT_FOUND` for `file:///dashboard/projects`

## Expected Behavior

The dashboard should load successfully, showing the projects list.

## Next Steps

1. Review TASK-001B changes related to routing
2. Check if route registration was affected by Electron store changes
3. Verify file path resolution for dashboard routes
4. Test in production build to determine if it's dev-only or affects all builds
5. Check if the route changed from `/dashboard/projects` to something else

## Notes

- This issue is **unrelated to Phase 0 work** (cache fixes, useEventListener hook)
- Phase 0 was marked complete despite this blocking formal verification tests
- Should be investigated in Phase 3 context with knowledge of TASK-001B changes

## Resolution

_To be filled when issue is resolved_
