# TASK-001B: React 19 Migration Completion

## Status: ✅ COMPLETED

## Overview
Complete the React 19 TypeScript compatibility migration that was started in TASK-001. The editor currently has 90 TypeScript errors preventing it from running.

## Problem Statement
After the initial React 17→19 upgrade in TASK-001, only a subset of files were fixed. The editor build fails with 90 errors related to:
- Removed React 18/19 APIs (`render`, `unmountComponentAtNode`)
- Removed TypeScript types (`ReactChild`, `ReactFragment`, `ReactText`)
- Stricter `useRef()` typing
- Stricter ref callback signatures
- Other breaking type changes

## Error Categories

| Category | Count | Fix Pattern |
|----------|-------|-------------|
| `ReactDOM.render` removed | ~20 | Use `createRoot().render()` |
| `unmountComponentAtNode` removed | ~10 | Use `root.unmount()` |
| `useRef()` needs argument | ~15 | Add type param and `null` |
| `ReactChild` type removed | ~5 | Use `React.ReactNode` |
| `ReactFragment` type removed | 1 | Use `Iterable<React.ReactNode>` |
| `ReactText` type removed | 1 | Use `string \| number` |
| Ref callback return type | ~8 | Return `void` not element |
| Unused `@ts-expect-error` | 1 | Remove directive |
| `algoliasearch` API change | 1 | Use named export |
| Other type issues | ~28 | Case-by-case |

## Files to Fix

### noodl-core-ui (Critical)
- [ ] `src/types/global.ts` - Remove ReactChild, ReactFragment, ReactText
- [ ] `src/components/layout/BaseDialog/BaseDialog.tsx` - useRef
- [ ] `src/components/layout/Carousel/Carousel.tsx` - ref callback
- [ ] `src/components/property-panel/PropertyPanelSelectInput/PropertyPanelSelectInput.tsx` - useRef
- [ ] `src/components/property-panel/PropertyPanelSliderInput/PropertyPanelSliderInput.tsx` - type issue
- [ ] `src/components/popups/PopupSection/PopupSection.tsx` - useRef, @ts-expect-error

### noodl-editor (Critical)
- [ ] `src/shared/ReactView.ts` - render, unmountComponentAtNode
- [ ] `src/editor/src/views/VisualCanvas/CanvasView.ts` - render, unmountComponentAtNode
- [ ] `src/editor/src/views/VisualCanvas/ShowInspectMenu.tsx` - render, unmountComponentAtNode
- [ ] `src/editor/src/views/HelpCenter/HelpCenter.tsx` - useRef, algoliasearch
- [ ] `src/editor/src/views/EditorTopbar/EditorTopbar.tsx` - multiple useRef
- [ ] `src/editor/src/views/NodeGraphComponentTrail/NodeGraphComponentTrail.tsx` - useRef
- [ ] `src/editor/src/views/NodePicker/components/*` - ReactChild imports
- [ ] `src/editor/src/views/SidePanel/SidePanel.tsx` - ReactChild
- [ ] `src/editor/src/views/panels/propertyeditor/*.ts` - render, unmountComponentAtNode
- [ ] `src/editor/src/views/documents/ComponentDiffDocument/CodeDiffDialog.tsx` - useRef
- [ ] Many more in propertyeditor folder...

## Fix Patterns

### Pattern 1: ReactDOM.render → createRoot
```typescript
// OLD (React 17)
import ReactDOM from 'react-dom';
ReactDOM.render(<Component />, container);

// NEW (React 18+)
import { createRoot } from 'react-dom/client';
const root = createRoot(container);
root.render(<Component />);
```

### Pattern 2: unmountComponentAtNode → root.unmount
```typescript
// OLD (React 17)
ReactDOM.unmountComponentAtNode(container);

// NEW (React 18+)
// Store root when creating, then:
root.unmount();
```

### Pattern 3: useRef with type
```typescript
// OLD
const ref = useRef();

// NEW
const ref = useRef<HTMLDivElement>(null);
```

### Pattern 4: Ref callbacks
```typescript
// OLD - returns element
ref={(el: HTMLDivElement) => this.el = el}

// NEW - returns void
ref={(el: HTMLDivElement) => { this.el = el; }}
```

### Pattern 5: Removed types
```typescript
// OLD
import { ReactChild, ReactFragment, ReactText } from 'react';

// NEW - use equivalent types
type ReactChild = React.ReactNode;  // or just use ReactNode directly
type ReactText = string | number;
// ReactFragment → Iterable<React.ReactNode> or just ReactNode
```

## Success Criteria
- [ ] `npm run dev` compiles without errors
- [ ] Editor window opens and displays
- [ ] Basic editor functionality works
- [ ] No TypeScript errors: `npx tsc --noEmit`

## Estimated Time
4-6 hours (90 errors across ~40 files)

## Dependencies
- TASK-001 (completed partially)

## Notes
- Many files use the legacy `ReactDOM.render` pattern for dynamic rendering
- Consider creating a helper utility for the createRoot pattern
- Some files may need runtime root tracking for unmount
