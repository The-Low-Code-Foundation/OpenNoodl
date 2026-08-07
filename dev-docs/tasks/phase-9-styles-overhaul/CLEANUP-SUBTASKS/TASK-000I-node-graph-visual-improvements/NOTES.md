# TASK-000I Working Notes

## Key Code Locations

### Node Rendering

```
packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts

Key methods:
- paint() - Main render function (~line 200-400)
- drawPlugs() - Port indicator rendering
- measure() - Calculate node dimensions
- handleMouseEvent() - Click/hover handling
```

### Colors

```
packages/noodl-core-ui/src/styles/custom-properties/colors.css

Node colors section (~line 30-60):
- --theme-color-node-data-*
- --theme-color-node-visual-*
- --theme-color-node-logic-*
- --theme-color-node-custom-*
- --theme-color-node-component-*
```

### Node Model

```
packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts

- metadata object already exists
- Add comment storage here
```

### Node Type Definitions

```
packages/noodl-editor/src/editor/src/models/nodelibrary/

- Port groups would be defined in node type registration
```

---

## Canvas API Notes

### roundRect Support

- Native `ctx.roundRect()` available in modern browsers
- Fallback for older browsers:

```javascript
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
```

### Text Measurement

```javascript
const width = ctx.measureText(text).width;
```

### Hit Testing

Currently done manually by checking bounds - no need to change pattern.

---

## Color Palette Ideas

### Current (approximate from inspection)

```css
/* Data nodes - current olive green */
--base-color-node-green-700: #4a5d23;
--base-color-node-green-600: #5c7029;

/* Visual nodes - current muted blue */
--base-color-node-blue-700: #2d4a6d;
--base-color-node-blue-600: #3a5f8a;

/* Logic nodes - current grey */
--base-color-node-grey-700: #3d3d3d;
--base-color-node-grey-600: #4a4a4a;

/* Custom nodes - current pink/magenta */
--base-color-node-pink-700: #7d3a5d;
--base-color-node-pink-600: #9a4872;
```

### Proposed Direction

```css
/* Data nodes - richer emerald */
--base-color-node-green-700: #166534;
--base-color-node-green-600: #15803d;

/* Visual nodes - cleaner slate */
--base-color-node-blue-700: #334155;
--base-color-node-blue-600: #475569;

/* Logic nodes - warmer charcoal */
--base-color-node-grey-700: #3f3f46;
--base-color-node-grey-600: #52525b;

/* Custom nodes - refined rose */
--base-color-node-pink-700: #9f1239;
--base-color-node-pink-600: #be123c;
```

_Need to test contrast ratios and get visual feedback_

---

## Port Type Icons

### Character-based approach (simpler)

```typescript
const PORT_TYPE_ICONS = {
  signal: '⚡', // or custom glyph
  string: 'T',
  number: '#',
  boolean: '◐',
  object: '{}',
  array: '[]',
  color: '●',
  any: '◇'
};
```

### SVG path approach (more control)

```typescript
const PORT_TYPE_PATHS = {
  signal: 'M4 0 L8 4 L4 8 L0 4 Z' // lightning bolt
  // ... etc
};
```

_Need to evaluate which looks better at 10-12px_

---

## Port Grouping Logic

### Auto-grouping heuristics

```typescript
function autoGroupPorts(ports: Port[]): PortGroup[] {
  const signals = ports.filter((p) => isSignalType(p.type));
  const dataInputs = ports.filter((p) => p.direction === 'input' && !isSignalType(p.type));
  const dataOutputs = ports.filter((p) => p.direction === 'output' && !isSignalType(p.type));

  const groups: PortGroup[] = [];

  if (signals.length > 0) {
    groups.push({ name: 'Events', ports: signals, expanded: true });
  }
  if (dataInputs.length > 0) {
    groups.push({ name: 'Inputs', ports: dataInputs, expanded: true });
  }
  if (dataOutputs.length > 0) {
    groups.push({ name: 'Outputs', ports: dataOutputs, expanded: true });
  }

  return groups;
}

function isSignalType(type: string): boolean {
  return type === 'signal' || type === '*'; // Check actual type names
}
```

### Explicit group configuration example (HTTP node)

```typescript
{
  portGroups: [
    {
      name: 'Request',
      ports: ['url', 'method', 'body', 'headers-*'],
      defaultExpanded: true
    },
    {
      name: 'Response',
      ports: ['status', 'response', 'responseHeaders'],
      defaultExpanded: true
    },
    {
      name: 'Control',
      ports: ['send', 'success', 'failure', 'error'],
      defaultExpanded: true
    }
  ];
}
```

---

## Connection Compatibility

### Existing type checking

```typescript
// Check NodeLibrary for existing type compatibility logic
NodeLibrary.instance.canConnect(sourceType, targetType);
```

### Visual feedback states

1. **Source port** - Normal rendering (this is what user is hovering)
2. **Compatible** - Brighter, subtle glow, maybe pulse animation
3. **Incompatible** - Dimmed to 50% opacity, greyed connection point

---

## Comment Modal Positioning

### Algorithm

```typescript
function calculateModalPosition(node: NodeGraphEditorNode): { x: number; y: number } {
  const nodeScreenPos = canvasToScreen(node.global.x, node.global.y);
  const nodeWidth = node.nodeSize.width * currentScale;
  const nodeHeight = node.nodeSize.height * currentScale;

  // Position to the right of the node
  let x = nodeScreenPos.x + nodeWidth + 20;
  let y = nodeScreenPos.y;

  // Check if off-screen right, move to left
  if (x + MODAL_WIDTH > window.innerWidth) {
    x = nodeScreenPos.x - MODAL_WIDTH - 20;
  }

  // Check if off-screen bottom
  if (y + MODAL_HEIGHT > window.innerHeight) {
    y = window.innerHeight - MODAL_HEIGHT - 20;
  }

  return { x, y };
}
```

---

## Learnings to Add to LEARNINGS.md

_Add these after implementation:_

- [ ] Canvas roundRect browser support findings
- [ ] Performance impact of rounded corners
- [ ] Comment storage in metadata - any gotchas
- [ ] Port grouping measurement calculations
- [ ] Connection preview performance considerations

---

## Questions to Resolve

1. ~~Should rounded corners apply to title bar only or whole node?~~

   - Decision: Whole node with consistent radius

2. What happens to comments when node is copied to different project?

   - Need to test metadata handling in import/export

3. Should port groups be user-customizable or only defined in node types?

   - Start with node type definitions, user customization is future enhancement

4. How to handle groups for Component nodes (user-defined ports)?
   - Auto-group based on port direction (input/output)

---

## Reference Screenshots

_Add reference screenshots here during implementation for comparison_

### Design References

- [ ] Modern node-based tools (Unreal Blueprints, Blender Geometry Nodes)
- [ ] Other low-code tools for comparison

### OpenNoodl Current State

- [ ] Capture before screenshots
- [ ] Note specific problem areas
