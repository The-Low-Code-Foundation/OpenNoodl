# Project Learnings

This document captures important discoveries and gotchas encountered during OpenNoodl development.

---

## ✅ VersionControlPanel is Already React! (Jan 18, 2026)

### The Good News: No jQuery Rewrite Needed

**Context**: Phase 3 TASK-002B GitHub Advanced Integration - Concerned that extending the existing VersionControlPanel with GitHub features would require a jQuery-to-React rewrite.

**GREAT NEWS**: The entire VersionControlPanel is already **100% modern React**!

**What Was Verified**:

```
VersionControlPanel/
├── VersionControlPanel.tsx    ✅ React (useState, useEffect, useRef)
├── context/                   ✅ React Context API
│   └── index.tsx
├── components/
│   ├── LocalChanges.tsx       ✅ React functional component
│   ├── History.tsx            ✅ React functional component
│   ├── HistoryCommitDiff.tsx  ✅ React functional component
│   ├── CommitChangesDiff.tsx  ✅ React functional component
│   ├── DiffList.tsx           ✅ React functional component
│   ├── BranchList.tsx         ✅ React functional component
│   ├── BranchMerge.tsx        ✅ React functional component
│   ├── MergeConflicts.tsx     ✅ React functional component
│   └── Stashes.tsx            ✅ React functional component
└── hooks/
    └── useShowComponentDiffDocument.ts  ✅ React hook
```

**Modern Patterns Already in Use**:

- React hooks (useState, useEffect, useRef)
- Context API (VersionControlContext)
- TypeScript throughout
- @noodl-core-ui design system components
- NO jQuery anywhere (except PopupLayer which is separate system)

**Visual Diff System Already Works**:
The "green nodes for additions, red for deletions" visual diff is already implemented:

1. Click any commit in History tab
2. `HistoryCommitDiff.tsx` shows the diff
3. `CommitChangesDiff.tsx` fetches project.json diff
4. `DiffList.tsx` renders component-level changes
5. `useShowComponentDiffDocument` opens visual node graph diff

**Integration Strategy**:
Instead of creating a separate GitHubPanel, extend VersionControlPanel:

```typescript
// Just add new tabs to existing panel
<Tabs
  tabs={[
    { id: 'changes', content: <LocalChanges /> }, // Existing
    { id: 'history', content: <History /> }, // Existing
    { id: 'issues', content: <IssuesTab /> }, // NEW (11-16 hours)
    { id: 'prs', content: <PullRequestsTab /> } // NEW
  ]}
/>
```

**Why This Matters**:

- **No rewrite needed** - Just add React components to existing React panel
- **Shared context** - Can extend VersionControlContext with GitHub state
- **Visual diffs work** - The killer feature is already implemented
- **Familiar UX** - Users already know the Version Control panel

**Time Saved**: Estimated 50+ hours saved vs creating separate panel or rewriting jQuery.

**Documentation**: Created `GIT-INTEGRATION-STRATEGY.md` with full implementation plan.

**Location**:

- Panel: `packages/noodl-editor/src/editor/src/views/panels/VersionControlPanel/`
- Strategy: `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-002B-github-advanced-integration/GIT-INTEGRATION-STRATEGY.md`

**Keywords**: VersionControlPanel, React, GitHub integration, visual diff, DiffList, History, no jQuery, extend existing panel

---

## 🏗️ CRITICAL ARCHITECTURE PATTERNS

These fundamental patterns apply across ALL Noodl development. Understanding them prevents hours of debugging.

---

## 📊 Property Expression Runtime Context (Jan 16, 2026)

### The Context Trap: Why evaluateExpression() Needs undefined, Not this.context

**Context**: TASK-006 Expressions Overhaul - Property expressions in the properties panel weren't evaluating. Error: "scope.get is not a function".

**The Problem**: The `evaluateExpression()` function in `expression-evaluator.js` expects either `undefined` (to use global Model) or a Model scope object. Passing `this.context` (the runtime node context with editorConnection, styles, etc.) caused the error because it lacks a `.get()` method.

**The Broken Pattern**:

```javascript
// ❌ WRONG - this.context is NOT a Model scope
Node.prototype._evaluateExpressionParameter = function (paramValue, portName) {
  const compiled = compileExpression(paramValue.expression);
  const result = evaluateExpression(compiled, this.context); // ☠️ scope.get is not a function
};
```

**The Correct Pattern**:

```javascript
// ✅ RIGHT - Pass undefined to use global Model
Node.prototype._evaluateExpressionParameter = function (paramValue, portName) {
  const compiled = compileExpression(paramValue.expression);
  const result = evaluateExpression(compiled, undefined); // ✅ Uses global Model
};
```

**Why This Works**:

The expression-evaluator's `createNoodlContext()` function does:

```javascript
const scope = modelScope || Model; // Falls back to global Model
const variablesModel = scope.get('--ndl--global-variables');
```

When `undefined` is passed, it uses the global `Model` which has the `.get()` method. The runtime's `this.context` is a completely different object containing `editorConnection`, `styles`, etc.

**Reactive Expression Subscriptions**:

To make expressions update when Variables change, the expression-evaluator already has:

- `detectDependencies(expression)` - finds what Variables/Objects/Arrays are referenced
- `subscribeToChanges(dependencies, callback)` - subscribes to Model changes

Wire these up in `_evaluateExpressionParameter`:

```javascript
// Set up reactive subscription
if (!this._expressionSubscriptions[portName]) {
  const dependencies = detectDependencies(paramValue.expression);
  if (dependencies.variables.length > 0) {
    this._expressionSubscriptions[portName] = subscribeToChanges(
      dependencies,
      function () {
        if (this._deleted) return;
        this.queueInput(portName, paramValue); // Re-evaluate
      }.bind(this)
    );
  }
}
```

**Critical Rules**:

1. **NEVER** pass `this.context` to `evaluateExpression()` - it's not a Model scope
2. **ALWAYS** pass `undefined` to use the global Model for Variables/Objects/Arrays
3. **Clean up subscriptions** in `_onNodeDeleted()` to prevent memory leaks
4. **Track subscriptions by port name** to avoid duplicate listeners

**Applies To**:

- Property panel expression fields
- Any runtime expression evaluation
- Future expression support in other property types

**Time Saved**: This pattern prevents 1-2 hours debugging "scope.get is not a function" errors.

**Location**:

- Fixed in: `packages/noodl-runtime/src/node.js`
- Expression evaluator: `packages/noodl-runtime/src/expression-evaluator.js`
- Task: Phase 3 TASK-006 Expressions Overhaul

**Keywords**: expression, evaluateExpression, this.context, Model scope, scope.get, Variables, reactive, subscribeToChanges, detectDependencies

---

## 🔴 Editor/Runtime Window Separation (Jan 2026)

### The Invisible Boundary: Why Editor Methods Don't Exist in Runtime

**Context**: TASK-012 Blockly Integration - Discovered that editor and runtime run in completely separate JavaScript contexts (different windows/iframes). This is THE most important architectural detail to understand.

**CRITICAL PRINCIPLE**: The OpenNoodl editor and runtime are NOT in the same JavaScript execution context. They are separate windows that communicate via message passing.

**What This Means**:

```
┌─────────────────────┐         ┌─────────────────────┐
│   Editor Window     │ Message │   Runtime Window    │
│                     │ Passing │                     │
│ - ProjectModel      │←-------→│ - Node execution    │
│ - NodeGraphEditor   │         │ - Dynamic ports     │
│ - graphModel        │         │ - Code compilation  │
│ - UI components     │         │ - No editor access! │
└─────────────────────┘         └─────────────────────┘
```

**The Broken Pattern**:

```javascript
// ❌ WRONG - In runtime node code, trying to access editor
function updatePorts(nodeId, workspace, editorConnection) {
  // These look reasonable but FAIL silently or crash:
  const graphModel = getGraphModel(); // ☠️ Doesn't exist in runtime!
  const node = graphModel.getNodeWithId(nodeId); // ☠️ graphModel is undefined
  const code = node.parameters.generatedCode; // ☠️ Can't access node this way

  // Problem: Runtime has NO ACCESS to editor objects/methods
}
```

**The Correct Pattern**:

```javascript
// ✅ RIGHT - Pass ALL data explicitly via parameters
function updatePorts(nodeId, workspace, generatedCode, editorConnection) {
  // generatedCode passed directly - no cross-window access needed
  const detected = parseCode(generatedCode);
  editorConnection.sendDynamicPorts(nodeId, detected.ports);

  // All data provided explicitly through function parameters
}

// In editor: Pass the data explicitly when calling
const node = graphModel.getNodeWithId(nodeId);
updatePorts(
  node.id,
  node.parameters.workspace,
  node.parameters.generatedCode, // ✅ Pass explicitly
  editorConnection
);
```

**Why This Matters**:

- **Silent failures**: Attempting to access editor objects from runtime often fails silently
- **Mysterious undefined errors**: "Cannot read property X of undefined" when objects don't exist
- **Debugging nightmare**: Looks like your code is wrong when it's an architecture issue
- **Affects ALL editor/runtime communication**: Dynamic ports, code generation, parameter updates

**Common Mistakes**:

1. Looking up nodes in graphModel from runtime
2. Accessing ProjectModel from runtime
3. Trying to call editor methods from node setup functions
4. Assuming shared global scope between editor and runtime

**Critical Rules**:

1. **NEVER** assume editor objects exist in runtime code
2. **ALWAYS** pass data explicitly through function parameters
3. **NEVER** look up nodes via graphModel from runtime
4. **ALWAYS** use event payloads with complete data
5. **TREAT** editor and runtime as separate processes that only communicate via messages

**Applies To**:

- Dynamic port detection systems
- Code generation and compilation
- Parameter updates and node configuration
- Custom property editors
- Any feature bridging editor and runtime

**Detection**:

- Runtime errors about undefined objects that "should exist"
- Functions that work in editor but fail in runtime
- Dynamic features that don't update when they should
- Silent failures with no error messages

**Time Saved**: Understanding this architectural boundary can save 2-4 hours PER feature that crosses the editor/runtime divide.

**Location**: Discovered in TASK-012 Blockly Integration (Logic Builder dynamic ports)

**Keywords**: editor runtime separation, window context, iframe, cross-context communication, graphModel, ProjectModel, dynamic ports, architecture boundary

---

## 🟡 Dynamic Code Compilation Context (Jan 2026)

### The this Trap: Why new Function() + .call() Doesn't Work

**Context**: TASK-012 Blockly Integration - Generated code failed with "ReferenceError: Outputs is not defined" despite context being passed via `.call()`.

**CRITICAL PRINCIPLE**: When using `new Function()` to compile user code dynamically, execution context MUST be passed as function parameters, NOT via `this` or `.call()`.

**The Problem**: Modern JavaScript scoping rules make `this` unreliable for providing execution context to dynamically compiled code.

**The Broken Pattern**:

```javascript
// ❌ WRONG - Generated code can't access context variables
const fn = new Function(code); // Code contains: Outputs["result"] = 'test';
fn.call(context); // context = { Outputs: {}, Inputs: {}, Noodl: {...} }

// Result: ReferenceError: Outputs is not defined
// Why: Generated code has no lexical access to context properties
```

**The Correct Pattern**:

```javascript
// ✅ RIGHT - Pass context as function parameters
const fn = new Function(
  'Inputs', // Parameter names define lexical scope
  'Outputs',
  'Noodl',
  'Variables',
  'Objects',
  'Arrays',
  'sendSignalOnOutput',
  code // Function body - can reference parameters by name
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

// Generated code: Outputs["result"] = 'test'; // ✅ Works! Outputs is in scope
```

**Why This Works**:

Function parameters create a proper lexical scope where the generated code can access variables by their parameter names. This is how closures and scope work in JavaScript.

**Code Generator Pattern**:

```javascript
// When generating code, reference parameters directly
javascriptGenerator.forBlock['set_output'] = function (block) {
  const name = block.getFieldValue('NAME');
  const value = javascriptGenerator.valueToCode(block, 'VALUE', Order.ASSIGNMENT);

  // Generated code uses parameter name directly - no 'context.' prefix needed
  return `Outputs["${name}"] = ${value};\n`;
};

// Result: Outputs["result"] = "hello"; // Parameter name, not property access
```

**Comparison with eval()** (Don't use eval, but this explains the difference):

```javascript
// eval() has access to surrounding scope (dangerous!)
const context = { Outputs: {} };
eval('Outputs["result"] = "test"'); // Works but unsafe

// new Function() creates isolated scope (safe!)
const fn = new Function('Outputs', 'Outputs["result"] = "test"');
fn(context.Outputs); // Safe and works
```

**Critical Rules**:

1. **ALWAYS** pass execution context as function parameters
2. **NEVER** rely on `this` or `.call()` for context in compiled code
3. **GENERATE** code that references parameters directly, not properties
4. **LIST** all context variables as function parameters
5. **PASS** arguments in same order as parameters

**Applies To**:

- Expression node evaluation
- JavaScript Function node execution
- Logic Builder block code generation
- Any dynamic code compilation system
- Script evaluation in custom nodes

**Common Mistakes**:

1. Using `.call(context)` and expecting generated code to access context properties
2. Using `.apply(context, args)` but not listing context as parameters
3. Generating code with `context.Outputs` instead of just `Outputs`
4. Forgetting to pass an argument for every parameter

**Detection**:

- "ReferenceError: [variable] is not defined" when executing compiled code
- Variables exist in context but code can't access them
- `.call()` or `.apply()` used but doesn't provide access
- Generated code works in eval() but not new Function()

**Time Saved**: This pattern prevents 1-2 hours of debugging per dynamic code feature. The error message gives no clue that the problem is parameter passing.

**Location**: Discovered in TASK-012 Blockly Integration (Logic Builder execution)

**Keywords**: new Function, dynamic code, compilation, execution context, this, call, apply, parameters, lexical scope, ReferenceError, code generation

---

## 🎨 React Overlay Z-Index Pattern (Jan 2026)

### The Invisible UI: Why React Overlays Disappear Behind Canvas

**Context**: TASK-012 Blockly Integration - React tabs were invisible because canvas layers rendered on top. This is a universal problem when adding React to legacy canvas systems.

**CRITICAL PRINCIPLE**: When overlaying React components on legacy HTML5 Canvas or jQuery systems, DOM order alone is INSUFFICIENT. You MUST set explicit `position` and `z-index`.

**The Problem**: Absolute-positioned canvas layers render based on z-index, not DOM order. React overlays without explicit z-index appear behind the canvas.

**The Broken Pattern**:

```html
<!-- ❌ WRONG - React overlay invisible behind canvas -->
<div id="react-overlay-root" style="width: 100%; height: 100%">
  <div class="tabs">Tab controls here</div>
</div>
<canvas id="legacy-canvas" style="position: absolute; top: 0; left: 0">
  <!-- Canvas renders ON TOP even though it's after in DOM! -->
</canvas>
```

**The Correct Pattern**:

```html
<!-- ✅ RIGHT - Explicit z-index layering -->
<div id="react-overlay-root" style="position: absolute; z-index: 100; pointer-events: none">
  <div class="tabs" style="pointer-events: all">
    <!-- Tabs visible and clickable -->
  </div>
</div>
<canvas id="legacy-canvas" style="position: absolute; top: 0; left: 0">
  <!-- Canvas in background (no z-index or z-index < 100) -->
</canvas>
```

**Pointer Events Strategy**: The click-through pattern

1. **Container**: `pointer-events: none` (transparent to clicks)
2. **Content**: `pointer-events: all` (captures clicks)
3. **Result**: Canvas clickable when no React UI, React UI clickable when present

**CSS Pattern**:

```scss
#react-overlay-root {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100; // Above canvas
  pointer-events: none; // Transparent when empty
}

.ReactUIComponent {
  pointer-events: all; // Clickable when rendered
}
```

**Layer Stack** (Bottom → Top):

```
z-index: 100  ← React overlays (tabs, panels, etc.)
z-index: 50   ← Canvas overlays (comments, highlights)
z-index: 1    ← Main canvas
z-index: 0    ← Background layers
```

**Why This Matters**:

- **Silent failure**: UI renders but is invisible (no errors)
- **Works in isolation**: React components work fine in Storybook
- **Fails in integration**: Same components invisible when added to canvas
- **Not obvious**: DevTools show elements exist but can't see them

**Critical Rules**:

1. **ALWAYS** set `position: absolute` or `fixed` on overlay containers
2. **ALWAYS** set explicit `z-index` higher than canvas (e.g., 100)
3. **ALWAYS** use `pointer-events: none` on containers
4. **ALWAYS** use `pointer-events: all` on interactive content
5. **NEVER** rely on DOM order for layering with absolute positioning

**Applies To**:

- Any React overlay on canvas (tabs, panels, dialogs)
- Canvas visualization views
- Debug overlays and dev tools
- Custom editor tools and widgets
- Future canvas integration features

**Common Mistakes**:

1. Forgetting `position: absolute` on overlay (it won't stack correctly)
2. Not setting `z-index` (canvas wins by default)
3. Not using `pointer-events` management (blocks canvas clicks)
4. Setting z-index on wrong element (set on container, not children)

**Detection**:

- React component renders in React DevTools but not visible
- Element exists in DOM inspector but can't see it
- Clicking canvas area triggers React component (wrong z-order)
- Works in Storybook but invisible in editor

**Time Saved**: This pattern prevents 1-3 hours of "why is my UI invisible" debugging per overlay feature.

**Location**: Discovered in TASK-012B Blockly Integration (Tab visibility fix)

**Keywords**: z-index, React overlay, canvas layering, position absolute, pointer-events, click-through, DOM order, stacking context, legacy integration

---

## 🚫 Legacy/React Separation Pattern (Jan 2026)

### The Wrapper Trap: Why You Can't Render Canvas in React

**Context**: TASK-012 Blockly Integration - Initial attempt to wrap canvas in React tabs failed catastrophically. Canvas rendering broke completely.

**CRITICAL PRINCIPLE**: NEVER try to render legacy vanilla JS or jQuery code inside React components. Keep them completely separate and coordinate via events.

**The Problem**: Legacy canvas systems manage their own DOM, lifecycle, and rendering. React's virtual DOM and component lifecycle conflict with this, causing rendering failures, memory leaks, and crashes.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Trying to wrap canvas in React
function EditorTabs() {
  return (
    <div>
      <TabBar />
      <div id="canvas-container">
        {/* Can't put vanilla JS canvas here! */}
        {/* Canvas is rendered by nodegrapheditor.ts, not React */}
      </div>
      <BlocklyTab />
    </div>
  );
}

// Result: Canvas rendering breaks, tabs don't work, memory leaks
```

**The Correct Pattern**: Separation of Concerns

```typescript
// ✅ RIGHT - Canvas and React completely separate

// Canvas rendered by vanilla JS (always present)
// In nodegrapheditor.ts:
const canvas = document.getElementById('nodegraphcanvas');
renderCanvas(canvas); // Legacy rendering

// React tabs overlay when needed (conditional)
function EditorTabs() {
  return tabs.length > 0 ? (
    <div className="overlay">
      {tabs.map((tab) => (
        <Tab key={tab.id} {...tab} />
      ))}
    </div>
  ) : null;
}

// Coordinate visibility via EventDispatcher
EventDispatcher.instance.on('BlocklyTabOpened', () => {
  setCanvasVisibility(false); // Hide canvas
});

EventDispatcher.instance.on('BlocklyTabClosed', () => {
  setCanvasVisibility(true); // Show canvas
});
```

**Architecture**: Desktop vs Windows Metaphor

```
┌────────────────────────────────────┐
│   React Tabs (Windows)             │ ← Overlay when needed
├────────────────────────────────────┤
│   Canvas (Desktop)                 │ ← Always rendered
└────────────────────────────────────┘

• Canvas = Desktop: Always there, rendered by vanilla JS
• React Tabs = Windows: Appear/disappear, managed by React
• Coordination = Events: Show/hide via EventDispatcher
```

**Why This Matters**:

- **Canvas lifecycle independence**: Canvas manages its own rendering, events, state
- **React lifecycle conflicts**: React wants to control DOM, canvas already controls it
- **Memory leaks**: Re-rendering React components can duplicate canvas instances
- **Event handler chaos**: Both systems try to manage the same DOM events

**Critical Rules**:

1. **NEVER** put legacy canvas/jQuery in React component JSX
2. **ALWAYS** keep legacy always-rendered in background
3. **ALWAYS** coordinate visibility via EventDispatcher, not React state
4. **NEVER** try to control canvas lifecycle from React
5. **TREAT** them as separate systems that coordinate, don't integrate

**Coordination Pattern**:

```typescript
// React component listens to canvas events
useEventListener(NodeGraphEditor.instance, 'viewportChanged', (viewport) => {
  // Update React state based on canvas events
});

// Canvas listens to React events
EventDispatcher.instance.on('ReactUIAction', (data) => {
  // Canvas responds to React UI changes
});
```

**Applies To**:

- Canvas integration (node graph editor)
- Any legacy jQuery code in the editor
- Third-party libraries with their own rendering
- Future integrations with non-React systems
- Plugin systems or external tools

**Common Mistakes**:

1. Trying to `ReactDOM.render(<Canvas />)` with legacy canvas
2. Putting canvas container in React component tree
3. Managing canvas visibility with React state instead of CSS
4. Attempting to "React-ify" legacy code instead of coordinating

**Detection**:

- Canvas stops rendering after React component mounts
- Multiple canvas instances created (memory leak)
- Event handlers fire multiple times
- Canvas rendering flickers or behaves erratically
- DOM manipulation conflicts (React vs vanilla JS)

**Time Saved**: Understanding this pattern saves 4-8 hours of debugging per integration attempt. Prevents architectural dead-ends.

**Location**: Discovered in TASK-012B Blockly Integration (Canvas visibility coordination)

**Keywords**: React legacy integration, canvas React, vanilla JS React, jQuery React, separation of concerns, EventDispatcher coordination, lifecycle management, DOM conflicts

---

## 🎨 Node Color Scheme Must Match Defined Colors (Jan 11, 2026)

### The Undefined Colors Crash: When Node Picker Can't Find Color Scheme

**Context**: TASK-012 Blockly Integration - Logic Builder node caused EditorNode component to crash with "Cannot read properties of undefined (reading 'text')" when trying to render in the node picker.

**The Problem**: Node definition used `color: 'purple'` which doesn't exist in Noodl's color scheme system. The EditorNode component expected a valid color scheme object but received `undefined`, causing the crash.

**Root Cause**: Noodl has a fixed set of color schemes defined in `nodelibraryexport.js`. Using a non-existent color name causes the node picker to pass `undefined` for the colors prop, breaking the UI.

**The Broken Pattern**:

```javascript
// ❌ WRONG - 'purple' is not a defined color scheme
const LogicBuilderNode = {
  name: 'Logic Builder',
  category: 'Logic',
  color: 'purple' // ☠️ Doesn't exist! Causes crash
  // ...
};
```

**The Correct Pattern**:

```javascript
// ✅ RIGHT - Use defined color schemes
const LogicBuilderNode = {
  name: 'Logic Builder',
  category: 'CustomCode',
  color: 'javascript' // ✓ Exists and works
  // ...
};
```

**Available Color Schemes** (from `nodelibraryexport.js`):

| Color Name   | Visual Color | Use Case                |
| ------------ | ------------ | ----------------------- |
| `visual`     | Blue         | Visual/UI nodes         |
| `data`       | Green        | Data nodes              |
| `javascript` | Pink/Magenta | Custom code nodes       |
| `component`  | Purple       | Component utility nodes |
| `default`    | Gray         | Generic/utility nodes   |

**Critical Rules**:

1. **Always use an existing color scheme name** - Check nodelibraryexport.js for valid values
2. **Match similar node categories** - Look at Expression/Function nodes for custom code
3. **Test in node picker immediately** - Color crashes prevent the picker from opening

**How to Verify**:

```bash
# Find color definitions
grep -A 20 "colors: {" packages/noodl-runtime/src/nodelibraryexport.js

# Search for similar nodes' color usage
grep "color:" packages/noodl-runtime/src/nodes/std-library/*.js
```

**Common Mistakes**:

- Using descriptive names like `'purple'`, `'red'`, `'custom'` - these don't exist
- Assuming color names match visual appearance - `'javascript'` is pink, not beige
- Forgetting that `category` and `color` serve different purposes

**Symptoms**:

- EditorNode crash: "Cannot read properties of undefined"
- Node picker fails to open
- Console shows errors about colors.text, colors.headerHighlighted
- SVG icon errors (side effect of missing color scheme)

**Time Lost**: 30 minutes debugging what appeared to be an unrelated React component issue

**Location**:

- Fixed in: `packages/noodl-runtime/src/nodes/std-library/logic-builder.js`
- Color definitions: `packages/noodl-runtime/src/nodelibraryexport.js` (lines 165-225)
- Task: Phase 3 TASK-012 Blockly Integration

**Keywords**: color scheme, node picker, EditorNode crash, undefined colors, nodelibraryexport, color validation, node registration, custom nodes

---

## ⚙️ Runtime Node Method Structure (Jan 11, 2026)

### The Invisible Method: Why prototypeExtensions Methods Aren't Accessible from Inputs

**Context**: Phase 3 TASK-008 Critical Runtime Bugs - Expression node was throwing `TypeError: this._scheduleEvaluateExpression is not a function` when the Run signal was triggered, despite the method being clearly defined in the node definition.

**The Problem**: Methods defined in `prototypeExtensions` with descriptor syntax (`{ value: function() {...} }`) are NOT accessible from `inputs` callbacks. Calling `this._methodName()` from an input handler fails with "not a function" error.

**Root Cause**: Node definition structure has two places to define methods:

- **`prototypeExtensions`**: Uses ES5 descriptor syntax, methods added to prototype at registration time
- **`methods`**: Simple object with functions, methods accessible everywhere via `this`

Input callbacks execute in a different context where `prototypeExtensions` methods aren't accessible.

**The Broken Pattern**:

```javascript
// ❌ WRONG - Method not accessible from inputs
const MyNode = {
  inputs: {
    run: {
      type: 'signal',
      valueChangedToTrue: function () {
        this._doSomething(); // ☠️ TypeError: this._doSomething is not a function
      }
    }
  },
  prototypeExtensions: {
    _doSomething: {
      value: function () {
        // This method is NOT accessible from input callbacks!
        console.log('This never runs');
      }
    }
  }
};
```

**The Correct Pattern**:

```javascript
// ✅ RIGHT - Methods accessible everywhere
const MyNode = {
  inputs: {
    run: {
      type: 'signal',
      valueChangedToTrue: function () {
        this._doSomething(); // ✅ Works!
      }
    }
  },
  methods: {
    _doSomething: function () {
      // This method IS accessible from anywhere
      console.log('This works perfectly');
    }
  }
};
```

**Key Differences**:

| Pattern               | Access from Inputs | Access from Methods | Syntax                                        |
| --------------------- | ------------------ | ------------------- | --------------------------------------------- |
| `prototypeExtensions` | ❌ No              | ✅ Yes              | `{ methodName: { value: function() {...} } }` |
| `methods`             | ✅ Yes             | ✅ Yes              | `{ methodName: function() {...} }`            |

**When This Manifests**:

- Signal inputs using `valueChangedToTrue` callback
- Input setters trying to call helper methods
- Any input handler calling `this._methodName()`

**Symptoms**:

- Error: `TypeError: this._methodName is not a function`
- Method clearly defined but "not found"
- Other methods CAN call the method (if they're in `prototypeExtensions` too)

**Related Pattern**: Noodl API Augmentation for Backward Compatibility

When passing the Noodl API object to user code, you often need to augment it with additional properties:

```javascript
// Function/Expression nodes need Noodl.Inputs and Noodl.Outputs
const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.context.modelScope);

// Augment with inputs/outputs for backward compatibility
noodlAPI.Inputs = inputs; // Enables: Noodl.Inputs.foo
noodlAPI.Outputs = outputs; // Enables: Noodl.Outputs.bar = 'value'

// Pass augmented API to user function
const result = userFunction.apply(null, [inputs, outputs, noodlAPI, component]);
```

This allows both legacy syntax (`Noodl.Outputs.foo = 'bar'`) and modern syntax (`Outputs.foo = 'bar'`) to work.

**Passing Noodl Context to Compiled Functions**:

Expression nodes compile user expressions into functions. To provide access to Noodl globals (Variables, Objects, Arrays), pass the Noodl API as a parameter:

```javascript
// ❌ WRONG - Function can't access Noodl context
function compileExpression(expression, inputNames) {
  const args = inputNames.concat([expression]);
  return construct(Function, args); // function(inputA, inputB, ...) { return expression; }
  // Problem: Expression can't access Variables.myVar
}

// ✅ RIGHT - Pass Noodl as parameter
function compileExpression(expression, inputNames) {
  const args = inputNames.concat(['Noodl', expression]);
  return construct(Function, args); // function(inputA, inputB, Noodl) { return expression; }
}

// When calling: pass Noodl API as last argument
const noodlAPI = JavascriptNodeParser.createNoodlAPI(this.context.modelScope);
const argsWithNoodl = inputValues.concat([noodlAPI]);
const result = compiledFunction.apply(null, argsWithNoodl);
```

**Debug Logging Pattern** - Colored Emojis for Flow Tracing:

When debugging complex async flows, use colored emojis to make logs scannable:

```javascript
function scheduleEvaluation() {
  console.log('🔵 [Expression] Scheduling evaluation...');
  this.scheduleAfterInputsHaveUpdated(function () {
    console.log('🟡 [Expression] Callback FIRED');
    const result = this.calculate();
    console.log('✅ [Expression] Result:', result, '(type:', typeof result, ')');
  });
}
```

**Color Coding**:

- 🔵 Blue: Function entry/scheduling
- 🟢 Green: Success path taken
- 🟡 Yellow: Async callback fired
- 🔷 Diamond: Calculation/processing
- ✅ Check: Success result
- ❌ X: Error path
- 🟠 Orange: State changes
- 🟣 Purple: Side effects (flagOutputDirty, sendSignal)

**Files Fixed in TASK-008**:

- `expression.js`: Moved 4 methods from `prototypeExtensions` to `methods`
- `simplejavascript.js`: Augmented Noodl API with Inputs/Outputs
- `popuplayer.css`: Replaced hardcoded colors with theme tokens

**All Three Bugs Shared Common Cause**: Missing Noodl context access

- **Tooltips**: Hardcoded colors (not using theme context)
- **Function node**: Missing `Noodl.Outputs` reference
- **Expression node**: Methods inaccessible + missing Noodl parameter

**Critical Rules**:

1. **Always use `methods` object for node methods** - Accessible from everywhere
2. **Never use `prototypeExtensions` unless you understand the limitations** - Only for prototype manipulation
3. **Augment Noodl API for backward compatibility** - Add Inputs/Outputs references
4. **Pass Noodl as function parameter** - Don't rely on global scope
5. **Use colored emoji logging for async flows** - Makes debugging 10x faster

**Verification Commands**:

```bash
# Find nodes using prototypeExtensions
grep -r "prototypeExtensions:" packages/noodl-runtime/src/nodes --include="*.js"

# Check if they're accessible from inputs (potential bug)
grep -A 5 "valueChangedToTrue.*function" packages/noodl-runtime/src/nodes --include="*.js"
```

**Time Saved**: This pattern will prevent ~2-4 hours of debugging per occurrence. The error message gives no indication that the problem is structural access, not missing code.

**Location**:

- Fixed files:
  - `packages/noodl-runtime/src/nodes/std-library/expression.js`
  - `packages/noodl-runtime/src/nodes/std-library/simplejavascript.js`
  - `packages/noodl-editor/src/editor/src/styles/popuplayer.css`
- Task: Phase 3 TASK-008 Critical Runtime Bugs
- CHANGELOG: `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-008-critical-runtime-bugs/CHANGELOG.md`

**Keywords**: node structure, methods, prototypeExtensions, runtime nodes, this context, signal inputs, valueChangedToTrue, TypeError not a function, Noodl API, JavascriptNodeParser, backward compatibility, compiled functions, debug logging, colored emojis, flow tracing

---

## 🎨 Canvas Overlay Pattern: React Over HTML5 Canvas (Jan 3, 2026)

### The Transform Trick: CSS scale() + translate() for Automatic Coordinate Transformation

**Context**: Phase 4 PREREQ-003 - Studying CommentLayer to understand how React components overlay the HTML5 Canvas node graph. Need to build Data Lineage, Impact Radar, and Semantic Layer visualizations using the same pattern.

**The Discovery**: The most elegant solution for overlaying React on Canvas uses CSS transforms on a parent container. Child React components automatically position themselves in canvas coordinates without manual recalculation.

**The Pattern**:

```typescript
// ❌ WRONG - Manual coordinate transformation for every element
function OverlayComponent({ node, viewport }) {
  const screenX = (node.x + viewport.pan.x) * viewport.scale;
  const screenY = (node.y + viewport.pan.y) * viewport.scale;

  return <div style={{ left: screenX, top: screenY }}>...</div>;
  // Problem: Must recalculate for every element, every render
}

// ✅ RIGHT - CSS transform on parent container
function OverlayContainer({ children, viewport }) {
  return (
    <div
      style={{
        transform: `scale(${viewport.scale}) translate(${viewport.pan.x}px, ${viewport.pan.y}px)`,
        transformOrigin: '0 0'
      }}
    >
      {children}
      {/* All children automatically positioned in canvas coordinates! */}
    </div>
  );
}

// React children use canvas coordinates directly
function NodeBadge({ node }) {
  return (
    <div style={{ position: 'absolute', left: node.x, top: node.y }}>
      {/* Works perfectly - transform handles the rest */}
    </div>
  );
}
```

**Why This Matters**:

- **Automatic transformation**: React children don't need coordinate math
- **Performance**: No per-element calculations on every render
- **Simplicity**: Overlay components use canvas coordinates naturally
- **Consistency**: Same coordinate system as canvas drawing code

**React 19 Root API Pattern** - Critical for overlays:

```typescript
// ❌ WRONG - Creates new root on every render (memory leak)
function updateOverlay() {
  createRoot(container).render(<Overlay />); // ☠️ New root each time
}

// ✅ RIGHT - Create once, reuse forever
class CanvasOverlay {
  private root: Root;

  constructor(container: HTMLElement) {
    this.root = createRoot(container); // Create once
  }

  render(props: OverlayProps) {
    this.root.render(<Overlay {...props} />); // Reuse root
  }

  dispose() {
    this.root.unmount(); // Clean up properly
  }
}
```

**Two-Layer System** - CommentLayer's architecture:

```
┌─────────────────────────────────────┐
│   Foreground Layer (z-index: 2)    │ ← Interactive controls
├─────────────────────────────────────┤
│   HTML5 Canvas (z-index: 1)        │ ← Node graph
├─────────────────────────────────────┤
│   Background Layer (z-index: 0)    │ ← Comment boxes with shadows
└─────────────────────────────────────┘
```

This allows:

- Comment boxes render **behind** canvas (no z-fighting with nodes)
- Interactive controls render **in front** of canvas (draggable handles)
- No z-index conflicts between overlay elements

**Mouse Event Forwarding** - The click-through solution:

```typescript
// Three-step pattern for handling clicks
overlayContainer.addEventListener('mousedown', (event) => {
  // Step 1: Capture the event
  const target = event.target as HTMLElement;

  // Step 2: Check if clicking on actual UI
  const clickedOnUI = target.style.pointerEvents !== 'none';

  // Step 3: If not UI, forward to canvas
  if (!clickedOnUI) {
    const canvasEvent = new MouseEvent('mousedown', event);
    canvasElement.dispatchEvent(canvasEvent);
  }
});
```

**EventDispatcher Context Pattern** - Must use context object:

```typescript
// ✅ BEST - Use useEventListener hook (built-in context handling)
import { useEventListener } from '@noodl-hooks/useEventListener';

// ❌ WRONG - Direct subscription in React (breaks on cleanup)
useEffect(() => {
  editor.on('viewportChanged', handler);
  return () => editor.off('viewportChanged', handler); // ☠️ Can't unsubscribe
}, []);

// ✅ RIGHT - Use context object for cleanup
useEffect(() => {
  const context = {};
  editor.on('viewportChanged', handler, context);
  return () => editor.off(context); // Removes all subscriptions with context
}, []);

useEventListener(editor, 'viewportChanged', (viewport) => {
  // Automatically handles context and cleanup
});
```

**Scale-Dependent vs Scale-Independent Sizing**:

```scss
// Scale-dependent - Grows/shrinks with zoom
.node-badge {
  font-size: 12px; // Affected by parent transform
  padding: 4px;
}

// Scale-independent - Stays same size
.floating-panel {
  position: fixed; // Not affected by transform
  top: 20px;
  right: 20px;
  font-size: 14px; // Always 14px regardless of zoom
}
```

**Common Gotchas**:

1. **React-rnd scale prop**: Must set scale on mount, can't update dynamically

   ```typescript
   // Set scale once when component mounts
   <Rnd scale={this.scale} onMount={...} />
   ```

2. **Transform affects ALL children**: Can't exempt specific elements

   - Solution: Use two overlays (one transformed, one not)

3. **Async rendering timing**: React 19 may batch updates

   ```typescript
   // Force immediate render with setTimeout
   setTimeout(() => this.root.render(<Overlay />), 0);
   ```

4. **EventDispatcher cleanup**: Must use context object, not direct references

**Documentation Created**:

- `CANVAS-OVERLAY-PATTERN.md` - Overview and quick start
- `CANVAS-OVERLAY-ARCHITECTURE.md` - Integration with NodeGraphEditor
- `CANVAS-OVERLAY-COORDINATES.md` - Coordinate transformation details
- `CANVAS-OVERLAY-EVENTS.md` - Mouse event handling
- `CANVAS-OVERLAY-REACT.md` - React 19 specific patterns

**Impact**: This pattern unblocks all Phase 4 visualization views:

- VIEW-005: Data Lineage (path highlighting)
- VIEW-006: Impact Radar (dependency visualization)
- VIEW-007: Semantic Layers (node filtering)

**Critical Rules**:

1. **Use CSS transform on parent** - Let CSS handle coordinate transformation
2. **Create React root once** - Reuse for all renders, unmount on disposal
3. **Use two layers when needed** - Background and foreground for z-index control
4. **Forward mouse events** - Check pointer-events before forwarding to canvas
5. **Use EventDispatcher context** - Never subscribe without context object

**Time Saved**: This documentation will save ~4-6 hours per visualization view by providing proven patterns instead of trial-and-error.

**Location**:

- Study file: `packages/noodl-editor/src/editor/src/views/nodegrapheditor/commentlayer.ts`
- Documentation: `dev-docs/reference/CANVAS-OVERLAY-*.md` (5 files)
- Task CHANGELOG: `dev-docs/tasks/phase-4-canvas-visualisation-views/PREREQ-003-canvas-overlay-pattern/CHANGELOG.md`

**Keywords**: canvas overlay, React over canvas, CSS transform, coordinate transformation, React 19, createRoot, EventDispatcher, mouse forwarding, pointer-events, two-layer system, CommentLayer, viewport, pan, zoom, scale

---

## 🔄 React UseMemo Array Reference Equality (Jan 3, 2026)

### The Invisible Update: When UseMemo Recalculates But React Doesn't Re-render

**Context**: Phase 2 TASK-008 - Sheet dropdown in Components Panel wasn't updating when sheets were created/deleted. Events fired correctly, useMemo recalculated correctly, but the UI didn't update.

**The Problem**: React's useMemo uses reference equality (`===`) to determine if a value has changed. Even when useMemo recalculates an array with new values, if the dependencies haven't changed by reference, React may return the same memoized reference, preventing child components from detecting the change.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Recalculation doesn't guarantee new reference
const sheets = useMemo((): Sheet[] => {
  const sheetSet = new Set<string>();
  // ... calculate sheets ...
  return result; // Same reference if deps unchanged
}, [rawComponents, allComponents, hideSheets]);

// Child component receives same array reference
<SheetSelector sheets={sheets} />; // No re-render!
```

**The Solution** - Add an update counter to force new references:

```typescript
// ✅ RIGHT - Update counter forces new reference
const [updateCounter, setUpdateCounter] = useState(0);

// Increment counter when model changes
useEffect(() => {
  const handleUpdate = () => setUpdateCounter((c) => c + 1);
  ProjectModel.instance.on(EVENTS, handleUpdate, group);
  return () => ProjectModel.instance.off(group);
}, []);

// Counter in deps forces new reference on every recalculation
const sheets = useMemo((): Sheet[] => {
  const sheetSet = new Set<string>();
  // ... calculate sheets ...
  return result; // New reference when updateCounter changes!
}, [rawComponents, allComponents, hideSheets, updateCounter]);

// Child component detects new reference and re-renders
<SheetSelector sheets={sheets} />; // Re-renders correctly!
```

**Why This Matters**:

- **useMemo is an optimization, not a guarantee**: It may return the cached value even when recalculating
- **Reference equality drives React updates**: Components only re-render when props change by reference
- **Update counters bypass the cache**: Changing a simple number in deps forces a full recalculation with a new reference

**The Debug Journey**:

1. ✅ Events fire correctly (componentAdded, componentRemoved)
2. ✅ Event handlers execute (updateCounter increments)
3. ✅ useMemo recalculates (new sheet values computed)
4. ❌ But child components don't re-render (same array reference)

**Common Symptoms**:

- Events fire but UI doesn't update
- Data is correct when logged but not displayed
- Refreshing the page shows correct state
- Direct state changes work but derived state doesn't

**Critical Rules**:

1. **Never assume useMemo creates new references** - It's an optimization, not a forcing mechanism
2. **Use update counters for event-driven data** - Simple incrementing values in deps force re-computation
3. **Always verify reference changes** - Log array/object references to confirm they change
4. **Test with React DevTools** - Check component re-render highlighting to confirm updates

**Alternative Patterns**:

```typescript
// Pattern 1: Force re-creation with spreading (less efficient)
const sheets = useMemo(() => {
  const result = calculateSheets();
  return [...result]; // Always new array
}, [deps, updateCounter]);

// Pattern 2: Skip useMemo for frequently-changing data
const sheets = calculateSheets(); // Recalculate every render
// Only use when calculation is cheap

// Pattern 3: Use useCallback for stable references with changing data
const getSheets = useCallback(() => {
  return calculateSheets(); // Fresh calculation on every call
}, [deps]);
```

**Related Issues**:

- Similar to React's "stale closure" problem
- Related to React.memo's shallow comparison
- Connected to PureComponent update blocking

**Time Lost**: 2-3 hours debugging "why events work but UI doesn't update"

**Location**:

- Fixed in: `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentsPanel.ts` (line 153)
- Task: Phase 2 TASK-008 ComponentsPanel Menus and Sheets
- CHANGELOG: `dev-docs/tasks/phase-2-react-migration/TASK-008-componentspanel-menus-and-sheets/CHANGELOG.md`

**Keywords**: React, useMemo, reference equality, array reference, update counter, force re-render, shallow comparison, React optimization, derived state, memoization

---

## 🚫 Port Hover Compatibility Highlighting Failed Attempt (Jan 1, 2026)

### The Invisible Compatibility: Why Port Hover Preview Didn't Work

**Context**: Phase 3 TASK-000I-C3 - Attempted to add visual feedback showing compatible/incompatible ports when hovering over any port. After 6+ debugging iterations spanning multiple attempts, the feature was abandoned.

**The Problem**: Despite comprehensive implementation with proper type detection, bidirectional logic, cache optimization, and visual effects, console logs consistently showed "incompatible" for most ports that should have been compatible.

**What Was Implemented**:

- Port hover detection with 8px hit radius
- Compatibility cache system for performance
- Type coercion rules (number↔string, boolean↔string, color↔string)
- Bidirectional vs unidirectional port logic (data vs signals)
- Visual feedback (glow for compatible, dim for incompatible)
- Proper port definition lookup (not connection-based)

**Debugging Attempts**:

1. Fixed backwards compatibility logic
2. Fixed cache key mismatches
3. Increased glow visibility (shadowBlur 50)
4. Added bidirectional logic for data ports vs unidirectional for signals
5. Fixed type detection to use `model.getPorts()` instead of connections
6. Modified cache rebuilding to support bidirectional data ports

**Why It Failed** (Suspected Root Causes):

1. **Port Type System Complexity**: Noodl's type system has more nuances than documented

   - Type coercion rules may be more complex than number↔string, etc.
   - Some types may have special compatibility that isn't exposed in port definitions
   - Dynamic type resolution at connection time may differ from static analysis

2. **Dynamic Port Generation**: Many nodes generate ports dynamically based on configuration

   - Port definitions from `model.getPorts()` may not reflect all runtime ports
   - StringList-configured ports (headers, query params) create dynamic inputs
   - These ports may not have proper type metadata until after connection

3. **Port Direction Ambiguity**: Input/output distinction may be insufficient

   - Some ports accept data from both directions (middle/bidirectional ports)
   - Connection validation logic in the engine may use different rules than exposed in the model
   - Legacy nodes may have special-case connection rules

4. **Hidden Compatibility Layer**: The actual connection validation may happen elsewhere
   - NodeLibrary or ConnectionModel may have additional validation logic
   - Engine-level type checking may override model-level type information
   - Some compatibility may be determined by node behavior, not type declarations

**Critical Learnings**:

**❌ Don't assume port type compatibility is simple**:

```typescript
// ❌ WRONG - Oversimplified compatibility
if (sourceType === targetType) return true;
if (sourceType === 'any' || targetType === 'any') return true;
// Missing: Engine-level rules, dynamic types, node-specific compatibility
```

**✅ Port compatibility is more complex than it appears**:

- Port definitions don't tell the whole story
- Connection validation happens in multiple places
- Type coercion has engine-level rules not exposed in metadata
- Some compatibility is behavioral, not type-based

**What Would Be Needed for This Feature**:

1. **Access to Engine Validation**: Hook into the actual connection validation logic

   - Use the same code path that validates connections when dragging
   - Don't reimplement compatibility rules - use existing validator

2. **Runtime Type Resolution**: Get actual types at connection time, not from definitions

   - Some nodes resolve types dynamically based on connected nodes
   - Type information may flow through the graph

3. **Node-Specific Rules**: Account for special-case compatibility

   - Some nodes accept any connection and do runtime type conversion
   - Legacy nodes may have grandfathered compatibility rules

4. **Testing Infrastructure**: Comprehensive test suite for all node types
   - Would need to test every node's port compatibility
   - Edge cases like Collection nodes, Router adapters, etc.

**Alternative Approaches** (For Future Attempts):

1. **Hook Existing Validation**: Instead of reimplementing, call the existing connection validator

   ```typescript
   // Pseudocode - use actual engine validation
   const canConnect = connectionModel.validateConnection(sourcePort, targetPort);
   ```

2. **Show Type Names Only**: Simpler feature - just show port types on hover

   - No compatibility checking
   - Let users learn type names and infer compatibility themselves

3. **Connection Hints After Drag**: Show compatibility when actively dragging a connection
   - Only check compatibility for the connection being created
   - Use the engine's validation since we're about to create the connection anyway

**Time Lost**: ~3-4 hours across multiple debugging sessions

**Files Cleaned Up** (All code removed):

- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts`

**Documentation**:

- Failure documented in: `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-000-styles-overhaul/TASK-000I-node-graph-visual-improvements/CHANGELOG.md`
- Task marked as: ❌ REMOVED (FAILED)

**Keywords**: port compatibility, hover preview, type checking, connection validation, node graph, canvas, visual feedback, failed feature, type system, dynamic ports

---

## ⚠️ Permanent Warning Patterns: Banner + Toast Dual-Layer (Jan 2026)

### The Dismissable Problem: Why One Warning Layer Isn't Enough

**Context**: TASK-001D Legacy Read-Only Enforcement - Users needed constant reminder they're in read-only mode, but banner alone was insufficient (dismissable) and toast alone was intrusive (blocks view).

**CRITICAL PRINCIPLE**: For critical mode warnings (read-only, offline, unsaved changes), use BOTH a dismissable banner AND a permanent toast to balance UX with safety.

**The Problem**: Single-layer warnings fail:

- **Banner only**: User dismisses it, forgets mode, loses work
- **Toast only**: Blocks UI permanently, user frustrated but can't clear it
- **Temporary warnings**: Disappear, user forgets critical mode

**The Solution** - Dual-layer warning system:

```typescript
// Layer 1: EditorBanner (Top) - Dismissable, high visibility
<EditorBanner
  onDismiss={handleDismiss} // ✅ User CAN close to clear workspace
  message="Legacy Project (React 17) - Read-Only Mode"
  description="Return to the launcher to migrate it before editing"
  style={{
    background: '#1a1a1a', // Solid black for maximum visibility
    borderBottom: '2px solid var(--theme-color-warning)'
  }}
/>;

// Layer 2: Toast (Bottom Right) - Permanent, subtle reminder
ToastLayer.showError(
  'READ-ONLY MODE - No changes will be saved',
  Infinity // ✅ Stays forever
);
// NO close button - truly permanent
```

**Toast Permanence Pattern**:

```typescript
// ❌ WRONG - User can dismiss critical warning
showError(message, {
  duration: 10000, // Disappears after 10s
  onClose: () => toast.dismiss(id) // Has close button
});

// ✅ RIGHT - Permanent reminder
showError(message, {
  duration: Infinity // Never auto-dismisses
  // No onClose callback = no close button
});
```

**Banner Visibility Pattern**:

```scss
// ❌ WRONG - Semi-transparent, hard to see
.EditorBanner {
  background: rgba(255, 193, 7, 0.15); // Transparent yellow
  pointer-events: none; // Can't interact!
}

// ✅ RIGHT - Solid color, highly visible
.EditorBanner {
  background: #1a1a1a; // Solid black
  border-bottom: 2px solid var(--theme-color-warning);
  pointer-events: auto; // Fully interactive
}
```

**Why This Works**:

**Banner Advantages:**

- Large, prominent at top of viewport
- Can include detailed instructions
- User can dismiss to clear workspace when needed
- Shows mode on initial project open

**Toast Advantages:**

- Small, non-intrusive in corner
- Always visible (can't dismiss)
- Constant reminder even after banner closed
- Doesn't block UI when user understands the mode

**User Flow**:

1. User opens project → Banner + Toast appear
2. User reads banner, understands mode
3. User closes banner to work (needs space)
4. **Toast remains**: Constant reminder in corner
5. User forgets after 30 minutes → **Toast still there!**

**Critical Rules**:

1. **NEVER** rely on banner alone for critical modes (user will dismiss)
2. **NEVER** make toast the only warning (too intrusive)
3. **ALWAYS** use `duration: Infinity` for permanent toasts
4. **NEVER** add close button to critical toasts (remove onClose callback)
5. **ALWAYS** use solid backgrounds on banners (visibility)

**Applies To**:

- Read-only mode warnings
- Offline mode indicators
- Unsaved changes warnings
- Beta feature warnings
- Migration required notices
- Any critical persistent state

**Common Mistakes**:

1. Using toast with 10-second duration (disappears, user forgets)
2. Banner only (user closes it, forgets critical mode)
3. Making toast undismissable with close button (confusing UX)
4. Transparent banner backgrounds (low visibility)
5. Blocking all interactions when warnings show

**Time Saved**: This pattern prevents data loss scenarios and support tickets. Clear, persistent warnings = fewer user mistakes.

**Location**:

- Implemented in: TASK-001D Legacy Read-Only Enforcement
- Files: `EditorBanner.tsx`, `ToastLayer.tsx`, `ProjectsPage.tsx`
- Documentation: `TASK-001D/CHANGELOG.md`

**Keywords**: permanent toast, dismissable banner, dual-layer warnings, read-only mode, critical warnings, user safety, Infinity duration, banner visibility, UX balance

---

## 🔥 CRITICAL: Electron Blocks window.prompt() and window.confirm() (Dec 2025)

### The Silent Dialog: Native Dialogs Don't Work in Electron

**Context**: Phase 3 TASK-001 Launcher - FolderTree component used `prompt()` and `confirm()` for folder creation/deletion. These worked in browser but silently failed in Electron, causing "Maximum update depth exceeded" React errors and no UI response.

**The Problem**: Electron blocks `window.prompt()` and `window.confirm()` for security reasons. Calling these functions throws an error: `"prompt() is and will not be supported"`.

**Root Cause**: Electron's sandboxed renderer process doesn't allow synchronous native dialogs as they can hang the IPC bridge and create security vulnerabilities.

**The Broken Pattern**:

```typescript
// ❌ WRONG - Throws error in Electron
const handleCreateFolder = () => {
  const name = prompt('Enter folder name:'); // ☠️ Error: prompt() is not supported
  if (name && name.trim()) {
    createFolder(name.trim());
  }
};

const handleDeleteFolder = (folder: Folder) => {
  if (confirm(`Delete "${folder.name}"?`)) {
    // ☠️ Error: confirm() is not supported
    deleteFolder(folder.id);
  }
};
```

**The Solution** - Use React state + inline input for text entry:

```typescript
// ✅ RIGHT - React state-based text input
const [isCreatingFolder, setIsCreatingFolder] = useState(false);
const [newFolderName, setNewFolderName] = useState('');

const handleCreateFolder = () => {
  setIsCreatingFolder(true);
  setNewFolderName('');
};

const handleCreateFolderSubmit = () => {
  if (newFolderName.trim()) {
    createFolder(newFolderName.trim());
  }
  setIsCreatingFolder(false);
};

// JSX
{
  isCreatingFolder ? (
    <input
      type="text"
      value={newFolderName}
      onChange={(e) => setNewFolderName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleCreateFolderSubmit();
        if (e.key === 'Escape') setIsCreatingFolder(false);
      }}
      onBlur={handleCreateFolderSubmit}
      autoFocus
    />
  ) : (
    <button onClick={handleCreateFolder}>New Folder</button>
  );
}
```

**The Solution** - Use React state + custom dialog for confirmation:

```typescript
// ✅ RIGHT - React state-based confirmation dialog
const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);

const handleDeleteFolder = (folder: Folder) => {
  setDeletingFolder(folder);
};

const handleDeleteFolderConfirm = () => {
  if (deletingFolder) {
    deleteFolder(deletingFolder.id);
    setDeletingFolder(null);
  }
};

// JSX - Overlay modal
{
  deletingFolder && (
    <div className={css['DeleteConfirmation']}>
      <div className={css['Backdrop']} onClick={() => setDeletingFolder(null)} />
      <div className={css['Dialog']}>
        <h3>Delete Folder</h3>
        <p>Delete "{deletingFolder.name}"?</p>
        <button onClick={() => setDeletingFolder(null)}>Cancel</button>
        <button onClick={handleDeleteFolderConfirm}>Delete</button>
      </div>
    </div>
  );
}
```

**Why This Matters**:

- Native dialogs work fine in browser testing (Storybook)
- Same code fails silently or with cryptic errors in Electron
- Can waste hours debugging what looks like unrelated React errors
- Common pattern developers expect to work doesn't

**Secondary Issue**: The `prompt()` error triggered an infinite loop in `useProjectOrganization` hook because the service wasn't memoized, causing "Maximum update depth exceeded" errors that obscured the root cause.

**Critical Rules**:

1. **Never use `window.prompt()` in Electron** - use inline text input with React state
2. **Never use `window.confirm()` in Electron** - use custom modal dialogs
3. **Never use `window.alert()` in Electron** - use toast notifications or modals
4. **Always test Electron-specific code in the actual Electron app**, not just browser

**Alternative Electron-Native Approach** (for main process):

```javascript
// From main process - can use Electron's dialog
const { dialog } = require('electron');

// Text input dialog (async)
const result = await dialog.showMessageBox(mainWindow, {
  type: 'question',
  buttons: ['Cancel', 'OK'],
  defaultId: 1,
  title: 'Create Folder',
  message: 'Enter folder name:',
  // Note: No built-in text input, would need custom window
});

// Confirmation dialog (async)
const result = await dialog.showMessageBox(mainWindow, {
  type: 'question',
  buttons: ['Cancel', 'Delete'],
  defaultId: 0,
  cancelId: 0,
  title: 'Delete Folder',
  message: `Delete "${folderName}"?`
});
```

**Detection**: If you see errors mentioning `prompt() is not supported` or similar, you're using blocked native dialogs.

**Location**:

- Fixed in: `packages/noodl-core-ui/src/preview/launcher/Launcher/components/FolderTree/FolderTree.tsx`
- Fixed in: `packages/noodl-core-ui/src/preview/launcher/Launcher/hooks/useProjectOrganization.ts` (infinite loop fix)
- Task: Phase 3 TASK-001 Dashboard UX Foundation

**Related Issues**:

- **Infinite loop in useProjectOrganization**: Service object was recreated on every render, causing useEffect to run infinitely. Fixed by wrapping service creation in `useMemo(() => createLocalStorageService(), [])`.

**Keywords**: Electron, window.prompt, window.confirm, window.alert, native dialogs, security, renderer process, React state, modal, confirmation dialog, infinite loop, Maximum update depth

---

[Previous learnings content continues...]

## 🎨 Design Token Consolidation Side Effects (Dec 31, 2025)

### The White-on-White Epidemic: When --theme-color-secondary Changed

**Context**: Phase 3 UX Overhaul - Design token consolidation (TASK-000A) changed `--theme-color-secondary` from teal (#00CEC9) to white (#ffffff). This broke selected/active states across the entire editor UI.

**The Problem**: Dozens of components used `--theme-color-secondary` and `--theme-color-secondary-highlight` as background colors for selected items. When these tokens changed to white, selected items became invisible white-on-white.

**Affected Components**:

- MenuDialog dropdowns (viewport, URL routes, zoom level)
- Component breadcrumb trail (current page indicator)
- Search panel results (active result)
- Components panel (selected components)
- Lesson layer (selected lessons)
- All legacy CSS files using hardcoded teal colors

**Root Cause**: Token meaning changed during consolidation:

- **Before**: `--theme-color-secondary` = teal accent color (good for backgrounds)
- **After**: `--theme-color-secondary` = white/neutral (terrible for backgrounds)

**The Solution Pattern**:

```scss
// ❌ BROKEN (post-consolidation)
.is-selected {
  background-color: var(--theme-color-secondary); // Now white!
  color: var(--theme-color-on-secondary); // Also problematic
}

// ✅ FIXED - Subtle highlight
.is-current {
  background-color: var(--theme-color-bg-4); // Dark gray
  color: var(--theme-color-fg-highlight); // White text
}

// ✅ FIXED - Bold accent (for dropdowns/menus)
.is-selected {
  background-color: var(--theme-color-primary); // Noodl red
  color: var(--theme-color-on-primary); // White text
}
```

**Decision Matrix**: Use different backgrounds based on emphasis level:

- **Subtle**: `--theme-color-bg-4` (dark gray) - breadcrumbs, sidebar
- **Medium**: `--theme-color-bg-5` (lighter gray) - hover states
- **Bold**: `--theme-color-primary` (red) - dropdown selected items

**Files Fixed** (Dec 31, 2025):

- `MenuDialog.module.scss` - Dropdown selected items
- `NodeGraphComponentTrail.module.scss` - Breadcrumb current page
- `search-panel.module.scss` - Active search result
- `componentspanel.css` - Selected components
- `LessonLayerView.css` - Selected lessons
- `EditorTopbar.module.scss` - Static display colors
- `ToggleSwitch.module.scss` - Track visibility
- `popuplayer.css` - Modal triangle color

**Prevention**: New section added to `UI-STYLING-GUIDE.md` (Part 9: Selected/Active State Patterns) documenting the correct approach.

**Critical Rule**: **Never use `--theme-color-secondary` or `--theme-color-fg-highlight` as backgrounds. Always use `--theme-color-bg-*` for backgrounds and `--theme-color-primary` for accent highlights.**

**Time Lost**: 2+ hours debugging across multiple UI components

**Location**:

- Fixed files: See list above
- Documentation: `dev-docs/reference/UI-STYLING-GUIDE.md` (Part 9)
- Token definitions: `packages/noodl-core-ui/src/styles/custom-properties/colors.css`

**Keywords**: design tokens, --theme-color-secondary, white-on-white, selected state, active state, MenuDialog, consolidation, contrast, accessibility

---

## 🎨 CSS Variable Naming Mismatch: --theme-spacing-_ vs --spacing-_ (Dec 31, 2025)

### The Invisible UI: When Padding Doesn't Exist

**Context**: Phase 3 TASK-001 Launcher - Folder tree components had proper padding styles defined but rendered with zero spacing. All padding/margin values appeared to be 0px despite correct-looking SCSS code.

**The Problem**: SCSS files referenced `var(--theme-spacing-2)` but the CSS custom properties file defined `--spacing-2` (without the `theme-` prefix). This mismatch caused all spacing values to resolve to undefined/0px.

**Root Cause**: Inconsistent variable naming between:

- **SCSS files**: Used `var(--theme-spacing-1)`, `var(--theme-spacing-2)`, etc.
- **CSS definitions**: Defined `--spacing-1: 4px`, `--spacing-2: 8px`, etc. (no `theme-` prefix)

**The Broken Pattern**:

```scss
// ❌ WRONG - Variable doesn't exist
.FolderTree {
  padding: var(--theme-spacing-2); // Resolves to nothing!
  gap: var(--theme-spacing-1); // Also undefined
}

.Button {
  padding: var(--theme-spacing-2) var(--theme-spacing-3); // Both 0px
}
```

**The Correct Pattern**:

```scss
// ✅ RIGHT - Matches defined variables
.FolderTree {
  padding: var(--spacing-2); // = 8px ✓
  gap: var(--spacing-1); // = 4px ✓
}

.Button {
  padding: var(--spacing-2) var(--spacing-3); // = 8px 12px ✓
}
```

**How to Detect**:

1. **Visual inspection**: Everything looks squished with no breathing room
2. **DevTools**: Computed padding/margin values show 0px or nothing
3. **Code search**: `grep -r "var(--theme-spacing" packages/` finds non-existent variables
4. **Compare working components**: Other components use `var(--spacing-*)` without `theme-` prefix

**What Makes This Confusing**:

- **Color variables DO use `theme-` prefix**: `var(--theme-color-bg-2)` exists and works
- **Font variables DO use `theme-` prefix**: `var(--theme-font-size-default)` exists and works
- **Spacing variables DON'T use `theme-` prefix**: Only `var(--spacing-2)` works, not `var(--theme-spacing-2)`
- **Radius variables DON'T use prefix**: Just `var(--radius-default)`, not `var(--theme-radius-default)`

**Correct Variable Patterns**:
| Category | Pattern | Example |
|----------|---------|---------|
| Colors | `--theme-color-*` | `var(--theme-color-bg-2)` |
| Fonts | `--theme-font-*` | `var(--theme-font-size-default)` |
| Spacing | `--spacing-*` | `var(--spacing-2)` |
| Radius | `--radius-*` | `var(--radius-default)` |
| Shadows | `--shadow-*` | `var(--shadow-lg)` |

**Files Fixed** (Dec 31, 2025):

- `FolderTree/FolderTree.module.scss` - All spacing variables corrected
- `FolderTreeItem/FolderTreeItem.module.scss` - All spacing variables corrected

**Verification Command**:

```bash
# Find incorrect usage of --theme-spacing-*
grep -r "var(--theme-spacing" packages/noodl-core-ui/src --include="*.scss"

# Should return zero results after fix
```

**Prevention**: Always reference `dev-docs/reference/UI-STYLING-GUIDE.md` which documents the correct variable patterns. Use existing working components as templates.

**Critical Rule**: **Spacing variables are `--spacing-*` NOT `--theme-spacing-*`. When in doubt, check `packages/noodl-core-ui/src/styles/custom-properties/spacing.css` for the actual defined variables.**

**Time Lost**: 30 minutes investigating "missing styles" before discovering the variable mismatch

**Location**:

- Fixed files: `FolderTree.module.scss`, `FolderTreeItem.module.scss`
- Variable definitions: `packages/noodl-core-ui/src/styles/custom-properties/spacing.css`
- Documentation: `dev-docs/reference/UI-STYLING-GUIDE.md`

**Keywords**: CSS variables, custom properties, --spacing, --theme-spacing, zero padding, invisible UI, variable mismatch, design tokens, spacing scale

---

[Rest of the previous learnings content continues...]

---

## STYLE-001: UndoQueue requires UndoActionGroup class instances (2026-02-18)

**Context:** Building StyleTokensModel with undo support.
**Discovery:** `UndoQueue.push()` requires `new UndoActionGroup({ label, do, undo })` — NOT a plain `{ label, do, undo }` object. The TypeScript error was clear but the fix isn't obvious from the class name alone.
**Fix:** `UndoQueue.instance.push(new UndoActionGroup({ label: '...', do: () => {}, undo: () => {} }))`
**Location:** `packages/noodl-editor/src/editor/src/models/undo-queue-model.ts`

## STYLE-001: Design token persistence pattern (2026-02-18)

**Context:** Implementing per-project design token persistence in StyleTokensModel.
**Discovery:** Only custom overrides are stored in project metadata — never defaults. Defaults live in `DefaultTokens.ts` and are merged at load time. This keeps `project.json` lean and lets defaults be updated without migrations.
**Location:** `StyleTokensModel._store()` uses `ProjectModel.instance.setMetaData('designTokens', data)`

## STYLE-001: DesignTokenPanel/ColorsTab pre-existed (2026-02-18)

**Context:** Adding a new "Tokens" tab to the DesignTokenPanel.
**Discovery:** `DesignTokenPanel/components/ColorsTab/` already existed before this work. The new "Tokens" tab was added alongside it. Always check what pre-exists before creating new panel components.
