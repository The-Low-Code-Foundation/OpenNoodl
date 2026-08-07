# STYLE-001 MVP - Testing Guide

**Version**: MVP  
**Date**: 2026-01-12  
**Estimated Time**: 15-20 minutes

---

## 🎯 Testing Objectives

Verify that:

1. ✅ Default tokens are injected into the preview
2. ✅ Tokens can be used in element styles
3. ✅ Custom token values can be set and persist
4. ✅ Tokens update in real-time when changed

---

## 🛠️ Prerequisites

- OpenNoodl editor running (`npm run dev` from project root)
- Browser with DevTools (Chrome/Firefox/Edge recommended)
- Basic knowledge of CSS custom properties

---

## 📋 Test Cases

### Test 1: Verify Default Tokens Are Injected

**Goal**: Confirm that default tokens are available in the preview.

**Steps:**

1. Start the editor: `npm run dev`
2. Create a new project (or open an existing one)
3. Wait for the preview to load
4. Open browser DevTools (F12 or Right-click → Inspect)
5. Go to the **Elements** tab
6. Look for a `<style>` tag with `id="noodl-style-tokens"` in the `<head>`

**Expected Result:**

```html
<style id="noodl-style-tokens">
  :root {
    --primary: #3b82f6;
    --background: #ffffff;
    --foreground: #0f172a;
    --border: #e2e8f0;
    --space-sm: 8px;
    --space-md: 16px;
    --space-lg: 24px;
    --radius-md: 8px;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }
</style>
```

**✅ Pass Criteria**: The style tag exists with all 10 default tokens.

---

### Test 2: Use Tokens in Element Styles

**Goal**: Verify tokens can be used in visual elements.

**Steps:**

1. In the node graph, add a **Group** node
2. In the property panel, go to **Style** section
3. Add custom styles:
   ```css
   background: var(--primary);
   padding: var(--space-md);
   border-radius: var(--radius-md);
   box-shadow: var(--shadow-md);
   ```
4. Make the Group visible by setting width/height (e.g., 200px x 200px)

**Expected Result:**

- Background color: Blue (#3b82f6)
- Padding: 16px on all sides
- Border radius: 8px rounded corners
- Box shadow: Medium shadow visible

**✅ Pass Criteria**: All token values are applied correctly.

---

### Test 3: Verify Token Persistence

**Goal**: Confirm tokens persist across editor restarts.

**Steps:**

1. With a project open, open DevTools Console
2. Set a custom token value:
   ```javascript
   ProjectModel.instance.setMetaData('styleTokens', {
     '--primary': '#ff0000'
   });
   ```
3. Reload the preview (Cmd+R / Ctrl+R)
4. Check if the element from Test 2 now has a red background

**Expected Result:**

- Background changes from blue to red
- Other tokens remain unchanged (still using defaults)

**✅ Pass Criteria**: Custom token value persists after reload.

---

### Test 4: Real-Time Token Updates

**Goal**: Verify tokens update without page reload.

**Steps:**

1. With the preview showing an element styled with tokens
2. Open DevTools Console
3. Change a token value:
   ```javascript
   ProjectModel.instance.setMetaData('styleTokens', {
     '--primary': '#00ff00',
     '--space-md': '32px'
   });
   ```
4. Observe the preview **without reloading**

**Expected Result:**

- Background changes from previous color to green
- Padding increases from 16px to 32px
- Changes happen immediately

**✅ Pass Criteria**: Changes reflected in real-time.

---

### Test 5: Multiple Element Usage

**Goal**: Confirm tokens work across multiple elements.

**Steps:**

1. Add multiple visual elements:
   - Group 1: `background: var(--primary)`
   - Group 2: `background: var(--primary)`
   - Text: `color: var(--foreground)`
2. Set a custom `--primary` value:
   ```javascript
   ProjectModel.instance.setMetaData('styleTokens', {
     '--primary': '#9333ea' // Purple
   });
   ```

**Expected Result:**

- Both Group 1 and Group 2 change to purple simultaneously
- Text color remains the foreground color

**✅ Pass Criteria**: Token change applies to all elements using it.

---

### Test 6: Invalid Token Handling

**Goal**: Verify system handles invalid token values gracefully.

**Steps:**

1. Add an element with `background: var(--nonexistent-token)`
2. Observe what happens

**Expected Result:**

- No error in console
- Element uses browser default (likely transparent/white)
- Preview doesn't crash

**✅ Pass Criteria**: System degrades gracefully.

---

### Test 7: Token in Different CSS Properties

**Goal**: Confirm tokens work in various CSS properties.

**Steps:**

1. Create an element with multiple token usages:
   ```css
   background: var(--primary);
   color: var(--foreground);
   padding: var(--space-sm) var(--space-md);
   margin: var(--space-lg);
   border: 1px solid var(--border);
   border-radius: var(--radius-md);
   box-shadow: var(--shadow-sm);
   ```
2. Inspect the computed styles in DevTools

**Expected Result:**

All properties resolve to their token values:

- `background: rgb(59, 130, 246)` (--primary)
- `padding: 8px 16px` (--space-sm --space-md)
- etc.

**✅ Pass Criteria**: All tokens resolve correctly.

---

## 🐛 Troubleshooting

### Issue: Tokens not showing in preview

**Solution:**

1. Check browser console for errors
2. Verify the style element exists: `document.getElementById('noodl-style-tokens')`
3. Check if StyleTokensInjector was initialized:
   ```javascript
   // In DevTools console
   console.log('Injector exists:', !!window._styleTokensInjector);
   ```

### Issue: Changes don't persist

**Solution:**

1. Ensure you're using `ProjectModel.instance.setMetaData()`
2. Check if metadata is saved:
   ```javascript
   console.log(ProjectModel.instance.getMetaData('styleTokens'));
   ```
3. Save the project explicitly if needed

### Issue: Tokens not updating in real-time

**Solution:**

1. Check if the 'metadataChanged' event is firing
2. Verify StyleTokensInjector is listening to events
3. Try a hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)

---

## 📊 Test Results Template

```
STYLE-001 MVP Testing - Results
================================
Date: ___________
Tester: ___________

Test 1: Default Tokens Injected       [ ] PASS  [ ] FAIL
Test 2: Use Tokens in Styles           [ ] PASS  [ ] FAIL
Test 3: Token Persistence              [ ] PASS  [ ] FAIL
Test 4: Real-Time Updates              [ ] PASS  [ ] FAIL
Test 5: Multiple Element Usage         [ ] PASS  [ ] FAIL
Test 6: Invalid Token Handling         [ ] PASS  [ ] FAIL
Test 7: Various CSS Properties         [ ] PASS  [ ] FAIL

Notes:
_____________________________________________________
_____________________________________________________
_____________________________________________________

Overall Status: [ ] PASS  [ ] FAIL
```

---

## 🚀 Next Steps After Testing

**If all tests pass:**

- ✅ MVP is ready for use
- Document any findings
- Plan STYLE-001 full version (UI panel)

**If tests fail:**

- Document which tests failed
- Note error messages
- Create bug reports
- Fix issues before continuing

---

_Last Updated: 2026-01-12_
