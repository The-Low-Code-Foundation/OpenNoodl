# TASK-008: Unified JSON Editor Component

## Overview

Create a modern, no-code-friendly JSON editor component for OpenNoodl with two editing modes:

- **Easy Mode** - Visual tree builder (impossible to break, perfect for no-coders)
- **Advanced Mode** - Text editor with validation/linting (for power users)

This component will replace existing JSON editors throughout the application, providing a consistent and user-friendly experience.

## Problem Statement

### Current State

- JSON editing in Noodl uses a basic Monaco text editor with no syntax highlighting or validation
- Monaco JSON workers are broken in Electron's CommonJS environment
- No-coders can easily create invalid JSON without feedback
- No visual way to construct arrays/objects without knowing JSON syntax

### User Pain Points

1. **No-coders don't understand JSON syntax** - They need to learn `[]`, `{}`, `"key": value` format
2. **Easy to make mistakes** - Missing commas, unclosed brackets, unquoted strings
3. **No feedback when JSON is invalid** - Just fails silently on save
4. **Intimidating** - A blank text area with `[]` is not welcoming

## Solution Design

### Two-Mode Editor

#### 🟢 Easy Mode (Visual Builder)

A tree-based visual editor where users can't break the JSON structure.

**Features:**

- **Add Item Button** - Adds array elements or object keys
- **Type Selector** - Choose: String, Number, Boolean, Null, Array, Object
- **Inline Editing** - Click to edit values with type-appropriate inputs
- **Drag & Drop** - Reorder array items or object keys
- **Delete Button** - Remove items with confirmation
- **Expand/Collapse** - For nested structures
- **No raw JSON visible** - Just the structured view

**Visual Example:**

```
┌────────────────────────────────────────────────┐
│  📋 Array (3 items)                    [+ Add] │
├────────────────────────────────────────────────┤
│  ▼ 0: {object}                              ×  │
│      name: "John"                      [edit]  │
│      age: 30                           [edit]  │
│      active: ✓                         [edit]  │
│                                                │
│  ▼ 1: {object}                              ×  │
│      name: "Jane"                      [edit]  │
│      age: 25                           [edit]  │
│      active: ✗                         [edit]  │
│                                                │
│  ▶ 2: {object} (collapsed)                  ×  │
└────────────────────────────────────────────────┘
```

#### 🔵 Advanced Mode (Text Editor)

A text editor with validation feedback for power users who prefer typing.

**Features:**

- **Syntax Highlighting** - If Monaco JSON works, or via custom tokenizer
- **Validate Button** - Click to check JSON validity
- **Error Display** - Clear message: "Line 3, Position 5: Unexpected token '}'"
- **Line Numbers** - Help locate errors
- **Format/Pretty Print** - Button to auto-format JSON
- **Import from Easy Mode** - Seamlessly switch from visual builder

**Visual Example:**

```
┌────────────────────────────────────────────────┐
│ [Validate] [Format] │ ✅ Valid JSON            │
├────────────────────────────────────────────────┤
│ 1 │ [                                          │
│ 2 │   {                                        │
│ 3 │     "name": "John",                        │
│ 4 │     "age": 30                              │
│ 5 │   }                                        │
│ 6 │ ]                                          │
└────────────────────────────────────────────────┘
```

**Error State:**

```
┌────────────────────────────────────────────────┐
│ [Validate] [Format] │ ❌ Line 4: Missing ","   │
├────────────────────────────────────────────────┤
│ 1 │ [                                          │
│ 2 │   {                                        │
│ 3 │     "name": "John"                         │
│ 4*│     "age": 30        ← ERROR HERE          │
│ 5 │   }                                        │
│ 6 │ ]                                          │
└────────────────────────────────────────────────┘
```

### Mode Toggle

```
┌────────────────────────────────────────────────┐
│ JSON Editor              [Easy] [Advanced]     │
├────────────────────────────────────────────────┤
│                                                │
│  [Content changes based on mode]               │
│                                                │
└────────────────────────────────────────────────┘
```

- **Default to Easy Mode** for new users
- **Remember preference** per user (localStorage)
- **Warn when switching** if there are unsaved changes
- **Auto-parse** when switching from Advanced → Easy (show error if invalid)

## Technical Implementation

### Component Structure

```
packages/noodl-core-ui/src/components/
└── json-editor/
    ├── JSONEditor.tsx              # Main component with mode toggle
    ├── JSONEditor.module.scss
    ├── index.ts
    │
    ├── modes/
    │   ├── EasyMode/
    │   │   ├── EasyMode.tsx        # Visual tree builder
    │   │   ├── TreeNode.tsx        # Recursive tree node
    │   │   ├── ValueEditor.tsx     # Type-aware value inputs
    │   │   └── EasyMode.module.scss
    │   │
    │   └── AdvancedMode/
    │       ├── AdvancedMode.tsx    # Text editor with validation
    │       ├── ValidationBar.tsx   # Error display component
    │       └── AdvancedMode.module.scss
    │
    └── utils/
        ├── jsonValidator.ts        # JSON.parse with detailed errors
        ├── jsonFormatter.ts        # Pretty print utility
        └── types.ts                # Shared types
```

### API Design

```typescript
interface JSONEditorProps {
  /** Initial value (JSON string or parsed object) */
  value: string | object | unknown[];

  /** Called when value changes (debounced) */
  onChange: (value: string) => void;

  /** Called on explicit save (Cmd+S or button) */
  onSave?: (value: string) => void;

  /** Initial mode - defaults to 'easy' */
  defaultMode?: 'easy' | 'advanced';

  /** Force a specific mode (no toggle shown) */
  mode?: 'easy' | 'advanced';

  /** Type constraint for validation */
  expectedType?: 'array' | 'object' | 'any';

  /** Custom schema validation (optional future feature) */
  schema?: object;

  /** Readonly mode */
  disabled?: boolean;

  /** Height constraint */
  height?: number | string;
}

// Usage examples:

// Basic array editing
<JSONEditor
  value="[]"
  onChange={setValue}
  expectedType="array"
/>

// Object editing with forced advanced mode
<JSONEditor
  value={myConfig}
  onChange={setConfig}
  mode="advanced"
/>

// With save callback
<JSONEditor
  value={data}
  onChange={handleChange}
  onSave={handleSave}
  defaultMode="easy"
/>
```

### Integration Points

The JSON Editor will replace existing JSON editing in:

1. **Config Variables** (App Setup Panel)

   - Array/Object variable values
   - Currently uses Monaco plaintext

2. **REST Node Response Mapping**

   - Path configuration
   - Currently uses basic text input

3. **Data nodes** (Object, Array, etc.)

   - Static default values
   - Currently uses Monaco

4. **Any future JSON property inputs**

## Subtasks

### Phase 1: Core Component (2-3 days)

- [ ] **JSON-001**: Create base JSONEditor component structure
- [ ] **JSON-002**: Implement EasyMode tree view (read-only display)
- [ ] **JSON-003**: Implement EasyMode editing (add/edit/delete)
- [ ] **JSON-004**: Implement AdvancedMode text editor
- [ ] **JSON-005**: Add validation with detailed error messages
- [ ] **JSON-006**: Add mode toggle and state management

### Phase 2: Polish & Integration (1-2 days)

- [ ] **JSON-007**: Add drag & drop for EasyMode
- [ ] **JSON-008**: Add format/pretty-print to AdvancedMode
- [ ] **JSON-009**: Integrate with VariablesSection (App Config)
- [ ] **JSON-010**: Add keyboard shortcuts (Cmd+S, etc.)

### Phase 3: System-wide Replacement (2-3 days)

- [ ] **JSON-011**: Replace existing JSON editors in property panel
- [ ] **JSON-012**: Add to Storybook with comprehensive stories
- [ ] **JSON-013**: Documentation and migration guide

## Dependencies

- React 19 (existing)
- No new npm packages required (pure React implementation)
- Optional: `ajv` for JSON Schema validation (future)

## Design Tokens

Use existing Noodl design tokens:

- `--theme-color-bg-2` for editor background
- `--theme-color-bg-3` for tree node hover
- `--theme-color-primary` for actions
- `--theme-color-success` for valid state
- `--theme-color-error` for error state

## Acceptance Criteria

1. ✅ No-coder can create arrays/objects without knowing JSON syntax
2. ✅ Power users can type raw JSON with validation feedback
3. ✅ Errors clearly indicate where the problem is
4. ✅ Switching modes preserves data (unless invalid)
5. ✅ Works in Electron (no web worker dependencies)
6. ✅ Consistent with Noodl's design system
7. ✅ Accessible (keyboard navigation, screen reader friendly)

## Future Enhancements

- JSON Schema validation
- Import from URL/file
- Export to file
- Copy/paste tree nodes
- Undo/redo stack
- AI-assisted JSON generation

---

**Priority**: Medium
**Estimated Effort**: 5-8 days
**Related Tasks**: TASK-007 App Config System
