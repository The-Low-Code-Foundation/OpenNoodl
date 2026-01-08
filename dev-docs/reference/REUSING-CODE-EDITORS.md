# Reusing Code Editors in OpenNoodl

This guide explains how to integrate Monaco code editors (the same editor as VS Code) into custom UI components in OpenNoodl.

## Overview

OpenNoodl uses Monaco Editor for all code editing needs:

- **JavaScript/TypeScript** in Function and Script nodes
- **JSON** in Static Array node
- **Plain text** for other data types

The editor system is already set up and ready to reuse. You just need to know the pattern!

---

## Core Components

### 1. Monaco Editor

The actual editor engine from VS Code.

```typescript
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
```

### 2. EditorModel

Wraps a Monaco model with OpenNoodl-specific features (TypeScript support, etc.).

```typescript
import { createModel } from '@noodl-utils/CodeEditor';
import { EditorModel } from '@noodl-utils/CodeEditor/model/editorModel';
```

### 3. CodeEditor Component

React component that renders the Monaco editor with toolbar and resizing.

```typescript
import { CodeEditor, CodeEditorProps } from '@noodl-editor/views/panels/propertyeditor/CodeEditor/CodeEditor';
```

### 4. PopupLayer

Utility for showing popups (used for code editor popups).

```typescript
import PopupLayer from '@noodl-editor/views/popuplayer';
```

---

## Supported Languages

The `createModel` utility supports these languages:

| Language     | Usage                 | Features                                           |
| ------------ | --------------------- | -------------------------------------------------- |
| `javascript` | Function nodes        | TypeScript checking, autocomplete, Noodl API types |
| `typescript` | Script nodes          | Full TypeScript support                            |
| `json`       | Static Array, Objects | JSON validation, formatting                        |
| `plaintext`  | Other data            | Basic text editing                                 |

---

## Basic Pattern (Inline Editor)

If you want an inline code editor (not in a popup):

```tsx
import React, { useState } from 'react';

import { createModel } from '@noodl-utils/CodeEditor';

import { CodeEditor } from '../path/to/CodeEditor';

function MyComponent() {
  // 1. Create the editor model
  const model = createModel({
    value: '[]', // Initial code
    codeeditor: 'json' // Language
  });

  // 2. Render the editor
  return (
    <CodeEditor
      model={model}
      nodeId="my-unique-id" // For view state caching
      onSave={() => {
        const code = model.getValue();
        console.log('Saved:', code);
      }}
    />
  );
}
```

---

## Popup Pattern (Property Panel Style)

This is how the Function and Static Array nodes work - clicking a button opens a popup with the editor.

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';

import { createModel } from '@noodl-utils/CodeEditor';

import { CodeEditor, CodeEditorProps } from '../path/to/CodeEditor';
import PopupLayer from '../path/to/popuplayer';

function openCodeEditorPopup(initialValue: string, onSave: (value: string) => void) {
  // 1. Create model
  const model = createModel({
    value: initialValue,
    codeeditor: 'json'
  });

  // 2. Create popup container
  const popupDiv = document.createElement('div');
  const root = createRoot(popupDiv);

  // 3. Configure editor props
  const props: CodeEditorProps = {
    nodeId: 'my-editor-instance',
    model: model,
    initialSize: { x: 700, y: 500 },
    onSave: () => {
      const code = model.getValue();
      onSave(code);
    }
  };

  // 4. Render editor
  root.render(React.createElement(CodeEditor, props));

  // 5. Show popup
  const button = document.querySelector('#my-button');
  PopupLayer.showPopout({
    content: { el: [popupDiv] },
    attachTo: $(button),
    position: 'right',
    disableDynamicPositioning: true,
    onClose: () => {
      // Save and cleanup
      const code = model.getValue();
      onSave(code);
      model.dispose();
      root.unmount();
    }
  });
}

// Usage
<button
  onClick={() =>
    openCodeEditorPopup('[]', (code) => {
      console.log('Saved:', code);
    })
  }
>
  Edit JSON
</button>;
```

---

## Full Example: JSON Editor for Array/Object Variables

Here's a complete example of integrating a JSON editor into a form:

```tsx
import { CodeEditor, CodeEditorProps } from '@noodl-editor/views/panels/propertyeditor/CodeEditor/CodeEditor';
import PopupLayer from '@noodl-editor/views/popuplayer';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { createModel } from '@noodl-utils/CodeEditor';

interface JSONEditorButtonProps {
  value: string;
  onChange: (value: string) => void;
  type: 'array' | 'object';
}

function JSONEditorButton({ value, onChange, type }: JSONEditorButtonProps) {
  const handleClick = () => {
    // Create model
    const model = createModel({
      value: value,
      codeeditor: 'json'
    });

    // Create popup
    const popupDiv = document.createElement('div');
    const root = createRoot(popupDiv);

    const props: CodeEditorProps = {
      nodeId: `json-editor-${type}`,
      model: model,
      initialSize: { x: 600, y: 400 },
      onSave: () => {
        try {
          const code = model.getValue();
          // Validate JSON
          JSON.parse(code);
          onChange(code);
        } catch (e) {
          console.error('Invalid JSON:', e);
        }
      }
    };

    root.render(React.createElement(CodeEditor, props));

    PopupLayer.showPopout({
      content: { el: [popupDiv] },
      attachTo: $(event.currentTarget),
      position: 'right',
      onClose: () => {
        props.onSave();
        model.dispose();
        root.unmount();
      }
    });
  };

  return <button onClick={handleClick}>Edit {type === 'array' ? 'Array' : 'Object'} ➜</button>;
}

// Usage
function MyForm() {
  const [arrayValue, setArrayValue] = useState('[]');

  return (
    <div>
      <label>My Array:</label>
      <JSONEditorButton value={arrayValue} onChange={setArrayValue} type="array" />
    </div>
  );
}
```

---

## Key APIs

### createModel(options, node?)

Creates an EditorModel with Monaco model configured for a language.

**Parameters:**

- `options.value` (string): Initial code
- `options.codeeditor` (string): Language ID (`'javascript'`, `'typescript'`, `'json'`, `'plaintext'`)
- `node` (optional): NodeGraphNode for TypeScript features

**Returns:** `EditorModel`

**Example:**

```typescript
const model = createModel({
  value: '{"key": "value"}',
  codeeditor: 'json'
});
```

### EditorModel Methods

- `getValue()`: Get current code as string
- `setValue(code: string)`: Set code
- `model`: Access underlying Monaco model
- `dispose()`: Clean up (important!)

### CodeEditor Props

```typescript
interface CodeEditorProps {
  nodeId: string; // Unique ID for view state caching
  model: EditorModel; // The editor model
  initialSize?: IVector2; // { x: width, y: height }
  onSave: () => void; // Save callback
  outEditor?: (editor) => void; // Get editor instance
}
```

---

## Common Patterns

### Pattern 1: Simple JSON Editor

For editing JSON data inline:

```typescript
const model = createModel({ value: '{}', codeeditor: 'json' });
<CodeEditor
  model={model}
  nodeId="my-json"
  onSave={() => {
    const json = JSON.parse(model.getValue());
    // Use json
  }}
/>;
```

### Pattern 2: JavaScript with TypeScript Checking

For scripts with type checking:

```typescript
const model = createModel(
  {
    value: 'function myFunc() { }',
    codeeditor: 'javascript'
  },
  nodeInstance
); // Pass node for types
```

### Pattern 3: Popup on Button Click

For property panel-style editors:

```typescript
<button
  onClick={() => {
    const model = createModel({ value, codeeditor: 'json' });
    // Create popup (see full example above)
  }}
>
  Edit Code
</button>
```

---

## Pitfalls & Solutions

### ❌ Pitfall: CRITICAL - Never Bypass createModel()

**This is the #1 mistake that causes worker errors!**

```typescript
// ❌ WRONG - Bypasses worker configuration
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const model = monaco.editor.createModel(value, 'json');
// Result: "Error: Unexpected usage" worker errors!
```

```typescript
// ✅ CORRECT - Use createModel utility
import { createModel } from '@noodl-utils/CodeEditor';

const model = createModel({
  type: 'array', // or 'object', 'string'
  value: value,
  codeeditor: 'javascript' // arrays/objects use this!
});
// Result: Works perfectly, no worker errors
```

**Why this matters:**

- `createModel()` configures TypeScript/JavaScript workers properly
- Direct Monaco API skips this configuration
- You get "Cannot use import statement outside a module" errors
- **Always use `createModel()` - it's already set up for you!**

### ❌ Pitfall: Forgetting to dispose

```typescript
// BAD - Memory leak
const model = createModel({...});
// Never disposed!
```

```typescript
// GOOD - Always dispose
const model = createModel({...});
// ... use model ...
model.dispose(); // Clean up when done
```

### ❌ Pitfall: Invalid JSON crashes

```typescript
// BAD - No validation
const code = model.getValue();
const json = JSON.parse(code); // Throws if invalid!
```

```typescript
// GOOD - Validate first
try {
  const code = model.getValue();
  const json = JSON.parse(code);
  // Use json
} catch (e) {
  console.error('Invalid JSON');
}
```

### ❌ Pitfall: Using wrong language

```typescript
// BAD - Language doesn't match data
createModel({ value: '{"json": true}', codeeditor: 'javascript' });
// No JSON validation!
```

```typescript
// GOOD - Match language to data type
createModel({ value: '{"json": true}', codeeditor: 'json' });
// Proper validation
```

---

## Testing Your Integration

1. **Open the editor** - Does it appear correctly?
2. **Syntax highlighting** - Is JSON/JS highlighted?
3. **Error detection** - Enter invalid JSON, see red squiggles?
4. **Auto-format** - Press Ctrl+Shift+F, does it format?
5. **Save works** - Edit and save, does `onSave` trigger?
6. **Resize works** - Can you drag to resize?
7. **Close works** - Does it cleanup on close?

---

## Where It's Used in OpenNoodl

Study these for real examples:

| Location                                                                                        | What                       | Language   |
| ----------------------------------------------------------------------------------------------- | -------------------------- | ---------- |
| `packages/noodl-viewer-react/src/nodes/std-library/data/staticdata.js`                          | Static Array node          | JSON       |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts` | Property panel integration | All        |
| `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/components/AiChat/AiChat.tsx` | AI code editor             | JavaScript |

---

## Summary

**To reuse code editors:**

1. Import `createModel` and `CodeEditor`
2. Create a model with `createModel({ value, codeeditor })`
3. Render `<CodeEditor model={model} ... />`
4. Handle `onSave` callback
5. Dispose model when done

**For popups** (recommended):

- Use `PopupLayer.showPopout()`
- Render editor into popup div
- Clean up in `onClose`

---

_Last Updated: January 2025_
