# TASK-009 Verification Checklist

## Pre-Verification

- [x] `npm run clean:all` script exists
- [x] Script successfully clears caches
- [x] Babel cache disabled in webpack config
- [x] Build timestamp canary added to entry point

## User Verification Required

### Test 1: Fresh Build

- [ ] Run `npm run clean:all`
- [ ] Run `npm run dev`
- [ ] Wait for Electron to launch
- [ ] Open DevTools Console (View → Toggle Developer Tools)
- [ ] Verify timestamp appears: `🔥 BUILD TIMESTAMP: [recent time]`
- [ ] Note the timestamp: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### Test 2: Code Change Detection

- [ ] Open `packages/noodl-editor/src/editor/index.ts`
- [ ] Change the build canary line to add extra emoji:
  ```typescript
  console.log('🔥🔥 BUILD TIMESTAMP:', new Date().toISOString());
  ```
- [ ] Save the file
- [ ] Wait 5 seconds for webpack to recompile
- [ ] Reload Electron app (Cmd+R on macOS, Ctrl+R on Windows/Linux)
- [ ] Check console - timestamp should update and show two fire emojis
- [ ] Note new timestamp: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- [ ] Timestamps should be different (proves fresh code loaded)

### Test 3: Repeat to Ensure Reliability

- [ ] Make another trivial change (e.g., add 🔥🔥🔥)
- [ ] Save, wait, reload
- [ ] Verify timestamp updates again
- [ ] Note timestamp: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

### Test 4: Revert and Confirm

- [ ] Revert changes (remove extra emojis, keep just one 🔥)
- [ ] Save, wait, reload
- [ ] Verify timestamp updates
- [ ] Build canary back to original

## Definition of Done

All checkboxes above should be checked. If any test fails:

1. Run `npm run clean:all` again
2. Manually clear Electron cache: `~/Library/Application Support/Noodl/Code Cache/`
3. Restart from Test 1

## Success Criteria

✅ Changes appear within 5 seconds, 3 times in a row
✅ Build timestamp updates every time code changes
✅ No stale code issues

## If Problems Persist

1. Check if webpack dev server is running properly
2. Look for webpack compilation errors in terminal
3. Verify no other Electron/Node processes are running: `pkill -f Electron; pkill -f node`
4. Try a full restart of the dev server
