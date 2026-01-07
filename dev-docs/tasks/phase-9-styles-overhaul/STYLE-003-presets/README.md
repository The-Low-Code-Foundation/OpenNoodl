# STYLE-003: Style Presets System

## Overview

Create a library of style presets (Modern, Minimal, Playful, Enterprise) that users can choose when creating a new project. Each preset defines token values that cascade through the entire style system.

**Phase:** 8 (Styles Overhaul)  
**Priority:** HIGH  
**Effort:** 8-12 hours  
**Risk:** Low  
**Dependencies:** STYLE-001 (Token System), STYLE-002 (Element Configs)

---

## Background

### The Goal

When a user creates a new project, they should be able to:

1. Choose a visual style preset from a gallery
2. See live previews of what their UI will look like
3. Start building immediately with consistent, professional styling
4. Customize the preset later if desired

### Why Presets Matter

- **Beginners**: Don't know what colors/spacing to choose
- **Speed**: Skip the "design token setup" phase
- **Consistency**: Entire project has cohesive look from start
- **Exploration**: Easy to try different aesthetics

---

## Preset Definitions

### Modern (Default)

A clean, professional look with subtle shadows and medium rounding. Works for most applications.

```typescript
const ModernPreset: StylePreset = {
  name: 'Modern',
  description: 'Clean and professional with subtle depth',
  
  tokens: {
    // Colors
    '--primary': '#3b82f6',           // Blue
    '--primary-hover': '#2563eb',
    '--primary-foreground': '#ffffff',
    '--secondary': '#64748b',
    '--secondary-hover': '#475569',
    '--secondary-foreground': '#ffffff',
    '--destructive': '#ef4444',
    '--destructive-hover': '#dc2626',
    '--destructive-foreground': '#ffffff',
    '--muted': '#f1f5f9',
    '--muted-foreground': '#64748b',
    '--accent': '#f1f5f9',
    '--accent-foreground': '#0f172a',
    '--background': '#ffffff',
    '--foreground': '#0f172a',
    '--surface': '#f8fafc',
    '--border': '#e2e8f0',
    '--border-subtle': '#f1f5f9',
    '--ring': '#3b82f6',
    
    // Typography
    '--font-sans': 'Inter, ui-sans-serif, system-ui, sans-serif',
    
    // Borders
    '--radius-sm': '4px',
    '--radius-md': '8px',
    '--radius-lg': '12px',
    
    // Shadows
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  },
  
  preview: {
    primaryButton: '#3b82f6',
    cardBackground: '#ffffff',
    cardBorder: '#e2e8f0',
    textColor: '#0f172a',
    radius: '8px',
  }
};
```

### Minimal

Ultra-clean with sharp corners, no shadows, and monochromatic palette.

```typescript
const MinimalPreset: StylePreset = {
  name: 'Minimal',
  description: 'Ultra-clean with sharp edges and no shadows',
  
  tokens: {
    // Colors - Monochromatic
    '--primary': '#18181b',           // Near black
    '--primary-hover': '#27272a',
    '--primary-foreground': '#ffffff',
    '--secondary': '#71717a',
    '--secondary-hover': '#52525b',
    '--secondary-foreground': '#ffffff',
    '--destructive': '#dc2626',
    '--destructive-hover': '#b91c1c',
    '--destructive-foreground': '#ffffff',
    '--muted': '#f4f4f5',
    '--muted-foreground': '#71717a',
    '--accent': '#f4f4f5',
    '--accent-foreground': '#18181b',
    '--background': '#ffffff',
    '--foreground': '#18181b',
    '--surface': '#fafafa',
    '--border': '#e4e4e7',
    '--border-subtle': '#f4f4f5',
    '--ring': '#18181b',
    
    // Typography
    '--font-sans': 'system-ui, -apple-system, sans-serif',
    
    // Borders - Sharp
    '--radius-sm': '2px',
    '--radius-md': '4px',
    '--radius-lg': '6px',
    
    // Shadows - None
    '--shadow-sm': 'none',
    '--shadow-md': 'none',
    '--shadow-lg': 'none',
  },
  
  preview: {
    primaryButton: '#18181b',
    cardBackground: '#ffffff',
    cardBorder: '#e4e4e7',
    textColor: '#18181b',
    radius: '4px',
  }
};
```

### Playful

Vibrant colors, generous rounding, and friendly typography.

```typescript
const PlayfulPreset: StylePreset = {
  name: 'Playful',
  description: 'Vibrant colors and rounded, friendly shapes',
  
  tokens: {
    // Colors - Vibrant
    '--primary': '#8b5cf6',           // Purple
    '--primary-hover': '#7c3aed',
    '--primary-foreground': '#ffffff',
    '--secondary': '#ec4899',         // Pink
    '--secondary-hover': '#db2777',
    '--secondary-foreground': '#ffffff',
    '--destructive': '#f43f5e',       // Rose
    '--destructive-hover': '#e11d48',
    '--destructive-foreground': '#ffffff',
    '--muted': '#faf5ff',
    '--muted-foreground': '#6b7280',
    '--accent': '#fce7f3',
    '--accent-foreground': '#831843',
    '--background': '#ffffff',
    '--foreground': '#1e1b4b',
    '--surface': '#faf5ff',
    '--border': '#e9d5ff',
    '--border-subtle': '#faf5ff',
    '--ring': '#8b5cf6',
    
    // Typography - Friendly
    '--font-sans': '"Nunito", "Quicksand", ui-sans-serif, sans-serif',
    
    // Borders - Very Rounded
    '--radius-sm': '8px',
    '--radius-md': '16px',
    '--radius-lg': '24px',
    '--radius-full': '9999px',
    
    // Shadows - Soft colored
    '--shadow-sm': '0 1px 3px rgb(139 92 246 / 0.1)',
    '--shadow-md': '0 4px 12px rgb(139 92 246 / 0.15)',
  },
  
  preview: {
    primaryButton: '#8b5cf6',
    cardBackground: '#faf5ff',
    cardBorder: '#e9d5ff',
    textColor: '#1e1b4b',
    radius: '16px',
  }
};
```

### Enterprise

Conservative, trustworthy palette with traditional styling.

```typescript
const EnterprisePreset: StylePreset = {
  name: 'Enterprise',
  description: 'Professional and trustworthy for business applications',
  
  tokens: {
    // Colors - Conservative
    '--primary': '#0f172a',           // Dark navy
    '--primary-hover': '#1e293b',
    '--primary-foreground': '#ffffff',
    '--secondary': '#475569',
    '--secondary-hover': '#334155',
    '--secondary-foreground': '#ffffff',
    '--destructive': '#b91c1c',
    '--destructive-hover': '#991b1b',
    '--destructive-foreground': '#ffffff',
    '--muted': '#f1f5f9',
    '--muted-foreground': '#475569',
    '--accent': '#e2e8f0',
    '--accent-foreground': '#0f172a',
    '--background': '#ffffff',
    '--foreground': '#0f172a',
    '--surface': '#f8fafc',
    '--border': '#cbd5e1',
    '--border-subtle': '#e2e8f0',
    '--ring': '#0f172a',
    
    // Typography - Traditional
    '--font-sans': '"Source Sans Pro", "Segoe UI", ui-sans-serif, sans-serif',
    
    // Borders - Conservative
    '--radius-sm': '2px',
    '--radius-md': '4px',
    '--radius-lg': '6px',
    
    // Shadows - Subtle
    '--shadow-sm': '0 1px 2px rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 2px 4px rgb(0 0 0 / 0.06), 0 1px 2px rgb(0 0 0 / 0.04)',
  },
  
  preview: {
    primaryButton: '#0f172a',
    cardBackground: '#ffffff',
    cardBorder: '#cbd5e1',
    textColor: '#0f172a',
    radius: '4px',
  }
};
```

### Soft

Gentle, calming aesthetic with soft colors and generous whitespace.

```typescript
const SoftPreset: StylePreset = {
  name: 'Soft',
  description: 'Gentle colors and soft shapes for a calming aesthetic',
  
  tokens: {
    // Colors - Soft/Muted
    '--primary': '#6366f1',           // Indigo
    '--primary-hover': '#4f46e5',
    '--primary-foreground': '#ffffff',
    '--secondary': '#a78bfa',         // Light purple
    '--secondary-hover': '#8b5cf6',
    '--secondary-foreground': '#ffffff',
    '--destructive': '#fb7185',       // Soft red
    '--destructive-hover': '#f43f5e',
    '--destructive-foreground': '#ffffff',
    '--muted': '#f5f3ff',
    '--muted-foreground': '#6b7280',
    '--accent': '#ede9fe',
    '--accent-foreground': '#4c1d95',
    '--background': '#fefefe',
    '--foreground': '#374151',
    '--surface': '#f9fafb',
    '--border': '#e5e7eb',
    '--border-subtle': '#f3f4f6',
    '--ring': '#6366f1',
    
    // Typography
    '--font-sans': '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    
    // Borders - Soft rounded
    '--radius-sm': '6px',
    '--radius-md': '12px',
    '--radius-lg': '20px',
    
    // Shadows - Very soft
    '--shadow-sm': '0 1px 3px rgb(0 0 0 / 0.02)',
    '--shadow-md': '0 4px 6px rgb(0 0 0 / 0.04)',
  },
  
  preview: {
    primaryButton: '#6366f1',
    cardBackground: '#fefefe',
    cardBorder: '#e5e7eb',
    textColor: '#374151',
    radius: '12px',
  }
};
```

---

## Implementation

### Phase 1: Preset Data Structure (2-3 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/models/
├── StylePresets/
│   ├── StylePresetsModel.ts     # Preset management
│   ├── presets/
│   │   ├── ModernPreset.ts
│   │   ├── MinimalPreset.ts
│   │   ├── PlayfulPreset.ts
│   │   ├── EnterprisePreset.ts
│   │   ├── SoftPreset.ts
│   │   └── index.ts
│   ├── StylePresetTypes.ts      # TypeScript interfaces
│   └── index.ts
```

**TypeScript Interfaces:**

```typescript
interface StylePreset {
  id: string;
  name: string;
  description: string;
  tokens: Record<string, string>;
  preview: PresetPreview;
  isBuiltIn: boolean;
  createdAt?: Date;
}

interface PresetPreview {
  primaryButton: string;
  cardBackground: string;
  cardBorder: string;
  textColor: string;
  radius: string;
}

interface StylePresetsModel {
  builtInPresets: StylePreset[];
  customPresets: StylePreset[];
  
  getPreset(id: string): StylePreset | undefined;
  applyPreset(presetId: string): void;
  saveCustomPreset(preset: Omit<StylePreset, 'id' | 'isBuiltIn'>): StylePreset;
  deleteCustomPreset(id: string): void;
  exportPreset(id: string): string; // JSON
  importPreset(json: string): StylePreset;
}
```

### Phase 2: Preset Selector Component (3-4 hrs)

**Files to create:**

```
packages/noodl-core-ui/src/components/
├── StylePresets/
│   ├── PresetSelector.tsx       # Main selector component
│   ├── PresetSelector.module.scss
│   ├── PresetSelector.stories.tsx
│   ├── PresetCard.tsx           # Individual preset card
│   ├── PresetPreview.tsx        # Live preview mini-UI
│   └── index.ts
```

**PresetSelector UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ STYLE PRESET                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Choose a visual style for your project:                        │
│                                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ Modern  │ │ Minimal │ │ Playful │ │  Corp   │ │  Soft   │   │
│ │         │ │         │ │         │ │         │ │         │   │
│ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │ │ ┌─────┐ │   │
│ │ │ btn │ │ │ │ btn │ │ │ │ btn │ │ │ │ btn │ │ │ │ btn │ │   │
│ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │ │ └─────┘ │   │
│ │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │   │
│ │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │ │ ─────── │   │
│ │ ███████ │ │ ███████ │ │ ███████ │ │ ███████ │ │ ███████ │   │
│ └────●────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│   Selected                                                      │
│                                                                 │
│ "Clean and professional with subtle depth"                     │
│                                                                 │
│ [Customize After Creation]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**PresetCard Component:**

```typescript
interface PresetCardProps {
  preset: StylePreset;
  isSelected: boolean;
  onSelect: (presetId: string) => void;
}

function PresetCard({ preset, isSelected, onSelect }: PresetCardProps) {
  return (
    <div 
      className={cn(css.PresetCard, isSelected && css.Selected)}
      onClick={() => onSelect(preset.id)}
    >
      <PresetPreview preview={preset.preview} />
      <span className={css.PresetName}>{preset.name}</span>
    </div>
  );
}
```

### Phase 3: Project Creation Integration (2-3 hrs)

**Files to modify:**

```
packages/noodl-editor/src/editor/src/views/
├── NewProjectDialog/
│   ├── NewProjectDialog.tsx     # Add preset selector
│   └── NewProjectDialog.module.scss

packages/noodl-editor/src/editor/src/models/
├── ProjectModel.ts              # Apply preset on creation
```

**Integration Points:**

```typescript
// In NewProjectDialog.tsx
function NewProjectDialog() {
  const [selectedPreset, setSelectedPreset] = useState('modern');
  
  const handleCreate = async () => {
    const project = await ProjectModel.create({
      name: projectName,
      // ... other options
    });
    
    // Apply selected preset's tokens
    const preset = StylePresetsModel.getPreset(selectedPreset);
    if (preset) {
      StyleTokensModel.applyPreset(preset.tokens);
    }
    
    // Open project
    EditorModel.openProject(project);
  };
  
  return (
    <Dialog>
      {/* ... name input ... */}
      <PresetSelector 
        selected={selectedPreset}
        onSelect={setSelectedPreset}
      />
      {/* ... other options ... */}
      <Button onClick={handleCreate}>Create Project</Button>
    </Dialog>
  );
}
```

### Phase 4: Preset Management UI (2-3 hrs)

**Files to create:**

```
packages/noodl-editor/src/editor/src/views/panels/
├── PresetManagerPanel/
│   ├── PresetManagerPanel.tsx   # Full preset management
│   ├── PresetManagerPanel.module.scss
│   ├── CreatePresetDialog.tsx
│   └── index.ts
```

**Features:**

1. View all presets (built-in + custom)
2. Create preset from current tokens
3. Edit custom presets
4. Delete custom presets
5. Import/Export presets

---

## Custom Preset Creation

### From Project Settings

```
┌─────────────────────────────────────────────────────────────────┐
│ SAVE AS PRESET                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Save your current token configuration as a reusable preset.    │
│                                                                 │
│ Preset Name: [My Brand Style       ]                           │
│ Description: [Corporate brand colors]                          │
│                                                                 │
│ Preview:                                                        │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │  ┌──────┐                                                 │   │
│ │  │ btn  │  Heading Text                                   │   │
│ │  └──────┘  Body text preview with current styling         │   │
│ │  ┌──────────────────────────────────────────────────┐     │   │
│ │  │  Card preview with surface color                 │     │   │
│ │  └──────────────────────────────────────────────────┘     │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ [Cancel]                                     [Save Preset]      │
└─────────────────────────────────────────────────────────────────┘
```

### Import/Export

```typescript
// Export format (JSON)
{
  "name": "My Brand Style",
  "description": "Corporate brand colors",
  "version": "1.0",
  "tokens": {
    "--primary": "#1a73e8",
    "--primary-hover": "#1557b0",
    // ... all token values
  }
}
```

---

## Testing Strategy

### Unit Tests

- Preset loading and parsing
- Token application
- Custom preset CRUD operations
- Import/export JSON serialization

### Integration Tests

- Preset selection in new project dialog
- Tokens apply correctly to elements
- Custom presets persist across sessions

### Manual Testing Checklist

- [ ] Create project with each built-in preset
- [ ] Verify elements styled correctly per preset
- [ ] Create custom preset from current tokens
- [ ] Import preset from JSON
- [ ] Export preset to JSON
- [ ] Delete custom preset
- [ ] Preset preview matches actual result

---

## Success Criteria

- [ ] 5 built-in presets available
- [ ] Preset selector in project creation dialog
- [ ] Live preview in preset cards
- [ ] Custom preset creation works
- [ ] Import/export functionality
- [ ] Presets correctly populate all tokens

---

## Future Considerations

### Dark Mode Variants

Each preset could have light/dark variants:

```typescript
interface StylePreset {
  // ...
  modes: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}
```

### Community Presets

Allow sharing presets via:
- Export as JSON file
- Copy/paste shareable code
- (Future) Community preset gallery

### Preset Inheritance

Allow presets to extend other presets:

```typescript
const MyPreset = {
  extends: 'modern',
  tokens: {
    '--primary': '#custom-color', // Override just this
    // Other tokens inherited from 'modern'
  }
};
```

---

## Dependencies

**Blocked By:**
- STYLE-001 (Token System) - presets populate tokens
- STYLE-002 (Element Configs) - tokens flow to variants

**Blocks:**
- WIZARD-001 (Project Wizard) - uses preset selector

---

*Last Updated: January 2026*
