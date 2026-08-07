# Responsive Breakpoints System

## Feature Overview

A built-in responsive breakpoint system that works like visual states (hover/pressed/disabled) but for viewport widths. Users can define breakpoint-specific property values directly in the property panel without wiring up states nodes.

**Current Pain Point:**
Users must manually wire `[Screen Width] → [States Node] → [Visual Node]` for every responsive property, cluttering the node graph and making responsive design tedious.

**Solution:**
In the property panel, a breakpoint selector lets users switch between Desktop/Tablet/Phone/Small Phone views. When a breakpoint is selected, users see and edit that breakpoint's values. Values cascade down (desktop → tablet → phone) unless explicitly overridden.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Terminology | "Breakpoints" |
| Default breakpoints | Desktop (≥1024px), Tablet (768-1023px), Phone (320-767px), Small Phone (<320px) |
| Cascade direction | Configurable (desktop-first default, mobile-first option) |
| Editor preview sync | Independent (changing breakpoint doesn't resize preview, and vice versa) |

## Breakpoint-Aware Properties

Only layout/dimension properties support breakpoints (not colors/shadows):

**✅ Supported:**
- **Dimensions**: width, height, minWidth, maxWidth, minHeight, maxHeight
- **Spacing**: marginTop/Right/Bottom/Left, paddingTop/Right/Bottom/Left, gap
- **Typography**: fontSize, lineHeight, letterSpacing
- **Layout**: flexDirection, alignItems, justifyContent, flexWrap, flexGrow, flexShrink
- **Visibility**: visible, mounted

**❌ Not Supported:**
- Colors (backgroundColor, borderColor, textColor, etc.)
- Borders (borderWidth, borderRadius, borderStyle)
- Shadows (boxShadow)
- Effects (opacity, transform)

## Data Model

```javascript
// Node model storage
{
  parameters: {
    marginTop: '40px',           // desktop (default breakpoint)
  },
  breakpointParameters: {
    tablet: { marginTop: '24px' },
    phone: { marginTop: '16px' },
    smallPhone: { marginTop: '12px' }
  },
  // Optional: combined visual state + breakpoint
  stateBreakpointParameters: {
    'hover:tablet': { /* ... */ }
  }
}

// Project settings
{
  breakpoints: {
    desktop: { minWidth: 1024, isDefault: true },
    tablet: { minWidth: 768, maxWidth: 1023 },
    phone: { minWidth: 320, maxWidth: 767 },
    smallPhone: { minWidth: 0, maxWidth: 319 }
  },
  breakpointOrder: ['desktop', 'tablet', 'phone', 'smallPhone'],
  cascadeDirection: 'desktop-first' // or 'mobile-first'
}
```

## Implementation Phases

| Phase | Name | Estimate | Dependencies |
|-------|------|----------|--------------|
| 1 | Foundation - Data Model | 2-3 days | None |
| 2 | Editor UI - Property Panel | 3-4 days | Phase 1 |
| 3 | Runtime - Viewport Detection | 2-3 days | Phase 1 |
| 4 | Variants Integration | 1-2 days | Phases 1-3 |
| 5 | Visual States Combo | 2 days | Phases 1-4 |

**Total Estimate: 10-14 days**

## Success Criteria

1. Users can set different margin/padding/width values per breakpoint without any node wiring
2. Values cascade automatically (tablet inherits desktop unless overridden)
3. Property panel clearly shows inherited vs overridden values
4. Runtime automatically applies correct values based on viewport width
5. Variants support breakpoint-specific values
6. Project settings allow customizing breakpoint thresholds
7. Both desktop-first and mobile-first workflows supported

## File Structure

```
tasks/responsive-breakpoints/
├── 00-OVERVIEW.md              (this file)
├── 01-FOUNDATION.md            (Phase 1: Data model)
├── 02-EDITOR-UI.md             (Phase 2: Property panel)
├── 03-RUNTIME.md               (Phase 3: Viewport detection)
├── 04-VARIANTS.md              (Phase 4: Variants integration)
└── 05-VISUAL-STATES-COMBO.md   (Phase 5: Combined states)
```

## Related Documentation

- `codebase/nodes/visual-states.md` - Existing visual states system (pattern to follow)
- `codebase/nodes/variants.md` - Existing variants system
- `packages/noodl-editor/src/editor/src/views/panels/propertyeditor/` - Property panel implementation
- `packages/noodl-editor/src/editor/src/models/nodegraphmodel/NodeGraphNode.ts` - Node model
- `packages/noodl-runtime/src/models/nodemodel.js` - Runtime node model
