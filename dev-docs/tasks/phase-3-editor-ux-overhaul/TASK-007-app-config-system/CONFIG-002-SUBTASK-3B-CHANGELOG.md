# CONFIG-002 Subtask 3B: Variables Section - Advanced Features

**Status:** 🟡 In Progress (Monaco editor needs debugging)  
**Started:** 2026-01-07  
**Last Updated:** 2026-01-07

---

## Overview

Enhanced the Variables Section with advanced features including color picker, JSON editing for arrays/objects, and category grouping.

---

## What's Working ✅

### 1. Color Type UI

- ✅ Color picker input
- ✅ Hex value text input
- ✅ Proper persistence to project.json
- ✅ Accessible via `Noodl.Config.get('varName')`

### 2. Array/Object UI (Basic)

- ✅ "Edit JSON ➜" button renders
- ✅ Button styling and layout
- ✅ JSON validation on manual entry
- ✅ Fallback textarea works
- ✅ Values saved to project.json correctly

### 3. Category Grouping

- ✅ Variables grouped by category
- ✅ "Uncategorized" always shown first
- ✅ Alphabetical sorting of categories
- ✅ Clean visual separation

### 4. Documentation

- ✅ Created `REUSING-CODE-EDITORS.md` reference guide
- ✅ Documented `createModel()` utility pattern
- ✅ Added critical pitfall: Never bypass `createModel()`
- ✅ Explained why worker errors occur

---

## What's NOT Working ❌

### Monaco Editor Integration

**Problem:** Clicking "Edit JSON ➜" button does not open Monaco editor popup.

**What We Did:**

1. ✅ Restored `createModel` import
2. ✅ Replaced direct `monaco.editor.createModel()` with `createModel()` utility
3. ✅ Configured correct parameters:
   ```typescript
   const model = createModel(
     {
       type: varType, // 'array' or 'object'
       value: initialValue,
       codeeditor: 'javascript' // arrays use TypeScript mode
     },
     undefined
   );
   ```
4. ✅ Cleared all caches with `npm run clean:all`

**Why It Should Work:**

- Using exact same pattern as `AiChat.tsx` (confirmed working)
- Using same popup infrastructure as property panel
- Webpack workers configured correctly (AI chat works)

**Status:** Needs debugging session to determine why popup doesn't appear.

**Possible Issues:**

1. Event handler not firing
2. PopupLayer.instance not available
3. React.createElement not rendering
4. Missing z-index or CSS issue hiding popup

---

## Implementation Details

### Files Modified

```
packages/noodl-editor/src/editor/src/views/panels/AppSetupPanel/sections/VariablesSection.tsx
```

### Key Code Sections

#### Color Picker Implementation

```typescript
if (type === 'color') {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '40px',
          height: '32px',
          border: '1px solid var(--theme-color-border-default)',
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: 'transparent'
        }}
      />
      <div style={{ flex: 1 }}>
        <PropertyPanelTextInput value={value || '#000000'} onChange={onChange} />
      </div>
    </div>
  );
}
```

#### Monaco Editor Integration (NOT WORKING)

```typescript
const openJSONEditor = (
  initialValue: string,
  onSave: (value: string) => void,
  varType: 'array' | 'object',
  event: React.MouseEvent
) => {
  const model = createModel(
    {
      type: varType,
      value: initialValue,
      codeeditor: 'javascript'
    },
    undefined
  );

  const popupDiv = document.createElement('div');
  const root = createRoot(popupDiv);

  const props: CodeEditorProps = {
    nodeId: `config-variable-${varType}-editor`,
    model: model,
    initialSize: { x: 600, y: 400 },
    onSave: () => {
      const code = model.getValue();
      const parsed = JSON.parse(code);
      onSave(code);
    }
  };

  root.render(React.createElement(CodeEditor, props));

  PopupLayer.instance.showPopout({
    content: { el: [popupDiv] },
    attachTo: $(event.currentTarget),
    position: 'right',
    disableDynamicPositioning: true,
    onClose: () => {
      props.onSave();
      model.dispose();
      root.unmount();
    }
  });
};
```

#### Category Grouping

```typescript
const groupedVariables: { [category: string]: ConfigVariable[] } = {};
localVariables.forEach((variable) => {
  const cat = variable.category || 'Uncategorized';
  if (!groupedVariables[cat]) {
    groupedVariables[cat] = [];
  }
  groupedVariables[cat].push(variable);
});

const categories = Object.keys(groupedVariables).sort((a, b) => {
  if (a === 'Uncategorized') return -1;
  if (b === 'Uncategorized') return 1;
  return a.localeCompare(b);
});
```

---

## Testing Notes

### What to Test After Monaco Fix

1. **Color Variables**

   - [x] Create color variable
   - [x] Use color picker to change value
   - [x] Edit hex value directly
   - [x] Verify saved to project.json
   - [x] Verify accessible in runtime

2. **Array Variables**

   - [x] Create array variable
   - [ ] Click "Edit JSON ➜" → Monaco editor opens ❌
   - [ ] Edit array in Monaco
   - [ ] Save and close
   - [ ] Verify updated value
   - [ ] Invalid JSON shows error

3. **Object Variables**

   - [x] Create object variable
   - [ ] Click "Edit JSON ➜" → Monaco editor opens ❌
   - [ ] Edit object in Monaco
   - [ ] Save and close
   - [ ] Verify updated value

4. **Category Grouping**
   - [x] Create variables with different categories
   - [x] Verify grouped correctly
   - [x] Verify "Uncategorized" appears first
   - [x] Verify alphabetical sorting

---

## Next Steps

### Immediate (Critical)

1. **Debug Monaco editor popup** - Why doesn't it appear?

   - Add console.log to `openJSONEditor` function
   - Verify `createModel` returns valid model
   - Check `PopupLayer.instance` exists
   - Verify React.createElement works
   - Check browser console for errors

2. **Test in running app** - Start `npm run dev` and:
   - Open App Setup panel
   - Create array variable
   - Click "Edit JSON ➜"
   - Check browser DevTools console
   - Check Electron DevTools (View → Toggle Developer Tools)

### After Monaco Works

3. Complete testing checklist
4. Mark subtask 3B as complete
5. Update PROGRESS.md to mark TASK-007 complete

---

## Related Tasks

- **CONFIG-001**: Runtime config system ✅ Complete
- **CONFIG-002 Subtask 1**: Core panel, Identity & SEO ✅ Complete
- **CONFIG-002 Subtask 2**: PWA Section ✅ Complete
- **CONFIG-002 Subtask 3A**: Variables basic features ✅ Complete
- **CONFIG-002 Subtask 3B**: Variables advanced features 🟡 **THIS TASK** (Monaco debugging needed)

---

## Phase 5 Integration

PWA file generation added to Phase 5 as **Phase F: Progressive Web App Target**:

- TASK-008: PWA File Generation
- TASK-009: PWA Icon Processing
- TASK-010: Service Worker Template
- TASK-011: PWA Deploy Integration

These tasks will read the PWA configuration we've created here and generate the actual PWA files during deployment.

---

## Known Issues

### Issue #1: Monaco Editor Popup Not Appearing

**Severity:** Critical  
**Status:** ✅ RESOLVED (2026-01-08)  
**Description:** Clicking "Edit JSON ➜" button does not open Monaco editor popup  
**Impact:** Array/Object variables can't use advanced JSON editor (fallback to manual editing works)  
**Root Cause:** Using `$(event.currentTarget)` from React synthetic event doesn't work reliably with jQuery-based PopupLayer. The DOM element reference from React events is unstable.  
**Solution:** Created separate `JSONEditorButton` component with its own `useRef<HTMLButtonElement>` to maintain a stable DOM reference. The component manages its own ref for the button element and passes `$(buttonRef.current)` to PopupLayer, matching the pattern used successfully in `AiChat.tsx`.

**Key Changes:**

1. Created `JSONEditorButton` component with `useRef<HTMLButtonElement>(null)`
2. Component handles editor lifecycle with cleanup on unmount
3. Uses `$(buttonRef.current)` for `attachTo` instead of `$(event.currentTarget)`
4. Follows same pattern as working AiChat.tsx implementation

---

## Lessons Learned

### 1. Never Bypass `createModel()`

- Direct use of `monaco.editor.createModel()` bypasses worker configuration
- Results in "Error: Unexpected usage" and worker failures
- **Always** use the `createModel()` utility from `@noodl-utils/CodeEditor`

### 2. Arrays Use JavaScript Language Mode

- Arrays and objects use `codeeditor: 'javascript'` NOT `'json'`
- This provides TypeScript validation and better editing
- Discovered by studying `AiChat.tsx` implementation

### 3. Importance of Working Examples

- Studying existing working code (`AiChat.tsx`) was crucial
- Showed the correct `createModel()` pattern
- Demonstrated popup integration

---

_Last Updated: 2026-01-07 23:41 UTC+1_
