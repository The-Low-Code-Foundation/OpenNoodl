# TASK-003: TypeScript Configuration Cleanup

## Status: ✅ COMPLETED

## Overview
Fix TypeScript configuration issues in the monorepo to enable proper type checking from the root level. Currently, running `npx tsc --noEmit` from the root produces ~1900 errors, mostly due to path alias resolution failures.

## Problem Statement
The OpenNoodl monorepo has TypeScript configured at both the root level and in individual packages. When running TypeScript checks from the root:
- Path aliases (`@noodl-core-ui/*`, `@noodl-types/*`, etc.) are not resolved
- This causes ~1500 "Cannot find module" errors
- Prevents effective CI/CD type checking
- Webpack builds work because they have their own alias configuration

## Error Analysis

| Error Type | Count | Root Cause |
|------------|-------|------------|
| Cannot find module `@noodl-core-ui/*` | ~1200 | Path alias not in root tsconfig |
| Cannot find module `@noodl-types/*` | ~150 | Path alias not in root tsconfig |
| Cannot find module `@noodl-constants/*` | ~100 | Path alias not in root tsconfig |
| Other missing modules | ~50 | Various cross-package aliases |
| Storybook API (see TASK-004) | ~214 | Storybook 8 migration |
| Duplicate identifiers | ~8 | global.d.ts conflicts |

## Root Cause

### Current Configuration
The root `tsconfig.json` has no path aliases:
```json
{
  "compilerOptions": {
    "jsx": "react",
    "lib": ["ES2019", "DOM", "DOM.Iterable", "ESNext"],
    "target": "ES2019",
    "noImplicitAny": false,
    "esModuleInterop": true,
    "sourceMap": true,
    "module": "CommonJS"
  },
  "exclude": ["deps/parse-dashboard", "node_modules"]
}
```

The `packages/noodl-core-ui/tsconfig.json` has paths configured:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@noodl-core-ui/*": ["./src/*"],
      "@noodl-hooks/*": ["../noodl-editor/src/editor/src/hooks/*"],
      "@noodl-utils/*": ["../noodl-editor/src/editor/src/utils/*"],
      ...
    }
  }
}
```

But TypeScript doesn't support running multiple tsconfigs in one check.

## Solution Options

### Option A: TypeScript Project References (Recommended)
Use TypeScript project references to enable per-package type checking with proper boundaries.

**Pros:**
- Proper monorepo pattern
- Incremental builds
- Clear package boundaries
- Supports `tsc --build` for full monorepo check

**Cons:**
- Requires restructuring
- Each package needs `composite: true`
- More complex setup

### Option B: Global Path Aliases in Root tsconfig
Add all path aliases to the root tsconfig.

**Pros:**
- Simple fix
- Quick to implement

**Cons:**
- Doesn't scale well
- Requires maintaining aliases in two places
- Doesn't enforce package boundaries

### Option C: Exclude Stories from Root Check
Only check non-story files from root, let packages check their own stories.

**Pros:**
- Simplest short-term fix
- Reduces error noise

**Cons:**
- Stories would remain unchecked
- Still doesn't solve root cause

## Proposed Implementation (Option A)

### Step 1: Update Root tsconfig.json
```json
{
  "compilerOptions": {
    "jsx": "react",
    "lib": ["ES2019", "DOM", "DOM.Iterable", "ESNext"],
    "target": "ES2019",
    "noImplicitAny": false,
    "esModuleInterop": true,
    "sourceMap": true,
    "module": "CommonJS",
    "declaration": true,
    "declarationMap": true,
    "composite": true
  },
  "references": [
    { "path": "./packages/noodl-core-ui" },
    { "path": "./packages/noodl-editor" },
    { "path": "./packages/noodl-viewer-react" },
    { "path": "./packages/noodl-runtime" }
  ],
  "exclude": ["deps/parse-dashboard", "node_modules"]
}
```

### Step 2: Update Package tsconfigs
Each package gets `composite: true` and proper references:

**packages/noodl-core-ui/tsconfig.json:**
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@noodl-core-ui/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "references": []
}
```

### Step 3: Fix Global Type Duplicates
The `@include-types/global.d.ts` files have duplicate declarations. Need to:
- Consolidate to a single global types package
- Or use proper module augmentation

### Step 4: Run Checks Per-Package
Add npm scripts:
```json
{
  "scripts": {
    "typecheck": "tsc --build",
    "typecheck:core-ui": "tsc -p packages/noodl-core-ui --noEmit",
    "typecheck:editor": "tsc -p packages/noodl-editor --noEmit"
  }
}
```

## Files to Modify

### Configuration Files
- [ ] `tsconfig.json` (root)
- [ ] `packages/noodl-core-ui/tsconfig.json`
- [ ] `packages/noodl-editor/tsconfig.json`
- [ ] `packages/noodl-viewer-react/tsconfig.json`
- [ ] `packages/noodl-runtime/tsconfig.json` (if exists)

### Global Type Files
- [ ] `packages/noodl-core-ui/src/@include-types/global.d.ts`
- [ ] `packages/noodl-editor/@include-types/global.d.ts`
- [ ] Create shared types package or consolidate

## Success Criteria
- [ ] `npm run typecheck` runs from root without path resolution errors
- [ ] Each package can be type-checked independently
- [ ] Webpack builds continue to work
- [ ] No duplicate type declarations

## Estimated Time
6-10 hours

## Dependencies
- Independent of other tasks
- Blocking for: CI/CD improvements

## Priority
**Medium** - Not blocking development (webpack works), but important for code quality and CI/CD.

## Notes
- Webpack has its own alias resolution via webpack config, so builds work
- The Storybook 8 migration (TASK-004) is a separate issue
- Consider if stories should even be type-checked from root or only in Storybook build
