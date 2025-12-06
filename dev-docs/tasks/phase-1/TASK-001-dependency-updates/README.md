# TASK-001: Dependency Updates & Build Modernization

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-001 |
| **Phase** | Phase 1 - Foundation |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2-3 days |
| **Prerequisites** | None (this is the first task) |
| **Branch** | `task/001-dependency-updates` |
| **Related Branches** | `12-upgrade-dependencies` (previous dev work) |

## Objective

Complete and validate all dependency updates, fully migrate to React 19, and modernize the build pipeline for reliable, fast development.

## Background

A previous developer started this work on the `12-upgrade-dependencies` branch. They updated package.json files across the monorepo, including:
- React 17 → 19
- Various webpack, typescript, and tooling updates
- Removed Node.js version upper cap

They also made a commit "Update rendering to use non-deprecated react-dom calls" which addressed some React 19 breaking changes.

This task completes that work, validates everything works, and improves the overall build experience.

## Current State

### What Exists
- Branch `12-upgrade-dependencies` with package.json updates
- Some React 19 migration work done
- Build may have errors or warnings

### Known Issues
- `react-instantsearch-hooks-web` renamed to `react-instantsearch` (breaking API change)
- `ReactDOM.render()` deprecated in React 18+
- Potential peer dependency conflicts
- Hot reload may be unreliable
- Build times are slow

### Key Package Changes (from previous dev)

| Package | Old | New | Breaking Changes |
|---------|-----|-----|------------------|
| react | 17.0.2 | 19.0.0 | Yes - see below |
| react-dom | 17.0.0 | 19.0.0 | Yes - render API |
| react-instantsearch-hooks-web | 6.38.0 | react-instantsearch 7.16.2 | Yes - renamed |
| webpack | 5.74.0 | 5.101.3 | Minor |
| typescript | 4.8.3 | 4.9.5 | Minor |

## Desired State

After this task:
- All packages build without errors
- No deprecation warnings in console
- React 19 fully adopted (no legacy patterns)
- Hot reload works reliably
- Build completes in <60 seconds
- All existing tests pass

## Scope

### In Scope
- [x] Validate and fix dependency updates
- [x] Complete React 19 migration
- [x] Fix all build errors and warnings
- [x] Update react-instantsearch usage
- [x] Improve build performance
- [x] Fix hot reload issues

### Out of Scope
- Major refactoring (that's later tasks)
- New features
- TSFixme cleanup (TASK-002)
- Storybook 9 migration (can be separate task)

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `package.json` (root) | Verify dependencies, fix conflicts |
| `packages/*/package.json` | Verify peer deps, fix conflicts |
| `packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx` | Update react-instantsearch imports |
| Any file with `ReactDOM.render` | Migrate to createRoot |
| `packages/noodl-viewer-react/` | React 19 compatibility |

### React 19 Migration Points

```typescript
// OLD (React 17)
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// NEW (React 19)
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

Search for these patterns:
```bash
grep -r "ReactDOM.render" packages/ --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "ReactDOM.hydrate" packages/ --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "ReactDOM.unmountComponentAtNode" packages/ --include="*.ts" --include="*.tsx" --include="*.js"
```

### react-instantsearch Migration

```typescript
// OLD
import { InstantSearch, Hits } from 'react-instantsearch-hooks-web';

// NEW
import { InstantSearch, Hits } from 'react-instantsearch';
```

The API is mostly compatible, but verify all hooks used still exist.

## Implementation Steps

### Step 1: Setup and Initial Validation
1. Checkout the existing branch: `git checkout 12-upgrade-dependencies`
2. Create our task branch: `git checkout -b task/001-dependency-updates`
3. Clean install: `rm -rf node_modules && npm install`
4. Document any install errors in NOTES.md

### Step 2: Fix Dependency Conflicts
1. Run `npm install` and note all peer dependency warnings
2. For each warning, determine the correct resolution
3. Update package.json files as needed
4. Repeat until `npm install` runs cleanly

### Step 3: Fix Build Errors
1. Run `npm run build:editor`
2. Fix each error one at a time
3. Document each fix in CHANGELOG.md
4. Repeat until build succeeds

### Step 4: React 19 Migration
1. Search for deprecated ReactDOM calls
2. Update each to use createRoot pattern
3. Check for class component lifecycle issues
4. Test each changed component

### Step 5: react-instantsearch Update
1. Update imports in HelpCenter.tsx
2. Verify all hooks/components still available
3. Test search functionality

### Step 6: Build Optimization
1. Analyze current build time
2. Check webpack configs for optimization opportunities
3. Enable caching if not already
4. Measure improvement

### Step 7: Validation
1. Run full test suite
2. Manual testing of key workflows
3. Verify hot reload works
4. Check for console warnings

## Testing Plan

### Automated Tests
- [ ] Run `npm run test:editor` - all pass
- [ ] Run `npm run test:platform` - all pass
- [ ] Run `npx tsc --noEmit` - no type errors

### Manual Testing Scenarios
- [ ] Start dev server: `npm run dev` - starts without errors
- [ ] Create new project - works
- [ ] Add nodes to canvas - works
- [ ] Connect nodes - works
- [ ] Preview project - works
- [ ] Edit code in Function node - works
- [ ] Hot reload when editing - works
- [ ] Search in Help Center - works (react-instantsearch)
- [ ] Build for production - works

## Success Criteria

- [ ] `npm install` completes with no errors
- [ ] `npm run build:editor` completes with no errors
- [ ] `npm run test:editor` all tests pass
- [ ] `npx tsc --noEmit` no TypeScript errors
- [ ] No deprecation warnings in browser console
- [ ] Hot reload works reliably
- [ ] All manual test scenarios pass

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| React 19 breaks something subtle | Extensive manual testing, rollback plan ready |
| react-instantsearch API changes | Read migration guide, test search thoroughly |
| Build time regression | Measure before/after, optimize if needed |
| Peer dependency hell | Use `--legacy-peer-deps` as last resort, document why |

## Rollback Plan

If major issues discovered:
1. Checkout main branch
2. Cherry-pick any non-breaking fixes
3. Document issues for future attempt
4. Consider incremental approach (React 18 first, then 19)

## References

- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)
- [react-instantsearch v7 Migration](https://www.algolia.com/doc/guides/building-search-ui/upgrade-guides/react/)
- Previous dev branch: `12-upgrade-dependencies`
- Previous dev commit: "Update rendering to use non-deprecated react-dom calls"
