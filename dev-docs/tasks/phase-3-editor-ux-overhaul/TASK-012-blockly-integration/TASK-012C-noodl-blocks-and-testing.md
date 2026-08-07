# TASK-012C: Noodl Blocks and End-to-End Testing

**Status:** Not Started  
**Depends On:** TASK-012B (Bug Fixes - Completed)  
**Estimated Duration:** 8-12 hours  
**Priority:** High

## Overview

Complete the Logic Builder by adding Noodl-specific blocks and perform end-to-end testing to verify data flow between the Logic Builder node and the standard Noodl canvas.

## Current State

### ✅ What's Working

- Blockly workspace renders in tabs
- Tab system functional (open/close/switch)
- Basic Blockly categories (Logic, Math, Text)
- Property panel "Edit Blocks" button
- Workspace auto-save
- Dynamic port detection framework
- JavaScript code generation

### ⚠️ Known Issues

- Drag-and-drop has 1000ms timeout (see DRAG-DROP-ISSUE.md)
- Only basic Blockly blocks available (no Noodl-specific blocks)
- No Noodl API integration blocks yet
- Untested: Actual data flow from inputs → Logic Builder → outputs

### 📦 Existing Infrastructure

**Files:**

- `NoodlBlocks.ts` - Block definitions (placeholders exist)
- `NoodlGenerators.ts` - Code generators (placeholders exist)
- `IODetector.ts` - Dynamic port detection
- `logic-builder.js` - Runtime node
- `BlocklyEditorGlobals.ts` - Runtime bridge

## Goals

1. **Audit Standard Blockly Blocks** - Determine which to keep/remove
2. **Implement Noodl API Blocks** - Inputs, Outputs, Variables, Objects, Arrays
3. **Test End-to-End Data Flow** - Verify Logic Builder works as a functional node
4. **Document Patterns** - Create guide for adding future blocks

---

## Phase 1: Standard Blockly Block Audit

### Objective

Review Blockly's default blocks and decide which are valuable for Noodl users vs adding clutter.

### Current Default Blocks

**Logic Category:**

- `controls_if` - If/else conditionals
- `logic_compare` - Comparison operators (==, !=, <, >)
- `logic_operation` - Boolean operators (AND, OR)
- `logic_negate` - NOT operator
- `logic_boolean` - True/False values

**Math Category:**

- `math_number` - Number input
- `math_arithmetic` - Basic operations (+, -, ×, ÷)
- `math_single` - Functions (sqrt, abs, etc.)

**Text Category:**

- `text` - String input
- `text_join` - Concatenate strings
- `text_length` - String length

### Decision Criteria

For each category, determine:

- **Keep:** Fundamental programming concepts that align with Noodl
- **Remove:** Overly technical or redundant with Noodl nodes
- **Add Later:** Useful but not MVP (e.g., loops, lists)

### Recommendations

**Logic - KEEP ALL**

- Essential for conditional logic
- Aligns with Noodl's event-driven model

**Math - KEEP BASIC**

- Keep: number, arithmetic
- Consider: single (advanced math functions)
- Reason: Basic math is useful; advanced math might be better as Data nodes

**Text - KEEP ALL**

- String manipulation is common
- Lightweight and useful

**NOT INCLUDED YET (Consider for future):**

- Loops (for, while) - Complex for visual editor
- Lists/Arrays - Would need Noodl-specific implementation
- Functions - Covered by components in Noodl
- Variables - Covered by Noodl Variables system

### Action Items

- [ ] Create custom toolbox config with curated blocks
- [ ] Test each block generates valid JavaScript
- [ ] Document reasoning for inclusions/exclusions

---

## Phase 2: Noodl API Blocks Implementation

### 2.1 Input Blocks

**Purpose:** Read values from node inputs

**Blocks Needed:**

1. **Get Input**

   - Dropdown selector for input names
   - Returns current input value
   - Code: `Noodl.Inputs['inputName']`

2. **Define Input**
   - Text field for input name
   - Dropdown for type (String, Number, Boolean, Signal)
   - Creates dynamic port on node
   - Code: Registers input via IODetector

**Implementation:**

```javascript
// In NoodlBlocks.ts
Blockly.Blocks['noodl_get_input'] = {
  init: function () {
    this.appendDummyInput().appendField('get input').appendField(new Blockly.FieldTextInput('inputName'), 'INPUT_NAME');
    this.setOutput(true, null);
    this.setColour(290);
    this.setTooltip('Get value from node input');
  }
};

// In NoodlGenerators.ts
javascriptGenerator.forBlock['noodl_get_input'] = function (block) {
  const inputName = block.getFieldValue('INPUT_NAME');
  return [`Noodl.Inputs['${inputName}']`, Order.MEMBER];
};
```

### 2.2 Output Blocks

**Purpose:** Send values to node outputs

**Blocks Needed:**

1. **Set Output**

   - Dropdown/text for output name
   - Value input socket
   - Code: `Noodl.Outputs['outputName'] = value`

2. **Define Output**

   - Text field for output name
   - Dropdown for type
   - Creates dynamic port on node
   - Code: Registers output via IODetector

3. **Send Signal**
   - Dropdown for signal output name
   - Code: `Noodl.Outputs['signalName'] = true`

### 2.3 Variable Blocks

**Purpose:** Access Noodl Variables

**Blocks Needed:**

1. **Get Variable**

   - Dropdown for variable name (from project)
   - Code: `Noodl.Variables['varName']`

2. **Set Variable**
   - Dropdown for variable name
   - Value input
   - Code: `Noodl.Variables['varName'] = value`

### 2.4 Object Blocks

**Purpose:** Work with Noodl Objects

**Blocks Needed:**

1. **Get Object**

   - Text input for object ID
   - Code: `Noodl.Objects['objectId']`

2. **Get Object Property**

   - Object input socket
   - Property name field
   - Code: `object['propertyName']`

3. **Set Object Property**
   - Object input socket
   - Property name field
   - Value input socket
   - Code: `object['propertyName'] = value`

### 2.5 Array Blocks

**Purpose:** Work with Noodl Arrays

**Blocks Needed:**

1. **Get Array**

   - Text input for array name
   - Code: `Noodl.Arrays['arrayName']`

2. **Array Length**

   - Array input socket
   - Code: `array.length`

3. **Get Array Item**

   - Array input socket
   - Index input
   - Code: `array[index]`

4. **Add to Array**
   - Array input socket
   - Value input
   - Code: `array.push(value)`

### Implementation Priority

**MVP (Must Have):**

1. Get Input / Set Output (core functionality)
2. Variables (get/set)
3. Send Signal

**Phase 2 (Important):** 4. Objects (get/get property/set property) 5. Define Input/Define Output (dynamic ports)

**Phase 3 (Nice to Have):** 6. Arrays (full CRUD operations)

---

## Phase 3: IODetector Enhancement

### Current State

`IODetector.ts` exists but needs verification:

- Scans workspace JSON for Noodl block usage
- Detects input/output references
- Reports required ports to editor

### Tasks

- [ ] Review IODetector logic
- [ ] Add support for "Define Input/Output" blocks
- [ ] Handle variable/object/array references
- [ ] Test with various block combinations

### Expected Detection

```typescript
// Workspace contains:
// - Get Input "userName"
// - Set Output "greeting"
// - Send Signal "done"

// IODetector should return:
{
  inputs: [
    { name: 'userName', type: 'string' }
  ],
  outputs: [
    { name: 'greeting', type: 'string' },
    { name: 'done', type: 'signal' }
  ]
}
```

---

## Phase 4: End-to-End Testing

### 4.1 Basic Flow Test

**Setup:**

1. Add Logic Builder node to canvas
2. Open Logic Builder editor
3. Create simple logic:
   - Get Input "name"
   - Concatenate with "Hello, "
   - Set Output "greeting"

**Expected:**

- Input port "name" appears on node
- Output port "greeting" appears on node
- Text input node → Logic Builder → Text node shows correct value

### 4.2 Signal Test

**Setup:**

1. Logic Builder with "Send Signal 'done'" block

**Expected:**

- Signal output "done" appears
- Connecting to another node triggers it properly

### 4.3 Variable Test

**Setup:**

1. Create Variable "counter"
2. Logic Builder:
   - Get Variable "counter"
   - Add 1
   - Set Variable "counter"
   - Set Output "currentCount"

**Expected:**

- Variable updates globally
- Output shows incremented value

### 4.4 Object Test

**Setup:**

1. Create Object with property "score"
2. Logic Builder:
   - Get Object "player"
   - Get Property "score"
   - Add 10
   - Set Property "score"

**Expected:**

- Object property updates
- Other nodes reading same object see change

### Test Matrix

| Test         | Inputs | Logic                            | Outputs     | Status |
| ------------ | ------ | -------------------------------- | ----------- | ------ |
| Pass-through | value  | Get Input → Set Output           | value       | ⏳     |
| Math         | a, b   | a + b                            | sum         | ⏳     |
| Conditional  | x      | if x > 10 then "high" else "low" | result      | ⏳     |
| Signal       | -      | Send Signal                      | done signal | ⏳     |
| Variable     | -      | Get/Set Variable                 | -           | ⏳     |
| Object       | objId  | Get Object Property              | value       | ⏳     |

---

## Phase 5: Documentation

### 5.1 User Guide

Create: `LOGIC-BUILDER-USER-GUIDE.md`

**Contents:**

- What is Logic Builder?
- When to use vs standard nodes
- How to add inputs/outputs
- Available blocks reference
- Common patterns/examples

### 5.2 Developer Guide

Create: `LOGIC-BUILDER-DEV-GUIDE.md`

**Contents:**

- Architecture overview
- How to add new blocks
- Code generation patterns
- IODetector how-to
- Troubleshooting guide

### 5.3 Known Limitations

Document in README:

- Drag-and-drop timeout (1000ms)
- No async/await support yet
- No loop constructs yet
- Data nodes not integrated

---

## File Changes Required

### New Files

- `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-012-blockly-integration/LOGIC-BUILDER-USER-GUIDE.md`
- `dev-docs/tasks/phase-3-editor-ux-overhaul/TASK-012-blockly-integration/LOGIC-BUILDER-DEV-GUIDE.md`

### Modified Files

- `NoodlBlocks.ts` - Add all Noodl API blocks
- `NoodlGenerators.ts` - Add code generators for Noodl blocks
- `BlocklyWorkspace.tsx` - Update toolbox configuration
- `IODetector.ts` - Enhance detection logic
- `logic-builder.js` - Verify runtime API exposure

---

## Success Criteria

- [ ] Standard Blockly blocks audited and documented
- [ ] Noodl Input/Output blocks implemented
- [ ] Noodl Variable blocks implemented
- [ ] Noodl Object blocks implemented (basic)
- [ ] Noodl Array blocks implemented (basic)
- [ ] IODetector correctly identifies all port requirements
- [ ] End-to-end tests pass (inputs → logic → outputs)
- [ ] User guide written
- [ ] Developer guide written
- [ ] Examples created and tested

---

## Future Enhancements (Not in This Task)

- Data node integration (REST API, SQL, etc.)
- Async/await support
- Loop constructs
- Custom block creation UI
- Block library sharing
- Visual debugging/step-through
- Performance profiling
- Fix drag-and-drop 1000ms timeout

---

## Related Tasks

- TASK-012A - Foundation (Complete)
- TASK-012B - Bug Fixes (Complete)
- TASK-012C - This task
- TASK-012D - Polish & Advanced Features (Future)

---

## Notes

- Keep blocks simple and aligned with Noodl concepts
- Prioritize common use cases over exhaustive coverage
- Document limitations clearly
- Consider future extensibility in design
