# TASK-000I Implementation Checklist

## Pre-Implementation

- [ ] Review `NodeGraphEditorNode.ts` paint() method thoroughly
- [ ] Review `colors.css` current color definitions
- [ ] Review `NodeGraphNode.ts` metadata structure
- [ ] Test Canvas roundRect() browser support
- [ ] Set up test project with complex node graphs

---

## Sub-Task A: Visual Polish

### A1: Rounded Corners

- [ ] Create `canvasHelpers.ts` with roundRect utility
- [ ] Replace background `fillRect` with roundRect in paint()
- [ ] Update border drawing to use roundRect
- [ ] Update selection highlight to use roundRect
- [ ] Update error/annotation borders to use roundRect
- [ ] Handle title bar corners (top only vs all)
- [ ] Test at various zoom levels
- [ ] Verify no visual artifacts

### A2: Color Palette Update

- [ ] Document current color values
- [ ] Design new palette following design system
- [ ] Update `--theme-color-node-data-*` variables
- [ ] Update `--theme-color-node-visual-*` variables
- [ ] Update `--theme-color-node-logic-*` variables
- [ ] Update `--theme-color-node-custom-*` variables
- [ ] Update `--theme-color-node-component-*` variables
- [ ] Update connection colors if needed
- [ ] Verify contrast ratios (WCAG AA minimum)
- [ ] Test in dark theme
- [ ] Get feedback on new colors

### A3: Connection Point Styling

- [ ] Identify all port indicator drawing code
- [ ] Increase hit area size (4px → 6px?)
- [ ] Add subtle inner highlight effect
- [ ] Improve anti-aliasing
- [ ] Test connection dragging still works
- [ ] Verify hover states visible

### A4: Port Label Truncation

- [ ] Create truncateText utility function
- [ ] Integrate into drawPlugs() function
- [ ] Calculate available width correctly
- [ ] Add ellipsis character (…)
- [ ] Verify tooltip shows full name on hover
- [ ] Test with various label lengths
- [ ] Test with RTL text (if applicable)

### A: Integration & Polish

- [ ] Full visual review of all node types
- [ ] Performance profiling
- [ ] Update any hardcoded colors
- [ ] Screenshots for documentation

---

## Sub-Task B: Node Comments System

### B1: Data Layer

- [ ] Add `comment?: string` to NodeMetadata interface
- [ ] Implement `getComment()` method
- [ ] Implement `setComment()` method with undo support
- [ ] Implement `hasComment()` helper
- [ ] Add 'commentChanged' event emission
- [ ] Verify comment persists in project JSON
- [ ] Verify comment included in node copy/paste
- [ ] Write unit tests for data layer

### B2: Comment Icon Rendering

- [ ] Design/source comment icon (speech bubble)
- [ ] Add icon drawing in paint() after title
- [ ] Show solid icon when comment exists
- [ ] Show faded icon on hover when no comment
- [ ] Calculate correct icon position
- [ ] Store hit bounds for click detection
- [ ] Test icon visibility at all zoom levels

### B3: Hover Preview

- [ ] Add hover state tracking for comment icon
- [ ] Implement 300ms debounce timer
- [ ] Create preview content formatter
- [ ] Position preview near icon, not obscuring node
- [ ] Set max dimensions (250px × 150px)
- [ ] Add scroll for long comments
- [ ] Clear preview on mouse leave
- [ ] Clear preview on pan/zoom start
- [ ] Test rapid mouse movement (no spam)

### B4: Edit Modal

- [ ] Create `NodeCommentEditor.tsx` component
- [ ] Create `NodeCommentEditor.module.scss` styles
- [ ] Implement draggable header
- [ ] Implement textarea with auto-focus
- [ ] Handle Save button click
- [ ] Handle Cancel button click
- [ ] Handle Cmd+Enter to save
- [ ] Handle Escape to cancel
- [ ] Show node name in header
- [ ] Position modal near node initially
- [ ] Prevent duplicate modals for same node

### B5: Click Handler Integration

- [ ] Add comment icon click detection
- [ ] Open modal on icon click
- [ ] Prevent node selection on icon click
- [ ] Handle modal close callback
- [ ] Update node display after comment change

### B: Integration & Polish

- [ ] End-to-end test: create, edit, delete comment
- [ ] Test with very long comments
- [ ] Test with special characters
- [ ] Test undo/redo flow
- [ ] Test save/load project
- [ ] Test export behavior
- [ ] Accessibility review (keyboard nav)

---

## Sub-Task C: Port Organization & Smart Connections

### C1: Port Grouping - Data Model

- [ ] Define PortGroup interface
- [ ] Add portGroups to node type schema
- [ ] Create port group configuration for HTTP node
- [ ] Create port group configuration for Object node
- [ ] Create port group configuration for Function node
- [ ] Create auto-grouping logic for unconfigured nodes
- [ ] Store group expand state in view

### C1: Port Grouping - Rendering

- [ ] Modify measure() to account for groups
- [ ] Implement group header drawing
- [ ] Implement expand/collapse chevron
- [ ] Draw ports within expanded groups
- [ ] Skip ports in collapsed groups
- [ ] Update connection positioning for grouped ports
- [ ] Handle click on group header

### C1: Port Grouping - Testing

- [ ] Test grouped node rendering
- [ ] Test collapse/expand toggle
- [ ] Test connections to grouped ports
- [ ] Test node without groups (unchanged)
- [ ] Test dynamic ports (wildcard matching)
- [ ] Verify no regression on existing projects

### C2: Port Type Icons

- [ ] Design icon set (signal, string, number, boolean, object, array, color, any)
- [ ] Create icon paths/characters in `portIcons.ts`
- [ ] Integrate icon drawing into port rendering
- [ ] Size icons appropriately (10-12px)
- [ ] Match icon color to port type
- [ ] Test visibility at minimum zoom
- [ ] Ensure icons don't interfere with labels

### C3: Connection Preview on Hover

- [ ] Add highlightedPort state to NodeGraphEditor
- [ ] Detect port hover in mouse event handling
- [ ] Implement `getPortCompatibility()` method
- [ ] Highlight compatible ports (glow effect)
- [ ] Dim incompatible ports (reduce opacity)
- [ ] Draw preview line from source to cursor
- [ ] Clear highlight on mouse leave
- [ ] Test with various type combinations
- [ ] Performance test with many visible nodes

### C: Integration & Polish

- [ ] Full interaction test
- [ ] Performance profiling
- [ ] Edge case testing
- [ ] Documentation for port group configuration

---

## Final Verification

- [ ] All three sub-tasks complete
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Performance acceptable
- [ ] Existing projects load correctly
- [ ] All node types render correctly
- [ ] Copy/paste works
- [ ] Undo/redo works
- [ ] Save/load works
- [ ] Export works
- [ ] Screenshots captured for changelog
- [ ] CHANGELOG.md updated
- [ ] LEARNINGS.md updated with discoveries

---

## Sign-off

| Sub-Task             | Completed | Date | Notes |
| -------------------- | --------- | ---- | ----- |
| A: Visual Polish     | ☐         | -    | -     |
| B: Node Comments     | ☐         | -    | -     |
| C: Port Organization | ☐         | -    | -     |
| Final Integration    | ☐         | -    | -     |
