# TASK-006 Checklist

## Prerequisites
- [ ] Read README.md completely
- [ ] Understand the scope and success criteria
- [ ] Create branch: `git checkout -b fix/preview-font-loading`
- [ ] Verify build works: `npm run build:editor`

## Phase 1: Research & Investigation
- [ ] Locate where `localhost:8574` development server is configured
- [ ] Identify if it's webpack-dev-server, Electron static server, or custom
- [ ] Review `packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js`
- [ ] Review `packages/noodl-editor/src/main/` for Electron main process setup
- [ ] Find where current project path is stored (likely `ProjectModel`)
- [ ] Test console to confirm 404 errors on font requests
- [ ] Document findings in NOTES.md

## Phase 2: Architecture Planning
- [ ] Decide on implementation approach (A, B, or C from README)
- [ ] Map out where code changes are needed
- [ ] Identify if IPC communication is needed (renderer ↔ main)
- [ ] Plan security measures (path sanitization)
- [ ] Plan MIME type configuration for fonts
- [ ] Update NOTES.md with architectural decisions

## Phase 3: Implementation - Dev Server Configuration
- [ ] Add middleware or protocol handler for project assets
- [ ] Implement path resolution (project directory + requested file)
- [ ] Add path sanitization (prevent directory traversal)
- [ ] Configure MIME types for fonts:
  - [ ] `.ttf` → `font/ttf`
  - [ ] `.otf` → `font/otf`
  - [ ] `.woff` → `font/woff`
  - [ ] `.woff2` → `font/woff2`
- [ ] Handle project switching (update served directory)
- [ ] Add error handling for missing files
- [ ] Document changes in CHANGELOG.md

## Phase 4: Testing - Basic Font Loading
- [ ] Create test project with custom `.ttf` font
- [ ] Add font via Assets panel
- [ ] Assign font to Text node
- [ ] Open preview
- [ ] Verify font loads without 404
- [ ] Verify font renders correctly
- [ ] Check console for errors
- [ ] Document test results in NOTES.md

## Phase 5: Testing - Multiple Formats
- [ ] Test with `.otf` font
- [ ] Test with `.woff` font
- [ ] Test with `.woff2` font
- [ ] Test project with multiple fonts simultaneously
- [ ] Verify all formats load correctly
- [ ] Document any format-specific issues in NOTES.md

## Phase 6: Testing - Project Switching
- [ ] Create Project A with Font X
- [ ] Open Project A, verify Font X loads
- [ ] Close Project A
- [ ] Create Project B with Font Y
- [ ] Open Project B, verify Font Y loads (not Font X)
- [ ] Switch back to Project A, verify Font X still works
- [ ] Document results in NOTES.md

## Phase 7: Testing - Edge Cases
- [ ] Test missing font file (reference exists but file deleted)
- [ ] Verify graceful fallback behavior
- [ ] Test with special characters in filename
- [ ] Test with deeply nested font paths
- [ ] Test security: attempt directory traversal attack (should fail)
- [ ] Document edge case results in NOTES.md

## Phase 8: Testing - Other Assets
- [ ] Verify PNG images also load in preview
- [ ] Verify SVG images also load in preview
- [ ] Test any other asset types stored in project directory
- [ ] Document findings in NOTES.md

## Phase 9: Regression Testing
- [ ] Build and deploy test project
- [ ] Verify fonts work in deployed version (shouldn't change)
- [ ] Test editor performance (no noticeable slowdown)
- [ ] Measure project load time (should be similar)
- [ ] Test on multiple platforms if possible:
  - [ ] macOS
  - [ ] Windows
  - [ ] Linux
- [ ] Document regression test results in NOTES.md

## Phase 10: Documentation
- [ ] Add code comments explaining asset serving mechanism
- [ ] Update any relevant README files
- [ ] Document project path → server path mapping
- [ ] Add JSDoc to any new functions
- [ ] Complete CHANGELOG.md with summary

## Phase 11: Code Quality
- [ ] Remove any debug console.log statements
- [ ] Ensure TypeScript types are correct
- [ ] Run `npx tsc --noEmit` (type check)
- [ ] Run `npm run build:editor` (ensure builds)
- [ ] Self-review all changes
- [ ] Check for potential security issues

## Phase 12: Completion
- [ ] Verify all success criteria from README.md are met
- [ ] Update CHANGELOG.md with final summary
- [ ] Commit changes with descriptive message
- [ ] Push branch: `git push origin fix/preview-font-loading`
- [ ] Create pull request
- [ ] Mark task as complete
