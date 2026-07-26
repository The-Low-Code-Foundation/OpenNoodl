# Issue: Dashboard Routing Error

**Discovered:** 2026-01-07  
**Status:** 🟢 Fixed 2026-07-26 (PLAT-005)  
**Priority:** Medium  
**Related Task:** TASK-001B Launcher Fixes — but see the Resolution: the
attribution below is wrong, and this was never a TASK-001B regression.

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

**Fixed 2026-07-26 by PLAT-005** in
`packages/noodl-core-ui/src/preview/launcher/Launcher/Launcher.tsx`.

### Actual cause

Not the Electron store migration, and nothing in the "Suspected Cause" or
"Related Files" sections above was involved. The editor has no URL router at
all — `src/editor/src/router.tsx` is a hand-rolled two-state machine
(`'editor'` / `'projects'`) that never touches `window.location`, so there was
no `/dashboard/projects` route to have been renamed, and no dev server serving
the renderer.

The renderer is loaded straight off disk:

```js
// packages/noodl-editor/src/main/main.js
win.loadURL('file:///' + appPath + '/src/editor/index.html');
```

so `window.location` is a `file:` URL with an empty host. `Launcher.tsx` then
ran this on every tab change:

```tsx
const url = new URL(window.location.href);
url.pathname = `/dashboard/${activePageId}`;
window.history.replaceState({}, '', url.toString());
```

Assigning `pathname` on a host-less `file:` URL yields literally
`file:///dashboard/projects`, and `replaceState` writes it into session
history. The *next* reload — Cmd+R, a devtools reload, an HMR full reload, which
is exactly what `npm run clean:all && npm run dev` produces — then asks the
filesystem root for `/dashboard/projects` and fails. `main.js`'s `did-fail-load`
handler prints the message quoted above.

The block was introduced by `73b5a42` ("initial ux ui improvements and revised
dashboard", 2025-12-31) and had never been modified since, through six later
commits to the file.

### Fix

The write is now guarded by `shouldWriteDeepLinkUrl()`, which permits it only
under an `http:`/`https:` origin (Storybook, the hosted preview). Under `file:`
it is skipped. Nothing depended on the write: the active tab is persisted by
`usePersistentTab` via localStorage.

Covered by `packages/noodl-editor/tests/launcher/deeplink-url.test.ts` (5
specs) — noodl-core-ui has no test runner of its own, so the guard is exported
and exercised from the editor's Jasmine suite.

### Still true, deliberately not fixed

`parseDeepLink()` reads the last path segment, which under `file:` is
`index.html`, so it always returns `null` — deep linking has never actually
worked in the desktop app. No `noodl://` protocol handler is registered in
`src/main` either. Making deep links work is a feature, not part of this fix.

### Verification owed

Fixed and unit-tested, but **not yet confirmed against a running editor** —
PLAT-005 ran from a git worktree and could not drive the app. See
`dev-docs/tasks/phase-14-editor-platform-health/PLAT-005-NOTES.md` §6 for the
click-through a human should do.
