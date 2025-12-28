# TASK-001 Checklist

## Prerequisites
- [ ] Read README.md completely
- [ ] Understand React 19 breaking changes
- [ ] Have Node.js 18+ installed
- [ ] Clone the repository fresh (or ensure clean state)

## Phase 1: Setup
- [ ] Checkout existing work: `git checkout 12-upgrade-dependencies`
- [ ] Create task branch: `git checkout -b task/001-dependency-updates`
- [ ] Delete node_modules: `rm -rf node_modules packages/*/node_modules`
- [ ] Clean install: `npm install`
- [ ] Document any install errors in NOTES.md
- [ ] Note: confidence level for this phase: __/10

## Phase 2: Dependency Conflicts
- [ ] List all peer dependency warnings
- [ ] Research each warning
- [ ] Fix conflicts in root package.json
- [ ] Fix conflicts in packages/noodl-editor/package.json
- [ ] Fix conflicts in packages/noodl-core-ui/package.json
- [ ] Fix conflicts in packages/noodl-viewer-react/package.json
- [ ] Fix conflicts in other packages as needed
- [ ] Verify clean `npm install`
- [ ] Document fixes in CHANGELOG.md
- [ ] Note: confidence level for this phase: __/10

## Phase 3: Build Errors
- [ ] Run `npm run build:editor`
- [ ] List all build errors
- [ ] Fix error 1: _______________
- [ ] Fix error 2: _______________
- [ ] Fix error 3: _______________
- [ ] (add more as needed)
- [ ] Verify clean build
- [ ] Document fixes in CHANGELOG.md
- [ ] Note: confidence level for this phase: __/10

## Phase 4: React 19 Migration
- [ ] Search for ReactDOM.render usage:
  ```bash
  grep -rn "ReactDOM.render" packages/ --include="*.ts" --include="*.tsx" --include="*.js"
  ```
- [ ] List all files found: _______________
- [ ] Update file 1: _______________
- [ ] Update file 2: _______________
- [ ] (add more as needed)
- [ ] Search for ReactDOM.hydrate usage
- [ ] Search for ReactDOM.unmountComponentAtNode usage
- [ ] Update any found
- [ ] Verify no legacy ReactDOM usage remains
- [ ] Document changes in CHANGELOG.md
- [ ] Note: confidence level for this phase: __/10

## Phase 5: react-instantsearch Migration
- [ ] Open `packages/noodl-editor/src/editor/src/views/HelpCenter/HelpCenter.tsx`
- [ ] Update import from `react-instantsearch-hooks-web` to `react-instantsearch`
- [ ] Check all hooks used are still available
- [ ] Search for other files using old package:
  ```bash
  grep -rn "react-instantsearch-hooks-web" packages/
  ```
- [ ] Update any other files found
- [ ] Test search functionality works
- [ ] Document changes in CHANGELOG.md
- [ ] Note: confidence level for this phase: __/10

## Phase 6: Build Optimization (Optional but Recommended)
- [ ] Measure current build time: ___ seconds
- [ ] Check webpack config for cache settings
- [ ] Enable persistent caching if not enabled
- [ ] Check for unnecessary rebuilds
- [ ] Measure new build time: ___ seconds
- [ ] Document optimizations in CHANGELOG.md

## Phase 7: Testing - Automated
- [ ] Run `npm run test:editor`
  - [ ] All tests pass
  - [ ] Note any failures: _______________
- [ ] Run `npm run test:platform`
  - [ ] All tests pass
  - [ ] Note any failures: _______________
- [ ] Run `npx tsc --noEmit`
  - [ ] No TypeScript errors
  - [ ] Note any errors: _______________

## Phase 8: Testing - Manual
- [ ] Start dev server: `npm run dev`
  - [ ] Starts without errors
  - [ ] No console warnings about deprecated APIs
- [ ] Create new project
- [ ] Add Group node to canvas
- [ ] Add Text node as child
- [ ] Connect nodes
- [ ] Open preview
- [ ] Edit text content, verify preview updates
- [ ] Save and reopen project
- [ ] Open Help Center, test search (react-instantsearch)
- [ ] Edit Function node code
- [ ] Change a file, verify hot reload works
- [ ] Build production: `npm run build:editor`

## Phase 9: Cleanup & Documentation
- [ ] Remove any debug console.logs added
- [ ] Review all changes for code quality
- [ ] Complete CHANGELOG.md with summary
- [ ] Update NOTES.md with learnings
- [ ] Self-review: confidence level __/10

## Phase 10: Completion
- [ ] All success criteria met (see README.md)
- [ ] Create pull request
- [ ] PR title: "TASK-001: Dependency Updates & Build Modernization"
- [ ] PR description includes:
  - [ ] Summary of changes
  - [ ] Testing performed
  - [ ] Any known issues or follow-ups
- [ ] Mark task complete

## Final Confidence Check
- Overall confidence this task is complete and correct: __/10
- Remaining concerns: _______________
