# BUG-9: Properties Panel Not Responsive to Width Changes

**Priority:** P1 - UX annoyance  
**Status:** 🔴 Research needed  
**Reported:** January 16, 2026

---

## Issue

When resizing the left sidebar panel by dragging:

- ✅ The left panel container correctly expands/shrinks
- ❌ The properties panel content **stays fixed width** and doesn't expand to fill the available space
- Result: Wasted whitespace when panel is widened

---

## Expected Behavior

When the user widens the left panel by dragging:

1. The entire side panel container expands
2. The properties panel content **responsively expands** to use the new width
3. Form fields, inputs, and content fill the available horizontal space

---

## Current Behavior

1. User widens the left panel by dragging
2. The container expands
3. The properties panel content **stays at a fixed width**
4. Large empty space appears on the right side of the panel

---

## Likely Causes

### 1. Fixed Width on PropertyEditor Container

The property editor or one of its parent containers likely has a fixed `width` value instead of responsive sizing:

```scss
// Problem pattern:
.PropertyEditor {
  width: 280px; // ❌ Fixed - won't expand
}

// Should be:
.PropertyEditor {
  width: 100%; // ✅ Fills available space
  max-width: 400px; // Optional upper limit
}
```

### 2. Missing Flex Properties

Parent containers may be missing proper flex properties:

```scss
// Problem pattern:
.Container {
  display: flex;
}

// Should have:
.Container {
  display: flex;
  flex: 1; // Grow to fill space
}
```

### 3. Incorrect Content Sizing

Inner content may have fixed widths that override responsive parent:

```scss
// Problem pattern:
.PropertyPanelInput {
  width: 200px; // ❌ Fixed
}

// Should be:
.PropertyPanelInput {
  width: 100%; // ✅ Fills parent
}
```

---

## Files to Investigate

### Primary Files

1. `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/index.tsx`

   - Main property editor container
   - Check container width styling

2. `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/propertyeditor.scss`

   - Check for fixed width values
   - Verify flex properties

3. `packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.model.scss`
   - Panel container styling
   - Check how panel receives width

### Component Files

4. `packages/noodl-core-ui/src/components/property-panel/PropertyPanelInput/PropertyPanelInput.module.scss`

   - Input field sizing
   - May have fixed widths

5. `packages/noodl-core-ui/src/components/property-panel/PropertyPanelRow/PropertyPanelRow.module.scss`
   - Row container sizing

### SideNavigation Container

6. `packages/noodl-core-ui/src/components/app/SideNavigation/SideNavigation.module.scss`
   - May constrain panel width

---

## Investigation Steps

### 1. Inspect in DevTools

Open DevTools (Cmd+Opt+I) and:

1. Select the property panel container
2. Manually adjust width in CSS
3. Identify which element is constraining width

### 2. Search for Fixed Widths

```bash
# Find fixed width declarations in property panel files
grep -rn "width:" packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
grep -rn "width:" packages/noodl-core-ui/src/components/property-panel/
```

### 3. Check Flex Properties

```bash
# Find flex-related styles
grep -rn "flex:" packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
grep -rn "flex-grow\|flex-shrink" packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
```

---

## Potential Fixes

### Option A: Make PropertyEditor Container Responsive

```scss
.PropertyEditor {
  width: 100%;
  min-width: 200px; // Minimum usable width
  max-width: 100%; // Allow full expansion
}
```

### Option B: Add Flex Growth

```scss
.PanelItem {
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
}

.PropertyEditor {
  flex: 1;
  width: 100%;
}
```

### Option C: Fix Input Field Widths

If inputs have fixed widths:

```scss
.PropertyPanelInput {
  width: 100%;
  max-width: none; // Remove any max-width constraint
}
```

---

## Testing Plan

- [ ] Open a project and select a node with properties
- [ ] Drag the left panel border to widen it
- [ ] Verify property panel content expands with the panel
- [ ] Test with different panel widths (narrow, medium, wide)
- [ ] Verify input fields remain usable at all sizes
- [ ] Test with nested property groups (expanded sections)
- [ ] Test on different node types (simple vs complex properties)

---

## Success Criteria

- [ ] Properties panel content fills available horizontal space
- [ ] No large empty areas when panel is widened
- [ ] Input fields expand proportionally
- [ ] Layout remains usable at minimum width
- [ ] No overflow/cutoff issues at narrow widths
- [ ] Smooth resize without jank

---

## Related

- This may affect other panels (Components, Cloud Functions, etc.)
- Sidebar resize is handled by the SideNavigation component
- Property panel renders into a slot provided by SidePanel

---

_Last Updated: January 16, 2026_
