# TASK-012 Implementation Checklist

## Prerequisites

- [ ] Read README.md completely
- [ ] Review existing Function node implementation (`javascriptfunction.js`)
- [ ] Review existing Expression node implementation (`expression.js`)
- [ ] Understand Noodl's signal/output pattern
- [ ] Create branch: `git checkout -b task/012-blockly-logic-builder`
- [ ] Verify build works: `npm run dev`

---

## Phase A: Foundation (Week 1)

### A1: Install and Configure Blockly

- [ ] Add Blockly to package.json
  ```bash
  cd packages/noodl-editor
  npm install blockly
  ```
- [ ] Verify Blockly types are available
- [ ] Create basic test component
  - [ ] Create `src/editor/src/views/BlocklyEditor/` directory
  - [ ] Create `BlocklyWorkspace.tsx` - minimal React wrapper
  - [ ] Render basic workspace with default toolbox
  - [ ] Verify it displays in a test location

### A2: Create Basic Custom Blocks

- [ ] Create `NoodlBlocks.ts` - block definitions
  - [ ] `noodl_get_input` block
  - [ ] `noodl_set_output` block
  - [ ] `noodl_get_variable` block
  - [ ] `noodl_set_variable` block
- [ ] Create `NoodlGenerators.ts` - JavaScript generators
  - [ ] Generator for `noodl_get_input` → `Inputs.name`
  - [ ] Generator for `noodl_set_output` → `Outputs.name = value`
  - [ ] Generator for `noodl_get_variable` → `Noodl.Variables.name`
  - [ ] Generator for `noodl_set_variable` → `Noodl.Variables.name = value`
- [ ] Verify generated code in console

### A3: Storage Mechanism

- [ ] Implement workspace serialization
  - [ ] `workspaceToJson()` function
  - [ ] `jsonToWorkspace()` function
- [ ] Test round-trip: create blocks → serialize → deserialize → verify same blocks
- [ ] Document in NOTES.md

**Checkpoint A:** Basic Blockly renders, custom blocks work, serialization works

---

## Phase B: Logic Builder Node (Week 2)

### B1: Node Definition

- [ ] Create `logic-builder.js` in `packages/noodl-runtime/src/nodes/std-library/`
- [ ] Define node structure:
  ```javascript
  name: 'noodl.logic.LogicBuilder',
  displayNodeName: 'Logic Builder',
  category: 'Logic',
  color: 'logic'
  ```
- [ ] Add `blocklyWorkspace` parameter (string, stores JSON)
- [ ] Add `_internal` for code execution state
- [ ] Register in `nodelibraryexport.js`
- [ ] Verify node appears in node picker

### B2: Dynamic Port Registration

- [ ] Create `IODetector.ts` - parses workspace for I/O blocks
  - [ ] `detectInputs(workspace)` → `[{name, type}]`
  - [ ] `detectOutputs(workspace)` → `[{name, type}]`
  - [ ] `detectSignalInputs(workspace)` → `[name]`
  - [ ] `detectSignalOutputs(workspace)` → `[name]`
- [ ] Implement `registerInputIfNeeded()` in node
- [ ] Implement `updatePorts()` in setup function
- [ ] Test: add Input block → port appears on node

### B3: Code Execution

- [ ] Generate complete function from workspace
- [ ] Create execution context with Noodl API access
- [ ] Wire signal inputs to trigger execution
- [ ] Wire outputs to flag dirty and update
- [ ] Test: simple input → output flow

### B4: Editor Integration (Modal)

- [ ] Create property panel button "Edit Logic Blocks"
- [ ] Create modal component `LogicBuilderModal.tsx`
- [ ] Load workspace from node parameter
- [ ] Save workspace on close
- [ ] Wire up to property panel

**Checkpoint B:** Logic Builder node works end-to-end with modal editor

---

## Phase C: Tabbed Canvas System (Week 3)

### C1: Tab Infrastructure

- [ ] Create `CanvasTabs.tsx` component
- [ ] Define tab state interface:
  ```typescript
  interface CanvasTab {
    id: string;
    type: 'canvas' | 'logic-builder';
    nodeId?: string;
    nodeName?: string;
  }
  ```
- [ ] Create tab context/store
- [ ] Integrate with NodeGraphEditor container

### C2: Tab Behavior

- [ ] "Canvas" tab always present (index 0)
- [ ] "Edit Logic Blocks" opens new tab
- [ ] Tab title = node display name
- [ ] Close button on Logic Builder tabs
- [ ] Clicking tab switches view
- [ ] Track component scope - reset tabs on component change

### C3: Workspace in Tab

- [ ] Render Blockly workspace in tab content area
- [ ] Maintain workspace state per tab
- [ ] Handle resize when tab dimensions change
- [ ] Auto-save workspace changes (debounced)

### C4: Polish

- [ ] Tab styling consistent with editor theme
- [ ] Unsaved changes indicator (dot on tab)
- [ ] Keyboard shortcut: Escape closes tab (returns to canvas)
- [ ] Smooth transitions between tabs

**Checkpoint C:** Tabbed editing experience works smoothly

---

## Phase D: Expression Builder Node (Week 4)

### D1: Simplified Workspace Configuration

- [ ] Create `ExpressionBuilderToolbox.ts` - limited block set
  - [ ] Math blocks only
  - [ ] Logic/comparison blocks
  - [ ] Text blocks
  - [ ] Variable get (no set)
  - [ ] Input get only
  - [ ] NO signal blocks
  - [ ] NO event blocks
- [ ] Single "result" output (auto-generated)

### D2: Node Definition

- [ ] Create `expression-builder.js`
- [ ] Single output: `result` type `*`
- [ ] Inputs auto-detected from "Get Input" blocks
- [ ] Expression evaluated on any input change

### D3: Inline/Small Modal Editor

- [ ] Compact Blockly workspace
- [ ] Horizontal layout if possible
- [ ] Or small modal (not full tab)
- [ ] Quick open/close behavior

### D4: Type Inference

- [ ] Detect result type from blocks
- [ ] Provide typed outputs: `asString`, `asNumber`, `asBoolean`
- [ ] Match Expression node pattern

**Checkpoint D:** Expression Builder provides quick visual expressions

---

## Phase E: Full Block Library & Polish (Weeks 5-6)

### E1: Complete Tier 1 Blocks

#### Objects Blocks
- [ ] `noodl_get_object` - Get Object by ID
- [ ] `noodl_get_object_property` - Get property from object
- [ ] `noodl_set_object_property` - Set property on object
- [ ] `noodl_create_object` - Create new object with ID
- [ ] `noodl_on_object_change` - Event: when object changes

#### Arrays Blocks
- [ ] `noodl_get_array` - Get Array by name
- [ ] `noodl_array_add` - Add item to array
- [ ] `noodl_array_remove` - Remove item from array
- [ ] `noodl_array_length` - Get array length
- [ ] `noodl_array_foreach` - Loop over array
- [ ] `noodl_on_array_change` - Event: when array changes

#### Event/Signal Blocks
- [ ] `noodl_on_signal` - When signal input triggered
- [ ] `noodl_send_signal` - Send signal output
- [ ] `noodl_define_signal_input` - Declare signal input
- [ ] `noodl_define_signal_output` - Declare signal output

### E2: Code Viewer

- [ ] Add "View Code" button to I/O summary panel
- [ ] Create `CodeViewer.tsx` component
- [ ] Display generated JavaScript
- [ ] Read-only (not editable)
- [ ] Syntax highlighting (monaco-editor or prism)
- [ ] Collapsible panel

### E3: Rename Existing Nodes

- [ ] `expression.js` → displayName "JavaScript Expression"
- [ ] `javascriptfunction.js` → displayName "JavaScript Function"  
- [ ] Verify no breaking changes to existing projects
- [ ] Update node picker categories/search tags

### E4: Testing

- [ ] Unit tests for each block's code generation
- [ ] Unit tests for I/O detection
- [ ] Integration test: Logic Builder with Variables
- [ ] Integration test: Logic Builder with Objects
- [ ] Integration test: Logic Builder with Arrays
- [ ] Integration test: Signal flow
- [ ] Manual test checklist (see README.md)

### E5: Documentation

- [ ] User documentation: "Visual Logic with Logic Builder"
- [ ] User documentation: "Quick Expressions with Expression Builder"
- [ ] Update node reference docs
- [ ] Add tooltips/help text to blocks

**Checkpoint E:** Feature complete, tested, documented

---

## Final Review

- [ ] All success criteria from README met
- [ ] No TypeScript errors
- [ ] No console warnings/errors
- [ ] Performance acceptable (no lag with 50+ blocks)
- [ ] Works in deployed preview
- [ ] Code review completed
- [ ] PR ready for merge

---

## Session Tracking

Use this section to track progress across development sessions:

### Session 1: [Date]
- Started: 
- Completed:
- Blockers:
- Next:

### Session 2: [Date]
- Started:
- Completed:
- Blockers:
- Next:

(Continue as needed)
