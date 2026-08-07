# BUG-2.1: Blockly UI Polish

**Priority:** P2 - UX improvement  
**Status:** ✅ Ready to implement  
**Introduced in:** Phase 3 Task 12 (Blockly integration)

---

## Issues

### 1. Redundant Label

There's a label text above the "Edit Logic Blocks" button that's not needed - the button text is self-explanatory.

### 2. Generated Code Field is Wrong Type

The "Generated Code" field is currently an **input field** but should be a **button** that opens a read-only code viewer modal.

---

## Current UI

```
Property Panel for Logic Builder Node:
┌────────────────────────────────┐
│ Logic Builder                  │ ← Node label
├────────────────────────────────┤
│ [Label Text Here]              │ ← ❌ Remove this
│ [Edit Logic Blocks]            │ ← ✅ Keep button
│                                │
│ Generated Code:                │
│ [_______________]              │ ← ❌ Wrong! It's an input
└────────────────────────────────┘
```

## Desired UI

```
Property Panel for Logic Builder Node:
┌────────────────────────────────┐
│ Logic Builder                  │ ← Node label
├────────────────────────────────┤
│ [Edit Logic Blocks]            │ ← Button (no label above)
│                                │
│ [View Generated Code]          │ ← ✅ New button
└────────────────────────────────┘
```

---

## Implementation

### File to Modify

`packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/LogicBuilderWorkspaceType.ts`

### Changes Needed

#### 1. Remove Redundant Label

Find and remove the label div/text above the "Edit Logic Blocks" button.

#### 2. Replace Generated Code Input with Button

**Remove:**

```typescript
{
  type: 'string',
  name: 'generatedCode',
  displayName: 'Generated Code',
  group: 'Logic',
  readonly: true
}
```

**Add:**

```typescript
// Add button to view generated code
const viewCodeButton = {
  type: 'button',
  displayName: 'View Generated Code',
  onClick: () => {
    // Get the generated code from the node
    const code = node.parameters.generatedCode || '// No code generated yet';

    // Open code editor modal in read-only mode
    PopupLayer.instance.showModal({
      type: 'code-editor',
      title: 'Generated Code (Read-Only)',
      code: code,
      language: 'javascript',
      readOnly: true,
      allowCopy: true,
      allowPaste: false
    });
  }
};
```

---

## Code Editor Modal Integration

The modal should use the same code editor component from TASK-011 (Advanced Code Editor):

```typescript
import { JavaScriptEditor } from '@noodl-core-ui/components/code-editor';

// In modal content
<JavaScriptEditor
  value={generatedCode}
  onChange={() => {}} // No-op since read-only
  readOnly={true}
  language="javascript"
  height="500px"
/>;
```

---

## User Experience

### Before

1. User opens Logic Builder properties
2. Sees confusing label above button
3. Sees "Generated Code" input field with code
4. Can't easily view or copy the code
5. Input might be mistaken for editable

### After

1. User opens Logic Builder properties
2. Sees clean "Edit Logic Blocks" button
3. Sees "View Generated Code" button
4. Clicks button → Modal opens with formatted code
5. Can easily read, copy code
6. Clear it's read-only

---

## Testing Plan

- [ ] Label above "Edit Logic Blocks" button is removed
- [ ] "Generated Code" input field is replaced with button
- [ ] Button says "View Generated Code"
- [ ] Clicking button opens modal with code
- [ ] Modal shows generated JavaScript code
- [ ] Code is syntax highlighted
- [ ] Code is read-only (can't type/edit)
- [ ] Can select and copy code
- [ ] Modal has close button
- [ ] Modal title is clear ("Generated Code - Read Only")

---

## Success Criteria

- [ ] Clean, minimal property panel UI
- [ ] Generated code easily viewable in proper editor
- [ ] Code is formatted and syntax highlighted
- [ ] User can copy code but not edit
- [ ] No confusion about editability

---

_Last Updated: January 13, 2026_
