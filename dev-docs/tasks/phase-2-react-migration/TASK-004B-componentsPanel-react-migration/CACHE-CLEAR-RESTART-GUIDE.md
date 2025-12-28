# Cache Clear & Restart Guide

## ✅ Caches Cleared

The following caches have been successfully cleared:

1. ✅ Webpack cache: `packages/noodl-editor/node_modules/.cache`
2. ✅ Electron cache: `~/Library/Application Support/Electron`
3. ✅ OpenNoodl cache: `~/Library/Application Support/OpenNoodl`

## 🔄 How to Restart with Clean Slate

### Step 1: Kill Any Running Processes

Make sure to **completely stop** any running `npm run dev` process:

- Press `Ctrl+C` in the terminal where `npm run dev` is running
- Wait for it to fully stop (both webpack-dev-server AND Electron)

### Step 2: Start Fresh

```bash
cd /Users/richardosborne/vscode_projects/OpenNoodl
npm run dev
```

### Step 3: What to Look For in Console

Once Electron opens, **open the Developer Tools** (View → Toggle Developer Tools or Cmd+Option+I) and check the Console tab.

#### Expected Log Output

You should see these logs IN THIS ORDER when the app starts:

1. **Module Load Markers** (proves new code is loaded):

   ```
   🔥🔥🔥 useEventListener.ts MODULE LOADED WITH DEBUG LOGS - Version 2.0 🔥🔥🔥
   🔥🔥🔥 useComponentsPanel.ts MODULE LOADED WITH FIXES - Version 2.0 🔥🔥🔥
   ```

2. **useComponentsPanel Hook Initialization**:

   ```
   🔍 useComponentsPanel: About to call useEventListener with ProjectModel.instance: [ProjectModel object]
   ```

3. **useEventListener useEffect Running** (THE CRITICAL LOG):

   ```
   🚨 useEventListener useEffect RUNNING! dispatcher: [ProjectModel] eventName: ["componentAdded", "componentRemoved", "componentRenamed", "rootNodeChanged"]
   ```

4. **Subscription Confirmation**:
   ```
   📡 useEventListener subscribing to: ["componentAdded", "componentRemoved", "componentRenamed", "rootNodeChanged"] on dispatcher: [ProjectModel]
   ```

### Step 4: Test Component Rename

1. Right-click on any component in the Components Panel
2. Choose "Rename Component"
3. Type a new name and press Enter

#### Expected Behavior After Rename

You should see these logs:

```
🔔 useEventListener received event: componentRenamed data: {...}
🎉 Event received! Updating counter...
```

AND the UI should immediately update to show the new component name.

## 🚨 Troubleshooting

### If you DON'T see the 🔥 module load markers:

The old code is still loading. Try:

1. Completely close Electron (not just Dev Tools - the whole window)
2. Stop webpack-dev-server (Ctrl+C)
3. Check for any lingering Electron processes: `ps aux | grep -i electron | grep -v grep`
4. Kill them if found: `killall Electron`
5. Run `npm run dev` again

### If you see 🔥 markers but NOT the 🚨 useEffect marker:

This means:

- The modules are loading correctly
- BUT useEffect is not running (React dependency issue)
- This would be very surprising given our fix, so please report exactly what logs you DO see

### If you see 🚨 marker but no 🔔 event logs when renaming:

This means:

- useEffect is running and subscribing
- BUT ProjectModel is not emitting events
- This would indicate the ProjectModel event system isn't working

## 📝 What to Report Back

Please check the console and let me know:

1. ✅ or ❌ Do you see the 🔥 module load markers?
2. ✅ or ❌ Do you see the 🚨 useEffect RUNNING marker?
3. ✅ or ❌ Do you see the 📡 subscription marker?
4. ✅ or ❌ When you rename a component, do you see 🔔 event received logs?
5. ✅ or ❌ Does the UI update immediately after rename?

---

**Next Steps:**

- Once this works, we'll remove all the debug logging
- Document the fix in LEARNINGS.md
- Mark TASK-004B Phase 5 (Inline Rename) as complete
