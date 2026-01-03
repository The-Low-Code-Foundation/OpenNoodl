# TASK-008: ComponentsPanel Menus and Sheets - CHANGELOG

## Status: ✅ COMPLETED

**Date Completed**: January 3, 2026

---

## Summary

Fixed inability to edit or delete sheets in the Components Panel dropdown. The issue was caused by React's useMemo not detecting when the sheets array had changed, even though the array was being recalculated correctly. The fix involved adding `updateCounter` to the useMemo dependencies to force a new array reference creation.

---

## Root Cause

React's useMemo performs reference equality checking (`===`) on its dependencies. When the sheets array was recalculated, useMemo was creating a new array with the same values but not creating a NEW REFERENCE that React could detect as changed. This caused:

1. SheetSelector to receive the same array reference on every render
2. React to skip re-rendering the dropdown because the prop reference hadn't changed
3. Newly created or deleted sheets to not appear in the UI

---

## The Critical Fix

**File**: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`

**Line 153**: Added `updateCounter` to sheets useMemo dependencies:

```typescript
const sheets = useMemo((): Sheet[] => {
  // Sheet calculation logic...
  return result;
}, [rawComponents, allComponents, hideSheets, updateCounter]); // ← Added updateCounter here
```

**Why this works**:

- `updateCounter` increments whenever a ProjectModel event fires (componentAdded, componentRemoved, etc.)
- When updateCounter changes, useMemo recalculates AND returns a **new array reference**
- React detects the new reference and triggers a re-render of components using `sheets`
- SheetSelector dropdown updates to show current sheets

---

## Investigation Process

### Initial Symptoms

- User could not edit or delete sheets from the dropdown menu
- Creating new sheets worked but they didn't appear in the dropdown
- Deleting sheets threw "sheet doesn't exist" errors
- Refreshing/restarting the editor showed the correct sheets

### Debugging Journey

1. **Verified event system**: Added extensive debug logging to confirm:

   - ✅ ComponentAdded events fire correctly
   - ✅ ProjectModel.instance receives events
   - ✅ useComponentsPanel receives events and increments updateCounter
   - ✅ Sheets array recalculates with correct values
   - ✅ All sheet placeholders detected properly

2. **React rendering investigation**: Logs showed:

   - 🔥 Sheets useMemo recalculated correctly
   - ❌ But SheetSelector component didn't re-render
   - ❌ `sheets` prop reference remained the same

3. **The "Aha" Moment**: Realized useMemo was calculating a new array but not creating a new reference that React could detect as different. The array had the same shape and values, so React's shallow comparison saw it as unchanged.

4. **Solution**: Adding `updateCounter` to deps forces useMemo to return a completely new array reference whenever events fire, triggering React's re-render cycle.

---

## Files Modified

### Core Fix

- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`
  - Added `updateCounter` to sheets useMemo dependencies (line 153)

### Debug Cleanup (Removed extensive logging from)

- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts`
- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanelReact.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/components/SheetSelector.tsx`
- `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useSheetManagement.ts`
- `packages/noodl-editor/src/editor/src/models/projectmodel.ts`

---

## Testing & Verification

**Verification Steps**:

1. ✅ Create new sheet → appears immediately in dropdown
2. ✅ Rename sheet → updates immediately in dropdown
3. ✅ Delete sheet → removes immediately from dropdown
4. ✅ Move components between sheets → component counts update
5. ✅ Sheet selector shows all sheets with correct counts
6. ✅ No console errors or warnings

**Note**: Required `npm run clean:all` and dev server restart due to Webpack filesystem caching issues during development. See LEARNINGS.md for details on this common development pitfall.

---

## Related Issues

### Secondary Issue: Webpack Caching

During development, code changes sometimes didn't load due to Webpack's filesystem cache. This obscured the actual fix for several debugging iterations.

**Solution Pattern**:

```bash
npm run clean:all  # Clear all caches
# Restart dev server
# Check build canary timestamp in console
```

**Prevention**: Dev mode webpack config should use memory cache or no cache, not filesystem cache.

---

## Lessons Learned

### Critical Pattern: React UseMemo with Arrays

**❌ WRONG - Recalculation doesn't guarantee new reference**:

```typescript
const sheets = useMemo((): Sheet[] => {
  // Calculate sheets...
  return result; // Same reference if deps haven't changed
}, [rawComponents, allComponents, hideSheets]);
```

**✅ CORRECT - Force new reference with counter**:

```typescript
const [updateCounter, setUpdateCounter] = useState(0);

// Increment on events
useEffect(() => {
  const handleUpdate = () => setUpdateCounter((c) => c + 1);
  ProjectModel.instance.on(EVENTS, handleUpdate, group);
  return () => ProjectModel.instance.off(group);
}, []);

const sheets = useMemo((): Sheet[] => {
  // Calculate sheets...
  return result; // New reference when updateCounter changes
}, [rawComponents, allComponents, hideSheets, updateCounter]);
```

### Key Insights

1. **useMemo doesn't always return new references**: Even when recalculating, if dependencies haven't changed by reference, the same memoized value is returned

2. **Update counters force React updates**: A simple incrementing counter in deps guarantees a new reference on every calculation

3. **EventDispatcher + React requires patterns**: Direct `.on()` subscriptions from React components silently fail. Use the proven direct subscription pattern or abstracted hooks

4. **Debug by elimination**: When events fire and logic executes correctly but UI doesn't update, suspect React reference equality issues

5. **Webpack cache can obscure fixes**: Always verify code changes are actually loaded (`npm run clean:all`) before spending hours debugging

---

## Documentation Updates

- ✅ Updated `dev-docs/reference/LEARNINGS.md` with React useMemo reference discovery
- ✅ Existing EventDispatcher + React patterns documented in Phase 0
- ✅ Webpack caching issues already documented in LEARNINGS.md

---

## Related Documentation

- **EventDispatcher + React Pattern**: `dev-docs/patterns/REACT-EVENTDISPATCHER.md`
- **Webpack Cache Issues**: Section in `dev-docs/reference/LEARNINGS.md`
- **Phase 0 Foundation**: `dev-docs/tasks/phase-0-foundation-stabalisation/`

---

_Task completed January 3, 2026 by Cline_
