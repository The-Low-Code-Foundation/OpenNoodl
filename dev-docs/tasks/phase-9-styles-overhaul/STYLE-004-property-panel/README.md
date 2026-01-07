# STYLE-004: Property Panel UX Overhaul

## Overview

Redesign the property panel to surface the three-level styling system: Variant Picker (easy), Token Overrides (intermediate), and Manual Values (advanced). The goal is progressive disclosure - make the happy path obvious while preserving full control.

**Phase:** 8 (Styles Overhaul)  
**Priority:** HIGH  
**Effort:** 12-16 hours  
**Risk:** Medium (significant UI changes)  
**Dependencies:** STYLE-001, STYLE-002

---

## Background

### Current State

- Property panel shows all CSS properties in a flat list
- No progressive disclosure (beginners see same UI as experts)
- Style variants exist but aren't prominently featured
- Token system exists but requires manual typing

### Target State

- Variant picker is front-and-center for styled elements
- Token overrides available in collapsible section
- Manual controls preserved but de-emphasized
- Visual indicators show when elements use system styles vs custom

---

## The Three Levels

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  LEVEL 1: VARIANT PICKER                    [Default View]      │
│  "Just pick Primary, Secondary, Ghost..."                       │
│  • Single dropdown                                              │
│  • Visual previews                                              │
│  • 80% of users, 80% of the time                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LEVEL 2: TOKEN OVERRIDES                   [Expanded]          │
│  "Use Primary but change the radius to Large"                   │
│  • Override specific properties with tokens                     │
│  • Stay systematic, theme-aware                                 │
│  • Designers building design systems                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LEVEL 3: MANUAL VALUES                     [Advanced]          │
│  "I need exactly 17px padding and this hex color"              │
│  • Full CSS control                                             │
│  • Chrome DevTools-style interface                              │
│  • "You're on your own"                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Property Panel Redesign

### Default View (Button Example)

```
┌─────────────────────────────────────────────────────────────────┐
│ BUTTON                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ CONTENT                                                         │
│ ├─ Label:     [Sign Up          ]                              │
│ └─ Icon:      [None ▼]  Position: [Left ▼]                     │
│                                                                 │
│ STYLE                                                           │
│ ├─ Variant:   [Primary ▼]                                      │
│ │             ┌────────────────────────────────┐                │
│ │             │ ● Primary     ████████████     │                │
│ │             │   Secondary   ████████████     │                │
│ │             │   Outline     ░░░░░░░░░░░░     │                │
│ │             │   Ghost       ············     │                │
│ │             │   Destructive ████████████     │                │
│ │             │   Link        ____________     │                │
│ │             │ ──────────────────────────────│                │
│ │             │   + Create Variant             │                │
│ │             └────────────────────────────────┘                │
│ │                                                               │
│ └─ Size:      [Medium ▼]  (sm / md / lg / xl)                  │
│                                                                 │
│ BEHAVIOR                                                        │
│ ├─ Disabled:  [ ]                                              │
│ └─ Loading:   [ ]                                              │
│                                                                 │
│ ▶ Style Overrides                                               │
│ ▶ Layout                                                        │
│ ▶ Advanced                                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Expanded: Style Overrides (Level 2)

```
│ ▼ Style Overrides                                               │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ Override properties while staying on-system             │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   Background                                                    │
│   [From Variant ▼] ─────────────────────────────────────────   │
│   │ ┌────────────────────────────────┐                         │
│   │ │ ● From Variant (--primary)     │                         │
│   │ │ ─────────────────────────────  │                         │
│   │ │   --primary                    │                         │
│   │ │   --primary-hover              │                         │
│   │ │   --secondary                  │                         │
│   │ │   --destructive                │                         │
│   │ │   --muted                      │                         │
│   │ │   --surface                    │                         │
│   │ │   --background                 │                         │
│   │ │ ─────────────────────────────  │                         │
│   │ │   Custom Value...              │  ← Escape hatch         │
│   │ └────────────────────────────────┘                         │
│                                                                 │
│   Text Color                                                    │
│   [From Variant ▼]                                             │
│                                                                 │
│   Border Color                                                  │
│   [--border ▼]  ← Overriding variant                           │
│   ⚠️ Overriding variant default                                 │
│                                                                 │
│   Border Radius                                                 │
│   [--radius-lg ▼]  ← Overriding variant                        │
│   ⚠️ Overriding variant default                                 │
│                                                                 │
│   Padding                                                       │
│   [From Variant ▼]                                             │
│                                                                 │
│   Shadow                                                        │
│   [From Variant ▼]                                             │
│                                                                 │
│   [Reset All Overrides]                                        │
│                                                                 │
```

When user selects "Custom Value...":

```
│   Background                                                    │
│   [Custom ▼] [#a3f7c2    ] [🎨]                                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ ⚠️ Custom value won't update when theme changes          │   │
│   │    [Save as Token]  [Keep Custom]                        │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
```

### Expanded: Layout (Partially Level 3)

```
│ ▼ Layout                                                        │
│                                                                 │
│   WIDTH                                                         │
│   [Auto ▼] [         ]                                         │
│   │ ● Auto (fit content)                                       │
│   │   Full (100%)                                              │
│   │   Fixed                                                    │
│   │   Token → [Select Token ▼]                                 │
│                                                                 │
│   HEIGHT                                                        │
│   [Auto ▼] [         ]                                         │
│                                                                 │
│   ALIGNMENT                                                     │
│   ┌─────────────────────────────────────┐                      │
│   │ [⬉] [⬆] [⬈]     Align Self         │                      │
│   │ [⬅] [·] [➡]                        │                      │
│   │ [⬋] [⬇] [⬊]                        │                      │
│   └─────────────────────────────────────┘                      │
│                                                                 │
│   SPACING                                                       │
│   Margin:  [Token ▼] [--space-md ▼]                            │
│   Padding: [Variant ▼]                                         │
│                                                                 │
```

### Expanded: Advanced (Level 3)

```
│ ▼ Advanced                                                      │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ ⚠️ Manual values bypass the style system                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   POSITION                                                      │
│   Position: [Relative ▼]                                       │
│   ┌─────────────────────────────────────┐                      │
│   │      Top: [    ]                    │                      │
│   │ Left: [    ]   Right: [    ]        │                      │
│   │      Bottom: [    ]                 │                      │
│   └─────────────────────────────────────┘                      │
│                                                                 │
│   BOX MODEL                                                     │
│   ┌─────────────────────────────────────┐                      │
│   │   Margin                            │                      │
│   │   ┌─────────────────────────────┐   │                      │
│   │   │   Border                    │   │                      │
│   │   │   ┌─────────────────────┐   │   │                      │
│   │   │   │   Padding           │   │   │                      │
│   │   │   │   ┌─────────────┐   │   │   │                      │
│   │   │   │   │   Content   │   │   │   │                      │
│   │   │   │   └─────────────┘   │   │   │                      │
│   │   │   └─────────────────────┘   │   │                      │
│   │   └─────────────────────────────┘   │                      │
│   └─────────────────────────────────────┘                      │
│   [Edit Individual Values]                                     │
│                                                                 │
│   EFFECTS                                                       │
│   Opacity:     [1.0    ] ────────○                             │
│   Cursor:      [Pointer ▼]                                     │
│   Overflow:    [Visible ▼]                                     │
│   Z-Index:     [        ]                                      │
│                                                                 │
│   TRANSFORM                                                     │
│   Rotate:      [0°     ]                                       │
│   Scale:       [1      ]                                       │
│   Translate X: [0      ]                                       │
│   Translate Y: [0      ]                                       │
│                                                                 │
│   TRANSITIONS                                                   │
│   Property:    [all ▼]                                         │
│   Duration:    [--duration-200 ▼]                              │
│   Easing:      [--ease-out ▼]                                  │
│                                                                 │
│   CUSTOM CSS                                                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ /* Any valid CSS */                                     │   │
│   │ backdrop-filter: blur(8px);                             │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
```

---

## Visual Indicators

### On-System vs Custom Indicators

Show users when elements are "on system" vs have custom values:

**In the Property Panel Header:**

```
┌─────────────────────────────────────────────────────────────────┐
│ BUTTON                                         [Using System ✓] │
├─────────────────────────────────────────────────────────────────┤

vs.

┌─────────────────────────────────────────────────────────────────┐
│ BUTTON                                     [⚡ 2 Custom Values] │
├─────────────────────────────────────────────────────────────────┤
```

**In the Style Section:**

```
│ STYLE                                                           │
│ ├─ Variant:   [Primary ▼]  (2 overrides)                       │
                             ^^^^^^^^^^^^^ subtle indicator
```

**On Individual Properties:**

```
│   Border Radius                                                 │
│   [--radius-lg ▼]  ← Override indicator                        │
│   ⚠️ Overriding variant                                         │
```

### In the Canvas (Optional)

Small indicator on selected element showing style status:

```
┌────────────────────────┐
│                        │
│      [ Sign Up ]       │ ← Normal (using system)
│                        │
└────────────────────────┘

┌────────────────────────┐
│                      ⚡ │ ← Has custom values
│      [ Sign Up ]       │
│                        │
└────────────────────────┘
```

---

## Implementation

### Phase 1: Panel Structure Refactor (4-5 hrs)

**Files to modify:**

```
packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
├── PropertyEditor.tsx           # Main panel refactor
├── sections/
│   ├── ContentSection.tsx       # Node-specific content
│   ├── StyleSection.tsx         # Variant picker + size
│   ├── StyleOverridesSection.tsx # Level 2 overrides
│   ├── LayoutSection.tsx        # Layout controls
│   ├── AdvancedSection.tsx      # Level 3 manual controls
│   └── BehaviorSection.tsx      # Disabled, loading, etc.
├── PropertyEditor.module.scss
└── index.ts
```

**Section Architecture:**

```typescript
interface PropertyPanelSection {
  id: string;
  title: string;
  icon?: IconName;
  defaultExpanded: boolean;
  render: (node: NodeModel) => React.ReactNode;
  isApplicable: (nodeType: string) => boolean;
}

const sections: PropertyPanelSection[] = [
  { id: 'content', title: 'Content', defaultExpanded: true, ... },
  { id: 'style', title: 'Style', defaultExpanded: true, ... },
  { id: 'behavior', title: 'Behavior', defaultExpanded: true, ... },
  { id: 'style-overrides', title: 'Style Overrides', defaultExpanded: false, ... },
  { id: 'layout', title: 'Layout', defaultExpanded: false, ... },
  { id: 'advanced', title: 'Advanced', defaultExpanded: false, ... },
];
```

### Phase 2: Style Section Components (3-4 hrs)

**Files to create:**

```
packages/noodl-core-ui/src/components/propertyeditor/
├── VariantPicker/
│   ├── VariantPicker.tsx
│   ├── VariantPicker.module.scss
│   ├── VariantOption.tsx        # Single variant option with preview
│   └── index.ts
├── SizePicker/
│   ├── SizePicker.tsx           # sm/md/lg/xl buttons
│   └── SizePicker.module.scss
├── TokenOverrideRow/
│   ├── TokenOverrideRow.tsx     # Single property override
│   ├── TokenOverrideRow.module.scss
│   └── index.ts
```

### Phase 3: Token Picker Integration (2-3 hrs)

Connect TokenPicker (from STYLE-001) to override rows:

```typescript
interface TokenOverrideRowProps {
  property: string;              // e.g., 'backgroundColor'
  label: string;                 // e.g., 'Background'
  variantValue: string;          // Value from variant
  currentValue: string | null;   // Override value (null = use variant)
  tokenCategory: TokenCategory;  // Filter tokens shown
  onChange: (value: string | null) => void;
}

function TokenOverrideRow({
  property,
  label,
  variantValue,
  currentValue,
  tokenCategory,
  onChange
}: TokenOverrideRowProps) {
  const isOverridden = currentValue !== null;
  
  return (
    <div className={css.Row}>
      <label>{label}</label>
      <TokenPicker
        category={tokenCategory}
        value={currentValue ?? variantValue}
        onChange={(val, isToken) => {
          if (val === variantValue) {
            onChange(null); // Reset to variant
          } else {
            onChange(val);
          }
        }}
        placeholder="From Variant"
        showVariantDefault={variantValue}
      />
      {isOverridden && (
        <span className={css.OverrideIndicator}>
          ⚠️ Overriding variant
        </span>
      )}
    </div>
  );
}
```

### Phase 4: Advanced Section (Legacy Panel) (2-3 hrs)

Preserve existing functionality in collapsible advanced section:

```typescript
// Wrap existing property controls in Advanced section
function AdvancedSection({ node }: { node: NodeModel }) {
  return (
    <CollapsibleSection 
      title="Advanced" 
      defaultExpanded={false}
      warning="Manual values bypass the style system"
    >
      {/* Position controls */}
      <PositionControls node={node} />
      
      {/* Box model (existing) */}
      <BoxModelControls node={node} />
      
      {/* Effects */}
      <EffectsControls node={node} />
      
      {/* Transform */}
      <TransformControls node={node} />
      
      {/* Custom CSS */}
      <CustomCSSEditor node={node} />
    </CollapsibleSection>
  );
}
```

### Phase 5: Polish & Indicators (2-3 hrs)

1. Add override count to Style section header
2. Add custom values indicator to panel header
3. Add canvas indicator (optional)
4. Implement "Reset All Overrides" functionality
5. Add animations for section expand/collapse

---

## Node-Specific Panel Configurations

Different nodes show different sections:

```typescript
const panelConfigs: Record<string, PanelConfig> = {
  'net.noodl.visual.button': {
    sections: ['content', 'style', 'behavior', 'style-overrides', 'layout', 'advanced'],
    contentFields: ['label', 'icon', 'iconPosition'],
    styleOptions: { showVariants: true, showSizes: true },
  },
  
  'net.noodl.visual.text': {
    sections: ['content', 'style', 'layout', 'advanced'],
    contentFields: ['text'],
    styleOptions: { showVariants: true, showSizes: false },
  },
  
  'net.noodl.visual.group': {
    sections: ['style', 'layout', 'advanced'],
    contentFields: [],
    styleOptions: { showVariants: true, showSizes: false },
  },
  
  'net.noodl.visual.image': {
    sections: ['content', 'style', 'layout', 'advanced'],
    contentFields: ['source', 'alt'],
    styleOptions: { showVariants: true, showSizes: false },
  },
};
```

---

## Testing Strategy

### Unit Tests

- Section rendering based on node type
- Override state management
- Token picker selection
- Reset functionality

### Integration Tests

- Select variant → styles apply
- Override property → indicator appears
- Reset overrides → returns to variant
- Expand/collapse sections → state persists

### Manual Testing Checklist

- [ ] Select Button, see variant picker in Style section
- [ ] Change variant, see immediate visual update
- [ ] Expand Style Overrides, override a property
- [ ] See "2 overrides" indicator appear
- [ ] Click Reset All Overrides
- [ ] Expand Advanced section, verify all legacy controls work
- [ ] Use custom CSS field
- [ ] Select Group, verify appropriate sections shown
- [ ] Select logic node (non-visual), verify no style sections

---

## Success Criteria

- [ ] Property panel reorganized into collapsible sections
- [ ] Variant picker prominently displayed for styled elements
- [ ] Token overrides section works correctly
- [ ] Advanced section preserves all legacy functionality
- [ ] Override indicators show where variants are overridden
- [ ] "Reset All Overrides" works correctly
- [ ] Panel adapts to different node types

---

## Backward Compatibility

The existing property panel functionality must be preserved:

1. All existing CSS properties remain editable in Advanced section
2. Projects with manual styling continue to work
3. No forced migration to new system
4. Advanced section provides identical control to old panel

---

## Dependencies

**Blocked By:**
- STYLE-001 (Token System) - needs TokenPicker component
- STYLE-002 (Element Configs) - needs variant definitions

**Blocks:**
- STYLE-005 (Smart Suggestions) - builds on panel structure

---

*Last Updated: January 2026*
