# Project Learnings

This document captures important discoveries and gotchas encountered during OpenNoodl development.

---

## 🚨 CRITICAL: React + EventDispatcher Incompatibility (Phase 0, Dec 2025)

### The Silent Killer: Direct `.on()` Subscriptions in React

**Context**: Phase 0 Foundation Stabilization discovered a critical, silent failure mode that was blocking all React migration work.

**The Problem**: EventDispatcher's `.on()` method **silently fails** when used directly in React components. Events are emitted, but React never receives them. No errors, no warnings, just silence.

**Root Cause**: Fundamental incompatibility between:

- EventDispatcher's context-object-based cleanup pattern
- React's closure-based lifecycle management

**The Broken Pattern** (compiles and runs without errors):

```typescript
// ❌ THIS SILENTLY FAILS - DO NOT USE
function MyComponent() {
  useEffect(() => {
    const context = {};
    ProjectModel.instance.on('componentRenamed', handler, context);
    return () => ProjectModel.instance.off(context); // Context reference doesn't match
  }, []);

  // Events are emitted but NEVER received
  // Hours of debugging later...
}
```

**The Solution** - Always use `useEventListener` hook:

```typescript
// ✅ THIS WORKS - ALWAYS USE THIS
import { useEventListener } from '@noodl-hooks/useEventListener';

function MyComponent() {
  useEventListener(ProjectModel.instance, 'componentRenamed', (data) => {
    // Events received correctly!
  });
}
```

**Why This Matters**:

- Wasted 10+ hours per React migration debugging this
- Affects ALL EventDispatcher usage in React (ProjectModel, NodeLibrary, WarningsModel, etc.)
- Silent failures are the worst kind of bug

**Full Documentation**:

- Pattern Guide: `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-011-react-event-pattern-guide/GOLDEN-PATTERN.md`
- Investigation: `dev-docs/tasks/phase-0-foundation-stabalisation/TASK-008-eventdispatcher-react-investigation/`
- Also in: `.clinerules` (Section: React + EventDispatcher Integration)

**Keywords**: EventDispatcher, React, useEventListener, silent failure, event subscription, Phase 0

---

## React Hooks & EventDispatcher Integration (Dec 2025)

### Problem: EventDispatcher Events Not Reaching React Hooks

**Context**: During TASK-004B (ComponentsPanel React migration), discovered that `componentRenamed` events from ProjectModel weren't triggering UI updates in React components.

**Root Cause**: Array reference instability causing useEffect to constantly re-subscribe/unsubscribe.

**Discovery**:

```typescript
// ❌ BAD - Creates new array on every render
useEventListener(
  ProjectModel.instance,
  ['componentAdded', 'componentRemoved', 'componentRenamed', 'rootNodeChanged'],
  callback
);

// ✅ GOOD - Stable reference prevents re-subscription
const PROJECT_EVENTS = ['componentAdded', 'componentRemoved', 'componentRenamed', 'rootNodeChanged'];
useEventListener(ProjectModel.instance, PROJECT_EVENTS, callback);
```

**Location**:

- `packages/noodl-editor/src/editor/src/hooks/useEventListener.ts`
- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`

**Keywords**: EventDispatcher, React hooks, useEffect, event subscription, array reference, re-render

---

## Hot Reload Issues with React Hooks (Dec 2025)

**Context**: Code changes to React hooks not taking effect despite webpack hot reload.

**Discovery**: React hooks sometimes require a **hard browser refresh** or **dev server restart** to pick up changes, especially:

- Changes to `useEffect` dependencies
- Changes to custom hooks
- Changes to event subscription logic

**Solution**:

1. Try hard refresh first: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. If that fails, restart dev server: Stop (Ctrl+C) and `npm run dev`
3. Clear browser cache if issues persist

**Location**: Affects all React hook development

**Keywords**: hot reload, React hooks, webpack, dev server, browser cache

---

## Webpack 5 Persistent Caching Issues (Dec 2025)

### Problem: Code Changes Not Loading Despite Dev Server Restart

**Context**: During TASK-004B, discovered that TypeScript source file changes weren't appearing in the running Electron app, even after multiple `npm run dev` restarts and cache clearing attempts.

**Root Cause**: Webpack 5 enables aggressive persistent caching by default:

- **Primary cache**: `packages/noodl-editor/node_modules/.cache`
- **Electron cache**: `~/Library/Application Support/Electron` (macOS)
- **App cache**: `~/Library/Application Support/OpenNoodl` (macOS)

**Discovery**: Standard cache clearing may not be sufficient. The caches can persist across:

- Dev server restarts
- Electron restarts
- Multiple rapid development iterations

**Solution**:

```bash
# Kill any running processes first
killall node
killall Electron

# Clear all caches
cd packages/noodl-editor
rm -rf node_modules/.cache
rm -rf ~/Library/Application\ Support/Electron
rm -rf ~/Library/Application\ Support/OpenNoodl

# Start fresh
npm run dev
```

**Best Practice**: When debugging webpack/compilation issues, add module-level console.log markers at the TOP of your files to verify new code is loading:

```typescript
// At top of file
console.log('🔥 MyModule.ts LOADED - Version 2.0');
```

If you don't see this marker in the console, your changes aren't loading - it's a cache/build issue, not a code issue.

**Location**: Affects all webpack-compiled code in `packages/noodl-editor/`

**Keywords**: webpack, cache, persistent caching, hot reload, dev server, Electron

---

## React 19 useEffect with Array Dependencies (Dec 2025)

### Problem: useEffect with Array Dependency Never Executes

**Context**: During TASK-004B, discovered that passing an array as a single dependency to useEffect prevents the effect from ever running.

**Root Cause**: React 19's `Object.is()` comparison for dependencies doesn't work correctly when an array is passed as a single dependency item.

**Discovery**:

```typescript
// ❌ BROKEN - useEffect NEVER runs
const eventNames = ['event1', 'event2', 'event3'];
useEffect(() => {
  console.log('This never prints!');
}, [dispatcher, eventNames]); // eventNames is an array reference

// ✅ CORRECT - Spread array into individual dependencies
const eventNames = ['event1', 'event2', 'event3'];
useEffect(() => {
  console.log('This runs correctly');
}, [dispatcher, ...eventNames]); // Spreads to: [dispatcher, 'event1', 'event2', 'event3']

// ✅ ALSO CORRECT - Use stable array reference outside component
const EVENT_NAMES = ['event1', 'event2', 'event3']; // Outside component

function MyComponent() {
  useEffect(() => {
    // Works because EVENT_NAMES reference is stable
  }, [dispatcher, ...EVENT_NAMES]);
}
```

**Critical Rule**: **Never pass an array as a dependency to useEffect. Always spread it.**

**Location**: Affects `useEventListener` hook and any custom hooks with array dependencies

**Keywords**: React 19, useEffect, dependencies, array, Object.is, spread operator, hook lifecycle

---

## 🔥 CRITICAL: Singleton Dependency Timing in useEffect (Dec 2025)

### The Silent Subscriber: Missing Singleton Dependencies

**Context**: Phase 0 completion - Final bug preventing EventDispatcher events from reaching React components.

**The Problem**: Components that subscribe to singleton instances (like `ProjectModel.instance`) in useEffect often mount **before** the singleton is initialized. With an empty dependency array, the effect only runs once when the instance is `null/undefined`, and never re-runs when the instance is set.

**Symptom**: Events are emitted, logs show event firing, but React components never receive them.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Subscribes before instance exists, never re-subscribes
function MyComponent() {
  useEffect(() => {
    console.log('Setting up subscriptions');
    if (!ProjectModel.instance) {
      console.log('Instance is null'); // This prints
      return;
    }

    ProjectModel.instance.on('event', handler, group);
    // This NEVER executes because instance is null at mount
    // and useEffect never runs again!
  }, []); // Empty deps = only runs once at mount
}
```

**Timeline of Failure**:

1. Component mounts → useEffect runs
2. `ProjectModel.instance` is `null` (project not loaded yet)
3. Early return, no subscription
4. Project loads → `ProjectModel.instance` gets set
5. **useEffect doesn't re-run** (instance not in deps)
6. Events fire but nobody's listening 🦗

**The Solution**:

```typescript
// ✅ RIGHT - Re-subscribes when instance changes from null to defined
function MyComponent() {
  useEffect(() => {
    console.log('Setting up subscriptions');
    if (!ProjectModel.instance) {
      console.log('Instance is null, will retry when available');
      return;
    }

    const group = { id: 'mySubscription' };
    ProjectModel.instance.on('event', handler, group);
    console.log('Subscribed successfully!');

    return () => {
      if (ProjectModel.instance) {
        ProjectModel.instance.off(group);
      }
    };
  }, [ProjectModel.instance]); // RE-RUNS when instance changes!
}
```

**Critical Rule**: **Always include singleton instances in useEffect dependencies if you're subscribing to them.**

**Affected Singletons**:

- `ProjectModel.instance`
- `NodeLibrary.instance`
- `WarningsModel.instance`
- `EventDispatcher.instance`
- `UndoQueue.instance`

**Location**:

- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts` (line 76)
- Any React component using EventDispatcher with singleton instances

**Keywords**: singleton, useEffect, dependencies, timing, ProjectModel, EventDispatcher, subscription, React lifecycle

---

## 🔥 CRITICAL: UndoActionGroup.do() Silent Failure (Dec 2025)

### The Invisible Bug: Actions That Don't Execute

**Context**: Phase 0 completion - Discovered why `ProjectModel.renameComponent()` was never being called despite the undo system reporting success.

**The Problem**: `UndoActionGroup.push()` followed by `undoGroup.do()` **silently fails to execute** due to an internal pointer bug. The action is recorded for undo/redo, but never actually executes.

**Root Cause**: `UndoActionGroup` maintains an internal `ptr` (pointer) that tracks which actions have been executed:

- `push()` increments `ptr` to `actions.length`
- `do()` loops from `ptr` to `actions.length`
- But if `ptr === actions.length`, the loop never runs!

**The Broken Pattern**:

```typescript
// ❌ WRONG - Action recorded but NEVER executes
const undoGroup = new UndoActionGroup({
  label: 'Rename component'
});

UndoQueue.instance.push(undoGroup);

undoGroup.push({
  do: () => {
    ProjectModel.instance.renameComponent(component, newName);
    // ☠️ THIS NEVER RUNS ☠️
  },
  undo: () => {
    ProjectModel.instance.renameComponent(component, oldName);
  }
});

undoGroup.do(); // Loop condition is already false (ptr === actions.length)

// Result:
// - Returns true ✅
// - Undo/redo works ✅
// - But initial action NEVER executes ❌
```

**Why It's Dangerous**:

- No errors or warnings
- Returns success
- Undo/redo actually works (if you manually trigger the action first)
- Can waste hours debugging because everything "looks correct"

**The Solution**:

```typescript
// ✅ RIGHT - Use pushAndDo pattern (action in constructor)
UndoQueue.instance.pushAndDo(
  new UndoActionGroup({
    label: 'Rename component',
    do: () => {
      ProjectModel.instance.renameComponent(component, newName);
    },
    undo: () => {
      ProjectModel.instance.renameComponent(component, oldName);
    }
  })
);

// This works because:
// 1. Action added in constructor (ptr still 0)
// 2. pushAndDo() calls do() which loops from 0 to 1
// 3. Action executes! 🎉
```

**Alternative Pattern** (if you need to build complex undo groups):

```typescript
// ✅ ALSO RIGHT - Use pushAndDo on individual actions
const undoGroup = new UndoActionGroup({ label: 'Complex operation' });
UndoQueue.instance.push(undoGroup);

undoGroup.pushAndDo({
  // Note: pushAndDo, not push!
  do: () => {
    /* first action */
  },
  undo: () => {
    /* undo first */
  }
});

undoGroup.pushAndDo({
  // Note: pushAndDo, not push!
  do: () => {
    /* second action */
  },
  undo: () => {
    /* undo second */
  }
});
```

**Critical Rule**: **Never use `undoGroup.push()` + `undoGroup.do()`. Always use `UndoQueue.instance.pushAndDo()` or `undoGroup.pushAndDo()`.**

**Code Evidence** (from `undo-queue-model.ts` lines 108-115):

```typescript
do() {
  for (var i = this.ptr; i < this.actions.length; i++) {
    // If ptr === actions.length, this loop never runs!
    var a = this.actions[i];
    a.do && a.do();
  }
  this.ptr = this.actions.length;
}
```

**Location**:

- `packages/noodl-editor/src/editor/src/models/undo-queue-model.ts`
- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentActions.ts` (line 174)

**Detection**: Add debug logging to your action's `do()` function. If it never prints, you have this bug.

**Keywords**: UndoQueue, UndoActionGroup, silent failure, do, push, pushAndDo, undo, redo, pointer bug

---

## PopupLayer API Confusion: showPopup vs showPopout (Dec 2025)

### The Invisible Menu: Wrong API, Silent Failure

**Context**: TASK-008 ComponentsPanel menus - Plus button menu logged "Popup shown successfully" but nothing appeared on screen.

**The Problem**: PopupLayer has **two different methods** for displaying overlays, each with different parameters and behaviors. Using the wrong one causes silent failures where the popup/popout doesn't appear, but no error is thrown.

**Root Cause**: API confusion between modals and attached menus.

**The Two APIs**:

```typescript
// 1. showPopup() - For centered modals/dialogs
PopupLayer.instance.showPopup({
  content: popupObject, // Direct object reference
  position: 'screen-center', // Only supports 'screen-center'
  isBackgroundDimmed: true // Optional: dims background for modals
});

// 2. showPopout() - For attached dropdowns/menus
PopupLayer.instance.showPopout({
  content: { el: jQueryElement }, // Must wrap in { el: ... }
  attachTo: $(element), // jQuery element to attach to
  position: 'bottom', // Supports 'bottom'|'top'|'left'|'right'
  arrowColor: '313131' // Optional: arrow indicator color
});
```

**The Broken Pattern**:

```typescript
// ❌ WRONG - showPopup doesn't support position: 'bottom'
const menu = new PopupMenu({ items, owner: PopupLayer.instance });
menu.render();

PopupLayer.instance.showPopup({
  content: menu,
  attachTo: $(buttonRef.current),
  position: 'bottom' // showPopup ignores this!
});
// Logs success, but menu never appears
```

**The Solution**:

```typescript
// ✅ RIGHT - showPopout for attached menus
const menu = new PopupMenu({ items, owner: PopupLayer.instance });
menu.render();

PopupLayer.instance.showPopout({
  content: { el: menu.el }, // Wrap in { el: ... }
  attachTo: $(buttonRef.current),
  position: 'bottom'
});
// Menu appears below button with arrow indicator!
```

**Rule of Thumb**:

- **Use `showPopup()`** for:
  - Modal dialogs (confirmation, input, etc.)
  - Centered popups
  - When you need `isBackgroundDimmed`
- **Use `showPopout()`** for:
  - Dropdown menus
  - Context menus
  - Tooltips
  - Anything attached to a specific element

**Common Gotchas**:

1. **Content format differs**:

   - `showPopup()` takes direct object: `content: popup`
   - `showPopout()` requires wrapper: `content: { el: popup.el }`

2. **Position values differ**:

   - `showPopup()` only supports `'screen-center'`
   - `showPopout()` supports `'bottom'|'top'|'left'|'right'`

3. **No error on wrong usage** - silent failure is the symptom

**Location**:

- Type definitions: `packages/noodl-editor/src/editor/src/views/popuplayer.d.ts`
- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanelReact.tsx` (line 157)

**Related Issues**:

- **Template popup visibility**: Also needed `isBackgroundDimmed: true` flag to make modal properly visible with dimmed background

**Detection**: If popup/popout logs success but doesn't appear, check:

1. Are you using the right API method?
2. Is the content format correct for that API?
3. Is the position value supported by that API?

**Keywords**: PopupLayer, showPopup, showPopout, menu, dropdown, modal, position, silent failure, UI

---

## 🔥 CRITICAL: React Button Clicks vs Cursor-Based Menu Positioning (Dec 2025)

### The Button Click Nightmare: When Menus Just Won't Work

**Context**: TASK-008 ComponentsPanel menus - Spent hours trying to show a dropdown menu from a plus button click. Multiple approaches all failed in different spectacular ways.

**The Problem**: `showContextMenuInPopup()` utility (which works perfectly for right-click context menus) **completely fails** when triggered from a button click event. The fundamental issue is that this utility uses `screen.getCursorScreenPoint()` for positioning, which gives you the cursor position at the _moment the function runs_, not where the button is located.

**Timeline of Failed Attempts**:

1. **Attempt 1: showContextMenuInPopup() from button click**

   - **Result**: Silent failure - no menu appears, no errors
   - **Why**: Uses `screen.getCursorScreenPoint()` which gives cursor position after the click moved away from the button
   - **Duration**: 1+ hours debugging

2. **Attempt 2: PopupLayer.showPopout() with button ref**

   - **Result**: Silent failures despite "success" logs
   - **Why**: Content format issues, API confusion
   - **Duration**: 1+ hours debugging

3. **Attempt 3: NewPopupLayer.PopupMenu constructor**

   - **Result**: Runtime error "NewPopupLayer.PopupMenu is not a constructor"
   - **Why**: PopupMenu not properly exported/accessible
   - **Duration**: 30 minutes debugging

4. **Attempt 4: Got PopupMenu to render after fixing imports**

   - **Result**: Menu appeared, but click handlers didn't fire
   - **Why**: Event delegation issues in legacy jQuery code
   - **Duration**: 1+ hours debugging, multiple cache clears

5. **Pragmatic Solution: Remove button, use right-click on empty space**
   - **Result**: Works perfectly using proven showContextMenuInPopup() pattern
   - **Why**: Right-click naturally provides cursor position for menu positioning

**The Core Issue**: React + Electron menu positioning from button clicks is fundamentally problematic:

```typescript
// ❌ FAILS - Cursor has moved away from button by the time this runs
const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  showContextMenuInPopup({
    items: menuItems,
    width: MenuDialogWidth.Default
  });
  // Internally calls screen.getCursorScreenPoint()
  // But cursor is no longer over the button!
  // Menu appears at random location or not at all
};

// ✅ WORKS - Cursor is naturally at right position
const handleRightClick = (e: React.MouseEvent) => {
  e.preventDefault();
  showContextMenuInPopup({
    items: menuItems,
    width: MenuDialogWidth.Default
  });
  // Cursor is exactly where user right-clicked
  // Menu appears at correct location
};
```

**Why Button Clicks Fail**:

1. User clicks button
2. React synthetic event fires
3. Event propagates through React and into Electron
4. By the time `showContextMenuInPopup()` runs, cursor has moved
5. `screen.getCursorScreenPoint()` gives wrong position
6. Menu either doesn't appear or appears in wrong location

**Why Right-Click Works**:

1. User right-clicks
2. Context menu event fires
3. Cursor is still exactly where user clicked
4. `screen.getCursorScreenPoint()` gives correct position
5. Menu appears at cursor location (expected UX)

**The Working Pattern**:

```typescript
// In ComponentsPanelReact.tsx
const handleTreeContextMenu = useCallback(
  (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const templates = ComponentTemplates.instance.getTemplates({
      forRuntimeType: 'browser'
    });

    const items: TSFixme[] = templates.map((template) => ({
      icon: template.icon,
      label: `Create ${template.label}`,
      onClick: () => handleAddComponent(template)
    }));

    items.push({
      icon: IconName.FolderClosed,
      label: 'Create Folder',
      onClick: () => handleAddFolder()
    });

    showContextMenuInPopup({
      items,
      width: MenuDialogWidth.Default
    });
  },
  [handleAddComponent, handleAddFolder]
);

// Attach to tree container for empty space clicks
<div className={css['Tree']} onContextMenu={handleTreeContextMenu}>
```

**PopupMenu Constructor Issues**:

When trying direct PopupMenu usage, encountered:

```typescript
// ❌ FAILS - "PopupMenu is not a constructor"
import NewPopupLayer from '../popuplayer/popuplayer';

const menu = new NewPopupLayer.PopupMenu({ items });

// Even after fixing imports, menu rendered but clicks didn't work
// Legacy jQuery event delegation issues in React context
```

**Critical Lessons**:

1. **Never use button clicks to trigger showContextMenuInPopup()** - cursor positioning will be wrong
2. **Right-click context menus are reliable** - cursor position is naturally correct
3. **Legacy PopupLayer/PopupMenu integration with React is fragile** - avoid if possible
4. **When something fails repeatedly with the same pattern, change the approach** - "this is the renaming task all over again"
5. **Pragmatic UX is better than broken UX** - right-click on empty space works fine

**UX Implications**:

- Plus buttons for dropdown menus are problematic in Electron
- Right-click context menus are more reliable
- Users can right-click on components, folders, or empty space to access create menu
- This pattern is actually more discoverable (common in native apps)

**Location**:

- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanelReact.tsx`
- Utility: `packages/noodl-editor/src/editor/src/views/ShowContextMenuInPopup.tsx`
- Task: `dev-docs/tasks/phase-2/TASK-008-componentspanel-menus-and-sheets/`

**References**:

- ComponentItem.tsx - working right-click context menu example
- FolderItem.tsx - working right-click context menu example

**Detection**: If showContextMenuInPopup() works from right-click but not from button click, you have this issue.

**Keywords**: showContextMenuInPopup, cursor position, button click, right-click, context menu, Electron, React, PopupMenu, menu positioning, UX

---

## 🔥 CRITICAL: Mutable Data Sources + React useMemo (Dec 2025)

### Problem: useMemo Not Recalculating Despite Dependency Change

**Context**: TASK-008 Sheet creation - New sheets weren't appearing in dropdown despite event received and updateCounter state changing.

**Root Cause**: `ProjectModel.getComponents()` returns the **same array reference** each time. When a component is added, the array is mutated (push) rather than replaced. React's `Object.is()` comparison sees the same reference and skips recalculation.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Same array reference, useMemo skips recalculation
const rawComponents = useMemo(() => {
  if (!ProjectModel.instance) return [];
  return ProjectModel.instance.getComponents(); // Returns same mutated array
}, [updateCounter]); // Even when updateCounter changes!

// Dependent memos never run because rawComponents reference is unchanged
const sheets = useMemo(() => {
  // This never executes after component added
}, [rawComponents]);
```

**The Solution**:

```typescript
// ✅ RIGHT - Spread creates new array reference, forces recalculation
const rawComponents = useMemo(() => {
  if (!ProjectModel.instance) return [];
  return [...ProjectModel.instance.getComponents()]; // New reference!
}, [updateCounter]);
```

**Why This Happens**:

1. `getComponents()` returns the internal array (same reference)
2. When component is added, array is mutated with `push()`
3. `Object.is(oldArray, newArray)` returns `true` (same reference)
4. useMemo thinks nothing changed, skips recalculation
5. Spreading `[...array]` creates new reference → forces recalculation

**Critical Rule**: When consuming mutable data sources (EventDispatcher models, etc.) in useMemo, **always spread arrays** to create new references.

**Affected Patterns**:

- `ProjectModel.instance.getComponents()`
- Any `Model.getX()` that returns internal arrays
- Collections that mutate rather than replace

**Location**: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`

**Keywords**: useMemo, array reference, Object.is, mutable data, spread operator, React, recalculation, EventDispatcher

---

## 🔥 CRITICAL: HTML5 DnD vs Mouse-Based Dragging - onDrop Never Fires (Dec 2025)

### The Silent Drop: When onDrop Never Triggers

**Context**: TASK-008C ComponentsPanel drag-drop system - All drop handlers existed and appeared correct, but drops never completed. Items would snap back to origin.

**The Problem**: The drag-drop implementation used `onDrop` React event handlers, but the underlying PopupLayer drag system uses **mouse-based dragging**, not **HTML5 Drag-and-Drop API**. The HTML5 `onDrop` event **never fires** for mouse-based drag systems.

**Root Cause**: Fundamental API mismatch between the drag initiation system and drop detection.

**The Two Drag Systems**:

1. **HTML5 Drag-and-Drop API**:

   - Uses `draggable="true"` attribute
   - Events: `ondragstart`, `ondragenter`, `ondragover`, `ondragleave`, `ondrop`
   - Native browser implementation with built-in ghost image
   - `onDrop` fires when dropping a dragged element

2. **Mouse-Based Dragging (PopupLayer)**:
   - Uses `onMouseDown`, `onMouseMove`, `onMouseUp`
   - Custom implementation that moves a label element with cursor
   - `onDrop` **never fires** - must use `onMouseUp` to detect drop

**The Broken Pattern**:

```typescript
// ❌ WRONG - onDrop never fires for PopupLayer drag system
const handleDrop = useCallback(() => {
  if (isDropTarget && onDrop) {
    const node: TreeNode = { type: 'component', data: component };
    onDrop(node);  // Never reached!
    setIsDropTarget(false);
  }
}, [isDropTarget, component, onDrop]);

// JSX
<div
  onMouseEnter={handleMouseEnter}  // ✅ Works - sets isDropTarget
  onMouseLeave={handleMouseLeave}  // ✅ Works - clears isDropTarget
  onDrop={handleDrop}              // ❌ NEVER FIRES
>
```

**The Solution**:

```typescript
// ✅ RIGHT - Use onMouseUp to trigger drop
const handleMouseUp = useCallback(
  (e: React.MouseEvent) => {
    dragStartPos.current = null;

    // If this item is a valid drop target, execute the drop
    if (isDropTarget && onDrop) {
      e.stopPropagation(); // Prevent bubble to parent
      const node: TreeNode = { type: 'component', data: component };
      onDrop(node);
      setIsDropTarget(false);
    }
  },
  [isDropTarget, component, onDrop]
);

// JSX
<div
  onMouseEnter={handleMouseEnter}  // ✅ Sets isDropTarget
  onMouseLeave={handleMouseLeave}  // ✅ Clears isDropTarget
  onMouseUp={handleMouseUp}        // ✅ Triggers drop when isDropTarget
>
```

**Why This Works**:

1. User starts drag via `onMouseDown` + `onMouseMove` (5px threshold) → `PopupLayer.startDragging()`
2. User hovers over target → `onMouseEnter` sets `isDropTarget = true`
3. User releases mouse → `onMouseUp` checks `isDropTarget` and executes drop
4. `e.stopPropagation()` prevents event bubbling to parent containers

**Root Drop Zone Pattern**:

For dropping onto empty space (background), use event bubbling:

```typescript
// In parent container
const handleTreeMouseUp = useCallback(() => {
  const PopupLayer = require('@noodl-views/popuplayer');

  // If we're dragging and no specific item claimed the drop, it's a root drop
  if (draggedItem && PopupLayer.instance.isDragging()) {
    handleDropOnRoot(draggedItem);
  }
}, [draggedItem, handleDropOnRoot]);

// JSX
<div className={css['Tree']} onMouseUp={handleTreeMouseUp}>
  {/* Tree items call e.stopPropagation() on valid drops */}
  {/* If no item stops propagation, this handler catches it */}
</div>;
```

**Critical Rule**: **If using PopupLayer's drag system, always use `onMouseUp` for drop detection, never `onDrop`.**

**Detection**: If drops appear to work (visual feedback shows) but never complete (items snap back), check if you're using `onDrop` instead of `onMouseUp`.

**Location**:

- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/components/ComponentItem.tsx`
- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/components/FolderItem.tsx`
- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanelReact.tsx`
- Task: `dev-docs/tasks/phase-2/TASK-008-componentspanel-menus-and-sheets/TASK-008C-drag-drop-system.md`

**Keywords**: onDrop, onMouseUp, HTML5 DnD, drag-and-drop, PopupLayer, mouse events, drop handler, snap back

---

## 🔥 CRITICAL: Runtime Node Creation - The Unholy Trinity of Silent Failures (Dec 2025)

### The HTTP Node Debugging Saga: 3+ Hours of Silent Failures

**Context**: Creating an HTTP node (httpnode.js) as a modern, no-code-friendly alternative to the script-based REST node. Everything looked correct but nothing worked. Signals never fired, config values never set, and no errors anywhere.

**The Problems Found** (each took significant debugging time):

#### Problem 1: Signal Input Using `set` Instead of `valueChangedToTrue`

```javascript
// ❌ WHAT I WROTE (never triggers)
inputs: {
  fetch: {
    type: 'signal',
    set: function(value) {
      this.scheduleFetch();  // ☠️ Never called
    }
  }
}

// ✅ WHAT IT SHOULD BE
inputs: {
  fetch: {
    type: 'signal',
    valueChangedToTrue: function() {
      this.scheduleFetch();  // ✓ Works!
    }
  }
}
```

**Why**: Signals use `EdgeTriggeredInput.createSetter()` which wraps the callback and only calls `valueChangedToTrue` when value transitions from falsy to truthy. The `set` callback is never used.

#### Problem 2: Custom `setInputValue` Overriding Base Method

```javascript
// ❌ WHAT I WROTE (breaks ALL inputs including signals)
prototypeExtensions: {
  setInputValue: function(name, value) {
    this._internal.inputValues[name] = value;  // ☠️ Overrides Node.prototype.setInputValue
  }
}

// ✅ WHAT IT SHOULD BE
prototypeExtensions: {
  _storeInputValue: function(name, value) {  // Different name!
    this._internal.inputValues[name] = value;
  }
}
```

**Why**: `prototypeExtensions` methods are merged into node prototype. Defining `setInputValue` completely replaces the base implementation, which handles signal detection, input.set() calls, and event emission.

#### Problem 3: Dynamic Ports Replacing Static Ports

```javascript
// ❌ WHAT I WROTE (static ports disappear)
function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [];
  // Only add dynamic header/query param ports...
  if (parameters.headers) { /* add header ports */ }
  editorConnection.sendDynamicPorts(nodeId, ports);  // Static inputs GONE!
}

// ✅ WHAT IT SHOULD BE
function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [
    // Re-add ALL static inputs
    { name: 'url', displayName: 'URL', type: 'string', plug: 'input', group: 'Request' },
    { name: 'fetch', displayName: 'Fetch', type: 'signal', plug: 'input', group: 'Actions' },
    { name: 'cancel', displayName: 'Cancel', type: 'signal', plug: 'input', group: 'Actions' },
    // Then dynamic ports...
  ];
  editorConnection.sendDynamicPorts(nodeId, ports);
}
```

**Why**: `sendDynamicPorts` REPLACES all ports, not merges. The `inputs` object in node definition is only for default setup - once dynamic ports are sent, they're the only ports.

#### Problem 4: Config Inputs (StringList/Enum) Need Explicit Registration

```javascript
// ❌ MISSING (config values never reach setters)
// StringList inputs like "headers", "queryParams" appear in editor but their
// values never reach the node because there's no registered input handler

// ✅ WHAT IT NEEDS
registerInputIfNeeded: function(name) {
  if (this.hasInput(name)) return;

  const configSetters = {
    'method': this.setMethod.bind(this),
    'headers': this.setHeaders.bind(this),
    'queryParams': this.setQueryParams.bind(this),
    'bodyType': this.setBodyType.bind(this),
    // ... all config inputs
  };

  if (configSetters[name]) {
    return this.registerInput(name, { set: configSetters[name] });
  }

  // Dynamic inputs (header-X, query-Y, etc.)
  if (name.startsWith('header-')) {
    return this.registerInput(name, {
      set: this._storeInputValue.bind(this, name)
    });
  }
}
```

**Why**: Inputs defined in the `inputs` object get registered automatically. Dynamic ports don't - they need `registerInputIfNeeded` to create runtime handlers.

**Why This Was So Hard to Debug**:

1. **No errors** - Everything appeared to work, logs said "success", but nothing happened
2. **Partial success** - Some things worked (node appeared in palette) making it seem close
3. **Multiple bugs** - Each fix revealed the next bug, each taking time to diagnose
4. **No TypeScript** - Runtime code is JS, no compile-time checking
5. **Unfamiliar patterns** - `valueChangedToTrue`, `registerInputIfNeeded`, etc. aren't obvious

**Time Lost**: 3+ hours debugging what should have been a straightforward node

**Prevention**:

- Created `dev-docs/reference/LEARNINGS-NODE-CREATION.md` with Critical Gotchas section
- Added Node Creation Checklist to `.clinerules` Section 14
- These gotchas are now documented with THE BUG / WHY IT BREAKS / THE FIX patterns

**Location**:

- `packages/noodl-runtime/src/nodes/std-library/data/httpnode.js` (fixed)
- `dev-docs/reference/LEARNINGS-NODE-CREATION.md` (new documentation)

**Keywords**: node creation, signal, valueChangedToTrue, setInputValue, prototypeExtensions, sendDynamicPorts, registerInputIfNeeded, stringlist, enum, config inputs, HTTP node, runtime

---

## 🔥 CRITICAL: PopupLayer.dragCompleted() - Not endDrag() (Dec 2025)

### Wrong Method Name Causes TypeError

**Context**: TASK-008C ComponentsPanel drag-drop system - After fixing the onDrop→onMouseUp issue, drops still failed with a TypeError.

**The Error**:

```
TypeError: PopupLayer.instance.endDrag is not a function
```

**The Problem**: Code was calling `PopupLayer.instance.endDrag()`, but this method **doesn't exist**. The correct method is `dragCompleted()`.

**Root Cause**: Method name was guessed or hallucinated rather than verified against the actual PopupLayer source code.

**The Broken Pattern**:

```typescript
// ❌ WRONG - endDrag() doesn't exist
const handleDrop = () => {
  // ... do drop operation
  PopupLayer.instance.endDrag(); // TypeError!
};
```

**The Solution**:

```typescript
// ✅ RIGHT - Use dragCompleted()
const handleDrop = () => {
  // ... do drop operation
  PopupLayer.instance.dragCompleted(); // Works!
};
```

**PopupLayer Drag API Reference** (from `popuplayer.js`):

```javascript
// Start drag with label that follows cursor
PopupLayer.prototype.startDragging = function (args) {
  // args: { label: string }
  // Creates .popup-layer-dragger element
};

// Check if currently dragging
PopupLayer.prototype.isDragging = function () {
  return this.dragItem !== undefined;
};

// Show cursor feedback during drag
PopupLayer.prototype.indicateDropType = function (droptype) {
  // droptype: 'move' | 'copy' | 'none'
};

// ✅ CORRECT: Complete the drag operation
PopupLayer.prototype.dragCompleted = function () {
  this.$('.popup-layer-dragger').css({ opacity: '0' });
  this.dragItem = undefined;
};
```

**Critical Rule**: **Always verify method names against actual source code. Never guess or assume API method names.**

**Why This Matters**:

- Silent TypeErrors at runtime
- Method names like `endDrag` vs `dragCompleted` are easy to confuse
- Legacy JavaScript codebase has no TypeScript definitions to catch this

**Detection**: If you get `X is not a function` error on PopupLayer, check `popuplayer.js` for the actual method name.

**Location**:

- PopupLayer source: `packages/noodl-editor/src/editor/src/views/popuplayer/popuplayer.js`
- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentActions.ts`

**Keywords**: PopupLayer, dragCompleted, endDrag, TypeError, drag-and-drop, method name, API

---

## NoodlRuntime.instance.getMetaData() Pattern for Project Data (Dec 2025)

### How Runtime Nodes Access Project Metadata

**Context**: BYOB Query Data node needed to access backend services configuration (URLs, tokens, schema) from runtime code.

**The Pattern**: Use `NoodlRuntime.instance.getMetaData(key)` to access project metadata stored in graphModel.

**Working Example** (from byob-query-data.js):

```javascript
const NoodlRuntime = require('../../../../noodl-runtime');

resolveBackend: function() {
  // Get metadata - same pattern as cloudstore.js uses for cloudservices
  const backendServices = NoodlRuntime.instance.getMetaData('backendServices');

  if (!backendServices || !backendServices.backends) {
    console.log('[BYOB Query Data] No backend services metadata found');
    console.log('[BYOB Query Data] Available metadata keys:',
                Object.keys(NoodlRuntime.instance.metadata || {}));
    return null;
  }

  // Access the data
  const backends = backendServices.backends || [];
  const activeBackendId = backendServices.activeBackendId;

  // Find and use the backend config...
}
```

**Reference Implementation** (from `src/api/cloudstore.js`):

```javascript
const NoodlRuntime = require('../../noodl-runtime');

// Access cloud services config
const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices');
```

**How It Works**:

- `NoodlRuntime.prototype.getMetaData(key)` delegates to `this.graphModel.getMetaData(key)`
- Metadata is stored in the project file and loaded into graphModel
- Editor components set metadata via `graphModel.setMetaData(key, value)`

**Available Metadata Keys** (varies by project):

- `cloudservices` - Parse/Firebase cloud settings
- `backendServices` - BYOB backend configurations
- Project-specific settings

**Location**:

- NoodlRuntime API: `packages/noodl-runtime/noodl-runtime.js` (line 299)
- Pattern reference: `packages/noodl-runtime/src/api/cloudstore.js`
- BYOB usage: `packages/noodl-runtime/src/nodes/std-library/data/byob-query-data.js`

**Keywords**: NoodlRuntime, getMetaData, project metadata, runtime, backend config, cloudservices

---

## 🔴 Runtime Nodes Must Be in coreNodes Index (Dec 2025)

### Problem: Node Module Loads But Doesn't Appear in Node Picker

**Context**: TASK-002 BYOB Data Nodes - Created `byob-query-data.js`, registered in `register-nodes.js`, console showed "Module loaded" but node never appeared in Node Picker.

**Root Cause**: Runtime nodes need to be registered in THREE places:

1. ✅ Node file created (`noodl-runtime/src/nodes/std-library/data/byob-query-data.js`)
2. ✅ Registered in `register-nodes.js` via `require()`
3. ❌ **MISSING** - Added to `coreNodes` index in `nodelibraryexport.js`

**The Hidden Requirement**:

```javascript
// In nodelibraryexport.js, the coreNodes array determines Node Picker organization
const coreNodes = [
  {
    name: 'Read & Write Data',
    subCategories: [
      {
        name: 'External Data',
        items: ['net.noodl.HTTP', 'REST2'] // HTTP appears because it's HERE
      }
      // Node not in this array = not in Node Picker!
    ]
  }
];
```

**The Fix**:

```javascript
// Add node to appropriate category in coreNodes
{
  name: 'BYOB Data',
  items: ['noodl.byob.QueryData']  // Now appears in Node Picker!
}
```

**Why This Is Easy to Miss**:

- Module loads fine (console log appears)
- No errors anywhere
- Node IS registered in `nodeRegister._constructors`
- Node IS in `nodetypes` array exported to editor
- But Node Picker uses `coreNodes` index for organization

**Critical Rule**: After creating a node, ALWAYS add it to `nodelibraryexport.js` coreNodes array.

**Location**:

- `packages/noodl-runtime/src/nodelibraryexport.js` (coreNodes array)
- Documented in: `dev-docs/reference/LEARNINGS-NODE-CREATION.md` (Step 3)

**Keywords**: node picker, coreNodes, nodelibraryexport, runtime node, silent failure, node not appearing

---
