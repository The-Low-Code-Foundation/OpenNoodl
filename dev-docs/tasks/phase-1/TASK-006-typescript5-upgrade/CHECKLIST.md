# TASK-006 Checklist

## Prerequisites
- [x] Read README.md completely
- [x] Understand the scope and success criteria
- [x] Create branch: `git checkout -b task/006-typescript5-upgrade`
- [x] Verify current build works with `transpileOnly: true`

## Phase 1: TypeScript Upgrade
- [x] Upgrade typescript to 5.x
  - Installed typescript@^5.9.3
- [x] Run typecheck: `npm run typecheck`
- [x] Document new errors found (9 errors from TS5's stricter checks)

## Phase 2: ESLint Compatibility
- [x] Upgrade @typescript-eslint/parser
  - `npm install @typescript-eslint/parser@^7.18.0 -D`
- [x] Upgrade @typescript-eslint/eslint-plugin
  - `npm install @typescript-eslint/eslint-plugin@^7.18.0 -D`
- [x] Test linting still works

## Phase 3: Fix Type Errors
- [x] Systematic review of type errors
- [x] Fix errors in packages/noodl-editor
  - keyboardhandler.ts: Fixed KeyMod return type
  - model.ts: Removed unused @ts-expect-error directives
  - ScreenSizes.ts: Removed @ts-expect-error, added type guard
- [x] Fix errors in packages/noodl-core-ui
  - PropertyPanelBaseInput.tsx: Fixed event handler types
- [x] Fix errors in other packages (none found)
- [x] Run full typecheck passes

## Phase 4: Zod Upgrade  
- [x] Upgrade zod to 4.x - SKIPPED (Zod not currently used directly)
- [x] Verify AI SDK packages work with zod/v4 - N/A
- [x] Test AI features in editor - N/A

## Phase 5: Re-enable Type Checking
- [x] Remove `transpileOnly: true` from webpack.renderer.core.js
- [x] Run `npm run typecheck` and verify no type errors
- [ ] Run `npm run dev` and verify build works
- [ ] Run `npm run build:editor` successfully (optional full verification)

## Phase 6: Completion
- [x] All type errors fixed
- [x] Update CHANGELOG.md
- [ ] Commit changes
- [ ] Create pull request
- [ ] Mark task complete
