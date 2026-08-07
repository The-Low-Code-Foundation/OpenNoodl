# STYLE-002: Element Configs & Variants

## Overview

Define default configurations and pre-built style variants for Noodl's core visual nodes. When users drag a Button, Group, Text, or Input onto the canvas, it should look good immediately and offer variant options via a simple dropdown.

**Phase:** 8 (Styles Overhaul)  
**Priority:** HIGH (core feature of Phase 8)  
**Effort:** 16-20 hours  
**Risk:** Medium  
**Dependencies:** STYLE-001 (Token System)

---

## Background

### Current State

- Visual nodes render with browser defaults (unstyled)
- Users must manually style every element from scratch
- No variant system for quick style switching
- Existing "style variants" feature is underutilized (requires manual setup)

### Target State

- Visual nodes have sensible, themed defaults on creation
- Common components (Button, Input) have pre-built variants (Primary, Secondary, etc.)
- Variants reference project tokens (change token → all variants update)
- Users can create custom variants and save them

---

## Core Visual Nodes to Configure

| Node | Default Variants | Notes |
|------|------------------|-------|
| **Button** | primary, secondary, outline, ghost, destructive, link | Most important |
| **Group** | default, card, section, inset | Container patterns |
| **Text** | body, heading-1 through heading-6, muted, label, code | Typography hierarchy |
| **TextInput** | default, error | Form inputs |
| **TextArea** | default, error | Multi-line input |
| **Checkbox** | default | Form control |
| **Radio Button** | default | Form control |
| **Switch** | default | Toggle control |
| **Image** | default, rounded, circle | Image display |

---

## Element Configurations

### Button Config

```typescript
const ButtonConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.button',
  
  // Default styling applied on node creation
  defaults: {
    // Layout defaults
    paddingTop: 'var(--space-2)',
    paddingBottom: 'var(--space-2)',
    paddingLeft: 'var(--space-4)',
    paddingRight: 'var(--space-4)',
    
    // Typography defaults
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-medium)',
    fontFamily: 'var(--font-sans)',
    
    // Border defaults
    borderRadius: 'var(--radius-md)',
    
    // Behavior
    cursor: 'pointer',
    
    // Default variant
    _variant: 'primary'
  },
  
  // Size presets
  sizes: {
    sm: {
      paddingTop: 'var(--space-1)',
      paddingBottom: 'var(--space-1)',
      paddingLeft: 'var(--space-2)',
      paddingRight: 'var(--space-2)',
      fontSize: 'var(--text-xs)',
    },
    md: {
      paddingTop: 'var(--space-2)',
      paddingBottom: 'var(--space-2)',
      paddingLeft: 'var(--space-4)',
      paddingRight: 'var(--space-4)',
      fontSize: 'var(--text-sm)',
    },
    lg: {
      paddingTop: 'var(--space-3)',
      paddingBottom: 'var(--space-3)',
      paddingLeft: 'var(--space-6)',
      paddingRight: 'var(--space-6)',
      fontSize: 'var(--text-base)',
    },
    xl: {
      paddingTop: 'var(--space-4)',
      paddingBottom: 'var(--space-4)',
      paddingLeft: 'var(--space-8)',
      paddingRight: 'var(--space-8)',
      fontSize: 'var(--text-lg)',
    }
  },
  
  // Style variants
  variants: {
    primary: {
      backgroundColor: 'var(--primary)',
      color: 'var(--primary-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',
      states: {
        hover: {
          backgroundColor: 'var(--primary-hover)',
        },
        active: {
          transform: 'scale(0.98)',
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
        }
      }
    },
    
    secondary: {
      backgroundColor: 'var(--secondary)',
      color: 'var(--secondary-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',
      states: {
        hover: {
          backgroundColor: 'var(--secondary-hover)',
        },
        active: {
          transform: 'scale(0.98)',
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
        }
      }
    },
    
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border)',
      borderStyle: 'solid',
      states: {
        hover: {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-foreground)',
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
        }
      }
    },
    
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--foreground)',
      borderWidth: '0',
      states: {
        hover: {
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-foreground)',
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
        }
      }
    },
    
    destructive: {
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)',
      borderWidth: '0',
      boxShadow: 'var(--shadow-sm)',
      states: {
        hover: {
          backgroundColor: 'var(--destructive-hover)',
        },
        disabled: {
          opacity: '0.5',
          cursor: 'not-allowed',
        }
      }
    },
    
    link: {
      backgroundColor: 'transparent',
      color: 'var(--primary)',
      borderWidth: '0',
      textDecoration: 'none',
      paddingLeft: '0',
      paddingRight: '0',
      states: {
        hover: {
          textDecoration: 'underline',
        }
      }
    }
  }
};
```

### Group Config

```typescript
const GroupConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.group',
  
  defaults: {
    // Flexbox defaults
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    
    // No default variant - groups start transparent
    _variant: 'default'
  },
  
  variants: {
    default: {
      backgroundColor: 'transparent',
      padding: '0',
      borderWidth: '0',
      borderRadius: '0',
    },
    
    card: {
      backgroundColor: 'var(--surface)',
      padding: 'var(--space-4)',
      borderWidth: 'var(--border-1)',
      borderColor: 'var(--border-subtle)',
      borderStyle: 'solid',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
    },
    
    section: {
      padding: 'var(--space-8)',
    },
    
    inset: {
      backgroundColor: 'var(--muted)',
      padding: 'var(--space-4)',
      borderRadius: 'var(--radius-md)',
    },
    
    'flex-row': {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 'var(--space-2)',
    },
    
    'flex-col': {
      flexDirection: 'column',
      gap: 'var(--space-2)',
    },
    
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
    }
  }
};
```

### Text Config

```typescript
const TextConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.text',
  
  // ============================================================
  // 🐛 BUG FIX: Text element default sizing
  // ============================================================
  // ISSUE: Text elements default to 100% width in a way that
  // causes overflow when siblings are added. The element forces
  // full width instead of sharing space with siblings.
  //
  // ROOT CAUSE: Default width is set to '100%' with no flex-shrink,
  // causing the element to refuse to shrink when siblings exist.
  //
  // FIX: Set proper flex defaults so text elements participate
  // correctly in flex layout:
  // - flexShrink: '1' (allow shrinking)
  // - flexGrow: '0' (don't expand beyond content)
  // - width: 'auto' (size to content by default)
  // - minWidth: '0' (allow shrinking below content size if needed)
  // ============================================================
  
  defaults: {
    // FIXED: Proper flex participation defaults
    width: 'auto',           // Was: '100%' - caused overflow
    height: 'auto',          // Content height (correct)
    flexShrink: '1',         // NEW: Allow shrinking in flex container
    flexGrow: '0',           // NEW: Don't expand beyond content
    minWidth: '0',           // NEW: Allow shrinking below content
    
    // Typography defaults
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--font-normal)',
    lineHeight: 'var(--leading-normal)',
    color: 'var(--foreground)',
    
    // Default variant
    _variant: 'body'
  },
  
  variants: {
    body: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--font-normal)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)',
    },
    
    'heading-1': {
      fontSize: 'var(--text-4xl)',
      fontWeight: 'var(--font-bold)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--foreground)',
      letterSpacing: 'var(--tracking-tight)',
    },
    
    'heading-2': {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-tight)',
      color: 'var(--foreground)',
    },
    
    'heading-3': {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--foreground)',
    },
    
    'heading-4': {
      fontSize: 'var(--text-xl)',
      fontWeight: 'var(--font-semibold)',
      lineHeight: 'var(--leading-snug)',
      color: 'var(--foreground)',
    },
    
    'heading-5': {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--font-medium)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)',
    },
    
    'heading-6': {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--font-medium)',
      lineHeight: 'var(--leading-normal)',
      color: 'var(--foreground)',
    },
    
    muted: {
      fontSize: 'var(--text-sm)',
      color: 'var(--muted-foreground)',
    },
    
    label: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--font-medium)',
      color: 'var(--foreground)',
    },
    
    small: {
      fontSize: 'var(--text-xs)',
      color: 'var(--muted-foreground)',
    },
    
    code: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      backgroundColor: 'var(--muted)',
      padding: '2px 4px',
      borderRadius: 'var(--radius-sm)',
    },
    
    lead: {
      fontSize: 'var(--text-xl)',
      color: 'var(--muted-foreground)',
      lineHeight: 'var(--leading-relaxed)',
    },
    
    blockquote: {
      fontStyle: 'italic',
      borderLeftWidth: '4px',
      borderLeftColor: 'var(--border)',
      borderLeftStyle: 'solid',
      paddingLeft: 'var(--space-4)',
      color: 'var(--muted-foreground)',
    }
  }
};
```

### TextInput Config

```typescript
const TextInputConfig: ElementConfig = {
  nodeType: 'net.noodl.visual.textinput',
  
  defaults: {
    // Sizing
    width: '100%',
    height: 'auto',
    
    // Spacing
    paddingTop: 'var(--space-2)',
    paddingBottom: 'var(--space-2)',
    paddingLeft: 'var(--space-3)',
    paddingRight: 'var(--space-3)',
    
    // Typography
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-base)',
    color: 'var(--foreground)',
    
    // Border
    borderWidth: 'var(--border-1)',
    borderColor: 'var(--border)',
    borderStyle: 'solid',
    borderRadius: 'var(--radius-md)',
    
    // Background
    backgroundColor: 'var(--background)',
    
    // Default variant
    _variant: 'default'
  },
  
  variants: {
    default: {
      borderColor: 'var(--border)',
      backgroundColor: 'var(--background)',
      states: {
        focus: {
          borderColor: 'var(--ring)',
          boxShadow: '0 0 0 2px var(--ring)',
          outline: 'none',
        },
        disabled: {
          backgroundColor: 'var(--muted)',
          opacity: '0.5',
          cursor: 'not-allowed',
        },
        placeholder: {
          color: 'var(--muted-foreground)',
        }
      }
    },
    
    error: {
      borderColor: 'var(--destructive)',
      states: {
        focus: {
          borderColor: 'var(--destructive)',
          boxShadow: '0 0 0 2px var(--destructive)',
        }
      }
    }
  }
};
```

---

## Implementation

### Phase 1: Config System Architecture (4-6 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/models/
├── ElementConfigs/
│   ├── ElementConfigModel.ts    # Main config model
│   ├── ElementConfigTypes.ts    # TypeScript interfaces
│   ├── configs/
│   │   ├── ButtonConfig.ts
│   │   ├── GroupConfig.ts
│   │   ├── TextConfig.ts
│   │   ├── TextInputConfig.ts
│   │   ├── CheckboxConfig.ts
│   │   └── index.ts             # Exports all configs
│   ├── ElementConfigRegistry.ts # Registry for configs
│   └── index.ts
```

**TypeScript Interfaces:**

```typescript
interface ElementConfig {
  nodeType: string;
  defaults: Record<string, string>;
  sizes?: Record<string, Record<string, string>>;
  variants: Record<string, VariantConfig>;
}

interface VariantConfig {
  [property: string]: string | StateConfig;
  states?: StateConfig;
}

interface StateConfig {
  hover?: Record<string, string>;
  active?: Record<string, string>;
  focus?: Record<string, string>;
  disabled?: Record<string, string>;
  placeholder?: Record<string, string>;
}

interface ElementConfigRegistry {
  configs: Map<string, ElementConfig>;
  register(config: ElementConfig): void;
  get(nodeType: string): ElementConfig | undefined;
  getVariants(nodeType: string): string[];
  applyDefaults(node: NodeModel): void;
  applyVariant(node: NodeModel, variantName: string): void;
}
```

### Phase 2: Node Creation Integration (4-5 hrs)

**Files to modify:**

```
packages/noodl-editor/src/editor/src/models/
├── NodeModel.ts                 # Apply defaults on creation
├── NodeGraphModel.ts            # Hook into node creation

packages/noodl-viewer-react/src/
├── nodes/basic/Text.jsx         # Fix defaults (BUG FIX)
├── nodes/controls/Button.jsx    # Apply variant styles
└── react-component-node.js      # Variant resolution
```

**Tasks:**

1. Hook into node creation lifecycle
2. Apply config defaults when node is created
3. Store variant selection in node data
4. Apply variant styles at render time
5. **BUG FIX**: Fix Text element default sizing

**Node Creation Flow:**

```typescript
// In NodeGraphModel.ts or similar
function createNode(nodeType: string, position: Point): NodeModel {
  const node = new NodeModel(nodeType, position);
  
  // Apply element config defaults
  const config = ElementConfigRegistry.get(nodeType);
  if (config) {
    ElementConfigRegistry.applyDefaults(node);
  }
  
  return node;
}
```

### Phase 3: Variant Selector UI (4-5 hrs)

**Files to create/modify:**

```
packages/noodl-core-ui/src/components/inputs/
├── VariantSelector/
│   ├── VariantSelector.tsx
│   ├── VariantSelector.module.scss
│   ├── VariantSelector.stories.tsx
│   ├── VariantPreview.tsx       # Visual preview of variant
│   └── index.ts

packages/noodl-editor/src/editor/src/views/panels/propertyeditor/
├── VariantSection.tsx           # Variant section in property panel
```

**Variant Selector UI:**

```
┌───────────────────────────────────────────┐
│ Variant: [Primary ▼]                      │
│          ┌─────────────────────────────┐  │
│          │ ● Primary    [████████████] │  │
│          │   Secondary  [████████████] │  │
│          │   Outline    [░░░░░░░░░░░░] │  │
│          │   Ghost      [············] │  │
│          │   Destructive[████████████] │  │
│          │   Link       [____________] │  │
│          │ ─────────────────────────── │  │
│          │   + Create Variant          │  │
│          └─────────────────────────────┘  │
└───────────────────────────────────────────┘
```

### Phase 4: State Handling (3-4 hrs)

**Tasks:**

1. Implement hover state application
2. Implement active/pressed state
3. Implement focus state
4. Implement disabled state
5. Implement placeholder styling (inputs)

**State Implementation:**

```typescript
// In react-component-node.js or component wrapper
function applyVariantStates(
  baseStyles: CSSProperties,
  variant: VariantConfig,
  states: { isHovered: boolean; isActive: boolean; isFocused: boolean; isDisabled: boolean }
): CSSProperties {
  let styles = { ...baseStyles };
  
  if (states.isDisabled && variant.states?.disabled) {
    styles = { ...styles, ...variant.states.disabled };
  } else {
    if (states.isHovered && variant.states?.hover) {
      styles = { ...styles, ...variant.states.hover };
    }
    if (states.isActive && variant.states?.active) {
      styles = { ...styles, ...variant.states.active };
    }
    if (states.isFocused && variant.states?.focus) {
      styles = { ...styles, ...variant.states.focus };
    }
  }
  
  return styles;
}
```

---

## Text Element Bug Fix Details

### Current Behavior (Bug)

```
Parent Group (row layout)
├── Text "Hello"     → Takes 100% width, pushes sibling off-screen
└── Text "World"     → Overflows to the right (not visible)
```

### Expected Behavior (After Fix)

```
Parent Group (row layout)
├── Text "Hello"     → Takes ~50% width (flex shrinks)
└── Text "World"     → Takes ~50% width (both visible)
```

### Root Cause Analysis

The Text node's default styling sets `width: 100%` without proper flex shrink behavior:

```javascript
// Current (problematic) defaults in Text.jsx
const defaultStyle = {
  width: '100%',        // Forces full width
  height: 'auto',
  // Missing: flexShrink, flexGrow, minWidth
};
```

### Fix Implementation

```javascript
// Fixed defaults in Text.jsx
const defaultStyle = {
  width: 'auto',        // Changed from '100%'
  height: 'auto',
  flexShrink: 1,        // Allow shrinking
  flexGrow: 0,          // Don't expand beyond content
  minWidth: 0,          // Allow shrinking below intrinsic size
};
```

### Files to Modify

```
packages/noodl-viewer-react/src/nodes/basic/Text.jsx
  - Update defaultStyle object
  - Add flexShrink, flexGrow, minWidth defaults

packages/noodl-runtime/src/nodes/basic/text.js (if exists)
  - Mirror changes for runtime consistency
```

### Testing the Fix

1. Create a Group with row layout
2. Add two Text elements as children
3. **Before fix**: Second text overflows
4. **After fix**: Both texts share space equally

---

## Custom Variant Creation

Users should be able to create their own variants:

### "Save as Variant" Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CREATE NEW VARIANT                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ This button has custom styling. Save it as a reusable variant? │
│                                                                 │
│ Variant Name: [success-button      ]                           │
│                                                                 │
│ Apply to:                                                       │
│ ○ This project only                                            │
│ ● All projects (global)                                        │
│                                                                 │
│ Preview:                                                        │
│ ┌─────────────────────────────────────┐                        │
│ │         [  Success  ]               │                        │
│ └─────────────────────────────────────┘                        │
│                                                                 │
│ [Cancel]                                    [Save Variant]     │
└─────────────────────────────────────────────────────────────────┘
```

### Storage

```typescript
interface CustomVariant extends VariantConfig {
  name: string;
  nodeType: string;
  scope: 'project' | 'global';
  createdAt: Date;
}

// Project-scoped variants stored in project file
// Global variants stored in user preferences
```

---

## Testing Strategy

### Unit Tests

- Config registry operations
- Variant style resolution
- State style merging
- Token reference resolution in variants

### Integration Tests

- Node creation applies defaults
- Variant change updates styles
- State changes reflect visually
- Custom variants persist

### Manual Testing Checklist

- [ ] Create Button, verify styled by default
- [ ] Change Button variant, see instant update
- [ ] Create Group with "card" variant
- [ ] Create Text with "heading-1" variant
- [ ] **Test Text bug fix**: Two Text elements in row layout share space
- [ ] Create custom variant and reuse it
- [ ] Hover/active/disabled states work correctly

---

## Success Criteria

- [ ] All listed nodes have default configs
- [ ] Variant dropdown appears in property panel
- [ ] Variants reference tokens correctly
- [ ] State styles apply on interaction
- [ ] Custom variant creation works
- [ ] **Text element bug is fixed**
- [ ] No regression in existing projects

---

## Dependencies

**Blocked By:**
- STYLE-001 (Token System) - variants reference tokens

**Blocks:**
- STYLE-004 (Property Panel UX) - uses variant selector

---

*Last Updated: January 2026*
