# TASK-001 Changelog

Track all changes made during this task. Update this file as you work.

---

## [2025-06-12] - Cline (AI-assisted)

### Summary
Fixed React 19 TypeScript compatibility errors that were preventing the build from completing. The previous developer updated dependencies but did not address all the TypeScript compatibility issues with the new `@types/react` package.

### Starting Point
- Based on branch: `12-upgrade-dependencies`
- Previous work by: previous developer
- Previous commits include:
  - Package.json dependency updates (React 17 → 19)
  - "Update rendering to use non-deprecated react-dom calls"

---

## React 19 TypeScript Fixes

### Issue 1: Unused `@ts-expect-error` directives
React 19's types fixed some underlying issues that were previously suppressed with `@ts-expect-error`. These now cause errors when the underlying issue no longer exists.

### Issue 2: `useRef()` requires explicit type parameter
In React 19's types, `useRef()` without a type parameter returns `RefObject<unknown>`, which is not assignable to more specific ref types.

**Fix**: Changed `useRef()` to `useRef<HTMLDivElement>(null)`

### Issue 3: `JSX` namespace moved
In React 19, `JSX` is no longer a global namespace. It must be accessed as `React.JSX`.

**Fix**: Changed `keyof JSX.IntrinsicElements` to `keyof React.JSX.IntrinsicElements`

### Issue 4: `ReactFragment` export removed
React 19 no longer exports `ReactFragment`. Use `Iterable<React.ReactNode>` instead.

### Issue 5: `children` not implicitly included in props
React 19 no longer implicitly includes `children` in component props. It must be explicitly declared.

**Fix**: Added `children?: React.ReactNode` to component prop interfaces.

### Issue 6: `ReactDOM.findDOMNode` removed
React 19 removed the deprecated `findDOMNode` API.

**Fix**: Access DOM elements directly from refs rather than using `findDOMNode`.

---

## Build Fixes

### Error: TS2578: Unused '@ts-expect-error' directive
- **Cause**: React 19 types fixed the type inference for `React.cloneElement()`
- **Fix**: Removed the `@ts-expect-error` comment
- **Files**: 
  - `packages/noodl-core-ui/src/components/layout/Columns/Columns.tsx`
  - `packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx`

### Error: TS2554: Expected 1 arguments, but got 0 (useRef)
- **Cause**: React 19's types require an initial value for `useRef()`
- **Fix**: Added type parameter and null initial value: `useRef<HTMLDivElement>(null)`
- **Files**: 
  - `packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.tsx`
  - `packages/noodl-core-ui/src/components/popups/ContextMenu/ContextMenu.tsx`

### Error: TS2322: RefObject<unknown> not assignable to RefObject<HTMLElement>
- **Cause**: Untyped `useRef()` returns `RefObject<unknown>`
- **Fix**: Same as above - add explicit type parameter
- **Files**: Same as above

### Error: TS2305: Module 'react' has no exported member 'ReactFragment'
- **Cause**: `ReactFragment` was removed in React 19
- **Fix**: Replaced with `Iterable<React.ReactNode>`
- **File**: `packages/noodl-viewer-react/src/types.ts`

### Error: TS2503: Cannot find namespace 'JSX'
- **Cause**: `JSX` is no longer a global namespace in React 19
- **Fix**: Changed `JSX.IntrinsicElements` to `React.JSX.IntrinsicElements`
- **Files**: 
  - `packages/noodl-viewer-react/src/components/visual/Group/Group.tsx`
  - `packages/noodl-viewer-react/src/components/visual/Text/Text.tsx`

### Error: TS2339: Property 'children' does not exist on type
- **Cause**: React 19 no longer implicitly includes `children` in props
- **Fix**: Added `children?: React.ReactNode` to component interfaces
- **Files**: 
  - `packages/noodl-viewer-react/src/components/visual/Drag/Drag.tsx`
  - `packages/noodl-viewer-react/src/components/visual/Group/Group.tsx`

### Error: Property 'findDOMNode' does not exist on ReactDOM
- **Cause**: `findDOMNode` removed from React 19
- **Fix**: Access DOM element directly from ref instead of using findDOMNode
- **File**: `packages/noodl-viewer-react/src/components/visual/Group/Group.tsx`

---

## Files Modified

- [x] `packages/noodl-core-ui/src/components/layout/Columns/Columns.tsx`
- [x] `packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.tsx`
- [x] `packages/noodl-core-ui/src/components/popups/ContextMenu/ContextMenu.tsx`
- [x] `packages/noodl-viewer-react/src/types.ts`
- [x] `packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx`
- [x] `packages/noodl-viewer-react/src/components/visual/Drag/Drag.tsx`
- [x] `packages/noodl-viewer-react/src/components/visual/Group/Group.tsx`
- [x] `packages/noodl-viewer-react/src/components/visual/Text/Text.tsx`

---

## Files Created

- None

---

## Files Deleted

- None

---

## Breaking Changes

- React 19 requires Node.js 18+ (documented in root package.json engines)
- `findDOMNode` usage removed - code now accesses refs directly

---

## Testing Notes

### Automated Tests
- `npm run dev`: **PASS** - All three packages (Editor, Viewer, Cloud) compile successfully

### Manual Tests
- Dev server start: **PASS** - Editor launches, Viewer compiles, Cloud compiles

---

## Known Issues

<!-- Document any issues discovered that aren't fixed in this task -->

1. Deprecation warnings for Sass legacy JS API - Non-blocking, can be addressed in future task
2. Deprecation warning for `Buffer()` - Non-blocking, comes from dependency

---

## Follow-up Tasks

1. Consider updating Sass configuration to use modern API - Future task
2. Review `scrollToElement` functionality to ensure it works correctly with the new ref-based approach - Manual testing needed

---

## Final Summary

**Total files modified**: 8
**Build status**: All packages compiling successfully (was 95 errors, now 0)
**Confidence**: 8/10 (code compiles, but manual testing of `scrollToElement` functionality recommended)
