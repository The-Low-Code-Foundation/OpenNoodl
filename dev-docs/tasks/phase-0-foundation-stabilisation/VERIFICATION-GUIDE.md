# Phase 0: Complete Verification Guide

## Overview

This guide will walk you through verifying both TASK-009 (cache fixes) and TASK-010 (EventListener hook) in one session. Total time: ~30 minutes.

---

## Prerequisites

✅ Health check passed: `npm run health:check`
✅ EventListenerTest component added to Router
✅ All Phase 0 infrastructure in place

---

## Part 1: Cache Fix Verification (TASK-009)

### Step 1: Clean Start

```bash
npm run clean:all
npm run dev
```

**Wait for:** Electron window to launch

### Step 2: Check Build Canary

1. Open DevTools Console: **View → Toggle Developer Tools**
2. Look for: `🔥 BUILD TIMESTAMP: [recent time]`
3. **Write down the timestamp:** ************\_\_\_************

✅ **Pass criteria:** Timestamp appears and is recent

### Step 3: Test Code Change Detection

1. Open: `packages/noodl-editor/src/editor/index.ts`
2. Find line: `console.log('🔥 BUILD TIMESTAMP:', new Date().toISOString());`
3. Change to: `console.log('🔥🔥 BUILD TIMESTAMP:', new Date().toISOString());`
4. **Save the file**
5. Wait 5-10 seconds for webpack to recompile (watch terminal)
6. **Reload Electron app:** Cmd+R (macOS) / Ctrl+R (Windows/Linux)
7. Check console - should show **two fire emojis** now
8. **Write down new timestamp:** ************\_\_\_************

✅ **Pass criteria:**

- Two fire emojis appear
- Timestamp is different from Step 2
- Change appeared within 10 seconds

### Step 4: Test Reliability

1. Change to: `console.log('🔥🔥🔥 BUILD TIMESTAMP:', new Date().toISOString());`
2. Save, wait, reload
3. **Write down timestamp:** ************\_\_\_************

✅ **Pass criteria:** Three fire emojis, new timestamp

### Step 5: Revert Changes

1. Change back to: `console.log('🔥 BUILD TIMESTAMP:', new Date().toISOString());`
2. Save, wait, reload
3. Verify: One fire emoji, new timestamp

✅ **Pass criteria:** Back to original state, timestamps keep updating

---

## Part 2: EventListener Hook Verification (TASK-010)

**Note:** The editor should still be running from Part 1. If you closed it, restart with `npm run dev`.

### Step 6: Verify Test Component Visible

1. Look in **top-right corner** of the editor window
2. You should see a **green panel** labeled: `🧪 EventListener Test`

✅ **Pass criteria:** Test panel is visible

**If not visible:**

- Check console for errors
- Verify import worked: Search console for "useEventListener"
- If component isn't rendering, check Router.tsx

### Step 7: Check Hook Subscription Logs

1. In console, look for these logs:

```
📡 useEventListener subscribing to: componentRenamed
📡 useEventListener subscribing to: ["componentAdded", "componentRemoved"]
📡 useEventListener subscribing to: rootNodeChanged
```

✅ **Pass criteria:** All three subscription logs appear

**If missing:**

- Hook isn't being called
- Check console for errors
- Verify useEventListener.ts exists and is exported

### Step 8: Test Manual Event Trigger

1. In the test panel, click: **🧪 Trigger Test Event**
2. **Check console** for:

```
🧪 Manually triggering componentRenamed event...
🎯 TEST [componentRenamed]: Event received!
```

3. **Check test panel** - should show event in the log with timestamp

✅ **Pass criteria:**

- Console shows event triggered and received
- Test panel shows event entry
- Counter increments

**If fails:**

- Click 📊 Status button to check ProjectModel
- If ProjectModel is null, you need to open a project first

### Step 9: Open a Project

1. If you're on the Projects page, open any project
2. Wait for editor to load
3. Repeat Step 8 - manual trigger should now work

### Step 10: Test Real Component Rename

1. In the component tree (left panel), find any component
2. Right-click → Rename (or double-click to rename)
3. Change the name and press Enter

**Check:**

- Console shows: `🎯 TEST [componentRenamed]: Event received!`
- Test panel logs the rename event with data
- Counter increments

✅ **Pass criteria:** Real rename event is captured

### Step 11: Test Component Add/Remove

1. **Add a component:**

   - Right-click in component tree
   - Select "New Component"
   - Name it and press Enter

2. **Check:**

   - Console: `🎯 TEST [componentAdded]: Event received!`
   - Test panel logs the event

3. **Remove the component:**

   - Right-click the new component
   - Select "Delete"

4. **Check:**
   - Console: `🎯 TEST [componentRemoved]: Event received!`
   - Test panel logs the event

✅ **Pass criteria:** Both add and remove events captured

---

## Part 3: Clean Up

### Step 12: Remove Test Component

1. Close Electron app
2. Open: `packages/noodl-editor/src/editor/src/router.tsx`
3. Remove the import:

```typescript
// TEMPORARY: Phase 0 verification - Remove after TASK-010 complete
import { EventListenerTest } from './views/EventListenerTest';
```

4. Remove from render:

```typescript
{
  /* TEMPORARY: Phase 0 verification - Remove after TASK-010 complete */
}
<EventListenerTest />;
```

5. Save the file

6. Delete the test component:

```bash
rm packages/noodl-editor/src/editor/src/views/EventListenerTest.tsx
```

7. **Optional:** Start editor again to verify it works without test component:

```bash
npm run dev
```

---

## Verification Results

### TASK-009: Cache Fixes

- [ ] Build timestamp appears on startup
- [ ] Code changes load within 10 seconds
- [ ] Timestamps update on each change
- [ ] Tested 3 times successfully

**Status:** ✅ PASS / ❌ FAIL

### TASK-010: EventListener Hook

- [ ] Test component rendered
- [ ] Subscription logs appear
- [ ] Manual test event works
- [ ] Real componentRenamed event works
- [ ] Component add event works
- [ ] Component remove event works

**Status:** ✅ PASS / ❌ FAIL

---

## If Any Tests Fail

### Cache Issues (TASK-009)

1. Run `npm run clean:all` again
2. Manually clear Electron cache:
   - macOS: `~/Library/Application Support/Noodl/`
   - Windows: `%APPDATA%/Noodl/`
   - Linux: `~/.config/Noodl/`
3. Kill all Node/Electron processes: `pkill -f node; pkill -f Electron`
4. Restart from Step 1

### EventListener Issues (TASK-010)

1. Check console for errors
2. Verify hook exists: `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts`
3. Check ProjectModel is loaded (open a project first)
4. Add debug logging to hook
5. Check `.clinerules` has EventListener documentation

---

## Success Criteria

Phase 0 is complete when:

✅ All TASK-009 tests pass
✅ All TASK-010 tests pass
✅ Test component removed
✅ Editor runs without errors
✅ Documentation in place

---

## Next Steps After Verification

Once verified:

1. **Update task status:**
   - Mark TASK-009 as verified
   - Mark TASK-010 as verified
2. **Return to Phase 2 work:**
   - TASK-004B (ComponentsPanel migration) is now UNBLOCKED
   - Future React migrations can use documented pattern
3. **Run health check periodically:**
   ```bash
   npm run health:check
   ```

---

## Troubleshooting Quick Reference

| Problem                        | Solution                                                |
| ------------------------------ | ------------------------------------------------------- |
| Build timestamp doesn't update | Run `npm run clean:all`, restart server                 |
| Changes don't load             | Check webpack compilation in terminal, verify no errors |
| Test component not visible     | Check console for import errors, verify Router.tsx      |
| No subscription logs           | Hook not being called, check imports                    |
| Events not received            | ProjectModel might be null, open a project first        |
| Manual trigger fails           | Check ProjectModel.instance in console                  |

---

**Estimated Total Time:** 20-30 minutes

**Questions?** Check:

- `dev-docs/tasks/phase-0-foundation-stabalisation/QUICK-START.md`
- `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-009-verification-checklist/`
- `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-010-eventlistener-verification/`
