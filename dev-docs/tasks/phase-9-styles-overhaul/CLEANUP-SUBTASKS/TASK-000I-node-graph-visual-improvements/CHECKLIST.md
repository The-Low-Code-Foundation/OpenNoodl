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

## Sub-Task B: Node Comments System ✅ COMPLETED

> **Note:** Implementation used existing legacy PopupLayer.StringInputPopup system rather than creating new React component. This was more pragmatic and consistent with codebase patterns.

### B1: Data Layer

- [x] Add `comment?: string` to NodeMetadata interface (already existed)
- [x] Implement `getComment()` method (via model.metadata.comment)
- [x] Implement `setComment()` method with undo support (via setMetaData)
- [x] Implement `hasComment()` helper (via model.hasMetaData)
- [x] Add 'metadataChanged' event emission (existing pattern)
- [x] Verify comment persists in project JSON
- [x] Verify comment included in node copy/paste
- [ ] Write unit tests for data layer (future)

### B2: Comment Icon Rendering

- [x] Design/source comment icon (speech bubble path)
- [x] Add icon drawing in paint() after title
- [x] Show solid icon when comment exists
- [x] Show faded icon on hover when no comment
- [x] Calculate correct icon position (adjusted for node icon presence)
- [x] Store hit bounds for click detection
- [x] Test icon visibility at all zoom levels

### B3: Hover Preview

- [x] Add hover state tracking for comment icon
- [x] Implement 300ms debounce timer
- [x] Create preview content formatter (using PopupLayer tooltip)
- [x] Position preview near icon, not obscuring node
- [x] Set max dimensions (250px × 150px)
- [x] Add scroll for long comments
- [x] Clear preview on mouse leave
- [ ] Clear preview on pan/zoom start (future enhancement)
- [x] Test rapid mouse movement (no spam)

### B4: Edit Modal (via Legacy StringInputPopup)

- [x] Enhanced StringInputPopup template with textarea
- [x] Added code editor styling (monospace, line numbers)
- [x] Auto-focus textarea on open
- [x] Save button saves and closes
- [x] Cancel button discards and closes
- [x] Enter closes for single-line, multiline allows newlines
- [x] Escape cancels
- [x] Show label in header
- [x] Position modal centered on screen
- [x] Fixed height to prevent modal overflow
- [x] Line numbers scroll sync with textarea

### B5: Click Handler Integration

- [x] Add comment icon click detection
- [x] Open modal on icon click (showCommentEditPopup)
- [x] Prevent node selection on icon click
- [x] Handle modal close callback
- [x] Update node display after comment change

### B: Integration & Polish

- [x] End-to-end test: create, edit, delete comment
- [x] Test with very long comments (scroll works)
- [x] Test with special characters
- [x] Test undo/redo flow (via existing undo system)
- [x] Test save/load project
- [ ] Test export behavior (future)
- [ ] Accessibility review (keyboard nav) (future)

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

| Sub-Task             | Completed | Date       | Notes                                                |
| -------------------- | --------- | ---------- | ---------------------------------------------------- |
| A: Visual Polish     | ☐         | -          | -                                                    |
| B: Node Comments     | ☑         | 2026-01-01 | Used legacy PopupLayer with code editor enhancements |
| C: Port Organization | ☐         | -          | -                                                    |
| Final Integration    | ☐         | -          | -                                                    |
