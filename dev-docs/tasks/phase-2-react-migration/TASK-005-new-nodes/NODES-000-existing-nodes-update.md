# Task: React 19 Node Modernization

## Overview

Update all frontend visual nodes in `noodl-viewer-react` to take advantage of React 19 features, remove deprecated patterns, and prepare the infrastructure for future React 19-only features like View Transitions.

**Priority:** High  
**Estimated Effort:** 16-24 hours  
**Branch:** `feature/react19-node-modernization`

---

## Background

With the editor upgraded to React 19 and the runtime to React 18.3 (95% compatible), we have an opportunity to modernize our node infrastructure. This work removes technical debt, simplifies code, and prepares the foundation for React 19-exclusive features.

### React 19 Changes That Affect Nodes

1. **`ref` as a regular prop** - No more `forwardRef` wrapper needed
2. **Improved `useTransition`** - Can now handle async functions
3. **`useDeferredValue` with initial value** - New parameter for better loading states
4. **Native document metadata** - `<title>`, `<meta>` render directly
5. **Better Suspense** - Works with more scenarios
6. **`use()` hook** - Read resources in render (promises, context)
7. **Form actions** - `useActionState`, `useFormStatus`, `useOptimistic`
8. **Cleaner cleanup** - Ref cleanup functions

---

## Phase 1: Infrastructure Updates

### 1.1 Update `createNodeFromReactComponent` Wrapper

**File:** `packages/noodl-viewer-react/src/react-component-node.js` (or `.ts`)

**Changes:**
- Remove automatic `forwardRef` wrapping logic
- Add support for `ref` as a standard prop
- Add optional `useTransition` integration for state updates
- Add optional `useDeferredValue` wrapper for specified inputs

**New Options:**
```javascript
createNodeFromReactComponent({
  // ... existing options
  
  // NEW: React 19 options
  react19: {
    // Enable transition wrapping for specified inputs
    transitionInputs: ['items', 'filter'], 
    
    // Enable deferred value for specified inputs
    deferredInputs: ['searchQuery'],
    
    // Enable form action support
    formActions: true,
  }
})
```

### 1.2 Update Base Node Classes

**Files:**
- `packages/noodl-viewer-react/src/nodes/std-library/visual-base.js`
- Any shared base classes for visual nodes

**Changes:**
- Remove `forwardRef` patterns
- Update ref handling to use callback ref pattern
- Add utility methods for transitions:
  - `this.startTransition(callback)` - wrap updates in transition
  - `this.getDeferredValue(inputName)` - get deferred version of input

### 1.3 Update TypeScript Definitions

**Files:**
- `packages/noodl-viewer-react/static/viewer/global.d.ts.keep`
- Any relevant `.d.ts` files

**Changes:**
- Update component prop types to include `ref` as regular prop
- Add types for new React 19 hooks
- Update `Noodl` namespace types if needed

---

## Phase 2: Core Visual Nodes

### 2.1 Group Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/group.js`

**Current Issues:**
- Likely uses `forwardRef` or class component with ref forwarding
- May have legacy lifecycle patterns

**Updates:**
- Convert to functional component with `ref` as prop
- Use `useEffect` cleanup returns properly
- Add optional `useDeferredValue` for children rendering (large lists)

**New Capabilities:**
- `Defer Children` input (boolean) - uses `useDeferredValue` for smoother updates
- `Is Updating` output - true when deferred update pending

### 2.2 Text Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/text.js`

**Updates:**
- Remove `forwardRef` wrapper
- Simplify ref handling

### 2.3 Image Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/image.js`

**Updates:**
- Remove `forwardRef` wrapper
- Add resource preloading hints for React 19's `preload()` API (future enhancement slot)

### 2.4 Video Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/video.js`

**Updates:**
- Remove `forwardRef` wrapper
- Ensure ref cleanup is proper

### 2.5 Circle Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/circle.js`

**Updates:**
- Remove `forwardRef` wrapper

### 2.6 Icon Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/icon.js` (or `net.noodl.visual.icon`)

**Updates:**
- Remove `forwardRef` wrapper

---

## Phase 3: UI Control Nodes

### 3.1 Button Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/button.js` (or `net.noodl.controls.button`)

**Updates:**
- Remove `forwardRef` wrapper
- Add form action support preparation:
  - `formAction` input (string) - for future form integration
  - `Is Pending` output - when used in form with pending action

### 3.2 Text Input Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/textinput.js`

**Updates:**
- Remove `forwardRef` wrapper
- Consider `useDeferredValue` for `onChange` value updates
- Add form integration preparation

**New Capabilities (Optional):**
- `Defer Updates` input - delays `Value` output updates for performance
- `Immediate Value` output - non-deferred value for UI feedback

### 3.3 Checkbox Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/checkbox.js`

**Updates:**
- Remove `forwardRef` wrapper
- Add optimistic update preparation (`useOptimistic` slot)

### 3.4 Radio Button / Radio Button Group

**Files:**
- `packages/noodl-viewer-react/src/nodes/std-library/radiobutton.js`
- `packages/noodl-viewer-react/src/nodes/std-library/radiobuttongroup.js`

**Updates:**
- Remove `forwardRef` wrappers
- Ensure proper group state management

### 3.5 Options/Dropdown Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/options.js`

**Updates:**
- Remove `forwardRef` wrapper
- Consider `useDeferredValue` for large option lists

### 3.6 Range/Slider Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/range.js`

**Updates:**
- Remove `forwardRef` wrapper
- `useDeferredValue` for value output (prevent render thrashing during drag)

**New Capabilities:**
- `Deferred Value` output - smoothed value for expensive downstream renders
- `Immediate Value` output - raw value for UI display

---

## Phase 4: Navigation Nodes

### 4.1 Page Router / Router Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/router.js`

**Updates:**
- Add `useTransition` wrapping for navigation
- Prepare for View Transitions API integration

**New Capabilities:**
- `Is Transitioning` output - true during page transition
- `Use Transition` input (boolean, default true) - wrap navigation in React transition

### 4.2 Router Navigate Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/routernavigate.js`

**Updates:**
- Wrap navigation in `startTransition`

**New Capabilities:**
- `Is Pending` output - navigation in progress
- `Transition Priority` input (enum: 'normal', 'urgent') - for future prioritization

### 4.3 Page Stack / Component Stack

**File:** `packages/noodl-viewer-react/src/nodes/std-library/pagestack.js`

**Updates:**
- Add `useTransition` for push/pop operations

**New Capabilities:**
- `Is Transitioning` output
- Prepare for animation coordination with View Transitions

### 4.4 Page Inputs Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/pageinputs.js`

**Updates:**
- Standard cleanup, ensure no deprecated patterns

### 4.5 Popup Nodes

**Files:**
- `packages/noodl-viewer-react/src/nodes/std-library/showpopup.js`
- `packages/noodl-viewer-react/src/nodes/std-library/closepopup.js`

**Updates:**
- Consider `useTransition` for popup show/hide

---

## Phase 5: Layout Nodes

### 5.1 Columns Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/columns.js`

**Updates:**
- Remove `forwardRef` wrapper
- Remove `React.cloneElement` if present (React 19 has better patterns)
- Consider using CSS Grid native features

### 5.2 Repeater (For Each) Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/foreach.js`

**Critical Updates:**
- Add `useDeferredValue` for items array
- Add `useTransition` for item updates

**New Capabilities:**
- `Defer Updates` input (boolean) - uses deferred value for items
- `Is Updating` output - true when deferred update pending
- `Transition Updates` input (boolean) - wrap updates in transition

**Why This Matters:**
Large list updates currently cause jank. With these options:
- User toggles `Defer Updates` → list updates don't block UI
- `Is Updating` output → can show loading indicator

### 5.3 Component Children Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/componentchildren.js`

**Updates:**
- Standard cleanup

---

## Phase 6: Data/Object Nodes

### 6.1 Component Object Node

**File:** `packages/noodl-viewer-react/src/nodes/std-library/componentobject.js`

**Updates:**
- Consider context-based implementation for React 19
- `use(Context)` can now be called conditionally in React 19

### 6.2 Parent Component Object Node

**File:** Similar location

**Updates:**
- Same as Component Object

---

## Phase 7: SEO/Document Nodes (New Capability)

### 7.1 Update Page Node for Document Metadata

**File:** `packages/noodl-viewer-react/src/nodes/std-library/page.js`

**New Capabilities:**
React 19 allows rendering `<title>`, `<meta>`, `<link>` directly in components and they hoist to `<head>`.

**New Inputs:**
- `Page Title` - renders `<title>` (already exists, but implementation changes)
- `Meta Description` - renders `<meta name="description">`
- `Meta Keywords` - renders `<meta name="keywords">`
- `Canonical URL` - renders `<link rel="canonical">`
- `OG Title` - renders `<meta property="og:title">`
- `OG Description` - renders `<meta property="og:description">`
- `OG Image` - renders `<meta property="og:image">`

**Implementation:**
```jsx
function PageComponent({ title, description, ogTitle, ...props }) {
  return (
    <>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {ogTitle && <meta property="og:title" content={ogTitle} />}
      {/* ... rest of component */}
    </>
  );
}
```

This replaces the hacky SSR string replacement currently in `packages/noodl-viewer-react/static/ssr/index.js`.

---

## Phase 8: Testing & Validation

### 8.1 Unit Tests

**Update/Create Tests For:**
- `createNodeFromReactComponent` with new options
- Each updated node renders correctly
- Ref forwarding works without `forwardRef`
- Deferred values update correctly
- Transitions wrap updates properly

### 8.2 Integration Tests

- Page navigation with transitions
- Repeater with large datasets
- Form interactions with new patterns

### 8.3 Visual Regression Tests

- Ensure no visual changes from modernization
- Test all visual states (hover, pressed, disabled)
- Test variants still work

### 8.4 Performance Benchmarks

**Before/After Metrics:**
- Repeater with 1000 items - render time
- Page navigation - transition smoothness
- Text input rapid typing - lag measurement

---

## File List Summary

### Infrastructure Files
```
packages/noodl-viewer-react/src/
├── react-component-node.js          # Main wrapper factory
├── nodes/std-library/
│   └── visual-base.js               # Base class for visual nodes
```

### Visual Element Nodes
```
packages/noodl-viewer-react/src/nodes/std-library/
├── group.js
├── text.js
├── image.js
├── video.js
├── circle.js
├── icon.js (or net.noodl.visual.icon)
```

### UI Control Nodes
```
packages/noodl-viewer-react/src/nodes/std-library/
├── button.js (or net.noodl.controls.button)
├── textinput.js
├── checkbox.js
├── radiobutton.js
├── radiobuttongroup.js
├── options.js
├── range.js
```

### Navigation Nodes
```
packages/noodl-viewer-react/src/nodes/std-library/
├── router.js
├── routernavigate.js
├── pagestack.js
├── pageinputs.js
├── showpopup.js
├── closepopup.js
```

### Layout Nodes
```
packages/noodl-viewer-react/src/nodes/std-library/
├── columns.js
├── foreach.js
├── componentchildren.js
```

### Data Nodes
```
packages/noodl-viewer-react/src/nodes/std-library/
├── componentobject.js
├── parentcomponentobject.js
```

### Page/SEO Nodes
```
packages/noodl-viewer-react/src/nodes/std-library/
├── page.js
```

### Type Definitions
```
packages/noodl-viewer-react/static/viewer/
├── global.d.ts.keep
```

---

## Implementation Order

### Week 1: Foundation
1. Update `createNodeFromReactComponent` infrastructure
2. Update base classes
3. Update Group node (most used, good test case)
4. Update Text node
5. Create test suite for modernized patterns

### Week 2: Controls & Navigation
6. Update all UI Control nodes (Button, TextInput, etc.)
7. Update Navigation nodes with transition support
8. Update Repeater with deferred value support
9. Test navigation flow end-to-end

### Week 3: Polish & New Features
10. Update remaining nodes (Columns, Component Object, etc.)
11. Add Page metadata support
12. Performance testing and optimization
13. Documentation updates

---

## Success Criteria

### Must Have
- [ ] All nodes render correctly after updates
- [ ] No `forwardRef` usage in visual nodes
- [ ] All refs work correctly (DOM access, focus, etc.)
- [ ] No breaking changes to existing projects
- [ ] Tests pass

### Should Have
- [ ] Repeater has `Defer Updates` option
- [ ] Page Router has `Is Transitioning` output
- [ ] Page node has SEO metadata inputs

### Nice to Have
- [ ] Performance improvement measurable in benchmarks
- [ ] Text Input deferred value option
- [ ] Range slider deferred value option

---

## Migration Notes

### Backward Compatibility

These changes should be **fully backward compatible**:
- Existing projects continue to work unchanged
- New features are opt-in via new inputs
- No changes to how nodes are wired together

### Runtime Considerations

Since runtime is React 18.3:
- `useTransition` works (available since React 18)
- `useDeferredValue` works (available since React 18)
- `ref` as prop works (React 18.3 forward-ported this)
- Native metadata hoisting does NOT work (React 19 only)
  - For runtime, metadata nodes will need polyfill/fallback

**Strategy:** Build features for React 19 editor, provide graceful degradation for React 18.3 runtime. Eventually upgrade runtime to React 19.

---

## Code Examples

### Before: forwardRef Pattern
```javascript
getReactComponent() {
  return React.forwardRef((props, ref) => {
    return <div ref={ref} style={props.style}>{props.children}</div>;
  });
}
```

### After: ref as Prop Pattern
```javascript
getReactComponent() {
  return function GroupComponent({ ref, style, children }) {
    return <div ref={ref} style={style}>{children}</div>;
  };
}
```

### Adding Deferred Value Support
```javascript
getReactComponent() {
  return function RepeaterComponent({ items, deferUpdates, onIsUpdating }) {
    const deferredItems = React.useDeferredValue(items);
    const isStale = items !== deferredItems;
    
    React.useEffect(() => {
      onIsUpdating?.(isStale);
    }, [isStale, onIsUpdating]);
    
    const itemsToRender = deferUpdates ? deferredItems : items;
    
    return (
      <div>
        {itemsToRender.map(item => /* render item */)}
      </div>
    );
  };
}
```

### Adding Transition Support
```javascript
getReactComponent() {
  return function RouterComponent({ onNavigate, onIsTransitioning }) {
    const [isPending, startTransition] = React.useTransition();
    
    React.useEffect(() => {
      onIsTransitioning?.(isPending);
    }, [isPending, onIsTransitioning]);
    
    const handleNavigate = (target) => {
      startTransition(() => {
        onNavigate(target);
      });
    };
    
    // ...
  };
}
```

---

## Questions for Implementation

1. **File locations:** Need to verify actual file paths in `noodl-viewer-react` - the paths above are educated guesses based on patterns.

2. **Runtime compatibility:** Should we add feature detection to gracefully degrade on React 18.3 runtime, or assume eventual runtime upgrade?

3. **New inputs/outputs:** Should new capabilities (like `Defer Updates`) be hidden by default and exposed via a "React 19 Features" toggle in project settings?

4. **Breaking changes policy:** If we find any patterns that would break (unlikely), what's the policy? Migration path vs versioning?

---

## Related Future Work

This modernization enables but does not include:
- **Magic Transition Node** - View Transitions API wrapper
- **AI Component Node** - Generative UI with streaming
- **Async Boundary Node** - Suspense wrapper with error boundaries
- **Form Action Node** - React 19 form actions

These will be separate tasks building on this foundation.


# React 19 Node Modernization - Implementation Checklist

Quick reference checklist for implementation. See full spec for details.

---

## Pre-Flight Checks

- [ ] Verify React 19 is installed in editor package
- [ ] Verify React 18.3 is installed in runtime package  
- [ ] Create feature branch: `feature/react19-node-modernization`
- [ ] Locate all node files in `packages/noodl-viewer-react/src/nodes/`

---

## Phase 1: Infrastructure

### createNodeFromReactComponent
- [ ] Find file: `packages/noodl-viewer-react/src/react-component-node.js`
- [ ] Remove automatic forwardRef wrapping
- [ ] Add `ref` prop passthrough to components
- [ ] Add optional `react19.transitionInputs` config
- [ ] Add optional `react19.deferredInputs` config
- [ ] Test: Basic node still renders
- [ ] Test: Ref forwarding works

### Base Classes
- [ ] Find visual-base.js or equivalent
- [ ] Add `this.startTransition()` utility method
- [ ] Add `this.getDeferredValue()` utility method
- [ ] Update TypeScript definitions if applicable

---

## Phase 2: Core Visual Nodes

### Group Node
- [ ] Remove forwardRef
- [ ] Use `ref` as regular prop
- [ ] Test: Renders correctly
- [ ] Test: Ref accessible for DOM manipulation
- [ ] Optional: Add `Defer Children` input
- [ ] Optional: Add `Is Updating` output

### Text Node
- [ ] Remove forwardRef
- [ ] Test: Renders correctly

### Image Node
- [ ] Remove forwardRef
- [ ] Test: Renders correctly

### Video Node  
- [ ] Remove forwardRef
- [ ] Ensure proper ref cleanup
- [ ] Test: Renders correctly

### Circle Node
- [ ] Remove forwardRef
- [ ] Test: Renders correctly

### Icon Node
- [ ] Remove forwardRef
- [ ] Test: Renders correctly

---

## Phase 3: UI Control Nodes

### Button Node
- [ ] Remove forwardRef
- [ ] Test: Click events work
- [ ] Test: Visual states work (hover, pressed, disabled)
- [ ] Optional: Add `Is Pending` output for forms

### Text Input Node
- [ ] Remove forwardRef
- [ ] Test: Value binding works
- [ ] Test: Focus/blur events work
- [ ] Optional: Add `Defer Updates` input
- [ ] Optional: Add `Immediate Value` output

### Checkbox Node
- [ ] Remove forwardRef
- [ ] Test: Checked state works

### Radio Button Node
- [ ] Remove forwardRef
- [ ] Test: Selection works

### Radio Button Group Node
- [ ] Remove forwardRef
- [ ] Test: Group behavior works

### Options/Dropdown Node
- [ ] Remove forwardRef
- [ ] Test: Selection works
- [ ] Optional: useDeferredValue for large option lists

### Range/Slider Node
- [ ] Remove forwardRef
- [ ] Test: Value updates work
- [ ] Optional: Add `Deferred Value` output
- [ ] Optional: Add `Immediate Value` output

---

## Phase 4: Navigation Nodes

### Router Node
- [ ] Remove forwardRef if present
- [ ] Add useTransition for navigation
- [ ] Add `Is Transitioning` output
- [ ] Test: Page navigation works
- [ ] Test: Is Transitioning output fires correctly

### Router Navigate Node
- [ ] Wrap navigation in startTransition
- [ ] Add `Is Pending` output
- [ ] Test: Navigation triggers correctly

### Page Stack Node
- [ ] Add useTransition for push/pop
- [ ] Add `Is Transitioning` output
- [ ] Test: Stack operations work

### Page Inputs Node
- [ ] Standard cleanup
- [ ] Test: Parameters pass correctly

### Show Popup Node
- [ ] Consider useTransition
- [ ] Test: Popup shows/hides

### Close Popup Node
- [ ] Standard cleanup
- [ ] Test: Popup closes

---

## Phase 5: Layout Nodes

### Columns Node
- [ ] Remove forwardRef
- [ ] Remove React.cloneElement if present
- [ ] Test: Column layout works

### Repeater (For Each) Node ⭐ HIGH VALUE
- [ ] Remove forwardRef if present
- [ ] Add useDeferredValue for items
- [ ] Add useTransition for updates
- [ ] Add `Defer Updates` input
- [ ] Add `Is Updating` output
- [ ] Add `Transition Updates` input
- [ ] Test: Basic rendering works
- [ ] Test: Large list performance improved
- [ ] Test: Is Updating output fires correctly

### Component Children Node
- [ ] Standard cleanup
- [ ] Test: Children render correctly

---

## Phase 6: Data Nodes

### Component Object Node
- [ ] Review implementation
- [ ] Consider React 19 context patterns
- [ ] Test: Object access works

### Parent Component Object Node
- [ ] Same as Component Object
- [ ] Test: Parent access works

---

## Phase 7: Page/SEO Node ⭐ HIGH VALUE

### Page Node
- [ ] Add `Page Title` input → renders `<title>`
- [ ] Add `Meta Description` input → renders `<meta name="description">`
- [ ] Add `Canonical URL` input → renders `<link rel="canonical">`
- [ ] Add `OG Title` input → renders `<meta property="og:title">`
- [ ] Add `OG Description` input
- [ ] Add `OG Image` input
- [ ] Test: Metadata renders in head
- [ ] Test: SSR works correctly
- [ ] Provide fallback for React 18.3 runtime

---

## Phase 8: Testing

### Unit Tests
- [ ] createNodeFromReactComponent tests
- [ ] Ref forwarding tests
- [ ] Deferred value tests
- [ ] Transition tests

### Integration Tests
- [ ] Full navigation flow
- [ ] Repeater with large data
- [ ] Form interactions

### Visual Tests
- [ ] All nodes render same as before
- [ ] Visual states work
- [ ] Variants work

### Performance Tests
- [ ] Benchmark: Repeater 1000 items
- [ ] Benchmark: Page navigation
- [ ] Benchmark: Text input typing

---

## Final Steps

- [ ] Update documentation
- [ ] Update changelog
- [ ] Create PR
- [ ] Test in sample projects
- [ ] Deploy to staging
- [ ] User testing

---

## Quick Reference: Pattern Changes

### forwardRef Removal

**Before:**
```jsx
React.forwardRef((props, ref) => <div ref={ref} />)
```

**After:**
```jsx
function Component({ ref, ...props }) { return <div ref={ref} /> }
```

### Adding Deferred Value

```jsx
function Component({ items, deferUpdates, onIsUpdating }) {
  const deferredItems = React.useDeferredValue(items);
  const isStale = items !== deferredItems;
  
  React.useEffect(() => {
    onIsUpdating?.(isStale);
  }, [isStale]);
  
  return /* render deferUpdates ? deferredItems : items */;
}
```

### Adding Transitions

```jsx
function Component({ onNavigate, onIsPending }) {
  const [isPending, startTransition] = React.useTransition();
  
  React.useEffect(() => {
    onIsPending?.(isPending);
  }, [isPending]);
  
  const handleNav = (target) => {
    startTransition(() => onNavigate(target));
  };
}
```

### Document Metadata (React 19)

```jsx
function Page({ title, description }) {
  return (
    <>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      {/* rest of page */}
    </>
  );
}
```

---

## Notes

- High value items marked with ⭐
- Start with infrastructure, then Group node as test case
- Test frequently - small iterations
- Keep backward compatibility - no breaking changes
