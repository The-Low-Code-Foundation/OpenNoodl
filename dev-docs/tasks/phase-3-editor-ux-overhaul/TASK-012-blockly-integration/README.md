# TASK-012: Blockly Visual Logic Integration

## Metadata

| Field | Value |
|-------|-------|
| **ID** | TASK-012 |
| **Phase** | Phase 3 (Editor UX Overhaul) |
| **Priority** | 🟠 High |
| **Difficulty** | 🔴 Hard |
| **Estimated Time** | 4-6 weeks |
| **Prerequisites** | TASK-006 (Expression Overhaul) recommended but not blocking |
| **Branch** | `task/012-blockly-logic-builder` |

---

## Objective

Integrate Google Blockly into Nodegx to provide visual block-based programming as a bridge between nocode nodes and JavaScript, enabling users to build complex logic without writing code.

---

## Background

### The "JavaScript Cliff" Problem

Nodegx inherits Noodl's powerful but intimidating transition from visual nodes to code:

```
NoCode Zone                          JS Zone
─────────────                        ────────
Visual nodes     ─────[CLIFF]─────►  Expression/Function nodes
Condition node                       Noodl.Variables.isLoggedIn ? x : y
Boolean node                         Inputs.a + Inputs.b  
String Format                        Outputs.result = computation
```

Current observations from coaching Noodl users:
- The built-in nocode nodes become limited quickly
- Teaching customization often requires saying "actually an expression would be better here"
- Most people resist dipping into JavaScript - it's a significant turnoff
- The original creators imagined users would be tempted into JS gradually, but this rarely happens

### The Blockly Solution

Blockly provides visual block-based programming that:
- Eliminates syntax anxiety (no semicolons, parentheses, typos)
- Makes logic tangible and manipulable
- Generates real JavaScript that curious users can inspect
- Has proven success (Scratch, Code.org, MakeCode, MIT App Inventor)

This is similar to our JSON editor approach: visual nocode option available, with code view for the curious.

### Why Blockly?

Research confirms Blockly is the right choice:
- **Industry standard**: Powers Scratch 3.0, Code.org, Microsoft MakeCode, MIT App Inventor
- **Active development**: Transitioned to Raspberry Pi Foundation (November 2025) ensuring education-focused stewardship
- **Mature library**: 13+ years of development, extensive documentation
- **Embeddable**: 100% client-side, ~500KB, no server dependencies
- **Customizable**: Full control over toolbox, blocks, and code generation
- **No real alternatives**: Other "alternatives" are either built on Blockly or complete platforms (not embeddable libraries)

---

## Current State

### Existing Code Nodes

| Node | Purpose | Limitation |
|------|---------|------------|
| **Expression** | Single expression evaluation | Requires JS syntax knowledge |
| **Function** | Multi-line JavaScript | Full JS required |
| **Script** | External script loading | Advanced use case |

### User Pain Points

1. **Backend integration barrier**: "How do I hook up my backend?" often requires Function nodes
2. **Conditional logic complexity**: Even simple if/else requires Expression node JS
3. **Data transformation**: Mapping/filtering arrays requires JS knowledge
4. **No gradual learning path**: Jump from visual to text is too steep

---

## Desired State

Two new node types that provide visual block-based logic:

### 1. Logic Builder Node

Full-featured Blockly workspace for complex, event-driven logic:

```
┌─────────────────────────────────────┐
│    Logic Builder: "ProcessOrder"    │
│                                     │
│  ○ orderData      result ○          │
│  ○ userInfo       error ○           │
│  ⚡ process       ⚡ success         │
│                   ⚡ failure         │
│                                     │
│  [Edit Logic Blocks]                │
└─────────────────────────────────────┘
```

- Multiple inputs and outputs (data and signals)
- Event-driven logic (when signal triggered, do X)
- Full Noodl API access (Variables, Objects, Arrays, Records)
- Tabbed editing experience in node canvas

### 2. Expression Builder Node

Simplified Blockly for single-value expressions:

```
┌───────────────────────────────────────────┐
│  Expression Builder                        │
├───────────────────────────────────────────┤
│  ○ price          result ○                │
│  ○ quantity                               │
│  ○ discount                               │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │ [price] × [quantity] × (1 - [disc]) │  │
│  └─────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

- Single result output
- Inline or small modal editor
- Perfect for computed values, conditionals, formatting

### Node Naming Distinction

To help users choose the right node:

| Node | Mental Model | Subtitle/Description | Icon |
|------|--------------|---------------------|------|
| **Logic Builder** | "Do things when stuff happens" | *"Build event-driven logic visually"* | ⚡ or flowchart |
| **Expression Builder** | "Calculate something" | *"Combine values visually"* | `f(x)` or calculator |

### Existing Node Renaming

For clarity, rename existing code nodes:

| Current Name | New Name |
|--------------|----------|
| Expression | **JavaScript Expression** |
| Function | **JavaScript Function** |
| Script | **JavaScript Script** |

---

## Scope

### In Scope

- [ ] Logic Builder node with full Blockly workspace
- [ ] Expression Builder node with simplified Blockly
- [ ] Tabbed canvas system for Logic Builder editing
- [ ] Custom Noodl block categories (Variables, Objects, Arrays, I/O)
- [ ] Auto-detection of inputs/outputs from blocks
- [ ] I/O summary panel
- [ ] Hidden "View Code" button (read-only JS output)
- [ ] Blockly workspace persistence as node parameter
- [ ] Rename existing Expression/Function/Script to "JavaScript X"

### Out of Scope (Future Phases)

- Records/BYOB blocks (requires Phase 5 BYOB completion)
- Navigation blocks
- Users/Auth blocks
- Cloud Functions blocks
- AI-assisted block suggestions
- Block-to-code learning mode

---

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LOGIC BUILDER NODE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Blockly Workspace                          │ │
│  │  (Custom toolbox with Noodl categories)                       │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Code Generator                             │ │
│  │  Blockly → JavaScript with Noodl context                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│  ┌──────────────────┐       │        ┌─────────────────────────┐  │
│  │  I/O Detector    │◄──────┴───────►│  Generated JS (hidden)  │  │
│  │  (auto-ports)    │                │  [View Code] button     │  │
│  └──────────────────┘                └─────────────────────────┘  │
│           │                                                        │
│           ▼                                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                 Node Port Registration                        │ │
│  │  Dynamic inputs/outputs based on detected blocks              │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Tabbed Canvas System

When opening a Logic Builder node for editing:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Canvas] [ProcessOrder ×] [ValidateUser ×]                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │                                                             │  │
│   │                   Blockly Workspace                         │  │
│   │                                                             │  │
│   │   ┌──────────────┐     ┌──────────────┐                    │  │
│   │   │ when process │     │ set result   │                    │  │
│   │   │ is triggered │────►│ to [value]   │                    │  │
│   │   └──────────────┘     └──────────────┘                    │  │
│   │                                                             │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│   ┌─ I/O Summary ─────────────────┐  ┌─ View Code (read-only) ──┐  │
│   │ Inputs:  orderData, userInfo  │  │ function execute() {     │  │
│   │ Outputs: result, error        │  │   if (Inputs.orderData)  │  │
│   │ Signals: process → success    │  │   ...                    │  │
│   └───────────────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Tab behavior:**
- Clicking "Edit Logic Blocks" opens a new tab named after the node
- Canvas tab always available to flip back
- Tabs reset when leaving component view
- Multiple Logic Builder nodes can be open simultaneously

### Custom Blockly Blocks - Tier 1 (This Task)

```
INPUTS/OUTPUTS
├── 📥 Get Input [name ▼]
├── 📥 Define Input [name] type [type ▼]
├── 📤 Set Output [name ▼] to [value]
├── 📤 Define Output [name] type [type ▼]
└── ⚡ Send Signal [name ▼]
└── ⚡ Define Signal Input [name]
└── ⚡ Define Signal Output [name]

VARIABLES (Noodl.Variables)
├── 📖 Get Variable [name]
├── ✏️ Set Variable [name] to [value]
└── 👁️ When Variable [name] changes

OBJECTS (Noodl.Objects / Noodl.Model)
├── 📖 Get Object [id] 
├── 📖 Get Object [id] property [prop]
├── ✏️ Set Object [id] property [prop] to [value]
├── ➕ Create Object with ID [id]
└── 👁️ When Object [id] changes

ARRAYS (Noodl.Arrays / Noodl.Collection)  
├── 📋 Get Array [name]
├── ➕ Add [item] to Array [name]
├── ➖ Remove [item] from Array [name]
├── 🔢 Array [name] length
├── 🔄 For each [item] in Array [name]
└── 👁️ When Array [name] changes

LOGIC (Standard Blockly)
├── if / else if / else
├── comparison (=, ≠, <, >, ≤, ≥)
├── boolean (and, or, not)
├── loops (repeat, while, for each)
└── math operations

TEXT (Standard Blockly)
├── text join
├── text length
├── text contains
└── text substring

EVENTS
├── ⚡ When [signal input ▼] is triggered
└── ⚡ Then send [signal output ▼]
```

### Future Block Categories (Post-BYOB)

```
RECORDS (Phase 5+ after BYOB)
├── 🔍 Query [collection] where [filter]
├── ➕ Create Record in [collection]
├── ✏️ Update Record [id] in [collection]
├── 🗑️ Delete Record [id]
└── 🔢 Count Records in [collection]

NAVIGATION (Future)
├── 🧭 Navigate to [page]
├── 🔗 Navigate to path [/path]
└── 📦 Show Popup [component]

CONFIG (When Config node complete)
├── ⚙️ Get Config [key]
└── 🔒 Get Secret [key]
```

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/package.json` | Add `blockly` dependency |
| `packages/noodl-runtime/src/nodelibraryexport.js` | Register new nodes |
| `packages/noodl-runtime/src/nodes/std-library/expression.js` | Rename to "JavaScript Expression" |
| `packages/noodl-runtime/src/nodes/std-library/javascriptfunction.js` | Rename to "JavaScript Function" |

### New Files to Create

| File | Purpose |
|------|---------|
| `packages/noodl-editor/src/editor/src/views/BlocklyEditor/` | Blockly workspace React component |
| `packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyWorkspace.tsx` | Main workspace component |
| `packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlBlocks.ts` | Custom block definitions |
| `packages/noodl-editor/src/editor/src/views/BlocklyEditor/NoodlGenerators.ts` | JavaScript code generators |
| `packages/noodl-editor/src/editor/src/views/BlocklyEditor/BlocklyToolbox.ts` | Toolbox configuration |
| `packages/noodl-editor/src/editor/src/views/BlocklyEditor/IODetector.ts` | Auto-detect I/O from blocks |
| `packages/noodl-runtime/src/nodes/std-library/logic-builder.js` | Logic Builder node definition |
| `packages/noodl-runtime/src/nodes/std-library/expression-builder.js` | Expression Builder node definition |
| `packages/noodl-editor/src/editor/src/views/nodegrapheditor/CanvasTabs.tsx` | Tab system for canvas |

### Dependencies

- `blockly` npm package (~500KB)
- No server-side dependencies

---

## Implementation Plan

### Phase A: Foundation (Week 1)

1. **Install and configure Blockly**
   - Add to package.json
   - Create basic React wrapper component
   - Verify rendering in editor

2. **Create basic custom blocks**
   - Input/Output blocks
   - Variable get/set blocks
   - Verify code generation

3. **Storage mechanism**
   - Serialize workspace to JSON
   - Store as node parameter
   - Load/restore workspace

### Phase B: Logic Builder Node (Week 2)

1. **Node definition**
   - Runtime node structure
   - Dynamic port registration
   - Code execution from generated JS

2. **I/O auto-detection**
   - Parse workspace for Input/Output blocks
   - Update node ports dynamically
   - I/O summary panel

3. **Editor integration**
   - Modal editor (initial implementation)
   - "Edit Logic Blocks" button in properties

### Phase C: Tabbed Canvas System (Week 3)

1. **Tab infrastructure**
   - CanvasTabs component
   - Tab state management
   - Component view scope

2. **Tab behavior**
   - Open/close tabs
   - Tab naming from node
   - Reset on component change

3. **Polish**
   - Tab switching animation
   - Unsaved indicator
   - Keyboard shortcuts

### Phase D: Expression Builder Node (Week 4)

1. **Simplified workspace**
   - Limited toolbox (no events/signals)
   - Single result output
   - Inline or small modal

2. **Node definition**
   - Single output port
   - Expression evaluation
   - Type inference

### Phase E: Full Block Library & Polish (Weeks 5-6)

1. **Complete Tier 1 blocks**
   - Objects blocks with property access
   - Arrays blocks with iteration
   - Event/signal blocks

2. **Code viewer**
   - "View Code" button
   - Read-only JS display
   - Syntax highlighting

3. **Rename existing nodes**
   - Expression → JavaScript Expression
   - Function → JavaScript Function
   - Script → JavaScript Script

4. **Testing & documentation**
   - Unit tests for code generation
   - Integration tests for node behavior
   - User documentation

---

## Testing Plan

### Unit Tests

- [ ] Block definitions load correctly
- [ ] Code generator produces valid JavaScript
- [ ] I/O detector finds all Input/Output blocks
- [ ] Workspace serialization round-trips correctly

### Integration Tests

- [ ] Logic Builder node executes generated code
- [ ] Signal inputs trigger execution
- [ ] Outputs update connected nodes
- [ ] Variables/Objects/Arrays access works

### Manual Testing

- [ ] Create Logic Builder with simple if/else logic
- [ ] Connect inputs/outputs to other nodes
- [ ] Verify signal flow works
- [ ] Test workspace persistence (save/reload project)
- [ ] Test tab system navigation
- [ ] Verify "View Code" shows correct JS
- [ ] Test Expression Builder for computed values
- [ ] Performance test with complex block arrangements

---

## Success Criteria

- [ ] Logic Builder node fully functional with Blockly workspace
- [ ] Expression Builder node for simple expressions
- [ ] Auto-detection of I/O from blocks works reliably
- [ ] Tabbed canvas system for editing multiple Logic Builders
- [ ] All Tier 1 blocks implemented and working
- [ ] "View Code" button shows generated JavaScript (read-only)
- [ ] Existing code nodes renamed to "JavaScript X"
- [ ] No performance regression in editor
- [ ] Works in both editor preview and deployed apps

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Blockly bundle size (~500KB) | Lazy-load only when Logic Builder opened |
| Blockly styling conflicts | Scope styles carefully, use shadow DOM if needed |
| Generated code security | Same sandbox as Function node, no new risks |
| Tab system complexity | Start with modal, upgrade to tabs if feasible |
| I/O detection edge cases | Require explicit "Define Input/Output" blocks for ports |

---

## Rollback Plan

All changes are additive:
- New nodes can be removed without breaking existing projects
- Blockly dependency can be removed
- Tab system is independent of node functionality
- Renamed nodes can have aliases for backward compatibility

---

## Future Enhancements (Separate Tasks)

1. **Records blocks** - After BYOB (Phase 5)
2. **Navigation blocks** - Page/popup navigation
3. **AI-assisted blocks** - "Describe what you want" → generates blocks
4. **Block templates** - Common patterns as reusable block groups
5. **Debugging** - Step-through execution, breakpoints
6. **Learning mode** - Side-by-side blocks and generated code

---

## References

- [Google Blockly Documentation](https://developers.google.com/blockly)
- [Blockly GitHub Repository](https://github.com/google/blockly)
- [Blockly Samples (plugins, examples)](https://github.com/google/blockly-samples)
- [MIT App Inventor Blocks](https://appinventor.mit.edu/) - Reference for event-driven block patterns
- [Backendless Blockly](https://backendless.com/) - Richard's reference for block-based backend logic
- TASK-006: Expression Overhaul (related enhancement)
- Phase 5 BYOB: For future Records blocks integration
