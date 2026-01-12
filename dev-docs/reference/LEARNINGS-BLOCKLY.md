# Blockly Integration Learnings

**Created:** 2026-01-12  
**Source:** TASK-012 Blockly Logic Builder Integration  
**Context:** Building a visual programming interface with Google Blockly in OpenNoodl

## Overview

This document captures critical learnings from integrating Google Blockly into OpenNoodl to create the Logic Builder node. These patterns are essential for anyone working with Blockly or integrating visual programming tools into the editor.

## Critical Architecture Patterns

### 1. Editor/Runtime Window Separation 🔴 CRITICAL

**The Problem:**

The OpenNoodl editor and runtime run in COMPLETELY SEPARATE JavaScript contexts (different windows/iframes). This is easy to forget and causes mysterious bugs.

**What Breaks:**

```javascript
// ❌ BROKEN - In runtime, trying to access editor objects
function updatePorts(nodeId, workspace, editorConnection) {
  // This looks reasonable but FAILS silently
  const graphModel = getGraphModel(); // Doesn't exist in runtime!
  const node = graphModel.getNodeWithId(nodeId); // Crashes here
  const code = node.parameters.generatedCode;
}
```

**The Fix:**

```javascript
// ✅ WORKING - Pass data explicitly as parameters
function updatePorts(nodeId, workspace, generatedCode, editorConnection) {
  // generatedCode passed directly - no cross-window access needed
  const detected = parseCode(generatedCode);
  editorConnection.sendDynamicPorts(nodeId, detected.ports);
}

// In editor: Pass the data explicitly
updatePorts(node.id, node.parameters.workspace, node.parameters.generatedCode, connection);
```

**Key Principle:**

> **NEVER** assume editor objects/methods are available in runtime. **ALWAYS** pass data explicitly through function parameters or event payloads.

**Applies To:**

- Any dynamic port detection
- Code generation systems
- Parameter passing between editor and runtime
- Event payloads between windows

---

### 2. Function Execution Context 🔴 CRITICAL

**The Problem:**

Using `new Function(code).call(context)` doesn't work as expected. The generated code can't access variables via `this`.

**What Breaks:**

```javascript
// ❌ BROKEN - Generated code can't access Outputs
const fn = new Function(code); // Code contains: Outputs["result"] = 'test';
fn.call(context); // context has Outputs property

// Result: ReferenceError: Outputs is not defined
```

**The Fix:**

```javascript
// ✅ WORKING - Pass context as function parameters
const fn = new Function(
  'Inputs', // Parameter names
  'Outputs',
  'Noodl',
  'Variables',
  'Objects',
  'Arrays',
  'sendSignalOnOutput',
  code // Function body
);

// Call with actual values as arguments
fn(
  context.Inputs,
  context.Outputs,
  context.Noodl,
  context.Variables,
  context.Objects,
  context.Arrays,
  context.sendSignalOnOutput
);
```

**Why This Works:**

The function parameters create a proper lexical scope where the generated code can access variables by name.

**Code Generator Pattern:**

```javascript
// When generating code, reference parameters directly
javascriptGenerator.forBlock['noodl_set_output'] = function (block) {
  const name = block.getFieldValue('NAME');
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.ASSIGNMENT);

  // Generated code uses parameter name directly
  return `Outputs["${name}"] = ${value};\n`;
};
```

**Key Principle:**

> **ALWAYS** pass execution context as function parameters. **NEVER** rely on `this` or `.call()` for context in dynamically compiled code.

---

### 3. Blockly v10+ API Compatibility 🟡 IMPORTANT

**The Problem:**

Blockly v10+ uses a completely different API from older versions. Documentation and examples online are often outdated.

**What Breaks:**

```javascript
// ❌ BROKEN - Old API (pre-v10)
import * as Blockly from 'blockly';

import 'blockly/javascript';

// These don't exist in v10+:
Blockly.JavaScript.ORDER_MEMBER;
Blockly.JavaScript.ORDER_ASSIGNMENT;
Blockly.JavaScript.workspaceToCode(workspace);
```

**The Fix:**

```javascript
// ✅ WORKING - Modern v10+ API
import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

// Use named exports
Order.MEMBER;
Order.ASSIGNMENT;
javascriptGenerator.workspaceToCode(workspace);
```

**Complete Migration Guide:**

| Old API (pre-v10)                      | New API (v10+)                               |
| -------------------------------------- | -------------------------------------------- |
| `Blockly.JavaScript.ORDER_*`           | `Order.*` from `blockly/javascript`          |
| `Blockly.JavaScript['block_type']`     | `javascriptGenerator.forBlock['block_type']` |
| `Blockly.JavaScript.workspaceToCode()` | `javascriptGenerator.workspaceToCode()`      |
| `Blockly.JavaScript.valueToCode()`     | `javascriptGenerator.valueToCode()`          |

**Key Principle:**

> **ALWAYS** use named imports from `blockly/javascript`. Check Blockly version first before following online examples.

---

### 4. Z-Index Layering (React + Legacy Canvas) 🟡 IMPORTANT

**The Problem:**

React overlays on legacy jQuery/canvas systems can be invisible if z-index isn't explicitly set.

**What Breaks:**

```html
<!-- ❌ BROKEN - Tabs invisible behind canvas -->
<div id="canvas-tabs-root" style="width: 100%; height: 100%">
  <div class="tabs">...</div>
</div>
<canvas id="canvas" style="position: absolute; top: 0; left: 0">
  <!-- Canvas renders ON TOP of tabs! -->
</canvas>
```

**The Fix:**

```html
<!-- ✅ WORKING - Explicit z-index layering -->
<div id="canvas-tabs-root" style="position: absolute; z-index: 100; pointer-events: none">
  <div class="tabs" style="pointer-events: all">
    <!-- Tabs visible and clickable -->
  </div>
</div>
<canvas id="canvas" style="position: absolute; top: 0; left: 0">
  <!-- Canvas in background -->
</canvas>
```

**Pointer Events Strategy:**

1. **Container:** `pointer-events: none` (transparent to clicks)
2. **Content:** `pointer-events: all` (captures clicks)
3. **Result:** Canvas clickable when no tabs, tabs clickable when present

**CSS Pattern:**

```scss
#canvas-tabs-root {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100; // Above canvas
  pointer-events: none; // Transparent when empty
}

.CanvasTabs {
  pointer-events: all; // Clickable when rendered
}
```

**Key Principle:**

> In mixed legacy/React systems, **ALWAYS** set explicit `position` and `z-index`. Use `pointer-events` to manage click-through behavior.

---

## Blockly-Specific Patterns

### Block Registration

**Must Call Before Workspace Creation:**

```typescript
// ❌ WRONG - Blocks never registered
useEffect(() => {
  const workspace = Blockly.inject(...); // Fails - blocks don't exist yet
}, []);

// ✅ CORRECT - Register first, then inject
useEffect(() => {
  initBlocklyIntegration(); // Registers custom blocks
  const workspace = Blockly.inject(...); // Now blocks exist
}, []);
```

**Initialization Guard Pattern:**

```typescript
let blocklyInitialized = false;

export function initBlocklyIntegration() {
  if (blocklyInitialized) return; // Safe to call multiple times

  // Register blocks
  Blockly.Blocks['my_block'] = {...};
  javascriptGenerator.forBlock['my_block'] = function(block) {...};

  blocklyInitialized = true;
}
```

### Toolbox Configuration

**Categories Must Reference Registered Blocks:**

```typescript
function getDefaultToolbox() {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'My Blocks',
        colour: 230,
        contents: [
          { kind: 'block', type: 'my_block' } // Must match Blockly.Blocks key
        ]
      }
    ]
  };
}
```

### Workspace Persistence

**Save/Load Pattern:**

```typescript
// Save to JSON
const json = Blockly.serialization.workspaces.save(workspace);
const workspaceStr = JSON.stringify(json);
onSave(workspaceStr);

// Load from JSON
const json = JSON.parse(workspaceStr);
Blockly.serialization.workspaces.load(json, workspace);
```

### Code Generation Pattern

**Block Definition:**

```javascript
Blockly.Blocks['noodl_set_output'] = {
  init: function () {
    this.appendValueInput('VALUE')
      .setCheck(null)
      .appendField('set output')
      .appendField(new Blockly.FieldTextInput('result'), 'NAME');
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(230);
  }
};
```

**Code Generator:**

```javascript
javascriptGenerator.forBlock['noodl_set_output'] = function (block, generator) {
  const name = block.getFieldValue('NAME');
  const value = generator.valueToCode(block, 'VALUE', Order.ASSIGNMENT) || '""';

  // Return JavaScript code
  return `Outputs["${name}"] = ${value};\n`;
};
```

---

## Dynamic Port Detection

### Regex Parsing (MVP Pattern)

For MVP, simple regex parsing is sufficient:

```javascript
function detectOutputPorts(generatedCode) {
  const outputs = [];
  const regex = /Outputs\["([^"]+)"\]/g;
  let match;

  while ((match = regex.exec(generatedCode)) !== null) {
    const name = match[1];
    if (!outputs.find((o) => o.name === name)) {
      outputs.push({ name, type: '*' });
    }
  }

  return outputs;
}
```

**When To Use:**

- MVP/prototypes
- Simple output detection
- Known code patterns

**When To Upgrade:**

- Need input detection
- Signal detection
- Complex expressions
- AST-based analysis needed

### AST Parsing (Future Pattern)

For production, use proper AST parsing:

```javascript
import * as acorn from 'acorn';

function detectPorts(code) {
  const ast = acorn.parse(code, { ecmaVersion: 2020 });
  const detected = { inputs: [], outputs: [], signals: [] };

  // Walk AST and detect patterns
  walk(ast, {
    MemberExpression(node) {
      if (node.object.name === 'Outputs') {
        detected.outputs.push(node.property.value);
      }
    }
  });

  return detected;
}
```

---

## Event Coordination Patterns

### Editor → Runtime Communication

**Use Event Payloads:**

```javascript
// Editor side
EventDispatcher.instance.notifyListeners('LogicBuilder.Updated', {
  nodeId: node.id,
  workspace: workspaceJSON,
  generatedCode: code // Send all needed data
});

// Runtime side
graphModel.on('parameterUpdated', function (event) {
  if (event.name === 'generatedCode') {
    const code = node.parameters.generatedCode; // Now available
    updatePorts(node.id, workspace, code, editorConnection);
  }
});
```

### Canvas Visibility Coordination

**EventDispatcher Pattern:**

```javascript
// When Logic Builder tab opens
EventDispatcher.instance.notifyListeners('LogicBuilder.TabOpened');

// Canvas hides itself
EventDispatcher.instance.on('LogicBuilder.TabOpened', () => {
  setCanvasVisibility(false);
});

// When all tabs closed
EventDispatcher.instance.notifyListeners('LogicBuilder.AllTabsClosed');

// Canvas shows itself
EventDispatcher.instance.on('LogicBuilder.AllTabsClosed', () => {
  setCanvasVisibility(true);
});
```

---

## Common Pitfalls

### ❌ Don't: Wrap Legacy in React

```typescript
// ❌ WRONG - Trying to render canvas in React
function CanvasTabs() {
  return (
    <div>
      <div id="canvas-container">{/* Can't put canvas here - it's rendered by vanilla JS */}</div>
      <LogicBuilderTab />
    </div>
  );
}
```

### ✅ Do: Separate Concerns

```typescript
// ✅ CORRECT - Canvas and React separate
// Canvas always rendered by vanilla JS
// React tabs overlay when needed

function CanvasTabs() {
  return tabs.length > 0 ? (
    <div className="overlay">
      {tabs.map((tab) => (
        <Tab key={tab.id} {...tab} />
      ))}
    </div>
  ) : null;
}
```

### ❌ Don't: Assume Shared Context

```javascript
// ❌ WRONG - Accessing editor from runtime
function runtimeFunction() {
  const model = ProjectModel.instance; // Doesn't exist in runtime!
  const node = model.getNode(nodeId);
}
```

### ✅ Do: Pass Data Explicitly

```javascript
// ✅ CORRECT - Data passed as parameters
function runtimeFunction(nodeId, data, connection) {
  // All data provided explicitly
  processData(data);
  connection.sendResult(nodeId, result);
}
```

---

## Testing Strategies

### Manual Testing Checklist

- [ ] Blocks appear in toolbox
- [ ] Blocks draggable onto workspace
- [ ] Workspace saves correctly
- [ ] Code generation works
- [ ] Dynamic ports appear
- [ ] Execution triggers
- [ ] Output values flow
- [ ] Tabs manageable (open/close)
- [ ] Canvas switching works
- [ ] Z-index layering correct

### Debug Logging Pattern

```javascript
// Temporary debug logs (remove before production)
console.log('[BlocklyWorkspace] Code generated:', code.substring(0, 100));
console.log('[Logic Builder] Detected ports:', detectedPorts);
console.log('[Runtime] Execution context:', Object.keys(context));
```

**Remove or gate behind flag:**

```javascript
const DEBUG = false; // Set via environment variable

if (DEBUG) {
  console.log('[Debug] Important info:', data);
}
```

---

## Performance Considerations

### Blockly Workspace Size

- Small projects (<50 blocks): No issues
- Medium (50-200 blocks): Slight lag on load
- Large (>200 blocks): Consider workspace pagination

### Code Generation

- Generated code is cached (only regenerates on change)
- Regex parsing is O(n) where n = code length (fast enough)
- AST parsing is slower but more accurate

### React Re-renders

```typescript
// Memoize expensive operations
const toolbox = useMemo(() => getDefaultToolbox(), []);
const workspace = useMemo(() => createWorkspace(toolbox), [toolbox]);
```

---

## Future Enhancements

### Input Port Detection

```javascript
// Detect: Inputs["myInput"]
const inputRegex = /Inputs\["([^"]+)"\]/g;
```

### Signal Output Detection

```javascript
// Detect: sendSignalOnOutput("mySignal")
const signalRegex = /sendSignalOnOutput\s*\(\s*["']([^"']+)["']\s*\)/g;
```

### Block Marketplace

- User-contributed blocks
- Import/export block definitions
- Block versioning system

### Visual Debugging

- Step through blocks execution
- Variable inspection
- Breakpoints in visual logic

---

## Key Takeaways

1. **Editor and runtime are SEPARATE windows** - never forget this
2. **Pass context as function parameters** - not via `this`
3. **Use Blockly v10+ API** - check imports carefully
4. **Set explicit z-index** - don't rely on DOM order
5. **Keep legacy and React separate** - coordinate via events
6. **Initialize blocks before workspace** - order matters
7. **Test with real user flow** - early and often
8. **Document discoveries immediately** - while context is fresh

---

## References

- [Blockly Documentation](https://developers.google.com/blockly)
- [OpenNoodl TASK-012 Complete](../tasks/phase-3-editor-ux-overhaul/TASK-012-blockly-integration/)
- [Window Context Patterns](./LEARNINGS-RUNTIME.md#window-separation)
- [Z-Index Layering](./LEARNINGS.md#react-legacy-integration)

---

**Last Updated:** 2026-01-12  
**Maintainer:** Development Team  
**Status:** Production-Ready Patterns
