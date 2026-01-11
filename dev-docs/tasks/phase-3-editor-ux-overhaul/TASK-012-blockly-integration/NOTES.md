# TASK-012 Working Notes

Use this file to capture discoveries, decisions, and research during implementation.

---

## Research Notes

### Blockly Documentation References

- [Getting Started](https://developers.google.com/blockly/guides/get-started)
- [Custom Blocks](https://developers.google.com/blockly/guides/create-custom-blocks/overview)
- [Code Generators](https://developers.google.com/blockly/guides/create-custom-blocks/generating-code)
- [Toolbox Configuration](https://developers.google.com/blockly/guides/configure/web/toolbox)
- [Workspace Serialization](https://developers.google.com/blockly/guides/configure/web/serialization)

### Key Blockly Concepts

- **Workspace**: The canvas where blocks are placed
- **Toolbox**: The sidebar menu of available blocks
- **Block Definition**: JSON or JS object defining block appearance and connections
- **Generator**: Function that converts block to code
- **Mutator**: Dynamic block that can change shape (e.g., if/elseif/else)

### Blockly React Integration

Options:
1. **@blockly/react** - Official React wrapper (may have limitations)
2. **Direct integration** - Use Blockly.inject() in useEffect

Research needed: Which approach works better with our build system?

---

## Design Decisions

### Decision 1: [Topic]
**Date:** 
**Context:** 
**Options:**
1. 
2. 

**Decision:** 
**Rationale:** 

---

### Decision 2: [Topic]
**Date:** 
**Context:** 
**Options:**
1. 
2. 

**Decision:** 
**Rationale:** 

---

## Technical Discoveries

### Discovery 1: [Topic]
**Date:**
**Finding:**

**Impact:**

---

## Questions to Resolve

- [ ] Q1: 
- [ ] Q2: 
- [ ] Q3: 

---

## Code Snippets & Patterns

### Pattern: [Name]
```javascript
// Code here
```

---

## Related Files in Codebase

Files to study:
- `packages/noodl-runtime/src/nodes/std-library/javascriptfunction.js` - Function node pattern
- `packages/noodl-runtime/src/nodes/std-library/expression.js` - Expression node pattern
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/` - Property panel patterns

---

## Meeting Notes / Discussions

### [Date]: [Topic]
**Participants:**
**Summary:**
**Action Items:**

---

## Open Issues

1. **Issue:** 
   **Status:** 
   **Notes:**

2. **Issue:** 
   **Status:** 
   **Notes:**
