# SUBTASK-002: Canvas Navigation

**Parent Task**: TASK-000J Canvas Organization System  
**Estimate**: 8-12 hours  
**Priority**: 2  
**Dependencies**: SUBTASK-001 (Smart Frames) - requires frames to exist as navigation anchors

---

## Overview

A minimap overlay and jump-to navigation system for quickly moving around large canvases. Smart Frames automatically become navigation anchors - no manual bookmark creation needed.

### The Problem

In complex components with many nodes:
- Users pan around aimlessly looking for specific logic
- No way to quickly jump to a known area
- Easy to get "lost" in large canvases
- Zooming out to see everything makes nodes unreadable

### The Solution

- **Minimap**: Small overview in corner showing frame locations and current viewport
- **Jump Menu**: Dropdown list of all Smart Frames for quick navigation
- **Keyboard Shortcuts**: Cmd+1..9 to jump to frames by position

---

## Feature Capabilities

| Capability | Description |
|------------|-------------|
| **Minimap toggle** | Button in canvas toolbar to show/hide minimap |
| **Frame indicators** | Colored rectangles showing Smart Frame positions |
| **Viewport indicator** | Rectangle showing current visible area |
| **Click to navigate** | Click anywhere on minimap to pan canvas there |
| **Jump menu** | Dropdown list of all Smart Frames |
| **Keyboard shortcuts** | Cmd+1..9 to jump to first 9 frames |
| **Persistent state** | Minimap visibility saved in editor settings |

---

## Visual Design

### Minimap Layout

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                 [Main Canvas]                    │
│                                                  │
│                                           ┌─────┐│
│                                           │▪ A  ││
│                                           │  ▪B ││  ← Minimap (150x100px)
│                                           │ ┌─┐ ││  ← Viewport rectangle
│                                           │ └─┘ ││
│                                           │▪ C  ││
│                                           └─────┘│
└──────────────────────────────────────────────────┘
```

### Minimap Details

- **Position**: Bottom-right corner, 10px from edges
- **Size**: ~150x100px (aspect ratio matches canvas)
- **Background**: Semi-transparent dark (#1a1a1a at 80% opacity)
- **Border**: 1px solid border (#333)
- **Border radius**: 4px

### Frame Indicators

- Small rectangles (~10-20px depending on scale)
- Color matches frame color
- Optional: First letter of frame name as label
- Slightly rounded corners

### Viewport Rectangle

- Outline rectangle (no fill)
- White or light color (#fff at 50% opacity)
- 1px stroke
- Shows what's currently visible in main canvas

### Jump Menu

```
┌─────────────────────────┐
│ Jump to Frame      ⌘G   │
├─────────────────────────┤
│ ● Login Flow        ⌘1  │
│ ● Data Fetching     ⌘2  │
│ ● Authentication    ⌘3  │
│ ● Navigation Logic  ⌘4  │
└─────────────────────────┘
```

- Color dot matches frame color
- Frame title (truncated if long)
- Keyboard shortcut hint (if within first 9)

---

## Technical Architecture

### Component Structure

```
packages/noodl-editor/src/editor/src/views/CanvasNavigation/
├── CanvasNavigation.tsx       # Main container
├── CanvasNavigation.module.scss
├── Minimap.tsx                # Minimap rendering
├── Minimap.module.scss
├── JumpMenu.tsx               # Dropdown menu
├── JumpMenu.module.scss
├── hooks/
│   └── useCanvasNavigation.ts # Shared state/logic
└── index.ts
```

### Props Interface

```typescript
interface CanvasNavigationProps {
  nodeGraph: NodeGraphEditor;
  commentsModel: CommentsModel;
  visible: boolean;
  onToggle: () => void;
}

interface MinimapProps {
  frames: SmartFrameInfo[];
  canvasBounds: Bounds;
  viewport: Viewport;
  onNavigate: (x: number, y: number) => void;
}

interface SmartFrameInfo {
  id: string;
  title: string;
  color: string;
  bounds: Bounds;
}

interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}
```

### Coordinate Transformation

The minimap needs to transform between three coordinate systems:

1. **Canvas coordinates**: Where nodes/frames actually are
2. **Minimap coordinates**: Scaled down to fit minimap
3. **Screen coordinates**: For click handling

```typescript
class CoordinateTransformer {
  private canvasBounds: Bounds;
  private minimapSize: { width: number; height: number };
  private scale: number;
  
  constructor(canvasBounds: Bounds, minimapSize: { width: number; height: number }) {
    this.canvasBounds = canvasBounds;
    this.minimapSize = minimapSize;
    
    // Calculate scale to fit canvas in minimap
    const scaleX = minimapSize.width / (canvasBounds.maxX - canvasBounds.minX);
    const scaleY = minimapSize.height / (canvasBounds.maxY - canvasBounds.minY);
    this.scale = Math.min(scaleX, scaleY);
  }
  
  canvasToMinimap(point: Point): Point {
    return {
      x: (point.x - this.canvasBounds.minX) * this.scale,
      y: (point.y - this.canvasBounds.minY) * this.scale
    };
  }
  
  minimapToCanvas(point: Point): Point {
    return {
      x: point.x / this.scale + this.canvasBounds.minX,
      y: point.y / this.scale + this.canvasBounds.minY
    };
  }
}
```

---

## Implementation Sessions

### Session 2.1: Component Structure (2 hours)

**Goal**: Create component files and basic rendering.

**Tasks**:
1. Create directory structure
2. Create `CanvasNavigation.tsx`:
   ```tsx
   import React, { useState } from 'react';
   import { Minimap } from './Minimap';
   import { JumpMenu } from './JumpMenu';
   import styles from './CanvasNavigation.module.scss';
   
   export function CanvasNavigation({ nodeGraph, commentsModel, visible, onToggle }: CanvasNavigationProps) {
     const [jumpMenuOpen, setJumpMenuOpen] = useState(false);
     
     if (!visible) return null;
     
     const frames = getSmartFrames(commentsModel);
     const canvasBounds = calculateCanvasBounds(nodeGraph);
     const viewport = getViewport(nodeGraph);
     
     return (
       <div className={styles.container}>
         <Minimap
           frames={frames}
           canvasBounds={canvasBounds}
           viewport={viewport}
           onNavigate={(x, y) => nodeGraph.panTo(x, y)}
         />
       </div>
     );
   }
   ```
3. Create basic SCSS:
   ```scss
   .container {
     position: absolute;
     bottom: 10px;
     right: 10px;
     z-index: 100;
   }
   ```
4. Create placeholder `Minimap.tsx` and `JumpMenu.tsx`

**Files to create**:
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/CanvasNavigation.tsx`
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/CanvasNavigation.module.scss`
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/Minimap.tsx`
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/Minimap.module.scss`
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/JumpMenu.tsx`
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/index.ts`

**Success criteria**:
- [ ] Components compile without errors
- [ ] Basic container renders in corner

---

### Session 2.2: Coordinate Transformation & Frame Rendering (2 hours)

**Goal**: Render frames at correct positions on minimap.

**Tasks**:
1. Implement canvas bounds calculation:
   ```typescript
   function calculateCanvasBounds(nodeGraph: NodeGraphEditor): Bounds {
     let minX = Infinity, minY = Infinity;
     let maxX = -Infinity, maxY = -Infinity;
     
     // Include all nodes
     nodeGraph.forEachNode((node) => {
       minX = Math.min(minX, node.global.x);
       minY = Math.min(minY, node.global.y);
       maxX = Math.max(maxX, node.global.x + node.nodeSize.width);
       maxY = Math.max(maxY, node.global.y + node.nodeSize.height);
     });
     
     // Include all frames
     const comments = nodeGraph.commentLayer.model.getComments();
     for (const comment of comments) {
       minX = Math.min(minX, comment.x);
       minY = Math.min(minY, comment.y);
       maxX = Math.max(maxX, comment.x + comment.width);
       maxY = Math.max(maxY, comment.y + comment.height);
     }
     
     // Add padding
     const padding = 50;
     return {
       minX: minX - padding,
       minY: minY - padding,
       maxX: maxX + padding,
       maxY: maxY + padding
     };
   }
   ```
2. Implement `CoordinateTransformer` class
3. Render frame rectangles on minimap:
   ```tsx
   function Minimap({ frames, canvasBounds, viewport, onNavigate }: MinimapProps) {
     const minimapSize = { width: 150, height: 100 };
     const transformer = new CoordinateTransformer(canvasBounds, minimapSize);
     
     return (
       <div className={styles.minimap} style={{ width: minimapSize.width, height: minimapSize.height }}>
         {frames.map((frame) => {
           const pos = transformer.canvasToMinimap({ x: frame.bounds.x, y: frame.bounds.y });
           const size = {
             width: frame.bounds.width * transformer.scale,
             height: frame.bounds.height * transformer.scale
           };
           
           return (
             <div
               key={frame.id}
               className={styles.frameIndicator}
               style={{
                 left: pos.x,
                 top: pos.y,
                 width: Math.max(size.width, 8),
                 height: Math.max(size.height, 8),
                 backgroundColor: frame.color
               }}
               title={frame.title}
             />
           );
         })}
       </div>
     );
   }
   ```
4. Add frame color extraction from comment colors

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/Minimap.tsx`

**Files to create**:
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/CoordinateTransformer.ts`

**Success criteria**:
- [ ] Frames render at proportionally correct positions
- [ ] Frame colors match actual frame colors
- [ ] Minimap scales appropriately for different canvas sizes

---

### Session 2.3: Viewport and Click Navigation (2 hours)

**Goal**: Show viewport rectangle and handle click-to-navigate.

**Tasks**:
1. Get viewport from NodeGraphEditor:
   ```typescript
   function getViewport(nodeGraph: NodeGraphEditor): Viewport {
     const panAndScale = nodeGraph.getPanAndScale();
     const canvasWidth = nodeGraph.canvas.width / nodeGraph.canvas.ratio;
     const canvasHeight = nodeGraph.canvas.height / nodeGraph.canvas.ratio;
     
     return {
       x: -panAndScale.x,
       y: -panAndScale.y,
       width: canvasWidth / panAndScale.scale,
       height: canvasHeight / panAndScale.scale,
       scale: panAndScale.scale
     };
   }
   ```
2. Subscribe to pan/scale changes:
   ```typescript
   useEffect(() => {
     const handlePanScaleChange = () => {
       setViewport(getViewport(nodeGraph));
     };
     
     nodeGraph.on('panAndScaleChanged', handlePanScaleChange);
     return () => nodeGraph.off('panAndScaleChanged', handlePanScaleChange);
   }, [nodeGraph]);
   ```
3. Render viewport rectangle:
   ```tsx
   const viewportPos = transformer.canvasToMinimap({ x: viewport.x, y: viewport.y });
   const viewportSize = {
     width: viewport.width * transformer.scale,
     height: viewport.height * transformer.scale
   };
   
   <div
     className={styles.viewport}
     style={{
       left: viewportPos.x,
       top: viewportPos.y,
       width: viewportSize.width,
       height: viewportSize.height
     }}
   />
   ```
4. Handle click navigation:
   ```typescript
   const handleMinimapClick = (e: React.MouseEvent) => {
     const rect = e.currentTarget.getBoundingClientRect();
     const clickX = e.clientX - rect.left;
     const clickY = e.clientY - rect.top;
     
     const canvasPos = transformer.minimapToCanvas({ x: clickX, y: clickY });
     onNavigate(canvasPos.x, canvasPos.y);
   };
   ```
5. Add `panTo` method to NodeGraphEditor if not exists:
   ```typescript
   panTo(x: number, y: number, animate: boolean = true) {
     const centerX = this.canvas.width / this.canvas.ratio / 2;
     const centerY = this.canvas.height / this.canvas.ratio / 2;
     
     const targetPan = {
       x: centerX - x,
       y: centerY - y,
       scale: this.getPanAndScale().scale
     };
     
     if (animate) {
       this.animatePanTo(targetPan);
     } else {
       this.setPanAndScale(targetPan);
     }
   }
   ```

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/Minimap.tsx`
- `packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts` (add panTo method)

**Success criteria**:
- [ ] Viewport rectangle shows current visible area
- [ ] Viewport updates when panning/zooming main canvas
- [ ] Clicking minimap pans canvas to that location

---

### Session 2.4: Toggle and Integration (1-2 hours)

**Goal**: Add toggle button and integrate with editor.

**Tasks**:
1. Add minimap toggle to canvas toolbar:
   ```tsx
   // In EditorDocument.tsx or canvas toolbar component
   <IconButton
     icon={minimapVisible ? IconName.MapFilled : IconName.Map}
     onClick={() => setMinimapVisible(!minimapVisible)}
     tooltip="Toggle Minimap"
   />
   ```
2. Add to EditorSettings:
   ```typescript
   // In editorsettings.ts
   interface EditorSettings {
     // ... existing
     minimapVisible?: boolean;
   }
   ```
3. Mount CanvasNavigation in EditorDocument:
   ```tsx
   // In EditorDocument.tsx
   import { CanvasNavigation } from '@noodl-views/CanvasNavigation';
   
   // In render
   {nodeGraph && (
     <CanvasNavigation
       nodeGraph={nodeGraph}
       commentsModel={commentsModel}
       visible={minimapVisible}
       onToggle={() => setMinimapVisible(!minimapVisible)}
     />
   )}
   ```
4. Persist visibility state:
   ```typescript
   useEffect(() => {
     EditorSettings.instance.set('minimapVisible', minimapVisible);
   }, [minimapVisible]);
   
   // Initial load
   const [minimapVisible, setMinimapVisible] = useState(
     EditorSettings.instance.get('minimapVisible') ?? false
   );
   ```

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/documents/EditorDocument/EditorDocument.tsx`
- `packages/noodl-editor/src/editor/src/utils/editorsettings.ts`

**Success criteria**:
- [ ] Toggle button shows in toolbar
- [ ] Clicking toggle shows/hides minimap
- [ ] Visibility persists across editor sessions

---

### Session 2.5: Jump Menu (2-3 hours)

**Goal**: Create jump menu dropdown and keyboard shortcuts.

**Tasks**:
1. Create JumpMenu component:
   ```tsx
   function JumpMenu({ frames, onSelect, onClose }: JumpMenuProps) {
     return (
       <div className={styles.jumpMenu}>
         <div className={styles.header}>Jump to Frame</div>
         <div className={styles.list}>
           {frames.map((frame, index) => (
             <div
               key={frame.id}
               className={styles.item}
               onClick={() => {
                 onSelect(frame);
                 onClose();
               }}
             >
               <span
                 className={styles.colorDot}
                 style={{ backgroundColor: frame.color }}
               />
               <span className={styles.title}>{frame.title || 'Untitled'}</span>
               {index < 9 && (
                 <span className={styles.shortcut}>⌘{index + 1}</span>
               )}
             </div>
           ))}
         </div>
       </div>
     );
   }
   ```
2. Add jump menu trigger (toolbar button or keyboard):
   ```typescript
   // Keyboard shortcut: Cmd+G or Cmd+J
   KeyboardHandler.instance.registerCommand('g', { meta: true }, () => {
     setJumpMenuOpen(true);
   });
   ```
3. Implement frame jump:
   ```typescript
   const handleFrameSelect = (frame: SmartFrameInfo) => {
     const centerX = frame.bounds.x + frame.bounds.width / 2;
     const centerY = frame.bounds.y + frame.bounds.height / 2;
     nodeGraph.panTo(centerX, centerY);
   };
   ```
4. Add number shortcuts (Cmd+1..9):
   ```typescript
   useEffect(() => {
     const frames = getSmartFrames(commentsModel);
     
     for (let i = 0; i < Math.min(frames.length, 9); i++) {
       KeyboardHandler.instance.registerCommand(`${i + 1}`, { meta: true }, () => {
         handleFrameSelect(frames[i]);
       });
     }
     
     return () => {
       for (let i = 1; i <= 9; i++) {
         KeyboardHandler.instance.unregisterCommand(`${i}`, { meta: true });
       }
     };
   }, [commentsModel, frames]);
   ```
5. Style the menu appropriately

**Files to modify**:
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/JumpMenu.tsx`
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/JumpMenu.module.scss`
- `packages/noodl-editor/src/editor/src/views/CanvasNavigation/CanvasNavigation.tsx`

**Success criteria**:
- [ ] Jump menu opens via toolbar or Cmd+G
- [ ] Menu lists all Smart Frames with colors
- [ ] Selecting frame pans canvas to it
- [ ] Cmd+1..9 shortcuts work for first 9 frames

---

## Testing Checklist

### Minimap Display
- [ ] Minimap appears in bottom-right corner
- [ ] Minimap background is semi-transparent
- [ ] Frame indicators show at correct positions
- [ ] Frame colors match actual frame colors
- [ ] Viewport rectangle visible and correctly sized

### Viewport Tracking
- [ ] Viewport rectangle updates when panning
- [ ] Viewport rectangle updates when zooming
- [ ] Viewport correctly represents visible area

### Navigation
- [ ] Click on minimap pans canvas to that location
- [ ] Pan animation is smooth (not instant)
- [ ] Canvas centers on click location

### Toggle
- [ ] Toggle button visible in toolbar
- [ ] Clicking toggle shows minimap
- [ ] Clicking again hides minimap
- [ ] State persists when switching components
- [ ] State persists when closing/reopening editor

### Jump Menu
- [ ] Menu opens via toolbar button
- [ ] Menu opens via Cmd+G (or Cmd+J)
- [ ] All Smart Frames listed
- [ ] Frame colors displayed correctly
- [ ] Keyboard shortcuts (⌘1-9) shown
- [ ] Selecting frame pans to it
- [ ] Menu closes after selection
- [ ] Esc closes menu

### Keyboard Shortcuts
- [ ] Cmd+1 jumps to first frame
- [ ] Cmd+2 jumps to second frame
- [ ] ...through Cmd+9 for ninth frame
- [ ] Shortcuts only work when canvas focused

### Edge Cases
- [ ] Canvas with no Smart Frames - minimap shows empty, jump menu shows "No frames"
- [ ] Single Smart Frame - minimap and jump work
- [ ] Many frames (20+) - performance acceptable, jump menu scrollable
- [ ] Very large canvas - minimap scales appropriately
- [ ] Very small canvas - minimap shows reasonable size

---

## Files Summary

### Create
```
packages/noodl-editor/src/editor/src/views/CanvasNavigation/
├── CanvasNavigation.tsx
├── CanvasNavigation.module.scss
├── Minimap.tsx
├── Minimap.module.scss
├── JumpMenu.tsx
├── JumpMenu.module.scss
├── CoordinateTransformer.ts
├── hooks/useCanvasNavigation.ts
└── index.ts
```

### Modify
```
packages/noodl-editor/src/editor/src/views/documents/EditorDocument/EditorDocument.tsx
packages/noodl-editor/src/editor/src/utils/editorsettings.ts
packages/noodl-editor/src/editor/src/views/nodegrapheditor.ts
```

---

## Performance Considerations

### Minimap Updates

- Don't re-render on every mouse move during pan
- Use `requestAnimationFrame` for smooth viewport updates
- Debounce frame position updates (frames don't move often)

```typescript
// Throttled viewport update
const updateViewport = useMemo(
  () => throttle(() => {
    setViewport(getViewport(nodeGraph));
  }, 16), // ~60fps
  [nodeGraph]
);
```

### Frame Collection

- Cache frame list, invalidate on comments change
- Don't filter comments on every render

```typescript
const [frames, setFrames] = useState<SmartFrameInfo[]>([]);

useEffect(() => {
  const updateFrames = () => {
    const smartFrames = commentsModel.getComments()
      .filter(c => c.containedNodeIds?.length > 0)
      .map(c => ({
        id: c.id,
        title: c.text,
        color: getFrameColor(c),
        bounds: { x: c.x, y: c.y, width: c.width, height: c.height }
      }));
    setFrames(smartFrames);
  };
  
  commentsModel.on('commentsChanged', updateFrames);
  updateFrames();
  
  return () => commentsModel.off('commentsChanged', updateFrames);
}, [commentsModel]);
```

### Canvas Bounds

- Recalculate bounds only when nodes/frames change, not on every pan
- Cache bounds calculation result

---

## Design Notes

### Why Not Manual Bookmarks?

We considered allowing users to drop pin markers anywhere on the canvas. However:

1. **User responsibility**: Users already create Smart Frames for organization
2. **Reduced complexity**: One concept (frames) serves multiple purposes
3. **Automatic updates**: Frames move, and navigation stays in sync
4. **No orphan pins**: Deleted frames = removed from navigation

If users want navigation without visual grouping, they can create small frames with just a label.

### Minimap Position

Bottom-right was chosen because:
- Top area often has toolbars
- Left side has sidebar panels
- Bottom-right is conventionally where minimaps appear (games, IDEs)

Could make position configurable in future.

### Animation on Navigate

Smooth pan animation helps users:
- Understand spatial relationship between areas
- Not feel "teleported" and disoriented
- See path between current view and destination

Animation should be quick (~200-300ms) to not feel sluggish.
