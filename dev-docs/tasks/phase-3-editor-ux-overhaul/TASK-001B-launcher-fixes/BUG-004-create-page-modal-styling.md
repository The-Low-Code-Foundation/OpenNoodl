# BUG-004: "Create Page" Modal Misaligned

**Severity**: 🟡 Medium (UI/UX Issue)  
**Status**: Identified  
**Category**: CSS Styling

---

## 🐛 Symptom

When clicking "+ Add new page" in the Page Router property editor:

- ❌ Modal rectangle appears **below** the pointer triangle
- ❌ Triangle "floats" and barely touches the rectangle
- ❌ Looks unprofessional and broken

**Expected**: Triangle should be seamlessly attached to the modal rectangle.

**Actual**: Triangle and rectangle are visually disconnected.

---

## 🔍 Root Cause

**CSS positioning issue in legacy PopupLayer system**

### The Modal Components

```typescript
// Pages.tsx line ~195
PopupLayer.instance.showPopup({
  content: { el: $(div) },
  attachTo: $(this.popupAnchor),
  position: 'right' // ← Position hint
  // ...
});
```

The popup uses legacy jQuery + CSS positioning from `pages.css`.

### Likely CSS Issue

```css
/* packages/noodl-editor/src/editor/src/styles/propertyeditor/pages.css */

/* Triangle pointer */
.popup-layer-arrow {
  /* Positioned absolutely */
}

/* Modal rectangle */
.popup-layer-content {
  /* Also positioned absolutely */
  /* ❌ Offset calculations may be incorrect */
}
```

The triangle and rectangle are positioned separately, causing misalignment.

---

## 🛠️ Solution

### Option 1: Fix CSS (Recommended)

Adjust positioning in `pages.css`:

```css
.popup-layer-content {
  /* Ensure top aligns with triangle */
  margin-top: 0;
  /* Adjust offset if needed */
}

.popup-layer-arrow {
  /* Ensure connects to content */
}
```

### Option 2: Migrate to Modern Popup

Replace legacy PopupLayer with modern PopupMenu (from `@noodl-core-ui`).

**Complexity**: Higher, but better long-term solution.

---

## ✅ Verification

1. Open project with Page Router
2. Click "+ Add new page" button
3. Check modal appearance
4. Triangle should seamlessly connect to rectangle

---

**Priority**: P2 - Fix after critical bugs  
**Impact**: Cosmetic only, doesn't affect functionality
